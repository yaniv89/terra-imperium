import { describe, it, expect } from 'vitest';
import {
  XP_THRESHOLDS,
  getRankForXp,
  entitledPromotionCount,
  canPromote,
  awardXp,
  PROMOTION_BRANCHES,
  ALL_PERKS,
  getPerk,
  CLASS_CAPSTONES,
  hasPerk,
  getPromotionDamageMultiplier,
  getPromotionDefenseMultiplier,
  getPromotionMoraleLossMultiplier,
  applySapperToSiegeMultiplier
} from './promotions';

const makeUnit = (overrides = {}) => ({ id: 'u1', classId: 'infantry', xp: 0, rank: 'recruit', promotions: [], ...overrides });

describe('rank derivation', () => {
  it('starts at recruit with no XP', () => {
    expect(getRankForXp(0)).toBe('recruit');
  });

  it('advances through every rank as XP crosses each threshold', () => {
    expect(getRankForXp(XP_THRESHOLDS.regular)).toBe('regular');
    expect(getRankForXp(XP_THRESHOLDS.veteran)).toBe('veteran');
    expect(getRankForXp(XP_THRESHOLDS.elite)).toBe('elite');
    expect(getRankForXp(XP_THRESHOLDS.legendary)).toBe('legendary');
  });

  it('is just short of the next rank one XP below its threshold', () => {
    expect(getRankForXp(XP_THRESHOLDS.regular - 1)).toBe('recruit');
  });
});

describe('entitledPromotionCount / canPromote', () => {
  it('entitles zero picks at recruit and one per rank up to elite', () => {
    expect(entitledPromotionCount('recruit')).toBe(0);
    expect(entitledPromotionCount('regular')).toBe(1);
    expect(entitledPromotionCount('veteran')).toBe(2);
    expect(entitledPromotionCount('elite')).toBe(3);
  });

  it('does not grant an extra pick for reaching legendary', () => {
    expect(entitledPromotionCount('legendary')).toBe(3);
  });

  it('a unit can promote once it has reached a rank it has not spent a pick for', () => {
    const unit = makeUnit({ xp: XP_THRESHOLDS.regular, promotions: [] });
    expect(canPromote(unit)).toBe(true);
  });

  it('cannot promote again until XP crosses the next threshold', () => {
    const unit = makeUnit({ xp: XP_THRESHOLDS.regular, promotions: ['shock'] });
    expect(canPromote(unit)).toBe(false);
  });

  it('cannot promote at legendary — its capstone is automatic, not picked', () => {
    const unit = makeUnit({ xp: XP_THRESHOLDS.legendary, promotions: ['shock', 'bulwark', 'overrun'] });
    expect(canPromote(unit)).toBe(false);
  });
});

describe('awardXp', () => {
  it('accumulates XP and updates the derived rank', () => {
    const unit = makeUnit();
    const next = awardXp(unit, XP_THRESHOLDS.regular);
    expect(next.xp).toBe(XP_THRESHOLDS.regular);
    expect(next.rank).toBe('regular');
  });

  it('auto-grants the class capstone the moment XP crosses the legendary threshold', () => {
    const unit = makeUnit({ classId: 'cavalry' });
    const next = awardXp(unit, XP_THRESHOLDS.legendary);
    expect(next.rank).toBe('legendary');
    expect(next.promotions).toContain(CLASS_CAPSTONES.cavalry.id);
  });

  it('does not duplicate the capstone if awarded again after already legendary', () => {
    const unit = makeUnit({ classId: 'infantry', xp: XP_THRESHOLDS.legendary, promotions: [CLASS_CAPSTONES.infantry.id] });
    const next = awardXp(unit, 10);
    expect(next.promotions.filter((p) => p === CLASS_CAPSTONES.infantry.id).length).toBe(1);
  });

  it('is pure — does not mutate the input unit', () => {
    const unit = makeUnit();
    const snapshot = { ...unit, promotions: [...unit.promotions] };
    awardXp(unit, 100);
    expect(unit).toEqual(snapshot);
  });
});

describe('perk data integrity', () => {
  it('every branch perk is reachable via getPerk by id', () => {
    ALL_PERKS.forEach((perk) => {
      expect(getPerk(perk.id)).toEqual(perk);
    });
  });

  it('has exactly three branches with three perks each', () => {
    expect(Object.keys(PROMOTION_BRANCHES).length).toBe(3);
    Object.values(PROMOTION_BRANCHES).forEach((branch) => {
      expect(Object.keys(branch.perks).length).toBe(3);
    });
  });

  it('every core combat class has a capstone', () => {
    ['infantry', 'cavalry', 'ranged', 'siege'].forEach((classId) => {
      expect(CLASS_CAPSTONES[classId]).toBeDefined();
    });
  });
});

describe('combat multiplier hooks', () => {
  it('shock perk boosts outgoing damage', () => {
    const withShock = makeUnit({ promotions: ['shock'] });
    const without = makeUnit();
    expect(getPromotionDamageMultiplier(withShock, { phase: 'shock' })).toBeGreaterThan(getPromotionDamageMultiplier(without, { phase: 'shock' }));
  });

  it('breakthrough only applies when attacking a fortification', () => {
    const unit = makeUnit({ promotions: ['breakthrough'] });
    expect(getPromotionDamageMultiplier(unit, { phase: 'shock', isAttackingFortification: true })).toBeGreaterThan(1);
    expect(getPromotionDamageMultiplier(unit, { phase: 'shock', isAttackingFortification: false })).toBe(1);
  });

  it('bulwark reduces incoming damage', () => {
    const unit = makeUnit({ promotions: ['bulwark'] });
    expect(getPromotionDefenseMultiplier(unit, {})).toBeLessThan(1);
  });

  it('entrenched only helps while on the defending side', () => {
    const unit = makeUnit({ promotions: ['entrenched'] });
    expect(getPromotionDefenseMultiplier(unit, { isDefendingSide: true })).toBeLessThan(1);
    expect(getPromotionDefenseMultiplier(unit, { isDefendingSide: false })).toBe(1);
  });

  it('resilient reduces morale loss taken', () => {
    const unit = makeUnit({ promotions: ['resilient'] });
    expect(getPromotionMoraleLossMultiplier(unit)).toBeLessThan(1);
  });

  it('sapper keeps a partial fortification bonus in the open field only', () => {
    const unit = makeUnit({ classId: 'siege', promotions: ['sapper'] });
    const openFieldBase = 0.5;
    const adjusted = applySapperToSiegeMultiplier(unit, false, openFieldBase);
    expect(adjusted).toBeGreaterThan(openFieldBase);
    // No change when actually attacking a fortification — sapper's benefit is specifically for
    // the open-field case.
    expect(applySapperToSiegeMultiplier(unit, true, 3.0)).toBe(3.0);
  });

  it('hasPerk is false for a unit with no matching promotion', () => {
    expect(hasPerk(makeUnit(), 'shock')).toBe(false);
  });
});
