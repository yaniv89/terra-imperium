// .claude/skills/balance-sim/turnPacing.sim.js
// Turn pacing (lane turn-pacing): what the player is asked each turn, read from the prompt stack the
// UI shows (End Turn's blockers, src/engine/turnBlockers.js, and the "needs you" chips,
// src/components/ui/nextPromptModel.js), and whether the turn report would open by itself
// (turnReportModel.js). A scripted player answers what blocks (createScriptedPlayer) and fills idle
// cities with the advisor (ADVISOR_PRODUCTION). Per seed one PACING line:
//   emptyTurns       turns with no blocker and no chip at all (nothing to do but End Turn)
//   staleTurns       turns with no blocker and no chip that was not already there last turn (the
//                    player already passed on every one: nothing new to decide)
//   softOnlyTurns    turns with chips but no blocker
//   cityTurns        turns with at least one "Choose production" blocker; cityPrompts the sum over turns
//   tapsPerCity      taps of the per-city flow (TAPS_PER_CITY each: End Turn, pick, close the sheet,
//                    close the tile card; playtest run 40550092795 counted about five) vs tapsAdvisor
//                    (one tap a turn with idle cities)
//   reportOld / reportNew  turns on which the report opens by itself, old rule vs turnReportModel's own
//   reportNewWhy     what opened it under the new rule, by group
//   TURNS=60 SEEDS=11,12,13,14 PLAYER=akkad npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/turnPacing.sim.js
import { it } from 'vitest';
import { resolveTurn } from '../../../src/engine/resolveTurn';
import { createInitialState, gameReducer } from '../../../src/context/GameContext';
import { ActionTypes, GameStatus } from '../../../src/data/types';
import { turnBlockers } from '../../../src/engine/turnBlockers';
import { nextPrompts } from '../../../src/components/ui/nextPromptModel';
import { turnReportModel } from '../../../src/components/ui/turnReportModel';
import { createScriptedPlayer } from '../../../scripts/campaignTelemetry.mjs';
import { bestSites, MAX_SETTLE_RINGS } from '../../../src/engine/settlers';
import { getResearched, getTechAgeId } from '../../../src/engine/nationState';

const TURNS = Number(process.env.TURNS || 60);
const SEEDS = String(process.env.SEEDS || '11').split(',').map(Number);
const PLAYER = process.env.PLAYER || 'akkad';
const SIZE = process.env.SIZE || 'standard';
const TAPS_PER_CITY = 5;
// The report's old rule: it opened unless every line was research, growth or unmet news.
const oldQuiet = (r) => r.items.every((i) => i.group === 'research' || i.growth || i.unmet);

SEEDS.forEach((seed) => {
  it(`pacing seed ${seed}`, () => {
    let s = createInitialState({ playerNationId: PLAYER, rngSeed: seed, scenario: { mode: 'peoples', size: SIZE, seed } });
    s = { ...s, research: { ...s.research, auto: true }, battleSettings: { ...(s.battleSettings || {}), autoDefend: true } };
    const player = createScriptedPlayer({ engine: { gameReducer, ActionTypes, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId }, production: false });
    const out = { seed, turns: 0, emptyTurns: 0, staleTurns: 0, softOnlyTurns: 0, cityTurns: 0, cityPrompts: 0, advisorQueued: 0, reportOld: 0, reportNew: 0, reportNewWhy: {}, kinds: {} };
    let seen = null; let lastChips = new Set();
    for (let t = 1; t <= TURNS && s.gameStatus === GameStatus.ACTIVE; t++) {
      out.turns += 1;
      if (seen) {
        const r = turnReportModel(seen, s, 'en');
        if (r && !oldQuiet(r)) out.reportOld += 1;
        if (r && !r.quiet) { out.reportNew += 1; r.items.filter((i) => i.matters).forEach((i) => { out.reportNewWhy[i.group] = (out.reportNewWhy[i.group] || 0) + 1; }); }
      }
      const blockers = turnBlockers(s);
      const chips = nextPrompts(s).filter((p) => p.kind !== 'guide');
      [...blockers.map((b) => b.kind), ...chips.map((p) => p.kind)].forEach((k) => { out.kinds[k] = (out.kinds[k] || 0) + 1; });
      if (!blockers.length && !chips.length) out.emptyTurns += 1;
      else if (!blockers.length) out.softOnlyTurns += 1;
      if (!blockers.length && chips.every((p) => lastChips.has(p.id))) out.staleTurns += 1;
      lastChips = new Set(chips.map((p) => p.id));
      // Events take their first answer that works (the scripted player only clears historical ones).
      // (an option the player cannot afford is refused: the next one is tried)
      for (let k = 0; k < 6 && (s.activeEventId || s.activeProceduralEvent); k++) s = gameReducer(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: k } });
      s = player.answer(s).state;
      const idle = turnBlockers(s).filter((b) => b.kind === 'city').length;
      if (idle) {
        out.cityTurns += 1; out.cityPrompts += idle;
        const before = s;
        s = gameReducer(s, { type: ActionTypes.ADVISOR_PRODUCTION });
        out.advisorQueued += Object.keys(s.regions).filter((id) => s.regions[id].production?.current && !before.regions[id].production?.current).length;
        out.cityLeftIdle = (out.cityLeftIdle || 0) + turnBlockers(s).filter((b) => b.kind === 'city').length;
      }
      seen = s;
      const at = s.turnNumber;
      s = resolveTurn(s);
      // A turn that did not move (something the scripted player cannot answer): say what, and stop.
      if (s.turnNumber === at) { out.stuck = { turn: at, blockers: turnBlockers(s).map((b) => b.kind), defenses: (s.pendingDefenses || []).length, event: s.activeEventId || s.activeProceduralEvent?.id || null, peace: !!s.pendingPeaceOffer, battle: !!s.pendingBattle }; break; }
    }
    out.tapsPerCity = out.cityPrompts * TAPS_PER_CITY;
    out.tapsAdvisor = out.cityTurns;
    out.finalTurn = s.turnNumber;
    out.cities = Object.values(s.regions).filter((c) => c.owner === s.playerNationId).length;
    console.log(`PACING ${JSON.stringify(out)}`);
  });
});
