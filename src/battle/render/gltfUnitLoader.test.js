// The GLB → instanced-soldier bake: skinned rigs map onto the shader's limbs with the right hinges,
// named static parts and plain single meshes still get legs and arms, horses trot in diagonal
// pairs, palette textures become vertex colour, and a real glTF file parses end to end.
import { describe, it, expect } from 'vitest';
import {
  Bone, Skeleton, SkinnedMesh, Mesh, Group, BoxGeometry, MeshStandardMaterial, Uint16BufferAttribute,
  Float32BufferAttribute, DataTexture, RGBAFormat, BufferGeometry
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { extractUnitGeometry, limbFromName, sideOf, parseUnitModel } from './gltfUnitLoader';
import { LIMB, PART, RIG_ATTRIBUTES } from './soldierFactory';

// three's FileLoader reports progress with the browser's ProgressEvent, which Node lacks.
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    constructor(type, init = {}) { super(type); Object.assign(this, { lengthComputable: false, loaded: 0, total: 0, ...init }); }
  };
}

const mat = (name, color = '#888888') => Object.assign(new MeshStandardMaterial({ color }), { name });
const at = (geo, x, y, z) => geo.translate(x, y, z);
const skinTo = (geo, boneIndex) => {
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? boneIndex : 0)), 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  return geo;
};

// A 2-unit-tall Mixamo-named humanoid: legs, torso, arms, a tunic and a head, three materials.
const buildHumanoid = () => {
  const bone = (name, x, y, z, parent) => { const b = new Bone(); b.name = name; b.position.set(x, y, z); parent?.add(b); return b; };
  const hips = bone('mixamorig:Hips', 0, 0.95, 0);
  const lUp = bone('mixamorig:LeftUpLeg', 0.15, -0.05, 0, hips); const lLow = bone('mixamorig:LeftLeg', 0, -0.45, 0, lUp);
  const rUp = bone('mixamorig:RightUpLeg', -0.15, -0.05, 0, hips); bone('mixamorig:RightLeg', 0, -0.45, 0, rUp);
  const spine = bone('mixamorig:Spine', 0, 0.3, 0, hips);
  const lArm = bone('mixamorig:LeftArm', 0.3, 0.35, 0, spine); const rArm = bone('mixamorig:RightArm', -0.3, 0.35, 0, spine);
  const head = bone('mixamorig:Head', 0, 0.5, 0, spine);
  const bones = [hips, lUp, lLow, rUp, rUp.children[0], spine, lArm, rArm, head];
  const idx = (b) => bones.indexOf(b);
  const body = mergeGeometries([
    skinTo(at(new BoxGeometry(0.2, 0.9, 0.2), 0.15, 0.45, 0), idx(lLow)),
    skinTo(at(new BoxGeometry(0.2, 0.9, 0.2), -0.15, 0.45, 0), idx(rUp)),
    skinTo(at(new BoxGeometry(0.5, 0.7, 0.3), 0, 1.25, 0), idx(spine)),
    skinTo(at(new BoxGeometry(0.15, 0.6, 0.15), 0.35, 1.3, 0), idx(lArm)),
    skinTo(at(new BoxGeometry(0.15, 0.6, 0.15), -0.35, 1.3, 0), idx(rArm))
  ]);
  const tunic = skinTo(at(new BoxGeometry(0.45, 0.5, 0.05), 0, 1.2, 0.17), idx(spine));
  const face = skinTo(at(new BoxGeometry(0.3, 0.4, 0.3), 0, 1.8, 0), idx(head));
  const root = new Group();
  root.add(hips);
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  [[body, 'Leather', '#6b4a2e'], [tunic, 'Tunic', '#ffffff'], [face, 'Skin', '#e0ac82']].forEach(([g, name, c]) => {
    const m = new SkinnedMesh(g, mat(name, c));
    root.add(m);
    m.bind(skeleton);
  });
  return root;
};

const vertsOf = (geo, limb) => {
  const out = [];
  const l = geo.attributes.aLimb;
  for (let i = 0; i < l.count; i++) if (l.getX(i) === limb) out.push(i);
  return out;
};

describe('bone and node names → rig limbs', () => {
  it('reads the common rig conventions', () => {
    expect(limbFromName('mixamorig:LeftUpLeg')).toBe(LIMB.LEG_L);
    expect(limbFromName('RightFoot')).toBe(LIMB.LEG_R);
    expect(limbFromName('thigh.L')).toBe(LIMB.LEG_L);
    expect(limbFromName('upper_arm.R')).toBe(LIMB.ARM_R);
    expect(limbFromName('Bip01 L Forearm')).toBe(LIMB.ARM_L);
    expect(limbFromName('mixamorig:LeftHandIndex1')).toBe(LIMB.ARM_L);
    expect(limbFromName('Arm_R')).toBe(LIMB.ARM_R);
    expect(limbFromName('Turret')).toBe(LIMB.TURRET);
    ['mixamorig:Hips', 'Spine1', 'Head', 'Neck', 'Root'].forEach((n) => expect(limbFromName(n), n).toBeNull());
    expect(sideOf('LeftShoulder')).toBe('L');
    expect(sideOf('shoulder.r')).toBe('R');
  });

  it('pairs a mount’s legs diagonally and leaves the rider’s legs still', () => {
    const q = { quadruped: true };
    expect(limbFromName('FrontLeg.L', q)).toBe(LIMB.HORSE_FRONT);
    expect(limbFromName('BackLeg.R', q)).toBe(LIMB.HORSE_FRONT);
    expect(limbFromName('FrontLeg.R', q)).toBe(LIMB.HORSE_BACK);
    expect(limbFromName('Hind_Leg_L', q)).toBe(LIMB.HORSE_BACK);
    expect(limbFromName('mixamorig:LeftUpLeg', q)).toBeNull();
  });
});

describe('extractUnitGeometry', () => {
  it('bakes a skinned humanoid into one normalised, rigged, instancing-ready geometry', () => {
    const { geometry: geo, stats } = extractUnitGeometry(buildHumanoid(), { height: 1 });
    Object.keys(RIG_ATTRIBUTES).concat(['position', 'normal']).forEach((a) => expect(geo.attributes[a], a).toBeDefined());
    expect(geo.index).toBeNull();
    expect(stats.skinned).toBe(3);
    expect(stats.triangles).toBe(7 * 12);
    // Feet on the ground, one unit tall, centred.
    expect(geo.boundingBox.min.y).toBeCloseTo(0, 5);
    expect(geo.boundingBox.max.y).toBeCloseTo(1, 5);
    expect(Math.abs(geo.boundingBox.min.x + geo.boundingBox.max.x)).toBeLessThan(1e-5);
    // Every limb found, from the bones (the shin follows its thigh's chain).
    [LIMB.LEG_L, LIMB.LEG_R, LIMB.ARM_L, LIMB.ARM_R].forEach((l) => expect(vertsOf(geo, l).length, `limb ${l}`).toBe(36));
    // Hinges: legs at the hip joint (0.9 of 2 → 0.45), arms at the shoulder (1.6 → 0.8).
    const piv = geo.attributes.aPivot;
    vertsOf(geo, LIMB.LEG_L).forEach((i) => expect(piv.getX(i)).toBeCloseTo(0.45, 4));
    vertsOf(geo, LIMB.ARM_R).forEach((i) => expect(piv.getX(i)).toBeCloseTo(0.8, 4));
    // Surfaces tagged by material name.
    const team = geo.attributes.aTeam.array; const part = geo.attributes.aPart.array;
    expect(team.filter((t) => t === 1).length).toBe(36);
    expect([...part].filter((p) => p === PART.SKIN).length).toBe(36);
    expect(stats.warnings).toEqual([]);
  });

  it('turns a model that faces −Z around', () => {
    const root = buildHumanoid();
    const plain = extractUnitGeometry(root).geometry;
    const turned = extractUnitGeometry(buildHumanoid(), { rotateY: Math.PI }).geometry;
    // The tunic sits on the chest: +Z normally, −Z once turned.
    const tunicZ = (g) => { let z = 0; let n = 0; for (let i = 0; i < g.attributes.aTeam.count; i++) if (g.attributes.aTeam.getX(i) === 1) { z += g.attributes.position.getZ(i); n += 1; } return z / n; };
    expect(tunicZ(plain)).toBeGreaterThan(0.05);
    expect(tunicZ(turned)).toBeLessThan(-0.05);
  });

  it('rigs an unskinned model from its node names, hinged at each part’s origin', () => {
    const root = new Group();
    const add = (name, geo, x, y) => { const m = new Mesh(geo, mat(name === 'Body' ? 'Team' : 'Cloth')); m.name = name; m.position.set(x, y, 0); root.add(m); };
    add('Leg_L', at(new BoxGeometry(0.2, 0.8, 0.2), 0, -0.4, 0), 0.15, 0.8);
    add('Leg_R', at(new BoxGeometry(0.2, 0.8, 0.2), 0, -0.4, 0), -0.15, 0.8);
    add('Body', new BoxGeometry(0.5, 0.8, 0.3), 0, 1.2);
    add('Arm_L', at(new BoxGeometry(0.15, 0.6, 0.15), 0, -0.3, 0), 0.35, 1.55);
    add('Arm_R', at(new BoxGeometry(0.15, 0.6, 0.15), 0, -0.3, 0), -0.35, 1.55);
    const { geometry: geo, stats } = extractUnitGeometry(root, { height: 1.6 });
    expect(stats.namedLimbs).toBe(true);
    const piv = geo.attributes.aPivot;
    vertsOf(geo, LIMB.LEG_R).forEach((i) => expect(piv.getX(i)).toBeCloseTo(0.8, 4));
    vertsOf(geo, LIMB.ARM_L).forEach((i) => expect(piv.getX(i)).toBeCloseTo(1.55, 4));
    expect(vertsOf(geo, LIMB.BODY).length).toBe(36);
  });

  it('splits a single static figure with no names by height and side', () => {
    const geo0 = mergeGeometries([
      at(new BoxGeometry(0.2, 0.9, 0.2), 0.15, 0.45, 0), at(new BoxGeometry(0.2, 0.9, 0.2), -0.15, 0.45, 0),
      at(new BoxGeometry(0.5, 0.7, 0.3), 0, 1.25, 0), at(new BoxGeometry(0.15, 0.6, 0.15), 0.4, 1.3, 0), at(new BoxGeometry(0.15, 0.6, 0.15), -0.4, 1.3, 0),
      at(new BoxGeometry(0.3, 0.4, 0.3), 0, 1.8, 0)
    ]);
    const { geometry: geo, stats } = extractUnitGeometry(new Mesh(geo0, mat('Soldier')), { height: 1 });
    expect(stats.segmented).toBe(true);
    [LIMB.LEG_L, LIMB.LEG_R, LIMB.ARM_L, LIMB.ARM_R].forEach((l) => expect(vertsOf(geo, l).length, `limb ${l}`).toBeGreaterThan(0));
    expect(stats.warnings.some((w) => /team-colour/.test(w))).toBe(true);
  });

  it('gives each leg of a diagonal pair its own hip', () => {
    const bone = (name, x, y, z, parent) => { const b = new Bone(); b.name = name; b.position.set(x, y, z); parent?.add(b); return b; };
    const body = bone('Body', 0, 1, 0);
    const legs = [['FrontLeg.L', 0.2, 0.5], ['FrontLeg.R', -0.2, 0.5], ['BackLeg.L', 0.2, -0.5], ['BackLeg.R', -0.2, -0.5]].map(([n, x, z]) => bone(n, x, 0, z, body));
    const bones = [body, ...legs];
    const geo0 = mergeGeometries([
      skinTo(at(new BoxGeometry(0.5, 0.4, 1.4), 0, 1.1, 0), 0),
      ...legs.map((b, i) => skinTo(at(new BoxGeometry(0.1, 1, 0.1), b.position.x, 0.5, b.position.z), i + 1))
    ]);
    const root = new Group(); root.add(body); root.updateMatrixWorld(true);
    const m = new SkinnedMesh(geo0, mat('Horse')); root.add(m); m.bind(new Skeleton(bones));
    const { geometry: geo } = extractUnitGeometry(root, { quadruped: true, height: 1.3 });
    const front = vertsOf(geo, LIMB.HORSE_FRONT);
    expect(front.length).toBe(72); // front-left + back-right
    const zs = new Set(front.map((i) => Math.round(geo.attributes.aPivot.getY(i) * 100)));
    expect(zs.size).toBe(2);
  });

  it('bakes a palette texture into vertex colour, one flat colour per triangle', () => {
    const tex = new DataTexture(new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), 2, 1, RGBAFormat);
    tex.flipY = false;
    const geo0 = new BufferGeometry();
    geo0.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1], 3));
    geo0.setAttribute('uv', new Float32BufferAttribute([0.1, 0.5, 0.2, 0.5, 0.1, 0.5, 0.8, 0.5, 0.9, 0.5, 0.8, 0.5], 2));
    const m = Object.assign(new MeshStandardMaterial({ map: tex }), { name: 'Palette' });
    const { geometry: geo } = extractUnitGeometry(new Mesh(geo0, m), { segment: false });
    const c = geo.attributes.color;
    expect(c.getX(0)).toBeCloseTo(1, 3); expect(c.getZ(0)).toBeCloseTo(0, 3);
    expect(c.getX(3)).toBeCloseTo(0, 3); expect(c.getZ(3)).toBeCloseTo(1, 3);
  });
});

// A minimal glTF 2.0 file: one triangle, material "Tabard", buffer embedded as a data URI.
const tinyGltf = () => {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const b64 = Buffer.from(pos.buffer).toString('base64');
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Soldier' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ name: 'Tabard', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0] }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${b64}` }]
  });
};

describe('parseUnitModel', () => {
  it('loads a real glTF through GLTFLoader and bakes it', async () => {
    const { geometry, stats } = await parseUnitModel(tinyGltf(), { height: 1, segment: false });
    expect(stats.triangles).toBe(1);
    expect(geometry.boundingBox.max.y).toBeCloseTo(1, 5);
    expect(geometry.attributes.aTeam.getX(0)).toBe(1);
  });
});
