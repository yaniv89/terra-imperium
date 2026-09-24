// src/data/techTree.js
// The ~50-tech, 5-line, age-gated Research tree (plan's "Research tab"). Each of the 5
// TechCategories (src/data/types.js) gets a simple 10-tech linear chain, two techs per age,
// covering all five ages — researching later techs requires the one before it in the same line.
//
// A tech's payoff is the plan's own framing: research enough of your current age's line and your
// empire's tech-earned age (state.techAgeId, advanced by GameContext.jsx's RESEARCH_TECH) catches
// up to the next one — which is what src/data/ages.js's already-existing getEffectiveAgeId was
// built for. GameContext.jsx now passes that effective age to canBuildTier, getAvailableClasses
// and canBuildExtraction instead of the raw calendar age.
//
// For unit recruitment this is a genuine new capability: getAvailableClasses has no rush allowance
// of its own, so reaching a tech-earned age ahead of the calendar is the only way to recruit that
// age's unit classes early. For buildings/extraction it currently coincides with, rather than adds
// to, Phase B's own unconditional "rush one tier ahead of the calendar" allowance already built
// into canBuildTier/canBuildExtraction — both cap at the same calendarAge+1 ceiling either way, so
// tech doesn't yet buy a builder anything a flat gold spend didn't already. Making rushing actually
// require earned tech (removing that free allowance) is a real, separate design change to Phase
// B's tested behavior, not something this task's tech-content scope should do unilaterally.

import { AGE_ORDER, AGES, getAgesBehindResearchCostMultiplier } from './ages';
import { TechCategories } from './types';
import { ACTION_COSTS, TECH_RESEARCH_POOL } from './actionCosts';

const CATEGORY_LINES = {
  [TechCategories.MILITARY]: [
    'Bronze Casting', 'Composite Bow',
    'Iron Weapons', 'Siege Engineering',
    'Feudal Levies', 'Plate Armor',
    'Gunpowder Weapons', 'Standing Armies',
    'Mechanized Warfare', 'Precision Guidance'
  ],
  [TechCategories.ECONOMY]: [
    'Bronze Trade Routes', 'Granary Storage',
    'Minted Coinage', 'Silk Road Trade',
    'Guild Charters', 'Banking Houses',
    'Joint-Stock Companies', 'Colonial Trade',
    'Industrial Capital', 'Global Markets'
  ],
  [TechCategories.INFRASTRUCTURE]: [
    'Irrigation Canals', 'Mudbrick Roads',
    'Paved Roads', 'Aqueducts',
    'Stone Bridges', 'Postal Relay',
    'Canal Locks', 'Turnpike Roads',
    'Rail Networks', 'Highway Systems'
  ],
  [TechCategories.GOVERNANCE]: [
    'Code of Laws', 'Scribal Bureaucracy',
    'Civic Assemblies', 'Provincial Administration',
    'Feudal Charters', 'Royal Chancery',
    'Bureaucratic Reform', 'Constitutional Law',
    'Civil Service', 'Digital Administration'
  ],
  [TechCategories.SCIENCE]: [
    'Cuneiform Records', 'Early Astronomy',
    'Geometry', 'Natural Philosophy',
    'Scholastic Method', 'Optics',
    'Scientific Method', 'Calculus',
    'Computing', 'Genomics'
  ]
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const buildLine = (category, names) => {
  const techs = {};
  names.forEach((name, i) => {
    const ageIndex = Math.floor(i / 2);
    const ageId = AGE_ORDER[ageIndex];
    const age = AGES[ageId];
    const isSecondOfAge = i % 2 === 1;
    const id = `${category}_${slug(name)}`;
    const previousId = i === 0 ? null : `${category}_${slug(names[i - 1])}`;
    techs[id] = {
      id,
      name,
      category,
      ageId,
      // Staggered within the age so the second tech isn't available the instant the age begins.
      yearAvailable: isSecondOfAge ? Math.round(age.startYear + (age.endYear - age.startYear) * 0.5) : age.startYear,
      prerequisites: previousId ? [previousId] : [],
      requiresAny: false,
      exclusiveWith: [],
      cost: { gold: 40 + ageIndex * 40, techPoints: 10 + ageIndex * 15 }
    };
  });
  return techs;
};

export const TECH_TREE = Object.entries(CATEGORY_LINES).reduce((acc, [category, names]) => {
  return { ...acc, ...buildLine(category, names) };
}, {});

// How many of a given age's techs (across all 5 lines) must be researched before a nation's
// tech-earned age (state.techAgeId) advances to the next one — a majority, not all ten, so
// falling behind in one line doesn't lock out the reward from the other four.
export const TECH_AGE_ADVANCEMENT_THRESHOLD = 6;

export const getTechsForAge = (ageId) => Object.values(TECH_TREE).filter((t) => t.ageId === ageId);

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

// Check if tech can be researched. `techDefs` defaults to the real TECH_TREE — tests pass their
// own fixture table instead, so exercising the generic gating logic never has to mutate the real
// production tree. `agesBehind` (src/data/ages.js's getAgesBehind) scales the affordability check
// by the same ages-behind research-cost multiplier the reducer actually deducts — otherwise a
// player could see "can research" here while the reducer charges them a scaled-up cost they can't
// afford.
export const canResearchTech = (techId, techTree, resources, year, techDefs = TECH_TREE, agesBehind = 0) => {
  const tech = techDefs[techId];
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
    return { can: false, reason: `Exclusive with ${techDefs[exclusiveResearched]?.name}` };
  }

  const costMult = getAgesBehindResearchCostMultiplier(agesBehind);
  if (resources.gold < tech.cost.gold * costMult) return { can: false, reason: 'Insufficient funds' };
  if (resources.techPoints < tech.cost.techPoints * costMult) return { can: false, reason: 'Insufficient tech points' };
  // Plan §M2/§M7: which power pool gates this depends on the tech's own line.
  const pool = TECH_RESEARCH_POOL[tech.category];
  if ((resources[pool] || 0) < ACTION_COSTS.researchTech.power) {
    return { can: false, reason: `Need ${ACTION_COSTS.researchTech.power} ${pool.toUpperCase()}` };
  }

  return { can: true, reason: null };
};
