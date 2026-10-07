// scripts/art/improvement-shots.mjs
// Browser check of the improvement models in the close view (plans/game/improvement-models.md):
// starts a game as Israel, puts a farm, pasture, plantation, fort, a pillaged farm and two fishing
// boats on Israeli tiles (through window.__game, LOAD_GAME), then focuses the flat map on each
// shot and saves a screenshot with the draw calls. Needs `npx vite --port 5199` running.
//
//   node scripts/art/improvement-shots.mjs <out_dir> <width> <height> <age|-> name:lat:lng:k ...
//   node scripts/art/improvement-shots.mjs /tmp/shots 1280 800 - warm:31.6:35:60 k60:31.9:34.95:60
//   (the first shot warms up: the close view and its model files load on first use)
// Optional env: PLAN (JSON { tile: improvement }), WAIT (ms per shot, default 15000),
// URL (default http://localhost:5199/terra-imperium/), CHROMIUM (default /opt/pw-browsers/chromium).
import { chromium } from 'playwright';

const [,, out, w, h, ageArg, ...shots] = process.argv;
const PLAN = JSON.parse(process.env.PLAN || '{"82396":"farm","82319":"pasture","82473":"plantation","82474":"fort","82472":"fishing_boats","82395":"fishing_boats","82475":"farm"}');
const PILLAGED = '82475';
const phone = +w < 900;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
await page.goto(process.env.URL || 'http://localhost:5199/terra-imperium/');
await page.getByPlaceholder('Search 240 nations...').fill('Israel');
await page.getByRole('button', { name: 'Israel', exact: true }).dispatchEvent('click');
await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
await page.getByRole('button', { name: 'Begin as Israel' }).dispatchEvent('click');
await page.getByRole('button', { name: 'Skip', exact: true }).dispatchEvent('click');
await page.getByTitle('Flat map view').dispatchEvent('click');
await page.getByRole('button', { name: 'Let my advisor choose' }).click().catch(() => {});
await page.waitForFunction(() => window.__map2DTest?.features?.length > 0, null, { timeout: 90000 });
// the improvements, owned by Israel's capital; the age (calendar and tech) when one is given
await page.evaluate(({ PLAN, PILLAGED, age }) => {
  const { state, dispatch } = window.__game;
  const cap = state.nations.il.capitalRegionId;
  const tileState = { ...(state.world.tileState || {}) };
  const tileOwner = { ...(state.world.tileOwner || {}) };
  Object.entries(PLAN).forEach(([t, imp]) => { tileState[t] = { ...(tileState[t] || {}), improvement: imp, ...(t === PILLAGED ? { pillaged: true } : {}) }; tileOwner[t] = cap; });
  dispatch({ type: 'LOAD_GAME', payload: { ...state, ...(age ? { age, techAgeId: age } : {}), world: { ...state.world, tileState, tileOwner } } });
}, { PLAN, PILLAGED, age: ageArg === '-' ? null : ageArg });
for (const s of shots) {
  const [name, lat, lng, k] = s.split(':');
  await page.evaluate(({ lat, lng, k }) => window.__map2DTest.focus(+lat, +lng, +k), { lat, lng, k });
  await page.waitForTimeout(+(process.env.WAIT || 15000));
  const calls = await page.evaluate(() => {
    const t = window.__closeView;
    return t ? { improvements: t.improvements.drawCalls(), landmarks: t.buildings.drawCalls(), all: t.renderer.info.render.calls, triangles: t.renderer.info.render.triangles } : null;
  });
  console.log(name, JSON.stringify(calls));
  await page.screenshot({ path: `${out}/${name}.png` });
}
const errors = logs.filter((l) => !/ReadPixels|GPU stall/.test(l));
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();
