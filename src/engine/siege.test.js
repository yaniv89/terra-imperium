import { describe, it, expect } from 'vitest';
import {
  resolveSiegeControlDamage,
  hasMeleeUnitDeployed,
  nextSiegeControlRegen,
  getDefenseLevelDamageReductionMultiplier,
  getZoneOfControlMultiplier,
  SIEGE_CAPTURE_CONTROL_THRESHOLD,
  SIEGE_CONTROL_REGEN_PER_TURN,
  SIEGE_REGEN_COOLDOWN_TURNS,
  ZOC_FORT_LEVEL_THRESHOLD
} from './siege';

describe('resolveSiegeControlDamage', () => {
  it('damages control on an attacker win without capturing, while control stays above the threshold', () => {
    const result = resolveSiegeControlDamage({ currentControl: 100, outcome: 'attacker', hasMeleeUnit: true });
    expect(result.captured).toBe(false);
    expect(result.nextControl).toBe(70); // 100 - 30
  });

  it('does less damage on a stalemate', () => {
    const result = resolveSiegeControlDamage({ currentControl: 100, outcome: 'stalemate', hasMeleeUnit: true });
    expect(result.nextControl).toBe(90); // 100 - 10
    expect(result.captured).toBe(false);
  });

  it('does no damage when the defender cleanly repels the attacker', () => {
    const result = resolveSiegeControlDamage({ currentControl: 100, outcome: 'defender', hasMeleeUnit: true });
    expect(result.nextControl).toBe(100);
    expect(result.captured).toBe(false);
  });

  it('captures once an attacker win crosses the threshold WITH a melee unit present', () => {
    const result = resolveSiegeControlDamage({ currentControl: 40, outcome: 'attacker', hasMeleeUnit: true });
    expect(result.nextControl).toBe(10); // 40 - 30, at/under the threshold
    expect(result.captured).toBe(true);
  });

  it('clamps at the threshold without capturing when no melee unit is present, even overshooting damage', () => {
    const result = resolveSiegeControlDamage({ currentControl: 40, outcome: 'attacker', hasMeleeUnit: false });
    expect(result.nextControl).toBe(SIEGE_CAPTURE_CONTROL_THRESHOLD);
    expect(result.captured).toBe(false);
  });

  it('is idempotent once clamped: a further no-melee hit never pushes control below the threshold', () => {
    const first = resolveSiegeControlDamage({ currentControl: 40, outcome: 'attacker', hasMeleeUnit: false });
    const second = resolveSiegeControlDamage({ currentControl: first.nextControl, outcome: 'attacker', hasMeleeUnit: false });
    expect(second.nextControl).toBe(SIEGE_CAPTURE_CONTROL_THRESHOLD);
    expect(second.captured).toBe(false);
  });

  it('captures immediately once melee finally shows up against an already-clamped region', () => {
    const clamped = resolveSiegeControlDamage({ currentControl: 40, outcome: 'attacker', hasMeleeUnit: false });
    const withMelee = resolveSiegeControlDamage({ currentControl: clamped.nextControl, outcome: 'attacker', hasMeleeUnit: true });
    expect(withMelee.captured).toBe(true);
  });

  it('never drives control below zero', () => {
    const result = resolveSiegeControlDamage({ currentControl: 5, outcome: 'stalemate', hasMeleeUnit: true });
    expect(result.nextControl).toBe(0);
  });
});

describe('hasMeleeUnitDeployed', () => {
  it('is true when an infantry or cavalry unit with strength remains', () => {
    expect(hasMeleeUnitDeployed([{ classId: 'infantry', strength: 100 }])).toBe(true);
    expect(hasMeleeUnitDeployed([{ classId: 'cavalry', strength: 1 }])).toBe(true);
  });

  it('is false for ranged/siege/naval/air-only forces', () => {
    expect(hasMeleeUnitDeployed([{ classId: 'ranged', strength: 100 }, { classId: 'siege', strength: 100 }])).toBe(false);
  });

  it('is false when the only melee unit has zero strength', () => {
    expect(hasMeleeUnitDeployed([{ classId: 'infantry', strength: 0 }])).toBe(false);
  });

  it('is false for an empty force', () => {
    expect(hasMeleeUnitDeployed([])).toBe(false);
  });
});

describe('getDefenseLevelDamageReductionMultiplier', () => {
  it('is 1 (no reduction) at defenseLevel 0', () => {
    expect(getDefenseLevelDamageReductionMultiplier(0)).toBe(1);
  });

  it('reduces 5% per level', () => {
    expect(getDefenseLevelDamageReductionMultiplier(1)).toBeCloseTo(0.95);
    expect(getDefenseLevelDamageReductionMultiplier(4)).toBeCloseTo(0.8);
  });

  it('floors at 50% reduction, even past level 10', () => {
    expect(getDefenseLevelDamageReductionMultiplier(10)).toBe(0.5);
    expect(getDefenseLevelDamageReductionMultiplier(20)).toBe(0.5);
  });
});

describe('nextSiegeControlRegen', () => {
  it('does not regenerate while still within the cooldown window', () => {
    const region = { control: 50, lastAttackedTurn: 10 };
    expect(nextSiegeControlRegen(region, 10 + SIEGE_REGEN_COOLDOWN_TURNS - 1)).toBe(50);
  });

  it('regenerates once the cooldown has passed', () => {
    const region = { control: 50, lastAttackedTurn: 10 };
    expect(nextSiegeControlRegen(region, 10 + SIEGE_REGEN_COOLDOWN_TURNS)).toBe(50 + SIEGE_CONTROL_REGEN_PER_TURN);
  });

  it('caps regeneration at 100', () => {
    const region = { control: 99, lastAttackedTurn: 0 };
    expect(nextSiegeControlRegen(region, 100)).toBe(100);
  });

  it('treats a region with no lastAttackedTurn as long past cooldown', () => {
    const region = { control: 50 };
    expect(nextSiegeControlRegen(region, 1)).toBe(50 + SIEGE_CONTROL_REGEN_PER_TURN);
  });
});

// fr-59 (Nord) really borders be-vwv (Hainaut) — worldRegions.json — the same real pair used
// elsewhere in this codebase's tests wherever genuine adjacency (not just any two owned regions)
// matters.
describe('getZoneOfControlMultiplier (plan §M14)', () => {
  const regions = {
    'fr-59': { owner: 'fr', defenseLevel: 0 },
    'be-vwv': { owner: 'be', defenseLevel: 0 }
  };

  it('is a no-op with no fortified neighbor', () => {
    expect(getZoneOfControlMultiplier(regions, 'fr-59', 'fr')).toBe(1);
  });

  it('reduces damage when a bordering region the defender holds is fortified to Star Fort tier or better', () => {
    const withFort = { ...regions, 'be-vwv': { ...regions['be-vwv'], owner: 'fr', defenseLevel: ZOC_FORT_LEVEL_THRESHOLD } };
    expect(getZoneOfControlMultiplier(withFort, 'fr-59', 'fr')).toBeLessThan(1);
  });

  it('does not trigger below the fort-level threshold', () => {
    const weakFort = { ...regions, 'be-vwv': { ...regions['be-vwv'], owner: 'fr', defenseLevel: ZOC_FORT_LEVEL_THRESHOLD - 1 } };
    expect(getZoneOfControlMultiplier(weakFort, 'fr-59', 'fr')).toBe(1);
  });

  it('does not trigger from a neighbor the defender neither owns nor occupies', () => {
    const enemyFort = { ...regions, 'be-vwv': { ...regions['be-vwv'], owner: 'be', defenseLevel: ZOC_FORT_LEVEL_THRESHOLD } };
    expect(getZoneOfControlMultiplier(enemyFort, 'fr-59', 'fr')).toBe(1);
  });

  it('also counts a neighbor the defender merely occupies', () => {
    const occupied = { ...regions, 'be-vwv': { ...regions['be-vwv'], owner: 'be', occupiedBy: 'fr', defenseLevel: ZOC_FORT_LEVEL_THRESHOLD } };
    expect(getZoneOfControlMultiplier(occupied, 'fr-59', 'fr')).toBeLessThan(1);
  });
});
