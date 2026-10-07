// scripts/art/pack-map-models.test.mjs
import { describe, it, expect } from 'vitest';
import { isPacked, modelFiles, mapModelFiles, readGlbJson, needsLods, packFlags, KIT_MODEL_DIRS, SINGLE_LOD_DIRS } from './glbInfo.mjs';

describe('map and battle models', () => {
  it('cover every art folder of the model plan', () => {
    ['src/assets/map/terrain', 'src/assets/battle/rts', 'src/assets/battle/city', 'src/assets/battle/nature', 'src/assets/battle/terrain'].forEach((d) => expect(KIT_MODEL_DIRS).toContain(d));
    ['src/assets/battle/projectiles', 'src/assets/units/signature'].forEach((d) => expect(SINGLE_LOD_DIRS).toContain(d));
    expect(mapModelFiles().every((f) => modelFiles().includes(f))).toBe(true);
    expect(needsLods('src/assets/battle/rts/rts-bronze.glb')).toBe(true);
    expect(needsLods('src/assets/units/signature/israel.glb')).toBe(false);
    expect(packFlags('src/assets/units/signature/israel.glb')).toContain('-noq');
    expect(packFlags('src/assets/battle/city/walls-bronze.glb')).not.toContain('-noq');
  });

  it('are packed (run npm run pack:models after adding art)', () => {
    const unpacked = modelFiles().filter((f) => !isPacked(readGlbJson(f)));
    expect(unpacked).toEqual([]);
  });

  it('keep the object names the game reads', () => {
    modelFiles().filter(needsLods).forEach((f) => {
      const names = new Set(readGlbJson(f).nodes.map((n) => n.name));
      expect(names.has('LOD0') || [...names].some((n) => /^LOD0/.test(n || '')), f).toBe(true);
    });
  });
});
