// Phase R3 step 1: raids and sacks as real battles, Command or Auto, through the one outcome
// service (src/engine/raidBattle.js, battleOutcome.js raidAdapter, raids.js settleRaidBattle;
// plans/MASTER-PLAN.md 6.1, 6.5, 6.8; plans/independent-cities.md 4.4).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { ringsForKm } from '../data/geo/gridScale';
import { RAID_KM, isIndependentNation } from '../data/independents';
import { ringsAround } from './world/cities';
import { createRng } from '../utils/rng';
import { buildSetupFromArmies, buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { buildTownManifest } from '../data/townLayout';
import { RAID_LOOT_NEEDED, SACK_BURN_NEEDED, BATTLE_TYPES } from '../battle/setup/battleType';
import { RAID_BATTLE_TICKS, SACK_BATTLE_TICKS } from '../battle/sim/constants';
import { autoFromInputs, raidMult, RAID_MULT, SACK_MULT } from './autoBattle';
import { sackBurn, raidOutcome, fightRaidAuto } from './raidBattle';
import { applyBattleOutcome } from './battleOutcome';
import { processIndependents } from './raids';
import { resolveAllQueuedAuto, queuedBattleView, keepQueued } from './battleQueue';
import { cityManifestOf } from './cityManifest';
import { auditGameState } from './stateAudit';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
const unit = (id, owner, regionId, tile, classId = 'infantry') => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });

// The player (Akkad) and the nearest raiders independent, everyone else's independents retired.
const duel = () => {
  const s0 = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  const s = { ...s0, firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: false } };
  const tiles = getTiles();
  const capital = s.regions[s.nations.akkad.capitalRegionId];
  const near = ringsAround(tiles, capital.tile, ringsForKm(RAID_KM.raiders) + 3);
  const raider = Object.values(s.nations).filter((n) => n.indep?.personality === 'raiders' && near.has(s.regions[n.capitalRegionId]?.tile))
    .sort((a, b) => near.get(s.regions[a.capitalRegionId].tile) - near.get(s.regions[b.capitalRegionId].tile))[0];
  const nations = { ...s.nations };
  Object.keys(nations).forEach((id) => { if (id !== raider.id && isIndependentNation(nations[id])) nations[id] = { ...nations[id], isEliminated: true }; });
  return { s: { ...s, nations }, raider, capital };
};

// A raid party of three standing beside the player's capital, about to sack it (or fight the guard there).
const atTheGates = ({ guard = 0, kind = 'sack' } = {}) => {
  const { s, raider, capital } = duel();
  const tiles = getTiles();
  const me = s.playerNationId;
  const units = {};
  Object.values(s.units).forEach((u) => { if (u.ownerId !== me && u.ownerId !== raider.id) units[u.id] = u; });
  const beside = tiles.neighbors[capital.tile].find((t) => tiles.land[t] === 1 && t !== capital.tile);
  const home = s.regions[raider.capitalRegionId];
  for (let i = 0; i < 3; i++) units[`p${i}`] = { ...unit(`p${i}`, raider.id, home.id, beside, i < 2 ? 'cavalry' : 'infantry'), raidOf: raider.id };
  for (let i = 0; i < guard; i++) units[`g${i}`] = unit(`g${i}`, me, capital.id, capital.tile);
  const raid = { kind, targetTile: capital.tile, targetNationId: me, targetCityId: capital.id, targetUnitId: null, startedTurn: s.turnNumber, startStrength: 3000, phase: 'out', route: [], warned: true };
  return {
    s: { ...s, units, regions: { ...s.regions, [capital.id]: { ...capital, size: 4, lastYields: { ...(capital.lastYields || {}), gold: 10 } } }, resources: { ...s.resources, gold: 500 }, nations: { ...s.nations, [raider.id]: { ...s.nations[raider.id], indep: { ...s.nations[raider.id].indep, raid, mood: 'raiding' } } } },
    raider, capital, beside
  };
};

const phase = (s) => {
  const turnNumber = s.turnNumber + 1;
  const out = processIndependents({ ...s, turnNumber });
  return { ...s, turnNumber, regions: out.regions, units: out.units, nations: out.nations, resources: out.resources, world: out.world, indepStats: out.indepStats, logs: [...s.logs, ...out.logs], pendingDefenses: [...(s.pendingDefenses || []), ...out.queued] };
};

describe('the raid on the battle map (the light battle)', () => {
  const raidSetup = (seed, extra = {}) => buildSetupFromArmies({ regionId: `r-${seed}`, terrain: 'mixed', seed, attackerUnits: mk('a', ['cavalry', 'cavalry', 'infantry']), defenderUnits: mk('d', ['infantry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], raid: true, economy: true, ...extra });

  it('a raid has loot targets, no base-building and the raid clock', () => {
    const setup = raidSetup(1);
    expect(setup.battleType).toBe('raid');
    expect(setup.economy).toBe(null); // raids are the one light battle (decision 36)
    expect(setup.limitTicks).toBe(RAID_BATTLE_TICKS);
    expect(setup.raid.needed).toBe(RAID_LOOT_NEEDED);
    expect(setup.structures.filter((s) => s.loot)).toHaveLength(3);
    expect(BATTLE_TYPES.raid.limitTicks).toBe(RAID_BATTLE_TICKS);
  });

  it('a sack stands the real town: its buildings and houses are what the raiders burn', () => {
    const cityManifest = buildTownManifest({ cityId: 'sack-1', ageId: 'bronze', tierId: 'medium', style: 'europe', seed: 1, defenseTier: -1 });
    const setup = raidSetup(1, { city: true, cityManifest });
    expect(setup.battleType).toBe('sack');
    expect(setup.limitTicks).toBe(SACK_BATTLE_TICKS);
    expect(setup.raid.needed).toBe(SACK_BURN_NEEDED);
    expect(setup.structures.filter((s) => s.loot).every((s) => s.kind === 'house' || s.kind === 'building')).toBe(true);
    expect(setup.structures.filter((s) => s.loot).length).toBeGreaterThan(SACK_BURN_NEEDED);
  });

  it('the raiders burn the loot and get away by their edge; the result says how each unit left', () => {
    const { world, result } = runHeadless(raidSetup(1));
    expect(world.looted).toBe(true);
    expect(result.outcome).toBe('attacker');
    expect(result.report.tactical.reason).toBe('escaped');
    // Every raider still alive left the field by the exit.
    result.attackerUnits.filter((u) => u.strength > 0).forEach((u) => expect(u.disposition).toBe('fled'));
    // Deterministic.
    expect(runHeadless(raidSetup(1)).hash).toBe(runHeadless(raidSetup(1)).hash);
  });

  it('raiders driven off before they loot lose the battle', () => {
    // Two riders against a strong garrison: they rarely get the loot; across seeds the defender wins some.
    const outcomes = [1, 2, 3, 4, 5, 6].map((seed) => runHeadless(buildSetupFromArmies({ regionId: `r-${seed}`, terrain: 'mixed', seed, attackerUnits: mk('a', ['infantry']), defenderUnits: mk('d', ['infantry', 'infantry', 'cavalry', 'ranged']), controllers: ['ai', 'ai'], deposits: [], powers: [[], []], raid: true })).result);
    const lost = outcomes.filter((r) => r.outcome === 'defender');
    expect(lost.length).toBeGreaterThan(0);
    lost.forEach((r) => expect(['raidersDriven', 'attackerRetreated', 'timeLimit']).toContain(r.report.tactical.reason));
  });
});

describe('the honest Auto of a raid', () => {
  const ins = (a, d) => ({ attackerUnits: mk('a', a), defenderUnits: mk('d', d), hpRatio: 1, economyInputs: { supply: [1, 1], development: [0, 0] }, housing: 0 });
  it('raiders fight at RAID_MULT x the defenders / raiders share, a sack at SACK_MULT', () => {
    expect(raidMult('raid', ins(['infantry', 'infantry'], ['infantry']))).toBeCloseTo(RAID_MULT / 2);
    expect(raidMult('raid', ins(['infantry'], ['infantry', 'infantry']))).toBeCloseTo(RAID_MULT);
    expect(raidMult('sack', ins(['infantry'], ['infantry']))).toBe(SACK_MULT);
    expect(raidMult('field', ins(['infantry'], ['infantry']))).toBe(1);
  });

  it('no auxiliaries (no base-building), dispositions for the decisive rule, deterministic', () => {
    const args = { terrain: 'plains', battleType: 'raid', attackerAgeId: 'bronze', defenderAgeId: 'bronze', generals: {} };
    const a = autoFromInputs(args, ins(['cavalry', 'cavalry'], ['infantry', 'infantry', 'ranged']), 'raid', createRng(4));
    const b = autoFromInputs(args, ins(['cavalry', 'cavalry'], ['infantry', 'infantry', 'ranged']), 'raid', createRng(4));
    expect(a).toEqual(b);
    expect(a.report.auxiliaries.every((x) => x.fielded === 0)).toBe(true);
    a.attackerUnits.forEach((u) => expect(['dead', 'fled', 'field']).toContain(u.disposition));
  });

  it('beaten in the fight, fast raiders often still got the loot away (RAID_SLIP)', () => {
    const args = { terrain: 'plains', battleType: 'raid', attackerAgeId: 'bronze', defenderAgeId: 'bronze', generals: {} };
    const wins = [...Array(20).keys()].filter((i) => autoFromInputs(args, ins(['cavalry', 'cavalry'], ['infantry', 'infantry', 'infantry', 'ranged']), 'raid', createRng(i + 1)).outcome === 'attacker').length;
    expect(wins).toBeGreaterThan(10);
  });
});

describe('the raid in the outcome service', () => {
  it('beaten raiders still on the field are cut down, the ones that got away live; no war score', () => {
    const { s, raider, capital, beside } = atTheGates({ guard: 1 });
    const spec = { kind: 'raid', raidKind: 'pillage', attackerId: raider.id, defenderId: 'akkad', tile: beside, attackerUnits: ['p0', 'p1', 'p2'].map((id) => s.units[id]), defenderUnits: [s.units.g0] };
    const battle = { outcome: 'defender', attackerUnits: [{ ...s.units.p0, strength: 400, disposition: 'field' }, { ...s.units.p1, strength: 500, disposition: 'fled' }, { ...s.units.p2, strength: 0, disposition: 'dead' }], defenderUnits: [{ ...s.units.g0, strength: 700, disposition: 'field' }], report: {} };
    const o = raidOutcome(s, spec, battle, { id: 'raid-x', mode: 'command' });
    const after = applyBattleOutcome(s, o);
    expect(after.units.p0).toBeUndefined();
    expect(after.units.p1.strength).toBe(500);
    expect(after.units.p2).toBeUndefined();
    expect(after.units.g0.strength).toBe(700);
    expect(after.units.g0.regionId).toBe(capital.id);
    expect(after.wars).toEqual(s.wars);
    expect(after.battleReports[0]).toMatchObject({ kind: 'raid', playerSide: 'defender' });
    expect(applyBattleOutcome(after, o)).toBe(after); // exactly once
  });

  it('a sack the raiders won burns the town under the 50% rule: the best building and a size of houses', () => {
    const manifest = buildTownManifest({ cityId: 'b-1', ageId: 'bronze', tierId: 'medium', style: 'europe', seed: 1, defenseTier: -1, buildings: { food: 1, culture: 0 } });
    const houses = manifest.structures.filter((x) => x.kind === 'house');
    const burn = sackBurn(manifest, { size: 4, raidersWon: true, report: { destroyed: [], damaged: [] } });
    expect(burn.destroyed.filter((id) => id.startsWith('house-'))).toHaveLength(Math.ceil(houses.length / 4));
    const lost = sackBurn(manifest, { size: 4, raidersWon: false, report: { destroyed: ['house-0'], damaged: [] } });
    expect(lost.destroyed).toEqual(['house-0']);
  });

  it('through the service a won sack takes about one size, never more than half the city', () => {
    const { s, raider, capital } = atTheGates();
    const manifest = cityManifestOf(s, capital.id);
    expect(manifest).toBeTruthy();
    const spec = { kind: 'sack', raidKind: 'sack', attackerId: raider.id, defenderId: 'akkad', tile: capital.tile, cityId: capital.id, attackerUnits: ['p0', 'p1', 'p2'].map((id) => s.units[id]), defenderUnits: [] };
    const battle = { outcome: 'attacker', attackerUnits: spec.attackerUnits.map((u) => ({ ...u, disposition: 'fled' })), defenderUnits: [], report: {} };
    const after = applyBattleOutcome(s, raidOutcome(s, spec, battle, { id: 'sack-x' }));
    const city = after.regions[capital.id];
    expect(city.owner).toBe('akkad'); // never a capture
    expect(city.size).toBeGreaterThanOrEqual(2);
    expect(city.size).toBeLessThanOrEqual(4);
    expect(Object.keys(city.cityDamage?.ruined || {}).length).toBeLessThanOrEqual(Math.floor(manifest.structures.filter((x) => x.kind === 'house').length / 2));
  });
});

describe('raids against the player wait for Command or Auto', () => {
  it('a sack is queued, pauses the turn, and Auto settles it: gold, the burned town, the march home', () => {
    const { s, raider, capital } = atTheGates();
    const q = phase(s);
    expect(q.pendingDefenses).toHaveLength(1);
    const def = q.pendingDefenses[0];
    expect(def).toMatchObject({ kind: 'sack', aggressorId: raider.id, warId: null, cityId: capital.id });
    expect(def.militia.length).toBeGreaterThan(0); // the town's militia stands
    expect(q.nations[raider.id].indep.raid.phase).toBe('battle');
    expect(keepQueued(def, q.wars, q.nations)).toBe(true);
    expect(resolveTurn(q)).toBe(q);
    expect(queuedBattleView(q, def, 6).odds.holdChance).toBeGreaterThanOrEqual(0);
    const done = gameReducer(q, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    expect(done.pendingDefenses).toHaveLength(0);
    expect(done.appliedBattleIds).toContain(def.id);
    const raid = done.nations[raider.id].indep.raid;
    expect(raid === null || raid.phase === 'home').toBe(true);
    expect(done.battleReports[0]).toMatchObject({ kind: 'sack', attackerNationId: raider.id, playerSide: 'defender', commanded: false });
    if (done.indepStats.sacks > 0) {
      expect(done.resources.gold).toBe(500 - 30);
      expect(done.regions[capital.id].sackedTurn).toBe(done.turnNumber);
    }
    expect(auditGameState(done).filter((v) => v.code !== 'eliminated_owner')).toEqual([]);
  });

  it('Command: the player defends the town in the real-time sack and the result lands once', () => {
    const { s, raider, capital } = atTheGates({ guard: 1 });
    const q = phase(s);
    const def = q.pendingDefenses[0];
    const began = gameReducer(q, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    expect(began.pendingBattle).toMatchObject({ kind: 'sack', playerSide: 'defender', attackerNationId: raider.id, defenseId: def.id });
    const setup = buildInvasionSetup(began, began.pendingBattle);
    expect(setup.battleType).toBe('sack');
    expect(setup.controllers).toEqual(['ai', 'player']);
    expect(setup.economy).toBe(null);
    expect(setup.city?.id ?? setup.city).toBeTruthy();
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const resolved = gameReducer(began, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: began.pendingBattle.id, result } });
    expect(resolved.pendingBattle).toBeNull();
    expect(resolved.pendingDefenses).toHaveLength(0);
    expect(resolved.appliedBattleIds).toContain(def.id);
    expect(resolved.battleReports[0]).toMatchObject({ kind: 'sack', commanded: true });
    expect(resolved.regions[capital.id].owner).toBe('akkad');
    // Abandoning the battle instead is the same record's Auto.
    const abandoned = gameReducer(began, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(abandoned.pendingDefenses).toHaveLength(0);
    expect(abandoned.appliedBattleIds).toContain(def.id);
  });

  it('through resolveTurn: the raid battle is queued at the turn and autoDefend fights it at once', () => {
    const { s, raider } = atTheGates({ guard: 1 });
    const paused = resolveTurn(s);
    expect(paused.pendingDefenses.some((d) => d.kind === 'sack' && d.aggressorId === raider.id)).toBe(true);
    const auto = resolveTurn({ ...s, battleSettings: { autoDefend: true } });
    expect(auto.pendingDefenses.filter((d) => d.aggressorId === raider.id)).toHaveLength(0);
    expect(auto.battleReports.some((b) => b.kind === 'sack')).toBe(true);
    expect(JSON.stringify(resolveTurn({ ...s, battleSettings: { autoDefend: true } }).nations)).toBe(JSON.stringify(auto.nations));
  }, 120000);

  it('raids against AI nations are fought on Auto at once, through the outcome service', () => {
    const { s, raider } = atTheGates({ guard: 1 });
    const fought = fightRaidAuto(s, { kind: 'raid', attackerId: raider.id, defenderId: 'akkad', tile: s.units.g0.tile, attackerUnits: ['p0', 'p1', 'p2'].map((id) => s.units[id]), defenderUnits: [s.units.g0] }, createRng(3));
    expect(['attacker', 'defender', 'stalemate']).toContain(fought.outcome);
    // resolveAllQueuedAuto on an empty queue is a no-op.
    expect(resolveAllQueuedAuto(s)).toBe(s);
  });
});
