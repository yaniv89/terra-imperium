// src/components/map/closeView/buildingModels.js
// A city's constructed buildings as landmark models in the close view (art spec section 4). A file
// src/assets/map/buildings/{id}.glb is the base landmark of a building tier, {id}-{style}.glb the
// one a region builds (granary-israelite.glb); each holds one root object named after the id with
// LOD0..LOD2 children, the format of the shared files. A town shows its highest tiers that have a
// file, at most a few, on free spots of its ground: near the rim on the back (north) side, away
// from its banner, or just outside its wall ring between its fields. With no file nothing is drawn
// and the town stays as it is. Pure (no three.js); unit tested. Drawn by buildingLayer.js.
import { styleChain } from '../../../data/architecture';
import { getAgeIndex } from '../../../data/ages';
import { BUILDING_CATEGORIES } from '../../../data/buildings';

// The model id of each building tier, by category, in tier order. Defense has none: its tiers are
// the wall rings of the shared file.
export const BUILDING_MODEL_IDS = {
  food: ['granary', 'irrigation', 'farm_estate', 'crop_rotation_farm', 'mechanized_farm'],
  economy: ['market', 'bazaar', 'bank', 'stock_exchange'],
  military: ['barracks', 'drill_yard', 'military_academy', 'war_college'],
  science: ['library', 'scriptorium', 'university', 'research_lab'],
  industry: ['workshop', 'manufactory', 'factory'],
  culture: ['shrine', 'temple', 'cathedral', 'civic_center'],
  naval: ['harbor', 'shipyard', 'naval_base', 'carrier_dock'],
  logistics: ['road_post', 'highway', 'rail_depot']
};
export const EXTRACTION_MODEL_IDS = { copper: 'copper_mine', iron: 'iron_foundry', oil: 'oil_well' };
const EXTRACTION_AGE = { copper: 'bronze', iron: 'kingdoms', oil: 'modern' };
// Between equal tiers, the landmark that says most about a city goes first.
const CATEGORY_ORDER = ['culture', 'science', 'economy', 'military', 'food', 'industry', 'naval', 'logistics'];

/** Index model files by id and style: { granary: { base: url, israelite: url } }. */
export const indexBuildingFiles = (files) => {
  const out = {};
  Object.entries(files).forEach(([path, url]) => {
    const m = path.match(/\/([a-z_]+?)(?:-([a-z]+))?\.glb$/);
    if (m) (out[m[1]] ||= {})[m[2] || 'base'] = url;
  });
  return out;
};
const FILES = import.meta.glob('../../../assets/map/buildings/*.glb', { query: '?url', import: 'default', eager: true });
const BY_ID = indexBuildingFiles(FILES);

/** The object to draw from a loaded file: the one named after the file (granary-israelite), the
 * bare id (granary), or the file's only object. */
export const buildingRoot = (objs, id, url) => {
  const file = (url || '').match(/\/([a-z_]+(?:-[a-z]+)?)(?:-[\w]{6,})?\.glb/)?.[1];
  return (file && objs[file]) || objs[id] || Object.values(objs)[0];
};

/** The file for a building model on land of this style: its style chain first, then the base
 * file, or null (nothing is drawn). */
export const buildingModelUrl = (id, style = null, index = BY_ID) => {
  const files = index[id];
  if (!files) return null;
  for (const st of styleChain(style)) if (files[st]) return files[st];
  return files.base || null;
};

/** At most this many landmarks stand round a town of each size. */
export const MAX_BUILDINGS = { small: 3, medium: 3, big: 4 };

/** Every building a city has built, as [{ id, rank }], highest rank first: the tier's age, then
 * the tier within its line, then the category order. */
export const builtModels = (region) => {
  const cats = region?.buildings?.categories || {};
  const out = [];
  Object.entries(BUILDING_MODEL_IDS).forEach(([cat, ids]) => {
    const tier = cats[cat];
    if (!(tier >= 0) || !ids[tier]) return;
    const age = BUILDING_CATEGORIES[cat]?.tiers[tier]?.age;
    out.push({ id: ids[tier], rank: getAgeIndex(age) * 100 + tier * 10 + (CATEGORY_ORDER.length - CATEGORY_ORDER.indexOf(cat)) });
  });
  Object.entries(region?.buildings?.extraction || {}).forEach(([res, built]) => {
    if (built && EXTRACTION_MODEL_IDS[res]) out.push({ id: EXTRACTION_MODEL_IDS[res], rank: getAgeIndex(EXTRACTION_AGE[res]) * 100 });
  });
  return out.sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1));
};

const pickCache = new Map();
/** The landmarks a town shows: [{ id, url }], its highest tiers that have a file, at most
 * MAX_BUILDINGS for its size. Cached by the city's buildings and style. */
export const pickBuildingModels = (region, style = null, tierId = 'small', index = BY_ID) => {
  if (!Object.keys(index).length || !region?.buildings) return [];
  const cats = region.buildings.categories || {};
  const ext = region.buildings.extraction || {};
  const key = `${style}|${tierId}|${Object.values(cats).join(',')}|${Object.values(ext).map(Number).join('')}`;
  if (index === BY_ID && pickCache.has(key)) return pickCache.get(key);
  const out = builtModels(region)
    .map((b) => ({ id: b.id, url: buildingModelUrl(b.id, style, index) }))
    .filter((b) => b.url)
    .slice(0, MAX_BUILDINGS[tierId] || MAX_BUILDINGS.small);
  if (index === BY_ID) pickCache.set(key, out);
  return out;
};

// ---- placement -----------------------------------------------------------------------------------
// Model units (10 m): a landmark is 10 to 20 m across (the Israelite ones 15 to 18 m by 10 to 14),
// the disc round it BUILDING_DISC.
export const BUILDING_DISC = 0.8;
// The town's square ground reaches TOWN_HALF each way; the wall ring's outer edge WALL_OUTER (the
// shared files' walls-small, -medium and -big; the same ring with or without walls, so a town
// that builds its walls later keeps its landmarks where they stood).
const TOWN_HALF = { small: 2.0, medium: 3.0, big: 4.0 };
const WALL_OUTER = { small: 2.35, medium: 3.4, big: 4.5 };
// Inside the ground near the rim on the back side (north, away from the banner): one spot in a
// small town, two in a medium one, three in a big one (degrees: 90 is north, as in fieldsAround).
const INNER_ANGLES = { small: [90], medium: [65, 115], big: [90, 45, 135] };
// Outside the wall: every 20 degrees, north first, but never in front of the gate (south) nor
// where the town's army stands (south-east, scale.js ARMY_SPOT).
const OUTER_STEP = 20;
const GATE = [245, 295];
const ARMY = [-60, -10];
const FIELD_HALF = 0.8; // a field's half length along the ring (townAssets fieldsAround)

const inArc = (deg, [a, b]) => { const d = ((deg % 360) + 360) % 360; const lo = ((a % 360) + 360) % 360; const hi = ((b % 360) + 360) % 360; return lo <= hi ? d >= lo && d <= hi : d >= lo || d <= hi; };
const angleGap = (a, b) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };

/**
 * Where a town's landmarks may stand, in its model space (glTF: x east, z south), most wanted
 * first: [{ x, z, yaw, inner }]. Inner spots lie on the town's ground (only other landmarks can
 * be in the way); outer spots lie just outside the wall ring, clear of the town's own `fields`
 * ([{ x, z }] from fieldsAround), and must still find free land on the map (occupancy.js).
 */
export const buildingSpots = (tierId, seed = 0, fields = []) => {
  const half = TOWN_HALF[tierId] || TOWN_HALF.small;
  const wall = WALL_OUTER[tierId] || WALL_OUTER.small;
  const shift = ((seed % 5) - 2) * 4; // degrees, so neighbours differ
  const spot = (deg, r, inner) => {
    const a = (deg * Math.PI) / 180;
    return { x: r * Math.cos(a), z: -r * Math.sin(a), yaw: 0, inner, deg };
  };
  const inner = (INNER_ANGLES[tierId] || INNER_ANGLES.small).map((d) => spot(d + shift, half - BUILDING_DISC + 0.05, true));
  const rOut = wall + 0.1 + BUILDING_DISC;
  const fieldAngles = fields.map((f) => (Math.atan2(-f.z, f.x) * 180) / Math.PI);
  const fieldR = fields.length ? Math.hypot(fields[0].x, fields[0].z) : 0;
  // how far round the ring (degrees) a field and a landmark must keep apart
  const clear = fieldR ? ((FIELD_HALF + BUILDING_DISC) / fieldR) * (180 / Math.PI) : 0;
  const outer = [];
  for (let d = 0; d < 360; d += OUTER_STEP) {
    const deg = d + shift;
    if (inArc(deg, GATE) || inArc(deg, ARMY)) continue;
    if (fieldAngles.some((fa) => angleGap(fa, deg) < clear)) continue;
    outer.push(spot(deg, rOut, false));
  }
  outer.sort((a, b) => angleGap(a.deg, 90) - angleGap(b.deg, 90) || a.deg - b.deg);
  return [...inner, ...outer].map(({ deg: _deg, ...s }) => s);
};

/**
 * Give each landmark (most important first) the first spot that is clear of the landmarks
 * already placed and that `accept(spot)` allows (on land, and for an outer spot free on the
 * map). Returns [{ model, spot }] for the landmarks that found one; the rest are not drawn.
 */
export const assignSpots = (models, spots, accept = () => true) => {
  const out = [];
  const used = new Set();
  models.forEach((model) => {
    for (let i = 0; i < spots.length; i++) {
      if (used.has(i)) continue;
      const s = spots[i];
      if (out.some((o) => (o.spot.x - s.x) ** 2 + (o.spot.z - s.z) ** 2 < (2 * BUILDING_DISC) ** 2)) continue;
      if (!accept(s)) continue;
      used.add(i);
      out.push({ model, spot: s });
      return;
    }
  });
  return out;
};
