// scripts/ui/campaign-phone-map.mjs
// The map must not go blank after Peoples closes or a pact is signed (playtest issue 8).
// Measures the mean brightness of the map strip left of the dock before and after each step.
//   node scripts/ui/campaign-phone-map.mjs --tag after [--url http://localhost:5411/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5411/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve(`audits/campaign-phone/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (l) => l.dispatchEvent('click');
let failed = 0;
const check = (n, ok, d = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  (${d})` : ''}`); };
const browser = await launchBrowser({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL_BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(URL_BASE);
await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
await click(page.locator('[data-people]').first());
await page.getByTestId('start-step-ready').dispatchEvent('click');
await click(page.getByRole('button', { name: /^Begin as/ }));
const skip = page.getByRole('button', { name: 'Skip' });
await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await click(skip);
await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
await wait(2500);
const adv = page.getByTestId('research-let-advisor');
if (await adv.isVisible().catch(() => false)) await click(adv);
// Mean brightness (0..255) of the left 300 px of the map under the top bar.
const lum = async (name) => {
  await wait(900);
  const file = path.join(OUT, `map-${name}.png`);
  await page.screenshot({ path: file, clip: { x: 0, y: 60, width: 300, height: 320 } });
  const v = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; return s / (d.length / 4);
  }, fs.readFileSync(file).toString('base64'));
  return Math.round(v * 10) / 10;
};
const rail = page.getByTestId('landscape-rail');
const base = await lum('0-start');
console.log('start brightness', base);
await click(rail.getByRole('button', { name: 'Peoples' }));
await page.getByTestId('landscape-dock').waitFor({ timeout: 10000 });
await wait(500);
const pact = page.getByRole('button', { name: /Offer pact/ }).first();
if (await pact.isVisible().catch(() => false)) { await pact.dispatchEvent('click'); await wait(800); }
const show = page.getByRole('button', { name: /Show on map/ }).first();
if (await show.isVisible().catch(() => false)) { await show.dispatchEvent('click'); await wait(800); }
await page.screenshot({ path: path.join(OUT, 'map-1-peoples.png') });
if (await page.getByTestId('landscape-dock').count()) await click(rail.getByRole('button', { name: 'Peoples' }));
const after = await lum('2-after-close');
check('map not blank after Peoples closes', after > base * 0.5 && after > 8, `${base} -> ${after}`);
await page.screenshot({ path: path.join(OUT, 'map-3-full.png') });
await browser.close();
process.exit(failed ? 1 : 0);
