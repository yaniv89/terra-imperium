import { describe, it, expect } from 'vitest';
import { endingSignal, finalGoalTechs, FINAL_GOAL_AGE_ID, dominanceMultipleX2, dominantNation, nextDominance, dominanceHold, DOMINANCE_HOLD } from './ending';
import { getTechsForAge, TECH_TREE } from '../data/techTree';

// Eight-ages plan U11 (KTD3): one ending signal, the turn limit or the Future's final goal.
const base = { playerNationId: 'p', gameSpeed: 'normal', turnNumber: 10, techTree: {}, nations: { p: { id: 'p' }, a: { id: 'a', tech: { researched: [] } }, b: { id: 'b', tech: { researched: [] } } } };
const goal = finalGoalTechs();

describe('endingSignal', () => {
  it('is null mid-game and turnLimit at exactly 923 on Normal', () => {
    expect(endingSignal(base)).toBeNull();
    expect(endingSignal({ ...base, turnNumber: 922 })).toBeNull();
    expect(endingSignal({ ...base, turnNumber: 923 })).toEqual({ reason: 'turnLimit' });
    expect(endingSignal({ ...base, gameSpeed: 'fast', turnNumber: 440 })).toEqual({ reason: 'turnLimit' });
  });

  it('fires futureGoal with the first nation (by id) that knows every goal tech', () => {
    const one = { ...base, nations: { ...base.nations, b: { id: 'b', tech: { researched: goal } } } };
    expect(endingSignal(one, { goalTechs: goal })).toEqual({ reason: 'futureGoal', nationId: 'b' });
    const almost = { ...base, nations: { ...base.nations, b: { id: 'b', tech: { researched: goal.slice(1) } } } };
    expect(endingSignal(almost, { goalTechs: goal })).toBeNull();
    const player = { ...base, techTree: Object.fromEntries(goal.map((id) => [id, { researched: true }])) };
    expect(endingSignal(player, { goalTechs: goal })).toEqual({ reason: 'futureGoal', nationId: 'p' });
  });

  it('the final goal is every Future tech with both robot techs, not the repeatable Future Tech (U64)', () => {
    expect(FINAL_GOAL_AGE_ID).toBe('future');
    expect(goal).toHaveLength(12);
    expect(goal).toEqual(expect.arrayContaining([...getTechsForAge('future').map((t) => t.id), 'military_autonomous_warfare', 'science_machine_consciousness']));
    expect(goal).not.toContain('governance_future_tech');
    expect(TECH_TREE.governance_future_tech.repeatable).toBe(true);
    const tenOnly = { ...base, nations: { ...base.nations, a: { id: 'a', tech: { researched: getTechsForAge('future').map((t) => t.id) } } } };
    expect(endingSignal(tenOnly)).toBeNull(); // the ten base techs are not enough
    const both = { ...base, nations: { ...base.nations, a: { id: 'a', tech: { researched: goal } }, b: { id: 'b', tech: { researched: goal } } } };
    expect(endingSignal(both)).toEqual({ reason: 'futureGoal', nationId: 'a' }); // the first nation only
  });
});

// The AoE and Civ report's rank 8: the Dominance end (Civ VII 1.4.0).
describe('dominance', () => {
  const goals = (n) => ({ stone: { met: Array.from({ length: n }, (_, i) => `g${i}`) } });
  const world = (turnNumber, a, b, extra = {}) => ({ ...base, turnNumber, nations: { p: { id: 'p', eraGoals: goals(extra.p ?? 0) }, a: { id: 'a', tech: { researched: [] }, eraGoals: goals(a) }, b: { id: 'b', tech: { researched: [] }, eraGoals: goals(b) } } });

  it('needs 6x from 40% of the turn limit, falling to 1.5x from 90%; integer steps', () => {
    expect(dominanceMultipleX2(369, 923)).toBeNull();
    expect(dominanceMultipleX2(370, 923)).toBe(12);
    expect(dominanceMultipleX2(831, 923)).toBe(3);
    expect(dominantNation(world(300, 12, 1))).toBeNull(); // too early
    expect(dominantNation(world(370, 6, 1))).toMatchObject({ nationId: 'a', multX2: 12 });
    expect(dominantNation(world(370, 5, 1))).toBeNull();
    expect(dominantNation(world(831, 3, 2))).toMatchObject({ nationId: 'a' }); // 1.5x late
    expect(dominantNation(world(831, 2, 2))).toBeNull(); // a tie never dominates
    expect(dominantNation(world(370, 0, 0))).toBeNull(); // nobody scored
  });

  it('a streak held DOMINANCE_HOLD reference turns ends the game for the leader; a new leader restarts it', () => {
    const s = world(370, 6, 1);
    const d = nextDominance(s);
    expect(d).toEqual({ nationId: 'a', since: 370 });
    const hold = dominanceHold(s, 'a');
    expect(hold).toBeGreaterThanOrEqual(DOMINANCE_HOLD);
    expect(nextDominance({ ...world(371, 6, 1), dominance: d })).toBe(d);
    expect(endingSignal({ ...world(370 + hold - 1, 6, 1), dominance: d })).toBeNull();
    expect(endingSignal({ ...world(370 + hold, 6, 1), dominance: d })).toEqual({ reason: 'dominance', nationId: 'a' });
    expect(nextDominance({ ...world(372, 1, 6), dominance: d })).toEqual({ nationId: 'b', since: 372 });
    expect(nextDominance({ ...world(372, 2, 1), dominance: d })).toBeNull();
  });
});
