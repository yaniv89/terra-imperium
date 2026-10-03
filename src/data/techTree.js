// src/data/techTree.js
// The ~50-tech, 5-line, age-gated Research tree (plan's "Research tab"). Each of the 5
// TechCategories (src/data/types.js) gets a simple 10-tech linear chain, two techs per age,
// covering all five ages — researching later techs requires the one before it in the same line.
//
// A tech's payoff is the plan's own framing: research enough of your current age's line and your
// empire's tech-earned age (state.techAgeId, advanced by GameContext.jsx's RESEARCH_TECH) catches
// up to the next one — which is what src/data/ages.js's already-existing getEffectiveAgeId was
// built for. GameContext.jsx now passes that effective age to getAvailableClasses instead of the
// raw calendar age.
//
// Research cost: science only, by age (src/engine/research.js RESEARCH_AGE_BASE); the old
// per-tech `cost.techPoints` below is kept only as data. Building/tech unlocks named in the plan's own §M6.3/§M7
// tables are wired as REAL effects wherever this codebase already has the hook to receive them
// (most of the building unlocks are src/data/buildings.js's own requiresTech, already wired in
// M6): every tech below whose plan-described effect maps onto an EXISTING, consumed modifier hook
// (power pools, tax/production/manpower income, tech points, population growth, development/
// building/research/stability cost, unrest) gets that real effect via TECH_EFFECTS. A tech whose
// plan-described effect names a system that doesn't exist yet (combat/siege/naval damage,
// movement, attrition-by-terrain, estate loyalty, laws/reforms, trade pact capacity, event
// chances) is left with no `effects` entry — it's still real progression (its own prerequisite
// chain, its building unlocks where those exist), just not a faked modifier line. Those systems'
// own milestones (M8/M9/M11/M12/M14/M17) are where those techs' remaining effects get wired.
import { AGE_ORDER, AGES } from './ages';
import { TechCategories } from './types';

// Each line lists its techs by age, two per age, oldest first; the line's order is AGE_ORDER's.
// A tech's age is where it is listed (moving a tech to another age keeps its id and saves).
const CATEGORY_LINES = {
  [TechCategories.MILITARY]: {
    bronze: ['Bronze Casting', 'Composite Bow'],
    classical: ['Iron Weapons', 'Siege Engineering'],
    kingdoms: ['Feudal Levies', 'Plate Armor'],
    gunpowder: ['Gunpowder Weapons', 'Standing Armies'],
    modern: ['Mechanized Warfare', 'Precision Guidance']
  },
  [TechCategories.ECONOMY]: {
    bronze: ['Bronze Trade Routes', 'Granary Storage'],
    classical: ['Minted Coinage', 'Silk Road Trade'],
    kingdoms: ['Guild Charters', 'Banking Houses'],
    gunpowder: ['Joint-Stock Companies', 'Colonial Trade'],
    modern: ['Industrial Capital', 'Global Markets']
  },
  [TechCategories.INFRASTRUCTURE]: {
    bronze: ['Irrigation Canals', 'Mudbrick Roads'],
    classical: ['Paved Roads', 'Aqueducts'],
    kingdoms: ['Stone Bridges', 'Postal Relay'],
    gunpowder: ['Canal Locks', 'Turnpike Roads'],
    modern: ['Rail Networks', 'Highway Systems']
  },
  [TechCategories.GOVERNANCE]: {
    bronze: ['Code of Laws', 'Scribal Bureaucracy'],
    classical: ['Civic Assemblies', 'Provincial Administration'],
    kingdoms: ['Feudal Charters', 'Royal Chancery'],
    gunpowder: ['Bureaucratic Reform', 'Constitutional Law'],
    modern: ['Civil Service', 'Digital Administration']
  },
  [TechCategories.SCIENCE]: {
    bronze: ['Cuneiform Records', 'Early Astronomy'],
    classical: ['Geometry', 'Natural Philosophy'],
    kingdoms: ['Scholastic Method', 'Optics'],
    gunpowder: ['Scientific Method', 'Calculus'],
    modern: ['Computing', 'Genomics']
  }
};
// The line as one list of { name, ageId }, in age order.
const lineEntries = (byAge) => AGE_ORDER.flatMap((ageId) => (byAge[ageId] || []).map((name) => ({ name, ageId })));

// Real per-tech effects (short hook names, same LEGACY_HOOK vocabulary traits/policies/wonders
// already use), keyed by tech NAME so it reads next to CATEGORY_LINES above rather than by the
// generated id. "trade income" / "production" / "tax" all fold onto goldMult — this codebase
// doesn't yet split tax/production/trade into separate national multipliers (M11's job), so they
// share the one hook exactly like Set Tax Rate and satellites already do.
const TECH_EFFECTS = {
  // Military
  'Feudal Levies': { hrMult: 0.15 },
  'Standing Armies': { milBonus: 1 },
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
  'Postal Relay': { dipBonus: 1 },
  'Canal Locks': { goldMult: 0.10 },
  'Highway Systems': { supplyRange: 1, attrition: -0.15 },
  // Governance
  'Code of Laws': { admBonus: 1 },
  'Scribal Bureaucracy': { developmentCost: -0.10 },
  'Royal Chancery': { admBonus: 1, stabilityCost: -0.10 },
  'Constitutional Law': { stabilityBonus: 1 },
  'Digital Administration': { admBonus: 1, developmentCost: -0.20 },
  // Science
  'Cuneiform Records': { techPointsMult: 0.10 },
  'Early Astronomy': { dipBonus: 1 },
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
const idOfName = (name) => { for (const [category, byAge] of Object.entries(CATEGORY_LINES)) if (lineEntries(byAge).some((e) => e.name === name)) return `${category}_${slug(name)}`; throw new Error(`Unknown tech ${name}`); };
const crossPrerequisites = (name) => (CROSS_PREREQUISITES[name] || []).map(idOfName);

// The legacy techPoints cost kept on each tech as data (research.js prices techs by age instead).
const LEGACY_TECH_POINTS_BY_AGE = { bronze: 10, classical: 25, kingdoms: 40, gunpowder: 55, modern: 70 };

const buildLine = (category, byAge) => {
  const techs = {};
  const entries = lineEntries(byAge);
  entries.forEach(({ name, ageId }, i) => {
    const age = AGES[ageId];
    const isSecondOfAge = i > 0 && entries[i - 1].ageId === ageId;
    const id = `${category}_${slug(name)}`;
    const previousId = i === 0 ? null : `${category}_${slug(entries[i - 1].name)}`;
    techs[id] = {
      id,
      name,
      category,
      ageId,
      // Staggered within the age so the second tech isn't available the instant the age begins.
      yearAvailable: isSecondOfAge ? Math.round(age.startYear + (age.endYear - age.startYear) * 0.5) : age.startYear,
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

export const TECH_TREE = Object.entries(CATEGORY_LINES).reduce((acc, [category, byAge]) => {
  return { ...acc, ...buildLine(category, byAge) };
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

