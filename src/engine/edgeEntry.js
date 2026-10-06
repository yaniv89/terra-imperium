// src/engine/edgeEntry.js
// The edge function's bundle entry (scripts/build-edge-engine.mjs): the world grid first (the
// bundle carries tiles.json, the browser fetches a binary instead), then the engine.
import '../data/geo/tilesPreload';

export * from './gameReducer';
