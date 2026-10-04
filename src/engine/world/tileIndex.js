// src/engine/world/tileIndex.js
// A flat, typed view of tile ownership for the per-cell loops (plans/math/perf.md). The game state
// keeps `world.tileOwner` as a plain { tile: cityId } object (serialisable, read by the UI and
// dozens of rules); this builds, once per ownership map, an Int32Array with one slot per tile
// holding the index of the owning city in `ids` (-1 for unowned). A lookup is an array read
// instead of a string-keyed dictionary probe, and a loop over neighbours touches no strings.
//
// Pure and derived: memoised on the identity of the ownership map, so it is never stale for a map
// that is not written in place (processCities writes into a private copy, cities.js privateWorld).
// Cost: O(owned tiles) to build, 4 bytes per tile (225 KB at 56k cells, 400 KB at 100k).
const cache = new WeakMap(); // tileOwner -> { slot: Int32Array, ids: [cityId], indexOf: Map }

export const ownerSlots = (tileOwner, count) => {
  let hit = cache.get(tileOwner);
  if (hit && hit.slot.length === count) return hit;
  const slot = new Int32Array(count).fill(-1);
  const ids = []; const indexOf = new Map();
  for (const key in tileOwner) {
    const id = tileOwner[key];
    if (id == null) continue;
    let i = indexOf.get(id);
    if (i === undefined) { i = ids.length; ids.push(id); indexOf.set(id, i); }
    const t = +key;
    if (t >= 0 && t < count) slot[t] = i;
  }
  hit = { slot, ids, indexOf };
  cache.set(tileOwner, hit);
  return hit;
};
