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

  it('resolves civic halls and palace damage by style without borrowing another age', () => {
    for (const kind of ['civic', 'palaceDamage']) {
      const stem = kind === 'civic' ? 'civic' : 'palace-damage';
      const a = idx(`battle/city/${stem}-bronze.glb`, `battle/city/${stem}-bronze-sinic.glb`, `battle/city/${stem}-classical-levant.glb`);
      expect(a[kind]('bronze', 'korea').style).toBe('sinic');
      expect(a[kind]('bronze', 'europe').style).toBe('base');
      expect(a[kind]('classical', 'andalus').style).toBe('levant');
      expect(a[kind]('kingdoms', 'sinic')).toBeNull();
      expect(idx()[kind]('bronze', 'levant')).toBeNull();
    }
  });

  it('finds nodes, vegetation kits along their chain, terrain, bridges, signature units and map kits', () => {
    const a = idx('battle/nature/stone-outcrop.glb', 'battle/nature/vegetation-temperate.glb', 'battle/nature/vegetation-conifer.glb',
      'battle/terrain/ford.glb', 'battle/terrain/bridge-wood.glb', 'battle/terrain/bridge-stone.glb', 'units/signature/kingdom-of-israel.glb', 'map/terrain/hills.glb');
    expect(a.nature('stone-outcrop').url).toMatch(/stone-outcrop/);
    expect(a.nature('gold-vein')).toBeNull();
    expect(vegetationChain('cold')).toEqual(['cold', 'conifer', 'temperate']);
    expect(a.vegetation('cold').kit).toBe('conifer');
    expect(a.vegetation('desert').kit).toBe('temperate');
    expect(a.terrain('ford').url).toMatch(/ford/);
    expect(a.terrain('river-kit')).toBeNull();
    expect(a.bridge('modern').material).toBe('stone');
    expect(a.bridge('bronze').object).toBe('bridge-wood');
    expect(a.signature('kingdom-of-israel').url).toMatch(/signature\/kingdom-of-israel/);
    expect(a.signature('hittites')).toBeNull();
    expect(a.mapTerrain('hills').url).toMatch(/hills/);
    expect(idx().vegetation('temperate')).toBeNull();
  });

  it('builds the game index from the asset folders (every key a known class)', () => {
    ART.keys().forEach((k) => expect(k).toMatch(/^(battle\/(rts|city|nature|terrain|projectiles|props)|units\/signature|map\/terrain)\//));
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

describe('vegetation kits on the battlefield', async () => {
  const { VegetationProps, vegetationLodForZoom } = await import('./vegetationProps');
  const { KEEP_AT_LOD, keptCount } = await import('./treeMix');
  const { kitForClimate, vegetationKitFor } = await import('./vegetation');
  const { InstancedMesh, BoxGeometry, MeshBasicMaterial } = await import('three');

  it('picks the kit from the climate, the terrain or the setup', () => {
    expect(['Af', 'BWh', 'BSk', 'Csa', 'Cfb', 'Dfc', 'Dfb', 'ET'].map(kitForClimate)).toEqual(['tropical', 'desert', 'steppe', 'mediterranean', 'temperate', 'conifer', 'temperate', 'cold']);
    expect(vegetationKitFor({ terrain: 'desert' }, null)).toBe('desert');
    expect(vegetationKitFor({ terrain: 'plains', vegetation: 'steppe' }, null)).toBe('steppe');
    const tiles = { climate: [9, 6], climateNames: ['Af', 'Am', 'As', 'Aw', 'BSh', 'BSk', 'BWh', 'BWk', 'Cfa', 'Cfb'] };
    expect(vegetationKitFor({ terrain: 'desert', tile: 0 }, tiles)).toBe('temperate');
    expect(vegetationKitFor({ terrain: 'plains', tile: 1 }, tiles)).toBe('desert');
  });

  it('swaps a dropped-in kit into the instanced chunks and follows the zoom; no kit, no change', async () => {
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
    const rocks = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
    const procedural = rocks.geometry;
    const field = new Group(); field.add(mesh); field.add(rocks);
    const r = { track: (x) => x, camera: { zoom: 1 }, setup: { terrain: 'plains' } };
    const kit = parseKit((await parseGlbBytes(kitGlb([{ name: 'tree-l', size: 0.4 }, { name: 'rock-m', size: 0.2 }]))).scene);
    const v = new VegetationProps(r, { pine: [mesh], rock: [rocks], tuft: [] }, { ref: { url: 'test://veg' }, load: async () => kit });
    await v.ready;
    // rocks keep their chunk and instances and take the kit's geometry, the LOD by zoom
    expect(rocks.geometry).not.toBe(procedural);
    expect(rocks.count).toBe(3);
    const lod1 = rocks.geometry;
    v.update(3); expect(vegetationLodForZoom(3)).toBe(0);
    expect(rocks.geometry).not.toBe(lod1);
    // a kit with one tree still replaces every procedural tree (the species rule takes the size it has)
    expect(mesh.visible).toBe(false);
    expect(v.treeStats()).toMatchObject({ trees: 4, drawn: 4, species: 1, lod: 0 });
    const other = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 2);
    const before = other.geometry;
    const none = new VegetationProps(r, { pine: [other] }, { ref: null });
    none.update(3);
    expect(other.geometry).toBe(before);
  });

  // a wood of 400 trees on a 20 x 20 tile patch, as BattleRenderer places them (one chunk mesh a kind)
  const wood = () => {
    const field = new Group();
    const make = (n, off) => {
      const m = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), n);
      for (let i = 0; i < n; i++) m.setMatrixAt(i, new Matrix4().makeTranslation((i % 20) + off, 0, Math.floor(i / 20) + off));
      field.add(m); m.castShadow = true;
      return m;
    };
    return { field, pine: make(200, 0.3), oak: make(200, 0.7) };
  };
  const speciesKit = async (names) => parseKit((await parseGlbBytes(kitGlb(names.map((name, i) => ({ name, size: 0.2 + 0.05 * (i % 3) }))))).scene);

  it('mixes the species and sizes of the kit and its species file, the same on every build', async () => {
    const own = await speciesKit(['tree-s', 'tree-m', 'tree-l', 'tree-s-2', 'tree-m-2', 'tree-l-2', 'rock-m']);
    const more = await speciesKit(['tree-s-3', 'tree-m-3', 'tree-l-3']);
    const build = async () => {
      const { field, pine, oak } = wood();
      const r = { track: (x) => x, camera: { zoom: 3 }, setup: { terrain: 'forest' } };
      const v = new VegetationProps(r, { pine: [pine], oak: [oak] }, { ref: { url: 'test://own' }, more: { url: 'test://more' }, load: async (u) => (u.includes('more') ? more : own) });
      await v.ready;
      return { v, field, pine, oak };
    };
    const a = await build();
    expect(a.pine.visible).toBe(false); expect(a.oak.visible).toBe(false);
    const stats = a.v.treeStats();
    expect(stats).toMatchObject({ trees: 400, drawn: 400, species: 3, lod: 0 });
    const perVariant = {};
    a.v.trees.near.forEach((n) => { perVariant[`${n.species}/${n.size}`] = (perVariant[`${n.species}/${n.size}`] || 0) + n.mesh.count; });
    expect(Object.keys(perVariant).length).toBe(9); // three species, three sizes each
    Object.values(perVariant).forEach((n) => expect(n).toBeGreaterThan(8));
    expect(a.field.children.filter((m) => m.visible).length).toBe(a.v.trees.near.length);
    // deterministic: a second build of the same field draws the same trees in the same places
    const b = await build();
    const where = (v) => v.trees.near.map((n) => [n.species, n.size, n.mesh.count, Array.from(n.mesh.instanceMatrix.array).join()]).sort().join('|');
    expect(where(b.v)).toBe(where(a.v));
    a.v.dispose();
    expect(a.field.children.length).toBe(2); // only the procedural chunks are left
  });

  it('thins the wood at far zoom (fewer trees, nested, one mesh a species) and never touches the procedural chunks it hid', async () => {
    const own = await speciesKit(['tree-s', 'tree-m', 'tree-l', 'tree-s-2', 'tree-m-2', 'tree-l-2']);
    const { pine, oak } = wood();
    const r = { track: (x) => x, camera: { zoom: 3 }, setup: { terrain: 'forest' } };
    const v = new VegetationProps(r, { pine: [pine], oak: [oak] }, { ref: { url: 'test://own' }, more: null, load: async () => own });
    await v.ready;
    const drawnAt = (zoom) => { v.update(zoom); return v.treeStats(); };
    const near = drawnAt(3); const mid = drawnAt(1); const far = drawnAt(0.6);
    expect(near.drawn).toBe(400);
    expect(mid.lod).toBe(1); expect(far.lod).toBe(2);
    expect(mid.drawn).toBeLessThan(near.drawn);
    expect(far.drawn).toBeLessThan(mid.drawn);
    expect(far.drawn / near.drawn).toBeGreaterThan(KEEP_AT_LOD[2] - 0.12);
    expect(far.drawn / near.drawn).toBeLessThan(KEEP_AT_LOD[2] + 0.12);
    expect(far.meshes).toBe(2); // one per species in the chunk, not one per size
    v.trees.near.forEach((n) => expect(n.mesh.visible).toBe(false));
    // the far trees are the first of each mesh's rank order, so the ones LOD2 keeps are kept at LOD1 too
    v.trees.far.forEach((f) => { expect(f.ranks).toEqual([...f.ranks].sort((x, y) => x - y)); expect(keptCount(f.ranks, 2)).toBeLessThanOrEqual(keptCount(f.ranks, 1)); });
    expect(pine.count).toBe(200); expect(oak.count).toBe(200); // the procedural instances are untouched
    drawnAt(3);
    expect(v.treeStats().drawn).toBe(400);
  });
});

describe('tree species picking (treeMix.js)', async () => {
  const { treeAt, parseTreeName, treeSpecies, nearestSize, keptCount: kept } = await import('./treeMix');
  it('reads species and sizes from the object names', () => {
    expect(parseTreeName('tree-m')).toEqual({ species: 0, size: 1 });
    expect(parseTreeName('tree-l-3')).toEqual({ species: 2, size: 2 });
    expect(parseTreeName('tree-x')).toBeNull();
    expect(parseTreeName('stump')).toBeNull();
    const rows = treeSpecies({ objects: { 'tree-l': 'a', 'tree-s-2': 'b', stump: 'c' } }, { objects: { 'tree-m-2': 'd', 'tree-l': 'ignored' } });
    expect(rows).toEqual([[null, null, 'a'], ['b', 'd', null]]);
    expect(nearestSize(rows[0], 0)).toBe(2);
    expect(nearestSize(rows[1], 2)).toBe(1);
    expect(kept([0.1, 0.5, 0.7, 0.9], 2)).toBe(2);
  });
  it('is a pure function of the place: the same tree every time, stands of a leading species', () => {
    expect(treeAt(12.3, 40.7, 3)).toEqual(treeAt(12.3, 40.7, 3));
    const counts = [0, 0, 0]; const sizes = [0, 0, 0];
    let same = 0; let pairs = 0;
    for (let z = 0; z < 60; z += 0.7) for (let x = 0; x < 60; x += 0.7) {
      const t = treeAt(x, z, 3); counts[t.species]++; sizes[t.size]++;
      expect(t.scale).toBeGreaterThanOrEqual(0.86); expect(t.scale).toBeLessThanOrEqual(1.14);
      const n = treeAt(x + 0.7, z, 3); pairs++; if (n.species === t.species) same++;
    }
    counts.forEach((c) => expect(c).toBeGreaterThan(400));
    sizes.forEach((c) => expect(c).toBeGreaterThan(1000));
    expect(same / pairs).toBeGreaterThan(0.45); // neighbours agree more than a third of the time: stands
  });
});

describe('the steppe kit and the species files', () => {
  it('a steppe battle reads vegetation-steppe.glb, and only an exact kit takes a species file', () => {
    const a = idx('battle/nature/vegetation-temperate.glb', 'battle/nature/vegetation-steppe.glb', 'battle/nature/vegetation-conifer-species.glb');
    expect(a.vegetation('steppe').kit).toBe('steppe');
    expect(a.vegetation('desert').kit).toBe('steppe'); // desert falls back to steppe before temperate
    expect(a.vegetationSpecies('conifer').key).toBe('battle/nature/vegetation-conifer-species.glb');
    expect(a.vegetationSpecies('temperate')).toBeNull();
    expect(a.vegetation('steppe').key).not.toBe(a.vegetationSpecies('conifer').key);
  });
  it('ships the steppe kit and the three species files the game reads', () => {
    expect(ART.vegetation('steppe')?.kit).toBe('steppe');
    ['conifer', 'tropical', 'cold'].forEach((k) => expect(ART.vegetationSpecies(k), k).not.toBeNull());
    expect(ART.vegetationSpecies('temperate')).toBeNull();
  });
});
