// scripts/simulate.mjs
// Plan §M21: "Balance simulation harness — a headless full-game run." Runs N seeded games of the
// real turn-resolution engine (the exact same resolveTurn every real turn goes through) and reports
// the metrics the plan asks for, so future balance passes have a real tool instead of guesswork.
//
// Two deliberate scope trims from the plan's literal ask, both documented rather than silently
// dropped:
//   - Default 5 games x 150 turns, not "20 games x 495 turns". A full 20x495 run is CLI-flag
//     reachable (`--games 20 --turns 495`) for whoever has the machine time; the smaller default
//     keeps `node scripts/simulate.mjs` itself fast enough to actually run in this sandbox/CI.
//   - No scripted "competent player" bot. Every nation in a game — including the one nominally
//     flagged `playerNationId` — is left to the same M16 AI economy/diplomacy/military systems (a
//     passive human player already can't win passively per M18's endgameReachability tests, so this
//     is exactly the "does nothing" baseline that suite already established, just aggregated across
//     many games and nations for AI-vs-AI dynamics). Building a real scripted human-strategy bot
//     would mean inventing a whole second decision system with nothing in this codebase to build on
//     — a bigger, separate undertaking than a cleanup-milestone balance harness should attempt.
//   - "Dominant strategies" (e.g. "is any law option never picked by the AI") is not instrumented —
//     it would need per-decision logging inside aiEconomy.js itself, which risks slowing down the
//     exact hot path aiQualityBenchmark.test.js guards. Left for a future, more invasive pass.
//
// Because src/ uses bundler-style extensionless imports, this script builds a small throwaway
// esbuild bundle exposing exactly the pure-engine symbols it needs (mirroring
// scripts/build-edge-engine.mjs's own reason for bundling at all) rather than trying to run src/
// files directly under plain Node ESM.
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const parseArgs = (argv) => {
  const args = { games: 5, turns: 150, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inlineValue] = argv[i].split('=');
    const key = flag.replace(/^--/, '');
    const value = inlineValue ?? argv[i + 1];
    if (key === 'games' || key === 'turns' || key === 'seed') {
      args[key] = Number(value);
      if (inlineValue === undefined) i++;
    }
  }
  for (const [key, value] of Object.entries(args)) {
    if (!Number.isSafeInteger(value) || value < (key === 'seed' ? 0 : 1)) throw new Error(`Invalid --${key}: expected ${key === 'seed' ? 'a nonnegative' : 'a positive'} integer`);
  }
  return args;
};

const buildSimEngine = async () => {
  const outfile = path.join(os.tmpdir(), `terra-imperium-sim-engine-${process.pid}.mjs`);
  await build({
    stdin: {
      contents: [
        "export { resolveTurn } from '../src/engine/resolveTurn.js';",
        "export { createInitialState } from '../src/engine/gameReducer.js';",
        "export { gameReducer } from '../src/engine/gameReducer.js';",
        "export { ActionTypes } from '../src/data/types.js';",
        "export { assertGameState } from '../src/engine/stateAudit.js';",
        "export { HISTORICAL_EVENTS } from '../src/data/events.js';",
        "export { WORLD_NATIONS } from '../src/data/worldNations.js';"
      ].join('\n'),
      resolveDir: __dirname,
      loader: 'js'
    },
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022'
  });
  return outfile;
};

// Explicit policy for the passive benchmark: reject demands, accept white peace, auto-defend.
// A blocked loop must fail instead of reporting many iterations over an unchanged world.
export const advanceCampaign = (engine, state) => {
  let ready = state;
  if (ready.pendingPeaceOffer) {
    ready = engine.gameReducer(ready, { type: ready.pendingPeaceOffer.terms?.length
      ? engine.ActionTypes.REJECT_PENDING_PEACE : engine.ActionTypes.ACCEPT_PENDING_PEACE });
  }
  if (ready.pendingDefenses?.length) ready = engine.gameReducer(ready, { type: engine.ActionTypes.RESOLVE_ALL_DEFENSES_AUTO });
  if (ready.gameStatus !== 'ACTIVE') return ready;
  let next = engine.resolveTurn(ready);
  if (next.activeProceduralEvent) next = { ...next, activeProceduralEvent: null };
  if (next.gameStatus === 'ACTIVE' && next.turnNumber !== ready.turnNumber + 1) {
    throw new Error(`Campaign stalled at turn ${ready.turnNumber}`);
  }
  engine.assertGameState(next);
  return next;
};

const runGame = (engine, playerNationId, seed, turns) => {
  const firedEvents = Object.keys(engine.HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
  let state = {
    ...engine.createInitialState({ playerNationId, rngSeed: seed }),
    firedEvents,
    proceduralEventCooldown: 999999,
    // Nobody is at the controls: defense battles auto-resolve instead of waiting for the player.
    battleSettings: { defaultMode: 'auto', autoDefend: true }
  };

  const seenWarIds = new Set();
  const seenBankruptNations = new Set();
  const seenCivilWarNations = new Set();
  let warsDeclared = 0;
  let peacesConcluded = 0;
  let regionOwnershipChanges = 0;
  let turnTimeMsTotal = 0;
  let completedTurns = 0;
  let lastOwnerById = {};
  Object.values(state.regions).forEach((r) => { lastOwnerById[r.id] = r.owner; });

  for (let t = 0; t < turns; t++) {
    const startedAt = performance.now();
    const next = advanceCampaign(engine, state);
    turnTimeMsTotal += performance.now() - startedAt;
    completedTurns += next.turnNumber - state.turnNumber;

    (next.wars || []).forEach((w) => {
      if (!seenWarIds.has(w.id)) {
        seenWarIds.add(w.id);
        warsDeclared++;
      }
    });
    const stillActiveIds = new Set((next.wars || []).filter((w) => w.active).map((w) => w.id));
    const wasActiveIds = new Set((state.wars || []).filter((w) => w.active).map((w) => w.id));
    wasActiveIds.forEach((id) => { if (!stillActiveIds.has(id)) peacesConcluded++; });

    Object.values(next.nations || {}).forEach((n, idx) => {
      const nationId = Object.keys(next.nations)[idx];
      if (n.hasBeenBankrupt && !seenBankruptNations.has(nationId)) seenBankruptNations.add(nationId);
      if (n.civilWar?.active && !seenCivilWarNations.has(nationId)) seenCivilWarNations.add(nationId);
    });

    Object.values(next.regions).forEach((r) => {
      if (lastOwnerById[r.id] !== undefined && lastOwnerById[r.id] !== r.owner) regionOwnershipChanges++;
      lastOwnerById[r.id] = r.owner;
    });

    state = next;
    if (state.gameStatus !== 'ACTIVE') break;
  }

  return {
    finalTurn: state.turnNumber,
    completedTurns,
    finalYear: state.year,
    finalStatus: state.gameStatus,
    warsDeclared,
    peacesConcluded,
    bankruptcies: seenBankruptNations.size,
    civilWars: seenCivilWarNations.size,
    regionOwnershipChanges,
    meanTurnMs: turnTimeMsTotal / Math.max(1, completedTurns),
    finalGoldByNation: Object.fromEntries(
      Object.entries(state.nations).map(([id, n]) => [id, Math.round(n.economy?.gold ?? (id === playerNationId ? state.resources.gold : 0))])
    )
  };
};

const main = async () => {
  const { games, turns, seed } = parseArgs(process.argv.slice(2));
  console.log(`Balance simulation: ${games} game(s) x up to ${turns} turns each (seed base ${seed})`);

  const enginePath = await buildSimEngine();
  const engine = await import(pathToFileURL(enginePath).href);
  fs.rmSync(enginePath, { force: true });

  const nationIds = Object.keys(engine.WORLD_NATIONS);
  const results = [];
  for (let g = 0; g < games; g++) {
    const playerNationId = nationIds[(seed + g) % nationIds.length];
    const gameSeed = seed * 1000 + g;
    console.log(`  game ${g + 1}/${games}: player=${playerNationId} seed=${gameSeed}`);
    results.push(runGame(engine, playerNationId, gameSeed, turns));
  }

  const sum = (key) => results.reduce((acc, r) => acc + r[key], 0);
  const avg = (key) => sum(key) / results.length;

  console.log('\n=== Summary across all games ===');
  console.log(`Wars declared:        total ${sum('warsDeclared')}, avg/game ${avg('warsDeclared').toFixed(1)}`);
  console.log(`Peace deals:          total ${sum('peacesConcluded')}, avg/game ${avg('peacesConcluded').toFixed(1)}`);
  console.log(`Bankruptcies:         total ${sum('bankruptcies')}, avg/game ${avg('bankruptcies').toFixed(1)}`);
  console.log(`Civil wars:           total ${sum('civilWars')}, avg/game ${avg('civilWars').toFixed(1)}`);
  console.log(`Region hand-changes:  total ${sum('regionOwnershipChanges')}, avg/game ${avg('regionOwnershipChanges').toFixed(1)}`);
  console.log(`Mean turn time:       ${avg('meanTurnMs').toFixed(2)}ms (plan §M0.4 budget: 80ms)`);
  console.log('\nPer-game results:');
  results.forEach((r, i) => {
    console.log(`  #${i + 1}: turn ${r.finalTurn} (${r.finalYear}), status ${r.finalStatus}, ` +
      `wars ${r.warsDeclared}, peaces ${r.peacesConcluded}, bankruptcies ${r.bankruptcies}, ` +
      `civil wars ${r.civilWars}, region changes ${r.regionOwnershipChanges}, ` +
      `mean turn ${r.meanTurnMs.toFixed(2)}ms`);
  });

  if (avg('meanTurnMs') > 80) {
    console.warn('\nWARNING: mean turn time exceeds the plan\'s 80ms/turn end-of-M16 budget.');
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((err) => {
  console.error(err);
  process.exit(1);
});
