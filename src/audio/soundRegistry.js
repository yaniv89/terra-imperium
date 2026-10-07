// src/audio/soundRegistry.js
// Every sound the game can play, by id, and where its recordings live. Drop OGG or MP3 files into
// the id's folder and they are used on the next build (import.meta.glob); several files in one
// folder are variants, one picked at random each time (a non-sim RNG, never the battle's).
// An id with no files plays its procedural fallback (`synth`, battleAudio.js) or stays silent.
//
//   battle effects   src/assets/audio/battle/<id>/*.ogg|mp3      (BATTLE_SOUNDS)
//   map ambience     src/assets/audio/music/ambience/<id>/*.ogg|mp3  (AMBIENCE_SOUNDS, looped)
//   music            src/assets/audio/music/*.ogg|mp3            (the map's playlist, crossfaded)
//   interface        src/assets/audio/ui/<id>/*.ogg              (UI_SOUNDS, sfx.js)
//   world map        src/assets/audio/world/<id>/*.ogg           (WORLD_SOUNDS, sfx.js)
//   unit voices      src/assets/audio/voice/<class>/<select|order|attack>/*.ogg (sfx.js playVoice)
// src/audio/ACTIONS.md says when each interface, world, battle and voice sound plays.
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
  // The battle's player cues (src/audio/ACTIONS.md): heard wherever the camera is, each with a
  // cooldown so a busy economy or a long siege never turns into a drum roll.
  'order-move': { label: 'Move order', gain: 0.5, cooldownMs: 250, synth: 'click', positional: false },
  'order-attack': { label: 'Attack order', gain: 0.6, cooldownMs: 250, synth: 'click', positional: false },
  'worker-task': { label: 'Worker sent to gather, build or repair', gain: 0.5, cooldownMs: 300, synth: 'chop', positional: false },
  'building-placed': { label: 'Building placed', gain: 0.6, cooldownMs: 300, synth: 'chop', positional: false },
  'building-finished': { label: 'Building finished', gain: 0.7, cooldownMs: 1500, synth: 'bell', positional: false },
  'house-built': { label: 'House built', gain: 0.6, cooldownMs: 1500, synth: 'chop', positional: false },
  'squad-trained': { label: 'Unit trained', gain: 0.6, cooldownMs: 1200, synth: 'click', positional: false },
  'housing-full': { label: 'Population capped', gain: 0.6, cooldownMs: 15000, synth: 'routed', positional: false },
  'node-depleted': { label: 'Resource used up', gain: 0.6, cooldownMs: 4000, synth: 'impact', positional: false },
  'under-attack': { label: 'Under attack alert', gain: 0.75, cooldownMs: 12000, synth: 'horn', positional: false },
  'gate-breached': { label: 'Gate breached', gain: 0.9, cooldownMs: 3000, synth: 'impactBig', positional: false },
  'wall-destroyed': { label: 'Wall destroyed', gain: 0.85, cooldownMs: 2500, synth: 'impactBig', positional: false },
  'retreat-horn': { label: 'Retreat sounded', gain: 0.7, cooldownMs: 3000, synth: 'horn', positional: false },
  'rally-cry': { label: 'Rally cry', gain: 0.8, cooldownMs: 3000, synth: 'horn', positional: false },
  'power-used': { label: 'Commander power used', gain: 0.7, cooldownMs: 1500, synth: 'horn', positional: false },
  'general-killed': { label: 'General killed', gain: 0.85, cooldownMs: 4000, synth: 'defeat', positional: false },
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

// The interface and the world map (src/audio/sfx.js plays them; src/audio/ACTIONS.md says when).
//   category 'ui'     taps, sheets, tabs, toggles, refusals: the Interface sounds switch
//   category 'world'  what happens in the world: the Interface sounds switch too
// gain: level in the mix (0..1); cooldownMs: shortest gap between two plays of the id; big: a
// fanfare that takes the stage (smaller sounds queued with it wait or drop); priority: which of
// several sounds of one moment plays first (higher first).
export const UI_SOUNDS = {
  'ui-click': { label: 'Tap or click', gain: 0.35, cooldownMs: 40 },
  'ui-open': { label: 'Sheet or panel opens', gain: 0.35, cooldownMs: 120 },
  'ui-close': { label: 'Sheet or panel closes', gain: 0.3, cooldownMs: 120 },
  'ui-tab': { label: 'Tab switch', gain: 0.35, cooldownMs: 60 },
  'ui-toggle': { label: 'Toggle', gain: 0.35, cooldownMs: 60 },
  'ui-error': { label: 'Refused or not possible', gain: 0.45, cooldownMs: 300 },
  'ui-confirm': { label: 'Confirmed', gain: 0.4, cooldownMs: 150 }
};
const ws = (label, gain, priority, extra = {}) => ({ label, gain, cooldownMs: 600, priority, ...extra });
export const WORLD_SOUNDS = {
  'turn-end': ws('End turn', 0.5, 1),
  'turn-begin': ws('A new turn begins', 0.45, 0),
  'city-founded': ws('City founded', 0.75, 6),
  'city-grows': ws('City grows', 0.45, 2),
  'building-queued': ws('Building queued', 0.5, 2),
  'building-complete': ws('Building completed', 0.6, 3),
  'wonder-started': ws('Wonder started', 0.65, 5),
  'wonder-complete': ws('Wonder completed', 0.85, 9, { big: true }),
  'tech-selected': ws('Research chosen', 0.5, 2),
  'tech-complete': ws('Research completed', 0.6, 4),
  'era-advanced': ws('A new era', 0.85, 10, { big: true }),
  'settler-moving': ws('Settlers on the move', 0.5, 2),
  'army-moved': ws('Army marches', 0.5, 2),
  'unit-trained': ws('Unit recruited', 0.55, 3),
  'war-declared': ws('War declared', 0.85, 8, { big: true }),
  'peace-signed': ws('Peace signed', 0.7, 7),
  'pact-signed': ws('Alliance or pact signed', 0.65, 6),
  'trade-route': ws('Trade agreed', 0.55, 4),
  'gold-received': ws('Gold received', 0.5, 2),
  'tribute-paid': ws('Tribute paid', 0.5, 3),
  'raid-warning': ws('Raiders approach', 0.7, 6, { cooldownMs: 4000 }),
  'city-besieged': ws('City under siege', 0.7, 7),
  'city-captured': ws('City captured', 0.75, 8),
  'city-lost': ws('City lost', 0.75, 8),
  'city-razed': ws('City razed', 0.7, 7),
  'event-appeared': ws('An event needs you', 0.55, 5),
  'first-contact': ws('First contact', 0.6, 5),
  'independent-joined': ws('An independent city joins you', 0.65, 6),
  rebellion: ws('Rebellion', 0.7, 7),
  'battle-won': ws('Battle won (auto-resolved)', 0.65, 6),
  'battle-lost': ws('Battle lost (auto-resolved)', 0.65, 6),
  'game-victory': ws('Victory', 0.9, 20, { big: true, cooldownMs: 10000 }),
  'game-defeat': ws('Defeat', 0.9, 20, { big: true, cooldownMs: 10000 })
};
export const UI_SOUND_IDS = Object.keys(UI_SOUNDS);
export const WORLD_SOUND_IDS = Object.keys(WORLD_SOUNDS);

// Unit voices: wordless barks per unit class (src/assets/audio/voice/<class>/<kind>/), when a
// group is selected, given an order, or sent to attack. Classes without their own folder borrow.
export const VOICE_CLASSES = ['infantry', 'ranged', 'cavalry', 'siege', 'worker'];
export const VOICE_KINDS = ['select', 'order', 'attack'];
const VOICE_FALLBACK_CLASS = { worker: 'infantry', siege: 'infantry', ranged: 'infantry', cavalry: 'infantry', naval: 'infantry', general: 'cavalry' };

// The files (urls), by folder. In tests and before any file exists these are empty.
const BATTLE_FILES = import.meta.glob('../assets/audio/battle/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
const UI_FILES = import.meta.glob('../assets/audio/ui/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
const WORLD_FILES = import.meta.glob('../assets/audio/world/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
const VOICE_FILES = import.meta.glob('../assets/audio/voice/*/*/*.{ogg,mp3}', { query: '?url', import: 'default', eager: true });
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
let uiIndex = null; let worldIndex = null; let voiceIndex = null;
/** The recordings for an interface sound id ([] when none: the id stays silent). */
export const uiFilesFor = (id) => {
  if (fileOverride?.ui) return fileOverride.ui[id] || [];
  uiIndex = uiIndex || groupByFolder(UI_FILES);
  return uiIndex[id] || [];
};
/** The recordings for a world map sound id ([] when none: the id stays silent). */
export const worldFilesFor = (id) => {
  if (fileOverride?.world) return fileOverride.world[id] || [];
  worldIndex = worldIndex || groupByFolder(WORLD_FILES);
  return worldIndex[id] || [];
};
/** Group voice files { '<path>/<class>/<kind>/<file>': url } as { 'class/kind': [url] }. */
export const groupVoices = (files) => {
  const out = {};
  Object.keys(files).sort().forEach((p) => {
    const parts = p.split('/');
    const key = `${parts[parts.length - 3]}/${parts[parts.length - 2]}`;
    (out[key] = out[key] || []).push(files[p]);
  });
  return out;
};
/** A unit class's barks of one kind ('select', 'order', 'attack'); a class with none borrows a
 *  neighbour's voice, an attack with none falls back to the order barks; [] means silence. */
export const voiceFilesFor = (classId, kind) => {
  const idx = fileOverride?.voice || (voiceIndex = voiceIndex || groupVoices(VOICE_FILES));
  const tryClass = (c) => idx[`${c}/${kind}`] || (kind === 'attack' ? idx[`${c}/order`] : null);
  return tryClass(classId) || tryClass(VOICE_FALLBACK_CLASS[classId]) || [];
};
/** Which registry an id belongs to: 'ui', 'world', 'battle' or null. */
export const soundCategory = (id) => (UI_SOUNDS[id] ? 'ui' : WORLD_SOUNDS[id] ? 'world' : BATTLE_SOUNDS[id] ? 'battle' : null);

/** The music playlist, in file name order (prefix names with 01-, 02- to set it). */
export const musicTracks = () => fileOverride?.music || Object.keys(MUSIC_FILES).sort().map((k) => MUSIC_FILES[k]);

/** Tests only: pretend these files exist ({ battle: { id: [url] }, ui, world, voice: { 'class/kind': [url] },
 *  ambience, music: [url] }); null resets. */
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
