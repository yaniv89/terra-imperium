// scripts/ui/report-fates-shots.mjs
// Screenshots of the battle report's unit fates (src/engine/battleReports.js unitFate, shown by
// BattleReportSheet.jsx) at the reference phone screen (844x390 landscape) and a desktop, into
// plans/ui/report-fates/. Three past battles: a field battle won (their units run down by
// cavalry, broken but escaped, withdrawn, destroyed), a lost one (yours), and a report saved
// before fates were recorded. Same set-up as scripts/ui/u1b-shots.mjs W16.
// Needs a running dev server (`npx vite --port 5187`) and a Chrome; headless.
//   node scripts/ui/report-fates-shots.mjs [--url http://localhost:5187/terra-imperium/] [--chrome <path>]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5187/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/report-fates');
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
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

// The reports, in the shape battleReports.js records (strength x MEN_PER_STRENGTH = men).
const SETUP = () => {
  const s = window.__game.state;
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const foe = Object.values(s.nations).filter((n) => n.id !== me && !n.indep && n.capitalRegionId && s.regions[n.capitalRegionId])
    .sort((a, b) => {
      const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
      return d(a) - d(b);
    })[0].id;
  const tl = (a, d, n) => Array.from({ length: n + 1 }, (_, i) => ({ round: i, att: Math.round(a * (1 - 0.08 * i)), def: Math.round(d * (1 - 0.18 * i)), ...(i === n ? { defBroken: true } : {}) }));
  const u = (id, classId, before, after, extra = {}) => ({ id, classId, domain: 'land', before, after, routed: false, ...extra });
  const base = { kind: 'field', tile: null, defense: false, fromRegionId: null, targetRegionId: capId, attackerNationId: me, defenderNationId: foe, playerSide: 'attacker', captured: false, rounds: 5, terrain: 'plains', battleType: 'field' };
  const reports = [
    { ...base, id: 'battle-3', turn: s.turnNumber - 1, year: s.year - 1, name: 'Battle of the Diyala fields', outcome: 'attacker', commanded: false, timeline: tl(46, 52, 5),
      sides: {
        attacker: [u('g1', 'infantry', 16, 13, { regiment: 1, fate: 'held' }), u('g2', 'cavalry', 10, 9, { regiment: 1, fate: 'held' }), u('g3', 'ranged', 12, 11, { regiment: 2, fate: 'held' }), u('g4', 'infantry', 8, 3, { regiment: 3, routed: true, fate: 'pulledBack' })],
        defender: [u('e1', 'infantry', 16, 0, { fate: 'fellFighting' }), u('e2', 'infantry', 14, 6, { routed: true, fate: 'runDown', byCavalry: true }), u('e3', 'ranged', 10, 5, { routed: true, fate: 'escaped' }), u('e4', 'infantry', 12, 9, { fate: 'withdrew' })]
      },
      fallen: { attacker: 100, defender: 320 }, fled: { attacker: 30, defender: 110 } },
    { ...base, id: 'battle-2', turn: s.turnNumber - 4, year: s.year - 4, name: 'Battle of Der', outcome: 'defender', commanded: true, timeline: null,
      sides: {
        attacker: [u('g5', 'infantry', 14, 0, { regiment: 4, fate: 'fellFighting' }), u('g6', 'ranged', 10, 4, { regiment: 3, routed: true, fate: 'runDown' }), u('g7', 'infantry', 12, 7, { regiment: 5, routed: true, fate: 'escaped' }), u('g8', 'infantry', 12, 10, { regiment: 6, fate: 'withdrew' })],
        defender: [u('e5', 'infantry', 18, 14, { fate: 'held' }), u('e6', 'cavalry', 8, 7, { fate: 'held' })]
      },
      fallen: { attacker: 270, defender: 50 }, fled: { attacker: 110, defender: 0 } },
    { ...base, id: 'battle-1', turn: s.turnNumber - 7, year: s.year - 7, name: 'Siege of Susa', kind: 'land', battleType: 'assault', outcome: 'attacker', commanded: false, timeline: tl(30, 24, 4),
      // saved before fates were recorded
      sides: { attacker: [{ id: 'o1', classId: 'infantry', before: 12, after: 9 }], defender: [{ id: 'o2', classId: 'infantry', before: 12, after: 0 }, { id: 'o3', classId: 'ranged', before: 8, after: 4, routed: true }] },
      fallen: { attacker: 30, defender: 160 }, fled: { attacker: 0, defender: 40 } }
  ];
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, turnNumber: s.turnNumber + 9, year: s.year + 9, battleReports: reports.map((r) => ({ ...r, turn: r.turn + 9, year: r.year + 9 })), battleReportSeq: 3, battleSettings: { ...(s.battleSettings || {}), instantBattles: true } } });
};

const run = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      const page = await context.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await startGame(page);
      await page.evaluate(SETUP);
      await wait(800);
      const cont = page.getByRole('button', { name: 'Continue', exact: true });
      if (await cont.isVisible().catch(() => false)) await click(cont);
      for (const id of ['battle-3', 'battle-2', 'battle-1']) {
        await page.evaluate((detail) => window.dispatchEvent(new CustomEvent('ti:open-battle-report', { detail })), id);
        await page.getByTestId('battle-report').waitFor({ timeout: 15000 });
        await page.getByTestId('battle-report-units').first().scrollIntoViewIfNeeded();
        await wait(700);
        const file = path.join(OUT, `report-fates-${id}-${vp.id}.png`);
        await page.screenshot({ path: file, timeout: 120000 });
        console.log('wrote', path.relative(process.cwd(), file));
        await click(page.getByRole('button', { name: 'Close reports' }));
        await wait(400);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
