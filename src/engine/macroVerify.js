// src/engine/macroVerify.js
// Macro replay verification (differentiation plan U35, KTD16): a game is proven by replaying its
// action log (actionLog.js) from its start through gameReducer and comparing the final state hash
// with the one the player's game ended on. Pure, runs in Node and in the browser. A commanded
// battle in the log is replayed by its own verify (battleVerify.js) inside the reducer, so a forged
// battle result changes the state and fails here too.
//   verifyGame(log, claimedHash) -> { status: 'verified' | 'mismatch' | 'invalid' | 'error', hash, turns, problem }
import { startState, gameReducer } from './gameReducer';
import { checkLog } from './actionLog';

// The whole state as one string, keys sorted (the balance-sim stateHash method). Typed arrays
// (the world's tile columns) are written as their numbers.
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    if (ArrayBuffer.isView(v)) return `<${Array.from(v).join(',')}>`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
  return JSON.stringify(v) ?? 'undefined';
};

/** A 64-bit hash (two FNV-1a lanes over the UTF-16 code units) of the whole state, as 16 hex digits. */
export const stateHash = (state) => {
  const s = stable(state);
  let a = 0x811c9dc5; let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
};

/** The state the log's actions lead to from `state`. */
export const replayActions = (state, actions) => actions.reduce(gameReducer, state);

/** The final state of a checked log, from its start. Throws on a log checkLog refuses. */
export const replayGame = (log) => {
  const problem = checkLog(log);
  if (problem) throw new Error(problem);
  return replayActions(startState(log.start), log.actions);
};

/** Replays `log` and compares its final state hash with `claimedHash`. Never throws. */
export const verifyGame = (log, claimedHash) => {
  const problem = checkLog(log);
  if (problem) return { status: 'invalid', hash: null, turns: null, problem };
  try {
    const end = replayGame(log);
    const hash = stateHash(end);
    return { status: hash === claimedHash ? 'verified' : 'mismatch', hash, turns: end.turnNumber, problem: null };
  } catch (e) {
    return { status: 'error', hash: null, turns: null, problem: String(e?.message || e) };
  }
};
