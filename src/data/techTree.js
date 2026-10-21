// src/data/techTree.js
// The ~50-tech, 5-line, age-gated Research tree (plan's "Research tab"). Each of the 5
// TechCategories (src/data/types.js) gets a simple 10-tech linear chain, two techs per age,
// covering all five ages — researching later techs requires the one before it in the same line.
//
// A tech's payoff is the plan's own framing: research enough of your current age's line and your
// empire's tech-earned age (state.techAgeId, advanced by GameContext.jsx's RESEARCH_TECH) catches
// up to the next one. That research age is the nation's age and nothing else (ageOf in
// src/engine/nationState.js; eight-ages plan KTD1): no calendar floor and no cap.
//
// Research cost: science only, by age (src/engine/research.js RESEARCH_AGE_BASE); the old
// per-tech `cost.techPoints` below is kept only as data. Building/tech unlocks named in the plan's own §M6.3/§M7
// tables are wired as REAL effects wherever this codebase already has the hook to receive them
// (most of the building unlocks are src/data/buildings.js's own requiresTech, already wired in
// M6): every tech below whose plan-described effect maps onto an EXISTING, consumed modifier hook
// (power pools, tax/production/manpower income, tech points, population growth, development/
// building/research/stability cost, unrest) gets that real effect via TECH_EFFECTS. A tech whose
// plan-described effect names a system that doesn't exist yet (combat/siege/naval damage,
// movement, attrition-by-terrain, laws/reforms, trade pact capacity, event
// chances) is left with no `effects` entry — it's still real progression (its own prerequisite
// chain, its building unlocks where those exist), just not a faked modifier line. Those systems'
// own milestones (M8/M9/M11/M12/M14/M17) are where those techs' remaining effects get wired.

import { TechCategories } from './types';

// Each line lists its techs oldest first, each with its age: a tech's age is where it is listed,
// not its position, so a tech can move to another age (or an age be added) keeping its id and saves.
const CATEGORY_LINES = {
  [TechCategories.MILITARY]: [
    { name: 'Hunting Bands', age: 'stone' }, { name: 'Copper Working', age: 'stone' },
    { name: 'Bronze Casting', age: 'bronze' }, { name: 'Composite Bow', age: 'bronze' },
    { name: 'Iron Weapons', age: 'classical' }, { name: 'Siege Engineering', age: 'classical' },
    { name: 'Feudal Levies', age: 'kingdoms' }, { name: 'Plate Armor', age: 'kingdoms' },
    { name: 'Gunpowder Weapons', age: 'gunpowder' }, { name: 'Standing Armies', age: 'gunpowder' },
    { name: 'Mechanized Warfare', age: 'modern' }, { name: 'Precision Guidance', age: 'modern' }
  ],
  [TechCategories.ECONOMY]: [
    { name: 'Agriculture', age: 'stone' }, { name: 'Animal Husbandry', age: 'stone' },
    { name: 'Bronze Trade Routes', age: 'bronze' }, { name: 'Granary Storage', age: 'bronze' },
    { name: 'Minted Coinage', age: 'classical' }, { name: 'Silk Road Trade', age: 'classical' },
    { name: 'Guild Charters', age: 'kingdoms' }, { name: 'Banking Houses', age: 'kingdoms' },
    { name: 'Joint-Stock Companies', age: 'gunpowder' }, { name: 'Colonial Trade', age: 'gunpowder' },
    { name: 'Industrial Capital', age: 'modern' }, { name: 'Global Markets', age: 'modern' }
  ],
  [TechCategories.INFRASTRUCTURE]: [
    { name: 'Pottery', age: 'stone' }, { name: 'The Wheel', age: 'stone' },
    { name: 'Irrigation Canals', age: 'bronze' }, { name: 'Mudbrick Roads', age: 'bronze' },
    { name: 'Paved Roads', age: 'classical' }, { name: 'Aqueducts', age: 'classical' },
    { name: 'Stone Bridges', age: 'kingdoms' }, { name: 'Postal Relay', age: 'kingdoms' },
    { name: 'Canal Locks', age: 'gunpowder' }, { name: 'Turnpike Roads', age: 'gunpowder' },
    { name: 'Rail Networks', age: 'modern' }, { name: 'Highway Systems', age: 'modern' }
  ],
  [TechCategories.GOVERNANCE]: [
    { name: 'Chiefdoms', age: 'stone' }, { name: 'Sacred Kingship', age: 'stone' },
    { name: 'Code of Laws', age: 'bronze' }, { name: 'Scribal Bureaucracy', age: 'bronze' },
    { name: 'Civic Assemblies', age: 'classical' }, { name: 'Provincial Administration', age: 'classical' },
    { name: 'Feudal Charters', age: 'kingdoms' }, { name: 'Royal Chancery', age: 'kingdoms' },
    { name: 'Bureaucratic Reform', age: 'gunpowder' }, { name: 'Constitutional Law', age: 'gunpowder' },
    { name: 'Civil Service', age: 'modern' }, { name: 'Digital Administration', age: 'modern' }
  ],
  [TechCategories.SCIENCE]: [
    { name: 'Star Lore', age: 'stone' }, { name: 'Proto-Writing', age: 'stone' },
    { name: 'Cuneiform Records', age: 'bronze' }, { name: 'Early Astronomy', age: 'bronze' },
    { name: 'Geometry', age: 'classical' }, { name: 'Natural Philosophy', age: 'classical' },
    { name: 'Scholastic Method', age: 'kingdoms' }, { name: 'Optics', age: 'kingdoms' },
    { name: 'Scientific Method', age: 'gunpowder' }, { name: 'Calculus', age: 'gunpowder' },
    { name: 'Computing', age: 'modern' }, { name: 'Genomics', age: 'modern' }
  ]
};

// Real per-tech effects (short hook names, same LEGACY_HOOK vocabulary traits/policies/wonders
// already use), keyed by tech NAME so it reads next to CATEGORY_LINES above rather than by the
// generated id. "trade income" / "production" / "tax" all fold onto goldMult — this codebase
// doesn't yet split tax/production/trade into separate national multipliers (M11's job), so they
// share the one hook exactly like Set Tax Rate already does.
const TECH_EFFECTS = {
  // Stone Age (eight-ages plan U27, effects from plans/eras-origins-and-future.md 5.4). Chiefdoms,
  // Sacred Kingship and Star Lore keep the stability, manpower and gold effects they took instead of pools.
  'Hunting Bands': { hrMult: 0.10 },
  'Copper Working': { goldMult: 0.05 }, // mines and copper armies come with U31
  'Agriculture': { popGrowthBonus: 0.002 },
  'Animal Husbandry': { popGrowthBonus: 0.001 }, // pastures come with U31
  'Pottery': { popGrowthBonus: 0.001 },
  'The Wheel': { supplyRange: 1 },
  'Chiefdoms': { stabilityBonus: 0.5 },
  'Sacred Kingship': { hrMult: 0.10 },
  'Star Lore': { goldMult: 0.05 },
  'Proto-Writing': { techPointsMult: 0.10 },
  // Military
  'Feudal Levies': { hrMult: 0.15 },
  'Standing Armies': { hrMult: 0.05 },
  // Economy
  'Bronze Trade Routes': { goldMult: 0.25 },
  'Granary Storage': { popGrowthBonus: 0.001 },
  'Minted Coinage': { goldMult: 0.05 },
  'Guild Charters': { goldMult: 0.10 },
  'Joint-Stock Companies': { goldMult: 0.10 },
  // Disruptive breakthroughs pay, but shake society: factory towns and labour unrest,
  // globalisation's winners and losers (negative stabilityBonus = more unrest everywhere).
  'Industrial Capital': { goldMult: 0.15, stabilityBonus: -0.5 },
  'Global Markets': { goldMult: 0.15, stabilityBonus: -0.5 },
  // Infrastructure
  'Mudbrick Roads': { supplyRange: 1 },
  'Paved Roads': { supplyRange: 1, attrition: -0.10 },
  'Postal Relay': { opinion: 5 },
  'Canal Locks': { goldMult: 0.10 },
  'Highway Systems': { supplyRange: 1, attrition: -0.15 },
  // Governance
  'Code of Laws': { decreePace: 1 },
  'Scribal Bureaucracy': { developmentCost: -0.10 },
  'Royal Chancery': { decreePace: 1, stabilityCost: -0.10 },
  'Constitutional Law': { stabilityBonus: 1 },
  'Digital Administration': { decreePace: 1, developmentCost: -0.20 },
  // Science
  'Cuneiform Records': { techPointsMult: 0.10 },
  'Early Astronomy': { opinion: 5 },
  'Natural Philosophy': { techPointsMult: 0.10 },
  'Scientific Method': { researchCost: -0.10 },
  'Computing': { techPointsMult: 0.20 },
  'Genomics': { popGrowthBonus: 0.002 }
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// The web (plans/civ-map-rework.md C3.1): a tech can also need a tech from another line, of the
// same age or an earlier one, so the lines cross (Siege Engineering needs Iron Weapons and
// Geometry). Name -> [name]. Resolved to ids in buildLine; research.js reads every prerequisite.
export const CROSS_PREREQUISITES = {
  'The Wheel': ['Animal Husbandry'],
  'Code of Laws': ['Proto-Writing'],
  'Siege Engineering': ['Geometry'],
  'Plate Armor': ['Guild Charters'],
  'Gunpowder Weapons': ['Natural Philosophy'],
  'Standing Armies': ['Royal Chancery'],
  'Mechanized Warfare': ['Industrial Capital'],
  'Precision Guidance': ['Computing'],
  'Silk Road Trade': ['Paved Roads'],
  'Banking Houses': ['Provincial Administration'],
  'Colonial Trade': ['Optics'],
  'Global Markets': ['Rail Networks'],
  'Aqueducts': ['Geometry'],
  'Stone Bridges': ['Provincial Administration'],
  'Rail Networks': ['Industrial Capital'],
  'Provincial Administration': ['Paved Roads'],
  'Constitutional Law': ['Scientific Method'],
  'Digital Administration': ['Computing'],
  'Scholastic Method': ['Scribal Bureaucracy']
};
const idOfName = (name) => { for (const [category, entries] of Object.entries(CATEGORY_LINES)) if (entries.some((e) => e.name === name)) return `${category}_${slug(name)}`; throw new Error(`Unknown tech ${name}`); };
const crossPrerequisites = (name) => (CROSS_PREREQUISITES[name] || []).map(idOfName);

// The old techPoints cost kept on each tech as data (research.js prices techs by age instead).
const LEGACY_TECH_POINTS_BY_AGE = { stone: 5, bronze: 10, classical: 25, kingdoms: 40, gunpowder: 55, modern: 70 };

const buildLine = (category, entries) => {
  const techs = {};
  entries.forEach(({ name, age: ageId }, i) => {
    const id = `${category}_${slug(name)}`;
    const previousId = i === 0 ? null : `${category}_${slug(entries[i - 1].name)}`;
    techs[id] = {
      id,
      name,
      category,
      ageId,
      // Its place in the line (0 = first). No tech waits for a year: the research window is the
      // nation's own age and the next (research.js inResearchWindow, eight-ages plan KTD4).
      lineIndex: i,
      prerequisites: [...(previousId ? [previousId] : []), ...crossPrerequisites(name)],
      requiresAny: false,
      exclusiveWith: [],
      // Gold is gone from research cost (plan §M7) — techPoints only; the power-pool cost is
      // computed separately (getTechPowerCost) since which POOL applies depends on category, not
      // a fixed resource key this object could name directly.
      cost: { techPoints: LEGACY_TECH_POINTS_BY_AGE[ageId] },
      effects: TECH_EFFECTS[name] || {}
    };
  });
  return techs;
};

export const TECH_TREE = Object.entries(CATEGORY_LINES).reduce((acc, [category, entries]) => {
  return { ...acc, ...buildLine(category, entries) };
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
    cat.techs.sort((a, b) => a.lineIndex - b.lineIndex);
  });
  return categories;
};

