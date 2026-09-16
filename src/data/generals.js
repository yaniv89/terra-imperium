// src/data/generals.js
// Generals (plan §7): commanders with four trait axes (Martial, Shock, Fire, Maneuver — each
// 1-5) plus a personality trait, assignable to a single unit via unit.commanderId. The plan's own
// data model already carries commanderId on the unit itself (§11), so no separate "Army" grouping
// entity is needed for a general to matter — assigning one directly biases that unit's combat.

export const PERSONALITIES = ['cautious', 'reckless', 'siegemaster', 'logistician'];

const TRAIT_MIN = 1;
const TRAIT_MAX = 5;
const randTrait = (rng) => TRAIT_MIN + Math.floor(rng.next() * (TRAIT_MAX - TRAIT_MIN + 1));

export const generateGeneral = (rng, id, nationId) => ({
  id,
  nationId,
  name: `Commander ${id.split('_')[1] || id}`,
  martial: randTrait(rng),
  shock: randTrait(rng),
  fire: randTrait(rng),
  maneuver: randTrait(rng),
  personality: PERSONALITIES[Math.floor(rng.next() * PERSONALITIES.length)],
  assignedUnitId: null
});

// 1-5 -> 0.84x-1.16x per point away from the 3 (average) midpoint.
const axisMultiplier = (value) => 1 + (value - 3) * 0.08;
// Martial applies everywhere but more gently, since it stacks with whichever axis also applies.
const martialMultiplier = (value) => 1 + (value - 3) * 0.05;

const PHASE_AXIS = { shock: 'shock', ranged: 'fire', flanking: 'maneuver', pursuit: 'maneuver' };

// The multiplier a commanded unit's OUTGOING damage gets in a given battle phase.
export const getGeneralDamageMultiplier = (general, phase, unitClassId) => {
  if (!general) return 1;
  let mult = martialMultiplier(general.martial);
  const axis = PHASE_AXIS[phase];
  if (axis) mult *= axisMultiplier(general[axis]);
  if (general.personality === 'reckless') mult *= 1.1;
  if (general.personality === 'cautious') mult *= 0.9;
  if (general.personality === 'siegemaster' && unitClassId === 'siege') mult *= 1.25;
  return mult;
};

// The multiplier a commanded unit's INCOMING damage gets — cautious generals dig their unit in.
export const getGeneralDefenseMultiplier = (general) => (general?.personality === 'cautious' ? 0.9 : 1);

// Logistician generals get their unit combat experience faster — a modest XP bonus, standing in
// for actual supply mechanics (what "logistician" ought to touch) until Task 19 exists.
export const getGeneralXpMultiplier = (general) => (general?.personality === 'logistician' ? 1.25 : 1);
