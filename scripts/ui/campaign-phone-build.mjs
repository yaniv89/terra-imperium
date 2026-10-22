// scripts/ui/campaign-phone-build.mjs
// The city Build tab with the pinned queue bar, scrolled: shots at 844x390 and 1600x900.
//   node scripts/ui/campaign-phone-build.mjs --tag before|after [--lang he] [--url ...]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5411/terra-imperium/');
const TAG = arg('--tag', 'after'); const LANG = arg('--lang', 'en');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve(`audits/campaign-phone/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (l) => l.dispatchEvent('click');
const browser = await launchBrowser({ executablePath: CHROME, headless: true });
for (const [w, h] of [[844, 390], [1600, 900]]) {
  const phone = w < 1000;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, LANG);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: /Skip|דילוג/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await page.evaluate(() => {
    const g = window.__game; const me0 = g.state.playerNationId;
    const band = Object.values(g.state.units).find((u) => u.ownerId === me0 && (u.classId === 'settler' || u.classId === 'band' || u.band));
    if (band && !Object.values(g.state.regions).some((c) => c.owner === me0)) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
  });
  await wait(1500);
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { ...(c.production || {}), current: null, queue: [], progress: 0 } } : c]));
    const r = s.research || {};
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, research: { ...r, current: r.current || Object.keys(r.progress || {})[0] || 'science_cuneiform_records', queue: [], auto: false } } });
  });
  await click(page.getByTestId('end-turn')); // "Choose production" opens the Build tab
  await wait(1500); await page.screenshot({ path: path.join(OUT, `dbg-${LANG}-${w}.png`) });
  await page.getByTestId('city-tab-build').waitFor({ timeout: 20000 });
  await wait(600);
  for (let i = 0; i < 2; i += 1) { const b = page.getByTestId('queue-item').nth(i); if (await b.isEnabled().catch(() => false)) { await click(b); await wait(200); } }
  await page.getByTestId('city-queue-bar').waitFor({ timeout: 20000 });
  await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="city-queue-bar"]'); let el = bar.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (el) el.scrollTop = 140;
  });
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `build-${LANG}-${w}x${h}-scrolled.png`) });
  await ctx.close();
}
await browser.close();
