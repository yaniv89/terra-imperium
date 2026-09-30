// Composed units: a recipe dresses one rigged archetype (weapon in hand, seated on a mount, crewing an
// engine) and bakes it into a single instancing-ready geometry; the fetch script's recipes cover the
// whole {age}-{class} matrix and its GLB texture embedding produces a valid self-contained binary.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  Bone, Skeleton, SkinnedMesh, Mesh, Group, BoxGeometry, MeshStandardMaterial, Uint16BufferAttribute, Float32BufferAttribute
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { composeUnitModel, findHand } from './unitComposer';
import { LIMB, RIG_ATTRIBUTES } from './soldierFactory';
import { embedGlbImages, checkMatrix, RECIPES, ARCHETYPES } from '../../../scripts/fetch-models.js';

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

const LIBRARY = { soldier: buildSoldier, spear: buildSpear };
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

  it('refuses a recipe whose base is missing', async () => {
    await expect(composeUnitModel({ base: 'nobody' }, opts)).rejects.toThrow(/not available/);
  });
});

describe('fetch-models recipes', () => {
  const UNITS = path.resolve(__dirname, '../../assets/units');
  const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
  const CLASSES = ['infantry', 'cavalry', 'ranged', 'siege'];

  it('cover the whole {age}-{class} matrix, and every slot resolves from the shipped archetypes', () => {
    AGES.forEach((a) => CLASSES.forEach((c) => expect(RECIPES[`${a}-${c}`], `${a}-${c}`).toBeTruthy()));
    const shipped = new Set(fs.readdirSync(path.join(UNITS, '_src')).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)));
    ARCHETYPES.forEach((a) => expect(shipped.has(a.name), a.name).toBe(true));
    checkMatrix(shipped).forEach((s) => expect(s.missing, s.slot).toEqual([]));
    Object.keys(RECIPES).forEach((slot) => expect(JSON.parse(fs.readFileSync(path.join(UNITS, `${slot}.json`), 'utf8'))).toEqual(RECIPES[slot]));
  });

  it('reports a slot whose archetype is missing', () => {
    const bad = checkMatrix(new Set());
    expect(bad.every((s) => !s.ok && s.missing.length > 0)).toBe(true);
  });

  it('embeds external textures into a valid GLB binary chunk', async () => {
    const json = { asset: { version: '2.0' }, images: [{ uri: 'Textures/colormap.png' }], buffers: [{ byteLength: 4 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }] };
    const pad = (b, f) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), f)]) : b);
    const jsonBuf = pad(Buffer.from(JSON.stringify(json)), 0x20);
    const bin = Buffer.from([1, 2, 3, 4]);
    const chunk = (b, t) => { const h = Buffer.alloc(8); h.writeUInt32LE(b.length, 0); h.write(t, 4, 'latin1'); return Buffer.concat([h, b]); };
    const head = Buffer.alloc(12); head.write('glTF', 0, 'latin1'); head.writeUInt32LE(2, 4);
    const glb = Buffer.concat([head, chunk(jsonBuf, 'JSON'), chunk(bin, 'BIN\0')]); glb.writeUInt32LE(glb.length, 8);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9, 9]);
    const asked = [];
    const out = await embedGlbImages(glb, async (uri) => { asked.push(uri); return png; });
    expect(asked).toEqual(['Textures/colormap.png']);
    expect(out.toString('latin1', 0, 4)).toBe('glTF');
    expect(out.readUInt32LE(8)).toBe(out.length);
    const jl = out.readUInt32LE(12);
    const parsed = JSON.parse(out.subarray(20, 20 + jl).toString('utf8'));
    const img = parsed.images[0];
    expect(img.uri).toBeUndefined();
    expect(img.mimeType).toBe('image/png');
    const binLen = out.readUInt32LE(20 + jl);
    expect(parsed.buffers[0].byteLength).toBe(binLen);
    const binData = out.subarray(28 + jl, 28 + jl + binLen);
    expect(Array.from(binData.subarray(0, 4))).toEqual([1, 2, 3, 4]);
    const view = parsed.bufferViews[img.bufferView];
    expect(Buffer.compare(binData.subarray(view.byteOffset, view.byteOffset + view.byteLength), png)).toBe(0);
    // Already self-contained: untouched.
    expect(await embedGlbImages(out, async () => { throw new Error('no fetch'); })).toBe(out);
  });
});
