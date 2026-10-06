// src/data/townTiers.js
// A town's size from its province's buildings, kept free of three.js so the flat map's badges can
// read it without pulling the 3D engine into the main bundle. `radius` is the procedural town's;
// `modelRadius` the artist models' ground (model units: small 40 m, medium 60, big 80 across).
export const TOWN_TIERS = [
  { id: 'small', minBuildings: 0, houses: 5, radius: 1.7, modelRadius: 2.0 },
  { id: 'medium', minBuildings: 4, houses: 11, radius: 2.6, modelRadius: 3.0 },
  { id: 'big', minBuildings: 10, houses: 22, radius: 3.6, modelRadius: 4.0 }
];

// How many buildings a province has: each built category counts its tier + 1, each mine 1.
export const countBuildings = (region) => {
  const cats = region?.buildings?.categories || {};
  const fromCats = Object.values(cats).reduce((sum, t) => sum + (t >= 0 ? t + 1 : 0), 0);
  const mines = Object.values(region?.buildings?.extraction || {}).filter(Boolean).length;
  return fromCats + mines;
};

export const townTier = (region) => {
  const n = countBuildings(region);
  return [...TOWN_TIERS].reverse().find((t) => n >= t.minBuildings);
};
