// .claude/skills/perf/battleStart.sim.js
// What the battle worker does between the 'start' message and its first frame (createBattleLoop:
// createWorld, the first step and frame), on a setup grabbed from the browser (a JSON of the start
// message's setup, typed arrays as { __ta, d }). Prints ms per run; CPUPROFILE=path for a profile.
//   SETUP=setup.json RUNS=5 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/perf/battleStart
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { createBattleLoop } from '../../../src/battle/worker/battleLoop';

const RUNS = Number(process.env.RUNS || 5);
const revive = (k, v) => (v && v.__ta ? new globalThis[v.__ta](v.d) : v);

it('battle start in the worker', async () => {
  const text = readFileSync(process.env.SETUP, 'utf8');
  const session = process.env.CPUPROFILE ? new Session() : null;
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const setup = JSON.parse(text, revive);
    if (session && i === 1) { session.connect(); await session.post('Profiler.enable'); await session.post('Profiler.start'); }
    let first = null;
    const t0 = performance.now();
    const loop = createBattleLoop({ setup, post: (m) => { if (m.type === 'frame' && first === null) first = performance.now() - t0; } });
    const built = performance.now() - t0;
    loop.frame(1000); loop.frame(1100);
    times.push(`${built.toFixed(0)}/${(first ?? performance.now() - t0).toFixed(0)}`);
  }
  if (session) writeFileSync(process.env.CPUPROFILE, JSON.stringify((await session.post('Profiler.stop')).profile));
  console.log(`BATTLESTART build/firstFrame ms: ${times.join(' ')}`);
}, 600000);
