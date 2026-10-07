// src/data/geo/terrainColumns.js
// Mountain ranges, ridges and passes as a pure function of the tile columns (phase F; moved out of
// scripts/geo/build-tile-terrain.mjs so Earth and generated worlds share it, plans/MAP-VARIATIONS-
// PLAN.md 3.4). The Earth build imports it back, so Earth's columns are unchanged.
//
//   range  Int16 per tile: the mountain range a mountain tile belongs to (a connected group of
//          mountain tiles, split by name where `nameAt` names its tiles), -1 elsewhere.
//   ridge  Uint8 per tile: bit k = a ridge line runs to neighbors[k]; per range the maximum
//          spanning forest by the lower end's elevation (Kruskal), so a chain follows its high ground.
//   pass   Uint8 per tile: 1 on a mountain pass (PASS_RULES): a mountain tile with passable lowland
//          on two separate sides, lower than at least two mountain neighbours; a range with
//          crossings but no saddle gets its lowest crossing.
// `neighbors`: the decorated grid's neighbour lists; `raw`: land, relief, terrain, feature,
// elevation and their name tables. Deterministic (fixed orders, id tie-breaks).

export const PASS_RULES = { minLowlandGroups: 2, minHigherNeighbours: 2 };

export const buildTerrainColumns = (raw, neighbors, { nameAt = null } = {}) => {
  const n = raw.count;
  const mountainCode = raw.reliefNames.indexOf('mountains');
  const snowCode = raw.terrainNames.indexOf('snow');
  const iceCode = raw.featureNames.indexOf('ice');
  const isMountain = (i) => raw.land[i] === 1 && raw.relief[i] === mountainCode;
  const passable = (i) => raw.land[i] === 1 && raw.terrain[i] !== snowCode && raw.feature[i] !== iceCode;

  // ---- ranges: connected mountain tiles, split by name ----------------------------------------
  const comp = new Int32Array(n).fill(-1);
  const label = new Array(n).fill(null);
  const range = new Int16Array(n).fill(-1);
  const rangeTiles = []; const rangeNames = [];
  let comps = 0;
  for (let i = 0; i < n; i++) {
    if (!isMountain(i) || comp[i] >= 0) continue;
    const list = [i]; comp[i] = comps;
    for (let q = 0; q < list.length; q++) for (const j of neighbors[list[q]]) if (isMountain(j) && comp[j] < 0) { comp[j] = comps; list.push(j); }
    list.sort((x, y) => x - y);
    let frontier = nameAt ? list.filter((t) => (label[t] = nameAt(t)) != null) : [];
    while (frontier.length) {
      const next = [];
      frontier.forEach((t) => neighbors[t].forEach((j) => { if (comp[j] === comps && label[j] == null && !next.includes(j)) { label[j] = label[t]; next.push(j); } }));
      frontier = next.sort((x, y) => x - y);
    }
    const byName = new Map();
    list.forEach((t) => { const key = label[t] ?? ''; if (!byName.has(key)) byName.set(key, []); byName.get(key).push(t); });
    [...byName.keys()].sort().forEach((key) => {
      const id = rangeTiles.length;
      byName.get(key).forEach((t) => { range[t] = id; });
      rangeTiles.push(byName.get(key)); rangeNames.push(key || null);
    });
    comps++;
  }
  if (rangeTiles.length > 32767) throw new Error('too many ranges for Int16');
  const rangeSizes = rangeTiles.map((l) => l.length);

  // ---- ridges -----------------------------------------------------------------------------------
  const ridge = new Uint8Array(n);
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const edges = [];
  for (let i = 0; i < n; i++) {
    if (!isMountain(i)) continue;
    for (const j of neighbors[i]) if (j > i && isMountain(j)) edges.push([Math.min(raw.elevation[i], raw.elevation[j]), i, j]);
  }
  edges.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
  edges.forEach(([, i, j]) => {
    const a = find(i); const b = find(j);
    if (a === b) return;
    parent[a] = b;
    ridge[i] |= 1 << neighbors[i].indexOf(j); ridge[j] |= 1 << neighbors[j].indexOf(i);
  });

  // ---- passes -----------------------------------------------------------------------------------
  const pass = new Uint8Array(n);
  const lowlandGroups = (i) => {
    const ns = neighbors[i];
    const low = ns.map((j) => passable(j) && !isMountain(j));
    if (low.every(Boolean)) return 1;
    let groups = 0;
    for (let k = 0; k < ns.length; k++) if (low[k] && !low[(k + ns.length - 1) % ns.length]) groups++;
    return groups;
  };
  rangeTiles.forEach((list) => {
    const crossings = list.filter((i) => passable(i) && lowlandGroups(i) >= PASS_RULES.minLowlandGroups);
    let found = 0;
    crossings.forEach((i) => {
      const higher = neighbors[i].filter((j) => isMountain(j) && raw.elevation[j] > raw.elevation[i]).length;
      if (higher >= PASS_RULES.minHigherNeighbours) { pass[i] = 1; found++; }
    });
    if (!found && crossings.length) {
      const lowest = crossings.slice().sort((x, y) => raw.elevation[x] - raw.elevation[y] || x - y)[0];
      pass[lowest] = 1;
    }
  });
  return { range, rangeNames, rangeSizes, rangeTiles, ridge, pass, masses: comps };
};
