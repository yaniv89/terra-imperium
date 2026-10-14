// src/battle/art/treeMix.js
// Which tree stands where (manifest rows MD05 and MD14): a vegetation kit holds several species,
// each at three sizes (objects tree-s, tree-m, tree-l for the first species, tree-s-2 ... for the
// second, and so on). Every tree of a battlefield takes a species, a size and a rank from a hash
// of its own place, never from Math.random, so a replay, a screenshot and both players' screens
// show the same wood. Pure: no three.js, no loading.

export const TREE_SIZES = ['s', 'm', 'l'];
const TREE_NAME = /^tree-([sml])(?:-(\d+))?$/;

/** 0..1 from two integers and a salt. */
export const hash2 = (a, b, salt = 0) => {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((b | 0) + Math.imul(salt | 0, 0x632be5ab)) ^ 0xc2b2ae35, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** 'tree-m-2' -> { species: 1, size: 1 } (species and size from 0), or null for any other object. */
export const parseTreeName = (name) => {
  const m = TREE_NAME.exec(name || '');
  return m ? { species: Number(m[2] || 1) - 1, size: TREE_SIZES.indexOf(m[1]) } : null;
};

/**
 * The species of some kits' objects, in order: [[small, medium, large], ...] where each entry is
 * the object or null. `kits` are parsed kit files (kitLoader.js), the battle's own kit first and
 * then the files that add species to it; an earlier file's object wins a name both have.
 */
export const treeSpecies = (...kits) => {
  const bySpecies = new Map();
  kits.filter(Boolean).forEach((kit) => Object.entries(kit.objects || {}).forEach(([name, obj]) => {
    const t = parseTreeName(name);
    if (!t) return;
    if (!bySpecies.has(t.species)) bySpecies.set(t.species, [null, null, null]);
    const row = bySpecies.get(t.species);
    if (!row[t.size]) row[t.size] = obj;
  }));
  return [...bySpecies.keys()].sort((a, b) => a - b).map((k) => bySpecies.get(k));
};

/** The size a species really has nearest to the wanted one (a kit with only tree-l still draws). */
export const nearestSize = (row, size) => {
  if (!row) return -1;
  for (const d of [0, 1, -1, 2, -2]) if (row[size + d]) return size + d;
  return -1;
};

/** Woods grow in stands: this many tiles square share a leading species. */
export const STAND_TILES = 9;
/** The share of a stand's trees that are its leading species; the rest are any species. */
export const STAND_SHARE = 0.6;
/** Small, medium and large trees: the shares of each. */
export const SIZE_SHARES = [0.3, 0.42, 0.28];
/** How much of a wood is drawn at each vegetation LOD: all of it close up, thinned further out,
 * so the crowns stand apart and the ground (and the men on it) shows between them. The trees kept
 * at a far level are always among those kept nearer (one rank per tree), so zooming never swaps
 * one tree for its neighbour. */
export const KEEP_AT_LOD = [1, 0.7, 0.52];
/** The far level draws its fewer trees this much larger, so a wood keeps its weight. */
export const FAR_CROWN_SCALE = 1.14;

const cell = (v) => Math.round(v * 16);

/**
 * One tree's draw from its place on the field (tile units): the species (0 .. speciesCount - 1),
 * the size (0 small, 1 medium, 2 large), its rank (0..1: drawn at a LOD while rank < KEEP_AT_LOD)
 * and its own scale (0.86 .. 1.14).
 */
export const treeAt = (x, z, speciesCount = 1) => {
  const a = cell(x); const b = cell(z);
  const n = Math.max(1, speciesCount | 0);
  // the stand's leading species: cells of STAND_TILES, shifted row by row so stands are not a grid
  const row = Math.floor(z / STAND_TILES);
  const col = Math.floor((x + (hash2(row, 7, 11) - 0.5) * STAND_TILES) / STAND_TILES);
  const lead = Math.floor(hash2(col, row, 3) * n) % n;
  const species = hash2(a, b, 1) < STAND_SHARE ? lead : Math.floor(hash2(a, b, 2) * n) % n;
  const s = hash2(a, b, 4);
  const size = s < SIZE_SHARES[0] ? 0 : s < SIZE_SHARES[0] + SIZE_SHARES[1] ? 1 : 2;
  return { species, size, rank: hash2(a, b, 5), scale: 0.86 + hash2(a, b, 6) * 0.28 };
};

/** The battle's wind (a turn about the vertical, radians) from its seed: wind-bent trees lean this way. */
export const windYaw = (seed = 0) => hash2(seed | 0, 77, 13) * Math.PI * 2;

/** A crown standing this far off the trunk's foot (a share of the tree's height) marks a wind-bent tree. */
export const LEAN_SHARE = 0.25; // the steppe elm stands 0.36 to 0.42 off; olives, palms, dwarf birches under 0.2
/** Which way a tree leans, from its box in its own space (glTF axes: y up), or null for an
 * upright tree: the angle the turn about y measures, so turning the tree by `w - leanOf(box)`
 * points its lean at w. */
export const leanOf = (box) => {
  if (!box) return null;
  const cx = (box.min.x + box.max.x) / 2; const cz = (box.min.z + box.max.z) / 2;
  const h = box.max.y - box.min.y;
  return h > 0 && Math.hypot(cx, cz) > LEAN_SHARE * h ? Math.atan2(-cz, cx) : null;
};

/** The size level by a medium tree's height on screen (css px; REFERENCE_TREE_UNITS tall): LOD0 from TREE_LOD_PX[0] up,
 * LOD1 from TREE_LOD_PX[1], LOD2 below. On a landscape phone these sit at zoom 2 and 0.9 (where
 * the zoom rule switched); a desktop's larger view switches at its own zooms. The size level sets
 * how much of a wood is drawn (KEEP_AT_LOD) and the finest detail allowed. */
export const TREE_LOD_PX = [70, 32];
/** The reference tree for that height: a medium tree, 6 m (0.6 model units). */
export const REFERENCE_TREE_UNITS = 0.6;
/** A level is kept until the size is this much past its threshold, so a slow zoom does not flicker. */
export const TREE_LOD_HYSTERESIS = 0.08;
export const treeLodForPx = (px, prev = 1) => {
  for (let k = 0; k < TREE_LOD_PX.length; k++) {
    const need = TREE_LOD_PX[k] * (prev <= k ? 1 - TREE_LOD_HYSTERESIS : 1 + TREE_LOD_HYSTERESIS);
    if (px >= need) return k;
  }
  return TREE_LOD_PX.length;
};

/**
 * The detail level the trees draw this frame: the size level, or coarser while `cost(level)` (the
 * triangles the visible trees would draw at that level, shadows included) is over `budget`; a
 * finer level than last frame only with 15% to spare, so a pan does not flip it back and forth.
 * Like soldierLod.js pickSoldierTier. Only the detail changes: how many trees stand is the size
 * level's (a wood never thins because it is near the budget).
 */
export const pickTreeLod = ({ sizeLod, cost, budget = Infinity, prev = sizeLod }) => {
  let lod = sizeLod;
  while (lod < 2 && cost(lod) > budget * (lod < prev ? 0.85 : 1)) lod += 1;
  return lod;
};

/** How many of `ranks` (sorted ascending) are drawn at a vegetation LOD. */
export const keptCount = (ranks, lod) => {
  const limit = KEEP_AT_LOD[lod] ?? 1;
  let n = 0;
  while (n < ranks.length && ranks[n] < limit) n++;
  return n;
};
