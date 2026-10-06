// scripts/art/town-tone.test.mjs
// The Israelite map models read as light as the Levant files of the same age (Town about 0.27 to
// 0.33, Team 0.34 to 0.43, scripts/art/town-tone.mjs): the earlier builds came out near black
// (Town 0.16 to 0.19, Team 0.10). Values are the base colour as rendered, COLOR_0 included.
import { describe, it, expect } from 'vitest';
import { mapModelFiles } from './glbInfo.mjs';
import { measureTone } from './town-tone.mjs';

const FLOOR = { Town: 0.26, Team: 0.3 };

describe('Israelite map models', () => {
  const files = mapModelFiles().filter((f) => /-israelite\.glb$/.test(f));

  it('exist for every age', () => {
    for (const age of ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern']) {
      expect(files.filter((f) => f.includes(`/${age}-town-`)).length, age).toBe(6);
      expect(files.some((f) => f.endsWith(`/shared-${age}-israelite.glb`)), age).toBe(true);
    }
  });

  it('read as light as the Levant files of the same age', async () => {
    const dark = [];
    for (const f of files) {
      const tone = await measureTone(f);
      Object.entries(FLOOR).forEach(([mat, floor]) => {
        if (tone[mat] && tone[mat].effective < floor) dark.push(`${f} ${mat} ${tone[mat].effective}`);
      });
    }
    expect(dark).toEqual([]);
  }, 60000);
});
