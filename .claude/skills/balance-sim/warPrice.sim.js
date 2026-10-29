// .claude/skills/balance-sim/warPrice.sim.js
// The early war price (lane pacing-8): the player's gold, net gold a turn and the unjustified war price
// at checkpoints, plus whether any neighbour major offers a casus belli. Scripted player, Normal speed.
//   TURNS=120 EVERY=10 SEEDS=11,12,13,14 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/warPrice.sim.js
import { it } from 'vitest';
import { appendFileSync } from 'fs';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId, ageOf } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { calcNationBalance } from '../../../src/engine/economy';
import { hasCasusBelli } from '../../../src/engine/diplomacy';
import { warCost } from '../../../src/utils/costs';
import { decreesOf } from '../../../src/engine/decrees';

const TURNS = Number(process.env.TURNS || 120);
const EVERY = Number(process.env.EVERY || 10);
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const OUT = process.env.OUT || 'warPrice.out';

SEEDS.forEach((seed) => {
  it(`war price seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse' });
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      for (let k = 0; k < 6 && (s.activeEventId || s.activeProceduralEvent); k++) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: k } });
      if (s.activeEventId || s.activeProceduralEvent) s = { ...s, activeEventId: null, activeProceduralEvent: null };
      s = scripted.answer(s).state;
      if (t % EVERY === 0 || t === 1) {
        const me = s.playerNationId;
        const price = warCost(s, false).gold;
        const net = Math.round(calcNationBalance(s, me).net * 10) / 10;
        const majors = Object.keys(s.nations || {}).filter((id) => id !== me && s.nations[id]?.kind !== 'independent' && s.nations[id]?.isAlive !== false);
        const cb = majors.filter((id) => hasCasusBelli(s, me, id)).length;
        appendFileSync(OUT, `WAR seed=${seed} turn=${s.turnNumber} age=${ageOf(s, me)} gold=${Math.round(s.resources?.gold || 0)} net=${net} price=${price} turnsToPay=${net > 0 ? Math.ceil(price / net) : 'never'} cbTargets=${cb} decrees=${decreesOf(s.nations[me])}\n`);
      }
      s = resolveTurn(s);
    }
  });
});
