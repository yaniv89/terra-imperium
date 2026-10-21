// src/data/proceduralEvents.js
// Procedural cards of the event deck (src/engine/eventDeck.js draws them): state-aware templates
// that fill the quiet turns between story events, in the same options/effects shape as
// HISTORICAL_EVENTS (applyEventEffects.js and EventModal.jsx do not know they are procedural).
//
// A card is { id, family, weight, requires?, subjects?, build(state, rng, city) }:
//   requires   a predicate over the player's facts (src/engine/predicates.js)
//   subjects   { city: (state) => the player's cities whose facts fit } (a river city for a flood, a
//              coastal one for trade, a starving one, a frontier one, one with a foreign majority);
//              the deck draws one with the turn's rng and the event carries `cityId` and `tile` so the
//              sheet names the place and the city-targeted effects (cityUnrest, cityFood, citySize,
//              cityLoyalty) land there.
import { getTiles } from './geo/tiles';
import { CLIMATE_RESILIENCE_THRESHOLD } from './actionCosts';
import { FIRST_AGE_ID, getAgeIndex } from './ages';

const mine = (state) => Object.values(state.regions || {}).filter((c) => c.owner === state.playerNationId && c.tile != null && !c.outpost).sort((a, b) => (a.id < b.id ? -1 : 1));
const facts = (c) => { const t = getTiles(); return { river: !!t.rivers[c.tile], coastal: t.coastal[c.tile] === 1, lat: t.latLonOf(c.tile).lat }; };
// A city whose land touches land nobody or someone else owns.
const frontier = (state, c) => { const t = getTiles(); const owner = state.world?.tileOwner || {}; return (c.tiles || [c.tile]).some((x) => t.neighbors[x].some((n) => t.land[n] === 1 && (owner[n] == null || state.regions[owner[n]]?.owner !== c.owner))); };
const foreignMajority = (c) => { const cu = c.culture || {}; const own = cu[c.owner] || 0; return Object.entries(cu).some(([id, v]) => id !== c.owner && v > own); };
// Stone Age flavour: the first age's own small troubles and omens (U33).
const FIRST_AGE = { fact: 'ageIndex', min: 0, max: getAgeIndex(FIRST_AGE_ID) };
const starving = (c) => (c.lastYields?.food ?? 0) < 0;
const unprepared = (c) => (c.climateResilience || 0) < CLIMATE_RESILIENCE_THRESHOLD;
// A granary is the food line's first tier (buildings.js): text that talks about granaries only
// says so for a city that has one (playtest audit I222).
const hasGranary = (c) => (c.buildings?.categories?.food ?? -1) >= 0;
// Winter bites where winters are cold: a continental (D) or polar (E) climate, or a temperate one
// (C) from latitude 40. The Nile and the Euphrates do not get a harsh winter.
const coldWinter = (c) => {
  const t = getTiles();
  const k = t.climateNames?.[t.climate?.[c.tile]] || '';
  const lat = Math.abs(facts(c).lat);
  if (k) return k[0] === 'D' || k[0] === 'E' || (k[0] === 'C' && lat >= 40);
  return lat >= 40;
};

export const PROCEDURAL_TEMPLATES = [
  {
    id: 'good_harvest',
    family: 'food',
    weight: 8,
    requires: FIRST_AGE,
    subjects: { city: (state) => mine(state) },
    build: (state, rng, city) => ({
      title: 'A Good Harvest',
      description: `The fields and gathering grounds around ${city.name} give more than anyone remembers, and there is food to spare.`,
      options: [
        { label: 'Hold a feast and store the rest', effects: { cityFood: 10, cityLoyalty: 5 } },
        { label: 'Trade the surplus to travellers', effects: { gold: 50 } }
      ]
    })
  },
  {
    id: 'sick_herds',
    family: 'food',
    weight: 7,
    requires: FIRST_AGE,
    subjects: { city: (state) => mine(state) },
    build: (state, rng, city) => ({
      title: 'Sick Herds',
      description: `A sickness runs through the herds around ${city.name}, and the herders fear for their flocks.`,
      options: [
        { label: 'Cull the sick animals', effects: { cityFood: -5, gold: -20 } },
        { label: 'Drive the herds to clean pasture', effects: { cityFood: -10, controlBonus: 3 } }
      ]
    })
  },
  {
    id: 'comet',
    family: 'omen',
    weight: 5,
    requires: FIRST_AGE,
    subjects: { city: (state) => mine(state) },
    build: (state, rng, city) => ({
      title: 'A Comet in the Sky',
      description: `A bright star with a tail crosses the sky above ${city.name}, and the people ask what it foretells.`,
      options: [
        { label: 'Let the watchers of the sky read it', effects: { techPoints: 15, cityUnrest: 5 } },
        { label: 'Call it a sign of favour', effects: { cityLoyalty: 10 } }
      ]
    })
  },
  {
    id: 'river_shifts',
    family: 'food',
    weight: 6,
    requires: FIRST_AGE,
    subjects: { city: (state) => mine(state).filter((c) => facts(c).river) },
    build: (state, rng, city) => ({
      title: 'The River Shifts',
      description: `The river near ${city.name} cuts a new bed, leaving old fields dry and watering land that was never farmed.`,
      options: [
        { label: 'Follow the water with new fields', effects: { gold: -30, cityFood: 5 } },
        { label: 'Stay on the old fields', effects: { cityFood: -10 } }
      ]
    })
  },
  {
    id: 'shamans_prophecy',
    family: 'omen',
    weight: 5,
    requires: FIRST_AGE,
    subjects: { city: (state) => mine(state) },
    build: (state, rng, city) => ({
      title: "The Shaman's Prophecy",
      description: `A shaman of ${city.name} wakes from a trance and speaks of what is coming, and the people gather to listen.`,
      options: [
        { label: 'Honour the shaman and heed the words', effects: { cityLoyalty: 10, gold: -20 } },
        { label: 'Let the elders judge the words', effects: { legitimacy: 3, cityUnrest: 3 } }
      ]
    })
  },
  {
    id: 'coastal_trade_boom',
    family: 'trade',
    weight: 10,
    subjects: { city: (state) => mine(state).filter((c) => facts(c).coastal && (c.control || 0) >= 60) },
    build: (state, rng, city) => ({
      title: 'A Coastal Boom',
      description: `${city.name} grows rich on trade, its harbours crowded with foreign ships eager to do business.`,
      options: [
        { label: 'Tax the merchants heavily', effects: { gold: 120 } },
        { label: 'Keep tariffs low to keep them coming back', effects: { gold: 100 } }
      ]
    })
  },
  {
    id: 'overcrowded_plague',
    family: 'people',
    weight: 8,
    subjects: { city: (state) => mine(state).filter((c) => (c.currentInfrastructure || 0) >= 3 || (c.size || 1) >= 5) },
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
    family: 'war',
    weight: 10,
    subjects: { city: (state) => mine(state).filter((c) => (c.defenseLevel || 0) < 3 && frontier(state, c)) },
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
    family: 'war',
    weight: 6,
    requires: { fact: 'generals' },
    build: (state, rng) => {
      const generals = Object.values(state.hiredCommanders);
      const general = generals[Math.floor(rng.next() * generals.length)];
      return {
        title: 'A General Grows Ambitious',
        description: `${general.name}, flush with recent victories, begins courting favor among the officer corps — a loyal commander, or the seed of a future rival?`,
        options: [
          { label: 'Reward their loyalty publicly', effects: { gold: -100, prestige: 10 } },
          { label: 'Quietly reassign them to a distant post', effects: { gold: -30, controlPenalty: 5 } }
        ]
      };
    }
  },
  {
    id: 'failed_harvest',
    family: 'food',
    weight: 10,
    // Gated off once Build Climate Resilience (Modern age) has raised the city past the threshold.
    // A starving city is the likeliest place for it.
    subjects: { city: (state) => { const all = mine(state).filter(unprepared); const hungry = all.filter(starving); return hungry.length ? hungry : all; } },
    build: (state, rng, city) => ({
      title: 'Failed Harvest',
      description: `Poor weather ruins the harvest around ${city.name}, and ${hasGranary(city) ? 'granaries that should be full stand' : 'the stores that should be full stand'} nearly empty heading into the lean months.`,
      options: [
        { label: 'Import food at whatever price it takes', effects: { gold: -100, cityFood: 10 } },
        { label: 'Ration what remains', effects: { cityFood: -10, cityUnrest: 5 } }
      ]
    })
  },
  {
    id: 'river_flood',
    family: 'food',
    weight: 8,
    subjects: { city: (state) => mine(state).filter((c) => facts(c).river && unprepared(c)) },
    build: (state, rng, city) => ({
      title: 'The River Rises',
      description: `The river bursts its banks at ${city.name}; the low fields are under water and ${hasGranary(city) ? 'the granary is wet through' : 'the stored grain is spoiling'}.`,
      options: [
        { label: 'Raise levees and drain the fields', effects: { gold: -80, cityFood: -5 } },
        { label: 'Let the waters recede on their own', effects: { cityFood: -15, cityUnrest: 5 } }
      ]
    })
  },
  {
    id: 'foreign_quarter',
    family: 'people',
    weight: 7,
    subjects: { city: (state) => mine(state).filter(foreignMajority) },
    build: (state, rng, city) => ({
      title: 'A Foreign Quarter',
      description: `Most of ${city.name} speaks another tongue and keeps another law; its elders ask who really rules them.`,
      options: [
        { label: 'Grant them their customs and a seat in council', effects: { cityLoyalty: 15, gold: -25 } },
        { label: 'Garrison the quarter and tax it', effects: { gold: 60, cityLoyalty: -10, cityUnrest: 5 } }
      ]
    })
  },
  {
    id: 'traveling_merchants',
    family: 'trade',
    weight: 12,
    subjects: { city: (state) => mine(state) },
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
    family: 'people',
    weight: 9,
    // Post-war or post-disaster: any war in the world, or a badly unsettled city of yours; the
    // refugees arrive at a frontier city when there is one.
    subjects: {
      city: (state) => {
        const all = mine(state);
        const unsettled = all.filter((c) => (c.unrest || 0) >= 40);
        if (!(state.wars || []).some((w) => w.active) && !unsettled.length) return [];
        const border = all.filter((c) => frontier(state, c));
        return unsettled.length ? unsettled : border.length ? border : all;
      }
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
    family: 'food',
    weight: 8,
    subjects: { city: (state) => mine(state).filter((c) => unprepared(c) && coldWinter(c)) },
    build: (state, rng, city) => ({
      title: 'A Harsh Winter',
      description: `An unusually harsh winter settles over ${city.name}, straining stores of food and fuel alike.`,
      options: [
        { label: hasGranary(city) ? 'Open the granaries to everyone' : 'Share out what grain is left', effects: { cityFood: -10, gold: -60 } },
        { label: 'Ration carefully and wait it out', effects: { cityFood: -5, cityUnrest: 5 } }
      ]
    })
  }
];
