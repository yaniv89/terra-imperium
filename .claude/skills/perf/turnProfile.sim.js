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
import { writeFileSync } from 'node:fs';

const TURNS = Number(process.env.TURNS || 120);
const WARMUP = Number(process.env.WARMUP || 10);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'au';
// CPUPROFILE=path writes a V8 .cpuprofile of the measured turns (open in Chrome DevTools).
const CPUPROFILE = process.env.CPUPROFILE;
// SAVE_STATE=path writes the last state as JSON (for micro benchmarks of single systems).
const SAVE_STATE = process.env.SAVE_STATE;
const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((a, id) => ({ ...a, [id]: true }), {});

SEEDS.forEach((seed) => {
  it(`profile seed ${seed}`, async () => {
    const session = CPUPROFILE ? new Session() : null;
    if (session) { session.connect(); await session.post('Profiler.enable'); }
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } };
    const sums = {}; const maxes = {}; let measured = 0; let total = 0; let worst = 0;
    const buckets = []; let bucket = { ms: 0, n: 0 };
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.pendingPeaceOffer) s = gameReducer(s, { type: s.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
      const phases = {};
      const t0 = performance.now();
      s = resolveTurn(s, { onPhase: (name, ms) => { phases[name] = (phases[name] || 0) + ms; } });
      const ms = performance.now() - t0;
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
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
