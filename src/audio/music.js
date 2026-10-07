// src/audio/music.js
// The map's music and ambience, played through the game's one Web Audio context (audioContext.js),
// never as media elements: iOS keeps a playing <audio> / new Audio() going in the background and
// on the lock screen, while it pauses a Web Audio context there itself (see audioContext.js).
// Tracks are the files in src/assets/audio/music/ (soundRegistry.js musicTracks, in file name
// order), played one after another with a CROSSFADE_S crossfade, the list looping; the map
// ambience beds (src/assets/audio/music/ambience/<id>/) loop under them.
// Each track is decoded into an AudioBuffer when it is needed: the current one, and the next one
// PRELOAD_S before the current one ends; a track is released when its last note has played.
// Phones decode at PHONE_DECODE_RATE (a 5 minute track is about 46 MB instead of 115 MB at 48 kHz).
// The crossfade is scheduled on the audio clock (gain ramps), so it needs no timer to be exact.
// Music plays in map mode only: a battle screen calls suppressMusic('battle') while it is open; the
// music fades out and after PARK_AFTER_MS is stopped and released, its place remembered. The page
// being away mutes it at once (and audioContext.js suspends the whole context). The Music volume
// and switch and the Sound switch come from audioSettings.js. Browsers only start audio after a
// user gesture: App calls startMusic() on the first one. With no files all of this does nothing.
import { musicTracks, AMBIENCE_SOUNDS, ambienceFilesFor, createSoundRng } from './soundRegistry';
import { getAudioSettings, subscribeAudioSettings } from './audioSettings';
import { isPageAudible, subscribePageAudio, pageAudioState } from './pageLifecycle';
import { getAudioContext, unlockAudio, registerAudioConsumer, audioLog } from './audioContext';

export const CROSSFADE_S = 4;
export const PRELOAD_S = 40; // decode the next track this long before the current one ends
export const PARK_AFTER_MS = 2500; // suppressed (battle, switch off) this long: stop and release
export const PHONE_DECODE_RATE = 24000;
const TICK_MS = 500;
const SCHEDULE_AHEAD_S = 1.5; // schedule the crossfade this long before it starts (two ticks)

/** Should music be heard now? (pure) */
export const musicWanted = ({ started, sound, volume, suppressed, hidden, trackCount }) =>
  !!started && !!sound && volume > 0 && !suppressed && !hidden && trackCount > 0;
/** The next track in the playlist (pure). */
export const nextTrack = (i, n) => (n > 0 ? (i + 1) % n : -1);
/** The sample rate tracks are decoded at (pure): lower on phones to save memory. */
export const musicDecodeRate = ({ phone, contextRate = 48000 }) => (phone ? Math.min(PHONE_DECODE_RATE, contextRate) : contextRate);
/** Bytes a decoded track takes (pure): float32 per sample per channel. */
export const decodedBytes = (seconds, rate, channels = 2) => Math.round(seconds * rate * channels * 4);

/**
 * The playlist's next move (pure), from the audio clock:
 *   preload   start decoding the next track now
 *   schedule  start the crossfade (the next track is ready and the end is near)
 *   at        when the next track starts (audio clock): CROSSFADE_S before the end, or now if late
 */
export const musicStep = ({ now, startAt, duration, nextReady = false, nextScheduled = false }) => {
  const endAt = startAt + duration;
  const remaining = endAt - now;
  return {
    preload: remaining <= PRELOAD_S,
    schedule: !!nextReady && !nextScheduled && remaining <= CROSSFADE_S + SCHEDULE_AHEAD_S,
    at: Math.max(now, endAt - CROSSFADE_S)
  };
};

let started = false;
const suppressors = new Set();
let bus = null; // music and ambience -> destination
let busCtx = null;
let current = null; // the track heard now: { idx, src, gain, startAt, duration, buffer }
const outgoing = new Set(); // tracks fading out
let nextLoad = null; // { idx, buffer, done }
let parked = { idx: 0, offset: 0 }; // where to pick up after a stop
let starting = false;
let token = 0; // bumped on every stop: late decodes are dropped
let ambience = null; // [{ id, src, gain }] or [] while loading
let tickTimer = null;
let parkTimer = null;
let lastOn = false;
let unsubscribe = null;
let unsubscribePage = null;
const rng = createSoundRng();

const hidden = () => !isPageAudible();
const ctxNow = () => getAudioContext({ create: false });
const wanted = () => {
  const s = getAudioSettings();
  return musicWanted({ started, sound: s.sound && s.musicOn !== false, volume: s.music, suppressed: suppressors.size > 0, hidden: hidden(), trackCount: musicTracks().length });
};

const ensureBus = (c) => {
  if (bus && busCtx === c) return bus;
  bus = c.createGain(); busCtx = c;
  bus.gain.value = 0;
  bus.connect(c.destination);
  return bus;
};

// Fetch and decode one file into an AudioBuffer (at the phone rate on phones), or null.
const decode = async (url) => {
  const c = ctxNow();
  if (!c || typeof fetch === 'undefined') return null;
  try {
    const ab = await (await fetch(url)).arrayBuffer();
    const rate = musicDecodeRate({ phone: pageAudioState().phone, contextRate: c.sampleRate });
    const OAC = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
    if (OAC && rate !== c.sampleRate) {
      try { return await new OAC(2, 1, rate).decodeAudioData(ab.slice(0)); } catch { /* this rate not supported: the context's own */ }
    }
    return await c.decodeAudioData(ab);
  } catch { return null; }
};

// Decode track idx, or the next ones if it fails: { idx, buffer } or null.
const loadTrack = async (idx) => {
  const n = musicTracks().length;
  for (let k = 0, i = idx; k < n; k++, i = nextTrack(i, n)) {
    const buffer = await decode(musicTracks()[i]);
    if (buffer) return { idx: i, buffer };
  }
  return null;
};

const release = (entry) => {
  if (!entry) return;
  try { entry.src.onended = null; entry.src.stop(); } catch { /* not started or already stopped */ }
  try { entry.src.disconnect(); entry.gain.disconnect(); } catch { /* gone */ }
  try { entry.src.buffer = null; } catch { /* some browsers keep it */ }
  entry.buffer = null;
};

// Start a buffer on the bus at `at` (audio clock) from `offset` seconds in, fading in.
const playBuffer = (c, buffer, idx, at, offset = 0) => {
  const src = c.createBufferSource(); src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(1, at + CROSSFADE_S);
  src.connect(gain); gain.connect(ensureBus(c));
  src.start(at, offset);
  const entry = { idx, src, gain, startAt: at - offset, duration: buffer.duration, buffer };
  src.onended = () => {
    outgoing.delete(entry);
    release(entry);
    // It ended with nothing after it (the next track was late): carry on with the next one.
    if (entry === current) { current = null; nextLoad = null; parked = { idx: nextTrack(idx, musicTracks().length), offset: 0 }; refreshMusic(); }
  };
  return entry;
};

const startFrom = (idx, offset) => {
  const c = ctxNow();
  if (!c || starting || current) return;
  starting = true;
  const my = token;
  loadTrack(idx).then((got) => {
    starting = false;
    if (my !== token || !got || current || !wanted()) return;
    const c2 = ctxNow(); if (!c2) return;
    const off = got.idx === idx && offset < got.buffer.duration - CROSSFADE_S ? offset : 0;
    current = playBuffer(c2, got.buffer, got.idx, c2.currentTime + 0.05, off);
    audioLog(`music: track ${got.idx + 1} from ${off.toFixed(0)} s`);
  });
};

// The crossfade: the current track fades out to its end while the next fades in.
const crossfade = (c, at) => {
  const old = current;
  const next = nextLoad;
  nextLoad = null;
  old.gain.gain.setValueAtTime(1, at);
  old.gain.gain.linearRampToValueAtTime(0, at + CROSSFADE_S);
  try { old.src.stop(at + CROSSFADE_S + 0.05); } catch { /* already stopping */ }
  outgoing.add(old);
  current = playBuffer(c, next.buffer, next.idx, at, 0);
  next.buffer = null;
  audioLog(`music: crossfade to track ${current.idx + 1}`);
};

const tick = () => {
  const c = ctxNow();
  if (!c || !current || hidden()) return;
  const step = musicStep({ now: c.currentTime, startAt: current.startAt, duration: current.duration, nextReady: !!nextLoad?.buffer, nextScheduled: false });
  if (step.preload && !nextLoad) {
    const my = token;
    const entry = { idx: nextTrack(current.idx, musicTracks().length), buffer: null, done: false };
    nextLoad = entry;
    loadTrack(entry.idx).then((got) => {
      entry.done = true;
      if (my !== token || nextLoad !== entry) return;
      if (got) { entry.idx = got.idx; entry.buffer = got.buffer; } else nextLoad = null;
    });
  }
  if (step.schedule) crossfade(c, step.at);
};

const ensureTick = () => { if (!tickTimer) tickTimer = setInterval(tick, TICK_MS); };

const ensureAmbience = (c) => {
  if (ambience) return;
  ambience = [];
  const my = token;
  Object.entries(AMBIENCE_SOUNDS).forEach(([id, def]) => {
    const files = ambienceFilesFor(id);
    if (!files.length) return;
    decode(files[Math.floor(rng() * files.length)]).then((buffer) => {
      if (!buffer || my !== token || !ambience) return;
      const src = c.createBufferSource(); src.buffer = buffer; src.loop = true;
      const gain = c.createGain();
      const t = c.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(def.gain, t + CROSSFADE_S);
      src.connect(gain); gain.connect(ensureBus(c));
      src.start(t);
      ambience.push({ id, src, gain, buffer });
    });
  });
};

// Stop everything and release the buffers, remembering where the music was.
const park = () => {
  parkTimer = null;
  token += 1; starting = false;
  const c = ctxNow();
  if (current) {
    const pos = c ? c.currentTime - current.startAt : 0;
    parked = { idx: current.idx, offset: Math.max(0, Math.min(pos, current.duration - CROSSFADE_S)) };
    audioLog(`music: stopped at track ${current.idx + 1}, ${parked.offset.toFixed(0)} s`);
  }
  release(current); current = null;
  outgoing.forEach(release); outgoing.clear();
  (ambience || []).forEach(release); ambience = null;
  nextLoad = null;
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
};

/** Bring the music in line with the settings, the battle and the page. */
export const refreshMusic = () => {
  const c = ctxNow();
  if (!c) return;
  const on = wanted();
  const b = ensureBus(c);
  const t = c.currentTime;
  const level = on ? getAudioSettings().music : 0;
  try {
    b.gain.cancelScheduledValues?.(t);
    if (hidden()) b.gain.setValueAtTime(0, t); // the page went away: silent now (and the context is suspended)
    else b.gain.setTargetAtTime(level, t, on && lastOn ? 0.08 : 0.5);
  } catch { b.gain.value = level; }
  lastOn = on;
  if (on) {
    if (parkTimer) { clearTimeout(parkTimer); parkTimer = null; }
    if (!current) startFrom(parked.idx, parked.offset);
    ensureAmbience(c);
    ensureTick();
  } else if (!hidden() && !parkTimer && (current || ambience || starting)) {
    parkTimer = setTimeout(park, PARK_AFTER_MS);
  }
};

const describe = () => ({
  started,
  wanted: wanted(),
  suppressed: [...suppressors],
  track: current ? `${current.idx + 1}/${musicTracks().length} ${String(musicTracks()[current.idx] || '').split('/').pop()}` : (starting ? 'loading' : 'none'),
  position: current && ctxNow() ? Math.max(0, ctxNow().currentTime - current.startAt).toFixed(0) : '-',
  next: nextLoad ? (nextLoad.buffer ? `track ${nextLoad.idx + 1} ready` : `track ${nextLoad.idx + 1} decoding`) : '-',
  fadingOut: outgoing.size,
  ambience: (ambience || []).map((a) => a.id),
  bus: bus ? Number(bus.gain.value).toFixed(2) : '-',
  decodedMB: Math.round(([current, ...outgoing, nextLoad, ...(ambience || [])].reduce((s, e) => s + (e?.buffer ? decodedBytes(e.buffer.duration, e.buffer.sampleRate, e.buffer.numberOfChannels || 2) : 0), 0)) / 1e6)
});

/** Call on the first user gesture: from then on music may play. */
export const startMusic = () => {
  if (started) return;
  started = true;
  unlockAudio();
  registerAudioConsumer('music', describe);
  if (!unsubscribe) unsubscribe = subscribeAudioSettings(() => refreshMusic());
  if (!unsubscribePage) unsubscribePage = subscribePageAudio(() => refreshMusic());
  refreshMusic();
};

/** Silence the music while `reason` holds (a battle is open). Returns the release function. */
export const suppressMusic = (reason) => {
  suppressors.add(reason);
  refreshMusic();
  return () => { suppressors.delete(reason); refreshMusic(); };
};

export const isMusicSuppressed = () => suppressors.size > 0;

/** Tests and the debug readout: what is playing. */
export const musicDebugState = describe;
/** Tests: run one playlist tick now. */
export const tickMusicForTest = tick;
/** Tests: forget everything. */
export const resetMusicForTest = () => {
  park();
  if (parkTimer) { clearTimeout(parkTimer); parkTimer = null; }
  started = false; suppressors.clear(); bus = null; busCtx = null; parked = { idx: 0, offset: 0 }; lastOn = false;
  unsubscribe?.(); unsubscribe = null; unsubscribePage?.(); unsubscribePage = null;
};
