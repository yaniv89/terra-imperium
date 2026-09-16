import { describe, it, expect } from 'vitest';
import { TECH_TREE, canResearchTech, getTechsByCategory, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from './techTree';
import { AGE_ORDER } from './ages';
import { TechCategories } from './types';

// The generic gating mechanism (canResearchTech) is exercised against its own small fixture table,
// passed explicitly as `techDefs` — this never touches the real production TECH_TREE, so these
// tests can freely construct exclusive/requiresAny scenarios the real linear-chain content doesn't
// use without polluting or depending on real content's shape.
const FIXTURE_TECH = {
  a: { id: 'a', category: 'military', cost: { gold: 100, techPoints: 5 }, prerequisites: [], effects: {}, yearAvailable: 1000 },
  b: { id: 'b', category: 'military', cost: { gold: 200, techPoints: 10 }, prerequisites: ['a'], effects: {}, yearAvailable: 1100 },
  c1: { id: 'c1', category: 'economy', cost: { gold: 300, techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c2'], effects: {}, yearAvailable: 1200 },
  c2: { id: 'c2', category: 'economy', cost: { gold: 300, techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c1'], effects: {}, yearAvailable: 1200 },
  d: { id: 'd', category: 'economy', cost: { gold: 400, techPoints: 20 }, prerequisites: ['c1', 'c2'], requiresAny: true, effects: {}, yearAvailable: 1300 }
};

const freshTree = (fixture = FIXTURE_TECH) => {
  const tree = {};
  Object.entries(fixture).forEach(([id, data]) => {
    tree[id] = { id, researched: false, available: data.yearAvailable <= 1000 };
  });
  return tree;
};

const richResources = { gold: 10000000, techPoints: 10000, actionPoints: 3 };

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

  it('rejects insufficient funds or tech points', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, { gold: 0, techPoints: 0, actionPoints: 3 }, 2000, FIXTURE_TECH).can).toBe(false);
  });

  it('rejects fewer than 2 action points regardless of funds', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, { gold: 10000000, techPoints: 10000, actionPoints: 1 }, 2000, FIXTURE_TECH).can).toBe(false);
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

  it('costs scale up with age', () => {
    Object.values(TechCategories).forEach(category => {
      const chain = AGE_ORDER.map(ageId => Object.values(TECH_TREE).find(t => t.category === category && t.ageId === ageId));
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].cost.gold).toBeGreaterThan(chain[i - 1].cost.gold);
      }
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
