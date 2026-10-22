// audits/user-playtest-22oct/shots.mjs
// The user's 22 Oct playtest, map side: a unit (infantry) and a farm two rings from Israel's
// capital, shot at the start zoom, the close view's first zoom, a closer zoom and a far zoom, at
// 844x390 (phone) and 1600x900. Prints the figure's height and the hex spacing on screen.
// Needs a dev server of this checkout and Chrome; headless.
//   node audits/user-playtest-22oct/shots.mjs --url http://localhost:5261/terra-imperium/ --tag before|after
import { launchBrowser } from '../../scripts/lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { foundFirstCity } from '../../e2e/startHelpers.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5261/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/user-playtest-22oct');
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

const SETUP = `
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const T = m.getTiles();
  const ring1 = T.neighbors[cap.tile];
  const ring2 = [...new Set(ring1.flatMap((n) => T.neighbors[n]))].filter((t) => t !== cap.tile && !ring1.includes(t) && T.land[t] === 1);
  const armyTile = ring2[0]; const farmTile = ring2[Math.floor(ring2.length / 2)];
  const u = (id, tile, classId) => ({ id, ownerId: me, regionId: capId, homeRegionId: capId, tile, domain: 'land', classId, strength: 100, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')), z1: u('z1', armyTile, 'infantry') };
  const tileState = { ...(s.world.tileState || {}), [farmTile]: { ...(s.world.tileState?.[farmTile] || {}), improvement: 'farm' } };
  const tileOwner = { ...s.world.tileOwner, [farmTile]: capId, [armyTile]: s.world.tileOwner[armyTile] ?? capId };
  const ll = (t) => { const p = T.latLonOf(t); return { lat: p.lat, lng: p.lon }; };
  window.__shot = { army: ll(armyTile), farm: ll(farmTile) };
  return { ...s, units, world: { ...s.world, tileState, tileOwner } };
`;

const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
const run = async (vw, vh, name, mobile) => {
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await startGame(page, 'Israel');
  await foundFirstCity(page);
  await wait(2000);
  await page.waitForFunction(() => window.__map2DTest && window.__game, null, { timeout: 60000 });
  const startK = await page.evaluate(() => window.__map2DTest.transform().k);
  await page.evaluate(async (body) => {
    const m = await import('/terra-imperium/src/data/geo/tiles.js');
    // eslint-disable-next-line no-new-func
    const next = await new Function('s', 'm', `return (async () => { ${body} })();`)(window.__game.state, m);
    window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
  }, SETUP);
  await wait(1500);
  const shoot = async (what, k, label) => {
    await page.evaluate(({ what, k }) => { const c = window.__shot[what]; window.__map2DTest.focus(c.lat, c.lng, k); }, { what, k });
    await wait(4500);
    const info = await page.evaluate(() => {
      const cv = window.__closeView; let fig = 0;
      cv?.layers?.forEach((l) => l.levels.forEach((mesh) => { if (mesh.count) { const e = mesh.instanceMatrix.array; fig = Math.max(fig, Math.hypot(e[0], e[1], e[2]) * l.height); } }));
      return { k: window.__map2DTest.transform().k, fig: Math.round(fig) };
    });
    const f = path.join(OUT, `${TAG}-${name}-${label}.png`);
    await page.screenshot({ path: f, timeout: 120000 });
    console.log(name, label, 'k', info.k.toFixed(1), 'figure px', info.fig, f);
  };
  await shoot('army', startK, 'start-zoom');
  await shoot('army', 14, 'close-view');
  await shoot('army', 40, 'closer');
  await shoot('farm', 40, 'farm');
  await shoot('army', 6, 'far');
  await context.close();
};
try {
  await run(844, 390, 'phone', true);
  await run(1600, 900, 'desktop', false);
} finally { await browser.close(); }
