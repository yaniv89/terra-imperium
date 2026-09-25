// src/data/unitClasses.js
// The combat classes and their hard-counter triangle (plan §7): Infantry beats Cavalry, Cavalry
// beats Ranged, Ranged beats Infantry — a counter system players can't see is just noise, so
// getCounterMultiplier's result is always shown in the UI ("+50% vs Mounted").
//
// Siege, Naval, Air and Support sit outside the closed triangle by design, not by omission:
// - Siege cracks fortifications (+200%) but is helpless in the open field (-50%) — a context
//   multiplier (getSiegeMultiplier), not a class-vs-class counter, though Cavalry still hard-
//   counters it directly (a siege train caught by cavalry in the open is defenseless).
// - Naval fights in its own domain — real counters land in a future naval-class expansion (plan
//   §M14's light/heavy/transport/carrier split is deferred — see this file's own header note below
//   the class table for why).
// - Air (Modern-only) has reach without borders, but plan §M14 gives Support real teeth as its
//   Anti-Air counter (renamed in its Modern-age flavor text, not a new class) — Support now beats
//   Air, and Air no longer beats Naval or Support.
// - Support (engineer/medic/supply train in early ages, Anti-Air battery in Modern) is otherwise
//   non-combat: no counters of its own beyond the Air matchup above.

export const UNIT_CLASSES = {
  infantry: {
    id: 'infantry',
    name: 'Infantry',
    role: 'Holds ground, cheap, the backbone.',
    beats: ['cavalry'],
    losesTo: ['ranged', 'air']
  },
  cavalry: {
    id: 'cavalry',
    name: 'Cavalry',
    role: 'Flanks, pursues routers, raids supply.',
    beats: ['ranged', 'siege'],
    losesTo: ['infantry', 'air']
  },
  ranged: {
    id: 'ranged',
    name: 'Ranged',
    role: 'Damage before contact.',
    beats: ['infantry'],
    losesTo: ['cavalry', 'air']
  },
  siege: {
    id: 'siege',
    name: 'Siege',
    role: 'Cracks defenses, helpless alone.',
    beats: [],
    losesTo: ['cavalry', 'air']
  },
  naval: {
    id: 'naval',
    name: 'Naval',
    role: 'Sea lanes, transport, bombardment.',
    beats: [],
    losesTo: []
  },
  // Plan §M14: Air no longer beats Naval or Support — its reach still overwhelms ground troops, but
  // it's no longer strictly upside once Support (Anti-Air in Modern) is actually recruitable.
  air: {
    id: 'air',
    name: 'Air',
    role: 'Reach without borders.',
    beats: ['infantry', 'cavalry', 'ranged', 'siege'],
    losesTo: ['support']
  },
  // Plan §M14: Support is now a real recruitable class (see UNIT_ROSTER below) with one real
  // counter — Anti-Air (its Modern-age flavor name) shoots down Air. It still has no OTHER
  // counters of its own; it isn't meant to fight infantry/cavalry/ranged/siege/naval directly.
  support: {
    id: 'support',
    name: 'Support',
    role: 'Non-combat multipliers early; Anti-Air defense in the Modern age.',
    beats: ['air'],
    losesTo: []
  }
};

export const UNIT_CLASS_IDS = Object.keys(UNIT_CLASSES);

// The three classes that form the closed rock-paper-scissors triangle every player learns in
// their first war — every OTHER class's counters are intentionally asymmetric (see file header).
export const CORE_TRIANGLE_CLASS_IDS = ['infantry', 'cavalry', 'ranged'];

// Plan §M14: sharper counters than M0-M13's baseline (was 1.5/0.67) — a matchup you win should feel
// more decisive, and one you lose should hurt more, now that roster stats (below) also separately
// reward staying at the front of the tech curve.
const COUNTER_BONUS_MULT = 1.75; // +75% damage
const COUNTER_PENALTY_MULT = 0.6; // -40% damage

// The generic class-vs-class multiplier. Siege's fortification/open-field multiplier is handled
// separately by getSiegeMultiplier below, since it isn't a class matchup.
export const getCounterMultiplier = (attackerClassId, defenderClassId) => {
  const attacker = UNIT_CLASSES[attackerClassId];
  if (!attacker) return 1;
  if (attacker.beats.includes(defenderClassId)) return COUNTER_BONUS_MULT;
  if (attacker.losesTo.includes(defenderClassId)) return COUNTER_PENALTY_MULT;
  return 1;
};

const SIEGE_VS_FORTIFICATION_MULT = 3.0; // +200%
const SIEGE_OPEN_FIELD_MULT = 0.5; // -50%

// Siege's own context multiplier — call with whether the target region is meaningfully fortified
// (defenseLevel > 0, see src/context/GameContext.jsx's Build Defenses action) rather than looking
// up an opposing unit class.
export const getSiegeMultiplier = (isAttackingFortification) =>
  isAttackingFortification ? SIEGE_VS_FORTIFICATION_MULT : SIEGE_OPEN_FIELD_MULT;

// The age-gated unit roster (plan §7's "unit roster by age" table) — one canonical unit per class
// per age. Each line upgrades along its own class (a Spearman lineage becomes Pikemen becomes
// Musketeers), which is what makes a unit's accumulated promotions worth preserving across ages
// rather than starting over — see the Promotions task. Base attack/defense scale with age so a
// later-age unit is a straightforward upgrade over an earlier one of the same class; strength
// (headcount) and morale/organization are runtime army state, not roster data — see the
// Per-region armies task.
const rosterEntry = (name, ageIndex) => ({
  name,
  baseAttack: 10 + ageIndex * 8,
  baseDefense: 8 + ageIndex * 6
});

export const UNIT_ROSTER = {
  bronze: {
    infantry: rosterEntry('Spearmen', 0),
    cavalry: rosterEntry('Chariots', 0),
    ranged: rosterEntry('Archers', 0),
    siege: rosterEntry('Battering Ram', 0),
    naval: rosterEntry('War Galley', 0)
  },
  classical: {
    infantry: rosterEntry('Swordsmen', 1),
    cavalry: rosterEntry('Heavy Cavalry', 1),
    ranged: rosterEntry('Composite Archers', 1),
    siege: rosterEntry('Ballista', 1),
    naval: rosterEntry('Trireme', 1)
  },
  kingdoms: {
    infantry: rosterEntry('Pikemen', 2),
    cavalry: rosterEntry('Knights', 2),
    ranged: rosterEntry('Longbowmen', 2),
    siege: rosterEntry('Trebuchet', 2),
    naval: rosterEntry('Longship', 2)
  },
  gunpowder: {
    infantry: rosterEntry('Musketeers', 3),
    cavalry: rosterEntry('Dragoons', 3),
    ranged: rosterEntry('Riflemen', 3),
    siege: rosterEntry('Field Cannon', 3),
    naval: rosterEntry('Frigate', 3)
  },
  modern: {
    infantry: rosterEntry('Mechanized Infantry', 4),
    cavalry: rosterEntry('Tanks', 4),
    ranged: rosterEntry('ATGM Teams', 4),
    siege: rosterEntry('Artillery', 4),
    naval: rosterEntry('Destroyer', 4),
    air: rosterEntry('Fighter Jet', 4),
    support: rosterEntry('Anti-Air Battery', 4)
  }
};

// Plan §M14: Support becomes a real recruitable class — flavor names change by age (a construction/
// logistics role early on, hardening into dedicated Anti-Air once Air exists to shoot down), but the
// class id and its counter (support beats air) stay the same throughout.
UNIT_ROSTER.bronze.support = rosterEntry('Baggage Train', 0);
UNIT_ROSTER.classical.support = rosterEntry('Engineers', 1);
UNIT_ROSTER.kingdoms.support = rosterEntry('Pioneers', 2);
UNIT_ROSTER.gunpowder.support = rosterEntry('Sappers', 3);

export const getUnitDefinition = (ageId, classId) => UNIT_ROSTER[ageId]?.[classId] || null;

// Every class recruitable at (and including) the given age — Air only exists from Modern on.
export const getAvailableClasses = (ageId) => Object.keys(UNIT_ROSTER[ageId] || {});

// Plan §M14: roster stats wired into combat, replacing the old flat "ages-behind" combat malus
// (src/data/ages.js's now-removed getAgesBehindCombatMultiplier) — that malus only ever penalized
// a nation falling behind; this instead directly compares the two SIDES' own current ages, so a
// nation ahead of an opponent is rewarded exactly as much as a nation behind one is punished, and
// two nations at the SAME age always net out to 1.0 no matter which age that is.
//
// Honest simplification of the plan's literal "attackerRoster.baseAttack / defenderRoster.
// baseDefense" wording: baseAttack and baseDefense deliberately scale at DIFFERENT per-age rates
// (see rosterEntry above — a design choice for how a single roster entry's own numbers read, not
// meant to double as a cross-age normalization base), so a raw attack/defense ratio does NOT stay
// constant across ages and can't be "normalized to 1.0 for same-age units" by any single divisor.
// Comparing each side's baseATTACK against the other side's baseATTACK (same stat, both sides)
// sidesteps that mismatch entirely and gives the same real-content promise — an age gap swings the
// multiplier away from 1.0 by exactly how far apart the two roster tiers are — with an exact 1.0 at
// equal ages guaranteed by construction, not by a coincidental ratio.
const ROSTER_REFERENCE_CLASS = 'infantry';
export const getRosterCombatMultiplier = (attackerAgeId, defenderAgeId) => {
  const attackerAttack = UNIT_ROSTER[attackerAgeId]?.[ROSTER_REFERENCE_CLASS]?.baseAttack ?? UNIT_ROSTER.bronze[ROSTER_REFERENCE_CLASS].baseAttack;
  const defenderAttack = UNIT_ROSTER[defenderAgeId]?.[ROSTER_REFERENCE_CLASS]?.baseAttack ?? UNIT_ROSTER.bronze[ROSTER_REFERENCE_CLASS].baseAttack;
  return attackerAttack / defenderAttack;
};
