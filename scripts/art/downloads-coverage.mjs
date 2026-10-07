// scripts/art/downloads-coverage.mjs
// Checks that every art item delivered in the ZIPs under plans/art/downloads is in the game, so the
// ZIPs can be purged from git history without losing art the game needs. ZIPs are no longer kept
// in git: a checkpoint folder (plans/art/downloads/<wave>/<checkpoint>/) holds a manifest.json whose
// items name their game file and their archive, and a SHA256SUMS.txt for the archives, which are
// GitHub release assets or a local copy outside the repository; those are checked from the
// manifest (manifestCoverage). For ZIPs still stored here it reads only each ZIP's
// file list (its central directory), maps every item folder inside (plans/art/kits/<style>/<age>/
// <part>, towns/<age>/<id>, buildings/<id>, wonders/<id>, improvements/<age>/<id>, icons/<group>/
// <id>) to the file the game ships, and lists the production-queue items marked built but not yet
// uploaded (those are not in any ZIP: they still have to come from the art agent).
//   node scripts/art/downloads-coverage.mjs           one line per ZIP, exit 1 if an item is missing
//   node scripts/art/downloads-coverage.mjs --items   also every item and its game file
// The ZIPs hold the editable sources (.blend, model.glb, build.py); the game ships the imported,
// packed result only. Keep a copy of the ZIPs outside git if the towns may need rebuilding.
import { closeSync, existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync } from 'node:fs';
import { posix } from 'node:path';
import { readGlbJson } from './glbInfo.mjs';

export const DOWNLOADS = 'plans/art/downloads';

/** File names in a ZIP file, from its central directory only (no extraction, no dependency). */
export const zipEntryNames = (file) => {
  const fd = openSync(file, 'r');
  try {
    const size = fstatSync(fd).size;
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    readSync(fd, tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error(`${file}: not a zip file`);
    const dirLen = tail.readUInt32LE(eocd + 12), dirAt = tail.readUInt32LE(eocd + 16);
    const dir = Buffer.alloc(dirLen);
    readSync(fd, dir, 0, dirLen, dirAt);
    return centralDirectoryNames(dir, tail.readUInt16LE(eocd + 10));
  } finally {
    closeSync(fd);
  }
};

/** The names of `count` central directory records. */
export const centralDirectoryNames = (buf, count) => {
  let p = 0;
  const names = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
};

// Sub-landmarks build their own town set (kingdoms-town-*-japan ...).
const SUB_STYLE = {
  'landmark-japan': 'japan', 'landmark-japan-pagoda': 'japan', 'landmark-japan-tenshu': 'japan', 'landmark-korea': 'korea',
  'landmark-east': 'easteurope', 'landmark-north': 'europenorth', 'landmark-colonies': 'colonies', 'landmark-pacific': 'pacific'
};
const SHARED_PARTS = new Set(['palace', 'palace-small', 'walls-medium']);

/** The item folder of a file inside a delivery ZIP, or null for loose files (README, audits,
 * repo-source scripts, before/after previews). Wonder tier preview folders fold into the wonder. */
export const itemOf = (entry) => {
  if (entry.endsWith('/')) return null;
  const m = entry.match(/^(plans\/art\/(?:kits\/[^/]+\/[^/]+(?:\/[^/]+)?|towns\/[^/]+\/[^/]+|buildings\/[^/]+|wonders\/[^/]+|improvements\/[^/]+\/[^/]+|icons\/[^/]+\/[^/]+))\//);
  if (m) return m[1];
  // An icon's flat renders beside its folder (plans/art/icons/ages/bronze.png, bronze-mask.png).
  const icon = entry.match(/^(plans\/art\/icons\/[^/]+\/[^/]+?)(?:-mask)?\.png$/);
  if (icon) return icon[1];
  // A street file's linked houses (dependencies/nile-modern-houses.blend).
  const dep = entry.match(/^dependencies\/([a-z]+)-([a-z]+)-houses\.blend$/);
  if (dep) return `plans/art/kits/${dep[1]}/${dep[2]}/houses`;
  // A kit's sheet files (plans/art/kits/levant/classical/street.png): the kit itself.
  const sheet = entry.match(/^(plans\/art\/kits\/[^/]+\/[^/]+)\/[^/]+\.[a-z]+$/);
  if (sheet) return sheet[1];
  const proto = entry.match(/^(indic-modern-five|rajput-palace)\//);
  return proto ? proto[1] : null;
};

/**
 * The game files an item becomes: { kind, files } where files are the candidates under src/assets
 * (any one present means the item is in the game). `list(dir)` lists a folder's file names.
 */
export const gameTargets = (item, list) => {
  const towns = (age, style) => list('src/assets/map/towns').filter((f) => new RegExp(`^${age}-town-(small|medium|big)-[ab]-${style}\\.glb$`).test(f)).map((f) => `src/assets/map/towns/${f}`);
  let m;
  if ((m = item.match(/^plans\/art\/kits\/([^/]+)\/([^/]+)\/([^/]+)$/))) {
    const [, style, age, part] = m;
    if (SHARED_PARTS.has(part)) return { kind: 'shared', files: [`src/assets/map/shared/shared-${age}-${style}.glb`] };
    return { kind: 'kit', files: towns(age, SUB_STYLE[part] || style) };
  }
  if ((m = item.match(/^plans\/art\/kits\/([^/]+)\/([^/]+)$/))) return { kind: 'kit', files: towns(m[2], m[1]) };
  if ((m = item.match(/^plans\/art\/towns\/([^/]+)\/(.+)$/))) {
    const [, age, id] = m;
    return { kind: 'shared', files: [id.endsWith('-israelite') ? `src/assets/map/shared/shared-${age}-israelite.glb` : `src/assets/map/shared/shared-${age}.glb`] };
  }
  if ((m = item.match(/^plans\/art\/buildings\/([^/]+)$/))) return { kind: 'building', files: [`src/assets/map/buildings/${m[1]}.glb`] };
  if ((m = item.match(/^plans\/art\/wonders\/([^/]+)$/))) return { kind: 'wonder', files: [`src/assets/map/wonders/${m[1]}.glb`] };
  if ((m = item.match(/^plans\/art\/improvements\/([^/]+)\/([^/]+)$/))) {
    const id = m[2], regional = id.endsWith('-israelite'), base = id.replace(/-israelite$/, '');
    const files = list('src/assets/map/improvements').filter((f) => (f === `${base}.glb` || f.startsWith(`${base}-`)) && f.includes('-israelite') === regional);
    return { kind: 'improvement', files: files.map((f) => `src/assets/map/improvements/${f}`) };
  }
  if ((m = item.match(/^plans\/art\/icons\/([^/]+)\/([^/]+)$/))) {
    const files = list(`src/assets/icons/${m[1]}`).filter((f) => f.replace(/\.(svg|webp|png)$/, '') === m[2]);
    return { kind: 'icon', files: files.map((f) => `src/assets/icons/${m[1]}/${f}`) };
  }
  // Early Blender prototypes, superseded by the production kits of the same region and age.
  if (item === 'indic-modern-five') return { kind: 'prototype', files: towns('modern', 'indic') };
  if (item === 'rajput-palace') return { kind: 'prototype', files: towns('gunpowder', 'indic') };
  return { kind: 'unknown', files: [] };
};

const walkZips = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = posix.join(dir, e.name);
    if (e.isDirectory()) walkZips(p, out);
    else if (p.endsWith('.zip')) out.push(p);
  });
  return out.sort();
};

const walkManifests = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = posix.join(dir, e.name);
    if (e.isDirectory()) walkManifests(p, out);
    else if (e.name === 'manifest.json') out.push(p);
  });
  return out.sort();
};

/** The SHA-256 a checkpoint folder records for each archive: SHA256SUMS.txt lines "<hash>  <file>". */
const archiveHashes = (dir) => {
  const sums = posix.join(dir, 'SHA256SUMS.txt');
  if (!existsSync(sums)) return {};
  return Object.fromEntries(readFileSync(sums, 'utf8').split(/\r?\n/).map((l) => l.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/)).filter(Boolean).map((m) => [m[2], m[1]]));
};

/**
 * Checkpoint deliveries whose ZIPs are hosted outside git (GitHub release assets, or a local copy
 * outside the repository): the checkpoint folder keeps a manifest.json whose items name their game
 * file (`target_path`) and their archive (`archive_part`, or the manifest's single `archive`), and a
 * SHA256SUMS.txt for the archives. Same shape as the ZIP coverage, plus each archive's hash and URL.
 */
export const manifestCoverage = (root = DOWNLOADS) => walkManifests(root).flatMap((file) => {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(manifest.items) || !manifest.items.some((i) => i?.target_path)) return [];
  const dir = posix.dirname(file);
  const hashes = archiveHashes(dir);
  const archives = new Map();
  (manifest.archives || []).forEach((a) => archives.set(a.file, { url: a.url || null, sha256: a.sha256 || null }));
  const single = manifest.archive?.url ? manifest.archive.url.split('/').pop() : null;
  if (single && !archives.has(single)) archives.set(single, { url: manifest.archive.url, sha256: null });
  const byZip = new Map();
  manifest.items.forEach((i) => {
    const zip = i.archive_part || single;
    if (!zip || !i.target_path) return;
    if (!byZip.has(zip)) byZip.set(zip, new Map());
    // Variants of one logical item (cathedral and cathedral-levant) count once, with every file.
    const item = i.item || i.logical_item || i.id;
    const items = byZip.get(zip);
    if (!items.has(item)) items.set(item, { item, kind: i.kind || 'delivery', targets: [], objects: [], files: [], models: [] });
    items.get(item).targets.push(i.target_path);
    // A kit file holds several items (rts-bronze.glb's roles): `object` names the item's root node.
    if (i.object) items.get(item).objects.push([i.target_path, i.object]);
  });
  const nodeNames = new Map();
  const hasNode = (file, name) => {
    if (!nodeNames.has(file)) nodeNames.set(file, new Set((readGlbJson(file).nodes || []).map((n) => n.name)));
    return nodeNames.get(file).has(name);
  };
  return [...byZip.entries()].map(([zip, items]) => {
    const meta = archives.get(zip) || {};
    const list = [...items.values()].map((it) => {
      const missing = it.targets.filter((f) => !existsSync(f));
      it.objects.forEach(([f, name]) => { if (existsSync(f) && !hasNode(f, name)) missing.push(`${f}#${name}`); });
      return { ...it, files: it.targets.filter((f) => existsSync(f)), missing };
    });
    return { zip: posix.join(dir, zip), hosted: meta.url || null, sha256: hashes[zip] || meta.sha256 || null, items: list };
  });
});

/** The coverage of every delivery: the ZIPs kept under plans/art/downloads and the checkpoint
 * manifests of release-hosted ZIPs: [{ zip, items: [{ item, kind, files, models }] }]. */
export const downloadsCoverage = (root = DOWNLOADS) => [...zipCoverage(root), ...manifestCoverage(root)];

/** The coverage of every delivery ZIP stored under `root`. */
export const zipCoverage = (root = DOWNLOADS) => {
  const cache = new Map();
  const list = (d) => { if (!cache.has(d)) cache.set(d, existsSync(d) ? readdirSync(d) : []); return cache.get(d); };
  return walkZips(root).map((zip) => {
    const items = new Map();
    zipEntryNames(zip).forEach((entry) => {
      const item = itemOf(entry);
      if (!item) return;
      if (!items.has(item)) items.set(item, { item, ...gameTargets(item, list), models: [] });
      if (/\.(glb|blend)$/.test(entry)) items.get(item).models.push(entry.slice(item.length + 1));
    });
    items.forEach((it) => { it.files = it.files.filter((f) => existsSync(f)); });
    return { zip, items: [...items.values()] };
  });
};

/** An item none of whose game files exists, or (a manifest item) one of whose named files is missing. */
export const notInGame = (i) => !i.files.length || !!i.missing?.length;

/** Production-queue items built by the art agent but never uploaded, and any ZIP that has them. */
export const builtNotUploaded = (coverage, queuePath = 'plans/art/production-queue.json') => {
  const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
  const delivered = new Set(coverage.flatMap((z) => z.items.map((i) => i.item)));
  return queue.items.filter((i) => i.delivery_status === 'built_awaiting_validation_upload').map((i) => ({ path: i.path, inZip: delivered.has(i.path) }));
};

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/art/downloads-coverage.mjs')) {
  const coverage = downloadsCoverage();
  const verbose = process.argv.includes('--items');
  let missing = 0, total = 0;
  coverage.forEach(({ zip, items, hosted, sha256 }) => {
    const miss = items.filter(notInGame);
    missing += miss.length; total += items.length;
    console.log(`${miss.length ? 'MISSING' : 'ok     '} ${zip}: ${items.length} items${miss.length ? `, not in game: ${miss.map((i) => i.item).join(', ')}` : ''}`);
    if (verbose && hosted !== undefined) console.log(`          archive ${sha256 ? sha256.slice(0, 12) : 'NO HASH'} ${hosted || 'no URL'}`);
    if (verbose) items.forEach((i) => console.log(`          ${i.item} [${i.kind}] -> ${i.files.length ? i.files.slice(0, 2).join(', ') + (i.files.length > 2 ? ` (+${i.files.length - 2})` : '') : 'NONE'}`));
  });
  const pending = builtNotUploaded(coverage);
  console.log(`\n${coverage.length} ZIPs, ${total} delivered items, ${missing} not in the game.`);
  console.log(`Built by the art agent but not uploaded (in no ZIP): ${pending.filter((p) => !p.inZip).length}`);
  pending.forEach((p) => console.log(`  ${p.inZip ? 'IN A ZIP, IMPORT IT:' : 'not delivered:'} ${p.path}`));
  process.exitCode = missing || pending.some((p) => p.inZip) ? 1 : 0;
}
