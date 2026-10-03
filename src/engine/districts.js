// src/engine/districts.js
// Districts as tiles (plans/civ-map-rework.md B3, C1 and C3.4): a city's Science, Culture and
// Economy lines stand on a tile of its border once their first tier is built, and the tile
// pays by what is around it, Civ VI's adjacency:
//   science  Campus          +DISTRICT_BASE science, +1 per mountain beside it (max 2), +1 on a river
//   culture  Temple Quarter  +DISTRICT_BASE culture, +1 per wonder beside it, +1 beside the centre
//   economy  Market Quarter  +DISTRICT_BASE gold, +1 on a river, +1 on the coast, +1 on a road
// The site is chosen when the line's first tier completes (cities.js): the best adjacency on a
// free land tile of the border, nearer rings first, lowest tile id last. The tile keeps its own
// terrain yields and can hold no improvement. A pillaged district (threat.js) pays nothing for
// DISTRICT_REPAIR_TURNS turns, then its city has rebuilt it. The player and the AI alike go
// through the city queue, so both get districts. Pure.
import { tileFacts } from '../data/tileYields';

export const DISTRICT_BASE = 1;
export const DISTRICT_REPAIR_TURNS = 5;
export const DISTRICTS = {
  science: { id: 'science', name: 'Campus', line: 'science', yield: 'science', glyph: 'C' },
  culture: { id: 'culture', name: 'Temple Quarter', line: 'culture', yield: 'culture', glyph: 'T' },
  economy: { id: 'economy', name: 'Market Quarter', line: 'economy', yield: 'gold', glyph: 'M' }
};
export const DISTRICT_IDS = Object.keys(DISTRICTS);

/** The adjacency bonus of `kind` on `tile` (the base not included). */
export const adjacencyOf = (tiles, world, tile, kind, city = null) => {
  const ts = world?.tileState || {};
  const near = tiles.neighbors[tile];
  if (kind === 'science') return Math.min(2, near.filter((n) => tiles.reliefOf(n) === 'mountains').length) + (tiles.rivers[tile] !== 0 ? 1 : 0);
  if (kind === 'culture') return near.filter((n) => ts[n]?.wonder).length + (city && near.includes(city.tile) ? 1 : 0);
  if (kind === 'economy') return (tiles.rivers[tile] !== 0 ? 1 : 0) + (tiles.coastal[tile] === 1 ? 1 : 0) + (ts[tile]?.road ? 1 : 0);
  return 0;
};

const free = (tiles, world, city, t) => {
  if (t === city.tile || tiles.land[t] !== 1) return false;
  if (tiles.reliefOf(t) === 'mountains' || tiles.terrainOf(t) === 'snow' || tiles.featureOf(t) === 'ice') return false;
  const e = world?.tileState?.[t];
  return !e?.improvement && !e?.wonder && !e?.district;
};

/** The tile the city would put a `kind` district on, or null when none is free. */
export const districtSite = (tiles, world, city, kind) => {
  const ring1 = new Set(tiles.neighbors[city.tile]);
  let best = null; let bestScore = -1;
  (city.tiles || []).forEach((t) => {
    if (!free(tiles, world, city, t)) return;
    const score = adjacencyOf(tiles, world, t, kind, city) * 10 + (ring1.has(t) ? 1 : 0);
    if (score > bestScore || (score === bestScore && t < best)) { best = t; bestScore = score; }
  });
  return best;
};

/** The city's districts: [{ kind, name, tile, pillaged, yield, amount }]. */
export const districtsOf = (tiles, world, city) => {
  const ts = world?.tileState || {};
  const out = [];
  (city.tiles || []).forEach((t) => {
    const e = ts[t];
    if (!e?.district || !DISTRICTS[e.district]) return;
    const d = DISTRICTS[e.district];
    out.push({ kind: d.id, name: d.name, tile: t, pillaged: !!e.pillaged, yield: d.yield, amount: e.pillaged ? 0 : DISTRICT_BASE + adjacencyOf(tiles, world, t, d.id, city) });
  });
  return out;
};

/** What the city's districts pay this turn: { science, culture, gold }. */
export const districtYields = (tiles, world, city) => {
  const y = { science: 0, culture: 0, gold: 0 };
  districtsOf(tiles, world, city).forEach((d) => { y[d.yield] += d.amount; });
  return y;
};

/** Whether the city already has a `kind` district standing (pillaged or not). */
export const hasDistrict = (world, city, kind) => (city.tiles || []).some((t) => world?.tileState?.[t]?.district === kind);

/** The tile state entry of a new district on `tile` (the caller writes it). */
export const districtEntry = (entry, kind) => ({ ...(entry || {}), district: kind, pillaged: false });

/** A pillaged district rebuilt: the entry with the pillage cleared once DISTRICT_REPAIR_TURNS passed, else the same entry. */
export const repairedDistrict = (entry, turn) => (entry?.district && entry.pillaged && entry.pillagedTurn != null && turn - entry.pillagedTurn >= DISTRICT_REPAIR_TURNS ? { ...entry, pillaged: false, pillagedTurn: undefined } : entry);

/** The facts of a tile with its district named, for the sheets. */
export const districtOnTile = (world, tile) => { const k = world?.tileState?.[tile]?.district; return k && DISTRICTS[k] ? DISTRICTS[k] : null; };

export { tileFacts };
