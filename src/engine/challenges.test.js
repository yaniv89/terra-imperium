// src/engine/challenges.test.js
// Weekly challenge (differentiation plan U36): the same week gives the same challenge, and a
// submission is accepted only when its log replays to the claimed hash and score.
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { isoWeekId } from '../services/challenges';
import { challengeForWeek, verifyChallenge, challengeScore, replayChecked } from './challenges';
import { startLog, logAction } from './actionLog';
import { startState, gameReducer } from './gameReducer';
import { stateHash } from './macroVerify';
import { ActionTypes } from '../data/types';
import { ENGINE_BUILD, TURN_LIMIT, MAX_LOG_BYTES } from '../data/challenges';

const WEEK = '2026-W43';
const play = (first = []) => {
  const c = challengeForWeek(WEEK);
  let log = startLog(c.start);
  let s = startState(c.start);
  for (const a of first) { log = logAction(log, a); s = gameReducer(s, a); }
  for (let i = 0; i < TURN_LIMIT; i++) {
    if (s.activeEventId || s.activeProceduralEvent) { const a = { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } }; log = logAction(log, a); s = gameReducer(s, a); }
    const a = { type: ActionTypes.ADVANCE_TURN }; log = logAction(log, a); s = gameReducer(s, a);
  }
  return { log, sub: { weekId: WEEK, build: ENGINE_BUILD, log, hash: stateHash(s), score: challengeScore(s) } };
};

describe('weekly challenge', () => {
  it('the week id and the challenge are deterministic', () => {
    expect(isoWeekId(new Date(Date.UTC(2026, 9, 21)))).toBe('2026-W43');
    expect(isoWeekId(new Date(Date.UTC(2027, 0, 1)))).toBe('2026-W53');
    expect(challengeForWeek(WEEK)).toEqual(challengeForWeek(WEEK));
    expect(challengeForWeek(WEEK).seed).not.toBe(challengeForWeek('2026-W44').seed);
    expect(challengeForWeek('nonsense')).toBeNull();
  });

  it('security: honest accepted; forged score, wrong seed, tampered log, other build, hostile logs rejected', () => {
    const { sub } = play();
    // CHALLENGE_SUB_OUT=file keeps the submission, to run scripts/verifyChallenges.mjs --file on it
    if (process.env.CHALLENGE_SUB_OUT) writeFileSync(process.env.CHALLENGE_SUB_OUT, JSON.stringify(sub));
    const ok = verifyChallenge(sub);
    expect(ok).toMatchObject({ status: 'verified', score: sub.score });
    // forged score or hash
    expect(verifyChallenge({ ...sub, score: sub.score + 1000 })).toMatchObject({ status: 'rejected', reason: 'mismatch' });
    expect(verifyChallenge({ ...sub, hash: '0000000000000000' }).status).toBe('rejected');
    // wrong seed: another week's start under this week's claim
    const other = challengeForWeek('2026-W44').start;
    expect(verifyChallenge({ ...sub, log: { ...sub.log, start: other } })).toMatchObject({ status: 'rejected', reason: 'seed' });
    expect(verifyChallenge({ ...sub, log: { ...sub.log, start: { ...sub.log.start, difficultyId: 'easy' } } }).reason).toBe('seed');
    // tampered log: an extra action the player did not take changes the replay
    const i = sub.log.actions.findIndex((a) => a.type === ActionTypes.ADVANCE_TURN);
    const tax = { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'low' } };
    const tampered = { ...sub.log, actions: [...sub.log.actions.slice(0, i), tax, ...sub.log.actions.slice(i)] };
    expect(verifyChallenge({ ...sub, log: tampered }).status).toBe('rejected');
    // another build is closed, a bad week is refused
    expect(verifyChallenge({ ...sub, build: 'e0' })).toEqual({ status: 'closed' });
    expect(verifyChallenge({ ...sub, weekId: '2026-W99' }).reason).toBe('week');
    // schema: unknown action type, unknown field, wrong turn count, oversized
    const withActions = (actions) => verifyChallenge({ ...sub, log: { ...sub.log, actions } });
    expect(withActions([{ type: 'MINT_GOLD' }]).status).toBe('rejected');
    expect(withActions([{ ...sub.log.actions[0], evil: 1 }, ...sub.log.actions.slice(1)]).reason).toBe('fields');
    expect(withActions(sub.log.actions.slice(1)).reason).toBe('turns');
    expect(withActions([{ type: ActionTypes.ADVANCE_TURN, payload: 'x'.repeat(MAX_LOG_BYTES) }]).reason).toBe('size');
    expect(verifyChallenge(null).status).toBe('rejected');
    // an extra turn hidden in a FAST_FORWARD (not an ADVANCE_TURN) is counted on the replayed state
    const s0 = startState(sub.log.start);
    const cap = Object.values(s0.regions).find((c) => c.owner === s0.playerNationId).id;
    const cheat = play([{ type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cap, item: { kind: 'unit', classId: 'infantry' } } }, { type: ActionTypes.FAST_FORWARD }]).sub;
    expect(verifyChallenge(cheat).reason).toBe('turns');
  }, 600000);

  it('security: a commanded battle without its order log (a client-claimed result) is refused', () => {
    const s = { ...startState(challengeForWeek(WEEK).start), pendingBattle: { id: 'b1', kind: 'field', attackerUnitIds: [], defenderUnitIds: [] } };
    const forged = { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: 'b1', result: { outcome: 'attacker', attackerUnits: [], defenderUnits: [] } } };
    expect(replayChecked(s, [forged])).toEqual({ reason: 'battle' });
    expect(replayChecked(s, [{ type: ActionTypes.SET_TAX_RATE, payload: { rate: 'low' } }]).state).toBeTruthy();
  });
});
