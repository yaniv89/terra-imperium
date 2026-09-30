#!/usr/bin/env node
// scripts/fetch-models.js
// Fills the battle's whole unit roster — every {age}-{class} of the 5 ages × infantry, ranged,
// cavalry, siege (+ modern support) — from free CC0 low-poly models, so no unit uses the procedural
// placeholder soldier.
//
//   node scripts/fetch-models.js                 fetch the CC0 archetypes + write every recipe
//   node scripts/fetch-models.js --from <dir>    also import your own GLBs (e.g. an unzipped
//                                               Quaternius or Kenney pack) into the archetype pool
//   node scripts/fetch-models.js --check         only report what the matrix resolves to
//
// How the matrix is filled. CC0 packs don't come with one model per age and unit type, so the
// script downloads a few ARCHETYPES (a rigged soldier with an idle/sit/walk clip set, weapons, a
// truck, blasters) into src/assets/units/_src/ and writes a small JSON RECIPE for every slot
// ({age}-{class}.json) that dresses an archetype for it: weapons and shields in its hands, a seat on
// an animated horse or chariot, the crew of a siege engine, a turret on a truck. The game bakes each
// recipe into one instanced, vertex-coloured, team-coloured geometry at load time
// (src/battle/render/unitComposer.js) — one archetype file serves all twenty slots instead of twenty
// copies of it in the app bundle.
//
// Where the models come from. Kenney's CC0 packs, fetched from Kenney's own public GitHub starter
// kits (the kits' code is MIT; every model in them is CC0 — see their License.txt). Kenney's and
// Quaternius's websites host the full packs as zip downloads whose URLs change between releases, so
// they aren't hard-coded here: download a pack, unzip it, and pass it with --from (any *.glb found
// is added to the archetype pool under its file name; point a recipe's "base" or "model" at it).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNITS = path.join(ROOT, 'src/assets/units');
const SRC = path.join(UNITS, '_src');

// ---- the CC0 archetypes ---------------------------------------------------------------------

const KENNEY = 'https://raw.githubusercontent.com/KenneyNL';
export const ARCHETYPES = [
  { name: 'character-soldier', repo: 'Starter-Kit-Basic-Scene', file: 'sample/Mini Arena/Models/GLB format/character-soldier.glb', pack: 'Kenney Mini Arena' },
  { name: 'weapon-spear', repo: 'Starter-Kit-Basic-Scene', file: 'sample/Mini Arena/Models/GLB format/weapon-spear.glb', pack: 'Kenney Mini Arena' },
  { name: 'weapon-sword', repo: 'Starter-Kit-Basic-Scene', file: 'sample/Mini Arena/Models/GLB format/weapon-sword.glb', pack: 'Kenney Mini Arena' },
  { name: 'blaster-repeater', repo: 'Starter-Kit-FPS', file: 'models/blaster-repeater.glb', pack: 'Kenney Blaster Kit' },
  { name: 'vehicle-truck-green', repo: 'Starter-Kit-Racing', file: 'models/vehicle-truck-green.glb', pack: 'Kenney Car Kit' }
];

// ---- the recipes: every {age}-{class} slot ----------------------------------------------------
// Offsets and scales are in the soldier archetype's own units (it stands ~0.84 tall, faces +Z,
// right hand toward −X). Rotations are world-space Euler angles in radians.
const SOLDIER = { base: 'character-soldier', teamFrom: 'torso', restClip: 'idle' };
const spear = (scale = 1.3) => ({ model: 'weapon-spear', hand: 'right', at: [0, -0.2 * scale, 0.02], rotation: [0.12, 0, 0], scale });
const sword = { model: 'weapon-sword', hand: 'right', at: [0, 0, 0.02], rotation: [-2.1, 0, 0], scale: 1 };
const shield = { prop: 'shield', hand: 'left', at: [0.02, 0.02, 0.07], scale: 0.9 };
const bow = { prop: 'bow', hand: 'left', at: [0, 0.04, 0.05], scale: 0.9 };
const musket = { prop: 'musket', hand: 'right', at: [0, 0, 0.02], rotation: [-0.3, 0, 0], scale: 0.8 };
const rifle = { model: 'blaster-repeater', hand: 'right', at: [0, 0, 0.04], rotation: [-0.15, 0, 0], scale: 0.28 };
const launcher = { prop: 'launcher', hand: 'right', at: [0, 0.14, 0], scale: 0.7 };
const soldier = (...attach) => ({ ...SOLDIER, attach });
const rider = (kind, ...attach) => ({ ...SOLDIER, mount: { kind }, attach });
const crewed = { ...SOLDIER, engine: 'siege', crew: [[-0.6, -0.85], [0.6, -0.85]] };

export const RECIPES = {
  'bronze-infantry': soldier(spear(1.4), shield),
  'classical-infantry': soldier(sword, shield),
  'kingdoms-infantry': soldier(spear(1.9)),
  'gunpowder-infantry': soldier(musket),
  'modern-infantry': soldier(rifle),
  'bronze-ranged': soldier(bow),
  'classical-ranged': soldier(bow),
  'kingdoms-ranged': soldier(bow),
  'gunpowder-ranged': soldier(musket),
  'modern-ranged': soldier(launcher),
  'bronze-cavalry': rider('chariot', spear(1.3)),
  'classical-cavalry': rider('horse', spear(1.4)),
  'kingdoms-cavalry': rider('warhorse', spear(1.8), shield),
  'gunpowder-cavalry': rider('darkhorse', musket),
  // Modern cavalry is armour: the CC0 truck as an armoured car, with a turret and team plate.
  'modern-cavalry': { base: 'vehicle-truck-green', teamFrom: 'body', height: 0.85, attach: [{ prop: 'turret', to: 'root', at: [0, 0.5, -0.1], scale: 1.1 }] },
  'bronze-siege': crewed,
  'classical-siege': crewed,
  'kingdoms-siege': crewed,
  'gunpowder-siege': crewed,
  'modern-siege': crewed,
  'modern-support': { base: 'vehicle-truck-green', teamFrom: 'body', height: 0.8 }
};

// ---- download --------------------------------------------------------------------------------

const has = (cmd) => { try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };

// curl honours HTTPS_PROXY (corporate / sandboxed networks); Node's fetch doesn't, so it's the fallback.
const download = async (url, dest) => {
  if (has('curl')) {
    execFileSync('curl', ['-fsSL', '--retry', '3', '-o', dest, url], { stdio: ['ignore', 'ignore', 'pipe'] });
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
};

// Last resort for one file: a shallow, sparse clone of its repository (works wherever git does).
const viaGit = (a, dest) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'units-'));
  try {
    execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', `https://github.com/KenneyNL/${a.repo}`, tmp], { stdio: 'ignore' });
    execFileSync('git', ['-C', tmp, 'sparse-checkout', 'set', '--no-cone', a.file], { stdio: 'ignore' });
    fs.copyFileSync(path.join(tmp, a.file), dest);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
};

// Kenney's GLBs point at an external Textures/colormap.png (a palette, per pack). A bundler renames
// assets, so a relative texture URI would 404 — and every pack's colormap.png has the same name. So
// each image a GLB references is fetched and EMBEDDED into its binary chunk (pure Node, no deps).
export const embedGlbImages = async (glb, fetchImage) => {
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  let bin = binStart + 8 <= glb.length ? glb.subarray(binStart + 8, binStart + 8 + glb.readUInt32LE(binStart)) : Buffer.alloc(0);
  const pad4 = (b, fill = 0) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
  let changed = false;
  for (const img of json.images || []) {
    if (!img.uri || img.uri.startsWith('data:')) continue;
    const data = await fetchImage(decodeURIComponent(img.uri));
    bin = pad4(bin);
    json.bufferViews = json.bufferViews || [];
    json.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: data.length });
    bin = Buffer.concat([bin, data]);
    img.bufferView = json.bufferViews.length - 1;
    img.mimeType = /\.jpe?g$/i.test(img.uri) ? 'image/jpeg' : 'image/png';
    delete img.uri;
    changed = true;
  }
  if (!changed) return glb;
  bin = pad4(bin);
  json.buffers = json.buffers?.length ? json.buffers : [{}];
  json.buffers[0] = { ...json.buffers[0], byteLength: bin.length };
  delete json.buffers[0].uri;
  const jsonBuf = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const header = Buffer.alloc(12); header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4);
  const chunk = (buf, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(buf.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, buf]); };
  const out = Buffer.concat([header, chunk(jsonBuf, 'JSON'), chunk(bin, 'BIN\0')]);
  out.writeUInt32LE(out.length, 8);
  return out;
};

const hasExternalImages = (file) => {
  const b = fs.readFileSync(file);
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return (json.images || []).some((i) => i.uri && !i.uri.startsWith('data:'));
};

const isGlb = (file) => { try { const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(4); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); return b.toString('latin1') === 'glTF'; } catch { return false; } };

const fetchArchetypes = async () => {
  fs.mkdirSync(SRC, { recursive: true });
  const got = []; const failed = [];
  const rawUrl = (a, file) => `${KENNEY}/${a.repo}/main/${file.split('/').map(encodeURIComponent).join('/')}`;
  for (const a of ARCHETYPES) {
    const dest = path.join(SRC, `${a.name}.glb`);
    if (isGlb(dest) && !hasExternalImages(dest)) { got.push(a.name); continue; }
    try {
      if (!isGlb(dest)) {
        try { await download(rawUrl(a, a.file), dest); if (!isGlb(dest)) throw new Error('not a GLB'); } catch (e1) {
          try { viaGit(a, dest); } catch (e2) { throw new Error(`${e1.message.split('\n')[0]} / git: ${e2.message.split('\n')[0]}`); }
        }
      }
      // Embed the textures it references (resolved next to the model in its repository).
      const dir = path.posix.dirname(a.file);
      const embedded = await embedGlbImages(fs.readFileSync(dest), async (uri) => {
        const tmp = path.join(os.tmpdir(), `units-img-${process.pid}-${Math.random().toString(36).slice(2)}`);
        try { await download(rawUrl(a, path.posix.join(dir, uri)), tmp); return fs.readFileSync(tmp); } finally { fs.rmSync(tmp, { force: true }); }
      });
      fs.writeFileSync(dest, embedded);
      if (!isGlb(dest) || hasExternalImages(dest)) throw new Error('could not embed its textures');
      got.push(a.name);
    } catch (e) {
      fs.rmSync(dest, { force: true });
      failed.push(`${a.name}: ${e.message}`);
    }
  }
  return { got, failed };
};

// --from <dir>: every *.glb under it joins the archetype pool (named after its file).
const importFrom = (dir) => {
  const found = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.glb$/i.test(e.name)) { fs.copyFileSync(p, path.join(SRC, e.name.toLowerCase())); found.push(e.name); }
  });
  walk(path.resolve(dir));
  return found;
};

const writeCredits = () => {
  const packs = [...new Set(ARCHETYPES.map((a) => a.pack))];
  fs.writeFileSync(path.join(SRC, 'CREDITS.md'), `# Unit archetypes\n\nFetched by \`scripts/fetch-models.js\`. All models are CC0 (public domain):\n\n${packs.map((p) => `- ${p} — Kenney (www.kenney.nl), CC0 1.0`).join('\n')}\n\nSource: Kenney's public starter kits on GitHub (github.com/KenneyNL). Any other file here was imported with \`--from\`; check its own licence.\n`);
};

const writeRecipes = () => {
  Object.entries(RECIPES).forEach(([slot, recipe]) => {
    fs.writeFileSync(path.join(UNITS, `${slot}.json`), `${JSON.stringify(recipe, null, 2)}\n`);
  });
};

// Which slots resolve (their base and every model part is present).
export const checkMatrix = (available) => Object.entries(RECIPES).map(([slot, r]) => {
  const needs = [r.base, ...(r.attach || []).map((a) => a.model).filter(Boolean)];
  const missing = needs.filter((n) => !available.has(n));
  return { slot, ok: missing.length === 0, missing };
});

const main = async () => {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  if (!checkOnly) {
    const { got, failed } = await fetchArchetypes();
    console.log(`archetypes: ${got.length}/${ARCHETYPES.length} present${failed.length ? `\n  failed:\n  - ${failed.join('\n  - ')}` : ''}`);
    const fromIdx = args.indexOf('--from');
    if (fromIdx >= 0 && args[fromIdx + 1]) console.log(`imported ${importFrom(args[fromIdx + 1]).length} model(s) from ${args[fromIdx + 1]}`);
    writeCredits();
    writeRecipes();
  }
  const available = new Set(fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => /\.(glb|gltf)$/i.test(f)).map((f) => f.replace(/\.(glb|gltf)$/i, '')) : []);
  const report = checkMatrix(available);
  report.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.slot}${r.ok ? '' : ` (missing ${r.missing.join(', ')})`}`));
  const bad = report.filter((r) => !r.ok).length;
  console.log(bad ? `${bad} slot(s) fall back to the procedural model until their archetypes are present.` : `All ${report.length} slots resolve to CC0 models.`);
  if (bad && !checkOnly) process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
