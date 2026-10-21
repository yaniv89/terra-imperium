// src/data/crises.js
// History crises (differentiation plan U31, KTD14): world crises that start from conditions, never a
// date. Each is data over existing systems, run by src/engine/crises.js:
//   ages       the age window of the nations it hits (their research age, ageOf); an age id here is data
//   hits       a predicate (predicates.js) a major must meet, inside the window, to be hit
//   minHit     how many majors must be hit at once for the crisis to start (the world condition)
//   raiders    'coast' | 'inland': it also needs raider independents of that kind near the hit
//   effect     collapse (loyalty falls in the outer cities), surge (raiders get war bands, raids.js),
//              plague (an outbreak in the largest cities, plague.js), famine (people lost, the
//              population model), war (the two largest hit majors go to war, declareWar)
//   cooldown   reference turns before it may come again (speedTurns)
//   card       the opening story the player sees when hit: an event-deck link fired by id
// Hebrew: i18n/locales/data/he.crises.js.
export const CRISES = [
  { id: 'bronze_collapse', ages: ['bronze', 'bronze'], hits: { fact: 'cities', min: 3 }, minHit: 3, effect: 'collapse', cooldown: 200,
    card: { title: 'The Palaces Fall', desc: 'Trade between the great kingdoms has stopped. Granaries stand empty, scribes go unpaid, and the outer towns stop sending tribute to the capital.',
      options: [{ label: 'Open the royal stores', effects: { gold: -40, stability: 1 } }, { label: 'Hold the capital and let the towns fend for themselves', effects: { stability: -1, gold: 20 } }] } },
  { id: 'sea_peoples', ages: ['bronze', 'classical'], hits: { fact: 'coastal' }, minHit: 2, raiders: 'coast', effect: 'surge', cooldown: 150,
    card: { title: 'Raiders from the Sea', desc: 'Ships full of armed families have been sighted along the coast. They burn what they cannot carry.',
      options: [{ label: 'Pay for watchtowers on the shore', effects: { gold: -40, stability: 1 } }, { label: 'Pray the storms keep them away', effects: { prestige: -3 } }] } },
  { id: 'steppe_surge', ages: ['bronze', 'kingdoms'], hits: { fact: 'cities', min: 2 }, minHit: 2, raiders: 'inland', effect: 'surge', cooldown: 150,
    card: { title: 'Riders on the Horizon', desc: 'The herders of the dry lands are on the move, in numbers no one has seen before. Villages on the frontier send for help.',
      options: [{ label: 'Send gifts to their chiefs', effects: { gold: -50, prestige: -2 } }, { label: 'Call up the frontier', effects: { stability: -1, prestige: 3 } }] } },
  { id: 'great_plague', ages: ['classical', 'gunpowder'], hits: { all: [{ fact: 'maxSize', min: 5 }, { fact: 'trade' }] }, minHit: 2, effect: 'plague', cooldown: 200,
    card: { title: 'The Great Sickness', desc: 'A sickness travels with the caravans and the ships. The largest cities are struck first.',
      options: [{ label: 'Close the city gates to travellers', effects: { gold: -40 } }, { label: 'Keep the markets open', effects: { gold: 30, stability: -1 } }] } },
  { id: 'little_ice_age', ages: ['kingdoms', 'gunpowder'], hits: { fact: 'cities', min: 3 }, minHit: 3, effect: 'famine', cooldown: 250,
    card: { title: 'The Cold Years', desc: 'Summers come late and short. Frost takes the harvest two years running, and hungry families leave the towns.',
      options: [{ label: 'Buy grain from abroad', effects: { gold: -60, stability: 1 } }, { label: 'Ration what is left', effects: { stability: -1 } }] } },
  { id: 'world_war', ages: ['modern', 'modern'], hits: { fact: 'cities', min: 4 }, minHit: 4, effect: 'war', cooldown: 200,
    card: { title: 'The World at War', desc: 'Two great powers have gone to war, and their alliances are pulling the rest of the world in behind them.',
      options: [{ label: 'Stay out and trade with both sides', effects: { gold: 60, prestige: -3 } }, { label: 'Ready the army', effects: { stability: 1, gold: -30 } }] } }
];

/** The deck id of a crisis's opening story. */
export const crisisCardId = (id) => `crisis_${id}`;

/** The opening stories as event-deck links (eventDeck.js CARDS). */
export const CRISIS_LINKS = Object.fromEntries(CRISES.map((c) => [crisisCardId(c.id), { id: crisisCardId(c.id), title: c.card.title, description: c.card.desc, options: c.card.options }]));
