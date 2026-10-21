import { describe, it, expect } from 'vitest';
import { endingSignal, finalGoalTechs, FINAL_GOAL_AGE_ID } from './ending';
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
