// src/data/nations.js
// All nation definitions

import { RelationStatus } from './types';

export const NATIONS_DATA = {
  player: {
    id: 'player',
    name: 'Israel',
    color: '#3B82F6',
    isPlayer: true
  },
  egypt: {
    id: 'egypt',
    name: 'Egypt',
    color: '#10B981',
    startHostility: 75,
    startMilitary: 15000,
    aggression: 0.7,
    startRelation: RelationStatus.HOSTILE,
    regions: ['egypt_cairo', 'egypt_sinai', 'gaza'],
    aiPriority: ['military', 'economy']
  },
  jordan: {
    id: 'jordan',
    name: 'Jordan',
    color: '#EF4444',
    startHostility: 60,
    startMilitary: 5000,
    aggression: 0.5,
    startRelation: RelationStatus.HOSTILE,
    regions: ['jordan_amman', 'west_bank'],
    aiPriority: ['defense', 'diplomacy']
  },
  syria: {
    id: 'syria',
    name: 'Syria',
    color: '#F59E0B',
    startHostility: 85,
    startMilitary: 8000,
    aggression: 0.8,
    startRelation: RelationStatus.HOSTILE,
    regions: ['syria_damascus', 'golan'],
    aiPriority: ['military', 'military']
  },
  lebanon: {
    id: 'lebanon',
    name: 'Lebanon',
    color: '#EC4899',
    startHostility: 40,
    startMilitary: 3000,
    aggression: 0.3,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['lebanon_north', 'lebanon_south'],
    aiPriority: ['economy', 'diplomacy']
  },
  iraq: {
    id: 'iraq',
    name: 'Iraq',
    color: '#8B5CF6',
    startHostility: 80,
    startMilitary: 10000,
    aggression: 0.6,
    startRelation: RelationStatus.HOSTILE,
    regions: ['iraq_baghdad', 'iraq_basra'],
    aiPriority: ['military', 'economy']
  },
  saudi: {
    id: 'saudi',
    name: 'Saudi Arabia',
    color: '#059669',
    startHostility: 70,
    startMilitary: 12000,
    aggression: 0.4,
    startRelation: RelationStatus.HOSTILE,
    regions: ['saudi_north', 'saudi_south'],
    aiPriority: ['economy', 'defense']
  },
  iran: {
    id: 'iran',
    name: 'Iran',
    color: '#7C3AED',
    startHostility: 30,
    startMilitary: 20000,
    aggression: 0.3,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['iran_west', 'iran_east'],
    aiPriority: ['military', 'military']
  },
  turkey: {
    id: 'turkey',
    name: 'Turkey',
    color: '#DC2626',
    startHostility: 25,
    startMilitary: 25000,
    aggression: 0.2,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['turkey_west', 'turkey_east'],
    aiPriority: ['economy', 'diplomacy']
  },
  yemen: {
    id: 'yemen',
    name: 'Yemen',
    color: '#78716C',
    startHostility: 55,
    startMilitary: 4000,
    aggression: 0.4,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['yemen'],
    aiPriority: ['defense', 'military']
  },
  oman: {
    id: 'oman',
    name: 'Oman',
    color: '#84CC16',
    startHostility: 35,
    startMilitary: 2000,
    aggression: 0.2,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['oman'],
    aiPriority: ['economy', 'diplomacy']
  },
  uae: {
    id: 'uae',
    name: 'UAE',
    color: '#0EA5E9',
    startHostility: 50,
    startMilitary: 3000,
    aggression: 0.2,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['uae'],
    aiPriority: ['economy', 'economy']
  },
  qatar: {
    id: 'qatar',
    name: 'Qatar',
    color: '#6366F1',
    startHostility: 45,
    startMilitary: 1000,
    aggression: 0.2,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['qatar'],
    aiPriority: ['economy', 'diplomacy']
  },
  bahrain: {
    id: 'bahrain',
    name: 'Bahrain',
    color: '#F472B6',
    startHostility: 40,
    startMilitary: 800,
    aggression: 0.2,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['bahrain'],
    aiPriority: ['economy', 'diplomacy']
  },
  kuwait: {
    id: 'kuwait',
    name: 'Kuwait',
    color: '#14B8A6',
    startHostility: 50,
    startMilitary: 2000,
    aggression: 0.2,
    startRelation: RelationStatus.NEUTRAL,
    regions: ['kuwait'],
    aiPriority: ['economy', 'defense']
  },
  hamas: {
    id: 'hamas',
    name: 'Hamas',
    color: '#166534',
    startHostility: 90,
    startMilitary: 6000,
    aggression: 0.9,
    startRelation: RelationStatus.HOSTILE,
    regions: [],
    aiPriority: ['military', 'military']
  }
};

// Nations that attack during independence war
export const INDEPENDENCE_WAR_ATTACKERS = ['egypt', 'jordan', 'syria', 'lebanon', 'iraq'];

// Get relation color based on status
export const getRelationColor = (status) => {
  const colors = {
    [RelationStatus.WAR]: '#ef4444',
    [RelationStatus.HOSTILE]: '#f97316',
    [RelationStatus.COLD_PEACE]: '#eab308',
    [RelationStatus.NEUTRAL]: '#94a3b8',
    [RelationStatus.FRIENDLY]: '#22c55e',
    [RelationStatus.ALLIED]: '#3b82f6'
  };
  return colors[status] || '#94a3b8';
};
