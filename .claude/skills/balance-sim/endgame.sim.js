// .claude/skills/balance-sim/endgame.sim.js
// The passive endgame of src/engine/endgameReachability.test.js as a sim, so compare.sh can run it on a
// base commit and the working tree at once (lane early-pace-8): prints one ENDGAME line with the turn,
// status, ending reason and the leader's techs every 100 turns.
//   SEEDS=7 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/endgame.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { gameReducer } from '../../../src/context/GameContext';
import { peoplesWorld } from '../../../src/engine/testWorld';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { advanceCampaign } from '../../../scripts/simulate.mjs';
import { assertGameState } from '../../../src/engine/stateAudit';

const SEEDS = String(process.env.SEEDS || '7').split(',').map(Number);
const firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));

SEEDS.forEach((seed) => {
  it(`endgame seed ${seed}`, () => {
    let s = { ...peoplesWorld({ seed }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
    const marks = [];
    for (let i = 0; i < 1200 && s.gameStatus === GameStatus.ACTIVE; i++) {
      s = advanceCampaign({ resolveTurn, gameReducer, ActionTypes, assertGameState }, s);
      if (s.turnNumber % 100 === 0) marks.push(`${s.turnNumber}:${Math.max(...Object.values(s.nations).map((n) => n.tech?.researched?.length || 0))}`);
    }
    console.log(`ENDGAME seed=${seed} turn=${s.turnNumber} status=${s.gameStatus} ending=${JSON.stringify(s.ending)} leaderTechs=${marks.join(',')}`);
  }, 3600000);
});
