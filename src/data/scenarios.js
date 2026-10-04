// src/data/scenarios.js
// Scenario starts on the world grid (plans/civ-map-rework.md, B6). Every scenario is the same
// 240 peoples; what differs is the year, how many cities each starts with and how much land is
// claimed. Decided 2026-10-02: Dawn (2000 BCE) is the default and every nation starts with ONE
// city, its capital, owning the centre tile and its first ring. The world fills in by settling.
//
// Pure data and pure functions over the loaded tiles (src/data/geo/tiles.js): the engine's
// createInitialState turns a start spec into cities (workstream 3). Deterministic: ties break by
// nation id and tile id, never by randomness.
import { AGE_ORDER } from './ages';

export const SCENARIOS = {
  dawn: { id: 'dawn', name: 'Dawn of Civilization', year: -2000, age: 'bronze', ring: 1, extraCities: 0, description: 'Every people starts with one city. Settle the empty world.' },
  classical: { id: 'classical', name: 'Classical Age', year: -800, age: 'classical', ring: 2, extraCities: 1, description: 'Cities and their hinterlands; most of the world is still open.' },
  kingdoms: { id: 'kingdoms', name: 'Age of Kingdoms', year: 500, age: 'kingdoms', ring: 3, extraCities: 2, description: 'Realms with several cities each.' },
  gunpowder: { id: 'gunpowder', name: 'Age of Gunpowder', year: 1500, age: 'gunpowder', ring: 4, extraCities: 3, description: 'Established states on the eve of the modern world.' },
  modern: { id: 'modern', name: 'Modern Age', year: 1900, age: 'modern', ring: Infinity, extraCities: 6, description: 'Every tile is claimed; the modern borders.' }
};
export const DEFAULT_SCENARIO_ID = 'dawn';
export const SCENARIO_IDS = Object.keys(SCENARIOS);

// Starting size of the capital at the Dawn start, by how big a people was around 2000 BCE
// (B6: "Egypt and China start at size 5, most nations at 2"). Anything not listed is 2.
export const DAWN_CAPITAL_SIZE = {
  eg: 5, cn: 5, iq: 5, in: 4, pk: 4,
  ir: 4, tr: 4, gr: 3, sy: 3, il: 3, lb: 3, jo: 3, sd: 3, et: 3, ye: 3, om: 3, sa: 3, af: 3, uz: 3, tm: 3,
  kr: 3, jp: 3, vn: 3, th: 3, mm: 3, kh: 3, id: 3, mx: 3, pe: 3, gt: 3, bo: 3, it: 3, es: 3, ua: 3, ro: 3, bg: 3, ge: 3, am: 3, az: 3, cy: 3, mt: 3, ps: 3, kw: 3, bh: 3, ae: 3, qa: 3
};
// The five largest peoples of 2000 BCE also start with a settler, so the Nile, Mesopotamia, the
// Indus and the Yellow River fill in first, as they did.
export const DAWN_SETTLER_NATIONS = ['eg', 'cn', 'iq', 'in', 'pk'];

// Peoples whose land had no settled population in 2000 BCE start as a size-1 outpost with a
// settler and a "hard start" warning (B6), so all 240 stay pickable.
export const UNPEOPLED_AT_DAWN = new Set(['is', 'nz', 'gl', 'fo', 'ax', 'pm', 'fk', 'gs', 'hm', 'tf', 'io', 'sh', 'bm', 'mu', 'sc', 'cv', 'st', 'mv', 'ki', 'mh', 'fm', 'nr', 'pw', 'tv', 'to', 'ws', 'as', 'nu', 'ck', 'pf', 'pn', 'wf', 'nf', 'nc', 'vu', 'sb', 'fj', 'gu', 'mp', 'aq', 'bs', 'tc', 'ky', 'ai', 'vg', 'vi', 'ms', 'ag', 'kn', 'dm', 'lc', 'vc', 'gd', 'bb', 'tt', 'aw', 'cw', 'sx', 'mf', 'bl', 'pr', 'do', 'ht', 'jm', 'cu', 'mg', 'km', 'bn']);

export const capitalSizeFor = (scenario, nationId) => {
  if (UNPEOPLED_AT_DAWN.has(nationId)) return scenario.id === 'dawn' ? 1 : 2;
  const dawn = DAWN_CAPITAL_SIZE[nationId] || 2;
  // Later starts begin bigger: +1 per age after the Bronze Age.
  return dawn + AGE_ORDER.indexOf(scenario.age);
};

// Ring distance from `from` over the grid, limited to `maxRing`, as a Map tile -> ring.
export const ringsFrom = (tiles, from, maxRing) => {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const d = dist.get(id);
    if (d >= maxRing) continue;
    tiles.neighbors[id].forEach((n) => { if (!dist.has(n)) { dist.set(n, d + 1); queue.push(n); } });
  }
  return dist;
};

// Start capitals obey the settling rule (MIN_CITY_SPACING, 3 rings: no other city within 2 rings),
// as far as each nation's own land allows: real capitals can lie under 100 km apart, closer than
// one 106 km hex (Jerusalem, Ramallah, Amman). Bigger nations (more land tiles) are placed first
// and keep their real capital when it is clear; a capital that is not moves to the nearest tile of
// its own land that is. A land with no such tile (Luxembourg, Liechtenstein, the small islands)
// keeps its real capital, and then a bigger neighbour shifts up to BIG_MOVE_RINGS within its own
// land when that clears it. Moved capitals keep their real names (buildScenarioStarts).
// Deterministic, so every game starts the same.
export const START_SPACING = 3;
const BIG_MOVE_RINGS = 3;
export const spreadCapitals = (tiles, ids) => {
  const size = (id) => (tiles.countryTiles?.[id] || []).length;
  const order = [...ids].sort((a, b) => size(b) - size(a) || (a < b ? -1 : 1));
  const out = {};
  const livable = (t) => tiles.land[t] === 1 && tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice';
  const clearOf = (tile, others) => { const near = ringsFrom(tiles, tile, START_SPACING - 1); return !others.some((o) => near.has(o)); };
  // the nation's own livable tiles, nearest to `from` first (ring distance over the whole grid)
  const ownByDistance = (id, from, maxRing) => {
    const dist = ringsFrom(tiles, from, maxRing);
    return (tiles.countryTiles?.[id] || []).filter((t) => dist.has(t) && livable(t)).sort((a, b) => dist.get(a) - dist.get(b) || a - b);
  };
  const placed = [];
  order.forEach((id) => {
    const real = tiles.capitals[id];
    const tile = clearOf(real, placed) ? real : ownByDistance(id, real, 40).find((t) => clearOf(t, placed)) ?? real;
    out[id] = tile;
    placed.push(tile);
  });
  // Pass 2: a capital still crowded (its small land had no room) asks its bigger neighbours to
  // shift within their own land.
  order.forEach((small) => {
    const others = () => order.filter((o) => o !== small).map((o) => out[o]);
    if (clearOf(out[small], others())) return;
    const near = ringsFrom(tiles, out[small], START_SPACING - 1);
    order.filter((big) => big !== small && size(big) > size(small) && near.has(out[big])).forEach((big) => {
      const rest = order.filter((o) => o !== big).map((o) => out[o]);
      const t = ownByDistance(big, out[big], BIG_MOVE_RINGS).find((x) => clearOf(x, rest));
      if (t != null) out[big] = t;
    });
  });
  return out;
};

// Extra city sites inside a nation's modern territory: its most populous named tiles, at least
// 3 tiles apart from every other city, nearest the capital first on ties.
const extraCitySites = (tiles, nationId, capital, count, claimedBy) => {
  if (count <= 0) return [];
  const own = tiles.countryTiles[nationId] || [];
  const named = own.filter((id) => id !== capital && tiles.names[id] && tiles.land[id] && !tiles.lake?.[id]);
  const chosen = [];
  const farEnough = (id) => [capital, ...chosen].every((c) => !ringsFrom(tiles, c, 2).has(id));
  // Deterministic order: tile id, which the build fixed; the name list has no population, so the
  // capital-distance order below is the tie-break that matters.
  const byDistance = named.map((id) => ({ id, ring: ringsFrom(tiles, capital, 12).get(id) ?? 99 })).sort((a, b) => a.ring - b.ring || a.id - b.id);
  for (const { id } of byDistance) {
    if (chosen.length >= count) break;
    if (claimedBy.has(id) || !farEnough(id)) continue;
    chosen.push(id);
  }
  return chosen;
};

/**
 * Start specs for every nation in `nationIds` (default: every nation with a capital tile):
 *   { [nationId]: { capital, size, cities: [{ tile, size }], tiles: [tileIds], settlers, hardStart } }
 * Cities claim their centre and ring; land claims never overlap and prefer a nation's own
 * modern territory. In the Modern start every land tile of a country is claimed.
 */
export const buildScenarioStarts = (tiles, scenarioId = DEFAULT_SCENARIO_ID, nationIds = null) => {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`unknown scenario ${scenarioId}`);
  const ids = (nationIds || Object.keys(tiles.capitals)).filter((id) => tiles.capitals[id] != null).sort();
  const claimedBy = new Map();
  const starts = {};
  const capitals = spreadCapitals(tiles, ids);
  // Pass 1: capitals and extra cities (every city centre claimed first, so a ring never swallows
  // another nation's capital).
  ids.forEach((id) => {
    const capital = capitals[id];
    claimedBy.set(capital, id);
    // a capital moved off its real tile keeps its real name (Jerusalem, not the new tile's town)
    const name = capital !== tiles.capitals[id] ? tiles.names[tiles.capitals[id]] || undefined : undefined;
    starts[id] = { capital, size: capitalSizeFor(scenario, id), cities: [{ tile: capital, size: capitalSizeFor(scenario, id), name }], tiles: [capital], settlers: 0, hardStart: false };
  });
  ids.forEach((id) => {
    const extra = UNPEOPLED_AT_DAWN.has(id) && scenario.id === 'dawn' ? 0 : scenario.extraCities;
    extraCitySites(tiles, id, starts[id].capital, extra, claimedBy).forEach((tile) => {
      claimedBy.set(tile, id);
      starts[id].cities.push({ tile, size: Math.max(1, starts[id].size - 1) });
      starts[id].tiles.push(tile);
    });
  });
  // Pass 2: rings, one ring at a time for everyone (round robin keeps neighbours fair), own
  // country first, then any unclaimed land for a city with nothing else around it.
  const maxRing = scenario.ring === Infinity ? 0 : scenario.ring;
  for (let ring = 1; ring <= maxRing; ring++) {
    ids.forEach((id) => {
      starts[id].cities.forEach(({ tile }) => {
        const dist = ringsFrom(tiles, tile, ring);
        const ownFirst = [...dist.entries()].filter(([t, d]) => d === ring && tiles.land[t] && !claimedBy.has(t)).map(([t]) => t).sort((a, b) => a - b);
        const own = ownFirst.filter((t) => tiles.countryOf(t) === id);
        const take = own.length ? own : (ring === 1 ? ownFirst : []);
        take.forEach((t) => { claimedBy.set(t, id); starts[id].tiles.push(t); });
      });
    });
  }
  if (scenario.ring === Infinity) {
    ids.forEach((id) => (tiles.countryTiles[id] || []).forEach((t) => { if (!claimedBy.has(t)) { claimedBy.set(t, id); starts[id].tiles.push(t); } }));
  }
  ids.forEach((id) => {
    if (scenario.id === 'dawn') {
      if (DAWN_SETTLER_NATIONS.includes(id)) starts[id].settlers = 1;
      if (UNPEOPLED_AT_DAWN.has(id)) { starts[id].settlers = 1; starts[id].hardStart = true; }
    }
  });
  return { scenario, starts, claimedBy };
};

export const landClaimedShare = (tiles, claimedBy) => {
  const land = tiles.land.reduce((a, b) => a + b, 0);
  return claimedBy.size / land;
};
