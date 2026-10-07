// The world generator (plans/MAP-VARIATIONS-PLAN.md section 4 and 8.1): determinism, the frozen
// golden hashes of generator version 1, the quality checks, rivers, the coast and the binary.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTiles, tilesFromRaw } from '../data/geo/tiles';
import { encodeTiles, decodeTiles } from '../data/geo/tilesCodec';
import { generateWorld, gridOf } from './index';
import { prepareGrid, _internals, qualityProblems } from './v1/generate';
import { gnoise, makeField, ONE } from './v1/noise';
import { worldHashOf, mapCode, parseMapCode, normalizeSpec, specKey } from './spec';
import { buildHexLand } from '../data/geo/hexCoast';
import { paintWorld } from './painter';

// Frozen with generator version 1: a change here means old saves would rebuild a different world.
// Any intended change to the output is a new generator version (src/worldgen/v2/...), never an edit.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GOLDEN_V1 = { 1: 'ee05f631', 2: 'f18154e8', 3: '9f9334cf' };
// Frozen with generator version 2 (the look pass: no specks or small inland seas, narrower sea ice,
// fewer lakes, a wandering dry belt; and the shapes and relief option), seed 1 to 3 per shape.
export const GOLDEN_V2 = {
  continents: ['c4f02f87', '51b3bbff', '82223216'], pangaea: ['b761cd90', '4db379ec', '8663c5b8'],
  archipelago: ['75e116b1', 'b4f18497', 'a7bdfed3'], islands: ['6b0f5d38', 'e1cb450f', 'd6cb3395'], inland: ['02a7f2fc', '77ea0dea', '2aac12a2']
};

const worlds = {};
let grid;
beforeAll(() => {
  grid = gridOf(getTiles());
  [1, 2, 3].forEach((seed) => { worlds[seed] = generateWorld({ kind: 'generated', generatorVersion: 1, seed, params: {} }, grid); });
}, 120000);

describe('integer noise', () => {
  it('is the same for the same point and salt, and stays in range', () => {
    expect(gnoise(123456, -654321, 99999, 7)).toBe(gnoise(123456, -654321, 99999, 7));
    const f = makeField(5, 16, 4);
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i < 5000; i++) { const v = f((i * 37) % ONE, ((i * 91) % ONE) - 30000, 1000 + i); lo = Math.min(lo, v); hi = Math.max(hi, v); expect(Number.isInteger(v)).toBe(true); }
    expect(lo).toBeGreaterThan(-ONE); expect(hi).toBeLessThan(ONE);
    expect(hi - lo).toBeGreaterThan(ONE / 4); // not flat
  });
});

describe('world generator v1', () => {
  it('matches the golden hashes (generator version 1 is frozen)', () => {
    Object.entries(GOLDEN_V1).forEach(([seed, hash]) => expect(worlds[seed].report.worldHash, `seed ${seed}`).toBe(hash));
  });

  it('gives the same bytes for the same seed, and different worlds for different seeds', () => {
    const again = generateWorld({ kind: 'generated', generatorVersion: 1, seed: 2, params: {} }, grid);
    expect(worldHashOf(again.raw)).toBe(worlds[2].report.worldHash);
    expect(Buffer.from(encodeTiles(again.raw))).toEqual(Buffer.from(encodeTiles(worlds[2].raw)));
    expect(new Set(Object.values(worlds).map((w) => w.report.worldHash)).size).toBe(3);
  }, 60000);

  it('passes the quality checks: land share, continents, mountains in ranges, rivers, climate spread', () => {
    Object.values(worlds).forEach(({ raw, report }) => {
      expect(qualityProblems(report, raw.world.params)).toEqual([]);
      let land = 0; for (let i = 0; i < raw.count; i++) land += raw.land[i];
      expect(Math.abs((land / raw.count) * 100 - 30)).toBeLessThan(0.5);
      expect(report.continents).toBeGreaterThanOrEqual(2);
      expect(report.mountainsInRanges).toBeGreaterThan(0.7);
      expect(report.riverShare).toBeGreaterThan(0.3);
      expect(report.riverShare).toBeLessThan(0.45);
      expect(report.koppenMax).toBeLessThan(0.5);
      expect(report.passes).toBeGreaterThan(10);
    });
  });

  it('honours the parameters: land share and continents', () => {
    const dry = generateWorld({ kind: 'generated', generatorVersion: 1, seed: 9, params: { land: 40, continents: 2, climate: 'hot', rainfall: 'dry' } }, grid);
    let land = 0; for (let i = 0; i < dry.raw.count; i++) land += dry.raw.land[i];
    expect(Math.abs((land / dry.raw.count) * 100 - 40)).toBeLessThan(0.5);
    expect(dry.report.continents).toBeGreaterThanOrEqual(1);
    expect(dry.report.continents).toBeLessThanOrEqual(4);
    expect(dry.report.desertShare).toBeGreaterThan(worlds[1].report.desertShare);
  }, 60000);

  it('every river runs downhill along hex edges to the sea or a lake', () => {
    const { raw } = worlds[1];
    const G = prepareGrid(grid);
    const C = _internals.prepareCorners(G);
    const isRiver = (e) => (raw.rivers[C.eA[e]] >> C.eKA[e]) & 1;
    const wet = (c) => [0, 1, 2].some((t) => { const i = C.cells[3 * c + t]; return raw.land[i] !== 1 || raw.terrain[i] === 2; });
    // Corner components joined by river edges: each must touch a wet corner (sea or lake).
    const parent = new Int32Array(C.nc).map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    let riverEdges = 0;
    for (let c = 0; c < C.nc; c++) for (let t = 0; t < 3; t++) {
      const e = C.linkEdge[3 * c + t]; const d = C.linkNb[3 * c + t];
      if (e >= 0 && d > c && isRiver(e)) { riverEdges++; parent[find(c)] = find(d); }
    }
    const touchesWater = new Set();
    for (let c = 0; c < C.nc; c++) if (wet(c)) touchesWater.add(find(c));
    let dry = 0;
    for (let c = 0; c < C.nc; c++) for (let t = 0; t < 3; t++) {
      const e = C.linkEdge[3 * c + t];
      if (e >= 0 && isRiver(e) && !touchesWater.has(find(c))) dry++;
    }
    expect(riverEdges).toBeGreaterThan(5000);
    expect(dry).toBe(0);
    // Size classes on every river edge, none elsewhere.
    let mismatched = 0;
    for (let i = 0; i < raw.count; i++) for (let k = 0; k < 6; k++) {
      const has = (raw.rivers[i] >> k) & 1; const size = (raw.riverSize[i] >> (2 * k)) & 3;
      if (!!has !== size > 0) mismatched++;
    }
    expect(mismatched).toBe(0);
  }, 60000);

  it('has the terrain columns, names and fair start sites the engine reads', () => {
    const { raw } = worlds[3];
    expect(raw.climateNames).toHaveLength(30);
    expect(raw.range.length).toBe(raw.count);
    expect(raw.rangeNames.filter(Boolean).length).toBeGreaterThan(5);
    expect(Object.keys(raw.names).length).toBeGreaterThan(3000);
    expect(Object.keys(raw.riverNames).length).toBeGreaterThan(500);
    expect(raw.capitals).toEqual({});
    expect(raw.starts.majors).toHaveLength(42);
    expect(raw.starts.candidates.length).toBeGreaterThan(1000);
    // Every major site: land with room around it.
    const t = tilesFromRaw(raw);
    raw.starts.majors.forEach((s) => {
      expect(t.isLand(s)).toBe(true);
      expect(t.terrainOf(s)).not.toBe('lake');
      const room = t.neighbors[s].filter((j) => t.isLand(j) && t.terrainOf(j) !== 'lake').length;
      expect(room).toBeGreaterThanOrEqual(2);
    });
    expect(worlds[3].report.startSpread).toBeLessThan(0.15);
  });

  it('round-trips through the tiles binary and builds a hex coast', () => {
    const { raw, report } = worlds[2];
    const back = decodeTiles(encodeTiles(raw));
    expect(worldHashOf(back)).toBe(report.worldHash);
    expect(back.world.worldHash).toBe(report.worldHash);
    expect(back.starts.majors).toEqual(raw.starts.majors);
    const land = buildHexLand(tilesFromRaw(back), { chunked: false });
    expect(land.length).toBeGreaterThan(5);
  }, 60000);
});

describe('world generator v2 (the look pass and the shapes)', () => {
  it('matches the golden hashes of every shape (generator version 2 is frozen)', () => {
    Object.entries(GOLDEN_V2).forEach(([shape, hashes]) => hashes.forEach((hash, k) => {
      if (shape !== 'continents' && k > 0) return; // one seed a shape here; the bench checks the rest
      const w = generateWorld({ kind: 'generated', generatorVersion: 2, seed: k + 1, params: { shape } }, grid);
      expect(w.report.worldHash, `${shape} seed ${k + 1}`).toBe(hash);
    }));
  }, 240000);

  it('has no land specks of up to six hexes and no small enclosed seas; the land share stays exact', () => {
    const { raw, report } = generateWorld({ kind: 'generated', generatorVersion: 2, seed: 2, params: {} }, grid);
    expect(qualityProblems(report, raw.world.params)).toEqual([]);
    const nb = prepareGrid(grid).nb;
    const comp = new Int32Array(raw.count).fill(-1); const sizes = [];
    for (let s = 0; s < raw.count; s++) {
      if (comp[s] >= 0) continue;
      const q = [s]; comp[s] = sizes.length;
      for (let h = 0; h < q.length; h++) for (const j of nb[q[h]]) if (comp[j] < 0 && raw.land[j] === raw.land[s]) { comp[j] = sizes.length; q.push(j); }
      sizes.push({ land: raw.land[s], size: q.length });
    }
    const seas = sizes.filter((c) => !c.land).sort((a, b) => b.size - a.size);
    expect(sizes.filter((c) => c.land && c.size <= 6)).toEqual([]);
    // (a stray walled-in sea hex or two can remain; they paint like a lake)
    expect(seas.slice(1).filter((c) => c.size < 250).reduce((a, c) => a + c.size, 0)).toBeLessThan(6);
    let land = 0; for (let i = 0; i < raw.count; i++) land += raw.land[i];
    expect(Math.abs((land / raw.count) * 100 - 30)).toBeLessThan(0.5);
  }, 60000);

  it('shapes: a pangaea is one landmass, islands are many small ones, the inland sea is enclosed', () => {
    const pan = generateWorld({ kind: 'generated', generatorVersion: 2, seed: 1, params: { shape: 'pangaea' } }, grid).report;
    const isl = generateWorld({ kind: 'generated', generatorVersion: 2, seed: 1, params: { shape: 'islands' } }, grid).report;
    expect(pan.largestShare).toBeGreaterThan(0.9);
    expect(isl.largestShare).toBeLessThan(0.35);
    const inland = generateWorld({ kind: 'generated', generatorVersion: 2, seed: 1, params: { shape: 'inland' } }, grid).raw;
    let deepInland = 0;
    for (let i = 0; i < inland.count; i++) if (!inland.land[i] && inland.elevation[i] <= -1000) deepInland++;
    expect(deepInland).toBeGreaterThan(100);
  }, 120000);
});

describe('the painter (MV4, first CPU version)', () => {
  it('paints the base picture: land where the land is, sea elsewhere', () => {
    const tiles = tilesFromRaw(worlds[1].raw);
    const W = 256; const H = 128;
    const rgba = paintWorld(tiles, W, H);
    expect(rgba.length).toBe(W * H * 4);
    // Pixels over land tiles are mostly not ocean blue, pixels over deep sea are.
    let landOk = 0; let landN = 0; let seaOk = 0; let seaN = 0;
    for (let y = 8; y < H - 8; y += 3) for (let x = 0; x < W; x += 3) {
      const id = tiles.nearest(90 - ((y + 0.5) / H) * 180, ((x + 0.5) / W) * 360 - 180);
      const o = (y * W + x) * 4; const blue = rgba[o + 2] > rgba[o] + 40 && rgba[o + 2] > rgba[o + 1];
      if (tiles.land[id] === 1 && tiles.terrainOf(id) !== 'lake') { landN++; if (!blue) landOk++; } else if (tiles.elevation[id] < -1000) { seaN++; if (blue) seaOk++; }
    }
    expect(landOk / landN).toBeGreaterThan(0.8);
    expect(seaOk / seaN).toBeGreaterThan(0.9);
  }, 60000);
});

describe('cross-engine determinism of the rules-facing pass', () => {
  it('uses no transcendental Math, randomness or clocks (exact operations only, plan 4.4)', () => {
    const unsafe = /\bMath\.(acos|asin|atan2?|sinh?|cosh?|tanh?|exp|expm1|log1p|log2|log10|log|pow|cbrt|hypot)\s*\(|\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(|\*\*\s*(?!\d+(?![.\d]))[\w(.-]/;
    const files = ['worldgen/v1/noise.js', 'worldgen/v1/generate.js', 'worldgen/v1/startSites.js', 'worldgen/spec.js', 'worldgen/index.js', 'worldgen/names.js', 'data/geo/classifyTile.js', 'data/geo/terrainColumns.js', 'engine/worldgen/generatedPeoples.js', 'engine/world/cultureZones.js'];
    const hits = files.flatMap((f) => fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').map((line, i) => (!/^\s*(\/\*|\*)/.test(line) && unsafe.test(line.replace(/\/\/.*$/, '')) ? `${f}:${i + 1} ${line.trim()}` : null)).filter(Boolean));
    expect(hits).toEqual([]);
  });
});

describe('the world descriptor', () => {
  it('map codes carry the whole spec', () => {
    const spec = normalizeSpec({ kind: 'generated', seed: 123456789, params: { land: 37, continents: 5, climate: 'cold', rainfall: 'wet' } });
    const code = mapCode(spec);
    expect(code).toMatch(/^G2-37-5C-W-/);
    const old = normalizeSpec({ kind: 'generated', generatorVersion: 1, seed: 5, params: {} });
    expect(parseMapCode(mapCode(old))).toEqual(old);
    expect(specKey(old)).toBe('gen1:5:30:0:temperate:normal'); // version 1 cache keys unchanged
    const shaped = normalizeSpec({ kind: 'generated', seed: 77, params: { shape: 'inland', relief: 'high' } });
    expect(mapCode(shaped)).toMatch(/^G2-30-AT-NSH-/);
    expect(parseMapCode(mapCode(shaped))).toEqual(shaped);
    expect(parseMapCode(code)).toEqual(spec);
    expect(specKey(parseMapCode(code))).toBe(specKey(spec));
    expect(parseMapCode('nonsense')).toBeNull();
    expect(mapCode({ kind: 'earth' })).toBe('EARTH');
    expect(normalizeSpec(undefined)).toEqual({ kind: 'earth' });
  });
});
