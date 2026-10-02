// src/data/eraGoals.js
// Era goals (plans/civ-map-rework.md, C9.3): every age sets one goal per playstyle (expand,
// wealth, war, culture, science); meeting ERA_GOALS_FOR_LEGACY of them before the age ends gives
// a legacy for the next age (the playstyles met each add their bonus, ERA_LEGACY_TURNS long).
// Targets grow with the age; the engine (src/engine/eraGoals.js) reads the numbers from state.
import { AGE_ORDER } from './ages';

export const ERA_GOALS_FOR_LEGACY = 2;
export const ERA_LEGACY_TURNS = 50;

export const PLAYSTYLES = {
  expand: { label: 'Expand', targets: [4, 6, 9, 12, 16], unit: 'cities', mods: { 'national.popGrowthBonus': 0.1 }, bonusLabel: '+10% population growth' },
  wealth: { label: 'Wealth', targets: [1, 2, 3, 4, 5], unit: 'trade agreements', mods: { 'national.goldMult': 0.1 }, bonusLabel: '+10% gold' },
  war: { label: 'War', targets: [1, 2, 3, 4, 5], unit: 'cities taken', mods: { 'national.milBonus': 1 }, bonusLabel: '+1 military power a turn' },
  culture: { label: 'Culture', targets: [1, 2, 3, 4, 5], unit: 'wonders', mods: { 'national.stabilityBonus': 1 }, bonusLabel: '+1 stability' },
  science: { label: 'Science', targets: [4, 8, 14, 20, 28], unit: 'techs', mods: { 'national.researchCost': -0.1 }, bonusLabel: '-10% research cost' }
};

export const goalsForAge = (ageId) => {
  const i = Math.max(0, AGE_ORDER.indexOf(ageId));
  return Object.entries(PLAYSTYLES).map(([id, p]) => ({ id, label: p.label, target: p.targets[i], unit: p.unit }));
};
