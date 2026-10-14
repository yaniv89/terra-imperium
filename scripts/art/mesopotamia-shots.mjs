// scripts/art/mesopotamia-shots.mjs
// In-game evidence for the Mesopotamian theme (audit I215): an Akkad town on the map's close view
// and in a city battle, next to the same town in the old Levant look. Runs against a server of the
// production build (`npx vite preview --port 5214 --strictPort` after `npm run build`), in a real
// Chrome (WebGL through ANGLE / D3D11), phone landscape 844 x 390 at device scale factor 3.
//   map     starts a game as Akkad (the start screen, as improvement-shots.mjs), makes Kish a town of
//           the asked size (buildings) in the asked age when window.__game exists (dev builds; a
//           production build shows the turn-1 small town), and focuses the close view on it. The "levant"
//           pass serves the Levant town file (and the base shared file) in place of every Mesopotamian
//           one the page asks for, so the same city shows its old look.
//   battle  the battle sandbox with a city of that size and age, `style=mesopotamia` and the defender
//           Akkad (its battle buildings in the theme's skin), against `style=levant` and Ugarit.
//   node scripts/art/mesopotamia-shots.mjs <out_dir> [bronze|classical] [small|medium|big] [map|battle|both]
// Env: URL (default http://localhost:5214/terra-imperium/), CHROME (default Chrome's Windows path),
// WAIT (ms per map shot, default 20000), DIST (default dist, for the Levant stand-ins).
import { chromium } from 'playwright';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [,, out, age = 'bronze', size = 'medium', what = 'both'] = process.argv;
const URL = process.env.URL || 'http://localhost:5214/terra-imperium/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIST = join(process.env.DIST || 'dist', 'assets');
const KISH = { lat: 32.54, lng: 44.6 };
const BUILDINGS = { small: { economy: 0 }, medium: { economy: 1, culture: 1 }, big: { economy: 2, culture: 2, food: 2, science: 1 } };
mkdirSync(out, { recursive: true });

const assets = readdirSync(DIST);
// '<name>-<8 char hash>.glb' -> the Levant stand-in's bytes: the Levant town of the same age, size and
// layout, the base shared file of the age
const standIn = (file) => {
  const town = file.match(/^([a-z]+-town-[a-z]+-[ab])-mesopotamia-/);
  const shared = file.match(/^shared-([a-z]+)-mesopotamia-/);
  const pick = town ? assets.find((f) => f.startsWith(`${town[1]}-levant-`) && f.endsWith('.glb'))
    : shared ? assets.find((f) => new RegExp(`^shared-${shared[1]}-[A-Za-z0-9_-]{8}\\.glb$`).test(f)) : null;
  return pick ? readFileSync(join(DIST, pick)) : null;
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=d3d11'] });
const newPage = async (levant) => {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  if (levant) {
    await page.route(/-mesopotamia-[^/]*\.glb$/, async (route) => {
      const file = route.request().url().split('/').pop().split('?')[0];
      const body = standIn(file);
      if (body) await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body });
      else await route.continue();
    });
  }
  return { page, logs };
};

const mapShots = async (levant) => {
  const { page, logs } = await newPage(levant);
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
  await page.goto(URL, { timeout: 240000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await page.locator('[data-people="akkad"]').first().dispatchEvent('click');
  for (let i = 0; i < 4; i++) {
    const step = await page.getByTestId('start-screen').getAttribute('data-step');
    if (step === 'ready') break;
    await page.getByTestId('start-next').dispatchEvent('click');
    await page.locator(`[data-testid="start-screen"]:not([data-step="${step}"])`).waitFor({ timeout: 20000 });
  }
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  const later = page.locator('[data-testid="research-choice"] button[aria-label="Later"]');
  await later.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await later.isVisible().catch(() => false)) await later.dispatchEvent('click');
  await page.waitForFunction(() => window.__map2DTest?.features?.length > 0, null, { timeout: 180000 });
  // window.__game exists only in dev builds: a production build shows the capital as the game starts
  // it (a small Bronze town), whatever size was asked
  const at = await page.evaluate(({ age, cats }) => {
    if (!window.__game) return { cap: Object.values(window.__map2DTest.features).find((f) => f.properties?.owner === 'akkad' && f.properties?.capital)?.properties?.gameRegionId || null, start: true };
    const { state, dispatch } = window.__game;
    const cap = state.nations[state.playerNationId].capitalRegionId;
    const region = state.regions[cap];
    const regions = { ...state.regions, [cap]: { ...region, buildings: { ...(region.buildings || {}), categories: { ...cats } } } };
    dispatch({ type: 'LOAD_GAME', payload: { ...state, regions, ...(age !== 'bronze' ? { age, techAgeId: age } : {}) } });
    return { cap, tile: region.tile, nation: state.playerNationId };
  }, { age, cats: BUILDINGS[size] });
  await page.waitForTimeout(1500);
  const ll = await page.evaluate((cap) => {
    const f = window.__map2DTest.features.find((x) => x.properties?.gameRegionId === cap);
    const c = f?.geometry?.coordinates;
    return c ? { lat: c[1], lng: c[0] } : null;
  }, at.cap).catch(() => null);
  const focus = ll || KISH;
  const tag = levant ? 'levant' : 'mesopotamia';
  for (const k of [150, 60]) {
    await page.evaluate(({ lat, lng, k }) => window.__map2DTest.focus(lat, lng, k), { lat: focus.lat, lng: focus.lng, k });
    await page.waitForTimeout(+(process.env.WAIT || 20000));
    const file = join(out, `map-${age}-${at.start ? "start" : size}-${tag}-k${k}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file, JSON.stringify(at));
  }
  if (logs.length) console.log(`${tag} console errors:\n${logs.slice(0, 12).join('\n')}`);
  await page.close();
};

const battleShots = async (levant) => {
  const { page, logs } = await newPage(false);
  const q = levant ? '&style=levant&enemy=ugarit' : '&style=mesopotamia&enemy=akkad';
  await page.goto(`${URL}?battleSandbox&autostart&age=${age}&city=${size}&fort=0&seed=7${q}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-pause').waitFor({ timeout: 240000 });
  await page.waitForTimeout(12000);
  const tag = levant ? 'levant' : 'mesopotamia';
  // the deploy card folded away, then the HUD's Enemy button puts the camera on the defender's town
  // (a production build has no renderer hook); the close shot zooms in with the wheel
  // (screen points of the 844 x 390 HUD: the card's fold chevron, the Enemy button)
  await page.evaluate(() => {
    const head = [...document.querySelectorAll('h1,h2,h3,div,span')].find((e) => /^deploy your army$/i.test(e.textContent.trim()));
    let card = head;
    while (card && card.parentElement && card.getBoundingClientRect().height < 80) card = card.parentElement;
    if (card) card.style.visibility = 'hidden';
  }).catch(() => {});
  await page.waitForTimeout(500);
  const views = [['town', async () => { await page.mouse.click(132, 362); }]];
  for (const [name, fn] of views) {
    await fn().catch((e) => console.log('camera', e.message));
    await page.waitForTimeout(3500);
    const file = join(out, `battle-${age}-${size}-${tag}-${name}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
  if (logs.length) console.log(`battle ${tag} console errors:\n${logs.slice(0, 12).join('\n')}`);
  await page.close();
};

for (const levant of [false, true]) {
  if (what === 'map' || what === 'both') await mapShots(levant);
  if (what === 'battle' || what === 'both') await battleShots(levant);
}
await browser.close();
