import { describe, it, expect } from 'vitest';
import { InstancedMesh, BoxGeometry, MeshBasicMaterial, Matrix4 } from 'three';
import { FogMask } from './fogMask';

const meshAt = (points) => {
  const m = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), points.length);
  points.forEach(([x, z], j) => m.setMatrixAt(j, new Matrix4().makeScale(2, 2, 2).setPosition(x, 0, z)));
  return m;
};
const scaleOf = (m, j) => m.instanceMatrix.array[j * 16];

describe('FogMask', () => {
  it('hides what stands on never-seen ground and shows it once seen', () => {
    const mask = new FogMask(4, 4);
    const m = meshAt([[0.5, 0.5], [3.5, 3.5]]);
    mask.add(m);
    const grid = new Uint8Array(16); // nothing seen
    mask.update(grid);
    expect(scaleOf(m, 0)).toBe(0); expect(scaleOf(m, 1)).toBe(0);
    expect(m.instanceMatrix.array[12]).toBeCloseTo(0.5); // position kept
    grid[0] = 1; // explored
    mask.update(grid);
    expect(scaleOf(m, 0)).toBe(2); expect(scaleOf(m, 1)).toBe(0);
    grid[15] = 2; mask.update(grid);
    expect(scaleOf(m, 1)).toBe(2);
  });
  it('shows everything without fog and registers late meshes against the current grid', () => {
    const mask = new FogMask(4, 4);
    mask.update(new Uint8Array(16));
    const late = meshAt([[1.5, 1.5], [9, -3]]); // the second is out on the skirt: it takes the edge tile
    mask.add(late);
    expect(scaleOf(late, 0)).toBe(0); expect(scaleOf(late, 1)).toBe(0);
    mask.update(null);
    expect(scaleOf(late, 0)).toBe(2); expect(scaleOf(late, 1)).toBe(2);
  });
  it('W12: a felled tile hides its trees for good, through any fog grid, and for meshes added later', () => {
    const mask = new FogMask(4, 4);
    const m = meshAt([[0.5, 0.5], [1.5, 0.5]]);
    mask.add(m);
    mask.fell([1]);
    expect(scaleOf(m, 0)).toBe(2); expect(scaleOf(m, 1)).toBe(0);
    const grid = new Uint8Array(16).fill(2); mask.update(grid);
    expect(scaleOf(m, 1)).toBe(0); // seen ground does not bring a felled tree back
    mask.update(null);
    expect(scaleOf(m, 1)).toBe(0);
    const late = meshAt([[1.5, 0.5]]); mask.add(late);
    expect(scaleOf(late, 0)).toBe(0);
  });
});
