// src/data/unitClasses.js
// The combat classes and their hard-counter triangle (plan §7): Infantry beats Cavalry, Cavalry
// beats Ranged, Ranged beats Infantry — a counter system players can't see is just noise, so
// getCounterMultiplier's result is always shown in the UI ("+50% vs Mounted").
//
// Siege, Naval, Air and Support sit outside the closed triangle by design, not by omission:
// - Siege cracks fortifications (+200%) but is helpless in the open field (-50%) — a context
//   multiplier (getSiegeMultiplier), not a class-vs-class counter, though Cavalry still hard-
//   counters it directly (a siege train caught by cavalry in the open is defenseless).
// - Naval fights in its own domain — real counters land in Phase C's navy work (Task: Navies and
//   amphibious invasion), not here.
// - Air (Modern-only) has reach without borders — its dedicated counter (anti-air) isn't a unit
//   class yet, so it currently only has upside, matching "the reach without borders" framing.
// - Support (engineer/medic/supply train) is explicitly non-combat: multipliers only, no counters.

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
    losesTo: ['air']
  },
  air: {
    id: 'air',
    name: 'Air',
    role: 'Reach without borders.',
    beats: ['infantry', 'cavalry', 'ranged', 'siege', 'naval'],
    losesTo: []
  },
  support: {
    id: 'support',
    name: 'Support',
    role: 'Non-combat multipliers (engineer, medic, supply train).',
    beats: [],
    losesTo: []
  }
};

export const UNIT_CLASS_IDS = Object.keys(UNIT_CLASSES);

// The three classes that form the closed rock-paper-scissors triangle every player learns in
// their first war — every OTHER class's counters are intentionally asymmetric (see file header).
export const CORE_TRIANGLE_CLASS_IDS = ['infantry', 'cavalry', 'ranged'];

const COUNTER_BONUS_MULT = 1.5; // +50% damage
const COUNTER_PENALTY_MULT = 0.67; // -33% damage (1 - 0.33, matching the plan's stated number)

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
    air: rosterEntry('Fighter Jet', 4)
  }
};

export const getUnitDefinition = (ageId, classId) => UNIT_ROSTER[ageId]?.[classId] || null;

// Every class recruitable at (and including) the given age — Air only exists from Modern on.
export const getAvailableClasses = (ageId) => Object.keys(UNIT_ROSTER[ageId] || {});
