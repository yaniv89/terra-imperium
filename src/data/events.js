// src/data/events.js
// Scripted historical events, keyed by id and placed by `year` (its age and its spot in the age). They are the story cards of the event deck
// (src/engine/eventDeck.js), which turns the year and `requires` into predicates.
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
import { getNationCapital } from './regions';
import { AGE_ORDER, AGES, LAST_AGE_ID } from './ages';
const RAW_HISTORICAL_EVENTS = {
  // ---- Stone Age (-5000 to -2000): generic by people, never tied to a modern country ----
  great_migrations: {
    id: 'great_migrations',
    year: -4800,
    title: 'The Great Migrations',
    description: 'Bands follow the herds and the rivers into new country, and your people meet strangers whose tongue and tools they do not know.',
    options: [
      { label: 'Follow the herds into the new country', effects: { hr: 20, controlPenalty: 3 } },
      { label: 'Hold your valley and guard your fields', effects: { defenseBonus: 0.05, gold: -20 } }
    ]
  },
  the_horse: {
    id: 'the_horse',
    year: -4000,
    title: 'The Horse',
    description: 'Herders learn to keep and ride the wild horse of the grasslands, and a day\'s journey shrinks to a morning\'s.',
    options: [
      { label: 'Breed riding herds for the hunters', effects: { gold: -30, militaryStrengthBonus: 20 } },
      { label: 'Use the horses to carry goods and trade', effects: { gold: 50 } }
    ]
  },
  the_wheel: {
    id: 'the_wheel',
    year: -3500,
    title: 'The Wheel',
    description: 'A turning disc of wood, first for the potter and then for the cart, changes what one pair of hands can move and make.',
    options: [
      { label: 'Build carts for harvest and market', effects: { gold: -40, cityFood: 10 } },
      { label: 'Keep the craft to the potters\' guild', effects: { gold: 40, techPoints: 10 } }
    ]
  },
  uruk_expansion: {
    id: 'uruk_expansion',
    year: -3300,
    title: 'The River City Expands',
    description: 'A great river city sends colonists, goods and its way of life far up the valleys, and its neighbours must decide how to meet it.',
    options: [
      { label: 'Trade with the colonists', effects: { gold: 85 } },
      { label: 'Close your borders to them', effects: { controlBonus: 5, gold: -40 } }
    ]
  },
  first_writing: {
    id: 'first_writing',
    year: -3200,
    title: 'The First Writing',
    description: 'Marks pressed in clay count the grain and the flocks, and soon the temple clerks can remember more than any elder.',
    options: [
      { label: 'Train clerks in the temple', effects: { gold: -50, techPoints: 25 } },
      { label: 'Keep the tallies in the elders\' memory', effects: { stability: 1 } }
    ]
  },
  river_unification: {
    id: 'river_unification',
    year: -3100,
    title: 'One River, One Crown',
    description: 'The towns along a great river are drawn together under a single ruler, and the lands beside it feel the pull.',
    options: [
      { label: 'Seek a place at the new court', effects: { gold: 50, legitimacy: 5 } },
      { label: 'Stand apart and arm your border', effects: { defenseBonus: 0.05, gold: -40 } }
    ]
  },
  drought_of_4200: {
    id: 'drought_of_4200',
    year: -2200,
    title: 'The Long Drought',
    description: 'The rains fail for a generation. Fields crack, rivers shrink, and whole peoples move or perish.',
    options: [
      { label: 'Dig channels and share the stores', effects: { gold: -80, cityFood: 10, controlBonus: 4 } },
      { label: 'Send the hungry away', effects: { hr: -30, stability: -1 } }
    ]
  },
  // ---- Bronze Age (-2000 to -800) ----
  great_flood_myth: {
    id: 'great_flood_myth',
    year: -1850,
    title: 'The Great Flood',
    description: 'Rivers burst their banks in a deluge so severe that generations afterward will tell of it as the flood that nearly ended the world.',
    options: [
      { label: 'Divert labor to levees and drainage works', effects: { gold: -80, controlBonus: 5 } },
      { label: 'Let the waters recede on their own', effects: { hr: -30, stability: -1 } }
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
      { label: 'Leave record-keeping to the temples', effects: { gold: 50 } }
    ]
  },
  bronze_age_collapse: {
    id: 'bronze_age_collapse',
    year: -1200,
    // Not a one-city start's event: it waits for a realm big enough to have a palace economy to lose
    // (3 cities), and fires for a small realm once it is well into the Bronze Age's techs (the age and progress of -900, never the calendar).
    requires: { minCities: 3, orByYear: -900 },
    title: 'The Bronze Age Collapse',
    description: 'A cascade of invasions, crop failures and broken trade routes brings the great palace economies to their knees. Kingdoms that seemed eternal crumble within a generation.',
    options: [
      { label: 'Hoard grain and retreat behind your walls', effects: { hr: 40, controlPenalty: 10 } },
      { label: 'Push through the chaos and modernize', effects: { gold: -150, techPoints: 30, stability: -1 } },
      { label: 'Open your stores and trade for grain with neighbours', effects: { gold: -60, hr: 20, controlPenalty: 4, prestige: 5 } },
      { label: 'Ride it out and hope for the best', effects: { controlPenalty: 20 } }
    ]
  },
  sea_peoples_invasions: {
    id: 'sea_peoples_invasions',
    year: -1180,
    requires: { coastal: true },
    title: 'Raiders From Across the Sea',
    description: 'A confederation of seaborne raiders strikes coastal settlements throughout the region, burning stores and scattering garrisons wherever they land.',
    options: [
      { label: 'Fortify the coastline', effects: { gold: -100, defenseBonus: 0.1 } },
      { label: 'Pay tribute and let them pass', effects: { gold: -80, hr: 20, legitimacy: -5 } }
    ]
  },

  // ---- Classical Age (-800 to 500) ----
  alexanders_conquests: {
    id: 'alexanders_conquests',
    year: -330,
    title: "A Conqueror's Shadow",
    description: 'A young commander leads an army further than anyone believed possible, toppling ancient empires and scattering their peoples\' customs, coinage and ideas across three continents in his wake.',
    options: [
      { label: 'Adopt the new fashions in arms and coinage', effects: { gold: -80, militaryStrengthBonus: 60, prestige: 10 } },
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
      { label: 'Rely on your own scribes and temples', effects: { gold: 75 } }
    ]
  },
  silk_road_opens: {
    id: 'silk_road_opens',
    year: -130,
    title: 'The Silk Road Opens',
    description: 'Trade routes stretching from the Mediterranean to the far east open in earnest, carrying silk, spices, and ideas across an entire continent.',
    options: [
      { label: 'Invest in caravanserais and trade infrastructure', effects: { gold: -100, prestige: 15 } },
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
      { label: 'Let trade and travel continue regardless', effects: { hr: -80, gold: 60, stability: -1 } }
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
      { label: 'Import scholars rather than train your own', effects: { gold: -40, techPoints: 15, prestige: 5 } }
    ]
  },
  viking_raids: {
    id: 'viking_raids',
    year: 850,
    requires: { coastal: true },
    title: 'Raiders From the North',
    description: 'Shallow-drafted longships appear without warning off undefended coasts and up navigable rivers, striking monasteries and towns before any garrison can respond.',
    options: [
      { label: 'Build watchtowers along the coast', effects: { gold: -90, defenseBonus: 0.08 } },
      { label: 'Pay them off before they land', effects: { gold: -120, legitimacy: -5 } }
    ]
  },
  black_death: {
    id: 'black_death',
    year: 1347,
    title: 'The Black Death',
    description: 'A plague of unprecedented scale sweeps from the steppes to the western ocean, killing a third of the population in its path within a few short years.',
    options: [
      { label: 'Impose strict quarantine on affected regions', effects: { hr: -60, controlBonus: 10 } },
      { label: 'Continue trade and accept the losses', effects: { hr: -120, gold: 100, stability: -1 } }
    ]
  },
  little_ice_age: {
    id: 'little_ice_age',
    year: 1400,
    title: 'A Colder World',
    description: 'Winters grow longer and summers shorter across an entire generation, shortening growing seasons and pushing failed harvests further south each year.',
    options: [
      { label: 'Stockpile grain reserves against the cold', effects: { gold: -80, hr: 30 } },
      { label: 'Weather it region by region as it comes', effects: { hr: -40, stability: -1 } }
    ]
  },
  printing_press: {
    id: 'printing_press',
    year: 1450,
    title: 'The Printing Press',
    description: 'A new method of reproducing text with movable type spreads rapidly, putting books — and ideas — within reach of far more people than ever before.',
    options: [
      { label: 'Fund printing houses in your major cities', effects: { gold: -80, techPoints: 40 } },
      { label: 'Leave it to the church and the guilds', effects: { gold: 50 } }
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
      { label: 'Proceed cautiously', effects: { gold: 40, stability: 1 } }
    ]
  },
  reformation: {
    id: 'reformation',
    year: 1520,
    title: 'A Religious Schism',
    description: 'A challenge to established religious authority splits congregations, courts, and entire kingdoms into rival camps, each certain the other has broken faith.',
    options: [
      { label: 'Back the reformers', effects: { gold: -50, controlBonus: 5 } },
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
      { label: 'Modernize your army to keep pace', effects: { gold: -200, militaryStrengthBonus: 300, stability: -1 } },
      { label: 'Stay neutral and consolidate at home', effects: { controlBonus: 10 } }
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

  // ---- Modern Age (1900 to 1990) ----
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
      { label: 'Let the market correct itself', effects: { gold: -250, stability: -1 } }
    ]
  },
  decolonization_wave: {
    id: 'decolonization_wave',
    year: 1960,
    title: 'Empires Recede',
    description: 'One colonial holding after another declares independence, and the old imperial map that had held for a century unravels within a single decade.',
    options: [
      { label: 'Negotiate an orderly withdrawal', effects: { prestige: 20, gold: -60 } },
      { label: 'Hold on as long as possible', effects: { gold: -150, militaryStrengthBonus: 80, legitimacy: -10 } }
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
  // ---- Information Age (from 1990; eight-ages plan U59). Generic: never about real living people
  // or current politics. Dated before 2100 so they stay Information events once the Future arrives.
  // ----
  financial_crisis: {
    id: 'financial_crisis',
    year: 2008,
    title: 'The Global Financial Crisis',
    description: 'Debts nobody understood come due at once. Banks fail in a week, and the panic crosses every border the money once did.',
    options: [
      { label: 'Bail out the banks', effects: { gold: -250, stability: 1 } },
      { label: 'Let the failing banks fall', effects: { gold: 60, addModifier: { label: 'Credit crunch', mods: { 'national.goldMult': -0.1 }, duration: 10 } } }
    ]
  },
  global_pandemic: {
    id: 'global_pandemic',
    year: 2020,
    title: 'A Global Pandemic',
    description: 'A new disease moves faster than any before it, carried along the flight paths that tie the world together.',
    options: [
      { label: 'Order a quarantine and close the borders', effects: { gold: -150, addModifier: { label: 'Quarantine', mods: { 'national.goldMult': -0.15 }, duration: 6 } } },
      { label: 'Keep the country open and treat the sick', effects: { hr: -80, cityUnrest: 10, stability: -1 } }
    ]
  },
  climate_stress: {
    id: 'climate_stress',
    year: 2050,
    title: 'A Changing Climate',
    description: 'Shifting rainfall patterns and rising seas strain farmland and coastal infrastructure worldwide, forcing hard choices about where to keep investing.',
    options: [
      { label: 'Invest in resilient infrastructure', effects: { gold: -200, hr: 30 } },
      { label: 'Manage the damage as it comes', effects: { hr: -60, gold: 50, stability: -1 } }
    ]
  },
  solar_storm: {
    id: 'solar_storm',
    year: 2060,
    title: 'The Solar Storm',
    description: 'A burst from the Sun lights the sky in green curtains and burns out transformers on half the planet. The power grid goes dark.',
    options: [
      { label: 'Rebuild the grid hardened against the next one', effects: { gold: -200, defenseBonus: 0.05 } },
      { label: 'Patch it back together quickly', effects: { gold: -60, addModifier: { label: 'Fragile grid', mods: { 'national.stabilityBonus': -1 }, duration: 8 } } }
    ]
  },
  automation_riots: {
    id: 'automation_riots',
    year: 2075,
    title: 'The Automation Riots',
    description: 'Machines now do the work of whole towns. The workers they replaced fill the squares and smash the robots at the factory gates.',
    options: [
      { label: 'Pay every worker a share of what the machines make', effects: { gold: -200, stability: 1, cityLoyalty: 5 } },
      { label: 'Send in the police and keep the factories running', effects: { gold: 80, cityUnrest: 15, legitimacy: -5 } }
    ]
  },
  first_general_ai: {
    id: 'first_general_ai',
    year: 2090,
    title: 'The First General AI',
    description: 'A laboratory switches on a mind that can learn anything a person can, and faster. Every government wants it, and every government fears it.',
    options: [
      { label: 'Put it to work on research', effects: { techPoints: 150, stability: -1 } },
      { label: 'Keep it boxed under strict law', effects: { prestige: 20, legitimacy: 5 } }
    ]
  },

  // ---- Curated national flavor (plan §9.5 Layer 3) — a representative batch of historically
  // significant lands, not the plan's full ~40. Keyed by `land` (the modern country code of the
  // player's people, peoples.js countryOfNation: Egypt's 'eg' fires for kemet) and gated by
  // `requiresHomeland` (only while the player still holds its original capital). The event deck
  // (src/engine/eventDeck.js) turns both into requirements. These know roughly who's playing, so they
  // may use the identity-specific effect keys world events avoid (see punic_ambitions below for an example).
  // Every other nation still gets Task 26's generic world/situational/procedural content — this
  // is bespoke flavor layered on top, not a replacement for it.
  national_egypt_nile_flood: {
    id: 'national_egypt_nile_flood',
    year: -1900,
    land: 'eg',
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
    land: 'it',
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
    land: 'mn',
    requiresHomeland: true,
    title: "The Great Khan's Succession",
    description: "With the great khan's death, the empire's constituent hordes must choose between uniting under a new ruler or fracturing into rival domains.",
    options: [
      { label: 'Convene a kurultai to elect a strong successor', effects: { controlBonus: 10, gold: 50 } },
      { label: 'Let the strongest horde claim the title by force', effects: { militaryStrengthBonus: 100, controlPenalty: 10 } }
    ]
  },
  national_japan_sakoku: {
    id: 'national_japan_sakoku',
    year: 1639,
    land: 'jp',
    requiresHomeland: true,
    title: 'The Sakoku Decision',
    description: 'Foreign traders and missionaries have grown numerous enough to worry the court. Some counsel closing the realm to outside influence entirely.',
    options: [
      { label: 'Seal the borders and expel foreign traders', effects: { controlBonus: 10, gold: -50 } },
      { label: 'Keep trade open despite the risk', effects: { gold: 130 } }
    ]
  },
  national_britain_naval_turn: {
    id: 'national_britain_naval_turn',
    year: 1588,
    land: 'gb',
    requiresHomeland: true,
    title: 'Mastery of the Sea',
    description: 'A hostile fleet approaches to end your independence for good — the outcome will decide whether your future lies on the continent or across the oceans.',
    options: [
      { label: 'Commit everything to the fleet', effects: { gold: -150, militaryStrengthBonus: 250, prestige: 15 } },
      { label: 'Rely on fortified ports and coastal defense', effects: { gold: -80, defenseBonus: 0.1 } }
    ]
  },
  national_china_mandate: {
    id: 'national_china_mandate',
    year: 1644,
    land: 'cn',
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
    land: 'in',
    requiresHomeland: true,
    title: 'Ships From a Distant Sea',
    description: 'Foreign ships arrive by a sea route none of your merchants have used before, eager to trade directly for the spices and cloth that made your ports famous.',
    options: [
      { label: 'Grant them trading rights at your ports', effects: { gold: 150 } },
      { label: 'Restrict them to existing merchant guilds', effects: { gold: 40, controlBonus: 5 } }
    ]
  },
  national_ottoman_city_between_seas: {
    id: 'national_ottoman_city_between_seas',
    year: 1453,
    land: 'tr',
    requiresHomeland: true,
    title: 'The City Between Two Seas',
    description: 'An ancient, storied city at the crossing between two continents stands within reach — its walls have held for a thousand years, but not forever.',
    options: [
      { label: 'Commit to a prolonged siege', effects: { gold: -200, militaryStrengthBonus: 200, controlBonus: 10 } },
      { label: 'Focus on consolidating existing territory instead', effects: { gold: 60, stability: 1 } }
    ]
  },
  national_greek_golden_age: {
    id: 'national_greek_golden_age',
    year: -450,
    land: 'gr',
    requiresHomeland: true,
    title: 'A Golden Age',
    description: 'Philosophy, theater and architecture flourish in your city-states, drawing students and thinkers from across the known world.',
    options: [
      { label: 'Fund public works and monuments', effects: { gold: -100, techPoints: 40, prestige: 10 } },
      { label: 'Let private patrons carry the cost', effects: { techPoints: 15, prestige: 5 } }
    ]
  },
  national_persian_zenith: {
    id: 'national_persian_zenith',
    year: -500,
    land: 'ir',
    requiresHomeland: true,
    title: "An Empire's Reach",
    description: 'Royal roads and a standing administration now bind together more peoples and provinces than any realm before it — the question is how tightly to hold them.',
    options: [
      { label: 'Rule through tolerance and local custom', effects: { gold: 100, controlBonus: 5 } },
      { label: 'Impose uniform law across every province', effects: { gold: -100, controlBonus: 15 } }
    ]
  },
  national_aztec_founding: {
    id: 'national_aztec_founding',
    year: -1325,
    land: 'mx',
    requiresHomeland: true,
    title: 'A City on the Lake',
    description: 'Following an old prophecy, your people found a city on an island in the middle of a lake — an unlikely site that will need engineering as much as faith to sustain.',
    options: [
      { label: 'Build causeways and floating gardens', effects: { gold: -100, hr: 40 } },
      { label: 'Expand cautiously along the shore instead', effects: { gold: 40, stability: 1 } }
    ]
  },
  national_inca_roads: {
    id: 'national_inca_roads',
    year: 1438,
    land: 'pe',
    requiresHomeland: true,
    title: 'Roads of the Sun',
    description: 'A network of roads and rope bridges now threads through the mountains, binding together valleys that would otherwise take weeks to cross on foot.',
    options: [
      { label: 'Extend the road network further', effects: { gold: -120, prestige: 15, dev: { regionId: getNationCapital('pe'), type: 'production', delta: 1 } } },
      { label: 'Maintain what already exists', effects: { gold: 40, controlBonus: 5 } }
    ]
  },
  national_spanish_exploration: {
    id: 'national_spanish_exploration',
    year: 1492,
    land: 'es',
    requiresHomeland: true,
    title: 'An Age of Exploration',
    description: 'A gamble on an unproven westward route across the ocean pays off beyond anyone\'s expectations, opening an entire hemisphere no one at court had known existed.',
    options: [
      { label: 'Fund further expeditions immediately', effects: { gold: -150, spawnFollowUp: { id: 'colonial_venture_1', delayTurns: 4 } } },
      { label: 'Consolidate what the first voyage found', effects: { gold: 100, stability: 1 } }
    ]
  },
  national_dutch_golden_age: {
    id: 'national_dutch_golden_age',
    year: 1648,
    land: 'nl',
    requiresHomeland: true,
    title: 'A Golden Age of Trade',
    description: 'Merchant fleets and a new kind of joint-stock company make your ports the busiest in the world, and your merchants some of the wealthiest.',
    options: [
      { label: 'Charter more trading companies', effects: { gold: -100, prestige: 20 } },
      { label: 'Tax the existing trade heavily instead', effects: { gold: 150 } }
    ]
  },
  national_russian_reforms: {
    id: 'national_russian_reforms',
    year: 1700,
    land: 'ru',
    requiresHomeland: true,
    title: "A Ruler's Reforms",
    description: 'A sweeping campaign of westernizing reform remakes the army, the bureaucracy, and the court almost overnight — welcomed by some, resented by many more.',
    options: [
      { label: 'Push the reforms through regardless of resistance', effects: { gold: -150, militaryStrengthBonus: 150, controlPenalty: 10 } },
      { label: 'Phase them in gradually', effects: { gold: -60, controlBonus: 5 } }
    ]
  }
};

// The nominal age of a year: the age whose [startYear, endYear) holds it; the last age holds its end year.
export const ageIdOfYear = (year) => AGE_ORDER.find((id) => year >= AGES[id].startYear && year < AGES[id].endYear)
  ?? (year < AGES[AGE_ORDER[0]].startYear ? AGE_ORDER[0] : LAST_AGE_ID);

// Each event's age, derived once from its year (eight-ages plan KTD6). The year stays only as the
// event's place inside its age and its sort key; no rule reads the calendar.
export const HISTORICAL_EVENTS = Object.fromEntries(
  Object.entries(RAW_HISTORICAL_EVENTS).map(([key, e]) => [key, { ...e, ageId: ageIdOfYear(e.year) }])
);

const TECHS_PER_AGE_SPREAD = 6;
/** How many of an age's techs a player must hold before the event dated `year` is due:
 * round(6 x (year - start) / (end - start)). */
export const eventTechsNeeded = (ageId, year) => {
  const age = AGES[ageId];
  if (!age) return 0;
  const share = (year - age.startYear) / (age.endYear - age.startYear);
  return Math.round(TECHS_PER_AGE_SPREAD * Math.max(0, Math.min(1, share)));
};
