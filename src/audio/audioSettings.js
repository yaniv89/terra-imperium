// src/audio/audioSettings.js
// The player's sound settings, per device (localStorage, never in the save):
//   sound    the one Sound switch (battle effects, music and haptics); the battle HUD's speaker
//            button and Settings > Sound both flip it. Kept under its old key so a muted player
//            stays muted.
//   effects  battle effects volume, 0..1
//   music    music and map ambience volume, 0..1 (music plays on the map, never in a battle)
//   musicOn  music switch (mute music only); effectsOn battle sounds switch (mute RTS sounds only)
import { useSyncExternalStore } from 'react';

const SOUND_KEY = 'terra-imperium-battle-audio'; // 'on' | 'off' (the battle's original switch)
const VOLUME_KEY = 'terra-imperium-audio-volume'; // { effects, music }
export const DEFAULT_VOLUMES = { effects: 0.8, music: 0.5 };

const clamp01 = (v, d) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const read = () => {
  let sound = true; let vol = {};
  try { sound = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* storage blocked: defaults */ }
  try { vol = JSON.parse(localStorage.getItem(VOLUME_KEY) || '{}') || {}; } catch { vol = {}; }
  return { sound, effects: clamp01(vol.effects, DEFAULT_VOLUMES.effects), music: clamp01(vol.music, DEFAULT_VOLUMES.music), musicOn: vol.musicOn !== false, effectsOn: vol.effectsOn !== false };
};

let current = null;
const listeners = new Set();
export const getAudioSettings = () => { current = current || read(); return current; };
/** Change some settings ({ sound, effects, music, musicOn, effectsOn }); saved at once, listeners told. */
export const setAudioSettings = (patch) => {
  const next = { ...getAudioSettings(), ...patch };
  next.effects = clamp01(next.effects, DEFAULT_VOLUMES.effects);
  next.music = clamp01(next.music, DEFAULT_VOLUMES.music);
  next.sound = next.sound !== false;
  next.musicOn = next.musicOn !== false;
  next.effectsOn = next.effectsOn !== false;
  current = next;
  try {
    localStorage.setItem(SOUND_KEY, next.sound ? 'on' : 'off');
    localStorage.setItem(VOLUME_KEY, JSON.stringify({ effects: next.effects, music: next.music, musicOn: next.musicOn, effectsOn: next.effectsOn }));
  } catch { /* storage unavailable: just won't persist */ }
  listeners.forEach((fn) => fn(next));
};
export const subscribeAudioSettings = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** Tests: forget the cached settings so the next read comes from storage. */
export const resetAudioSettingsCache = () => { current = null; };

export const useAudioSettings = () => useSyncExternalStore(subscribeAudioSettings, getAudioSettings, getAudioSettings);
