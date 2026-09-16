// src/data/techTree.js
// Technology tree — the gating mechanism (canResearchTech) is generic and reused as-is from the
// original campaign; the tech CONTENT is intentionally empty here. Authoring the ~50-tech, 5-line,
// age-gated tree described in the plan ("Research tab") is later work (Phase D), built on top of
// this same yearAvailable/prerequisites/exclusiveWith shape once buildings and units exist for
// techs to unlock.

export const TECH_TREE = {};

// Get tech by category
export const getTechsByCategory = () => {
  const categories = {};
  Object.values(TECH_TREE).forEach(tech => {
    if (!categories[tech.category]) categories[tech.category] = { techs: [] };
    categories[tech.category].techs.push(tech);
  });
  Object.values(categories).forEach(cat => {
    cat.techs.sort((a, b) => a.yearAvailable - b.yearAvailable);
  });
  return categories;
};

// Check if tech can be researched
export const canResearchTech = (techId, techTree, resources, year) => {
  const tech = TECH_TREE[techId];
  const state = techTree[techId];

  if (!tech || !state) return { can: false, reason: 'Invalid tech' };
  if (state.researched) return { can: false, reason: 'Already researched' };
  if (tech.yearAvailable > year) return { can: false, reason: `Available in ${tech.yearAvailable}` };

  const hasPrereqs = tech.requiresAny
    ? tech.prerequisites.some(p => techTree[p]?.researched)
    : tech.prerequisites.every(p => techTree[p]?.researched);
  if (!hasPrereqs) return { can: false, reason: 'Prerequisites not met' };

  // Mutually exclusive techs: researching one locks out the other permanently for this game.
  const exclusiveResearched = (tech.exclusiveWith || []).find(id => techTree[id]?.researched);
  if (exclusiveResearched) {
    return { can: false, reason: `Exclusive with ${TECH_TREE[exclusiveResearched]?.name}` };
  }

  if (resources.money < tech.cost.money) return { can: false, reason: 'Insufficient funds' };
  if (resources.techPoints < tech.cost.techPoints) return { can: false, reason: 'Insufficient tech points' };
  if (resources.actionPoints < 2) return { can: false, reason: 'Need 2 AP' };

  return { can: true, reason: null };
};
