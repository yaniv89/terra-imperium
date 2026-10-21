// Regression tests for the second review pass (design/code-review-fix-plan.md, S2-S14). Each test
// reproduces the exact scenario the review verified as broken, against the real reducer/turn engine.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { startCivilWar, processCivilWarTurn, INSURGENT_MARKER } from './civilWar';
import { applyEventEffects, getOptionShortfall } from './applyEventEffects';
import { ActionTypes } from '../data/types';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { HISTORICAL_EVENTS } from '../data/events';
import { ACHIEVEMENTS } from '../data/achievements';
import { getBorderingNationIds, getOwnedRegionIds, isAdjacentToOwner } from '../data/regions';
import { createRng } from '../utils/rng';
import { addCity, addCities, cloneWorld, neighbourWorld, rivalOf } from './testWorld';

const A = (type, payload) => ({ type: ActionTypes[type], payload });
// A small peoples world where the player borders two rivals (P the player, R and R2 the rivals).
const WORLD = neighbourWorld({ rivals: 2, seed: 4242 });
const P = WORLD.playerNationId;
const R = rivalOf(WORLD);
const R2 = rivalOf(WORLD, 1);
const fresh = () => ({
  ...cloneWorld(WORLD),
  firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
  proceduralEventCooldown: 999999
});
const lastLog = (state) => state.logs[state.logs.length - 1]?.message || '';
const borderRegion = (state) => {
  const neighbor = getBorderingNationIds(state.regions, state.playerNationId).find((id) => state.nations[id]);
  const regionId = getOwnedRegionIds(state.regions, neighbor).find((id) => isAdjacentToOwner(id, state.regions, state.playerNationId));
  return { neighbor, regionId };
};
const rebelUnit = (id, regionId, extra = {}) => ({
  id, regionId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', strength: 50, maxStrength: 50,
  morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], spawnedTurn: 0, ...extra
});

describe('S2: civil wars no longer end by themselves', () => {
  it('insurgent armies survive the unrest phase in calm provinces', () => {
    let state = fresh();
    const started = startCivilWar(state.regions, state.units, P, 1000, createRng(1), state.turnNumber);
    state = { ...state, regions: started.regions, units: started.units, nations: { ...state.nations, [P]: { ...state.nations[P], civilWar: started.civilWar } } };
    const before = Object.values(state.units).filter((u) => u.isInsurgent).length;
    const next = resolveTurn(state);
    expect(Object.values(next.units).filter((u) => u.isInsurgent).length).toBeGreaterThanOrEqual(before);
    expect(next.nations[P].civilWar?.active).toBe(true);
  });

  it('never overwrites a foreign occupation when it starts', () => {
    const state = fresh();
    const regions = { ...state.regions };
    getOwnedRegionIds(regions, P).forEach((id) => { regions[id] = { ...regions[id], occupiedBy: R }; });
    expect(startCivilWar(regions, state.units, P, 1000, createRng(1), 1)).toBeNull();
  });

  it('an AI nation grinds its insurgents down (its civil war can end without a player action)', () => {
    const state = fresh();
    const aiId = R;
    const started = startCivilWar(state.regions, state.units, aiId, 1000, createRng(2), 1);
    // Give the AI a big loyal army so suppression is near its max chance.
    const units = { ...started.units };
    getOwnedRegionIds(state.regions, aiId).slice(0, 5).forEach((regionId, i) => {
      units[`loyal_${i}`] = { id: `loyal_${i}`, regionId, ownerId: aiId, domain: 'land', classId: 'infantry', strength: 100000, maxStrength: 100000, morale: 100 };
    });
    let regions = started.regions;
    let unitsNow = units;
    let nation = { ...state.nations[aiId], civilWar: started.civilWar };
    const rng = createRng(9);
    let result = null;
    for (let turn = 2; turn < 60 && nation.civilWar; turn++) {
      result = processCivilWarTurn(state, regions, unitsNow, nation, aiId, rng, turn);
      regions = result.regions; unitsNow = result.units; nation = result.nation;
    }
    expect(result.result).toBe('crushed');
  });

  it('insurgents spread, so an unopposed civil war can actually be lost', () => {
    const state = { ...fresh(), regions: addCities(fresh(), P, 3).state.regions };
    const started = startCivilWar(state.regions, state.units, P, 1000, createRng(3), 1);
    let regions = started.regions;
    let units = started.units;
    let nation = { ...state.nations[P], civilWar: started.civilWar };
    const rng = createRng(5);
    let outcome = 'ongoing';
    for (let turn = 2; turn < 200 && outcome === 'ongoing'; turn++) {
      const r = processCivilWarTurn(state, regions, units, nation, P, rng, turn);
      regions = r.regions; units = r.units; nation = r.nation; outcome = r.result;
    }
    expect(outcome).toBe('lost');
    expect(Object.values(units).some((u) => u.isInsurgent && regions[u.regionId]?.owner === P)).toBe(false);
  });
});

describe('S5: Settle/Colonize only takes land nobody governs', () => {
  it("refuses a living nation's low-control province that isn't rebel-held", () => {
    const base = fresh();
    const { regionId } = borderRegion(base);
    const state = { ...base, regions: { ...base.regions, [regionId]: { ...base.regions[regionId], control: 5 } } };
    const next = gameReducer(state, A('SETTLE_COLONIZE', { regionId }));
    expect(next.regions[regionId].owner).not.toBe(P);
  });

  it("refuses an ally's province even when rebels hold it", () => {
    const base = fresh();
    const { neighbor, regionId } = borderRegion(base);
    const state = {
      ...base,
      nations: { ...base.nations, [neighbor]: { ...base.nations[neighbor], hasMilitaryPact: true } },
      regions: { ...base.regions, [regionId]: { ...base.regions[regionId], control: 5 } },
      units: { ...base.units, r1: rebelUnit('r1', regionId) }
    };
    expect(gameReducer(state, A('SETTLE_COLONIZE', { regionId })).regions[regionId].owner).toBe(neighbor);
  });

  it('settles a rebel-held province, clears the rebels, and angers the owner', () => {
    const base = fresh();
    const { neighbor, regionId } = borderRegion(base);
    const state = {
      ...base,
      regions: { ...base.regions, [regionId]: { ...base.regions[regionId], control: 5 } },
      units: { ...base.units, r1: rebelUnit('r1', regionId) }
    };
    const next = gameReducer(state, A('SETTLE_COLONIZE', { regionId }));
    expect(next.regions[regionId].owner).toBe(P);
    expect(next.units.r1).toBeUndefined();
    expect(next.nations[neighbor].hostility).toBeGreaterThan(state.nations[neighbor].hostility);
  });
});

describe('S6: loan ids are unique and repaying removes exactly one loan', () => {
  it('repay-then-borrow never produces a duplicate id', () => {
    const base = fresh();
    let state = { ...base, techTree: { ...base.techTree, economy_banking_houses: { ...base.techTree.economy_banking_houses, researched: true } }, resources: { ...base.resources, gold: 100000 } };
    state = gameReducer(state, A('REQUEST_LOAN'));
    state = gameReducer(state, A('REQUEST_LOAN'));
    state = gameReducer(state, A('REPAY_LOAN', { loanId: state.nations[P].loans[0].id }));
    state = gameReducer(state, A('REQUEST_LOAN'));
    const ids = state.nations[P].loans.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a legacy save holding two loans with the same id only loses one on repay', () => {
    const base = fresh();
    const loan = { id: 'loan_1_1', principal: 100, interestRate: 0.05, takenTurn: 1 };
    const state = { ...base, resources: { ...base.resources, gold: 1000 }, nations: { ...base.nations, [P]: { ...base.nations[P], loans: [loan, { ...loan }] } } };
    const next = gameReducer(state, A('REPAY_LOAN', { loanId: 'loan_1_1' }));
    expect(next.nations[P].loans).toHaveLength(1);
    expect(next.resources.gold).toBe(900);
  });
});

describe('S7: a successful revolt never hands land to a dead nation or leaves it occupied', () => {
  it('revives the eliminated former owner and clears occupiedBy', () => {
    const base = addCity(fresh(), P).state;
    const [formerOwner, occupier] = [R, R2];
    const regionId = getOwnedRegionIds(base.regions, P).find((id) => id !== base.nations[P].capitalRegionId);
    const state = {
      ...base,
      nations: { ...base.nations, [formerOwner]: { ...base.nations[formerOwner], isEliminated: true } },
      regions: { ...base.regions, [regionId]: { ...base.regions[regionId], formerOwner, occupiedBy: occupier, unrest: 100, control: 5 } },
      units: { ...base.units, r1: rebelUnit('r1', regionId, { spawnedTurn: -10 }) }
    };
    const next = resolveTurn(state);
    expect(next.regions[regionId].owner).toBe(formerOwner);
    expect(next.regions[regionId].occupiedBy).toBeUndefined();
    expect(next.nations[formerOwner].isEliminated).toBe(false);
  });
});

describe('S8: event options you cannot afford', () => {
  const event = {
    id: 'test_event', title: 'Test', description: '',
    options: [{ label: 'Pay', effects: { gold: -100 } }, { label: 'Refuse', effects: { stability: -1 } }]
  };

  it('refuses an unaffordable option while another one is payable', () => {
    const base = fresh();
    const state = { ...base, resources: { ...base.resources, gold: 20 }, activeEventId: null };
    expect(getOptionShortfall(state.resources, event.options[0].effects)).toEqual(['gold']);
    const next = applyEventEffects(state, event, 0);
    expect(next.resources.gold).toBe(20);
    expect(lastLog(next)).toMatch(/can't afford/);
  });

  it('when nothing is affordable, pays what exists (never negative) at a stability cost', () => {
    const base = fresh();
    const allCost = { ...event, options: [{ label: 'Pay', effects: { gold: -100 } }, { label: 'Pay more', effects: { gold: -200 } }] };
    const state = { ...base, resources: { ...base.resources, gold: 20 } };
    const next = applyEventEffects(state, allCost, 0);
    expect(next.resources.gold).toBe(0);
    expect(next.nations[P].stability).toBe(Math.max(-3, (state.nations[P].stability || 0) - 1));
  });
});

describe('S9: achievements only count the player\'s own wars and treaties', () => {
  it('Three-Front War ignores AI-vs-AI wars', () => {
    const base = fresh();
    const aiIds = Object.keys(base.nations).filter((id) => id !== P).slice(0, 4);
    const nations = { ...base.nations };
    aiIds.forEach((id) => { nations[id] = { ...nations[id], isAtWar: true }; });
    const state = { ...base, nations, wars: [{ id: 'w1', active: true, aggressor: aiIds[0], enemy: aiIds[1] }, { id: 'w2', active: true, aggressor: aiIds[2], enemy: aiIds[3] }] };
    expect(ACHIEVEMENTS.three_front_war.check(state)).toBe(false);
  });

  it('Master Diplomat ignores AI-vs-AI peace treaties', () => {
    const base = fresh();
    const nations = { ...base.nations };
    Object.keys(nations).filter((id) => id !== P).slice(0, 5).forEach((id) => { nations[id] = { ...nations[id], hasPeaceTreaty: true }; });
    expect(ACHIEVEMENTS.master_diplomat.check({ ...base, nations })).toBe(false);
  });
});

describe('S14: occupied provinces', () => {
  it('Population Policy and Quell Unrest refuse an occupied province', () => {
    const base = fresh();
    const regionId = base.nations[P].capitalRegionId || getOwnedRegionIds(base.regions, P)[0];
    const state = { ...base, resources: { ...base.resources, gold: 5000, adm: 100 }, regions: { ...base.regions, [regionId]: { ...base.regions[regionId], occupiedBy: R, unrest: 50 } } };
    expect(gameReducer(state, A('POPULATION_POLICY', { regionId })).regions[regionId].currentPopulation).toBe(state.regions[regionId].currentPopulation);
    expect(gameReducer(state, A('QUELL_UNREST', { regionId })).regions[regionId].unrest).toBe(50);
  });
});

// INSURGENT_MARKER is part of civilWar.js's public surface; keep the import honest.
it('insurgent-held regions use the shared marker', () => expect(INSURGENT_MARKER).toBe('insurgents'));
