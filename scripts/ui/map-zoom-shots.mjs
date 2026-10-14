// scripts/ui/map-zoom-shots.mjs
// Zooms the flat map from far to the close view over one of the player's armies and over a mine
// (Israel, the Levant), screenshots each step at 844x390 into plans/ui/map-zoom/ and prints the
// army's banner and figure sizes on screen at each zoom: units must never shrink as the map zooms
// in, and a mine must never draw black. Needs a running dev server and a Chrome; headless.
//   node scripts/ui/map-zoom-shots.mjs [--url http://localhost:5243/terra-imperium/] [--tag before|after]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5243/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/map-zoom');
fs.mkdirSync(OUT, { recursive: true });

const W = 844; const H = 390;
const ZOOMS = (arg('--zooms', '4,8,12,13,14,18,25,45,90')).split(',').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

// An army two tiles from the capital and a mine on another land tile two rings out.
const SETUP = `
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const T = m.getTiles();
  const ring2 = [...new Set(T.neighbors[cap.tile].flatMap((n) => T.neighbors[n]))].filter((t) => t !== cap.tile && !T.neighbors[cap.tile].includes(t) && T.land[t] === 1);
  const armyTile = ring2[0]; const mineTile = ring2[Math.floor(ring2.length / 2)];
  const u = (id, tile, classId) => ({ id, ownerId: me, regionId: capId, homeRegionId: capId, tile, domain: 'land', classId, strength: 90, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')), z1: u('z1', armyTile, 'infantry'), z2: u('z2', armyTile, 'infantry') };
  const tileState = { ...(s.world.tileState || {}), [mineTile]: { ...(s.world.tileState?.[mineTile] || {}), improvement: 'mine' } };
  const tileOwner = { ...s.world.tileOwner, [mineTile]: capId, [armyTile]: s.world.tileOwner[armyTile] ?? capId };
  const ll = (t) => { const p = T.latLonOf(t); return { lat: p.lat, lng: p.lon }; };
  window.__zoom = { army: ll(armyTile), mine: ll(mineTile), armyTile, mineTile };
  return { ...s, units, world: { ...s.world, tileState, tileOwner } };
`;

const sizes = (page) => page.evaluate(() => {
  const cv = window.__closeView;
  const figs = [];
  cv?.layers?.forEach((l, key) => l.levels.forEach((mesh) => {
    for (let i = 0; i < mesh.count; i++) { const e = mesh.instanceMatrix.array; const o = i * 16; figs.push({ key, scale: Math.hypot(e[o], e[o + 1], e[o + 2]), px: Math.hypot(e[o], e[o + 1], e[o + 2]) * l.height }); }
  }));
  return { k: window.__map2DTest.transform().k, banners: window.__glMap.banners(), figures: figs.slice(0, 4) };
});

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  page.on('console', (msg) => { if (msg.type() === 'warning' || msg.type() === 'error') console.log('console', msg.type(), msg.text().slice(0, 200)); });
  await startGame(page, arg('--people', 'Israel'));
  await patch(page, SETUP, ['data/geo/tiles.js']);
  await wait(1500);
  // A wheel zoom in over the army, read frame by frame while it runs and after it settles: the
  // figures' height on screen (layout height x live factor x live zoom / layout zoom) must never drop.
  await page.evaluate(() => { const c = window.__zoom.army; window.__map2DTest.focus(c.lat, c.lng, 16); });
  await wait(4000);
  const onScreen = () => page.evaluate(() => {
    const cv = window.__closeView; const k = window.__map2DTest.transform().k; const out = [];
    cv.layers.forEach((l) => { const m = l.levels.find((x) => x.count) || l.levels[0]; if (!m.count) return; const e = m.instanceMatrix.array; out.push(Math.hypot(e[0], e[1], e[2]) * l.height * (k / cv.layoutK)); });
    return { k: Math.round(k * 100) / 100, px: out.map((x) => Math.round(x * 10) / 10) };
  });
  const trace = [];
  const box = await page.locator('[data-testid="flat-map"]').boundingBox();
  const pt = await page.evaluate(() => { const c = window.__zoom.army; return window.__map2DTest.project(c.lat, c.lng); });
  await page.mouse.move(box.x + pt.x, box.y + pt.y);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -120); await wait(60); trace.push(await onScreen()); }
  await wait(3000); trace.push(await onScreen());
  console.log('wheel zoom in, figure px on screen by frame:', JSON.stringify(trace));
  const drops = trace.slice(1).filter((t, i) => t.px[0] < trace[i].px[0] - 0.5);
  console.log(drops.length ? `FIGURES SHRANK on ${drops.length} steps` : 'figures never shrank');
  for (const what of ['army', 'mine']) {
    for (const k of ZOOMS) {
      await page.evaluate(({ what, k }) => { const c = window.__zoom[what]; window.__map2DTest.focus(c.lat, c.lng, k); }, { what, k });
      await wait(k >= 13 ? 4000 : 1500);
      const file = path.join(OUT, `${TAG}-${what}-k${k}.png`);
      await page.screenshot({ path: file, timeout: 120000 });
      console.log('wrote', path.relative(process.cwd(), file), what === 'army' ? JSON.stringify(await sizes(page)) : '');
    }
  }
  await context.close();
} finally {
  await browser.close();
}
