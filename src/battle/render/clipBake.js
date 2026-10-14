// src/battle/render/clipBake.js
// Authored clips for battle soldiers (I219, plans/art/clip-animation-pipeline.md option 2: a rigid
// bone texture). gltfUnitLoader.js bakes a model once, in its rest pose, into one flat-shaded soup;
// every vertex follows ONE driver (its dominant bone, or its own node when unskinned). Here each
// clip is sampled at 20 fps with three's AnimationMixer, and for every driver and frame we store
//   M = norm x W(frame) x W(rest)^-1 x norm^-1
// (W the driver's world matrix, norm the loader's normalising matrix): the move from the baked rest
// pose to that frame, in the baked model's own space. The polearm fit, team and skin tags and the
// rest bake are untouched; the vertex shader (soldierFactory.js, USE_CLIPS) only applies M.
// Layout: one RGBA32F texture per unit, 3 texels a driver (the three rows of the 3x4 matrix), one row
// per frame, every clip's frames one after the other. Driver 0 is the identity (static parts).
import { Matrix4, AnimationMixer, LoopOnce } from 'three';

export const CLIP_FPS = 20;
export const MAX_BONES = 128;   // the art contract (plans/art/clip-animation-pipeline.md section 7)
export const MAX_CLIPS = 24;    // the shader's clip table (uniform vec4 array)
// Clips that play once and hold their last frame; every other clip loops (closed loops: the first
// frame equals the last). A unit's JSON may say otherwise per clip ("loop": true or false).
const ONCE = /^(death|deathalt|hit|destroyed|wreck|deploy|deposit)$/i;
// Event names the art writes (1-based frames, src/assets/units/<uid>.json "clips").
export const CLIP_EVENTS = ['contact', 'release', 'cut', 'pour', 'settle'];

/**
 * The per-clip metadata of a unit's options file: { fps, <Clip>: { loop, contact, release, ... } }.
 * Returns { loop: bool, events: { contact: frame0, ... } } for a clip (frames 0-based here).
 */
export const clipMeta = (name, meta = {}) => {
  const m = meta?.[name] || {};
  const events = {};
  CLIP_EVENTS.forEach((e) => { if (Number.isFinite(m[e])) events[e] = Math.max(0, m[e] - 1); });
  return { loop: typeof m.loop === 'boolean' ? m.loop : !ONCE.test(name), events };
};

/**
 * Sample every clip of a posed glTF scene into a bone texture.
 * @param {Object3D} root the glTF scene, already posed at rest and baked (updateMatrixWorld done)
 * @param {AnimationClip[]} animations
 * @param {Object3D[]} drivers the objects vertices follow; vertex aBone = index + 1 (0 = static)
 * @param {Matrix4} norm the loader's normalising matrix (rest space to baked model space)
 * @param {object} [meta] the JSON "clips" block (loop flags, event frames)
 * @returns {{ data: Float32Array, width: number, height: number, bones: number,
 *   clips: { name, first, frames, loop, duration, events }[], byName: Record<string, number> } | null}
 */
export const bakeClips = (root, animations, drivers, norm, meta = {}) => {
  if (!animations?.length || !drivers.length) return null;
  const fps = Number.isFinite(meta?.fps) && meta.fps > 0 ? meta.fps : CLIP_FPS;
  const bones = drivers.length + 1;
  if (bones > MAX_BONES) throw new Error(`clip bake: ${bones} bones is over the ${MAX_BONES} limit`);
  const usable = animations.slice(0, MAX_CLIPS);
  // The rest pose: every node's local transform (restored before each clip, so a bone a clip does
  // not key stays at rest) and every driver's world matrix, inverted.
  const nodes = []; root.traverse((o) => nodes.push(o));
  const rest = nodes.map((o) => [o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
  const restore = () => nodes.forEach((o, i) => { o.position.copy(rest[i][0]); o.quaternion.copy(rest[i][1]); o.scale.copy(rest[i][2]); });
  const restInv = drivers.map((d) => d.matrixWorld.clone().invert());
  const normInv = norm.clone().invert();
  const clips = []; let rows = 0;
  usable.forEach((clip) => {
    const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
    clips.push({ name: clip.name, first: rows, frames, duration: (frames - 1) / fps, ...clipMeta(clip.name, meta) });
    rows += frames;
  });
  const width = bones * 3;
  const data = new Float32Array(width * rows * 4);
  const m = new Matrix4();
  const writeRows = (row, b, e) => {
    const o = (row * width + b * 3) * 4;
    data[o] = e[0]; data[o + 1] = e[4]; data[o + 2] = e[8]; data[o + 3] = e[12];
    data[o + 4] = e[1]; data[o + 5] = e[5]; data[o + 6] = e[9]; data[o + 7] = e[13];
    data[o + 8] = e[2]; data[o + 9] = e[6]; data[o + 10] = e[10]; data[o + 11] = e[14];
  };
  const identity = new Matrix4().elements;
  for (let r = 0; r < rows; r++) writeRows(r, 0, identity);
  const mixer = new AnimationMixer(root);
  usable.forEach((clip, ci) => {
    const c = clips[ci];
    restore();
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1); action.clampWhenFinished = true;
    action.reset().play();
    for (let f = 0; f < c.frames; f++) {
      mixer.setTime(Math.min(clip.duration, f / fps));
      root.updateMatrixWorld(true);
      drivers.forEach((d, k) => {
        m.multiplyMatrices(norm, d.matrixWorld).multiply(restInv[k]).multiply(normInv);
        writeRows(c.first + f, k + 1, m.elements);
      });
    }
    action.stop();
    mixer.uncacheAction(clip);
  });
  mixer.uncacheRoot(root);
  restore();
  root.updateMatrixWorld(true);
  return { data, width, height: rows, bones, fps, clips, byName: Object.fromEntries(clips.map((c, i) => [c.name, i])), norm: norm.elements.slice(), boneNames: ['', ...drivers.map((d) => d.name)] };
};

/** The bone matrix (as 3 rows of 4) of `bone` at frame `f` of a bake: for tests and debugging. */
export const boneRows = (bake, bone, row) => {
  const o = (row * bake.width + bone * 3) * 4;
  return [0, 1, 2].map((r) => Array.from(bake.data.subarray(o + r * 4, o + r * 4 + 4)));
};
