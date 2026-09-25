import { describe, it, expect } from 'vitest';
import { TECH_TREE, canResearchTech, getTechsByCategory, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD, getTechPowerCost } from './techTree';
import { AGE_ORDER } from './ages';
import { TechCategories } from './types';

// The generic gating mechanism (canResearchTech) is exercised against its own small fixture table,
// passed explicitly as `techDefs` — this never touches the real production TECH_TREE, so these
// tests can freely construct exclusive/requiresAny scenarios the real linear-chain content doesn't
// use without polluting or depending on real content's shape. Plan §M7: gold is gone from tech
// cost — only techPoints, plus a power cost (getTechPowerCost) computed from the tech's own ageId.
const FIXTURE_TECH = {
  a: { id: 'a', category: 'military', ageId: 'bronze', cost: { techPoints: 5 }, prerequisites: [], effects: {}, yearAvailable: 1000 },
  b: { id: 'b', category: 'military', ageId: 'bronze', cost: { techPoints: 10 }, prerequisites: ['a'], effects: {}, yearAvailable: 1100 },
  c1: { id: 'c1', category: 'economy', ageId: 'bronze', cost: { techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c2'], effects: {}, yearAvailable: 1200 },
  c2: { id: 'c2', category: 'economy', ageId: 'bronze', cost: { techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c1'], effects: {}, yearAvailable: 1200 },
  d: { id: 'd', category: 'economy', ageId: 'bronze', cost: { techPoints: 20 }, prerequisites: ['c1', 'c2'], requiresAny: true, effects: {}, yearAvailable: 1300 }
};

const freshTree = (fixture = FIXTURE_TECH) => {
  const tree = {};
  Object.entries(fixture).forEach(([id, data]) => {
    tree[id] = { id, researched: false, available: data.yearAvailable <= 1000 };
  });
  return tree;
};

// Every fixture tech is Bronze-age (ageIndex 0), so getTechPowerCost is 40 for all of them —
// richResources needs enough of every pool to clear that, not just the old flat power cost of 2.
const richResources = { techPoints: 10000, adm: 1000, dip: 1000, mil: 1000 };

describe('canResearchTech (generic gating, against a fixture table)', () => {
  it('rejects a tech whose exclusive counterpart is already researched', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    const check = canResearchTech('c2', tree, richResources, 2000, FIXTURE_TECH);
    expect(check.can).toBe(false);
    expect(check.reason).toContain('Exclusive with');
  });

  it('allows either side of an exclusive pair when neither is researched yet', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(canResearchTech('c1', tree, richResources, 2000, FIXTURE_TECH).can).toBe(true);
    expect(canResearchTech('c2', tree, richResources, 2000, FIXTURE_TECH).can).toBe(true);
  });

  it('is researchable with only ONE of two requiresAny prerequisites satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    expect(canResearchTech('d', tree, richResources, 2000, FIXTURE_TECH).can).toBe(true);
  });

  it('is not researchable with neither requiresAny prerequisite satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(canResearchTech('d', tree, richResources, 2000, FIXTURE_TECH).can).toBe(false);
  });

  it('rejects a tech before its yearAvailable', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, richResources, 500, FIXTURE_TECH).can).toBe(false);
  });

  it('rejects insufficient tech points', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, { techPoints: 0, mil: 1000 }, 2000, FIXTURE_TECH).can).toBe(false);
  });

  // Tech 'a' is category 'military', which draws from the MIL pool (TECH_RESEARCH_POOL,
  // src/data/actionCosts.js) — insufficient power in that specific pool blocks research even with
  // unlimited ADM/DIP/techPoints.
  it('rejects insufficient power in the tech\'s own pool regardless of funds or other pools', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, { techPoints: 10000, adm: 1000, dip: 1000, mil: 1 }, 2000, FIXTURE_TECH).can).toBe(false);
  });

  it('scales the affordability check up by agesBehind\'s research-cost multiplier', () => {
    const tree = freshTree();
    // tech 'a' costs techPoints: 5, power: 40 (Bronze) — exactly affordable at 1x, not at 1.3x.
    const exact = { techPoints: 5, mil: 40 };
    expect(canResearchTech('a', tree, exact, 2000, FIXTURE_TECH, 0).can).toBe(true);
    expect(canResearchTech('a', tree, exact, 2000, FIXTURE_TECH, 1).can).toBe(false);
  });
});

describe('getTechPowerCost (plan §M7: 40 + 30 x ageIndex, before ages-behind)', () => {
  it('is exactly 40 for a Bronze-age tech with no discounts', () => {
    expect(getTechPowerCost(TECH_TREE.military_bronze_casting)).toBe(40);
  });

  it('is exactly 160 for a Modern-age tech with no discounts', () => {
    expect(getTechPowerCost(TECH_TREE.military_mechanized_warfare)).toBe(160);
  });

  it('applies a positive researchCostMult as a surcharge', () => {
    const base = getTechPowerCost(TECH_TREE.military_bronze_casting);
    const surcharged = getTechPowerCost(TECH_TREE.military_bronze_casting, { researchCostMult: 0.5 });
    expect(surcharged).toBe(Math.round(base * 1.5));
  });

  it('applies exactly -15% when focused on the tech\'s own line (Research Focus)', () => {
    const base = getTechPowerCost(TECH_TREE.military_bronze_casting);
    const focused = getTechPowerCost(TECH_TREE.military_bronze_casting, { focused: true });
    expect(focused).toBe(Math.round(base * 0.85));
  });

  it('stacks researchCostMult and the focus discount multiplicatively', () => {
    const both = getTechPowerCost(TECH_TREE.military_bronze_casting, { researchCostMult: -0.1, focused: true });
    expect(both).toBe(Math.round(40 * 0.9 * 0.85));
  });
});

describe('canResearchTech against the real TECH_TREE (default techDefs)', () => {
  it('gates a real tech on its real prerequisite', () => {
    const tree = {};
    Object.keys(TECH_TREE).forEach(id => { tree[id] = { id, researched: false }; });
    const second = TECH_TREE.military_composite_bow;
    expect(canResearchTech(second.id, tree, richResources, 3000).can).toBe(false);
    tree[second.prerequisites[0]].researched = true;
    expect(canResearchTech(second.id, tree, richResources, 3000).can).toBe(true);
  });
});

describe('real TECH_TREE content integrity', () => {
  it('has exactly 50 techs', () => {
    expect(Object.keys(TECH_TREE).length).toBe(50);
  });

  it('has exactly 10 techs per category, 2 per age', () => {
    Object.values(TechCategories).forEach(category => {
      const techs = Object.values(TECH_TREE).filter(t => t.category === category);
      expect(techs.length, category).toBe(10);
      AGE_ORDER.forEach(ageId => {
        expect(techs.filter(t => t.ageId === ageId).length, `${category}/${ageId}`).toBe(2);
      });
    });
  });

  it('every non-first tech in a line requires the previous one', () => {
    Object.values(TECH_TREE).forEach(tech => {
      tech.prerequisites.forEach(p => {
        expect(TECH_TREE[p], `${tech.id} requires unknown tech ${p}`).toBeDefined();
      });
    });
  });

  it('yearAvailable strictly increases along each category\'s chain', () => {
    Object.values(TechCategories).forEach(category => {
      const chain = Object.values(TECH_TREE)
        .filter(t => t.category === category)
        .sort((a, b) => a.yearAvailable - b.yearAvailable);
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].yearAvailable).toBeGreaterThan(chain[i - 1].yearAvailable);
      }
    });
  });

  it('techPoints cost and power cost both scale up with age', () => {
    Object.values(TechCategories).forEach(category => {
      const chain = AGE_ORDER.map(ageId => Object.values(TECH_TREE).find(t => t.category === category && t.ageId === ageId));
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].cost.techPoints).toBeGreaterThan(chain[i - 1].cost.techPoints);
        expect(getTechPowerCost(chain[i])).toBeGreaterThan(getTechPowerCost(chain[i - 1]));
      }
    });
  });

  it('every tech\'s cost object has no gold key at all (plan §M7: gold removed from research)', () => {
    Object.values(TECH_TREE).forEach((tech) => {
      expect(tech.cost).not.toHaveProperty('gold');
    });
  });

  it('every tech\'s effects (when present) use a real, wired modifier hook', () => {
    // Mirrors traits.test.js's own check — every tech that DOES declare an effect must use a hook
    // LEGACY_HOOK actually maps, or it would silently do nothing once researched.
    Object.values(TECH_TREE).forEach((tech) => {
      Object.keys(tech.effects || {}).forEach((hook) => {
        expect(['goldMult', 'hrMult', 'techPointsMult', 'stabilityBonus', 'popGrowthBonus', 'apBonus',
          'admBonus', 'dipBonus', 'milBonus', 'developmentCost', 'buildingCost', 'researchCost',
          'stabilityCost', 'supplyRange', 'attrition']).toContain(hook);
      });
    });
  });

  it('getTechsForAge returns exactly the advancement-threshold-relevant set for an age', () => {
    const bronzeTechs = getTechsForAge('bronze');
    expect(bronzeTechs.length).toBe(10);
    expect(TECH_AGE_ADVANCEMENT_THRESHOLD).toBeLessThanOrEqual(bronzeTechs.length);
  });
});

describe('getTechsByCategory', () => {
  it('groups every real tech under its category, sorted by yearAvailable', () => {
    const categories = getTechsByCategory();
    Object.values(TechCategories).forEach(category => {
      expect(categories[category].techs.length).toBe(10);
      const years = categories[category].techs.map(t => t.yearAvailable);
      expect(years).toEqual([...years].sort((a, b) => a - b));
    });
  });
});
