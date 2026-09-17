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
  great_flood_myth: {
    id: 'great_flood_myth',
    year: -1850,
    title: 'The Great Flood',
    description: 'Rivers burst their banks in a deluge so severe that generations afterward will tell of it as the flood that nearly ended the world.',
    options: [
      { label: 'Divert labor to levees and drainage works', effects: { gold: -80, controlBonus: 5 } },
      { label: 'Let the waters recede on their own', effects: { hr: -30 } }
    ]
  },
  bronze_trade_networks: {
    id: 'bronze_trade_networks',
    year: -1600,
    title: 'The Tin Trade',
    description: 'Tin, scarce and found in only a handful of places, is now the single resource every bronze-working kingdom cannot do without — and the routes that carry it are worth fighting over.',
    options: [
      { label: 'Secure the trade routes with garrisons', effects: { gold: -100, defenseBonus: 0.05 } },
      { label: 'Let merchants handle it themselves', effects: { gold: 60 } }
    ]
  },
  rise_of_writing: {
    id: 'rise_of_writing',
    year: -1300,
    title: 'The First Scribes',
    description: 'A system of written records spreads among neighboring courts, turning administration from memory and custom into something that can be counted, taxed, and enforced.',
    options: [
      { label: 'Train a corps of royal scribes', effects: { gold: -60, techPoints: 25 } },
      { label: 'Leave record-keeping to the temples', effects: { diplomacyPoints: 10 } }
    ]
  },
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
  alexanders_conquests: {
    id: 'alexanders_conquests',
    year: -330,
    title: "A Conqueror's Shadow",
    description: 'A young commander leads an army further than anyone believed possible, toppling ancient empires and scattering their peoples\' customs, coinage and ideas across three continents in his wake.',
    options: [
      { label: 'Adopt the new fashions in arms and coinage', effects: { gold: -80, militaryStrengthBonus: 60 } },
      { label: 'Hold to the old ways', effects: { controlBonus: 5 } }
    ]
  },
  library_of_alexandria: {
    id: 'library_of_alexandria',
    year: -250,
    title: 'A Great Library',
    description: 'Word spreads of a library built to hold a copy of every book in the known world, drawing scholars from every court willing to fund the journey.',
    options: [
      { label: 'Send scholars and fund a wing of your own', effects: { gold: -100, techPoints: 40 } },
      { label: 'Rely on your own scribes and temples', effects: { diplomacyPoints: 15 } }
    ]
  },
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
  migration_period: {
    id: 'migration_period',
    year: 400,
    title: 'The Great Migrations',
    description: 'Whole peoples uproot and move, pressed by famine, climate, and pressure from further east — and wherever they settle, they press in turn on whoever was there first.',
    options: [
      { label: 'Absorb the newcomers as subjects', effects: { hr: 50, controlPenalty: 10 } },
      { label: 'Turn them away at the border', effects: { gold: -80, defenseBonus: 0.05 } }
    ]
  },

  // ---- Age of Kingdoms (500 to 1500) ----
  islamic_golden_age: {
    id: 'islamic_golden_age',
    year: 850,
    title: 'A Golden Age of Learning',
    description: 'Great centers of learning translate, preserve, and build on the accumulated knowledge of a dozen older civilizations, from mathematics and medicine to astronomy.',
    options: [
      { label: 'Fund houses of wisdom in your own cities', effects: { gold: -100, techPoints: 45 } },
      { label: 'Import scholars rather than train your own', effects: { gold: -40, techPoints: 15 } }
    ]
  },
  viking_raids: {
    id: 'viking_raids',
    year: 850,
    title: 'Raiders From the North',
    description: 'Shallow-drafted longships appear without warning off undefended coasts and up navigable rivers, striking monasteries and towns before any garrison can respond.',
    options: [
      { label: 'Build watchtowers along the coast', effects: { gold: -90, defenseBonus: 0.08 } },
      { label: 'Pay them off before they land', effects: { gold: -120 } }
    ]
  },
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
  little_ice_age: {
    id: 'little_ice_age',
    year: 1400,
    title: 'A Colder World',
    description: 'Winters grow longer and summers shorter across an entire generation, shortening growing seasons and pushing failed harvests further south each year.',
    options: [
      { label: 'Stockpile grain reserves against the cold', effects: { gold: -80, hr: 30 } },
      { label: 'Weather it region by region as it comes', effects: { hr: -40 } }
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
      // Adopting the new crops aggressively means backing the merchants and adventurers eager to
      // chase the new trade routes the exchange opens up — the seed of a colonial venture
      // (event chain, src/data/eventChains.js's colonial_venture_1).
      { label: 'Adopt the new crops aggressively', effects: { hr: 60, gold: -50, spawnFollowUp: { id: 'colonial_venture_1', delayTurns: 5 } } },
      { label: 'Proceed cautiously', effects: { gold: 40 } }
    ]
  },
  reformation: {
    id: 'reformation',
    year: 1520,
    title: 'A Religious Schism',
    description: 'A challenge to established religious authority splits congregations, courts, and entire kingdoms into rival camps, each certain the other has broken faith.',
    options: [
      { label: 'Back the reformers', effects: { diplomacyPoints: -10, controlBonus: 5 } },
      { label: 'Defend the established order', effects: { gold: -60, controlBonus: 10 } }
    ]
  },
  scientific_revolution: {
    id: 'scientific_revolution',
    year: 1650,
    title: 'A New Method',
    description: 'A new way of testing claims against observation and experiment spreads among natural philosophers, quietly overturning certainties that had stood for a thousand years.',
    options: [
      { label: 'Found a royal academy of sciences', effects: { gold: -120, techPoints: 55 } },
      { label: 'Leave it to individual patrons', effects: { techPoints: 20 } }
    ]
  },
  continental_upheaval: {
    id: 'continental_upheaval',
    year: 1803,
    title: 'Continental Upheaval',
    description: 'A wave of revolutionary wars and shifting alliances upends the old order across entire continents, redrawing borders and toppling dynasties that seemed permanent.',
    options: [
      { label: 'Modernize your army to keep pace', effects: { gold: -200, militaryStrengthBonus: 300 } },
      // Watching neighboring dynasties fall raises the same question at home — the seed of a
      // succession crisis (event chain, src/data/eventChains.js's succession_crisis_1).
      { label: 'Stay neutral and consolidate at home', effects: { controlBonus: 10, spawnFollowUp: { id: 'succession_crisis_1', delayTurns: 3 } } }
    ]
  },
  industrial_revolution: {
    id: 'industrial_revolution',
    year: 1830,
    title: 'The Age of Machines',
    description: 'Steam and mechanization transform how goods are made, drawing workers off the land and into new factory towns almost overnight.',
    options: [
      { label: 'Invest heavily in factories and rail', effects: { gold: -250, techPoints: 50 } },
      { label: 'Let industrialization happen at its own pace', effects: { gold: 80 } }
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
  decolonization_wave: {
    id: 'decolonization_wave',
    year: 1960,
    title: 'Empires Recede',
    description: 'One colonial holding after another declares independence, and the old imperial map that had held for a century unravels within a single decade.',
    options: [
      { label: 'Negotiate an orderly withdrawal', effects: { diplomacyPoints: 20, gold: -60 } },
      { label: 'Hold on as long as possible', effects: { gold: -150, militaryStrengthBonus: 80 } }
    ]
  },
  digital_revolution: {
    id: 'digital_revolution',
    year: 1995,
    title: 'The Digital Revolution',
    description: 'Computing and telecommunications reshape economies overnight, rewarding nations that invest early and leaving the rest to scramble and catch up.',
    options: [
      // Full commitment to unproven new technology is exactly the risk-tolerant posture the
      // technological gamble chain (src/data/eventChains.js's tech_gamble_1) assumes.
      { label: 'Invest heavily in the new technology', effects: { gold: -300, techPoints: 100, spawnFollowUp: { id: 'tech_gamble_1', delayTurns: 4 } } },
      { label: 'Let private industry lead the way', effects: { gold: 100, techPoints: 20 } }
    ]
  },
  climate_stress: {
    id: 'climate_stress',
    year: 2050,
    title: 'A Changing Climate',
    description: 'Shifting rainfall patterns and rising seas strain farmland and coastal infrastructure worldwide, forcing hard choices about where to keep investing.',
    options: [
      { label: 'Invest in resilient infrastructure', effects: { gold: -200, hr: 30 } },
      { label: 'Manage the damage as it comes', effects: { hr: -60, gold: 50 } }
    ]
  },

  // ---- Curated national flavor (plan §9.5 Layer 3) — a representative batch of historically
  // significant nations, not the plan's full ~40: the mechanism (nationId + requiresHomeland gate
  // below) works identically for any of the 240 nation ids, so extending this list later is pure
  // data, not new code. Gated on `nationId` (only fires for that specific nation's own player) and
  // `requiresHomeland` (only fires while that nation still controls its own starting region) —
  // unlike world events, these already know exactly who's playing, so they're free to use the
  // identity-specific effect keys world events avoid (see punic_ambitions below for an example).
  // Every other nation still gets Task 26's generic world/situational/procedural content — this
  // is bespoke flavor layered on top, not a replacement for it.
  national_egypt_nile_flood: {
    id: 'national_egypt_nile_flood',
    year: -1900,
    nationId: 'eg',
    requiresHomeland: true,
    title: "The Nile's Verdict",
    description: 'The annual flood of the Nile arrives lower than expected, threatening the harvest the whole kingdom depends on.',
    options: [
      { label: 'Draw on the royal granaries', effects: { hr: 30, gold: -80 } },
      { label: 'Ration strictly and wait for a better year', effects: { hr: -20, controlBonus: 5 } }
    ]
  },
  national_punic_ambitions: {
    id: 'national_punic_ambitions',
    year: -264,
    nationId: 'it',
    requiresHomeland: true,
    title: 'The Case for War',
    description: 'Advisors argue that the rival maritime power across the sea threatens your trade routes and must be dealt with before it grows any stronger.',
    options: [
      { label: 'Declare war and settle it by force', effects: { warWith: ['tn'] } },
      { label: 'Seek a trade agreement instead', effects: { tradeWith: ['tn'] } }
    ]
  },
  national_mongol_succession: {
    id: 'national_mongol_succession',
    year: 1227,
    nationId: 'mn',
    requiresHomeland: true,
    title: "The Great Khan's Succession",
    description: "With the great khan's death, the empire's constituent hordes must choose between uniting under a new ruler or fracturing into rival domains.",
    options: [
      { label: 'Convene a kurultai to elect a strong successor', effects: { controlBonus: 10, diplomacyPoints: 10 } },
      { label: 'Let the strongest horde claim the title by force', effects: { militaryStrengthBonus: 100, controlPenalty: 10 } }
    ]
  },
  national_japan_sakoku: {
    id: 'national_japan_sakoku',
    year: 1639,
    nationId: 'jp',
    requiresHomeland: true,
    title: 'The Sakoku Decision',
    description: 'Foreign traders and missionaries have grown numerous enough to worry the court. Some counsel closing the realm to outside influence entirely.',
    options: [
      { label: 'Seal the borders and expel foreign traders', effects: { controlBonus: 10, gold: -50 } },
      { label: 'Keep trade open despite the risk', effects: { gold: 80, diplomacyPoints: 10 } }
    ]
  },
  national_britain_naval_turn: {
    id: 'national_britain_naval_turn',
    year: 1588,
    nationId: 'gb',
    requiresHomeland: true,
    title: 'Mastery of the Sea',
    description: 'A hostile fleet approaches to end your independence for good — the outcome will decide whether your future lies on the continent or across the oceans.',
    options: [
      { label: 'Commit everything to the fleet', effects: { gold: -150, militaryStrengthBonus: 250 } },
      { label: 'Rely on fortified ports and coastal defense', effects: { gold: -80, defenseBonus: 0.1 } }
    ]
  },
  national_china_mandate: {
    id: 'national_china_mandate',
    year: 1644,
    nationId: 'cn',
    requiresHomeland: true,
    title: 'A Question of the Mandate',
    description: 'Natural disasters, peasant uprisings and a weakening court have many whispering that the Mandate of Heaven has passed to someone else.',
    options: [
      { label: 'Reassert authority through decisive reform', effects: { controlBonus: 15, gold: -100 } },
      { label: "Let the old dynasty's rot run its course", effects: { controlPenalty: 15, militaryStrengthBonus: 50 } }
    ]
  },
  national_india_maritime_trade: {
    id: 'national_india_maritime_trade',
    year: 1498,
    nationId: 'in',
    requiresHomeland: true,
    title: 'Ships From a Distant Sea',
    description: 'Foreign ships arrive by a sea route none of your merchants have used before, eager to trade directly for the spices and cloth that made your ports famous.',
    options: [
      { label: 'Grant them trading rights at your ports', effects: { gold: 100, diplomacyPoints: 10 } },
      { label: 'Restrict them to existing merchant guilds', effects: { gold: 40, controlBonus: 5 } }
    ]
  },
  national_ottoman_city_between_seas: {
    id: 'national_ottoman_city_between_seas',
    year: 1453,
    nationId: 'tr',
    requiresHomeland: true,
    title: 'The City Between Two Seas',
    description: 'An ancient, storied city at the crossing between two continents stands within reach — its walls have held for a thousand years, but not forever.',
    options: [
      { label: 'Commit to a prolonged siege', effects: { gold: -200, militaryStrengthBonus: 200, controlBonus: 10 } },
      { label: 'Focus on consolidating existing territory instead', effects: { gold: 60 } }
    ]
  },
  national_greek_golden_age: {
    id: 'national_greek_golden_age',
    year: -450,
    nationId: 'gr',
    requiresHomeland: true,
    title: 'A Golden Age',
    description: 'Philosophy, theater and architecture flourish in your city-states, drawing students and thinkers from across the known world.',
    options: [
      { label: 'Fund public works and monuments', effects: { gold: -100, techPoints: 40, diplomacyPoints: 10 } },
      { label: 'Let private patrons carry the cost', effects: { techPoints: 15 } }
    ]
  },
  national_persian_zenith: {
    id: 'national_persian_zenith',
    year: -500,
    nationId: 'ir',
    requiresHomeland: true,
    title: "An Empire's Reach",
    description: 'Royal roads and a standing administration now bind together more peoples and provinces than any realm before it — the question is how tightly to hold them.',
    options: [
      { label: 'Rule through tolerance and local custom', effects: { diplomacyPoints: 20, controlBonus: 5 } },
      { label: 'Impose uniform law across every province', effects: { gold: -100, controlBonus: 15 } }
    ]
  },
  national_aztec_founding: {
    id: 'national_aztec_founding',
    year: -1325,
    nationId: 'mx',
    requiresHomeland: true,
    title: 'A City on the Lake',
    description: 'Following an old prophecy, your people found a city on an island in the middle of a lake — an unlikely site that will need engineering as much as faith to sustain.',
    options: [
      { label: 'Build causeways and floating gardens', effects: { gold: -100, hr: 40 } },
      { label: 'Expand cautiously along the shore instead', effects: { gold: 40 } }
    ]
  },
  national_inca_roads: {
    id: 'national_inca_roads',
    year: 1438,
    nationId: 'pe',
    requiresHomeland: true,
    title: 'Roads of the Sun',
    description: 'A network of roads and rope bridges now threads through the mountains, binding together valleys that would otherwise take weeks to cross on foot.',
    options: [
      { label: 'Extend the road network further', effects: { gold: -120, diplomacyPoints: 15 } },
      { label: 'Maintain what already exists', effects: { gold: 40, controlBonus: 5 } }
    ]
  },
  national_spanish_exploration: {
    id: 'national_spanish_exploration',
    year: 1492,
    nationId: 'es',
    requiresHomeland: true,
    title: 'An Age of Exploration',
    description: 'A gamble on an unproven westward route across the ocean pays off beyond anyone\'s expectations, opening an entire hemisphere no one at court had known existed.',
    options: [
      { label: 'Fund further expeditions immediately', effects: { gold: -150, spawnFollowUp: { id: 'colonial_venture_1', delayTurns: 4 } } },
      { label: 'Consolidate what the first voyage found', effects: { gold: 100 } }
    ]
  },
  national_dutch_golden_age: {
    id: 'national_dutch_golden_age',
    year: 1648,
    nationId: 'nl',
    requiresHomeland: true,
    title: 'A Golden Age of Trade',
    description: 'Merchant fleets and a new kind of joint-stock company make your ports the busiest in the world, and your merchants some of the wealthiest.',
    options: [
      { label: 'Charter more trading companies', effects: { gold: -100, diplomacyPoints: 20 } },
      { label: 'Tax the existing trade heavily instead', effects: { gold: 150 } }
    ]
  },
  national_russian_reforms: {
    id: 'national_russian_reforms',
    year: 1700,
    nationId: 'ru',
    requiresHomeland: true,
    title: "A Ruler's Reforms",
    description: 'A sweeping campaign of westernizing reform remakes the army, the bureaucracy, and the court almost overnight — welcomed by some, resented by many more.',
    options: [
      { label: 'Push the reforms through regardless of resistance', effects: { gold: -150, militaryStrengthBonus: 150, controlPenalty: 10 } },
      { label: 'Phase them in gradually', effects: { gold: -60, controlBonus: 5 } }
    ]
  }
};

// True once a scripted event's year has arrived (and it hasn't already fired, any requiresNoWar
// nations are actually at peace, and — for curated national flavor — the current player is
// actually that specific nation and, if requiresHomeland is set, still controls their own
// starting region). playerNationId/regions are only needed for nationId-gated events; every
// existing (world/generic) call site can omit them safely since event.nationId is undefined for
// those. pickNextEvent() below fires at most one due event per turn, in year order, so
// simultaneous-year events queue up and fire on consecutive turns instead of colliding.
export const shouldEventFire = (event, year, nations, firedEvents, playerNationId, regions) => {
  if (firedEvents[event.id]) return false;
  if (event.year > year) return false;
  if (event.requiresNoWar) {
    const anyAtWar = event.requiresNoWar.some(nId => nations[nId]?.isAtWar);
    if (anyAtWar) return false;
  }
  if (event.nationId) {
    if (event.nationId !== playerNationId) return false;
    if (event.requiresHomeland && regions?.[event.nationId]?.owner !== event.nationId) return false;
  }
  return true;
};

// Pick the single most-overdue eligible event for this turn (earliest scripted year first, then
// stable declaration order for same-year ties).
export const pickNextEvent = (year, nations, firedEvents, playerNationId, regions) => {
  const eligible = Object.values(HISTORICAL_EVENTS).filter(e => shouldEventFire(e, year, nations, firedEvents, playerNationId, regions));
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.year - b.year);
  return eligible[0];
};
