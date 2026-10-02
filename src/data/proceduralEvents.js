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
// Every template names the CITY it happens to (plans/civ-map-rework.md C9.1): `candidates(state)`
// lists the player's cities whose facts fit (a river city for a flood, a coastal one for trade,
// a starving one, a frontier one, one with a foreign majority), one is drawn with the turn's rng,
// and the event carries `cityId` and `tile` so the sheet names the place and the city-targeted
// effects (applyEventEffects.js: cityUnrest, cityFood, citySize, cityLoyalty) land there. A
// template with no `candidates` (a general at court, a pretender) keeps a plain isEligible gate.
import { getTiles } from './geo/tiles';
import { CLIMATE_RESILIENCE_THRESHOLD } from './actionCosts';

const mine = (state) => Object.values(state.regions || {}).filter((c) => c.owner === state.playerNationId && c.tile != null && !c.outpost).sort((a, b) => (a.id < b.id ? -1 : 1));
const facts = (c) => { const t = getTiles(); return { river: !!t.rivers[c.tile], coastal: t.coastal[c.tile] === 1, lat: t.latLonOf(c.tile).lat }; };
// A city whose land touches land nobody or someone else owns.
const frontier = (state, c) => { const t = getTiles(); const owner = state.world?.tileOwner || {}; return (c.tiles || [c.tile]).some((x) => t.neighbors[x].some((n) => t.land[n] === 1 && (owner[n] == null || state.regions[owner[n]]?.owner !== c.owner))); };
const foreignMajority = (c) => { const cu = c.culture || {}; const own = cu[c.owner] || 0; return Object.entries(cu).some(([id, v]) => id !== c.owner && v > own); };
const starving = (c) => (c.lastYields?.food ?? 0) < 0;
const unprepared = (c) => (c.climateResilience || 0) < CLIMATE_RESILIENCE_THRESHOLD;

const PROCEDURAL_TEMPLATES = [
  {
    id: 'coastal_trade_boom',
    weight: 10,
    candidates: (state) => mine(state).filter((c) => facts(c).coastal && (c.control || 0) >= 60),
    build: (state, rng, city) => ({
      title: 'A Coastal Boom',
      description: `${city.name} grows rich on trade, its harbours crowded with foreign ships eager to do business.`,
      options: [
        { label: 'Tax the merchants heavily', effects: { gold: 120 } },
        { label: 'Keep tariffs low to keep them coming back', effects: { gold: 50, dip: 10 } }
      ]
    })
  },
  {
    id: 'overcrowded_plague',
    weight: 8,
    candidates: (state) => mine(state).filter((c) => (c.currentInfrastructure || 0) >= 3 || (c.size || 1) >= 5),
    build: (state, rng, city) => ({
      title: 'Plague in the Streets',
      description: `Disease breaks out in overcrowded ${city.name}, spreading fastest through its densest quarters.`,
      options: [
        { label: 'Quarantine the afflicted districts', effects: { hr: -30, cityUnrest: 5, controlBonus: 5 } },
        { label: 'Let it run its course', effects: { hr: -60, citySize: -1 } }
      ]
    })
  },
  {
    id: 'frontier_raiders',
    weight: 10,
    candidates: (state) => mine(state).filter((c) => (c.defenseLevel || 0) < 3 && frontier(state, c)),
    build: (state, rng, city) => ({
      title: 'Raiders on the Frontier',
      description: `Raiders strike the open country around ${city.name}, making off with livestock and grain before your garrisons can respond.`,
      options: [
        // A punitive expedition can cross into disputed ground and escalate — the seed of the
        // border dispute chain (src/data/eventChains.js's border_dispute_1).
        { label: 'Muster a punitive expedition', effects: { gold: -60, militaryStrengthBonus: 40, spawnFollowUp: { id: 'border_dispute_1', delayTurns: 4 } } },
        { label: 'Reinforce the border after the fact', effects: { gold: -100, defenseBonus: 0.05, cityFood: -10 } }
      ]
    })
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
          { label: 'Reward their loyalty publicly', effects: { gold: -100, dip: 10 } },
          { label: 'Quietly reassign them to a distant post', effects: { gold: -30, controlPenalty: 5 } }
        ]
      };
    }
  },
  {
    id: 'failed_harvest',
    weight: 10,
    // Gated off once Build Climate Resilience (Modern age) has raised the city past the threshold.
    // A starving city is the likeliest place for it.
    candidates: (state) => { const all = mine(state).filter(unprepared); const hungry = all.filter(starving); return hungry.length ? hungry : all; },
    build: (state, rng, city) => ({
      title: 'Failed Harvest',
      description: `Poor weather ruins the harvest around ${city.name}, and granaries that should be full stand nearly empty heading into the lean months.`,
      options: [
        { label: 'Import food at whatever price it takes', effects: { gold: -100, cityFood: 10 } },
        { label: 'Ration what remains', effects: { cityFood: -10, cityUnrest: 5 } }
      ]
    })
  },
  {
    id: 'river_flood',
    weight: 8,
    candidates: (state) => mine(state).filter((c) => facts(c).river && unprepared(c)),
    build: (state, rng, city) => ({
      title: 'The River Rises',
      description: `The river bursts its banks at ${city.name}; the low fields are under water and the granary is wet through.`,
      options: [
        { label: 'Raise levees and drain the fields', effects: { gold: -80, cityFood: -5 } },
        { label: 'Let the waters recede on their own', effects: { cityFood: -15, cityUnrest: 5 } }
      ]
    })
  },
  {
    id: 'foreign_quarter',
    weight: 7,
    candidates: (state) => mine(state).filter(foreignMajority),
    build: (state, rng, city) => ({
      title: 'A Foreign Quarter',
      description: `Most of ${city.name} speaks another tongue and keeps another law; its elders ask who really rules them.`,
      options: [
        { label: 'Grant them their customs and a seat in council', effects: { cityLoyalty: 15, dip: -5 } },
        { label: 'Garrison the quarter and tax it', effects: { gold: 60, cityLoyalty: -10, cityUnrest: 5 } }
      ]
    })
  },
  {
    id: 'throne_pretender',
    weight: 5,
    candidates: (state) => mine(state).filter((c) => (c.unrest || 0) >= 30),
    build: (state, rng, city) => ({
      title: 'A Rival Claims Your Throne',
      description: `Discontent in ${city.name} has emboldened a pretender, who now claims a rightful place at the head of the state.`,
      options: [
        { label: 'Move against them decisively', effects: { gold: -80, cityUnrest: -10, controlBonus: 10 } },
        { label: 'Buy their loyalty with a title and lands', effects: { gold: -150, controlPenalty: 5 } }
      ]
    })
  },
  {
    id: 'traveling_merchants',
    weight: 12,
    candidates: (state) => mine(state),
    build: (state, rng, city) => ({
      title: 'Traveling Merchants',
      description: `A caravan of traveling merchants passes through ${city.name}, offering rare goods — and rarer opportunities — to whoever can afford them.`,
      options: [
        { label: 'Buy up their entire stock', effects: { gold: -80, hr: 30 } },
        { label: 'Trade only what you need', effects: { gold: 40 } }
      ]
    })
  },
  {
    id: 'refugee_crisis',
    weight: 9,
    // Post-war or post-disaster: any war in the world, or a badly unsettled city of yours; the
    // refugees arrive at a frontier city when there is one.
    candidates: (state) => {
      const all = mine(state);
      const unsettled = all.filter((c) => (c.unrest || 0) >= 40);
      if (!(state.wars || []).some((w) => w.active) && !unsettled.length) return [];
      const border = all.filter((c) => frontier(state, c));
      return unsettled.length ? unsettled : border.length ? border : all;
    },
    build: (state, rng, city) => ({
      title: 'Refugees at the Border',
      description: `Waves of refugees, fleeing war and hardship beyond your borders, arrive at ${city.name} seeking shelter.`,
      options: [
        { label: 'Take them in and put them to work', effects: { hr: 40, citySize: 1, cityUnrest: 10 } },
        { label: 'Turn them away and seal the border', effects: { gold: -80, controlBonus: 3 } }
      ]
    })
  },
  {
    id: 'harsh_winter',
    weight: 8,
    candidates: (state) => { const all = mine(state).filter(unprepared); const north = all.filter((c) => Math.abs(facts(c).lat) >= 40); return north.length ? north : all; },
    build: (state, rng, city) => ({
      title: 'A Harsh Winter',
      description: `An unusually harsh winter settles over ${city.name}, straining stores of food and fuel alike.`,
      options: [
        { label: 'Open the granaries to everyone', effects: { cityFood: -10, gold: -60 } },
        { label: 'Ration carefully and wait it out', effects: { cityFood: -5, cityUnrest: 5 } }
      ]
    })
  }
];

// Picks one procedural event to fire this turn, or null if none of the templates are currently
// eligible. Weighted random selection among eligible templates, using the caller's seeded rng so
// turn resolution stays deterministic.
export const pickProceduralEvent = (state, rng) => {
  const eligible = PROCEDURAL_TEMPLATES.map((t) => ({ t, cities: t.candidates ? t.candidates(state) : null })).filter(({ t, cities }) => (cities ? cities.length > 0 : t.isEligible(state)));
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, e) => sum + e.t.weight, 0);
  let roll = rng.next() * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const e of eligible) {
    if (roll < e.t.weight) { chosen = e; break; }
    roll -= e.t.weight;
  }
  const city = chosen.cities ? chosen.cities[Math.floor(rng.next() * chosen.cities.length)] : null;
  const built = chosen.t.build(state, rng, city);
  return {
    id: `procedural_${chosen.t.id}_${state.turnNumber}`,
    year: state.year,
    mandatory: false,
    procedural: true,
    ...(city ? { cityId: city.id, tile: city.tile } : {}),
    ...built
  };
};
