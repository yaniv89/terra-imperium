// src/engine/pathOptimality.test.js
// The A* guesses (gridScale.minStepsBetween x the cheapest step) must never overestimate, or a
// march or a voyage takes a longer way than it should. Checked against a plain Dijkstra / BFS
// over the real grid, with the cheapest roads there are (0.2 a step with every road tech), where
// the old guess (km / 170 x 0.5, up to 0.33 a step) overestimated.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { findTilePath, tileAccess, tileStepCost, passableTile, cheapestStep, ENEMY_PATH_PENALTY } from './armies';
import { findSeaPath, seaPassable, fleetAge } from './fleets';

const tiles = getTiles();
const ROAD_TECHS = ['military_mechanized_warfare', 'infrastructure_paved_roads', 'infrastructure_turnpike_roads'];

// Land tiles within `rings` of `from` that an army may stand on, in id order.
const landAround = (from, rings) => {
  const seen = new Set([from]); let frontier = [from];
  for (let d = 0; d < rings; d++) {
    const next = [];
    for (const t of frontier) for (const n of tiles.neighbors[t]) if (!seen.has(n) && passableTile(tiles, n)) { seen.add(n); next.push(n); }
    frontier = next;
  }
  return [...seen].sort((a, b) => a - b);
};

// Plain Dijkstra with findTilePath's own step rule.
const dijkstra = (state, from, to, nationId, researched) => {
  const dist = new Map([[from, 0]]); const done = new Set();
  for (;;) {
    let id = null; let best = Infinity;
    dist.forEach((d, t) => { if (!done.has(t) && d < best) { best = d; id = t; } });
    if (id == null) return Infinity;
    if (id === to) return best;
    done.add(id);
    for (const n of tiles.neighbors[id]) {
      if (!passableTile(tiles, n)) continue;
      const access = tileAccess(state, n, nationId);
      if (access === 'closed') continue;
      const nd = best + tileStepCost(state, tiles, id, n, access, researched) + (access === 'enemy' && n !== to ? ENEMY_PATH_PENALTY : 0);
      if (nd < (dist.get(n) ?? Infinity)) dist.set(n, nd);
    }
  }
};

describe('A* on land finds the cheapest path', () => {
  const base = createInitialState({ playerNationId: 'in', rngSeed: 3 });
  const home = base.regions[getNationCapital('in')].tile;
  const area = landAround(home, 9);
  // Roads on about a third of the land around New Delhi.
  const tileState = { ...(base.world.tileState || {}) };
  area.forEach((t, i) => { if (i % 3 === 0) tileState[t] = { ...(tileState[t] || {}), road: true }; });
  const state = { ...base, units: {}, world: { ...base.world, tileState } };
  const targets = area.filter((_, i) => i % 9 === 4).slice(0, 25);

  it('the cheapest step follows the road techs', () => {
    expect(cheapestStep([])).toBe(0.5);
    expect(cheapestStep(ROAD_TECHS)).toBeCloseTo(0.2, 9);
    expect(cheapestStep(['infrastructure_rail_networks'])).toBe(0.25);
  });

  [['no road techs', []], ['every road tech', ROAD_TECHS]].forEach(([label, researched]) => {
    it(`matches Dijkstra on ${targets.length} routes (${label})`, () => {
      expect(targets.length).toBeGreaterThan(10);
      targets.forEach((to) => {
        const r = findTilePath(state, home, to, 'in', { researched });
        const best = dijkstra(state, home, to, 'in', researched);
        if (best === Infinity) { expect(r.path).toBeUndefined(); return; }
        expect(r.cost).toBeCloseTo(best, 9);
      });
    });
  });
});

describe('A* at sea finds the shortest voyage', () => {
  const state = (() => { const s = createInitialState({ playerNationId: 'gb', rngSeed: 3 }); return { ...s, units: {} }; })();
  const ageId = fleetAge(state, 'gb');
  const start = tiles.capitals.gb;
  // Open water near Britain the fleet may sail, by BFS hop count from one start tile.
  const water = (() => {
    const near = []; const seen = new Set([start]); let frontier = [start];
    for (let d = 0; d < 6; d++) {
      const next = [];
      for (const t of frontier) for (const n of tiles.neighbors[t]) if (!seen.has(n)) { seen.add(n); next.push(n); if (!tiles.land[n] && seaPassable(tiles, n, ageId)) near.push(n); }
      frontier = next;
    }
    return near.sort((a, b) => a - b);
  })();
  const bfs = (from) => {
    const d = new Map([[from, 0]]); let frontier = [from];
    while (frontier.length) {
      const next = [];
      for (const t of frontier) for (const n of tiles.neighbors[t]) if (!d.has(n) && seaPassable(tiles, n, ageId)) { d.set(n, d.get(t) + 1); next.push(n); }
      frontier = next;
    }
    return d;
  };

  it('matches the hop count of a BFS over passable water', () => {
    expect(water.length).toBeGreaterThan(5);
    const from = water[0]; const hopsFrom = bfs(from);
    let checked = 0;
    [...hopsFrom.keys()].sort((a, b) => a - b).filter((_, i) => i % 7 === 3).slice(0, 30).forEach((to) => {
      if (to === from) return;
      const r = findSeaPath(state, from, to, 'gb');
      if (!r.path) return;
      expect(r.cost).toBe(hopsFrom.get(to));
      checked += 1;
    });
    expect(checked).toBeGreaterThan(5);
  });
});
