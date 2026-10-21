// src/engine/challenges.js
// The weekly seeded challenge (differentiation plan U36, KTD16): the same people, world seed and
// Stone Age start for everyone in an ISO week, scored by the legacy score after TURN_LIMIT turns.
// A submission is accepted only when its action log replays (macroVerify) to the claimed hash
// and score. Pure: the week id comes in from the menu, never from a clock in here.
import { ENGINE_BUILD, TURN_LIMIT, MAX_LOG_BYTES, MAX_ACTIONS } from '../data/challenges';
import { MAJOR_PEOPLES_LIST } from '../data/peoples';
import { ActionTypes } from '../data/types';
import { checkLog } from './actionLog';
import { stateHash } from './macroVerify';
import { startState, gameReducer } from './gameReducer';
import { verifyCommandedBattle, REPLAYED } from './battleVerify';
import { syncWorldRegistry } from './world/registry';
import { legacyScore } from './legacy';
import { calcNationScore } from './score';

const WEEK = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

const seedOf = (weekId) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < weekId.length; i++) h = Math.imul(h ^ weekId.charCodeAt(i), 0x01000193);
  return (h >>> 0) % 2147483647 || 1;
};

/** The challenge of a week, or null for a malformed id. `start` is the exact RESET_GAME payload. */
export const challengeForWeek = (weekId) => {
  if (typeof weekId !== 'string' || !WEEK.test(weekId)) return null;
  const seed = seedOf(weekId);
  const people = MAJOR_PEOPLES_LIST[seed % MAJOR_PEOPLES_LIST.length].id;
  return {
    weekId, seed, people, build: ENGINE_BUILD, turnLimit: TURN_LIMIT,
    start: { playerNationId: people, gameSpeed: 'normal', scenario: { mode: 'peoples', size: 'small', seed, map: { kind: 'earth' } }, rngSeed: seed }
  };
};

/** The score rule: legacy points first, the old nation score breaking ties. */
export const challengeScore = (state) => legacyScore(state, state.playerNationId).total * 1000 + calcNationScore(state, state.playerNationId).total;

export const turnsIn = (log) => log.actions.filter((a) => a.type === ActionTypes.ADVANCE_TURN).length;

const reject = (reason) => ({ status: 'rejected', reason });

/**
 * Replays `actions` from `state`; { state } or { reason }. A commanded battle must replay from its
 * own order log: without one the reducer keeps the client's (sanitized) result, a free win.
 */
export const replayChecked = (state, actions) => {
  for (const a of actions) {
    const pb = state.pendingBattle;
    if (a.type === ActionTypes.RESOLVE_TACTICAL_BATTLE && pb && pb.id === a.payload?.battleId) {
      syncWorldRegistry(state);
      if (!REPLAYED.has(verifyCommandedBattle(state, pb, a.payload).verification.status)) return { reason: 'battle' };
    }
    state = gameReducer(state, a);
  }
  return { state };
};

/**
 * { status: 'verified', score, hash } | { status: 'closed' } | { status: 'rejected', reason }.
 * sub = { weekId, build, log, hash, score }. Never throws, never trusts the claimed score.
 */
export const verifyChallenge = (sub) => {
  try {
    const challenge = challengeForWeek(sub?.weekId);
    if (!challenge) return reject('week');
    if (sub.build !== challenge.build) return { status: 'closed' };
    if (JSON.stringify(sub.log ?? null).length > MAX_LOG_BYTES) return reject('size');
    const bad = checkLog(sub.log);
    if (bad) return reject(bad);
    if (sub.log.actions.length > MAX_ACTIONS) return reject('size');
    if (sub.log.actions.some((a) => Object.keys(a).some((k) => k !== 'type' && k !== 'payload'))) return reject('fields');
    if (stateHash(sub.log.start) !== stateHash(challenge.start)) return reject('seed');
    if (turnsIn(sub.log) !== challenge.turnLimit) return reject('turns');
    // Replayed from the week's own start, never the submitted one; turns counted on the state (FAST_FORWARD runs several).
    const first = startState(challenge.start);
    const run = replayChecked(first, sub.log.actions);
    if (run.reason) return reject(run.reason);
    const end = run.state;
    if (end.turnNumber - first.turnNumber !== challenge.turnLimit) return reject('turns');
    const hash = stateHash(end);
    const score = challengeScore(end);
    if (hash !== sub.hash || score !== sub.score) return reject('mismatch');
    return { status: 'verified', score, hash };
  } catch (e) {
    return reject(`error: ${String(e?.message || e)}`);
  }
};
