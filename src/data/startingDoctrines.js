// src/data/startingDoctrines.js
// Meta-progression payoff: a small, permanently-available starting bonus the player can select
// for their NEXT game once they've earned the achievement it's tied to. Deliberately modest
// (never a decisive advantage) — the point is a nod to past runs, not a power creep spiral.
//
// Only 'none' exists for now — the achievement-tied bonuses need re-authoring against the new
// gold/hr resource model and the removed underground-forces mechanic (Phase D content pass).

export const STARTING_DOCTRINES = {
  none: {
    id: 'none',
    name: 'Standard Start',
    description: 'No bonus.',
    requiresAchievement: null,
    effects: {}
  }
};

// Pure: applies a starting doctrine's flat bonuses onto a freshly-created state. Falls back to
// the state unchanged for an unknown/'none' id rather than throwing, since the caller only ever
// has a persisted id (from localStorage) with no guarantee the catalog above hasn't changed.
export const applyStartingDoctrine = (state, doctrineId) => {
  const doctrine = STARTING_DOCTRINES[doctrineId];
  if (!doctrine) return state;
  const effects = doctrine.effects;
  if (Object.keys(effects).length === 0) return state;

  const resources = { ...state.resources };
  Object.entries(effects).forEach(([id, amount]) => {
    if (resources[id] !== undefined) resources[id] += amount;
  });
  return { ...state, resources };
};
