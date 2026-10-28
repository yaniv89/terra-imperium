// src/audio/music.js
// The music: the map's playlist (with the ambience beds under it) and the RTS battle's playlist,
// played through the game's one Web Audio context (audioContext.js), never as media elements: iOS
// keeps a playing <audio> / new Audio() going in the background and on the lock screen, while it
// pauses a Web Audio context there itself (see audioContext.js).
//   map     the player's age's tracks, src/assets/audio/music/ages/<age>/ (soundRegistry.js
//           musicTracks); a new age crossfades to its own music (setMusicAge, as Civ VI's eras and
//           AoE IV's ages change the score). The ambience bed of the land in view loops under them
//           (setMapAmbience, mapAmbience.js; src/assets/audio/music/ambience/<id>/).
//   battle  src/assets/audio/music/battle/ (battleMusicTracks, by age too), from BATTLE_CALM_DB under the
//           map's level while nobody fights up to BATTLE_MUSIC_DB in a heavy fight and back down after
//           (setBattleIntensity, from battleAudio.js: Total War raises its battle score with the
//           fighting), so the battle's own sounds stay clear.
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
import { musicTracks, battleMusicTracks, AMBIENCE_SOUNDS, ambienceFilesFor, createSoundRng, pickVariant } from './soundRegistry';
import { FIRST_AGE_ID } from '../data/ages';
import { getAudioSettings, subscribeAudioSettings } from './audioSettings';
import { isPageAudible, subscribePageAudio, pageAudioState } from './pageLifecycle';
import { getAudioContext, unlockAudio, registerAudioConsumer, audioLog, audioOutput } from './audioContext';

export const CROSSFADE_S = 4;
export const PRELOAD_S = 40; // decode the next track this long before the current one ends
export const PARK_AFTER_MS = 5000; // a playlist silent this long (after its fade): stop and release
export const PHONE_DECODE_RATE = 24000;
export const BATTLE_MUSIC_DB = -6; // the battle playlist under the map's level in a heavy fight: a bed under it (mixLevels.test.js)
export const BATTLE_CALM_DB = -12; // ... and while nobody fights (deployment, a lull)
export const AMBIENCE_RELEASE_MS = 20000; // a bed silent this long is stopped and its buffer released
export const MAP_GAP_S = [8, 25]; // map tracks: a quiet spell between two, only the ambience (Civ VI, AoE IV)
export const DUCK_GAIN = 0.35; // the music under a fanfare (war, a new age, a wonder)
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
/** The battle playlist's level in dB for a fight intensity 0..1 (pure). */
export const battleMusicDb = (intensity = 0) => BATTLE_CALM_DB + (BATTLE_MUSIC_DB - BATTLE_CALM_DB) * Math.max(0, Math.min(1, intensity));
/** Each playlist's level, 0..1 of the music volume (pure): only the mode's playlist is heard. */
export const playlistLevels = ({ mode, on, intensity = 0 }) => ({
  map: on && mode === 'map' ? 1 : 0,
  battle: on && mode === 'battle' ? dbToGain(battleMusicDb(intensity)) : 0
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
let musicAge = FIRST_AGE_ID;
const playlists = { map: makePlaylist('map', () => musicTracks(musicAge)), battle: makePlaylist('battle', () => battleMusicTracks(musicAge)) };

let started = false;
const suppressors = new Set();
let battleHolds = 0;
let bus = null; // all music -> destination (the Music volume)
let busCtx = null;
let ambience = null; // map only: { id: { src, gain, buffer, releaseTimer } | { loading: true } }, null when the map is parked
let ambienceToken = 0;
let ambienceTarget = { 'map-wind': 1 }; // { id: weight } (mapAmbience.js)
const lastBed = {}; // the variant each bed played last: never the same one twice running
let battleIntensity = 0;
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
  bus.connect(audioOutput(c));
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

// The crossfade: the current track fades out to its end while the next fades in (at `at`, which
// may be after the end: a gap).
const crossfade = (c, pl, at) => {
  const old = pl.current;
  const next = pl.nextLoad;
  pl.nextLoad = null;
  const fadeAt = Math.max(c.currentTime, Math.min(at, old.startAt + old.duration - CROSSFADE_S));
  old.gain.gain.setValueAtTime(1, fadeAt);
  old.gain.gain.linearRampToValueAtTime(0, fadeAt + CROSSFADE_S);
  try { old.src.stop(fadeAt + CROSSFADE_S + 0.05); } catch { /* already stopping */ }
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
  if (step.schedule) crossfade(c, pl, step.at + (pl.id === 'map' ? CROSSFADE_S + MAP_GAP_S[0] + rng() * (MAP_GAP_S[1] - MAP_GAP_S[0]) : 0));
};

const tick = () => {
  const c = ctxNow();
  if (!c || hidden()) return;
  const pl = playlists[mode()];
  if (wanted()) tickPlaylist(c, pl);
};
const ensureTick = () => { if (!tickTimer) tickTimer = setInterval(tick, TICK_MS); };

// The map's beds follow ambienceTarget: each wanted bed is decoded and looped (fading in over
// CROSSFADE_S), each unwanted one fades out and is released after AMBIENCE_RELEASE_MS of silence.
const applyAmbience = (c) => {
  ambience = ambience || {};
  const my = ambienceToken;
  const t = c.currentTime;
  Object.entries(AMBIENCE_SOUNDS).forEach(([id, def]) => {
    const level = def.gain * (ambienceTarget[id] || 0);
    const cur = ambience[id];
    if (cur?.gain) {
      glide(cur.gain.gain, level, t, CROSSFADE_S / 3);
      clearTimeout(cur.releaseTimer); cur.releaseTimer = null;
      if (!level) cur.releaseTimer = setTimeout(() => { if (ambience?.[id] === cur) { release(cur); delete ambience[id]; } }, AMBIENCE_RELEASE_MS);
      return;
    }
    const files = ambienceFilesFor(id);
    if (cur || !level || !files.length) return;
    ambience[id] = { loading: true };
    const i = pickVariant(files, rng, lastBed[id] ?? -1); lastBed[id] = i;
    decode(files[i]).then((buffer) => {
      if (my !== ambienceToken || !ambience) return;
      if (!buffer) { delete ambience[id]; return; }
      const src = c.createBufferSource(); src.buffer = buffer; src.loop = true;
      const gain = c.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(plBus(c, playlists.map));
      src.start(c.currentTime, rng() * buffer.duration); // a random point: two visits never start alike
      ambience[id] = { id, src, gain, buffer, releaseTimer: null };
      applyAmbience(c);
    });
  });
};
const ambienceEntries = () => Object.values(ambience || {}).filter((a) => a.src);

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
  if (pl.id === 'map') { ambienceToken += 1; ambienceEntries().forEach((a) => { clearTimeout(a.releaseTimer); release(a); }); ambience = null; }
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
  const levels = playlistLevels({ mode: m, on, intensity: battleIntensity });
  Object.values(playlists).forEach((pl) => {
    const level = levels[pl.id];
    if (level > 0) {
      if (pl.parkTimer) { clearTimeout(pl.parkTimer); pl.parkTimer = null; }
      glide(plBus(c, pl).gain, level, t, SWITCH_TC);
      if (!pl.current) startFrom(pl);
      if (pl.id === 'map' && !ambience) applyAmbience(c);
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
  const all = [...Object.values(playlists).flatMap((pl) => [pl.current, ...pl.outgoing, pl.nextLoad]), ...ambienceEntries()];
  return {
    started,
    wanted: wanted(),
    mode: mode(),
    suppressed: [...suppressors],
    ...map, // the map playlist's fields at the top level (track, position, next, fadingOut)
    battle: describePlaylist(playlists.battle),
    age: musicAge,
    intensity: battleIntensity.toFixed(2),
    ambience: ambienceEntries().map((a) => `${a.id} ${Number(a.gain.gain.value).toFixed(2)}`),
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
  return () => { if (done) return; done = true; battleHolds = Math.max(0, battleHolds - 1); battleIntensity = 0; refreshMusic(); };
};
export const currentMusicMode = mode;

/**
 * The player's age (ageOf): each playlist moves to that age's tracks. One that is playing
 * crossfades to a new age's track at once; one that is parked starts there next time.
 */
export const setMusicAge = (age) => {
  if (!age || age === musicAge) return;
  musicAge = age;
  Object.values(playlists).forEach((pl) => {
    pl.parked = { idx: Math.floor(rng() * Math.max(1, pl.tracks().length)), offset: 0 };
    if (!pl.current) return;
    pl.token += 1; pl.nextLoad = null; // decodes on their way are the old age's
    const my = pl.token;
    loadTrack(pl, pl.parked.idx).then((got) => {
      const c = ctxNow();
      if (!got || !c || my !== pl.token || !pl.current) return;
      pl.nextLoad = { idx: got.idx, buffer: got.buffer, done: true };
      crossfade(c, pl, c.currentTime + 0.05);
    });
  });
};

/** The map's ambience mix, { bedId: weight } (mapAmbience.js ambienceMix). */
export const setMapAmbience = (mix) => {
  const key = (m) => JSON.stringify(Object.entries(m || {}).sort());
  if (!mix || key(mix) === key(ambienceTarget)) return;
  ambienceTarget = mix;
  const c = ctxNow();
  if (c && ambience) applyAmbience(c);
};

/** How much fighting a battle has on screen, 0..1 (battleAudio.js): the battle music rises and falls with it. */
export const setBattleIntensity = (level) => {
  const l = Math.max(0, Math.min(1, Number(level) || 0));
  if (Math.abs(l - battleIntensity) < 0.05 && (l > 0 || battleIntensity === 0)) return;
  battleIntensity = l;
  const c = ctxNow(); const pl = playlists.battle;
  if (c && pl.bus && mode() === 'battle' && lastOn && !hidden()) glide(pl.bus.gain, playlistLevels({ mode: 'battle', on: true, intensity: l }).battle, c.currentTime, 1.2);
};

/** A fanfare (sfx.js, a big world sound): the music dips to DUCK_GAIN for `seconds`, then comes back. */
export const duckMusic = (seconds = 3) => {
  const c = ctxNow();
  if (!c || !bus || !lastOn || hidden()) return;
  const v = getAudioSettings().music; const t = c.currentTime;
  try {
    bus.gain.cancelScheduledValues?.(t);
    bus.gain.setTargetAtTime(v * DUCK_GAIN, t, 0.08);
    bus.gain.setTargetAtTime(v, t + seconds, 0.6);
  } catch { /* an old browser: no dip */ }
};

/** Tests and the debug readout: what is playing. */
export const musicDebugState = describe;
/** Tests: run one playlist tick now. */
export const tickMusicForTest = tick;
/** Tests: forget everything. */
export const resetMusicForTest = () => {
  Object.values(playlists).forEach((pl) => { park(pl); pl.parked = { idx: 0, offset: 0 }; pl.bus = null; });
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  started = false; suppressors.clear(); battleHolds = 0; bus = null; busCtx = null; lastOn = false;
  musicAge = FIRST_AGE_ID; ambienceTarget = { 'map-wind': 1 }; battleIntensity = 0;
  unsubscribe?.(); unsubscribe = null; unsubscribePage?.(); unsubscribePage = null;
};
