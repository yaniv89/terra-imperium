// src/data/eventChains.js
// Registry of scripted follow-up events (Phase 10: "event chains with memory"). An option in
// events.js or proceduralEvents.js can attach `effects.spawnFollowUp: { id, delayTurns }` to
// schedule one of these to fire `delayTurns` turns later — see applyEventEffects.js (which
// records the schedule in state.pendingEventChains) and resolveTurn.js (which checks it every
// turn). Shaped exactly like a HISTORICAL_EVENTS entry so EventModal.jsx needs no changes to
// render one, except these have no fixed `year` since they fire on a turn delay, not a calendar
// date.
export const EVENT_CHAINS = {
  refugee_startup_ipo: {
    id: 'refugee_startup_ipo',
    title: 'Refugee-Founded Startup Goes Public',
    description: 'A tech company founded by refugees welcomed years ago has gone public, its IPO now a headline case study in what open immigration built.',
    options: [
      { label: 'Court them for a state partnership', effects: { techPoints: 30, diplomacyPoints: 10 } },
      { label: 'Tax the windfall for the treasury', effects: { money: 60000 } }
    ]
  }
};
