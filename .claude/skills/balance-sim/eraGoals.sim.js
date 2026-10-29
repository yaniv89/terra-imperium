// .claude/skills/balance-sim/eraGoals.sim.js
// Era goal reach (follow-up 24): a whole Normal game (TURNS, default the speed's turn limit) of a
// peoples world, events answered with their first option, every other blocker by the scripted
// player. Prints one ERAGOALS line per seed: for every age, the majors scored in it (left it, or
// were in it at the end) and how many met each goal. Reads only nation.eraGoals, the record the
// engine keeps, so it runs on a base commit too.
//   SEEDS=11 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/eraGoals.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { opinionOf } from '../../../src/engine/opinion';
import { eraGoalProgress } from '../../../src/engine/eraGoals';

const SPEED = process.env.SPEED || 'normal';
const TURNS = Number(process.env.TURNS || AGES.speedTurnLimit(SPEED));
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';

SEEDS.forEach((seed) => {
  it(`era goals seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, gameSpeed: SPEED, scenario: { mode: 'peoples', size: 'standard', seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    const prog = {};
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.activeEventId || s.activeProceduralEvent) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
      if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; // an option it cannot afford
      s = scripted.answer(s).state;
      const before = s.turnNumber;
      s = resolveTurn(s);
      // the player's best value per goal and age (lane early-pace-8: how close a scripted player comes)
      const pa = getTechAgeId(s, s.playerNationId); const pp = (prog[pa] ||= { turns: 0 }); pp.turns += 1;
      eraGoalProgress(s, pa, s.playerNationId).goals.forEach((g) => { pp[g.id] = `${Math.max(Number(String(pp[g.id] || '0/').split('/')[0]), g.value)}/${g.target}`; });
      if (s.turnNumber === before && process.env.DEBUG) console.log('STALL', s.turnNumber, Object.keys(s).filter((k) => /^(pending|active)/i.test(k) && s[k] && (!Array.isArray(s[k]) || s[k].length)));
    }
    // ages[age] = { n: majors scored, goal: count met }; an age still running at the stop is read live.
    const ages = {};
    Object.values(s.nations).filter((n) => n.kind !== 'independent' && !n.isEliminated).forEach((n) => {
      const rec = { ...(n.eraGoals || {}) };
      const cur = getTechAgeId(s, n.id);
      if (!rec[cur]) rec[cur] = { met: eraGoalProgress(s, cur, n.id).goals.filter((g) => g.done).map((g) => g.id) };
      Object.entries(rec).forEach(([age, r]) => {
        const a = (ages[age] ||= { n: 0 });
        a.n += 1;
        (r.met || []).forEach((g) => { a[g] = (a[g] || 0) + 1; });
      });
    });
    console.log(`ERAGOALS seed=${seed} turn=${s.turnNumber} status=${s.gameStatus} ages=${JSON.stringify(ages)}`);
    console.log(`PLAYERGOALS seed=${seed} met=${JSON.stringify(Object.fromEntries(Object.entries(s.nations[s.playerNationId]?.eraGoals || {}).map(([a, r]) => [a, r.met || []])))} best=${JSON.stringify(prog)}`);
  });
});
