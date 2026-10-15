// src/i18n/locales/msg/city.en.js
// Engine messages (phase H3): city. Keys and placeholders: src/engine/messages.js.
export default {
  // the cities phase (src/engine/world/cities.js processCity)
  'm.city.starves': '{city} starves and shrinks to {size}.',
  'm.city.starvesSiege': '{city} starves under siege and shrinks to {size}.',
  'm.city.grows': '{city} grows to size {size}.',
  'm.city.completesBuilding': '{city} completes a {building}.',
  'm.city.district': '{city} lays out its {district}.',
  'm.city.improvement': '{city} builds a {improvement}.',
  'm.city.settlers': '{city} sends out settlers.',
  'm.city.wonderAbandoned': '{city} abandons {wonder}: it stands elsewhere.',
  'm.city.wonderDone': '{city} completes {wonder} (tier {tier}).',
  'm.city.trainsForArmy': '{city} trains {unit} for {army} ({done}/{total}).',
  'm.city.armyComplete': '{army} is complete at {city}.',
  'm.city.trainsScouts': '{city} trains scouts.',
  'm.city.trains': '{city} trains {unit}.',
  'm.city.borders': '{city}\'s borders grow to {land}.',
  'm.city.newLand': 'new land',

  // loyalty (loyalty.js)
  'm.city.loyaltyLow': '{city} is losing its loyalty ({loyalty}): garrison it or raise its amenities.',
  'm.city.flipLost': '{city} has gone over to {nation}: its people no longer feel yours.',
  'm.city.flipGained': '{city} joins you: its people chose your rule.',
  'm.city.flipIndependent': '{city} has thrown off your rule and stands as {nation}, an independent city.',
  'm.city.flipFree': '{city} has thrown off your rule and stands as a free city.',

  // plague (plague.js) and city disasters (cityDisasters.js)
  'm.city.plagueOutbreak': 'Plague breaks out in {city}.',
  'm.city.plagueOver': 'The plague in {city} has burnt out{left}.',
  'm.city.plagueLeftSize': ', leaving it at size {size}',
  'm.city.plagueShrinks': 'Plague kills many in {city}: it shrinks to size {size}.',
  'm.city.plagueReaches': 'Plague reaches {city}.',
  'm.city.flood': 'The river floods {city}: half its stores are lost and the fields yield less for {turns} turns.',
  'm.city.fire': 'Fire sweeps through {city}: half its work in progress is lost and the workshops yield less for {turns} turns.',
  'm.city.plagueStrikesOne': 'Plague strikes {city}: {n} citizen lost and no growth for {turns} turns.',
  'm.city.plagueStrikesMany': 'Plague strikes {city}: {n} citizens lost and no growth for {turns} turns.',
};
