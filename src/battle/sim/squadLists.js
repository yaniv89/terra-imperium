// src/battle/sim/squadLists.js
// Short lists of squads picked by a field that never changes after createWorld (classId,
// commanderId, side), built once per world and kept beside it (not on it, so hashes, clones and
// saves never see them). Hot checks that only care about a few squads (is a general near? is enemy
// cavalry near?) walk these instead of the whole army. Callers still test everything that can
// change (alive, on the field, routed, position), so the answers are exactly the full scan's.
const lists = new WeakMap();

export const staticSquads = (w, key, pick) => {
  let byKey = lists.get(w.squads);
  if (!byKey || byKey.count !== w.squads.length) { byKey = { count: w.squads.length }; lists.set(w.squads, byKey); }
  return byKey[key] || (byKey[key] = w.squads.filter(pick));
};

export const generalsOf = (w) => staticSquads(w, 'generals', (q) => !!q.commanderId);
export const cavalryOf = (w) => staticSquads(w, 'cavalry', (q) => q.classId === 'cavalry');
