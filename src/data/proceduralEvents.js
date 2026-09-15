// src/data/proceduralEvents.js
// Procedural late-game events. HISTORICAL_EVENTS (src/data/events.js) gets sparser the further
// into the future it goes — real gaps of 10-15 years between scripted events past 2050 — which
// left the back half of the timeline feeling empty between them. These templates fill those gaps
// with randomized, state-aware events that can recur (unlike scripted events, which fire once),
// reusing the exact same options/effects shape so no new UI or resolution code was needed for
// them — see applyEventEffects.js and EventModal.jsx, neither of which know these are procedural.

import { GamePhases } from './types';

const pickRandom = (arr, rng) => arr[Math.floor(rng.next() * arr.length)];

const nonPlayerNations = (nations, filter) =>
  Object.values(nations).filter(n => !n.isPlayer && filter(n));

const PROCEDURAL_TEMPLATES = [
  {
    id: 'border_skirmish',
    weight: 3,
    isEligible: (state) => nonPlayerNations(state.nations, n => !n.isAtWar && n.hostility >= 30).length > 0,
    build: (state, rng) => {
      const nation = pickRandom(nonPlayerNations(state.nations, n => !n.isAtWar && n.hostility >= 30), rng);
      return {
        title: `Border Skirmish with ${nation.name}`,
        description: `Shots are exchanged along the frontier with ${nation.name}. Both sides posture for advantage without yet tipping into open war.`,
        options: [
          { label: 'Reinforce the border', effects: { militaryBonus: 300, nationHostility: { [nation.id]: 5 } } },
          { label: 'De-escalate through back channels', effects: { diplomacyPoints: -15, nationHostility: { [nation.id]: -8 } } }
        ]
      };
    }
  },
  {
    id: 'trade_delegation',
    weight: 3,
    isEligible: (state) => nonPlayerNations(state.nations, n => n.hostility < 60).length > 0,
    build: (state, rng) => {
      const nation = pickRandom(nonPlayerNations(state.nations, n => n.hostility < 60), rng);
      return {
        title: `Trade Delegation from ${nation.name}`,
        description: `${nation.name} sends a delegation proposing expanded commercial ties.`,
        options: [
          { label: 'Expand trade ties', effects: { money: 20000, nationHostility: { [nation.id]: -3 } } },
          { label: 'Politely decline', effects: { diplomacyPoints: 5 } }
        ]
      };
    }
  },
  {
    id: 'tech_grant',
    weight: 2,
    isEligible: () => true,
    build: () => ({
      title: 'Research Grant Proposal',
      description: 'A consortium of universities and startups pitches a joint research initiative.',
      options: [
        { label: 'Fund the research team', effects: { money: -30000, techPoints: 40 } },
        { label: 'Redirect funds elsewhere', effects: { money: 15000 } }
      ]
    })
  },
  {
    id: 'refugee_crisis',
    weight: 2,
    isEligible: () => true,
    build: () => ({
      title: 'Refugee Crisis',
      description: 'Regional instability sends a wave of refugees toward the border, straining services but offering new manpower.',
      options: [
        { label: 'Open the borders', effects: { manpower: 600, controlBonus: -2 } },
        { label: 'Restrict entry', effects: { diplomacyPoints: -10, controlBonus: 2 } }
      ]
    })
  },
  {
    id: 'diplomatic_summit',
    weight: 2,
    isEligible: (state) => nonPlayerNations(state.nations, n => n.hostility < 40).length > 0,
    build: (state, rng) => {
      const nation = pickRandom(nonPlayerNations(state.nations, n => n.hostility < 40), rng);
      return {
        title: 'International Diplomatic Summit',
        description: `A multilateral summit convenes, with ${nation.name} among the attendees seeking closer ties.`,
        options: [
          { label: 'Champion multilateral cooperation', effects: { diplomacyPoints: 25, nationHostility: { [nation.id]: -5 } } },
          { label: 'Focus on bilateral gains', effects: { money: 10000 } }
        ]
      };
    }
  },
  {
    id: 'espionage_scare',
    weight: 2,
    isEligible: (state) => nonPlayerNations(state.nations, n => n.isAtWar || n.hostility >= 70).length > 0,
    build: (state, rng) => {
      const nation = pickRandom(nonPlayerNations(state.nations, n => n.isAtWar || n.hostility >= 70), rng);
      return {
        title: 'Espionage Scare',
        description: `Counterintelligence uncovers a suspected ${nation.name}-linked network operating domestically.`,
        options: [
          { label: 'Purge the network', effects: { defenseBonus: 0.03, money: -10000 } },
          { label: 'Monitor quietly', effects: { techPoints: 10 } }
        ]
      };
    }
  }
];

// Picks one procedural event to fire this turn, or null if none of the templates are currently
// eligible (e.g. every nation is already at peace and un-hostile). Weighted random selection
// among eligible templates, using the caller's seeded rng so turn resolution stays deterministic.
export const pickProceduralEvent = (state, rng) => {
  const eligible = PROCEDURAL_TEMPLATES.filter(t => t.isEligible(state));
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng.next() * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const template of eligible) {
    if (roll < template.weight) { chosen = template; break; }
    roll -= template.weight;
  }

  const built = chosen.build(state, rng);
  return {
    id: `procedural_${chosen.id}_${state.turnNumber}`,
    year: state.year,
    phase: GamePhases.POST_STATE,
    mandatory: false,
    procedural: true,
    ...built
  };
};
