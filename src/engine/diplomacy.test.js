import { describe, it, expect } from 'vitest';
import {
  declareWar, assignDefaultWarGoal, buildWarGoal, checkWarGoal, hasCasusBelli, isWarBetween, isAtWarWithPlayer, resolveWarProgress,
  isInTruce, setTruce, getTradePactCapacity, recordBattle, getOccupationScore, updateTickScore, computeWarScore, refreshWarFlags,
  CONVERGE_MIN_TURNS, warActivity, isStalemate, WAR_STALEMATE_IDLE_TURNS, WAR_STALEMATE_MIN_TURNS
} from './diplomacy';
import { getNationCapital } from '../data/regions';
import { addCity } from './testWorld';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 1 });
const US_ID = PEOPLES_WORLD.playerNationId;
const CA_ID = rivalOf(PEOPLES_WORLD, 0);
const MX_ID = rivalOf(PEOPLES_WORLD, 1);
const DE_ID = rivalOf(PEOPLES_WORLD, 2);
const EG_ID = rivalOf(PEOPLES_WORLD, 3);
const PS_ID = rivalOf(PEOPLES_WORLD, 4);

// A nation now spans many real provinces, not one region matching its own id — these tests use
// each nation's capital as "its" region wherever the old one-region-per-nation model used the
// nation id directly as a region id.
const cap = getNationCapital;

const alwaysRolls = { next: () => 0 };       // guarantees any probability check < 1 succeeds
const neverRolls = { next: () => 0.999999 }; // guarantees any realistic probability check fails

// Player is the US; Canada (CA_ID) and Mexico (MX_ID) are its real bordering nations.
// These tests exercise the compatibility policy for saves predating real AI economies.
// Current campaigns use real armies, covered by aiOperations and campaignAudit.
// Every nation starts with a garrison in its capital on the tile world; these legacy capture-roll
// tests want undefended capitals, so the starting units go. Canada gets a second city so a lost
// capital has somewhere to move to.
const usState = () => {const s=addCity(neighbourWorld({ seed: 1 }),CA_ID).state;s.units={};for(const n of Object.values(s.nations))if(!n.isPlayer)n.economy=undefined;return s;};

describe('assignDefaultWarGoal', () => {
  it('gives the player a capture_region goal against a nation with a bordering region', () => {
    const state = usState();
    const goal = assignDefaultWarGoal(state, CA_ID, US_ID);
    expect(goal.type).toBe('capture_region');
    expect(state.regions[goal.regionId].owner).toBe(CA_ID);
  });

  it('falls back to destroy_military for the player when the nation has no bordering region', () => {
    const state = usState();
    const regions = { ...state.regions };
    Object.keys(regions).forEach(id => { regions[id] = { ...regions[id], owner: 'nobody' }; });
    const goal = assignDefaultWarGoal({ ...state, regions }, CA_ID, US_ID);
    expect(goal.type).toBe('destroy_military');
    expect(goal.threshold).toBeLessThan(state.nations[CA_ID].militaryStrength);
  });

  it('gives a blitz/opportunist AI aggressor a capture_region goal when a target exists', () => {
    const state = usState();
    const aggressorId = CA_ID; // Mexico City is too far from Washington to border it at the Dawn start
    const withDoctrine = { ...state, nations: { ...state.nations, [aggressorId]: { ...state.nations[aggressorId], doctrine: 'blitz' } } };
    const goal = assignDefaultWarGoal(withDoctrine, US_ID, aggressorId);
    expect(goal.type).toBe('capture_region');
    expect(state.regions[goal.regionId].owner).toBe(US_ID);
  });

  it('gives an attrition/cautious AI aggressor a destroy_military goal', () => {
    const state = usState();
    const aggressorId = MX_ID;
    const withDoctrine = { ...state, nations: { ...state.nations, [aggressorId]: { ...state.nations[aggressorId], doctrine: 'cautious' } } };
    const goal = assignDefaultWarGoal(withDoctrine, US_ID, aggressorId);
    expect(goal.type).toBe('destroy_military');
  });
});

describe('buildWarGoal', () => {
  it('falls back to destroy_military when capture_region is requested but no target exists', () => {
    const state = usState();
    const regions = { ...state.regions };
    Object.keys(regions).forEach(id => { regions[id] = { ...regions[id], owner: 'nobody' }; });
    const goal = buildWarGoal({ ...state, regions }, CA_ID, US_ID, 'capture_region');
    expect(goal.type).toBe('destroy_military');
  });
});

describe('checkWarGoal', () => {
  it('capture_region: true once the aggressor actually occupies the target region (plan §M13: occupiedBy, not owner)', () => {
    const state = usState();
    const war = { active: true, aggressor: US_ID, enemy: CA_ID, goal: { type: 'capture_region', regionId: cap(CA_ID) } };
    expect(checkWarGoal(war, state)).toBe(false);
    const occupied = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    expect(checkWarGoal(war, occupied)).toBe(true);
  });

  it('destroy_military: true once the enemy nation\'s strength drops to the threshold', () => {
    const state = usState();
    const war = { active: true, aggressor: US_ID, enemy: CA_ID, goal: { type: 'destroy_military', threshold: 5000 } };
    expect(checkWarGoal(war, state)).toBe(false);
    const weakened = { ...state, nations: { ...state.nations, [CA_ID]: { ...state.nations[CA_ID], militaryStrength: 4000 } } };
    expect(checkWarGoal(war, weakened)).toBe(true);
  });

  it('returns false for a war with no goal, an already-achieved goal, or an inactive war', () => {
    const state = usState();
    expect(checkWarGoal({ active: true, goal: null }, state)).toBe(false);
    expect(checkWarGoal({ active: true, goal: { type: 'destroy_military', threshold: 999999999 }, goalAchieved: true, aggressor: US_ID, enemy: CA_ID }, state)).toBe(false);
    expect(checkWarGoal({ active: false, goal: { type: 'destroy_military', threshold: 999999999 }, aggressor: US_ID, enemy: CA_ID }, state)).toBe(false);
  });
});

describe('declareWar', () => {
  it('auto-assigns a goal and records the aggressor', () => {
    const state = usState();
    const next = declareWar(state, CA_ID, { aggressor: US_ID });
    const war = next.wars.find(w => w.enemy === CA_ID);
    expect(war.aggressor).toBe(US_ID);
    expect(war.goal).toBeTruthy();
    expect(war.goalAchieved).toBe(false);
  });

  it('records an explicit aggressor for an AI-initiated declaration', () => {
    const state = usState();
    const next = declareWar(state, US_ID, { aggressor: CA_ID });
    const war = next.wars.find(w => w.enemy === US_ID);
    expect(war.aggressor).toBe(CA_ID);
  });

  it('uses an explicitly-supplied goal instead of auto-assigning one', () => {
    const state = usState();
    const goal = { type: 'destroy_military', threshold: 1 };
    const next = declareWar(state, CA_ID, { aggressor: US_ID, goal });
    expect(next.wars.find(w => w.enemy === CA_ID).goal).toEqual(goal);
  });

  it('is a no-op when the nation is already at war', () => {
    const state = usState();
    const atWar = declareWar(state, CA_ID, { aggressor: US_ID });
    expect(declareWar(atWar, CA_ID, { aggressor: US_ID })).toBe(atWar);
  });

  it('lets a nation already fighting someone else be attacked — a second front, with its own war record', () => {
    const state = usState();
    const busy = declareWar(state, CA_ID, { aggressor: MX_ID });
    expect(busy.nations[CA_ID].isAtWar).toBe(true);
    const next = declareWar(busy, CA_ID, { aggressor: US_ID });
    expect(next).not.toBe(busy);
    const live = next.wars.filter((w) => w.active && w.enemy === CA_ID);
    expect(live.map((w) => w.aggressor).sort()).toEqual([MX_ID, US_ID]);
    expect(new Set(live.map((w) => w.id)).size).toBe(2); // same target, same year — distinct ids
    expect(isAtWarWithPlayer(next, CA_ID)).toBe(true);
  });

  it('refuses a nation declaring war on itself', () => {
    const state = usState();
    expect(declareWar(state, US_ID, { aggressor: US_ID })).toBe(state);
  });

  it('a claim on a city of the target justifies the war, names it as the goal and stays until the city is taken', () => {
    const state = usState();
    const caCity = Object.values(state.regions).find((r) => r.owner === CA_ID).id;
    const mxCity = Object.values(state.regions).find((r) => r.owner === MX_ID).id;
    const withClaims = { ...state, nations: { ...state.nations, [US_ID]: { ...state.nations[US_ID], claims: [caCity, mxCity] } } };
    const next = declareWar(withClaims, CA_ID, { aggressor: US_ID });
    const war = next.wars[next.wars.length - 1];
    expect(war.cb).toBe('claim');
    expect(war.goal).toEqual({ type: 'capture_region', regionId: caCity });
    expect(next.nations[US_ID].claims).toEqual([caCity, mxCity]);
  });

  it('marks the aggressor isAtWar too, not just the target — every isAtWar reader in the codebase means "a belligerent", not "the defender"', () => {
    const state = usState();
    const next = declareWar(state, CA_ID, { aggressor: US_ID });
    expect(next.nations[US_ID].isAtWar).toBe(true);
    expect(next.nations[CA_ID].isAtWar).toBe(true);
  });
});

describe('hasCasusBelli', () => {
  it('is true when the aggressor holds a claim on a city of the target', () => {
    const state = usState();
    const caCity = Object.values(state.regions).find((r) => r.owner === CA_ID).id;
    const withClaim = { ...state, nations: { ...state.nations, [US_ID]: { ...state.nations[US_ID], claims: [caCity] } } };
    expect(hasCasusBelli(withClaim, US_ID, CA_ID)).toBe(true);
  });

  it('is true when the target is already sufficiently hostile, with no claim needed', () => {
    const state = usState();
    const hostile = { ...state, nations: { ...state.nations, [CA_ID]: { ...state.nations[CA_ID], hostility: 90 } } };
    expect(hasCasusBelli(hostile, US_ID, CA_ID)).toBe(true);
  });

  it('is false with neither a claim nor sufficient hostility', () => {
    const state = usState();
    const calm = { ...state, nations: { ...state.nations, [CA_ID]: { ...state.nations[CA_ID], hostility: 10 } } };
    expect(hasCasusBelli(calm, US_ID, CA_ID)).toBe(false);
  });
});

describe('isWarBetween', () => {
  it('matches regardless of which id is the aggressor and which is the enemy', () => {
    const war = { aggressor: CA_ID, enemy: US_ID };
    expect(isWarBetween(war, US_ID, CA_ID)).toBe(true);
    expect(isWarBetween(war, CA_ID, US_ID)).toBe(true);
  });

  it('does not match a war between two unrelated nations', () => {
    const war = { aggressor: CA_ID, enemy: US_ID };
    expect(isWarBetween(war, MX_ID, US_ID)).toBe(false);
  });
});

describe('isAtWarWithPlayer', () => {
  // Regression: nation.isAtWar means "in a war with ANYONE" (used for AI-tiering), and several UI
  // surfaces were reading it as "at war with the player" — so two AI nations fighting each other
  // showed up as if they'd declared war on you (map coloring, the Military/Diplomacy tabs' war
  // lists and badges). isAtWarWithPlayer is the one function all of those must use instead.
  const stateWith = (wars, playerNationId = US_ID) => ({ playerNationId, wars });

  it('is true when the player is a side of an active war', () => {
    const state = stateWith([{ aggressor: DE_ID, enemy: US_ID, active: true }]);
    expect(isAtWarWithPlayer(state, DE_ID)).toBe(true);
  });

  it('is false for a war between two other nations, even though both are isAtWar', () => {
    const state = stateWith([{ aggressor: EG_ID, enemy: PS_ID, active: true }]);
    expect(isAtWarWithPlayer(state, EG_ID)).toBe(false);
    expect(isAtWarWithPlayer(state, PS_ID)).toBe(false);
  });

  it('is false once the war against the player is no longer active', () => {
    const state = stateWith([{ aggressor: DE_ID, enemy: US_ID, active: false }]);
    expect(isAtWarWithPlayer(state, DE_ID)).toBe(false);
  });
});

describe('recordBattle (plan §M13)', () => {
  const war = { aggressor: US_ID, enemy: CA_ID, battleScore: 0 };

  it('moves battleScore toward the aggressor when the aggressor wins', () => {
    expect(recordBattle(war, US_ID, 0.5)).toBeGreaterThan(0);
  });

  it('moves battleScore toward the enemy when the enemy wins', () => {
    expect(recordBattle(war, CA_ID, 0.5)).toBeLessThan(0);
  });

  it('clamps at +/-40', () => {
    expect(recordBattle({ ...war, battleScore: 39 }, US_ID, 1)).toBe(40);
    expect(recordBattle({ ...war, battleScore: -39 }, CA_ID, 1)).toBe(-40);
  });

  it('scales magnitude up with a bigger lossShare', () => {
    expect(recordBattle(war, US_ID, 1)).toBeGreaterThan(recordBattle(war, US_ID, 0));
  });
});

describe('getOccupationScore (plan §M13)', () => {
  it('is 0 with no occupation either way', () => {
    const state = usState();
    expect(getOccupationScore(state, { aggressor: US_ID, enemy: CA_ID })).toBe(0);
  });

  it('is positive when the aggressor occupies enemy territory', () => {
    const state = usState();
    const occupied = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    expect(getOccupationScore(occupied, { aggressor: US_ID, enemy: CA_ID })).toBeGreaterThan(0);
  });

  it('is negative when the enemy occupies aggressor territory', () => {
    const state = usState();
    const occupied = { ...state, regions: { ...state.regions, [cap(US_ID)]: { ...state.regions[cap(US_ID)], occupiedBy: CA_ID } } };
    expect(getOccupationScore(occupied, { aggressor: US_ID, enemy: CA_ID })).toBeLessThan(0);
  });
});

describe('updateTickScore (plan §M13)', () => {
  it('ticks up while the aggressor holds a capture_region goal', () => {
    const state = usState();
    const war = { aggressor: US_ID, enemy: CA_ID, tickScore: 0, startTurn: state.turnNumber, goal: { type: 'capture_region', regionId: cap(CA_ID) } };
    const occupied = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    expect(updateTickScore(war, occupied)).toBe(1);
  });

  it('does not tick down before the grace period elapses', () => {
    const state = usState();
    const war = { aggressor: US_ID, enemy: CA_ID, tickScore: 0, startTurn: state.turnNumber, goal: { type: 'capture_region', regionId: cap(CA_ID) } };
    expect(updateTickScore(war, state)).toBe(0);
  });

  it('ticks down once the grace period elapses without holding the goal', () => {
    const state = usState();
    const war = { aggressor: US_ID, enemy: CA_ID, tickScore: 0, startTurn: state.turnNumber - 5, goal: { type: 'capture_region', regionId: cap(CA_ID) } };
    expect(updateTickScore(war, state)).toBe(-1);
  });

  it('stays at 0 for a destroy_military goal (no ticking territory to hold)', () => {
    const state = usState();
    const war = { aggressor: US_ID, enemy: CA_ID, tickScore: 0, startTurn: state.turnNumber, goal: { type: 'destroy_military', threshold: 1 } };
    expect(updateTickScore(war, state)).toBe(0);
  });
});

describe('computeWarScore (plan §M13)', () => {
  it('sums battle and tick components, clamped to +/-100', () => {
    const state = usState();
    const war = { aggressor: US_ID, enemy: CA_ID, battleScore: 40, tickScore: 25 };
    expect(computeWarScore(war, state)).toBe(65);
  });

  it('never exceeds the +/-100 clamp even with a large occupation component', () => {
    const state = usState();
    const war = { aggressor: US_ID, enemy: CA_ID, battleScore: 40, tickScore: 25 };
    const occupied = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: US_ID } } };
    const score = computeWarScore(war, occupied);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(65);
  });
});

describe('resolveWarProgress (Task 32 + plan §M13: occupation, war score, and the peace machinery)', () => {
  // Mexico (MX_ID) is AI-declaring war on Canada (CA_ID) here — neither is the player (US_ID) — so
  // this exercises the pure AI-vs-AI path. Separate describes below exercise AI-vs-player.
  const aiWarState = (overrides = {}) => {
    const base = usState();
    // Inflates every ca region OTHER than its capital to a huge development value, so a single
    // capital capture's tripled occupation weight (getOccupationScore's own capital bonus) stays a
    // small fraction of ca's total dev — keeping these capture-mechanics tests decoupled from
    // whether the resulting occupation score happens to cross the AI-vs-AI peace threshold on real
    // Canada geography. The peace-machinery describe below tests that threshold directly instead.
    const capId = cap(CA_ID);
    const regions = { ...base.regions };
    Object.keys(regions).forEach((id) => {
      if (regions[id].owner === CA_ID && id !== capId) regions[id] = { ...regions[id], dev: { tax: 1000, production: 1000, manpower: 1000 } };
    });
    const state = { ...base, regions };
    const war = {
      id: 'war_1', aggressor: MX_ID, enemy: CA_ID, active: true, goalAchieved: false,
      startYear: state.year, startTurn: state.turnNumber, cb: 'none',
      battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0,
      ...overrides
    };
    return { state: { ...state, wars: [war] }, war };
  };

  it('runs no capture roll for a war the player started, but still keeps its score bookkeeping', () => {
    const state = usState();
    const war = {
      id: 'war_1', aggressor: US_ID, enemy: CA_ID, active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
      cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: cap(CA_ID) }
    };
    const withWar = { ...state, wars: [war] };
    const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, alwaysRolls);
    expect(result.wars[0]).toEqual(war); // nothing moved: no capture roll, no attrition, score stays 0
    expect(result.regions).toBe(withWar.regions);
    expect(result.nations).toBe(withWar.nations);
  });

  it('two worn AI nations at a stalemate sign a white peace once both would accept it (bargaining model)', () => {
    const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 } });
    const turn = 40; // a multiple of CONVERGE_PERIOD, CONVERGE_MIN_TURNS after the start
    const worn = { ...state, turnNumber: turn, wars: state.wars.map((w) => ({ ...w, startTurn: turn - CONVERGE_MIN_TURNS - 5 })),
      nations: { ...state.nations, [MX_ID]: { ...state.nations[MX_ID], economy: { gold: 0 }, warExhaustion: 70 }, [CA_ID]: { ...state.nations[CA_ID], economy: { gold: 0 }, warExhaustion: 70 } } };
    const result = resolveWarProgress(worn, worn.regions, worn.nations, worn.wars, neverRolls);
    expect(result.wars[0].active).toBe(false);
    // Fresh and still fighting (a battle last turn, so not a stalemate either: CB09): the war goes on.
    const fresh = { ...worn, wars: worn.wars.map((w) => ({ ...w, lastActiveTurn: turn - 1 })), nations: { ...worn.nations, [MX_ID]: { ...worn.nations[MX_ID], warExhaustion: 0 }, [CA_ID]: { ...worn.nations[CA_ID], warExhaustion: 0 } } };
    expect(resolveWarProgress(fresh, fresh.regions, fresh.nations, fresh.wars, neverRolls).wars[0].active).toBe(true);
  });

  it('leaves an inactive war untouched', () => {
    const { state, war } = aiWarState({ active: false, goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.wars[0]).toEqual(war);
  });

  it('applies mutual military attrition to both belligerents every turn the war runs', () => {
    const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 } });
    const before = { [MX_ID]: state.nations[MX_ID].militaryStrength, [CA_ID]: state.nations[CA_ID].militaryStrength };
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.nations[MX_ID].militaryStrength).toBeLessThan(before[MX_ID]);
    expect(result.nations[CA_ID].militaryStrength).toBeLessThan(before[CA_ID]);
  });

  it('conquers the goal region outright when the capture roll succeeds (AI vs AI)', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    const r = result.regions[cap(CA_ID)];
    expect(r.owner).toBe(MX_ID); // conquest: the land changes hands in battle
    expect(r.occupiedBy).toBeUndefined();
    expect(r.conquest).toMatchObject({ warId: 'war_1', from: CA_ID, capital: true });
    expect(r.control).toBe(25);
    // Their capital fell, so it moved to their richest remaining province.
    expect(result.nations[CA_ID].capitalRegionId).not.toBe(cap(CA_ID));
    expect(result.regions[result.nations[CA_ID].capitalRegionId].owner).toBe(CA_ID);
  });

  it('an AI can conquer the PLAYER\'S region, exactly like any other nation', () => {
    const state = usState();
    const war = {
      id: 'war_1', aggressor: CA_ID, enemy: US_ID, active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
      cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'capture_region', regionId: cap(US_ID) }
    };
    const withWar = { ...state, wars: [war] };
    const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, alwaysRolls);
    expect(result.regions[cap(US_ID)].owner).toBe(CA_ID);
    expect(result.regions[cap(US_ID)].conquest?.from).toBe(US_ID);
  });

  it('records the capture as a battle, moving battleScore toward the taker', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.wars[0].battleScore).toBeGreaterThan(0);
  });

  it('does not occupy the region when the roll fails, and the war stays active', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.regions[cap(CA_ID)].owner).toBe(CA_ID);
    expect(result.wars[0].active).toBe(true);
  });

  it('does not roll a capture once the target region already changed hands some other way', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const alreadyLost = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], owner: US_ID } } };
    const result = resolveWarProgress(alreadyLost, alreadyLost.regions, alreadyLost.nations, alreadyLost.wars, alwaysRolls);
    expect(result.regions[cap(CA_ID)].owner).toBe(US_ID); // unchanged by this war
  });

  it('does not re-roll once the aggressor already occupies the target region', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const alreadyOccupied = { ...state, regions: { ...state.regions, [cap(CA_ID)]: { ...state.regions[cap(CA_ID)], occupiedBy: MX_ID } } };
    const result = resolveWarProgress(alreadyOccupied, alreadyOccupied.regions, alreadyOccupied.nations, alreadyOccupied.wars, alwaysRolls);
    expect(result.regions[cap(CA_ID)].occupiedBy).toBe(MX_ID);
  });

  it('sets goalAchieved (without ending the war outright) once a destroy_military goal is met', () => {
    const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 999999999 } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
    expect(result.wars[0].goalAchieved).toBe(true);
    expect(result.wars[0].battleScore).toBe(40); // a crushed military counts as a maximally decisive battle
  });

  it('accrues Aggressive Expansion when land is conquered, just as when it is ceded at peace', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    expect(result.nations[CA_ID].ae?.[MX_ID] || 0).toBeGreaterThan(0);
  });

  it('keeps scoring land conquered in a war until the peace, then stops', () => {
    const { state } = aiWarState({ goal: { type: 'capture_region', regionId: cap(CA_ID) } });
    const conquered = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
    const later = { ...state, regions: conquered.regions, nations: conquered.nations, wars: conquered.wars };
    expect(getOccupationScore(later, conquered.wars[0])).toBeGreaterThan(0);
    expect(getOccupationScore(later, { ...conquered.wars[0], id: 'another_war' })).toBe(0);
  });

  describe('the peace machinery (plan §M13)', () => {
    it('ends a war in white peace once both sides are sufficiently war-exhausted', () => {
      const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 } });
      const exhausted = {
        ...state,
        nations: { ...state.nations, [MX_ID]: { ...state.nations[MX_ID], warExhaustion: 85 }, [CA_ID]: { ...state.nations[CA_ID], warExhaustion: 85 } }
      };
      const result = resolveWarProgress(exhausted, exhausted.regions, exhausted.nations, exhausted.wars, neverRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.nations[MX_ID].truces[CA_ID]).toBe(state.turnNumber + 10);
    });

    it('never signs the player up to a white peace: an exhausted AI enemy offers it instead', () => {
      const state = usState();
      const war = {
        id: 'war_1', aggressor: CA_ID, enemy: US_ID, active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const exhausted = { ...state, wars: [war], nations: { ...state.nations, [US_ID]: { ...state.nations[US_ID], warExhaustion: 90 }, [CA_ID]: { ...state.nations[CA_ID], warExhaustion: 90 } } };
      const result = resolveWarProgress(exhausted, exhausted.regions, exhausted.nations, exhausted.wars, neverRolls);
      expect(result.wars[0].active).toBe(true);
      expect(result.pendingPeaceOffer).toEqual({ warId: 'war_1', from: CA_ID, terms: [], reason: 'exhaustion' });
      // after the player rejects, the offer doesn't come straight back
      const again = resolveWarProgress({ ...exhausted, wars: result.wars }, exhausted.regions, exhausted.nations, result.wars, neverRolls);
      expect(again.pendingPeaceOffer).toBeNull();
      expect(again.wars[0].active).toBe(true);
    });

    // Lane CB09 (I121): a war with nothing happening ends as a stalemate, said as such.
    it('a war idle for WAR_STALEMATE_IDLE_TURNS: the AI offers the player a white peace for a stalemate', () => {
      const state = usState();
      const t = state.turnNumber;
      const war = {
        id: 'war_1', aggressor: CA_ID, enemy: US_ID, active: true, goalAchieved: false, startYear: state.year, startTurn: t - WAR_STALEMATE_MIN_TURNS,
        lastActiveTurn: t - WAR_STALEMATE_IDLE_TURNS, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const s = { ...state, wars: [war] };
      const result = resolveWarProgress(s, s.regions, s.nations, s.wars, neverRolls);
      expect(result.pendingPeaceOffer).toEqual({ warId: 'war_1', from: CA_ID, terms: [], reason: 'stalemate' });
      expect(result.logs.some((l) => /nothing to gain/.test(l.message))).toBe(true);
      // A battle fought lately (the battle score moved) keeps the war alive.
      const fought = { ...s, wars: [{ ...war, battleScore: 6, seenBattleScore: 0 }] };
      const r2 = resolveWarProgress(fought, fought.regions, fought.nations, fought.wars, neverRolls);
      expect(r2.pendingPeaceOffer).toBeNull();
      expect(r2.wars[0].lastActiveTurn).toBe(t);
    });

    it('an AI vs AI war idle for a long time does NOT end in a stalemate peace (user ruling, 14 Oct)', () => {
      const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 } });
      const t = state.turnNumber;
      const old = { ...state, turnNumber: t + 3, wars: [{ ...state.wars[0], startTurn: t - WAR_STALEMATE_MIN_TURNS - 3, lastActiveTurn: t - WAR_STALEMATE_IDLE_TURNS - 3 }] };
      const result = resolveWarProgress(old, old.regions, old.nations, old.wars, neverRolls);
      expect(result.wars[0].active).toBe(true);
    });

    it('warActivity: held land or a siege counts as activity; a quiet turn keeps the old mark', () => {
      const war = { aggressor: 'a', enemy: 'b', startTurn: 1, battleScore: 0 };
      const idx = (occupiedDev = {}, sieged = []) => ({ occupiedDev, sieged: new Set(sieged) });
      expect(warActivity(war, idx(), 30)).toBe(war); // quiet: unchanged (the start counts as the last activity)
      expect(warActivity(war, idx({ 'b|a': 3 }), 30).lastActiveTurn).toBe(30);
      expect(warActivity(war, idx({}, ['a|b']), 30).lastActiveTurn).toBe(30);
      expect(isStalemate({ startTurn: 1 }, 1 + WAR_STALEMATE_IDLE_TURNS)).toBe(false); // too young
      expect(isStalemate({ startTurn: 1, lastActiveTurn: 10 }, 10 + WAR_STALEMATE_IDLE_TURNS)).toBe(true);
    });

    it('concludes an AI-vs-AI war once the leading side is winning by enough and the loser\'s ledger accepts', () => {
      const { state } = aiWarState({ goal: { type: 'destroy_military', threshold: 1 }, battleScore: 95, goalAchieved: true });
      const result = resolveWarProgress(state, state.regions, state.nations, state.wars, neverRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.nations[MX_ID].truces[CA_ID]).toBe(state.turnNumber + 10);
      expect(result.nations[CA_ID].truces[MX_ID]).toBe(state.turnNumber + 10);
    });

    it('queues a pendingPeaceOffer for the player once an AI enemy is winning enough to demand terms', () => {
      const state = usState();
      const war = {
        id: 'war_1', aggressor: CA_ID, enemy: US_ID, active: true, goalAchieved: true, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 35, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const withWar = { ...state, wars: [war] };
      const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, neverRolls);
      expect(result.pendingPeaceOffer).toBeTruthy();
      expect(result.pendingPeaceOffer.from).toBe(CA_ID);
      expect(result.wars[0].active).toBe(true); // an offer, not an enforcement — the player still decides
    });

    it('enforces peace on the player outright once the AI is winning overwhelmingly', () => {
      const state = usState();
      const war = {
        id: 'war_1', aggressor: CA_ID, enemy: US_ID, active: true, goalAchieved: true, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 95, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const withWar = { ...state, wars: [war] };
      const result = resolveWarProgress(withWar, withWar.regions, withWar.nations, withWar.wars, neverRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.pendingPeaceOffer).toBeNull();
    });

    it('an unrelated AI-vs-AI war processed the same turn does not disturb the player\'s pending offer', () => {
      const state = usState();
      const warA = {
        id: 'war_a', aggressor: CA_ID, enemy: US_ID, active: true, goalAchieved: true, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 35, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const warB = {
        id: 'war_b', aggressor: MX_ID, enemy: DE_ID, active: true, goalAchieved: false, startYear: state.year, startTurn: state.turnNumber,
        cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 }
      };
      const withWars = { ...state, wars: [warA, warB] };
      const result = resolveWarProgress(withWars, withWars.regions, withWars.nations, withWars.wars, neverRolls);
      expect(result.pendingPeaceOffer.warId).toBe('war_a');
      expect(result.wars.find(w => w.id === 'war_b').active).toBe(true);
    });
  });

  describe('independence wars (plan §M12/§M15)', () => {
    const vassalWarState = (score) => {
      const base = usState();
      const state = {
        ...base,
        nations: {
          ...base.nations,
          [US_ID]: { ...base.nations[US_ID], vassalOf: CA_ID, isAtWar: true },
          [CA_ID]: { ...base.nations[CA_ID], vassals: [US_ID], isAtWar: true }
        }
      };
      const war = {
        id: 'war_1', aggressor: US_ID, enemy: CA_ID, active: true, goalAchieved: false,
        startYear: state.year, startTurn: state.turnNumber, cb: 'independence',
        battleScore: score, tickScore: 0, score, peaceOfferCooldownTurn: 0, goal: null
      };
      return { ...state, wars: [war] };
    };

    it('frees the vassal outright once it wins decisively, clearing vassalOf/vassals and setting a truce', () => {
      const state = vassalWarState(60);
      const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
      expect(result.wars[0].active).toBe(false);
      expect(result.nations[US_ID].vassalOf).toBeNull();
      expect(result.nations[CA_ID].vassals).not.toContain(US_ID);
      expect(result.nations[US_ID].isAtWar).toBe(false);
      expect(result.nations[CA_ID].isAtWar).toBe(false);
      expect(result.nations[US_ID].truces?.[CA_ID]).toBeGreaterThan(state.turnNumber);
    });

    it('falls through to the ordinary peace machinery short of the win-score threshold', () => {
      const state = vassalWarState(10);
      const result = resolveWarProgress(state, state.regions, state.nations, state.wars, alwaysRolls);
      expect(result.wars[0].active).toBe(true);
      expect(result.nations[US_ID].vassalOf).toBe(CA_ID);
    });
  });
});

describe('isInTruce / setTruce (plan §M12/M13)', () => {
  it('is false with no truce entry at all', () => {
    const state = usState();
    expect(isInTruce(state, US_ID, CA_ID)).toBe(false);
  });

  it('is true immediately after setTruce, on both sides', () => {
    const state = usState();
    const nations = setTruce(state.nations, US_ID, CA_ID, state.turnNumber);
    const withTruce = { ...state, nations };
    expect(isInTruce(withTruce, US_ID, CA_ID)).toBe(true);
    expect(isInTruce(withTruce, CA_ID, US_ID)).toBe(true);
  });

  it('expires after TRUCE_DURATION_TURNS turns', () => {
    const state = usState();
    const nations = setTruce(state.nations, US_ID, CA_ID, state.turnNumber);
    const later = { ...state, nations, turnNumber: state.turnNumber + 10 };
    expect(isInTruce(later, US_ID, CA_ID)).toBe(false);
  });

  it('is a no-op when either nation is missing', () => {
    const state = usState();
    expect(setTruce(state.nations, US_ID, 'ghost', state.turnNumber)).toBe(state.nations);
  });
});

describe('getTradePactCapacity (plan §M8.3/§M12)', () => {
  it('is the base capacity with a neutral identity', () => {
    expect(getTradePactCapacity({ identity: { globalism: 0 } })).toBe(1);
  });

  it('is +1 for a Globalist nation', () => {
    expect(getTradePactCapacity({ identity: { globalism: 50 } })).toBe(2);
  });

  it('is -1, floored at 0, for an Isolationist nation', () => {
    expect(getTradePactCapacity({ identity: { globalism: -50 } })).toBe(0);
  });
});

// Real live bug: aiEconomy.js's processAIEconomyTurn stripped `id` off every AI nation that
// "thought" each turn, so after a few turns most nations had no `id` — and every player diplomacy
// action (which looks its target up by `nation.id`) silently no-oped. Turn 1 always worked, which
// is why it slipped past tests that only ever acted on a fresh state.
describe('nation ids survive turn resolution (regression)', () => {
  it('every nation keeps an id matching its key, and player diplomacy still works, after several turns', async () => {
    const { gameReducer } = await import('./gameReducer');
    const { ActionTypes } = await import('../data/types');
    let state = usState();
    for (let i = 0; i < 4; i++) state = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });

    const mismatched = Object.entries(state.nations).filter(([key, n]) => n.id !== key);
    expect(mismatched).toEqual([]);

    const { claimableCities } = await import('./claims');
    const site = claimableCities(state, state.playerNationId)[0].city;
    const rich = { ...state, resources: { ...state.resources, gold: 10000, dip: 100 } };
    const next = gameReducer(rich, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: site.owner } });
    expect(next.nations[state.playerNationId].claimsInProgress.map((c) => c.cityId)).toContain(site.id);
  });
});

describe('refreshWarFlags', () => {
  it('keeps a nation at war while any of its wars is still live, and clears it once none are', () => {
    const nations = { a: { isAtWar: false }, b: { isAtWar: false }, c: { isAtWar: true }, d: { isAtWar: true } };
    const wars = [
      { id: 'w1', aggressor: 'a', enemy: 'b', active: false },
      { id: 'w2', aggressor: 'c', enemy: 'b', active: true }
    ];
    const next = refreshWarFlags(nations, wars);
    expect(next.a.isAtWar).toBe(false);
    expect(next.b.isAtWar).toBe(true);
    expect(next.c.isAtWar).toBe(true);
    expect(next.d.isAtWar).toBe(false);
    expect(next.c).toBe(nations.c); // untouched records keep their identity
    expect(refreshWarFlags(next, wars)).toBe(next);
    // Restricted to the named nations.
    expect(refreshWarFlags(nations, wars, ['a']).d.isAtWar).toBe(true);
  });
});
