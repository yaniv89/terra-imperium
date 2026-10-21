// scripts/ui/ages-u42-shots.mjs
// U42 (eight ages): screenshots of the Stone start screen, the band onboarding card, the band prompt
// and the research web with its jump strip, at the phone (844x390) and desktop, into audits/ages-u42/.
//   npx vite --port 5231, then: node scripts/ui/ages-u42-shots.mjs [--url http://localhost:5231/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5231/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/ages-u42');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const run = async (browser, name, viewport, mobile, he = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (n) => { await wait(600); await page.screenshot({ path: path.join(OUT, `${name}-${n}.png`), timeout: 120000 }); };
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  if (he) await click(page.getByTestId('lang-he'));
  await page.fill(he ? 'input[aria-label="חיפוש עמים"]' : 'input[aria-label="Search peoples"]', he ? 'אכד' : 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await shot('1-start');
  await click(page.getByRole('button', { name: he ? /^מתחילים/ : /^Begin as/ }));
  const next = page.getByRole('button', { name: he ? 'הבא' : 'Next', exact: true });
  await next.waitFor({ state: 'visible', timeout: 30000 });
  await click(next);
  await shot('2-onboarding-band');
  await click(page.getByRole('button', { name: he ? 'דילוג' : 'Skip' }));
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await shot('3-band-prompt');
  // The research sheet, web view: Tech tab.
  await page.evaluate(() => window.__openTab?.('tech'));
  const tab = page.getByRole('button', { name: he ? /^מחקר/ : /^(Tech|Research)/ }).first();
  await click(tab);
  await page.getByTestId('research-web-toggle').waitFor({ timeout: 15000 });
  await click(page.getByTestId('research-web-toggle'));
  await page.getByTestId('research-age-strip').waitFor({ timeout: 10000 });
  await shot('4-research-age-strip');
  await click(page.getByTestId('jump-bronze'));
  await shot('5-research-jump-bronze');
  console.log(name, 'web:', await page.getByTestId('research-web').count());
  console.log(name, 'page errors:', errors.length ? errors : 'none');
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone', { width: 844, height: 390 }, true);
await run(browser, 'desktop', { width: 1280, height: 800 }, false);
await run(browser, 'phone-he', { width: 844, height: 390 }, true, true);
await browser.close();
