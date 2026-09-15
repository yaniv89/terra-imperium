import { describe, it, expect } from 'vitest';
import { TECH_TREE, canResearchTech } from './techTree';

const freshTechTree = () => {
  const tree = {};
  Object.entries(TECH_TREE).forEach(([id, data]) => {
    tree[id] = { id, researched: false, available: data.yearAvailable <= 1870 };
  });
  return tree;
};

const richResources = { money: 10000000, techPoints: 10000, actionPoints: 3 };

describe('canResearchTech exclusivity (Phase 5: branching tech)', () => {
  it('rejects a tech whose exclusive counterpart is already researched', () => {
    const tree = freshTechTree();
    tree.haganah_doctrine.researched = true;
    tree.uzi_production.researched = true;
    tree.merkava_mk1.researched = true;

    const check = canResearchTech('air_superiority', tree, richResources, 2000);
    expect(check.can).toBe(false);
    expect(check.reason).toContain('Exclusive with');
  });

  it('allows either side of an exclusive pair when neither is researched yet', () => {
    const tree = freshTechTree();
    tree.haganah_doctrine.researched = true;
    tree.uzi_production.researched = true;

    expect(canResearchTech('merkava_mk1', tree, richResources, 2000).can).toBe(true);
    expect(canResearchTech('air_superiority', tree, richResources, 2000).can).toBe(true);
  });

  it('rejects researching both mutually exclusive nodes in either order', () => {
    const tree = freshTechTree();
    tree.radio_networks.researched = true;
    tree.mossad_formation.researched = true;

    expect(canResearchTech('open_diplomacy', tree, richResources, 2000).can).toBe(false);
  });
});

describe('canResearchTech requiresAny (Phase 5: Iron Dome doesn\'t need both doctrines)', () => {
  it('is researchable with only ONE of its two prerequisites satisfied', () => {
    const tree = freshTechTree();
    tree.haganah_doctrine.researched = true;
    tree.uzi_production.researched = true;
    tree.merkava_mk1.researched = true;
    // air_superiority deliberately NOT researched.

    expect(canResearchTech('iron_dome', tree, richResources, 2020).can).toBe(true);
  });

  it('is not researchable with neither prerequisite satisfied', () => {
    const tree = freshTechTree();
    tree.haganah_doctrine.researched = true;
    tree.uzi_production.researched = true;

    expect(canResearchTech('iron_dome', tree, richResources, 2020).can).toBe(false);
  });
});

describe('tech data integrity', () => {
  it('every exclusiveWith reference points to a real, reciprocal tech', () => {
    Object.entries(TECH_TREE).forEach(([id, tech]) => {
      (tech.exclusiveWith || []).forEach(otherId => {
        expect(TECH_TREE[otherId], `${id} references unknown tech ${otherId}`).toBeDefined();
        expect(TECH_TREE[otherId].exclusiveWith || [], `${otherId} does not reciprocally exclude ${id}`).toContain(id);
      });
    });
  });

  it('every prerequisite reference points to a real tech', () => {
    Object.entries(TECH_TREE).forEach(([id, tech]) => {
      tech.prerequisites.forEach(p => {
        expect(TECH_TREE[p], `${id} references unknown prerequisite ${p}`).toBeDefined();
      });
    });
  });
});
