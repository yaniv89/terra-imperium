// src/engine/macroVerify.test.js
// Macro replay verification (differentiation plan U35): a scripted 100-turn game recorded through
// the action log replays from its start to the same final state hash; an edited action fails; a
// commanded battle inside a log is replayed by its own verify (battleVerify.js).
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { startState, gameReducer } from './gameReducer';
import { startLog, logAction, checkLog, LOG_VERSION } from './actionLog';
import { verifyGame, replayActions, stateHash } from './macroVerify';
import { ActionTypes } from '../data/types';
import { createScriptedPlayer } from '../../scripts/campaignTelemetry.mjs';
import { chooseProduction, nationCounts } from './aiProduction';
import { bestSites, MAX_SETTLE_RINGS } from './settlers';
import { getResearched, getTechAgeId } from './nationState';
import { speedCostMult } from '../data/ages';
import { buildCommandedSetup } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { getTouchingIds, getNeighborIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, neighbourWorld } from './testWorld';

const TURNS = 100;
const START = { playerNationId: 'akkad', gameSpeed: 'normal', rngSeed: 7, scenario: { mode: 'peoples', size: 'small', seed: 7 } };

// The scripted player of the balance harness, every decision a dispatched (and logged) action.
const playGame = () => {
  let log = startLog(START);
  const record = (s, a) => { log = logAction(log, a); return gameReducer(s, a); };
  const player = createScriptedPlayer({ engine: { gameReducer: record, ActionTypes, chooseProduction, nationCounts, bestSites, MAX_SETTLE_RINGS, getResearched, getTechAgeId, speedCostMult } });
  let s = startState(START);
  for (let t = 0; t < TURNS && s.gameStatus === 'ACTIVE'; t++) {
    if (s.activeEventId || s.activeProceduralEvent) s = record(s, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    (s.joinOffers || []).forEach((o) => { s = record(s, { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: false } }); });
    s = player.answer(s).state;
    s = record(s, { type: ActionTypes.ADVANCE_TURN });
  }
  return { log, end: s };
};

describe('macro replay verification', () => {
  let game = null;
  const played = () => (game ||= playGame());

  it('a scripted 100-turn game replays from its log (sent as JSON) to the same final hash', () => {
    const { log, end } = played();
    expect(end.turnNumber).toBe(startState(START).turnNumber + TURNS);
    const wire = JSON.stringify(log);
    const turns = log.actions.filter((a) => a.type === ActionTypes.ADVANCE_TURN).length;
    console.log(`macro log: ${log.actions.length} actions, ${wire.length} bytes, ${Math.round(wire.length / turns)} bytes a turn`);
    expect(log.actions.length).toBeGreaterThan(turns); // the player did more than end turns
    // MACRO_LOG_OUT=file: keep the log and its hash, to replay elsewhere (another engine, a browser)
    if (process.env.MACRO_LOG_OUT) writeFileSync(process.env.MACRO_LOG_OUT, JSON.stringify({ log, hash: stateHash(end) }));
    const v = verifyGame(JSON.parse(wire), stateHash(end));
    expect(v).toEqual({ status: 'verified', hash: stateHash(end), turns: end.turnNumber, problem: null });
  }, 600000);

  it('one edited action fails the check', () => {
    const { log, end } = played();
    const i = log.actions.findIndex((a) => a.type === ActionTypes.QUEUE_PRODUCTION);
    expect(i).toBeGreaterThanOrEqual(0);
    const edited = { ...log, actions: log.actions.filter((_, j) => j !== i) };
    expect(verifyGame(edited, stateHash(end)).status).toBe('mismatch');
  }, 600000);

  it('a malformed log is refused before it runs', () => {
    expect(checkLog(startLog(START))).toBeNull();
    expect(verifyGame(null, 'x').status).toBe('invalid');
    expect(verifyGame({ ...startLog(START), version: LOG_VERSION + 1 }, 'x').status).toBe('invalid');
    expect(verifyGame({ ...startLog(START), actions: [{ type: 'MINT_GOLD' }] }, 'x')).toMatchObject({ status: 'invalid', problem: 'action 0 refused' });
    expect(verifyGame({ ...startLog(START), actions: [{ type: ActionTypes.LOAD_GAME, payload: {} }] }, 'x').status).toBe('invalid');
    // a worker's turn result or a load never enters a log
    const log = startLog(START);
    expect(logAction(log, { type: ActionTypes.APPLY_TURN_RESULT, payload: {} })).toBe(log);
    expect(logAction(log, { type: ActionTypes.ADVANCE_TURN }).actions).toEqual([{ type: ActionTypes.ADVANCE_TURN }]);
  });

  it('a commanded battle in the log is replayed by its own verify: a forged result is not the one applied', () => {
    // The tacticalBattle.test.js fixture: a city of the player at war beside an enemy city, armies on both.
    const first = addCity(neighbourWorld({ player: 'ahhiyawa', seed: 1, age: 'bronze' }), 'ahhiyawa');
    const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== 'ahhiyawa') || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== 'ahhiyawa');
    const enemy = first.state.regions[target].owner;
    const gate = getTouchingIds(first.cityId).includes(target) ? null : getTiles().neighbors[first.state.regions[target].tile].find((n) => getTiles().land[n] === 1);
    const unit = (id, regionId, ownerId, classId = 'infantry') => ({ id, regionId, ownerId, domain: 'land', classId, strength: 1000, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1, ...(ownerId === 'ahhiyawa' && gate != null ? { tile: gate } : {}) });
    const s0 = {
      ...first.state,
      resources: { ...first.state.resources, gold: 100000, hr: 100000, mil: 500 },
      wars: [...first.state.wars, { id: 'war_t', aggressor: 'ahhiyawa', enemy, active: true, goalAchieved: false, startTurn: first.state.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }],
      units: { a1: unit('a1', first.cityId, 'ahhiyawa'), a2: unit('a2', first.cityId, 'ahhiyawa', 'cavalry'), d1: unit('d1', target, enemy) }
    };
    const begin = { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: first.cityId, targetRegionId: target } };
    const started = gameReducer(s0, begin);
    const setup = buildCommandedSetup(started, started.pendingBattle);
    const orders = [{ side: 0, type: 'attackMove', squads: [0, 1], x: 60 * 256, y: 30 * 256, tick: 0, seq: 0 }];
    const truth = runHeadless(setup, { orders });
    const resolve = (result) => ({ type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result, log: orders, hash: truth.hash } });
    const honest = replayActions(s0, [begin, resolve(truth.result), { type: ActionTypes.ADVANCE_TURN }]);
    const forged = replayActions(s0, [begin, resolve({ outcome: truth.result.outcome === 'attacker' ? 'defender' : 'attacker', attackerUnits: [], defenderUnits: [] }), { type: ActionTypes.ADVANCE_TURN }]);
    expect(replayActions(s0, [begin, resolve(truth.result)]).lastBattleReport.tactical.verification.status).toBe('verified');
    expect(honest.turnNumber).toBe(s0.turnNumber + 1);
    expect(stateHash(forged)).toBe(stateHash(honest));
  }, 300000);
});
