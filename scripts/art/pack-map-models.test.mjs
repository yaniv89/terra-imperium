// scripts/art/pack-map-models.test.mjs
import { describe, it, expect } from 'vitest';
import { isPacked, mapModelFiles, readGlbJson } from './glbInfo.mjs';

describe('map models', () => {
  it('are packed (run npm run pack:models after adding art)', () => {
    const unpacked = mapModelFiles().filter((f) => !isPacked(readGlbJson(f)));
    expect(unpacked).toEqual([]);
  });

  it('keep the object names the close view reads', () => {
    mapModelFiles().forEach((f) => {
      const names = new Set(readGlbJson(f).nodes.map((n) => n.name));
      expect(names.has('LOD0') || [...names].some((n) => /^LOD0/.test(n || '')), f).toBe(true);
    });
  });
});
