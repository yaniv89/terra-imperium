// src/data/promotions.js
// Promotions (plan §7): units earn XP in combat and climb Recruit -> Regular -> Veteran -> Elite
// -> Legendary. Rank is always derived from accumulated XP (getRankForXp) so it's never out of
// sync with reality; reaching Regular/Veteran/Elite additionally unlocks ONE perk pick from any of
// the three branches (PROMOTE_UNIT, src/context/GameContext.jsx) — Legendary instead auto-grants a
// class-specific capstone the moment XP crosses its threshold (awardXp below), since the plan
// describes it as something Legendary "unlocks", not something spent XP on like the other three.

export const RANK_ORDER = ['recruit', 'regular', 'veteran', 'elite', 'legendary'];

// XP required to REACH each rank (recruit is the starting rank, needs none).
export const XP_THRESHOLDS = { regular: 50, veteran: 150, elite: 350, legendary: 700 };

export const getRankForXp = (xp) => {
  let rank = 'recruit';
  for (const candidate of RANK_ORDER.slice(1)) {
    if (xp >= XP_THRESHOLDS[candidate]) rank = candidate;
  }
  return rank;
};

// How many perks a unit at this rank is entitled to have picked (recruit=0, regular=1, veteran=2,
// elite=3; legendary doesn't add to this count — its capstone is granted automatically, not picked).
export const entitledPromotionCount = (rank) => Math.min(RANK_ORDER.indexOf(rank), 3);

export const PROMOTION_BRANCHES = {
  offense: {
    id: 'offense',
    name: 'Offense',
    perks: {
      shock: { id: 'shock', branch: 'offense', name: 'Shock', description: '+15% damage dealt' },
      breakthrough: { id: 'breakthrough', branch: 'offense', name: 'Breakthrough', description: '+25% damage dealt when attacking a fortification' },
      overrun: { id: 'overrun', branch: 'offense', name: 'Overrun', description: '+50% pursuit damage against routed enemies' }
    }
  },
  defense: {
    id: 'defense',
    name: 'Defense',
    perks: {
      bulwark: { id: 'bulwark', branch: 'defense', name: 'Bulwark', description: '-15% damage taken' },
      entrenched: { id: 'entrenched', branch: 'defense', name: 'Entrenched', description: '-10% damage taken while defending' },
      resilient: { id: 'resilient', branch: 'defense', name: 'Resilient', description: '-30% morale loss taken' }
    }
  },
  logistics: {
    id: 'logistics',
    name: 'Logistics',
    perks: {
      // Plan §M14: this unit gets a second move each turn (src/engine/resolveTurn.js's own
      // movement-reset phase) — Move Army/Launch Invasion/Amphibious Assault/Naval Engagement all
      // spend from the same movesLeft counter this grants an extra point of.
      forcedMarch: { id: 'forcedMarch', branch: 'logistics', name: 'Forced March', description: 'Gains a second move each turn' },
      // Plan §M14: -50% out-of-supply attrition (src/engine/resolveTurn.js's own supply-attrition
      // phase), stacking with a logistician-commanded unit's own -50%.
      forager: { id: 'forager', branch: 'logistics', name: 'Forager', description: '-50% attrition outside friendly territory' },
      // Plan §M14: doubles this unit's own reinforcement rate (src/engine/resolveTurn.js's own
      // reinforcement phase) — repurposed from this codebase's earlier "once a training queue
      // exists" placeholder description, since M14 gives the id a real, different mechanical home.
      cadre: { id: 'cadre', branch: 'logistics', name: 'Cadre', description: 'Reinforces at double speed' }
    }
  }
};

export const ALL_PERKS = Object.values(PROMOTION_BRANCHES).flatMap((branch) => Object.values(branch.perks));

export const getPerk = (perkId) => ALL_PERKS.find((p) => p.id === perkId) || null;

// Legendary's class-specific capstone (plan §7) — granted automatically, never picked.
export const CLASS_CAPSTONES = {
  infantry: { id: 'unbreakable', name: 'Unbreakable', description: 'Immune to the first rout each battle' },
  cavalry: { id: 'relentless', name: 'Relentless', description: 'Double pursuit damage' },
  ranged: { id: 'volleyFire', name: 'Volley Fire', description: 'Fires twice in the ranged phase' },
  siege: { id: 'sapper', name: 'Sapper', description: 'Keeps half its fortification bonus even in the open field' }
};

export const hasPerk = (unit, perkId) => (unit.promotions || []).includes(perkId);

// A unit is eligible to spend a promotion once its derived rank entitles it to more picks than
// it has already spent. Legendary is excluded — that capstone is automatic, not chosen here.
export const canPromote = (unit) => {
  const rank = getRankForXp(unit.xp || 0);
  if (rank === 'legendary' && entitledPromotionCount(rank) === (unit.promotions || []).length) return false;
  return entitledPromotionCount(rank) > (unit.promotions || []).length;
};

// Adds XP and, if it pushes the unit into Legendary for the first time, auto-grants its class's
// capstone. Pure — returns a new unit object, never mutates the input.
export const awardXp = (unit, xpGained) => {
  const xp = (unit.xp || 0) + xpGained;
  const rank = getRankForXp(xp);
  const promotions = [...(unit.promotions || [])];
  const capstone = CLASS_CAPSTONES[unit.classId];
  if (rank === 'legendary' && capstone && !promotions.includes(capstone.id)) {
    promotions.push(capstone.id);
  }
  return { ...unit, xp, rank, promotions };
};

// ============ COMBAT INTEGRATION ============
// Multiplier a unit's OUTGOING damage gets from its own perks in a given phase/context.
export const getPromotionDamageMultiplier = (unit, { phase, isAttackingFortification }) => {
  let mult = 1;
  if (hasPerk(unit, 'shock')) mult *= 1.15;
  if (hasPerk(unit, 'breakthrough') && isAttackingFortification) mult *= 1.25;
  if (hasPerk(unit, 'overrun') && phase === 'pursuit') mult *= 1.5;
  if (hasPerk(unit, 'relentless') && phase === 'pursuit') mult *= 2;
  return mult;
};

// Multiplier a unit's INCOMING damage gets from its own perks. `isDefendingSide` is true when
// this unit belongs to the side being invaded (Entrenched only helps while defending).
export const getPromotionDefenseMultiplier = (unit, { isDefendingSide }) => {
  let mult = 1;
  if (hasPerk(unit, 'bulwark')) mult *= 0.85;
  if (hasPerk(unit, 'entrenched') && isDefendingSide) mult *= 0.9;
  return mult;
};

// Resilient trades some of a hit's morale cost away — applied to the morale-loss figure, not the
// strength-damage figure, keeping "fewer casualties" about resolve rather than raw survivability.
export const getPromotionMoraleLossMultiplier = (unit) => (hasPerk(unit, 'resilient') ? 0.7 : 1);

// Sapper keeps half its fortification bonus even without one to crack — halfway between the open-
// field penalty and neutral, rather than the harsh -50% every other siege unit suffers.
export const applySapperToSiegeMultiplier = (unit, isAttackingFortification, siegeMultiplier) => {
  if (isAttackingFortification || !hasPerk(unit, 'sapper')) return siegeMultiplier;
  return (siegeMultiplier + 1) / 2;
};
