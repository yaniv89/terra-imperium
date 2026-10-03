import { describe, it, expect } from 'vitest';
import { rulerWarMult, rulerBuildOrder, RULER_WAR_ROLL, RULER_WAR_ROLL_MAX, RULER_WAR_ROLL_MIN } from './rulerBias';
import { buildingOrder } from './aiProduction';
import { TRAIT_IDS } from '../data/traits';

describe('ruler traits bias the AI (plan C8)', () => {
  it('a warlike ruler raises the war roll, a coward lowers it, no traits leave it alone', () => {
    expect(rulerWarMult({ ruler: { traits: [] } })).toBe(1);
    expect(rulerWarMult({})).toBe(1);
    expect(rulerWarMult({ ruler: { traits: ['warrior'] } })).toBe(RULER_WAR_ROLL.warrior);
    expect(rulerWarMult({ ruler: { traits: ['coward'] } })).toBeLessThan(1);
    expect(rulerWarMult({ ruler: { traits: ['warrior', 'tyrant'] } })).toBeCloseTo(1.5 * 1.3, 5);
    expect(rulerWarMult({ ruler: { traits: ['coward', 'diplomat', 'kind'] } })).toBeGreaterThanOrEqual(RULER_WAR_ROLL_MIN);
    TRAIT_IDS.forEach((t) => { const m = rulerWarMult({ ruler: { traits: [t] } }); expect(m).toBeGreaterThanOrEqual(RULER_WAR_ROLL_MIN); expect(m).toBeLessThanOrEqual(RULER_WAR_ROLL_MAX); });
  });

  it('a builder or scholar ruler moves their lines to the front of the doctrine order', () => {
    const base = buildingOrder('cautious');
    expect(rulerBuildOrder({ ruler: { traits: [] } }, base)).toBe(base);
    const scholar = rulerBuildOrder({ ruler: { traits: ['scholar'] } }, base);
    expect(scholar[0]).toBe('science');
    expect([...scholar].sort()).toEqual([...base].sort());
    const both = rulerBuildOrder({ ruler: { traits: ['builder', 'merchant'] } }, base);
    expect(both.slice(0, 4)).toEqual(['industry', 'logistics', 'economy', 'naval']);
    expect(new Set(both).size).toBe(base.length);
  });
});
