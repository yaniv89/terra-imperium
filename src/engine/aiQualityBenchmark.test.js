// src/engine/aiQualityBenchmark.test.js
// Plan §13's "AI quality benchmark": automated AI-vs-AI matches asserting (a) turn resolution for
// 240 nations stays under a time budget, (b) the AI actually counter-builds, and (c) no runaway —
// at Prince difficulty, no single nation should hold most of the map after a long run in most
// seeds.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';

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
  // Real observed cost on this machine is ~35-45ms/turn across the full 4,482-province world
  // (~250ms for 300 turns back when regions were one-per-nation, i.e. 18.7x fewer of them) —
  // BUDGET_MS has room above that for a shared/noisy sandbox, so this is a regression guard
  // against an accidental O(n^2)/O(n^3) sweep creeping back in on top of the real, larger cost of
  // simulating a bigger world, not a strict performance SLA.
  it('resolves 300 turns across the full 240-nation, 4,482-region world well within a generous time budget', () => {
    const TURNS = 300;
    const BUDGET_MS = 30000;
    const state = freshWorld();
    const start = performance.now();
    runTurns(state, TURNS);
    const elapsed = performance.now() - start;
    expect(elapsed, `resolving ${TURNS} turns took ${elapsed.toFixed(0)}ms, over the ${BUDGET_MS}ms budget`).toBeLessThan(BUDGET_MS);
  }, 45000);
});

describe('AI quality benchmark: per-phase timing breakdown (plan §M0.4)', () => {
  // Plan §M0.4: "record the mean turn cost over 50 turns and log a per-phase breakdown using
  // performance.now() around each resolveTurn phase. Budget: <= 80ms/turn mean at 240 nations by
  // the end of M16 (today about 35-45ms)." resolveTurn's optional onPhase hook (added for this
  // milestone) reports the wall time of each named section as the turn runs, so this is real
  // per-phase cost, not a coarse whole-turn average — a future milestone that blows its own phase's
  // budget shows up by name instead of just moving the total.
  //
  // BUDGET_MS is the plan's own end-of-M16 ceiling, not today's baseline: M2-M16 all add real work
  // (power pools, rulers, buildings, tech, diplomacy, AI parity, ...) to this same per-turn cost on
  // purpose. Failing this test today would mean a milestone already blew through headroom meant to
  // last through M16, well before the AI-parity work that budget was reserved for.
  const TURNS = 50;
  const BUDGET_MS = 80;

  it('resolves 50 turns at a mean cost under the plan\'s end-of-M16 80ms/turn budget, with a per-phase breakdown', () => {
    const phaseTotals = {};
    const onPhase = (name, ms) => { phaseTotals[name] = (phaseTotals[name] || 0) + ms; };

    let state = freshWorld();
    const start = performance.now();
    for (let i = 0; i < TURNS; i++) {
      const next = resolveTurn(state, { onPhase });
      state = next.activeProceduralEvent ? { ...next, activeProceduralEvent: null } : next;
    }
    const totalMs = performance.now() - start;
    const meanMs = totalMs / TURNS;

    const breakdown = Object.entries(phaseTotals)
      .map(([name, ms]) => [name, ms / TURNS])
      .sort((a, b) => b[1] - a[1])
      .map(([name, ms]) => `  ${name}: ${ms.toFixed(2)}ms/turn`)
      .join('\n');
    console.log(`aiQualityBenchmark per-phase breakdown (mean over ${TURNS} turns, total ${meanMs.toFixed(2)}ms/turn):\n${breakdown}`);

    expect(meanMs, `mean turn cost was ${meanMs.toFixed(2)}ms, over the plan's ${BUDGET_MS}ms end-of-M16 budget`).toBeLessThan(BUDGET_MS);
  }, 20000);
});

describe('AI quality benchmark: counter-building (plan §13 item b)', () => {
  // fr's and de's real provinces border each other for real (worldRegions.json — e.g. de-rp/fr-57),
  // so getBorderingNationIds (src/data/regions.js) puts them on each other's border from the very
  // first turn, before any territory changes hands — playing as fr means de is bordering the
  // player and therefore Tier 1 (aiLogic.js's getNationTier) on every single turn, no reliance on
  // military ranking or an existing war. getRivalId (aiLogic.js) resolves a Tier-1 nation's rival
  // to a war opponent first, else the player if bordering — so de's rival here is deterministically
  // the player, exactly the plan's own example ("spam cavalry at your neighbor, they start fielding
  // pikes").
  const PLAYER_ID = 'fr';
  const RIVAL_AI_ID = 'de';
  const CAVALRY_UNIT_COUNT = 6;

  // de declaring or receiving its own unrelated war would swap its rival away from the player
  // (getRivalId prefers a live war opponent) and confound the assertion below — isolationist has
  // the lowest warRollMult in the game (0.02) and low hostility keeps the roll chance negligible
  // over the run, without touching the recruitment mechanism under test at all.
  const seedCavalryOpponent = (state) => {
    const seededUnits = {};
    const playerCapital = getNationCapital(PLAYER_ID);
    for (let i = 0; i < CAVALRY_UNIT_COUNT; i++) {
      seededUnits[`seed_cav_${i}`] = {
        id: `seed_cav_${i}`, regionId: playerCapital, ownerId: PLAYER_ID, domain: 'land',
        classId: 'cavalry', ageId: state.age, strength: 1000, maxStrength: 1000, morale: 100,
        organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null,
        transportCapacity: null, embarkedOn: null
      };
    }
    return {
      ...state,
      units: { ...state.units, ...seededUnits },
      nations: {
        ...state.nations,
        [RIVAL_AI_ID]: { ...state.nations[RIVAL_AI_ID], doctrine: 'isolationist', hostility: 0 }
      }
    };
  };

  it('an AI nation shifts its own recruiting toward infantry when its player neighbor fields cavalry', () => {
    const TRIALS = 5;
    const TURNS = 80;
    let recruitedNothing = 0;
    let failedToCounter = 0;

    for (let t = 0; t < TRIALS; t++) {
      const state = seedCavalryOpponent(freshWorld(PLAYER_ID));
      const final = runTurns(state, TURNS);
      const rivalUnits = Object.values(final.units).filter(u => u.ownerId === RIVAL_AI_ID);
      if (rivalUnits.length === 0) { recruitedNothing++; continue; }
      const infantryRatio = rivalUnits.filter(u => u.classId === 'infantry').length / rivalUnits.length;
      if (infantryRatio < 0.5) failedToCounter++;
    }

    expect(recruitedNothing, `${RIVAL_AI_ID} recruited nothing in ${recruitedNothing}/${TRIALS} trials`).toBeLessThanOrEqual(Math.floor(TRIALS / 2));
    expect(failedToCounter, `${RIVAL_AI_ID}'s infantry ratio was below 50% in ${failedToCounter}/${TRIALS} trials that did recruit`).toBeLessThanOrEqual(Math.floor(TRIALS / 2));
  }, 30000); // 5 trials x 80 turns at the 4,482-region world's real per-turn cost
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
  }, 120000); // 5 trials x 300 turns at the 4,482-region world's real per-turn cost — see the budget test's own comment
});
