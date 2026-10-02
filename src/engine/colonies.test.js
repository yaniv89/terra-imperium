import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNeighborIds } from '../data/regions';
import { assertGameState } from './stateAudit';
import {
  BASE_PROGRESS, BORDER_BONUS_CAP, POLICY, RAIDS_TO_LOSE, RAID_SETBACK, SETTLER_MIN, colonyGrowth, colonySlots, foundColony, foundingCost,
  processColonies, raidChance, validateColony
} from './colonies';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const emergent = () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 7, scenario: { mode: 'emergent', nationCount: 15, seed: 7 } });
  return quiet({ ...s, resources: { ...s.resources, gold: 10000, adm: 100, supplies: 100 } });
};
const homeOf = (s) => s.units.start_fr.regionId;
const frontierNear = (s, from = homeOf(s)) => getNeighborIds(from).find((id) => s.regions[id]?.owner === null && s.regions[id]?.neutral && !s.regions[id].colony);
// Run only the colony phase for `turns` turns (no world noise).
const grow = (s, turns) => { let x = s; for (let i = 0; i < turns; i++) x = processColonies({ ...x, turnNumber: x.turnNumber + 1 }); return x; };

describe('founding a colony', () => {
  it('needs free land next to yours, an army next to it, a slot and the cost, and says what is missing', () => {
    const s = emergent();
    const target = frontierNear(s);
    expect(validateColony(s, target).ok).toBe(true);
    const noArmy = { ...s, units: {} };
    const v = validateColony(noArmy, target);
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => !c.ok).label).toMatch(/army/);
    const poor = { ...s, resources: { ...s.resources, gold: 0 } };
    expect(validateColony(poor, target).reason).toMatch(/Costs/);
  });

  it('pays, moves the escort in and takes settlers from the home province', () => {
    const s = emergent();
    const target = frontierNear(s);
    const home = homeOf(s);
    const cost = foundingCost(s, 'fr');
    const next = gameReducer(s, { type: ActionTypes.FOUND_COLONY, payload: { regionId: target, policy: 'coexist' } });
    expect(next.regions[target].colony).toMatchObject({ ownerId: 'fr', policy: 'coexist', progress: 0 });
    expect(next.regions[target].owner).toBe(null); // not yours yet
    expect(next.resources.gold).toBe(s.resources.gold - cost.gold);
    expect(next.units.start_fr.regionId).toBe(target);
    expect(next.regions[home].currentPopulation).toBeLessThanOrEqual(s.regions[home].currentPopulation - SETTLER_MIN);
  });

  it('costs more the bigger the realm, and slots grow with the age', () => {
    const s = emergent();
    const small = foundingCost(s, 'fr');
    const owned = Object.keys(s.regions).filter((id) => s.regions[id].owner === null).slice(0, 20);
    const big = { ...s, regions: { ...s.regions, ...Object.fromEntries(owned.map((id) => [id, { ...s.regions[id], owner: 'fr', neutral: null }])) } };
    expect(foundingCost(big, 'fr').gold).toBeGreaterThan(small.gold * 3);
    expect(colonySlots(s, 'fr')).toBe(1);
    expect(colonySlots({ ...s, age: 'classical', techAgeId: 'classical' }, 'fr')).toBe(2);
  });

  it('a second colony waits for a free slot', () => {
    let s = emergent();
    const a = frontierNear(s);
    s = foundColony(s, a, 'coexist');
    s = { ...s, units: { ...s.units, extra: { ...s.units.start_fr, id: 'extra', regionId: homeOf(emergent()), movesLeft: 1 } } };
    const b = frontierNear(s, homeOf(emergent()));
    expect(validateColony(s, b).reason).toMatch(/slots: 1 of 1/);
  });
});

describe('a colony grows', () => {
  it('by terrain, policy and the provinces of yours around it', () => {
    const s = emergent();
    const target = frontierNear(s);
    const g = colonyGrowth(s, target, 'fr', 'coexist');
    expect(g).toBeGreaterThan(0);
    expect(colonyGrowth(s, target, 'fr', 'driveOut') / g).toBeCloseTo(POLICY.driveOut.growth / POLICY.coexist.growth);
    expect(g).toBeLessThanOrEqual(BASE_PROGRESS * POLICY.coexist.growth * (1 + BORDER_BONUS_CAP));
  });

  it('becomes a province after several turns, and the people stay when living alongside them', () => {
    let s = foundColony(emergent(), frontierNear(emergent()), 'coexist');
    const target = frontierNear(emergent());
    const people = s.regions[target].currentPopulation;
    // No raids for this test: no resistance.
    s = { ...s, regions: { ...s.regions, [target]: { ...s.regions[target], neutral: { ...s.regions[target].neutral, resistance: 0 } } } };
    let turns = 0;
    while (s.regions[target].owner !== 'fr' && turns < 40) { s = grow(s, 1); turns += 1; }
    expect(s.regions[target].owner).toBe('fr');
    expect(turns).toBeGreaterThanOrEqual(8);
    expect(s.regions[target].currentPopulation).toBeGreaterThan(people);
    expect(s.regions[target].integratingUntil).toBeGreaterThan(s.turnNumber);
    expect(s.regions[target].colony).toBeUndefined();
    assertGameState(s);
  });

  it('charges upkeep each turn, and does not grow when it cannot be paid', () => {
    const s0 = foundColony(emergent(), frontierNear(emergent()), 'coexist');
    const target = frontierNear(emergent());
    const paid = grow(s0, 1);
    expect(paid.resources.gold).toBeLessThan(s0.resources.gold);
    const broke = grow({ ...s0, resources: { ...s0.resources, gold: 0 } }, 1);
    expect(broke.regions[target].colony.progress).toBeLessThanOrEqual(0);
  });

  it('raids set it back, and three in a row lose it', () => {
    let s = foundColony(emergent(), frontierNear(emergent()), 'driveOut');
    const target = frontierNear(emergent());
    s = { ...s, regions: { ...s.regions, [target]: { ...s.regions[target], neutral: { ...s.regions[target].neutral, resistance: 1e6 } } } };
    expect(raidChance(s, target, 'driveOut', true)).toBeGreaterThan(0.5);
    let lost = false;
    for (let i = 0; i < 20 && !lost; i++) { s = grow(s, 1); lost = !s.regions[target].colony; }
    expect(lost).toBe(true);
    expect(s.logs.some((l) => /overrun by raids/.test(l.message))).toBe(true);
    expect(RAIDS_TO_LOSE).toBe(3);
    expect(RAID_SETBACK).toBeGreaterThan(0);
  });

  it('abandoning gives the land back', () => {
    const s = foundColony(emergent(), frontierNear(emergent()), 'coexist');
    const target = frontierNear(emergent());
    const next = gameReducer(s, { type: ActionTypes.ABANDON_COLONY, payload: { regionId: target } });
    expect(next.regions[target].colony).toBeUndefined();
    expect(next.regions[target].owner).toBe(null);
  });
});

describe('through the whole turn', () => {
  it('is deterministic, survives a save, and AI nations found colonies under the same rules', () => {
    const play = () => {
      let s = gameReducer(emergent(), { type: ActionTypes.FOUND_COLONY, payload: { regionId: frontierNear(emergent()), policy: 'coexist' } });
      for (let t = 0; t < 6; t++) { if (s.pendingPeaceOffer) s = gameReducer(s, { type: ActionTypes.REJECT_PENDING_PEACE }); s = resolveTurn({ ...s, activeProceduralEvent: null }); }
      return s;
    };
    const a = play(); const b = play();
    expect(JSON.stringify(a.regions)).toBe(JSON.stringify(b.regions));
    const colonies = Object.values(a.regions).filter((r) => r.colony);
    expect(colonies.some((r) => r.colony.ownerId !== 'fr')).toBe(true);
    // No AI nation runs more colonies than its slots.
    const by = {}; colonies.forEach((r) => { by[r.colony.ownerId] = (by[r.colony.ownerId] || 0) + 1; });
    Object.entries(by).forEach(([id, n]) => expect(n).toBeLessThanOrEqual(colonySlots(a, id)));
    const loaded = JSON.parse(JSON.stringify(a));
    expect(JSON.stringify(resolveTurn(loaded).regions)).toBe(JSON.stringify(resolveTurn(a).regions));
    assertGameState(a);
  });
});
