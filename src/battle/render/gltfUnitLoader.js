// src/battle/render/gltfUnitLoader.js
// GLB → one soldier BufferGeometry the battlefield can instance (a GLTF instancing pipeline).
//
// The battlefield draws every soldier of an (age, class) with ONE InstancedMesh and animates them
// in the vertex shader (soldierFactory.js), so an artist's model can't stay a node tree of meshes,
// materials and a skeleton — each of those would be its own draw call and a CPU-side skinning or
// mixer update per soldier. Instead this bakes the model, once, at load time:
//   1. pose it (the file's rest pose, or the first frame of an idle clip — arms down, not a T-pose)
//   2. bake every mesh's vertices (skinning + morphs + node transforms) into one world-space soup,
//      non-indexed, so each triangle has its own flat normal — the low-poly look
//   3. turn materials into per-vertex colour (material colour × vertex colour × the texel under
//      the triangle, so palette-textured packs like Kenney's still come out right)
//   4. map the skeleton onto the shader's rigid rig: each vertex follows its dominant bone's limb
//      (legs, arms, horse legs, turret) and pivots at that limb's top joint
//   5. tag team-colour, skin and emblem surfaces by material/node name
//   6. normalise: feet on y = 0, centred, facing +Z, scaled to a target height
// The result carries exactly soldierFactory's attributes (position, normal, color, aLimb, aPivot,
// aTeam, aPart, aUv) and is registered with registerSoldierGeometry().
import { Vector3, Vector4, Matrix4, Color, Box3, BufferGeometry, Float32BufferAttribute, AnimationMixer } from 'three';
import { LIMB, PART } from './soldierFactory';

export const DEFAULT_TRIANGLE_BUDGET = 3000; // per soldier; ×hundreds of instances on a phone GPU

const DEFAULT_TAGS = {
  team: /team|tabard|tunic|surcoat|banner|flag|faction|cloak|cape|livery|plume/i,
  skin: /(^|[^a-z])(skin|flesh|face)/i,
  emblem: /emblem|shield_?face|heraldry|crest|insignia|decal/i
};

// ---- naming → rig limbs ------------------------------------------------------------------------

const tokens = (name = '') => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
export const sideOf = (name) => {
  const t = tokens(name);
  if (t.some((w) => w === 'left' || w === 'l' || w === 'lf' || w === 'lft')) return 'L';
  if (t.some((w) => w === 'right' || w === 'r' || w === 'rt' || w === 'rgt')) return 'R';
  return null;
};
const LEG = /^(up|upper|lower)?(leg|thigh|shin|calf|knee|foot|feet|toe|toes|ankle|hoof)s?$/;
const ARM = /^(up|upper|lower|fore)?(arm|shoulder|clavicle|elbow|hand|wrist|finger|thumb|index|middle|ring|pinky|palm)s?\d*$/;
const TURRET = /^(turret|barrel|cannon|gun|mantlet|weapon_?mount)\d*$/;
// One bone/node name → a rig limb, or null when the name doesn't say. `quadruped` switches legs to
// the horse bones (front-left moves with back-right, the procedural trot).
export const limbFromName = (name, { quadruped = false } = {}) => {
  const t = tokens(name);
  const joined = t.join('_');
  if (t.some((w) => TURRET.test(w))) return LIMB.TURRET;
  const side = sideOf(name);
  const isLeg = t.some((w) => LEG.test(w)) || /up_?leg/.test(joined);
  const isArm = !isLeg && (t.some((w) => ARM.test(w)) || /fore_?arm|upper_?arm/.test(joined));
  if (quadruped && isLeg) {
    const front = t.some((w) => w === 'front' || w === 'fore' || w === 'f');
    const hind = t.some((w) => w === 'hind' || w === 'back' || w === 'rear' || w === 'b');
    if (!front && !hind) return null; // the rider's own legs — they sit still in the saddle
    return (front === (side !== 'R')) ? LIMB.HORSE_FRONT : LIMB.HORSE_BACK;
  }
  if (isLeg && side) return side === 'L' ? LIMB.LEG_L : LIMB.LEG_R;
  if (isArm && side) return side === 'L' ? LIMB.ARM_L : LIMB.ARM_R;
  return null;
};

// Walk up from a bone/node to the first ancestor whose name names a limb.
const classify = (obj, opts, stopAt) => {
  for (let o = obj; o && o !== stopAt; o = o.parent) {
    const limb = limbFromName(o.name, opts);
    if (limb !== null) return { limb, node: o };
  }
  return { limb: LIMB.BODY, node: null };
};
// The top joint of a limb chain (e.g. LeftUpLeg for every thigh/shin/foot bone): the highest
// ancestor still classified as the same limb.
const chainRoot = (node, limb, opts, stopAt) => {
  let top = node;
  for (let o = node?.parent; o && o !== stopAt; o = o.parent) {
    if (limbFromName(o.name, opts) === limb) top = o; else break;
  }
  return top;
};

// ---- texture sampling (palette atlases → vertex colour) ---------------------------------------

const texelReaders = new WeakMap();
const readerFor = (tex) => {
  if (!tex?.image) return null;
  if (texelReaders.has(tex)) return texelReaders.get(tex);
  let reader = null;
  try {
    const img = tex.image;
    const w = img.width; const h = img.height;
    let data = img.data; // DataTexture
    if (!data && typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      data = g.getImageData(0, 0, w, h).data;
    }
    if (data && w && h) {
      const flip = tex.flipY !== false && !img.data;
      reader = (u, v, out) => {
        const x = Math.min(w - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * w)));
        const vv = ((v % 1) + 1) % 1;
        const y = Math.min(h - 1, Math.max(0, Math.floor((flip ? 1 - vv : vv) * h)));
        const o = (y * w + x) * 4;
        return out.setRGB(data[o] / 255, data[o + 1] / 255, data[o + 2] / 255, tex.colorSpace || 'srgb');
      };
    }
  } catch { reader = null; }
  texelReaders.set(tex, reader);
  return reader;
};

// ---- the bake ----------------------------------------------------------------------------------

// Put the model into the pose it should be instanced in.
const applyPose = (root, animations, restClip) => {
  root.traverse((o) => { if (o.isSkinnedMesh && o.skeleton && restClip === 'bind') o.skeleton.pose(); });
  if (restClip && restClip !== 'bind' && animations?.length) {
    const clip = animations.find((a) => (restClip instanceof RegExp ? restClip.test(a.name) : a.name === restClip));
    if (clip) {
      const mixer = new AnimationMixer(root);
      mixer.clipAction(clip).play();
      mixer.update(0);
    }
  }
  root.updateMatrixWorld(true);
};

/**
 * Bake a loaded glTF scene into one instancing-ready soldier geometry.
 * @param {Object3D} root            gltf.scene (or any Object3D)
 * @param {object}  [opts]
 * @param {AnimationClip[]} [opts.animations]  gltf.animations, for `restClip`
 * @param {RegExp|string|'bind'} [opts.restClip=/idle/i]  pose to bake: a clip's first frame, or 'bind'
 * @param {number}  [opts.height=1]  target height (world units; a person in the procedural set ≈ 1)
 * @param {number}  [opts.rotateY=0]  extra yaw so the model faces +Z
 * @param {boolean} [opts.quadruped=false]  a mount: front/hind legs drive the horse bones
 * @param {'auto'|false} [opts.segment='auto']  static (unskinned, unnamed) humanoids: split limbs by position
 * @param {object}  [opts.tags]  RegExps over material/node names: { team, skin, emblem }
 * @param {number}  [opts.triangleBudget=3000]
 * @returns {{ geometry: BufferGeometry, stats: object }}
 */
export const extractUnitGeometry = (root, opts = {}) => {
  const {
    animations = [], restClip = /idle/i, height = 1, rotateY = 0, quadruped = false, segment = 'auto',
    triangleBudget = DEFAULT_TRIANGLE_BUDGET
  } = opts;
  const tags = { ...DEFAULT_TAGS, ...(opts.tags || {}) };
  const limbOpts = { quadruped };
  applyPose(root, animations, restClip);

  const pos = []; const col = []; const limb = []; const team = []; const partId = []; const uvs = [];
  const hinge = []; // per vertex: the Object3D (a limb chain's top joint) it pivots about, or null
  const stats = { meshes: 0, skinned: 0, triangles: 0, limbs: {}, namedLimbs: false, warnings: [] };
  const v = new Vector3(); const skinIdx = new Vector4(); const skinW = new Vector4();
  const c = new Color(); const texel = new Color(); const uvA = [0, 0]; const cornerUv = [[0, 0], [0, 0], [0, 0]];

  root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position || mesh.visible === false) return;
    stats.meshes += 1;
    const geo = mesh.geometry;
    const skinned = !!(mesh.isSkinnedMesh && mesh.skeleton && geo.attributes.skinIndex && geo.attributes.skinWeight);
    if (skinned) stats.skinned += 1;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const index = geo.index; const posAttr = geo.attributes.position;
    const colorAttr = geo.attributes.color; const uvAttr = geo.attributes.uv;
    const count = index ? index.count : posAttr.count;
    const groups = geo.groups?.length ? geo.groups : [{ start: 0, count, materialIndex: 0 }];
    // Unskinned meshes: a node name like "Arm_L" rigs the whole mesh.
    const withHinge = (cl) => (cl.node ? { ...cl, hinge: chainRoot(cl.node, cl.limb, limbOpts, root.parent) } : { ...cl, hinge: null });
    const nodeLimb = skinned ? null : withHinge(classify(mesh, limbOpts, root.parent));
    const boneLimb = skinned ? mesh.skeleton.bones.map((b) => withHinge(classify(b, limbOpts, root.parent))) : null;
    if (nodeLimb?.node || boneLimb?.some((bl) => bl.node)) stats.namedLimbs = true;

    groups.forEach((grp) => {
      const mat = materials[grp.materialIndex ?? 0] || materials[0];
      const label = `${mat?.name || ''} ${mesh.name || ''} ${mesh.parent?.name || ''}`;
      const isEmblem = tags.emblem.test(label);
      const isTeam = isEmblem || tags.team.test(label);
      const isSkin = !isTeam && tags.skin.test(label);
      const base = mat?.color ? mat.color : new Color(1, 1, 1);
      const reader = uvAttr && mat?.map ? readerFor(mat.map) : null;
      const end = Math.min(count, grp.start + grp.count);
      for (let k = grp.start; k + 2 < end; k += 3) {
        // Flat colour per triangle: sample the texture once at the triangle's centre.
        for (let j = 0; j < 3; j++) {
          const vi = index ? index.getX(k + j) : k + j;
          cornerUv[j][0] = uvAttr ? uvAttr.getX(vi) : 0; cornerUv[j][1] = uvAttr ? uvAttr.getY(vi) : 0;
        }
        uvA[0] = (cornerUv[0][0] + cornerUv[1][0] + cornerUv[2][0]) / 3;
        uvA[1] = (cornerUv[0][1] + cornerUv[1][1] + cornerUv[2][1]) / 3;
        const tex = reader ? reader(uvA[0], uvA[1], texel) : null;
        for (let j = 0; j < 3; j++) {
          const vi = index ? index.getX(k + j) : k + j;
          mesh.getVertexPosition(vi, v); // skinning + morph targets, in the mesh's local space
          v.applyMatrix4(mesh.matrixWorld);
          pos.push(v.x, v.y, v.z);
          c.copy(base);
          if (colorAttr) c.multiply(texel.setRGB(colorAttr.getX(vi), colorAttr.getY(vi), colorAttr.getZ(vi)));
          if (tex) c.multiply(tex);
          col.push(c.r, c.g, c.b);
          let rig = nodeLimb;
          if (skinned) {
            skinIdx.fromBufferAttribute(geo.attributes.skinIndex, vi); skinW.fromBufferAttribute(geo.attributes.skinWeight, vi);
            let best = 0;
            for (let q = 1; q < 4; q++) if (skinW.getComponent(q) > skinW.getComponent(best)) best = q;
            rig = boneLimb[skinIdx.getComponent(best)];
          }
          limb.push(rig ? rig.limb : LIMB.BODY);
          hinge.push(rig?.hinge || null);
          team.push(isTeam ? 1 : 0);
          partId.push(isEmblem ? PART.EMBLEM : isSkin ? PART.SKIN : PART.PLAIN);
          uvs.push(isEmblem ? cornerUv[j][0] : 0, isEmblem ? cornerUv[j][1] : 0);
        }
      }
    });
  });

  const n = pos.length / 3;
  if (!n) throw new Error('extractUnitGeometry: the model has no triangles');

  // Normalise: yaw to face +Z, feet on the ground, centred, scaled to `height`.
  const norm = new Matrix4().makeRotationY(rotateY);
  const bb = new Box3();
  for (let i = 0; i < n; i++) bb.expandByPoint(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(norm));
  const s = height / Math.max(1e-6, bb.max.y - bb.min.y);
  norm.premultiply(new Matrix4().makeTranslation(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)).premultiply(new Matrix4().makeScale(s, s, s));
  for (let i = 0; i < n; i++) {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(norm);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }

  // Hinges: each limb chain's top joint, in normalised model space (the rig rotates about X, so
  // only y, z matter). Per chain, not per limb: a horse's diagonal leg pair shares a limb id but
  // each leg swings from its own hip.
  const hingeYZ = new Map();
  hinge.forEach((node) => { if (node && !hingeYZ.has(node)) { node.getWorldPosition(v).applyMatrix4(norm); hingeYZ.set(node, [v.y, v.z]); } });
  const pivots = new Map(); // limb → [y, z], for the positional fallback

  // No names to go by (a static single-mesh figure): split a humanoid by height and side.
  if (!stats.namedLimbs && segment === 'auto' && !quadruped) {
    const hip = height * 0.47; const shoulder = height * 0.8; const armX = height * 0.13;
    for (let t = 0; t < n; t += 3) {
      const cx = (pos[t * 3] + pos[t * 3 + 3] + pos[t * 3 + 6]) / 3;
      const cy = (pos[t * 3 + 1] + pos[t * 3 + 4] + pos[t * 3 + 7]) / 3;
      let l = LIMB.BODY;
      if (cy < hip * 0.95) l = cx >= 0 ? LIMB.LEG_L : LIMB.LEG_R; // facing +Z, the figure's left is +X
      else if (cy < shoulder && Math.abs(cx) > armX) l = cx >= 0 ? LIMB.ARM_L : LIMB.ARM_R;
      limb[t] = l; limb[t + 1] = l; limb[t + 2] = l;
      hinge[t] = null; hinge[t + 1] = null; hinge[t + 2] = null;
    }
    [LIMB.LEG_L, LIMB.LEG_R].forEach((l) => pivots.set(l, [hip, 0]));
    [LIMB.ARM_L, LIMB.ARM_R].forEach((l) => pivots.set(l, [shoulder, 0]));
    stats.segmented = true;
  }

  const piv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = (hinge[i] && hingeYZ.get(hinge[i])) || pivots.get(limb[i]) || [0, 0];
    piv[i * 2] = p[0]; piv[i * 2 + 1] = p[1];
    stats.limbs[limb[i]] = (stats.limbs[limb[i]] || 0) + 1;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setAttribute('aLimb', new Float32BufferAttribute(limb, 1));
  geometry.setAttribute('aPivot', new Float32BufferAttribute(piv, 2));
  geometry.setAttribute('aTeam', new Float32BufferAttribute(team, 1));
  geometry.setAttribute('aPart', new Float32BufferAttribute(partId, 1));
  geometry.setAttribute('aUv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals(); // non-indexed → one flat normal per face
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  stats.triangles = n / 3;
  if (stats.triangles > triangleBudget) stats.warnings.push(`${stats.triangles} triangles is over the ${triangleBudget} budget — decimate it for phones`);
  if (!team.some((t) => t === 1)) stats.warnings.push('no team-colour surface found (name a material "Team…" or "Tabard…")');
  return { geometry, stats };
};

// ---- loading -----------------------------------------------------------------------------------

let loaderPromise = null;
// GLTFLoader (+ Meshopt decoding, + Draco when a decoder path is given) is only downloaded the
// first time a battle actually has a model to load — the procedural army needs none of it.
const getLoader = async ({ dracoDecoderPath } = {}) => {
  if (!loaderPromise) {
    loaderPromise = (async () => {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js')
      ]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      if (dracoDecoderPath) {
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
        loader.setDRACOLoader(new DRACOLoader().setDecoderPath(dracoDecoderPath));
      }
      return loader;
    })();
  }
  return loaderPromise;
};

// Free the glTF's own GPU-side objects once baked (we keep only our geometry).
const disposeScene = (scene) => scene.traverse((o) => {
  if (!o.isMesh) return;
  o.geometry?.dispose();
  (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m?.map?.dispose(); m?.dispose(); });
});

/** Load a .glb/.gltf by URL and bake it (see extractUnitGeometry for `opts`). */
export const loadUnitModel = async (url, opts = {}) => {
  const loader = await getLoader(opts);
  const gltf = await loader.loadAsync(url);
  const out = extractUnitGeometry(gltf.scene, { animations: gltf.animations, ...opts });
  disposeScene(gltf.scene);
  return out;
};

/** Same, from an ArrayBuffer (GLB) or a glTF JSON string already in memory. */
export const parseUnitModel = async (data, opts = {}) => {
  const loader = await getLoader(opts);
  const gltf = await loader.parseAsync(data, opts.path || '');
  const out = extractUnitGeometry(gltf.scene, { animations: gltf.animations, ...opts });
  disposeScene(gltf.scene);
  return out;
};
