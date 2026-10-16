// W12: the woods thin to stumps as the sim cuts them (treeFelling.js over fogMask.js).
import { describe, it, expect } from 'vitest';
import { InstancedMesh, BoxGeometry, MeshBasicMaterial, Matrix4, Scene } from 'three';
import { FogMask } from './fogMask';
import { TreeFelling, newlyFelled } from './treeFelling';

const W = 6; const H = 4;
const treesAt = (tiles) => {
  const m = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), tiles.length);
  tiles.forEach((t, j) => m.setMatrixAt(j, new Matrix4().makeScale(0.8, 0.8, 0.8).setPosition((t % W) + 0.4, 0, Math.floor(t / W) + 0.6)));
  return m;
};

describe('TreeFelling', () => {
  it('newlyFelled takes the next trees in felling order', () => {
    expect(newlyFelled([5, 6, 7, 8], 0, 2)).toEqual([5, 6]);
    expect(newlyFelled([5, 6, 7, 8], 2, 9)).toEqual([7, 8]);
    expect(newlyFelled([5, 6, 7, 8], 3, 3)).toEqual([]);
  });

  it('hides each felled tree and stands a stump where it stood, once', () => {
    const fogMask = new FogMask(W, H);
    const mesh = treesAt([7, 8, 9]);
    fogMask.add(mesh).tree = true;
    const r = { setup: { map: { w: W, h: H }, economy: { nodes: [{ kind: 'stone' }, { kind: 'tree', trees: [8, 7, 9] }] } }, fogMask, scene: new Scene(), track: (x) => x, heightAt: () => 0 };
    const f = new TreeFelling(r);
    const view = (cut) => ({ eco: { nodes: [{ i: 1, cut }] } });
    f.update(view(0));
    expect(f.stats()).toMatchObject({ woods: 1, felled: 0, stumps: 0 });
    f.update(view(2));
    expect(f.stats()).toMatchObject({ felled: 2, stumps: 2 });
    const scale = (j) => mesh.instanceMatrix.array[j * 16];
    expect(scale(0)).toBe(0); expect(scale(1)).toBe(0); expect(scale(2)).toBeCloseTo(0.8); // tiles 7 and 8 are down, 9 stands
    const at = f.mesh.instanceMatrix.array;
    expect(at[12]).toBeCloseTo(2 + 0.4); // the first stump stands where tile 8's tree stood
    f.update(view(2));
    expect(f.stats().stumps).toBe(2);
  });
});
