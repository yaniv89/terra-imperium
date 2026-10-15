// scripts/ui/site-rating-shot.mjs
// The settle tile sheet's site rating at 844x390, English and Hebrew, into plans/ui/site-rating/.
//   npx vite --port 5181   then   node scripts/ui/site-rating-shot.mjs [--url http://localhost:5181/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5181/terra-imperium/');
const OUT = path.resolve('plans/ui/site-rating');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const browser = await launchBrowser(CHROME ? { executablePath: CHROME } : {});
for (const lang of ['en', 'he']) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button').filter({ hasText: /Begin as|מתחילים כ/ }).first());
  const skip = page.getByRole('button', { name: /Skip|דלג|דילוג/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await page.keyboard.press('7');
  const tile = await page.evaluate(async () => {
    const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
    const { settleSiteModel } = await import('/terra-imperium/src/components/map/settleSiteModel.js');
    const t = getTiles(); const s = window.__game.state;
    const start = s.regions[s.nations[s.playerNationId].capitalRegionId].tile;
    let frontier = [start]; const seen = new Set(frontier);
    for (let d = 0; d < 6; d++) { const next = []; frontier.forEach((x) => t.neighbors[x].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } })); frontier = next; }
    const ok = frontier.map((x) => ({ x, m: t.land[x] && !s.world.tileOwner[x] ? settleSiteModel(s, x, 'bronze') : null })).filter((o) => o.m?.ok && o.m.why);
    const pick = ok.find((o) => o.m.rating === 'excellent') || ok.find((o) => o.m.rating === 'good') || ok[0];
    window.dispatchEvent(new CustomEvent('ti:select-tile', { detail: pick.x }));
    return { x: pick.x, rating: pick.m.rating, why: pick.m.why };
  });
  console.log(lang, JSON.stringify(tile));
  await page.getByTestId('tile-sheet').waitFor({ timeout: 10000 });
  await wait(800);
  const file = path.join(OUT, `site-rating-${lang}.png`);
  await page.screenshot({ path: file });
  console.log(await page.getByTestId('tile-sheet').innerText());
  console.log('saved', file);
  await ctx.close();
}
await browser.close();
