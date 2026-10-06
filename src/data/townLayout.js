// src/data/townLayout.js
// The city manifest (plans/MASTER-PLAN.md phase B, sections 6.3 and 6.8; the world plan sections
// 7 to 11): one list of a city's structures, with stable ids, that both the close view of the map
// and the tactical battle read. Pure data and functions, no three.js and no game state: the
// engine's src/engine/cityManifest.js gathers the inputs from a city record.
//
// Where the structures come from:
//   town      the assembled town model the close view shows for the city's age, size, land style
//             and seed (townFileKey: the same pick as the close view's townAssets.townAssetUrl).
//             Its houses and landmarks were split back out of the merged model by
//             scripts/art/build-town-layouts.mjs into src/data/townLayouts.json. An age and size
//             with no file shows the procedural town (proceduralHouses, the same scatter).
//   townhall  the town's centre, the battle's keep (the objective); houses 20 people.
//   palace    a capital's palace on the free centre (the shared file's palace / palace-small).
//   buildings one per built category (src/data/buildings.js), at its current tier, on the spots
//             the close view uses (closeView/buildingModels.js buildingSpots, most wanted first).
//   walls     with a Defense building: the shared file's wall ring of the town's size, split by
//             code into WALL_SEGMENT_M segments, the gate at the front (model south) and towers
//             spread round the ring (art plan S7 wall kits replace the split later).
//   wonders   built wonders standing on the city's own land (their tile, not the town).
//
// Ids are stable and readable: `house-<n>` is the town's nth house counted from the square outward
// (so a city that grows into a bigger town keeps its first houses' ids), `landmark-<n>` the town
// model's own landmarks, `bld-<category>`, `wall-<n>`, `gate`, `tower-<n>`, `palace`, `townhall`,
// `wonder-<projectId>`. Saves store only damage keyed by these ids (src/engine/cityManifest.js);
// the manifest itself is rebuilt from the city on demand, so it is never saved.
//
// Units: model units of the town files (1 unit = 10 m), x east, z south (glTF, the close view's
// town space). The battle turns and scales it (src/battle/setup/cityBattle.js).
import LAYOUTS from './townLayouts.json';
import { styleChain } from './architecture';
import { BUILDING_CATEGORIES, getCategoryTierName } from './buildings';
import { TOWN_TIERS } from './townTiers';

export const MANIFEST_VERSION = 1;
export const LAYOUT_VERSION = LAYOUTS.version;

// ---- which town model ------------------------------------------------------------------------------
// Each age's two layouts carry two traditions until every region has its kit (art spec 3b).
// Bronze: a is Mesopotamian, b Egyptian; the Nile builds b, the Levant a. Classical: a is Roman,
// b Han; East and South-East Asia and Mongolia build b. Kingdoms: a is European, b Abbasid and
// Andalusian; the Nile, the Levant, the Maghreb, Iberia (al-Andalus) and Central Asia (Bukhara,
// Samarkand) build b. Elsewhere, and in the Gunpowder and Modern Ages, the city's seed mixes both
// so neighbours differ.
export const TOWN_VARIANT_BY_AGE = {
  bronze: { nile: 'b', levant: 'a', israelite: 'a' },
  classical: { sinic: 'b', japan: 'b', korea: 'b', monsoon: 'b', steppe: 'b', others: 'a' },
  kingdoms: { nile: 'b', levant: 'b', maghreb: 'b', andalus: 'b', steppe: 'b', israelite: 'b', others: 'a' }
};

/** The variant ('a' or 'b') a city builds in this age on land of this style. */
export const townVariant = (ageId, style, seed = 0) => {
  const rule = TOWN_VARIANT_BY_AGE[ageId];
  return (rule && (rule[style] || rule.others)) || (seed % 2 ? 'b' : 'a');
};

/** Index town file names ('bronze-town-small-a-europe') as { 'bronze:small': { europe: { a: name } } }. */
export const indexTownFiles = (names) => {
  const out = {};
  names.forEach((name) => {
    const m = name.match(/([a-z]+)-town-(small|medium|big)-([ab])(?:-([a-z]+))?$/);
    if (m) ((out[`${m[1]}:${m[2]}`] ||= {})[m[4] || 'base'] ||= {})[m[3]] = name;
  });
  return out;
};
const LAYOUT_INDEX = indexTownFiles(Object.keys(LAYOUTS.towns));

/** The town file (its name without .glb) a city of this age, size, seed and land style shows, or
 * null: the land's regional kit when that file exists (layout a or b by the seed), else the age's
 * base kit in the layout the land's tradition (or the seed) picks; the other layout when only one
 * exists. `index` defaults to the files that have a layout. */
export const townFileKey = (ageId, tierId, seed = 0, style = null, index = LAYOUT_INDEX) => {
  const kits = index[`${ageId}:${tierId}`];
  if (!kits) return null;
  // A regional kit builds both layouts in its own tradition, so the city's seed picks between
  // them; the age's tradition rule only steers the base towns.
  const pick = (k, v) => k && (k[v] || k.a || k.b);
  const own = seed % 2 ? 'b' : 'a';
  for (const st of styleChain(style)) { const key = pick(kits[st], own); if (key) return key; }
  return pick(kits.base, townVariant(ageId, style, seed)) || null;
};

/** The city's seed for its look: the sum of its id's character codes (as the close view). */
export const citySeed = (cityId) => [...String(cityId)].reduce((h, c) => h + c.charCodeAt(0), 0);

// ---- the town's own houses -------------------------------------------------------------------------
const decode = (flat) => {
  const out = [];
  for (let i = 0; i + 4 < flat.length; i += 5) out.push({ x: flat[i] / 100, z: flat[i + 1] / 100, w: flat[i + 2] / 100, d: flat[i + 3] / 100, h: flat[i + 4] / 100 });
  return out;
};
const layoutCache = new Map();
/** { houses: [{ x, z, w, d, h }], landmarks: [...] } of a town file, or null. */
export const townLayout = (key) => {
  if (!key || !LAYOUTS.towns[key]) return null;
  if (!layoutCache.has(key)) { const [h, l] = LAYOUTS.towns[key]; layoutCache.set(key, { houses: decode(h), landmarks: decode(l) }); }
  return layoutCache.get(key);
};

// ---- the procedural town (an age and size with no town file: closeView/townModels.js) -----------
// A small seeded generator (mulberry32) from a string.
export const seededRandom = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
/** The procedural town's houses: a seeded scatter off the plaza and apart from each other,
 * [{ x, z, w, d, h, rot, shade }] (rot: radians about y; w and d are the unturned sizes). */
export const proceduralHouses = (cityId, tierId, ageId = 'bronze') => {
  const tier = TOWN_TIERS.find((t) => t.id === tierId) || TOWN_TIERS[0];
  const modern = ageId === 'modern';
  const rand = seededRandom(`${cityId}|${tier.id}|houses`);
  const plaza = tier.id === 'small' ? 0.5 : 0.95;
  const placed = [];
  let tries = 0;
  while (placed.length < tier.houses && tries < tier.houses * 30) {
    tries += 1;
    const a = rand() * Math.PI * 2; const r = plaza + 0.35 + rand() * (tier.radius - plaza - 0.5);
    const x = Math.cos(a) * r; const z = Math.sin(a) * r;
    const w = 0.55 + rand() * 0.4; const d = 0.5 + rand() * 0.3;
    if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < ((p.w + w) * 0.62) ** 2)) continue;
    const tall = modern && rand() < 0.35;
    const h = tall ? 1.2 + rand() * 1.6 : 0.45 + rand() * (tier.id === 'big' ? 0.5 : 0.3);
    placed.push({ x, z, w, d, h, rot: a + Math.PI / 2, shade: 0.85 + rand() * 0.3 });
  }
  return placed;
};

// ---- housing (master plan 6.3)---------------------------------------------------------------------
// A house shelters people by its floor area (model units squared: 0.5 is 50 square metres):
// a hut 5, a common house 10, a large house 15. The town hall 20. Ruined houses shelter nobody;
// damaged ones still do.
export const TOWNHALL_HOUSING = 20;
export const HOUSING_BY_AREA = [[0.45, 5], [0.9, 10], [Infinity, 15]];
export const houseHousing = (w, d) => HOUSING_BY_AREA.find(([a]) => w * d < a)[1];

// ---- walls (art plan S7: the ring split by code until the wall kits arrive) -----------------------
// The ring's centre line per town size (just inside the shared files' walls-small, -medium and
// -big outer edges, closeView/buildingModels.js WALL_OUTER), model units.
export const WALL_RADIUS = { small: 2.25, medium: 3.3, big: 4.4 };
export const WALL_THICKNESS = 0.2;
export const WALL_SEGMENT_M = 15; // one segment, metres along the ring
// Towers on the ring: two, plus one per Defense tier, at most six.
export const wallTowerCount = (defenseTier) => Math.min(6, 2 + Math.max(0, defenseTier));

// Fixed sizes for structures with no measured footprint (model units).
const PALACE_SIZE = { small: [1.0, 0.9, 0.9], medium: [1.3, 1.1, 1.2], big: [1.3, 1.1, 1.2] }; // w, d, h
const TOWNHALL_SIZE = [0.9, 0.9, 0.8];
const BUILDING_SIZE = [1.2, 1.0, 0.9];
const WONDER_SIZE = [1.8, 1.8, 2.0];
// Landmark spots round a town (the close view's buildingSpots): inner on the back (north) rim,
// then outside the wall every 20 degrees, north first, never at the gate (south).
const TOWN_HALF = { small: 2.0, medium: 3.0, big: 4.0 };
const BUILDING_DISC = 0.8;
const buildingSpotsFor = (tierId, seed) => {
  const half = TOWN_HALF[tierId] || TOWN_HALF.small;
  const shift = ((seed % 5) - 2) * 4;
  const inner = { small: [90], medium: [65, 115], big: [90, 45, 135] }[tierId] || [90];
  const at = (deg, r) => ({ x: r * Math.cos((deg * Math.PI) / 180), z: -r * Math.sin((deg * Math.PI) / 180) });
  const rOut = (WALL_RADIUS[tierId] || WALL_RADIUS.small) + 0.25 + BUILDING_DISC;
  const outer = [];
  for (let d = 0; d < 360; d += 20) { const deg = d + shift; const n = ((deg % 360) + 360) % 360; if (n >= 245 && n <= 295) continue; outer.push(deg); }
  outer.sort((a, b) => Math.min(Math.abs(a - 90), 360 - Math.abs(a - 90)) - Math.min(Math.abs(b - 90), 360 - Math.abs(b - 90)) || a - b);
  return [...inner.map((d) => at(d + shift, half - BUILDING_DISC + 0.05)), ...outer.map((d) => at(d, rOut)), ...outer.map((d) => at(d, rOut + 2 * BUILDING_DISC))];
};
// The order buildings take their spots: the categories that say most about a city first.
export const BUILDING_ORDER = ['culture', 'science', 'economy', 'military', 'food', 'industry', 'naval', 'logistics'];

/**
 * The manifest of one city from plain inputs:
 *   { cityId, ageId, tierId ('small'|'medium'|'big'), style, seed, capital, defenseTier (-1 none),
 *     buildings: { category: tier }, wonders: [projectId], camp }
 * Returns { version, cityId, townKey, ageId, tierId, style, structures: [{ id, kind, x, z, w, d,
 * h, housing?, category?, tier?, name?, passive }] } with structures in a fixed order.
 * `kind`: townhall, house, landmark, palace, building, wall, gate, tower, wonder. `passive`: a
 * civilian structure (no fire, no effect in battle beyond housing; world plan section 8).
 */
export const buildTownManifest = ({ cityId, ageId = 'bronze', tierId = 'small', style = null, seed = 0, capital = false, defenseTier = -1, buildings = {}, wonders = [], camp = false }) => {
  const townKey = camp ? null : townFileKey(ageId, tierId, seed, style);
  // no town file for this age and size: the procedural town's houses (an outpost has none)
  const layout = townLayout(townKey) || { houses: camp ? [] : proceduralHouses(cityId, tierId, ageId).map(({ x, z, w, d, h }) => ({ x, z, w, d, h })), landmarks: [] };
  const s = [];
  const [tw, td, th] = TOWNHALL_SIZE;
  s.push({ id: 'townhall', kind: 'townhall', x: 0, z: 0, w: tw, d: td, h: th, housing: TOWNHALL_HOUSING, passive: false });
  if (capital) { const [w, d, h] = PALACE_SIZE[tierId] || PALACE_SIZE.small; s.push({ id: 'palace', kind: 'palace', x: 0, z: -0.15, w, d, h, passive: true }); }
  layout.houses.forEach((b, i) => s.push({ id: `house-${i}`, kind: 'house', ...b, housing: houseHousing(b.w, b.d), passive: true }));
  layout.landmarks.forEach((b, i) => s.push({ id: `landmark-${i}`, kind: 'landmark', ...b, passive: true }));
  const spots = buildingSpotsFor(tierId, seed);
  const taken = [...layout.landmarks];
  let next = 0;
  BUILDING_ORDER.filter((c) => (buildings[c] ?? -1) >= 0 && BUILDING_CATEGORIES[c]).forEach((category) => {
    const tier = buildings[category];
    const [w, d, h] = BUILDING_SIZE;
    // the first spot clear of the town's landmarks and the buildings already placed
    while (next < spots.length && taken.some((t) => Math.abs(t.x - spots[next].x) < (t.w + w) / 2 && Math.abs(t.z - spots[next].z) < (t.d + d) / 2)) next += 1;
    const spot = spots[Math.min(next, spots.length - 1)];
    next += 1;
    const b = { id: `bld-${category}`, kind: 'building', category, tier, name: getCategoryTierName(category, tier) || BUILDING_CATEGORIES[category].label, x: spot.x, z: spot.z, w, d, h, passive: false };
    taken.push(b);
    s.push(b);
  });
  if (defenseTier >= 0 && !camp) {
    const r = WALL_RADIUS[tierId] || WALL_RADIUS.small;
    const n = Math.max(8, Math.round((2 * Math.PI * r * 10) / WALL_SEGMENT_M));
    const step = (2 * Math.PI) / n;
    const len = 2 * r * Math.sin(step / 2);
    // segment 0 centred on the gate (south, +z: angle -90 degrees with north up)
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * step;
      const seg = { x: r * Math.cos(a), z: -r * Math.sin(a), w: len, d: WALL_THICKNESS, h: 0.5, yaw: a + Math.PI / 2, passive: false };
      s.push(i === 0 ? { id: 'gate', kind: 'gate', ...seg } : { id: `wall-${i - 1}`, kind: 'wall', ...seg });
    }
    const towers = wallTowerCount(defenseTier);
    for (let i = 0; i < towers; i++) {
      // spread evenly from the gate's two sides round the back
      const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / towers;
      s.push({ id: `tower-${i}`, kind: 'tower', x: r * Math.cos(a), z: -r * Math.sin(a), w: 0.45, d: 0.45, h: 0.9, passive: false });
    }
  }
  const wr = (WALL_RADIUS[tierId] || WALL_RADIUS.small) + 1.6;
  [...wonders].sort().forEach((projectId, i) => {
    const a = Math.PI / 2 + (i % 2 ? 1 : -1) * (0.5 + Math.floor(i / 2) * 0.6);
    const [w, d, h] = WONDER_SIZE;
    s.push({ id: `wonder-${projectId}`, kind: 'wonder', projectId, x: wr * Math.cos(a), z: -wr * Math.sin(a), w, d, h, passive: true });
  });
  return { version: MANIFEST_VERSION, layoutVersion: LAYOUT_VERSION, cityId, townKey, ageId, tierId, style, structures: s };
};

/** Houses and buildings: the structures the 50% rule counts (master plan 6.8). */
export const isCivic = (st) => st.kind === 'house' || st.kind === 'building';

/** The defender's housing cap (master plan 6.3): the town hall plus every house not ruined. */
export const manifestHousing = (manifest, ruined = {}) => manifest.structures
  .reduce((sum, st) => sum + (st.housing && !ruined[st.id] ? st.housing : 0), 0);
