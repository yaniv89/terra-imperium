// Artist town models: the file for an (age, size) is found, the zoom picks the brief's LOD, a load
// happens once per file, and an instance tints only its Team cloth.
import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { townAssetUrl, lodForZoom, loadTownAsset, instanceTownAsset, showLod } from './townAssets';

const fakeTown = () => {
  const root = new Group(); root.name = 'town-small-a';
  ['LOD0', 'LOD1', 'LOD2'].forEach((n) => {
    const town = Object.assign(new MeshStandardMaterial(), { name: 'Town' });
    const team = Object.assign(new MeshStandardMaterial({ color: '#ffffff' }), { name: 'Team' });
    const m = new Mesh(new BoxGeometry(1, 1, 1), [town, team]); m.name = n; root.add(m);
  });
  const scene = new Group(); scene.add(root);
  return { scene };
};

describe('artist town models', () => {
  it('finds the shipped Bronze Age towns, picks a variant by seed, and nothing for other ages', () => {
    expect(townAssetUrl('bronze', 'small', 0)).toMatch(/bronze-town-small-a/);
    expect(townAssetUrl('bronze', 'small', 1)).toMatch(/bronze-town-small-b/);
    expect(townAssetUrl('bronze', 'medium', 0)).toMatch(/bronze-town-medium-a/);
    expect(townAssetUrl('bronze', 'medium', 1)).toMatch(/bronze-town-medium-b/);
    expect(townAssetUrl('bronze', 'big')).toBeNull();
    // the land's tradition wins over the seed: Egypt builds the Nile town, Iraq the Mesopotamian
    expect(townAssetUrl('bronze', 'small', 0, 'eg')).toMatch(/bronze-town-small-b/);
    expect(townAssetUrl('bronze', 'medium', 1, 'iq')).toMatch(/bronze-town-medium-a/);
    expect(townAssetUrl('bronze', 'small', 1, 'fr')).toMatch(/bronze-town-small-b/);
    expect(townAssetUrl('modern', 'small')).toBeNull();
  });

  it('picks LOD2 below k 20, LOD1 below 40, LOD0 from 40', () => {
    expect([10, 19.9, 20, 39, 40, 150].map(lodForZoom)).toEqual([2, 2, 1, 1, 0, 0]);
  });

  it('loads a file once and finds the object holding the LODs', async () => {
    let calls = 0;
    const load = async () => { calls += 1; return fakeTown(); };
    const [a, b] = await Promise.all([loadTownAsset('test://town.glb', load), loadTownAsset('test://town.glb', load)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(a.name).toBe('town-small-a');
  });

  it('tints only Team, shares geometry, and shows one LOD at a time', async () => {
    const root = await loadTownAsset('test://town2.glb', async () => fakeTown());
    const inst = instanceTownAsset(root, '#ff0000');
    const mesh = inst.children[0];
    expect(mesh.geometry).toBe(root.children[0].geometry);
    expect(mesh.material[0]).toBe(root.children[0].material[0]);
    expect(mesh.material[1]).not.toBe(root.children[0].material[1]);
    expect(mesh.material[1].color.r).toBeGreaterThan(mesh.material[1].color.g);
    showLod(inst, 1);
    expect(inst.children.map((c) => c.visible)).toEqual([false, true, false]);
  });
});
