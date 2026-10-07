// src/data/greatProjects.js
// Plan §M10: Great Projects replace the old flat, empire-wide, instant-purchase World Wonders
// (src/data/wonders.js, deleted). 15 world projects (3 per age, plus the national ones below), each tied to a specific REGION (a site
// rule — the plan's own examples: "a capital", "a region with Irrigation", "coastal with Harbor")
// with 3 upgrade tiers, built from a city's production queue (src/engine/wonders.js; the old gold queue is gone —
// buildings.js's own construction stayed instant, see that file's header comment, so this is fresh
// plumbing, not reused), and genuine capture: a project's owner is DERIVED from whoever currently
// owns its site region (getGreatProjectOwner) rather than stored redundantly — simpler than the
// plan's own `ownerNationId` field, and it can never drift out of sync with a siege/peace-deal
// ownership change the way a stored copy could.
//
// "AI competes for projects" (the plan's own world-race framing) isn't wired: every other
// milestone since M8 has deferred AI ECONOMIC actions to M16 (government reforms, laws —
// AI never adopts/grants/interacts, only the player does), and starting/upgrading a project is
// exactly that kind of action. The race backdrop is still real once M16 lands, since ownership is
// derived from region conquest, which AI-vs-AI wars already cause today.
//
// Every tier's `effects` uses the same LEGACY_HOOK vocabulary as buildings/techs/reforms, applied
// NATIONALLY (via contextSources, since "who owns this project" needs live region state — a
// staticSources-cacheable `nation` object alone can't answer that). A tier's `effects` is the
// CURRENT cumulative value (matching how building tiers work — Bazaar's 25% REPLACES Market's 15%,
// it doesn't stack on top), not an incremental delta. `completionPrestige` is a ONE-TIME grant when
// construction of that tier finishes (reusing nationalPower.js's existing prestige stat), and every
// project has one at every tier.
//
// A `LEGACY_HOOK` key only counts as "real" here if it's actually read somewhere via
// `getModifier`/`getNationSheet` (sheet.js) — that's what makes a great project's effect visible to
// BOTH the player and the AI's own decisions generically. `governingCapacity` (the Forbidden City's
// own effect) was a real bug of exactly that shape: nationalPower.js's overextension calc used to
// read it straight off `staticSources(nation)` only, to avoid a circular import, which meant a great
// project's (contextSources-sourced) governingCapacity contribution silently never applied —
// src/engine/modifiers/sources.js's own `capacityBonus` computation now folds in this function's own
// already-accumulated `lines` (which includes the great-project loop above) alongside
// staticSources(nation), fixing it without nationalPower.js ever needing to import the modifier
// engine.
//
// Five projects (Pyramids, Great Wall, Arsenal, Space Program, Atomic Research Center) name a
// flavor effect that doesn't exist as a real mechanic yet (a stability floor, a combat malus on
// invaders, ship cost/naval morale, a mission-time discount, a missile-cost discount) — each gets a
// modest real bonus from an already-wired hook instead, as a stand-in, so building one is never a
// pure dead end; every such trim/substitution is noted inline in that project's own `description`.
//
// NATIONAL wonders (plans/game/israelite-wonders.md): a project with a `homeland` (a country code
// of the hex grid) can only be built by a city whose centre stands on that country's land, on a
// wonder tile of that land too (siteRule 'homeland'; wonders.js wonderSites). The rule is the
// LAND, not the builder: like every project its owner is whoever holds the city, so a captured
// Jerusalem keeps its temple for the captor. Such a project acts on ITS CITY: a tier's
// `cityEffects` ({ 'local.culture', 'local.loyalty', 'local.fortLevel', 'local.wallHp' }) feed
// that city's culture (resolveTurn's city context), loyalty target (loyalty.js), siege HP
// (sieges.js) and the region modifier sheet (local.fortLevel: assaults in invasion.js and
// defense.js, the tactical keep). cityWonderLines below is the one reader.
import { REGIONS_DATA } from './regions';
import { onHomeland } from '../engine/world/cultureZones';
import { isCoastal } from './navalReach';
import { getTotalDev } from '../engine/development';

const buildingTier = (region, categoryId) => region?.buildings?.categories?.[categoryId] ?? -1;

export const SITE_RULES = {
  capital: (region, regionId) => !!REGIONS_DATA[regionId]?.isCapital,
  capitalWithLibrary: (region, regionId) => !!REGIONS_DATA[regionId]?.isCapital && buildingTier(region, 'science') >= 0,
  irrigation: (region) => buildingTier(region, 'food') >= 1,
  palisade: (region) => buildingTier(region, 'defense') >= 0,
  devAtLeast15: (region) => getTotalDev(region) >= 15,
  coastalHarbor: (region, regionId) => isCoastal(regionId) && buildingTier(region, 'naval') >= 0,
  bazaar: (region) => buildingTier(region, 'economy') >= 1,
  cathedral: (region) => buildingTier(region, 'culture') >= 2,
  university: (region) => buildingTier(region, 'science') >= 2,
  coastalNavalBase: (region, regionId) => isCoastal(regionId) && buildingTier(region, 'naval') >= 2,
  researchLab: (region) => buildingTier(region, 'science') >= 3,
  stockExchange: (region) => buildingTier(region, 'economy') >= 3,
  factory: (region) => buildingTier(region, 'industry') >= 2,
  // a national wonder: the city's centre stands on its homeland (the tile's country)
  // (a culture zone on a generated world: src/engine/world/cultureZones.js)
  homeland: (region, regionId, project) => !!project?.homeland && region?.tile != null && onHomeland(region.tile, project.homeland)
};

export const GREAT_PROJECTS = {
  great_pyramids: {
    id: 'great_pyramids', name: 'The Great Pyramids', ageId: 'bronze', siteRule: 'capital',
    description: 'Built at your capital. +1/2/3 stability, standing in for the legitimacy/turn and stability-floor effects a monumental tomb complex would ideally grant (M4/M15 aren\'t wired yet).',
    tiers: [
      { effects: { stabilityBonus: 1 }, completionPrestige: 10 },
      { effects: { stabilityBonus: 2 }, completionPrestige: 20 },
      { effects: { stabilityBonus: 3 }, completionPrestige: 30 }
    ]
  },
  hanging_gardens: {
    id: 'hanging_gardens', name: 'The Hanging Gardens', ageId: 'bronze', siteRule: 'irrigation',
    description: 'Built in a region with Irrigation. +0.3/0.6/1% national population growth (famine immunity at tier 3 not yet wired, M15).',
    tiers: [
      { effects: { popGrowthBonus: 0.003 }, completionPrestige: 10 },
      { effects: { popGrowthBonus: 0.006 }, completionPrestige: 20 },
      { effects: { popGrowthBonus: 0.01 }, completionPrestige: 30 }
    ]
  },
  great_wall: {
    id: 'great_wall', name: 'The Great Wall', ageId: 'bronze', siteRule: 'palisade',
    description: 'Built in a region with a Palisade. +1/2/3 Administrative Power per turn (a secured, well-administered frontier), standing in for the "enemy stacks lose strength entering your border regions" combat mechanic (M14 isn\'t wired yet).',
    tiers: [
      { effects: { admBonus: 1 }, completionPrestige: 10 },
      { effects: { admBonus: 2 }, completionPrestige: 20 },
      { effects: { admBonus: 3 }, completionPrestige: 30 }
    ]
  },
  great_library: {
    id: 'great_library', name: 'The Great Library', ageId: 'classical', siteRule: 'capitalWithLibrary',
    description: 'Built at your capital, which must have a Library. +10/20/30% tech points; -10% research cost at tier 3.',
    tiers: [
      { effects: { techPointsMult: 0.1 }, completionPrestige: 10 },
      { effects: { techPointsMult: 0.2 }, completionPrestige: 20 },
      { effects: { techPointsMult: 0.3, researchCost: -0.1 }, completionPrestige: 30 }
    ]
  },
  colosseum: {
    id: 'colosseum', name: 'The Colosseum', ageId: 'classical', siteRule: 'devAtLeast15',
    description: 'Built in a region with development 15 or higher. -1/-2/-3 unrest nationwide.',
    tiers: [
      { effects: { stabilityBonus: 1 }, completionPrestige: 10 },
      { effects: { stabilityBonus: 2 }, completionPrestige: 20 },
      { effects: { stabilityBonus: 3 }, completionPrestige: 30 }
    ]
  },
  lighthouse: {
    id: 'lighthouse', name: 'The Lighthouse', ageId: 'classical', siteRule: 'coastalHarbor',
    description: 'Built in a coastal region with a Harbor. +10% trade income (naval reach % is M14, not yet wired).',
    tiers: [
      { effects: { goldMult: 0.1 }, completionPrestige: 10 },
      { effects: { goldMult: 0.1 }, completionPrestige: 20 },
      { effects: { goldMult: 0.1 }, completionPrestige: 30 }
    ]
  },
  solomons_temple: {
    id: 'solomons_temple', name: "Solomon's Temple", ageId: 'bronze', siteRule: 'homeland', homeland: 'il', homelandLabel: "Israel's land", national: true,
    description: "A national wonder of Israel: only a city on Israel's land can build it, on hills of that land. The First Temple and the royal quarter. Its city gains +2/+3/+4 culture and +5/+10/+15 loyalty.",
    tiers: [
      { effects: {}, cityEffects: { 'local.culture': 2, 'local.loyalty': 5 }, completionPrestige: 10 },
      { effects: {}, cityEffects: { 'local.culture': 3, 'local.loyalty': 10 }, completionPrestige: 20 },
      { effects: {}, cityEffects: { 'local.culture': 4, 'local.loyalty': 15 }, completionPrestige: 30 }
    ]
  },
  masada: {
    id: 'masada', name: 'Masada', ageId: 'classical', siteRule: 'homeland', homeland: 'il', homelandLabel: "Israel's land", national: true,
    description: "A national wonder of Israel: only a city on Israel's land can build it, on desert of that land. Herod's fortress on the mesa. Its city's walls hold +50/+100/+150% siege HP and it gains +2/+4/+6 fort level against assaults.",
    tiers: [
      { effects: {}, cityEffects: { 'local.fortLevel': 2, 'local.wallHp': 0.5 }, completionPrestige: 10 },
      { effects: {}, cityEffects: { 'local.fortLevel': 4, 'local.wallHp': 1 }, completionPrestige: 20 },
      { effects: {}, cityEffects: { 'local.fortLevel': 6, 'local.wallHp': 1.5 }, completionPrestige: 30 }
    ]
  },
  grand_bazaar: {
    id: 'grand_bazaar', name: 'The Grand Bazaar', ageId: 'kingdoms', siteRule: 'bazaar',
    description: 'Built in a region with a Bazaar. +15/25/40% trade income.',
    tiers: [
      { effects: { goldMult: 0.15 }, completionPrestige: 10 },
      { effects: { goldMult: 0.25 }, completionPrestige: 20 },
      { effects: { goldMult: 0.4 }, completionPrestige: 30 }
    ]
  },
  great_cathedral: {
    id: 'great_cathedral', name: 'The Great Cathedral', ageId: 'kingdoms', siteRule: 'cathedral',
    description: 'Built in a region with a Cathedral / Mosque. -1/-1/-2 unrest nationwide.',
    tiers: [
      { effects: { stabilityBonus: 1 }, completionPrestige: 10 },
      { effects: { stabilityBonus: 1 }, completionPrestige: 20 },
      { effects: { stabilityBonus: 2 }, completionPrestige: 30 }
    ]
  },
  forbidden_city: {
    id: 'forbidden_city', name: 'The Forbidden City', ageId: 'kingdoms', siteRule: 'capital',
    description: 'Built at your capital. +10/20/30 governing capacity; +1 ADM/turn at tier 3.',
    tiers: [
      { effects: { governingCapacity: 10 }, completionPrestige: 10 },
      { effects: { governingCapacity: 20 }, completionPrestige: 20 },
      { effects: { governingCapacity: 30, admBonus: 1 }, completionPrestige: 30 }
    ]
  },
  royal_observatory: {
    id: 'royal_observatory', name: 'The Royal Observatory', ageId: 'gunpowder', siteRule: 'university',
    description: 'Built in a region with a University. -5/10/15% research cost; +1 DIP/turn.',
    tiers: [
      { effects: { researchCost: -0.05, dipBonus: 1 }, completionPrestige: 10 },
      { effects: { researchCost: -0.1, dipBonus: 1 }, completionPrestige: 20 },
      { effects: { researchCost: -0.15, dipBonus: 1 }, completionPrestige: 30 }
    ]
  },
  arsenal: {
    id: 'arsenal', name: 'The Arsenal', ageId: 'gunpowder', siteRule: 'coastalNavalBase',
    description: 'Built in a coastal region with a Naval Base. +1/2/3 Military Power per turn, standing in for the ship-cost/naval-morale effects (M14 isn\'t wired yet).',
    tiers: [
      { effects: { milBonus: 1 }, completionPrestige: 10 },
      { effects: { milBonus: 2 }, completionPrestige: 20 },
      { effects: { milBonus: 3 }, completionPrestige: 30 }
    ]
  },
  palace_of_versailles: {
    id: 'palace_of_versailles', name: 'The Palace of Versailles', ageId: 'gunpowder', siteRule: 'capital',
    description: 'Built at your capital. +1/+1/+2 ADM per turn from the court (+1 diplomat is M12, not yet wired).',
    tiers: [
      { effects: { admBonus: 1 }, completionPrestige: 20 },
      { effects: { admBonus: 1 }, completionPrestige: 35 },
      { effects: { admBonus: 2 }, completionPrestige: 50 }
    ]
  },
  space_program: {
    id: 'space_program', name: 'The Space Program', ageId: 'modern', siteRule: 'researchLab',
    description: 'Built in a region with a Research Lab. -5/10/15% research cost, standing in for a mission-time discount that isn\'t a modeled mechanic yet.',
    tiers: [
      { effects: { researchCost: -0.05 }, completionPrestige: 10 },
      { effects: { researchCost: -0.1 }, completionPrestige: 20 },
      { effects: { researchCost: -0.15 }, completionPrestige: 30 }
    ]
  },
  international_exchange: {
    id: 'international_exchange', name: 'The International Exchange', ageId: 'modern', siteRule: 'stockExchange',
    description: 'Built in a region with a Stock Exchange. +10/20/30% trade income (trade pact capacity is M12, not yet wired).',
    tiers: [
      { effects: { goldMult: 0.1 }, completionPrestige: 10 },
      { effects: { goldMult: 0.2 }, completionPrestige: 20 },
      { effects: { goldMult: 0.3 }, completionPrestige: 30 }
    ]
  },
  atomic_research_center: {
    id: 'atomic_research_center', name: 'The Atomic Research Center', ageId: 'modern', siteRule: 'factory',
    description: 'Built in a region with a Factory. +10/20/30% tech point income, standing in for a missile-cost discount that isn\'t a modeled hook yet (nuclear missiles already unlock via the existing tech/mission ladder).',
    tiers: [
      { effects: { techPointsMult: 0.1 }, completionPrestige: 10 },
      { effects: { techPointsMult: 0.2 }, completionPrestige: 20 },
      { effects: { techPointsMult: 0.3 }, completionPrestige: 30 }
    ]
  }
};

export const GREAT_PROJECT_IDS = Object.keys(GREAT_PROJECTS);

// Plan §M2: gold 500/1000/2000 + ADM 100/150/200, taking 4/6/8 turns per tier.
export const GREAT_PROJECT_TIER_COST = [
  { gold: 500, adm: 100, turns: 4 },
  { gold: 1000, adm: 150, turns: 6 },
  { gold: 2000, adm: 200, turns: 8 }
];

export const getGreatProject = (id) => GREAT_PROJECTS[id] || null;
export const getGreatProjectCost = (nextTier) => GREAT_PROJECT_TIER_COST[nextTier - 1] || null;

// Ownership is derived from the site region's CURRENT owner, never stored — see this file's header
// comment on why that's simpler and can't drift out of sync.
export const getGreatProjectOwner = (state, projectId) => {
  const entry = state.greatProjects?.[projectId];
  if (!entry) return null;
  return state.regions?.[entry.regionId]?.owner || null;
};

export const meetsSiteRule = (project, region, regionId) => {
  const check = SITE_RULES[project?.siteRule];
  return check ? check(region, regionId, project) : false;
};

// A city's own wonder effects (the `cityEffects` of the tier built there): modifier lines, keyed
// by city id, built once per `state.greatProjects` object (it is replaced, never mutated, when a
// wonder is built or raised), so a reader per city per turn costs a Map lookup.
const NO_LINES = [];
const cityLinesCache = new WeakMap();
const cityLinesOf = (greatProjects) => {
  let byCity = cityLinesCache.get(greatProjects);
  if (!byCity) {
    byCity = new Map();
    Object.entries(greatProjects).forEach(([projectId, entry]) => {
      const project = GREAT_PROJECTS[projectId];
      const fx = entry?.tier ? project?.tiers[entry.tier - 1]?.cityEffects : null;
      if (!fx || entry.regionId == null) return;
      const lines = byCity.get(entry.regionId) || [];
      Object.entries(fx).forEach(([key, value]) => lines.push({ key, value, sourceType: 'greatProject', sourceId: projectId, label: project.name }));
      byCity.set(entry.regionId, lines);
    });
    cityLinesCache.set(greatProjects, byCity);
  }
  return byCity;
};
/** The modifier lines a city's own wonders give it: [{ key, value, sourceType, sourceId, label }]. */
export const cityWonderLines = (greatProjects, cityId) => (greatProjects && cityId != null ? cityLinesOf(greatProjects).get(cityId) || NO_LINES : NO_LINES);
/** The total of one city-wonder key for a city (0 when it has none). */
export const cityWonderTotal = (greatProjects, cityId, key) => cityWonderLines(greatProjects, cityId).reduce((s, l) => (l.key === key ? s + l.value : s), 0);

