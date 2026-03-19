import { chromium, type Page, type Browser } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'docs/screenshots';

interface ScreenshotConfig {
  name: string;
  path: string;
  waitForSelector?: string;
  delay?: number;
}

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const PAGES: ScreenshotConfig[] = [
  { name: 'workspaces', path: '/', waitForSelector: '[data-testid="workspace-list"]' },
  { name: 'cocktails-overview', path: '/manage/cocktails', waitForSelector: 'table, [class*="grid"]', delay: 1000 },
  { name: 'ingredients-overview', path: '/manage/ingredients', waitForSelector: 'table, [class*="grid"]', delay: 1000 },
  { name: 'glasses-overview', path: '/manage/glasses', waitForSelector: 'table, [class*="grid"]', delay: 1000 },
  { name: 'garnishes-overview', path: '/manage/garnishes', waitForSelector: 'table, [class*="grid"]', delay: 1000 },
  { name: 'cards-overview', path: '/manage/cards', delay: 1000 },
  { name: 'calculations-overview', path: '/manage/calculations', delay: 1000 },
  { name: 'statistics', path: '/manage/statistics', delay: 2000 },
  { name: 'settings', path: '/manage/settings', delay: 500 },
  { name: 'order-view', path: '/', waitForSelector: '[class*="card"]', delay: 1000 },
];

async function waitForAppReady(): Promise<void> {
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        console.log('App is ready');
        return;
      }
    } catch {
      // App not ready yet
    }
    console.log(`Waiting for app to be ready... (${i + 1}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('App did not become ready within timeout');
}

async function createDemoWorkspace(): Promise<{ workspaceId: string; userId: string }> {
  const response = await fetch(`${BASE_URL}/api/demo/create-workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to create demo workspace: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  console.log(`Demo workspace created: ${result.data.workspaceId}`);
  return { workspaceId: result.data.workspaceId, userId: result.data.userId };
}

async function authenticateDemo(page: Page, userId: string): Promise<void> {
  await page.goto(`${BASE_URL}/api/auth/signin`);
  await page.waitForLoadState('networkidle');

  const csrfResponse = await page.evaluate(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/auth/csrf`);
    return res.json();
  }, BASE_URL);

  await page.evaluate(
    async ({ baseUrl, csrfToken, userId }) => {
      const res = await fetch(`${baseUrl}/api/auth/callback/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          csrfToken,
          userId,
        }),
        redirect: 'follow',
      });
      return res.url;
    },
    { baseUrl: BASE_URL, csrfToken: csrfResponse.csrfToken, userId },
  );

  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  console.log('Authenticated as demo user');
}

async function takeScreenshot(
  page: Page,
  config: ScreenshotConfig,
  fullPath: string,
  viewport: { width: number; height: number },
  suffix: string,
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE_URL}${fullPath}`, { waitUntil: 'networkidle' });

  if (config.waitForSelector) {
    try {
      await page.waitForSelector(config.waitForSelector, { timeout: 5000 });
    } catch {
      console.warn(`Selector "${config.waitForSelector}" not found for ${config.name}, continuing anyway`);
    }
  }

  if (config.delay) {
    await new Promise((r) => setTimeout(r, config.delay));
  }

  const filename = `${OUTPUT_DIR}/${config.name}-${suffix}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`Screenshot saved: ${filename}`);
}

async function run(): Promise<void> {
  const { mkdir } = await import('fs/promises');
  await mkdir(OUTPUT_DIR, { recursive: true });

  await waitForAppReady();

  const { workspaceId, userId } = await createDemoWorkspace();

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await context.newPage();

  await authenticateDemo(page, userId);

  // Close any modals that might appear
  try {
    const modalCloseBtn = page.locator('[class*="modal"] button, dialog button');
    if (await modalCloseBtn.first().isVisible({ timeout: 2000 })) {
      await modalCloseBtn.first().click();
      await page.waitForTimeout(500);
    }
  } catch {
    // No modal to close
  }

  for (const config of PAGES) {
    const fullPath = config.name === 'workspaces' ? config.path : `/workspaces/${workspaceId}${config.path}`;

    try {
      await takeScreenshot(page, config, fullPath, DESKTOP_VIEWPORT, 'desktop');
      await takeScreenshot(page, config, fullPath, MOBILE_VIEWPORT, 'mobile');
    } catch (error) {
      console.error(`Failed to capture ${config.name}:`, error);
    }
  }

  await browser.close();
  console.log('All screenshots generated successfully');
}

run().catch((error) => {
  console.error('Screenshot generation failed:', error);
  process.exit(1);
});
