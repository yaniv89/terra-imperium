// src/engine/worldgen/generatedPeoples.js
// Peoples on a generated world (plans/MAP-VARIATIONS-PLAN.md 6.1 to 6.3, phase MV5). The world
// itself brings its fair start sites (src/worldgen/v1/startSites.js, `tiles.starts`): majors spaced
// by the 612 km gap and repaired so every one has copper or iron, horses and enough food, then the
// other candidates by score. This module only decides who stands where:
//
// - Who is a major: the player's people, the pinned people (the Kingdom of Israel, decision 13),
//   then the pool by weight x a seeded roll, exactly like peoplesWorld.js but without Earth's
//   geography (there is no real capital to keep apart). Late arrivals are never majors.
// - Where: by climate affinity with the people's home (peopleHomes.json: the Köppen class, coast
//   and river of its real capital). The player's people takes its best site first, the other
//   majors are assigned by the Hungarian method on the majors x sites affinity table, so the world
//   as a whole matches its peoples best. Camel peoples weigh dry climates, elephant peoples hot wet
//   ones, more (6.3).
// - Independents (and the late arrivals after them, whose sites wait empty until their year): in
//   the order of the independents roll, each takes the best-affinity site among the next free
//   candidates by score that the settling rule allows (citySpacing.js: no gap beyond it).
// Returns the site table `sites` ({ peopleId: tile }) saved in the scenario. Deterministic in
// (player, size, seed, world).
import HOMES from '../../data/geo/peopleHomes.json';
import { PEOPLES, PEOPLES_LIST, PINNED_PEOPLE_IDS } from '../../data/peoples';
import { WORLD_SIZES, DEFAULT_WORLD_SIZE } from '../../data/worldSizes';
import { citySpacingRings, landmassOf } from '../../data/geo/citySpacing';
import { createRng } from '../../utils/rng';
import { pickIndependents } from '../independents';

const MIX = 0x9e3779b9; // the same stream as peoplesWorld.js pickMajors

// Köppen class -> [annual mean temperature in C, annual rain in mm, dry season 0..1].
export const KOPPEN_PROTOTYPES = {
  Af: [27, 2600, 0], Am: [26, 2300, 0.4], As: [26, 1300, 0.7], Aw: [25, 1200, 0.7],
  BSh: [24, 450, 0.6], BSk: [11, 350, 0.5], BWh: [26, 100, 0.8], BWk: [13, 120, 0.7],
  Cfa: [17, 1200, 0.1], Cfb: [11, 900, 0.1], Cfc: [5, 1100, 0.1], Csa: [17, 600, 0.8], Csb: [13, 700, 0.7], Csc: [7, 800, 0.6],
  Cwa: [19, 1100, 0.7], Cwb: [15, 900, 0.7], Cwc: [8, 700, 0.7],
  Dfa: [10, 800, 0.2], Dfb: [5, 650, 0.2], Dfc: [-3, 450, 0.2], Dfd: [-12, 250, 0.3],
  Dsa: [10, 450, 0.7], Dsb: [6, 450, 0.7], Dsc: [-1, 400, 0.6], Dsd: [-10, 300, 0.6],
  Dwa: [9, 700, 0.8], Dwb: [4, 550, 0.8], Dwc: [-5, 400, 0.8], Dwd: [-14, 250, 0.8],
  ET: [-8, 300, 0.3], EF: [-25, 150, 0.3]
};
const CAMEL_PEOPLES = new Set(['saba', 'kindah', 'qedar']);
const ELEPHANT_PEOPLES = new Set(['magadha', 'kalinga', 'kamarupa', 'champa']);

/** The site's profile: the climate class (its own or a land neighbour's), coast, river, |latitude|. */
export const siteProfile = (tiles, tile) => {
  let k = tiles.climate[tile] >= 0 ? tiles.climateNames[tiles.climate[tile]] : null;
  if (!k) { const j = tiles.neighbors[tile].find((x) => tiles.climate[x] >= 0); k = j != null ? tiles.climateNames[tiles.climate[j]] : 'Cfb'; }
  return { k, c: tiles.coastal[tile] === 1 ? 1 : 0, v: tiles.rivers[tile] ? 1 : 0, lat: Math.abs(tiles.lat[tile] / 1000) };
};

/** Affinity of a site profile with a people's home, about 0 (alien) to 1.3 (its very home). */
export const affinity = (site, peopleId) => {
  const home = HOMES[peopleId];
  if (!home) return 0.5;
  const a = KOPPEN_PROTOTYPES[site.k] || KOPPEN_PROTOTYPES.Cfb;
  const b = KOPPEN_PROTOTYPES[home.k] || KOPPEN_PROTOTYPES.Cfb;
  let climate = 1 - Math.min(1, (Math.abs(a[0] - b[0]) / 30 + Math.abs(a[1] - b[1]) / 2500 + Math.abs(a[2] - b[2]) / 2) / 1.6);
  if (CAMEL_PEOPLES.has(peopleId)) climate *= site.k[0] === 'B' ? 1.3 : 0.6;
  if (ELEPHANT_PEOPLES.has(peopleId)) climate *= site.k[0] === 'A' || site.k.startsWith('Cw') ? 1.3 : 0.6;
  return climate + (site.c === home.c ? 0.15 : 0) + (site.v === home.v ? 0.1 : 0) + (1 - Math.min(1, Math.abs(site.lat - Math.abs(home.lat)) / 60)) * 0.05;
};

/** Minimum-cost assignment (the Hungarian method, O(n^3)) of rows to columns, rows <= columns:
 * returns the column of each row. Ties fall to the lower index. */
export const hungarian = (cost) => {
  const n = cost.length; const m = n ? cost[0].length : 0;
  const INF = Infinity;
  const u = new Array(n + 1).fill(0); const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0); const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Array(m + 1).fill(INF); const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]; let delta = INF; let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const out = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
};

/** The majors of a generated world: [player, ...others], by the weighted roll only. */
export const pickGeneratedMajors = (playerId, count, seed) => {
  const chosen = [playerId];
  PINNED_PEOPLE_IDS.forEach((id) => { if (chosen.length < count && !chosen.includes(id)) chosen.push(id); });
  const rng = createRng(((seed >>> 0) ^ MIX) >>> 0);
  PEOPLES_LIST.map((p) => ({ id: p.id, score: p.weightValue * (0.5 + rng.next()), late: p.arrives != null }))
    .filter((c) => !c.late && !chosen.includes(c.id))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .forEach((c) => { if (chosen.length < count) chosen.push(c.id); });
  return chosen;
};

const NEXT_FREE = 60; // independents choose among this many free candidates, best score first

/**
 * Who stands where on a generated world: { majors, independents, late, sites }. `tiles` is the
 * loaded generated grid (with `starts`).
 */
export const placeGeneratedPeoples = (playerId, sizeId = DEFAULT_WORLD_SIZE, seed = 1, tiles, { independents = true } = {}) => {
  const starts = tiles.starts;
  if (!starts?.majors?.length) throw new Error('This world has no start sites (not a generated world?)');
  const size = WORLD_SIZES[sizeId] || WORLD_SIZES[DEFAULT_WORLD_SIZE];
  if (!PEOPLES[playerId]) throw new Error(`Unknown people ${playerId}`);
  const siteTiles = starts.majors.slice(0, size.majors);
  const majors = pickGeneratedMajors(playerId, siteTiles.length, seed);
  const profiles = new Map();
  const prof = (t) => { let p = profiles.get(t); if (!p) { p = siteProfile(tiles, t); profiles.set(t, p); } return p; };
  const sites = {};
  // The player first: its best site (ties: the better-scored site, earlier in the list).
  let best = 0; let bestA = -Infinity;
  siteTiles.forEach((t, i) => { const a = affinity(prof(t), playerId); if (a > bestA) { bestA = a; best = i; } });
  sites[playerId] = siteTiles[best];
  const restSites = siteTiles.filter((_, i) => i !== best);
  const restPeoples = majors.slice(1);
  const cost = restPeoples.map((id) => restSites.map((t) => -affinity(prof(t), id)));
  hungarian(cost).forEach((col, row) => { sites[restPeoples[row]] = restSites[col]; });

  // Independents and late arrivals: the settling rule against every city placed so far.
  const blocked = new Uint8Array(tiles.count);
  const mass = landmassOf(tiles);
  const reach = citySpacingRings(tiles) - 1;
  const block = (c) => {
    blocked[c] = 1;
    let frontier = [c]; const seen = new Set(frontier);
    for (let d = 1; d <= reach; d++) {
      const next = [];
      frontier.forEach((i) => tiles.neighbors[i].forEach((j) => {
        if (seen.has(j)) return;
        seen.add(j); next.push(j);
        if (d < reach || mass[j] === mass[c]) blocked[j] = 1;
      }));
      frontier = next;
    }
  };
  Object.values(sites).forEach(block);
  const pick = independents ? pickIndependents(majors, sizeId, seed) : { ids: [], late: [] };
  const rng = createRng(((seed >>> 0) ^ 0x2545f491) >>> 0);
  const order = (ids) => ids.map((id) => ({ id, r: (PEOPLES[id]?.weightValue || 1) * (0.5 + rng.next()) })).sort((a, b) => b.r - a.r || (a.id < b.id ? -1 : 1)).map((x) => x.id);
  const placed = { ids: [], late: [] };
  let cursor = 0;
  const cands = starts.candidates;
  const placeOne = (id) => {
    const free = [];
    for (let i = cursor; i < cands.length && free.length < NEXT_FREE; i++) if (!blocked[cands[i]]) free.push(cands[i]);
    while (cursor < cands.length && blocked[cands[cursor]]) cursor++;
    if (!free.length) return false;
    let t = free[0]; let a = -Infinity;
    free.forEach((c) => { const x = affinity(prof(c), id); if (x > a) { a = x; t = c; } });
    sites[id] = t; block(t);
    return true;
  };
  order(pick.ids).forEach((id) => { if (placeOne(id)) placed.ids.push(id); });
  order(pick.late).forEach((id) => { if (placeOne(id)) placed.late.push(id); });
  return { majors, independents: placed.ids.sort(), late: placed.late.sort(), sites };
};

/** The start tile of a people in a game: the game's site table, else its real capital (Earth). */
export const siteOf = (scenario, peopleId) => scenario?.sites?.[peopleId] ?? PEOPLES[peopleId]?.tile ?? null;
