// src/data/worldSizes.js
// The three world sizes of a new game (plans/peoples-and-world-setup.md section 2, roadmap
// decision 2): how many major nations are drawn from the 150-people pool. Measured on the real
// grid: Small leaves big empires and room to settle, Standard is the balance point, Large is
// crowded on purpose. `independents` is for phase W1 (independent cities); W0 has majors only.
// Majors keep at least MAJOR_MIN_GAP_KM between capitals (the plan's 6 hexes at frequency 75,
// written in km: master plan section 3, "Distances").
export const WORLD_SIZES = {
  small: { id: 'small', name: 'Small', majors: 24, independents: 96, blurb: 'Big empires, room to settle' },
  standard: { id: 'standard', name: 'Standard', majors: 36, independents: 'all', blurb: 'Recommended' },
  large: { id: 'large', name: 'Large', majors: 42, independents: 'all', blurb: 'Crowded, more diplomacy' }
};
export const WORLD_SIZE_IDS = Object.keys(WORLD_SIZES);
export const DEFAULT_WORLD_SIZE = 'standard';
export const MAJOR_MIN_GAP_KM = 612;

// Every nation starts equal (roadmap decision 10): one city of this size, the same abstract
// garrison strength (nation.militaryStrength), the same army (one regiment) and treasury, no
// settlers. The legacy world's Dawn sizes and river settlers do not apply to a peoples world.
export const EQUAL_START_SIZE = 2;
export const EQUAL_START_MILITARY = 12000;
