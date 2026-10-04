// src/engine/world/tileIndex.js
// A flat, typed view of tile ownership for the per-cell loops (plans/math/perf.md). The game state
// keeps `world.tileOwner` as a plain { tile: cityId } object (serialisable, read by the UI and
// dozens of rules); this keeps, per ownership map, an Int32Array with one slot per tile holding the
// index of the owning city in `ids` (-1 for unowned). A lookup is an array read instead of a
// string-keyed dictionary probe, and a loop over neighbours touches no strings.
//
// Change lists instead of rebuilds: the engine copies the ownership map once a turn and then
// claims a few tiles. `noteOwnerCopy(base, copy)` and `noteOwnerWrite(map, tile)` record that, so
// the copy's index is the base's index (one typed-array copy) plus the written tiles, never a walk
// of the whole map. A map without a recorded history is indexed by one walk of its keys.
//
// Pure and derived: the index of a map always equals what a fresh walk of that map would give, as
// long as every in-place write to a map is recorded (cities.js records its own; a map built with
// a spread is a new object with no history and is walked). Cost: 4 bytes per tile (225 KB at 56k
// cells, 400 KB at 100k); a turn's derivation is O(cells / 1,000,000) for the copy plus O(writes).
const cache = new WeakMap();   // tileOwner -> { slot: Int32Array, ids: [cityId], indexOf: Map, pending: [tile] }
const lineage = new WeakMap(); // tileOwner -> { base, changes: [tile] } until its index is first built

/** Records that `copy` was made from `base` (a spread) and is about to be written in place. */
// A short history only: a chain of copies nobody indexed is cut after MAX_CHAIN (the next index of
// it walks the map), so old states are never kept alive through it.
const MAX_CHAIN = 4;
export const noteOwnerCopy = (base, copy) => {
  if (!base || !copy || base === copy) return;
  const depth = cache.has(base) ? 1 : (lineage.get(base)?.depth ?? MAX_CHAIN) + 1;
  if (depth <= MAX_CHAIN) lineage.set(copy, { base, changes: [], depth });
};
/** Records an in-place write of `tile` into `map`. */
export const noteOwnerWrite = (map, tile) => {
  const entry = cache.get(map);
  if (entry) { entry.pending.push(tile); return; }
  const l = lineage.get(map);
  if (l) l.changes.push(tile);
};

const setSlot = (entry, tile, id) => {
  if (id == null) { entry.slot[tile] = -1; return; }
  let i = entry.indexOf.get(id);
  if (i === undefined) { i = entry.ids.length; entry.ids.push(id); entry.indexOf.set(id, i); }
  entry.slot[tile] = i;
};

const walk = (tileOwner, count) => {
  const entry = { slot: new Int32Array(count).fill(-1), ids: [], indexOf: new Map(), pending: [] };
  for (const key in tileOwner) { const t = +key; if (t >= 0 && t < count) setSlot(entry, t, tileOwner[key]); }
  return entry;
};

/** { slot, ids, indexOf } for an ownership map on a grid of `count` cells. */
export const ownerSlots = (tileOwner, count) => {
  let entry = cache.get(tileOwner);
  if (entry && entry.slot.length === count) {
    if (entry.pending.length) { entry.pending.forEach((t) => setSlot(entry, t, tileOwner[t])); entry.pending = []; }
    return entry;
  }
  const l = lineage.get(tileOwner);
  if (l && l.base) {
    const base = ownerSlots(l.base, count);
    entry = { slot: base.slot.slice(), ids: base.ids.slice(), indexOf: new Map(base.indexOf), pending: [] };
    l.changes.forEach((t) => setSlot(entry, t, tileOwner[t]));
    lineage.delete(tileOwner);
  } else entry = walk(tileOwner, count);
  cache.set(tileOwner, entry);
  return entry;
};
