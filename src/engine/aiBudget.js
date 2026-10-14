// src/engine/aiBudget.js
// AI budgets (lane CB09, I124). An AI nation whose upkeep outruns its income used to go bankrupt
// every turn: with no bank there is no loan, so each short turn was a new bankruptcy, each one
// stacked another -33% gold modifier and -3 stability, and the nation fell into civil war after
// civil war (measured: 2 or 3 majors a game, 100+ bankruptcies each in 150 turns). Now the AI does
// what a player would, in order:
//   1. Cut army pay to the minimum (armyMaintenance, the player's own slider: half upkeep, slower
//      reinforcement) when its treasury covers fewer than AI_BUDGET_RUNWAY_TURNS turns of deficit.
//   2. Still short: disband its weakest units (never settlers, never a unit in a battle) until the
//      deficit is gone or only AI_MIN_STANDING_UNITS remain.
//   3. Back in the black with savings (AI_BUDGET_RESTORE_RUNWAY turns of full pay banked): restore
//      full pay.
// Bankruptcy itself still happens (economy.js applyBankruptcy, justified unrest stays), but the
// modifier no longer stacks (it is refreshed) and the turns after one are a recovery window
// (aiEconomy.js settleAIUpkeep): a further shortfall then costs deserters, not a new bankruptcy.
// Pure of randomness; ties by unit id.
import { calcNationBalance } from './economy';
import { ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_DEFAULT, UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';

export const AI_BUDGET_RUNWAY_TURNS = 5;
export const AI_BUDGET_RESTORE_RUNWAY = 10;
export const AI_MIN_STANDING_UNITS = 1;

const maintenanceOf = (nation) => nation.armyMaintenance ?? ARMY_MAINTENANCE_DEFAULT;

/**
 * The budget step for one AI nation, before its upkeep is settled. `state` must hold the nation
 * with this turn's income already credited to `economy.gold`; `ownedUnits` are its units.
 * `inBattle(unitId)` says whether a unit is committed to a battle. Returns
 * { nation, disband: [unitId] } (the same nation object when nothing changed).
 */
export const aiBudgetStep = (state, nationId, income, ownedUnits, inBattle = () => false) => {
  let nation = state.nations[nationId];
  const gold = nation.economy?.gold || 0;
  const balanceWith = (n) => calcNationBalance({ ...state, nations: { ...state.nations, [nationId]: n } }, nationId, income, ownedUnits);
  let balance = balanceWith(nation);
  const disband = [];
  if (balance.net >= 0) {
    // Restore full pay once the treasury could carry it for a while.
    if (maintenanceOf(nation) < ARMY_MAINTENANCE_DEFAULT) {
      const full = { ...nation, armyMaintenance: ARMY_MAINTENANCE_DEFAULT };
      const fullNet = balanceWith(full).net;
      if (fullNet >= 0 || gold + fullNet * AI_BUDGET_RESTORE_RUNWAY >= 0) nation = full;
    }
    return { nation, disband };
  }
  if (gold + balance.net * AI_BUDGET_RUNWAY_TURNS >= 0) return { nation, disband }; // savings cover it for now
  if (maintenanceOf(nation) > ARMY_MAINTENANCE_MIN) {
    nation = { ...nation, armyMaintenance: ARMY_MAINTENANCE_MIN };
    balance = balanceWith(nation);
  }
  let net = balance.net;
  const perUnit = Math.max(1, Math.round(UNIT_UPKEEP_GOLD_PER_TURN * ARMY_MAINTENANCE_MIN / 100));
  const fighting = ownedUnits.filter((u) => u.classId !== 'settler' && !u.embarkedOn);
  const candidates = fighting
    .filter((u) => !inBattle(u.id) && !ownedUnits.some((c) => c.embarkedOn === u.id))
    .sort((a, b) => (a.strength || 0) - (b.strength || 0) || (a.id < b.id ? -1 : 1));
  let standing = fighting.length;
  for (const u of candidates) {
    if (net >= 0 || gold + net * AI_BUDGET_RUNWAY_TURNS >= 0 || standing <= AI_MIN_STANDING_UNITS) break;
    disband.push(u.id);
    standing -= 1;
    net += perUnit;
  }
  return { nation, disband };
};
