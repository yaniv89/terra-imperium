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
//   answer     the card a major inside the window that it spares sees when it strikes (events-8, after
//              Civ VI's emergencies): aid the struck (their grudge falls: struckHostility), profit from
//              them (their grudge rises), or stay out
// Hebrew: i18n/locales/data/he.crises.js.
export const CRISES = [
  { id: 'bronze_collapse', ages: ['bronze', 'bronze'], hits: { fact: 'cities', min: 3 }, minHit: 3, effect: 'collapse', cooldown: 200,
    card: { title: 'The Palaces Fall', desc: 'Trade between the great kingdoms has stopped. Granaries stand empty, scribes go unpaid, and the outer towns stop sending tribute to the capital.',
      options: [{ label: 'Open the royal stores', effects: { gold: -40, stability: 1 } }, { label: 'Hold the capital and let the towns fend for themselves', effects: { stability: -1, gold: 20 } }] },
    answer: { title: 'The Palaces Fall Abroad', desc: 'Trade between the great kingdoms has stopped, and their outer towns no longer send tribute home. Their envoys come to you for grain; their unpaid soldiers come looking for work.',
      options: [{ label: 'Send grain to the stricken kingdoms', effects: { gold: -40, prestige: 5, struckHostility: -15 } }, { label: 'Hire their unpaid soldiers', effects: { gold: -40, hr: 30, struckHostility: 10 } }, { label: 'Close the roads to their refugees', effects: { stability: 1, prestige: -3 } }] } },
  { id: 'sea_peoples', ages: ['bronze', 'classical'], hits: { fact: 'coastal' }, minHit: 2, raiders: 'coast', effect: 'surge', cooldown: 150,
    card: { title: 'Raiders from the Sea', desc: 'Ships full of armed families have been sighted along the coast. They burn what they cannot carry.',
      options: [{ label: 'Pay for watchtowers on the shore', effects: { gold: -40, stability: 1 } }, { label: 'Pray the storms keep them away', effects: { prestige: -3 } }] },
    answer: { title: 'Raiders Strike the Coasts', desc: 'Ships full of armed families are burning the harbours of other kingdoms. Survivors and traders flee along the coast to your ports.',
      options: [{ label: 'Take in the survivors', effects: { hr: 20, cityUnrest: 5, struckHostility: -10 } }, { label: 'Buy their plunder in your markets', effects: { gold: 40, prestige: -4, struckHostility: 15 } }, { label: 'Fortify your own shore', effects: { gold: -30, defenseBonus: 0.04 } }] } },
  { id: 'steppe_surge', ages: ['bronze', 'kingdoms'], hits: { fact: 'cities', min: 2 }, minHit: 2, raiders: 'inland', effect: 'surge', cooldown: 150,
    card: { title: 'Riders on the Horizon', desc: 'The herders of the dry lands are on the move, in numbers no one has seen before. Villages on the frontier send for help.',
      options: [{ label: 'Send gifts to their chiefs', effects: { gold: -50, prestige: -2 } }, { label: 'Call up the frontier', effects: { stability: -1, prestige: 3 } }] },
    answer: { title: 'Riders Fall on Your Neighbours', desc: 'The herders of the dry lands are riding through the frontier villages of other realms. Their kings ask you for horses and men.',
      options: [{ label: 'Send horses and men', effects: { hr: -30, prestige: 6, struckHostility: -15 } }, { label: 'Pay the riders to ride elsewhere', effects: { gold: -50, struckHostility: 10, stability: 1 } }, { label: 'Watch and wait', effects: { prestige: -2 } }] } },
  { id: 'great_plague', ages: ['classical', 'gunpowder'], hits: { all: [{ fact: 'maxSize', min: 5 }, { fact: 'trade' }] }, minHit: 2, effect: 'plague', cooldown: 200,
    card: { title: 'The Great Sickness', desc: 'A sickness travels with the caravans and the ships. The largest cities are struck first.',
      options: [{ label: 'Close the city gates to travellers', effects: { gold: -40 } }, { label: 'Keep the markets open', effects: { gold: 30, stability: -1 } }] },
    answer: { title: 'Sickness in Other Lands', desc: 'A sickness is emptying the great cities of other realms. Their physicians beg for help; your merchants see empty markets to fill.',
      options: [{ label: 'Send your physicians', effects: { hr: -20, techPoints: 15, struckHostility: -10 } }, { label: 'Fill their empty markets', effects: { gold: 50, stability: -1, struckHostility: 10 } }, { label: 'Close your gates to their caravans', effects: { gold: -20, controlBonus: 2 } }] } },
  { id: 'little_ice_age', ages: ['kingdoms', 'gunpowder'], hits: { fact: 'cities', min: 3 }, minHit: 3, effect: 'famine', cooldown: 250,
    card: { title: 'The Cold Years', desc: 'Summers come late and short. Frost takes the harvest two years running, and hungry families leave the towns.',
      options: [{ label: 'Buy grain from abroad', effects: { gold: -60, stability: 1 } }, { label: 'Ration what is left', effects: { stability: -1 } }] },
    answer: { title: 'Frost Takes Their Harvest', desc: 'Frost has taken the harvest in other realms two years running. Their grain buyers are at your gates, ready to pay any price.',
      options: [{ label: 'Share your stores at a fair price', effects: { gold: 20, controlPenalty: 3, struckHostility: -10 } }, { label: 'Sell to the highest bidder', effects: { gold: 80, prestige: -4, struckHostility: 15 } }, { label: 'Keep every sack at home', effects: { stability: 1, prestige: -2 } }] } },
  { id: 'world_war', ages: ['modern', 'modern'], hits: { fact: 'cities', min: 4 }, minHit: 4, effect: 'war', cooldown: 200,
    card: { title: 'The World at War', desc: 'Two great powers have gone to war, and their alliances are pulling the rest of the world in behind them.',
      options: [{ label: 'Stay out and trade with both sides', effects: { gold: 60, prestige: -3 } }, { label: 'Ready the army', effects: { stability: 1, gold: -30 } }] },
    answer: { title: 'A War of the Great Powers', desc: 'Two great powers are at war and their alliances are pulling the world in. Both sides court you for loans, arms and men.',
      options: [{ label: 'Lend to the side under attack', effects: { gold: -60, prestige: 6, struckHostility: -10 } }, { label: 'Sell arms to both sides', effects: { gold: 80, stability: -1, struckHostility: 10 } }, { label: 'Declare strict neutrality', effects: { stability: 1, prestige: -3 } }] } },
  // events-8: the last two ages had no crisis.
  { id: 'global_pandemic', ages: ['information', 'future'], hits: { all: [{ fact: 'maxSize', min: 5 }, { fact: 'trade' }] }, minHit: 2, effect: 'plague', cooldown: 200,
    card: { title: 'A New Pandemic', desc: 'A new virus travels the air routes faster than any warning. Hospitals in the great cities fill first.',
      options: [{ label: 'Close the borders and the airports', effects: { gold: -60, stability: 1, prestige: -2 } }, { label: 'Keep the economy open', effects: { gold: 40, stability: -1 } }] },
    answer: { title: 'Pandemic Abroad', desc: 'A new virus is filling the hospitals of other nations. They ask for doctors and vaccines; your industry sees their empty shelves.',
      options: [{ label: 'Send doctors and vaccines', effects: { hr: -20, prestige: 6, struckHostility: -15 } }, { label: 'Sell them supplies at a premium', effects: { gold: 80, prestige: -4, struckHostility: 10 } }, { label: 'Close the borders to them', effects: { gold: -30, controlBonus: 2 } }] } },
  { id: 'climate_shock', ages: ['information', 'future'], hits: { fact: 'cities', min: 4 }, minHit: 3, effect: 'famine', cooldown: 250,
    card: { title: 'The Hungry Decade', desc: 'Droughts, floods and failed monsoons come in the same years. Harvests fall short and people leave the stricken towns.',
      options: [{ label: 'Buy food on the world market', effects: { gold: -80, stability: 1 } }, { label: 'Ration and rebuild', effects: { stability: -1, techPoints: 20 } }] },
    answer: { title: 'Harvests Fail Abroad', desc: 'Droughts and floods have broken the harvests of other nations, and climate refugees gather at their borders and at yours.',
      options: [{ label: 'Take in climate refugees', effects: { hr: 30, controlPenalty: 3, struckHostility: -10 } }, { label: 'Sell them grain at market prices', effects: { gold: 80, prestige: -4, struckHostility: 10 } }, { label: 'Fund their climate defences', effects: { gold: -60, techPoints: 15, struckHostility: -5 } }] } }
];

/** The deck id of a crisis's opening story. */
export const crisisCardId = (id) => `crisis_${id}`;

/** The deck id of a crisis's answer card (a spared major's). */
export const crisisAnswerId = (id) => `crisis_${id}_answer`;

/** The opening stories and the answer cards as event-deck links (eventDeck.js CARDS). */
export const CRISIS_LINKS = Object.fromEntries(CRISES.flatMap((c) => [
  [crisisCardId(c.id), { id: crisisCardId(c.id), title: c.card.title, description: c.card.desc, options: c.card.options }],
  [crisisAnswerId(c.id), { id: crisisAnswerId(c.id), title: c.answer.title, description: c.answer.desc, options: c.answer.options }]
]));
