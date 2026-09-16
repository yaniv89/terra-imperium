// src/data/eventChains.js
// Registry of scripted follow-up events ("event chains with memory"). An option in events.js or
// proceduralEvents.js can attach `effects.spawnFollowUp: { id, delayTurns }` to schedule one of
// these to fire `delayTurns` turns later — see applyEventEffects.js (which records the schedule
// in state.pendingEventChains) and resolveTurn.js (which checks it every turn). Shaped exactly
// like a HISTORICAL_EVENTS entry so EventModal.jsx needs no changes to render one, except these
// have no fixed `year` since they fire on a turn delay, not a calendar date.
//
// Empty for now — see events.js's header for why (content authoring is Phase D3).
export const EVENT_CHAINS = {};
