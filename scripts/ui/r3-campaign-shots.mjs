// scripts/ui/r3-campaign-shots.mjs
// Shots of the round 3 campaign fixes (plans/lanes/r3-campaign-REPORT.md) on the classical era save
// (Israel at war with Akkad, Sippar near), at 844x390 (touch, CDP taps as the playtester) and 1600x900, en and he.
//   npx vite --port 5197 &  node scripts/ui/r3-campaign-shots.mjs --tag after [--url http://localhost:5197/terra-imperium/]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg('--tag', 'after');
const URL = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/lanes/r3-campaign-shots', TAG);
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = { state: readEraSave('classical').state };

const run = async (browser, sizeId, lang) => {
  const size = SIZES[sizeId];
  const g = await openGame(browser, { size, lang, url: URL });
  const { page, cdp } = g;
  const tapAt = async (x, y) => (size.mobile
    ? (await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }), await wait(60), await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }))
    : page.mouse.click(x, y));
  const tap = async (loc) => { const l = loc.first(); if (!(await l.count())) return false; await l.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {}); const b = await l.boundingBox({ timeout: 5000 }).catch(() => null); if (!b) return false; await tapAt(b.x + b.width / 2, b.y + b.height / 2); await wait(900); return true; };
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${sizeId}-${lang}.png`), timeout: 120000 });
  const ev = (name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);
  await loadSlice(g, save);
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|Close|סגירה/ }); if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click'); await wait(300); } };
  await dismiss();
  // 4/5. First, on a clear map: the war pill: the enemy's card, its first tile marches; the march bar's odds.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels'))); await wait(800);
  await dismiss();
  if (await tap(page.getByTestId('war-pill'))) await shot('5a-war-card');
  // the base had the march as a small button under the card; a click, not a tap: on desktop the Cities dock can cover the card
  const march = (await page.getByTestId('war-march').count()) ? page.getByTestId('war-march') : page.locator('[data-testid="nation-card"] button', { hasText: /March to|צעידה אל/ });
  if (await march.count()) { await march.first().dispatchEvent('click'); await wait(2500); await shot('4a-march-odds'); }
  await page.keyboard.press('Escape'); await wait(500);
  // 1. Research: the top, then the "All techs" chip, then an age cell of the strip.
  await ev('ti:open-tab', 'tech'); await wait(1500); await shot('1a-research');
  const toAll = page.getByTestId('research-to-all');
  if (await tap(toAll)) await shot('1b-all-techs');
  if (await tap(page.locator('[data-testid^="jump-"]').nth(2))) await shot('1c-age-tab');
  // 2. Peoples: tap the second row (a slow tap too), then Offer pact.
  await ev('ti:open-tab', 'diplomacy'); await wait(1500);
  const rows = page.locator('[data-people-row]');
  const row = rows.nth(1); await row.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {}); const b = await row.boundingBox({ timeout: 5000 }).catch(() => null);
  if (b && size.mobile) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + 40, y: b.y + 20, id: 1 }] }); await wait(700); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(900); } else if (b) await tap(row);
  await shot('2a-people-row');
  const pact = page.locator('[data-testid="nation-card"] button', { hasText: /Offer pact|הצעת ברית|ברית/ });
  if (await tap(pact)) { await wait(200); await shot('2b-offer-pact'); }
  // 3. A city's build bar: the Buy button of the current order.
  const city = await page.evaluate(() => { const s = window.__game.state; return Object.values(s.regions).filter((c) => c.owner === s.playerNationId && c.production?.current).sort((a, z) => (z.size || 0) - (a.size || 0))[0]?.id; });
  await ev('ti:manage-city', { regionId: city, tab: 'build' }); await wait(2000); await shot('3a-city-buy');
  if (await tap(page.getByTestId('city-rush-open'))) await shot('3b-city-buy-offer');
  await page.keyboard.press('Escape'); await wait(500);
  // 6. The lead's rerun items: the city search on the map, then the siege of Shechem on Auto and its result.
  await page.keyboard.press('Escape'); await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels'))); await wait(600); await dismiss();
  if (await tap(page.getByTestId('map-zoom-controls').locator('button').first())) {
    const box = page.getByTestId('map-city-search').locator('input');
    if (await box.count()) { await box.fill(lang === 'he' ? 'שכ' : 'Shech'); await wait(500); await shot('6a-city-search'); if (await tap(page.getByTestId('map-city-found'))) { await wait(1500); await shot('6b-city-found'); } }
  }
  await page.keyboard.press('Escape'); await wait(400);
  // Ten turns headless in the page (events answered, peace refused) until Akkad's siege of Shechem waits.
  await page.evaluate(async () => {
    const { resolveTurn } = await import('/terra-imperium/src/engine/resolveTurn.js');
    const { gameReducer } = await import('/terra-imperium/src/engine/gameReducer.js');
    let s = window.__game.state;
    for (let i = 0; i < 14 && !(s.pendingDefenses || []).some((d) => s.regions[d.regionId]?.name === 'Shechem'); i++) {
      if (s.activeEventId || s.activeProceduralEvent) s = gameReducer(s, { type: 'RESOLVE_EVENT', payload: { optionIndex: 0 } });
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: 'REJECT_PENDING_PEACE' });
      if ((s.pendingDefenses || []).length) s = { ...s, pendingDefenses: s.pendingDefenses.filter((d) => s.regions[d.regionId]?.name === 'Shechem') };
      const n = resolveTurn(s); if (n === s) break; s = n;
    }
    window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
  });
  await wait(4000); await dismiss();
  const sheet = page.getByTestId('defense-sheet');
  if (await sheet.count()) {
    await shot('7a-siege-card');
    await sheet.locator('[role="radio"]', { hasText: /^Auto|אוטומטי/ }).first().dispatchEvent('click'); await wait(400);
    await page.getByTestId('defense-go').dispatchEvent('click'); await wait(3500); await shot('7b-after-auto');
  }
  await g.page.context().close();
};

const browser = await chromium.launch();
for (const sizeId of arg('--sizes', 'phone,desktop').split(',')) for (const lang of ['en', 'he']) {
  try { await run(browser, sizeId, lang); console.log('ok', sizeId, lang); } catch (e) { console.log('fail', sizeId, lang, String(e.message).split('\n')[0]); }
}
await browser.close();
