#!/usr/bin/env node
// .claude/skills/balance-sim/pairedCompare.mjs
// Paired-seed comparison of two balance-sim logs (plans/math-ideas.md 8.1). Base and head ran the
// same seeds, so each metric is compared seed by seed: the mean difference (head - base), its 95%
// Student t interval, and a * when the interval excludes 0. Paired differences cancel most of the
// seed-to-seed noise, which is why 4 to 8 seeds can resolve effects that unpaired means cannot.
//   node .claude/skills/balance-sim/pairedCompare.mjs base.log head.log [--turn N] [--all] [--json out.json]
// Reads SUMMARY lines by default; --turn N reads the STATS lines of checkpoint N instead.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pairedDiff } from '../../../scripts/simStats.mjs';

// Keys that are labels or bookkeeping, not outcomes.
const SKIP = new Set(['seed', 'turn', 'status', 'playerTechAge']);
// Timing shares the CPU with the other parallel runs: shown, never starred.
const NOISY = new Set(['msPerTurn']);

const parseValue = (v) => (v === '' ? v : Number.isNaN(Number(v)) ? v : Number(v));

// Returns { [seed]: record } from one log.
export const readRuns = (text, turn = null) => {
  const out = {};
  text.split('\n').forEach((line) => {
    if (turn == null && line.startsWith('SUMMARY ')) {
      const r = JSON.parse(line.slice(8));
      out[r.seed] = r;
    } else if (turn != null && line.startsWith('STATS ')) {
      const r = {};
      line.slice(6).trim().split(/\s+/).forEach((kv) => { const i = kv.indexOf('='); r[kv.slice(0, i)] = parseValue(kv.slice(i + 1)); });
      if (r.turn === turn) out[r.seed] = r;
    }
  });
  return out;
};

const fmt = (v) => {
  if (v == null || Number.isNaN(v)) return '-';
  const a = Math.abs(v);
  return a === 0 ? '0' : a >= 1000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 0.1 ? v.toFixed(2) : v.toFixed(4);
};

export const comparePaired = (baseRuns, headRuns) => {
  const seeds = Object.keys(baseRuns).filter((s) => s in headRuns).sort((a, b) => a - b);
  const keys = [];
  seeds.forEach((s) => Object.keys({ ...baseRuns[s], ...headRuns[s] }).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  const rows = []; const labels = []; const onlyHead = []; const onlyBase = [];
  keys.filter((k) => !SKIP.has(k)).forEach((k) => {
    const b = seeds.map((s) => baseRuns[s][k]); const h = seeds.map((s) => headRuns[s][k]);
    const numeric = (xs) => xs.some((v) => typeof v === 'number');
    if (!numeric(b) && numeric(h)) { onlyHead.push(k); return; }
    if (numeric(b) && !numeric(h)) { onlyBase.push(k); return; }
    if (!numeric(b)) { if (b.some((v, i) => v !== h[i])) labels.push(k); return; }
    const r = pairedDiff(b, h);
    rows.push({ key: k, ...r, significant: r.significant && !NOISY.has(k), noisy: NOISY.has(k), identical: b.every((v, i) => v === h[i]) });
  });
  // Pairs only mean like for like when both sides ran to the same turn with the same status.
  const unequal = seeds.filter((s) => baseRuns[s].turn !== headRuns[s].turn || baseRuns[s].status !== headRuns[s].status);
  return { seeds, rows, labels, onlyHead, onlyBase, unequal };
};

export const formatReport = (res, { all = false } = {}) => {
  const lines = [];
  const n = res.seeds.length;
  lines.push(`paired over ${n} seed(s): ${res.seeds.join(',')}   diff = head - base, 95% t interval, * = interval excludes 0`);
  if (n < 2) lines.push('  only one pair: no interval possible, run at least 4 seeds for a verdict');
  if (res.unequal.length) lines.push(`  WARNING: seeds ${res.unequal.join(',')} ended at a different turn or status on the two sides; their pairs are not like for like`);
  const shown = res.rows.filter((r) => all || !r.identical);
  const head = ['metric', 'base', 'head', 'diff', '95% CI', '', 'up/down', 'seeds@80%'];
  const table = shown.map((r) => [r.key, fmt(r.baseMean), fmt(r.headMean), (r.meanDiff > 0 ? '+' : '') + fmt(r.meanDiff),
    n >= 2 ? `[${fmt(r.lo)}, ${fmt(r.hi)}]` : '-', r.significant ? '*' : r.noisy ? '(t)' : '', `${r.up}/${r.down}`,
    r.significant || r.identical || r.seedsNeeded == null ? '' : String(r.seedsNeeded)]);
  const w = head.map((h, i) => Math.max(h.length, ...table.map((row) => row[i].length)));
  const line = (row) => '  ' + row.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  lines.push(line(head));
  table.forEach((row) => lines.push(line(row)));
  const same = res.rows.filter((r) => r.identical).length;
  if (!all && same) lines.push(`  ${same} metric(s) identical on every seed (--all shows them)`);
  const sig = res.rows.filter((r) => r.significant).map((r) => r.key);
  lines.push(`significant: ${sig.length ? sig.join(', ') : 'none'}`);
  if (res.labels.length) lines.push(`labels that differ: ${res.labels.join(', ')}`);
  if (res.onlyHead.length) lines.push(`new in head (no base value): ${res.onlyHead.join(', ')}`);
  if (res.onlyBase.length) lines.push(`gone in head: ${res.onlyBase.join(', ')}`);
  lines.push('(t) = timing, parallel runs share the CPU. seeds@80% = seeds needed to resolve the observed diff at 80% power, ((2.8 sd)/diff)^2.');
  return lines.join('\n');
};

const main = () => {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const all = args.includes('--all'); if (all) args.splice(args.indexOf('--all'), 1);
  const turn = flag('--turn'); const json = flag('--json');
  const [basePath, headPath] = args;
  if (!basePath || !headPath) { console.error('usage: pairedCompare.mjs base.log head.log [--turn N] [--all] [--json out.json]'); process.exit(2); }
  const t = turn == null ? null : Number(turn);
  const res = comparePaired(readRuns(fs.readFileSync(basePath, 'utf8'), t), readRuns(fs.readFileSync(headPath, 'utf8'), t));
  console.log(formatReport(res, { all }));
  if (json) fs.writeFileSync(json, JSON.stringify(res, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
