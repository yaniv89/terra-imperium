// src/data/personas.js
// Shared roster of named personas (Phase 8). Player-assignable commanders draw from this list to
// buff a specific front; a later phase can reuse the same data for AI nation "leader" flavor
// (war-declaration/peace log quotes) without needing a second roster.

export const PERSONAS = {
  rafael_katz: {
    id: 'rafael_katz',
    name: 'Rafael Katz',
    trait: 'armor_tactician',
    description: 'Armor doctrine specialist — boosts committed armor strength.',
    bonus: { armorMult: 1.15 }
  },
  dana_shalev: {
    id: 'dana_shalev',
    name: 'Dana Shalev',
    trait: 'air_marshal',
    description: 'Air operations veteran — boosts committed air strength.',
    bonus: { airMult: 1.15 }
  },
  moshe_avrahami: {
    id: 'moshe_avrahami',
    name: 'Moshe Avrahami',
    trait: 'morale_officer',
    description: 'Keeps troops steady — halves morale loss from setbacks.',
    bonus: { moraleLossMult: 0.5 }
  },
  yael_ronen: {
    id: 'yael_ronen',
    name: 'Yael Ronen',
    trait: 'logistics_expert',
    description: 'Supply chain expert — cuts supply decay, easing overextension.',
    bonus: { supplyDecayMult: 0.6 }
  },
  ehud_barkat: {
    id: 'ehud_barkat',
    name: 'Ehud Barkat',
    trait: 'siege_engineer',
    description: 'Siege specialist — a besieging front erodes control faster.',
    bonus: { siegeDamageMult: 1.5 }
  },
  tamar_golan: {
    id: 'tamar_golan',
    name: 'Tamar Golan',
    trait: 'infantry_specialist',
    description: 'Infantry tactics expert — boosts committed infantry strength.',
    bonus: { infantryMult: 1.15 }
  }
};

export const getPersonaBonus = (personaId, key) => {
  const persona = PERSONAS[personaId];
  return persona?.bonus?.[key] ?? 1;
};
