// src/data/spaceMissions.js
// The Space Race mission ladder (plan §10.4 Layer 3): a fixed sequence of multi-turn projects,
// each unlocking the next, each paying a real one-time and/or permanent reward. Rare Metals and
// Helium-3 (src/data/resources.js — unlocked by age but gated further by "the space race's own
// mission-completion gate", per that file's own header) become real income for the first time
// here: asteroid_mining's and outer_planets' recurring rewards ARE that gate, since neither
// resource has an Earthly deposit or extraction building — they only ever come from completing
// the mission that plan text names as their source.
//
// Ordered array (not a keyed object) because completion is strictly sequential — `order` doubles
// as both display order and the prerequisite index.
export const SPACE_MISSIONS = [
  {
    id: 'sounding_rocket',
    order: 0,
    name: 'Sounding Rocket',
    description: 'Opens the space programme.',
    cost: { gold: 200, techPoints: 50 },
    turns: 3,
    oneTimeReward: { dip: 10 },
    recurringReward: {}
  },
  {
    id: 'first_satellite',
    order: 1,
    name: 'First Satellite',
    description: 'The Sputnik moment — prestige and diplomacy points, seen by the whole world.',
    cost: { gold: 400, techPoints: 100 },
    turns: 4,
    oneTimeReward: { dip: 30 },
    recurringReward: {}
  },
  {
    id: 'crewed_orbit',
    order: 2,
    name: 'Crewed Orbit',
    description: 'Prestige, and a crew programme for every mission after this one.',
    cost: { gold: 600, techPoints: 150 },
    turns: 5,
    oneTimeReward: { dip: 20 },
    recurringReward: {}
  },
  {
    id: 'moon_landing',
    order: 3,
    name: 'Moon Landing',
    description: 'Major one-off prestige, plus a permanent diplomacy income.',
    cost: { gold: 1000, techPoints: 250 },
    turns: 6,
    oneTimeReward: { dip: 100 },
    recurringReward: { dipPerTurn: 10 }
  },
  {
    id: 'space_station',
    order: 4,
    name: 'Space Station',
    description: 'A permanent research bonus and a staging point for deeper missions.',
    cost: { gold: 1200, techPoints: 300 },
    turns: 6,
    oneTimeReward: {},
    recurringReward: { techPointsPerTurn: 15 }
  },
  {
    id: 'asteroid_mining',
    order: 5,
    name: 'Asteroid Mining',
    description: 'Rare Metals income — breaks Earth\'s resource scarcity.',
    cost: { gold: 1500, techPoints: 400 },
    turns: 7,
    oneTimeReward: {},
    recurringReward: { rareMetalsPerTurn: 20 }
  },
  {
    id: 'mars_colony',
    order: 6,
    name: 'Mars Colony',
    description: 'A new production base and a population overflow valve.',
    cost: { gold: 2000, techPoints: 500 },
    turns: 8,
    oneTimeReward: {},
    recurringReward: { goldPerTurn: 100 }
  },
  {
    id: 'outer_planets',
    order: 7,
    name: 'Outer Planets',
    description: 'Helium-3 for fusion-era units and power.',
    cost: { gold: 2500, techPoints: 600 },
    turns: 8,
    oneTimeReward: {},
    recurringReward: { helium3PerTurn: 15 }
  },
  {
    id: 'interstellar_probe',
    order: 8,
    name: 'Interstellar Probe',
    description: 'Endgame prestige — completes the ladder and claims Space Ascendancy.',
    cost: { gold: 3000, techPoints: 800 },
    turns: 10,
    oneTimeReward: { dip: 200 },
    recurringReward: {}
  }
];

export const SPACE_MISSIONS_BY_ID = Object.fromEntries(SPACE_MISSIONS.map(m => [m.id, m]));
export const FINAL_SPACE_MISSION_ID = SPACE_MISSIONS[SPACE_MISSIONS.length - 1].id;

// True if `missionId` can be launched right now: it exists, isn't already completed or in
// progress, and (unless it's the first rung) the mission immediately before it is complete.
export const canLaunchMission = (missionId, completedMissions, missionProgress) => {
  const mission = SPACE_MISSIONS_BY_ID[missionId];
  if (!mission) return false;
  if (completedMissions.includes(missionId)) return false;
  if (missionProgress[missionId] !== undefined) return false;
  if (mission.order === 0) return true;
  return completedMissions.includes(SPACE_MISSIONS[mission.order - 1].id);
};
