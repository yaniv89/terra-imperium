// A kit's lower LODs whose uvs came out of the decimator scrambled (the temperate vegetation kit's
// LOD1 and LOD2 trees: bark, leaves and ground from all over the atlas, a dark camouflage blob at
// every zoom but the closest) take the full model's uvs face by face; sound LODs are left alone.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { parseKit, loadKit, lodUvMismatch, LOD_UV_TOLERANCE } from './kitLoader';
import { ART } from './artFiles';

afterEach(() => vi.restoreAllMocks());

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
    const raw = parseKit(tree(true), { repairLodUvs: true }).objects['tree-m'];
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
    const raw = parseKit(scene, { repairLodUvs: true }).objects['tree-m'];
    expect(raw.lods[1].geometry.attributes.uv.count).toBe(lod1Geo.attributes.uv.count);
    expect(lodUvMismatch(raw.lods[1], raw.lods[0])).toBeLessThan(LOD_UV_TOLERANCE);
  });

  it('preserves independent authored LOD1 and LOD2 atlas charts by default', () => {
    const scene = tree(false);
    const root = scene.children[0];
    const lod2 = root.children[1].clone();
    lod2.name = 'LOD2'; lod2.geometry = lod2.geometry.clone(); root.add(lod2);
    for (const [level, mesh] of root.children.entries()) {
      const uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, level * 0.3 + (i % 3) * 0.02, 0.1 + (i % 5) * 0.03);
    }
    const authored = root.children.map(mesh => Array.from(mesh.geometry.attributes.uv.array));
    const { lods } = parseKit(scene).objects['tree-m'];
    expect(lodUvMismatch(lods[1], lods[0])).toBeGreaterThan(LOD_UV_TOLERANCE);
    expect(lodUvMismatch(lods[2], lods[0])).toBeGreaterThan(LOD_UV_TOLERANCE);
    lods.forEach((lod, i) => expect(Array.from(lod.geometry.attributes.uv.array)).toEqual(authored[i]));
    root.children.forEach((mesh, i) => expect(Array.from(mesh.geometry.attributes.uv.array)).toEqual(authored[i]));
  });

  const legacy = (url) => vi.spyOn(ART, 'url').mockImplementation(key => key === 'battle/nature/vegetation-temperate.glb' ? url : null);
  const loadTree = () => vi.fn(async () => ({ scene: tree(true) }));
  const mismatch = kit => lodUvMismatch(kit.objects['tree-m'].lods[1], kit.objects['tree-m'].lods[0]);

  it('loadKit repairs the exact indexed legacy URL by default', async () => {
    const url = 'test://legacy-default.glb'; legacy(url);
    expect(mismatch(await loadKit(url, { load: loadTree() }))).toBeLessThan(LOD_UV_TOLERANCE);
  });

  it('loadKit preserves unknown URLs even with the legacy filename', async () => {
    legacy('test://indexed/vegetation-temperate.glb');
    const kit = await loadKit('test://unknown/vegetation-temperate.glb', { load: loadTree() });
    expect(mismatch(kit)).toBeGreaterThan(LOD_UV_TOLERANCE);
  });

  it('allows explicitly preserving the legacy kit charts', async () => {
    const url = 'test://legacy-preserve.glb'; legacy(url);
    expect(mismatch(await loadKit(url, { load: loadTree(), repairLodUvs: false }))).toBeGreaterThan(LOD_UV_TOLERANCE);
  });

  it('allows explicitly repairing an unknown kit', async () => {
    legacy(null);
    expect(mismatch(await loadKit('test://explicit-repair.glb', { load: loadTree(), repairLodUvs: true }))).toBeLessThan(LOD_UV_TOLERANCE);
  });

  it('isolates opposite repair policies for the same URL in either loading order', async () => {
    legacy(null);
    for (const first of [false, true]) {
      const url = `test://policy-isolation-${first}.glb`; const load = loadTree();
      const a = await loadKit(url, { load, repairLodUvs: first });
      const b = await loadKit(url, { load, repairLodUvs: !first });
      expect(a).not.toBe(b); expect(load).toHaveBeenCalledTimes(2);
      expect(mismatch(first ? a : b)).toBeLessThan(LOD_UV_TOLERANCE);
      expect(mismatch(first ? b : a)).toBeGreaterThan(LOD_UV_TOLERANCE);
    }
  });

  it('shares a cache entry for identical effective default and explicit policies', async () => {
    const url = 'test://legacy-cache.glb'; legacy(url); const load = loadTree();
    const [a, b] = await Promise.all([loadKit(url, { load }), loadKit(url, { load, repairLodUvs: true })]);
    expect(a).toBe(b); expect(load).toHaveBeenCalledTimes(1);
  });
});
