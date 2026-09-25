import { describe, it, expect } from 'vitest';
import {
  UNIT_CLASSES,
  UNIT_CLASS_IDS,
  CORE_TRIANGLE_CLASS_IDS,
  getCounterMultiplier,
  getSiegeMultiplier,
  UNIT_ROSTER,
  getUnitDefinition,
  getAvailableClasses,
  getRosterCombatMultiplier
} from './unitClasses';
import { AGE_ORDER } from './ages';

// The plan's own verification requirement (§13): "a test asserting the counter triangle is
// closed and non-degenerate (every class has something it beats and something that beats it) —
// so a later unit addition can't quietly create a dominant class". Scoped to the three classes
// that actually form the closed triangle — Siege/Naval/Air/Support are asymmetric by design
// (see unitClasses.js's file header) and are covered by their own tests below instead.
describe('counter triangle integrity (Infantry/Cavalry/Ranged)', () => {
  it('every core class beats at least one other core class', () => {
    CORE_TRIANGLE_CLASS_IDS.forEach(id => {
      const beatsAnotherCore = UNIT_CLASSES[id].beats.some(b => CORE_TRIANGLE_CLASS_IDS.includes(b));
      expect(beatsAnotherCore, `${id} beats nothing in the core triangle`).toBe(true);
    });
  });

  it('every core class loses to at least one other core class', () => {
    CORE_TRIANGLE_CLASS_IDS.forEach(id => {
      const losesToAnotherCore = UNIT_CLASSES[id].losesTo.some(l => CORE_TRIANGLE_CLASS_IDS.includes(l));
      expect(losesToAnotherCore, `${id} loses to nothing in the core triangle`).toBe(true);
    });
  });

  it('is a true cycle, not a transitive dominance chain: no class beats what beats it', () => {
    CORE_TRIANGLE_CLASS_IDS.forEach(id => {
      UNIT_CLASSES[id].beats.forEach(beatenId => {
        if (!CORE_TRIANGLE_CLASS_IDS.includes(beatenId)) return;
        expect(UNIT_CLASSES[beatenId].beats).not.toContain(id);
      });
    });
  });

  it('every beats/losesTo relationship is reciprocated from the other side', () => {
    UNIT_CLASS_IDS.forEach(id => {
      UNIT_CLASSES[id].beats.forEach(otherId => {
        expect(UNIT_CLASSES[otherId].losesTo, `${otherId} does not list losing to ${id}`).toContain(id);
      });
      UNIT_CLASSES[id].losesTo.forEach(otherId => {
        expect(UNIT_CLASSES[otherId].beats, `${otherId} does not list beating ${id}`).toContain(id);
      });
    });
  });
});

describe('getCounterMultiplier', () => {
  // Plan §M14: sharper than M0-M13's baseline (was 1.5/0.67) — see unitClasses.js's own comment.
  it('applies the +75% bonus when attacker beats defender', () => {
    expect(getCounterMultiplier('infantry', 'cavalry')).toBeCloseTo(1.75, 5);
  });

  it('applies the -40% penalty when attacker loses to defender', () => {
    expect(getCounterMultiplier('infantry', 'ranged')).toBeCloseTo(0.6, 5);
  });

  it('is neutral (1x) for a non-counter matchup', () => {
    expect(getCounterMultiplier('infantry', 'siege')).toBe(1);
  });

  it('is neutral for an unknown attacker class rather than throwing', () => {
    expect(() => getCounterMultiplier('not_a_class', 'infantry')).not.toThrow();
    expect(getCounterMultiplier('not_a_class', 'infantry')).toBe(1);
  });

  it('cavalry also hard-counters siege (caught in the open)', () => {
    expect(getCounterMultiplier('cavalry', 'siege')).toBeCloseTo(1.75, 5);
  });
});

// Plan §M14: Support's own counter — the only asymmetric-class relationship that changed shape
// (not just magnitude) this milestone, so it gets its own describe rather than folding into the
// reciprocity test above.
describe('Support vs Air (plan §M14)', () => {
  it('Support (Anti-Air) beats Air', () => {
    expect(getCounterMultiplier('support', 'air')).toBeCloseTo(1.75, 5);
  });

  it('Air loses to Support', () => {
    expect(getCounterMultiplier('air', 'support')).toBeCloseTo(0.6, 5);
  });

  it('Air no longer beats Naval', () => {
    expect(getCounterMultiplier('air', 'naval')).toBe(1);
  });
});

describe('getSiegeMultiplier', () => {
  it('is a large bonus against a fortified region', () => {
    expect(getSiegeMultiplier(true)).toBeGreaterThan(1);
  });

  it('is a penalty in the open field', () => {
    expect(getSiegeMultiplier(false)).toBeLessThan(1);
  });
});

describe('UNIT_ROSTER data integrity', () => {
  it('every age has an entry for every one of its ages\' core classes', () => {
    AGE_ORDER.forEach(ageId => {
      ['infantry', 'cavalry', 'ranged', 'siege', 'naval'].forEach(classId => {
        expect(UNIT_ROSTER[ageId][classId], `${ageId}/${classId}`).toBeDefined();
      });
    });
  });

  it('Air only exists from the Modern age', () => {
    ['bronze', 'classical', 'kingdoms', 'gunpowder'].forEach(ageId => {
      expect(UNIT_ROSTER[ageId].air).toBeUndefined();
    });
    expect(UNIT_ROSTER.modern.air).toBeDefined();
  });

  it('stats strictly increase age over age for the same class', () => {
    const attackValues = AGE_ORDER.map(ageId => UNIT_ROSTER[ageId].infantry.baseAttack);
    for (let i = 1; i < attackValues.length; i++) {
      expect(attackValues[i]).toBeGreaterThan(attackValues[i - 1]);
    }
  });
});

// Plan §M14: replaces the old flat "ages-behind" combat malus with a real two-sided comparison.
describe('getRosterCombatMultiplier', () => {
  it('is exactly 1.0 whenever both sides share an age, regardless of which age', () => {
    AGE_ORDER.forEach((ageId) => {
      expect(getRosterCombatMultiplier(ageId, ageId)).toBeCloseTo(1, 5);
    });
  });

  it('rewards a more advanced attacker against a less advanced defender', () => {
    expect(getRosterCombatMultiplier('modern', 'bronze')).toBeGreaterThan(1);
  });

  it('punishes a less advanced attacker against a more advanced defender', () => {
    expect(getRosterCombatMultiplier('bronze', 'modern')).toBeLessThan(1);
  });

  it('scales with how far apart the two ages are, not just which side is ahead', () => {
    const oneAgeAhead = getRosterCombatMultiplier('classical', 'bronze');
    const fourAgesAhead = getRosterCombatMultiplier('modern', 'bronze');
    expect(fourAgesAhead).toBeGreaterThan(oneAgeAhead);
  });
});

describe('getUnitDefinition / getAvailableClasses', () => {
  it('returns the roster entry for a real age/class pair', () => {
    expect(getUnitDefinition('bronze', 'infantry')?.name).toBe('Spearmen');
  });

  it('returns null for an unavailable class at that age', () => {
    expect(getUnitDefinition('bronze', 'air')).toBeNull();
  });

  it('lists exactly the classes available at a given age', () => {
    expect(getAvailableClasses('bronze').sort()).toEqual(['cavalry', 'infantry', 'naval', 'ranged', 'siege', 'support'].sort());
    expect(getAvailableClasses('modern')).toContain('air');
  });
});
