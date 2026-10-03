// Artist town models: the file for an (age, size) is found, the zoom picks the brief's LOD, a load
// happens once per file, and an instance tints only its Team cloth.
import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { styleOfLand, styleChain } from '../../../data/architecture';
import { sharedAssetUrls, townAssetUrl, townVariant, lodForZoom, loadTownAsset, loadAssetObjects, instanceTownAsset, showLod, palaceFor, sharedAssetUrl, wallsFor, isCamp, COLONY_CAMP, fieldsAround, fieldCount, FIELDS_FOR_WORK } from './townAssets';

const fakeObject = (name, lodNames = ['LOD0', 'LOD1', 'LOD2']) => {
  const root = new Group(); root.name = name;
  lodNames.forEach((n) => {
    const town = Object.assign(new MeshStandardMaterial(), { name: 'Town' });
    const team = Object.assign(new MeshStandardMaterial({ color: '#ffffff' }), { name: 'Team' });
    const m = new Mesh(new BoxGeometry(1, 1, 1), [town, team]); m.name = n; root.add(m);
  });
  return root;
};
const fakeTown = () => { const scene = new Group(); scene.add(fakeObject('town-small-a')); return { scene }; };

describe('artist town models', () => {
  it('finds the shipped Bronze Age towns, picks a variant by seed, and nothing for other ages', () => {
    expect(townAssetUrl('bronze', 'small', 0)).toMatch(/bronze-town-small-a/);
    expect(townAssetUrl('bronze', 'small', 1)).toMatch(/bronze-town-small-b/);
    expect(townAssetUrl('bronze', 'medium', 0)).toMatch(/bronze-town-medium-a/);
    expect(townAssetUrl('bronze', 'medium', 1)).toMatch(/bronze-town-medium-b/);
    expect(townAssetUrl('bronze', 'big', 0)).toMatch(/bronze-town-big-a/);
    expect(townAssetUrl('bronze', 'big', 1)).toMatch(/bronze-town-big-b/);
    // the land's tradition wins over the seed: the Nile builds the Egyptian town, the Levant the Mesopotamian
    expect(townAssetUrl('bronze', 'small', 0, 'nile')).toMatch(/bronze-town-small-b/);
    expect(townAssetUrl('bronze', 'medium', 1, 'levant')).toMatch(/bronze-town-medium-a/);
    expect(townAssetUrl('bronze', 'small', 1, 'westafrica')).toMatch(/bronze-town-small-b/);
    expect(townAssetUrl('future', 'small')).toBeNull();
  });

  it('picks the layout by the land: Han in East Asia, Roman elsewhere in the Classical Age', () => {
    expect(townAssetUrl('classical', 'medium', 0, styleOfLand('cn', 'classical'))).toMatch(/classical-town-medium-b/);
    expect(townAssetUrl('classical', 'small', 0, styleOfLand('jp', 'classical'))).toMatch(/classical-town-small-b/);
    expect(townAssetUrl('classical', 'medium', 1, styleOfLand('it', 'classical'))).toMatch(/classical-town-medium-a/);
    expect(townAssetUrl('classical', 'medium', 1, styleOfLand('eg', 'classical'))).toMatch(/classical-town-medium-a/);
    expect(sharedAssetUrl('classical')).toMatch(/shared-classical/);
    expect(townVariant('kingdoms', 'levant')).toBe('b');
    expect(townVariant('kingdoms', 'europe')).toBe('a');
    expect(townVariant('gunpowder', 'levant', 3)).toBe('b');
    expect(townVariant('gunpowder', 'levant', 4)).toBe('a');
    // a size with only one layout falls back to it whatever the tradition asks
    expect(townAssetUrl('kingdoms', 'small', 0, 'levant')).toMatch(/kingdoms-town-small-/);
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

  it('reads a shared file with several objects, whose later LODs arrive as LOD0001', async () => {
    const scene = new Group();
    scene.add(fakeObject('palace-small'), fakeObject('palace', ['LOD0001', 'LOD1001', 'LOD2001']));
    const objs = await loadAssetObjects('test://shared.glb', async () => ({ scene }));
    expect(Object.keys(objs).sort()).toEqual(['palace', 'palace-small']);
    // a palace placed in a town follows the town's LOD switch
    const town = instanceTownAsset(fakeObject('town'), '#00ff00');
    town.add(instanceTownAsset(objs.palace, '#00ff00'));
    showLod(town, 2);
    const visible = [];
    town.traverse((o) => { if (o.isMesh && o.visible) visible.push(o.name); });
    expect(visible).toEqual(['LOD2', 'LOD2001']);
  });

  it('gives a small capital the small palace and a bigger one the full palace', () => {
    expect(palaceFor('small')).toBe('palace-small');
    expect(palaceFor('medium')).toBe('palace');
    expect(palaceFor('big')).toBe('palace');
    expect(sharedAssetUrl('bronze')).toMatch(/shared-bronze/);
    expect(sharedAssetUrl('modern')).toBeNull();
  });

  it('rings each town size with its own wall ring', () => {
    expect(wallsFor('small')).toBe('walls-small');
    expect(wallsFor('medium')).toBe('walls-medium');
    expect(wallsFor('big')).toBe('walls-big');
    expect(wallsFor(undefined)).toBe('walls-small');
  });

  it('shows the colony camp on outposts and ownerless colonies, never on a grown city', () => {
    expect(COLONY_CAMP).toBe('colony-camp');
    expect(isCamp({ owner: 'eg', outpost: { progress: 10 } })).toBe(true);
    expect(isCamp({ owner: null, colony: { ownerId: 'eg' } })).toBe(true);
    expect(isCamp({ owner: 'eg' })).toBe(false);
    expect(isCamp({ owner: 'eg', colony: { ownerId: 'eg' } })).toBe(false);
    expect(isCamp(undefined)).toBe(false);
  });

  it('lays two to six fields round a town, more with food buildings', () => {
    expect(fieldCount({})).toBe(2);
    expect(fieldCount({ buildings: { categories: { food: 0 } } })).toBe(3);
    expect(fieldCount({ buildings: { categories: { food: 9 } } })).toBe(6);
    expect(FIELDS_FOR_WORK.farm).toEqual(['field-1', 'field-4']);
    expect(FIELDS_FOR_WORK.mine).toBeUndefined();
  });

  it('keeps the fields outside the town and its wall, off the south gate and apart', () => {
    for (const [tier, wallR] of [['small', 2.3], ['medium', 3.4], ['big', 4.5]]) {
      for (const seed of [0, 7, 123, 999]) {
        const fs = fieldsAround(tier, seed, 6);
        expect(fs).toHaveLength(6);
        fs.forEach((f) => {
          expect(Math.hypot(f.x, f.z)).toBeGreaterThan(wallR + 0.8);
          expect(f.name).toMatch(/^field-[1-4]$/);
          // the front (south, +z) stays open in front of the gate
          const deg = (Math.atan2(-f.z, f.x) * 180) / Math.PI;
          expect(Math.abs(deg + 90)).toBeGreaterThan(30);
        });
        for (let i = 0; i < fs.length; i++) {
          for (let j = i + 1; j < fs.length; j++) expect(Math.hypot(fs[i].x - fs[j].x, fs[i].z - fs[j].z)).toBeGreaterThan(1.7);
        }
      }
    }
  });
});

describe('architecture regions', () => {
  it('draws a city in the style of its land, settler lands only from the Gunpowder Age', () => {
    expect(styleOfLand('fr', 'bronze')).toBe('europe');
    expect(styleOfLand('eg', 'kingdoms')).toBe('nile');
    expect(styleOfLand('us', 'kingdoms')).toBe('americas');
    expect(styleOfLand('us', 'gunpowder')).toBe('europe');
    expect(styleOfLand('au', 'bronze')).toBe('monsoon');
    expect(styleOfLand('zz', 'bronze')).toBeNull();
    // the Orthodox east has its own churches from the Kingdoms Age, falling back to Europe
    expect(styleOfLand('ru', 'classical')).toBe('europe');
    expect(styleOfLand('ru', 'kingdoms')).toBe('easteurope');
    expect(styleChain('easteurope')).toEqual(['easteurope', 'europe']);
    expect(styleChain(null)).toEqual([]);
    expect(townAssetUrl('bronze', 'small', 0, 'easteurope')).toMatch(/bronze-town-small-/);
    // the base shared file always comes last; an age without one has none
    expect(sharedAssetUrls('bronze', 'europe').slice(-1)[0]).toMatch(/shared-bronze\.glb|shared-bronze-/);
    expect(sharedAssetUrls('future')).toEqual([]);
  });
});
