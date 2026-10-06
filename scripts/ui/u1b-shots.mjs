// scripts/ui/u1b-shots.mjs
// Screenshots of the war screens restyled in phase U1b (plans/UI-DESIGN.md section 3: W11, W13 to
// W16, B01, B05, B06, B08) at the reference phone screen (844x390 landscape) and a desktop
// (1280x800), into plans/ui/u1b/. Needs a running dev server (`npx vite --port 5187`) and a Chrome;
// headless. States that take many turns to reach (a war, an attack, a peace offer) are set up
// through the dev-only window.__game hook (GameContext.jsx) with LOAD_GAME and the engine's own
// functions, imported in the page.
//   node scripts/ui/u1b-shots.mjs [--url http://localhost:5187/terra-imperium/] [--chrome <path>] [--only W14,W11]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5187/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const OUT = path.resolve('plans/ui/u1b');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { id: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people = 'Akkad') => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

// Run `body` in the page with `s` (the live state) and the engine modules named in `mods`; it
// returns a new state, loaded with LOAD_GAME.
const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

// A war with the nearest major people, an army of theirs and a garrison of yours: the common
// ground for the war screens. Leaves `m.foe` (their id) on window.__u1b.
const WAR_SETUP = `
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const cands = Object.values(s.nations).filter((n) => n.id !== me && !n.indep && n.capitalRegionId && s.regions[n.capitalRegionId]);
  const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
  const foe = cands.sort((a, b) => d(a) - d(b))[0];
  const foeCap = s.regions[foe.capitalRegionId];
  const war = { id: 'war_u1b', aggressor: foe.id, enemy: me, active: true, startYear: s.year - 9, startTurn: Math.max(1, s.turnNumber - 9), cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: capId } };
  const u = (id, owner, regionId, tile, classId, strength, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null, ...extra });
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')),
    g1: u('g1', me, capId, cap.tile, 'infantry', 70), g2: u('g2', me, capId, cap.tile, 'ranged', 50), g3: u('g3', me, capId, cap.tile, 'infantry', 60),
    e1: u('e1', foe.id, foe.capitalRegionId, foeCap.tile, 'infantry', 100), e2: u('e2', foe.id, foe.capitalRegionId, foeCap.tile, 'infantry', 90), e3: u('e3', foe.id, foe.capitalRegionId, foeCap.tile, 'ranged', 70), e4: u('e4', foe.id, foe.capitalRegionId, foeCap.tile, 'siege', 30) };
  window.__u1b = { foe: foe.id, capId, foeCapId: foe.capitalRegionId };
  const nations = { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe.id]: { ...s.nations[foe.id], isAtWar: true } };
  const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe.id]: 1 } } } : s.fog;
  s = { ...s, units, nations, fog, wars: [...s.wars, war], turnNumber: Math.max(s.turnNumber, 12) };
`;

const shot = async (page, name, vp) => {
  const file = path.join(OUT, `${name}-${vp.id}.png`);
  await wait(700);
  await page.screenshot({ path: file, timeout: 120000 });
  console.log('wrote', path.relative(process.cwd(), file));
};

const SCREENS = {
  W14: async (page, vp) => {
    await startGame(page);
    await patch(page, `${WAR_SETUP}
      const def = m.createDefenseRecord(s, { war, regionId: window.__u1b.capId, aggressorShare: 0.6, seed: 11, index: 1 });
      const def2 = { ...def, id: def.id + 'b', seed: 12 };
      return { ...s, pendingDefenses: [def, def2] };`, ['engine/defense.js']);
    await page.getByTestId('defense-sheet').waitFor({ timeout: 15000 });
    await shot(page, 'W14-attacked', vp);
    await click(page.getByTestId('defense-auto'));
    await shot(page, 'W14-attacked-auto', vp);
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
