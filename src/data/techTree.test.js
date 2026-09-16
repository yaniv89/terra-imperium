import { describe, it, expect } from 'vitest';
import { TECH_TREE, canResearchTech, getTechsByCategory } from './techTree';

// TECH_TREE content is empty for now (Phase D authors it against the new age/resource model) —
// these tests exercise the generic gating mechanism itself against a small fixture tree, the same
// shape real content will eventually have.
const FIXTURE_TECH = {
  a: { id: 'a', category: 'military', cost: { money: 100, techPoints: 5 }, prerequisites: [], effects: {}, yearAvailable: 1000 },
  b: { id: 'b', category: 'military', cost: { money: 200, techPoints: 10 }, prerequisites: ['a'], effects: {}, yearAvailable: 1100 },
  c1: { id: 'c1', category: 'economy', cost: { money: 300, techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c2'], effects: {}, yearAvailable: 1200 },
  c2: { id: 'c2', category: 'economy', cost: { money: 300, techPoints: 15 }, prerequisites: ['a'], exclusiveWith: ['c1'], effects: {}, yearAvailable: 1200 },
  d: { id: 'd', category: 'economy', cost: { money: 400, techPoints: 20 }, prerequisites: ['c1', 'c2'], requiresAny: true, effects: {}, yearAvailable: 1300 }
};

const freshTree = (fixture = FIXTURE_TECH) => {
  const tree = {};
  Object.entries(fixture).forEach(([id, data]) => {
    tree[id] = { id, researched: false, available: data.yearAvailable <= 1000 };
  });
  return tree;
};

const richResources = { money: 10000000, techPoints: 10000, actionPoints: 3 };

// canResearchTech reads its tech definitions from this module's own TECH_TREE, which is real
// content (currently empty). Swap it in for the duration of this describe block so the generic
// gating logic can be tested against a realistic fixture without waiting on Phase D's content.
Object.assign(TECH_TREE, FIXTURE_TECH);

describe('canResearchTech', () => {
  it('rejects a tech whose exclusive counterpart is already researched', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    const check = canResearchTech('c2', tree, richResources, 2000);
    expect(check.can).toBe(false);
    expect(check.reason).toContain('Exclusive with');
  });

  it('allows either side of an exclusive pair when neither is researched yet', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(canResearchTech('c1', tree, richResources, 2000).can).toBe(true);
    expect(canResearchTech('c2', tree, richResources, 2000).can).toBe(true);
  });

  it('is researchable with only ONE of two requiresAny prerequisites satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    tree.c1.researched = true;
    expect(canResearchTech('d', tree, richResources, 2000).can).toBe(true);
  });

  it('is not researchable with neither requiresAny prerequisite satisfied', () => {
    const tree = freshTree();
    tree.a.researched = true;
    expect(canResearchTech('d', tree, richResources, 2000).can).toBe(false);
  });

  it('rejects a tech before its yearAvailable', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, richResources, 500).can).toBe(false);
  });

  it('rejects insufficient funds or tech points', () => {
    const tree = freshTree();
    expect(canResearchTech('a', tree, { money: 0, techPoints: 0, actionPoints: 3 }, 2000).can).toBe(false);
  });
});

describe('getTechsByCategory', () => {
  it('groups every tech under its category', () => {
    const categories = getTechsByCategory();
    expect(categories.military.techs.map(t => t.id).sort()).toEqual(['a', 'b']);
    expect(categories.economy.techs.map(t => t.id).sort()).toEqual(['c1', 'c2', 'd']);
  });
});
