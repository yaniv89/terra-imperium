// src/data/geo/tileSpatialIndex.js
// A spatial index of the tile grid for "what is on screen" queries (plans/rts-world-review.md
// 6.3): tile ids bucketed by their centre into CELL_DEG x CELL_DEG lat/lon cells, land and water
// apart, built once. A query visits only the cells that overlap the window, so the flat map's
// glyphs and hex mesh and the close view's trees cost what is on screen, not 100,002 tiles.
import { getTiles, onWorldChange } from './tiles';

export const CELL_DEG = 2;
const ROWS = 180 / CELL_DEG; const COLS = 360 / CELL_DEG;

let index = null;
onWorldChange(() => { index = null; });
const build = () => {
  const tiles = getTiles();
  const land = Array.from({ length: ROWS * COLS }, () => []);
  const water = Array.from({ length: ROWS * COLS }, () => []);
  for (let i = 0; i < tiles.count; i++) {
    const la = tiles.lat[i] / 1000; const lo = tiles.lon[i] / 1000;
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor((la + 90) / CELL_DEG)));
    const c = Math.min(COLS - 1, Math.max(0, Math.floor((lo + 180) / CELL_DEG)));
    (tiles.land[i] ? land : water)[r * COLS + c].push(i);
  }
  return { land, water, tiles };
};
const getIndex = () => (index && index.tiles === getTiles() ? index : (index = build()));

const colRanges = (west, east) => {
  const c = (lo) => Math.min(COLS - 1, Math.max(0, Math.floor((lo + 180) / CELL_DEG)));
  if (west <= east) return [[c(west), c(east)]];
  return [[c(west), COLS - 1], [0, c(east)]]; // across the antimeridian
};

/**
 * The tile ids whose centre lies in the lat/lon window (`west` may exceed `east` across the
 * antimeridian), land only unless `water`. Ascending ids, as a full scan would give.
 */
export const tilesInWindow = ({ south, north, west, east }, { water = false, land = true } = {}) => {
  const { land: landCells, water: waterCells, tiles } = getIndex();
  const r0 = Math.max(0, Math.floor((south + 90) / CELL_DEG)); const r1 = Math.min(ROWS - 1, Math.floor((north + 90) / CELL_DEG));
  const out = [];
  const lat = tiles.lat; const lon = tiles.lon;
  const inLon = west <= east ? (lo) => lo >= west && lo <= east : (lo) => lo >= west || lo <= east;
  for (let r = r0; r <= r1; r++) {
    for (const [c0, c1] of colRanges(west, east)) {
      for (let c = c0; c <= c1; c++) {
        const lists = [land ? landCells[r * COLS + c] : null, water ? waterCells[r * COLS + c] : null];
        for (const list of lists) {
          if (!list) continue;
          for (const i of list) {
            const la = lat[i] / 1000; const lo = lon[i] / 1000;
            if (la >= south && la <= north && inLon(lo)) out.push(i);
          }
        }
      }
    }
  }
  return out.sort((a, b) => a - b);
};
