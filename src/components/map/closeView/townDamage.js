// src/components/map/closeView/townDamage.js
// A city's damage drawn on its assembled town model (plans/MASTER-PLAN.md phase B), the same in
// the close view of the map and in the tactical battle. The town file is one merged mesh, so a
// ruined house cannot be hidden as an object: its building materials (Town, Team; not Ground) get
// a small shader patch that drops every fragment standing inside a ruined structure's ground
// rectangle (the manifest's footprint, in the town's own model space) and darkens the ones inside
// a damaged structure's. A rubble mound (ruinMounds) stands where a ruin is.
// ART (applyTownDamage; battle/art/cityArt.js): when the age's damaged-house kit exists
// (src/assets/battle/city/<age>-<theme>-houses-damage.glb, the theme along styleChain, then
// <age>-houses-damage.glb) a damaged or ruined house is cut out and its `<house>-damaged` or
// `<house>-ruined` piece stands in its place; other ruins take the age's ruin library
// (src/assets/battle/city/ruins-<age>.glb: rubble-s, -m, -l by size). Without the files the
// darkened house and the grey mound stay (the placeholders).
import { Matrix4, Vector4, Mesh, MeshLambertMaterial, BoxGeometry, DodecahedronGeometry, Group } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ART } from '../../../battle/art/artFiles';
import { loadKit, kitObject } from '../../../battle/art/kitLoader';
import { houseTypes, pickHouse, pickRubble } from '../../../battle/art/cityArt';
import { instanceTownAsset } from './townAssets';

export const MAX_RECTS = 64;
const RUBBLE_COLOR = '#8b8073';
const DAMAGED_SHADE = 0.55;
const PAD = 0.04; // model units round a footprint

const rect = (s) => new Vector4(s.x - s.w / 2 - PAD, s.z - s.d / 2 - PAD, s.x + s.w / 2 + PAD, s.z + s.d / 2 + PAD);
const fill = (list, rects) => { for (let i = 0; i < MAX_RECTS; i++) list[i].copy(rects[i] || new Vector4(0, 0, 0, 0)); };

const patch = (mat) => {
  const u = {
    uTownInv: { value: new Matrix4() },
    uRuin: { value: Array.from({ length: MAX_RECTS }, () => new Vector4()) }, uRuinN: { value: 0 },
    uDmg: { value: Array.from({ length: MAX_RECTS }, () => new Vector4()) }, uDmgN: { value: 0 }
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uTownInv;\nvarying vec3 vTownPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTownPos = (uTownInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vTownPos;\nuniform vec4 uRuin[${MAX_RECTS}];\nuniform int uRuinN;\nuniform vec4 uDmg[${MAX_RECTS}];\nuniform int uDmgN;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
for (int i = 0; i < ${MAX_RECTS}; i++) { if (i >= uRuinN) break; vec4 r = uRuin[i];
  if (vTownPos.y > 0.02 && vTownPos.x > r.x && vTownPos.x < r.z && vTownPos.z > r.y && vTownPos.z < r.w) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
for (int i = 0; i < ${MAX_RECTS}; i++) { if (i >= uDmgN) break; vec4 r = uDmg[i];
  if (vTownPos.x > r.x && vTownPos.x < r.z && vTownPos.z > r.y && vTownPos.z < r.w) { diffuseColor.rgb *= ${DAMAGED_SHADE}; break; } }`);
  };
  mat.customProgramCacheKey = () => 'townDamage';
  mat.userData.townDamage = u;
  return mat;
};

/**
 * Give a town instance (instanceTownAsset) its own damage-aware building materials, once. Returns
 * the materials made (for the caller to dispose).
 */
export const enableTownDamage = (root) => {
  if (root.userData.townDamage) return [];
  const made = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!m || m.name === 'Ground') return m;
      if (!made.has(m)) made.set(m, patch(m.clone()));
      return made.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  root.userData.townDamage = [...made.values()];
  return root.userData.townDamage;
};

/** Set which structures are ruined and damaged: lists of manifest-space { x, z, w, d }. */
export const setTownDamage = (root, ruined = [], damaged = []) => {
  const r = ruined.slice(0, MAX_RECTS).map(rect); const d = damaged.slice(0, MAX_RECTS).map(rect);
  (root.userData.townDamage || []).forEach((m) => {
    const u = m.userData.townDamage;
    fill(u.uRuin.value, r); u.uRuinN.value = r.length;
    fill(u.uDmg.value, d); u.uDmgN.value = d.length;
  });
};

/** Keep the shader's town space in step with the instance (call after it moves). */
export const syncTownDamage = (root) => {
  const mats = root.userData.townDamage;
  if (!mats?.length) return;
  root.updateMatrixWorld();
  const inv = mats[0].userData.townDamage.uTownInv.value.copy(root.matrixWorld).invert();
  mats.forEach((m) => m.userData.townDamage.uTownInv.value.copy(inv));
};

let mound = null;
export const moundGeometry = () => {
  if (!mound) {
    mound = mergeGeometries([
      new DodecahedronGeometry(0.5, 0).scale(1, 0.32, 1).translate(0, 0.08, 0),
      new DodecahedronGeometry(0.3, 0).scale(1, 0.5, 1).translate(0.25, 0.1, 0.15),
      new BoxGeometry(0.5, 0.07, 0.1).rotateY(0.6).translate(-0.15, 0.2, -0.1)
    ].map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g; }));
    mound.computeVertexNormals();
  }
  return mound;
};
const moundMaterial = new MeshLambertMaterial({ color: RUBBLE_COLOR });
/** A rubble mound sized to a structure's footprint, in the same model space. */
export const ruinMound = (s) => {
  const m = new Mesh(moundGeometry(), moundMaterial);
  m.position.set(s.x, 0, s.z);
  m.scale.set(Math.max(0.3, s.w), Math.max(0.5, Math.min(s.w, s.d)), Math.max(0.3, s.d));
  m.name = 'ruin';
  return m;
};

// A kit object as a town-file-like root (LOD0..LOD2 meshes), so showLod and instanceTownAsset work.
const templates = new Map(); // kit object -> root
const templateOf = (obj) => {
  if (!templates.has(obj)) {
    const root = new Group(); root.name = obj.name;
    obj.lods.forEach((b, l) => {
      const m = new Mesh(b.geometry, b.materials.length === 1 ? b.materials[0] : b.materials);
      m.name = `LOD${l}`; m.frustumCulled = false;
      root.add(m);
    });
    templates.set(obj, root);
  }
  return templates.get(obj);
};

/**
 * A town instance's damage (manifestStates: [{ kind, state, x, z, w, d }]): the shader cut-outs,
 * darkening and mounds at once, then the art pieces when the age's damage files exist. Resolves to
 * true when art was placed (and calls `onReady`), false when the placeholders stay.
 * `palace`: { name: 'palace' | 'palace-small', style, node } when the town shows a capital's palace
 * (node: its instance under root): a damaged or ruined palace state swaps it for the piece of
 * palace-damage-<age>[-<theme>].glb (same origin as the shared file's palace); without the file
 * the palace stands as it was.
 */
export const applyTownDamage = (root, allStates, { ageId, style = null, teamColor = '#9ca3af', tint = null, onReady = () => {}, art = ART, load = loadKit, palace = null } = {}) => {
  const states = allStates.filter((s) => s.kind !== 'palace');
  const palaceState = allStates.find((s) => s.kind === 'palace' && s.state !== 'intact');
  const palaceDone = palace?.node && palaceState ? applyPalaceDamage(root, palace, palaceState.state, { ageId, teamColor, tint, art, load, onReady }) : null;
  const ruined = states.filter((s) => s.state === 'ruined'); const damaged = states.filter((s) => s.state === 'damaged');
  enableTownDamage(root);
  setTownDamage(root, ruined, damaged);
  const mounds = ruined.map((s) => { const m = ruinMound(s); root.add(m); return m; });
  const houseRef = damaged.length || ruined.length ? art.housesDamage(ageId, style) : null;
  const ruinRef = ruined.length ? art.ruins(ageId) : null;
  if (!houseRef && !ruinRef) return palaceDone || Promise.resolve(false);
  const get = (ref) => (ref ? load(ref.url).catch((e) => { console.warn(`[art] ${e.message}: keeping the damage placeholders`); return null; }) : null);
  return Promise.all([get(houseRef), get(ruinRef)]).then(([houses, ruins]) => {
    if (!houses && !ruins) return false;
    const types = houseTypes(houses);
    const cut = [...ruined]; const dark = [];
    let placed = 0;
    const put = (obj, s, yaw, sx, sy, sz) => {
      const inst = instanceTownAsset(templateOf(obj), teamColor, tint);
      inst.position.set(s.x, 0, s.z); inst.rotation.y = yaw; inst.scale.set(sx, sy, sz);
      inst.name = 'damage-art';
      root.add(inst);
      placed += 1;
    };
    damaged.forEach((s) => {
      const p = houses && s.kind === 'house' ? pickHouse(houses, s.w, s.d, 'damaged', types) : null;
      if (p) { put(p.obj, s, p.yaw, p.lx, 1, p.lz); cut.push(s); } else dark.push(s);
    });
    ruined.forEach((s, i) => {
      const p = houses && s.kind === 'house' ? pickHouse(houses, s.w, s.d, 'ruined', types) : null;
      const r = p ? null : pickRubble(ruins, Math.max(s.w, s.d));
      if (!p && !r) return;
      root.remove(mounds[i]);
      if (p) put(p.obj, s, p.yaw, p.lx, 1, p.lz); else put(r.obj, s, 0, r.scale, r.scale, r.scale);
    });
    setTownDamage(root, cut, dark);
    if (placed) onReady();
    return placed > 0;
  }).then((placed) => (palaceDone ? palaceDone.then((p) => p || placed) : placed));
};

/** The capital's palace in its damaged or ruined state (applyTownDamage's `palace`). */
const applyPalaceDamage = (root, { name, style, node }, state, { ageId, teamColor, tint, art, load, onReady }) => {
  const ref = art.palaceDamage(ageId, style);
  if (!ref) return Promise.resolve(false);
  return load(ref.url).then((kit) => {
    const obj = kitObject(kit, `${name}-${state}`);
    if (!obj || node.parent !== root) return false;
    const inst = instanceTownAsset(templateOf(obj), teamColor, tint);
    inst.position.copy(node.position); inst.rotation.copy(node.rotation); inst.scale.copy(node.scale);
    inst.name = 'damage-art';
    node.visible = false;
    root.add(inst);
    onReady();
    return true;
  }).catch((e) => { console.warn(`[art] ${e.message}: the palace keeps its intact model`); return false; });
};
