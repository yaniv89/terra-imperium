// src/engine/disasters.js
// Plan §M15: two independent 0-100 progress meters, each growing DISASTER_PROGRESS_STEP/turn while
// its own trigger condition holds and decaying by the same step otherwise, with a real consequence
// once a meter hits 100. Revolution reads only fields every nation already tracks for real
// (stability, legitimacy, government), so it runs generically here for player and AI alike.
// Economic Collapse needs the sign of this turn's NET income after upkeep, which only exists inside
// resolveTurn.js's own player-only economy phase (economy.js's own "player-only real computation"
// scope), so it's computed there instead, using nextEconomicCollapseProgress from this file so its
// growth/decay/reset behaves identically. (Estate Takeover and Succession War went with the
// estates and succession, master plan decision 37.)
import {
  DISASTER_PROGRESS_STEP, DISASTER_MAX_PROGRESS, ECONOMIC_COLLAPSE_MIN_LOANS, REVOLUTION_LEGITIMACY_THRESHOLD
} from '../data/actionCosts';
import { getAvailableGovernmentTypes, resetReformsForType } from '../data/government';

const nextProgress = (current, triggered) =>
  Math.max(0, Math.min(DISASTER_MAX_PROGRESS, (current || 0) + (triggered ? DISASTER_PROGRESS_STEP : -DISASTER_PROGRESS_STEP)));

// A Modern-age nation at stability -2 or worse whose regime has lost its legitimacy.
export const revolutionTriggered = (nation, ageId) =>
  ageId === 'modern' && (nation.stability || 0) <= -2 && (nation.legitimacy ?? 50) < REVOLUTION_LEGITIMACY_THRESHOLD;

// Plan: "Revolution (Modern)... at 100: government becomes Republic/Presidential or Dictatorship/
// One-Party, and civil war." Monarchies/theocracies are overthrown into a republic; anything already
// republican or autocratic radicalizes into a dictatorship instead — the plan names both landing
// spots but not the rule choosing between them, so this reads it as "whichever is the bigger regime
// change from where the nation already stood."
const resolveRevolution = (nation, ageId) => {
  const overthrowingMonarchy = nation.government?.type === 'monarchy' || nation.government?.type === 'theocracy';
  const targetTypeId = overthrowingMonarchy ? 'republic' : 'dictatorship';
  const available = getAvailableGovernmentTypes(ageId, nation.identity);
  if (!available.some((t) => t.id === targetTypeId)) return nation;
  return { ...nation, government: { type: targetTypeId, reforms: resetReformsForType(targetTypeId, ageId) } };
};

// One turn of the Revolution meter for one nation. Returns the updated nation, plus
// `triggersCivilWar` when Revolution just completed: resolveTurn.js is the one place that knows how
// to actually start a civil war (src/engine/civilWar.js needs the region/unit maps this module
// deliberately doesn't touch). Only the two live meters are written back, so a save's old
// estateTakeover/successionWar meters drop out on the first turn.
export const processDisastersTurn = (nation, ageId) => {
  const disasters = nation.disasters || {};
  let nextNation = nation;
  let triggersCivilWar = false;
  const logs = [];

  const revolution = nextProgress(disasters.revolution, revolutionTriggered(nextNation, ageId));
  if (revolution >= DISASTER_MAX_PROGRESS && (disasters.revolution || 0) < DISASTER_MAX_PROGRESS) {
    nextNation = resolveRevolution(nextNation, ageId);
    triggersCivilWar = true;
    logs.push({ message: `${nextNation.name}: revolution overturns the old order.`, type: 'crisis' });
  }

  nextNation = { ...nextNation, disasters: { economicCollapse: disasters.economicCollapse || 0, revolution: revolution >= DISASTER_MAX_PROGRESS ? 0 : revolution } };
  return { nation: nextNation, triggersCivilWar, logs };
};

// Economic Collapse's own progress step (plan: "3 loans and negative net income for 5 turns") — kept
// separate since resolveTurn.js's economy phase is the only place `netIncomeNegative` is known, and
// is the only caller.
export const nextEconomicCollapseProgress = (nation, netIncomeNegative) =>
  nextProgress(nation.disasters?.economicCollapse, (nation.loans || []).length >= ECONOMIC_COLLAPSE_MIN_LOANS && netIncomeNegative);

export const isEconomicCollapseDisasterReady = (progress) => progress >= DISASTER_MAX_PROGRESS;
