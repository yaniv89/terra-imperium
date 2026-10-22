// src/engine/automation.js
// The automation meter (eight ages plan U70, KTD22: the Synthetics estate rebuilt as a number).
// `nation.automation` is an integer 0..AUTOMATION_MAX: how much of the nation's work machines do.
//
//   target    AUTOMATION_PER_ROBOT x robot units (robots.js) + AUTOMATION_INDUSTRY with Automated
//             Industry known, capped at AUTOMATION_MAX
//   meter     moves AUTOMATION_STEP a turn toward the target (integer)
//   yields    every city: production +automation / AUTOMATION_PRODUCTION_DIV (at most +25%) and
//             science +automation / AUTOMATION_SCIENCE_DIV (at most +20%), through the city turn
//             context (lawRules.js rulerCityCtx)
//   riots     automation >= AUTOMATION_RIOT_AT and stability <= AUTOMATION_RIOT_STABILITY: every city
//             of the nation gains AUTOMATION_RIOT_UNREST unrest a turn (the jobless riot)
//   uprising  automation >= AUTOMATION_UPRISING_AT, stability <= AUTOMATION_UPRISING_STABILITY, no
//             civil war or its cool-down: a seeded AUTOMATION_UPRISING_CHANCE roll a turn turns
//             UPRISING_SHARE of its robots at home into insurgents, a civil war run by the
//             civil-war machinery (civilWar.js processCivilWarTurn) until crushed or lost
// Ripples: city production and science, city unrest (and through it revolts), civil war, the army.
import { REBEL_OWNER_ID } from '../data/rebellion';
import { INSURGENT_MARKER } from './civilWar';
import { hashRoll } from './aftermath';

export const AUTOMATED_INDUSTRY_TECH = 'economy_automated_industry';
export const AUTOMATION_MAX = 100;
export const AUTOMATION_PER_ROBOT = 4;
export const AUTOMATION_INDUSTRY = 30;
export const AUTOMATION_STEP = 5;
export const AUTOMATION_PRODUCTION_DIV = 400;
export const AUTOMATION_SCIENCE_DIV = 500;
export const AUTOMATION_RIOT_AT = 40;
export const AUTOMATION_RIOT_STABILITY = -1;
export const AUTOMATION_RIOT_UNREST = 3;
export const AUTOMATION_UPRISING_AT = 60;
export const AUTOMATION_UPRISING_STABILITY = -2;
export const AUTOMATION_UPRISING_CHANCE = 0.05;
export const UPRISING_SHARE = 1 / 3;

export const automationOf = (nation) => nation?.automation || 0;

/** The meter's target for a nation with `robots` robot units knowing `researched` (array or Set). */
export const automationTarget = (robots, researched) => {
  const industry = researched?.has ? researched.has(AUTOMATED_INDUSTRY_TECH) : !!researched?.includes?.(AUTOMATED_INDUSTRY_TECH);
  return Math.min(AUTOMATION_MAX, AUTOMATION_PER_ROBOT * robots + (industry ? AUTOMATION_INDUSTRY : 0));
};

/** One step of the meter toward its target. */
export const nextAutomation = (current, target) => (current < target ? Math.min(target, current + AUTOMATION_STEP) : Math.max(target, current - AUTOMATION_STEP));

/** The meter's city yields: { productionMult, scienceMult } (0 when there is none). */
export const automationYields = (nation) => {
  const a = automationOf(nation);
  return { productionMult: a / AUTOMATION_PRODUCTION_DIV, scienceMult: a / AUTOMATION_SCIENCE_DIV };
};

export const isRioting = (nation) => automationOf(nation) >= AUTOMATION_RIOT_AT && (nation.stability || 0) <= AUTOMATION_RIOT_STABILITY;

/** Does the Machine Uprising start this turn? A seeded roll, no RNG stream. */
export const uprisingStarts = (nation, nationId, turn, coolingDown) => !nation.civilWar?.active && !coolingDown
  && automationOf(nation) >= AUTOMATION_UPRISING_AT && (nation.stability || 0) <= AUTOMATION_UPRISING_STABILITY
  && hashRoll(`uprising|${nationId}|${turn}`) < AUTOMATION_UPRISING_CHANCE;

/**
 * The uprising: UPRISING_SHARE (at least one) of the nation's robots based in its own cities rise as
 * insurgents in those cities. Mutates the turn's working `regions` and `units`; returns the civil war
 * record, or null when there is no robot at home to rise.
 */
export const startUprising = (regions, units, nationId, turn) => {
  const home = Object.values(units).filter((u) => u.ownerId === nationId && u.robot && u.domain === 'land' && regions[u.regionId]?.owner === nationId && !regions[u.regionId].occupiedBy)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!home.length) return null;
  home.slice(0, Math.max(1, Math.round(home.length * UPRISING_SHARE))).forEach((u) => {
    units[u.id] = { ...u, ownerId: REBEL_OWNER_ID, isInsurgent: true, route: undefined, spawnedTurn: turn };
    regions[u.regionId] = { ...regions[u.regionId], occupiedBy: INSURGENT_MARKER };
  });
  return { active: true, startedTurn: turn, holdStreak: 0, machines: true };
};
