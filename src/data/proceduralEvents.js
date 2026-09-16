// src/data/proceduralEvents.js
// Procedural events: randomized, state-aware templates that fill the quiet turns between scripted
// events, reusing the exact same options/effects shape as HISTORICAL_EVENTS so no new UI or
// resolution code is needed for them — see applyEventEffects.js and EventModal.jsx, neither of
// which know these are procedural.
//
// Empty for now (content authoring is Phase D3, once effects are re-authored against the new
// gold/hr/copper/iron/oil resource model) — pickProceduralEvent() always returns null until then.

const PROCEDURAL_TEMPLATES = [];

// Picks one procedural event to fire this turn, or null if none of the templates are currently
// eligible. Weighted random selection among eligible templates, using the caller's seeded rng so
// turn resolution stays deterministic.
export const pickProceduralEvent = (state, rng) => {
  const eligible = PROCEDURAL_TEMPLATES.filter(t => t.isEligible(state));
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng.next() * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const template of eligible) {
    if (roll < template.weight) { chosen = template; break; }
    roll -= template.weight;
  }

  const built = chosen.build(state, rng);
  return {
    id: `procedural_${chosen.id}_${state.turnNumber}`,
    year: state.year,
    mandatory: false,
    procedural: true,
    ...built
  };
};
