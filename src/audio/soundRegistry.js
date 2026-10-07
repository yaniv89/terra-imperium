// src/audio/soundRegistry.js
// Every sound the game can play, by id, and where its recordings live. Drop OGG or MP3 files into
// the id's folder and they are used on the next build (import.meta.glob); several files in one
// folder are variants, one picked at random each time (a non-sim RNG, never the battle's).
// An id with no files plays its procedural fallback (`synth`, battleAudio.js) or stays silent.
//
//   battle effects   src/assets/audio/battle/<id>/*.ogg|mp3      (BATTLE_SOUNDS)
//   map ambience     src/assets/audio/music/ambience/<id>/*.ogg|mp3  (AMBIENCE_SOUNDS, looped)
//   music            src/assets/audio/music/*.ogg|mp3            (the map's playlist, crossfaded)
// Each folder's README.md gives the format: OGG or MP3, 44.1 kHz, loudness about -16 LUFS for music
// and -14 to -20 LUFS for effects, and a LICENSE file per pack.

// gain: the id's level in the mix (0..1); cooldownMs: the shortest gap between two plays;
// synth: the procedural fallback in battleAudio.js (null: silent until files arrive);
// positional: heard only where the player looks (false: a UI sound, always heard); loop: ambience.
export const BATTLE_SOUNDS = {
  'sword-clash': { label: 'Sword clash', gain: 0.8, cooldownMs: 70, synth: 'melee', positional: true },
  'spear-thrust': { label: 'Spear thrust', gain: 0.75, cooldownMs: 80, synth: 'melee', positional: true },
  'shield-block': { label: 'Shield block', gain: 0.7, cooldownMs: 90, synth: 'block', positional: true },
  'arrow-release': { label: 'Arrow release', gain: 0.6, cooldownMs: 55, synth: 'shotBow', positional: true },
  'arrow-volley': { label: 'Arrow volley', gain: 0.8, cooldownMs: 500, synth: 'volley', positional: true },
  'arrow-hit': { label: 'Arrow hit', gain: 0.5, cooldownMs: 90, synth: 'arrowHit', positional: true },
  'cavalry-charge': { label: 'Cavalry charge', gain: 0.85, cooldownMs: 300, synth: 'melee', positional: true },
  'cavalry-hooves': { label: 'Cavalry hooves', gain: 0.6, cooldownMs: 900, synth: 'hooves', positional: true },
  'chariot-rumble': { label: 'Chariot rumble', gain: 0.65, cooldownMs: 900, synth: 'hooves', positional: true },
  'ram-impact': { label: 'Ram impact', gain: 0.9, cooldownMs: 250, synth: 'impact', positional: true },
  'ballista-release': { label: 'Ballista release', gain: 0.7, cooldownMs: 200, synth: 'shotBow', positional: true },
  'trebuchet-release': { label: 'Trebuchet release', gain: 0.8, cooldownMs: 300, synth: 'thump', positional: true },
  'cannon-fire': { label: 'Cannon fire', gain: 1, cooldownMs: 200, synth: 'shotGun', positional: true },
  'musket-volley': { label: 'Musket volley', gain: 0.85, cooldownMs: 70, synth: 'shotGun', positional: true },
  'rifle-fire': { label: 'Rifle fire', gain: 0.75, cooldownMs: 60, synth: 'shotGun', positional: true },
  explosion: { label: 'Explosion', gain: 1, cooldownMs: 120, synth: 'impact', positional: true },
  'building-collapse': { label: 'Building collapse', gain: 1, cooldownMs: 250, synth: 'impactBig', positional: true },
  'fire-crackle': { label: 'Fire crackle', gain: 0.5, cooldownMs: 1500, synth: null, positional: true },
  'death-cry': { label: 'Death cry (soft)', gain: 0.5, cooldownMs: 160, synth: 'destroyed', positional: true },
  'horn-order': { label: 'Horn or trumpet order', gain: 0.7, cooldownMs: 800, synth: 'horn', positional: false },
  rout: { label: 'Rout', gain: 0.6, cooldownMs: 400, synth: 'routed', positional: true },
  'war-drums': { label: 'War drums', gain: 0.5, cooldownMs: 0, synth: null, positional: false, loop: true },
  'battle-ambience': { label: 'Battle ambience (distant clash, crowd)', gain: 0.5, cooldownMs: 0, synth: 'ambience', positional: false, loop: true },
  'worker-chop': { label: 'Worker chopping', gain: 0.45, cooldownMs: 700, synth: 'chop', positional: true },
  'worker-mine': { label: 'Worker mining', gain: 0.45, cooldownMs: 700, synth: 'mine', positional: true },
  'worker-build': { label: 'Worker building', gain: 0.5, cooldownMs: 600, synth: 'chop', positional: true },
  // The interface: heard wherever the camera is.
  'order-click': { label: 'Order confirmed', gain: 0.6, cooldownMs: 30, synth: 'click', positional: false },
  bell: { label: 'Point captured', gain: 0.7, cooldownMs: 600, synth: 'bell', positional: false },
  victory: { label: 'Victory', gain: 0.8, cooldownMs: 2000, synth: 'victory', positional: false },
  defeat: { label: 'Defeat', gain: 0.8, cooldownMs: 2000, synth: 'defeat', positional: false }
};
export const BATTLE_SOUND_IDS = Object.keys(BATTLE_SOUNDS);

// The map's background beds, looped under the music.
export const AMBIENCE_SOUNDS = {
  'map-wind': { label: 'Wind over the land', gain: 0.35 },
  'map-sea': { label: 'Sea and coast', gain: 0.3 }
};

// The files (urls), by folder. In tests and before any file exists these are empty.
const BATTLE_FILES = import.meta.glob('../assets/audio/battle/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
const AMBIENCE_FILES = import.meta.glob('../assets/audio/music/ambience/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
const MUSIC_FILES = import.meta.glob('../assets/audio/music/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });

/** Group a glob map { '<path>/<id>/<file>': url } by its folder name: { id: [url, ...] } (sorted by file). */
export const groupByFolder = (files) => {
  const out = {};
  Object.keys(files).sort().forEach((path) => {
    const parts = path.split('/');
    const id = parts[parts.length - 2];
    (out[id] = out[id] || []).push(files[path]);
  });
  return out;
};

let battleIndex = null;
let ambienceIndex = null;
let fileOverride = null; // tests: replace the file lists

/** The recordings for a battle sound id ([] when the folder is empty or missing). */
export const battleFilesFor = (id) => {
  if (fileOverride?.battle) return fileOverride.battle[id] || [];
  battleIndex = battleIndex || groupByFolder(BATTLE_FILES);
  return battleIndex[id] || [];
};
export const ambienceFilesFor = (id) => {
  if (fileOverride?.ambience) return fileOverride.ambience[id] || [];
  ambienceIndex = ambienceIndex || groupByFolder(AMBIENCE_FILES);
  return ambienceIndex[id] || [];
};
/** The music playlist, in file name order (prefix names with 01-, 02- to set it). */
export const musicTracks = () => fileOverride?.music || Object.keys(MUSIC_FILES).sort().map((k) => MUSIC_FILES[k]);

/** Tests only: pretend these files exist ({ battle: { id: [url] }, ambience, music: [url] }); null resets. */
export const setSoundFilesForTest = (files) => { fileOverride = files; };

// A small RNG for picking variants: audio is outside the sim, so it must never touch the battle's
// seeded random (replays and hashes stay exact). xorshift32, seeded from the clock once.
export const createSoundRng = (seed = (typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 1) || 1) => {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
};
/** One of the variants, never the same one twice in a row when there are several. */
export const pickVariant = (list, rng, lastIndex = -1) => {
  if (!list?.length) return -1;
  if (list.length === 1) return 0;
  let i = Math.floor(rng() * list.length);
  if (i === lastIndex) i = (i + 1) % list.length;
  return i;
};
