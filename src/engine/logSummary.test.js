import { describe, it, expect } from 'vitest';
import { summarizeLogs, recurringRuleOf } from './logSummary';

const L = (year, message, type = 'action') => ({ year, message, type });

describe('summarizeLogs', () => {
  it('folds the per-turn upkeep line into one with a count and keeps the details', () => {
    const logs = [L(1, 'Upkeep: -10 (army 5)'), L(2, 'Something happened', 'event'), L(3, 'Upkeep: -12 (army 7)'), L(4, 'Upkeep: -9 (army 4)')];
    const out = summarizeLogs(logs);
    expect(out).toHaveLength(2);
    expect(out[0].message).toBe('Something happened');
    expect(out[1].count).toBe(3);
    expect(out[1].message).toContain('Upkeep: -9 (army 4)');
    expect(out[1].message).toContain('3 turns so far, since 1');
    expect(out[1].details.map((d) => d.year)).toEqual([1, 3, 4]);
  });
  it('keeps one summary per trade route', () => {
    const a = (y) => L(y, "Rebels plunder your land trade route to D'mt (Abdju): no trade this turn.", 'combat');
    const b = (y) => L(y, 'Rebels plunder your land trade route to Mari (Ur): no trade this turn.', 'combat');
    const out = summarizeLogs([a(1), b(1), a(2), a(3), b(2)]);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.count).sort()).toEqual([2, 3]);
  });
  it('leaves one-off and single recurring lines alone', () => {
    const logs = [L(1, 'Upkeep: -10 (army 5)'), L(2, 'Kish grew')];
    const out = summarizeLogs(logs);
    expect(out).toEqual(logs);
    expect(out[0]).toBe(logs[0]);
  });
  it('recognises the rules', () => {
    expect(recurringRuleOf('Upkeep: -3')?.id).toBe('upkeep');
    expect(recurringRuleOf('Kish grew')).toBeNull();
  });
});

describe('the per-turn income line folds (playtest issue 13)', () => {
  it('folds the new and the old income lines into one with a count', () => {
    const out = summarizeLogs([{ message: '-800: +5g', year: -800 }, { message: 'Income: +5g (each source: tap Gold on the top bar)', year: -790 }, { message: 'Income: +6g (each source: tap Gold on the top bar)', year: -780 }]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
  });
});
