// src/engine/eraGoals.test.js
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { TECH_TREE } from '../data/techTree';
import { AGE_ORDER } from '../data/ages';
import { addCities } from './testWorld';
import { eraGoalProgress, playstyleValues, awardEraLegacy, payEraGoals, nextGoal } from './eraGoals';
import { ERA_LEGACY_TURNS, goalsForAge } from '../data/eraGoals';
import { getModifier } from './modifiers/sheet';
import { peoplesWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const FR_ID = PEOPLES_WORLD.playerNationId;

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = quiet(peoplesWorld({ seed: 3, age: 'bronze' })); // these tests score the Bronze Age
const withNation = (s, patch) => ({ ...s, nations: { ...s.nations, [FR_ID]: { ...s.nations[FR_ID], ...patch } } });
// Enough cities for the Bronze Expand goal.
const expandTarget = goalsForAge('bronze').find((g) => g.id === 'expand').target;
const grown = () => addCities(S, FR_ID, expandTarget - 1, { near: getNationCapital(FR_ID) }).state;

describe('era goals', () => {
  it('every age has 3 to 5 goals, and each reward grows with the age', () => {
    AGE_ORDER.forEach((age) => expect(goalsForAge(age).length).toBeGreaterThanOrEqual(3));
    AGE_ORDER.forEach((age) => expect(goalsForAge(age).length).toBeLessThanOrEqual(5));
    const n = (age) => goalsForAge(age).find((g) => g.id === 'expand').n;
    expect(n(AGE_ORDER[0])).toBe(10);
    expect(n(AGE_ORDER[1])).toBe(15);
    expect(goalsForAge(AGE_ORDER[1]).find((g) => g.id === 'expand').mods).toEqual({ 'national.hrMult': 0.15 });
    expect(goalsForAge(AGE_ORDER[0]).find((g) => g.id === 'science').mods['national.researchCost']).toBeLessThan(0);
  });

  it('counts battles won from the first turn of the age for the War goal', () => {
    const begun = payEraGoals(S, S.nations[FR_ID], 'bronze', 5).nation;
    expect(begun.eraGoals.bronze).toEqual({ met: [], wonFrom: 0 });
    const won = withNation(S, { ...begun, battleStats: { won: 3, lost: 0, taken: 0 } });
    expect(playstyleValues(won, FR_ID, 'bronze').war).toBe(3);
    expect(playstyleValues(withNation(S, { battleStats: { won: 3 } }), FR_ID, 'bronze').war).toBe(0); // no record yet: counts from now
  });

  it('reads the player\'s numbers and the age\'s goals', () => {
    const v = playstyleValues(S);
    expect(v.expand).toBe(1);
    expect(v.war).toBe(0);
    const p = eraGoalProgress(S);
    expect(p.goals.map((g) => g.id)).toEqual(goalsForAge('bronze').map((g) => g.id));
    expect(p.goals.every((g) => g.bonus && g.n > 0)).toBe(true);
    expect(p.met).toBe(0);
  });

  it('pays a goal once, the turn it is met: its reward, a decree and renown', () => {
    const s = grown();
    const r = payEraGoals(s, s.nations[FR_ID], 'bronze', 10);
    expect(r.paid.map((g) => g.id)).toContain('expand');
    expect(r.nation.eraGoals.bronze.met).toContain('expand');
    expect(r.nation.modifiers.some((m) => m.sourceId === 'bronze.expand' && m.expiresTurn === 10 + ERA_LEGACY_TURNS)).toBe(true);
    expect(r.nation.ruler.decreeLog.some((e) => e.deed === 'eraGoal')).toBe(true);
    expect(getModifier(withNation(s, r.nation), FR_ID, 'national.hrMult').total).toBeGreaterThanOrEqual(0.15);
    const again = payEraGoals(s, r.nation, 'bronze', 11);
    expect(again.paid).toEqual([]);
    expect(again.nation).toBe(r.nation);
    // A city lost later keeps the goal met.
    expect(eraGoalProgress(withNation(S, r.nation), 'bronze').goals.find((g) => g.id === 'expand').done).toBe(true);
  });

  it('scores the age: the era legacy for two goals met, once, and none otherwise', () => {
    const s = grown();
    const ready = withNation(s, { eraGoals: { bronze: { met: ['expand', 'wealth'], wonFrom: 0 } } });
    const r = awardEraLegacy(ready, ready.nations[FR_ID], 'bronze', 10);
    expect(r.nation.eraGoals.bronze.legacy).toBe(true);
    expect(r.log.message).toMatch(/Legacy of the/);
    const again = awardEraLegacy(ready, r.nation, 'bronze', 11);
    expect(again.nation).toBe(r.nation);
    expect(payEraGoals(ready, r.nation, 'bronze', 12).nation).toBe(r.nation); // a scored age pays nothing more
    const none = awardEraLegacy(S, S.nations[FR_ID], 'bronze', 10);
    expect(none.nation.eraGoals.bronze.legacy).toBe(false);
    expect(none.nation.modifiers || []).toEqual([]);
  });

  // KTD7: a nation's era goals are scored when its OWN research age advances.
  const bronze = Object.values(TECH_TREE).filter((t) => t.ageId === 'bronze').sort((x, y) => x.lineIndex - y.lineIndex || (x.id < y.id ? -1 : 1));
  const firsts = bronze.filter((t) => t.lineIndex === bronze[0].lineIndex).map((t) => t.id);
  const sixth = bronze.find((t) => t.lineIndex === bronze[0].lineIndex + 1).id;

  it('scores the age the player leaves when its research reaches the next one', () => {
    const { state: s4 } = addCities(S, FR_ID, 4, { near: getNationCapital(FR_ID) });
    const techTree = { ...s4.techTree };
    firsts.forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const eve = { ...s4, techTree, research: { current: sixth, queue: [], progress: {}, auto: false, lastCompleted: null }, resources: { ...s4.resources, techPoints: 100000 } };
    const next = resolveTurn(eve);
    expect(next.techAgeId).toBe('classical');
    expect(next.nations[FR_ID].eraGoals.bronze).toBeDefined();
    expect(next.nations[FR_ID].ageSince).toBe(eve.turnNumber + 1);
    expect(next.nations[FR_ID].freeLawChange).toBe(true); // rank 11: one free law change per age
    expect(next.logs.some((l) => /Legacy of the|no legacy/.test(l.message))).toBe(true);
    expect(next.logs.some((l) => /the first in the world/.test(l.message))).toBe(true);
  }, 30000);

  it('an AI nation scores its own age when it advances, while the player has not', () => {
    const ai = Object.keys(S.nations).sort().find((id) => id !== FR_ID && S.nations[id].economy && S.nations[id].kind !== 'independent');
    const n = S.nations[ai];
    const eve = { ...S, nations: { ...S.nations, [ai]: { ...n, tech: { researched: firsts, ageId: 'bronze' }, research: { current: sixth, queue: [], progress: {}, auto: true, lastCompleted: null }, economy: { ...n.economy, techPoints: 100000 } } } };
    let s = eve;
    for (let t = 0; t < 4 && !s.nations[ai].eraGoals?.bronze; t++) s = resolveTurn(s);
    expect(s.nations[ai].tech.ageId).toBe('classical');
    expect(s.nations[ai].eraGoals.bronze).toBeDefined();
    expect(s.techAgeId).toBe('bronze');
    expect(s.nations[FR_ID].eraGoals?.bronze?.legacy).toBeUndefined(); // begun, not scored
  }, 60000);
});

describe('nextGoal (the map chip)', () => {
  it('names the unmet goal closest to done, null when all are met', () => {
    const g = (id, value, target, done = false) => ({ id, value, target, done });
    expect(nextGoal({ goals: [g('expand', 1, 4), g('wealth', 6, 9), g('war', 2, 2, true)] }).id).toBe('wealth');
    expect(nextGoal({ goals: [g('expand', 4, 4, true)] })).toBeNull();
  });
});
