// src/engine/worldgen/peoplesWorld.js
// A new game's world from the peoples pool (plans/peoples-and-world-setup.md 4.3, phase W0).
//
// Who becomes a major: the player's people first, then the pinned peoples (the Kingdom of Israel,
// roadmap decision 13), then, among the peoples at least MAJOR_MIN_GAP_KM from every major
// already chosen, the one with the best `weight x a seeded roll between 0.5 and 1.5`, until the
// world size's count is reached. The great powers are likely but not certain, majors are never
// packed together and every seed gives a different world. Late arrivals (`arrives`) are never
// drawn: their land was not yet settled at the Dawn start. If the gap leaves too few candidates
// (it does not at the three sizes on the real grid) it is relaxed by GAP_RELAX until full.
// The pinned people neither keeps the gap nor holds others off by it (see below).
//
// Every nation starts equal (roadmap decision 10): one city of EQUAL_START_SIZE, the same army
// and treasury, no settlers. Capitals sit on the pool's built tiles (peopleCapitals.json), all
// spaced by the settling rule. Deterministic in (player, size, seed).
import { PEOPLES, PEOPLES_LIST, PINNED_PEOPLE_IDS } from '../../data/peoples';
import { WORLD_SIZES, DEFAULT_WORLD_SIZE, MAJOR_MIN_GAP_KM, EQUAL_START_SIZE } from '../../data/worldSizes';
import { distanceKm } from '../../data/geo/geodesic';
import { getTiles } from '../../data/geo/tiles';
import { createRng } from '../../utils/rng';

export const GAP_RELAX = 0.85;
const MIX = 0x9e3779b9; // the majors roll its own stream of the world seed

/** The major nations of a world: [playerId, ...others], deterministic. */
export const pickMajors = (playerId, sizeId = DEFAULT_WORLD_SIZE, seed = 1, { tiles = null } = {}) => {
  const size = WORLD_SIZES[sizeId];
  if (!size) throw new Error(`Unknown world size ${sizeId}`);
  if (!PEOPLES[playerId]) throw new Error(`Unknown people ${playerId}`);
  const tileOf = (id) => PEOPLES[id].tile;
  if (tileOf(playerId) == null) throw new Error('The peoples pool has no capital tiles: run npm run build:peoples');
  const grid = tiles || getTiles();
  const km = (a, b) => distanceKm(grid.centres[tileOf(a)], grid.centres[tileOf(b)]);
  const chosen = [playerId];
  PINNED_PEOPLE_IDS.forEach((id) => { if (!chosen.includes(id)) chosen.push(id); });
  const rng = createRng(((seed >>> 0) ^ MIX) >>> 0);
  const ranked = PEOPLES_LIST.map((p) => ({ id: p.id, score: p.weightValue * (0.5 + rng.next()), late: p.arrives != null }))
    .filter((c) => !c.late && !chosen.includes(c.id))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  let gap = MAJOR_MIN_GAP_KM;
  // A pinned people does not hold its neighbours off: it is in the world by decision, not by
  // draw, so Kemet and Akkad stay as likely as in any other world (the settling rule still holds:
  // every capital of the pool is spaced by construction).
  const gapHolders = () => chosen.filter((id) => id === playerId || !PEOPLES[id].pinned);
  while (chosen.length < size.majors && ranked.length) {
    for (let i = 0; i < ranked.length && chosen.length < size.majors; i++) {
      const c = ranked[i];
      if (gapHolders().every((s) => km(s, c.id) >= gap)) { chosen.push(c.id); ranked.splice(i, 1); i -= 1; }
    }
    gap *= GAP_RELAX;
  }
  return chosen.slice(0, size.majors);
};

/** Start specs in the shape of scenarios.js buildScenarioStarts: one equal city per people, named
 * after its real capital (the first of its 20 city names). */
export const buildPeoplesStarts = (ids) => {
  const starts = {};
  ids.forEach((id) => {
    const p = PEOPLES[id];
    starts[id] = { capital: p.tile, size: EQUAL_START_SIZE, cities: [{ tile: p.tile, size: EQUAL_START_SIZE, name: p.capital.name }], tiles: [p.tile], settlers: 0, hardStart: false };
  });
  return starts;
};
