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
  expand: { label: 'Expand', targets: { stone: 4, bronze: 8, classical: 17, kingdoms: 25, gunpowder: 28, modern: 28, information: 29, future: 33 }, unit: 'cities', mod: 'national.hrMult', sign: 1, pct: true, n0: 10, step: 5, bonusLabel: '+{n}% manpower' },
  wealth: { label: 'Wealth', targets: { stone: 9, bronze: 15, classical: 19, kingdoms: 21, gunpowder: 22, modern: 22, information: 23, future: 24 }, unit: 'kinds of resource', mod: 'national.goldMult', sign: 1, pct: true, n0: 10, step: 5, bonusLabel: '+{n}% gold' },
  war: { label: 'War', targets: { stone: null, bronze: null, classical: 2, kingdoms: 2, gunpowder: 2, modern: 1, information: 1, future: 1 }, unit: 'battles won', mod: 'national.moraleRecovery', sign: 1, pct: true, n0: 10, step: 5, bonusLabel: '+{n}% morale recovery' },
  culture: { label: 'Culture', targets: { stone: 3, bronze: 8, classical: 14, kingdoms: 23, gunpowder: 31, modern: 40, information: 49, future: 55 }, unit: 'building levels in one city', mod: 'national.stabilityBonus', sign: 1, pct: false, n0: 1, step: 1 / 3, bonusLabel: '+{n} stability' },
  science: { label: 'Science', targets: { stone: 7, bronze: 8, classical: 8, kingdoms: 8, gunpowder: 8, modern: 9, information: 6, future: 4 }, unit: 'research boosts', mod: 'national.researchCost', sign: -1, pct: true, n0: 10, step: 2.5, bonusLabel: '-{n}% research cost' }
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
