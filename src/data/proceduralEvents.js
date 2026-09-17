// src/data/proceduralEvents.js
// Procedural events: randomized, state-aware templates that fill the quiet turns between scripted
// events, reusing the exact same options/effects shape as HISTORICAL_EVENTS so no new UI or
// resolution code is needed for them — see applyEventEffects.js and EventModal.jsx, neither of
// which know these are procedural.
//
// This is Phase D3 Layers 2 and 5 (plan §9.5) in one mechanism, not two: "situational" events
// (triggered by your own state — a rich coastal region, an overcrowded city, an ambitious
// general) and "procedural" filler for otherwise-quiet turns are the same shape in this codebase
// — a template with an isEligible(state) gate and a build(state, rng) that fills in the player's
// own region/nation/general names. Splitting them into two registries would just be the same
// content authored twice against two names for one mechanism.
//
// In this one-region-per-nation world model, "your region" is always state.regions[playerNationId]
// — there's no sub-national geography to pick from yet, so every template below refers to the
// player's single home region rather than a randomly-selected one of several.
import { REGIONS_DATA } from './regions';

const home = (state) => ({ region: state.regions[state.playerNationId], data: REGIONS_DATA[state.playerNationId] });

const PROCEDURAL_TEMPLATES = [
  {
    id: 'coastal_trade_boom',
    weight: 10,
    isEligible: (state) => {
      const { region, data } = home(state);
      return !!data?.isCoastal && (region?.control || 0) >= 60;
    },
    build: (state) => {
      const { data } = home(state);
      return {
        title: 'A Coastal Boom',
        description: `Your coastal region of ${data.name} grows rich on trade, its harbors crowded with foreign ships eager to do business.`,
        options: [
          { label: 'Tax the merchants heavily', effects: { gold: 120 } },
          { label: 'Keep tariffs low to keep them coming back', effects: { gold: 50, diplomacyPoints: 10 } }
        ]
      };
    }
  },
  {
    id: 'overcrowded_plague',
    weight: 8,
    isEligible: (state) => {
      const { region } = home(state);
      return (region?.currentInfrastructure || 0) >= 3;
    },
    build: (state) => {
      const { data } = home(state);
      return {
        title: 'Plague in the Streets',
        description: `Disease breaks out in overcrowded ${data.name}, spreading fastest through its densest, most developed quarters.`,
        options: [
          { label: 'Quarantine the afflicted districts', effects: { hr: -30, controlBonus: 5 } },
          { label: 'Let it run its course', effects: { hr: -60 } }
        ]
      };
    }
  },
  {
    id: 'frontier_raiders',
    weight: 10,
    isEligible: (state) => {
      const { region } = home(state);
      return (region?.defenseLevel || 0) < 3;
    },
    build: (state) => {
      const { data } = home(state);
      return {
        title: 'Raiders on the Frontier',
        description: `Raiders strike the undefended frontier of ${data.name}, making off with livestock and grain before your garrisons can respond.`,
        options: [
          // A punitive expedition can cross into disputed ground and escalate — the seed of the
          // border dispute chain (src/data/eventChains.js's border_dispute_1).
          { label: 'Muster a punitive expedition', effects: { gold: -60, militaryStrengthBonus: 40, spawnFollowUp: { id: 'border_dispute_1', delayTurns: 4 } } },
          { label: 'Reinforce the border after the fact', effects: { gold: -100, defenseBonus: 0.05 } }
        ]
      };
    }
  },
  {
    id: 'ambitious_general',
    weight: 6,
    isEligible: (state) => Object.keys(state.hiredCommanders || {}).length > 0,
    build: (state, rng) => {
      const generals = Object.values(state.hiredCommanders);
      const general = generals[Math.floor(rng.next() * generals.length)];
      return {
        title: 'A General Grows Ambitious',
        description: `${general.name}, flush with recent victories, begins courting favor among the officer corps — a loyal commander, or the seed of a future rival?`,
        options: [
          { label: 'Reward their loyalty publicly', effects: { gold: -100, diplomacyPoints: 10 } },
          { label: 'Quietly reassign them to a distant post', effects: { gold: -30, controlPenalty: 5 } }
        ]
      };
    }
  },
  {
    id: 'failed_harvest',
    weight: 10,
    isEligible: () => true,
    build: (state) => {
      const { data } = home(state);
      return {
        title: 'Failed Harvest',
        description: `Poor weather ruins the harvest around ${data.name}, and granaries that should be full stand nearly empty heading into the lean months.`,
        options: [
          { label: 'Import food at whatever price it takes', effects: { gold: -100, hr: 20 } },
          { label: 'Ration what remains', effects: { hr: -50, controlPenalty: 5 } }
        ]
      };
    }
  },
  {
    id: 'throne_pretender',
    weight: 5,
    isEligible: (state) => {
      const { region } = home(state);
      return (region?.unrest || 0) >= 30;
    },
    build: (state) => {
      const nation = state.nations[state.playerNationId];
      return {
        title: 'A Rival Claims Your Throne',
        description: `Discontent in ${nation.name} has emboldened a pretender, who now claims a rightful place at the head of the state.`,
        options: [
          { label: 'Move against them decisively', effects: { gold: -80, controlBonus: 10 } },
          { label: 'Buy their loyalty with a title and lands', effects: { gold: -150, controlPenalty: 5 } }
        ]
      };
    }
  },
  {
    id: 'traveling_merchants',
    weight: 12,
    isEligible: () => true,
    build: (state) => {
      const { data } = home(state);
      return {
        title: 'Traveling Merchants',
        description: `A caravan of traveling merchants passes through ${data.name}, offering rare goods — and rarer opportunities — to whoever can afford them.`,
        options: [
          { label: 'Buy up their entire stock', effects: { gold: -80, hr: 30 } },
          { label: 'Trade only what you need', effects: { gold: 40 } }
        ]
      };
    }
  },
  {
    id: 'harsh_winter',
    weight: 8,
    isEligible: () => true,
    build: (state) => {
      const { data } = home(state);
      return {
        title: 'A Harsh Winter',
        description: `An unusually harsh winter settles over ${data.name}, straining stores of food and fuel alike.`,
        options: [
          { label: 'Open the granaries to everyone', effects: { hr: 10, gold: -60 } },
          { label: 'Ration carefully and wait it out', effects: { hr: -20 } }
        ]
      };
    }
  }
];

// Picks one procedural event to fire this turn, or null if none of the templates are currently
// eligible. Weighted random selection among eligible templates, using the caller's seeded rng so
// turn resolution stays deterministic.
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
    mandatory: false,
    procedural: true,
    ...built
  };
};
