// scripts/battle-bench.mjs
// Battle kernel benchmark (plans/MASTER-PLAN.md 6.2 and 7 row 4, phase C): ms per sim tick with
// N combat squads a side, AI against AI, everyone on the field (src/battle/bench/benchScenario.js).
//
//   node scripts/battle-bench.mjs                      # 300, 500 and 1,000 a side, 2,400 ticks (2 minutes of battle)
//   node scripts/battle-bench.mjs --sizes 300 --ticks 600 --seed 3 --json out.json
//   node scripts/battle-bench.mjs --root <another checkout>   # the same scenario on older code
// Each size runs --repeat times (default 3) and the run with the lowest p95 is kept. On a hybrid
// CPU, pin it to one performance core for steady numbers (Windows: start /affinity 4 /high).
//
// The phone column multiplies by PHONE_FACTOR: plans/rts-world-review.md section 5 uses a 4x
// slower CPU as the stand-in for a mid phone. The budget is plans/terra-imperium-rts-plan.md 13.1:
// a worker tick p95 at most 10 ms on the phone (p99 at most 20 ms).
// Like scripts/simulate.mjs it bundles the sim with esbuild first (src/ uses extensionless imports).
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { performance } from 'perf_hooks';
import { engineSources } from './engineSources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PHONE_FACTOR = 4;
const PHONE_P95_BUDGET = 10;
const PHONE_P99_BUDGET = 20;

const parseArgs = (argv) => {
  const args = { sizes: [300, 500, 1000], ticks: 2400, seed: 7, warmup: 1, repeat: 3, json: null, difficulty: 'king', root: path.resolve(__dirname, '..') };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=');
    const key = flag.replace(/^--/, '');
    const value = inline ?? argv[++i];
    if (key === 'sizes') args.sizes = value.split(',').map(Number);
    else if (key === 'ticks' || key === 'seed' || key === 'warmup' || key === 'repeat') args[key] = Number(value);
    else if (key === 'root') args.root = path.resolve(value);
    else if (key === 'json') args.json = value;
    else if (key === 'difficulty') args.difficulty = value;
    else throw new Error(`Unknown flag --${key}`);
  }
  return args;
};

const bundle = async (root) => {
  const outfile = path.join(os.tmpdir(), `terra-imperium-battle-bench-${process.pid}.mjs`);
  await build({
    stdin: { contents: "export { runBench, makeBenchWorld } from './src/battle/bench/benchScenario.js'; export { step } from './src/battle/sim/step.js'; export { makeRenderView } from './src/battle/render/view.js';", resolveDir: root, loader: 'js' },
    outfile,
    plugins: [engineSources(root)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    logLevel: 'error'
  });
  return outfile;
};

const f = (x) => x.toFixed(2).padStart(7);

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const file = await bundle(args.root);
  const { runBench, makeBenchWorld, step, makeRenderView } = await import(pathToFileURL(file).href);
  const now = () => performance.now();
  // A short warm-up so the JIT has compiled the hot loops before anything is timed.
  for (let i = 0; i < args.warmup; i++) runBench(Math.min(...args.sizes), { ticks: 200, seed: args.seed + 1000, now, opts: { difficultyId: args.difficulty } });
  const rows = [];
  console.log(`battle-bench: ${args.ticks} ticks, seed ${args.seed}, node ${process.version}, ${os.cpus()[0]?.model?.trim()} x${os.cpus().length}`);
  console.log('per side | mean ms | p50    | p95    | p99    | max    | contact mean | phone p95 (x4) | alive at end | end');
  for (const perSide of args.sizes) {
    // Several runs, the quietest kept: other work on the machine only ever adds time.
    let r = null;
    for (let k = 0; k < Math.max(1, args.repeat); k++) {
      const run = runBench(perSide, { ticks: args.ticks, seed: args.seed, now, opts: { difficultyId: args.difficulty } });
      if (r && run.hash !== r.hash) throw new Error(`Non-deterministic: run ${k} ended with hash ${run.hash} instead of ${r.hash}`);
      if (!r || run.p95 < r.p95) r = run;
    }
    rows.push(r);
    const phone = r.p95 * PHONE_FACTOR;
    const verdict = phone <= PHONE_P95_BUDGET && r.p99 * PHONE_FACTOR <= PHONE_P99_BUDGET ? 'within' : 'OVER';
    console.log(`${String(perSide).padStart(8)} |${f(r.mean)} |${f(r.p50)} |${f(r.p95)} |${f(r.p99)} |${f(r.max)} | ${f(r.meanInContact)}      | ${f(phone)} ${verdict.padEnd(6)} | ${r.alive.join(' v ').padEnd(12)} | ${r.ended || `tick ${r.ticks}`} hash ${r.hash.toString(16)}`);
  }
  // The worker's other job: a render view per screen frame (src/battle/render/view.js), copied to
  // the UI thread by postMessage (structuredClone stands in for that copy), mid-battle.
  console.log('per side | render view ms | + copy ms | per second at 60 frames (worker, x4 phone)');
  for (const perSide of args.sizes) {
    const w = makeBenchWorld(perSide, args.seed, { difficultyId: args.difficulty });
    for (let i = 0; i < 600; i++) { step(w, []); w.events.length = 0; }
    const N = 60;
    let a = now();
    const views = [];
    for (let i = 0; i < N; i++) views.push(makeRenderView(w, [], 0, i % 3 === 0));
    const viewMs = (now() - a) / N;
    a = now();
    views.forEach((v) => structuredClone(v));
    const copyMs = (now() - a) / N;
    rows.find((r) => r.perSide === perSide).view = { viewMs, copyMs };
    console.log(`${String(perSide).padStart(8)} | ${f(viewMs)}        | ${f(copyMs)}   | ${f((viewMs + copyMs) * 60 * PHONE_FACTOR)} ms of every 1,000`);
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify({ args, node: process.version, cpu: os.cpus()[0]?.model, rows }, null, 2));
  fs.rmSync(file, { force: true });
};

main().catch((e) => { console.error(e); process.exit(1); });
