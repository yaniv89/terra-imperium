// src/components/panels/automationModel.js
// What the Domestic panel shows of the automation meter (src/engine/automation.js): the value, where it
// is heading, the yields, and the riot and uprising lines with the way out. Null when there is nothing
// to show (no robots, no Automated Industry, no warning).
import { automationOf, automationTarget, automationYields, isRioting, inUprisingDanger, AUTOMATION_MAX, AUTOMATION_RIOT_AT, AUTOMATION_RIOT_STABILITY, AUTOMATION_RIOT_UNREST, AUTOMATION_UPRISING_AT, AUTOMATION_UPRISING_STABILITY } from '../../engine/automation';
import { isBound, AI_LIMITS_CAP } from '../../data/worldCongress';
import { getResearched } from '../../engine/nationState';

export const automationView = (state, id) => {
  const nation = state.nations?.[id];
  if (!nation) return null;
  const robots = Object.values(state.units || {}).filter((u) => u.ownerId === id && u.robot && u.strength > 0).length;
  const target = Math.min(automationTarget(robots, getResearched(state, id)), isBound(state, 'aiLimits', id) ? AI_LIMITS_CAP : Infinity);
  const value = automationOf(nation);
  const warning = nation.uprisingWarning;
  if (!value && !target && !warning) return null;
  const { productionMult, scienceMult } = automationYields(nation);
  return {
    value, target, robots, max: AUTOMATION_MAX,
    production: Math.round(productionMult * 100), science: Math.round(scienceMult * 100),
    rioting: isRioting(nation), danger: inUprisingDanger(nation, target),
    warningTurns: warning ? Math.max(0, warning.at - (state.turnNumber || 0)) : null,
    riotAt: AUTOMATION_RIOT_AT, riotStability: AUTOMATION_RIOT_STABILITY, riotUnrest: AUTOMATION_RIOT_UNREST,
    uprisingAt: AUTOMATION_UPRISING_AT, uprisingStability: AUTOMATION_UPRISING_STABILITY
  };
};
