// src/data/tileYields.js
// What a tile yields (plans/civ-map-rework.md, C1): food, production and gold from its terrain,
// relief, feature, river, resource and improvement. Science and culture come from cities, never
// from raw land. Pure data and pure functions; the cities engine (src/engine/world/cities.js)
// sums these over a city's worked tiles.
//
// Terrain is a base (grassland, plains, desert, tundra, snow, coast, ocean, lake) plus a relief
// (flat, hills, mountains) plus a feature (forest, jungle, marsh, oasis, floodplain, ice), as the
// grid build classifies it, so the table composes instead of listing every combination.

export const BASE_YIELDS = {
  grassland: { food: 2, production: 0, gold: 0 },
  plains: { food: 1, production: 1, gold: 0 },
  desert: { food: 0, production: 0, gold: 0 },
  tundra: { food: 1, production: 0, gold: 0 },
  snow: { food: 0, production: 0, gold: 0 },
  coast: { food: 1, production: 0, gold: 1 },
  ocean: { food: 1, production: 0, gold: 0 },
  lake: { food: 2, production: 0, gold: 1 }
};

// Relief replaces food with production on hills; mountains yield nothing until mined.
export const RELIEF_YIELDS = {
  flat: {},
  hills: { food: -1, production: 2 },
  mountains: { food: -9, production: -9, gold: -9 } // clamped to zero below
};

export const FEATURE_YIELDS = {
  none: {},
  forest: { production: 1 },
  jungle: { food: 1, production: -1 },
  marsh: { food: 1, production: -1 },
  oasis: { food: 3 },
  floodplain: { food: 3, gold: 1 },
  ice: { food: -9, production: -9, gold: -9 }
};

export const RIVER_YIELDS = { gold: 1 };

// Resource kinds: bonus (food or production), luxury (amenities, gold), strategic (needed for
// units and buildings, counted per turn from improved tiles).
export const RESOURCES_ON_TILES = {
  wheat: { kind: 'bonus', yields: { food: 1 }, improvement: 'farm' },
  rice: { kind: 'bonus', yields: { food: 1 }, improvement: 'farm' },
  cattle: { kind: 'bonus', yields: { food: 1 }, improvement: 'pasture' },
  sheep: { kind: 'bonus', yields: { food: 1 }, improvement: 'pasture' },
  deer: { kind: 'bonus', yields: { food: 1 }, improvement: 'camp' },
  fish: { kind: 'bonus', yields: { food: 1 }, improvement: 'fishing_boats' },
  whales: { kind: 'luxury', yields: { food: 1, gold: 1 }, improvement: 'fishing_boats' },
  bananas: { kind: 'bonus', yields: { food: 1 }, improvement: 'plantation' },
  dates: { kind: 'bonus', yields: { food: 1 }, improvement: 'farm' },
  stone: { kind: 'bonus', yields: { production: 1 }, improvement: 'quarry' },
  timber: { kind: 'bonus', yields: { production: 1 }, improvement: 'lumber_camp' },
  reeds: { kind: 'bonus', yields: { production: 1 }, improvement: 'farm' },
  horses: { kind: 'strategic', yields: { production: 1 }, improvement: 'pasture' },
  copper: { kind: 'strategic', yields: { production: 1 }, improvement: 'mine' },
  iron: { kind: 'strategic', yields: { production: 1 }, improvement: 'mine' },
  coal: { kind: 'strategic', yields: { production: 2 }, improvement: 'mine' },
  oil: { kind: 'strategic', yields: { production: 2 }, improvement: 'oil_well' },
  uranium: { kind: 'strategic', yields: { production: 2 }, improvement: 'mine' },
  gold: { kind: 'luxury', yields: { gold: 2 }, improvement: 'mine' },
  silver: { kind: 'luxury', yields: { gold: 2 }, improvement: 'mine' },
  gems: { kind: 'luxury', yields: { gold: 3 }, improvement: 'mine' },
  salt: { kind: 'luxury', yields: { food: 1, gold: 1 }, improvement: 'mine' },
  furs: { kind: 'luxury', yields: { gold: 2 }, improvement: 'camp' },
  honey: { kind: 'luxury', yields: { food: 1, gold: 1 }, improvement: 'camp' },
  spices: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  dyes: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  sugar: { kind: 'luxury', yields: { food: 1, gold: 1 }, improvement: 'plantation' },
  cotton: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  silk: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  tea: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  wine: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  olives: { kind: 'luxury', yields: { food: 1, gold: 1 }, improvement: 'plantation' },
  incense: { kind: 'luxury', yields: { gold: 2 }, improvement: 'plantation' },
  papyrus: { kind: 'luxury', yields: { gold: 1 }, improvement: 'farm' },
  rubber: { kind: 'strategic', yields: { production: 1 }, improvement: 'plantation' }
};
export const RESOURCE_KIND = (id) => RESOURCES_ON_TILES[id]?.kind || null;
export const STRATEGIC_RESOURCES = Object.keys(RESOURCES_ON_TILES).filter((id) => RESOURCES_ON_TILES[id].kind === 'strategic');
export const LUXURY_RESOURCES = Object.keys(RESOURCES_ON_TILES).filter((id) => RESOURCES_ON_TILES[id].kind === 'luxury');

// Improvements a city builds on its tiles (no builder units; C1). `allowed(tile)` takes the tile
// facts { terrain, relief, feature, resource, river, coastal, land }. `upgrades` lists techs that
// add yields once researched.
export const IMPROVEMENTS = {
  farm: {
    name: 'Farm', turns: 2, requiresTech: null,
    allowed: (t) => t.land && t.relief !== 'mountains' && ['grassland', 'plains', 'tundra'].includes(t.terrain) && ['none', 'floodplain', 'marsh', 'oasis'].includes(t.feature) || ['wheat', 'rice', 'dates', 'reeds', 'papyrus'].includes(t.resource),
    yields: { food: 1 }, upgrades: { infrastructure_canal_locks: { food: 1 }, science_genomics: { food: 1 } }
  },
  pasture: {
    name: 'Pasture', turns: 2, requiresTech: null,
    allowed: (t) => ['cattle', 'sheep', 'horses'].includes(t.resource),
    yields: { food: 1, production: 1 }, upgrades: { governance_feudal_charters: { production: 1 } }
  },
  camp: {
    name: 'Camp', turns: 2, requiresTech: null,
    allowed: (t) => ['deer', 'furs', 'honey'].includes(t.resource),
    yields: { gold: 1 }, upgrades: { economy_silk_road_trade: { gold: 1 } }
  },
  mine: {
    name: 'Mine', turns: 3, requiresTech: 'military_bronze_casting',
    allowed: (t) => t.land && (t.relief === 'hills' || t.relief === 'mountains' || ['copper', 'iron', 'coal', 'gold', 'silver', 'gems', 'salt', 'uranium'].includes(t.resource)),
    yields: { production: 1 }, upgrades: { military_iron_weapons: { production: 1 }, economy_industrial_capital: { production: 1 } }
  },
  quarry: {
    name: 'Quarry', turns: 3, requiresTech: 'infrastructure_mudbrick_roads',
    allowed: (t) => t.resource === 'stone',
    yields: { production: 2 }, upgrades: {}
  },
  lumber_camp: {
    name: 'Lumber camp', turns: 2, requiresTech: 'military_bronze_casting',
    allowed: (t) => t.feature === 'forest' || t.resource === 'timber',
    yields: { production: 1 }, upgrades: { infrastructure_stone_bridges: { production: 1 } }
  },
  fishing_boats: {
    name: 'Fishing boats', turns: 2, requiresTech: 'economy_bronze_trade_routes',
    allowed: (t) => !t.land && (t.terrain === 'coast' || t.terrain === 'lake') || ['fish', 'whales'].includes(t.resource),
    yields: { food: 1 }, upgrades: { science_optics: { gold: 1 } }
  },
  plantation: {
    name: 'Plantation', turns: 3, requiresTech: 'infrastructure_irrigation_canals',
    allowed: (t) => ['bananas', 'spices', 'dyes', 'sugar', 'cotton', 'silk', 'tea', 'wine', 'olives', 'incense', 'rubber'].includes(t.resource),
    yields: { gold: 2 }, upgrades: { economy_joint_stock_companies: { gold: 1 } }
  },
  oil_well: {
    name: 'Oil well', turns: 4, requiresTech: 'military_mechanized_warfare',
    allowed: (t) => t.resource === 'oil',
    yields: { production: 2, gold: 2 }, upgrades: {}
  },
  road: {
    name: 'Road', turns: 1, requiresTech: null,
    allowed: (t) => t.land && t.relief !== 'mountains' && t.feature !== 'ice',
    yields: {}, upgrades: {}
  },
  fort: {
    name: 'Fort', turns: 4, requiresTech: 'military_siege_engineering',
    allowed: (t) => t.land && t.feature !== 'ice',
    yields: {}, upgrades: {}
  }
};
export const IMPROVEMENT_IDS = Object.keys(IMPROVEMENTS);

const add = (into, from, sign = 1) => {
  if (!from) return into;
  Object.entries(from).forEach(([k, v]) => { into[k] = (into[k] || 0) + v * sign; });
  return into;
};

/**
 * The facts of a tile as the yield rules want them. `tiles` is the loaded grid; `dynamic` is the
 * game's sparse tile state for this id: { improvement, pillaged, road }.
 */
export const tileFacts = (tiles, id, dynamic = {}) => ({
  id,
  land: tiles.land[id] === 1,
  terrain: tiles.terrainOf(id),
  relief: tiles.reliefOf(id),
  feature: tiles.featureOf(id),
  river: tiles.rivers[id] !== 0,
  coastal: tiles.coastal[id] === 1,
  resource: tiles.resourceOf ? tiles.resourceOf(id) : null,
  improvement: dynamic.improvement || null,
  pillaged: !!dynamic.pillaged,
  road: !!dynamic.road
});

export const canImprove = (facts, improvementId, researched = []) => {
  const imp = IMPROVEMENTS[improvementId];
  if (!imp) return false;
  if (imp.requiresTech && !researched.includes(imp.requiresTech)) return false;
  return !!imp.allowed(facts);
};

/** Food, production and gold of one tile, never negative. */
export const tileYields = (facts, researched = []) => {
  const y = { food: 0, production: 0, gold: 0 };
  if (!facts.land && !['coast', 'ocean', 'lake'].includes(facts.terrain)) return y;
  // A mountain with nothing on it is a wall; a mountain mine yields the mine and its ore only.
  const mountain = facts.relief === 'mountains';
  if (mountain && facts.improvement !== 'mine') return y;
  if (!mountain) {
    add(y, BASE_YIELDS[facts.terrain]);
    add(y, RELIEF_YIELDS[facts.relief]);
    add(y, FEATURE_YIELDS[facts.feature]);
    if (facts.river && facts.land) add(y, RIVER_YIELDS);
  }
  const resource = RESOURCES_ON_TILES[facts.resource];
  if (resource && !mountain) add(y, resource.yields);
  if (facts.improvement && !facts.pillaged) {
    const imp = IMPROVEMENTS[facts.improvement];
    if (imp) {
      add(y, imp.yields);
      Object.entries(imp.upgrades).forEach(([tech, bonus]) => { if (researched.includes(tech)) add(y, bonus); });
      // A mine on a resource that wants a mine, a farm on wheat and so on: the resource's bonus
      // only counts once the right improvement stands on it.
      if (resource && resource.improvement === facts.improvement) add(y, resource.yields);
    }
  }
  y.food = Math.max(0, y.food); y.production = Math.max(0, y.production); y.gold = Math.max(0, y.gold);
  return y;
};

/** The strategic resource a worked and improved tile supplies per turn (1, or 2 when the
 * improvement is upgraded by Industrial Capital), else null. */
export const strategicSupply = (facts, researched = []) => {
  const resource = RESOURCES_ON_TILES[facts.resource];
  if (!resource || resource.kind !== 'strategic') return null;
  if (!facts.improvement || facts.pillaged || resource.improvement !== facts.improvement) return null;
  return { resource: facts.resource, amount: researched.includes('economy_industrial_capital') ? 2 : 1 };
};
