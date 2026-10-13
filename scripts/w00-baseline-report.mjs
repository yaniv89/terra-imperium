// scripts/w00-baseline-report.mjs
// Turns the raw files of scripts/w00-baseline.sh into the markdown tables of the baseline write-up.
//   node scripts/w00-baseline-report.mjs plans/data/playtest-audits-baseline-raw > report-tables.md
// Reads <dir>/<speed>/seed-<n>/{run.log, telemetry-<n>.json, warstacks-<n>.jsonl}.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) { console.error('usage: node scripts/w00-baseline-report.mjs <raw dir>'); process.exit(1); }

const readLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : []);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? Math.round(v).toString() : (Math.round(v * 100) / 100).toString()) : '-');
const range = (xs) => (xs.length ? `${fmt(mean(xs))} (${fmt(Math.min(...xs))} to ${fmt(Math.max(...xs))})` : '-');

const speeds = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
const out = [];
for (const speed of speeds) {
  const seeds = fs.readdirSync(path.join(root, speed)).filter((d) => d.startsWith('seed-')).map((d) => Number(d.slice(5))).sort((a, b) => a - b);
  const stats = {}; const summary = {}; const telem = {}; const stacks = {};
  for (const sd of seeds) {
    const dir = path.join(root, speed, `seed-${sd}`);
    const lines = readLines(path.join(dir, 'run.log'));
    stats[sd] = lines.filter((l) => l.startsWith('STATS ')).map((l) => Object.fromEntries(l.slice(6).split(' ').map((kv) => { const i = kv.indexOf('='); const v = kv.slice(i + 1); return [kv.slice(0, i), Number.isNaN(Number(v)) || v === '' ? v : Number(v)]; })));
    const sm = lines.find((l) => l.startsWith('SUMMARY ')); summary[sd] = sm ? JSON.parse(sm.slice(8)) : null;
    const tf = path.join(dir, `telemetry-${sd}.json`); telem[sd] = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, 'utf8')) : null;
    stacks[sd] = readLines(path.join(dir, `warstacks-${sd}.jsonl`)).map((l) => JSON.parse(l));
  }
  const ok = seeds.filter((s) => summary[s]);
  out.push(`## ${speed}: seeds ${ok.join(', ')}, ${summary[ok[0]]?.turn ?? '?'} turns, player ${telem[ok[0]]?.player ?? '?'}\n`);

  // Headline: final values per seed.
  const HEAD = ['playerGold', 'playerAdm', 'playerDip', 'playerMil', 'playerCities', 'playerProdMean', 'aiCityProdMedian', 'aiTopCities', 'aiTopProdMean', 'firstUnitTurn', 'firstSettlerTurn', 'firstBuildingTurn', 'secondCityTurn', 'demandsMajor', 'demandsTribute', 'warsDeclaredMajors', 'warsOnPlayer', 'warLenMedian', 'warLenMax', 'siegesBegun', 'capturesTotal', 'conquestsKept20', 'conquestsLost20', 'rebellionsStarted', 'rebellionsOnPlayer', 'rebellionsSucceeded', 'aiMoveRate', 'aiMoveRateWar', 'aiMoveRatePeace', 'majorsMet', 'aiTopOverext', 'aiTopAuthority', 'aiTop5OverextMean', 'aiTop5AuthorityMean', 'playerOverext', 'playerAuthority', 'msPerTurn', 'auditViolations', 'nonFinite'];
  out.push('### Final values\n', `| metric | ${ok.map((s) => `seed ${s}`).join(' | ')} | mean (range) |`, `|---|${ok.map(() => '---:').join('|')}|---:|`);
  for (const k of HEAD) { const vs = ok.map((s) => summary[s][k]); out.push(`| ${k} | ${vs.map(fmt).join(' | ')} | ${range(vs.filter(Number.isFinite))} |`); }

  // Over time: mean over seeds at each checkpoint.
  const turns = [...new Set(ok.flatMap((s) => stats[s].map((r) => r.turn)))].sort((a, b) => a - b);
  const SERIES = ['playerGold', 'playerAdm', 'playerDip', 'playerMil', 'playerCities', 'playerProdMean', 'aiTopCities', 'aiTopProdMean', 'aiMoveRate', 'aiMoveRateWar', 'majorsMet', 'aiTopOverext', 'aiTopAuthority', 'warsActive', 'siegesBegun', 'capturesTotal', 'rebellionsStarted', 'stackShuttleShare', 'stackMovedShare'];
  out.push('\n### Over time (mean over seeds)\n', `| metric | ${turns.map((t) => `T${t}`).join(' | ')} |`, `|---|${turns.map(() => '---:').join('|')}|`);
  for (const k of SERIES) out.push(`| ${k} | ${turns.map((t) => fmt(mean(ok.map((s) => stats[s].find((r) => r.turn === t)?.[k]).filter(Number.isFinite)))).join(' | ')} |`);

  // Tribute and demands.
  const dem = ok.flatMap((s) => (telem[s]?.demandsAnswered || []).map((d) => ({ seed: s, ...d })));
  out.push('\n### Demands and tribute the player was asked for\n');
  if (!dem.length) out.push('None in these runs.\n');
  else {
    out.push('| seed | turn | from | quoted | paid | gold then | outcome | war within 10 turns |', '|---|---:|---|---:|---:|---:|---|---|');
    dem.slice(0, 40).forEach((d) => out.push(`| ${d.seed} | ${d.turn} | ${d.from} | ${d.quoted ?? '-'} | ${d.paid} | ${d.gold} | ${d.outcome} | ${d.warWithin10 ? 'yes' : 'no'} |`));
    if (dem.length > 40) out.push(`\n(${dem.length - 40} more rows in the telemetry files.)`);
    const q = dem.map((d) => d.quoted).filter(Number.isFinite);
    out.push(`\n${dem.length} demands in ${ok.length} runs; quoted amount mean ${fmt(mean(q))}, max ${q.length ? fmt(Math.max(...q)) : '-'}.\n`);
  }

  // Wars.
  const wars = ok.flatMap((s) => (telem[s]?.wars || []).filter((w) => !w.indep).map((w) => ({ seed: s, ...w, len: (w.end ?? summary[s].turn) - w.start, open: w.end == null })));
  const lens = wars.filter((w) => !w.open).map((w) => w.len).sort((a, b) => a - b);
  out.push('### Wars between majors\n', `${wars.length} declared (${wars.filter((w) => w.open).length} still open at the end); length of the ${lens.length} finished ones: min ${lens[0] ?? '-'}, median ${lens[Math.floor(lens.length / 2)] ?? '-'}, max ${lens[lens.length - 1] ?? '-'} turns. Wars involving the player: ${wars.filter((w) => w.withPlayer).length}.\n`);

  // One stack per turn, per war.
  const allRows = ok.flatMap((s) => stacks[s].map((r) => ({ seed: s, ...r })));
  const V = ['moved', 'shuttle', 'besieging', 'waitRoute', 'idleHome', 'idleField'];
  out.push('### AI stacks in a war, one row per stack per turn\n', `| seed | stack-turns | ${V.join(' | ')} |`, `|---|---:|${V.map(() => '---:').join('|')}|`);
  for (const s of ok) { const rows = stacks[s]; out.push(`| ${s} | ${rows.length} | ${V.map((v) => `${fmt(100 * rows.filter((r) => r.verdict === v).length / Math.max(1, rows.length))}%`).join(' | ')} |`); }
  out.push(`| all | ${allRows.length} | ${V.map((v) => `${fmt(100 * allRows.filter((r) => r.verdict === v).length / Math.max(1, allRows.length))}%`).join(' | ')} |`);
  // Longest stretches of one stack not moving, and the worst shuttlers.
  const byLead = {};
  allRows.forEach((r) => { (byLead[`${r.seed}|${r.war}|${r.lead}`] ||= []).push(r); });
  const worst = Object.entries(byLead).map(([k, rows]) => {
    rows.sort((a, b) => a.turn - b.turn);
    let run = 0; let best = 0; let bestAt = 0;
    rows.forEach((r) => { if (r.verdict === 'moved') run = 0; else { run += 1; if (run > best) { best = run; bestAt = r.turn; } } });
    return { k, rows: rows.length, shuttles: rows.filter((r) => r.verdict === 'shuttle').length, idleRun: best, idleRunEnd: bestAt, verdict: rows[rows.length - 1].verdict, nation: rows[0].nation };
  }).sort((a, b) => b.idleRun - a.idleRun).slice(0, 8);
  out.push('\nLongest runs of one stack not moving (a stack that is besieging is not stuck):\n', '| seed|war|stack | nation | turns seen | longest run without moving (ends turn) | shuttle turns | last verdict |', '|---|---|---:|---:|---:|---|');
  // (one row per stack: key is seed|war|stack)
  worst.forEach((w) => out.push(`| ${w.k} | ${w.nation} | ${w.rows} | ${w.idleRun} (T${w.idleRunEnd}) | ${w.shuttles} | ${w.verdict} |`));
  out.push('');
}
console.log(out.join('\n'));
