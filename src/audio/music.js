// src/audio/music.js
// The map's music and ambience. Tracks are the files in src/assets/audio/music/ (soundRegistry.js
// musicTracks, in file name order), played one after another with a CROSSFADE_S crossfade, the
// list looping; the map ambience beds (src/assets/audio/music/ambience/<id>/) loop under them.
// Music plays in map mode only: a battle screen calls suppressMusic('battle') while it is open,
// and the tab being hidden pauses it. The Music volume and the Sound switch come from
// audioSettings.js. Browsers only start audio after a user gesture: App calls startMusic() on the
// first one. With no files (today) all of this does nothing.
import { musicTracks, AMBIENCE_SOUNDS, ambienceFilesFor, createSoundRng } from './soundRegistry';
import { getAudioSettings, subscribeAudioSettings } from './audioSettings';

export const CROSSFADE_S = 4;
const FADE_STEP_MS = 50;

/** Should music be heard now? (pure) */
export const musicWanted = ({ started, sound, volume, suppressed, hidden, trackCount }) =>
  !!started && !!sound && volume > 0 && !suppressed && !hidden && trackCount > 0;
/** The next track in the playlist (pure). */
export const nextTrack = (i, n) => (n > 0 ? (i + 1) % n : -1);

let started = false;
const suppressors = new Set();
let players = null; // two HTMLAudioElements for the crossfade
let cur = 0; let trackIdx = 0;
let fadeTimer = null;
let ambience = null; // [{ el, gain }]
let unsubscribe = null;
const rng = createSoundRng();

const hidden = () => typeof document !== 'undefined' && !!document.hidden;
const canPlay = () => typeof Audio !== 'undefined';
const wanted = () => {
  const s = getAudioSettings();
  return musicWanted({ started, sound: s.sound && s.musicOn !== false, volume: s.music, suppressed: suppressors.size > 0, hidden: hidden(), trackCount: musicTracks().length });
};

// Every FADE_STEP_MS move each element's volume toward its target (el.dataset.target, 0..1).
const fadeTick = () => {
  let moving = false;
  const step = FADE_STEP_MS / 1000 / CROSSFADE_S;
  const vol = getAudioSettings().music;
  [...(players || []), ...(ambience || []).map((a) => a.el)].forEach((el) => {
    const target = Number(el.dataset.target || 0) * vol * Number(el.dataset.gain || 1);
    const v = el.volume;
    if (Math.abs(v - target) <= step) { el.volume = target; if (target === 0 && !el.paused) el.pause(); }
    else { el.volume = Math.max(0, Math.min(1, v + Math.sign(target - v) * step)); moving = true; }
  });
  if (!moving) { clearInterval(fadeTimer); fadeTimer = null; }
};
const fade = () => { if (!fadeTimer) fadeTimer = setInterval(fadeTick, FADE_STEP_MS); };

const playTrack = (el, i) => {
  const tracks = musicTracks();
  if (!tracks.length) return;
  el.src = tracks[i % tracks.length];
  el.volume = 0; el.dataset.target = '1';
  el.play()?.catch?.(() => { /* not allowed yet: the next gesture retries */ });
};

const ensurePlayers = () => {
  if (players || !canPlay()) return players;
  players = [new Audio(), new Audio()];
  players.forEach((el, k) => {
    el.preload = 'auto';
    // Near a track's end the other player starts the next one: the crossfade.
    el.addEventListener('timeupdate', () => {
      if (k !== cur || !el.duration || el.dataset.target === '0') return;
      if (el.duration - el.currentTime <= CROSSFADE_S && wanted()) {
        el.dataset.target = '0';
        cur = 1 - cur; trackIdx = nextTrack(trackIdx, musicTracks().length);
        playTrack(players[cur], trackIdx); fade();
      }
    });
    el.addEventListener('ended', () => { if (k === cur && wanted()) { trackIdx = nextTrack(trackIdx, musicTracks().length); playTrack(el, trackIdx); fade(); } });
  });
  return players;
};

const ensureAmbience = () => {
  if (ambience || !canPlay()) return ambience;
  ambience = Object.entries(AMBIENCE_SOUNDS).map(([id, def]) => {
    const files = ambienceFilesFor(id);
    if (!files.length) return null;
    const el = new Audio(files[Math.floor(rng() * files.length)]);
    el.loop = true; el.volume = 0; el.dataset.gain = String(def.gain); el.dataset.target = '0';
    return { id, el };
  }).filter(Boolean);
  return ambience;
};

/** Bring the music in line with the settings, the battle and the tab. */
export const refreshMusic = () => {
  if (!canPlay()) return;
  const on = wanted();
  const ps = on ? ensurePlayers() : players;
  if (ps) {
    const el = ps[cur];
    if (on && (el.paused || el.dataset.target === '0')) {
      if (!el.src || el.ended) playTrack(el, trackIdx);
      else { el.dataset.target = '1'; el.play()?.catch?.(() => {}); }
    } else if (!on) ps.forEach((p) => { p.dataset.target = '0'; });
  }
  const amb = on ? ensureAmbience() : ambience;
  (amb || []).forEach((a) => {
    a.el.dataset.target = on ? '1' : '0';
    if (on && a.el.paused) a.el.play()?.catch?.(() => {});
  });
  fade();
};

/** Call on the first user gesture: from then on music may play. */
export const startMusic = () => {
  if (started) return;
  started = true;
  if (!unsubscribe) unsubscribe = subscribeAudioSettings(() => refreshMusic());
  if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', refreshMusic);
  refreshMusic();
};

/** Silence the music while `reason` holds (a battle is open). Returns the release function. */
export const suppressMusic = (reason) => {
  suppressors.add(reason);
  refreshMusic();
  return () => { suppressors.delete(reason); refreshMusic(); };
};

export const isMusicSuppressed = () => suppressors.size > 0;
