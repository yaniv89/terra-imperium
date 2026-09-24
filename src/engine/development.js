// src/engine/development.js
// Plan §M5: province development (region.dev.tax/production/manpower) as the LIVE economic base,
// replacing calcIncome's old direct reads of REGIONS_DATA's static per-region resources.gold/hr.
//
// Seeding preserves today's exact income: REGIONS_DATA's gold/hr are already small integers
// (0-201 across the whole 4,482-region dataset, not raw GDP — gdpMillions is a separate, cosmetic
// field), so ceil(gold/2) + floor(gold/2) sums back to gold exactly for a freshly-seeded nation.
// The plan's own "each 1-30" development range doesn't strictly hold on this data (a region with
// gold=201 seeds dev.tax/production around 100) — real-world-derived regions vary far more than a
// 1-30 scale allows, and clamping dev to fit that scale would either break income parity at
// creation or flatten the game's actual economic geography into something flatter than the source
// data. The floor of 1 (never 0) IS kept, exactly as the plan states.
import { REGIONS_DATA } from '../data/regions';

export const seedDevelopment = (regionId) => {
  const data = REGIONS_DATA[regionId];
  const gold = data?.resources?.gold || 0;
  const hr = data?.resources?.hr || 0;
  return {
    tax: Math.max(1, Math.ceil(gold / 2)),
    production: Math.max(1, Math.floor(gold / 2)),
    manpower: Math.max(1, hr)
  };
};

export const getTotalDev = (region) => {
  const dev = region?.dev;
  if (!dev) return 0;
  return (dev.tax || 0) + (dev.production || 0) + (dev.manpower || 0);
};

// Sums getTotalDev across every region a nation currently OWNS (occupation doesn't move this —
// plan §M13: "owner keeps owning it, just gets nothing from it while occupied" applies to dev too).
// Prior call sites that needed this (M12's ANNEX_VASSAL cost, expansion.js's per-region read) each
// inlined their own reduce; this is the first shared helper, used by war-score/peace-cost math
// (M13) on top of those two.
export const getNationTotalDev = (state, nationId) =>
  Object.values(state.regions || {}).reduce((sum, r) => sum + (r.owner === nationId ? getTotalDev(r) : 0), 0);

// Population and development both compounding without limit would let a heavily-grown, heavily-
// developed region's income spiral (the plan's own concern, §M5's "clamped" note) — this replaces
// calcIncome's old UNCLAMPED popGrowthMult with an explicit [0.5, 2.0] ceiling/floor.
export const POP_FACTOR_MIN = 0.5;
export const POP_FACTOR_MAX = 2.0;
export const getPopFactor = (region, regionData) => {
  const modernBaseline = regionData?.population || 0;
  if (modernBaseline <= 0) return 1;
  const ratio = (region?.currentPopulation || modernBaseline) / modernBaseline;
  return Math.max(POP_FACTOR_MIN, Math.min(POP_FACTOR_MAX, ratio));
};

// Develop Province (plan §M5's new action): which power pool each development type spends.
export const DEV_TYPE_POOL = { tax: 'adm', production: 'dip', manpower: 'mil' };
export const DEV_TYPE_IDS = Object.keys(DEV_TYPE_POOL);

const DEVELOP_PROVINCE_BASE_COST = 50;
const DEVELOP_PROVINCE_DEV_SCALING = 15;

// The plan's own formula, verbatim: 50 x (1 + totalDev / 15) x (1 + national.developmentCost).
export const getDevelopProvinceCost = (region, developmentCostMult = 0) =>
  Math.round(DEVELOP_PROVINCE_BASE_COST * (1 + getTotalDev(region) / DEVELOP_PROVINCE_DEV_SCALING) * (1 + developmentCostMult));

// +1 development raises currentPopulation by 3% of the modern baseline (plan §M5) — a real,
// separate growth channel from Population Policy's own per-turn growth-RATE bump.
export const DEVELOP_PROVINCE_POP_GAIN_RATIO = 0.03;
