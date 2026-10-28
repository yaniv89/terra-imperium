// scripts/ui/naval-shots.mjs
// Lane naval-campaign: the sea chain in a real browser at 844x390 (and 1600x900): a coastal city's
// build list offering a ship once Star Lore is known, an army boarding the ship in port, and the
// fleet beside free land with "Land here"; lane naval-8: an enemy fleet with troops standing off the coast. Needs a dev server (`npx vite --port 5197`).
//   node scripts/ui/naval-shots.mjs [--url http://localhost:5197/terra-imperium/] [--chrome <path>] [--he]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/naval');
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1600, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
// On screen, not only in the page: the box lies inside the viewport.
const onScreen = async (page, loc) => { const b = await loc.boundingBox().catch(() => null); const v = page.viewportSize(); return !!b && b.y >= 0 && b.y + b.height <= v.height && b.x >= 0 && b.x + b.width <= v.width; };
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed += 1; };

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

const shot = async (page, name, vp) => {
  await wait(900);
  const file = path.join(OUT, `${name}-${vp.id}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 60, timeout: 120000 });
  console.log('wrote', path.relative(process.cwd(), file));
};

// The Stone age's techs (Star Lore among them), so the Bronze age without Early Astronomy: with the
// carry-over rule (unitClasses.js) the War Galley is open; before it no ship was.
const SETUP = `
  const me = s.playerNationId;
  s = m.withAgesResearched(s, me, 'bronze');
  const tiles = m.getTiles();
  const port = Object.values(s.regions).find((c) => c.owner === me && m.hasSeaCoast(tiles, c));
  window.__naval = { port: port.id, tile: port.tile };
  return { ...s, resources: { ...s.resources, gold: 900 } };
`;

const run = async (vp, lang) => {
  const browser = await launchBrowser({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, locale: lang });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await startGame(page, 'Tartessos');
  await page.evaluate(() => { const s = window.__game.state; const u = Object.values(s.units).find((x) => x.ownerId === s.playerNationId && x.classId === 'settler'); if (u) window.__game.dispatch({ type: 'FOUND_CITY', payload: { unitId: u.id } }); });
  await wait(1500);
  if (lang !== 'en') { await page.evaluate(async (l) => (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l), lang); await wait(1500); }
  await patch(page, SETUP, ['engine/research.js', 'data/geo/tiles.js', 'engine/world/cities.js']);
  const nv = await page.evaluate(() => window.__naval);
  // 1. the build list offers the ship
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('ti:manage-city', { detail: { regionId: id, tab: 'build' } })), nv.port);
  await wait(1500);
  const shipRow = page.getByText(lang === 'en' ? /War Galley/ : /גלי|ספינ|אני/).first();
  await shipRow.scrollIntoViewIfNeeded().catch(() => {});
  check(await onScreen(page, shipRow), `${vp.id} ${lang}: build list shows War Galley`);
  await shot(page, `1-build-ship-${lang}`, vp);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));
  // 2. a ship and an army in port: board
  await patch(page, `
    const me = s.playerNationId; const { port, tile } = window.__naval;
    s = { ...s, units: { ...s.units } };
    let ship = null;
    const mk = (classId, extra) => { const id = 'unit_' + s.nextUnitSeq; s = { ...s, nextUnitSeq: s.nextUnitSeq + 1 }; s.units[id] = { id, regionId: port, tile, homeRegionId: port, ownerId: me, domain: classId === 'naval' ? 'naval' : 'land', classId, ageId: 'bronze', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: classId === 'naval' ? 1 : null, embarkedOn: null, ...extra }; return id; };
    ship = mk('naval', { navalLine: 'warship' });
    window.__naval.ship = ship;
    if (!Object.values(s.units).some((u) => u.ownerId === me && u.domain === 'land' && u.classId !== 'settler' && u.regionId === port)) mk('infantry', {});
    return s;`);
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:select-army', { detail: t })), nv.tile);
  await wait(1200);
  const sw = page.getByTestId('army-switch');
  if (await sw.isVisible().catch(() => false) && !(await page.getByTestId('board-ship').first().isVisible().catch(() => false))) await click(sw);
  await wait(600);
  const board = page.getByTestId('board-ship').first();
  check(await onScreen(page, board), `${vp.id} ${lang}: army sheet shows Board on screen`);
  await shot(page, `2-board-${lang}`, vp);
  if (await board.isVisible().catch(() => false)) await click(board);
  await wait(500);
  const aboard = await page.evaluate(() => Object.values(window.__game.state.units).some((u) => u.embarkedOn === window.__naval.ship));
  check(aboard, `${vp.id} ${lang}: the army is aboard`);
  // 3. the fleet at sea beside free land: Land here
  await patch(page, `
    const tiles = m.getTiles(); const { ship, tile } = window.__naval;
    const seen = new Map([[tile, 0]]); const q = [tile]; let goal = null; let land = null;
    while (q.length && goal == null) { const at = q.shift(); for (const n of tiles.neighbors[at]) { if (seen.has(n) || tiles.land[n] === 1) continue; seen.set(n, seen.get(at) + 1); q.push(n);
      const l = seen.get(n) >= 3 && tiles.neighbors[n].find((x) => m.passableTile(tiles, x) && s.world.tileOwner[x] == null); if (l != null && l !== false) { goal = n; land = l; break; } } }
    window.__naval.land = land;
    const units = { ...s.units };
    Object.values(units).forEach((u) => { if (u.id === ship || u.embarkedOn === ship) units[u.id] = { ...u, tile: goal }; });
    return { ...s, units };`, ['data/geo/tiles.js', 'engine/armies.js']);
  const land = await page.evaluate(() => window.__naval.land);
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:select-tile', { detail: t })), land);
  await wait(1500);
  const here = page.getByTestId('land-here');
  check(await onScreen(page, here), `${vp.id} ${lang}: tile sheet shows Land here on screen`);
  await shot(page, `3-land-${lang}`, vp);
  if (await here.isVisible().catch(() => false)) await click(here);
  await wait(800);
  const landed = await page.evaluate(() => Object.values(window.__game.state.units).some((u) => u.tile === window.__naval.land && !u.embarkedOn && u.domain === 'land'));
  check(landed, `${vp.id} ${lang}: the army landed`);
  await shot(page, `4-landed-${lang}`, vp);
  // 5. (lane naval-8) an enemy fleet with troops sails up to the player's port: after End Turn it
  // stands off the coast in sight, and the turn report says it can land next turn.
  await patch(page, `
    const me = s.playerNationId; const tiles = m.getTiles(); const { tile } = window.__naval;
    const homeOf = (id) => Object.values(s.regions).find((c) => c.owner === id && !c.outpost && m.isCoastal(c.id));
    // A rival with a city: a major if one lives, else (a fresh browser world at turn 1) the nearest independent.
    const rivals = Object.keys(s.nations).sort().filter((id) => id !== me && !s.nations[id].isEliminated && !id.startsWith('free_') && id !== 'rebels' && homeOf(id));
    const km = (id) => Math.hypot(...[0, 1, 2].map((k) => tiles.centres[homeOf(id).tile][k] - tiles.centres[tile][k]));
    const ai = rivals.find((id) => s.nations[id].kind !== 'independent') || rivals.sort((a, b) => km(a) - km(b))[0];
    const seen = new Map([[tile, 0]]); const q = [tile]; let from = null;
    while (q.length && from == null) { const at = q.shift(); for (const n of tiles.neighbors[at]) { if (seen.has(n) || m.seaDepth(tiles, n) !== 'coast') continue; seen.set(n, seen.get(at) + 1); q.push(n); if (seen.get(n) >= 4 && !m.touchesCoastOf(s, tiles, n, window.__naval.port)) { from = n; break; } } }
    const view = { ...s, playerNationId: ai, wars: [...s.wars, { id: 'w-sea-shot', aggressor: ai, enemy: me, active: true, startTurn: s.turnNumber, battleScore: 0 }] };
    const found = m.findSeaPath(view, from, s.regions[window.__naval.port].tile, ai);
    const home = homeOf(ai).id;
    const base = { ownerId: ai, regionId: home, homeRegionId: home, tile: from, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, promotions: [] };
    // The player's warship (step 3) goes home first: at sea it would stand in the enemy's way (a fleet halts before one).
    const own = { ...s.units, [window.__naval.ship]: { ...s.units[window.__naval.ship], tile, regionId: window.__naval.port } };
    const units = { ...own, aiFleet: { ...base, id: 'aiFleet', domain: 'naval', classId: 'naval', navalLine: 'warship', transportCapacity: 1, route: (found.path || []).slice(1), routePace: 50 }, aiArmy: { ...base, id: 'aiArmy', domain: 'land', classId: 'infantry', embarkedOn: 'aiFleet' } };
    window.__naval.ai = ai;
    return { ...view, playerNationId: me, units, nations: { ...s.nations, [ai]: { ...s.nations[ai], isAtWar: true }, [me]: { ...s.nations[me], isAtWar: true } } };`, ['data/geo/tiles.js', 'engine/fleets.js', 'data/navalReach.js']);
  // End Turn as a player would: answer the research and event prompts that hold it.
  const before = await page.evaluate(() => window.__game.state.turnNumber);
  for (let i = 0; i < 8 && !(await page.evaluate((b) => window.__game.state.turnNumber > b, before)); i++) {
    for (const id of ['research-let-advisor', 'event-option-0']) { const b = page.getByTestId(id); if (await b.isVisible().catch(() => false)) { await click(b); await wait(800); } }
    const builds = page.getByRole('button', { name: /Advisor builds|בונה היועץ|היועץ בונה/ }).first();
    if (await builds.isVisible().catch(() => false)) { await click(builds); await wait(800); }
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels')));
    await click(page.getByTestId('end-turn'));
    await wait(2500);
  }
  if (!(await page.getByTestId('turn-report').count()) && await page.getByTestId('turn-report-chip').count()) { await click(page.getByTestId('turn-report-chip')); await wait(800); }
  const warned = await page.evaluate(() => window.__game.state.logs.some((l) => l.msgKey === 'm.battle.fleetOffCoast'));
  check(warned, `${vp.id} ${lang}: the enemy fleet off the coast is reported`);
  const line = page.getByText(lang === 'en' ? /Enemy fleet off/ : /צי אויב מול/).first();
  check(await onScreen(page, line), `${vp.id} ${lang}: the warning is on screen`);
  await shot(page, `5-enemy-fleet-off-coast-${lang}`, vp);
  check(!errors.length, `${vp.id} ${lang}: no page errors ${errors.slice(0, 2).join(' | ')}`);
  await browser.close();
};

for (const vp of VIEWPORTS) for (const lang of process.argv.includes('--he') ? ['en', 'he'] : ['en']) await run(vp, lang);
process.exit(failed ? 1 : 0);
