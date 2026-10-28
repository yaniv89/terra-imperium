// .claude/skills/balance-sim/heLog.sim.js
// The i18n sweep's log check: plays a scripted peoples game and prints every log line that still
// shows Latin letters in Hebrew (a line without a msgKey, or a name or table missing in Hebrew).
//   TURNS=80 SEEDS=11 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/heLog.sim.js
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
import { logText } from '../../../src/i18n/messageText';

const TURNS = Number(process.env.TURNS || 80);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const LATIN = /[A-Za-z]{2,}|\d+g\b/;

SEEDS.forEach((seed) => {
  it(`he log seed ${seed}`, () => {
    let s = { ...createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: 'standard', seed } }), battleSettings: { autoDefend: true } };
    s = { ...s, research: { ...s.research, auto: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, opinionOf });
    const bad = new Map(); let total = 0; const seen = new Set();
    const scan = () => (s.logs || []).forEach((l) => {
      const id = `${l.year}|${l.message}`; if (seen.has(id)) return; seen.add(id); total += 1;
      const he = logText(l, 'he');
      if (LATIN.test(he)) { const k = l.msgKey || 'NO-KEY'; const b = bad.get(k) || { n: 0, ex: he }; b.n += 1; bad.set(k, b); }
    });
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      s = scripted.answer(s).state;
      s = resolveTurn(s);
      scan();
    }
    console.log(`HELOG seed=${seed} turn=${s.turnNumber} lines=${total} latin=${[...bad.values()].reduce((a, b) => a + b.n, 0)}`);
    [...bad.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([k, b]) => console.log(`HEBAD ${b.n} ${k} :: ${b.ex}`));
  });
});
