import { describe, it, expect } from 'vitest';
import {
  LAW_CATEGORIES, LAW_CATEGORY_IDS, DEFAULT_LAWS, LAW_CHANGE_COOLDOWN_TURNS, getLaw, canEnactLaw, getLawChangeCost, getRequiredTechName
} from './laws';
import { TECH_TREE } from './techTree';

const RECOGNIZED_HOOKS = [
  'goldMult', 'hrMult', 'techPointsMult', 'stabilityBonus', 'popGrowthBonus', 'apBonus', 'admBonus',
  'dipBonus', 'milBonus', 'developmentCost', 'buildingCost', 'researchCost', 'stabilityCost',
  'supplyRange', 'attrition', 'governingCapacity'
];

describe('LAW_CHANGE_COOLDOWN_TURNS', () => {
  it('is the plan\'s 5-turn cooldown', () => expect(LAW_CHANGE_COOLDOWN_TURNS).toBe(5));
});

describe('LAW_CATEGORIES data integrity', () => {
  it('has exactly 6 categories', () => {
    expect(LAW_CATEGORY_IDS.sort()).toEqual(['conscription', 'justice', 'land', 'religion', 'taxation', 'trade'].sort());
  });

  it('every category\'s tier-1 law requires no tech (always available)', () => {
    Object.values(LAW_CATEGORIES).forEach((tiers) => expect(tiers[0].requiresTech).toBeNull());
  });

  it('tiers within a category are numbered 1..N with no gaps', () => {
    Object.entries(LAW_CATEGORIES).forEach(([category, tiers]) => {
      tiers.forEach((law, i) => expect(law.tier, `${category}/${law.id}`).toBe(i + 1));
    });
  });

  it('every requiresTech id is a real tech', () => {
    Object.values(LAW_CATEGORIES).forEach((tiers) => {
      tiers.forEach((law) => {
        if (law.requiresTech) expect(TECH_TREE[law.requiresTech], law.id).toBeDefined();
      });
    });
  });

  it('every law\'s effects (when present) use a real, wired modifier hook', () => {
    Object.values(LAW_CATEGORIES).forEach((tiers) => {
      tiers.forEach((law) => {
        Object.keys(law.effects || {}).forEach((hook) => expect(RECOGNIZED_HOOKS, `${law.id}/${hook}`).toContain(hook));
      });
    });
  });

  it('DEFAULT_LAWS picks each category\'s tier-1 law', () => {
    LAW_CATEGORY_IDS.forEach((category) => expect(DEFAULT_LAWS[category]).toBe(LAW_CATEGORIES[category][0].id));
  });
});

describe('getLaw', () => {
  it('returns the law by category/id', () => expect(getLaw('taxation', 'land_tax')?.name).toBe('Land Tax'));
  it('returns null for an unknown id', () => expect(getLaw('taxation', 'not_real')).toBeNull());
});

describe('canEnactLaw', () => {
  const baseNation = { laws: { ...DEFAULT_LAWS }, identity: {}, lawCooldowns: {} };
  const state = (overrides = {}) => ({
    playerNationId: 'fr',
    turnNumber: 10,
    techTree: {},
    nations: { fr: { ...baseNation, ...overrides } }
  });

  it('rejects the law already active in that category', () => {
    expect(canEnactLaw(state(), 'fr', 'taxation', 'tribute')).toBe(false);
  });

  it('rejects a tech-gated law when the player hasn\'t researched it', () => {
    expect(canEnactLaw(state(), 'fr', 'taxation', 'land_tax')).toBe(false);
  });

  it('allows a tech-gated law once the player has researched its tech', () => {
    const s = state();
    s.techTree = { economy_minted_coinage: { researched: true } };
    expect(canEnactLaw(s, 'fr', 'taxation', 'land_tax')).toBe(true);
  });

  it('never unlocks a player-only tech gate for an AI nation', () => {
    const s = { playerNationId: 'fr', turnNumber: 10, techTree: { economy_minted_coinage: { researched: true } }, nations: { de: { ...baseNation } } };
    expect(canEnactLaw(s, 'de', 'taxation', 'land_tax')).toBe(false);
  });

  it('rejects the Secularism law without the identity gate, allows it once secular enough', () => {
    const s = state({ identity: { secularism: 0 } });
    s.techTree = { science_scientific_method: { researched: true } };
    expect(canEnactLaw(s, 'fr', 'religion', 'secularism')).toBe(false);
    s.nations.fr.identity = { secularism: -50 };
    expect(canEnactLaw(s, 'fr', 'religion', 'secularism')).toBe(true);
  });

  it('rejects while the category is on cooldown', () => {
    const s = state({ lawCooldowns: { taxation: 20 } });
    s.techTree = { economy_minted_coinage: { researched: true } };
    expect(canEnactLaw(s, 'fr', 'taxation', 'land_tax')).toBe(false);
  });

  it('allows once the cooldown has passed', () => {
    const s = state({ lawCooldowns: { taxation: 5 } });
    s.techTree = { economy_minted_coinage: { researched: true } };
    expect(canEnactLaw(s, 'fr', 'taxation', 'land_tax')).toBe(true);
  });
});

describe('getLawChangeCost', () => {
  const state = (nation) => ({ nations: { fr: nation } });

  it('is 50 x tier with no discounts', () => {
    expect(getLawChangeCost(state({ laws: {}, identity: {} }), 'fr', 'taxation', 'head_tax')).toBe(150); // tier 3
  });

  it('discounts Religion law changes when the nation leans Religious', () => {
    const cost = getLawChangeCost(state({ laws: {}, identity: { secularism: 50 } }), 'fr', 'religion', 'established_church');
    expect(cost).toBe(Math.round(50 * 2 * 0.75));
  });

  it('discounts Conscription/Land law changes when the nation leans Collectivist', () => {
    const identity = { collectivism: 50 };
    expect(getLawChangeCost(state({ laws: {}, identity }), 'fr', 'conscription', 'feudal_levy')).toBe(Math.round(50 * 2 * 0.75));
    expect(getLawChangeCost(state({ laws: {}, identity }), 'fr', 'land', 'manorialism')).toBe(Math.round(50 * 2 * 0.75));
  });

  it('discounts Taxation/Trade law changes when the nation leans Individualist', () => {
    const identity = { collectivism: -50 };
    expect(getLawChangeCost(state({ laws: {}, identity }), 'fr', 'taxation', 'land_tax')).toBe(Math.round(50 * 2 * 0.75));
  });

  it('stacks a lawCostMult reform on top of an identity discount', () => {
    const nation = { laws: {}, identity: { secularism: 50 }, government: { type: 'monarchy', reforms: { gunpowder: 'parliamentary_monarchy' } } };
    // Parliamentary Monarchy: -50% + Religious: -25% = 0.25x
    expect(getLawChangeCost(state(nation), 'fr', 'religion', 'established_church')).toBe(Math.round(50 * 2 * 0.25));
  });

  it('never goes negative', () => {
    const nation = { laws: {}, identity: { secularism: 50 }, government: { type: 'monarchy', reforms: { gunpowder: 'parliamentary_monarchy', modern: 'constitutional_monarchy' } } };
    expect(getLawChangeCost(state(nation), 'fr', 'religion', 'established_church')).toBeGreaterThanOrEqual(0);
  });
});

describe('getRequiredTechName', () => {
  it('returns the tech\'s name for a gated law', () => {
    expect(getRequiredTechName(getLaw('taxation', 'land_tax'))).toBe('Minted Coinage');
  });

  it('returns null for an ungated law', () => {
    expect(getRequiredTechName(getLaw('taxation', 'tribute'))).toBeNull();
  });
});
