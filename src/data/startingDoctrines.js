// src/data/startingDoctrines.js
// Meta-progression payoff: a small, permanently-available starting bonus the player can select
// for their NEXT game once they've earned the achievement it's tied to. Deliberately modest
// (never a decisive advantage) — the point is a nod to past runs, not a power creep spiral.

export const STARTING_DOCTRINES = {
  none: {
    id: 'none',
    name: 'Standard Start',
    description: 'No bonus — the default founding of Israel.',
    requiresAchievement: null,
    effects: {}
  },
  economic_vanguard: {
    id: 'economic_vanguard',
    name: 'Economic Vanguard',
    description: '+$15,000 starting funds, built on lessons from a state that reached the New Millennium.',
    requiresAchievement: 'survive_to_2000',
    effects: { money: 15000 }
  },
  diplomatic_corps: {
    id: 'diplomatic_corps',
    name: 'Diplomatic Corps',
    description: '+15 starting Diplomacy Points, drawing on ties built by a past Master Diplomat.',
    requiresAchievement: 'master_diplomat',
    effects: { diplomacyPoints: 15 }
  },
  veteran_command: {
    id: 'veteran_command',
    name: 'Veteran Command',
    description: '+300 starting underground fighters, hardened by memories of a Three-Front War.',
    requiresAchievement: 'three_front_war',
    effects: { undergroundStrength: 300 }
  },
  research_legacy: {
    id: 'research_legacy',
    name: 'Research Legacy',
    description: "+20 starting Tech Points, inherited from a past Tech Titan's notes.",
    requiresAchievement: 'tech_titan',
    effects: { techPoints: 20 }
  }
};

// Pure: applies a starting doctrine's flat bonuses onto a freshly-created state. Falls back to
// the state unchanged for an unknown/'none' id rather than throwing, since the caller only ever
// has a persisted id (from localStorage) with no guarantee the catalog above hasn't changed.
export const applyStartingDoctrine = (state, doctrineId) => {
  const doctrine = STARTING_DOCTRINES[doctrineId];
  if (!doctrine) return state;
  const effects = doctrine.effects;

  return {
    ...state,
    resources: {
      ...state.resources,
      money: state.resources.money + (effects.money || 0),
      diplomacyPoints: state.resources.diplomacyPoints + (effects.diplomacyPoints || 0),
      techPoints: state.resources.techPoints + (effects.techPoints || 0)
    },
    undergroundStrength: state.undergroundStrength + (effects.undergroundStrength || 0)
  };
};
