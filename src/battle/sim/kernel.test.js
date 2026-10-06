// src/battle/sim/kernel.test.js
// Phase C, the battle kernel (plans/MASTER-PLAN.md 6.2 and 7 row 4): the packed spatial grids find
// exactly what a full scan finds, the hash chain proves two runs identical (and localizes where
// they part), a battle can be verified from a snapshot by replaying only its last segment, and,
// with PERF_CHECKS=1, 300 squads a side stay inside the phone budget.
import { describe, it, expect } from 'vitest';
import { makeBenchWorld, runBench } from './benchScenario';
import { step } from './step';
import { worldHash, chainHash, HASH_CHAIN_EVERY, HASH_CHAIN_SEED } from './hash';
import { buildSpatialHash, queryRadius, buildTargetGrid } from './pathing';
import { acquireTarget, targetScore } from './combat';
import { canSeeSquad } from './fog';
import { runHeadless } from './headless';
import { replayBattle, replaySegment } from './replay';
import { recordBattle } from './__fixtures__/recordBattles';
import { Q } from './constants';
import { createRng } from '../../utils/rng';

const run = (w, ticks) => { const chain = []; while (!w.ended && w.tick < ticks) { step(w, []); w.events.length = 0; if (w.tick % HASH_CHAIN_EVERY === 0) chain.push(w.hashChain); } return chain; };

// The old neighbour query, kept here as the reference: 8x8-tile cells keyed at the build, the
// distance measured where each squad stands now, ids ascending.
const CELL = 8 * Q;
const referenceGrid = (w) => {
  const cells = new Map();
  w.squads.forEach((q) => { if (!q.alive || !q.onField) return; const k = `${Math.floor(q.x / CELL)},${Math.floor(q.y / CELL)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(q.idx); });
  return cells;
};
const referenceQuery = (w, cells, x, y, r) => {
  const out = [];
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      (cells.get(`${cx},${cy}`) || []).forEach((i) => { const q = w.squads[i]; if ((q.x - x) ** 2 + (q.y - y) ** 2 <= r * r) out.push(i); });
    }
  }
  return out.sort((a, b) => a - b);
};

describe('packed spatial grids', () => {
  it('a radius query finds exactly what the old full rule finds, also after squads were nudged', () => {
    const w = makeBenchWorld(120, 5);
    for (let i = 0; i < 300; i++) { step(w, []); w.events.length = 0; }
    buildSpatialHash(w);
    const ref = referenceGrid(w);
    const rng = createRng(9);
    // Nudge a third of the squads after the build, as separation and garrisons do.
    w.squads.forEach((q) => { if (rng.next() < 0.33) { q.x += Math.floor((rng.next() - 0.5) * 3 * Q); q.y += Math.floor((rng.next() - 0.5) * 3 * Q); } });
    for (let k = 0; k < 400; k++) {
      const x = Math.floor(rng.next() * w.map.w * Q); const y = Math.floor(rng.next() * w.map.h * Q);
      const r = Math.floor(rng.next() * 12 * Q);
      expect(queryRadius(w, x, y, r)).toEqual(referenceQuery(w, ref, x, y, r));
    }
  });

  it('target finding picks the same enemy as a scan of every squad in index order', () => {
    const w = makeBenchWorld(150, 3);
    for (let i = 0; i < 400; i++) { step(w, []); w.events.length = 0; }
    buildTargetGrid(w);
    buildSpatialHash(w);
    const ref = referenceGrid(w);
    let picked = 0;
    w.squads.filter((q) => q.alive && q.onField).forEach((q) => {
      const radius = q.stats.sight * Q;
      const got = acquireTarget(w, q, radius);
      // The reference: every squad in reach, in index order, the first best score wins.
      let best = -1; let bestScore = 0;
      referenceQuery(w, ref, q.x, q.y, radius).forEach((j) => {
        const t = w.squads[j];
        if (!t.alive || !t.onField || t.fled || t.side === q.side || t.inside >= 0 || !canSeeSquad(w, q.side, t)) return;
        if (q.stats.minRange && (q.x - t.x) ** 2 + (q.y - t.y) ** 2 < q.stats.minRange ** 2) return;
        const score = targetScore(q, t);
        if (score > bestScore) { bestScore = score; best = j; }
      });
      if (got?.kind === 'squad') { expect(got.index).toBe(best); picked += 1; } else expect(best < 0 || got?.kind === 'structure').toBe(true);
    });
    expect(picked).toBeGreaterThan(50);
  });
});

describe('hash chain checkpoints', () => {
  it('two runs of the same battle produce the same chain at every checkpoint', () => {
    const a = run(makeBenchWorld(60, 11), 800);
    const b = run(makeBenchWorld(60, 11), 800);
    expect(a.length).toBe(40);
    expect(b).toEqual(a);
    expect(new Set(a).size).toBe(a.length); // the chain moves every second
  });

  it('a different seed parts from the first checkpoint on; one changed squad parts at the next', () => {
    const base = run(makeBenchWorld(60, 11), 400);
    expect(run(makeBenchWorld(60, 12), 400)[0]).not.toBe(base[0]);
    const w = makeBenchWorld(60, 11);
    const chain = [];
    while (w.tick < 400) {
      step(w, []); w.events.length = 0;
      if (w.tick === 210) w.squads[7].strength -= 1; // a desync at tick 210
      if (w.tick % HASH_CHAIN_EVERY === 0) chain.push(w.hashChain);
    }
    const firstDiff = chain.findIndex((h, i) => h !== base[i]);
    expect(firstDiff).toBe(220 / HASH_CHAIN_EVERY - 1); // the checkpoint at tick 220
  });

  it('the chain folds the world hash in on schedule', () => {
    const w = makeBenchWorld(10, 1);
    expect(w.hashChain).toBe(HASH_CHAIN_SEED);
    for (let i = 0; i < HASH_CHAIN_EVERY; i++) step(w, []);
    expect(w.hashChain).toBe(chainHash(HASH_CHAIN_SEED, HASH_CHAIN_EVERY, worldHash(w)));
  });

  it('a live-played battle and its replay end on the same chain', () => {
    for (let i = 0; i < 4; i++) {
      const { setup, ended } = recordBattle(i);
      expect(replayBattle(setup, ended.log).chain).toBe(ended.chain);
    }
  }, 60000);

  it('the last segment alone verifies a battle: a trusted snapshot plus the tail of the log', () => {
    const { setup, ended } = recordBattle(2);
    const full = replayBattle(setup, ended.log);
    // The trusted snapshot: the battle replayed up to a checkpoint halfway through.
    const half = Math.floor(full.tick / 2 / HASH_CHAIN_EVERY) * HASH_CHAIN_EVERY;
    const snap = replaySegment(runHeadless(setup, { maxTicks: 0 }).world, ended.log, half).world;
    expect(snap.tick).toBe(half);
    const tail = replaySegment(snap, ended.log);
    expect(tail.chain).toBe(full.chain);
    expect(tail.hash).toBe(full.hash);
    // A snapshot that was tampered with cannot reach the reported chain.
    const forged = structuredClone(snap);
    forged.squads[0].strength += 50;
    expect(replaySegment(forged, ended.log).chain).not.toBe(full.chain);
  }, 60000);
});

describe.runIf(process.env.PERF_CHECKS === '1')('battle kernel budget (phase C)', () => {
  // plans/terra-imperium-rts-plan.md 13.1: worker tick p95 <= 10 ms on the phone; the phone is
  // taken as 4x slower than this machine (plans/rts-world-review.md section 5).
  it('300 squads a side: p95 tick x4 within 10 ms', () => {
    runBench(300, { ticks: 200 }); // warm-up
    const r = runBench(300, { ticks: 1200 });
    expect(r.p95 * 4).toBeLessThanOrEqual(10);
  }, 300000);
});
