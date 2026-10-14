// src/battle/render/clipPlayer.js
// Which clip each figure of a clip unit plays (I219, plans/art/clip-animation-pipeline.md 4 and 7).
// Drawing only: it reads the render view (strength, routed, striking, the drawing-only ticks and the
// worker's `work` code) and never touches the sim. The renderer keeps FIGURE_STATE floats per
// figure and writes two per-instance vec4s from them for the USE_CLIPS shader:
//   aAnim     = (clip, start time, rate, phase)        start in the renderer's clock (RIG_TIME)
//   aAnimPrev = (clip, start time, rate, switched at)  the clip it is leaving, for the cross-fade
import { WORK_JOB, workJobOf, workNodeOf } from '../sim/economy';

export const FIGURE_STATE = 8; // clip, start, rate, prevClip, prevStart, prevRate, switchedAt, busyUntil
const S_CLIP = 0; const S_START = 1; const S_RATE = 2; const S_PCLIP = 3; const S_PSTART = 4; const S_PRATE = 5; const S_SWITCH = 6; const S_BUSY = 7;

// Each motion and the clips that can play it, best first (the art's names, section 7.2).
const ROLES = {
  idle: ['Idle', 'Aim'], idleAlt: ['IdleAlt', 'Idle', 'Aim'],
  walk: ['Walk', 'Move'], run: ['Run', 'Walk', 'Move'], retreat: ['Retreat-run', 'Run', 'Walk', 'Move'],
  attack: ['Attack', 'Draw-aim-release', 'Aim-fire-reload', 'Fire', 'Melee-fallback'],
  attack2: ['Attack2', 'Attack', 'Draw-aim-release', 'Aim-fire-reload', 'Fire', 'Melee-fallback'],
  hit: ['Hit'], death: ['Death', 'Destroyed'], deathAlt: ['DeathAlt', 'Death', 'Destroyed'], cheer: ['Cheer'],
  carry: ['Carry', 'Walk'], chop: ['Chop', 'Build'], mine: ['Mine', 'Build'], harvest: ['Harvest', 'Build'],
  build: ['Build', 'Repair'], repair: ['Repair', 'Build'], deposit: ['Deposit']
};
// The event a strike's sim tick lines up with, per clip.
const STRIKE_EVENT = ['contact', 'release', 'fire'];
// Gait strides at rate 1 (section 4): walk 1.6 m/s, run 2.6 m/s; a tile is about 1.9 m (a 1.8 m man
// is drawn ART_UNIT_WORLD = 0.95 tiles tall).
export const TILE_M = 1.8 / 0.95;
export const WALK_MPS = 1.6;
export const RUN_MPS = 2.6;
const NODE_ROLE = { tree: 'chop', stone: 'mine', gold: 'mine', herd: 'harvest', cattle: 'harvest', fish: 'harvest', farm: 'harvest' };

/** A unit's clips by motion: { role: clip index or -1 }, with each clip's duration, loop and strike frame. */
export const clipSetOf = (bake) => {
  const roles = {};
  Object.entries(ROLES).forEach(([role, names]) => {
    const name = names.find((n) => bake.byName[n] !== undefined);
    roles[role] = name === undefined ? -1 : bake.byName[name];
  });
  // Fallbacks (hit, deposit and death stay -1: nothing plays): an unknown idle is the first clip,
  // gaits fall back to walking, work and cheering to standing, a worker strikes with its chop.
  const or = (role, other) => { if (roles[role] < 0) roles[role] = roles[other]; };
  if (roles.idle < 0) roles.idle = 0;
  or('idleAlt', 'idle'); or('walk', 'idle'); or('run', 'walk'); or('retreat', 'run'); or('carry', 'walk'); or('cheer', 'idle');
  ['chop', 'mine', 'harvest', 'build', 'repair'].forEach((r) => or(r, 'idle'));
  or('attack', 'chop'); or('attack2', 'attack');
  const dur = bake.clips.map((c) => c.duration || (c.frames - 1) / 20);
  const loop = bake.clips.map((c) => !!c.loop);
  const strike = bake.clips.map((c) => { const e = STRIKE_EVENT.find((k) => Number.isFinite(c.events?.[k])); return e ? c.events[e] / 20 : dur[bake.clips.indexOf(c)] * 0.5; });
  return { roles, dur, loop, strike, count: bake.clips.length };
};

export const newFigureState = (n) => { const s = new Float32Array(n * FIGURE_STATE); for (let i = 0; i < n; i++) { s[i * FIGURE_STATE + S_CLIP] = -1; s[i * FIGURE_STATE + S_PCLIP] = -1; s[i * FIGURE_STATE + S_SWITCH] = -1; } return s; };

/**
 * Switch figure `i` to `clip` (start, rate) at `now`. The same looping clip keeps its phase (a new
 * rate is re-anchored so the frame on screen does not jump). `fade` false snaps (one-shots that
 * start and end on a shared pose, section 7.2).
 */
export const playClip = (st, i, clip, start, rate, now, { fade = true, keepLoop = true } = {}) => {
  const o = i * FIGURE_STATE;
  if (st[o + S_CLIP] === clip && keepLoop) {
    if (Math.abs(st[o + S_RATE] - rate) > 1e-3) { st[o + S_START] = now - ((now - st[o + S_START]) * st[o + S_RATE]) / rate; st[o + S_RATE] = rate; }
    return;
  }
  if (st[o + S_CLIP] >= 0 && fade) { st[o + S_PCLIP] = st[o + S_CLIP]; st[o + S_PSTART] = st[o + S_START]; st[o + S_PRATE] = st[o + S_RATE]; st[o + S_SWITCH] = now; } else st[o + S_SWITCH] = -1;
  st[o + S_CLIP] = clip; st[o + S_START] = start; st[o + S_RATE] = rate;
};
export const busyUntil = (st, i) => st[i * FIGURE_STATE + S_BUSY];
export const setBusy = (st, i, t) => { st[i * FIGURE_STATE + S_BUSY] = t; };
export const currentClip = (st, i) => st[i * FIGURE_STATE + S_CLIP];

/** Write figure `i`'s state into the instance arrays at slot k. `phase` (s) staggers loops. */
export const writeAnim = (st, i, anim, prev, k, phase) => {
  const o = i * FIGURE_STATE; const a = k * 4;
  anim[a] = Math.max(0, st[o + S_CLIP]); anim[a + 1] = st[o + S_START]; anim[a + 2] = st[o + S_RATE] || 1; anim[a + 3] = phase;
  prev[a] = Math.max(0, st[o + S_PCLIP]); prev[a + 1] = st[o + S_PSTART]; prev[a + 2] = st[o + S_PRATE] || 1; prev[a + 3] = st[o + S_SWITCH];
};

/**
 * The motion a squad's figures loop when nothing one-shot is playing, as { role, rate }.
 * `sq`: { moving, routed, fighting, won, worker, work, speed (tiles per render second), simRate }.
 */
export const baseMotion = (set, sq) => {
  const gait = (role) => {
    const mps = sq.speed * TILE_M;
    const run = role === 'retreat' || mps > (WALK_MPS + RUN_MPS) / 2;
    const r = role === 'carry' ? 'carry' : role === 'retreat' ? 'retreat' : run ? 'run' : 'walk';
    const stride = r === 'run' || r === 'retreat' ? RUN_MPS : WALK_MPS;
    return { role: r, rate: Math.max(0.5, Math.min(2.2, mps / stride)) };
  };
  if (sq.routed) return gait('retreat');
  const job = sq.worker ? workJobOf(sq.work) : WORK_JOB.none;
  if (sq.moving) return gait(job === WORK_JOB.hauling ? 'carry' : 'walk');
  const work = Math.max(0.5, Math.min(3, sq.simRate));
  if (sq.worker) {
    if (job === WORK_JOB.gathering) return { role: NODE_ROLE[workNodeOf(sq.work)] || 'harvest', rate: work };
    if (job === WORK_JOB.build) return { role: 'build', rate: work };
    if (job === WORK_JOB.repair) return { role: 'repair', rate: work };
  }
  if (sq.won) return { role: 'cheer', rate: 1 };
  return { role: 'idle', rate: 1 };
};

/**
 * When a strike's clip should start so its event frame (contact, release, fire) lands on the squad's
 * NEXT strike, predicted one attack period after the last: { start, rate }. The clip is sped up to
 * fit the period when it is longer.
 */
export const strikeTiming = (set, clip, lastStrikeAt, periodS) => {
  const rate = Math.max(1, Math.min(2.5, set.dur[clip] / Math.max(0.2, periodS * 0.95)));
  return { start: lastStrikeAt + periodS - set.strike[clip] / rate, rate };
};
