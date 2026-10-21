// src/engine/eventDeck.js
// The event deck (differentiation plan KTD13, KTD19): the one picker of the player's events. Every
// event is a card, checked through the predicates shared with ambitions (predicates.js):
//   story   a scripted event (data/events.js), once per game, in its age at its point of progress
//           (its year only orders the deck and sets that point: no rule reads the calendar);
//           `land` keys a curated one to the player's people's country (peoples.js)
//   link    a follow-up (data/eventChains.js), only fired by a link: an option's
//           effects.spawnFollowUp, due a delay in reference turns later, with the city it bound
//   draw    a procedural card (data/proceduralEvents.js): `requires`, a city subject drawn from
//           `subjects.city`, a weight, and cooldowns per card, family and city (`once`: a story's opener, never twice)
// A turn shows at most one: a due story first, then a due link, then sometimes a draw. Memory sits
// in state.firedEvents (stories and links), state.pendingEventChains (links waiting) and
// state.eventHistory (draw cooldowns). Pure; draws use the turn's seeded rng.
import { HISTORICAL_EVENTS, ageIdOfYear, eventTechsNeeded } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { PROCEDURAL_TEMPLATES } from '../data/proceduralEvents';
import { DECK_DRAWS, DECK_LINKS } from '../data/eventDeck/index';
import { CRISIS_LINKS } from '../data/crises';
import { getAgeIndex, speedCostMult } from '../data/ages';
import { countryOfNation } from '../data/peoples';
import { factContext, predicateMet } from './predicates';
import { ageOf } from './nationState';

// The player has reached the point of an age that `year` marks: in that age with enough of its techs.
const atPoint = (year) => {
  const ageId = ageIdOfYear(year);
  const i = getAgeIndex(ageId);
  return { all: [{ fact: 'ageIndex', min: i, max: i }, { fact: 'ageTechs', min: eventTechsNeeded(ageId, year) }] };
};
// ...or is already past that age.
const reached = (year) => ({ any: [{ fact: 'ageIndex', min: getAgeIndex(ageIdOfYear(year)) + 1 }, atPoint(year)] });

/** A scripted event as a story card: its year and old `requires` become one predicate. */
export const storyCard = (e) => {
  const r = e.requires || {};
  const all = [atPoint(e.year)];
  if (r.coastal) all.push({ fact: 'coastal' });
  if (r.minCities) all.push(r.orByYear != null ? { any: [{ fact: 'cities', min: r.minCities }, reached(r.orByYear)] } : { fact: 'cities', min: r.minCities });
  if (e.requiresHomeland) all.push({ fact: 'homeland' });
  return { ...e, kind: 'story', requires: { all } };
};

/** Every card by id: stories, links and draws. */
export const CARDS = Object.fromEntries([
  ...Object.values(HISTORICAL_EVENTS).map((e) => [e.id, storyCard(e)]),
  ...Object.values({ ...EVENT_CHAINS, ...DECK_LINKS, ...CRISIS_LINKS }).map((e) => [e.id, { ...e, kind: 'link' }]),
  ...[...PROCEDURAL_TEMPLATES, ...DECK_DRAWS].map((t) => [t.id, { ...t, kind: 'draw' }])
]);
const DRAWS = Object.values(CARDS).filter((c) => c.kind === 'draw');

/** The event an id names on the state (a story or a link fired by id). */
export const cardOf = (id) => (CARDS[id]?.kind === 'draw' ? null : CARDS[id] || null);

/** True when a story card may fire for the player now. */
export const storyDue = (state, card, ctx = factContext(state, state.playerNationId)) =>
  !state.firedEvents?.[card.id] && (!card.land || card.land === countryOfNation(state.playerNationId)) && predicateMet(card.requires, ctx);

/** The due story placed earliest (by its scripted year, then declaration order), or null. */
export const nextStory = (state) => {
  const ctx = factContext(state, state.playerNationId);
  const due = Object.values(CARDS).filter((c) => c.kind === 'story' && storyDue(state, c, ctx));
  return due.sort((a, b) => a.year - b.year)[0] || null;
};

// Cooldowns (playtest audit I221): reference turns scaled by the speed table at the player's age
// (KTD7): a card, its family and one city each rest after a draw.
export const EVENT_COOLDOWN_TURNS = { template: 14, family: 5, city: 7 };
export const cooldownTurns = (state, kind) => Math.ceil(EVENT_COOLDOWN_TURNS[kind] * speedCostMult(state.gameSpeed, ageOf(state, state.playerNationId)));
const onCooldown = (state, key, kind) => {
  const last = state.eventHistory?.[key];
  return last != null && (state.turnNumber || 0) - last < cooldownTurns(state, kind);
};

/** The event history after `event` fired this turn: its card, its family and its city rest. */
export const noteEventFired = (history, event, turnNumber) => ({
  ...(history || {}),
  ...(event?.templateId ? { [`t:${event.templateId}`]: turnNumber, [`f:${event.family}`]: turnNumber } : {}),
  ...(event?.cityId != null ? { [`c:${event.cityId}`]: turnNumber } : {})
});

/** One procedural card drawn by weight among those whose requirements and subjects fit, built into
 * an event bound to its city; null when none fits. */
export const drawCard = (state, rng) => {
  const ctx = factContext(state, state.playerNationId);
  const eligible = DRAWS
    .filter((t) => !(t.once && state.eventHistory?.[`t:${t.id}`] != null) && !onCooldown(state, `t:${t.id}`, 'template') && !onCooldown(state, `f:${t.family}`, 'family') && (!t.requires || predicateMet(t.requires, ctx)))
    .map((t) => ({ t, cities: t.subjects?.city ? t.subjects.city(state).filter((c) => !onCooldown(state, `c:${c.id}`, 'city')) : null }))
    .filter(({ cities }) => !cities || cities.length > 0);
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, e) => sum + e.t.weight, 0);
  let roll = rng.next() * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const e of eligible) {
    if (roll < e.t.weight) { chosen = e; break; }
    roll -= e.t.weight;
  }
  const city = chosen.cities ? chosen.cities[Math.floor(rng.next() * chosen.cities.length)] : null;
  return {
    id: `procedural_${chosen.t.id}_${state.turnNumber}`,
    year: state.year, // display label only
    mandatory: false,
    procedural: true,
    templateId: chosen.t.id,
    family: chosen.t.family,
    ...(city ? { cityId: city.id, tile: city.tile } : {}),
    ...chosen.t.build(state, rng, city)
  };
};

/**
 * This turn's event, as the state fields it sets. `state` carries the new turnNumber.
 * @returns {{ activeEventId, activeProceduralEvent, pendingEventChains, eventHistory, proceduralEventCooldown }}
 */
export const drawEvent = (state, rng) => {
  const out = {
    activeEventId: null,
    activeProceduralEvent: null,
    pendingEventChains: state.pendingEventChains || [],
    eventHistory: state.eventHistory || {},
    proceduralEventCooldown: Math.max(0, (state.proceduralEventCooldown || 0) - 1)
  };
  const story = nextStory(state);
  if (story) return { ...out, activeEventId: story.id };

  const i = out.pendingEventChains.findIndex((l) => l.dueTurn <= state.turnNumber && CARDS[l.id]?.kind === 'link');
  if (i !== -1) {
    const link = out.pendingEventChains[i];
    const rest = out.pendingEventChains.filter((_, j) => j !== i);
    const city = link.cityId != null ? state.regions?.[link.cityId] : null;
    // A link keeps the city its story bound while the player still holds it.
    if (city?.owner === state.playerNationId) {
      return { ...out, pendingEventChains: rest, activeProceduralEvent: { ...CARDS[link.id], year: state.year, cityId: city.id, tile: city.tile } };
    }
    return { ...out, pendingEventChains: rest, activeEventId: link.id };
  }

  // Draws come on a few quiet turns, a random few turns apart.
  if (out.proceduralEventCooldown <= 0 && rng.next() < 0.3) {
    const event = drawCard(state, rng);
    if (event) {
      out.activeProceduralEvent = event;
      out.eventHistory = noteEventFired(out.eventHistory, event, state.turnNumber);
      out.proceduralEventCooldown = 3 + Math.floor(rng.next() * 5);
    }
  }
  return out;
};
