// src/engine/challenges.js
// The weekly seeded challenge (differentiation plan U36, KTD16): the same people, world seed and
// Stone Age start for everyone in an ISO week, scored by the legacy score after TURN_LIMIT turns.
// A submission is accepted only when its action log replays (macroVerify) to the claimed hash
// and score. Pure: the week id comes in from the menu, never from a clock in here.
import { ENGINE_BUILD, TURN_LIMIT, MAX_LOG_BYTES, MAX_ACTIONS } from '../data/challenges';
import { MAJOR_PEOPLES_LIST } from '../data/peoples';
import { ActionTypes } from '../data/types';
import { checkLog } from './actionLog';
import { replayGame, stateHash } from './macroVerify';
import { legacyScore } from './legacy';
import { calcNationScore } from './score';

const WEEK = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

/** '2026-W43': the ISO week of a Date (UTC). */
export const isoWeekId = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // the Thursday of this week
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

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
    const end = replayGame(sub.log);
    const hash = stateHash(end);
    const score = challengeScore(end);
    if (hash !== sub.hash || score !== sub.score) return reject('mismatch');
    return { status: 'verified', score, hash };
  } catch (e) {
    return reject(`error: ${String(e?.message || e)}`);
  }
};
