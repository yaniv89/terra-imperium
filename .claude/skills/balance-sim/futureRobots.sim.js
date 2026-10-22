// .claude/skills/balance-sim/futureRobots.sim.js
// Eight ages Phase E (U67 to U72): a peoples world where every major starts in the Future with the
// robot techs and Automated Industry, run TURNS turns with the scripted player. Prints one FUTURE
// line per seed: robot share of land units, automation (mean, max), riots, Machine Uprisings per
// 100 nation-turns (the plan's bar: under 1), Council resolutions passed, audit issues, ms a turn.
//   TURNS=100 SEEDS=11,12 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/futureRobots.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import { withAgesResearched, withTechsResearched } from '../../../src/engine/research';
import { auditGameState } from '../../../src/engine/stateAudit';
import { isIndependentNation } from '../../../src/data/independents';
import { ROBOT_TECH } from '../../../src/data/unitClasses';
import * as AGES from '../../../src/data/ages';
import { opinionOf } from '../../../src/engine/opinion';

const TURNS = Number(process.env.TURNS || 100);
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const FUTURE_TECHS = [ROBOT_TECH, 'science_machine_consciousness', 'economy_automated_industry', 'governance_global_institutions', 'governance_planetary_federation'];

SEEDS.forEach((seed) => {
  it(`future robots seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
    const majors = Object.keys(s.nations).filter((id) => !isIndependentNation(s.nations[id]));
    majors.forEach((id) => { s = withTechsResearched(withAgesResearched(s, id, 'future'), id, FUTURE_TECHS); });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true }, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((k) => [k, true])), proceduralEventCooldown: 999999 };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    let uprisings = 0; let riotTurns = 0; let nationTurns = 0; let ms = 0; let audit = 0;
    const live = (st) => majors.filter((id) => st.nations[id] && !st.nations[id].isEliminated);
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      s = scripted.answer(s).state;
      const before = s;
      const t0 = performance.now();
      s = resolveTurn(s);
      ms += performance.now() - t0;
      live(s).forEach((id) => {
        nationTurns += 1;
        if (s.nations[id].automationRiots) riotTurns += 1;
        if (s.nations[id].civilWar?.machines && !before.nations[id]?.civilWar?.active) uprisings += 1;
      });
      if (t % 25 === 0) audit += auditGameState(s).length;
    }
    const units = Object.values(s.units).filter((u) => u.domain === 'land' && majors.includes(u.ownerId));
    const robots = units.filter((u) => u.robot).length;
    const auto = live(s).map((id) => s.nations[id].automation || 0);
    const passed = (s.worldCongress?.record || []).filter((r) => r.passed).map((r) => r.id);
    console.log(`FUTURE seed=${seed} turn=${s.turnNumber} status=${s.gameStatus} landUnits=${units.length} robots=${robots} robotShare=${(robots / Math.max(1, units.length)).toFixed(2)} automationMean=${(auto.reduce((a, b) => a + b, 0) / Math.max(1, auto.length)).toFixed(1)} automationMax=${Math.max(0, ...auto)} riotShare=${(riotTurns / Math.max(1, nationTurns)).toFixed(3)} uprisings=${uprisings} uprisingsPer100=${((100 * uprisings) / Math.max(1, nationTurns)).toFixed(3)} councilPassed=${JSON.stringify(passed)} binds=${(s.worldCongress?.binds || []).length} audit=${audit} msPerTurn=${(ms / Math.max(1, s.turnNumber - 1)).toFixed(1)}`);
  });
});
