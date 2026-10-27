// scripts/ui/map-clarity-shots.mjs
// Shots of the map-clarity lane (plans/ai-output/human-playtest/SUMMARY.md issues 6, 8, 13, 14, 17,
// 19): a classical playtest era save (the human-playtest harness's own buildSlices), then
//   pact     a pact with a met people whose capital is unseen, Peoples closed (issue 8: the map went dark)
//   army     a starving army in the wild, its sheet (issue 6: supply state, Back to supply; 19: men)
//   march    the march bar toward far wild land (issue 6: the supply forecast, the supply lens)
//   banners  your army beside a foreign one (issue 14: owner colours)
//   gold     the top bar's gold reasons (issue 13)
//   log      the event log (issues 13 and 17)
// at 844x390 and 1600x900, en and he, into plans/ui/map-clarity/<tag>-<scene>-<size>-<lang>.jpg.
// Needs a dev server of the checkout to shoot (`npx vite --port 5197`).
//   node scripts/ui/map-clarity-shots.mjs [--url http://localhost:5197/terra-imperium/] [--tag after] [--only phone-he]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { buildSlices } from '../ai/human-playtest.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const TAG = arg('--tag', 'after');
const ONLY = arg('--only', '');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/map-clarity');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const save = JSON.stringify((await buildSlices(['classical'], 400, () => {})).classical.state);

const tidy = async (page) => {
  for (let i = 0; i < 4; i++) {
    const b = page.getByRole('button', { name: /^(Later|Continue|Close|אחר כך|המשך|סגירה)$/ });
    if (await b.first().isVisible().catch(() => false)) await click(b.first());
    await wait(250);
  }
};

const startGame = async (page, lang) => {
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await page.evaluate((json) => window.__game.load(JSON.parse(json)), save);
  await wait(3000);
  if (lang === 'he') { await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he')); await wait(800); }
  // gold and decrees for the pact, a quiet ruler
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId; const n = s.nations[me];
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, nations: { ...s.nations, [me]: { ...n, gold: 5000, ruler: { ...n.ruler, decrees: 5 } } } } });
  });
  await wait(800);
  await tidy(page);
};

// A starving stack of yours on free land a few rings from the capital, and a foreign army beside it.
const stageArmy = (page) => page.evaluate(async () => {
  const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
  const s = window.__game.state; const me = s.playerNationId; const tiles = getTiles();
  const cap = s.regions[s.nations[me].capitalRegionId];
  let ring = [cap.tile]; const seen = new Set(ring); let wild = null;
  for (let d = 0; d < 14 && wild == null; d++) {
    ring = ring.flatMap((t) => tiles.neighbors[t]).filter((t) => !seen.has(t) && (seen.add(t), true) && tiles.land[t]);
    if (d >= 3) wild = ring.find((t) => s.world.tileOwner[t] == null) ?? null;
  }
  const mine = Object.values(s.units).find((u) => u.ownerId === me && u.domain === 'land' && u.classId !== 'settler' && !u.explorer);
  const foreignOwner = Object.keys(s.nations).find((id) => id !== me && !s.nations[id].isEliminated && s.nations[id].kind !== 'independent');
  const beside = tiles.neighbors[wild].find((t) => tiles.land[t] && s.world.tileOwner[t] == null);
  const foe = { ...mine, id: 'shot_foe', ownerId: foreignOwner, tile: beside, route: null, army: null, supply: 100 };
  const units = { ...s.units, [mine.id]: { ...mine, tile: wild, supply: 0, morale: 0, route: null, movesLeft: 1 }, shot_foe: foe };
  window.__shot = { wild, unitId: mine.id, regionId: mine.regionId };
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units } });
  return wild;
});

const shot = async (page, name, vp, lang) => {
  await wait(1300);
  const file = path.join(OUT, `${TAG}-${name}-${vp.id}-${lang}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 60, timeout: 180000 });
  console.log('wrote', path.relative(process.cwd(), file));
};

const errors = [];
const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
try {
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'he']) {
      if (ONLY && ONLY !== `${vp.id}-${lang}`) continue;
      const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => { errors.push(`${vp.id}/${lang}: ${String(e.message).slice(0, 200)}`); console.log('pageerror', vp.id, lang, String(e.stack || e.message).slice(0, 600)); });
      await startGame(page, lang);
      // pact: Peoples, the first met people at peace, Offer pact, close Peoples
      const foe = await page.evaluate(() => { const s = window.__game.state; const me = s.playerNationId; return Object.keys(s.fog.met[me] || {}).find((id) => id !== me && s.nations[id] && !s.nations[id].hasMilitaryPact && !s.wars.some((w) => w.active && [w.aggressor, w.enemy].includes(id))); });
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-tab', { detail: 'diplomacy' })));
      await wait(900);
      const nm = await page.evaluate(async (id) => { const { nameNow } = await import('/terra-imperium/src/i18n/names.js'); const s = window.__game.state; return nameNow('people', id, (await import('/terra-imperium/src/data/peoples.js')).PEOPLES[id]?.name || s.nations[id].name); }, foe);
      const row = page.getByText(nm, { exact: true }).first();
      if (await row.count()) await click(row);
      await wait(600);
      const pact = page.getByRole('button', { name: /Offer pact|הצעת ברית|ברית/ }).first();
      if (await pact.isVisible().catch(() => false)) { await pact.scrollIntoViewIfNeeded(); await pact.click({ force: true }); }
      await wait(500);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));
      await wait(1500);
      await tidy(page);
      await shot(page, 'pact', vp, lang);
      // army: the starving stack's sheet
      const wild = await stageArmy(page);
      await wait(800);
      await page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:select-army', { detail: t })), wild);
      await page.getByTestId('army-sheet').waitFor({ timeout: 15000 }).catch(() => {});
      await shot(page, 'army', vp, lang);
      // march: toward far wild land beyond the stack
      const far = await page.evaluate(async () => {
        const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
        const s = window.__game.state; const tiles = getTiles(); const at = window.__shot.wild;
        let ring = [at]; const seen = new Set(ring); let last = null;
        for (let d = 0; d < 7; d++) { ring = ring.flatMap((t) => tiles.neighbors[t]).filter((t) => !seen.has(t) && (seen.add(t), true) && tiles.land[t]); const w = ring.find((t) => s.world.tileOwner[t] == null); if (w != null) last = w; }
        const u = s.units[window.__shot.unitId];
        window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units: { ...s.units, [u.id]: { ...u, supply: 30, morale: 80 } } } });
        return last;
      });
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));
      const close = page.getByTestId('army-sheet').getByRole('button', { name: /^(Close|סגירה)$/ }).first();
      if (await close.isVisible().catch(() => false)) await click(close);
      await wait(500);
      await page.evaluate(({ far }) => window.dispatchEvent(new CustomEvent('ti:start-march', { detail: { from: window.__shot.regionId, naval: false, unitIds: [window.__shot.unitId], target: far } })), { far });
      await page.getByTestId('march-bar').waitFor({ timeout: 15000 }).catch(() => {});
      await shot(page, 'march', vp, lang);
      await click(page.getByTestId('march-bar').locator('button').last()); // its X (march.cancel)
      await wait(600);
      // banners: close on the stack and the foreign army beside it
      await page.evaluate(async () => { const { latLngOfTile } = await import('/terra-imperium/src/components/map/mapCamera.js'); const ll = latLngOfTile(window.__shot.wild); window.__map2DTest?.focus?.(ll.lat, ll.lng, 30); });
      await shot(page, 'banners', vp, lang);
      // gold reasons
      await click(page.getByTestId('top-bar-gold'));
      await page.getByTestId('top-bar-reasons').waitFor({ timeout: 10000 }).catch(() => {});
      await shot(page, 'gold', vp, lang);
      await page.keyboard.press('Escape');
      await click(page.getByTestId('top-bar-gold'));
      await wait(400);
      // the event log
      await click(page.getByRole('button', { name: /Open event log|יומן האירועים/ }).first());
      await wait(1000);
      await shot(page, 'log', vp, lang);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
if (errors.length) { console.log('page errors:'); errors.forEach((e) => console.log(' ', e)); }
