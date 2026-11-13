import { NextApiRequest, NextApiResponse } from 'next';
import { lookup } from 'dns/promises';
import HTTPMethod from 'http-method-enum';
import type { HTTPRequest, Page } from 'puppeteer-core';
import { z } from 'zod';

// @ts-expect-error jssoup has no type declarations
import JSSoup from 'jssoup';
import { User } from '@generated/prisma/client';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { isPublicImageAddress } from '@lib/guest-menu/workspaceImage.server';
import { isHostAllowed, parseSafeUrl, REMOTE_IMAGE_CONTENT_TYPES, safeFetch, SafeFetchError } from '@lib/http/safeFetch';
import { TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { sendFail } from '@lib/http/responses';
import { withPdfPage } from '@lib/pdf/browser';

interface ResponseBody {
  name: string;
  image?: string;
  price: number;
  volume: number;
}

type Soup = {
  find: (...args: unknown[]) => Soup | undefined;
  attrs?: Record<string, string>;
  text?: string;
  contents?: Array<{ attrs?: Record<string, string>; _text?: string }>;
};

const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'];
const MAX_PAGE_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const NAVIGATION_TIMEOUT_MS = 20_000;

/** Each scraper only ever fetches its own shop (exact host or subdomain); images may come from any public host. */
const SCRAPERS = {
  conalco: ['conalco.de', '.conalco.de'],
  expert24: ['expert24.com', '.expert24.com', 'delicando.com', '.delicando.com'],
  rumundco: ['rumundco.de', '.rumundco.de'],
  metro: ['metro.de', '.metro.de'],
} as const;
type ScraperId = keyof typeof SCRAPERS;

const QuerySchema = z.object({ url: z.string().trim().min(1).max(2048) });

/** Per user: scraping costs outbound requests (and a browser page for metro). */
const scraperLimiter = new TokenBucketRateLimiter({ capacity: 10, refillPerSecond: 10 / 60 });

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function fetchPage(url: string, scraper: ScraperId) {
  const page = await safeFetch(url, {
    allowedHosts: [...SCRAPERS[scraper]],
    accept: HTML_CONTENT_TYPES,
    maxBytes: MAX_PAGE_BYTES,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  return { soup: new JSSoup(page.body.toString('utf-8')) as Soup, pageUrl: page.url };
}

/** Downloads a product image (raster only, size-capped) as data URI with its real content type. */
async function fetchImage(src: string | null | undefined, baseUrl: string): Promise<string | undefined> {
  if (!src) return undefined;
  try {
    const image = await safeFetch(new URL(src, baseUrl).href, { accept: REMOTE_IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES, timeoutMs: FETCH_TIMEOUT_MS });
    if (image.body.length === 0) return undefined;
    return `data:${image.contentType};base64,${image.body.toString('base64')}`;
  } catch (error) {
    console.warn('[scraper] product image could not be loaded:', error instanceof SafeFetchError ? error.reason : 'unknown error');
    return undefined;
  }
}

async function scrapeConalco(url: string): Promise<ResponseBody> {
  const { soup, pageUrl } = await fetchPage(url, 'conalco');
  const imageUrl = soup.find('div', { class: 'cms-element-image-gallery' })?.find('img')?.attrs?.src;
  const name = soup.find('h1', 'product-detail-name')?.text?.replace('\n', '')?.trim() ?? '';
  const price = soup.find('meta', { itemprop: 'price' })?.attrs?.content ?? 0;
  const volume = toNumber(soup.find('span', 'price-unit-content')?.text?.trim()?.split(' ')?.[0]) * 100;
  return { name, image: await fetchImage(imageUrl, pageUrl), price: toNumber(price), volume: toNumber(volume) };
}

async function scrapeExpert24(url: string): Promise<ResponseBody> {
  const { soup, pageUrl } = await fetchPage(url, 'expert24');
  const imageUrl = soup.find('div', 'activeImage')?.contents?.[0]?.attrs?.href;
  const name = soup.find('h1', 'item-detail__headline')?.text?.replace('\n', '')?.trim() ?? '';
  const price = soup.find('div', 'undiscountedPrice')?.contents?.[0]?._text?.trim()?.replace(',', '.')?.replace('€', '')?.trim() ?? 0;
  const volume = toNumber(name.split('Vol. ')?.[1]?.split(' ')?.[0]?.replace(',', '.')?.replace('l', '')?.replace('ml', '')) * 100;
  return { name, image: await fetchImage(imageUrl, pageUrl), price: toNumber(price), volume: toNumber(volume) };
}

async function scrapeRumundco(url: string): Promise<ResponseBody> {
  const { soup, pageUrl } = await fetchPage(url, 'rumundco');
  const imageUrl = soup.find('meta', { property: 'og:image' })?.attrs?.content;
  const name = soup.find('meta', { property: 'og:title' })?.attrs?.content ?? '';
  const price = soup.find('meta', { itemprop: 'price' })?.attrs?.content ?? 0;
  const volumeText = soup.find('span', 'price-unit-content')?.text?.replace('\n', '').replace(',', '.').trim().split(' ')[0].trim();
  return { name, image: await fetchImage(imageUrl, pageUrl), price: toNumber(price), volume: toNumber(volumeText) * 100 };
}

/** Lets the browser load only public http(s) addresses (and inline data/blob URLs). */
async function isPublicBrowserRequest(rawUrl: string): Promise<boolean> {
  if (/^(data|blob|about):/i.test(rawUrl)) return true;
  try {
    const url = parseSafeUrl(rawUrl);
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => isPublicImageAddress(address));
  } catch {
    return false;
  }
}

async function guardBrowserRequests(page: Page): Promise<void> {
  await page.setRequestInterception(true);
  page.on('request', (request: HTTPRequest) => {
    if (request.isInterceptResolutionHandled()) return;
    void isPublicBrowserRequest(request.url()).then((allowed) => {
      if (request.isInterceptResolutionHandled()) return;
      void (allowed ? request.continue() : request.abort('blockedbyclient')).catch(() => undefined);
    });
  });
}

async function scrapeMetro(url: string): Promise<ResponseBody> {
  const target = parseSafeUrl(url, [...SCRAPERS.metro]);
  if (target.protocol !== 'https:') throw new SafeFetchError('INVALID_URL', 'Only https URLs are supported for this shop');

  const scraped = await withPdfPage(async (page) => {
    page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
    await guardBrowserRequests(page);
    await page.goto(target.href, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT_MS });
    // Redirects must not leave the shop.
    if (!isHostAllowed(new URL(page.url()).hostname, [...SCRAPERS.metro])) throw new SafeFetchError('HOST_NOT_ALLOWED', 'Host is not allowed');

    const imageUrl = await page.$eval('#mainImage', (el: Element) => (el as HTMLImageElement).src).catch(() => null);
    const name = (await page.$eval('div.mfcss_article-detail--title > h2 > span', (el: Element) => el.textContent || '').catch(() => '')) ?? '';
    const priceText = await page
      .$$eval(
        'div.mfcss_article-detail--price-container > div.row > div.text-right > div > span.mfcss_article-detail--price-breakdown > span > span',
        (elements: Element[]) => elements.map((el) => el.textContent || ''),
      )
      .catch(() => [] as string[]);
    return { imageUrl, name, pageUrl: page.url(), price: priceText?.[1]?.replace(',', '.')?.replace('€', '')?.trim() ?? 0 };
  });

  return { name: scraped.name.trim(), image: await fetchImage(scraped.imageUrl, scraped.pageUrl), price: toNumber(scraped.price), volume: 0 };
}

const SCRAPE: Record<ScraperId, (url: string) => Promise<ResponseBody>> = {
  conalco: scrapeConalco,
  expert24: scrapeExpert24,
  rumundco: scrapeRumundco,
  metro: scrapeMetro,
};

/** Picks the scraper by the URL's exact host (never by substring). */
export function findScraper(rawUrl: string): ScraperId | null {
  let url: URL;
  try {
    url = parseSafeUrl(rawUrl);
  } catch {
    return null;
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  return (Object.keys(SCRAPERS) as ScraperId[]).find((id) => isHostAllowed(hostname, [...SCRAPERS[id]])) ?? null;
}

export default withHttpMethods({
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const limit = scraperLimiter.take(`scraper:${user.id}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return sendFail(res, 429, 'RATE_LIMITED', 'Too many requests');
    }

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request query', parsed.error.issues);

    const scraper = findScraper(parsed.data.url);
    if (!scraper) return sendFail(res, 400, 'URL_NOT_SUPPORTED', 'URL not allowed');

    try {
      return res.json(await SCRAPE[scraper](parsed.data.url));
    } catch (error) {
      if (error instanceof SafeFetchError) return sendFail(res, 400, 'FETCH_FAILED', 'The page could not be loaded');
      throw error;
    }
  }),
});
