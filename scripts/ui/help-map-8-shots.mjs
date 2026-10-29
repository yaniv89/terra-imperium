// scripts/ui/help-map-8-shots.mjs
// Shots and checks of lane help-map-8 (plans/lanes/help-map-8-REPORT.md) on the classical era save
// (Israel at war with Akkad), 844x390 (touch, CDP taps and holds like the playtester) and 1600x900, en and he.
// Prints one line per check. Vite ignores .claude/**, so restart the dev server after every edit.
//   npx vite --port 5231 &  node scripts/ui/help-map-8-shots.mjs [--url http://localhost:5231/terra-imperium/] [--tag after]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5231/terra-imperium/');
const OUT = path.resolve('plans/lanes/help-map-8-shots', arg('--tag', 'after'));
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = { state: readEraSave('classical').state };
const fails = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`); if (!ok) fails.push(name); };

const run = async (browser, sizeId, lang) => {
  const size = SIZES[sizeId];
  const tag = `${sizeId}-${lang}`;
  const g = await openGame(browser, { size, lang, url: URL });
  const { page, cdp } = g;
  await page.evaluate(() => { window.__E2E_MAP_TEST__ = true; });
  const press = async (x, y, hold) => (size.mobile
    ? (await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }), await wait(hold), await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }))
    : page.mouse.click(x, y));
  const boxOf = async (loc) => { const l = loc.first(); if (!(await l.count())) return null; await l.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {}); return l.boundingBox({ timeout: 5000 }).catch(() => null); };
  const tap = async (loc, hold = 60) => { const b = await boxOf(loc); if (!b) return false; await press(b.x + b.width / 2, b.y + b.height / 2, hold); await wait(900); return true; };
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${tag}.jpg`), type: 'jpeg', quality: 70, timeout: 120000 });
  const ev = (name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);
  const shown = (id) => page.getByTestId(id).first().isVisible().catch(() => false);
  const closeGlossary = async () => { await page.keyboard.press('Escape'); await wait(400); };
  await loadSlice(g, save);
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|Close|סגירה/ }); if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click'); await wait(300); } };
  await dismiss();
  await ev('ti:close-panels'); await wait(800);

  // 1. Hold for help: a held rail tab opens its glossary entry, not the panel; the first panel shows the hint once.
  const rail = page.locator('[data-testid="landscape-rail"] nav button').nth(3); // Research
  if (size.mobile) {
    await tap(rail, 900);
    check(`${tag} hold Research tab opens the glossary`, await shown('glossary-sheet'));
    await shot('1a-hold-research-tab');
    await closeGlossary();
    check(`${tag} the held tab did not open the panel`, !(await shown('landscape-dock')));
  }
  await tap(rail);
  check(`${tag} hold hint on first open (touch only)`, (await shown('hold-hint')) === size.mobile);
  await shot('1b-research-first-open');
  if (size.mobile) {
    const name = page.getByTestId('research-current').locator('[data-testid="glossary-link"]').first();
    await tap(name, 900);
    check(`${tag} hold the current tech name opens its entry`, await shown('glossary-sheet'));
    await shot('1c-hold-tech-name');
    await closeGlossary();
    await tap(rail); await tap(rail); // close and open again: the hint is gone
    check(`${tag} hold hint shows only once`, !(await shown('hold-hint')));
  }
  await ev('ti:close-panels'); await wait(600);

  // 4. Zoomed out: the Close view chip, and one tap on it reaches the close view.
  await page.evaluate(() => { const t = window.__map2DTest.transform(); window.__map2DTest.setTransform({ x: t.x / 4 + 211, y: t.y / 4 + 97, k: t.k / 4 }); });
  await wait(1500);
  check(`${tag} Close view chip when zoomed out`, await shown('map-close-view'));
  await shot('4a-close-view-chip');
  const k0 = await page.evaluate(() => window.__map2DTest.transform().k);
  await tap(page.getByTestId('map-close-view')); await wait(1200);
  const k1 = await page.evaluate(() => window.__map2DTest.transform().k);
  check(`${tag} the chip zooms into the close view`, k1 > k0 * 2 && !(await shown('map-close-view')), `k ${k0.toFixed(1)} to ${k1.toFixed(1)}`);
  await shot('4b-close-view');

  // 2. A march from the war card: Sippar is centred above the march bar, not left under the HUD.
  await page.getByTestId('war-pill').first().dispatchEvent('click'); await wait(1200);
  await page.getByTestId('war-march').first().dispatchEvent('click'); await wait(2500);
  const where = await page.evaluate(async () => {
    const s = window.__game.state; const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
    const c = Object.values(s.regions).find((r) => r.name === 'Sippar'); const { lat, lon } = getTiles().latLonOf(c.tile);
    const p = window.__map2DTest.project(lat, lon); const b = document.querySelector('[data-testid="march-bar"]').getBoundingClientRect();
    const under = p.x > b.left && p.x < b.right && p.y > b.top - 10 && p.y < b.bottom;
    return { x: Math.round(p.x), y: Math.round(p.y), bar: [Math.round(b.top), Math.round(b.bottom)], ok: !under && p.x > 0 && p.x < innerWidth - 60 && p.y > 40 && p.y < innerHeight - 70 };
  });
  check(`${tag} march target in the free map`, where.ok, `Sippar at ${where.x},${where.y}, bar ${where.bar.join('-')}`);
  await shot('2a-march-target');
  await page.getByTestId('march-attack').first().dispatchEvent('click'); await wait(2000);
  const after = await page.evaluate(() => window.__map2DTest.transform());
  await shot('2b-march-confirmed');
  await wait(1500);
  const later = await page.evaluate(() => window.__map2DTest.transform());
  check(`${tag} the camera stays after March to attack`, Math.abs(after.x - later.x) < 2 && Math.abs(after.y - later.y) < 2);

  // 3. An army with no moves left: March says why on tap.
  const tile = await page.evaluate(() => {
    const s = window.__game.state;
    const u = Object.values(s.units).find((x) => x.ownerId === s.playerNationId && x.domain !== 'naval' && !x.route?.length && x.strength > 0 && x.tile != null && !x.settler && !x.band);
    if (!u) return null;
    const units = Object.fromEntries(Object.entries(s.units).map(([id, x]) => [id, x.tile === u.tile && x.ownerId === s.playerNationId ? { ...x, movesLeft: 0, route: [] } : x]));
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units } });
    return u.tile;
  });
  await wait(1500);
  if (tile != null) {
    await ev('ti:select-army', tile); await wait(1500);
    const march = page.getByTestId('army-march');
    check(`${tag} the army sheet shows March`, await march.first().isVisible().catch(() => false));
    if (size.mobile) await tap(march); else { await march.first().dispatchEvent('click'); await wait(600); }
    const tip = await page.getByTestId('why-tip').first().textContent().catch(() => '');
    check(`${tag} a greyed March says why`, /moves|תנועה/.test(tip || ''), tip);
    await shot('3a-march-why');
  } else check(`${tag} an army to test March`, false);
  await page.keyboard.press('Escape'); await wait(400);
  await page.context().close();
};

const browser = await launchBrowser({ channel: 'chrome' });
for (const sizeId of arg('--sizes', 'phone,desktop').split(',')) for (const lang of arg('--langs', 'en,he').split(',')) {
  try { await run(browser, sizeId, lang); } catch (e) { check(`${sizeId} ${lang} run`, false, String(e.message).split('\n')[0]); }
}
await browser.close();
console.log(fails.length ? `${fails.length} failed` : 'all checks passed');
process.exitCode = fails.length ? 1 : 0;
