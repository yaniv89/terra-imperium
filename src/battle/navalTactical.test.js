// src/battle/navalTactical.test.js
// Sea battles in the tactical sim (plans/civ-map-rework.md D5b): an open-water field, ships as
// squads, the command path through the reducer and the quick battle as its fallback.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../engine/gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { HISTORICAL_EVENTS } from '../data/events';
import { portWaters, seaPassable } from '../engine/fleets';
import { estimateFleetOdds } from '../engine/battleOdds';
import { generateMap, TILE, isPassable } from './setup/mapgen';
import { buildSetupFromArmies, buildInvasionSetup } from './setup/buildBattleSetup';
import { runHeadless } from './sim/headless';
import { getNavalStats, getUnitBattleStats, NAVAL_LINE_STATS } from './data/battleStats';
import { assertGameState } from '../engine/stateAudit';

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 })); return { ...s, units: {}, resources: { ...s.resources, mil: 100, gold: 1000 } }; })();
const FR = getNationCapital('fr'); const GB = getNationCapital('gb');
const fleet = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'naval', classId: 'naval', navalLine: 'warship', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, transportCapacity: 2, embarkedOn: null, promotions: [], xp: 0, ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s) => ({ ...s, wars: [...s.wars, { id: 'w-sea', aggressor: 'fr', enemy: 'gb', active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, fr: { ...s.nations.fr, isAtWar: true }, gb: { ...s.nations.gb, isAtWar: true } } });
const [ours, theirs] = (() => {
  const waters = portWaters(S, tiles, FR);
  for (const w of waters) { const o = tiles.neighbors[w].find((n) => tiles.land[n] !== 1 && seaPassable(tiles, n, 'bronze')); if (o != null) return [w, o]; }
  throw new Error('no sea pair off the port');
})();
const ships = (p, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, classId: 'naval', navalLine: 'warship', strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'naval', ...extra }));

describe('the sea battlefield', () => {
  it('is open water with a few islets, passable from the attacker zone to the anchorage', () => {
    const map = generateMap({ regionId: 'sea-1', terrain: 'sea', combatWidth: 5, naval: true });
    expect(map.naval).toBe(true);
    expect(map.points).toEqual([]);
    const open = [...map.tiles].filter((t) => t === TILE.OPEN).length;
    expect(open / map.tiles.length).toBeGreaterThan(0.9);
    expect([...map.tiles].every((t) => t === TILE.OPEN || t === TILE.ROCK || t === TILE.SAND)).toBe(true);
    expect(isPassable(map.tiles[map.keep.y * map.w + map.keep.x])).toBe(true);
    expect(generateMap({ regionId: 'sea-1', terrain: 'sea', combatWidth: 5, naval: true }).tiles).toEqual(map.tiles); // the same sea every time
  });

  it('ships take their line and age stats; a transport and a raider differ from a warship', () => {
    expect(getNavalStats('warship', 'bronze').melee).toBe(true);
    expect(getNavalStats('warship', 'gunpowder').melee).toBe(false);
    expect(getNavalStats('warship', 'modern').range).toBeGreaterThan(getNavalStats('warship', 'gunpowder').range);
    expect(getNavalStats('raider', 'classical').speed).toBeGreaterThan(getNavalStats('transport', 'classical').speed);
    expect(getNavalStats('carrier', 'bronze')).toBe(NAVAL_LINE_STATS.carrier.modern); // the nearest age that has the line
    expect(getUnitBattleStats({ classId: 'naval', navalLine: 'raider' }, 'modern')).toBe(NAVAL_LINE_STATS.raider.modern);
    expect(getUnitBattleStats({ classId: 'infantry' }, 'bronze').soldiers).toBe(12);
    Object.values(NAVAL_LINE_STATS).forEach((byAge) => Object.values(byAge).forEach((st) => { expect(st.canCapture).toBe(false); expect(st.soldiers).toBe(1); }));
  });

  it('a headless sea battle between two AI fleets fights to a result', () => {
    const setup = buildSetupFromArmies({ regionId: 'sea-2', terrain: 'sea', seed: 7, attackerUnits: ships('a', 3), defenderUnits: ships('d', 2, { navalLine: 'raider' }), attackerAgeId: 'classical', defenderAgeId: 'classical', controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: 'naval' });
    expect(setup.map.naval).toBe(true);
    expect(setup.battleType).toBe('naval');
    expect(setup.structures.map((s) => s.kind)).toEqual(['keep']);
    expect(setup.structures[0].damage).toBe(0);
    const { result } = runHeadless(setup);
    expect(['attacker', 'defender', 'stalemate']).toContain(result.outcome);
    const lost = [...result.attackerUnits, ...result.defenderUnits].reduce((s, u) => s + (1000 - u.strength), 0);
    expect(lost).toBeGreaterThan(0);
    expect(result.report.tactical.reason).toBeTruthy();
  });
});

describe('a commanded sea battle through the reducer', () => {
  const war = atWar(withUnits(S, [fleet('f1', FR, { tile: ours }), fleet('f2', FR, { tile: ours }), fleet('f3', FR, { tile: ours }), fleet('e', GB, { ownerId: 'gb', tile: theirs, strength: 300, maxStrength: 1000 })]));

  it('begins with the fleets of both tiles, builds a sea setup, resolves into the fleet aftermath', () => {
    const begun = gameReducer(war, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromTile: ours, tile: theirs, naval: true } });
    expect(begun.pendingBattle?.kind).toBe('naval');
    expect(begun.pendingBattle.attackerUnitIds).toEqual(['f1', 'f2', 'f3']);
    expect(begun.pendingBattle.defenderUnitIds).toEqual(['e']);
    expect(begun.resources.mil).toBe(war.resources.mil - 2);
    const setup = buildInvasionSetup(begun, begun.pendingBattle);
    expect(setup.map.naval).toBe(true);
    expect(setup.sides[0].units.map((u) => u.id)).toEqual(['f1', 'f2', 'f3']);
    expect(setup.terrain).toBe('sea');
    const odds = estimateFleetOdds(war, ours, theirs, 40);
    expect(odds.naval).toBe(true);
    expect(odds.attacker + odds.defender + odds.stalemate).toBeCloseTo(1, 5);
    // The replay from an empty command log: the AI fleet fights the player's idle line.
    const done = gameReducer(begun, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: begun.pendingBattle.id, result: null, log: [] } });
    expect(done.pendingBattle).toBeNull();
    expect(done.lastBattleReport?.kind).toBe('naval');
    expect(done.lastBattleReport?.tactical?.verified).toBe(true);
    ['f1', 'f2', 'f3'].forEach((id) => { if (done.units[id]) expect(done.units[id].movesLeft).toBe(0); });
    assertGameState(done);
  });

  it('abandoning the command fights the same battle as a quick battle with the battle seed', () => {
    const begun = gameReducer(war, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromTile: ours, tile: theirs, naval: true } });
    const done = gameReducer(begun, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(done.pendingBattle).toBeNull();
    expect(done.lastBattleReport?.kind).toBe('naval');
    expect(done.lastBattleReport?.tactical).toBeUndefined();
    expect(done.resources.mil).toBe(war.resources.mil - 2); // paid once, when the battle began
    assertGameState(done);
  });
});
