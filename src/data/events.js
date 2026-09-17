// src/data/events.js
// Scripted historical events, keyed by id and gated by `year`. The event SYSTEM (EventModal's
// per-option effect preview, this registry's shape, resolveTurn.js's year-based trigger check) is
// unchanged from the original campaign.
//
// This is Phase D3 Layer 1 (plan §9.5) — "world events": anchored to the calendar, firing for
// every nation regardless of who's playing, so they land differently depending on your situation
// rather than assuming a particular civilization. Every effect here deliberately uses only the
// nation-agnostic keys applyEventEffects.js supports (gold/hr/copper/iron/oil/techPoints/
// diplomacyPoints/militaryStrengthBonus/defenseBonus/controlBonus/controlPenalty) — never
// captureRegions/peaceWith/tradeWith/warWith/nationHostility, which name specific nations or
// regions and only make sense for content that already knows who you're playing (situational/
// procedural events, src/data/proceduralEvents.js; curated national flavor, a later task).
// "Alt-history tolerant": every event here only ever touches the player's own generic stats, so
// it still makes sense no matter how unrecognizable the map has become by the year it fires.
export const HISTORICAL_EVENTS = {
  // ---- Bronze Age (-2000 to -800) ----
  bronze_age_collapse: {
    id: 'bronze_age_collapse',
    year: -1200,
    title: 'The Bronze Age Collapse',
    description: 'A cascade of invasions, crop failures and broken trade routes brings the great palace economies to their knees. Kingdoms that seemed eternal crumble within a generation.',
    options: [
      { label: 'Hoard grain and retreat behind your walls', effects: { hr: 40, controlPenalty: 10 } },
      { label: 'Push through the chaos and modernize', effects: { gold: -150, techPoints: 30 } },
      { label: 'Ride it out and hope for the best', effects: { controlPenalty: 20 } }
    ]
  },
  sea_peoples_invasions: {
    id: 'sea_peoples_invasions',
    year: -1180,
    title: 'Raiders From Across the Sea',
    description: 'A confederation of seaborne raiders strikes coastal settlements throughout the region, burning granaries and scattering garrisons wherever they land.',
    options: [
      { label: 'Fortify the coastline', effects: { gold: -100, defenseBonus: 0.1 } },
      { label: 'Pay tribute and let them pass', effects: { gold: -80, hr: 20 } }
    ]
  },

  // ---- Classical Age (-800 to 500) ----
  silk_road_opens: {
    id: 'silk_road_opens',
    year: -130,
    title: 'The Silk Road Opens',
    description: 'Trade routes stretching from the Mediterranean to the far east open in earnest, carrying silk, spices, and ideas across an entire continent.',
    options: [
      { label: 'Invest in caravanserais and trade infrastructure', effects: { gold: -100, diplomacyPoints: 15 } },
      { label: 'Focus inward and let others carry the trade', effects: { hr: 30 } }
    ]
  },
  antonine_plague: {
    id: 'antonine_plague',
    year: 165,
    title: 'A Great Plague',
    description: 'A devastating plague, carried home by returning soldiers and merchants, sweeps through crowded cities and depopulates the countryside beyond them.',
    options: [
      { label: 'Impose strict quarantine', effects: { hr: -40, controlBonus: 5 } },
      { label: 'Let trade and travel continue regardless', effects: { hr: -80, gold: 60 } }
    ]
  },

  // ---- Age of Kingdoms (500 to 1500) ----
  black_death: {
    id: 'black_death',
    year: 1347,
    title: 'The Black Death',
    description: 'A plague of unprecedented scale sweeps from the steppes to the western ocean, killing a third of the population in its path within a few short years.',
    options: [
      { label: 'Impose strict quarantine on affected regions', effects: { hr: -60, controlBonus: 10 } },
      { label: 'Continue trade and accept the losses', effects: { hr: -120, gold: 100 } }
    ]
  },
  printing_press: {
    id: 'printing_press',
    year: 1450,
    title: 'The Printing Press',
    description: 'A new method of reproducing text with movable type spreads rapidly, putting books — and ideas — within reach of far more people than ever before.',
    options: [
      { label: 'Fund printing houses in your major cities', effects: { gold: -80, techPoints: 40 } },
      { label: 'Leave it to the church and the guilds', effects: { diplomacyPoints: 10 } }
    ]
  },

  // ---- Age of Gunpowder (1500 to 1900) ----
  columbian_exchange: {
    id: 'columbian_exchange',
    year: 1500,
    title: 'The Columbian Exchange',
    description: 'New crops, animals and diseases begin crossing the oceans in both directions, reshaping diets, economies and populations across every continent they touch.',
    options: [
      { label: 'Adopt the new crops aggressively', effects: { hr: 60, gold: -50 } },
      { label: 'Proceed cautiously', effects: { gold: 40 } }
    ]
  },
  continental_upheaval: {
    id: 'continental_upheaval',
    year: 1803,
    title: 'Continental Upheaval',
    description: 'A wave of revolutionary wars and shifting alliances upends the old order across entire continents, redrawing borders and toppling dynasties that seemed permanent.',
    options: [
      { label: 'Modernize your army to keep pace', effects: { gold: -200, militaryStrengthBonus: 300 } },
      { label: 'Stay neutral and consolidate at home', effects: { controlBonus: 10 } }
    ]
  },

  // ---- Modern Age (1900 to 2300) ----
  the_great_war: {
    id: 'the_great_war',
    year: 1914,
    title: 'The Great War',
    description: 'A regional dispute spirals into a war on a scale the world has never seen, drawing in nations far from its original cause and consuming an entire generation.',
    options: [
      { label: 'Mobilize for total war', effects: { gold: -300, militaryStrengthBonus: 500, hr: -100 } },
      { label: 'Maintain strict neutrality', effects: { gold: 150 } }
    ]
  },
  great_depression: {
    id: 'great_depression',
    year: 1929,
    title: 'The Great Depression',
    description: 'A financial collapse spreads outward from the markets, closing factories and banks and throwing millions out of work across the globe.',
    options: [
      { label: 'Launch public works to stem the collapse', effects: { gold: -150, hr: 40 } },
      { label: 'Let the market correct itself', effects: { gold: -250 } }
    ]
  },
  digital_revolution: {
    id: 'digital_revolution',
    year: 1995,
    title: 'The Digital Revolution',
    description: 'Computing and telecommunications reshape economies overnight, rewarding nations that invest early and leaving the rest to scramble and catch up.',
    options: [
      { label: 'Invest heavily in the new technology', effects: { gold: -300, techPoints: 100 } },
      { label: 'Let private industry lead the way', effects: { gold: 100, techPoints: 20 } }
    ]
  }
};

// True once a scripted event's year has arrived (and it hasn't already fired, and any
// requiresNoWar nations are actually at peace). pickNextEvent() below fires at most one due event
// per turn, in year order, so simultaneous-year events queue up and fire on consecutive turns
// instead of colliding.
export const shouldEventFire = (event, year, nations, firedEvents) => {
  if (firedEvents[event.id]) return false;
  if (event.year > year) return false;
  if (event.requiresNoWar) {
    const anyAtWar = event.requiresNoWar.some(nId => nations[nId]?.isAtWar);
    if (anyAtWar) return false;
  }
  return true;
};

// Pick the single most-overdue eligible event for this turn (earliest scripted year first, then
// stable declaration order for same-year ties).
export const pickNextEvent = (year, nations, firedEvents) => {
  const eligible = Object.values(HISTORICAL_EVENTS).filter(e => shouldEventFire(e, year, nations, firedEvents));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.year - b.year);
  return eligible[0];
};
