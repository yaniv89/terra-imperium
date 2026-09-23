// src/data/historicalPopulation.js
// Real-world global population, as a fraction of the "modern" (~2024) baseline that
// countries-meta.json/worldRegions.json's own `population` field is sourced from — used ONLY to
// compute a realistic DISPLAY population for flavor (RegionInfoModal, DomesticPanel).
//
// This deliberately does NOT touch region.currentPopulation or REGIONS_DATA[id].population
// themselves — those feed calcIncome's popGrowthMult (src/utils/helpers.js), which is pinned at
// exactly 1.0 for a fresh game and drives already-tuned gold/HR income. Scaling that pair down for
// a 2000 BCE start would crater income by the same factor (a real region's population might be
// 0.3% of its modern figure that far back) — an economy-breaking side effect for what is really
// just a cosmetic "this number looks wrong" complaint. Keeping the historical scaling entirely in
// a separate display-only helper (getDisplayPopulation, src/utils/helpers.js) avoids that.
//
// Anchor points are real historical estimates (broad scholarly consensus figures, not precise —
// nothing pre-modern-census era can be). Values are SHARE of the ~2024 baseline (see the 2024
// anchor = 1.0), not raw counts, since that's the ratio getDisplayPopulation actually needs.
const POPULATION_ANCHORS = [
  { year: -2000, share: 0.0027 }, // ~27M world population
  { year: -1000, share: 0.006 },  // ~50M
  { year: -500, share: 0.0123 },  // ~100M
  { year: 1, share: 0.0247 },     // ~200M
  { year: 1000, share: 0.038 },   // ~310M
  { year: 1500, share: 0.0617 },  // ~500M
  { year: 1800, share: 0.1235 },  // ~1B
  { year: 1900, share: 0.1975 },  // ~1.6B
  { year: 1950, share: 0.3086 },  // ~2.5B
  { year: 2000, share: 0.7531 },  // ~6.1B
  { year: 2024, share: 1 },       // modern baseline — matches the source year behind the static data
  { year: 2100, share: 1.26 },    // UN medium-variant peak ballpark — the last real projection available
  { year: 2300, share: 1.26 }     // held flat, not extrapolated further — genuinely speculative this far out
];

// Log-interpolated between anchors (population growth compounds — it's multiplicative between two
// points in time, not additive — so interpolating the log of the share tracks a real growth curve
// far better than a straight line would between, say, 1900 and 2000).
export const getHistoricalPopulationShare = (year) => {
  if (year <= POPULATION_ANCHORS[0].year) return POPULATION_ANCHORS[0].share;
  for (let i = 1; i < POPULATION_ANCHORS.length; i += 1) {
    if (year <= POPULATION_ANCHORS[i].year) {
      const a = POPULATION_ANCHORS[i - 1];
      const b = POPULATION_ANCHORS[i];
      const t = (year - a.year) / (b.year - a.year);
      return a.share * (b.share / a.share) ** t;
    }
  }
  return POPULATION_ANCHORS[POPULATION_ANCHORS.length - 1].share;
};
