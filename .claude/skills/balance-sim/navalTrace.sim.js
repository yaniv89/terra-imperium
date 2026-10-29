// .claude/skills/balance-sim/navalTrace.sim.js
// Naval milestones on coastal starts (lane naval-campaign): for the player and the AI majors, the
// first turn each one could build a ship (tech + a sea-coast city), owned one, had one at sea,
// carried an army (embarked), and fought a sea battle or a landing. The player is the scripted one
// (balance-sim worldStats POLICY=scripted); NAVAL=1 adds a player who also queues a ship once it can.
//   TURNS=200 SEEDS=11,12 PLAYERS=ahhiyawa,tartessos,butuan [NAVAL=1] npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/navalTrace.sim.js
import { it, vi } from 'vitest';
// Runs only when asked (PLAYERS set), so compare.sh's whole-folder run skips it.
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { getTiles } from '../../../src/data/geo/tiles';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { getUnlockedClasses } from '../../../src/data/unitClasses';
import { hasSeaCoast } from '../../../src/engine/world/cities';
import { atSea } from '../../../src/engine/fleets';
import { passableTile, tileAccess } from '../../../src/engine/armies';
import { navalLinesFor } from '../../../src/data/navalLines';

// Every battle passes through applyBattleOutcome (battleOutcome.js): count the sea kinds by nation.
const BATTLES = [];
vi.mock('../../../src/engine/battleOutcome', async (orig) => {
  const m = await orig();
  return { ...m, applyBattleOutcome: (state, o, ...rest) => { if (o) BATTLES.push({ turn: state.turnNumber, kind: o.kind, a: o.attackerNationId, d: o.defenderNationId }); return m.applyBattleOutcome(state, o, ...rest); } };
});

const TURNS = Number(process.env.TURNS || 150);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYERS = String(process.env.PLAYERS || 'ahhiyawa').split(',');
const NAVAL = process.env.NAVAL === '1';
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});
const NAVAL_TECHS = ['science_star_lore', 'science_early_astronomy', 'economy_minted_coinage'];
const SEA_KINDS = new Set(['naval', 'landing', 'intercept', 'amphibious']);

const milestones = (s, id, m, t) => {
  const tiles = getTiles();
  const age = getTechAgeId(s, id);
  const mark = (k) => { if (m[k] == null) m[k] = t; };
  const coast = Object.values(s.regions).some((c) => c.owner === id && hasSeaCoast(tiles, c));
  if (coast && getUnlockedClasses(age, getResearched(s, id)).includes('naval')) mark('canBuild');
  const ships = Object.values(s.units).filter((u) => u.ownerId === id && u.domain === 'naval' && u.strength > 0);
  if (ships.length) mark('ship');
  if (ships.some((u) => atSea(s, u))) mark('atSea');
  if (Object.values(s.units).some((u) => u.ownerId === id && u.embarkedOn && u.embarkedOn !== u.id)) mark('embarked');
  if (Object.values(s.units).some((u) => u.ownerId === id && u.embarkedOn === u.id)) mark('selfEmbark');
  if (Object.values(s.regions).some((c) => c.owner === id && c.production?.current?.classId === 'naval')) mark('queued');
  const known = getResearched(s, id);
  NAVAL_TECHS.forEach((tech) => { if (known.has ? known.has(tech) : known.includes(tech)) mark(tech.split('_').slice(1).join('_')); });
  mark(`age_${age}`);
};

// NAVAL=1's voyage, as a player would do it in the UI: embark one army in port (army sheet), sail to
// a sea tile beside land that is not the player's (SET_ROUTE naval), land there (TileSheet's Land here).
const seaVoyage = (state, m, t) => {
  let s = state; const me = s.playerNationId; const tiles = getTiles();
  const ship = Object.values(s.units).find((u) => u.ownerId === me && u.domain === 'naval' && u.strength > 0);
  if (!ship) return s;
  const cargo = Object.values(s.units).filter((u) => u.embarkedOn === ship.id);
  if (!atSea(s, ship) && !cargo.length) {
    const army = Object.values(s.units).find((u) => u.ownerId === me && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && u.regionId === ship.regionId);
    if (army) s = gameReducer(s, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: army.id, navalUnitId: ship.id } });
    else {
      // No army in the port: march one there.
      const walker = Object.values(s.units).find((u) => u.ownerId === me && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && !u.route?.length);
      if (walker) s = gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: walker.regionId, toRegionId: ship.regionId, unitIds: [walker.id] } });
    }
    return s;
  }
  if (!cargo.length || ship.route?.length) return s;
  const shore = (sea) => tiles.neighbors[sea].find((n) => passableTile(tiles, n) && s.world.tileOwner[n] == null && tileAccess(s, n, me) !== 'closed');
  if (atSea(s, ship)) {
    const land = shore(ship.tile);
    if (land == null) return s;
    const before = s;
    cargo.forEach((c) => { s = gameReducer(s, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: c.id, tile: land } }); });
    if (s !== before && m.landed == null) m.landed = t;
    return s;
  }
  // In port with cargo: the nearest sea tile 4+ steps out beside free land.
  const seen = new Map([[ship.tile, 0]]); const queue = [ship.tile]; let goal = null;
  while (queue.length && goal == null) {
    const at = queue.shift(); const d = seen.get(at);
    if (d > 40) break;
    for (const n of tiles.neighbors[at]) {
      if (seen.has(n) || tiles.land[n] === 1) continue;
      seen.set(n, d + 1); queue.push(n);
      if (d + 1 >= 4 && shore(n) != null) { goal = n; break; }
    }
  }
  if (goal != null) s = gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: ship.regionId, toTile: goal, unitIds: [ship.id], naval: true } });
  if (goal != null && s.units[ship.id]?.route?.length && m.sailOrder == null) m.sailOrder = t;
  return s;
};

if (!process.env.PLAYERS) it.skip('naval trace (set PLAYERS to run)', () => {});
else PLAYERS.forEach((PLAYER) => SEEDS.forEach((seed) => {
  it(`naval ${PLAYER} seed ${seed}`, () => {
    BATTLES.length = 0;
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult } });
    const majors = Object.values(s.nations).filter((n) => n.kind !== 'independent' && !n.id.startsWith('free_') && n.id !== 'rebels').map((n) => n.id);
    const tiles = getTiles();
    const coastalMajors = majors.filter((id) => Object.values(s.regions).some((c) => c.owner === id && hasSeaCoast(tiles, c)));
    const ms = Object.fromEntries(majors.map((id) => [id, {}]));
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      s = scripted.answer(s).state;
      if (NAVAL) {
        const me = s.playerNationId; const age = getTechAgeId(s, me);
        const hasShip = Object.values(s.units).some((u) => u.ownerId === me && u.domain === 'naval');
        const queued = Object.values(s.regions).some((c) => c.owner === me && (c.production?.queue || []).concat(c.production?.current || []).some((i) => i?.classId === 'naval'));
        if (!hasShip && !queued && getUnlockedClasses(age, getResearched(s, me)).includes('naval')) {
          const port = Object.values(s.regions).find((c) => c.owner === me && hasSeaCoast(tiles, c));
          if (port) s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: port.id, item: { kind: 'unit', classId: 'naval', navalLine: navalLinesFor(age)[0] } } });
        }
        // The advisor's "Sink the pirates" step (pirates.js): a ship beside a pirate attacks it.
        Object.values(s.units).filter((u) => u.ownerId === me && u.domain === 'naval' && u.strength > 0 && u.tile != null).forEach((f) => {
          const p = Object.values(s.units).find((u) => u.pirate && u.tile != null && tiles.neighbors[f.tile].includes(u.tile));
          if (p) s = gameReducer(s, { type: ActionTypes.ATTACK_FLEET, payload: { fromTile: f.tile, tile: p.tile } });
        });
        s = seaVoyage(s, ms[me], t);
      }
      s = resolveTurn(s);
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      if (s.activeEventId) s = { ...s, activeEventId: null };
      majors.forEach((id) => milestones(s, id, ms[id], t));
    }
    const sea = BATTLES.filter((b) => SEA_KINDS.has(b.kind));
    const firstSea = (id) => sea.find((b) => b.a === id || b.d === id)?.turn ?? null;
    const p = { ...ms[PLAYER], seaBattle: firstSea(PLAYER), playerSeaBattles: sea.filter((b) => b.a === PLAYER || b.d === PLAYER).length, coastalStart: coastalMajors.includes(PLAYER), age: getTechAgeId(s, PLAYER) };
    const ai = coastalMajors.filter((id) => id !== PLAYER);
    const share = (k) => `${ai.filter((id) => ms[id][k] != null).length}/${ai.length}`;
    const median = (k) => { const v = ai.map((id) => ms[id][k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const aiOut = Object.fromEntries(['canBuild', 'queued', 'ship', 'atSea', 'embarked', 'selfEmbark'].map((k) => [k, `${share(k)} median ${median(k)}`]));
    const kinds = {}; sea.forEach((b) => { kinds[b.kind] = (kinds[b.kind] || 0) + 1; });
    console.log(`NAVAL player=${PLAYER} seed=${seed} turns=${s.turnNumber} naval=${NAVAL ? 1 : 0} PLAYER ${JSON.stringify(p)}`);
    console.log(`NAVAL player=${PLAYER} seed=${seed} AI ${JSON.stringify(aiOut)} seaBattles=${JSON.stringify(kinds)} allBattles=${BATTLES.length}`);
  });
}));
