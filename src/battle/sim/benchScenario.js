// src/battle/sim/benchScenario.js
// The battle kernel benchmark (plans/MASTER-PLAN.md 6.2, phase C): N combat squads a side, AI
// against AI, every squad already on the field in a deep block (melee in front, shooters behind),
// on a plains field sized so the density stays about the same at every preset. Shared by
// scripts/battle-bench.mjs (ms per tick, before and after) and the PERF_CHECKS test.
// Pure and seeded: the same (perSide, seed) builds the same world on every machine.
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { worldHash } from './hash';

export const BENCH_SIZES = [300, 500, 1000];
// A full army: 40% foot, 25% shooters, 20% horse, 10% siege (splash), 5% supply wagons, and a
// general every 50 squads (auras, abilities); both commanders hold Rally Cry and Arrow Storm.
const CLASSES = ['infantry', 'ranged', 'infantry', 'cavalry', 'infantry', 'ranged', 'siege', 'infantry', 'cavalry', 'ranged',
  'infantry', 'cavalry', 'infantry', 'ranged', 'siege', 'infantry', 'cavalry', 'ranged', 'infantry', 'support'];
const PERSONALITIES = ['reckless', 'cautious', 'siegemaster', 'logistician'];
const GENERAL_EVERY = 50;

// A combat width big enough that the field keeps roughly the same room per squad.
export const benchCombatWidth = (perSide) => Math.max(6, Math.ceil(Math.sqrt(perSide) / 2.2));

const generalId = (prefix, i) => `g${prefix}${i / GENERAL_EVERY}`;
const army = (prefix, n) => Array.from({ length: n }, (_, i) => ({
  id: `${prefix}${i}`, classId: CLASSES[i % CLASSES.length], strength: 1000, maxStrength: 1000,
  morale: 100, promotions: [], commanderId: i % GENERAL_EVERY === 0 ? generalId(prefix, i) : null, domain: 'land'
}));
const generals = (prefix, n) => Object.fromEntries(Array.from({ length: Math.ceil(n / GENERAL_EVERY) }, (_, k) => {
  const id = generalId(prefix, k * GENERAL_EVERY);
  return [id, { id, name: id, martial: 3, shock: 2 + (k % 3), fire: 4 - (k % 3), maneuver: 3, personality: PERSONALITIES[k % PERSONALITIES.length] }];
}));

// `deployment: 'blocks'` (world.js deployBlocks): every squad starts on the field in deep blocks.
export const makeBenchSetup = (perSide, seed = 7, { difficultyId = 'king', ageId = 'classical' } = {}) => ({
  ...buildSetupFromArmies({
    regionId: `bench-${perSide}`, terrain: 'plains', seed, combatWidth: benchCombatWidth(perSide),
    attackerUnits: army('a', perSide), defenderUnits: army('d', perSide),
    attackerAgeId: ageId, defenderAgeId: ageId, controllers: ['ai', 'ai'], difficultyId,
    generals: { ...generals('a', perSide), ...generals('d', perSide) },
    deposits: [], powers: [[{ id: 'rallyCry' }, { id: 'arrowStorm' }], [{ id: 'rallyCry' }, { id: 'arrowStorm' }]], battleType: 'field'
  }),
  deployment: 'blocks'
});

export const makeBenchWorld = (perSide, seed = 7, opts = {}) => createWorld(makeBenchSetup(perSide, seed, opts));

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

// Step a bench world `ticks` times, timing each tick. `now` is the clock (performance.now).
export const runBench = (perSide, { ticks = 2400, seed = 7, now = () => performance.now(), opts = {} } = {}) => {
  const t0 = now();
  const w = makeBenchWorld(perSide, seed, opts);
  const setupMs = now() - t0;
  const times = [];
  let contactTick = -1;
  while (!w.ended && w.tick < ticks) {
    const a = now();
    step(w, []);
    times.push(now() - a);
    if (contactTick < 0 && w.events.some((e) => e.type === 'melee')) contactTick = w.tick;
    w.events.length = 0;
  }
  const sorted = [...times].sort((x, y) => x - y);
  const after = contactTick >= 0 ? times.slice(contactTick) : [];
  const alive = [0, 1].map((side) => w.squads.filter((q) => q.side === side && q.alive && !q.fled).length);
  return {
    perSide, ticks: times.length, setupMs,
    mean: times.reduce((s, x) => s + x, 0) / Math.max(1, times.length),
    p50: pct(sorted, 0.5), p95: pct(sorted, 0.95), p99: pct(sorted, 0.99), max: sorted[sorted.length - 1] || 0,
    meanInContact: after.length ? after.reduce((s, x) => s + x, 0) / after.length : 0,
    contactTick, alive, ended: w.ended ? w.ended.reason : null, hash: worldHash(w), chain: w.hashChain ?? null
  };
};
