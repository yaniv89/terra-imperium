import { describe, it, expect, beforeAll } from 'vitest';
import { geoArea, geoContains } from 'd3-geo';
import { loadTiles } from './tiles';
import { buildScenarioStarts } from '../scenarios';
import { buildTerritories, buildBorders, buildHexMesh, cellFeature, chainRings, boundaryEdges } from './tileGeometry';

let tiles; let starts;
beforeAll(async () => { tiles = await loadTiles(); starts = buildScenarioStarts(tiles, 'kingdoms'); });

describe('tile geometry', () => {
  it('chains a single cell into one ring of its corners', () => {
    const id = tiles.capitals.fr;
    const edges = boundaryEdges(tiles, (i) => (i === id ? 'x' : null));
    expect(edges.length).toBe(tiles.neighbors[id].length);
    const rings = chainRings(edges);
    expect(rings.length).toBe(1);
    expect(rings[0].length).toBe(tiles.neighbors[id].length + 1);
  });

  it('builds a territory per owner whose area matches its tiles and contains its capital', () => {
    const ownerOf = (i) => starts.claimedBy.get(i) || null;
    const features = buildTerritories(tiles, ownerOf);
    expect(features.length).toBe(Object.keys(starts.starts).length);
    features.forEach((f) => {
      // Cells near the 12 pentagons are smaller than average, so compare with the real cell areas.
      const expected = starts.starts[f.id].tiles.reduce((a, t) => a + geoArea(cellFeature(tiles, t)), 0);
      const area = geoArea(f);
      expect(area, f.id).toBeGreaterThan(expected * 0.97);
      expect(area, f.id).toBeLessThan(expected * 1.03);
      const cap = tiles.latLonOf(starts.starts[f.id].capital);
      expect(geoContains(f, [cap.lon, cap.lat]), `${f.id} contains its capital`).toBe(true);
    });
  });

  it('handles the Modern start, where Russia crosses the antimeridian and holes exist', () => {
    const modern = buildScenarioStarts(tiles, 'modern');
    const features = buildTerritories(tiles, (i) => modern.claimedBy.get(i) || null);
    const ru = features.find((f) => f.id === 'ru');
    const cellArea = (4 * Math.PI) / tiles.count;
    expect(geoArea(ru) / cellArea).toBeGreaterThan(modern.starts.ru.tiles.length * 0.8);
    expect(geoArea(ru) / cellArea).toBeLessThan(modern.starts.ru.tiles.length * 1.2);
    const chukotka = tiles.latLonOf(tiles.nearest(66, 179));
    expect(geoContains(ru, [chukotka.lon, chukotka.lat])).toBe(true);
    // Lesotho is a hole in South Africa.
    const za = features.find((f) => f.id === 'za');
    const ls = tiles.latLonOf(tiles.capitals.ls);
    expect(geoContains(za, [ls.lon, ls.lat])).toBe(false);
    expect(za.geometry.coordinates.some((poly) => poly.length > 1)).toBe(true);
  });

  it('draws each border edge once and the land hex mesh once per edge', () => {
    const ownerOf = (i) => starts.claimedBy.get(i) || null;
    const borders = buildBorders(tiles, ownerOf);
    const edges = boundaryEdges(tiles, ownerOf);
    const shared = edges.filter((e) => ownerOf(e.neighbor) != null).length;
    expect(borders.coordinates.length).toBe(edges.length - shared / 2);
    const mesh = buildHexMesh(tiles);
    const landEdges = tiles.neighbors.reduce((a, ns, i) => a + (tiles.land[i] ? ns.filter((j) => j > i || !tiles.land[j]).length : 0), 0);
    expect(mesh.coordinates.length).toBe(landEdges);
  });

  it('makes a cell feature that contains its own centre', () => {
    const id = tiles.capitals.eg;
    const f = cellFeature(tiles, id);
    const c = tiles.latLonOf(id);
    expect(geoContains(f, [c.lon, c.lat])).toBe(true);
    expect(geoArea(f)).toBeLessThan(((4 * Math.PI) / tiles.count) * 1.4);
  });
});
