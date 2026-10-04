// src/engine/defense.test.js
// Tactical Battles T8 exit gate (design/rts-battles-implementation-plan.md §16–17): AI assaults on
// garrisoned player regions queue as defense battles instead of a bare dice roll; the turn can't
// end while one is pending; auto and commanded defenses apply the right consequences; and the
// calibration harness keeps expected territory loss under auto-resolve within ±10% of the old roll.
import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './gameReducer';
import { ActionTypes } from '../data/types';
import { resolveWarProgress } from './diplomacy';
import { resolveTurn } from './resolveTurn';
import { resolveBattle } from './battle';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { getDefenseLevelDamageReductionMultiplier, SIEGE_CONTROL_DAMAGE } from './siege';
import { createRng } from '../utils/rng';
import { addCity } from './testWorld';
import { getNeighborIds } from '../data/regions';
import {
  buildSyntheticForce, getAssaultSize, getAssaultPressure, createDefenseRecord, PLAYER_DEFENDED_CAPTURE_MULT
} from './defense';

// The Dawn world gives France one city with no room beside it, so the fixture founds two French
// cities on the nearest free land (the first borders a foreign capital, the second borders the
// first) and the war comes from whoever owns that foreign neighbour.
// On the frequency-75 grid Dawn capitals sit about 8 rings apart, so the foreign neighbour is
// founded beside the first French city (REINFORCE_RINGS reach) rather than found among the
// capitals the registry bridges.
const WORLD = (() => {
  const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 1 }), 'fr');
  const foe = addCity(first.state, 'de', { near: first.cityId });
  const second = addCity(foe.state, 'fr', { near: first.cityId });
  const border = getNeighborIds(first.cityId).includes(foe.cityId) ? foe.cityId : getNeighborIds(first.cityId).find((id) => second.state.regions[id].owner !== 'fr');
  return { state: second.state, FR_BORDER: first.cityId, FR_BACK: second.cityId, BE_REGION: border, AGG: second.state.regions[border].owner };
})();
const { FR_BORDER, BE_REGION, AGG } = WORLD;

const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1
});
const war = (s) => ({ id: 'war_d', aggressor: AGG, enemy: 'fr', active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: FR_BORDER } });
const baseState = (units) => {
  const s = { ...WORLD.state, nations: { ...WORLD.state.nations } };
  // Legacy synthetic assault compatibility; operational AI has separate real-army tests.
  s.nations[AGG] = { ...s.nations[AGG], economy: undefined };
  return { ...s, wars: [...s.wars, war(s)], units: units || { g1: unit('g1', FR_BORDER, 'fr'), g2: unit('g2', FR_BORDER, 'fr', 'ranged') } };
};
const alwaysRoll = { next: () => 0.0001, getSeed: () => 1 };
const queue = (s) => resolveWarProgress(s, s.regions, s.nations, s.wars, alwaysRoll);
const withDefense = (s = baseState()) => {
  const { pendingDefenses } = queue(s);
  return { ...s, pendingDefenses };
};

describe('queueing defenses', () => {
  it('a successful roll on a garrisoned player region queues a defense instead of damaging control', () => {
    const s = baseState();
    const out = queue(s);
    expect(out.pendingDefenses).toHaveLength(1);
    expect(out.pendingDefenses[0]).toMatchObject({ warId: 'war_d', aggressorId: AGG, regionId: FR_BORDER, defenderUnitIds: ['g1', 'g2'] });
    expect(out.regions[FR_BORDER].control).toBe(s.regions[FR_BORDER].control);
    expect(out.pendingDefenses[0].synthetic.length).toBeGreaterThan(0);
  });

  it('an undefended player region keeps the old dice roll', () => {
    const s = baseState({});
    const out = queue(s);
    expect(out.pendingDefenses).toHaveLength(0);
    expect(out.regions[FR_BORDER].owner).toBe(AGG); // conquered
  });

  it('prefers the aggressor\'s real neighbouring troops over synthetic ones', () => {
    const s = baseState({ g1: unit('g1', FR_BORDER, 'fr'), r1: unit('r1', BE_REGION, AGG, 'cavalry') });
    const def = createDefenseRecord(s, { war: s.wars.at(-1), regionId: FR_BORDER, aggressorShare: 0.5, seed: 5, index: 1 });
    expect(def.attackerUnitIds).toEqual(['r1']);
    expect(def.synthetic).toHaveLength(0);
    expect(def.fromRegionId).toBe(BE_REGION);
  });

  it('builds a deterministic synthetic force sized by the aggressor\'s share', () => {
    expect(getAssaultSize(3, 0.5)).toBe(3);
    expect(getAssaultSize(3, 0.75)).toBeGreaterThan(3);
    expect(getAssaultSize(1, 0.1)).toBe(1);
    const a = buildSyntheticForce({ defenseId: 'x', aggressorId: AGG, ageId: 'gunpowder', count: 5, seed: 42 });
    const b = buildSyntheticForce({ defenseId: 'x', aggressorId: AGG, ageId: 'gunpowder', count: 5, seed: 42 });
    expect(a).toEqual(b);
    expect(a[0].classId).toBe('infantry');
    expect(a.every((u) => u.synthetic && u.strength === 1000)).toBe(true);
  });
});

describe('turn flow', () => {
  it('the turn can\'t end (or fast-forward) while a defense is pending, and the garrison is locked', () => {
    const s = withDefense();
    expect(gameReducer(s, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(s.turnNumber);
    expect(gameReducer(s, { type: ActionTypes.FAST_FORWARD }).turnNumber).toBe(s.turnNumber);
    const moved = gameReducer(s, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'g1', toRegionId: FR_BORDER } });
    expect(moved.units.g1.regionId).toBe(FR_BORDER);
  });

  it('auto-resolving clears the queue and the turn can end again', () => {
    const s = withDefense();
    const next = gameReducer(s, { type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO });
    expect(next.pendingDefenses).toHaveLength(0);
    expect(next.lastBattleReport.defense).toBe(true);
    expect(gameReducer(next, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(s.turnNumber + 1);
  });

  it('with battleSettings.autoDefend, resolveTurn fights defenses without interrupting', () => {
    let s = { ...baseState(), battleSettings: { autoDefend: true } };
    for (let i = 0; i < 40; i++) {
      s = resolveTurn(s);
      expect(s.pendingDefenses || []).toHaveLength(0);
      if (s.activeEventId || s.activeProceduralEvent || s.pendingPeaceOffer) s = { ...s, activeEventId: null, activeProceduralEvent: null, pendingPeaceOffer: null };
    }
  }, 60000);
});

describe('consequences', () => {
  it('a crushing garrison repels the assault: no control lost, war score to the player, synthetic losses off militaryStrength', () => {
    const s = withDefense({ ...baseState({ g1: unit('g1', FR_BORDER, 'fr'), g2: unit('g2', FR_BORDER, 'fr'), g3: unit('g3', FR_BORDER, 'fr', 'ranged'), g4: unit('g4', FR_BORDER, 'fr', 'cavalry') }) });
    const def = { ...s.pendingDefenses[0], synthetic: s.pendingDefenses[0].synthetic.slice(0, 1).map((u) => ({ ...u, strength: 150 })) };
    const st = { ...s, pendingDefenses: [def] };
    const next = gameReducer(st, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    expect(next.regions[FR_BORDER].control).toBe(st.regions[FR_BORDER].control);
    expect(next.regions[FR_BORDER].occupiedBy).toBeFalsy();
    expect(next.wars.find((w) => w.id === 'war_d').battleScore).toBeLessThan(0); // negative = toward the defender (fr)
    expect(next.nations[AGG].militaryStrength).toBeLessThan(st.nations[AGG].militaryStrength);
  });

  it('a garrison that is overrun at low control falls back to a neighbouring province and the region is conquered', () => {
    const s0 = withDefense(baseState({ g1: unit('g1', FR_BORDER, 'fr', 'ranged', 120) }));
    const s = { ...s0, regions: { ...s0.regions, [FR_BORDER]: { ...s0.regions[FR_BORDER], control: 20 } } };
    const def = { ...s.pendingDefenses[0], synthetic: buildSyntheticForce({ defenseId: 'z', aggressorId: AGG, ageId: s.age, count: 8, seed: 3 }) };
    const next = gameReducer({ ...s, pendingDefenses: [def] }, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    expect(next.regions[FR_BORDER].owner).toBe(AGG);
    expect(next.regions[FR_BORDER].conquest?.from).toBe('fr');
    if (next.units.g1) expect(next.units.g1.regionId).not.toBe(FR_BORDER);
  });

  it('peace signed before the battle means nothing happens', () => {
    const s = withDefense();
    const peaceful = { ...s, wars: s.wars.map((w) => (w.id === 'war_d' ? { ...w, active: false } : w)) };
    const next = gameReducer(peaceful, { type: ActionTypes.RESOLVE_ALL_DEFENSES_AUTO });
    expect(next.pendingDefenses).toHaveLength(0);
    expect(next.units).toEqual(peaceful.units);
    expect(next.regions[FR_BORDER]).toEqual(peaceful.regions[FR_BORDER]);
  });
});

describe('commanded defense', () => {
  it('BEGIN opens a battle with the player defending; a real headless battle resolves it end to end', () => {
    const s = withDefense();
    const def = s.pendingDefenses[0];
    const started = gameReducer(s, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    expect(started.pendingBattle).toMatchObject({ kind: 'defense', defenseId: def.id, playerSide: 'defender', attackerNationId: AGG, defenderNationId: 'fr', defenderUnitIds: ['g1', 'g2'] });
    expect(started.resources).toEqual(s.resources); // defending is free
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.controllers).toEqual(['ai', 'player']);
    expect(setup.sides[0].units.length).toBe(def.synthetic.length);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result } });
    expect(next.pendingBattle).toBeNull();
    expect(next.pendingDefenses).toHaveLength(0);
    expect(next.lastBattleReport.outcome).toBe(result.outcome);
    // synthetic troops never enter state.units
    expect(Object.keys(next.units).some((id) => id.startsWith('syn_'))).toBe(false);
  });

  it('never trusts the client with synthetic troops either, and ABANDON auto-resolves the same defense', () => {
    const s = withDefense();
    const def = s.pendingDefenses[0];
    const started = gameReducer(s, { type: ActionTypes.BEGIN_DEFENSE_BATTLE, payload: { defenseId: def.id } });
    const bogus = { outcome: 'defender', attackerUnits: def.synthetic.map((u) => ({ id: u.id, strength: 99999 })), defenderUnits: [{ id: 'g1', strength: 99999 }, { id: 'intruder', strength: 5000 }], report: {} };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: bogus } });
    expect(next.units.g1.strength).toBeLessThanOrEqual(1000);
    expect(next.units.intruder).toBeUndefined();
    expect(next.nations[AGG].militaryStrength).toBe(s.nations[AGG].militaryStrength); // no synthetic "gains"
    const abandoned = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    const auto = gameReducer(s, { type: ActionTypes.RESOLVE_DEFENSE_AUTO, payload: { defenseId: def.id } });
    expect(abandoned.pendingDefenses).toHaveLength(0);
    expect(abandoned.units).toEqual(auto.units);
    expect(abandoned.regions[FR_BORDER]).toEqual(auto.regions[FR_BORDER]);
  });
});

// The balance gate: before T8 a successful roll against a garrison ALWAYS did full siege damage.
// Now the roll fires PLAYER_DEFENDED_CAPTURE_MULT times as often and the damage follows the battle.
// Over a spread of garrisons, forts, terrains, ages and aggressor strengths (weighted by how often
// each rolls, which scales with the aggressor's share), expected control damage must stay within ±10%.
describe('calibration harness', () => {
  it('expected player territory loss under auto-resolve is within ±10% of the old dice roll', () => {
    const pick = createRng(2026);
    let oldDamage = 0; let newDamage = 0;
    const cls = ['infantry', 'infantry', 'ranged', 'cavalry'];
    for (const share of [0.25, 0.4, 0.5, 0.65, 0.8]) for (const fort of [0, 2, 4]) for (const age of ['classical', 'kingdoms', 'gunpowder', 'modern']) for (const terrain of ['plains', 'forest', 'hills', 'mountains', 'urban']) for (const g of [1, 2, 4]) for (let k = 0; k < 2; k++) {
      const garrison = Array.from({ length: g }, (_, i) => unit(`g${i}`, 'x', 'fr', cls[Math.floor(pick.next() * 4)]));
      const seed = Math.floor(pick.next() * 1e9);
      const attackers = buildSyntheticForce({ defenseId: 'h', aggressorId: 'ai', ageId: age, count: getAssaultSize(g, share), seed });
      const battle = resolveBattle({ attackerUnits: attackers, defenderUnits: garrison, terrain, isAttackingFortification: fort > 0, generals: {}, attackerAgeId: age, defenderAgeId: age, defenderDamageReductionMultiplier: getDefenseLevelDamageReductionMultiplier(fort), rng: createRng(seed) });
      const pressure = getAssaultPressure(battle, { attacker: attackers.length * 1000, defender: g * 1000 });
      const chance = 0.15 * share;
      oldDamage += chance * SIEGE_CONTROL_DAMAGE.attacker;
      newDamage += Math.min(1, chance * PLAYER_DEFENDED_CAPTURE_MULT) * SIEGE_CONTROL_DAMAGE.attacker * pressure;
    }
    const ratio = newDamage / oldDamage;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  it('pressure is 1 on a break, 0 when the attacking line breaks, and follows the exchange otherwise', () => {
    const u = (id, strength, routed = false) => ({ id, strength, routed });
    expect(getAssaultPressure({ outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: {} }, { attacker: 1, defender: 1 })).toBe(1);
    expect(getAssaultPressure({ outcome: 'defender', attackerUnits: [u('a', 400, true)], defenderUnits: [u('d', 900)], report: { deployedAttackerIds: ['a'] } }, { attacker: 1000, defender: 1000 })).toBe(0);
    expect(getAssaultPressure({ outcome: 'defender', attackerUnits: [u('a', 800)], defenderUnits: [u('d', 800)], report: { deployedAttackerIds: ['a'] } }, { attacker: 1000, defender: 1000 })).toBeCloseTo(0.5);
  });
});

// Reported: "the manual battle option disappeared and engagements bypass to auto-resolve".
describe('pre-battle choice is never skipped by accident', () => {
  it('the old shared "auto" mode no longer auto-resolves enemy assaults — only autoDefend does', () => {
    // Play turns in the legacy mode until the enemy assaults: the assault must wait for the player.
    let s = { ...baseState(), battleSettings: { defaultMode: 'auto' } };
    let asked = false;
    for (let i = 0; i < 80 && !asked; i++) {
      s = resolveTurn(s);
      // keep the aggressor on the legacy dice path (resolveTurn backfills an economy, after which
      // only a real AI march could assault, and that depends on where the capitals start)
      s = { ...s, nations: { ...s.nations, [AGG]: { ...s.nations[AGG], economy: undefined } } };
      asked = (s.pendingDefenses || []).length > 0;
      if (s.activeEventId || s.activeProceduralEvent || s.pendingPeaceOffer) s = { ...s, activeEventId: null, activeProceduralEvent: null, pendingPeaceOffer: null };
    }
    expect(asked).toBe(true);
  }, 60000);

  it('a garrison can withdraw instead of fighting: it falls back, shaken, and the enemy takes the province', () => {
    const s = withDefense(baseState({ g1: unit('g1', FR_BORDER, 'fr'), g2: unit('g2', FR_BORDER, 'fr', 'ranged') }));
    const def = s.pendingDefenses[0];
    const next = gameReducer(s, { type: ActionTypes.WITHDRAW_FROM_DEFENSE, payload: { defenseId: def.id } });
    expect(next.pendingDefenses).toHaveLength(0);
    expect(next.regions[FR_BORDER].owner).toBe(AGG);
    expect(next.units.g1.regionId).not.toBe(FR_BORDER);
    expect(next.regions[next.units.g1.regionId].owner).toBe('fr');
    expect(next.units.g1.morale).toBeLessThan(s.units.g1.morale ?? 100);
    expect(next.units.g1.strength).toBeLessThan(s.units.g1.strength);
  });
});
