// .claude/skills/balance-sim/storyPulse.sim.js
// What the player meets between battles, per player age (events-8 lane): a Normal game of a peoples
// world (TURNS, default the speed's turn limit), events answered with option PICK (default 0), every
// other blocker by the scripted player. Prints one PULSE line per seed and age:
//   ev      event cards shown          turns   turns spent in the age
//   real    (eventDeck.js cardChoice) cards where no option is as good or better than another on every count (a real trade-off)
//   free    cards where every option only gains (no price at all)       goldOnly  cards whose options differ only in gold
//   follow  link cards (a follow-up of an earlier choice)             warn/hit  crises announced on / striking the player
//   crisisCard  crisis cards (struck or answer)    raidCard  raid aftermath cards    dawn  age dawn cards
//   congress  World Congress votes while the player sat               goals  era goals the player met in the age
// Reads only state fields, so it runs on a base commit too.
//   SEEDS=11,12 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/storyPulse.sim.js
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
import { congressMembers } from '../../../src/engine/worldCongress';
import { cardOf, cardChoice as classify } from '../../../src/engine/eventDeck';

const SPEED = process.env.SPEED || 'normal';
const TURNS = Number(process.env.TURNS || AGES.speedTurnLimit(SPEED));
const SEEDS = (process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const PICK = Number(process.env.PICK || 0);

SEEDS.forEach((seed) => {
  it(`story pulse seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, gameSpeed: SPEED, scenario: { mode: 'peoples', size: 'standard', seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { autoDefend: true } };
    const scripted = createScriptedPlayer({ engine: { gameReducer, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, getEffectiveAgeId: AGES.getEffectiveAgeId, speedCostMult: AGES.speedCostMult, speedTrainMult: AGES.speedTrainMult }, demands: 'refuse', opinionOf });
    const per = {};
    const row = (age) => (per[age] ||= { turns: 0, ev: 0, real: 0, free: 0, goldOnly: 0, follow: 0, crisisCard: 0, raidCard: 0, dawn: 0, warn: 0, hit: 0, congress: 0, goals: 0 });
    let warnSeen = null; let histLen = 0; let votes = 0;
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      const age = getTechAgeId(s, s.playerNationId);
      const r = row(age);
      if (s.activeEventId || s.activeProceduralEvent) {
        const ev = s.activeEventId ? cardOf(s.activeEventId) : s.activeProceduralEvent;
        r.ev += 1;
        if (s.activeEventId ? !HISTORICAL_EVENTS[s.activeEventId] : !ev.procedural) r.follow += 1;
        const c = classify(ev?.options || []);
        const cid = String(s.activeEventId || ev?.id || '');
        if (cid.startsWith('crisis_')) r.crisisCard += 1;
        if (/^raid_(beaten|suffered)/.test(cid)) r.raidCard += 1;
        if (ev?.templateId === 'era_dawn') r.dawn += 1;
        if (c.real) r.real += 1; if (c.free) r.free += 1; if (c.goldOnly) r.goldOnly += 1;
        s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: Math.min(PICK, (ev?.options?.length || 1) - 1) } });
        if (s.activeEventId || s.activeProceduralEvent) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
        if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null };
        if (s.activeEventId) s = { ...s, activeEventId: null };
      }
      s = scripted.answer(s).state;
      const before = s.turnNumber;
      s = resolveTurn(s);
      if (s.turnNumber !== before) r.turns += 1;
      const coming = s.crises?.coming;
      if (coming && coming.nations.includes(s.playerNationId) && warnSeen !== coming.turn) { warnSeen = coming.turn; r.warn += 1; }
      const hist = s.crises?.history || [];
      for (; histLen < hist.length; histLen++) if (hist[histLen].nations.includes(s.playerNationId)) r.hit += 1;
      const wc = s.worldCongress;
      if (wc && wc.votes > votes) { if (congressMembers(s).includes(s.playerNationId)) r.congress += wc.votes - votes; votes = wc.votes; }
    }
    const goals = s.nations[s.playerNationId]?.eraGoals || {};
    Object.entries(goals).forEach(([age, g]) => { row(age).goals = (g.met || []).length; });
    AGES.AGE_ORDER.filter((a) => per[a]).forEach((a) => console.log(`PULSE seed=${seed} age=${a} ${Object.entries(per[a]).map(([k, v]) => `${k}=${v}`).join(' ')}`));
    console.log(`PULSE seed=${seed} end turn=${s.turnNumber} status=${s.gameStatus} worldCrises=${(s.crises?.history || []).map((h) => h.id).join(',')} congressVotes=${s.worldCongress?.votes || 0} focus=${Object.entries(s.nations[s.playerNationId]?.eraGoals || {}).map(([a, g]) => `${a}:${g.focus || '-'}`).join(',')}`);
  });
});
