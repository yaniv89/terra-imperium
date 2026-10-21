import { describe, it, expect } from 'vitest';
import { TECH_TREE, CROSS_PREREQUISITES, getTechsByCategory, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD } from './techTree';
import { techGraph, GRAPH_COL_W, GRAPH_THIN_W } from '../components/panels/researchView';
import { canStartTech, RESEARCH_AGE_BASE } from '../engine/research';
import { AGE_ORDER, getAgeIndex, LAST_AGE_ID } from './ages';
import { TechCategories } from './types';
import { peoplesWorld } from '../engine/testWorld';

// The generic gating mechanism (canStartTech, src/engine/research.js) is exercised against its own
// small fixture table, passed explicitly as `techDefs`, so these tests can construct
// exclusive/requiresAny scenarios the real linear-chain content doesn't use. Research costs only
// science now (no power, no purchase), so there is no affordability to gate here.
const FIXTURE_TECH = {
  a: { id: 'a', category: 'military', ageId: 'bronze', cost: { techPoints: 5 }, prerequisites: [], effects: {}, lineIndex: 0 },
  b: { id: 'b', category: 'military', ageId: 'bronze', cost: { techPoints: 10 }, prerequisites: ['a'], effects: {}, lineIndex: 1 },
  c1: { id: 'c1', category: 'economy', ageId: 'bronze', cost: { techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c2'], effects: {}, lineIndex: 2 },
  c2: { id: 'c2', category: 'economy', ageId: 'bronze', cost: { techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c1'], effects: {}, lineIndex: 2 },
  d: { id: 'd', category: 'economy', ageId: 'bronze', cost: { techPoints: 20 }, prerequisites: ['c1', 'c2'], requiresAny: true, effects: {}, lineIndex: 3 }
};

const freshTree = (fixture = FIXTURE_TECH) => {
  const tree = {};
  Object.keys(fixture).forEach((id) => {
    tree[id] = { id, researched: false };
  });
  return tree;
};

const researchedOf = (tree) => new Set(Object.keys(tree).filter((id) => tree[id].researched));
const can = (id, tree, ageId = 'bronze') => canStartTech(id, researchedOf(tree), ageId, FIXTURE_TECH);

describe('canStartTech (generic gating, against a fixture table)', () => {
  it('rejects a tech whose exclusive counterpart is already researched', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    const check = can('c2', tree);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('Exclusive with');
  });

  it('allows either side of an exclusive pair when neither is researched yet', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(can('c1', tree).ok).toBe(true);
    expect(can('c2', tree).ok).toBe(true);
  });

  it('is startable with only ONE of two requiresAny prerequisites satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    expect(can('d', tree).ok).toBe(true);
  });

  it('is not startable with neither requiresAny prerequisite satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(can('d', tree).ok).toBe(false);
  });

  it('allows the nation\'s own age and the next only (the research window, KTD4)', () => {
    const kingdoms = { ...FIXTURE_TECH.a, id: 'k', ageId: 'kingdoms' };
    const classical = { ...FIXTURE_TECH.a, id: 'c', ageId: 'classical' };
    const defs = { ...FIXTURE_TECH, k: kingdoms, c: classical };
    expect(canStartTech('c', new Set(), 'bronze', defs).ok).toBe(true);
    const late = canStartTech('k', new Set(), 'bronze', defs);
    expect(late.ok).toBe(false);
    expect(late.reason).toBe('Reach the Classical Age first');
    expect(canStartTech('k', new Set(), 'classical', defs).ok).toBe(true);
    expect(canStartTech('k', new Set(), 'kingdoms', defs).ok).toBe(true);
  });

  it('gates a real tech on its real prerequisite (default techDefs)', () => {
    const second = TECH_TREE.military_composite_bow;
    expect(canStartTech(second.id, new Set(), 'bronze').ok).toBe(false);
    expect(canStartTech(second.id, new Set(second.prerequisites), 'bronze').ok).toBe(true);
  });
});

describe('real TECH_TREE content integrity', () => {
  const base = () => Object.values(TECH_TREE).filter((t) => !t.outsideThreshold);
  it('has exactly 10 techs per age, plus the two robot techs and Future Tech outside the threshold (U65)', () => {
    expect(base().length).toBe(AGE_ORDER.length * 10);
    const extra = Object.values(TECH_TREE).filter((t) => t.outsideThreshold);
    expect(extra.map((t) => t.id).sort()).toEqual(['governance_future_tech', 'military_autonomous_warfare', 'science_machine_consciousness']);
    extra.forEach((t) => expect(t.ageId).toBe('future'));
    expect(extra.filter((t) => t.repeatable).map((t) => t.id)).toEqual(['governance_future_tech']);
  });

  it('has exactly 10 techs per category, 2 per age', () => {
    Object.values(TechCategories).forEach(category => {
      const techs = base().filter(t => t.category === category);
      expect(techs.length, category).toBe(AGE_ORDER.length * 2);
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

  it('the tech web (plan C3): every cross prerequisite is a tech of another line and an earlier or the same step', () => {
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
        const step = (t) => getAgeIndex(t.ageId) * 2 + (t.lineIndex % 2);
        expect(step(need), `${name} -> ${needName} must not point forward`).toBeLessThanOrEqual(step(tech));
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
    expect(canStartTech(siege.id, new Set(own), LAST_AGE_ID).ok).toBe(false);
    expect(canStartTech(siege.id, new Set(siege.prerequisites), LAST_AGE_ID).ok).toBe(true);
  });

  it('lineIndex counts up along each category\'s chain, two per age in age order', () => {
    Object.values(TechCategories).forEach(category => {
      const chain = Object.values(TECH_TREE)
        .filter(t => t.category === category)
        .sort((a, b) => a.lineIndex - b.lineIndex);
      chain.forEach((t, i) => { expect(t.lineIndex).toBe(i); expect(t.ageId).toBe(t.outsideThreshold ? 'future' : AGE_ORDER[Math.floor(i / 2)]); });
      expect(chain.slice(AGE_ORDER.length * 2).every((t) => t.outsideThreshold), `${category}: extras come last`).toBe(true);
    });
  });

  it('no cliff from Classical on: an age costs at most 4 times the one before (follow-up 17: Kingdoms was 15 times)', () => {
    for (let i = getAgeIndex('kingdoms'); i < AGE_ORDER.length; i++) expect(RESEARCH_AGE_BASE[AGE_ORDER[i]] / RESEARCH_AGE_BASE[AGE_ORDER[i - 1]], AGE_ORDER[i]).toBeLessThanOrEqual(4);
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
        expect(['goldMult', 'hrMult', 'techPointsMult', 'stabilityBonus', 'popGrowthBonus', 'decreePace',
          'opinion', 'developmentCost', 'buildingCost', 'researchCost',
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
  it('groups every real tech under its category, in line order', () => {
    const categories = getTechsByCategory();
    Object.values(TechCategories).forEach(category => {
      const techs = categories[category].techs.filter((t) => !t.outsideThreshold);
      expect(techs.length).toBe(AGE_ORDER.length * 2);
      expect(techs.map(t => t.lineIndex)).toEqual(AGE_ORDER.flatMap((_, i) => [2 * i, 2 * i + 1]));
    });
  });
});

describe('techGraph (the research web view)', () => {
  it('a collapsed age is one thin column with no techs and the edges to it are gone (jump strip)', () => {
    const state = peoplesWorld({ seed: 11 });
    const open = techGraph(state);
    const thin = techGraph(state, ['stone']);
    expect(thin.nodes.length).toBe(open.nodes.length - 10);
    expect(thin.nodes.some((n) => n.ageId === 'stone')).toBe(false);
    expect(thin.ages[0]).toMatchObject({ ageId: 'stone', x: 0, width: GRAPH_THIN_W, collapsed: true });
    expect(thin.ages[1].x).toBe(GRAPH_THIN_W);
    expect(thin.width).toBe(open.width - 2 * GRAPH_COL_W + GRAPH_THIN_W);
    thin.edges.forEach((e) => expect(e.x2 > e.x1 || (e.x1 === e.x2 && e.y1 !== e.y2)).toBe(true));
  });

  it('lays out one row per line, two columns per age (three in the Future), with one edge per prerequisite and the cross edges marked', () => {
    const state = peoplesWorld({ seed: 11 });
    const graph = techGraph(state);
    expect(graph.nodes.length).toBe(Object.keys(TECH_TREE).length);
    expect(graph.rows.length).toBe(Object.values(TechCategories).length);
    expect(new Set(graph.nodes.map((n) => n.col)).size).toBe(AGE_ORDER.length * 2 + 1);
    expect(graph.ages[AGE_ORDER.length - 1].width).toBe(3 * GRAPH_COL_W);
    const prereqCount = Object.values(TECH_TREE).reduce((n, t) => n + t.prerequisites.length, 0);
    expect(graph.edges.length).toBe(prereqCount);
    const crossCount = Object.values(CROSS_PREREQUISITES).reduce((n, list) => n + list.length, 0);
    expect(graph.edges.filter((e) => e.cross).length).toBe(crossCount);
    graph.edges.forEach((e) => expect(e.x2 > e.x1 || (e.x1 === e.x2 && e.y1 !== e.y2), `${e.from} -> ${e.to} runs forward or vertically`).toBe(true));
    expect(graph.ages.length).toBe(AGE_ORDER.length);
    const lastAge = graph.ages[AGE_ORDER.length - 1];
    expect(graph.width).toBe(lastAge.x + lastAge.width);
    const statuses = new Set(graph.nodes.map((n) => n.status));
    expect(statuses.has('locked')).toBe(true);
    expect(graph.nodes.filter((n) => n.status === 'available' || n.status === 'current').length).toBeGreaterThan(0);
  });
});
