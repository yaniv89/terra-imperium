// src/data/geo/tilesPreload.js
// For a bundle that must carry the world grid inside itself (the edge function,
// scripts/build-edge-engine.mjs): import this module FIRST, before anything that reads the grid,
// and the grid is in place when the engine's modules load. The browser fetches a binary instead
// (tiles.js loadTiles) and never imports this.
import raw from './tiles.json';
import { setRawTiles } from './tiles';

setRawTiles(raw);
