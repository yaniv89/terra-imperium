// What the player saw on an earlier turn explains a jump (round 3b: Zafar 14,900 then 294,900; Jerusalem 100% then 0%).
import { beforeEach, describe, expect, it } from 'vitest';
import { forgetSeen, garrisonSince, seenBefore, wallsSince, alliesText } from './oddsMemory';

describe('oddsMemory', () => {
  beforeEach(forgetSeen);
  it('returns the last earlier turn, stable within a turn, nothing for a later (new game) turn', () => {
    expect(seenBefore('k', 5, 1)).toBeNull();
    expect(seenBefore('k', 7, 2)).toEqual({ turn: 5, value: 1 });
    expect(seenBefore('k', 7, 3)).toEqual({ turn: 5, value: 1 });
    expect(seenBefore('k', 2, 9)).toBeNull();
  });
  it('a garrison jump of a quarter or more is said, a small change is not', () => {
    garrisonSince('c', 130, 1490);
    expect(garrisonSince('c', 132, 29490)).toBe('Up from 14,900 on turn 130: more troops marched in.');
    garrisonSince('d', 1, 1000);
    expect(garrisonSince('d', 2, 1100)).toBe('');
  });
  it('walls that lost HP since an earlier turn are said', () => {
    wallsSince('j', 130, 120, 240);
    expect(wallsSince('j', 131, 0, 240)).toBe('Its walls had 120 of 240 HP on turn 130; now 0.');
    expect(wallsSince('k', 1, 240, 240)).toBe('');
  });
  it('names allies among the troops standing by', () => {
    expect(alliesText([{ id: 'elam', name: 'Elam', strength: 2000 }])).toBe(' (20,000 from Elam)');
    expect(alliesText([])).toBe('');
  });
});
