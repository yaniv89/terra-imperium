import { describe, it, expect } from 'vitest';
import { TECH_TREE, CROSS_PREREQUISITES, getTechsByCategory, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from './techTree';
import { techGraph } from '../components/panels/researchView';
import { createInitialState } from '../engine/gameReducer';
import { canStartTech, RESEARCH_AGE_BASE } from '../engine/research';
import { AGE_ORDER } from './ages';
import { TechCategories } from './types';

// The generic gating mechanism (canStartTech, src/engine/research.js) is exercised against its own
// small fixture table, passed explicitly as `techDefs`, so these tests can construct
// exclusive/requiresAny scenarios the real linear-chain content doesn't use. Research costs only
// science now (no power, no purchase), so there is no affordability to gate here.
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

const researchedOf = (tree) => new Set(Object.keys(tree).filter((id) => tree[id].researched));
const can = (id, tree, year) => canStartTech(id, researchedOf(tree), year, FIXTURE_TECH);

describe('canStartTech (generic gating, against a fixture table)', () => {
  it('rejects a tech whose exclusive counterpart is already researched', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    const check = can('c2', tree, 2000);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('Exclusive with');
  });

  it('allows either side of an exclusive pair when neither is researched yet', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(can('c1', tree, 2000).ok).toBe(true);
    expect(can('c2', tree, 2000).ok).toBe(true);
  });

  it('is startable with only ONE of two requiresAny prerequisites satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    expect(can('d', tree, 2000).ok).toBe(true);
  });

  it('is not startable with neither requiresAny prerequisite satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(can('d', tree, 2000).ok).toBe(false);
  });

  it('rejects a tech before its yearAvailable', () => {
    expect(can('a', freshTree(), 500).ok).toBe(false);
  });

  it('gates a real tech on its real prerequisite (default techDefs)', () => {
    const second = TECH_TREE.military_composite_bow;
    expect(canStartTech(second.id, new Set(), 3000).ok).toBe(false);
    expect(canStartTech(second.id, new Set(second.prerequisites), 3000).ok).toBe(true);
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

  it('the tech web (plan C3): every cross prerequisite is a tech of another line and an earlier or same year', () => {
    const byName = Object.fromEntries(Object.values(TECH_TREE).map((t) => [t.name, t]));
    const crossCount = Object.values(CROSS_PREREQUISITES).reduce((n, list) => n + list.length, 0);
    expect(crossCount).toBeGreaterThanOrEqual(15);
    Object.entries(CROSS_PREREQUISITES).forEach(([name, needs]) => {
      const tech = byName[name];
      expect(tech, name).toBeDefined();
      needs.forEach((needName) => {
        const need = byName[needName];
        expect(need, `${name} needs unknown ${needName}`).toBeDefined();
        expect(need.category, `${name} -> ${needName} must cross lines`).not.toBe(tech.category);
        expect(need.yearAvailable, `${name} -> ${needName} must not point forward`).toBeLessThanOrEqual(tech.yearAvailable);
        expect(tech.prerequisites).toContain(need.id);
      });
    });
    // No cycles: every prerequisite chain ends.
    const seen = new Set();
    const walk = (id, stack) => { expect(stack.has(id), `cycle at ${id}`).toBe(false); if (seen.has(id)) return; stack.add(id); TECH_TREE[id].prerequisites.forEach((p) => walk(p, stack)); stack.delete(id); seen.add(id); };
    Object.keys(TECH_TREE).forEach((id) => walk(id, new Set()));
  });

  it('a tech with a cross prerequisite needs the other line too (Siege Engineering needs Geometry)', () => {
    const siege = TECH_TREE.military_siege_engineering;
    const own = siege.prerequisites.filter((p) => TECH_TREE[p].category === 'military');
    expect(canStartTech(siege.id, new Set(own), 3000).ok).toBe(false);
    expect(canStartTech(siege.id, new Set(siege.prerequisites), 3000).ok).toBe(true);
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

  it('research costs rise with each age (src/engine/research.js RESEARCH_AGE_BASE)', () => {
    for (let i = 1; i < AGE_ORDER.length; i++) expect(RESEARCH_AGE_BASE[AGE_ORDER[i]]).toBeGreaterThanOrEqual(RESEARCH_AGE_BASE[AGE_ORDER[i - 1]]);
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

describe('techGraph (the research web view)', () => {
  it('lays out 5 rows of 10 columns with one edge per prerequisite and the cross edges marked', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 11 });
    const graph = techGraph(state);
    expect(graph.nodes.length).toBe(50);
    expect(graph.rows.length).toBe(5);
    expect(new Set(graph.nodes.map((n) => n.col)).size).toBe(10);
    const prereqCount = Object.values(TECH_TREE).reduce((n, t) => n + t.prerequisites.length, 0);
    expect(graph.edges.length).toBe(prereqCount);
    const crossCount = Object.values(CROSS_PREREQUISITES).reduce((n, list) => n + list.length, 0);
    expect(graph.edges.filter((e) => e.cross).length).toBe(crossCount);
    graph.edges.forEach((e) => expect(e.x2 > e.x1 || (e.x1 === e.x2 && e.y1 !== e.y2), `${e.from} -> ${e.to} runs forward or vertically`).toBe(true));
    expect(graph.ages.length).toBe(5);
    expect(graph.width).toBe(graph.ages[4].x + graph.ages[4].width);
    const statuses = new Set(graph.nodes.map((n) => n.status));
    expect(statuses.has('locked')).toBe(true);
    expect(graph.nodes.filter((n) => n.status === 'available' || n.status === 'current').length).toBeGreaterThan(0);
  });
});
