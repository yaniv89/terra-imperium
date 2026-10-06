// src/engine/tacticalBattle.test.js
// Tactical Battles T5 exit gate (design/rts-battles-implementation-plan.md §17): BEGIN pays once
// and locks the units; the turn can't end mid-battle; RESOLVE applies exactly the invasion's own
// consequences from a sanitized result (no minting soldiers); ABANDON is auto-resolve with the same
// seed; and a real headless battle's result flows through RESOLVE end to end.
import { REGIONS_DATA } from '../data/regions';
import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState, sanitizeTacticalResult } from './gameReducer';
import { ActionTypes } from '../data/types';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { estimateInvasionOdds } from './battleOdds';
import { getNationCapital, getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities } from './testWorld';
import { createWorld, sideEdgeX } from '../battle/sim/world';
import { firePower } from '../battle/sim/effects';
import { cityManifestOf } from './cityManifest';

// The Dawn world gives France one city with no room beside it, so the fixture founds French
// cities on the nearest free land: FR_BORDER (bordering a foreign capital, the war's target),
// and FR_NEAR, a second French city bordering that target. The enemy is whoever owns the target.
const WORLD = (() => {
  const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 1 }), 'fr');
  // A land attack from inside a city needs touching lands (registry `touching`); else the army
  // stands at the target's gates (`unit` below places it there).
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr') || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr');
  const near = addCity(first.state, 'fr', { near: target });
  const AGG = near.state.regions[target].owner;
  // The enemy gets three more cities, so losing the target is a fraction of its nation.
  const grown = addCities(near.state, AGG, 3);
  return { state: grown.state, FR_BORDER: first.cityId, BE_REGION: target, FR_NEAR: near.cityId, AGG, THIRD: AGG === 'de' ? 'it' : 'de' };
})();
const { FR_BORDER, BE_REGION, AGG, THIRD } = WORLD;

const baseState = () => {
  const s = WORLD.state;
  return {
    ...s,
    resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
    wars: [...s.wars, { id: 'war_t', aggressor: 'fr', enemy: AGG, active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }]
  };
};
const GATE = getTouchingIds(FR_BORDER).includes(BE_REGION) ? null : getTiles().neighbors[WORLD.state.regions[BE_REGION].tile].find((n) => getTiles().land[n] === 1);
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1,
  ...(regionId === FR_BORDER && GATE != null ? { tile: GATE } : {})
});
const withArmies = (state = baseState()) => ({
  ...state,
  units: {
    a1: unit('a1', FR_BORDER, 'fr'), a2: unit('a2', FR_BORDER, 'fr', 'cavalry'), a3: unit('a3', FR_BORDER, 'fr', 'ranged'),
    d1: unit('d1', BE_REGION, AGG), d2: unit('d2', BE_REGION, AGG, 'ranged', 800)
  }
});
const begin = (s) => gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });

describe('BEGIN_TACTICAL_BATTLE', () => {
  it('pays the invasion cost once, records the battle and locks both armies', () => {
    const s = withArmies();
    const next = begin(s);
    expect(next.pendingBattle).toMatchObject({ fromRegionId: FR_BORDER, targetRegionId: BE_REGION, attackerUnitIds: ['a1', 'a2', 'a3'], defenderUnitIds: ['d1', 'd2'], playerSide: 'attacker' });
    expect(next.resources.mil).toBeLessThan(s.resources.mil);
    // locked: can't move, can't end the turn, can't start a second battle
    const moved = gameReducer(next, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a1', toRegionId: FR_BORDER } });
    expect(moved.units.a1.regionId).toBe(FR_BORDER);
    const turn = gameReducer(next, { type: ActionTypes.ADVANCE_TURN });
    expect(turn.turnNumber).toBe(next.turnNumber);
    expect(begin(next).pendingBattle.id).toBe(next.pendingBattle.id);
  });

  it('takes an undefended region immediately, like auto-resolve', () => {
    const s = baseState();
    const next = begin({ ...s, units: { a1: unit('a1', FR_BORDER, 'fr') } });
    expect(next.pendingBattle).toBeNull();
    expect(next.regions[BE_REGION].owner).toBe('fr');
  });

  it('refuses without a war, like LAUNCH_INVASION', () => {
    const s = withArmies({ ...baseState(), wars: [] });
    expect(begin(s).pendingBattle).toBeNull();
  });
});

describe('RESOLVE_TACTICAL_BATTLE', () => {
  it('applies a real headless battle through the invasion consequences and clears the lock', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result } });
    expect(next.pendingBattle).toBeNull();
    expect(next.lastBattleReport.outcome).toBe(result.outcome);
    expect(next.lastBattleReport.tactical.mode).toBe('command');
    // every surviving attacker spent its move; strengths match the battle
    result.attackerUnits.forEach((u) => {
      if (u.strength > 0) { expect(next.units[u.id].strength).toBe(u.strength); expect(next.units[u.id].movesLeft).toBe(0); } else expect(next.units[u.id]).toBeUndefined();
    });
    expect(gameReducer(next, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(next.turnNumber + 1);
  });

  it('with the command log, the battle is replayed and a forged result is ignored (server-verified)', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const log = [{ side: 0, type: 'attackMove', squads: [0, 1, 2], x: 60 * 256, y: 30 * 256, tick: 0, seq: 0 }];
    const truth = runHeadless(setup, { orders: log });
    const forged = { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: { tactical: { decisive: true } } };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: forged, log } });
    expect(next.lastBattleReport.outcome).toBe(truth.result.outcome);
    expect(next.lastBattleReport.tactical.verified).toBe(true);
    expect(next.lastBattleReport.tactical.hash).toBe(truth.hash);
    truth.result.defenderUnits.forEach((u) => { if (u.strength > 0 && !next.lastBattleReport.captured) expect(next.units[u.id].strength).toBe(u.strength); });
  });

  it('the real city stands on the battlefield; its losses carry to the map under the 50% rule', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const manifest = cityManifestOf(started, BE_REGION);
    expect(setup.city).toMatchObject({ cityId: BE_REGION });
    expect(setup.structures.map((st) => st.manifestId).filter(Boolean).sort()).toEqual(manifest.structures.map((st) => st.id).sort());
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const houses = manifest.structures.filter((st) => st.kind === 'house').map((st) => st.id);
    const forged = { ...result, report: { ...result.report, tactical: { ...result.report.tactical, cityDamage: { destroyed: [...houses, '<script>'], damaged: ['townhall'] } } } };
    const size = started.regions[BE_REGION].size;
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: forged } });
    const dmg = next.regions[BE_REGION].cityDamage;
    expect(Object.keys(dmg.ruined)).toHaveLength(Math.floor(houses.length / 2));
    expect(next.regions[BE_REGION].size).toBeGreaterThanOrEqual(Math.ceil(size / 2));
    expect(next.logs.some((l) => /left its mark/.test(l.message))).toBe(true);
    // the next battle for the city starts among the ruins
    const again = buildInvasionSetup({ ...next, pendingBattle: started.pendingBattle }, started.pendingBattle);
    if (again) expect(again.structures.filter((st) => st.ruinedAtStart).length).toBe(Object.keys(dmg.ruined).filter((id) => manifest.structures.some((st) => st.id === id)).length);
  });

  it('the target province\'s buildings stand on the battlefield, and the ones razed lose a tier (at most half of them)', () => {
    const s0 = withArmies();
    const r = s0.regions[BE_REGION];
    const s = { ...s0, regions: { ...s0.regions, [BE_REGION]: { ...r, buildings: { ...r.buildings, categories: { ...r.buildings.categories, military: 1, economy: 0 } } } } };
    const started = begin(s);
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.structures.filter((st) => st.kind === 'building').map((st) => st.category).sort()).toEqual(['economy', 'military']);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const forged = { ...result, report: { ...result.report, tactical: { ...result.report.tactical, razed: ['military', 'defense', 'bogus'], cityDamage: { destroyed: [], damaged: [] } } } }; // only the razed list (the AI battle's own city damage varies with the economy)
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: forged } });
    expect(next.regions[BE_REGION].buildings.categories.military).toBe(0);
    expect(next.regions[BE_REGION].buildings.categories.economy).toBe(0);
    expect(next.regions[BE_REGION].buildings.categories.defense).toBe(s.regions[BE_REGION].buildings.categories.defense);
  });

  it('a decisive (keep taken) win captures the region outright', () => {
    const started = begin(withArmies());
    const pb = started.pendingBattle;
    const result = {
      outcome: 'attacker',
      attackerUnits: pb.attackerUnitIds.map((id) => ({ ...started.units[id] })),
      defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id], strength: 0 })),
      report: { deployedAttackerIds: pb.attackerUnitIds, deployedDefenderIds: pb.defenderUnitIds, log: [], tactical: { decisive: true } }
    };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
    expect(next.regions[BE_REGION].owner).toBe('fr');
    expect(next.units.a1.regionId).toBe(BE_REGION);
  });

  it('never trusts the client: inflated strength, foreign ids and a bogus outcome are sanitized', () => {
    const started = begin(withArmies());
    const pb = started.pendingBattle;
    const tampered = {
      outcome: 'total_victory',
      attackerUnits: [{ ...started.units.a1, strength: 999999 }, { id: 'ghost', strength: 5000, classId: 'infantry' }],
      defenderUnits: [],
      report: { deployedAttackerIds: ['a1', 'ghost'], tactical: { decisive: 'yes', xpBonusById: { a1: 9999, ghost: 50 } } }
    };
    const safe = sanitizeTacticalResult(started, pb, tampered);
    expect(safe.outcome).toBe('defender');
    expect(safe.attackerUnits.find((u) => u.id === 'a1').strength).toBe(1000);
    expect(safe.attackerUnits.some((u) => u.id === 'ghost')).toBe(false);
    expect(safe.report.deployedAttackerIds).toEqual(['a1']);
    expect(safe.report.tactical.xpBonusById).toEqual({ a1: 20 });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result: tampered } });
    expect(next.units.ghost).toBeUndefined();
    Object.values(next.units).forEach((u) => expect(u.strength).toBeLessThanOrEqual(1000));
  });

  it('ignores a result for a different battle id', () => {
    const started = begin(withArmies());
    expect(gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: 'nope', result: {} } })).toBe(started);
  });

  it('has no consequences if peace was signed meanwhile', () => {
    const started = begin(withArmies());
    const peaceful = { ...started, wars: started.wars.map((w) => ({ ...w, active: false })) };
    const next = gameReducer(peaceful, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: {} } } });
    expect(next.pendingBattle).toBeNull();
    expect(next.regions[BE_REGION]).toBe(peaceful.regions[BE_REGION]);
    expect(next.units).toBe(peaceful.units);
  });
});

describe('ABANDON_TACTICAL_BATTLE', () => {
  it('auto-resolves the same battle without charging again', () => {
    const started = begin(withArmies());
    const next = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(next.pendingBattle).toBeNull();
    expect(next.resources.mil).toBe(started.resources.mil);
    expect(next.lastBattleReport).toBeTruthy();
    expect(next.lastBattleReport.tactical).toBeUndefined();
    // deterministic: same battle, same seed → same outcome
    expect(gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE }).lastBattleReport.outcome).toBe(next.lastBattleReport.outcome);
  });
});

describe('battle odds preview', () => {
  it('reports sensible probabilities from the real auto-resolve', () => {
    const s = withArmies();
    const odds = estimateInvasionOdds(s, FR_BORDER, BE_REGION, 100);
    expect(odds.attacker + odds.defender + odds.stalemate).toBeCloseTo(1, 5);
    expect(odds.attackerStrength).toBe(3000);
    // An empty city still has its militia (battleInputs.js, master plan 6.7 row 19): a regiment beats it.
    const empty = estimateInvasionOdds({ ...s, units: { a1: unit('a1', FR_BORDER, 'fr') } }, FR_BORDER, BE_REGION);
    expect(empty.undefended).toBeFalsy();
    expect(empty.attacker).toBeGreaterThan(0.8);
  });
});

describe('T7: reinforcements, missiles and powers in the campaign', () => {
  const withNeighbourTroops = () => {
    const s = withArmies();
    // Any French neighbour of the target that isn't the origin.
    const neighbour = WORLD.FR_NEAR;
    return { s: { ...s, units: { ...s.units, r1: unit('r1', neighbour, 'fr', 'cavalry') } }, neighbour };
  };

  it('BEGIN records standby reinforcements from neighbouring provinces and locks them', () => {
    const s = withArmies();
    const neighbours = REGIONS_DATA[BE_REGION].neighbors.filter((id) => s.regions[id]?.owner === 'fr');
    const next = begin(s);
    expect(Array.isArray(next.pendingBattle.attackerReinforcements)).toBe(true);
    // the origin province is never a "reinforcement" source
    expect(next.pendingBattle.attackerReinforcements.some((r) => r.regionId === FR_BORDER)).toBe(false);
    expect(neighbours.length).toBeGreaterThan(0);
  });

  it('a reinforcement only counts if the battle says it joined', () => {
    const { s, neighbour } = withNeighbourTroops();
    const started = begin(s);
    const pb = { ...started.pendingBattle, attackerReinforcements: [{ regionId: neighbour, unitIds: ['r1'] }] };
    const withPb = { ...started, pendingBattle: pb };
    const base = { outcome: 'defender', attackerUnits: [{ ...s.units.a1, strength: 900 }, { ...s.units.r1, strength: 500 }], defenderUnits: [], report: { tactical: {} } };
    expect(sanitizeTacticalResult(withPb, pb, base).attackerUnits.some((u) => u.id === 'r1')).toBe(false);
    const joined = sanitizeTacticalResult(withPb, pb, { ...base, report: { tactical: { joinedReinforcements: ['r1'] } } });
    expect(joined.attackerUnits.find((u) => u.id === 'r1').strength).toBe(500);
    // locked while the battle runs
    expect(gameReducer(withPb, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'r1', toRegionId: FR_BORDER } }).units.r1.regionId).toBe(s.units.r1.regionId);
  });

  it('missiles fired in battle come out of the real stockpile, capped at what the nation had', () => {
    const s0 = withArmies();
    const s = { ...s0, nations: { ...s0.nations, fr: { ...s0.nations.fr, missiles: { tactical: 2, theatre: 0, icbm: 0, nuclear: 0 } } } };
    const started = begin(s);
    const pb = started.pendingBattle;
    const result = { outcome: 'defender', attackerUnits: pb.attackerUnitIds.map((id) => started.units[id]), defenderUnits: pb.defenderUnitIds.map((id) => started.units[id]), report: { tactical: { powersUsed: [{ missileTactical: 5, rallyCry: 1 }, {}] } } };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
    expect(next.nations.fr.missiles.tactical).toBe(0);
  });

  it('a nuclear strike in battle brings world condemnation and a scarred region', () => {
    const s0 = withArmies();
    const s = { ...s0, nations: { ...s0.nations, fr: { ...s0.nations.fr, missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 1 } } } };
    const started = begin(s);
    const pb = started.pendingBattle;
    const before = started.nations[THIRD].hostility;
    const result = { outcome: 'stalemate', attackerUnits: pb.attackerUnitIds.map((id) => ({ ...started.units[id], strength: 0 })), defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id], strength: 0 })), report: { tactical: { powersUsed: [{ nuclearStrike: 1 }, {}] } } };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
    expect(next.nations.fr.missiles.nuclear).toBe(0);
    expect(next.nations[AGG].hostility).toBe(100);
    expect(next.nations[THIRD].hostility).toBeGreaterThan(before);
    expect(next.regions[BE_REGION].nuclearScarred).toBe(true);
    expect(next.nations.fr.prestige).toBeLessThan(started.nations.fr.prestige || 0.0001);
  });

  it('the battle setup brings the nation\'s real powers', () => {
    const s0 = withArmies();
    const s = { ...s0, nations: { ...s0.nations, fr: { ...s0.nations.fr, missiles: { tactical: 1, theatre: 0, icbm: 0, nuclear: 1 } } } };
    const started = begin(s);
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const ids = setup.powers[0].map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['rallyCry', 'missileTactical', 'nuclearStrike']));
    expect(setup.powers[1].some((p) => p.id === 'nuclearStrike')).toBe(false); // the AI never gets a nuke
  });
});

describe('T9: commanded amphibious landing', () => {
  const GB_TARGET = getNationCapital('gb');
  const landingState = () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 1 });
    const port = getNationCapital('fr');
    const units = {
      fleet: { id: 'fleet', regionId: port, ownerId: 'fr', domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1, transportCapacity: 2, embarkedOn: null },
      m1: { ...unit('m1', port, 'fr'), embarkedOn: 'fleet' },
      m2: { ...unit('m2', port, 'fr', 'ranged'), embarkedOn: 'fleet' },
      gb1: unit('gb1', GB_TARGET, 'gb')
    };
    return {
      ...s,
      units,
      resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
      wars: [...s.wars, { id: 'war_gb', aggressor: 'fr', enemy: 'gb', active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }]
    };
  };
  const beginLanding = (s) => gameReducer(s, { type: ActionTypes.BEGIN_AMPHIBIOUS_BATTLE, payload: { navalUnitId: 'fleet', targetRegionId: GB_TARGET } });

  it('BEGIN pays once, locks the fleet and its troops, and builds a beach landing with naval guns', () => {
    const s = landingState();
    const started = beginLanding(s);
    expect(started.pendingBattle).toMatchObject({ kind: 'amphibious', navalUnitId: 'fleet', attackerUnitIds: ['m1', 'm2'], defenderUnitIds: ['gb1'] });
    expect(started.resources.mil).toBe(s.resources.mil - 3);
    expect(gameReducer(started, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId: 'fleet', targetRegionId: GB_TARGET } }).units).toEqual(started.units);
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.map.landing).toBe(true);
    expect(setup.powers[0].some((p) => p.id === 'navalBombardment' && p.uses === 2)).toBe(true);
    const world = createWorld(setup);
    world.squads.filter((q) => q.side === 0 && q.onField).forEach((q) => expect(q.x).toBeGreaterThanOrEqual(setup.map.attackerEdge * 256));
    expect(sideEdgeX(world, 0)).toBe(setup.map.attackerEdge * 256);
  });

  it('a real headless landing resolves through the amphibious consequences', () => {
    const started = beginLanding(landingState());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result } });
    expect(next.pendingBattle).toBeNull();
    expect(next.lastBattleReport.kind).toBe('amphibious');
    expect(next.units.fleet.movesLeft).toBe(0);
    ['m1', 'm2'].forEach((id) => {
      const u = next.units[id];
      if (!u) return;
      if (next.lastBattleReport.captured) expect(u).toMatchObject({ regionId: GB_TARGET, embarkedOn: null });
      else expect(u.embarkedOn).toBe('fleet');
    });
  });

  it('ABANDON auto-resolves the same landing; an enemy fleet or an empty beach means no command battle', () => {
    const started = beginLanding(landingState());
    const abandoned = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(abandoned.pendingBattle).toBeNull();
    expect(abandoned.lastBattleReport.kind).toBe('amphibious');
    expect(abandoned.resources.mil).toBe(started.resources.mil);
    const s = landingState();
    const withFleet = { ...s, units: { ...s.units, gbNavy: { id: 'gbNavy', regionId: GB_TARGET, ownerId: 'gb', domain: 'naval', classId: 'naval', strength: 50000, maxStrength: 50000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null } } };
    expect(beginLanding(withFleet).pendingBattle).toBeNull();
    const { gb1, ...rest } = s.units; // eslint-disable-line no-unused-vars
    const empty = beginLanding({ ...s, units: rest });
    expect(empty.pendingBattle).toBeNull();
    expect(empty.regions[GB_TARGET].owner).toBe('fr');
  });

  it('the fleet\'s guns only reach the shore half of the field', () => {
    const started = beginLanding(landingState());
    const w = createWorld(buildInvasionSetup(started, started.pendingBattle));
    w.supply[0] = 1000;
    firePower(w, 0, 'navalBombardment', (w.map.w - 2) * 256, 20 * 256);
    const maxX = Math.floor(w.map.w * 0.5) * 256 + 3 * 256;
    w.impacts.forEach((imp) => expect(imp.x).toBeLessThanOrEqual(maxX));
  });
});

describe('conquest by battle (reported: "I won but the region didn\'t become mine / I could attack it forever")', () => {
  it('a won invasion makes the region yours on the spot, and it can\'t be attacked again', () => {
    const s0 = withArmies();
    const s = { ...s0, units: { a1: s0.units.a1 } };
    const taken = gameReducer(s, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    expect(taken.regions[BE_REGION]).toMatchObject({ owner: 'fr', control: 25, formerOwner: AGG });
    expect(taken.regions[BE_REGION].occupiedBy).toBeUndefined();
    expect(taken.regions[BE_REGION].conquest).toMatchObject({ warId: 'war_t', from: AGG });
    expect(taken.logs.at(-1).message).toMatch(/conquered/);
    expect(taken.units.a1.regionId).toBe(BE_REGION);
    // Attacking it again is refused (it's your own land now), nothing is spent.
    const again = gameReducer({ ...taken, units: { ...taken.units, a2: { ...s0.units.a1, id: 'a2', movesLeft: 1 } } }, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    expect(again.regions).toEqual(taken.regions);
    expect(again.resources).toEqual(taken.resources);
  });

  it('an occupation from an older save can\'t be invaded over and over either', async () => {
    const { validateInvasion } = await import('./invasion');
    const s = withArmies();
    const held = { ...s, regions: { ...s.regions, [BE_REGION]: { ...s.regions[BE_REGION], occupiedBy: 'fr' } } };
    expect(validateInvasion(held, FR_BORDER, BE_REGION).reason).toBe('already_held');
  });

  it('your own troops standing in the target are never counted as its garrison', async () => {
    const { validateInvasion } = await import('./invasion');
    const s = withArmies();
    const mixed = { ...s, units: { ...s.units, mine: { ...s.units.a1, id: 'mine', regionId: BE_REGION } } };
    const v = validateInvasion(mixed, FR_BORDER, BE_REGION);
    expect(v.defenderUnits.every((u) => u.ownerId !== 'fr')).toBe(true);
  });

  it('the enemy can demand conquered land back at the peace table', async () => {
    const { buildAITerms } = await import('./peace');
    const s0 = withArmies();
    const taken = gameReducer({ ...s0, units: { a1: s0.units.a1 } }, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    const war = { ...taken.wars.find((w) => w.id === 'war_t'), score: -60 };
    expect(buildAITerms(taken, war, AGG)).toContainEqual({ type: 'cede', regionId: BE_REGION });
  });

  it('the map shows occupation: an occupied region is drawn differently from its owner\'s land', async () => {
    const { getRegionFillColor, getRegionStrokeColor, OCCUPIED_BY_PLAYER_COLOR } = await import('../utils/mapRegionStyle');
    const s = withArmies();
    const occupied = { ...s.regions, [BE_REGION]: { ...s.regions[BE_REGION], occupiedBy: 'fr' } };
    expect(getRegionFillColor(occupied, 'fr', BE_REGION)).not.toBe(getRegionFillColor(s.regions, 'fr', BE_REGION));
    expect(getRegionStrokeColor(occupied, 'fr', BE_REGION, null, new Set())).toBe(OCCUPIED_BY_PLAYER_COLOR);
  });
});

describe('auto-resolve is fair and explains itself (reported: "check the auto battle is fair")', () => {
  it('a stronger army usually wins and takes the region; a weaker one usually fails; the odds say why', async () => {
    const { estimateInvasionOdds } = await import('./battleOdds');
    const s = withArmies();
    const garrison = Object.values(s.units).filter((u) => u.regionId === BE_REGION);
    expect(garrison.length).toBeGreaterThan(0);
    const mine = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`x${i}`, { ...garrison[0], id: `x${i}`, ownerId: 'fr', regionId: FR_BORDER, classId: 'infantry', movesLeft: 1, strength: garrison[0].strength }]));
    const others = Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.regionId !== FR_BORDER));
    const strong = estimateInvasionOdds({ ...s, units: { ...others, ...mine(garrison.length * 3) } }, FR_BORDER, BE_REGION, 120);
    const weak = estimateInvasionOdds({ ...s, units: { ...others, ...mine(1) } }, FR_BORDER, BE_REGION, 120);
    // The honest auto-resolve (autoBattle.js) gives both sides the battle economy's auxiliaries
    // and the city its militia, calibrated against the real-time battle (parityEco): in this
    // mountain town the defenders hold far more often than a bare count of regiments says.
    expect(strong.attacker).toBeGreaterThan(0.4);
    expect(strong.capture).toBeGreaterThan(0.3);
    expect(weak.attacker).toBeLessThan(strong.attacker);
    expect(strong.factors.find((f) => f.id === 'numbers').value).toBeGreaterThan(1);
  });
});
