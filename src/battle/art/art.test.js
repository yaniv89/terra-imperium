// The Wave 0 art paths (plans/ART-MODELS-PLAN.md): the index finds a dropped-in file by its folder
// and name with the documented fallbacks, a kit file parses into instanced pieces, and nothing is
// found (the placeholders stay) when the folders are empty.
import { describe, it, expect } from 'vitest';
import { Group, Matrix4, Color } from 'three';
import { createArtIndex, ageChain, vegetationChain, assetKey } from './artIndex';
import { ART } from './artFiles';
import { parseKit, loadKit, kitObject, objectSize } from './kitLoader';
import { KitInstances } from './kitInstances';
import { buildingArt, BUILDINGS, BUILDABLE } from '../data/economy';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';

const idx = (...keys) => createArtIndex(Object.fromEntries(keys.map((k) => [`../../assets/${k}`, `/u/${k}`])));

describe('art index', () => {
  it('reads keys from glob paths', () => {
    expect(assetKey('../../assets/battle/rts/rts-bronze.glb')).toBe('battle/rts/rts-bronze.glb');
    expect(assetKey('/src/assets/map/terrain/hills.glb')).toBe('map/terrain/hills.glb');
  });

  it('falls back to the nearest earlier age, never a later one', () => {
    expect(ageChain('kingdoms')).toEqual(['kingdoms', 'classical', 'bronze']);
    const a = idx('battle/rts/rts-bronze.glb', 'battle/rts/rts-gunpowder.glb');
    expect(a.rts('bronze').ageId).toBe('bronze');
    expect(a.rts('kingdoms').ageId).toBe('bronze');
    expect(a.rts('modern').ageId).toBe('gunpowder');
    expect(idx('battle/rts/rts-classical.glb').rts('bronze')).toBeNull();
    ['walls', 'ruins', 'fort', 'projectiles'].forEach((k) => {
      const file = k === 'projectiles' ? 'battle/projectiles/classical.glb' : `battle/city/${k}-classical.glb`;
      expect(idx(file)[k]('modern').url).toBe(`/u/${file}`);
      expect(idx(file)[k]('bronze')).toBeNull();
    });
  });

  it('follows the style chain for damaged houses and never crosses ages', () => {
    const a = idx('battle/city/bronze-houses-damage.glb', 'battle/city/bronze-sinic-houses-damage.glb', 'battle/city/classical-levant-houses-damage.glb');
    expect(a.housesDamage('bronze', 'korea').style).toBe('sinic');
    expect(a.housesDamage('bronze', 'europe').style).toBe('base');
    expect(a.housesDamage('classical', 'andalus').style).toBe('levant');
    expect(a.housesDamage('classical', 'europe')).toBeNull();
    expect(a.housesDamage('kingdoms', 'levant')).toBeNull();
  });

  it('finds nodes, vegetation kits along their chain, terrain, bridges, signature units and map kits', () => {
    const a = idx('battle/nature/stone-outcrop.glb', 'battle/nature/vegetation-temperate.glb', 'battle/nature/vegetation-conifer.glb',
      'battle/terrain/ford.glb', 'battle/terrain/bridge-wood.glb', 'battle/terrain/bridge-stone.glb', 'units/signature/egyptians.glb', 'map/terrain/hills.glb');
    expect(a.nature('stone-outcrop').url).toMatch(/stone-outcrop/);
    expect(a.nature('gold-vein')).toBeNull();
    expect(vegetationChain('cold')).toEqual(['cold', 'conifer', 'temperate']);
    expect(a.vegetation('cold').kit).toBe('conifer');
    expect(a.vegetation('desert').kit).toBe('temperate');
    expect(a.terrain('ford').url).toMatch(/ford/);
    expect(a.terrain('river-kit')).toBeNull();
    expect(a.bridge('modern').material).toBe('stone');
    expect(a.bridge('bronze').object).toBe('bridge-wood');
    expect(a.signature('egyptians').url).toMatch(/signature\/egyptians/);
    expect(a.signature('hittites')).toBeNull();
    expect(a.mapTerrain('hills').url).toMatch(/hills/);
    expect(idx().vegetation('temperate')).toBeNull();
  });

  it('builds the game index from the asset folders (every key a known class)', () => {
    ART.keys().forEach((k) => expect(k).toMatch(/^(battle\/(rts|city|nature|terrain|projectiles)|units\/signature|map\/terrain)\//));
  });
});

describe('battle building art ids', () => {
  it('resolve per age with the earlier-age fallback, and null without a file (the greybox)', () => {
    const have = new Set(['bronze', 'gunpowder']);
    const has = (a) => have.has(a);
    expect(buildingArt('barracks', 'bronze', has)).toEqual({ ageId: 'bronze', file: 'rts-bronze', object: 'barracks', id: 'rts/bronze/barracks' });
    expect(buildingArt('barracks', 'kingdoms', has).id).toBe('rts/bronze/barracks');
    expect(buildingArt('stable', 'modern', has).id).toBe('rts/gunpowder/stable');
    expect(buildingArt('barracks', 'bronze')).toBeNull();
    expect(buildingArt('camp', 'modern', () => true).id).toBe('rts/modern/expedition-camp');
    // no art id still hard-codes an age
    Object.values(BUILDINGS).forEach((b) => expect(b.art).not.toMatch(/\//));
    BUILDABLE.forEach((id) => expect(BUILDINGS[id].art).toMatch(/^[a-z-]+$/));
  });
});

describe('kit files', () => {
  const fixture = () => kitGlb([
    { name: 'barracks', size: 1.4, sockets: { 'socket-door': [0, 0, 0.7], 'socket-fire-1': [0.3, 0.5, 0] } },
    { name: 'barracks-damaged', size: 1.4 },
    { name: 'arrow', size: 0.1, lods: false }
  ]);

  it('parse into objects with three LODs, sockets and a footprint', async () => {
    const kit = parseKit((await parseGlbBytes(fixture())).scene);
    expect(Object.keys(kit.objects).sort()).toEqual(['arrow', 'barracks', 'barracks-damaged']);
    const b = kit.objects.barracks;
    expect(b.lods).toHaveLength(3);
    expect(b.lods[0].materials.map((m) => m.name)).toEqual(['Town', 'Team']);
    expect(b.lods[0].team).toEqual([false, true]);
    expect(b.lods[0].geometry.groups).toHaveLength(2);
    expect(b.sockets['socket-door'].z).toBeCloseTo(0.7);
    expect(objectSize(b).footprint).toBeCloseTo(1.4);
    // a root without LOD children is its own LOD0, and the lower levels reuse it
    expect(kit.objects.arrow.lods[2]).toBe(kit.objects.arrow.lods[0]);
    expect(kitObject(kit, 'tower-damaged', 'barracks-damaged').name).toBe('barracks-damaged');
    expect(kitObject(kit, 'tower')).toBeNull();
  });

  it('load once per url, and a failed load rejects (the caller keeps its placeholder)', async () => {
    let n = 0;
    const load = async () => { n += 1; return parseGlbBytes(fixture()); };
    const [a, b] = await Promise.all([loadKit('test://kit-a.glb', { load }), loadKit('test://kit-a.glb', { load })]);
    expect(a).toBe(b); expect(n).toBe(1);
    await expect(loadKit('test://missing.glb', { load: async () => { throw new Error('404'); } })).rejects.toThrow(/missing/);
    expect(await loadKit(null)).toBeNull();
  });

  it('instance every copy of a piece with one mesh per LOD, Team taking the copy colour', async () => {
    const kit = parseKit((await parseGlbBytes(fixture())).scene);
    const parent = new Group();
    const inst = new KitInstances(parent, { initial: 2 });
    inst.begin();
    for (let i = 0; i < 5; i++) inst.add(kit.objects.barracks, 0, new Matrix4().makeTranslation(i, 0, 0), new Color('#ff0000'));
    inst.add(kit.objects.barracks, 2, new Matrix4());
    inst.end();
    expect(inst.stats()).toEqual({ copies: 6, draws: 4 });
    const meshes = parent.children.filter((c) => c.isInstancedMesh);
    expect(meshes.length).toBe(2);
    expect(meshes.find((m) => m.count === 5).instanceMatrix.array[12 + 16 * 4]).toBe(4); // grown past its first 2 slots, copies kept
    inst.begin(); inst.end();
    expect(parent.children.every((m) => !m.visible)).toBe(true);
    inst.dispose();
    expect(parent.children.length).toBe(0);
  });
});
