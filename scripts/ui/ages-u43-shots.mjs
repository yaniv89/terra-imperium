// scripts/ui/ages-u43-shots.mjs
// U43 (eight ages): the per-age top bar strip at the phone (844x390), English and Hebrew, into
// audits/ages-u43/. The game sets <html data-age> from the player's age (stone at the start);
// the other seven are forced on the attribute to show their CSS.
//   npx vite --port 5243, then: node scripts/ui/ages-u43-shots.mjs [--url http://localhost:5243/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5243/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/ages-u43');
fs.mkdirSync(OUT, { recursive: true });
const AGES = ['stone', 'bronze', 'classical', 'kingdoms', 'gunpowder', 'modern', 'information', 'future'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const run = async (browser, name, he) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  if (he) await click(page.getByTestId('lang-he'));
  await page.fill(he ? 'input[aria-label="חיפוש עמים"]' : 'input[aria-label="Search peoples"]', he ? 'אכד' : 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: he ? /^מתחילים/ : /^Begin as/ }));
  const skip = page.getByRole('button', { name: he ? 'דילוג' : 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 });
  await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  console.log(name, 'game age attribute:', await page.evaluate(() => document.documentElement.dataset.age));
  for (const age of AGES) {
    await page.evaluate((a) => { document.documentElement.dataset.age = a; }, age);
    await wait(200);
    await page.screenshot({ path: path.join(OUT, `${name}-${age}.png`), clip: { x: 0, y: 0, width: 844, height: 120 } });
  }
  await page.screenshot({ path: path.join(OUT, `${name}-full-future.png`) });
  console.log(name, 'page errors:', errors.length ? errors : 'none');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone', false);
await run(browser, 'phone-he', true);
await browser.close();
