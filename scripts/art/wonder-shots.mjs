// scripts/art/wonder-shots.mjs
// Browser check of a wonder model in the close view (plans/art-pilot/temple-solomon/LOG.md). Starts a
// game as Israel on the peoples start screen, then through window.__game (a dev server: `npx vite
// --port 5220`) builds the wonder WONDER at the tier asked for on a land tile next to the capital,
// with comparison wonders (COMPARE, at tier 3) on two more tiles beside it, and shoots the map
// focused on the wonder at each zoom, for each tier.
//
//   node scripts/art/wonder-shots.mjs <out_dir> <prefix> [tiers 1,2,3] [k,k,...]
//   node scripts/art/wonder-shots.mjs plans/art-pilot/temple-solomon before 1,3 60,150
// Env: URL (default http://localhost:5220/terra-imperium/), CHROME (Chrome's exe), WAIT (ms a shot,
// default 9000), WONDER (default solomons_temple), COMPARE (default masada,great_library),
// W and H (default 844 x 390 at device scale 3).
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const [,, out, prefix = 'shot', tiersArg = '1', ks = '60,150'] = process.argv;
mkdirSync(out, { recursive: true });
const W = +(process.env.W || 844); const H = +(process.env.H || 390);
const WONDER = process.env.WONDER || 'solomons_temple';
const COMPARE = (process.env.COMPARE || 'masada,great_library').split(',').filter(Boolean);
const browser = await launchBrowser({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
const base = process.env.URL || 'http://localhost:5220/terra-imperium/';
await page.goto(base);
await page.fill('input[aria-label="Search peoples"]', 'Israel');
await page.locator('[data-people="israel"]').first().dispatchEvent('click');
for (let i = 0; i < 4; i++) {
  const step = await page.getByTestId('start-screen').getAttribute('data-step');
  if (step === 'ready') break;
  await page.getByTestId('start-next').dispatchEvent('click');
  await page.locator(`[data-testid="start-screen"]:not([data-step="${step}"])`).waitFor({ timeout: 10000 });
}
await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
const skip = page.getByRole('button', { name: 'Skip', exact: true });
await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
const later = page.locator('[data-testid="research-choice"] button[aria-label="Later"]');
await later.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
if (await later.isVisible().catch(() => false)) await later.dispatchEvent('click');
await page.waitForFunction(() => window.__map2DTest?.features?.length > 0 && window.__game, null, { timeout: 120000 });

for (const tier of tiersArg.split(',').map(Number)) {
  // the wonder at this tier on the first free land tile beside the capital, the others beside it
  const spot = await page.evaluate(async ({ base, WONDER, COMPARE, tier }) => {
    const root = new URL(base).pathname;
    const T = await import(`${root}src/data/geo/tiles.js`);
    const tiles = T.getTiles();
    const state = window.__game.state;
    const cap = state.regions[state.nations[state.playerNationId].capitalRegionId];
    const cityTiles = new Set(Object.values(state.regions).map((c) => c.tile));
    const free = [...tiles.neighbors[cap.tile]].filter((t) => tiles.land[t] === 1 && !cityTiles.has(t)).sort((a, b) => a - b);
    const ids = [WONDER, ...COMPARE].slice(0, free.length);
    const tileState = { ...(state.world.tileState || {}) };
    const tileOwner = { ...(state.world.tileOwner || {}) };
    const greatProjects = { ...(state.greatProjects || {}) };
    ids.forEach((id, i) => {
      const t = free[i];
      tileState[t] = { ...(tileState[t] || {}), wonder: id };
      tileOwner[t] = cap.id;
      greatProjects[id] = { regionId: cap.id, tier: id === WONDER ? tier : 3, tile: t };
    });
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...state, greatProjects, world: { ...state.world, tileState, tileOwner } } });
    const p = tiles.latLonOf(free[0]);
    return { lat: p.lat, lng: p.lon, tile: free[0], placed: ids.map((id, i) => `${id}@${free[i]}`) };
  }, { base, WONDER, COMPARE, tier });
  console.log(`tier ${tier}`, JSON.stringify(spot));
  for (const k of ks.split(',').map(Number)) {
    await page.evaluate(({ lat, lng, k }) => window.__map2DTest.focus(lat, lng, k), { ...spot, k });
    await page.waitForTimeout(+(process.env.WAIT || 9000));
    const calls = await page.evaluate(() => {
      const t = window.__closeView;
      return t ? { all: t.renderer.info.render.calls, triangles: t.renderer.info.render.triangles } : null;
    });
    const name = `${prefix}-tier${tier}-k${k}`;
    console.log(name, JSON.stringify(calls));
    await page.screenshot({ path: `${out}/${name}.png` });
  }
}
const errors = logs.filter((l) => !/ReadPixels|GPU stall/.test(l));
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();
