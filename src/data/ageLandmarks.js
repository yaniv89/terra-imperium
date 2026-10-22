// src/data/ageLandmarks.js
// Age landmarks (the AoE and Civ report's rank 13, after AoE IV's two landmarks per age-up): each
// time a nation enters a new age it raises ONE of two landmarks, a lasting bonus for the rest of the
// game. One pick per age, never changed; the Stone Age has none (every game starts there).
// `effects` use the modifier hooks of src/engine/modifiers/registry.js (LEGACY_HOOK), so the pick
// is one more line on the nation's sheet (sources.js staticSources): goldMult 0.1 = +10% gold,
// researchCost -0.1 = research 10% cheaper, stabilityBonus 1 = one point less unrest everywhere.
// Each pair sets a peaceful pick against a martial one, so the choice says how the nation will play.
export const AGE_LANDMARKS = {
  bronze: [
    { id: 'ziggurat', name: 'Great Ziggurat', desc: 'Stability +1 in every city', effects: { stabilityBonus: 1 } },
    { id: 'chariot_yards', name: 'Chariot Yards', desc: 'Manpower +10%', effects: { hrMult: 0.1 } }
  ],
  classical: [
    { id: 'great_library', name: 'Great Library', desc: 'Science +10%', effects: { techPointsMult: 0.1 } },
    { id: 'forum', name: 'Forum', desc: 'Gold +10%', effects: { goldMult: 0.1 } }
  ],
  kingdoms: [
    { id: 'guild_hall', name: 'Guild Hall', desc: 'Buildings cost 10% less', effects: { buildingCost: -0.1 } },
    { id: 'castle_keep', name: 'Castle Keep', desc: 'Morale recovers 15% faster', effects: { moraleRecovery: 0.15 } }
  ],
  gunpowder: [
    { id: 'stock_exchange', name: 'Stock Exchange', desc: 'Gold +10%', effects: { goldMult: 0.1 } },
    { id: 'arsenal', name: 'Arsenal', desc: 'Manpower +15%', effects: { hrMult: 0.15 } }
  ],
  modern: [
    { id: 'university', name: 'Research University', desc: 'Research costs 10% less', effects: { researchCost: -0.1 } },
    { id: 'rail_hub', name: 'Rail Hub', desc: 'Attrition 20% lower', effects: { attrition: -0.2 } }
  ],
  information: [
    { id: 'data_centre', name: 'Data Centre', desc: 'Science +10%', effects: { techPointsMult: 0.1 } },
    { id: 'broadcast_house', name: 'Broadcast House', desc: 'Every nation\'s opinion of you +5', effects: { opinion: 5 } }
  ],
  future: [
    { id: 'arcology', name: 'Arcology', desc: 'Stability +1 in every city', effects: { stabilityBonus: 1 } },
    { id: 'orbital_dock', name: 'Orbital Dock', desc: 'Morale recovers 20% faster', effects: { moraleRecovery: 0.2 } }
  ]
};

/** The landmark `id` of age `ageId`, or null. */
export const landmarkOf = (ageId, id) => (AGE_LANDMARKS[ageId] || []).find((l) => l.id === id) || null;
