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
  await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
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
  s = { ...s, units, nations, fog, wars: [...s.wars, war] };
`;

const shot = async (page, name, vp) => {
  const file = path.join(OUT, `${name}-${vp.id}.png`);
  await wait(700);
  await page.screenshot({ path: file, timeout: 120000 });
  console.log('wrote', path.relative(process.cwd(), file));
};

// Four past battles for the reports (the shape src/engine/battleReports.js records).
const REPORTS = `
  const me = s.playerNationId; const foe = window.__u1b.foe; const cap = window.__u1b.capId;
  const tl = (a, d, n) => Array.from({ length: n + 1 }, (_, i) => ({ round: i, att: Math.round(a * (1 - 0.08 * i)), def: Math.round(d * (1 - 0.2 * i)), ...(i === n ? { defBroken: true } : {}) }));
  const side = (cls, before, after) => cls.map((c, i) => ({ id: c + i, classId: c, before, after: i === 0 ? after : before - 2 }));
  const mk = (i, o) => ({ id: 'battle-' + i, turn: 30 - i * 3, year: s.year - (30 - i * 3), kind: 'land', tile: null, defense: false, commanded: false, fromRegionId: null, targetRegionId: cap,
    attackerNationId: me, defenderNationId: foe, playerSide: 'attacker', outcome: 'attacker', captured: false, rounds: 4, terrain: 'plains', battleType: 'assault',
    timeline: tl(34, 28, 4), sides: { attacker: side(['infantry', 'ranged', 'cavalry'], 12, 8), defender: side(['infantry', 'ranged'], 14, 0) }, fallen: { attacker: 96, defender: 231 }, fled: { attacker: 0, defender: 40 }, ...o });
  const reports = [
    mk(1, { name: 'Siege of Susa', commanded: true, captured: true, timeline: null }),
    mk(2, { name: 'Siege of Uruk', playerSide: 'defender', attackerNationId: foe, defenderNationId: me, outcome: 'defender', commanded: true, fallen: { attacker: 188, defender: 64 } }),
    mk(3, { name: 'Battle of Der', battleType: 'field', outcome: 'defender', fallen: { attacker: 140, defender: 88 } }),
    mk(4, { name: 'Battle of the Diyala fields', battleType: 'field', fallen: { attacker: 12, defender: 41 } })
  ];
  return { ...s, battleReports: reports, battleReportSeq: 4, battleSettings: { ...(s.battleSettings || {}), instantBattles: true } };
`;

const SCREENS = {
  W15: async (page, vp) => {
    await startGame(page);
    // the nearest raiders (or any independent) demands tribute; a little grudge already
    await patch(page, `
      const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
      const ind = Object.values(s.nations).filter((n) => n.indep && !n.isEliminated && s.regions[n.capitalRegionId]);
      const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
      const pick = ind.filter((n) => n.indep.personality === 'raiders').sort((a, b) => d(a) - d(b))[0] || ind[0];
      window.__u1b = { indep: pick.id };
      const n = s.nations[pick.id];
      return { ...s, resources: { ...s.resources, gold: 142 }, nations: { ...s.nations, [pick.id]: { ...n, indep: { ...n.indep, grudges: { ...(n.indep.grudges || {}), [me]: 45 } } } },
        tributeDemands: [{ id: 'td_u1b', indepId: pick.id, gold: 4, turns: 15, turn: s.turnNumber, expires: s.turnNumber + 3 }] };`);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-tribute-demand', { detail: 'td_u1b' })));
    await page.getByTestId('tribute-demand-sheet').waitFor({ timeout: 15000 });
    await shot(page, 'W15-tribute', vp);
    await click(page.getByTestId('tribute-choice-pay'));
    await shot(page, 'W15-tribute-pay', vp);
  },
  W13: async (page, vp) => {
    await startGame(page);
    await patch(page, `${WAR_SETUP}
      const r = m.addCity(s, window.__u1b.foe, { near: window.__u1b.capId });
      s = r.state; window.__u1b.target = r.cityId;
      const w = s.wars.at(-1);
      s = { ...s, wars: [...s.wars.slice(0, -1), { ...w, aggressor: s.playerNationId, enemy: window.__u1b.foe, battleScore: 26, score: 76 }],
        regions: { ...s.regions, [r.cityId]: { ...s.regions[r.cityId], occupiedBy: s.playerNationId } },
        nations: { ...s.nations, [s.playerNationId]: { ...s.nations[s.playerNationId], warExhaustion: 35 }, [window.__u1b.foe]: { ...s.nations[window.__u1b.foe], warExhaustion: 65 } } };
      return s;`, ['engine/testWorld.js']);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: window.__u1b.target })));
    await click(page.getByTestId('open-peace-deal'));
    await page.getByTestId('peace-deal').waitFor({ timeout: 15000 });
    await shot(page, 'W13-peace-deal', vp);
    await click(page.getByTestId('peace-term-other').first());
    await shot(page, 'W13-peace-deal-demand', vp);
    await click(page.getByRole('button', { name: 'Close' }).last());
    await patch(page, `const w = s.wars.find((x) => x.id === 'war_u1b');
      return { ...s, pendingPeaceOffer: { warId: w.id, from: window.__u1b.foe, terms: [{ type: 'gold', amount: 150 }, { type: 'humiliate' }] } };`);
    await page.getByTestId('peace-offer-sheet').waitFor({ timeout: 15000 });
    await shot(page, 'W13-peace-offer', vp);
  },
  W16: async (page, vp) => {
    await startGame(page);
    await patch(page, `${WAR_SETUP} return s;`);
    await patch(page, REPORTS);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-battle-report', { detail: 'battle-2' })));
    await page.getByTestId('battle-report').waitFor({ timeout: 15000 });
    await shot(page, 'W16-reports', vp);
    await click(page.getByRole('button', { name: 'Command', exact: true }));
    await shot(page, 'W16-reports-command', vp);
  },
  W11: async (page, vp) => {
    await startGame(page);
    await patch(page, `${WAR_SETUP}
      const w = s.wars.at(-1);
      s = { ...s, wars: [...s.wars.slice(0, -1), { ...w, aggressor: s.playerNationId, enemy: window.__u1b.foe }] };
      s = { ...s, units: { ...s.units, g4: { ...s.units.g1, id: 'g4', classId: 'cavalry', strength: 40 }, g5: { ...s.units.g1, id: 'g5', classId: 'siege', strength: 30 } } };
      // a city of theirs beside yours, with walls and a garrison (the Dawn world has none close)
      const r = m.addCity(s, window.__u1b.foe, { near: window.__u1b.capId });
      s = r.state; window.__u1b.target = r.cityId;
      const c = s.regions[r.cityId];
      s = { ...s, regions: { ...s.regions, [r.cityId]: { ...c, size: 4, buildings: { ...(c.buildings || {}), categories: { ...(c.buildings?.categories || {}), defense: 0 } } } } };
      const e = (id, classId, strength) => ({ ...s.units.e1, id, classId, strength, regionId: r.cityId, homeRegionId: r.cityId, tile: c.tile });
      s = { ...s, units: { ...s.units, t1: e('t1', 'infantry', 80), t2: e('t2', 'ranged', 60) } };
      return s;`, ['engine/testWorld.js']);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: window.__u1b.target })));
    await wait(1500);
    const invade = page.getByRole('button', { name: /Invade from|Attack from|Attack/ }).first();
    await click(invade);
    await page.getByTestId('pre-battle').waitFor({ timeout: 15000 });
    await shot(page, 'W11-prebattle-scouts', vp);
    await click(page.getByLabel(/^Call off the attack/));
    await patch(page, 'return { ...s, intel: { ...(s.intel || {}), [window.__u1b.foe]: s.turnNumber + 5 } };');
    await wait(800);
    await click(page.getByRole('button', { name: /Invade from|Attack from|Attack/ }).first());
    await page.getByTestId('pre-battle').waitFor({ timeout: 15000 });
    await click(page.getByTestId('battle-choice-auto'));
    await shot(page, 'W11-prebattle-spy', vp);
  },
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

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
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
