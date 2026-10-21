// src/data/eventDeck/stories.js
// Linked stories of the event deck (differentiation plan U27): 15 stories of four cards. The first
// card of a story is a draw (eventDeck.js): it takes a city of the player's as its subject, once a
// game, inside its age. The others are links: an option with `to` schedules the next card `to`
// reference turns later, an option without it ends the story. Hebrew: i18n/locales/data/he.deck.js.
// Gold is paced by age (Stone about 20 to 50, Modern about 150 to 300). No captives, no atrocities.
// Not linked to the battle cards (src/data/battleCards.js) yet: that is U23's file.
//   story = { id, ages: [first, last], subject, also?, cards: [{ title, desc, options: [{ label, effects, to? }] } x4] }
//   subject: any | river | coast | frontier   (the opener's city; {city} in its text)
export const STORIES = [
  // ---- Stone Age ----
  { id: 'deck_hearth_keepers', ages: ['stone', 'stone'], subject: 'any', cards: [
    { title: 'The Hearth Keepers', desc: 'Some families in {city} guard the village fire day and night, and they ask to be freed from the hunt to do it.',
      options: [
        { label: 'Set them apart as keepers', effects: { gold: -20, cityLoyalty: 5 }, to: 6 },
        { label: 'Let each family tend its own fire', effects: { cityFood: 5 }, to: 9 }
      ] },
    { title: 'Embers for a Neighbour', desc: 'A hungry band that lost its fire in a storm asks your keepers for embers to carry home.',
      options: [
        { label: 'Share the embers freely', effects: { prestige: 3, gold: -10 }, to: 7 },
        { label: 'Trade embers for dried meat', effects: { gold: 25 }, to: 7 }
      ] },
    { title: 'The Long Night', desc: 'A cold, wet winter tests the fire. The keepers say it will burn through the dark if you give them wood from the common store.',
      options: [
        { label: 'Open the wood store', effects: { gold: -25, stability: 1 }, to: 8 },
        { label: 'Ration the wood by household', effects: { cityUnrest: 5, gold: 10 }, to: 8 }
      ] },
    { title: 'The Fire Gathering', desc: 'Spring comes, and every household asks to bring its torch to the old hearth for a night of songs and stories.',
      options: [
        { label: 'Hold the gathering each year', effects: { prestige: 8, stability: 1 } },
        { label: 'Let the old custom fade', effects: { gold: 30 } }
      ] }
  ] },
  { id: 'deck_salt_shore', ages: ['stone', 'stone'], subject: 'coast', cards: [
    { title: 'White Crust on the Rocks', desc: 'Children near {city} find white crust drying on the shore rocks. It tastes sharp, and it keeps meat from spoiling.',
      options: [
        { label: 'Send gatherers to collect it', effects: { gold: -15, cityFood: 10 }, to: 6 },
        { label: 'Keep it a family secret', effects: { gold: 20 }, to: 8 },
        { label: 'Ignore it', effects: {} }
      ] },
    { title: 'Salted Meat', desc: 'The salted meat lasts through the lean months, and inland bands want to know how it is made.',
      options: [
        { label: 'Teach the method to visitors', effects: { prestige: 4, techPoints: 10 }, to: 7 },
        { label: 'Sell salt but keep the craft', effects: { gold: 40 }, to: 7 }
      ] },
    { title: 'The Salt Path', desc: 'Traders have worn a path from the shore to the hills. Raiders have also noticed it.',
      options: [
        { label: 'Post watchers along the path', effects: { gold: -25, defenseBonus: 0.04 }, to: 8 },
        { label: 'Travel in large groups only', effects: { gold: 15, controlPenalty: 2 }, to: 8 }
      ] },
    { title: 'The Salt Market', desc: 'Bands from far hills meet each season at the shore to swap furs, flint and stone for your salt.',
      options: [
        { label: 'Host the market and keep the peace', effects: { gold: 60, prestige: 5 } },
        { label: 'Take a share of every deal', effects: { gold: 90, cityUnrest: 5 } }
      ] }
  ] },
  { id: 'deck_painted_cave', ages: ['stone', 'stone'], subject: 'any', cards: [
    { title: 'The Painted Cave', desc: 'Hunters from {city} find a cave where an old hand painted herds on the wall. Nobody remembers who.',
      options: [
        { label: 'Guard it as a holy place', effects: { gold: -15, cityLoyalty: 5 }, to: 7 },
        { label: 'Let anyone visit', effects: { prestige: 3 }, to: 7 },
        { label: 'Leave it undisturbed', effects: { stability: 1 } }
      ] },
    { title: 'New Painters', desc: 'Young people begin to paint beside the old herds. The elders argue about whether this honours the cave or spoils it.',
      options: [
        { label: 'Let the young add their own scenes', effects: { techPoints: 10, stability: -1 }, to: 7 },
        { label: 'Keep the old wall untouched', effects: { stability: 1 }, to: 7 }
      ] },
    { title: 'Pilgrims at the Cave', desc: 'Strangers walk many days to see the paintings and ask to join the dances held before them.',
      options: [
        { label: 'Welcome them as guests', effects: { gold: 30, prestige: 4 }, to: 8 },
        { label: 'Keep the cave for your own people', effects: { cityLoyalty: 5 }, to: 8 }
      ] },
    { title: 'The Cave Remembered', desc: 'Your storytellers now tell of the cave in every camp, and the paintings have become part of who your people are.',
      options: [
        { label: 'Name a keeper of the stories', effects: { prestige: 8, techPoints: 15 } },
        { label: 'Let each camp tell it in its own way', effects: { stability: 1, gold: 30 } }
      ] }
  ] },
  // ---- Bronze Age ----
  { id: 'deck_bronze_smiths', ages: ['bronze', 'bronze'], subject: 'any', cards: [
    { title: 'A Smith Comes to Town', desc: 'A travelling smith offers to settle in {city} and teach the casting of bronze, if you give him a workshop.',
      options: [
        { label: 'Build him a workshop', effects: { gold: -60, techPoints: 25 }, to: 7 },
        { label: 'Buy his tools and send him on', effects: { gold: -30, militaryStrengthBonus: 10 }, to: 9 },
        { label: 'Turn him away', effects: {} }
      ] },
    { title: 'The Tin Shortage', desc: 'The smiths have more orders than tin. Caravans can bring more, but the price is high.',
      options: [
        { label: 'Pay for a tin caravan', effects: { gold: -70, militaryStrengthBonus: 20 }, to: 8 },
        { label: 'Melt old tools for the metal', effects: { gold: 20, controlPenalty: 2 }, to: 8 }
      ] },
    { title: 'The Smiths\' Guild', desc: 'The smiths want to form a guild to guard their trade secrets and set prices together.',
      options: [
        { label: 'Grant the guild a charter', effects: { gold: 50, controlPenalty: 2 }, to: 9 },
        { label: 'Keep the trade open to all', effects: { techPoints: 20, gold: -20 }, to: 9 }
      ] },
    { title: 'The First Bronze Blade', desc: 'The best smith finishes a blade finer than any seen before and asks what it should be used for.',
      options: [
        { label: 'Arm your guards with the new design', effects: { militaryStrengthBonus: 30, gold: -40 } },
        { label: 'Present it as a gift to a rival', effects: { prestige: 12, gold: -20 } }
      ] }
  ] },
  { id: 'deck_granary_ledger', ages: ['bronze', 'bronze'], subject: 'river', cards: [
    { title: 'Counting the Grain', desc: 'The river around {city} gave a huge harvest. Temple clerks propose to record every sack so none is lost or stolen.',
      options: [
        { label: 'Fund the clerks', effects: { gold: -50, techPoints: 20 }, to: 7 },
        { label: 'Trust the old ways', effects: { cityFood: 5 }, to: 9 }
      ] },
    { title: 'A Gap in the Ledger', desc: 'The clerks find that a quarter of the grain is missing from the store, and cannot say how.',
      options: [
        { label: 'Hold an open inquiry', effects: { stability: 1, gold: -25 }, to: 7 },
        { label: 'Quietly add guards', effects: { gold: -40, cityLoyalty: 3 }, to: 7 }
      ] },
    { title: 'The Dry Year', desc: 'The river runs low and the fields fail. The ledger shows exactly what the granary holds.',
      options: [
        { label: 'Share the grain by need', effects: { cityFood: 10, cityLoyalty: 5 }, to: 8 },
        { label: 'Sell some to buy seed for next year', effects: { gold: 70, cityUnrest: 5 }, to: 8 }
      ] },
    { title: 'The Clerks\' School', desc: 'Families now send their sons and daughters to learn the clerks\' marks, and the ledgers fill whole rooms.',
      options: [
        { label: 'Open a school beside the granary', effects: { gold: -60, techPoints: 40, prestige: 5 } },
        { label: 'Keep the craft within a few families', effects: { gold: 50, stability: 1 } }
      ] }
  ] },
  { id: 'deck_harbour_convoy', ages: ['bronze', 'bronze'], subject: 'coast', cards: [
    { title: 'A New Harbour', desc: 'Merchants from {city} ask to dredge a deep channel so larger boats can unload at the quay.',
      options: [
        { label: 'Pay for the channel', effects: { gold: -80, prestige: 5 }, to: 7 },
        { label: 'Let merchants pay and take the fees', effects: { gold: 25 }, to: 9 }
      ] },
    { title: 'Lost Cargoes', desc: 'Pirates have begun taking boats along the coast, and the merchants fear to sail alone.',
      options: [
        { label: 'Escort boats with warships', effects: { gold: -60, militaryStrengthBonus: 20 }, to: 7 },
        { label: 'Pay the pirates to leave your boats alone', effects: { gold: -40, prestige: -3 }, to: 7 }
      ] },
    { title: 'The Convoy', desc: 'Captains propose to sail together in a convoy, sharing the cost of guards and the risk of loss.',
      options: [
        { label: 'Organise the convoy', effects: { gold: 30, controlBonus: 2 }, to: 8 },
        { label: 'Let captains choose for themselves', effects: { gold: 10 }, to: 8 }
      ] },
    { title: 'Ships of Many Lands', desc: 'The quay is crowded with strangers\' ships, and the harbour master asks how newcomers should be treated.',
      options: [
        { label: 'Offer fair terms to all', effects: { gold: 90, prestige: 6 } },
        { label: 'Favour your own merchants', effects: { gold: 50, cityLoyalty: 5 } }
      ] }
  ] },
  // ---- Classical Age ----
  { id: 'deck_long_road', ages: ['classical', 'classical'], subject: 'any', cards: [
    { title: 'A Road to Build', desc: 'Engineers from {city} propose a paved road to the next great town, straight over hill and marsh.',
      options: [
        { label: 'Build the whole road at once', effects: { gold: -140, controlBonus: 4 }, to: 7 },
        { label: 'Build it in stages', effects: { gold: -70 }, to: 10 },
        { label: 'Keep to the old tracks', effects: {} }
      ] },
    { title: 'Bandits on the Road', desc: 'Travellers report robbers hiding in the hills beside the new road, and trade has begun to slow.',
      options: [
        { label: 'Station soldiers at the milestones', effects: { gold: -80, defenseBonus: 0.04 }, to: 7 },
        { label: 'Hire local guides who know the hills', effects: { gold: -40, cityLoyalty: 3 }, to: 7 }
      ] },
    { title: 'Tolls and Inns', desc: 'Innkeepers want to build along the road, and the treasury wonders whether to charge a toll.',
      options: [
        { label: 'Charge a modest toll', effects: { gold: 110, controlBonus: 2 }, to: 8 },
        { label: 'Keep the road free', effects: { prestige: 8, cityLoyalty: 5 }, to: 8 }
      ] },
    { title: 'The Milestone', desc: 'The last stone is set, and a traveller can walk from end to end counting every mile. A tablet is ready to say who built it.',
      options: [
        { label: 'Carve the ruler\'s name on it', effects: { prestige: 12, gold: -30 } },
        { label: 'Carve the builders\' names instead', effects: { stability: 1, cityLoyalty: 5 } }
      ] }
  ] },
  { id: 'deck_great_library', ages: ['classical', 'classical'], subject: 'any', cards: [
    { title: 'A Library for {city}', desc: 'A scholar in {city} offers her own scrolls and asks for a hall where others may read and copy them.',
      options: [
        { label: 'Build the hall', effects: { gold: -120, techPoints: 40 }, to: 7 },
        { label: 'Offer a smaller room in the temple', effects: { gold: -50, techPoints: 15 }, to: 9 },
        { label: 'Decline', effects: {} }
      ] },
    { title: 'Scrolls from Abroad', desc: 'Your scholars ask permission to copy every scroll that comes through the harbour and the gates.',
      options: [
        { label: 'Copy and return the originals', effects: { gold: -60, techPoints: 40 }, to: 7 },
        { label: 'Keep the originals and pay the owners', effects: { gold: -100, prestige: 6, techPoints: 20 }, to: 7 }
      ] },
    { title: 'The Lamp Fire', desc: 'A fallen lamp burns part of the reading room before it is put out. Some say the library should be moved.',
      options: [
        { label: 'Rebuild with stone shelves', effects: { gold: -90, defenseBonus: 0.02 }, to: 8 },
        { label: 'Copy the damaged scrolls first', effects: { gold: -40, techPoints: 20 }, to: 8 }
      ] },
    { title: 'Readers from Many Lands', desc: 'Students travel for months to read in your library, and ask whether they may stay and teach.',
      options: [
        { label: 'Welcome them as teachers', effects: { techPoints: 60, prestige: 8, gold: -50 } },
        { label: 'Let them read but not teach', effects: { gold: 50, techPoints: 20 } }
      ] }
  ] },
  // ---- Kingdoms Age ----
  { id: 'deck_guild_charter', ages: ['kingdoms', 'kingdoms'], subject: 'any', cards: [
    { title: 'Masters Ask for a Charter', desc: 'The weavers and masons of {city} ask for a charter that lets them set their own standards and train their own apprentices.',
      options: [
        { label: 'Grant the charter', effects: { gold: 120, controlPenalty: 3 }, to: 7 },
        { label: 'Grant it with fees to the crown', effects: { gold: 200, cityUnrest: 5 }, to: 7 },
        { label: 'Refuse', effects: { controlBonus: 2 } }
      ] },
    { title: 'A Dispute of Trades', desc: 'The masons say the carpenters are doing their work, and each guild asks you to settle the matter.',
      options: [
        { label: 'Hear both sides in open court', effects: { stability: 1, gold: -30 }, to: 8 },
        { label: 'Divide the work by custom', effects: { cityLoyalty: 3 }, to: 8 }
      ] },
    { title: 'The Apprentices\' Complaint', desc: 'Apprentices say they work for years with little pay or promise of a master\'s place.',
      options: [
        { label: 'Limit apprenticeships to seven years', effects: { cityLoyalty: 6, gold: -50 }, to: 9 },
        { label: 'Leave it to the guilds', effects: { gold: 40, cityUnrest: 6 }, to: 9 }
      ] },
    { title: 'The Guild Hall', desc: 'The guilds offer to pay for a grand hall in the market square, if their banners may hang in it.',
      options: [
        { label: 'Accept the hall and the banners', effects: { prestige: 12, gold: 100 } },
        { label: 'Build a town hall for everyone', effects: { prestige: 8, cityLoyalty: 6, gold: -80 } }
      ] }
  ] },
  { id: 'deck_border_fair', ages: ['kingdoms', 'kingdoms'], subject: 'frontier', cards: [
    { title: 'A Fair at the Border', desc: 'Merchants on both sides of the frontier near {city} ask to hold a yearly fair under a truce of one week.',
      options: [
        { label: 'Host the fair', effects: { gold: -50, prestige: 5 }, to: 6 },
        { label: 'Let the merchants arrange it', effects: { gold: 20 }, to: 8 },
        { label: 'Forbid it', effects: { controlBonus: 2 } }
      ] },
    { title: 'A Quarrel at the Stalls', desc: 'A fight over a stolen purse grows into a shouting match between local people and visitors.',
      options: [
        { label: 'Send judges from both sides', effects: { stability: 1, gold: -30 }, to: 7 },
        { label: 'Close the fair for the day', effects: { cityUnrest: 3 }, to: 7 }
      ] },
    { title: 'Who Collects the Tolls', desc: 'Officials on both sides want to charge visitors at the gate, which would price out the small traders.',
      options: [
        { label: 'Share the tolls equally', effects: { gold: 80, prestige: 3 }, to: 8 },
        { label: 'Charge only your own side\'s gate', effects: { gold: 130, cityLoyalty: -3 }, to: 8 }
      ] },
    { title: 'The Fair Grows', desc: 'Each year the fair is larger. A town has begun to grow where the tents once stood.',
      options: [
        { label: 'Found a market town there', effects: { gold: -100, hr: 20, prestige: 6 } },
        { label: 'Keep it a seasonal fair', effects: { gold: 100, stability: 1 } }
      ] }
  ] },
  // ---- Gunpowder Age ----
  { id: 'deck_printing_press', ages: ['gunpowder', 'gunpowder'], subject: 'any', cards: [
    { title: 'The Printer of {city}', desc: 'A craftsman in {city} has built a press that can print a hundred pages in the time a scribe copies one.',
      options: [
        { label: 'Fund his workshop', effects: { gold: -150, techPoints: 50 }, to: 7 },
        { label: 'Grant him a licence and a fee', effects: { gold: 100 }, to: 8 },
        { label: 'Ignore the novelty', effects: {} }
      ] },
    { title: 'Pamphlets and Almanacs', desc: 'Cheap printed pages spread through the markets: almanacs, songs, sermons and arguments about how the realm is run.',
      options: [
        { label: 'Welcome the debate', effects: { prestige: 8, stability: -1 }, to: 7 },
        { label: 'Print notices of your own', effects: { controlBonus: 3, gold: -40 }, to: 7 }
      ] },
    { title: 'The Question of Licences', desc: 'Some councillors want every printed page approved first. Printers say that would ruin their trade.',
      options: [
        { label: 'Require approval only for notices of law', effects: { stability: 1, gold: 40 }, to: 9 },
        { label: 'Leave the press free', effects: { techPoints: 40, controlPenalty: 3 }, to: 9 }
      ] },
    { title: 'Books for the Many', desc: 'Schoolmasters ask for printed primers so that every town may teach children to read.',
      options: [
        { label: 'Pay for a primer in every town', effects: { gold: -180, techPoints: 70, cityLoyalty: 5 } },
        { label: 'Let buyers pay for their own', effects: { gold: 80, techPoints: 25 } }
      ] }
  ] },
  { id: 'deck_foundry_guns', ages: ['gunpowder', 'gunpowder'], subject: 'any', cards: [
    { title: 'The Founder\'s Offer', desc: 'A bell founder in {city} claims he can cast iron guns that outlast the old bronze ones.',
      options: [
        { label: 'Commission a trial gun', effects: { gold: -150, militaryStrengthBonus: 30 }, to: 6 },
        { label: 'Ask him to keep casting bells', effects: { gold: 60, cityLoyalty: 3 }, to: 9 }
      ] },
    { title: 'The Test Firing', desc: 'The gun is hauled to the field. Townsfolk gather far behind the ropes, and the founder is pale.',
      options: [
        { label: 'Fire it with a double charge', effects: { gold: -40, militaryStrengthBonus: 40 }, to: 7 },
        { label: 'Fire it with a safe charge', effects: { gold: -20, militaryStrengthBonus: 20 }, to: 7 }
      ] },
    { title: 'Iron for the Foundry', desc: 'The foundry needs ore and charcoal, and the nearby woods are already thin. Foresters protest.',
      options: [
        { label: 'Buy ore from outside', effects: { gold: -120, militaryStrengthBonus: 20 }, to: 8 },
        { label: 'Cut the woods for charcoal', effects: { gold: -40, cityFood: -5, militaryStrengthBonus: 25 }, to: 8 }
      ] },
    { title: 'The Walls Answer', desc: 'Your engineers study how to build walls that can resist the new guns.',
      options: [
        { label: 'Rebuild the walls low and thick', effects: { gold: -180, defenseBonus: 0.08 } },
        { label: 'Put guns on the old walls instead', effects: { gold: -100, defenseBonus: 0.04, militaryStrengthBonus: 20 } }
      ] }
  ] },
  // ---- Modern Age ----
  { id: 'deck_railway_survey', ages: ['modern', 'modern'], subject: 'any', cards: [
    { title: 'Rails to {city}', desc: 'Surveyors propose an iron railway to {city}, and landowners along the way are not sure they want it.',
      options: [
        { label: 'Fund the line', effects: { gold: -250, techPoints: 40 }, to: 7 },
        { label: 'Let a private company build it', effects: { gold: -80 }, to: 9 },
        { label: 'Shelve the plan', effects: {} }
      ] },
    { title: 'Land for the Line', desc: 'Farmers and townsfolk on the route are asked to sell strips of land, some of them homes.',
      options: [
        { label: 'Pay a generous price', effects: { gold: -150, cityLoyalty: 5 }, to: 7 },
        { label: 'Reroute around the villages', effects: { gold: -100, controlBonus: 2 }, to: 9 }
      ] },
    { title: 'The First Train', desc: 'A crowd waits at the new station. The engine is late, and the crowd is not sure it will move at all.',
      options: [
        { label: 'Hold a public ceremony', effects: { prestige: 10, gold: -50 }, to: 8 },
        { label: 'Open the line quietly', effects: { gold: 40 }, to: 8 }
      ] },
    { title: 'Timetables', desc: 'Trains from many towns need one common clock. Each town still keeps its own time.',
      options: [
        { label: 'Set one clock for the whole realm', effects: { controlBonus: 4, gold: 200, techPoints: 30 } },
        { label: 'Let each region keep its time', effects: { stability: 1, gold: 100 } }
      ] }
  ] },
  { id: 'deck_water_works', ages: ['modern', 'modern'], subject: 'river', cards: [
    { title: 'Sickness by the Wells', desc: 'Fever spreads among the poor streets of {city}. A physician thinks the wells and the river share the blame.',
      options: [
        { label: 'Order a survey of the water', effects: { gold: -80, techPoints: 30 }, to: 6 },
        { label: 'Blame the bad air and wait', effects: { cityUnrest: 8 }, to: 8 }
      ] },
    { title: 'Engineers\' Plan', desc: 'Engineers propose pipes to bring clean water from upstream and sewers to carry waste far below the city.',
      options: [
        { label: 'Build both at once', effects: { gold: -300, cityLoyalty: 6 }, to: 8 },
        { label: 'Start with the water pipes', effects: { gold: -150 }, to: 8 }
      ] },
    { title: 'Who Pays the Rates', desc: 'The works need a new local rate. Wealthy districts want the poor to pay for their own pipes.',
      options: [
        { label: 'Charge by the value of property', effects: { gold: 100, cityLoyalty: 4 }, to: 7 },
        { label: 'Charge a flat rate on every household', effects: { gold: 150, cityUnrest: 6 }, to: 7 }
      ] },
    { title: 'Clean Water Flows', desc: 'The taps run clear, and the fever has not returned. Doctors say the city can now grow safely.',
      options: [
        { label: 'Open the city to more families', effects: { citySize: 1, hr: 30, prestige: 6 } },
        { label: 'Build public baths and fountains', effects: { gold: -100, cityLoyalty: 8, prestige: 8 } }
      ] }
  ] },
  { id: 'deck_radio_mast', ages: ['modern', 'modern'], subject: 'any', cards: [
    { title: 'A Mast over {city}', desc: 'Engineers raise a mast above {city} that can send voices across the realm, if you decide who may speak on it.',
      options: [
        { label: 'Run it as a public service', effects: { gold: -200, techPoints: 40 }, to: 7 },
        { label: 'License it to a private company', effects: { gold: 120 }, to: 8 },
        { label: 'Leave it unused', effects: {} }
      ] },
    { title: 'What Should Be Said', desc: 'The first broadcasts are music and weather. Officials ask to add lectures, news and your own addresses.',
      options: [
        { label: 'Schedule lessons for schools', effects: { techPoints: 60, cityLoyalty: 3 }, to: 7 },
        { label: 'Add daily news from the capital', effects: { controlBonus: 4, gold: -60 }, to: 7 }
      ] },
    { title: 'Rumours on the Air', desc: 'False reports of a bank failure spread by radio and cause a run on the banks.',
      options: [
        { label: 'Broadcast a calm, plain correction', effects: { stability: 1, gold: -100 }, to: 8 },
        { label: 'Require stations to check reports first', effects: { controlBonus: 3, prestige: -3 }, to: 8 }
      ] },
    { title: 'A Voice for Every Home', desc: 'Receivers become cheap. Families gather around them each evening to listen together.',
      options: [
        { label: 'Back a national programme of music and drama', effects: { prestige: 12, cityLoyalty: 6, gold: -120 } },
        { label: 'Leave programmes to the stations', effects: { gold: 200, techPoints: 20 } }
      ] }
  ] }
];
