import { describe, it, expect } from 'vitest';
import {
  GOVERNMENT_TYPES, GOVERNMENT_REFORMS, getGovernmentType, getAvailableGovernmentTypes, getReformChoices,
  getActiveReforms, getGovernmentReformEffectSum, canChangeGovernmentType, canEnactReform, resetReformsForType
} from './government';
import { AGE_ORDER } from './ages';

const RECOGNIZED_HOOKS = [
  'goldMult', 'hrMult', 'techPointsMult', 'stabilityBonus', 'popGrowthBonus', 'apBonus', 'admBonus',
  'dipBonus', 'milBonus', 'developmentCost', 'buildingCost', 'researchCost', 'stabilityCost',
  'supplyRange', 'attrition', 'governingCapacity'
];
// These are raw, non-LEGACY_HOOK keys consumed directly by succession.js/laws.js/estates.js rather
// than through the modifier engine — see government.js's header comment. estateLoyalty/
// estateInfluence are nested per-estate objects, not flat numbers, so the "recognized hooks" test
// below only checks the KEY names here, not their (object) values.
const RAW_KEYS = ['heirClaimBonus', 'successionLegitimacyPenalty', 'lawCostMult', 'estateLoyalty', 'estateInfluence'];

describe('GOVERNMENT_TYPES / GOVERNMENT_REFORMS data integrity', () => {
  it('every type belongs to a real age', () => {
    Object.values(GOVERNMENT_TYPES).forEach((t) => expect(AGE_ORDER, t.id).toContain(t.minAgeId));
  });

  it('every reform effect key is either a real modifier hook or one of the known raw keys', () => {
    Object.entries(GOVERNMENT_REFORMS).forEach(([typeId, byAge]) => {
      Object.values(byAge).forEach((choices) => {
        choices.forEach((reform) => {
          Object.keys(reform.effects || {}).forEach((key) => {
            expect([...RECOGNIZED_HOOKS, ...RAW_KEYS], `${typeId}/${reform.id}/${key}`).toContain(key);
          });
        });
      });
    });
  });

  it('every reform tier offers at least one choice', () => {
    Object.entries(GOVERNMENT_REFORMS).forEach(([typeId, byAge]) => {
      Object.entries(byAge).forEach(([ageId, choices]) => {
        expect(choices.length, `${typeId}/${ageId}`).toBeGreaterThan(0);
      });
    });
  });

  it('Tribal and Theocracy are available from Bronze; Republic only from Classical; Dictatorship only from Modern', () => {
    expect(getGovernmentType('tribal').minAgeId).toBe('bronze');
    expect(getGovernmentType('theocracy').minAgeId).toBe('bronze');
    expect(getGovernmentType('republic').minAgeId).toBe('classical');
    expect(getGovernmentType('dictatorship').minAgeId).toBe('modern');
  });
});

describe('getGovernmentType', () => {
  it('returns the type by id', () => expect(getGovernmentType('monarchy')?.name).toBe('Monarchy'));
  it('returns null for an unknown id', () => expect(getGovernmentType('not_real')).toBeNull());
});

describe('getAvailableGovernmentTypes', () => {
  it('at Bronze age, offers Tribal and Monarchy but not Republic/Dictatorship', () => {
    const ids = getAvailableGovernmentTypes('bronze', {}).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['tribal', 'monarchy']));
    expect(ids).not.toContain('republic');
    expect(ids).not.toContain('dictatorship');
  });

  it('excludes Theocracy unless the nation has leaned Religious (secularism > 40)', () => {
    expect(getAvailableGovernmentTypes('bronze', {}).map((t) => t.id)).not.toContain('theocracy');
    expect(getAvailableGovernmentTypes('bronze', { secularism: 50 }).map((t) => t.id)).toContain('theocracy');
  });

  it('offers every type once its minimum age is reached', () => {
    expect(getAvailableGovernmentTypes('modern', { secularism: 50 }).map((t) => t.id).sort())
      .toEqual(Object.keys(GOVERNMENT_TYPES).sort());
  });
});

describe('getReformChoices', () => {
  it('returns the 2 Bronze-tier Monarchy reforms', () => {
    expect(getReformChoices('monarchy', 'bronze').map((r) => r.id)).toEqual(['despotic_rule', 'divine_kingship']);
  });

  it('returns an empty array for a tier the type has no reforms at', () => {
    expect(getReformChoices('republic', 'bronze')).toEqual([]);
    expect(getReformChoices('dictatorship', 'classical')).toEqual([]);
  });
});

describe('getActiveReforms / getGovernmentReformEffectSum', () => {
  it('collects every reform tier the nation has picked, across ages', () => {
    const nation = { government: { type: 'monarchy', reforms: { bronze: 'despotic_rule', classical: 'imperial_bureaucracy' } } };
    expect(getActiveReforms(nation).map((r) => r.id).sort()).toEqual(['despotic_rule', 'imperial_bureaucracy'].sort());
  });

  it('is empty for a nation with no government type yet', () => {
    expect(getActiveReforms({})).toEqual([]);
    expect(getActiveReforms(undefined)).toEqual([]);
  });

  it('sums a raw effect key across every active reform', () => {
    const nation = { government: { type: 'monarchy', reforms: { kingdoms: 'hereditary_primogeniture' } } };
    expect(getGovernmentReformEffectSum(nation, 'heirClaimBonus')).toBe(20);
    expect(getGovernmentReformEffectSum(nation, 'lawCostMult')).toBe(0);
  });
});

describe('canChangeGovernmentType', () => {
  it('allows a type at or before the current age', () => {
    expect(canChangeGovernmentType({ government: { type: 'tribal', reforms: {} } }, 'monarchy', 'bronze')).toBe(true);
  });

  it('rejects a type not yet reached by age', () => {
    expect(canChangeGovernmentType({ government: { type: 'tribal', reforms: {} } }, 'republic', 'bronze')).toBe(false);
  });

  it('rejects switching to the type already held', () => {
    expect(canChangeGovernmentType({ government: { type: 'monarchy', reforms: {} } }, 'monarchy', 'bronze')).toBe(false);
  });

  it('rejects Theocracy without the identity gate', () => {
    expect(canChangeGovernmentType({ government: { type: 'tribal', reforms: {} }, identity: {} }, 'theocracy', 'bronze')).toBe(false);
    expect(canChangeGovernmentType({ government: { type: 'tribal', reforms: {} }, identity: { secularism: 50 } }, 'theocracy', 'bronze')).toBe(true);
  });
});

describe('canEnactReform', () => {
  const nation = { government: { type: 'monarchy', reforms: {} } };

  it('allows a reform choice for a tier at or before the current age', () => {
    expect(canEnactReform(nation, 'bronze', 'despotic_rule', 'bronze')).toBe(true);
  });

  it('rejects a tier ahead of the current age', () => {
    expect(canEnactReform(nation, 'classical', 'imperial_bureaucracy', 'bronze')).toBe(false);
  });

  it('rejects a reform id that does not belong to that type/age', () => {
    expect(canEnactReform(nation, 'bronze', 'imperial_bureaucracy', 'bronze')).toBe(false);
  });

  it('rejects re-enacting once a tier is already chosen (locks in)', () => {
    const chosen = { government: { type: 'monarchy', reforms: { bronze: 'despotic_rule' } } };
    expect(canEnactReform(chosen, 'bronze', 'divine_kingship', 'bronze')).toBe(false);
  });

  it('rejects when the nation has no government type', () => {
    expect(canEnactReform({}, 'bronze', 'despotic_rule', 'bronze')).toBe(false);
  });
});

describe('resetReformsForType', () => {
  it('fills every reachable age tier the new type actually offers with its first choice', () => {
    expect(resetReformsForType('monarchy', 'kingdoms')).toEqual({
      bronze: 'despotic_rule',
      classical: 'feudal_nobility',
      kingdoms: 'hereditary_primogeniture'
    });
  });

  it('leaves ages beyond the calendar age unset', () => {
    const reforms = resetReformsForType('monarchy', 'bronze');
    expect(reforms).toEqual({ bronze: 'despotic_rule' });
    expect(reforms.classical).toBeUndefined();
  });

  it('skips ages the type has no reforms for at all', () => {
    expect(resetReformsForType('republic', 'bronze')).toEqual({});
    expect(resetReformsForType('dictatorship', 'gunpowder')).toEqual({});
  });
});
