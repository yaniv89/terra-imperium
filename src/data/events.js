// src/data/events.js
// Scripted historical events, keyed by id and gated by `year`. The event SYSTEM (EventModal's
// per-option effect preview, this registry's shape, resolveTurn.js's year-based trigger check) is
// unchanged from the original campaign — only the content is empty here. Authoring world history
// events across all five ages (world events, situational templates, curated national flavor for
// ~40 civilizations, chains, procedural) is later work (Phase D3), built once the new resource
// model's effect fields (gold/hr/copper/iron/oil) are wired through applyEventEffects.js.
export const HISTORICAL_EVENTS = {};

// True once a scripted event's year has arrived (and it hasn't already fired, and any
// requiresNoWar nations are actually at peace). pickNextEvent() below fires at most one due event
// per turn, in year order, so simultaneous-year events queue up and fire on consecutive turns
// instead of colliding.
export const shouldEventFire = (event, year, nations, firedEvents) => {
  if (firedEvents[event.id]) return false;
  if (event.year > year) return false;
  if (event.requiresNoWar) {
    const anyAtWar = event.requiresNoWar.some(nId => nations[nId]?.isAtWar);
    if (anyAtWar) return false;
  }
  return true;
};

// Pick the single most-overdue eligible event for this turn (earliest scripted year first, then
// stable declaration order for same-year ties).
export const pickNextEvent = (year, nations, firedEvents) => {
  const eligible = Object.values(HISTORICAL_EVENTS).filter(e => shouldEventFire(e, year, nations, firedEvents));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.year - b.year);
  return eligible[0];
};
