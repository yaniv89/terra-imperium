// scripts/ui/map-zoom-shots.mjs
// Zooms the flat map from far to the close view over one of the player's armies and over a mine
// (Israel, the Levant), screenshots each step at 844x390 into plans/ui/map-zoom/ and prints the
// army's banner and figure sizes on screen at each zoom: units must never shrink as the map zooms
// in, and a mine must never draw black. Needs a running dev server and a Chrome; headless.
//   node scripts/ui/map-zoom-shots.mjs [--url http://localhost:5231/terra-imperium/] [--tag before|after]
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5243/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/fix-zoomsize');
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
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')), z1: u('z1', armyTile, 'infantry'), z2: u('z2', armyTile, 'infantry'), z3: { ...u('z3', armyTile, 'cavalry'), strength: 60 }, z4: u('z4', cap.tile, 'infantry') };
  const tileState = { ...(s.world.tileState || {}), [mineTile]: { ...(s.world.tileState?.[mineTile] || {}), improvement: 'mine' } };
  const tileOwner = { ...s.world.tileOwner, [mineTile]: capId, [armyTile]: s.world.tileOwner[armyTile] ?? capId };
  const ll = (t) => { const p = T.latLonOf(t); return { lat: p.lat, lng: p.lon }; };
  window.__zoom = { army: ll(armyTile), city: ll(cap.tile), mine: ll(mineTile), armyTile, mineTile };
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


const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
const run = async (vw, vh, tag, mobile) => {
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await startGame(page, 'Israel');
  await patch(page, SETUP, ['data/geo/tiles.js']);
  await wait(1500);
  const shot = async (name) => { const f = path.join(OUT, tag + '-' + name + '.png'); await page.screenshot({ path: f, timeout: 120000 }); console.log('wrote', f); };
  const focus = async (what, k) => { await page.evaluate(({ what, k }) => { const c = window.__zoom[what]; window.__map2DTest.focus(c.lat, c.lng, k); }, { what, k }); await wait(4500); };
  const tf = () => page.evaluate(() => window.__map2DTest.transform().k);
  await focus('army', 500); console.log(tag, 'closest k', await tf());
  await shot('closest-stack');
  console.log('banners', JSON.stringify(await page.evaluate(() => window.__glMap.banners())));
  await focus('city', 500); await shot('city-hex');
  await focus('army', 500);
  const tapFlag = async () => {
    const box = await page.locator('[data-testid="flat-map"]').boundingBox();
    const hit = await page.evaluate(() => { const p = window.__map2DTest.project(window.__zoom.army.lat, window.__zoom.army.lng); for (let dy = -150; dy <= 60; dy += 4) for (let dx = -60; dx <= 60; dx += 4) { const h = window.__map2DTest.hitAt(p.x + dx, p.y + dy); if (h && h.kind === 'marker') return { x: p.x + dx, y: p.y + dy }; } return null; });
    console.log('tap', JSON.stringify(hit));
    await page.mouse.click(box.x + hit.x, box.y + hit.y);
    await wait(1200);
  };
  await tapFlag(); await shot('flag-tap-1');
  console.log('unit-of', await page.getByTestId('army-unit-of').textContent().catch(() => 'none'));
  await tapFlag(); await shot('flag-tap-2');
  console.log('unit-of', await page.getByTestId('army-unit-of').textContent().catch(() => 'none'));
  await context.close();
};
try {
  await run(844, 390, 'phone', true);
  await run(1440, 900, 'desktop', false);
} finally { await browser.close(); }
