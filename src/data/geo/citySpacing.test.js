// The settling rule (citySpacing.js, plans/settle-rules.md R1): 4 rings apart at frequency 100,
// 3 across water; landmass ids per tile; the R7 breach finder.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from './tiles';
import { ringsForKm } from './gridScale';
import { CITY_SPACING_KM, citySpacingRings, landmassOf, sameLandmass, spacingBlocks, spacingReach, spacingBreaches } from './citySpacing';
import { emptyWorld, foundCity, canFoundCity } from '../../engine/world/cities';
import { ringsFrom } from '../scenarios';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });

// A land tile `ring` rings from `centre`, on the same landmass or another one, unowned in `world`.
const tileAt = (world, centre, ring, same) => {
  const ids = landmassOf(tiles);
  return [...ringsFrom(tiles, centre, ring)].filter(([t, d]) => d === ring && tiles.land[t] === 1 && !world.tileOwner[t]
    && tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice' && (ids[t] === ids[centre]) === same).map(([t]) => t).sort((a, b) => a - b)[0];
};

describe('the settling rule', () => {
  it('is 306 km: 4 rings on the frequency-100 grid', () => {
    expect(CITY_SPACING_KM).toBe(306);
    expect(citySpacingRings(tiles)).toBe(ringsForKm(306, { tiles }));
    expect(citySpacingRings(tiles)).toBe(4);
    expect(spacingReach(tiles)).toBe(3);
  });

  it('gives every land tile a stable landmass id and water -1', () => {
    const ids = landmassOf(tiles);
    expect(landmassOf(tiles)).toBe(ids); // cached per grid
    let bad = 0; // one expect at the end: 100,000 cells
    for (let t = 0; t < tiles.count; t++) {
      if (tiles.land[t] !== 1) { if (ids[t] !== -1) bad++; continue; }
      if (ids[t] < 0) bad++;
      for (const n of tiles.neighbors[t]) if (tiles.land[n] === 1 && ids[n] !== ids[t]) bad++;
    }
    expect(bad).toBe(0);
    expect(sameLandmass(tiles, tiles.capitals.fr, tiles.capitals.de)).toBe(true);
    expect(sameLandmass(tiles, tiles.capitals.fr, tiles.capitals.gb)).toBe(false);
  });

  it('blocks to ring 3 on the same landmass and to ring 2 across water', () => {
    const c = tiles.capitals.fr;
    [1, 2].forEach((ring) => expect(spacingBlocks(tiles, c, c, ring)).toBe(true));
    expect(spacingBlocks(tiles, c, c, 3)).toBe(true); // same tile, same landmass
    expect(spacingBlocks(tiles, c, tiles.capitals.gb, 3)).toBe(false); // other landmass
    expect(spacingBlocks(tiles, c, c, 4)).toBe(false);
  });

  it('canFoundCity refuses ring 3 on the same land and accepts ring 3 across a strait', () => {
    // A coastal city with land of another landmass three rings away (a strait or a near island).
    const ids = landmassOf(tiles);
    const centre = Object.values(tiles.capitals).sort((a, b) => a - b).find((c) => {
      const w = foundCity(emptyWorld(), tiles, { nationId: 'xx', tile: c }).world;
      return tileAt(w, c, 3, false) != null && tileAt(w, c, 3, true) != null && ids[c] >= 0;
    });
    expect(centre).toBeDefined();
    const { world } = foundCity(emptyWorld(), tiles, { nationId: 'xx', tile: centre, name: 'Home' });
    const same = tileAt(world, centre, 3, true);
    const across = tileAt(world, centre, 3, false);
    expect(canFoundCity(world, tiles, same, 'yy')).toEqual({ ok: false, reason: 'Too close to Home.' });
    expect(canFoundCity(world, tiles, across, 'yy').ok).toBe(true);
    const ring2 = tileAt(world, centre, 2, false) ?? tileAt(world, centre, 2, true);
    if (ring2 != null) expect(canFoundCity(world, tiles, ring2, 'yy').ok).toBe(false);
    // and the audit's breach finder agrees
    expect(spacingBreaches(tiles, [centre, same])).toEqual([[Math.min(centre, same), Math.max(centre, same)]]);
    expect(spacingBreaches(tiles, [centre, across])).toEqual([]);
    expect(spacingBreaches(tiles, [centre, centre])).toEqual([[centre, centre]]);
  });
});
