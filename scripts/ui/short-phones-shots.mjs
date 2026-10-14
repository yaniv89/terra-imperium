// scripts/ui/short-phones-shots.mjs
// Screenshots of the start screen (People, Ready) and the world map HUD at the short phone screens
// (844x390, 844x340, 667x375, 667x285) and a desktop, into plans/ui/short-phones/. Needs a dev
// server (`npx vite --port 5198`). Also prints how many people rows are visible and any text cut off.
//   node scripts/ui/short-phones-shots.mjs [--tag after] [--only start|map] [--url http://localhost:5198/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const TAG = arg('--tag', 'after');
const ONLY = arg('--only', 'all');
const OUT = path.resolve('plans/ui/short-phones');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[844, 390], [844, 340], [667, 375], [667, 285], [1280, 800]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const browser = await launchBrowser({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)), headless: true });
for (const [w, h] of SIZES) {
  const phone = w < 1000;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await wait(600);
  const id = `${TAG}-${w}x${h}`;
  if (ONLY !== 'map') {
    await page.screenshot({ path: path.join(OUT, `people-${id}.png`) });
    const rows = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="people-list"]').getBoundingClientRect();
      return [...document.querySelectorAll('[data-people]')].filter((b) => { const r = b.getBoundingClientRect(); return r.top >= list.top - 1 && r.bottom <= list.bottom + 1 && r.height > 0; }).length;
    });
    const nextVisible = await page.getByTestId('start-next').isVisible();
    console.log(id, 'people rows fully visible:', rows, 'next visible:', nextVisible);
    await click(page.getByTestId('start-step-ready'));
    await wait(300);
    await page.screenshot({ path: path.join(OUT, `ready-${id}.png`) });
    const cut = await page.evaluate(() => [...document.querySelectorAll('[data-testid="start-summary"] dd')].filter((d) => d.scrollWidth > d.clientWidth + 1 || getComputedStyle(d).textOverflow === 'ellipsis' && d.scrollWidth > d.clientWidth).map((d) => d.textContent));
    console.log(id, 'ready cut-off values:', cut.length ? cut : 'none');
  }
  if (ONLY !== 'start') {
    await click(page.getByRole('button', { name: /^Begin as/ }));
    const skip = page.getByRole('button', { name: 'Skip' });
    await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    if (await skip.isVisible().catch(() => false)) await click(skip);
    await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 }).catch(() => {});
    await wait(3000);
    const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
    if (await later.first().isVisible().catch(() => false)) await click(later.first());
    await wait(1500);
    await page.getByTestId('map-zoom-controls').locator('button').first().dispatchEvent('click').catch(() => {});
    await wait(500);
    await page.screenshot({ path: path.join(OUT, `map-${id}.png`) });
  }
  if (errors.length) console.log(id, 'page errors:', errors);
  await ctx.close();
}
await browser.close();
