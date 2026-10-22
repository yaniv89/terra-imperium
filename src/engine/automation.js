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
//             civil war or its cool-down: a seeded AUTOMATION_UPRISING_CHANCE roll a turn starts a
//             warning (`nation.uprisingWarning`, the user's rule: a fair warning and a way to stop
//             it). speedTurns(UPRISING_WARNING_REF_TURNS) later, if the danger still stands, UPRISING_SHARE
//             of its robots at home turn insurgent, a civil war run by the civil-war machinery
//             (civilWar.js processCivilWarTurn); raising stability above AUTOMATION_UPRISING_STABILITY
//             or bringing automation under AUTOMATION_UPRISING_AT meanwhile ends the warning
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
export const UPRISING_WARNING_REF_TURNS = 6;

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

/** Are the machines a danger now (automation high, stability low)? `target`: the meter's target, so
 * robots disbanded count at once though the meter itself falls AUTOMATION_STEP a turn. */
export const inUprisingDanger = (nation, target = Infinity) => Math.min(automationOf(nation), target) >= AUTOMATION_UPRISING_AT && (nation.stability || 0) <= AUTOMATION_UPRISING_STABILITY;

/**
 * One turn of the uprising rule: { warning, event, rise }. `warning` is the nation's next
 * uprisingWarning (undefined: unchanged, null: cleared); `event` 'warned' or 'averted' for the log;
 * `rise` true when the warning ran out with the danger still standing. A seeded roll, no RNG stream.
 * `warnTurns`: speedTurns(UPRISING_WARNING_REF_TURNS) at the nation's age; `target`: the meter's target.
 */
export const uprisingStep = (nation, nationId, turn, coolingDown, warnTurns, target = Infinity) => {
  const threat = inUprisingDanger(nation, target);
  const danger = !nation.civilWar?.active && !coolingDown && threat;
  const w = nation.uprisingWarning;
  if (w) return !danger ? { warning: null, ...(threat ? {} : { event: 'averted' }) } : turn >= w.at ? { warning: null, rise: true } : { warning: undefined }; // averted: only when the player acted
  if (danger && hashRoll(`uprising|${nationId}|${turn}`) < AUTOMATION_UPRISING_CHANCE) return { warning: { since: turn, at: turn + warnTurns }, event: 'warned' };
  return { warning: undefined };
};

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
