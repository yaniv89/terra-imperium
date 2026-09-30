// Composed units: a recipe dresses one rigged archetype (weapon in hand, seated on a mount, crewing an
// engine) and bakes it into a single instancing-ready geometry; the fetch script's recipes cover the
// whole {age}-{class} matrix and its GLB texture embedding produces a valid self-contained binary.
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  Bone, Skeleton, SkinnedMesh, Mesh, Group, BoxGeometry, MeshStandardMaterial, Uint16BufferAttribute, Float32BufferAttribute
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { composeUnitModel, findHand, findSaddle } from './unitComposer';
import { isSkinLike as loaderSkinLike } from './gltfUnitLoader';
import { LIMB, RIG_ATTRIBUTES } from './soldierFactory';
import {
  SLOTS, packGltf, readGlb, writeGlb, describe as describeModel, scoreModel, planRoster, tagSurfaces, facingYaw, normalise,
  isSkinLike, checkRoster
} from '../../../scripts/import-models.js';

const at = (geo, x, y, z) => geo.translate(x, y, z);
const skinTo = (geo, boneIndex) => {
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? boneIndex : 0)), 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  return geo;
};

// A 2-unit-tall humanoid whose right arm hangs down to y≈1.0 at x=-0.35.
const buildSoldier = () => {
  const bone = (name, x, y, z, parent) => { const b = new Bone(); b.name = name; b.position.set(x, y, z); parent?.add(b); return b; };
  const hips = bone('Hips', 0, 0.95, 0);
  const lUp = bone('LeftUpLeg', 0.15, -0.05, 0, hips); const rUp = bone('RightUpLeg', -0.15, -0.05, 0, hips);
  const spine = bone('Spine', 0, 0.3, 0, hips);
  const lArm = bone('LeftArm', 0.35, 0.35, 0, spine); const rArm = bone('RightArm', -0.35, 0.35, 0, spine);
  const head = bone('Head', 0, 0.5, 0, spine);
  const bones = [hips, lUp, rUp, spine, lArm, rArm, head];
  const idx = (b) => bones.indexOf(b);
  const geo = mergeGeometries([
    skinTo(at(new BoxGeometry(0.2, 0.9, 0.2), 0.15, 0.45, 0), idx(lUp)),
    skinTo(at(new BoxGeometry(0.2, 0.9, 0.2), -0.15, 0.45, 0), idx(rUp)),
    skinTo(at(new BoxGeometry(0.5, 0.7, 0.3), 0, 1.25, 0), idx(spine)),
    skinTo(at(new BoxGeometry(0.15, 0.6, 0.15), 0.35, 1.3, 0), idx(lArm)),
    skinTo(at(new BoxGeometry(0.15, 0.6, 0.15), -0.35, 1.3, 0), idx(rArm)),
    skinTo(at(new BoxGeometry(0.3, 0.4, 0.3), 0, 1.8, 0), idx(head))
  ]);
  const root = new Group();
  root.add(hips);
  root.updateMatrixWorld(true);
  const mesh = new SkinnedMesh(geo, Object.assign(new MeshStandardMaterial({ color: '#8a6a4a' }), { name: 'Body' }));
  root.add(mesh);
  mesh.bind(new Skeleton(bones));
  return root;
};

const buildSpear = () => {
  const g = new Group();
  g.add(new Mesh(new BoxGeometry(0.04, 1.6, 0.04), Object.assign(new MeshStandardMaterial({ color: '#7a5a3a' }), { name: 'Wood' })));
  return g;
};

// A four-legged animal: a long body up on four legs, head at the front (+Z).
const buildHorse = () => {
  const g = new Group();
  const m = (geo, name) => g.add(new Mesh(geo, Object.assign(new MeshStandardMaterial({ color: '#7a5230' }), { name })));
  m(at(new BoxGeometry(0.5, 0.5, 1.6), 0, 1.3, 0), 'Body');
  m(at(new BoxGeometry(0.3, 0.6, 0.4), 0, 1.9, 0.9), 'Head');
  [[-0.2, 0.6], [0.2, 0.6], [-0.2, -0.6], [0.2, -0.6]].forEach(([x, z]) => m(at(new BoxGeometry(0.12, 1.05, 0.12), x, 0.52, z), 'Leg'));
  return g;
};
const buildCatapult = () => {
  const g = new Group();
  g.add(new Mesh(at(new BoxGeometry(1, 0.4, 1.8), 0, 0.2, 0), Object.assign(new MeshStandardMaterial({ color: '#6b4a2e' }), { name: 'Wood' })));
  g.add(new Mesh(at(new BoxGeometry(0.1, 1.2, 0.1), 0, 1, -0.3), Object.assign(new MeshStandardMaterial({ color: '#6b4a2e' }), { name: 'Arm' })));
  return g;
};

const LIBRARY = { soldier: buildSoldier, spear: buildSpear, horse: buildHorse, catapult: buildCatapult };
const opts = {
  resolve: (name) => (LIBRARY[name] ? `mem://${name}` : null),
  load: async (url) => ({ scene: LIBRARY[url.slice(6)](), animations: [] })
};
const heightOf = (geo) => { geo.computeBoundingBox(); return geo.boundingBox.max.y - geo.boundingBox.min.y; };

describe('findHand', () => {
  it('finds the far end of the arm, and its bone', () => {
    const root = buildSoldier();
    const { bone, hand } = findHand(root, 'right');
    expect(bone.name).toBe('RightArm');
    expect(hand.x).toBeLessThan(-0.2);
    expect(hand.y).toBeLessThan(1.2);
    expect(findHand(root, 'left').bone.name).toBe('LeftArm');
  });
});

describe('composeUnitModel', () => {
  it('bakes a plain soldier with a GLB weapon in hand, carrying every rig attribute', async () => {
    const plain = await composeUnitModel({ base: 'soldier' }, opts);
    const armed = await composeUnitModel({ base: 'soldier', attach: [{ model: 'spear', hand: 'right' }] }, opts);
    Object.keys(RIG_ATTRIBUTES).forEach((a) => expect(armed.geometry.attributes[a], a).toBeTruthy());
    expect(armed.geometry.attributes.position.count).toBeGreaterThan(plain.geometry.attributes.position.count);
    // The weapon swings with the arm: some of its vertices are on the right-arm limb.
    const limbs = armed.geometry.attributes.aLimb.array;
    expect(Array.from(limbs).filter((l) => l === LIMB.ARM_R).length)
      .toBeGreaterThan(Array.from(plain.geometry.attributes.aLimb.array).filter((l) => l === LIMB.ARM_R).length);
    // The attachment doesn't shrink the soldier (it's left out of the height normalisation).
    expect(heightOf(armed.geometry)).toBeGreaterThanOrEqual(heightOf(plain.geometry) - 1e-3);
  });

  it('places a procedural prop too, and skips parts that are not available', async () => {
    const r = await composeUnitModel({ base: 'soldier', attach: [{ prop: 'shield', hand: 'left' }, { model: 'missing' }] }, opts);
    expect(r.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it('seats a rider on a procedural mount and crews a siege engine', async () => {
    const soldier = await composeUnitModel({ base: 'soldier' }, opts);
    const rider = await composeUnitModel({ base: 'soldier', mount: { kind: 'horse' } }, opts);
    expect(rider.stats.composed).toBe('mount');
    expect(rider.geometry.attributes.position.count).toBeGreaterThan(soldier.geometry.attributes.position.count);
    const engine = await composeUnitModel({ base: 'soldier', engine: 'siege', crew: [[-0.5, -0.8], [0.5, -0.8], [0, -1]] }, { ...opts, ageId: 'gunpowder' });
    expect(engine.stats.composed).toBe('engine');
    expect(engine.geometry.attributes.position.count).toBeGreaterThan(soldier.geometry.attributes.position.count * 3);
  });

  it('seats a rider on the saddle of a mount MODEL (the top of its back, not its head)', async () => {
    const r = await composeUnitModel({ base: 'soldier', mount: { model: 'horse', height: 1.25 } }, opts);
    expect(r.stats.composed).toBe('mount');
    const horse = buildHorse();
    // The horse model alone, baked to the same height, to find where its back is.
    const { extractUnitGeometry } = await import('./gltfUnitLoader');
    const alone = extractUnitGeometry(horse, { quadruped: true, height: 1.25, segment: false }).geometry;
    const [, backY] = findSaddle(alone);
    alone.computeBoundingBox();
    expect(backY).toBeLessThan(alone.boundingBox.max.y - 0.05); // the head is higher than the back
    r.geometry.computeBoundingBox();
    expect(r.geometry.boundingBox.max.y).toBeGreaterThan(alone.boundingBox.max.y); // the rider sits up top
  });

  it('crews an engine MODEL behind it, or puts one driver aboard', async () => {
    const soldier = await composeUnitModel({ base: 'soldier' }, opts);
    const n = soldier.geometry.attributes.position.count;
    const crewed = await composeUnitModel({ base: 'soldier', engine: { model: 'catapult', height: 1.3 } }, opts);
    const aboard = await composeUnitModel({ base: 'soldier', engine: { model: 'catapult', height: 1.3 }, crew: 'aboard' }, opts);
    expect(crewed.stats.composed).toBe('engine');
    expect(crewed.geometry.attributes.position.count - aboard.geometry.attributes.position.count).toBeGreaterThan(n * 0.5);
  });

  it('refuses a recipe whose base is missing', async () => {
    await expect(composeUnitModel({ base: 'nobody' }, opts)).rejects.toThrow(/not available/);
  });
});


// ---- scripts/import-models.js ----------------------------------------------------------------

// A tiny glTF: one triangle mesh per material, optional skin joints, as JSON + binary.
const makeGltf = ({ materials = [], nodes = [], skins, images } = {}) => {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const bin = Buffer.from(pos.buffer);
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Root', mesh: 0 }, ...nodes],
    meshes: [{ primitives: materials.map((_, i) => ({ attributes: { POSITION: 0 }, material: i })) }],
    materials,
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.length }],
    buffers: [{ byteLength: bin.length, uri: 'mesh.bin' }]
  };
  if (skins) json.skins = skins;
  if (images) json.images = images;
  return { json, bin };
};
const colour = (hex) => { const n = parseInt(hex.slice(1), 16); const lin = (c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4); return [lin(n >> 16), lin((n >> 8) & 255), lin(n & 255), 1]; };

describe('import-models: containers', () => {
  it('packs a .gltf with an external buffer and texture into one self-contained GLB', async () => {
    const { json, bin } = makeGltf({ materials: [{ name: 'A' }], images: [{ uri: 'Textures/colormap.png' }] });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const files = { 'mesh.bin': bin, 'Textures/colormap.png': png };
    const packed = await packGltf({ json }, async (uri) => files[uri]);
    const glb = writeGlb(packed.json, packed.bin);
    const back = readGlb(glb);
    expect(back.json.buffers).toEqual([{ byteLength: back.bin.length }]);
    expect(back.json.images[0].uri).toBeUndefined();
    const view = back.json.bufferViews[back.json.images[0].bufferView];
    expect(Buffer.compare(back.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength), png)).toBe(0);
    expect(Buffer.compare(back.bin.subarray(0, bin.length), bin)).toBe(0);
    expect(glb.readUInt32LE(8)).toBe(glb.length);
  });
});

describe('import-models: matching', () => {
  const person = (rel) => ({ ...describeModel(rel, makeGltf({ skins: [{ joints: [1] }], nodes: [{ name: 'LeftArm' }] }).json), humanoid: true, skinned: true });
  const machine = (rel) => describeModel(rel, makeGltf().json);
  const horse = (rel) => ({ ...describeModel(rel, makeGltf().json), quadruped: true, skinned: true });

  it('scores period keywords, file name first', () => {
    expect(scoreModel(person('packs/ancient/Hoplite.glb'), SLOTS['classical-infantry'].want)).toBeGreaterThan(scoreModel(person('packs/ancient/Knight.glb'), SLOTS['classical-infantry'].want));
    expect(scoreModel(person('packs/misc/Chef.glb'), SLOTS['modern-infantry'].want)).toBe(0);
  });

  it('gives every era its own period model and reports what is missing — never a stand-in', () => {
    const models = [
      person('q/Egyptian_Spearman.glb'), person('q/Egyptian_Archer.glb'), machine('k/chariot.glb'), machine('k/siege-ram.glb'),
      person('q/Hoplite.glb'), person('q/Greek_Archer.glb'), machine('k/siege-ballista.glb'),
      person('q/Knight.glb'), person('q/Crossbowman.glb'), machine('k/siege-trebuchet.glb'),
      person('q/Musketeer.glb'), person('q/Rifleman.glb'), person('q/Hussar.glb'), machine('k/cannon.glb'),
      person('q/Soldier.glb'), person('q/Sniper.glb'), machine('m/Tank.glb'), machine('m/Howitzer.glb'), machine('m/APC.glb'),
      horse('q/Horse.glb')
    ];
    const { plan, missing } = planRoster(models);
    expect(missing).toEqual([]);
    expect(plan['classical-infantry'].model.rel).toBe('q/Hoplite.glb');
    expect(plan['kingdoms-infantry'].model.rel).toBe('q/Knight.glb');
    expect(plan['gunpowder-infantry'].model.rel).toBe('q/Musketeer.glb');
    expect(plan['modern-cavalry'].model.rel).toBe('m/Tank.glb');
    expect(plan['gunpowder-cavalry']).toMatchObject({ kind: 'mounted', rider: { rel: 'q/Hussar.glb' }, mount: { rel: 'q/Horse.glb' } });
    expect(plan['classical-siege']).toMatchObject({ kind: 'engine', model: { rel: 'k/siege-ballista.glb' }, crew: { rel: 'q/Hoplite.glb' } });
    expect(plan['bronze-cavalry'].kind).toBe('chariot');
    // Without the horse and the tank, those slots are missing (not faked).
    const { missing: gaps } = planRoster(models.filter((d) => !/Horse|Tank/.test(d.rel)));
    expect(gaps).toEqual(expect.arrayContaining(['classical-cavalry', 'kingdoms-cavalry', 'gunpowder-cavalry', 'modern-cavalry']));
  });

  it('honours a manifest pin', () => {
    const models = [person('q/Hoplite.glb'), person('q/Spartan_Hero.glb')];
    const { plan } = planRoster(models, { 'classical-infantry': { file: 'q/Spartan_Hero.glb' } });
    expect(plan['classical-infantry'].model.rel).toBe('q/Spartan_Hero.glb');
  });
});

describe('import-models: tagging, scale and facing', () => {
  it('renames the uniform to TeamColor and the skin to Skin', () => {
    const { json } = makeGltf({ materials: [{ name: 'Tunic_Red' }, { name: 'Skin_Light' }, { name: 'Steel', pbrMetallicRoughness: { metallicFactor: 1 } }] });
    const t = tagSurfaces(json, { people: true });
    expect(json.materials.map((m) => m.name)).toEqual(['TeamColor_0', 'Skin_1', 'Steel']);
    expect(json.materials[0].extras.sourceName).toBe('Tunic_Red');
    expect(t.options).toEqual({});
  });

  it('finds skin by colour and gives the biggest plain surface the team colour when nothing is named', () => {
    const { json } = makeGltf({ materials: [{ name: 'mat_a', pbrMetallicRoughness: { baseColorFactor: colour('#e0ac82'), metallicFactor: 0 } }, { name: 'mat_b', pbrMetallicRoughness: { baseColorFactor: colour('#3050a0'), metallicFactor: 0 } }] });
    tagSurfaces(json, { people: true });
    expect(json.materials.map((m) => m.name)).toEqual(['Skin_0', 'TeamColor_1']);
  });

  it('falls back to per-vertex tagging (teamFrom / skinFrom) for a single palette texture', () => {
    const { json } = makeGltf({
      materials: [{ name: 'colormap', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
      nodes: [{ name: 'Hips' }, { name: 'Spine1' }, { name: 'Head' }, { name: 'HeadTop_End' }],
      skins: [{ joints: [1, 2, 3, 4] }]
    });
    expect(tagSurfaces(json, { people: true }).options).toEqual({ teamFrom: 'Spine1', skinFrom: 'Head' });
  });

  it('agrees with the game loader on what skin looks like', () => {
    ['#e0ac82', '#8d5524', '#c68642', '#f1c27d', '#3050a0', '#808080', '#20a040', '#ffffff'].forEach((hex) => {
      const [r, g, b] = colour(hex);
      expect(isSkinLike(r, g, b), hex).toBe(loaderSkinLike(r, g, b));
    });
    expect(isSkinLike(...colour('#e0ac82').slice(0, 3))).toBe(true);
    expect(isSkinLike(...colour('#3050a0').slice(0, 3))).toBe(false);
  });

  it('turns guns barrel-first and long machines lengthwise; people keep the +Z convention', () => {
    // A gun lying along X, its heavy breech at -X (centroid there), so the barrel points +X.
    expect(facingYaw({ min: [-2, 0, -0.5], max: [2, 1, 0.5], centroid: [-0.6, 0.4, 0] }, { barrel: true })).toBeCloseTo(-Math.PI / 2);
    expect(facingYaw({ min: [-2, 0, -0.5], max: [2, 1, 0.5], centroid: [0.6, 0.4, 0] }, { barrel: true })).toBeCloseTo(Math.PI / 2);
    expect(facingYaw({ min: [-0.5, 0, -2], max: [0.5, 1, 2], centroid: [0, 0.4, 0.7] }, { barrel: true })).toBeCloseTo(Math.PI);
    expect(facingYaw({ min: [-0.3, 0, -0.2], max: [0.3, 1.8, 0.2], centroid: [0, 0.9, 0] }, { lengthwise: false })).toBe(0);
    expect(facingYaw({ min: [-2, 0, -0.5], max: [2, 1, 0.5], centroid: [0, 0, 0] }, { pinDegrees: 180 })).toBeCloseTo(Math.PI);
  });

  it('stands the model on the ground, centred, at its real height', () => {
    const { json } = makeGltf({ materials: [{ name: 'A' }] });
    normalise(json, { min: [2, 1, -1], max: [4, 101, 1] }, { meters: 1.8, yaw: -Math.PI / 2 });
    const root = json.nodes[json.scenes[0].nodes[0]];
    expect(root.name).toBe('UnitRoot');
    expect(root.children).toEqual([0]);
    const m = root.matrix;
    const apply = ([x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    const foot = apply([3, 1, 0]); const top = apply([3, 101, 0]); const front = apply([4, 1, 0]);
    expect(foot.map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0, 0]);
    expect(top[1]).toBeCloseTo(1.8);
    expect(front[2]).toBeGreaterThan(0); // +X (the front) now points +Z
  });
});

describe('import-models: the shipped roster', () => {
  it('resolves every one of the 21 slots', () => {
    const res = checkRoster(path.resolve(__dirname, '../../assets/units'));
    expect(res).toHaveLength(Object.keys(SLOTS).length);
    res.forEach((r) => expect(r.missing, r.slot).toEqual([]));
  });
});
