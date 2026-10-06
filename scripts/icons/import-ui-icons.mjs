// scripts/icons/import-ui-icons.mjs
// Turns delivered 2D icons (art spec section 8) into the web assets under src/assets/icons/.
// Each delivered icon comes as plans/art/icons/<group>/<id>/source.svg (the authored vector) plus a
// 256px PNG and a white mask. The vector is what we ship: minified, one file per icon, crisp at any
// size; the mask is not shipped because its alpha equals the colour icon's (CSS mask-image on the
// colour file gives the same silhouette). A raster-only delivery (the icon redesign pilot: a PNG
// with no source.svg) is shipped as a 128px WebP and wins over a vector of the same id.
//
// Usage: node scripts/icons/import-ui-icons.mjs <unzipped-delivery-dir> [more dirs...]
// Unzip the delivery archives into a scratch dir outside the repo first; every dir is searched
// recursively for plans/art/icons/<group>/... Prints a size report per group.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'src', 'assets', 'icons');
const GROUPS = ['resources', 'improvements', 'buildings', 'wonders', 'units', 'ships', 'cities', 'ages', 'markers'];
const RASTER_PX = 128;

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};

/** Group and id of a delivered file, or null: .../icons/<group>/<id>/source.svg or .../icons/<group>/<id>.png */
const classify = (file) => {
  const parts = file.split(path.sep);
  const i = parts.lastIndexOf('icons');
  if (i < 0 || !GROUPS.includes(parts[i + 1])) return null;
  const rest = parts.slice(i + 2);
  if (rest.length === 2 && rest[1] === 'source.svg') return { group: parts[i + 1], id: rest[0], kind: 'svg' };
  if (rest.length === 1 && rest[0].endsWith('.png') && !rest[0].endsWith('-mask.png')) {
    return { group: parts[i + 1], id: rest[0].slice(0, -4), kind: 'png' };
  }
  return null;
};

const num = (s) => {
  const n = Math.round(Number(s) * 10) / 10;
  return String(n);
};
const tightPath = (d) => d
  .replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, num)
  .replace(/\s*([MLHVCSQTAZmlhvcsqtaz])\s*/g, '$1')
  .replace(/\s*,\s*/g, ',')
  .replace(/\s+/g, ' ')
  .replace(/ -/g, '-')
  .trim();

const ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform'];
// Values every path shares go on one wrapping <g>; a path keeps only what differs.
const minifySvg = (src) => {
  const paths = [...src.matchAll(/<path\b([^>]*?)\/>/g)].map(m => {
    const a = {};
    for (const [, k, v] of m[1].matchAll(/([a-z-]+)="([^"]*)"/g)) a[k] = v.trim();
    return a;
  });
  if (!paths.length || /<(?!path|svg|\/svg)[a-z]/i.test(src)) throw new Error('unexpected SVG content');
  const shared = {};
  for (const k of ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
    const counts = new Map();
    paths.forEach(p => { if (p[k] != null) counts.set(p[k], (counts.get(p[k]) || 0) + 1); });
    const [best] = [...counts.entries()].sort((x, y) => y[1] - x[1]);
    if (best) shared[k] = best[0];
  }
  // A transform can only be shared as a prefix of every path's own: keep the functions all share.
  const fns = paths.map(p => (p.transform || '').match(/[a-z]+\([^)]*\)/gi) || []);
  let common = 0;
  while (fns.every(f => f[common] && f[common] === fns[0][common])) common += 1;
  if (common) shared.transform = fns[0].slice(0, common).join(' '); else delete shared.transform;
  paths.forEach((p, i) => { p.transform = fns[i].join(' ') || undefined; });
  const g = Object.entries(shared).map(([k, v]) => `${k}="${v}"`).join(' ');
  const body = paths.map(p => {
    // The group's transform composes with a path's own, so a path keeps only what follows it.
    if (shared.transform && p.transform !== shared.transform) p.transform = p.transform.slice(shared.transform.length + 1);
    const attrs = ATTRS.filter(k => p[k] != null && p[k] !== shared[k])
      // A path with no stroke needs no stroke width.
      .filter(k => !(k === 'stroke-width' && p.stroke === 'none'))
      .map(k => ` ${k}="${p[k]}"`).join('');
    if (Object.keys(shared).some(k => k !== 'transform' && p[k] == null)) throw new Error('path without a shared attribute');
    return `<path d="${tightPath(p.d)}"${attrs}/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g ${g}>${body}</g></svg>`;
};

const main = async () => {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('usage: node scripts/icons/import-ui-icons.mjs <unzipped-delivery-dir>...');
    process.exit(1);
  }
  // A later dir replaces an earlier one's icon of the same id (list a redesign after the original).
  const found = new Map(); // group/id -> { svg, png }
  for (const dir of dirs) {
    const here = new Map();
    for (const f of walk(path.resolve(dir))) {
      const c = classify(f);
      if (!c) continue;
      const key = `${c.group}/${c.id}`;
      const entry = here.get(key) || { group: c.group, id: c.id };
      entry[c.kind] = f;
      here.set(key, entry);
    }
    for (const [key, entry] of here) found.set(key, entry);
  }
  for (const { group, id, svg, png } of found.values()) {
    if (!/^[a-z0-9_-]+$/.test(id)) throw new Error(`bad icon id ${group}/${id}`);
    fs.mkdirSync(path.join(OUT, group), { recursive: true });
    const base = path.join(OUT, group, id);
    let file;
    if (svg) {
      file = `${base}.svg`;
      fs.writeFileSync(file, minifySvg(fs.readFileSync(svg, 'utf8')));
      fs.rmSync(`${base}.webp`, { force: true });
    } else {
      // Raster only: a redesign with no vector source. It replaces any vector of the same id.
      file = `${base}.webp`;
      await sharp(png).resize(RASTER_PX, RASTER_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(file);
      fs.rmSync(`${base}.svg`, { force: true });
    }
  }
  let total = 0;
  for (const group of GROUPS) {
    const dir = path.join(OUT, group);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    const bytes = files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
    total += bytes;
    console.log(`${group.padEnd(13)} ${String(files.length).padStart(3)} files ${(bytes / 1024).toFixed(1).padStart(7)} KB`);
  }
  console.log(`${'total'.padEnd(13)}           ${(total / 1024).toFixed(1).padStart(7)} KB`);
};

main().catch(e => { console.error(e); process.exit(1); });
