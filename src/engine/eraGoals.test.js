// src/engine/eraGoals.test.js
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { AGES } from '../data/ages';
import { addCities } from './testWorld';
import { eraGoalProgress, playstyleValues, awardEraLegacy } from './eraGoals';
import { ERA_LEGACY_TURNS, goalsForAge } from '../data/eraGoals';
import { getModifier } from './modifiers/sheet';
import { peoplesWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3 });
const FR_ID = PEOPLES_WORLD.playerNationId;

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = quiet(peoplesWorld({ seed: 3 }));

describe('era goals', () => {
  it('counts a kept conquest for the War goal after the conquest flag is gone (H-10)', () => {
    const { state: s2, cityIds: ids } = addCities(S, FR_ID, 2, { near: getNationCapital(FR_ID) });
    const regions = { ...s2.regions };
    ids.forEach((id) => { regions[id] = { ...regions[id], conquest: undefined, captureLog: [{ by: FR_ID, from: 'x', turn: s2.turnNumber }] }; });
    expect(playstyleValues({ ...s2, regions }).war).toBe(2);
    const old = { ...regions, [ids[0]]: { ...regions[ids[0]], captureLog: [{ by: FR_ID, from: 'x', turn: s2.turnNumber - 5000 }] } };
    expect(playstyleValues({ ...s2, regions: old }).war).toBe(1);
  });

  it('reads the player\'s numbers and the age\'s targets', () => {
    const v = playstyleValues(S);
    expect(v.expand).toBe(1);
    expect(v.war).toBe(0);
    const p = eraGoalProgress(S);
    expect(p.goals.map((g) => g.id)).toEqual(['expand', 'wealth', 'war', 'culture', 'science']);
    expect(p.goals.find((g) => g.id === 'expand').target).toBe(goalsForAge('bronze')[0].target);
    expect(p.met).toBe(0);
  });

  it('awards a legacy for two goals met, once, and none otherwise', () => {
    const { state: s4 } = addCities(S, FR_ID, 4, { near: getNationCapital(FR_ID) });
    const techTree = { ...s4.techTree };
    Object.keys(techTree).slice(0, 4).forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const ready = { ...s4, techTree };
    const p = eraGoalProgress(ready, 'bronze');
    expect(p.met).toBeGreaterThanOrEqual(2);
    const nation = ready.nations[FR_ID];
    const r = awardEraLegacy(ready, nation, 'bronze', 10);
    expect(r.nation.eraGoals.bronze.legacy).toBe(true);
    expect(r.nation.modifiers.some((m) => m.sourceType === 'eraGoal' && m.expiresTurn === 10 + ERA_LEGACY_TURNS)).toBe(true);
    expect(r.log.message).toMatch(/Legacy of the/);
    const again = awardEraLegacy(ready, r.nation, 'bronze', 11);
    expect(again.nation).toBe(r.nation);
    const none = awardEraLegacy(S, S.nations[FR_ID], 'bronze', 10);
    expect(none.nation.eraGoals.bronze.legacy).toBe(false);
    expect(none.nation.modifiers || []).toEqual([]);
    const withBonus = { ...ready, nations: { ...ready.nations, [FR_ID]: r.nation } };
    expect(getModifier(withBonus, FR_ID, 'national.popGrowthBonus').total).toBeGreaterThanOrEqual(0.1);
  });

  it('scores the ending age when the calendar turns', () => {
    const lastYear = AGES.classical.startYear - 1;
    const { state: s4 } = addCities(S, FR_ID, 4, { near: getNationCapital(FR_ID) });
    const techTree = { ...s4.techTree };
    Object.keys(techTree).slice(0, 4).forEach((id) => { techTree[id] = { ...techTree[id], researched: true }; });
    const eve = { ...s4, techTree, year: lastYear };
    const next = resolveTurn(eve);
    expect(next.age).toBe('classical');
    expect(next.nations[FR_ID].eraGoals.bronze).toBeDefined();
    expect(next.logs.some((l) => /Legacy of the|no legacy/.test(l.message))).toBe(true);
  }, 30000);
});
