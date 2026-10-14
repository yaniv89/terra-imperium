// scripts/perf/heap-diff.mjs
// What grew between two heap snapshots (memory-soak.mjs --snap): count and self size by
// constructor name, biggest growth first.
//   node scripts/perf/heap-diff.mjs before.heapsnapshot after.heapsnapshot [--top 30]
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
const topI = process.argv.indexOf('--top');
const TOP = topI >= 0 ? Number(process.argv[topI + 1]) : 30;
const summarize = (file) => {
  const snap = JSON.parse(readFileSync(file, 'utf8'));
  const f = snap.snapshot.meta.node_fields; const types = snap.snapshot.meta.node_types[0];
  const iType = f.indexOf('type'); const iName = f.indexOf('name'); const iSize = f.indexOf('self_size'); const n = f.length;
  const out = new Map();
  for (let i = 0; i < snap.nodes.length; i += n) {
    const type = types[snap.nodes[i + iType]];
    const key = type === 'object' || type === 'native' ? snap.strings[snap.nodes[i + iName]] : `(${type})`;
    const e = out.get(key) || { count: 0, size: 0 };
    e.count += 1; e.size += snap.nodes[i + iSize];
    out.set(key, e);
  }
  return out;
};
const x = summarize(a); const y = summarize(b);
const rows = [...new Set([...x.keys(), ...y.keys()])].map((k) => ({ k, dc: (y.get(k)?.count || 0) - (x.get(k)?.count || 0), ds: (y.get(k)?.size || 0) - (x.get(k)?.size || 0) }));
rows.sort((p, q) => q.ds - p.ds).slice(0, TOP).forEach((r) => console.log(`${(r.ds / 1048576).toFixed(2).padStart(8)} MB ${String(r.dc).padStart(8)}  ${r.k.slice(0, 90)}`));
