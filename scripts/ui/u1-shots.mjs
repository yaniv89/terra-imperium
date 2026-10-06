// scripts/ui/u1-shots.mjs
// Screenshots of the world screens restyled in phase U1 (plans/UI-DESIGN.md), at the reference
// phone screen (844x390 landscape) and a desktop (1280x800), into plans/ui/u1/.
// Needs a running dev server (`npx vite --port 5181`) and a Chrome; headless.
//   node scripts/ui/u1-shots.mjs [--url http://localhost:5181/terra-imperium/] [--chrome <path>] [--only W02,W05]
// The game is driven through the UI and, for states that take many turns to reach (a war, a first
// contact), through the dev-only window.__game hook (GameContext.jsx) with LOAD_GAME.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5181/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p)));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const OUT = path.resolve('plans/ui/u1');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people = 'Akkad', explored = false) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  if (explored) await click(page.getByTestId('explored-world'));
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // The first research choice sheet: let the advisor pick so it does not cover the map.
  const later = page.getByRole('button', { name: /Later|Not now/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

// Change the live game state through the dev hook (LOAD_GAME keeps the reducer's rules).
const patchState = (page, fnSource) => page.evaluate((src) => {
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', src);
  const s = fn(window.__game.state); // fn returns a new state: change only what it spreads
  window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
}, fnSource);

const openTab = (page, tab) => page.evaluate((t) => window.dispatchEvent(new CustomEvent('ti:open-tab', { detail: t })), tab);

const shot = async (page, name, vp) => {
  const file = path.join(OUT, `${name}-${vp.id}.png`);
  await wait(600);
  await page.screenshot({ path: file });
  console.log('wrote', path.relative(process.cwd(), file));
};

const SCREENS = {
  W01: async (page, vp) => {
    await page.goto(URL_BASE);
    await page.evaluate(() => localStorage.clear());
    await page.goto(URL_BASE);
    await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
    await shot(page, 'W01-start', vp);
  },
  W02: async (page, vp) => {
    await startGame(page);
    // queue a build in the capital so its banner carries the production bar
    await patchState(page, `
      const me = s.playerNationId; const cap = s.nations[me].capitalRegionId; const c = s.regions[cap];
      return { ...s, regions: { ...s.regions, [cap]: { ...c, production: { ...c.production, current: { kind: 'building', category: 'food', tier: 0 }, progress: 14 } } } };`);
    await shot(page, 'W02-map', vp);
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 6; i++) { await click(zoomIn); await wait(350); }
    await wait(2500);
    await shot(page, 'W02-map-close', vp);
  },
  W03: async (page, vp) => {
    await startGame(page);
    // meet the nearest major people not met yet (the card shows for contacts made while playing)
    await patchState(page, `
      const me = s.playerNationId; const met = s.fog.met[me] || {};
      const cap = s.regions[s.nations[me].capitalRegionId];
      const cands = Object.values(s.nations).filter((n) => n.id !== me && !met[n.id] && !n.indep && n.capitalRegionId && s.regions[n.capitalRegionId]);
      const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
      const pick = cands.sort((a, b) => d(a) - d(b))[0];
      return { ...s, fog: { ...s.fog, met: { ...s.fog.met, [me]: { ...met, [pick.id]: s.turnNumber } } } };`);
    await page.getByTestId('first-contact').waitFor({ timeout: 10000 });
    await shot(page, 'W03-first-contact', vp);
  },
  W04: async (page, vp) => {
    await startGame(page);
    // settlers in the capital, the Settle lens on (key 7), a tile two rings out (blocked) then one far enough
    await patchState(page, `
      const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
      const u = { id: 'shot-settler', ownerId: me, regionId: cap.id, homeRegionId: cap.id, domain: 'land', classId: 'settler', strength: 100, maxStrength: 100, morale: 100, movesLeft: 3, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, tile: cap.tile, target: null };
      return { ...s, units: { ...s.units, [u.id]: u } };`);
    await page.keyboard.press('7');
    const pickTile = (ring) => page.evaluate(async (r) => {
      const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
      const t = getTiles(); const s = window.__game.state;
      const start = s.regions[s.nations[s.playerNationId].capitalRegionId].tile;
      let frontier = [start]; const seen = new Set(frontier);
      for (let d = 0; d < r; d++) { const next = []; frontier.forEach((x) => t.neighbors[x].forEach((n) => { if (!seen.has(n)) { seen.add(n); next.push(n); } })); frontier = next; }
      let tile = frontier.find((x) => t.land[x] && !s.world.tileOwner[x]);
      if (r > 2) { // the best legal site at that range (the settle card's own model)
        const { settleSiteModel } = await import('/terra-imperium/src/components/map/settleSiteModel.js');
        const best = frontier.map((x) => ({ x, m: t.land[x] && !s.world.tileOwner[x] ? settleSiteModel(s, x, 'bronze') : null })).filter((o) => o.m?.ok).sort((a, b) => b.m.score - a.m.score)[0];
        if (best) tile = best.x;
      }
      window.dispatchEvent(new CustomEvent('ti:select-tile', { detail: tile }));
      return tile;
    }, ring);
    await pickTile(2);
    await page.getByTestId('tile-sheet').waitFor({ timeout: 10000 });
    await shot(page, 'W04-settle-blocked', vp);
    await pickTile(5);
    await shot(page, 'W04-settle-site', vp);
  },
  W05: async (page, vp) => {
    await startGame(page);
    // a build under way and the damage of a past battle (3 houses ruined, the town hall damaged)
    await patchState(page, `
      const me = s.playerNationId; const cap = s.nations[me].capitalRegionId; const c = s.regions[cap];
      return { ...s, regions: { ...s.regions, [cap]: { ...c, production: { ...c.production, current: { kind: 'building', category: 'defense', tier: 0 }, queue: [{ kind: 'unit', classId: 'infantry' }], progress: 20 }, cityDamage: { ruined: { 'house-0': 5, 'house-1': 7, 'house-2': 9 }, damaged: { townhall: 2 } } } } };`);
    await page.evaluate(() => { const s = window.__game.state; window.dispatchEvent(new CustomEvent('ti:select-region', { detail: s.nations[s.playerNationId].capitalRegionId })); });
    await click(page.getByTestId('open-city-sheet'));
    await page.getByTestId('city-sheet-panel').waitFor({ timeout: 10000 });
    await shot(page, 'W05-city', vp);
    await click(page.getByTestId('city-tab-defense'));
    await shot(page, 'W05-city-defense', vp);
  },
  W09: async (page, vp) => {
    await startGame(page);
    // Irrigation under way (Kish is on a river: its boost waits), two techs queued
    await patchState(page, `
      const r = s.research || {};
      return { ...s, research: { ...r, current: 'infrastructure_irrigation_canals', queue: ['science_cuneiform_records', 'governance_code_of_laws'], progress: { ...(r.progress || {}), infrastructure_irrigation_canals: 9 } } };`);
    await openTab(page, 'tech');
    await page.getByTestId('research-current').waitFor({ timeout: 10000 });
    await shot(page, 'W09-research', vp);
  },
  W10: async (page, vp) => {
    await startGame(page);
    // state 2: "warn me" on, the first tap arms End Turn and shows what still waits
    await patchState(page, 'return { ...s, battleSettings: { ...(s.battleSettings || {}), warnEndTurn: true } };');
    await click(page.locator('[data-testid="turn-dock"] button[data-armed]'));
    await page.getByTestId('end-turn-warnings').waitFor({ timeout: 10000 });
    await shot(page, 'W10-end-turn-armed', vp);
    await wait(5000); // disarms by itself
    // the report: a turn that brought a siege held at the capital, a raid, news and growth (a
    // contact would also open its first-contact card, W03)
    await patchState(page, `
      const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const c = s.regions[capId];
      const battle = { id: 'battle-shot', name: 'Siege of ' + c.name, playerSide: 'defender', outcome: 'defender', defense: true, targetRegionId: capId, fallen: { attacker: 300, defender: 40 }, sides: { attacker: [], defender: [] } };
      return { ...s, turnNumber: s.turnNumber + 1, year: s.year + 1,
        battleReports: [battle, ...(s.battleReports || [])],
        logs: [...s.logs, { year: s.year, type: 'combat', message: 'Gutian raiders pillage the land of ' + c.name + ' (a pasture): 12 gold taken.' }, { year: s.year, type: 'diplomacy', message: 'The Kingdom of Elam denounces your border forts.' }],
        research: { ...(s.research || {}), current: 'infrastructure_irrigation_canals' },
        regions: { ...s.regions, [capId]: { ...c, size: (c.size || 1) + 1 } } };`);
    await page.getByTestId('turn-report').waitFor({ timeout: 10000 });
    await shot(page, 'W10-turn-report', vp);
  },
  W12: async (page, vp) => {
    await startGame(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-settings')));
    await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
    await shot(page, 'W12-settings', vp);
  },
  W17: async (page, vp) => {
    await startGame(page);
    await click(page.getByTestId('top-bar-nation'));
    await page.getByTestId('nation-overview').waitFor({ timeout: 10000 });
    await shot(page, 'W17-nation', vp);
  }
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log(`[${vp.id}] pageerror`, String(e).slice(0, 300)));
    for (const [id, run] of Object.entries(SCREENS)) {
      if (ONLY.length && !ONLY.includes(id)) continue;
      try { await run(page, vp); } catch (e) { console.log(`[${vp.id}] ${id} failed:`, String(e).slice(0, 400)); }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
export { patchState };
