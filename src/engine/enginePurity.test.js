// src/engine/enginePurity.test.js
// Plan §13's "engine purity guard": src/engine/** must import nothing from React, browser
// rendering packages, or the app's UI layer (components/context) — that's the whole basis for the
// server-authoritative multiplayer story (plan §10): the same engine module has to run unmodified
// in a Node edge function replaying client actions, with no DOM and no React runtime available.
//
// This walks the REAL import graph starting from src/engine/** (transitively, through
// src/data/** and src/utils/**, wherever the engine's own code actually leads) rather than only
// checking the engine files' own import lines — a violation two hops deep (engine -> data ->
// component, say) would be just as fatal to running server-side as a direct one.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = __dirname;

// Anything that only exists to render pixels or read/write the DOM — none of it can load in a
// headless Node process, which is exactly the environment the engine must run in server-side.
const FORBIDDEN_BARE_PACKAGES = ['react', 'react-dom', 'react-dom/client', 'react-globe.gl', 'globe.gl', 'three', 'lucide-react'];
// The UI layer: React components and the context/providers that wrap browser-only concerns
// (localStorage, window, DOM refs). The engine may be CALLED by these, but must never call INTO them.
const FORBIDDEN_DIRS = [path.join(SRC_ROOT, 'components'), path.join(SRC_ROOT, 'context')];

const IMPORT_RE = /(?:^|\n)\s*import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;

const isJsSource = (name) => /\.(js|jsx)$/.test(name) && !name.endsWith('.test.js');

const collectFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return collectFiles(full);
  return isJsSource(entry.name) ? [full] : [];
});

const resolveRelativeImport = (fromFile, spec) => {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')];
  return candidates.find((c) => fs.existsSync(c)) || base;
};

// The tactical-battle simulation (src/battle/sim, setup, data) must be just as pure: it runs in a
// Web Worker, in tests, and later server-side for replay verification (Tactical Battles plan §3).
const BATTLE_PURE_DIRS = ['sim', 'setup', 'data'].map((d) => path.join(SRC_ROOT, 'battle', d));
// Anything non-deterministic or environment-bound breaks exact replays.
const NONDETERMINISTIC_RE = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(|\bnew Date\s*\(|\bwindow\.|\bdocument\./;

const findImportOffenders = (roots) => {
  const offenders = [];
  const visited = new Set();
  const queue = roots.flatMap((dir) => (fs.existsSync(dir) ? collectFiles(dir) : []));
  while (queue.length) {
    const file = queue.pop();
    if (visited.has(file) || !fs.existsSync(file)) continue;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    let match;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(source))) {
      const spec = match[1];
      if (FORBIDDEN_BARE_PACKAGES.includes(spec)) { offenders.push(`${path.relative(SRC_ROOT, file)} imports forbidden package "${spec}"`); continue; }
      if (!spec.startsWith('.')) continue;
      const resolved = resolveRelativeImport(file, spec);
      if (FORBIDDEN_DIRS.some((dir) => resolved.startsWith(dir + path.sep))) { offenders.push(`${path.relative(SRC_ROOT, file)} imports from ${path.relative(SRC_ROOT, resolved)}`); continue; }
      if (resolved.startsWith(SRC_ROOT) && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return offenders;
};

describe('tactical battle sim purity guard', () => {
  it('src/battle/{sim,setup,data} never reach into React, rendering packages or the UI layer', () => {
    expect(findImportOffenders(BATTLE_PURE_DIRS)).toEqual([]);
  });

  it('src/battle/{sim,setup,data} use no randomness, clocks or browser globals (replays must be exact)', () => {
    const offenders = BATTLE_PURE_DIRS.flatMap((dir) => (fs.existsSync(dir) ? collectFiles(dir) : []))
      .filter((file) => NONDETERMINISTIC_RE.test(fs.readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '')))
      .map((file) => path.relative(SRC_ROOT, file));
    expect(offenders).toEqual([]);
  });
});

describe('engine purity guard', () => {
  it('src/engine/** and everything it transitively imports never reaches into React, a rendering package, or the UI layer', () => {
    const offenders = [];
    const visited = new Set();
    const queue = collectFiles(ENGINE_DIR);

    while (queue.length) {
      const file = queue.pop();
      if (visited.has(file) || !fs.existsSync(file)) continue;
      visited.add(file);
      const source = fs.readFileSync(file, 'utf8');

      let match;
      IMPORT_RE.lastIndex = 0;
      while ((match = IMPORT_RE.exec(source))) {
        const spec = match[1];
        if (FORBIDDEN_BARE_PACKAGES.includes(spec)) {
          offenders.push(`${path.relative(SRC_ROOT, file)} imports forbidden package "${spec}"`);
          continue;
        }
        if (!spec.startsWith('.')) continue; // some other bare dependency — fine, not a UI/DOM package
        const resolved = resolveRelativeImport(file, spec);
        if (FORBIDDEN_DIRS.some((dir) => resolved.startsWith(dir + path.sep))) {
          offenders.push(`${path.relative(SRC_ROOT, file)} imports from ${path.relative(SRC_ROOT, resolved)} (outside engine/data/utils)`);
          continue;
        }
        if (resolved.startsWith(SRC_ROOT) && !visited.has(resolved)) queue.push(resolved);
      }
    }

    expect(offenders).toEqual([]);
  });
});
