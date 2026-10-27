// src/data/eraGoals.js
// Era goals (plans/civ-map-rework.md, C9.3; follow-up 24): every age sets 3 to 5 goals, one per
// playstyle that fits it (a null target = no goal of that playstyle in that age). Each goal pays
// the turn it is met (src/engine/eraGoals.js): its playstyle's bonus, bigger with each age (goalReward),
// ERA_LEGACY_TURNS long, plus a decree and renown. Meeting ERA_GOALS_FOR_LEGACY of them before the
// age ends also earns the era legacy (renown and a virtue point). Targets are keyed by age id and
// calibrated with the balance-sim (eraGoals.sim.js: 8 seeds, Normal, 20 to 70% of majors each).
import { AGES, AGE_ORDER, FIRST_AGE_ID } from './ages';

export const ERA_GOALS_FOR_LEGACY = 2;
export const ERA_LEGACY_TURNS = 50;

// The reward is a national modifier `mod`: n = n0 + step per age after the first (rounded down;
// a percent when `pct`), `sign` its direction; `bonusLabel` shows it.
export const PLAYSTYLES = {
  expand: { label: 'Expand', targets: { stone: 4, bronze: 8, classical: 16, kingdoms: 24, gunpowder: 28, modern: 30, information: 30, future: 36 }, unit: 'cities', mod: 'national.hrMult', sign: 1, pct: true, n0: 10, step: 5, bonusLabel: '+{n}% manpower' },
  wealth: { label: 'Wealth', targets: { stone: 9, bronze: 14, classical: 18, kingdoms: 21, gunpowder: 22, modern: 22, information: 22, future: 24 }, unit: 'kinds of resource', mod: 'national.goldMult', sign: 1, pct: true, n0: 10, step: 5, bonusLabel: '+{n}% gold' },
  war: { label: 'War', targets: { stone: null, bronze: null, classical: 1, kingdoms: 2, gunpowder: 2, modern: 1, information: 1, future: null }, unit: 'battles won', mod: 'national.moraleRecovery', sign: 1, pct: true, n0: 10, step: 5, bonusLabel: '+{n}% morale recovery' },
  culture: { label: 'Culture', targets: { stone: 5, bronze: 22, classical: 85, kingdoms: 230, gunpowder: 490, modern: 770, information: 1050, future: 1450 }, unit: 'building levels in one city', mod: 'national.stabilityBonus', sign: 1, pct: false, n0: 1, step: 1 / 3, bonusLabel: '+{n} stability' },
  science: { label: 'Science', targets: { stone: 2, bronze: 2, classical: 2, kingdoms: 2, gunpowder: 2, modern: 2, information: 2, future: 2 }, unit: 'research boosts', mod: 'national.researchCost', sign: -1, pct: true, n0: 10, step: 2.5, bonusLabel: '-{n}% research cost' }
};

// What to do next for each goal, in one plain line (the map goal tracker, I149).
export const GOAL_NEXT_ACTION = {
  expand: 'Found or conquer another city.',
  wealth: 'Settle or grow onto a new kind of resource.',
  war: 'Win a battle.',
  culture: 'Build or upgrade a building in your best city.',
  science: 'Meet a research boost (see Research).'
};

/** The reward of playstyle `id` in `ageId`: { mods, n, bonus } (bonus: the English line). */
export const goalReward = (id, ageId) => {
  const p = PLAYSTYLES[id];
  const n = Math.floor(p.n0 + p.step * AGE_ORDER.indexOf(ageId) + 1e-9);
  return { mods: { [p.mod]: p.sign * (p.pct ? n / 100 : n) }, n, bonus: p.bonusLabel.replace('{n}', n) };
};

/** The goals of `ageId`, each with its target and reward. */
export const goalsForAge = (ageId) => {
  const age = AGES[ageId] ? ageId : FIRST_AGE_ID;
  return Object.entries(PLAYSTYLES).filter(([, p]) => p.targets[age] != null)
    .map(([id, p]) => ({ id, label: p.label, target: p.targets[age], unit: p.unit, ...goalReward(id, age) }));
};

// Every age has 3 to 5 goals.
AGE_ORDER.forEach((id) => { const n = goalsForAge(id).length; if (n < 3 || n > 5) throw new Error(`eraGoals: ${id} has ${n} goals`); });
