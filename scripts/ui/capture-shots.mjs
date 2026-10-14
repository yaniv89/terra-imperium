// scripts/ui/capture-shots.mjs
// A real-browser check of lane CB11 (decisions 40 and 41) on the phone in landscape: the capture
// card after a city falls to the player (844x390 and 844x340, Safari's bars), its four choices, a
// disabled-looking choice that still says why, no close on a backdrop tap, that it comes back after
// a reload, and the no man's land badge on the pre-battle card. Needs a running dev server of THIS
// checkout (`npx vite --port 5231`) and a Chrome; headless. States are set up through the dev-only
// window.__game hook with LOAD_GAME (as panels-shots.mjs does). Screenshots go to plans/ui/cb11/.
//   node scripts/ui/capture-shots.mjs [--url http://localhost:5231/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5231/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/cb11');
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const box = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });
const shot = async (page, name) => { await wait(600); await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }); };

// The player takes the nearest independent's city: ownership changes and the card waits.
const TAKE = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const ind = Object.values(s.nations).filter((n) => n.indep && !n.isEliminated && s.regions[n.capitalRegionId]);
  const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
  const pick = ind.sort((a, b) => d(a) - d(b))[0];
  const cityId = pick.capitalRegionId;
  const r = m.conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, cityId, me, null);
  return m.openCapture({ ...s, regions: r.regions, nations: r.nations }, { opId: 'shot1', cityId, by: me, from: pick.id, source: 'battle' });`;

// A player stack and an independent's stack on two free land tiles side by side (no man's land).
const CLASH = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const t = m.getTiles(); const owner = s.world.tileOwner;
  const ind = Object.values(s.nations).find((n) => n.indep && !n.isEliminated && !(n.indep.truceWith || {})[me]);
  let seen = new Set([cap.tile]); let f = [cap.tile]; let pair = null;
  for (let d = 0; d < 10 && !pair; d++) { const n = []; f.forEach((x) => t.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.add(y); n.push(y); } })); f = n.sort((a, b) => a - b);
    for (const x of f) { if (t.land[x] !== 1 || owner[x] != null) continue; const o = t.neighbors[x].find((y) => t.land[y] === 1 && owner[y] == null); if (o != null) { pair = [x, o]; break; } } }
  const u = (id, ownerId, regionId, tile) => ({ id, ownerId, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });
  window.__clash = pair;
  return { ...s, pendingCaptures: [], units: { ...s.units, nml1: u('nml1', me, cap.id, pair[0]), nml2: u('nml2', ind.id, ind.capitalRegionId, pair[1]) } };`;

const startGame = async (page) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
};

const main = async () => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await startGame(page);
  check('layout is phone-landscape', await page.evaluate(() => document.documentElement.dataset.layout) === 'phone-landscape');
  // Clear the research card out of the way if it is up.
  await patch(page, 'return { ...s, researchAdvisor: true };').catch(() => {});

  await patch(page, TAKE, ['engine/conquest.js', 'engine/capture.js']);
  const card = page.getByTestId('capture-card');
  await card.waitFor({ timeout: 15000 }).catch(() => {});
  check('the capture card shows after the city falls', await card.isVisible().catch(() => false));
  check('it has the four choices', (await page.locator('[data-testid^="capture-choice-"]').count()) === 4);
  const b390 = await box(card);
  check('the card fits 844x390', b390.top >= 0 && b390.bottom <= 390 && b390.left >= 0 && b390.right <= 844, JSON.stringify(b390));
  await shot(page, '01-capture-844x390');
  // A tap on the dimmed map never closes it.
  await page.mouse.click(20, 20);
  await wait(300);
  check('a backdrop tap does not close it', await card.isVisible().catch(() => false));
  // Raze is greyed when the city cannot be razed... show the reason of the first disabled choice, if any.
  const disabled = page.locator('[data-testid^="capture-choice-"][aria-disabled="true"]');
  if (await disabled.count()) {
    await click(disabled.first());
    check('a choice not on offer says why', await page.getByTestId('capture-reason').isVisible().catch(() => false));
    await shot(page, '02-capture-disabled-reason');
  }
  await click(page.getByTestId('capture-choice-tributary'));
  await shot(page, '03-capture-tributary');
  // 844x340: Safari's bars.
  await page.setViewportSize({ width: 844, height: 340 });
  await wait(500);
  const b340 = await box(card);
  const go = await box(page.getByTestId('capture-go'));
  check('the card and its button fit 844x340', b340.top >= 0 && b340.bottom <= 340 && go.bottom <= 340, `${JSON.stringify(b340)} go ${JSON.stringify(go)}`);
  await shot(page, '04-capture-844x340');
  // End Turn waits for it.
  const blockers = await page.evaluate(async () => (await import('/terra-imperium/src/engine/turnBlockers.js')).turnBlockers(window.__game.state).map((b) => b.kind));
  check('End Turn waits for the choice', blockers.includes('capture'), blockers.join(','));
  // A reload brings it back (the record lives in the save).
  await wait(3000);
  await page.reload();
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 }).catch(() => {});
  await wait(2500);
  const back = await page.getByTestId('capture-card').isVisible().catch(() => false);
  const waitingChip = await page.getByTestId('capture-chip').isVisible().catch(() => false);
  check('after a reload the choice is still waiting', back || waitingChip, back ? 'card' : waitingChip ? 'chip' : 'gone');
  if (!back && waitingChip) await click(page.getByTestId('capture-chip'));
  await page.getByTestId('capture-card').waitFor({ timeout: 10000 }).catch(() => {});
  const cityId = await page.evaluate(() => window.__game.state.pendingCaptures?.[0]?.cityId);
  await click(page.getByTestId('capture-choice-tributary'));
  await click(page.getByTestId('capture-go'));
  await wait(800);
  const after = await page.evaluate((id) => ({ owner: window.__game.state.regions[id]?.owner, me: window.__game.state.playerNationId, left: (window.__game.state.pendingCaptures || []).length }), cityId);
  check('Make tributary commits once and the card goes', after.left === 0 && after.owner && after.owner !== after.me, JSON.stringify(after));
  check('the card is gone', !(await page.getByTestId('capture-card').isVisible().catch(() => false)));

  // Decision 41: the pre-battle card of a clash on nobody's land.
  await patch(page, CLASH, ['data/geo/tiles.js']);
  const pair = await page.evaluate(() => window.__clash);
  await page.evaluate(async (tile) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectTile(tile), pair[1]);
  const attack = page.getByTestId('attack-army').first();
  await attack.waitFor({ timeout: 10000 }).catch(() => {});
  if (await attack.isVisible().catch(() => false)) {
    await click(attack);
    const badge = page.getByTestId('pre-battle-no-mans-land');
    await badge.waitFor({ timeout: 15000 }).catch(() => {});
    check('the pre-battle card says no man\'s land', await badge.isVisible().catch(() => false));
    check('Command is not on offer there', await page.getByTestId('battle-choice-command').isDisabled().catch(() => false));
    await shot(page, '05-no-mans-land-844x340');
  } else {
    const why = await page.evaluate(async (p) => {
      const fb = await import('/terra-imperium/src/engine/fieldBattle.js');
      const s = window.__game.state;
      return { pair: p, enemy: fb.enemyStackAt(s, p[1], s.playerNationId).length, v: fb.validateFieldAttack(s, s.units.nml1?.regionId, p[1]).reason || 'ok', sheet: !!document.querySelector('[data-testid="tile-sheet"]') };
    }, pair);
    check('the tile sheet offers the attack (for the no man\'s land check)', false, JSON.stringify(why));
  }

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
