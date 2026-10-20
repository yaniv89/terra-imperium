// The Wave 0 art paths (plans/ART-MODELS-PLAN.md): the index finds a dropped-in file by its folder
// and name with the documented fallbacks, a kit file parses into instanced pieces, and nothing is
// found (the placeholders stay) when the folders are empty.
import { describe, it, expect } from 'vitest';
import { Group, Matrix4, Color, Quaternion, Vector3 } from 'three';
import { createArtIndex, ageChain, vegetationChain, assetKey, VEGETATION_KITS } from './artIndex';
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
    expect(ageChain('kingdoms')).toEqual(['kingdoms', 'classical', 'bronze', 'stone']);
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

  it('mixes the species and sizes of the kit in one mesh a species and chunk, the same on every build', async () => {
    const own = await speciesKit(['tree-s', 'tree-m', 'tree-l', 'tree-s-2', 'tree-m-2', 'tree-l-2', 'tree-s-3', 'tree-m-3', 'tree-l-3', 'rock-m']);
    const build = async () => {
      const { field, pine, oak } = wood();
      const r = { track: (x) => x, camera: { zoom: 3 }, setup: { terrain: 'forest', seed: 5 } };
      const v = new VegetationProps(r, { pine: [pine], oak: [oak] }, { ref: { url: 'test://own' }, load: async () => own });
      await v.ready;
      return { v, field, pine, oak };
    };
    const a = await build();
    expect(a.pine.visible).toBe(false); expect(a.oak.visible).toBe(false);
    expect(a.v.treeStats()).toMatchObject({ trees: 400, drawn: 400, species: 3, lod: 0, meshes: 3 }); // one chunk, three species: three draw calls
    const perVariant = {};
    a.v.trees.meshes.forEach((m) => m.sizes.forEach((size) => { perVariant[`${m.species}/${size}`] = (perVariant[`${m.species}/${size}`] || 0) + 1; }));
    expect(Object.keys(perVariant).length).toBe(9); // three species, three sizes each
    Object.values(perVariant).forEach((n) => expect(n).toBeGreaterThan(8));
    // the sizes are scales of one geometry: a large tree is drawn bigger than a small one
    const scaleOf = (m, j) => new Matrix4().fromArray(m.mesh.instanceMatrix.array, j * 16).getMaxScaleOnAxis();
    a.v.trees.meshes.forEach((m) => {
      const avg = (size) => { const js = m.sizes.map((s, j) => (s === size ? j : -1)).filter((j) => j >= 0); return js.reduce((t, j) => t + scaleOf(m, j), 0) / js.length; };
      expect(avg(2)).toBeGreaterThan(avg(0));
    });
    // deterministic: a second build of the same field draws the same trees in the same places
    const b = await build();
    const where = (v) => v.trees.meshes.map((m) => [m.species, m.mesh.count, Array.from(m.mesh.instanceMatrix.array).join()]).sort().join('|');
    expect(where(b.v)).toBe(where(a.v));
    a.v.dispose();
    expect(a.field.children.length).toBe(2); // only the procedural chunks are left
  });

  it('turns wind-bent species to one wind per battle, give or take a little', async () => {
    const { treeSpecies: rows, leanOf, windYaw } = await import('./treeMix');
    const own = await speciesKit(['tree-s', 'tree-m', 'tree-l']);
    // shift the medium tree's crown off its foot along +x: a wind-bent tree
    const bent = { ...own, objects: { ...own.objects, 'tree-m': { ...own.objects['tree-m'], box: { min: { x: 0.0, y: 0, z: -0.05 }, max: { x: 0.3, y: 0.4, z: 0.05 } } } } };
    expect(rows(bent)[0][1]).toBe(bent.objects['tree-m']);
    expect(leanOf(bent.objects['tree-m'].box)).toBeCloseTo(0);
    expect(leanOf({ min: { x: -0.1, y: 0, z: -0.1 }, max: { x: 0.1, y: 0.5, z: 0.1 } })).toBeNull();
    const yaws = async (seed) => {
      const { pine, oak } = wood();
      const v = new VegetationProps({ track: (x) => x, camera: { zoom: 3 }, setup: { terrain: 'forest', seed } }, { pine: [pine], oak: [oak] }, { ref: { url: 'test://bent' }, load: async () => bent });
      await v.ready;
      const out = [];
      v.trees.meshes.forEach(({ mesh }) => { for (let j = 0; j < mesh.count; j++) { const q = new Quaternion(); new Matrix4().fromArray(mesh.instanceMatrix.array, j * 16).decompose(new Vector3(), q, new Vector3()); out.push(new Vector3(1, 0, 0).applyQuaternion(q)); } });
      return out;
    };
    const leanAngle = (d) => Math.atan2(-d.z, d.x);
    const diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const a = await yaws(5);
    a.forEach((d) => expect(diff(leanAngle(d), windYaw(5))).toBeLessThan(0.27));
    const b = await yaws(6);
    expect(diff(leanAngle(b[0]), leanAngle(a[0]))).toBeGreaterThan(0.01); // another battle, another wind
  });

  it('thins the wood at far zoom (fewer trees, nested, one mesh a species) and never touches the procedural chunks it hid', async () => {
    const own = await speciesKit(['tree-s', 'tree-m', 'tree-l', 'tree-s-2', 'tree-m-2', 'tree-l-2']);
    const { pine, oak } = wood();
    const r = { track: (x) => x, camera: { zoom: 3 }, setup: { terrain: 'forest' } };
    const v = new VegetationProps(r, { pine: [pine], oak: [oak] }, { ref: { url: 'test://own' }, load: async () => own });
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
    expect(near.meshes).toBe(2); // the same meshes close up
    // the far trees are the first of each mesh's rank order, so the ones LOD2 keeps are kept at LOD1 too
    v.trees.meshes.forEach((f) => { expect(f.ranks).toEqual([...f.ranks].sort((x, y) => x - y)); expect(keptCount(f.ranks, 2)).toBeLessThanOrEqual(keptCount(f.ranks, 1)); });
    expect(pine.count).toBe(200); expect(oak.count).toBe(200); // the procedural instances are untouched
    drawnAt(3);
    expect(v.treeStats().drawn).toBe(400);
  });
});

describe('the tree triangle budget', async () => {
  const { VegetationProps } = await import('./vegetationProps');
  const { treeLodForPx, pickTreeLod, TREE_LOD_PX, REFERENCE_TREE_UNITS } = await import('./treeMix');
  const { InstancedMesh, BoxGeometry, MeshBasicMaterial, OrthographicCamera } = await import('three');
  const { CITY_TILES_PER_UNIT } = await import('../setup/cityBattle');

  it('picks the size level by a tree\'s height on screen, with a margin against flicker', () => {
    expect(treeLodForPx(TREE_LOD_PX[0] * 1.1)).toBe(0);
    expect(treeLodForPx(TREE_LOD_PX[1] * 1.1)).toBe(1);
    expect(treeLodForPx(TREE_LOD_PX[1] * 0.9)).toBe(2);
    expect(treeLodForPx(TREE_LOD_PX[0] - 2, 0)).toBe(0); // just under: stays close up
    expect(treeLodForPx(TREE_LOD_PX[0] + 2, 1)).toBe(1); // just over: stays at the middle level
    expect(treeLodForPx(TREE_LOD_PX[1] - 1, 1)).toBe(1);
    // a landscape phone (18 tiles tall on 390 css px): the size levels sit near zoom 2 and 0.9, where the zoom rule switched
    const phonePx = (zoom) => REFERENCE_TREE_UNITS * CITY_TILES_PER_UNIT * (390 / 18) * zoom;
    expect(treeLodForPx(phonePx(2.2), 1)).toBe(0);
    expect(treeLodForPx(phonePx(1), 1)).toBe(1);
    expect(treeLodForPx(phonePx(0.8), 1)).toBe(2);
  });

  it('draws coarser while over the budget, finer again only with room to spare', () => {
    const cost = (lod) => [400, 60, 30][lod] * 1000;
    expect(pickTreeLod({ sizeLod: 0, cost, budget: Infinity })).toBe(0);
    expect(pickTreeLod({ sizeLod: 0, cost, budget: 150000 })).toBe(1);
    expect(pickTreeLod({ sizeLod: 0, cost, budget: 50000 })).toBe(2);
    expect(pickTreeLod({ sizeLod: 1, cost, budget: 1e9 })).toBe(1); // never finer than the size level
    expect(pickTreeLod({ sizeLod: 0, cost, budget: 420000, prev: 1 })).toBe(1); // 400k fits 420k, not with 15% spare
    expect(pickTreeLod({ sizeLod: 0, cost, budget: 480000, prev: 1 })).toBe(0);
  });

  it('a dense wood seen close keeps every tree and draws it simpler past the budget; trees out of view cost nothing', async () => {
    const field = new Group();
    const trees = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 900);
    for (let i = 0; i < 900; i++) trees.setMatrixAt(i, new Matrix4().makeTranslation(i % 30, 0, Math.floor(i / 30)));
    trees.castShadow = true; field.add(trees);
    const kit = parseKit((await parseGlbBytes(kitGlb([{ name: 'tree-s', size: 0.3 }, { name: 'tree-m', size: 0.4 }, { name: 'tree-l', size: 0.5 }]))).scene);
    const m = kit.objects['tree-m'];
    m.lods = [{ ...m.lods[0], geometry: new BoxGeometry(0.4, 0.4, 0.4, 4, 4, 4) }, m.lods[1], m.lods[2]]; // a full tree far heavier than its far levels
    const v = new VegetationProps({ track: (x) => x, camera: { zoom: 3 }, setup: { terrain: 'forest' } }, { pine: [trees] }, { ref: { url: 'test://k' }, load: async () => kit });
    await v.ready;
    const cam = (x0, x1) => { const c = new OrthographicCamera(x0, x1, 40, -40, 0.1, 400); c.position.set(0, 100, 0); c.up.set(0, 0, -1); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };
    const seen = cam(-10, 40); // the whole wood
    const close = 100; // css px a tile: the size level asks for full detail
    v.update(3, { cssPxPerTile: close, camera: seen, budget: Infinity });
    expect(v.treeStats()).toMatchObject({ lod: 0, sizeLod: 0, drawn: 900 });
    const full = v.treeStats().cost;
    const chunks = v.treeStats().fullDetail;
    expect(chunks).toBe(4); // a 30-tile wood in 16-tile chunks
    const budget = full - 1;
    v.update(3, { cssPxPerTile: close, camera: seen, budget });
    expect(v.treeStats().fullDetail).toBe(3); // the chunk furthest from the middle of the view draws simpler
    expect(v.treeStats().drawn).toBe(900); // not one tree fewer
    expect(v.treeStats().cost).toBeLessThanOrEqual(budget);
    v.update(3, { cssPxPerTile: close, camera: seen, budget: 1 });
    expect(v.treeStats().fullDetail).toBe(0); // nothing fits: every chunk at the simplest level, every tree still there
    expect(v.treeStats().lod).toBe(2);
    expect(v.treeStats().drawn).toBe(900);
    // looking away from the wood: nothing of it counts
    v.update(3, { cssPxPerTile: close, camera: cam(500, 560), budget });
    expect(v.treeStats().cost).toBe(0);
    // further out the 48-tile chunks draw, thinned, one level for all
    v.update(1, { cssPxPerTile: 20, camera: seen, budget: Infinity });
    expect(v.treeStats()).toMatchObject({ sizeLod: 1, lod: 1, fullDetail: 0 });
    expect(v.treeStats().drawn).toBeLessThan(900);
    expect(v.trees.near.every((t) => !t.mesh.visible)).toBe(true);
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

describe('the steppe kit', () => {
  it('a steppe battle reads vegetation-steppe.glb (and a desert battle without its kit falls back to it)', () => {
    const a = idx('battle/nature/vegetation-temperate.glb', 'battle/nature/vegetation-steppe.glb');
    expect(a.vegetation('steppe').kit).toBe('steppe');
    expect(a.vegetation('desert').kit).toBe('steppe');
  });
  it('ships all seven kits, each its own file', () => {
    VEGETATION_KITS.forEach((k) => expect(ART.vegetation(k)?.kit, k).toBe(k));
  });
});
