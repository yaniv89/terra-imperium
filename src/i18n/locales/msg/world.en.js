// src/i18n/locales/msg/world.en.js
// Engine messages (phase H3): world. Keys and placeholders: src/engine/messages.js.
export default {
  // shared pieces
  'm.world.listMore': '{a}, {b}',

  // settlers and outposts (settlers.js)
  'm.world.settlersLost': 'The settlers of {city} have no city left to go to and are lost.',
  'm.world.settlersReturn': '{city} fell: its settlers went back to {refuge}.',
  'm.world.settlersGiveUp': 'The settlers of {nation} found no land and went home.',
  'm.world.settlersBlocked': 'Your settlers cannot reach {place} and stop.',
  'm.world.theirDestination': 'their destination',
  'm.world.outpostFounded': '{city} is founded as an outpost.',
  'm.world.settlersNoRoom': 'Your settlers find no room at their destination: {reason}',
  'm.world.reasonLand': 'A city needs land.',
  'm.world.reasonIce': 'Nothing can live on the ice.',
  'm.world.reasonBelongs': 'This land belongs to another nation.',
  'm.world.reasonPromised': 'You promised not to settle this close to their cities.',
  'm.world.reasonTooClose': 'Too close to {city}.',
  'm.world.outpostGrown': '{city} has grown from an outpost into a city.',

  // research (research.js)
  'm.world.boost': 'Boost: {boost} speeds {tech} ({pct}% of its cost).',
  'm.world.researched': 'Researched {tech}.',
  'm.world.techAge': 'Your empire\'s expertise has reached the {age}.',
  'm.world.firstIntoAge': '{nation} enters the {age}, the first in the world.',

  // colonies (colonies.js)
  'm.world.colonyFoundedYou': 'Your settlers found a colony in {region}{driveOut}.',
  'm.world.colonyFounded': '{nation}\'s settlers found a colony in {region}{driveOut}.',
  'm.world.colonyDriveOut': ', driving out its people',
  'm.world.colonyAbandoned': 'The colony in {region} was abandoned.',
  'm.world.colonyEmptyYou': 'Your colony in {region} was left empty.',
  'm.world.colonyEmptyOf': '{nation} colony in {region} was left empty.',
  'm.world.colonyEmptyA': 'A colony in {region} was left empty.',
  'm.world.colonyOverrunYou': 'Your colony in {region} was overrun by raids and lost.',
  'm.world.colonyOverrunOf': '{nation} colony in {region} was overrun by raids and lost.',
  'm.world.colonyOverrunA': 'A colony in {region} was overrun by raids and lost.',
  'm.world.colonyRaided': 'Raiders struck your colony in {region} ({raids} of {max} before it falls).',
  'm.world.colonyGrownYou': 'Your colony in {region} has grown into a province.',
  'm.world.colonyGrown': '{nation}\'s colony in {region} has grown into a province.',

  // city-states (cityStates.js)
  'm.world.patronYou': '{nation} ({type} city-state) now favour you: {bonus} while they do.',
  'm.world.patronLost': '{nation} no longer favour you{now}.',
  'm.world.patronNow': '; they now favour {patron}',
  'm.world.bonusGold': '+{n} gold a turn',
  'm.world.bonusManpower': '+{n} manpower a turn',
  'm.world.bonusResearch': '+{n} research a turn',
  'm.world.bonusPrestige': '+{n} prestige a turn',

  // scouts, emergence, disasters
  'm.world.scoutsDone': 'Your scouts have found all the land they can reach. Send them to a tile of your choice, or disband them.',
  'm.world.emerges': '{nation} emerges at {city}.',
  'm.world.revolution': '{nation}: revolution overturns the old order.',

  // rulers (rulers.js successionLine) and era goals (eraGoals.js)
  'm.world.succession': '{ended}{ruler} of House {house} now rules (ADM {adm}, DIP {dip}, MIL {mil}{traits}).',
  'm.world.reignEnded': '{ruler} of House {house} reigned {turns} turns. ',
  'm.world.successionTraits': '; {traits}',
  'm.world.noLegacy': 'The {age} ends with {n} of its goals met: no legacy carries over.',
  'm.world.legacy': 'Legacy of the {age}: {bonuses} for {turns} turns.',

  // event choices (applyEventEffects.js)
  'm.world.eventCantAfford': 'You can\'t afford "{option}" ({missing}).',
  'm.world.eventCouldNotPay': 'The crown could not pay in full ({missing}). (-1 stability)',
  'm.world.risesAgain': '{nation} rises again!',
  'm.world.eventPeace': 'PEACE signed with {nation}!',
  'm.world.eventTrade': 'Trade agreement with {nation}!',
  'm.world.eventWar': 'WAR declared on {nation}!',
  'm.world.eventVictory': 'VICTORY!',
  'm.world.eventChoice': 'Event: {event} → {option}',

  // the tutorial (tutorial.js) and old saves (saveMigrations.js)
  'm.world.tutorialDone': 'The guide ends: every step done. Egypt is yours.',
  'm.world.tutorialEnds': 'The guide ends after {turns} turns with {done} of {total} steps done. The next prompt keeps pointing at what wants a decision.',
  'm.world.mapSimplified': 'The map was simplified: small provinces were merged into larger regions ({from} provinces became {to} regions).{split}',
  'm.world.mapSplitOwners': ' {n} merged regions had more than one owner and went to the one holding most of their people.',
};
