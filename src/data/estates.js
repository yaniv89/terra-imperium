// src/data/estates.js
// Plan §M9: Estates. Three are always present (Clergy, Nobility, Burghers); Labor is added once a
// nation reaches the Modern age (see resolveTurn.js's age-transition check). The plan's fourth,
// "Military Establishment for Dictatorship", is left out — wiring a government-type-conditional
// fifth estate would touch every estate-keyed loop in this file and estates.js for a single flavor
// addition with no described mechanical effects of its own beyond what Dictatorship's own reforms
// (src/data/government.js) already give.
export const ESTATE_IDS = ['clergy', 'nobility', 'burghers'];
export const LABOR_ESTATE_ID = 'labor'; // added dynamically at the Modern age
export const ESTATE_LABELS = { clergy: 'Clergy', nobility: 'Nobility', burghers: 'Burghers', labor: 'Labor' };

export const ESTATE_LOYALTY_EQUILIBRIUM = 50;
export const ESTATE_LOYALTY_LOW_THRESHOLD = 30;
export const ESTATE_LOYALTY_HIGH_THRESHOLD = 60;
// Plan §M9: "Influence > 80 AND loyalty < 50" starts the Estate Takeover disaster — the disaster
// itself is M15 work (crises/defeat don't exist yet), so this threshold isn't consumed anywhere yet.
export const ESTATE_TAKEOVER_INFLUENCE_THRESHOLD = 80;
export const ESTATE_TAKEOVER_LOYALTY_THRESHOLD = 50;

export const CROWN_LAND_DEFAULT = 50;
export const CROWN_LAND_LOW_THRESHOLD = 30;
export const CROWN_LAND_HIGH_THRESHOLD = 70;
export const CROWN_LAND_MAX = 100;
export const CROWN_LAND_MIN = 0;
export const CROWN_LAND_SEIZE_AMOUNT = 10;
export const CROWN_LAND_SELL_AMOUNT = 10;
export const CROWN_LAND_SEIZE_LOYALTY_PENALTY = 20;
export const CROWN_LAND_SELL_BURGHER_LOYALTY_BONUS = 10;
export const ESTATE_INTERACTION_COOLDOWN_TURNS = 10;
export const ESTATE_ASK_LOYALTY_PENALTY = 10;
export const REVOKE_PRIVILEGE_LOYALTY_PENALTY = 30;

export const createInitialEstate = () => ({ loyalty: ESTATE_LOYALTY_EQUILIBRIUM, influence: 10, privileges: [] });
export const createInitialEstates = () => ESTATE_IDS.reduce((acc, id) => { acc[id] = createInitialEstate(); return acc; }, {});

// Plan §M9's threshold table: loyalty >= 60 grants an estate its own bonus; loyalty < 30 gives the
// reverse sign, halved. Land morale (Nobility) is combat, not yet wired (M14); trade/production
// income fold onto the one goldMult hook the way tax/production/trade already do everywhere else in
// this codebase (M11 is what eventually splits them).
export const ESTATE_THRESHOLD_BONUS = {
  clergy: { stabilityBonus: 1, admBonus: 1 },
  nobility: { milBonus: 1 },
  burghers: { goldMult: 0.1, dipBonus: 1 },
  labor: { goldMult: 0.1 }
};
export const ESTATE_THRESHOLD_MALUS = {
  clergy: { stabilityBonus: -0.5, admBonus: -0.5 },
  nobility: { milBonus: -0.5 },
  burghers: { goldMult: -0.05, dipBonus: -0.5 },
  labor: { goldMult: -0.05 }
};

// 2 privileges per estate (plan lists 2-3; this ships the 2 the plan gives concrete numbers for).
// `loyaltyBonus`/`influenceBonus` are raw per-estate values (consumed directly by
// src/engine/estates.js, not through the modifier engine); `effects` uses the normal LEGACY_HOOK
// vocabulary and applies nationally like any other source once the privilege is granted.
export const ESTATE_PRIVILEGES = {
  clergy: [
    { id: 'religious_tax_exemption', name: 'Religious Tax Exemption', description: '+15 clergy loyalty, -10% tax, +5 clergy influence', loyaltyBonus: 15, influenceBonus: 5, effects: { goldMult: -0.1 } },
    { id: 'control_of_education', name: 'Control of Education', description: '+15% tech points, +10 clergy influence', loyaltyBonus: 0, influenceBonus: 10, effects: { techPointsMult: 0.15 } }
  ],
  nobility: [
    { id: 'officer_corps', name: 'Officer Corps', description: '+10% land morale (combat, M14), +1 general candidate (M14), +10 nobility influence', loyaltyBonus: 0, influenceBonus: 10, effects: {} },
    { id: 'seigneurial_rights', name: 'Seigneurial Rights', description: '+20% manpower, -1 ADM/turn, +10 nobility influence', loyaltyBonus: 0, influenceBonus: 10, effects: { hrMult: 0.2, admBonus: -1 } }
  ],
  burghers: [
    // "+15% production, -10% trade" nets to +5% on the one shared goldMult hook this codebase has.
    { id: 'guild_monopolies', name: 'Guild Monopolies', description: '+15% production, -10% trade', loyaltyBonus: 0, influenceBonus: 0, effects: { goldMult: 0.05 } },
    { id: 'free_city_charters', name: 'Free City Charters', description: '+1 DIP/turn, +10 burghers influence', loyaltyBonus: 0, influenceBonus: 10, effects: { dipBonus: 1 } }
  ],
  labor: [
    { id: 'workers_councils', name: "Workers' Councils", description: '+10% production, -5% tax', loyaltyBonus: 0, influenceBonus: 0, effects: { goldMult: 0.05 } },
    { id: 'right_to_strike', name: 'Right to Strike', description: '+20 labor loyalty; -1 stability floor if loyalty < 40 (not yet wired as a floor)', loyaltyBonus: 20, influenceBonus: 0, effects: {} }
  ]
};

export const getPrivilege = (estateId, privilegeId) => (ESTATE_PRIVILEGES[estateId] || []).find((p) => p.id === privilegeId) || null;
export const getEstatePrivileges = (estateId) => ESTATE_PRIVILEGES[estateId] || [];

export const clampCrownLand = (value) => Math.max(CROWN_LAND_MIN, Math.min(CROWN_LAND_MAX, value));
