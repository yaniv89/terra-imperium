// scripts/art/checkpoint-files.mjs
// Writes a delivery checkpoint's manifest.json and SHA256SUMS.txt (plans/art/downloads/<wave>/
// checkpoint-NN), the format of the earlier checkpoints: every listed file with its size and hash.
//   node scripts/art/checkpoint-files.mjs <checkpoint_dir> <id> <logical_deliveries> <packed_bytes_added> <file|dir>...
// A directory adds every file under it. The checkpoint's own contact.png is listed when it exists.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, id, logical, added, ...paths] = process.argv.slice(2);
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).sort().flatMap((f) => walk(join(p, f))) : [p.replace(/\\/g, '/')]);
const contact = join(dir, 'contact.png').replace(/\\/g, '/');
const files = [...new Set([...(existsSync(contact) ? [contact] : []), ...paths.flatMap(walk)])].sort();
const rows = files.map((file) => {
  const data = readFileSync(file);
  return { file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
});
const manifest = {
  checkpoint: id,
  date: new Date().toISOString().slice(0, 10),
  branch: 'claude/bronze-towns',
  logical_deliveries: Number(logical),
  packed_bytes_added: Number(added),
  files: rows
};
writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(dir, 'SHA256SUMS.txt'), rows.map((r) => `${r.sha256}  ${r.file}`).join('\n') + '\n');
console.log(`${dir}: ${rows.length} files`);
