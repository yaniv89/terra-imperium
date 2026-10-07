// src/components/map/mapPrefs.js
// The map's settings, per browser (localStorage), live across the app (useMapPrefs):
//   renderer  'webgl' (the one WebGL map, gl/GLMapView.jsx) or 'svg' (the old SVG map,
//             Map2DView.jsx, kept for one release in case the new one misbehaves somewhere)
//   globe     show the globe and its toggle (decision 28: hidden behind this setting for one
//             release, then deleted with react-globe.gl and politicalTexture); off by default
//   perf      the battle's performance readout (fps and ms, perfMeter.js), as `&perf` in the URL
//             does; off by default (Settings, W12)
import { useSyncExternalStore } from 'react';

export const MAP_RENDERER_KEY = 'terra-imperium-map-renderer';
export const SHOW_GLOBE_KEY = 'terra-imperium-show-globe';
export const PERF_OVERLAY_KEY = 'terra-imperium-perf-overlay';

const read = () => {
  let renderer = 'webgl'; let globe = false; let perf = false;
  try {
    renderer = localStorage.getItem(MAP_RENDERER_KEY) === 'svg' ? 'svg' : 'webgl';
    globe = localStorage.getItem(SHOW_GLOBE_KEY) === '1';
    perf = localStorage.getItem(PERF_OVERLAY_KEY) === '1';
  } catch { /* storage off: the defaults */ }
  return { renderer, globe, perf };
};

let current = typeof window === 'undefined' ? { renderer: 'webgl', globe: false, perf: false } : read();
const listeners = new Set();

export const getMapPrefs = () => current;

/** Changes one or both settings and tells every map. */
export const setMapPrefs = (patch) => {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(MAP_RENDERER_KEY, current.renderer);
    localStorage.setItem(SHOW_GLOBE_KEY, current.globe ? '1' : '0');
    localStorage.setItem(PERF_OVERLAY_KEY, current.perf ? '1' : '0');
  } catch { /* storage off: this session only */ }
  listeners.forEach((fn) => fn());
};

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useMapPrefs = () => useSyncExternalStore(subscribe, getMapPrefs, getMapPrefs);
