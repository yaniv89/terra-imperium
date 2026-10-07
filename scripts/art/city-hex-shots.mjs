// scripts/art/city-hex-shots.mjs
// Browser check of the towns filling their hexes in the close view (plans/game/city-hex-fill/):
// starts a game as Israel (a large, explored world), gives a few capitals the buildings of a medium or a big town (and
// walls), focuses the flat map on each shot and saves a screenshot, with the town scale of each
// city on screen (window.__closeView). Needs `npx vite --port 5199` running.
//
//   node scripts/art/city-hex-shots.mjs <out_dir> <width> <height> name:lat:lng:k|name:@City:k ...
//   node scripts/art/city-hex-shots.mjs /tmp/shots 844 390 warm:31.78:35.22:20 jerusalem:31.78:35.22:20
//   (the first shot warms up: the close view and its model files load on first use)
// Optional env: WAIT (ms per shot, default 12000), URL (default http://localhost:5199/terra-imperium/),
// CHROMIUM (default /opt/pw-browsers/chromium), PEOPLE (default Israel), TIERS (JSON { cityName: 'small'|'medium'|'big'|'big+walls' }).
import { chromium } from 'playwright';

const [,, out, w, h, ...shots] = process.argv;
const TIERS = JSON.parse(process.env.TIERS || '{"Jerusalem":"medium+walls","Men-nefer":"big","Durocortorum":"big+walls","Mycenae":"medium","Knossos":"small","Ugarit":"medium","Sardis":"big"}');
const BUILDINGS = { small: {}, medium: { food: 1, economy: 1 }, big: { food: 2, economy: 2, military: 1, science: 1 } };
const phone = +w < 900;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; try { localStorage.setItem('terra-imperium-minimap-open', '0'); } catch { /* none */ } });
await page.goto(process.env.URL || 'http://localhost:5199/terra-imperium/');
await page.getByText('Large', { exact: true }).click();
await page.getByText('Explored world', { exact: true }).click();
await page.fill('input[placeholder^="Search"]', process.env.PEOPLE || 'Israel');
await page.locator('[data-people]').first().dispatchEvent('click');
await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
const skip = page.getByRole('button', { name: 'Skip' });
await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
await page.waitForFunction(() => window.__map2DTest?.focus && window.__glMap, null, { timeout: 90000 });
// the first research pick (it opens a panel over the map): the advisor's choice
const advisor = page.getByRole('button', { name: 'Let my advisor choose' });
await advisor.waitFor({ state: 'visible', timeout: 20000 }).then(() => advisor.dispatchEvent('click')).catch(() => {});
await page.waitForTimeout(1500);
const named = await page.evaluate(({ TIERS, BUILDINGS }) => {
  const { state, dispatch } = window.__game;
  const regions = { ...state.regions };
  const found = [];
  Object.values(regions).forEach((r) => {
    const want = TIERS[r.name];
    if (!want) return;
    const [tier, walls] = want.split('+');
    const categories = { ...(r.buildings?.categories || {}), ...BUILDINGS[tier], ...(walls ? { defense: 0 } : {}) };
    regions[r.id] = { ...r, buildings: { ...(r.buildings || {}), categories } };
    found.push(`${r.name}=${want}`);
  });
  dispatch({ type: 'LOAD_GAME', payload: { ...state, regions } });
  return found;
}, { TIERS, BUILDINGS });
console.log('tiers:', named.join(', '));
for (const s of shots) {
  // name:lat:lng:k, or name:@City:k (on that city's tile; the dev server's own tiles module)
  const parts = s.split(':');
  const [name] = parts;
  const k = parts[parts.length - 1];
  const at = parts[1].startsWith('@') ? parts[1].slice(1) : null;
  await page.evaluate(async ({ at, lat, lng, k }) => {
    if (at) {
      const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
      const city = Object.values(window.__game.state.regions).find((r) => r.name === at);
      ({ lat, lon: lng } = getTiles().latLonOf(city.tile));
    }
    window.__map2DTest.focus(+lat, +lng, +k);
  }, { at, lat: parts[1], lng: parts[2], k });
  await page.waitForTimeout(+(process.env.WAIT || 12000));
  const info = await page.evaluate(() => {
    const t = window.__closeView;
    if (!t?.towns) return null;
    const towns = [];
    t.towns.forEach((m, id) => { if (m.visible) towns.push(`${window.__game.state.regions[id]?.name}:${m.scale.x.toFixed(1)}`); });
    return { calls: t.renderer?.info.render.calls, towns: towns.slice(0, 12).join(' ') };
  });
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
}
const errors = logs.filter((l) => !/ReadPixels|GPU stall/.test(l));
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();
