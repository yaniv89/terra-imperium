// src/audio/music.js
// The music: the map's playlist (with the ambience beds under it) and the RTS battle's playlist,
// played through the game's one Web Audio context (audioContext.js), never as media elements: iOS
// keeps a playing <audio> / new Audio() going in the background and on the lock screen, while it
// pauses a Web Audio context there itself (see audioContext.js).
//   map     the files in src/assets/audio/music/ (soundRegistry.js musicTracks, file name order);
//           the ambience beds (src/assets/audio/music/ambience/<id>/) loop under them.
//   battle  the files in src/assets/audio/music/battle/ (battleMusicTracks), steady and moderate,
//           BATTLE_MUSIC_DB under the map's level so the battle's own sounds stay clear.
// Each playlist plays its tracks one after another with a CROSSFADE_S crossfade, looping. A battle
// screen calls startBattleMusic() while it is open: the map music fades out while the battle
// playlist fades in, and when the battle ends it goes the other way. A playlist that is not heard
// for PARK_AFTER_MS is stopped and released, its place remembered: the map music picks up where it
// was. Each track is decoded into an AudioBuffer when it is needed: the current one, and the next
// one PRELOAD_S before the current one ends. Phones decode at PHONE_DECODE_RATE (a 5 minute track
// is about 58 MB instead of 115 MB at 48 kHz). The crossfade is scheduled on the audio clock (gain
// ramps), so it needs no timer to be exact.
// The page being away mutes the music at once (and audioContext.js suspends the whole context).
// The Music volume and switch and the Sound switch come from audioSettings.js. Browsers only start
// audio after a user gesture: App calls startMusic() on the first one. With no files nothing plays.
import { musicTracks, battleMusicTracks, AMBIENCE_SOUNDS, ambienceFilesFor, createSoundRng } from './soundRegistry';
import { getAudioSettings, subscribeAudioSettings } from './audioSettings';
import { isPageAudible, subscribePageAudio, pageAudioState } from './pageLifecycle';
import { getAudioContext, unlockAudio, registerAudioConsumer, audioLog } from './audioContext';

export const CROSSFADE_S = 4;
export const PRELOAD_S = 40; // decode the next track this long before the current one ends
export const PARK_AFTER_MS = 5000; // a playlist silent this long (after its fade): stop and release
export const PHONE_DECODE_RATE = 24000;
export const BATTLE_MUSIC_DB = -4; // the battle playlist under the map's level
const TICK_MS = 500;
const SCHEDULE_AHEAD_S = 1.5; // schedule the crossfade this long before it starts (two ticks)
const SWITCH_TC = CROSSFADE_S / 4; // map <-> battle: a gain glide that is done in about CROSSFADE_S

/** Should music be heard now? (pure) */
export const musicWanted = ({ started, sound, volume, suppressed, hidden, trackCount }) =>
  !!started && !!sound && volume > 0 && !suppressed && !hidden && trackCount > 0;
/** The next track in the playlist (pure). */
export const nextTrack = (i, n) => (n > 0 ? (i + 1) % n : -1);
export const DESKTOP_DECODE_RATE = 48000; // a 96 kHz output device would double the memory for nothing
/** The sample rate tracks are decoded at (pure): lower on phones to save memory. */
export const musicDecodeRate = ({ phone, contextRate = 48000 }) => Math.min(phone ? PHONE_DECODE_RATE : DESKTOP_DECODE_RATE, contextRate);
/** Bytes a decoded track takes (pure): float32 per sample per channel. */
export const decodedBytes = (seconds, rate, channels = 2) => Math.round(seconds * rate * channels * 4);
export const dbToGain = (db) => 10 ** (db / 20);

/** Which playlist is wanted (pure): 'battle' while a battle screen holds it, else 'map'. */
export const musicMode = ({ battleHolds = 0 }) => (battleHolds > 0 ? 'battle' : 'map');
/** Each playlist's level, 0..1 of the music volume (pure): only the mode's playlist is heard. */
export const playlistLevels = ({ mode, on }) => ({
  map: on && mode === 'map' ? 1 : 0,
  battle: on && mode === 'battle' ? dbToGain(BATTLE_MUSIC_DB) : 0
});

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

// One playlist's state. bus: its own gain into the music bus (the map/battle crossfade).
const makePlaylist = (id, tracks) => ({
  id, tracks,
  bus: null,
  current: null, // the track heard now: { idx, src, gain, startAt, duration, buffer }
  outgoing: new Set(), // tracks fading out
  nextLoad: null, // { idx, buffer, done }
  parked: { idx: 0, offset: 0 }, // where to pick up after a stop
  starting: false,
  token: 0, // bumped on every stop: late decodes are dropped
  parkTimer: null
});
const playlists = { map: makePlaylist('map', musicTracks), battle: makePlaylist('battle', battleMusicTracks) };

let started = false;
const suppressors = new Set();
let battleHolds = 0;
let bus = null; // all music -> destination (the Music volume)
let busCtx = null;
let ambience = null; // [{ id, src, gain, buffer }] (map only) or [] while loading
let ambienceToken = 0;
let tickTimer = null;
let lastOn = false;
let unsubscribe = null;
let unsubscribePage = null;
const rng = createSoundRng();

const hidden = () => !isPageAudible();
const ctxNow = () => getAudioContext({ create: false });
const mode = () => musicMode({ battleHolds });
const wanted = () => {
  const s = getAudioSettings();
  return musicWanted({ started, sound: s.sound && s.musicOn !== false, volume: s.music, suppressed: suppressors.size > 0, hidden: hidden(), trackCount: playlists[mode()].tracks().length });
};

const ensureBus = (c) => {
  if (bus && busCtx === c) return bus;
  bus = c.createGain(); busCtx = c;
  bus.gain.value = 0;
  bus.connect(c.destination);
  playlists.map.bus = null; playlists.battle.bus = null;
  return bus;
};
const plBus = (c, pl) => {
  ensureBus(c);
  if (!pl.bus) { pl.bus = c.createGain(); pl.bus.gain.value = 0; pl.bus.connect(bus); }
  return pl.bus;
};
const glide = (param, value, t, tc) => {
  try { param.cancelScheduledValues?.(t); param.setTargetAtTime(value, t, tc); } catch { param.value = value; }
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

// Decode track idx of a playlist, or the next ones if it fails: { idx, buffer } or null.
const loadTrack = async (pl, idx) => {
  const list = pl.tracks();
  const n = list.length;
  for (let k = 0, i = idx % Math.max(1, n); k < n; k++, i = nextTrack(i, n)) {
    const buffer = await decode(list[i]);
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

// Start a buffer on the playlist's bus at `at` (audio clock) from `offset` seconds in, fading in.
const playBuffer = (c, pl, buffer, idx, at, offset = 0) => {
  const src = c.createBufferSource(); src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(1, at + CROSSFADE_S);
  src.connect(gain); gain.connect(plBus(c, pl));
  src.start(at, offset);
  const entry = { idx, src, gain, startAt: at - offset, duration: buffer.duration, buffer };
  src.onended = () => {
    pl.outgoing.delete(entry);
    release(entry);
    // It ended with nothing after it (the next track was late): carry on with the next one.
    if (entry === pl.current) { pl.current = null; pl.nextLoad = null; pl.parked = { idx: nextTrack(idx, pl.tracks().length), offset: 0 }; refreshMusic(); }
  };
  return entry;
};

const startFrom = (pl) => {
  const c = ctxNow();
  if (!c || pl.starting || pl.current || !pl.tracks().length) return;
  pl.starting = true;
  const my = pl.token;
  const { idx, offset } = pl.parked;
  loadTrack(pl, idx).then((got) => {
    pl.starting = false;
    if (my !== pl.token || !got || pl.current || !wanted() || mode() !== pl.id) return;
    const c2 = ctxNow(); if (!c2) return;
    const off = got.idx === idx && offset < got.buffer.duration - CROSSFADE_S ? offset : 0;
    pl.current = playBuffer(c2, pl, got.buffer, got.idx, c2.currentTime + 0.05, off);
    audioLog(`music: ${pl.id} track ${got.idx + 1} from ${off.toFixed(0)} s`);
  });
};

// The crossfade: the current track fades out to its end while the next fades in.
const crossfade = (c, pl, at) => {
  const old = pl.current;
  const next = pl.nextLoad;
  pl.nextLoad = null;
  old.gain.gain.setValueAtTime(1, at);
  old.gain.gain.linearRampToValueAtTime(0, at + CROSSFADE_S);
  try { old.src.stop(at + CROSSFADE_S + 0.05); } catch { /* already stopping */ }
  pl.outgoing.add(old);
  pl.current = playBuffer(c, pl, next.buffer, next.idx, at, 0);
  next.buffer = null;
  audioLog(`music: ${pl.id} crossfade to track ${pl.current.idx + 1}`);
};

const tickPlaylist = (c, pl) => {
  if (!pl.current) return;
  const step = musicStep({ now: c.currentTime, startAt: pl.current.startAt, duration: pl.current.duration, nextReady: !!pl.nextLoad?.buffer });
  if (step.preload && !pl.nextLoad) {
    const my = pl.token;
    const entry = { idx: nextTrack(pl.current.idx, pl.tracks().length), buffer: null, done: false };
    pl.nextLoad = entry;
    loadTrack(pl, entry.idx).then((got) => {
      entry.done = true;
      if (my !== pl.token || pl.nextLoad !== entry) return;
      if (got) { entry.idx = got.idx; entry.buffer = got.buffer; } else pl.nextLoad = null;
    });
  }
  if (step.schedule) crossfade(c, pl, step.at);
};

const tick = () => {
  const c = ctxNow();
  if (!c || hidden()) return;
  const pl = playlists[mode()];
  if (wanted()) tickPlaylist(c, pl);
};
const ensureTick = () => { if (!tickTimer) tickTimer = setInterval(tick, TICK_MS); };

const ensureAmbience = (c) => {
  if (ambience) return;
  ambience = [];
  const my = ambienceToken;
  Object.entries(AMBIENCE_SOUNDS).forEach(([id, def]) => {
    const files = ambienceFilesFor(id);
    if (!files.length) return;
    decode(files[Math.floor(rng() * files.length)]).then((buffer) => {
      if (!buffer || my !== ambienceToken || !ambience) return;
      const src = c.createBufferSource(); src.buffer = buffer; src.loop = true;
      const gain = c.createGain();
      const t = c.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(def.gain, t + CROSSFADE_S);
      src.connect(gain); gain.connect(plBus(c, playlists.map));
      src.start(t);
      ambience.push({ id, src, gain, buffer });
    });
  });
};

// Stop a playlist and release its buffers, remembering where it was (the map's ambience goes too).
const park = (pl) => {
  if (pl.parkTimer) { clearTimeout(pl.parkTimer); pl.parkTimer = null; }
  pl.token += 1; pl.starting = false;
  const c = ctxNow();
  if (pl.current) {
    const pos = c ? c.currentTime - pl.current.startAt : 0;
    pl.parked = { idx: pl.current.idx, offset: Math.max(0, Math.min(pos, pl.current.duration - CROSSFADE_S)) };
    audioLog(`music: ${pl.id} stopped at track ${pl.current.idx + 1}, ${pl.parked.offset.toFixed(0)} s`);
  }
  release(pl.current); pl.current = null;
  pl.outgoing.forEach(release); pl.outgoing.clear();
  pl.nextLoad = null;
  if (pl.id === 'map') { ambienceToken += 1; (ambience || []).forEach(release); ambience = null; }
  if (!playlists.map.current && !playlists.battle.current && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
};
const busy = (pl) => !!(pl.current || pl.starting || pl.outgoing.size || (pl.id === 'map' && ambience));

/** Bring the music in line with the settings, the battle and the page. */
export const refreshMusic = () => {
  const c = ctxNow();
  if (!c) return;
  const on = wanted();
  const m = mode();
  const b = ensureBus(c);
  const t = c.currentTime;
  const away = hidden();
  if (away) {
    try { b.gain.cancelScheduledValues?.(t); b.gain.setValueAtTime(0, t); } catch { b.gain.value = 0; } // silent now (the context is suspended too)
  } else glide(b.gain, on ? getAudioSettings().music : 0, t, on && lastOn ? 0.08 : 0.5);
  lastOn = on;
  const levels = playlistLevels({ mode: m, on });
  Object.values(playlists).forEach((pl) => {
    const level = levels[pl.id];
    if (level > 0) {
      if (pl.parkTimer) { clearTimeout(pl.parkTimer); pl.parkTimer = null; }
      glide(plBus(c, pl).gain, level, t, SWITCH_TC);
      if (!pl.current) startFrom(pl);
      if (pl.id === 'map') ensureAmbience(c);
      ensureTick();
    } else {
      if (pl.bus && !away) glide(pl.bus.gain, 0, t, SWITCH_TC);
      if (!away && !pl.parkTimer && busy(pl)) pl.parkTimer = setTimeout(() => park(pl), PARK_AFTER_MS);
    }
  });
};

const describePlaylist = (pl) => {
  const list = pl.tracks();
  const c = ctxNow();
  return {
    track: pl.current ? `${pl.current.idx + 1}/${list.length} ${String(list[pl.current.idx] || '').split('/').pop()}` : (pl.starting ? 'loading' : 'none'),
    position: pl.current && c ? Math.max(0, c.currentTime - pl.current.startAt).toFixed(0) : '-',
    next: pl.nextLoad ? (pl.nextLoad.buffer ? `track ${pl.nextLoad.idx + 1} ready` : `track ${pl.nextLoad.idx + 1} decoding`) : '-',
    fadingOut: pl.outgoing.size,
    level: pl.bus ? Number(pl.bus.gain.value).toFixed(2) : '-'
  };
};
const bytesOf = (e) => (e?.buffer ? decodedBytes(e.buffer.duration, e.buffer.sampleRate, e.buffer.numberOfChannels || 2) : 0);
const describe = () => {
  const map = describePlaylist(playlists.map);
  const all = [...Object.values(playlists).flatMap((pl) => [pl.current, ...pl.outgoing, pl.nextLoad]), ...(ambience || [])];
  return {
    started,
    wanted: wanted(),
    mode: mode(),
    suppressed: [...suppressors],
    ...map, // the map playlist's fields at the top level (track, position, next, fadingOut)
    battle: describePlaylist(playlists.battle),
    ambience: (ambience || []).map((a) => a.id),
    bus: bus ? Number(bus.gain.value).toFixed(2) : '-',
    decodedMB: Math.round(all.reduce((s, e) => s + bytesOf(e), 0) / 1e6)
  };
};

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

/** Silence all music while `reason` holds. Returns the release function. */
export const suppressMusic = (reason) => {
  suppressors.add(reason);
  refreshMusic();
  return () => { suppressors.delete(reason); refreshMusic(); };
};
export const isMusicSuppressed = () => suppressors.size > 0;

/**
 * A battle screen is open: the map music crossfades into the battle playlist. Returns the release
 * function (call it when the battle screen closes: back to the map music where it was).
 */
export const startBattleMusic = () => {
  battleHolds += 1;
  refreshMusic();
  let done = false;
  return () => { if (done) return; done = true; battleHolds = Math.max(0, battleHolds - 1); refreshMusic(); };
};
export const currentMusicMode = mode;

/** Tests and the debug readout: what is playing. */
export const musicDebugState = describe;
/** Tests: run one playlist tick now. */
export const tickMusicForTest = tick;
/** Tests: forget everything. */
export const resetMusicForTest = () => {
  Object.values(playlists).forEach((pl) => { park(pl); pl.parked = { idx: 0, offset: 0 }; pl.bus = null; });
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  started = false; suppressors.clear(); battleHolds = 0; bus = null; busCtx = null; lastOn = false;
  unsubscribe?.(); unsubscribe = null; unsubscribePage?.(); unsubscribePage = null;
};
