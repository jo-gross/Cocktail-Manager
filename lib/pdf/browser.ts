/**
 * Shared Chromium connection for server-side PDF rendering (cocktail export,
 * guest menu print, table tents). Connects to the remote Chromium at
 * `CHROMIUM_HOST:9222` (DNS-resolved first, then by hostname), localhost, or
 * launches a local Chromium when no host is configured.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { promises as dnsPromises } from 'dns';

/** True if a Chromium PDF service is configured (same check as `/api/chromium-status`). */
export function isPdfServiceConfigured(): boolean {
  return !!process.env.CHROMIUM_HOST;
}

export async function connectPdfBrowser(): Promise<Browser> {
  const chromiumHost = process.env.CHROMIUM_HOST;
  console.debug('chromiumHost', chromiumHost);

  if (chromiumHost && chromiumHost !== 'localhost' && chromiumHost !== '127.0.0.1') {
    console.debug('Fetching WebSocket URL from Chromium...');
    try {
      const { address: chromeIP } = await dnsPromises.lookup(chromiumHost);
      console.debug('Chromium IP:', chromeIP);
      const browserURL = `http://${chromeIP}:9222`;
      console.debug('Connecting to Chromium via browserURL:', browserURL);
      const browser = await puppeteer.connect({ browserURL });
      console.debug('Successfully connected via DNS-resolved IP');
      return browser;
    } catch (dnsError) {
      console.error('DNS lookup failed, trying hostname directly:', dnsError);
      const browserURL = `http://${chromiumHost}:9222`;
      const browser = await puppeteer.connect({ browserURL });
      console.debug('Successfully connected via hostname');
      return browser;
    }
  }
  if (chromiumHost === 'localhost' || chromiumHost === '127.0.0.1') {
    console.debug('Connecting to localhost Chromium');
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
    console.debug('Successfully connected to localhost');
    return browser;
  }
  console.debug('No Chromium host specified, launching local Chromium - assuming it is installed at the instance');
  return puppeteer.launch();
}

export async function disconnectPdfBrowser(browser: Browser | undefined): Promise<void> {
  if (!browser) return;
  try {
    await browser.disconnect();
  } catch (disconnectError) {
    console.error('Error disconnecting browser:', disconnectError);
  }
}

/** Opens a page, runs `fn` and always closes the page + disconnects the browser. */
export async function withPdfPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  let browser: Browser | undefined;
  let page: Page | undefined;
  try {
    browser = await connectPdfBrowser();
    page = await browser.newPage();
    return await fn(page);
  } finally {
    if (page) await page.close().catch((error) => console.error('Error closing page:', error));
    await disconnectPdfBrowser(browser);
  }
}

export interface RenderHtmlToPdfOptions {
  /** CSS `@page` size is used (`preferCSSPageSize`); `format` is only the fallback. */
  format?: 'A4' | 'A5' | 'A6';
  timeoutMs?: number;
  /**
   * Default `false`: every request except `data:`/`about:`/`blob:` is aborted and
   * page JavaScript is disabled (user-authored HTML/CSS must never reach the
   * network – SSRF / tracking). Only set `true` for trusted documents.
   */
  allowNetwork?: boolean;
}

const OFFLINE_URL = /^(data|about|blob):/i;

/** Blocks all network requests and page scripts (defence in depth for user-authored documents). */
export async function lockDownPage(page: Page): Promise<void> {
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return;
    if (OFFLINE_URL.test(request.url())) void request.continue();
    else void request.abort('blockedbyclient');
  });
}

/** Renders a self-contained HTML document (no external requests needed) to PDF. */
export async function renderHtmlToPdf(html: string, options: RenderHtmlToPdfOptions = {}): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  return withPdfPage(async (page) => {
    page.setDefaultTimeout(timeoutMs);
    if (!options.allowNetwork) await lockDownPage(page);
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    try {
      // DevTools evaluation still works with page scripts disabled.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
    } catch (error) {
      console.warn('[pdf] waiting for fonts failed', error);
    }
    const pdf = await page.pdf({
      format: options.format ?? 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  });
}
