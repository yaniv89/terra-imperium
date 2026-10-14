// Fog like Civilization (playtest, Israel turn 137 to 166): a foreign city seen from one side shows
// its border only along the explored tiles, explored land is never drawn dark, and nothing (border,
// resource glyph) is drawn on unexplored land.
import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { fogEdgeMask, FOG_EDGE_KM, TERRITORY_FRAGMENT } from './territoryShader';
import { landSprites, RESOURCE_GLYPH_ZOOM } from './sceneModel';
import { getTiles } from '../../../data/geo/tiles';
import { RESOURCES_ON_TILES, resourceKnown } from '../../../data/tileYields';

describe('the dark mask', () => {
  const noise = [-0.5, -0.2, 0, 0.3, 0.5];

  it('never darkens explored land, whatever the noise', () => {
    [1, 2].forEach((fog) => [0, 5, 20, 40, 200, Infinity].forEach((d) => noise.forEach((w) => noise.forEach((s) => {
      expect(fogEdgeMask(fog, d, w, s)).toBe(0);
    }))));
  });

  it('fades in on the unexplored side from nothing at the explored edge to full', () => {
    noise.forEach((w) => noise.forEach((s) => {
      expect(fogEdgeMask(0, 0, w, s)).toBe(0);
      expect(fogEdgeMask(0, FOG_EDGE_KM * 6, w, s)).toBe(1);
      const ramp = [0, 5, 10, 20, 30, 40, 60, 100].map((d) => fogEdgeMask(0, d, w, s));
      ramp.forEach((v, i) => { if (i) expect(v).toBeGreaterThanOrEqual(ramp[i - 1]); });
    }));
    expect(fogEdgeMask(0, Infinity)).toBe(1); // no explored neighbour: the deep dark
  });

  it('is drawn by the shader on unexplored tiles only, and no border line crosses into them', () => {
    expect(TERRITORY_FRAGMENT).toMatch(/if \(fogA < 0\.5\) \{\s*float wisp/);
    // every outline, band, nation border and war band loop skips an edge to unexplored land (I078)
    expect(TERRITORY_FRAGMENT.match(/unk\[k\]/g).length).toBeGreaterThanOrEqual(5);
    expect(TERRITORY_FRAGMENT).toMatch(/Unexplored: no territory/);
  });
});

describe('resource glyphs in the fog', () => {
  const tiles = getTiles();
  // a land tile with a strategic or luxury resource known in the Bronze Age (drawn from the resource zoom)
  let tile = -1;
  for (let t = 0; t < tiles.count && tile < 0; t++) {
    const r = tiles.land[t] === 1 && tiles.resourceOf ? tiles.resourceOf(t) : null;
    if (r && RESOURCES_ON_TILES[r]?.kind !== 'bonus' && resourceKnown(r, 'bronze')) tile = t;
  }
  const { lat, lon } = tiles.latLonOf(tile);
  const projection = geoEquirectangular().fitSize([844, 390], { type: 'Sphere' });
  const state = {
    age: 'bronze', playerNationId: 'p', nations: { p: { id: 'p' } },
    regions: { c1: { id: 'c1', tile, owner: 'p' } },
    world: { tileOwner: { [tile]: 'c1' }, tileState: {} }
  };
  const glyphsWith = (isExplored) => landSprites({ state, projection, k: RESOURCE_GLYPH_ZOOM, window: { west: lon - 1, east: lon + 1, south: lat - 1, north: lat + 1 }, isExplored, lens: null, closeGround: false, dpr: 1 })
    .sprites.filter((s) => Math.abs(s.anchor[0] - projection([lon, lat])[0]) < 1e-6 && Math.abs(s.anchor[1] - projection([lon, lat])[1]) < 1e-6);

  it('show on explored land', () => {
    expect(tile).toBeGreaterThanOrEqual(0);
    expect(glyphsWith(() => true).length).toBeGreaterThan(0);
  });

  it('are hidden on unexplored land', () => {
    expect(glyphsWith((t) => t !== tile)).toHaveLength(0);
  });
});
