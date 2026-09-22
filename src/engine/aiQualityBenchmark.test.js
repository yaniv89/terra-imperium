// src/engine/aiQualityBenchmark.test.js
// Plan §13's "AI quality benchmark": automated AI-vs-AI matches asserting (a) turn resolution for
// 240 nations stays under a time budget, and (c) no runaway — at Prince difficulty, no single
// nation should hold most of the map after a long run in most seeds.
//
// Item (b) — "the AI actually counter-builds: feed it a cavalry-heavy opponent, assert its pike
// ratio rises" — is NOT implemented here. It has a real prerequisite that doesn't exist yet: AI
// nations don't recruit actual classed units into state.units at all (aiLogic.js's own header
// comment has said so since Task 23) — militaryStrength is a single scalar, not a composition of
// unit classes, so there is no "pike ratio" to assert on. Building that (giving 240 AI nations
// real recruited unit compositions that react to what they perceive) is a genuine new AI
// capability, not a test to write against what already exists — tracked as a separate follow-up.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { HISTORICAL_EVENTS } from '../data/events';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});

// Isolates the benchmark from the scripted/procedural event pipeline the same way every other
// long-run test in this codebase does (resolveTurn.test.js's withAllEventsFired) — a pending event
// would otherwise make resolveTurn a no-op and silently stall the simulation rather than exercise
// the AI systems this benchmark is actually about. Procedural events still roll every turn (not
// pre-fired), so any one that comes up active is cleared between iterations the same way.
const freshWorld = (playerNationId = 'fr') => ({
  ...createInitialState({ playerNationId }),
  firedEvents,
  proceduralEventCooldown: 999999
});

const advance = (state) => {
  const next = resolveTurn(state);
  return next.activeProceduralEvent ? { ...next, activeProceduralEvent: null } : next;
};

const runTurns = (state, turns) => {
  let current = state;
  for (let i = 0; i < turns; i++) current = advance(current);
  return current;
};

const largestRegionShare = (state) => {
  const regions = Object.values(state.regions);
  const counts = {};
  regions.forEach((r) => { counts[r.owner] = (counts[r.owner] || 0) + 1; });
  return Math.max(...Object.values(counts)) / regions.length;
};

describe('AI quality benchmark: turn resolution time budget', () => {
  // Real observed cost on this machine is ~0.8ms/turn (~250ms for 300 turns) — BUDGET_MS is set
  // an order of magnitude above that, so this is a regression guard against an accidental
  // O(n^2)/O(n^3) sweep across 240 nations creeping in, not a strict performance SLA. The explicit
  // per-test timeout (vitest's own default is 5000ms) gives a shared/noisy sandbox room to breathe
  // without the test reporting a generic "timed out" instead of this test's own budget message.
  it('resolves 300 turns across the full 240-nation world well within a generous time budget', () => {
    const TURNS = 300;
    const BUDGET_MS = 10000;
    const state = freshWorld();
    const start = performance.now();
    runTurns(state, TURNS);
    const elapsed = performance.now() - start;
    expect(elapsed, `resolving ${TURNS} turns took ${elapsed.toFixed(0)}ms, over the ${BUDGET_MS}ms budget`).toBeLessThan(BUDGET_MS);
  }, 20000);
});

describe('AI quality benchmark: no runaway leader', () => {
  // Plan §13: "at Prince, no single AI should hold >40% of the map by turn 300 in most seeds."
  // Prince (src/data/difficulty.js) has aiAggressionMult 1 — createInitialState's own default
  // difficultyMultiplier — so no explicit difficulty needs applying here. Each createInitialState()
  // call draws a fresh random rngSeed (src/utils/rng.js's randomSeed()), so five independent calls
  // are five independent seeds/trials, matching "in most seeds" rather than asserting on one.
  it('no single nation holds more than 40% of the world\'s regions after 300 turns, in most independent seeds', () => {
    const TRIALS = 5;
    const TURNS = 300;
    const RUNAWAY_SHARE = 0.4;
    let runawayCount = 0;
    for (let t = 0; t < TRIALS; t++) {
      const final = runTurns(freshWorld(), TURNS);
      if (largestRegionShare(final) > RUNAWAY_SHARE) runawayCount++;
    }
    expect(runawayCount, `${runawayCount}/${TRIALS} trials produced a runaway leader (>${RUNAWAY_SHARE * 100}% of the map)`).toBeLessThanOrEqual(Math.floor(TRIALS / 2));
  }, 20000); // 5 trials x 300 turns — comfortably under a second normally, but see the budget test's own comment on why this has room to spare
});
