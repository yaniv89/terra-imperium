// src/data/challenges.js
// Weekly challenge constants (differentiation plan U36, KTD16).
// ENGINE_BUILD pins the rules a challenge replays on. shortcut: bumped by hand, when any change
// alters how a game replays (engine, data, balance); upgrade to a build hash if that gets forgotten.
export const ENGINE_BUILD = 'e1';
export const TURN_LIMIT = 100; // ADVANCE_TURN actions in a challenge game, exactly
export const MAX_LOG_BYTES = 262144; // a submitted log is refused above this, before any replay
export const MAX_ACTIONS = 6000;
export const REPLAY_BUDGET_MS = 60000; // the Node verifier stops a replay after this
