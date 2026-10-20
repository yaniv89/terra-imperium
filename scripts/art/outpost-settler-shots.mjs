// scripts/art/outpost-settler-shots.mjs
// Browser check of the close view's outpost camp, settler party and an independent city's badge
// and banner (plans/art-pilot/map-outpost-settler/LOG.md). Starts a game (PEOPLE, default israel)
// on the peoples start screen, then through window.__game (a dev server: `npx vite --port 5217`):
// puts settlers on the best site near the capital and founds an outpost there (FOUND_CITY), puts a
// second party of settlers on the next site, optionally sets the age, and shoots the map focused
// on the outpost, the settlers and the nearest independent city at each zoom asked for.
//
//   node scripts/art/outpost-settler-shots.mjs <out_dir> <prefix> [age|-] [k,k,...]
//   node scripts/art/outpost-settler-shots.mjs plans/art-pilot/map-outpost-settler/before before - 8,60
// Env: URL (default http://localhost:5217/terra-imperium/), CHROME (Chrome's exe), WAIT (ms a shot,
// default 9000), PEOPLE, W and H (default 844 x 390 at device scale 3).
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const [,, out, prefix = 'shot', ageArg = '-', ks = '8,60'] = process.argv;
mkdirSync(out, { recursive: true });
const W = +(process.env.W || 844); const H = +(process.env.H || 390);
const browser = await launchBrowser({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
const base = process.env.URL || 'http://localhost:5217/terra-imperium/';
await page.goto(base);
const people = process.env.PEOPLE || 'israel';
await page.fill('input[aria-label="Search peoples"]', people);
await page.locator(`[data-people="${people}"]`).first().dispatchEvent('click');
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

const spots = await page.evaluate(async ({ base, age }) => {
  const root = new URL(base).pathname;
  const S = await import(`${root}src/engine/settlers.js`);
  const T = await import(`${root}src/data/geo/tiles.js`);
  const I = await import(`${root}src/data/independents.js`);
  const tiles = T.getTiles();
  const g = window.__game;
  let state = g.state;
  if (age) { g.dispatch({ type: 'LOAD_GAME', payload: { ...state, age, techAgeId: age } }); await new Promise((r) => setTimeout(r, 300)); state = window.__game.state; }
  const me = state.playerNationId;
  const cap = state.regions[state.nations[me].capitalRegionId];
  const ageId = age || state.techAgeId;
  const sites = S.bestSites(state, me, cap.tile, ageId, { rings: 8, limit: 6 });
  if (sites.length < 2) return { error: `only ${sites.length} sites` };
  const mk = (id, tile) => ({ ...S.makeSettler(id, cap, me), tile });
  // the outpost: settlers on the best site, founded at once, a third of the way grown
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...state, units: { ...state.units, shotA: mk('shotA', sites[0].tile) } } });
  await new Promise((r) => setTimeout(r, 300));
  window.__game.dispatch({ type: 'FOUND_CITY', payload: { unitId: 'shotA' } });
  await new Promise((r) => setTimeout(r, 300));
  state = window.__game.state;
  const outpost = Object.values(state.regions).find((c) => c.owner === me && c.outpost);
  if (outpost) {
    const regions = { ...state.regions, [outpost.id]: { ...outpost, outpost: { ...outpost.outpost, progress: 35 } } };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...state, regions, units: { ...state.units, shotB: mk('shotB', sites[1].tile) } } });
  } else {
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...state, units: { ...state.units, shotB: mk('shotB', sites[1].tile) } } });
  }
  await new Promise((r) => setTimeout(r, 300));
  state = window.__game.state;
  const ll = (tile) => { const p = tiles.latLonOf(tile); return { lat: p.lat, lng: p.lon, tile }; };
  // the nearest independent city to the capital
  const c0 = tiles.latLonOf(cap.tile);
  const indep = Object.values(state.regions).filter((c) => c.tile != null && I.isIndependent(state.nations, c.owner))
    .map((c) => { const p = tiles.latLonOf(c.tile); return { c, d: Math.hypot(p.lat - c0.lat, p.lon - c0.lon) }; })
    .sort((a, b) => a.d - b.d)[0]?.c;
  return {
    age: ageId, people: me,
    outpost: outpost ? { ...ll(outpost.tile), id: outpost.id } : null,
    settler: ll(sites[1].tile),
    indep: indep ? { ...ll(indep.tile), id: indep.id, personality: state.nations[indep.owner]?.indep?.personality } : null
  };
}, { base, age: ageArg === '-' ? null : ageArg });
console.log(JSON.stringify(spots));
if (spots.error) { await browser.close(); process.exit(1); }
for (const k of ks.split(',').map(Number)) {
  for (const what of ['outpost', 'settler', 'indep']) {
    const s = spots[what];
    if (!s) continue;
    await page.evaluate(({ lat, lng, k }) => window.__map2DTest.focus(lat, lng, k), { ...s, k });
    await page.waitForTimeout(+(process.env.WAIT || 9000));
    const calls = await page.evaluate(() => {
      const t = window.__closeView;
      return t ? { settlers: t.settlers?.drawCalls?.() ?? null, all: t.renderer?.info.render.calls, triangles: t.renderer?.info.render.triangles } : null;
    });
    console.log(what, k, JSON.stringify(calls));
    await page.screenshot({ path: `${out}/${prefix}-${what}-k${k}.png` });
  }
}
const errors = logs.filter((l) => !/ReadPixels|GPU stall|React Router/.test(l));
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();
