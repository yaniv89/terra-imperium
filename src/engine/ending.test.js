import { describe, it, expect } from 'vitest';
import { endingSignal, finalGoalTechs, FINAL_GOAL_AGE_ID } from './ending';
import { AGES } from '../data/ages';
import { getTechsForAge } from '../data/techTree';

// Eight-ages plan U11 (KTD3): one ending signal, the turn limit or the Future's final goal.
const base = { playerNationId: 'p', gameSpeed: 'normal', turnNumber: 10, techTree: {}, nations: { p: { id: 'p' }, a: { id: 'a', tech: { researched: [] } }, b: { id: 'b', tech: { researched: [] } } } };
const goal = getTechsForAge('modern').map((t) => t.id); // a stand-in final goal until the Future age exists

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

  it('has no final goal while the Future age does not exist', () => {
    expect(AGES[FINAL_GOAL_AGE_ID]).toBeUndefined();
    expect(finalGoalTechs()).toEqual([]);
    const all = { ...base, nations: { ...base.nations, a: { id: 'a', tech: { researched: goal } } } };
    expect(endingSignal(all)).toBeNull();
  });
});
