// scripts/ui/fog-border-shots.mjs
// Borders and resource glyphs at the edge of the explored world (Civilization's rule: a foreign
// city's border shows only along the tiles the player has explored; nothing is drawn on unexplored
// land). Starts a game as Israel, then makes a foreign city far away half seen: its centre and the
// tiles on one side explored, the rest not. Screenshots at 844x390 into plans/ui/fog-borders/.
// Needs a running dev server and a Chrome; headless.
//   node scripts/ui/fog-border-shots.mjs [--url http://localhost:5243/terra-imperium/] [--tag before|after]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5243/terra-imperium/');
const TAG = arg('--tag', 'after');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/fog-borders');
fs.mkdirSync(OUT, { recursive: true });
const W = 844; const H = 390;
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

// A foreign city out of sight and unexplored, grown to two rings, then its centre and its eastern
// half explored (a scout passed by on that side), as the player would have seen it.
const SETUP = `
  const me = s.playerNationId; const T = m.getTiles();
  const ex = s.fog.explored[me];
  const cap = s.regions[s.nations[me].capitalRegionId];
  const ll0 = T.latLonOf(cap.tile);
  const far = Object.values(s.regions).filter((c) => c.owner && c.owner !== me && c.tile != null && !m.bitsHas(ex, c.tile))
    .map((c) => { const p = T.latLonOf(c.tile); return { c, d: Math.hypot(p.lat - ll0.lat, p.lon - ll0.lon) }; })
    .filter((x) => x.d > 14).sort((a, b) => a.d - b.d)[0].c;
  const ring1 = T.neighbors[far.tile];
  const ring2 = [...new Set(ring1.flatMap((n) => T.neighbors[n]))].filter((t) => t !== far.tile && !ring1.includes(t));
  const tileOwner = { ...s.world.tileOwner };
  [far.tile, ...ring1, ...ring2].forEach((t) => { if (T.land[t] === 1) tileOwner[t] = far.id; });
  const lon0 = T.latLonOf(far.tile).lon;
  // a scout of the player's stands three rings east of the city for one turn, then goes home
  const ring3 = [...new Set(ring2.flatMap((n) => T.neighbors[n]))].filter((t) => !ring2.includes(t) && !ring1.includes(t) && t !== far.tile && T.land[t] === 1);
  const east = ring3.sort((a, b) => T.latLonOf(b).lon - T.latLonOf(a).lon)[0];
  const scout = { id: 'scout_f', ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile: east, domain: 'land', classId: 'infantry', strength: 30, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null };
  let t1 = m.updateFog({ ...s, units: { ...s.units, scout_f: scout }, world: { ...s.world, tileOwner } }, { onlyPlayer: true });
  const units = { ...t1.units }; delete units.scout_f;
  t1 = m.updateFog({ ...t1, units }, { onlyPlayer: true });
  window.__fogShot = { lat: T.latLonOf(far.tile).lat, lng: lon0, name: far.name, explored: [far.tile, ...ring1, ...ring2].map((t) => (m.bitsHas(t1.fog.explored[me], t) ? 1 : 0)).join('') };
  return t1;
`;

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await startGame(page, arg('--people', 'Israel'));
  // the edge of the known world round the start, where the resource glyphs meet the dark
  for (const k of [4, 7, 10]) {
    await page.evaluate(async (k) => {
      const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
      const s = window.__game.state; const c = s.regions[s.nations[s.playerNationId].capitalRegionId];
      const p = getTiles().latLonOf(c.tile);
      window.__map2DTest.focus(p.lat, p.lon + 7, k);
    }, k);
    await wait(2500);
    const file = path.join(OUT, `${TAG}-edge-k${k}.png`);
    await page.screenshot({ path: file, timeout: 120000 });
    console.log('wrote', path.relative(process.cwd(), file));
  }
  await patch(page, SETUP, ['data/geo/tiles.js', 'engine/fog.js']);
  await wait(1500);
  for (let i = 0; i < 3; i++) { const l = page.getByRole('button', { name: /^Later$/ }); if (await l.first().isVisible().catch(() => false)) await click(l.first()); await wait(400); }
  console.log('half-seen city', JSON.stringify(await page.evaluate(() => window.__fogShot)));
  for (const k of [5, 9, 14]) {
    await page.evaluate((k) => { const c = window.__fogShot; window.__map2DTest.focus(c.lat, c.lng, k); }, k);
    await wait(k >= 13 ? 4000 : 2500);
    const file = path.join(OUT, `${TAG}-city-k${k}.png`);
    await page.screenshot({ path: file, timeout: 120000 });
    console.log('wrote', path.relative(process.cwd(), file));
  }
  await context.close();
} finally {
  await browser.close();
}
