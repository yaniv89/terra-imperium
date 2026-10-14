// The far levels' guard: a model level that would draw black takes LOD0's part (a base-set mine
// showed as a black square at zoom 13 to 40: its LOD1 and LOD2 Ground sample an empty atlas corner).
import { describe, it, expect } from 'vitest';
import { repairDarkLods, partLuminance, DARK_LUMINANCE } from './buildingLayer';

const part = (name, id) => ({ id, material: { name }, kind: name === 'Ground' ? 'ground' : name === 'Team' ? 'team' : 'plain' });

describe('repairDarkLods', () => {
  // mine-bronze.glb as measured on its atlas: LOD0 Ground lit (0.38), LOD1 and LOD2 Ground black (0)
  const lums = { g0: 0.38, t0: 0.32, m0: 0.45, g1: 0, t1: 0.3, m1: 0.45, g2: 0, t2: 0.24, m2: 0.45 };
  const mine = () => [0, 1, 2].map((l) => [part('Town', `t${l}`), part('Team', `m${l}`), part('Ground', `g${l}`)]);

  it("draws a black far level's part with LOD0's part of the same material", () => {
    const lods = mine();
    const fixed = repairDarkLods(lods, (p) => lums[p.id]);
    expect(fixed).toEqual([{ lod: 1, material: 'Ground' }, { lod: 2, material: 'Ground' }]);
    [1, 2].forEach((l) => {
      expect(lods[l].map((p) => p.id).sort()).toEqual([`g0`, `m${l}`, `t${l}`].sort());
      lods[l].forEach((p) => expect(lums[p.id]).toBeGreaterThan(DARK_LUMINANCE));
    });
    expect(lods[0].map((p) => p.id)).toEqual(['t0', 'm0', 'g0']);
  });

  it('leaves a model alone when nothing is black, when it cannot tell, or when LOD0 is dark too', () => {
    const fine = mine();
    expect(repairDarkLods(fine, () => 0.4)).toEqual([]);
    expect(repairDarkLods(mine(), () => null)).toEqual([]);
    expect(repairDarkLods(mine(), () => { throw new Error('no canvas'); })).toEqual([]);
    // a dark material everywhere (a black iron part) is the art, not a broken level
    expect(repairDarkLods(mine(), (p) => (p.material.name === 'Ground' ? 0.01 : 0.4))).toEqual([]);
  });

  it('cannot read a texture without a canvas (tests, a worker): no guess', () => {
    expect(partLuminance({ material: { name: 'Ground' }, geometry: { attributes: {} } })).toBeNull();
  });
});
