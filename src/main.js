import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

const input = await Actor.getInput() || {};
const {
  scenario = 'smoke-home',
  baseUrl = 'https://kurs-ing-web-portal-804574293440.europe-north1.run.app',
  loginEmail,
  loginPassword,
} = input;

const result = {
  scenario,
  baseUrl,
  status: 'unknown',
  error: null,
  screenshots: [],
};

async function takeScreenshot(page, label) {
  try {
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const key = `${label}.png`;
    await Actor.setValue(key, screenshotBuffer, { contentType: 'image/png' });
    result.screenshots.push({ label, key });
  } catch (err) {
    console.error(`Screenshot failed for \${label}:`, err);
  }
}

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage();

try {
  if (scenario === 'smoke-home') {
    await page.goto(baseUrl);
    await takeScreenshot(page, 'home');
    const title = await page.title();
    if (title) {
      result.status = 'passed';
    } else {
      result.status = 'failed';
      result.error = 'No page title found';
    }
  } else if (scenario === 'login-student') {
    const email = loginEmail || 'student.owner@kurs.ing';
    const password = loginPassword || 'student123';
    await page.goto(`\${baseUrl}/login`);
    await takeScreenshot(page, 'before-login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 10000 });
    await takeScreenshot(page, 'after-login');
    const url = page.url();
    if (url.includes('/dashboard') || url.includes('/courses')) {
      result.status = 'passed';
    } else {
      result.status = 'failed';
      result.error = 'Did not navigate to dashboard after login';
    }
  } else if (scenario === 'login-owner') {
    const email = loginEmail || 'owner@kurs.ing';
    const password = loginPassword || 'owner123';
    await page.goto(`\${baseUrl}/login`);
    await takeScreenshot(page, 'before-login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 10000 });
    await takeScreenshot(page, 'after-login');
    const url = page.url();
    if (url.includes('/admin') || url.includes('/dashboard')) {
      result.status = 'passed';
    } else {
      result.status = 'failed';
      result.error = 'Did not navigate to admin/dashboard after login';
    }
  } else if (scenario === 'checkout-etablerer') {
    await page.goto(`\${baseUrl}/checkout?plan=etablerer`);
    await takeScreenshot(page, 'checkout-page');
    const hasStripe = await page.locator('iframe[title*="Stripe"]').count() > 0;
    if (hasStripe) {
      result.status = 'passed';
    } else {
      result.status = 'failed';
      result.error = 'Stripe payment element not found';
    }
  } else {
    result.status = 'failed';
    result.error = `Unknown scenario: \${scenario}`;
  }
} catch (err) {
  result.status = 'error';
  result.error = err.message || String(err);
} finally {
  await takeScreenshot(page, `final-\${scenario}`);
  await browser.close();
  await Actor.setValue('RESULT', result);
  console.log('Test complete:', result);
  await Actor.exit();
}
