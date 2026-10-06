import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { getTiles } from '../../../data/geo/tiles';
import { mountainRanges } from '../../../data/geo/terrainData';
import { pointInPolygon } from '../../../data/geo/footprints';
import { cachedFootprint, footprintKey, screenFrame, plotsOnScreen, reliefOnScreen, riverDiscsOnScreen, PASS_SADDLE } from './terrainPlacement';
import { createOccupancy } from './occupancy';

const tiles = getTiles();
// a close view round a tile: k 40 on an 844 px wide world
const viewAt = (tile, k = 40) => {
  const projection = geoEquirectangular().fitSize([844, 422], { type: 'Sphere' });
  const { lat, lon } = tiles.latLonOf(tile);
  const [cx, cy] = projection([lon, lat]);
  const width = 844; const height = 390;
  const project = (la, lo) => { const p = projection([lo, la]); return p ? { x: (p[0] - cx) * k + width / 2, y: (p[1] - cy) * k + height / 2 } : null; };
  const span = 844 / k / 844 * 360 * 1.5;
  return { project, width, height, area: { south: lat - span / 2, north: lat + span / 2, west: lon - span, east: lon + span }, pxPerKm: (projection.scale() * k) / 6371 };
};

describe('footprints in the close view', () => {
  // a land tile near Paris (mid latitude: the equirectangular map is not stretched much)
  const farmTile = tiles.nearest(48.9, 2.4)[0] ?? tiles.nearest(48.9, 2.4);
  const state = { world: { tileState: { [farmTile]: { improvement: 'farm' } }, tileOwner: {} }, regions: {} };

  it('caches a footprint until what it depends on changes', () => {
    const a = cachedFootprint(farmTile, state);
    expect(cachedFootprint(farmTile, state)).toBe(a);
    const roads = { ...state, world: { ...state.world, tileState: { [farmTile]: { improvement: 'farm', road: true } } } };
    expect(footprintKey(farmTile, roads)).not.toBe(footprintKey(farmTile, state));
    expect(cachedFootprint(farmTile, roads)).not.toBe(a);
  });

  it('draws the plots where the footprint put them, inside the cell on screen', () => {
    const v = viewAt(farmTile);
    const fp = cachedFootprint(farmTile, state);
    expect(fp.fields.length).toBeGreaterThan(3);
    const frame = screenFrame(farmTile, v.project);
    const plots = plotsOnScreen(fp, frame);
    expect(plots).toHaveLength(fp.fields.length);
    // the cell's corners on screen; every plot centre inside
    const cell = fp.cell.map((p) => { const s = frame.at(p); return [s.x, -s.y]; });
    plots.forEach((p) => expect(pointInPolygon(cell, [p.x, -p.y])).toBe(true));
    // 6 by 3 km (the flat map stretches east-west by 1 / cos(lat), 1.5 at Paris)
    expect(plots[0].len).toBeGreaterThan(plots[0].wid);
    expect(plots[0].len / v.pxPerKm).toBeGreaterThan(5.5);
    expect(plots[0].len / v.pxPerKm).toBeLessThan(6 * 1.55);
  });
});

describe('mountain chains in the close view', () => {
  const alps = mountainRanges().filter((r) => r.passes.length).sort((a, b) => b.size - a.size)[0];

  it('lays ridges along the ridge lines, none in a pass saddle, foothills beside the ranges', () => {
    const pass = alps.passes[0];
    const v = viewAt(pass, 20);
    const { ridges, hills } = reliefOnScreen({ ...v, lean: 0.58 });
    expect(ridges.length).toBeGreaterThan(5);
    const c = v.project(tiles.latLonOf(pass).lat, tiles.latLonOf(pass).lon);
    const spacing = Math.min(...tiles.neighbors[pass].map((n) => { const p = v.project(tiles.latLonOf(n).lat, tiles.latLonOf(n).lon); return Math.hypot(p.x - c.x, p.y - c.y); }));
    ridges.forEach((r) => expect(Math.hypot(r.x - c.x, r.y - c.y)).toBeGreaterThan(spacing * PASS_SADDLE * 0.6));
    expect(ridges.every((r) => r.sx > 0 && r.sy > 0)).toBe(true);
    expect(Array.isArray(hills)).toBe(true);
  });

  it('draws nothing on unexplored ground', () => {
    const v = viewAt(alps.tiles[0], 20);
    expect(reliefOnScreen({ ...v, lean: 0.58, isExplored: () => false }).ridges).toHaveLength(0);
  });
});

describe('river bands in the close view', () => {
  it('claims discs along river edges, so trees stay out of the water', () => {
    const t = [...Array(tiles.count).keys()].find((i) => tiles.rivers[i] && tiles.land[i] === 1);
    const v = viewAt(t);
    const discs = riverDiscsOnScreen({ ...v, halfPx: () => 2 });
    expect(discs.length).toBeGreaterThan(2);
    const occ = createOccupancy(0.58);
    discs.forEach((d) => occ.claim(d.x, d.y, d.r));
    expect(occ.free(discs[0].x, discs[0].y, 1)).toBe(false);
  });
});
