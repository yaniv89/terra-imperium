// src/engine/authority.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { canEnactLaw, LAW_CATEGORIES } from '../data/laws';
import { processEstatesTurn } from './estates';
import { nextLowStabilityStreak } from './civilWar';
import { authorityOf, canEnactLaws, estatesDemanding, authorityRisksCivilWar, AUTHORITY_BASE, AUTHORITY_PER_STABILITY, AUTHORITY_CAPITAL_LOST, AUTHORITY_NO_LAWS, AUTHORITY_ESTATE_DEMAND } from './authority';

const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
const withFr = (patch) => ({ ...S, nations: { ...S.nations, fr: { ...S.nations.fr, ...patch } } });

describe('authority', () => {
  it('starts near the base and moves with stability, legitimacy, war exhaustion and a lost capital, within 0..100', () => {
    const a = authorityOf(S, 'fr');
    expect(a.total).toBeGreaterThan(AUTHORITY_NO_LAWS);
    expect(a.parts[0]).toEqual({ id: 'base', label: 'Rule', value: AUTHORITY_BASE });
    const up = authorityOf(withFr({ stability: 3 }), 'fr');
    const down = authorityOf(withFr({ stability: -3 }), 'fr');
    expect(up.total - down.total).toBe(6 * AUTHORITY_PER_STABILITY);
    expect(authorityOf(withFr({ warExhaustion: 100 }), 'fr').total).toBeLessThan(a.total);
    expect(authorityOf(withFr({ legitimacy: 0 }), 'fr').total).toBeLessThan(a.total);
    const lost = { ...S, regions: { ...S.regions, [getNationCapital('fr')]: { ...S.regions[getNationCapital('fr')], owner: 'de' } } };
    expect(authorityOf(lost, 'fr').parts.find((p) => p.id === 'capital').value).toBe(-AUTHORITY_CAPITAL_LOST);
    expect(authorityOf(withFr({ stability: -3, legitimacy: 0, warExhaustion: 100 }), 'fr').total).toBeGreaterThanOrEqual(0);
    expect(authorityOf(withFr({ stability: 3, legitimacy: 100, ruler: { name: 'X', adm: 6, dip: 6, mil: 6 } }), 'fr').total).toBeLessThanOrEqual(100);
  });

  it('under the floor no law can be enacted, the estates press, and the civil war streak counts the turn', () => {
    const low = withFr({ stability: -3, legitimacy: 0, warExhaustion: 100 });
    expect(authorityOf(low, 'fr').total).toBeLessThan(AUTHORITY_NO_LAWS);
    expect(canEnactLaws(low, 'fr')).toBe(false);
    expect(canEnactLaws(S, 'fr')).toBe(true);
    const anyLaw = Object.entries(S.nations.fr.laws || {})[0];
    if (anyLaw) {
      const [category] = anyLaw;
      const other = LAW_CATEGORIES[category].find((l) => l.id !== anyLaw[1] && !l.requiresTech && !l.requiresIdentity);
      if (other) expect(canEnactLaw(low, 'fr', category, other.id)).toBe(false);
    }
    expect(estatesDemanding(low, 'fr')).toBe(true);
    const estates = { nobility: { loyalty: 50, influence: 30, privileges: [] }, clergy: { loyalty: 50, influence: 30, privileges: [] } };
    const pressed = processEstatesTurn({ ...low, nations: { ...low.nations, fr: { ...low.nations.fr, estates } } }, 'fr');
    const calm = processEstatesTurn({ ...S, nations: { ...S.nations, fr: { ...S.nations.fr, estates } } }, 'fr');
    expect(calm.nobility.loyalty - pressed.nobility.loyalty).toBe(AUTHORITY_ESTATE_DEMAND);
    expect(authorityRisksCivilWar(low, 'fr')).toBe(true);
    expect(nextLowStabilityStreak({ stability: 0, lowStabilityStreak: 2 }, true)).toBe(3);
    expect(nextLowStabilityStreak({ stability: 0, lowStabilityStreak: 2 }, false)).toBe(0);
  });
});
