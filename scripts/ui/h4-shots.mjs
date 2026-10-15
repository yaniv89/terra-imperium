// scripts/ui/h4-shots.mjs
// A real-browser check of phase H4 / H4b (plans/hebrew-support-plan.md): game data names and proper
// names in Hebrew at 844x390: the map with its city banners, the rail panels (Research, Cities,
// Empire), a city panel, and a check that no Latin word shows in the opened views.
// Needs a dev server of THIS checkout (`npx vite --port 5199`). Screenshots go to plans/ui/h4/.
//   node scripts/ui/h4-shots.mjs [--url http://localhost:5199/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5199/terra-imperium/');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve('plans/ui/h4');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const main = async () => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (name) => { await wait(700); await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }); };
  await page.goto(URL_BASE);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('terra-imperium.language', 'he'); });
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await shot('start-he');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^(Begin as|מתחילים)/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(3500);
  await shot('map-he');
  const rail = page.getByTestId('landscape-rail');
  const buttons = rail.getByRole('button');
  const n = await buttons.count();
  console.log('rail buttons', n, JSON.stringify(await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent))));
  for (let i = 0; i < n; i += 1) {
    await click(buttons.nth(i));
    await wait(900);
    await shot(`rail-${i}`);
    const text = await page.evaluate(() => document.body.innerText);
    const latin = (text.match(/\b[A-Za-z]{3,}\b/g) || []).slice(0, 12);
    console.log(`rail ${i}: Latin words: ${JSON.stringify(latin)}`);
    await click(buttons.nth(i));
    await wait(300);
  }
  // the city panel: tap the city banner (the capital sits at the middle of the map)
  await page.mouse.click(615, 247);
  await wait(1200);
  await shot('city-panel');
  const cityText = await page.evaluate(() => document.body.innerText);
  console.log('city panel Latin words:', JSON.stringify((cityText.match(/[A-Za-z]{3,}/g) || []).slice(0, 25)));
  // the city's build list
  await click(page.getByRole('button', { name: /Open the city/ }));
  await wait(1500);
  await shot('city-build');
  const buildText = await page.evaluate(() => document.body.innerText);
  console.log('city build Latin words:', JSON.stringify((buildText.match(/[A-Za-z]{3,}/g) || []).slice(0, 30)));
  // the Build tab
  await click(page.getByRole('button', { name: /^Build$/ }).or(page.getByText('Build', { exact: true })).first());
  await wait(1200);
  await shot('city-build-list');
  const listText = await page.evaluate(() => document.body.innerText);
  console.log('build list Latin words:', JSON.stringify((listText.match(/[A-Za-z]{3,}/g) || []).slice(0, 40)));
  console.log('page errors', JSON.stringify(errors));
  await browser.close();
};
main().catch((e) => { console.error(e); process.exit(1); });
