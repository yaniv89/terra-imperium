// src/data/terrain.js
// Plan §M14: real per-region terrain, replacing the flat 'mixed' every region in worldRegions.json
// currently reports (see combatWidth.js's own header — it already has a real 9-key table, just
// nothing to differentiate against). The plan's own primary path is a geo-data build script (Natural
// Earth or an npm package); its own explicitly-sanctioned FALLBACK is what this file implements
// instead: name-keyword matching plus whatever real per-region fields worldRegions.json already
// carries (isCoastal, infrastructure) — no new build step, no new data file, computed live and
// memoized, mirroring src/data/regions.js's own getNationCapital lazy-index pattern.
//
// Honest scope trim: the plan's own fallback also uses a latitude band (|lat| > 60 -> arctic); this
// schema has no per-region latitude field at all, so that half of the heuristic is dropped — arctic
// detection here is name-keyword only (plus a small curated list of far-north/south admin-1 names).
// The keyword list is also intentionally smaller than the plan's own "~150 keywords" figure (real
// province names rarely name-drop the mountain range or desert they sit in, so a much longer list
// would mostly still miss) — this covers the world's major, well-known ranges/deserts/forests by
// name, and leans on two REAL per-region numbers (isCoastal, infrastructure) for the rest.
import { getCombatWidth } from './combatWidth';

const includesAny = (haystack, needles) => needles.some((n) => haystack.includes(n));

const MOUNTAIN_KEYWORDS = [
  'alps', 'alpes', 'alpi', 'himalay', 'andes', 'andina', 'rockies', 'rocky mountain', 'ural',
  'carpath', 'caucasus', 'pamir', 'zagros', 'sierra nevada', 'sierra madre', 'atlas mountains',
  'pyren', 'apennin', 'dolomit', 'tatra', 'balkan', 'altai', 'tian shan', 'hindu kush', 'kunlun',
  'drakensberg', 'southern alps', 'cordillera', 'massif central', 'jura', 'harz', 'ore mountains'
];
const DESERT_KEYWORDS = [
  'sahara', 'arabian desert', 'gobi', 'atacama', 'kalahari', 'mojave', 'namib', 'thar desert',
  'sonora', 'karakum', 'kyzylkum', 'taklamakan', 'negev', 'sinai', 'rub al khali', 'nafud',
  'great victoria desert', 'simpson desert', 'chihuahuan'
];
const FOREST_KEYWORDS = [
  'amazon', 'amazonas', 'congo basin', 'taiga', 'siberia', 'borneo', 'sumatra', 'black forest',
  'schwarzwald', 'ardennes', 'bavarian forest', 'pacific northwest', 'rainforest', 'boreal'
];
const ARCTIC_KEYWORDS = [
  'arctic', 'greenland', 'svalbard', 'antarctic', 'nunavut', 'yakutia', 'sakha', 'yamal',
  'chukotka', 'novaya zemlya', 'franz josef land', 'northwest territories', 'lapland', 'iceland'
];
const HILLS_KEYWORDS = ['highland', 'plateau', 'hill country', 'uplands', 'downs'];
const ISLAND_KEYWORDS = ['island', 'isla', 'insel', 'ilha', 'archipelago', 'atoll', 'isle of'];
const URBAN_INFRASTRUCTURE_THRESHOLD = 9; // 0-10 scale; only the most developed handful of regions

const classify = (name, region) => {
  const lower = (name || '').toLowerCase();
  if (includesAny(lower, ARCTIC_KEYWORDS)) return 'arctic';
  if (includesAny(lower, MOUNTAIN_KEYWORDS)) return 'mountains';
  if (includesAny(lower, DESERT_KEYWORDS)) return 'desert';
  if (includesAny(lower, FOREST_KEYWORDS)) return 'forest';
  if (includesAny(lower, HILLS_KEYWORDS)) return 'hills';
  if (includesAny(lower, ISLAND_KEYWORDS)) return 'island';
  if ((region?.infrastructure || 0) >= URBAN_INFRASTRUCTURE_THRESHOLD) return 'urban';
  return 'mixed';
};

// Lazily memoized per regionId — pure function of static REGIONS_DATA, never of live game state
// (a region's physical terrain doesn't change with who owns it), so one cache entry per id for the
// whole process lifetime is safe, same reasoning as getNationCapital's own static index.
const terrainCache = {};
export const getRegionTerrain = (regionId, regionsData) => {
  if (terrainCache[regionId]) return terrainCache[regionId];
  const region = regionsData[regionId];
  const terrain = classify(`${region?.name || ''} ${region?.description || ''}`, region);
  terrainCache[regionId] = terrain;
  return terrain;
};

// Combat effects beyond combat width (already handled by combatWidth.js): a flat attacker damage
// modifier (terrain favoring the defender), and an attrition modifier for armies operating there —
// both read generically by battle.js/resolveTurn.js the same way local./national. modifier keys are.
export const TERRAIN_COMBAT_MODIFIERS = {
  plains: { attackerMult: 1, attritionMult: 1 },
  mixed: { attackerMult: 1, attritionMult: 1 },
  urban: { attackerMult: 1, attritionMult: 1 },
  island: { attackerMult: 1, attritionMult: 1 },
  hills: { attackerMult: 0.9, attritionMult: 1 }, // defender +10%, matching the plan's own table
  forest: { attackerMult: 0.9, attritionMult: 1 },
  mountains: { attackerMult: 0.75, attritionMult: 1.1 }, // defender +25%, attacker -10% (rounded together), attrition +10%
  desert: { attackerMult: 1, attritionMult: 1.2 },
  arctic: { attackerMult: 1, attritionMult: 1.25 }
};

export const getTerrainCombatModifier = (terrain) => TERRAIN_COMBAT_MODIFIERS[terrain] || TERRAIN_COMBAT_MODIFIERS.mixed;

// Re-exported so callers needing both a region's terrain AND its combat width only need one import.
export { getCombatWidth };
