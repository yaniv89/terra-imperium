// src/data/regions.js
// All region definitions for the Middle East map

import { RegionTypes } from './types';

export const REGIONS_DATA = {
  // ============ ISRAEL CORE REGIONS ============
  tel_aviv: {
    id: 'tel_aviv',
    name: 'Tel Aviv',
    type: RegionTypes.CORE,
    startOwner: 'player',
    startControl: 30,
    population: 50000,
    infrastructure: 3,
    strategicValue: 8,
    terrain: 'coastal',
    resources: { money: 500, manpower: 100 },
    fortification: 1,
    neighbors: ['haifa', 'jerusalem', 'west_bank', 'gaza'],
    description: 'Economic hub and largest city'
  },
  jerusalem: {
    id: 'jerusalem',
    name: 'Jerusalem',
    type: RegionTypes.CORE,
    startOwner: 'player',
    startControl: 25,
    population: 80000,
    infrastructure: 2,
    strategicValue: 10,
    terrain: 'hills',
    resources: { money: 300, manpower: 150 },
    fortification: 2,
    neighbors: ['tel_aviv', 'west_bank', 'negev'],
    description: 'Holy city and capital'
  },
  haifa: {
    id: 'haifa',
    name: 'Haifa',
    type: RegionTypes.CORE,
    startOwner: 'player',
    startControl: 20,
    population: 30000,
    infrastructure: 4,
    strategicValue: 7,
    terrain: 'port',
    resources: { money: 400, manpower: 80 },
    fortification: 1,
    neighbors: ['tel_aviv', 'galilee'],
    description: 'Major port city'
  },
  galilee: {
    id: 'galilee',
    name: 'Galilee',
    type: RegionTypes.CORE,
    startOwner: 'player',
    startControl: 15,
    population: 20000,
    infrastructure: 1,
    strategicValue: 6,
    terrain: 'hills',
    resources: { money: 200, manpower: 120 },
    fortification: 1,
    neighbors: ['haifa', 'golan', 'lebanon_south'],
    description: 'Northern agricultural region'
  },
  negev: {
    id: 'negev',
    name: 'Negev',
    type: RegionTypes.CORE,
    startOwner: 'player',
    startControl: 10,
    population: 5000,
    infrastructure: 0,
    strategicValue: 5,
    terrain: 'desert',
    resources: { money: 100, manpower: 30 },
    fortification: 0,
    neighbors: ['jerusalem', 'gaza', 'egypt_sinai', 'jordan_amman'],
    description: 'Southern desert region'
  },

  // ============ CONTESTED REGIONS ============
  gaza: {
    id: 'gaza',
    name: 'Gaza',
    type: RegionTypes.CONTESTED,
    startOwner: 'egypt',
    startControl: 0,
    population: 80000,
    infrastructure: 2,
    strategicValue: 4,
    terrain: 'coastal',
    resources: { money: 150, manpower: 200 },
    fortification: 2,
    neighbors: ['tel_aviv', 'negev', 'egypt_sinai'],
    description: 'Densely populated coastal strip'
  },
  west_bank: {
    id: 'west_bank',
    name: 'West Bank',
    type: RegionTypes.CONTESTED,
    startOwner: 'jordan',
    startControl: 0,
    population: 100000,
    infrastructure: 1,
    strategicValue: 7,
    terrain: 'hills',
    resources: { money: 200, manpower: 250 },
    fortification: 1,
    neighbors: ['tel_aviv', 'jerusalem', 'jordan_amman'],
    description: 'Strategic highland territory'
  },
  golan: {
    id: 'golan',
    name: 'Golan Heights',
    type: RegionTypes.CONTESTED,
    startOwner: 'syria',
    startControl: 0,
    population: 15000,
    infrastructure: 1,
    strategicValue: 9,
    terrain: 'highlands',
    resources: { money: 100, manpower: 50 },
    fortification: 3,
    neighbors: ['galilee', 'syria_damascus', 'lebanon_south'],
    description: 'Strategic high ground'
  },

  // ============ EGYPT ============
  egypt_sinai: {
    id: 'egypt_sinai',
    name: 'Sinai',
    type: RegionTypes.CAPTURABLE,
    startOwner: 'egypt',
    startControl: 0,
    population: 30000,
    infrastructure: 1,
    strategicValue: 6,
    terrain: 'desert',
    resources: { money: 200, manpower: 100 },
    fortification: 2,
    neighbors: ['negev', 'gaza', 'egypt_cairo'],
    description: 'Buffer peninsula'
  },
  egypt_cairo: {
    id: 'egypt_cairo',
    name: 'Cairo',
    type: RegionTypes.FOREIGN,
    startOwner: 'egypt',
    startControl: 0,
    population: 500000,
    infrastructure: 5,
    strategicValue: 10,
    terrain: 'urban',
    resources: { money: 1000, manpower: 500 },
    fortification: 4,
    isCapital: true,
    neighbors: ['egypt_sinai'],
    description: 'Egyptian capital'
  },

  // ============ JORDAN ============
  jordan_amman: {
    id: 'jordan_amman',
    name: 'Amman',
    type: RegionTypes.FOREIGN,
    startOwner: 'jordan',
    startControl: 0,
    population: 100000,
    infrastructure: 3,
    strategicValue: 7,
    terrain: 'urban',
    resources: { money: 400, manpower: 200 },
    fortification: 3,
    isCapital: true,
    neighbors: ['west_bank', 'negev', 'saudi_north', 'iraq_baghdad'],
    description: 'Jordanian capital'
  },

  // ============ SYRIA ============
  syria_damascus: {
    id: 'syria_damascus',
    name: 'Damascus',
    type: RegionTypes.FOREIGN,
    startOwner: 'syria',
    startControl: 0,
    population: 300000,
    infrastructure: 4,
    strategicValue: 9,
    terrain: 'urban',
    resources: { money: 600, manpower: 400 },
    fortification: 4,
    isCapital: true,
    neighbors: ['golan', 'lebanon_north', 'lebanon_south', 'iraq_baghdad', 'turkey_east'],
    description: 'Syrian capital'
  },

  // ============ LEBANON ============
  lebanon_south: {
    id: 'lebanon_south',
    name: 'S. Lebanon',
    type: RegionTypes.CAPTURABLE,
    startOwner: 'lebanon',
    startControl: 0,
    population: 50000,
    infrastructure: 2,
    strategicValue: 5,
    terrain: 'hills',
    resources: { money: 150, manpower: 100 },
    fortification: 1,
    neighbors: ['galilee', 'golan', 'lebanon_north', 'syria_damascus'],
    description: 'Southern buffer zone'
  },
  lebanon_north: {
    id: 'lebanon_north',
    name: 'Beirut',
    type: RegionTypes.FOREIGN,
    startOwner: 'lebanon',
    startControl: 0,
    population: 200000,
    infrastructure: 5,
    strategicValue: 6,
    terrain: 'coastal',
    resources: { money: 500, manpower: 150 },
    fortification: 2,
    isCapital: true,
    neighbors: ['lebanon_south', 'syria_damascus'],
    description: 'Lebanese capital'
  },

  // ============ IRAQ ============
  iraq_baghdad: {
    id: 'iraq_baghdad',
    name: 'Baghdad',
    type: RegionTypes.FOREIGN,
    startOwner: 'iraq',
    startControl: 0,
    population: 400000,
    infrastructure: 4,
    strategicValue: 8,
    terrain: 'urban',
    resources: { money: 900, manpower: 500 },
    fortification: 4,
    isCapital: true,
    neighbors: ['jordan_amman', 'syria_damascus', 'iraq_basra', 'saudi_north', 'iran_west', 'turkey_east', 'kuwait'],
    description: 'Iraqi capital'
  },
  iraq_basra: {
    id: 'iraq_basra',
    name: 'Basra',
    type: RegionTypes.FOREIGN,
    startOwner: 'iraq',
    startControl: 0,
    population: 150000,
    infrastructure: 3,
    strategicValue: 5,
    terrain: 'port',
    resources: { money: 600, manpower: 200 },
    fortification: 2,
    neighbors: ['iraq_baghdad', 'kuwait', 'iran_west'],
    description: 'Southern port city'
  },

  // ============ SAUDI ARABIA ============
  saudi_north: {
    id: 'saudi_north',
    name: 'N. Saudi',
    type: RegionTypes.FOREIGN,
    startOwner: 'saudi',
    startControl: 0,
    population: 100000,
    infrastructure: 2,
    strategicValue: 4,
    terrain: 'desert',
    resources: { money: 800, manpower: 150 },
    fortification: 2,
    neighbors: ['jordan_amman', 'iraq_baghdad', 'kuwait', 'saudi_south'],
    description: 'Northern desert'
  },
  saudi_south: {
    id: 'saudi_south',
    name: 'Riyadh',
    type: RegionTypes.FOREIGN,
    startOwner: 'saudi',
    startControl: 0,
    population: 200000,
    infrastructure: 4,
    strategicValue: 8,
    terrain: 'desert',
    resources: { money: 2000, manpower: 300 },
    fortification: 4,
    isCapital: true,
    neighbors: ['saudi_north', 'uae', 'qatar', 'bahrain', 'yemen', 'oman'],
    description: 'Saudi capital'
  },

  // ============ IRAN ============
  iran_west: {
    id: 'iran_west',
    name: 'W. Iran',
    type: RegionTypes.FOREIGN,
    startOwner: 'iran',
    startControl: 0,
    population: 300000,
    infrastructure: 3,
    strategicValue: 6,
    terrain: 'mountains',
    resources: { money: 700, manpower: 400 },
    fortification: 4,
    neighbors: ['iraq_baghdad', 'iraq_basra', 'iran_east', 'turkey_east'],
    description: 'Western provinces'
  },
  iran_east: {
    id: 'iran_east',
    name: 'Tehran',
    type: RegionTypes.FOREIGN,
    startOwner: 'iran',
    startControl: 0,
    population: 800000,
    infrastructure: 5,
    strategicValue: 9,
    terrain: 'urban',
    resources: { money: 1200, manpower: 600 },
    fortification: 5,
    isCapital: true,
    neighbors: ['iran_west'],
    description: 'Iranian capital'
  },

  // ============ TURKEY ============
  turkey_west: {
    id: 'turkey_west',
    name: 'W. Turkey',
    type: RegionTypes.FOREIGN,
    startOwner: 'turkey',
    startControl: 0,
    population: 1000000,
    infrastructure: 6,
    strategicValue: 7,
    terrain: 'mixed',
    resources: { money: 1500, manpower: 800 },
    fortification: 5,
    neighbors: ['turkey_east'],
    description: 'Western Anatolia'
  },
  turkey_east: {
    id: 'turkey_east',
    name: 'Ankara',
    type: RegionTypes.FOREIGN,
    startOwner: 'turkey',
    startControl: 0,
    population: 500000,
    infrastructure: 5,
    strategicValue: 8,
    terrain: 'urban',
    resources: { money: 1000, manpower: 500 },
    fortification: 5,
    isCapital: true,
    neighbors: ['turkey_west', 'syria_damascus', 'iraq_baghdad', 'iran_west'],
    description: 'Turkish capital'
  },

  // ============ GULF STATES ============
  yemen: {
    id: 'yemen',
    name: 'Yemen',
    type: RegionTypes.FOREIGN,
    startOwner: 'yemen',
    startControl: 0,
    population: 200000,
    infrastructure: 1,
    strategicValue: 3,
    terrain: 'mountains',
    resources: { money: 200, manpower: 300 },
    fortification: 2,
    isCapital: true,
    neighbors: ['saudi_south', 'oman'],
    description: 'Southern Arabian state'
  },
  oman: {
    id: 'oman',
    name: 'Oman',
    type: RegionTypes.FOREIGN,
    startOwner: 'oman',
    startControl: 0,
    population: 100000,
    infrastructure: 2,
    strategicValue: 4,
    terrain: 'coastal',
    resources: { money: 400, manpower: 100 },
    fortification: 2,
    isCapital: true,
    neighbors: ['saudi_south', 'uae', 'yemen'],
    description: 'Sultanate of Oman'
  },
  uae: {
    id: 'uae',
    name: 'UAE',
    type: RegionTypes.FOREIGN,
    startOwner: 'uae',
    startControl: 0,
    population: 50000,
    infrastructure: 3,
    strategicValue: 5,
    terrain: 'desert',
    resources: { money: 1000, manpower: 50 },
    fortification: 2,
    isCapital: true,
    neighbors: ['saudi_south', 'oman', 'qatar'],
    description: 'United Arab Emirates'
  },
  qatar: {
    id: 'qatar',
    name: 'Qatar',
    type: RegionTypes.FOREIGN,
    startOwner: 'qatar',
    startControl: 0,
    population: 30000,
    infrastructure: 3,
    strategicValue: 4,
    terrain: 'desert',
    resources: { money: 800, manpower: 30 },
    fortification: 1,
    isCapital: true,
    neighbors: ['saudi_south', 'uae'],
    description: 'Qatari peninsula'
  },
  bahrain: {
    id: 'bahrain',
    name: 'Bahrain',
    type: RegionTypes.FOREIGN,
    startOwner: 'bahrain',
    startControl: 0,
    population: 40000,
    infrastructure: 3,
    strategicValue: 3,
    terrain: 'island',
    resources: { money: 500, manpower: 40 },
    fortification: 1,
    isCapital: true,
    neighbors: ['saudi_south'],
    description: 'Island kingdom'
  },
  kuwait: {
    id: 'kuwait',
    name: 'Kuwait',
    type: RegionTypes.FOREIGN,
    startOwner: 'kuwait',
    startControl: 0,
    population: 80000,
    infrastructure: 4,
    strategicValue: 5,
    terrain: 'desert',
    resources: { money: 1200, manpower: 60 },
    fortification: 2,
    isCapital: true,
    neighbors: ['saudi_north', 'iraq_baghdad', 'iraq_basra'],
    description: 'Oil-rich emirate'
  }
};

// Adjacency is authored one-directional above for readability; symmetrize it here so a region
// always lists every neighbor that lists it back, regardless of which side was written.
Object.entries(REGIONS_DATA).forEach(([id, data]) => {
  (data.neighbors || []).forEach(neighborId => {
    const neighbor = REGIONS_DATA[neighborId];
    if (neighbor && !neighbor.neighbors.includes(id)) {
      neighbor.neighbors.push(id);
    }
  });
});

// Israeli core region IDs for easy reference
export const CORE_REGION_IDS = ['tel_aviv', 'jerusalem', 'haifa', 'galilee', 'negev'];

// Get core control percentage
export const getCoreControlAverage = (regions) => {
  const coreRegions = CORE_REGION_IDS.map(id => regions[id]).filter(Boolean);
  if (coreRegions.length === 0) return 0;
  const total = coreRegions.reduce((sum, r) => sum + (r.control || 0), 0);
  return Math.round(total / coreRegions.length);
};

// ============ ADJACENCY ============

export const getNeighborIds = (regionId) => REGIONS_DATA[regionId]?.neighbors || [];

// True if `regionId` shares a border with any region the given owner (usually 'player') holds.
export const isAdjacentToOwner = (regionId, regions, ownerId) => {
  return getNeighborIds(regionId).some(nId => regions[nId]?.owner === ownerId);
};
