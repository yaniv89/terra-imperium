// .claude/skills/perf/turnProfile.sim.js
// Phase-by-phase timing of resolveTurn on a whole-world game (fixed seed, passive player), the
// baseline for plans/math/perf.md. Prints one PHASES line (mean ms per phase over the measured
// turns, slowest first) and a TOTAL line per seed. WARMUP turns are run but not measured.
//   TURNS=120 WARMUP=10 SEEDS=11 PLAYER=au npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/perf
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { Session } from 'node:inspector/promises';
import { writeFileSync, readFileSync } from 'node:fs';
import { migrateSave, CURRENT_SAVE_VERSION } from '../../../src/engine/saveMigrations';
import { syncWorldRegistry } from '../../../src/engine/world/registry';
import { stateHash } from '../../../src/engine/macroVerify';

const TURNS = Number(process.env.TURNS || 120);
const WARMUP = Number(process.env.WARMUP || 10);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
// WINDOWS=50,150,300 prints the phase means of the WIN (20) turns ending at each, plus a state hash at each.
const WINDOWS = String(process.env.WINDOWS || '').split(',').filter(Boolean).map(Number);
const WIN = Number(process.env.WIN || 20);
// CPUPROFILE=path writes a V8 .cpuprofile of the measured turns (open in Chrome DevTools).
const CPUPROFILE = process.env.CPUPROFILE;
// SAVE_STATE=path writes the last state as JSON (for micro benchmarks of single systems).
const SAVE_STATE = process.env.SAVE_STATE;
// LOAD_STATE=path starts from a SAVE_STATE file instead of a new world (late turns without the 300 before them).
const LOAD_STATE = process.env.LOAD_STATE;
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

SEEDS.forEach((seed) => {
  it(`profile seed ${seed}`, async () => {
    const session = CPUPROFILE ? new Session() : null;
    if (session) { session.connect(); await session.post('Profiler.enable'); }
    let s = LOAD_STATE ? migrateSave({ version: CURRENT_SAVE_VERSION, state: JSON.parse(readFileSync(LOAD_STATE, 'utf8')) }).state : { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    if (LOAD_STATE) syncWorldRegistry(s);
    s = { ...s, research: { ...s.research, auto: true } };
    const winSums = {};
    const sums = {}; const maxes = {}; let measured = 0; let total = 0; let worst = 0;
    const buckets = []; let bucket = { ms: 0, n: 0 };
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
      const phases = {};
      const t0 = performance.now();
      s = resolveTurn(s, { onPhase: (name, ms) => { phases[name] = (phases[name] || 0) + ms; } });
      const ms = performance.now() - t0;
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
      const w = WINDOWS.find((e) => t > e - WIN && t <= e);
      if (w) {
        winSums[w] = winSums[w] || {};
        Object.entries({ ...phases, TOTAL: ms }).forEach(([k, v]) => { winSums[w][k] = (winSums[w][k] || 0) + v; });
      }
      if (WINDOWS.includes(t)) {
        const rows = Object.entries(winSums[t]).map(([k, v]) => [k, v / WIN]).sort((a, b) => b[1] - a[1]);
        console.log(`WIN seed=${seed} turn=${t} hash=${stateHash(s)} ${rows.map(([k, m]) => `${k}=${m.toFixed(2)}`).join(' ')}`);
      }
      if (session && t === WARMUP) await session.post('Profiler.start');
      if (t <= WARMUP) continue;
      measured += 1; total += ms; worst = Math.max(worst, ms);
      bucket.ms += ms; bucket.n += 1; if (bucket.n === 25) { buckets.push(+(bucket.ms / bucket.n).toFixed(1)); bucket = { ms: 0, n: 0 }; }
      phases.untimed = ms - Object.values(phases).reduce((a, b) => a + b, 0);
      Object.entries(phases).forEach(([k, v]) => { sums[k] = (sums[k] || 0) + v; maxes[k] = Math.max(maxes[k] || 0, v); });
    }
    if (session) { const { profile } = await session.post('Profiler.stop'); writeFileSync(CPUPROFILE, JSON.stringify(profile)); }
    if (SAVE_STATE) writeFileSync(SAVE_STATE, JSON.stringify(s));
    const rows = Object.entries(sums).map(([k, v]) => [k, v / measured, maxes[k]]).sort((a, b) => b[1] - a[1]);
    console.log(`PHASES seed=${seed} ${rows.map(([k, m, x]) => `${k}=${m.toFixed(2)}/${x.toFixed(0)}`).join(' ')}`);
    console.log(`TOTAL seed=${seed} turns=${measured} meanMs=${(total / measured).toFixed(1)} worstMs=${worst.toFixed(0)} per25=${buckets.join(',')} cities=${Object.keys(s.regions).length} owned=${Object.keys(s.world?.tileOwner || {}).length}`);
  });
});
