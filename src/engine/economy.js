// src/engine/economy.js
// Plan §M11: expenses ledger, loans, bankruptcy, and the strategic-resource recruit cost. Mirrors
// nationalPower.js/estates.js's shape — pure functions read from `state`, resolveTurn.js writes the
// result back. Real only for the player: calcIncome (helpers.js) itself only ever computed the
// player's economy (AI nations have no simulated gold/loan economy until M16), so every function
// here that reads income/expenses is honestly player-only too, matching the established
// "player-only real computation" trim from M7-M10.
import {
  UNIT_UPKEEP_GOLD_PER_TURN, ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_MAX, ARMY_MAINTENANCE_DEFAULT, FORT_UPKEEP_GOLD_PER_FORT_LEVEL,
  LOAN_BASE_INTEREST_RATE, LOAN_INTEREST_PER_EXISTING_LOAN, LOAN_INTEREST_BANKING_HOUSES_DISCOUNT, LOAN_MIN_INTEREST_RATE,
  LOAN_BASE_CAPACITY, LOAN_BANK_CAPACITY_CAP, LOAN_MIN_SIZE, LOAN_SIZE_INCOME_MULTIPLIER,
  RECRUIT_STRATEGIC_RESOURCE_BY_AGE, RECRUIT_MISSING_RESOURCE_GOLD_PENALTY_MULT, ACTION_COSTS,
  BANKRUPTCY_STABILITY_PENALTY, BANKRUPTCY_PRESTIGE_PENALTY, BANKRUPTCY_ESTATE_LOYALTY_PENALTY,
  BANKRUPTCY_MODIFIER_MODS, BANKRUPTCY_DURATION_TURNS
} from '../data/actionCosts';
import { calcIncome } from '../utils/helpers';
import { getAdvisorSalary } from './succession';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { addNationModifier } from './modifiers/timed';
import { clampStability, clampPrestige } from './nationalPower';

export const clampMaintenance = (value) => Math.max(ARMY_MAINTENANCE_MIN, Math.min(ARMY_MAINTENANCE_MAX, value));

export const hasBankingHouses = (state, nationId) =>
  nationId === state.playerNationId && !!state.techTree?.economy_banking_houses?.researched;

// Bank building tier (economy category index 2, "Bank") or higher, one owned region at a time,
// capped at +3 total per the plan's own "max +3 total" — a direct region scan rather than a
// modifier-engine hook, the same shape estates.js's land-share terms already use for player-only
// per-region counts.
const getBankLoanCapacityBonus = (state, nationId) => {
  if (nationId !== state.playerNationId) return 0;
  const bankTierOrHigher = Object.values(state.regions || {})
    .filter((r) => r.owner === nationId && (r.buildings?.categories?.economy ?? -1) >= 2).length;
  return Math.min(LOAN_BANK_CAPACITY_CAP, bankTierOrHigher);
};

// Plan: "Requires the Banking Houses tech; before that, the treasury simply can't go negative, so
// actions fail" — capacity is 0 (not merely undiscounted) without the tech, which is what makes
// resolveTurn.js's auto-loan-or-bankruptcy check correctly go straight to bankruptcy pre-Banking
// Houses instead of quietly borrowing against a capacity that was never supposed to exist yet.
export const getLoanCapacity = (state, nationId) => {
  if (!hasBankingHouses(state, nationId)) return 0;
  return LOAN_BASE_CAPACITY + getBankLoanCapacityBonus(state, nationId) + 1;
};

export const getLoanInterestRate = (state, nationId) => {
  const existingLoans = (state.nations?.[nationId]?.loans || []).length;
  const rate = LOAN_BASE_INTEREST_RATE + existingLoans * LOAN_INTEREST_PER_EXISTING_LOAN
    - (hasBankingHouses(state, nationId) ? LOAN_INTEREST_BANKING_HOUSES_DISCOUNT : 0);
  return Math.max(LOAN_MIN_INTEREST_RATE, rate);
};

// Plan: "max(200, 5 x avg net income over the last 5 turns)" — this build has no per-turn income
// history buffer (state.history is M20 work), so the current turn's net balance stands in for the
// 5-turn average (LOAN_SIZE_INCOME_MULTIPLIER's own header comment).
export const getLoanSize = (state, nationId) => {
  const { net } = calcNationBalance(state, nationId);
  return Math.max(LOAN_MIN_SIZE, Math.round(LOAN_SIZE_INCOME_MULTIPLIER * Math.max(0, net)));
};

// Plan §M11: "army upkeep, navy upkeep, fort upkeep, advisor salaries, loan interest" — vassal
// tribute is left out (subjects don't exist until M12). Returns zeros for any nation but the
// player, matching calcIncome's own player-only scope.
export const calcNationBalance = (state, nationId) => {
  if (nationId !== state.playerNationId) return { income: { gold: 0 }, expenses: {}, net: 0 };
  const nation = state.nations[nationId];
  const units = Object.values(state.units).filter((u) => u.ownerId === nationId);
  const armyMaintenanceMult = clampMaintenance(nation.armyMaintenance ?? ARMY_MAINTENANCE_DEFAULT) / 100;
  const navyMaintenanceMult = clampMaintenance(nation.navyMaintenance ?? ARMY_MAINTENANCE_DEFAULT) / 100;
  const armyUpkeep = Math.round(units.filter((u) => u.domain !== 'naval').length * UNIT_UPKEEP_GOLD_PER_TURN * armyMaintenanceMult);
  const navyUpkeep = Math.round(units.filter((u) => u.domain === 'naval').length * UNIT_UPKEEP_GOLD_PER_TURN * navyMaintenanceMult);
  const fortLevels = Object.values(state.regions || {})
    .filter((r) => r.owner === nationId)
    .reduce((sum, r) => {
      const tier = r.buildings?.categories?.defense;
      const fortLevel = tier >= 0 ? BUILDING_CATEGORIES.defense.tiers[tier]?.effects?.['local.fortLevel'] : 0;
      return sum + (fortLevel || 0);
    }, 0);
  const fortUpkeep = fortLevels * FORT_UPKEEP_GOLD_PER_FORT_LEVEL;
  const advisorSalaries = Object.values(nation.advisors || {}).filter(Boolean).reduce((sum, a) => sum + getAdvisorSalary(a.level), 0);
  const loanInterest = (nation.loans || []).reduce((sum, loan) => sum + Math.round(loan.principal * loan.interestRate), 0);

  const income = calcIncome(state);
  const expenses = { armyUpkeep, navyUpkeep, fortUpkeep, advisorSalaries, loanInterest };
  const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  return { income, expenses, net: (income.gold || 0) - totalExpenses };
};

// Plan §M11 resource sink: "bronze-age units cost copper, iron-age units cost iron, modern units
// cost oil... missing resources give +50% gold cost instead of blocking" (verbatim). ageId is the
// unit's own stamped age (state.age at recruit time, matching RECRUIT_UNIT's existing behavior).
// Plan §M11/§M15: shared bankruptcy consequence, extracted so both the natural "a loan is needed but
// capacity is already full" shortfall path (resolveTurn.js's own economy phase) and the Economic
// Collapse disaster's own completion (disasters.js, plan §M15: "3 loans and negative net income for 5
// turns... at 100: bankruptcy plus -2 stability") apply the exact same effect instead of two
// drifting copies. `extraStabilityPenalty` is the disaster's own additional hit on top of bankruptcy's
// regular one; the natural shortfall path always passes 0.
export const applyBankruptcy = (nation, regions, nationId, turnNumber, extraStabilityPenalty = 0) => {
  const estates = { ...nation.estates };
  Object.keys(estates).forEach((estateId) => {
    estates[estateId] = { ...estates[estateId], loyalty: Math.max(0, estates[estateId].loyalty - BANKRUPTCY_ESTATE_LOYALTY_PENALTY) };
  });
  const nextNation = addNationModifier(
    {
      ...nation,
      loans: [],
      stability: clampStability((nation.stability || 0) - BANKRUPTCY_STABILITY_PENALTY - extraStabilityPenalty),
      prestige: clampPrestige((nation.prestige || 0) - BANKRUPTCY_PRESTIGE_PENALTY),
      estates
    },
    { sourceType: 'bankruptcy', sourceId: 'bankruptcy', label: 'Bankruptcy', mods: BANKRUPTCY_MODIFIER_MODS, duration: BANKRUPTCY_DURATION_TURNS, turnNumber }
  );
  // "All construction is cancelled without refund" — see resolveTurn.js's own note on why a Great
  // Project's multi-turn queue is the only real substrate for this in a codebase where ordinary
  // buildings complete instantly.
  const nextRegions = { ...regions };
  Object.keys(nextRegions).forEach((regionId) => {
    if (nextRegions[regionId].owner === nationId && nextRegions[regionId].greatProjectConstruction) {
      nextRegions[regionId] = { ...nextRegions[regionId], greatProjectConstruction: null };
    }
  });
  return { nation: nextNation, regions: nextRegions };
};

export const getRecruitUnitCost = (state, ageId) => {
  const base = ACTION_COSTS.recruitUnit;
  const strategic = RECRUIT_STRATEGIC_RESOURCE_BY_AGE[ageId];
  if (!strategic) return base;
  const have = state.resources?.[strategic.key] || 0;
  if (have >= strategic.amount) return { ...base, [strategic.key]: strategic.amount };
  return { ...base, gold: Math.round(base.gold * (1 + RECRUIT_MISSING_RESOURCE_GOLD_PENALTY_MULT)) };
};
