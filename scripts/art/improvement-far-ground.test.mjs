// scripts/art/improvement-far-ground.test.mjs
// Every tile improvement file's far Ground (LOD1, LOD2) samples lit soil in its atlas: its opaque
// texels read at least DARK_SHARE as light as LOD0's Ground, and the texels at its vertices are not
// black (what buildingLayer.js repairDarkLods checks at run time). The 13 base files of the
// 2026-10-07 LOD repair drew a black square here (scripts/art/improvement-far-ground.mjs).
import { describe, it, expect } from 'vitest';
import { improvementFiles, measureFarGround, DARK_SHARE } from './improvement-far-ground.mjs';
import { DARK_LUMINANCE } from '../../src/components/map/closeView/buildingLayer.js';

// LOD0's Ground is a shore strip and the far square spans the sea, so a square of sand cannot stand
// in; their far Ground keeps the repair's (dark) beach projection and repairDarkLods draws LOD0's
// strip at run time. Remove a file from here once its far Ground is rebuilt.
const SHORE_STRIP = ['fishing_boats-bronze', 'fishing_boats-modern'];
const id = (f) => f.split('/').pop().replace(/\.glb$/, '');

describe('improvement far Ground', () => {
  it('samples lit soil at LOD1 and LOD2', async () => {
    const files = improvementFiles();
    expect(files.length).toBeGreaterThan(20);
    const dark = [];
    const stillDark = [];
    for (const f of files) {
      const r = await measureFarGround(f);
      const far = r.levels.filter((l) => l.lod > 0);
      expect(far.length, `${f} has no far Ground`).toBeGreaterThan(0);
      const bad = far.filter((l) => l.lum < DARK_SHARE * r.baseLum || l.vertexLum < DARK_LUMINANCE).map((l) => `${id(f)} LOD${l.lod} lum ${l.lum} (LOD0 ${r.baseLum}) at vertices ${l.vertexLum}`);
      if (SHORE_STRIP.includes(id(f))) { if (bad.length) stillDark.push(id(f)); } else dark.push(...bad);
    }
    expect(dark).toEqual([]);
    // the exceptions are still needed (drop one from SHORE_STRIP when it is fixed)
    expect(stillDark.sort()).toEqual([...SHORE_STRIP].sort());
  }, 120000);
});
