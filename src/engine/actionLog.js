// src/engine/actionLog.js
// The macro action log (differentiation plan U35, KTD16): a game is its start (the RESET_GAME
// payload: people, speed, scenario, rngSeed, doctrine, difficulty) plus every action the player
// dispatched, in order. gameReducer and resolveTurn are pure and seeded from state.rngSeed, so the
// log replays to the same state (macroVerify.js). A commanded battle rides inside as its
// RESOLVE_TACTICAL_BATTLE action with its own order log, replayed by battleVerify.js.
//   let log = startLog(resetPayload);
//   log = logAction(log, action);     // every dispatch; a turn run in the worker is logged as the turn action it ran
//   checkLog(log)                     // null, or why the log cannot be replayed
import { ActionTypes } from '../data/types';

export const LOG_VERSION = 1;

// Never in a log: the worker's turn result carries a whole state (log the turn action instead),
// and a load or a new game starts another game.
const UNLOGGED = new Set([ActionTypes.APPLY_TURN_RESULT, ActionTypes.LOAD_GAME, ActionTypes.RESET_GAME]);
const KNOWN = new Set(Object.values(ActionTypes).filter((t) => !UNLOGGED.has(t)));

export const startLog = (start = {}) => ({ version: LOG_VERSION, start, actions: [] });

export const logAction = (log, action) => (action && KNOWN.has(action.type) ? { ...log, actions: [...log.actions, action] } : log);

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Why a log cannot be replayed (an untrusted log is checked before it runs), or null. */
export const checkLog = (log) => {
  if (!isObject(log)) return 'not a log';
  if (log.version !== LOG_VERSION) return `log version ${log.version}`;
  if (!isObject(log.start)) return 'no start';
  if (!Array.isArray(log.actions)) return 'no actions';
  const bad = log.actions.findIndex((a) => !isObject(a) || !KNOWN.has(a.type));
  return bad < 0 ? null : `action ${bad} refused`;
};
