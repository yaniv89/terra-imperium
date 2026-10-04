// Each real strait in STRAIT_LINES is open on the shipped grid through a short local channel, not
// only by sailing round an island (plans/math/straits.md). Reads src/data/geo/tiles.json directly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromLatLon, buildLatLonIndex } from '../../src/data/geo/geodesic.js';
import { STRAIT_LINES, straitDetour } from './build-tiles.mjs';

const raw = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/data/geo/tiles.json'), 'utf8'));
const index = buildLatLonIndex(Array.from({ length: raw.count }, (_, i) => fromLatLon(raw.lat[i] / 1000, raw.lon[i] / 1000)));
const lake = raw.terrainNames.indexOf('lake');
const sea = (i) => raw.land[i] !== 1 && raw.terrain[i] !== lake;
const neighbors = (i) => raw.neighbors.slice(i * 6, i * 6 + 6).filter((j) => j >= 0);

const lineCells = (line) => {
  const cells = [];
  for (let s = 0; s < line.length - 1; s++) {
    const [la0, lo0] = line[s]; const [la1, lo1] = line[s + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(la1 - la0, lo1 - lo0) / 0.05));
    for (let t = 0; t <= steps; t++) {
      const id = index.nearest(la0 + ((la1 - la0) * t) / steps, lo0 + ((lo1 - lo0) * t) / steps);
      if (cells[cells.length - 1] !== id) cells.push(id);
    }
  }
  return cells;
};
const seaSteps = (a, b, maxSteps) => {
  const seen = new Set([a]); let frontier = [a];
  for (let d = 1; d <= maxSteps && frontier.length; d++) {
    const next = [];
    for (const i of frontier) for (const j of neighbors(i)) {
      if (seen.has(j) || !sea(j)) continue;
      if (j === b) return d;
      seen.add(j); next.push(j);
    }
    frontier = next;
  }
  return -1;
};

describe('real straits', () => {
  STRAIT_LINES.forEach(({ name, line }) => {
    it(`${name} is open through a local channel`, () => {
      const cells = lineCells(line);
      const first = cells.find(sea); const last = cells.slice().reverse().find(sea);
      expect(first, `${name} starts in the sea`).toBeDefined();
      if (first === last) return; // the whole line lies in one sea cell
      expect(seaSteps(first, last, straitDetour(cells.length)), name).toBeGreaterThan(0);
    });
  });
});
