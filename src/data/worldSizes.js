// src/data/worldSizes.js
// The three world sizes of a new game (plans/peoples-and-world-setup.md section 2, roadmap
// decision 2): how many major nations are drawn from the 50 major peoples, and how many
// city-states (one-city independents, phase W1) from the 100 city-state peoples (decision 42, X25:
// about 1.25 per major at Normal, Civ VI uses 1.5; there were 2.3 per major before).
// Every start (major or city-state) keeps at least START_MIN_GAP_KM from every other on the real
// Earth (decision 42: spacing by density; the old gap was 612 km between majors only).
export const WORLD_SIZES = {
  small: { id: 'small', name: 'Small', majors: 24, independents: 30, blurb: 'Big empires, room to settle' },
  standard: { id: 'standard', name: 'Standard', majors: 36, independents: 45, blurb: 'Recommended' },
  large: { id: 'large', name: 'Large', majors: 42, independents: 60, blurb: 'Crowded, more diplomacy' }
};
export const WORLD_SIZE_IDS = Object.keys(WORLD_SIZES);
export const DEFAULT_WORLD_SIZE = 'standard';

/** The minimum distance between any two starting cities on the real Earth (decision 42: "about 900";
 * 880 keeps the Kingdom of Israel beside Akkad, the default start: 895 km apart on the grid). */
export const START_MIN_GAP_KM = 880;
/** The generated worlds' fair start sites keep this gap between majors (src/worldgen/v1/startSites.js).
 * It is part of a generated world's hash, so it stays where it was; their city-states keep
 * START_MIN_GAP_KM where the land allows (generatedPeoples.js). */
export const MAJOR_MIN_GAP_KM = 612;
/** A city-state stands at its people's real capital or, when that is within the gap of another
 * start, on the nearest free site at most this far from it (the same part of the world); else it
 * is left out. On a Large world the land is full near 50 city-states at the 900 km gap. */
export const CITY_STATE_SHIFT_KM = 1000;

/** The start setting "City-states: Few / Normal / Many": a multiplier on the size's count. */
export const CITY_STATE_DENSITIES = {
  few: { id: 'few', name: 'Few', mult: 0.6, blurb: 'More open land' },
  normal: { id: 'normal', name: 'Normal', mult: 1, blurb: 'Recommended' },
  many: { id: 'many', name: 'Many', mult: 1.3, blurb: 'A busier map' }
};
export const CITY_STATE_DENSITY_IDS = Object.keys(CITY_STATE_DENSITIES);
export const DEFAULT_CITY_STATES = 'normal';
/** Not on the start screen: every city-state people at its real capital, spaced only by the settling
 * rule (the layout before decision 42). Engine tests that need a crowded neighbourhood use it. */
export const CITY_STATES_PACKED = 'packed';
/** How many city-states a world of this size and density aims for (fewer when the land is full). */
export const cityStateCount = (sizeId, density = DEFAULT_CITY_STATES) => {
  const size = WORLD_SIZES[sizeId] || WORLD_SIZES[DEFAULT_WORLD_SIZE];
  return Math.round(size.independents * (CITY_STATE_DENSITIES[density]?.mult ?? 1));
};

// Every nation starts equal (roadmap decision 10): one city of this size, the same abstract
// garrison strength (nation.militaryStrength), the same army (one regiment) and treasury, no
// settlers. The legacy world's Dawn sizes and river settlers do not apply to a peoples world.
export const EQUAL_START_SIZE = 2;
export const EQUAL_START_MILITARY = 12000;
