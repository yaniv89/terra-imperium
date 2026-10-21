// .claude/skills/balance-sim/eventDeck.sim.js
// The player's events over a long game (U26 event deck): TURNS turns of a peoples world with events
// ON, each event answered with its first option the turn it opens, every other blocker answered by
// the scripted player. Prints one EVENTS line per seed: events per player age, by kind (story,
// link, draw), the shortest gap between two draws of one family (turns) and stalls (turns that did
// not advance). Reads only state fields, so it runs on a base commit before the deck too.
//   TURNS=300 SEEDS=11,12 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/eventDeck.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { HISTORICAL_EVENTS } from '../../../src/data/events';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from '../../../src/engine/aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';
import * as AGES from '../../../src/data/ages';
import { opinionOf } from '../../../src/engine/opinion';

const TURNS = Number(process.env.TURNS || 300);
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';

SEEDS.forEach((seed) => {
  it(`events seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    const perAge = {}; const kinds = { story: 0, link: 0, draw: 0 }; const lastFamily = {}; let minFamilyGap = Infinity; let stalls = 0;
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      if (s.activeEventId || s.activeProceduralEvent) {
        const ev = s.activeProceduralEvent;
        const kind = s.activeEventId ? (HISTORICAL_EVENTS[s.activeEventId] ? 'story' : 'link') : ev.procedural ? 'draw' : 'link';
        kinds[kind] += 1;
        const age = getTechAgeId(s, s.playerNationId);
        perAge[age] = (perAge[age] || 0) + 1;
        if (kind === 'draw') {
          if (lastFamily[ev.family] != null) minFamilyGap = Math.min(minFamilyGap, s.turnNumber - lastFamily[ev.family]);
          lastFamily[ev.family] = s.turnNumber;
        }
        s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
      }
      s = scripted.answer(s).state;
      const turn = s.turnNumber;
      s = resolveTurn(s);
      if (s.turnNumber === turn && s.gameStatus === GameStatus.ACTIVE) stalls += 1;
    }
    const total = kinds.story + kinds.link + kinds.draw;
    console.log(`EVENTS seed=${seed} turn=${s.turnNumber} total=${total} story=${kinds.story} link=${kinds.link} draw=${kinds.draw} minFamilyGap=${minFamilyGap} familyCooldown=${Math.ceil(5 * AGES.speedCostMult(s.gameSpeed, getTechAgeId(s, s.playerNationId)))} stalls=${stalls} perAge=${JSON.stringify(perAge)}`);
  });
});
