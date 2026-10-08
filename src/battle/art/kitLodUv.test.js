// A kit's lower LODs whose uvs came out of the decimator scrambled (the temperate vegetation kit's
// LOD1 and LOD2 trees: bark, leaves and ground from all over the atlas, a dark camouflage blob at
// every zoom but the closest) take the full model's uvs face by face; sound LODs are left alone.
import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { parseKit, lodUvMismatch, LOD_UV_TOLERANCE } from './kitLoader';

const tree = (scramble) => {
  const mat = new MeshStandardMaterial({ name: 'Town' });
  const root = new Group(); root.name = 'tree-m';
  const lod0 = new Mesh(new BoxGeometry(1, 2, 1, 4, 8, 4), mat); lod0.name = 'LOD0';
  // uv = a function of the place: the top half samples "leaves" (v > 0.5), the bottom "bark"
  const paint = (g, wrong) => {
    const p = g.attributes.position; const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const v = p.getY(i) > 0 ? 0.75 : 0.25;
      uv.setXY(i, wrong ? (i * 0.37) % 1 : 0.5, wrong ? (i * 0.61) % 1 : v);
    }
  };
  paint(lod0.geometry, false);
  const lod1 = new Mesh(new BoxGeometry(1, 2, 1, 1, 2, 1), mat); lod1.name = 'LOD1';
  paint(lod1.geometry, scramble);
  root.add(lod0, lod1);
  const scene = new Group(); scene.add(root);
  return scene;
};

describe('kit LOD uvs', () => {
  it('repairs a lower LOD whose uvs do not match the full model', () => {
    const raw = parseKit(tree(true)).objects['tree-m'];
    const lod1 = raw.lods[1].geometry;
    expect(lodUvMismatch(raw.lods[1], raw.lods[0])).toBeLessThan(LOD_UV_TOLERANCE);
    // every face takes leaves above the middle and bark below it
    const p = lod1.attributes.position; const uv = lod1.attributes.uv; const idx = lod1.index;
    for (let t = 0; t < idx.count; t += 3) {
      const cy = (p.getY(idx.getX(t)) + p.getY(idx.getX(t + 1)) + p.getY(idx.getX(t + 2))) / 3;
      if (Math.abs(cy) < 0.2) continue;
      expect(uv.getY(idx.getX(t))).toBeCloseTo(cy > 0 ? 0.75 : 0.25, 1);
    }
    expect(raw.lods[1].triangles).toBe(idx.count / 3);
  });

  it('leaves a sound lower LOD as it is', () => {
    const scene = tree(false);
    const lod1Geo = scene.children[0].children[1].geometry;
    const raw = parseKit(scene).objects['tree-m'];
    expect(raw.lods[1].geometry.attributes.uv.count).toBe(lod1Geo.attributes.uv.count);
    expect(lodUvMismatch(raw.lods[1], raw.lods[0])).toBeLessThan(LOD_UV_TOLERANCE);
  });
});
