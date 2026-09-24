import { describe, it, expect } from 'vitest';
import {
  STABILITY_MIN, STABILITY_MAX, LEGITIMACY_MIN, LEGITIMACY_MAX, PRESTIGE_MIN, PRESTIGE_MAX,
  clampStability, clampLegitimacy, clampPrestige,
  getGoverningCapacity, getOwnedRegionCount, getOverextension, getIncreaseStabilityCost,
  getRulerBestPool, processNationalPowerTurn
} from './nationalPower';

describe('clamp helpers', () => {
  it('clampStability clamps to [-3, 3]', () => {
    expect(clampStability(10)).toBe(STABILITY_MAX);
    expect(clampStability(-10)).toBe(STABILITY_MIN);
    expect(clampStability(2)).toBe(2);
  });

  it('clampLegitimacy clamps to [0, 100]', () => {
    expect(clampLegitimacy(150)).toBe(LEGITIMACY_MAX);
    expect(clampLegitimacy(-5)).toBe(LEGITIMACY_MIN);
  });

  it('clampPrestige clamps to [-100, 100]', () => {
    expect(clampPrestige(500)).toBe(PRESTIGE_MAX);
    expect(clampPrestige(-500)).toBe(PRESTIGE_MIN);
  });
});

describe('getGoverningCapacity / getOwnedRegionCount / getOverextension', () => {
  const makeState = ({ startRegionCount = 10, ownedRegionIds = ['r1', 'r2'], techTree = {}, playerNationId = 'fr' } = {}) => ({
    playerNationId,
    nations: { fr: { startRegionCount } },
    regions: ownedRegionIds.reduce((acc, id) => ({ ...acc, [id]: { owner: 'fr' } }), { other: { owner: 'de' } }),
    techTree
  });

  it('capacity is startRegionCount + 10 with no Governance techs', () => {
    const state = makeState({ startRegionCount: 5 });
    expect(getGoverningCapacity(state, 'fr')).toBe(15);
  });

  it('counts only regions actually owned by that nation today', () => {
    const state = makeState({ ownedRegionIds: ['r1', 'r2', 'r3'] });
    expect(getOwnedRegionCount(state, 'fr')).toBe(3);
    expect(getOwnedRegionCount(state, 'de')).toBe(1);
  });

  it('overextension is 0 while owned regions are within capacity', () => {
    const state = makeState({ startRegionCount: 10, ownedRegionIds: ['r1', 'r2'] }); // capacity 20, owned 2
    expect(getOverextension(state, 'fr')).toBe(0);
  });

  it('overextension is positive once owned regions exceed capacity', () => {
    const ownedRegionIds = Array.from({ length: 25 }, (_, i) => `r${i}`);
    const state = makeState({ startRegionCount: 10, ownedRegionIds }); // capacity 20, owned 25
    expect(getOverextension(state, 'fr')).toBeCloseTo(25, 0); // (25-20)/20*100 = 25%
  });

  it('unowned/unknown nation has 0 overextension rather than throwing', () => {
    const state = makeState();
    expect(getOverextension(state, 'zz')).toBe(0);
  });
});

describe('getIncreaseStabilityCost', () => {
  it('is exactly 100 ADM at 0 overextension and minimum stability (the plan\'s own baseline)', () => {
    // The plan's formula is 100 x (1 + overextension%) x (1 + 0.1 x (stability + 3)) — the
    // (stability + 3) term is only 0 at the minimum stability (-3), which is where it reduces to
    // exactly the bare 100 ADM the plan states as its baseline.
    const state = { playerNationId: 'fr', nations: { fr: { startRegionCount: 10, stability: -3 } }, regions: {}, techTree: {} };
    expect(getIncreaseStabilityCost(state, 'fr')).toBe(100);
  });

  it('scales up with current stability (harder to push further from neutral)', () => {
    const base = { playerNationId: 'fr', regions: {}, techTree: {} };
    const atZero = getIncreaseStabilityCost({ ...base, nations: { fr: { startRegionCount: 10, stability: 0 } } }, 'fr');
    const atTwo = getIncreaseStabilityCost({ ...base, nations: { fr: { startRegionCount: 10, stability: 2 } } }, 'fr');
    expect(atTwo).toBeGreaterThan(atZero);
  });

  it('scales up with overextension', () => {
    const ownedRegionIds = Array.from({ length: 25 }, (_, i) => `r${i}`);
    const regions = ownedRegionIds.reduce((acc, id) => ({ ...acc, [id]: { owner: 'fr' } }), {});
    const state = { playerNationId: 'fr', nations: { fr: { startRegionCount: 10, stability: 0 } }, regions, techTree: {} };
    expect(getIncreaseStabilityCost(state, 'fr')).toBeGreaterThan(100);
  });
});

describe('getRulerBestPool', () => {
  it('returns the pool with the highest skill', () => {
    expect(getRulerBestPool({ adm: 1, dip: 5, mil: 2 })).toBe('dip');
    expect(getRulerBestPool({ adm: 3, dip: 1, mil: 6 })).toBe('mil');
  });

  it('ties break toward adm, then dip', () => {
    expect(getRulerBestPool({ adm: 3, dip: 3, mil: 3 })).toBe('adm');
    expect(getRulerBestPool({ adm: 1, dip: 4, mil: 4 })).toBe('dip');
  });

  it('returns null for a nation with no ruler', () => {
    expect(getRulerBestPool(null)).toBeNull();
  });
});

describe('processNationalPowerTurn', () => {
  it('does not decay stability before 10 turns of no source', () => {
    let nation = { stability: 2, stabilityDecayProgress: 0, legitimacy: 50, prestige: 0, government: null };
    for (let i = 0; i < 9; i++) nation = processNationalPowerTurn(nation);
    expect(nation.stability).toBe(2);
  });

  it('decays stability by 1 toward 0 every 10 turns', () => {
    let nation = { stability: 2, stabilityDecayProgress: 0, legitimacy: 50, prestige: 0, government: null };
    for (let i = 0; i < 10; i++) nation = processNationalPowerTurn(nation);
    expect(nation.stability).toBe(1);
  });

  it('decays negative stability upward toward 0', () => {
    let nation = { stability: -2, stabilityDecayProgress: 0, legitimacy: 50, prestige: 0, government: null };
    for (let i = 0; i < 10; i++) nation = processNationalPowerTurn(nation);
    expect(nation.stability).toBe(-1);
  });

  it('never decays stability that is already 0', () => {
    let nation = { stability: 0, stabilityDecayProgress: 0, legitimacy: 50, prestige: 0, government: null };
    for (let i = 0; i < 30; i++) nation = processNationalPowerTurn(nation);
    expect(nation.stability).toBe(0);
  });

  it('tribal (no government) legitimacy never moves', () => {
    let nation = { stability: 0, stabilityDecayProgress: 0, legitimacy: 50, prestige: 0, government: null };
    for (let i = 0; i < 20; i++) nation = processNationalPowerTurn(nation);
    expect(nation.legitimacy).toBe(50);
  });

  it('hereditary government gains legitimacy scaled by ruler ADM skill', () => {
    const withSkill = processNationalPowerTurn({ legitimacy: 50, prestige: 0, government: { type: 'monarchy', reforms: {} }, ruler: { adm: 6 } });
    const withoutSkill = processNationalPowerTurn({ legitimacy: 50, prestige: 0, government: { type: 'monarchy', reforms: {} }, ruler: { adm: 0 } });
    expect(withSkill.legitimacy).toBeGreaterThan(withoutSkill.legitimacy);
    expect(withoutSkill.legitimacy).toBe(50); // 0 adm skill and 0 prestige contributes nothing
  });

  it('elective government gains a flat legitimacy tick regardless of ruler skill', () => {
    const result = processNationalPowerTurn({ legitimacy: 50, prestige: 0, government: { type: 'republic', reforms: {} }, ruler: { adm: 0 } });
    expect(result.legitimacy).toBeGreaterThan(50);
  });

  it('legitimacy never exceeds 100', () => {
    let nation = { legitimacy: 99.9, prestige: 100, government: { type: 'monarchy', reforms: {} }, ruler: { adm: 6 } };
    for (let i = 0; i < 5; i++) nation = processNationalPowerTurn(nation);
    expect(nation.legitimacy).toBeLessThanOrEqual(100);
  });

  it('prestige decays 5% toward 0 every turn', () => {
    const result = processNationalPowerTurn({ legitimacy: 50, prestige: 100, government: null });
    expect(result.prestige).toBe(95);
  });

  it('prestige decay approaches but never crosses 0', () => {
    let nation = { legitimacy: 50, prestige: -10, government: null };
    for (let i = 0; i < 50; i++) nation = processNationalPowerTurn(nation);
    expect(nation.prestige).toBeCloseTo(0, 0);
  });

  // Plan §M11: "extortionate taxes... -1 stability every 10 turns while active". These merge the
  // result onto the nation (`{ ...nation, ...processNationalPowerTurn(nation) }`), the same way
  // resolveTurn.js's real caller does, rather than replacing the whole nation object each turn —
  // taxRate isn't part of processNationalPowerTurn's own return shape, so a bare reassignment would
  // silently drop it after the first iteration and the drain could never accumulate past turn 1.
  describe('extortionate tax rate stability drain', () => {
    it('does not drain stability before 10 turns on the extortionate rate', () => {
      let nation = { stability: 0, stabilityDecayProgress: 0, extortionateTaxProgress: 0, legitimacy: 50, prestige: 0, government: null, taxRate: 'extortionate' };
      for (let i = 0; i < 9; i++) nation = { ...nation, ...processNationalPowerTurn(nation) };
      expect(nation.stability).toBe(0);
    });

    it('drains 1 stability every 10 turns while on the extortionate rate', () => {
      let nation = { stability: 0, stabilityDecayProgress: 0, extortionateTaxProgress: 0, legitimacy: 50, prestige: 0, government: null, taxRate: 'extortionate' };
      for (let i = 0; i < 10; i++) nation = { ...nation, ...processNationalPowerTurn(nation) };
      expect(nation.stability).toBe(-1);
    });

    it('resets progress the instant the nation leaves the extortionate rate', () => {
      let nation = { stability: 0, stabilityDecayProgress: 0, extortionateTaxProgress: 0, legitimacy: 50, prestige: 0, government: null, taxRate: 'extortionate' };
      for (let i = 0; i < 5; i++) nation = { ...nation, ...processNationalPowerTurn(nation) };
      nation = { ...nation, taxRate: 'normal' };
      nation = { ...nation, ...processNationalPowerTurn(nation) };
      expect(nation.extortionateTaxProgress).toBe(0);
    });

    it('never drains stability on any other tax rate', () => {
      let nation = { stability: 0, stabilityDecayProgress: 0, extortionateTaxProgress: 0, legitimacy: 50, prestige: 0, government: null, taxRate: 'high' };
      for (let i = 0; i < 30; i++) nation = { ...nation, ...processNationalPowerTurn(nation) };
      expect(nation.stability).toBe(0);
    });

    it('never drains stability below STABILITY_MIN', () => {
      let nation = { stability: STABILITY_MIN, stabilityDecayProgress: 0, extortionateTaxProgress: 0, legitimacy: 50, prestige: 0, government: null, taxRate: 'extortionate' };
      for (let i = 0; i < 10; i++) nation = { ...nation, ...processNationalPowerTurn(nation) };
      expect(nation.stability).toBe(STABILITY_MIN);
    });
  });
});
