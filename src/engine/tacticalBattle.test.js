// src/engine/tacticalBattle.test.js
// Tactical Battles T5 exit gate (design/rts-battles-implementation-plan.md §17): BEGIN pays once
// and locks the units; the turn can't end mid-battle; RESOLVE applies exactly the invasion's own
// consequences from a sanitized result (no minting soldiers); ABANDON is auto-resolve with the same
// seed; and a real headless battle's result flows through RESOLVE end to end.
import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState, sanitizeTacticalResult } from './gameReducer';
import { ActionTypes } from '../data/types';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { estimateInvasionOdds } from './battleOdds';
import { getNationCapital } from '../data/regions';
import { createWorld, sideEdgeX } from '../battle/sim/world';
import { firePower } from '../battle/sim/effects';

const FR_BORDER = 'fr-59';
const BE_REGION = 'be-vwv';

const baseState = () => {
  const s = createInitialState({ playerNationId: 'fr' });
  return {
    ...s,
    resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
    wars: [...s.wars, { id: 'war_t', aggressor: 'fr', enemy: 'be', active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }]
  };
};
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1
});
const withArmies = (state = baseState()) => ({
  ...state,
  units: {
    a1: unit('a1', FR_BORDER, 'fr'), a2: unit('a2', FR_BORDER, 'fr', 'cavalry'), a3: unit('a3', FR_BORDER, 'fr', 'ranged'),
    d1: unit('d1', BE_REGION, 'be'), d2: unit('d2', BE_REGION, 'be', 'ranged', 800)
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
    const moved = gameReducer(next, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a1', toRegionId: 'fr-62' } });
    expect(moved.units.a1.regionId).toBe(FR_BORDER);
    const turn = gameReducer(next, { type: ActionTypes.ADVANCE_TURN });
    expect(turn.turnNumber).toBe(next.turnNumber);
    expect(begin(next).pendingBattle.id).toBe(next.pendingBattle.id);
  });

  it('takes an undefended region immediately, like auto-resolve', () => {
    const s = baseState();
    const next = begin({ ...s, units: { a1: unit('a1', FR_BORDER, 'fr') } });
    expect(next.pendingBattle).toBeNull();
    expect(next.regions[BE_REGION].occupiedBy).toBe('fr');
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

  it('the target province\'s buildings stand on the battlefield, and the ones razed lose a tier', () => {
    const s0 = withArmies();
    const r = s0.regions[BE_REGION];
    const s = { ...s0, regions: { ...s0.regions, [BE_REGION]: { ...r, buildings: { ...r.buildings, categories: { ...r.buildings.categories, military: 1, economy: 0 } } } } };
    const started = begin(s);
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.structures.filter((st) => st.kind === 'building').map((st) => st.category).sort()).toEqual(['economy', 'military']);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const forged = { ...result, report: { ...result.report, tactical: { ...result.report.tactical, razed: ['military', 'defense', 'bogus'] } } };
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
    expect(next.regions[BE_REGION].occupiedBy).toBe('fr');
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
    expect(estimateInvasionOdds({ ...s, units: { a1: unit('a1', FR_BORDER, 'fr') } }, FR_BORDER, BE_REGION).undefended).toBe(true);
  });
});

describe('T7: reinforcements, missiles and powers in the campaign', () => {
  const withNeighbourTroops = () => {
    const s = withArmies();
    // fr-62 (Pas-de-Calais) borders West Flanders? use any French neighbour of the target that isn't the origin
    const neighbour = ['fr-62', 'fr-80', 'fr-02'].find((id) => s.regions[id]?.owner === 'fr');
    return { s: { ...s, units: { ...s.units, r1: unit('r1', neighbour, 'fr', 'cavalry') } }, neighbour };
  };

  it('BEGIN records standby reinforcements from neighbouring provinces and locks them', () => {
    const s = withArmies();
    const neighbours = ['fr-62', 'fr-80', 'fr-02', 'fr-59'];
    const next = begin(s);
    expect(Array.isArray(next.pendingBattle.attackerReinforcements)).toBe(true);
    // the origin province is never a "reinforcement" source
    expect(next.pendingBattle.attackerReinforcements.some((r) => r.regionId === FR_BORDER)).toBe(false);
    expect(neighbours.length).toBeGreaterThan(0);
  });

  it('a reinforcement only counts if the battle says it joined', () => {
    const { s } = withNeighbourTroops();
    const started = begin(s);
    const pb = { ...started.pendingBattle, attackerReinforcements: [{ regionId: 'fr-62', unitIds: ['r1'] }] };
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
    const before = started.nations.de.hostility;
    const result = { outcome: 'stalemate', attackerUnits: pb.attackerUnitIds.map((id) => ({ ...started.units[id], strength: 0 })), defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id], strength: 0 })), report: { tactical: { powersUsed: [{ nuclearStrike: 1 }, {}] } } };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
    expect(next.nations.fr.missiles.nuclear).toBe(0);
    expect(next.nations.be.hostility).toBe(100);
    expect(next.nations.de.hostility).toBeGreaterThan(before);
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
  const GB_TARGET = 'gb-ios';
  const landingState = () => {
    const s = createInitialState({ playerNationId: 'fr' });
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
    expect(empty.regions[GB_TARGET].occupiedBy).toBe('fr');
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

describe('occupation → annexation (reported: "occupied Aqaba but it didn\'t change owner")', () => {
  it('an occupied region becomes yours when the enemy cedes it in a peace deal', () => {
    const s0 = withArmies();
    // Take the undefended region by auto-resolve: occupied, not owned.
    const s = { ...s0, units: { a1: s0.units.a1 } };
    const taken = gameReducer(s, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    expect(taken.regions[BE_REGION]).toMatchObject({ owner: 'be', occupiedBy: 'fr' });
    expect(taken.logs.at(-1).message).toMatch(/until peace/);
    // Winning the war enough that they accept, then demanding it at the table.
    const winning = { ...taken, wars: taken.wars.map((w) => (w.id === 'war_t' ? { ...w, score: 80 } : w)) };
    const peace = gameReducer(winning, { type: ActionTypes.OFFER_PEACE, payload: { warId: 'war_t', terms: [{ type: 'cede', regionId: BE_REGION }] } });
    expect(peace.regions[BE_REGION].owner).toBe('fr');
    expect(peace.regions[BE_REGION].occupiedBy).toBeFalsy();
    expect(peace.wars.find((w) => w.id === 'war_t').active).toBe(false);
  });

  it('the map shows occupation: an occupied region is drawn differently from its owner\'s land', async () => {
    const { getRegionFillColor, getRegionStrokeColor, OCCUPIED_BY_PLAYER_COLOR } = await import('../utils/mapRegionStyle');
    const s = withArmies();
    const occupied = { ...s.regions, [BE_REGION]: { ...s.regions[BE_REGION], occupiedBy: 'fr' } };
    expect(getRegionFillColor(occupied, 'fr', BE_REGION)).not.toBe(getRegionFillColor(s.regions, 'fr', BE_REGION));
    expect(getRegionStrokeColor(occupied, 'fr', BE_REGION, null, new Set())).toBe(OCCUPIED_BY_PLAYER_COLOR);
  });
});
