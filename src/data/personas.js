// src/data/personas.js
// Shared roster of named commanders. Player-assignable commanders draw from this list to buff a
// specific front; a later phase can reuse the same data for AI nation "leader" flavor
// (war-declaration/peace log quotes) without needing a second roster. Placeholder, nation-neutral
// names — Phase D2's Generals system (traits on four axes, retirement/death) replaces this roster
// with a deeper one generated per-nation rather than a fixed shared list.

export const PERSONAS = {
  commander_vega: {
    id: 'commander_vega',
    name: 'Commander Vega',
    trait: 'armor_tactician',
    description: 'Armor doctrine specialist — boosts committed armor strength.',
    bonus: { armorMult: 1.15 }
  },
  marshal_reyes: {
    id: 'marshal_reyes',
    name: 'Marshal Reyes',
    trait: 'air_marshal',
    description: 'Air operations veteran — boosts committed air strength.',
    bonus: { airMult: 1.15 }
  },
  officer_lindqvist: {
    id: 'officer_lindqvist',
    name: 'Officer Lindqvist',
    trait: 'morale_officer',
    description: 'Keeps troops steady — halves morale loss from setbacks.',
    bonus: { moraleLossMult: 0.5 }
  },
  quartermaster_osei: {
    id: 'quartermaster_osei',
    name: 'Quartermaster Osei',
    trait: 'logistics_expert',
    description: 'Supply chain expert — cuts supply decay, easing overextension.',
    bonus: { supplyDecayMult: 0.6 }
  },
  engineer_takeda: {
    id: 'engineer_takeda',
    name: 'Engineer Takeda',
    trait: 'siege_engineer',
    description: 'Siege specialist — a besieging front erodes control faster.',
    bonus: { siegeDamageMult: 1.5 }
  },
  captain_moreau: {
    id: 'captain_moreau',
    name: 'Captain Moreau',
    trait: 'infantry_specialist',
    description: 'Infantry tactics expert — boosts committed infantry strength.',
    bonus: { infantryMult: 1.15 }
  }
};

export const getPersonaBonus = (personaId, key) => {
  const persona = PERSONAS[personaId];
  return persona?.bonus?.[key] ?? 1;
};
