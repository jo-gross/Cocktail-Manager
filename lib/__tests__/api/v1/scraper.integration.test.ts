import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ safeFetch: vi.fn(), withPdfPage: vi.fn() }));

// Network is mocked; URL parsing/host checks (parseSafeUrl, isHostAllowed) stay real.
vi.mock('@lib/http/safeFetch', async (importOriginal) => ({ ...(await importOriginal<typeof import('@lib/http/safeFetch')>()), safeFetch: mocks.safeFetch }));
vi.mock('@lib/pdf/browser', () => ({ withPdfPage: mocks.withPdfPage, isPdfServiceConfigured: () => false }));

import ingredientScraper, { findScraper } from '../../../../pages/api/scraper/ingredient';
import imageProxy from '../../../../pages/api/scraper/image';
import { REMOTE_IMAGE_CONTENT_TYPES, SafeFetchError } from '@lib/http/safeFetch';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { seedWorkspace } from '@test/helpers/dbFixtures';
import { errorCodeOf } from '@test/helpers/scenario';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function userHeaders() {
  const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
  return sessionCookie(seeded.users[0]!.sessionToken);
}

beforeEach(() => {
  mocks.safeFetch.mockReset();
  mocks.withPdfPage.mockReset();
});

describe('scraper host matching', () => {
  it('matches exact shop hosts and subdomains only', () => {
    expect(findScraper('https://www.conalco.de/gin')).toBe('conalco');
    expect(findScraper('https://conalco.de/gin')).toBe('conalco');
    expect(findScraper('https://shop.delicando.com/x')).toBe('expert24');
    expect(findScraper('https://www.metro.de/x')).toBe('metro');
    for (const url of [
      'http://169.254.169.254/?conalco.de',
      'http://169.254.169.254/conalco.de',
      'https://conalco.de.evil.example/',
      'https://evilconalco.de/',
      'https://conalco.de:8443/',
      'https://user:pw@conalco.de/',
      'file:///etc/passwd?conalco.de',
      'http://localhost/metro.de',
      'not a url conalco.de',
    ]) {
      expect(findScraper(url), url).toBeNull();
    }
  });
});

describe('GET /api/scraper/ingredient', () => {
  it('requires a session and GET', async () => {
    expect((await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'https://www.conalco.de/x' } })).status).toBe(401);
    const headers = await userHeaders();
    expect((await invokeHandler(ingredientScraper, { method: 'POST', query: { url: 'https://www.conalco.de/x' }, headers })).status).toBe(405);
    expect(mocks.safeFetch).not.toHaveBeenCalled();
  });

  it('rejects SSRF URLs without any request', async () => {
    const headers = await userHeaders();
    for (const url of ['http://169.254.169.254/latest/meta-data/?conalco.de', 'http://127.0.0.1/expert24.com', 'http://metro.de.internal/']) {
      const result = await invokeHandler(ingredientScraper, { method: 'GET', query: { url }, headers });
      expect(result.status, url).toBe(400);
      expect(errorCodeOf(result)).toBe('URL_NOT_SUPPORTED');
    }
    expect((await invokeHandler(ingredientScraper, { method: 'GET', query: {}, headers })).status).toBe(400);
    // metro only via https, and never opens the browser for rejected URLs.
    const metro = await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'http://www.metro.de/product' }, headers });
    expect(metro.status).toBe(400);
    expect(mocks.safeFetch).not.toHaveBeenCalled();
    expect(mocks.withPdfPage).not.toHaveBeenCalled();
  });

  it('fetches the page only from the shop and the image as raster with its real content type', async () => {
    const headers = await userHeaders();
    mocks.safeFetch.mockImplementation(async (url: string, options: { accept?: unknown[] }) => {
      if (url === 'https://www.conalco.de/gin') {
        const html =
          '<html><body><h1 class="product-detail-name">Gin\n</h1><meta itemprop="price" content="19.90"/>' +
          '<span class="price-unit-content">0.7 Liter</span><div class="cms-element-image-gallery"><img src="/media/gin.webp"/></div></body></html>';
        return { url, status: 200, contentType: 'text/html', body: Buffer.from(html) };
      }
      if (url === 'https://www.conalco.de/media/gin.webp' && options.accept === REMOTE_IMAGE_CONTENT_TYPES) {
        return { url, status: 200, contentType: 'image/webp', body: PNG_BYTES };
      }
      throw new SafeFetchError('HOST_NOT_ALLOWED', 'unexpected');
    });

    const result = await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'https://www.conalco.de/gin' }, headers });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ name: 'Gin', image: `data:image/webp;base64,${PNG_BYTES.toString('base64')}`, price: 19.9, volume: 70 });
    const [pageUrl, pageOptions] = mocks.safeFetch.mock.calls[0]!;
    expect(pageUrl).toBe('https://www.conalco.de/gin');
    expect(pageOptions).toMatchObject({ allowedHosts: ['conalco.de', '.conalco.de'], accept: ['text/html', 'application/xhtml+xml'] });
    expect(pageOptions.maxBytes).toBeGreaterThan(0);
  });

  it('reports upstream failures as 400 without internals and keeps the shape when only the image fails', async () => {
    const headers = await userHeaders();
    mocks.safeFetch.mockRejectedValueOnce(new SafeFetchError('ADDRESS_NOT_ALLOWED', 'Address is not allowed'));
    const failed = await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'https://www.rumundco.de/rum' }, headers });
    expect(failed.status).toBe(400);
    expect(JSON.stringify(failed.json)).not.toMatch(/Address|169\.254/);

    mocks.safeFetch
      .mockResolvedValueOnce({
        url: 'https://www.rumundco.de/rum',
        status: 200,
        contentType: 'text/html',
        body: Buffer.from('<meta property="og:image" content="http://10.0.0.1/x.png"/>'),
      })
      .mockRejectedValueOnce(new SafeFetchError('ADDRESS_NOT_ALLOWED', 'Address is not allowed'));
    const noImage = await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'https://www.rumundco.de/rum' }, headers });
    expect(noImage.status).toBe(200);
    expect(noImage.json).toEqual({ name: '', image: undefined, price: 0, volume: 0 });
  });

  it('rate-limits per user', async () => {
    const headers = await userHeaders();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'https://evil.example/' }, headers })).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    // Another user is not affected.
    expect((await invokeHandler(ingredientScraper, { method: 'GET', query: { url: 'https://evil.example/' }, headers: await userHeaders() })).status).toBe(400);
  });
});

describe('GET /api/scraper/image', () => {
  it('serves raster images with nosniff + sandbox CSP and never reflects other content types', async () => {
    const headers = await userHeaders();
    mocks.safeFetch.mockResolvedValueOnce({ url: 'https://cdn.example/a.png', status: 200, contentType: 'image/png', body: PNG_BYTES });
    const ok = await invokeHandler(imageProxy, { method: 'GET', query: { url: 'https://cdn.example/a.png' }, headers });
    expect(ok.status).toBe(200);
    expect(ok.headers).toMatchObject({ 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff' });
    expect(String(ok.headers['Content-Security-Policy'])).toContain('sandbox');
    expect(ok.body).toEqual(PNG_BYTES);
    const [, options] = mocks.safeFetch.mock.calls[0]!;
    expect(options).toMatchObject({ accept: REMOTE_IMAGE_CONTENT_TYPES, maxBytes: 5_000_000 });

    // SVG/HTML is rejected by safeFetch's accept list → 400 envelope, nothing reflected.
    mocks.safeFetch.mockRejectedValueOnce(new SafeFetchError('BAD_CONTENT_TYPE', 'Unexpected content type'));
    const svg = await invokeHandler(imageProxy, { method: 'GET', query: { url: 'https://evil.example/x.svg' }, headers });
    expect(svg.status).toBe(400);
    expect(errorCodeOf(svg)).toBe('NOT_AN_IMAGE');
    expect(svg.headers['Content-Type']).toBeUndefined();

    mocks.safeFetch.mockRejectedValueOnce(new SafeFetchError('ADDRESS_NOT_ALLOWED', 'Address is not allowed'));
    const internal = await invokeHandler(imageProxy, { method: 'GET', query: { url: 'http://169.254.169.254/' }, headers });
    expect(internal.status).toBe(400);
    expect(errorCodeOf(internal)).toBe('FETCH_FAILED');
  });

  it('requires a session, a url and GET', async () => {
    expect((await invokeHandler(imageProxy, { method: 'GET', query: { url: 'https://cdn.example/a.png' } })).status).toBe(401);
    const headers = await userHeaders();
    expect((await invokeHandler(imageProxy, { method: 'GET', query: {}, headers })).status).toBe(400);
    expect((await invokeHandler(imageProxy, { method: 'POST', query: { url: 'https://cdn.example/a.png' }, headers })).status).toBe(405);
    expect(mocks.safeFetch).not.toHaveBeenCalled();
  });
});
