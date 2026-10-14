// src/battle/render/clipBake.js
// Authored clips for battle soldiers (I219, plans/art/clip-animation-pipeline.md option 2: a rigid
// bone texture; the art contract in sections 7, 7.1 and 7.2). gltfUnitLoader.js bakes a model once,
// in its rest pose (Idle frame 1), into one flat-shaded soup; every vertex follows ONE driver (its
// dominant bone, or its own node when unskinned). Here each clip is sampled at 20 fps with three's
// AnimationMixer, and for every driver and frame we store
//   M = norm x W(frame) x W(ref)^-1 x norm^-1
// (W the driver's world matrix, norm the loader's normalising matrix): the move from the driver's
// reference pose to that frame, in the baked model's own space. The reference is the rest pose,
// except for a bone hidden at rest (a worker's Tool_Axe, a scale-0 bone, section 7.1): it has no
// inverse there, so its vertices are baked from the bind pose (aClipPos) and W(ref) = W(bind).
// The polearm fit is done once, in rest space, before any of this (section 7.2), and rides along.
// Every clip is sampled from the bind pose: a track the file leaves out means the bind value.
// Layout: one RGBA32F texture per unit, 3 texels a driver (the three rows of the 3x4 matrix), one row
// per frame, every clip's frames one after the other. Driver 0 is the identity (static parts).
import { Matrix4, AnimationMixer, LoopOnce } from 'three';

export const CLIP_FPS = 20;
export const MAX_BONES = 128;   // the art contract (plans/art/clip-animation-pipeline.md section 7)
export const MAX_CLIPS = 24;    // the shader's clip table (uniform vec4 array)
// Without an options file entry, these play once and hold their last frame; the rest loop.
const ONCE = /^(death|deathalt|hit|destroyed|wreck|deploy|deposit|attack|attack2|block|melee-fallback|draw-aim-release|aim-fire-reload|fire)$/i;
// Event names the art writes (1-based frames, src/assets/units/<uid>.json "clips").
export const CLIP_EVENTS = ['contact', 'release', 'cut', 'pour', 'settle', 'fire', 'reloaded'];

/**
 * A clip's entry in a unit's options file "clips" block ({ <Clip>: { frames, fps, loop, tool,
 * events: { contact, ... } } }; flat event keys are read too). Frames here are 0-based.
 */
export const clipMeta = (name, meta = {}) => {
  const m = (meta && typeof meta[name] === 'object' && meta[name]) || {};
  const src = { ...m, ...(m.events || {}) };
  const events = {};
  CLIP_EVENTS.forEach((e) => { if (Number.isFinite(src[e])) events[e] = Math.max(0, src[e] - 1); });
  return { loop: typeof m.loop === 'boolean' ? m.loop : !ONCE.test(name), events, frames: Number.isFinite(m.frames) ? m.frames : null, tool: m.tool || null };
};

const capture = (nodes) => nodes.map((o) => [o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
const restoreLocals = (nodes, locals) => nodes.forEach((o, i) => { o.position.copy(locals[i][0]); o.quaternion.copy(locals[i][1]); o.scale.copy(locals[i][2]); });
/** Every node of `root` in traversal order (the order capture / restoreLocals use). */
export const sceneNodes = (root) => { const out = []; root.traverse((o) => out.push(o)); return out; };
/** Put every skinned mesh's skeleton in its bind pose (and keep the rest of the scene), then refresh. */
export const toBindPose = (root) => { root.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.pose(); }); root.updateMatrixWorld(true); };
/** A world matrix that has no usable inverse (a bone hidden by scale 0). */
export const isHidden = (m) => Math.abs(m.determinant()) < 1e-9;

/**
 * Sample every clip of a posed glTF scene into a bone texture.
 * @param {Object3D} root the glTF scene, posed at rest (updateMatrixWorld done)
 * @param {AnimationClip[]} animations
 * @param {Object3D[]} drivers the objects vertices follow; vertex aBone = index + 1 (0 = static)
 * @param {Matrix4} norm the loader's normalising matrix (rest space to baked model space)
 * @param {object} [meta] the JSON "clips" block (loop flags, frames, event frames)
 * @param {object} [ref] { world: Matrix4[] per driver (the reference pose), bind: node locals of the bind pose }
 * @returns {{ data: Float32Array, width: number, height: number, bones: number,
 *   clips: { name, first, frames, loop, duration, events }[], byName: Record<string, number> } | null}
 */
export const bakeClips = (root, animations, drivers, norm, meta = {}, ref = {}) => {
  if (!animations?.length || !drivers.length) return null;
  const fps = CLIP_FPS;
  const bones = drivers.length + 1;
  if (bones > MAX_BONES) throw new Error(`clip bake: ${bones} bones is over the ${MAX_BONES} limit`);
  const usable = animations.slice(0, MAX_CLIPS);
  const nodes = sceneNodes(root);
  const rest = capture(nodes);
  const bind = ref.bind || rest;
  const refInv = drivers.map((d, k) => (ref.world?.[k] || d.matrixWorld).clone().invert());
  const normInv = norm.clone().invert();
  const clips = []; let rows = 0;
  usable.forEach((clip) => {
    const info = clipMeta(clip.name, meta);
    // The GLB's first key (frame 1 at 0.05 s in the art's files, section 7.1; 0 in older files).
    let t0 = Infinity; clip.tracks.forEach((t) => { if (t.times.length) t0 = Math.min(t0, t.times[0]); });
    if (!Number.isFinite(t0)) t0 = 0;
    const frames = Math.max(2, info.frames || Math.round((clip.duration - t0) * fps) + 1);
    clips.push({ name: clip.name, first: rows, frames, duration: (frames - 1) / fps, t0, ...info, frames });
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
    restoreLocals(nodes, bind);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1); action.clampWhenFinished = true;
    action.reset().play();
    for (let f = 0; f < c.frames; f++) {
      mixer.setTime(Math.min(clip.duration, c.t0 + f / fps));
      root.updateMatrixWorld(true);
      drivers.forEach((d, k) => {
        m.multiplyMatrices(norm, d.matrixWorld).multiply(refInv[k]).multiply(normInv);
        writeRows(c.first + f, k + 1, m.elements);
      });
    }
    action.stop();
    mixer.uncacheAction(clip);
  });
  mixer.uncacheRoot(root);
  restoreLocals(nodes, rest);
  root.updateMatrixWorld(true);
  return {
    data, width, height: rows, bones, fps, clips, byName: Object.fromEntries(clips.map((c, i) => [c.name, i])),
    norm: norm.elements.slice(), boneNames: ['', ...drivers.map((d) => d.name)]
  };
};

/** The bone matrix (as 3 rows of 4) of `bone` at texture row `row` of a bake: for tests and debugging. */
export const boneRows = (bake, bone, row) => {
  const o = (row * bake.width + bone * 3) * 4;
  return [0, 1, 2].map((r) => Array.from(bake.data.subarray(o + r * 4, o + r * 4 + 4)));
};
