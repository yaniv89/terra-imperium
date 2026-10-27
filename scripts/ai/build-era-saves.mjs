// scripts/ai/build-era-saves.mjs
// The AI playtester's era saves (scripts/ai/human-playtest.mjs --slices), built by playing the real engine,
// never by editing a state by hand. One headless game (the scripted player of balance-sim POLICY=scripted:
// it answers every prompt, builds what an AI city would build and settles the best sites) runs from the
// start. On reaching an age the player researches the tech that opens the age's ships first (RESEARCH_TECH).
// Once it has it (or NAVAL_WAIT turns later), a copy of the game is played on as a player would: it buys a
// ship in its biggest coastal city and ends a turn or two until it sails, declares war (DECLARE_WAR, as from
// the Peoples screen) on the nearest major it has met, and ends turns, refusing peace, until an enemy army
// stands within ENEMY_REACH_KM of one of its cities or a battle waits for the player (a pending defense), at
// most WAR_TURNS turns. That copy is the age's save; the main game goes on in peace. Writes scripts/ai/era-saves/<age>.json.gz (the state with its
// facts) and index.json (the facts alone).
//   node scripts/ai/build-era-saves.mjs [--ages bronze,modern] [--player israel] [--seed 4242] [--turns 923]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildSimEngine, advanceCampaign } from '../simulate.mjs';
import { createScriptedPlayer } from '../campaignTelemetry.mjs';
import { AGE_ORDER } from '../../src/data/ages.js';

export const ERA_SAVES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'era-saves');
// Israel on the Levant coast: majors within about 900 to 1,300 km on seed 4242 (met in play by turn 100), and the sea.
export const ERA_PLAYER = 'israel';
export const ERA_SEED = 4242;
export const ENEMY_REACH_KM = 400; // about two turns of a march (armies.js MOVE_KM)
export const WAR_TURNS = 40;
export const NAVAL_WAIT = 60;
export const SAVE_UP_TURNS = 30;
const WAR_GOLD = 300; // data/actionCosts.js declareWarUnjustified
export const DEFAULT_AGES = AGE_ORDER.slice(1); // the stone age is the start screen's own session

export const ERA_ENGINE = [
  "export { declareWar } from '../src/engine/diplomacy.js';",
  "export { distanceKm } from '../src/data/geo/geodesic.js';",
  "export { auditGameState } from '../src/engine/stateAudit.js';",
  "export { calcIncome } from '../src/utils/helpers.js';",
  "export { getResearchCost } from '../src/engine/research.js';",
  "export { rushQuote } from '../src/engine/spending.js';",
  "export { navalLinesFor } from '../src/data/navalLines.js';",
  "export { unitUnlockTech, isUnitUnlocked } from '../src/data/unitClasses.js';"
];

export const loadEngine = async () => {
  const file = await buildSimEngine(ERA_ENGINE);
  const e = await import(pathToFileURL(file).href);
  fs.rmSync(file, { force: true });
  return e;
};

const own = (s, id) => Object.values(s.regions).filter((c) => (c.owner ?? c.ownerId) === id && c.tile != null);
const cities = (s, id) => own(s, id).filter((c) => !c.outpost);
const atWarWith = (s, p) => s.wars.filter((w) => w.active && (w.aggressor === p || w.enemy === p)).map((w) => (w.aggressor === p ? w.enemy : w.aggressor));
const isArmy = (u) => u.tile != null && u.domain !== 'naval' && u.classId !== 'settler' && !u.explorer && !u.band;
const isMajor = (e, n) => n && !n.isEliminated && !e.isIndependentNation(n);

/** The facts a playtest can count on, read from a state. */
export const eraFacts = (e, s) => {
  const p = s.playerNationId; const t = e.getTiles();
  const mine = cities(s, p);
  const km = (a, b) => e.distanceKm(t.centres[a], t.centres[b]);
  const enemies = atWarWith(s, p);
  const enemyArmies = Object.values(s.units).filter((u) => enemies.includes(u.ownerId) && isArmy(u));
  const nearestEnemyArmyKm = Math.round(Math.min(...enemyArmies.flatMap((u) => mine.map((c) => km(u.tile, c.tile)))));
  const inc = e.calcIncome(s);
  const cur = s.research?.current;
  const cost = cur ? e.getResearchCost(s, p, cur) : 0;
  const aiCities = Object.values(s.nations).filter((n) => isMajor(e, n) && n.id !== p).map((n) => cities(s, n.id).length).sort((a, b) => a - b);
  const units = Object.values(s.units).filter((u) => u.ownerId === p);
  return {
    age: e.getTechAgeId(s, p), turn: s.turnNumber, player: p,
    cities: mine.length, biggestCity: Math.max(0, ...mine.map((c) => c.size)), totalSize: mine.reduce((a, c) => a + c.size, 0),
    aiMedianCities: aiCities[Math.floor(aiCities.length / 2)] ?? 0,
    science: Math.round(inc.techPoints || 0), gold: Math.round(inc.gold || 0),
    researchTurns: cur && inc.techPoints > 0 ? Math.ceil((cost - (s.research?.progress?.[cur] || 0)) / inc.techPoints) : null,
    metMajors: e.metNations(s, p).filter((id) => id !== p && isMajor(e, s.nations[id])).length,
    coast: mine.some((c) => t.coastal[c.tile] === 1),
    ships: units.filter((u) => u.domain === 'naval').length,
    armies: units.filter(isArmy).length,
    enemies, nearestEnemyArmyKm: Number.isFinite(nearestEnemyArmyKm) ? nearestEnemyArmyKm : null,
    pendingBattles: (s.pendingDefenses || []).length
  };
};

// The ship goes first in the coastal city that builds it soonest.
const shipOrder = (e, s, ageId) => {
  const t = e.getTiles();
  let best = null;
  for (const city of cities(s, s.playerNationId).filter((c) => t.coastal[c.tile] === 1)) for (const navalLine of ['warship', 'transport', ...e.navalLinesFor(ageId)]) {
    let next = e.gameReducer(s, { type: e.ActionTypes.QUEUE_PRODUCTION, payload: { cityId: city.id, item: { kind: 'unit', classId: 'naval', navalLine } } });
    const prod = next.regions[city.id]?.production;
    const index = [prod.current, ...prod.queue].filter(Boolean).length - 1;
    if (index < [s.regions[city.id].production.current, ...s.regions[city.id].production.queue].filter(Boolean).length) continue; // refused (no tech, not this age)
    if (index > 0) next = e.gameReducer(next, { type: e.ActionTypes.MOVE_PRODUCTION, payload: { cityId: city.id, index, to: 0 } });
    const turns = e.rushQuote(next, city.id, 0).turns ?? Infinity;
    if (!best || turns < best.turns) best = { next, turns };
    break;
  }
  return best ? best.next : s;
};

/** One turn as a player at war: refuse peace, then the scripted answers (a waiting battle on Auto). */
const warTurn = (e, scripted, s) => {
  let r = s;
  if (r.pendingPeaceOffer) r = e.gameReducer(r, { type: e.ActionTypes.REJECT_PENDING_PEACE });
  if (r.activeEventId) r = e.gameReducer(r, { type: e.ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
  r = scripted.answer(r).state;
  const next = e.resolveTurn(r);
  e.assertGameState(next);
  return next.activeProceduralEvent ? { ...next, activeProceduralEvent: null } : next;
};

const shipsOf = (s) => Object.values(s.units).filter((u) => u.ownerId === s.playerNationId && u.domain === 'naval').length;

/** From early in an age: a war on the nearest met major, a ship, turns until the enemy is in reach. */
export const prepareEraSave = (e, base, log = () => {}) => {
  const p = base.playerNationId; const t = e.getTiles();
  const ageId = e.getTechAgeId(base, p);
  let s = { ...base, battleSettings: { defaultMode: 'ask', autoDefend: false } };
  const mine = cities(s, p);
  const near = e.metNations(s, p).filter((id) => id !== p && isMajor(e, s.nations[id]) && cities(s, id).length)
    .map((id) => [id, Math.min(...cities(s, id).flatMap((c) => mine.map((m) => e.distanceKm(t.centres[c.tile], t.centres[m.tile]))))])
    .sort((a, b) => a[1] - b[1]);
  // war on the nearest met major that will have it (a war costs 300 gold without a cause: the player saves up for it)
  const declare = (st) => {
    if (atWarWith(st, p).length) return st;
    for (const [id] of near) {
      const next = e.gameReducer(st, { type: e.ActionTypes.DECLARE_WAR, payload: { nationId: id } });
      if (atWarWith(next, p).includes(id)) return next;
    }
    return st;
  };
  s = shipOrder(e, s, ageId);
  const canSail = e.isUnitUnlocked(ageId, 'naval', e.getResearched(s, p));
  // the ship is bought when the treasury allows, keeping the price of a war while at peace
  const rushShip = (st) => {
    const yard = cities(st, p).find((c) => c.production?.current?.classId === 'naval');
    const quote = yard && e.rushQuote(st, yard.id, 0);
    const reserve = atWarWith(st, p).length ? 0 : WAR_GOLD;
    return quote?.ok && st.resources.gold - quote.gold >= reserve ? e.gameReducer(st, { type: e.ActionTypes.RUSH_PRODUCTION, payload: { cityId: yard.id, index: 0 } }) : st;
  };
  const scripted = createScriptedPlayer({ engine: e, opinionOf: e.opinionOf });
  // in peace until the ship sails (at most SAVE_UP_TURNS), then war until the enemy is in reach
  for (let i = 0; i < SAVE_UP_TURNS + WAR_TURNS && s.gameStatus === 'ACTIVE'; i++) {
    // battles while waiting for the ship (a war the AI started) are fought on Auto by the scripted answers
    const waitShip = canSail && !shipsOf(s) && i < SAVE_UP_TURNS;
    if (!waitShip) s = declare(s);
    const f = eraFacts(e, s);
    if (!waitShip && !f.enemies.length && i >= SAVE_UP_TURNS) break;
    if (!waitShip && f.enemies.length && (f.pendingBattles || (f.nearestEnemyArmyKm != null && f.nearestEnemyArmyKm <= ENEMY_REACH_KM))) break;
    s = warTurn(e, scripted, rushShip(s));
  }
  if (!atWarWith(s, p).length) log(`  ${ageId}: no war could be declared (met ${near.map(([id]) => id).join(', ') || 'nobody'})`);
  if (!shipsOf(s)) {
    const yard = cities(s, p).find((c) => [c.production?.current, ...(c.production?.queue || [])].some((q) => q?.classId === 'naval'));
    log(`  ${ageId}: no ship (${!canSail ? 'tech not known' : yard ? `still building in ${yard.id}: ${JSON.stringify(e.rushQuote(s, yard.id, 0))}` : 'no coastal city took the order'})`);
  }
  return { ...s, battleSettings: undefined }; // the player's own defaults on load
};

export const buildEraSaves = async ({ ages = DEFAULT_AGES, player = ERA_PLAYER, seed = ERA_SEED, turns = 923, log = console.log, engine = null } = {}) => {
  const e = engine || await loadEngine();
  let s = e.createInitialState({ playerNationId: player, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
  s = e.gameReducer({ ...s, battleSettings: { defaultMode: 'auto', autoDefend: true } }, { type: e.ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } });
  // rush: it also buys what its cities lack, as the AI does (balance-sim RUSH=1), so its empire keeps up with the AI majors
  const scripted = createScriptedPlayer({ engine: e, opinionOf: e.opinionOf, rush: true });
  const saves = {};
  const save = (st, age) => {
    const state = prepareEraSave(e, st, log);
    saves[age] = { state, facts: eraFacts(e, state) };
    log(`${age}: ${JSON.stringify(saves[age].facts)}`);
  };
  let waiting = null; // { age, since, prev }: the age reached, waiting for its ships' tech
  for (let i = 0; i < turns && s.gameStatus === 'ACTIVE' && ages.some((a) => !saves[a]); i++) {
    if (s.activeEventId) s = e.gameReducer(s, { type: e.ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    s = scripted.answer(s).state;
    const prev = s;
    s = advanceCampaign(e, s);
    const a = e.getTechAgeId(s, player);
    if (waiting && waiting.age !== a) { save(prev, waiting.age); waiting = null; } // the next age came first
    if (!waiting && ages.includes(a) && !saves[a]) {
      waiting = { age: a, since: s.turnNumber };
      const tech = e.unitUnlockTech(a, 'naval');
      if (tech && !e.isUnitUnlocked(a, 'naval', e.getResearched(s, player))) s = e.gameReducer(s, { type: e.ActionTypes.RESEARCH_TECH, payload: { techId: tech } });
    }
    if (waiting && (e.isUnitUnlocked(a, 'naval', e.getResearched(s, player)) || s.turnNumber - waiting.since >= NAVAL_WAIT)) { save(s, a); waiting = null; }
  }
  const missing = ages.filter((a) => !saves[a]);
  if (missing.length) log(`not reached by turn ${s.turnNumber}: ${missing.join(', ')}`);
  return { saves, version: e.CURRENT_SAVE_VERSION, player, seed };
};

export const eraSaveFile = (age) => path.join(ERA_SAVES_DIR, `${age}.json.gz`);
export const readEraSave = (age) => JSON.parse(zlib.gunzipSync(fs.readFileSync(eraSaveFile(age))).toString('utf8'));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const ages = arg('--ages', DEFAULT_AGES.join(',')).split(',');
  const bad = ages.filter((a) => !AGE_ORDER.includes(a));
  if (bad.length) throw new Error(`Unknown age ${bad.join(', ')}: ${AGE_ORDER.join(', ')}`);
  const { saves, version, seed } = await buildEraSaves({ ages, player: arg('--player', ERA_PLAYER), seed: Number(arg('--seed', ERA_SEED)), turns: Number(arg('--turns', 923)) });
  fs.mkdirSync(ERA_SAVES_DIR, { recursive: true });
  const indexFile = path.join(ERA_SAVES_DIR, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
  for (const [age, { state, facts }] of Object.entries(saves)) {
    fs.writeFileSync(eraSaveFile(age), zlib.gzipSync(JSON.stringify({ version, age, seed, facts, state }), { level: 9 }));
    index[age] = { version, seed, ...facts };
  }
  fs.writeFileSync(indexFile, `${JSON.stringify(Object.fromEntries(AGE_ORDER.filter((a) => index[a]).map((a) => [a, index[a]])), null, 1)}\n`);
  console.log(`wrote ${Object.keys(saves).join(', ')} to ${path.relative(process.cwd(), ERA_SAVES_DIR)}`);
}
