// src/audio/sfx.js
// The interface and world map sound player, and the unit voices (src/audio/ACTIONS.md lists every
// id and when it plays). One small Web Audio graph on the game's shared context (audioContext.js):
//   - ids come from soundRegistry.js (UI_SOUNDS, WORLD_SOUNDS, voiceFilesFor); an id without
//     recordings stays silent, nothing is synthesized;
//   - the Sound switch, the Effects volume and the Interface sounds / Unit voices switches
//     (audioSettings.js) decide what is heard; a page that is away (pageLifecycle.js) hears nothing;
//   - each id has a cooldown, at most MAX_CONCURRENT sounds ring at once, several sounds of one
//     moment play one after another (planSequence), the loudest news first;
//   - files are fetched and decoded on first use, then kept.
// Nothing here is read by the game logic: every call returns at once and never throws. Without
// Web Audio (tests, headless runs, old browsers) every call is a no-op.
import { UI_SOUNDS, WORLD_SOUNDS, uiFilesFor, worldFilesFor, voiceFilesFor, createSoundRng, pickVariant } from './soundRegistry';
import { getAudioSettings } from './audioSettings';
import { isPageAudible } from './pageLifecycle';
import { audioAvailable, getAudioContext, unlockAudio, resumeAudio, registerAudioConsumer } from './audioContext';

export const MASTER = 0.6; // the bus at full Effects volume (a phone speaker stays sane)
export const MAX_CONCURRENT = 6;
export const SEQUENCE_GAP_MS = 420; // between two sounds of one moment
export const MAX_SEQUENCE = 3; // sounds of one moment (the rest is news for the log, not the ear)
export const VOICE_GAIN = 0.7;

/** Is a sound of this category ('ui', 'world', 'voice') wanted with these settings? (pure) */
export const sfxWanted = (category, s) => {
  if (!s?.sound || !(s.effects > 0)) return false;
  return category === 'voice' ? s.voicesOn !== false : s.uiOn !== false;
};

const defOf = (id) => UI_SOUNDS[id] || WORLD_SOUNDS[id] || null;

/**
 * The order and timing of several sounds wanted at one moment (pure): unknown ids and repeats are
 * dropped, the highest priority plays first, at most MAX_SEQUENCE, SEQUENCE_GAP_MS apart. A big
 * fanfare plays alone, a long gap before anything after it.
 * Returns [{ id, delayMs }].
 */
export const planSequence = (ids, { gapMs = SEQUENCE_GAP_MS, max = MAX_SEQUENCE } = {}) => {
  const seen = new Set();
  const list = (ids || []).filter((id) => defOf(id) && !seen.has(id) && seen.add(id));
  list.sort((a, b) => (defOf(b).priority || 0) - (defOf(a).priority || 0));
  if (list.length && defOf(list[0]).big) return [{ id: list[0], delayMs: 0 }];
  return list.slice(0, max).map((id, i) => ({ id, delayMs: i * gapMs }));
};

/**
 * The unit voices' rate limit (pure state, the clock passed in): one bark at a time with at least
 * `gapMs` between two, and per kind a longer wait (a player clicking through the army hears a
 * bark now and then, not on every click).
 */
export const createBarkLimiter = ({ gapMs = 900, perKindMs = { select: 2600, order: 1400, attack: 1600 } } = {}) => {
  let last = -Infinity;
  const lastKind = {};
  return {
    allow(kind, now) {
      if (now - last < gapMs) return false;
      if (now - (lastKind[kind] ?? -Infinity) < (perKindMs[kind] ?? gapMs)) return false;
      last = now; lastKind[kind] = now;
      return true;
    },
    reset() { last = -Infinity; Object.keys(lastKind).forEach((k) => delete lastKind[k]); }
  };
};

// --- the player -----------------------------------------------------------------------------------
let ctx = null; let bus = null;
const buffers = new Map(); // url -> Promise<AudioBuffer|null>
const lastAt = {}; const lastVariant = {};
let active = 0;
let lastWorldAt = -Infinity; // a world sound just started: a sheet opening with it stays quiet
export const SHEET_QUIET_MS = 600;
const rng = createSoundRng();
const barks = createBarkLimiter();
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
const hidden = () => !isPageAudible();
const timers = new Set();

/** Can this environment play at all? (no in tests and headless runs) */
export const sfxAvailable = () => audioAvailable();

const ensure = () => {
  const c = getAudioContext();
  if (!c) return null;
  if (c !== ctx) {
    ctx = c; buffers.clear();
    bus = ctx.createGain(); bus.connect(ctx.destination);
    registerAudioConsumer('sfx', () => ({ ringing: active, decoded: buffers.size }));
  }
  if (ctx.state !== 'running') resumeAudio('sound');
  bus.gain.value = MASTER * getAudioSettings().effects;
  return ctx;
};

const load = (url) => {
  if (!buffers.has(url)) {
    buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)).catch(() => null));
  }
  return buffers.get(url);
};

const start = (url, level) => {
  load(url).then((buf) => {
    if (!buf || !ctx || active >= MAX_CONCURRENT) return;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = Math.max(0, Math.min(1.5, level));
    src.connect(g); g.connect(bus);
    active += 1;
    src.onended = () => { active = Math.max(0, active - 1); try { g.disconnect(); } catch { /* gone */ } };
    src.start();
  }).catch(() => {});
};

/** Call from the first user gesture so the browser lets the context run. */
export const unlockSfx = () => { if (sfxAvailable()) { unlockAudio(); ensure(); } };

/**
 * Play an interface or world sound now. Returns true when a sound was started (false: unknown id,
 * no recording, switched off, cooling down, too many ringing, or no Web Audio here).
 */
export const playSound = (id, { gain = 1 } = {}) => {
  try {
    const def = defOf(id);
    if (!def || !sfxAvailable() || hidden()) return false;
    const category = UI_SOUNDS[id] ? 'ui' : 'world';
    if (!sfxWanted(category, getAudioSettings())) return false;
    const t = now();
    if (t - (lastAt[id] ?? -Infinity) < (def.cooldownMs || 0)) return false;
    if ((id === 'ui-open' || id === 'ui-close') && t - lastWorldAt < SHEET_QUIET_MS) return false;
    const files = category === 'ui' ? uiFilesFor(id) : worldFilesFor(id);
    if (!files.length) return false; // no recording: silent
    if (active >= MAX_CONCURRENT && !def.big) return false;
    if (!ensure()) return false;
    lastAt[id] = t;
    if (category === 'world') lastWorldAt = t;
    const i = pickVariant(files, rng, lastVariant[id]); lastVariant[id] = i;
    start(files[i], def.gain * gain);
    return true;
  } catch { return false; }
};

/** Several sounds of one moment (a turn's news, an action and its result), one after another. */
export const playSounds = (ids) => {
  if (!sfxAvailable() || !ids?.length) return;
  planSequence(ids).forEach(({ id, delayMs }) => {
    if (!delayMs) { playSound(id); return; }
    const h = setTimeout(() => { timers.delete(h); playSound(id); }, delayMs);
    timers.add(h);
  });
};

/**
 * A unit bark: `classId` (infantry, ranged, cavalry, siege, worker...) and `kind` ('select',
 * 'order', 'attack'). Rate-limited (createBarkLimiter). Returns true when one started.
 */
export const playVoice = (classId, kind) => {
  try {
    if (!sfxAvailable() || hidden() || !sfxWanted('voice', getAudioSettings())) return false;
    const files = voiceFilesFor(classId, kind);
    if (!files.length) return false;
    if (!barks.allow(kind, now())) return false;
    if (!ensure()) return false;
    const key = `${classId}/${kind}`;
    const i = pickVariant(files, rng, lastVariant[key]); lastVariant[key] = i;
    start(files[i], VOICE_GAIN);
    return true;
  } catch { return false; }
};

/** Tests: forget cooldowns and the bark limiter. */
export const resetSfxForTest = () => {
  Object.keys(lastAt).forEach((k) => delete lastAt[k]);
  barks.reset();
  timers.forEach((h) => clearTimeout(h)); timers.clear();
};
