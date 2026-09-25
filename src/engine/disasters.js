// src/engine/disasters.js
// Plan §M15: four independent 0-100 progress meters, each growing DISASTER_PROGRESS_STEP/turn while
// its own trigger condition holds and decaying by the same step otherwise, with a real consequence
// once a meter hits 100. Three of the four (Estate Takeover, Succession War, Revolution) read only
// fields every nation already tracks for real (stability, estates, government, legitimacy — M3/M4/M9
// process these generically for player and AI alike), so they run generically here too. The fourth,
// Economic Collapse, needs the sign of this turn's NET income after upkeep, which only exists inside
// resolveTurn.js's own player-only economy phase (economy.js's own "player-only real computation"
// scope) — it's computed there instead, using nextEconomicCollapseProgress from this file so its
// growth/decay/reset behaves identically to the other three.
import {
  DISASTER_PROGRESS_STEP, DISASTER_MAX_PROGRESS,
  ESTATE_TAKEOVER_ADM_DIP_MIL_PENALTY, ESTATE_TAKEOVER_MODIFIER_DURATION_TURNS, ECONOMIC_COLLAPSE_MIN_LOANS,
  SUCCESSION_WAR_LEGITIMACY_THRESHOLD, REVOLUTION_LABOR_LOYALTY_THRESHOLD
} from '../data/actionCosts';
import { ESTATE_PRIVILEGES, LABOR_ESTATE_ID, ESTATE_TAKEOVER_INFLUENCE_THRESHOLD, ESTATE_TAKEOVER_LOYALTY_THRESHOLD } from '../data/estates';
import { getAvailableGovernmentTypes, resetReformsForType } from '../data/government';
import { addNationModifier } from './modifiers/timed';

const nextProgress = (current, triggered) =>
  Math.max(0, Math.min(DISASTER_MAX_PROGRESS, (current || 0) + (triggered ? DISASTER_PROGRESS_STEP : -DISASTER_PROGRESS_STEP)));

const emptyDisasters = () => ({ estateTakeover: 0, economicCollapse: 0, successionWar: 0, revolution: 0 });

// Any estate crossing the plan's own two thresholds keeps the meter climbing; which one crossed it
// is re-derived (not stored) at the moment the meter completes, since that's the only point it matters.
const estateTakeoverTriggered = (nation) =>
  Object.entries(nation.estates || {}).some(([, e]) => e.influence > ESTATE_TAKEOVER_INFLUENCE_THRESHOLD && e.loyalty < ESTATE_TAKEOVER_LOYALTY_THRESHOLD);

const successionWarTriggered = (nation) =>
  nation.government?.type === 'monarchy' && !nation.heir && (nation.legitimacy ?? 50) < SUCCESSION_WAR_LEGITIMACY_THRESHOLD;

const revolutionTriggered = (nation, ageId) =>
  ageId === 'modern' && (nation.stability || 0) <= -2 && (nation.estates?.[LABOR_ESTATE_ID]?.loyalty ?? 100) < REVOLUTION_LABOR_LOYALTY_THRESHOLD;

// Plan: "Estate Takeover... at 100 the estate seizes power: ADM/DIP/MIL -2 for 20 turns, and forced
// privileges." The estate that actually crossed the threshold (there may be more than one; the first
// found is the one that "seizes power") is granted whichever of its own privileges it doesn't already
// hold, same as a normal GRANT_ESTATE_PRIVILEGE — a disaster forcing a concession the crown never
// agreed to, rather than a new kind of privilege.
const resolveEstateTakeover = (nation, turnNumber) => {
  const [estateId, estate] = Object.entries(nation.estates || {})
    .find(([, e]) => e.influence > ESTATE_TAKEOVER_INFLUENCE_THRESHOLD && e.loyalty < ESTATE_TAKEOVER_LOYALTY_THRESHOLD) || [];
  let estates = nation.estates;
  if (estateId) {
    const grantable = (ESTATE_PRIVILEGES[estateId] || []).find((p) => !(estate.privileges || []).includes(p.id));
    if (grantable) estates = { ...estates, [estateId]: { ...estate, privileges: [...(estate.privileges || []), grantable.id] } };
  }
  return addNationModifier(
    { ...nation, estates },
    {
      sourceType: 'disaster', sourceId: 'estate_takeover', label: 'Estate Takeover',
      mods: { 'national.admBonus': -ESTATE_TAKEOVER_ADM_DIP_MIL_PENALTY, 'national.dipBonus': -ESTATE_TAKEOVER_ADM_DIP_MIL_PENALTY, 'national.milBonus': -ESTATE_TAKEOVER_ADM_DIP_MIL_PENALTY },
      duration: ESTATE_TAKEOVER_MODIFIER_DURATION_TURNS,
      turnNumber
    }
  );
};

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

// One turn of every generic (non-Economic-Collapse) disaster meter for one nation. Returns the
// updated nation, plus `triggersCivilWar` when Succession War or Revolution just completed —
// resolveTurn.js is the one place that knows how to actually start a civil war (src/engine/
// civilWar.js needs the region/unit maps this module deliberately doesn't touch).
export const processDisastersTurn = (nation, ageId, turnNumber) => {
  const disasters = { ...emptyDisasters(), ...nation.disasters };
  let nextNation = nation;
  let triggersCivilWar = false;
  const logs = [];

  const estateTakeover = nextProgress(disasters.estateTakeover, estateTakeoverTriggered(nextNation));
  if (estateTakeover >= DISASTER_MAX_PROGRESS && disasters.estateTakeover < DISASTER_MAX_PROGRESS) {
    nextNation = resolveEstateTakeover(nextNation, turnNumber);
    logs.push({ message: `${nextNation.name}: the estates seize real power over the crown. (-2 ADM/DIP/MIL for 20 turns)`, type: 'crisis' });
  }

  const successionWar = nextProgress(disasters.successionWar, successionWarTriggered(nextNation));
  if (successionWar >= DISASTER_MAX_PROGRESS && disasters.successionWar < DISASTER_MAX_PROGRESS) {
    triggersCivilWar = true;
    logs.push({ message: `${nextNation.name}: rival claimants to the throne plunge the realm into civil war.`, type: 'crisis' });
  }

  const revolution = nextProgress(disasters.revolution, revolutionTriggered(nextNation, ageId));
  if (revolution >= DISASTER_MAX_PROGRESS && disasters.revolution < DISASTER_MAX_PROGRESS) {
    nextNation = resolveRevolution(nextNation, ageId);
    triggersCivilWar = true;
    logs.push({ message: `${nextNation.name}: revolution overturns the old order.`, type: 'crisis' });
  }

  nextNation = { ...nextNation, disasters: { ...disasters, estateTakeover: estateTakeover >= DISASTER_MAX_PROGRESS ? 0 : estateTakeover, successionWar: successionWar >= DISASTER_MAX_PROGRESS ? 0 : successionWar, revolution: revolution >= DISASTER_MAX_PROGRESS ? 0 : revolution } };
  return { nation: nextNation, triggersCivilWar, logs };
};

// Economic Collapse's own progress step (plan: "3 loans and negative net income for 5 turns") — kept
// separate since resolveTurn.js's economy phase is the only place `netIncomeNegative` is known, and
// is the only caller.
export const nextEconomicCollapseProgress = (nation, netIncomeNegative) =>
  nextProgress(nation.disasters?.economicCollapse, (nation.loans || []).length >= ECONOMIC_COLLAPSE_MIN_LOANS && netIncomeNegative);

export const isEconomicCollapseDisasterReady = (progress) => progress >= DISASTER_MAX_PROGRESS;
