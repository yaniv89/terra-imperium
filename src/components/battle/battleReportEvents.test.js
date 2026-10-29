import { describe, it, expect } from 'vitest';
import { reportToTell } from './battleReportEvents';

describe('reportToTell: no battle of the player ends in silence', () => {
  const T = 40;
  it('a Command switched to Auto opens its report, instant battles or not (civ-veteran 106, warmonger 294)', () => {
    const sw = { id: 's', commanded: true, switchedAtSec: 42, playerSide: 'defender', turn: T };
    expect(reportToTell([sw], T)).toBe(sw);
    expect(reportToTell([sw], T, true)).toBe(sw);
  });
  it('the player own Auto battle of this turn opens unless instant battles are on; a commanded one has its result screen', () => {
    const auto = { id: 'a', commanded: false, playerSide: 'defender', turn: T };
    expect(reportToTell([auto], T)).toBe(auto);
    expect(reportToTell([auto], T, true)).toBeNull();
    expect(reportToTell([{ id: 'c', commanded: true, playerSide: 'attacker', turn: T }], T)).toBeNull();
  });
});
