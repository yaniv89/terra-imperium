// scripts/art/improvement-shots.mjs
// Browser check of the improvement models in the close view (plans/game/improvement-models.md):
// starts a game as Israel on the peoples start screen (pick the people, Next through the four steps
// to Ready, Begin: e2e/startHelpers.js), puts a farm, pasture, plantation, fort, a pillaged farm and
// two fishing boats on tiles round Jerusalem (through window.__game, LOAD_GAME, which also gives the
// tiles to Jerusalem), then focuses the flat map on each shot and saves a screenshot with the draw
// calls. Needs `npx vite --port 5199` running.
//
//   node scripts/art/improvement-shots.mjs <out_dir> <width> <height> <age|-> name:lat:lng:k ...
//   node scripts/art/improvement-shots.mjs /tmp/shots 1280 800 - warm:31.6:35:60 k60:31.9:34.95:60
//   (the first shot warms up: the close view and its model files load on first use)
// Optional env: PLAN (JSON { tile: improvement }), WAIT (ms per shot, default 15000),
// URL (default http://localhost:5199/terra-imperium/), CHROMIUM (default /opt/pw-browsers/chromium;
// SWIFTSHADER=0 drops the software GL flags for a real browser such as Chrome on Windows).
import { chromium } from 'playwright';

const [,, out, w, h, ageArg, ...shots] = process.argv;
const PLAN = JSON.parse(process.env.PLAN || '{"82396":"farm","82319":"pasture","82473":"plantation","82474":"fort","82472":"fishing_boats","82395":"fishing_boats","82475":"farm"}');
const PILLAGED = '82475';
const phone = +w < 900;
const gl = process.env.SWIFTSHADER === '0' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: [...gl, '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
await page.goto(process.env.URL || 'http://localhost:5199/terra-imperium/');
await page.fill('input[aria-label="Search peoples"]', 'Israel');
await page.locator('[data-people="israel"]').first().dispatchEvent('click');
// four steps, Begin only on Ready (e2e/startHelpers.js goToReady)
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
await page.waitForFunction(() => window.__map2DTest?.features?.length > 0, null, { timeout: 90000 });
// the improvements, owned by Israel's capital; the age (calendar and tech) when one is given
await page.evaluate(({ PLAN, PILLAGED, age }) => {
  const { state, dispatch } = window.__game;
  const cap = state.nations[state.playerNationId].capitalRegionId;
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
