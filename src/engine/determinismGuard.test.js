// src/engine/determinismGuard.test.js
// Cross-engine determinism guard (plans/math-ideas.md, 10.3). IEEE 754 makes + - * / and
// Math.sqrt exactly rounded on every JavaScript engine; the transcendental functions are not, so
// V8 (Chrome, Android, Node) and JavaScriptCore (the iPhone app) may disagree in the last bit, and
// one flipped comparison desyncs a replay or a shared save. This walks src/engine/** and every
// file it transitively imports and fails on a call whose result can differ between engines, on
// randomness and on clocks. Game maths uses src/utils/exactMath.js instead (sinCosDeg, asinExact,
// logExact, expExact, powExact, log10Exact).
//
// A line may opt out with a `determinism-ok: <reason>` comment (a timing read, an off-table
// fallback). Files that the engine imports but only use these calls for drawing, building data
// or display text are listed in RENDER_ONLY with the reason; their engine-facing functions are
// checked one by one below.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { distanceKm, fromLatLonExact } from '../data/geo/geodesic';
import { getTiles } from '../data/geo/tiles';
import { gridSpacing } from '../data/geo/gridScale';
import * as exact from '../utils/exactMath';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

// Unsafe: transcendental Math functions, randomness, clocks, and `**` with anything but a whole
// literal exponent (x ** 2 is fine; x ** 1.8 and x ** t are not).
const UNSAFE = [
  [/\bMath\.(acos|asin|atan2?|sinh?|cosh?|tanh?|asinh|acosh|atanh|exp|expm1|log1p|log2|log10|log|pow|cbrt|hypot)\s*\(/, 'transcendental Math call'],
  [/\bMath\.random\s*\(/, 'Math.random'],
  [/\bDate\.now\s*\(|\bnew Date\s*\(/, 'clock'],
  [/\bperformance\.now\s*\(/, 'clock'],
  [/\*\*\s*(?!\d+(?![.\d]))[\w(.-]/, '** with a non-integer exponent']
];

const RENDER_ONLY = {
  'data/geo/geodesic.js': 'grid building and drawing (buildGrid, fromLatLon, toLatLon); the engine uses distanceKm and fromLatLonExact, checked below',
  'data/geo/hexCoast.js': 'the softened coast drawn on the map',
  'data/geo/tileGeometry.js': 'GeoJSON for drawing territories and borders',
  'data/geo/rasterTiles.js': 'which raster zoom level to draw',
  'data/historicalPopulation.js': 'display population only (never fed back into state)'
};

// Reviewed lines in files other sessions own, matched by content so line moves do not matter.
const ALLOWED = [
  ['engine/resolveTurn.js', /performance\.now\(\)/, 'phase timing for the perf log, never read by game logic'],
  ['utils/aiLogic.js', /DEFAULT_RNG = \{ next: \(\) => Math\.random\(\) \}/, 'a default for direct test calls; resolveTurn always passes the seeded rng'],
  ['engine/worker/turn.worker.js', /performance.now()/, 'the turn log timing a turn (turnClient diagnostics), never read by game logic'],
  ['utils/rng.js', /export const randomSeed = /, 'the seed of a fresh game, chosen once before any game logic runs']
];

// The tactical battle (src/battle/) has its own determinism plan (integer fixed point,
// src/battle/sim/fixed.js) and owners; its setup still uses atan2/hypot/cos for the battlefield
// layout (plans/math/grid-math.md lists them). This guard covers the macro engine.
const OUT_OF_SCOPE = ['battle/'];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const isJsSource = (name) => /\.(js|jsx)$/.test(name) && !name.endsWith('.test.js');
const collectFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return collectFiles(full);
  return isJsSource(entry.name) ? [full] : [];
});
const resolveRelativeImport = (fromFile, spec) => {
  const base = path.resolve(path.dirname(fromFile), spec);
  return [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || base;
};

// Every source file src/engine/** reaches through relative imports.
const engineGraph = () => {
  const visited = new Set();
  const queue = collectFiles(__dirname);
  while (queue.length) {
    const file = queue.pop();
    if (visited.has(file) || !fs.existsSync(file) || !isJsSource(path.basename(file))) continue;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    let m; IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(source))) {
      if (!m[1].startsWith('.')) continue;
      const resolved = resolveRelativeImport(file, m[1]);
      if (resolved.startsWith(SRC_ROOT) && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return [...visited].sort();
};

// The code of a file with the opted-out lines blanked and comments removed, line numbers kept.
// Split on CRLF too: on a Windows checkout the trailing \r stopped `.*$` from reaching the end of
// a line, so comments that mention Math.random() were read as code.
const codeLines = (source) => source
  .split(/\r?\n/).map((line) => (line.includes('determinism-ok:') ? '' : line)).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .split('\n').map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'));

const unsafeMathOffenders = (files) => {
  const out = [];
  files.forEach((file) => {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join('/');
    if (RENDER_ONLY[rel] || OUT_OF_SCOPE.some((dir) => rel.startsWith(dir))) return;
    codeLines(fs.readFileSync(file, 'utf8')).forEach((line, i) => {
      if (ALLOWED.some(([f, re]) => f === rel && re.test(line))) return;
      UNSAFE.forEach(([re, what]) => { if (re.test(line)) out.push(`${rel}:${i + 1} ${what}: ${line.trim().slice(0, 100)}`); });
    });
  });
  return out;
};

describe('cross-engine determinism guard', () => {
  it('src/engine/** and everything it imports use no transcendental Math, randomness or clocks', () => {
    const files = engineGraph();
    expect(files.length).toBeGreaterThan(100);
    expect(unsafeMathOffenders(files)).toEqual([]);
  });

  it('the guard catches what it should and lets through what it should', () => {
    const tmp = path.join(__dirname, '__guard_probe__.js');
    const probe = ['const a = Math.acos(x);', 'const b = y ** 1.8;', 'const c = y ** t;', 'const d = Math.random();', 'const e = y ** 2;', 'const f = Math.sqrt(z) * Math.floor(w);', '// Math.exp(1) in a comment', 'const g = Math.log(q); // determinism-ok: test', '/** a doc comment */'].join('\n');
    try {
      fs.writeFileSync(tmp, probe);
      expect(unsafeMathOffenders([tmp]).map((s) => s.split(' ')[0].split(':').pop())).toEqual(['1', '2', '3', '4']);
    } finally { fs.rmSync(tmp, { force: true }); }
  });

  it('the grid helpers the engine calls are built from exact operations only', () => {
    [distanceKm, fromLatLonExact, ...Object.values(exact)].forEach((fn) => {
      const src = fn.toString();
      UNSAFE.forEach(([re]) => expect(re.test(src), `${fn.name}: ${src.slice(0, 80)}`).toBe(false));
    });
  });

  it('tile centres come from the exact trigonometry', () => {
    const tiles = getTiles();
    for (let i = 0; i < tiles.count; i += 997) {
      expect(tiles.centres[i]).toEqual(fromLatLonExact(tiles.lat[i] / 1000, tiles.lon[i] / 1000));
    }
  });

  it('exact maths agrees with Math to about 1e-14', () => {
    for (let d = -400; d <= 400; d += 0.37) {
      const [s, c] = exact.sinCosDeg(d); const r = (d * Math.PI) / 180;
      expect(Math.abs(s - Math.sin(r))).toBeLessThan(1e-14);
      expect(Math.abs(c - Math.cos(r))).toBeLessThan(1e-14);
    }
    for (let x = -1; x <= 1; x += 0.013) expect(Math.abs(exact.asinExact(x) - Math.asin(x))).toBeLessThan(1e-14);
    for (let x = 1e-3; x < 1e9; x *= 1.7) {
      expect(Math.abs(exact.logExact(x) - Math.log(x))).toBeLessThan(1e-13);
      expect(Math.abs(exact.powExact(x, 1.15) / x ** 1.15 - 1)).toBeLessThan(1e-13);
    }
    for (let x = -30; x <= 30; x += 0.7) expect(Math.abs(exact.expExact(x) / Math.exp(x) - 1)).toBeLessThan(1e-13);
    [1, 10, 1000, 1e6].forEach((x, i) => expect(exact.log10Exact(x)).toBe([0, 1, 3, 6][i]));
  });

  it('distanceKm matches the great circle (acos) to a millimetre on neighbouring tiles', () => {
    const tiles = getTiles();
    const { centres, neighbors } = tiles;
    for (let i = 0; i < tiles.count; i += 211) {
      neighbors[i].forEach((j) => {
        const a = centres[i]; const b = centres[j];
        const dot = Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
        expect(Math.abs(distanceKm(a, b) - Math.acos(dot) * 6371)).toBeLessThan(1e-6);
      });
    }
    expect(gridSpacing(tiles).meanKm).toBeGreaterThan(0);
  });
});
