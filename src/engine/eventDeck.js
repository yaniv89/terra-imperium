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
// A turn shows at most one: a due story first, then a due link, then a raid's aftermath
// (raidAftermathCard), then the age's dawn card
// (eraDawnCard, once an age), then sometimes a draw. Memory sits
// in state.firedEvents (stories and links), state.pendingEventChains (links waiting) and
// state.eventHistory (draw cooldowns). Pure; draws use the turn's seeded rng.
import { HISTORICAL_EVENTS, ageIdOfYear, eventTechsNeeded } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { PROCEDURAL_TEMPLATES } from '../data/proceduralEvents';
import { DECK_DRAWS, DECK_LINKS } from '../data/eventDeck/index';
import { AI_DRAWS } from '../data/eventsAi';
import { CRISIS_LINKS } from '../data/crises';
import { AGES, getAgeIndex, speedCostMult } from '../data/ages';
import { countryOfNation, peopleOf } from '../data/peoples';
import { factContext, predicateMet } from './predicates';
import { ageOf } from './nationState';
import { eraGoalProgress } from './eraGoals';
import { PLAYSTYLES } from '../data/eraGoals';

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

// What a card asks of the player (events-8; the balance-sim's storyPulse counts it): `dominated` when
// one option is as good or better than another on every count (sign-normalised: cityUnrest, controlPenalty and
// the grudge keys hurt when positive; an option that goes on with a story is not compared with one
// that ends it); `free` when every option only gains; `goldOnly` when the options differ only in
// gold; `real` when neither dominated nor free: a trade-off.
const HURTS_UP = new Set(['cityUnrest', 'controlPenalty', 'indepGrudge', 'struckHostility']);
const COSTS = new Set(['warWith', 'spawnRebels']);
const optionVector = (effects = {}) => Object.fromEntries(Object.entries(effects).filter(([k]) => k !== 'spawnFollowUp')
  .map(([k, v]) => (typeof v === 'number' ? [k, HURTS_UP.has(k) ? -v : v] : typeof v === 'string' ? [`${k}:${v}`, 1] : [k, COSTS.has(k) ? -1 : 1])));
export const cardChoice = (options = []) => {
  const vs = options.map((o) => optionVector(o.effects));
  const keys = [...new Set(vs.flatMap(Object.keys))];
  const geq = (a, b) => keys.every((k) => (a[k] || 0) >= (b[k] || 0));
  const goesOn = options.map((o) => !!o.effects?.spawnFollowUp);
  const dominated = vs.some((b, j) => vs.some((a, i) => i !== j && goesOn[i] === goesOn[j] && geq(a, b)));
  const free = vs.every((v) => Object.values(v).every((x) => x >= 0));
  const strip = (v) => JSON.stringify(Object.entries(v).filter(([k]) => k !== 'gold').sort());
  const goldOnly = options.length > 1 && new Set(vs.map(strip)).size === 1;
  return { dominated, free, goldOnly, real: options.length > 1 && !dominated && !free };
};

/** Every card by id: stories, links and draws. */
export const CARDS = Object.fromEntries([
  ...Object.values(HISTORICAL_EVENTS).map((e) => [e.id, storyCard(e)]),
  ...Object.values({ ...EVENT_CHAINS, ...DECK_LINKS, ...CRISIS_LINKS }).map((e) => [e.id, { ...e, kind: 'link' }]),
  // A drafted card with a dominated option asks nothing: it stays out of the deck (events-8).
  ...[...PROCEDURAL_TEMPLATES, ...DECK_DRAWS, ...AI_DRAWS.filter((t) => !cardChoice(t.build().options).dominated)].map((t) => [t.id, { ...t, kind: 'draw' }])
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
// A card rests longer each time it is drawn (River Rises four times in a game, round 2): its
// cooldown is EVENT_COOLDOWN_TURNS.template times (1 + the times it was drawn).
const onCooldown = (state, key, kind, times = 0) => {
  const last = state.eventHistory?.[key];
  return last != null && (state.turnNumber || 0) - last < cooldownTurns(state, kind) * (1 + times);
};

/** The event history after `event` fired this turn: its card, its family and its city rest. */
export const noteEventFired = (history, event, turnNumber) => ({
  ...(history || {}),
  ...(event?.templateId ? { [`t:${event.templateId}`]: turnNumber, [`f:${event.family}`]: turnNumber, [`n:${event.templateId}`]: (history?.[`n:${event.templateId}`] || 0) + 1 } : {}),
  ...(event?.cityId != null ? { [`c:${event.cityId}`]: turnNumber } : {})
});

/** One procedural card drawn by weight among those whose requirements and subjects fit, built into
 * an event bound to its city; null when none fits. */
export const drawCard = (state, rng) => {
  const ctx = factContext(state, state.playerNationId);
  const eligible = DRAWS
    .filter((t) => (!t.theme || t.theme === peopleOf(state.playerNationId)?.theme) && !(t.once && state.eventHistory?.[`t:${t.id}`] != null) && !onCooldown(state, `t:${t.id}`, 'template', state.eventHistory?.[`n:${t.id}`] || 0) && !onCooldown(state, `f:${t.family}`, 'family') && (!t.requires || predicateMet(t.requires, ctx)))
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
 * The age's dawn card (events-8): once an age, while at least two of its goals are open, the player
 * picks the goal its people will be remembered for; that goal pays twice (eraGoals.js setEraFocus).
 * Null when it was shown this age or a focus is set. Texts: pevt.era_dawn.* (vars on `textVars`).
 */
export const eraDawnCard = (state) => {
  const me = state.playerNationId;
  const ageId = ageOf(state, me);
  const rec = state.nations?.[me]?.eraGoals?.[ageId];
  if (rec?.focus || (rec && 'legacy' in rec) || state.eventHistory?.[`dawn:${ageId}`] != null) return null;
  const open = eraGoalProgress(state, ageId).goals.filter((g) => !g.done);
  if (open.length < 2) return null;
  const age = AGES[ageId]?.name || ageId;
  return {
    id: `era_dawn_${ageId}`, templateId: 'era_dawn', procedural: true, mandatory: false, year: state.year,
    title: `The Dawn of the ${age}`, textVars: { age, ageId },
    description: `A new age opens for your people. Choose the goal they will be remembered for in the ${age}: when it is met, its reward is doubled.`,
    options: open.map((g) => ({ label: `${g.label}: ${g.value} of ${g.target} ${g.unit} (when met: ${PLAYSTYLES[g.id].bonusLabel.replace('{n}', g.n * 2)})`, textKey: `pevt.era_dawn.${g.id}`, textVars: { value: g.value, target: g.target, n: g.n * 2 }, effects: { eraFocus: g.id } }))
  };
};

// The raid aftermath card (events-8, round 2: "a raid had no visible follow-up"): within
// RAID_AFTERMATH_TURNS of an independent's raid on a city the player still holds (raids.js
// lastRaidOnPlayer), the player answers it; the answer moves the raiders' grudge (grudges.js), which
// sets how often they raid and demand tribute. Texts: pevt.raid_beaten.* / pevt.raid_suffered.*.
export const RAID_AFTERMATH_TURNS = 3;
const RAID_ANSWERS = {
  raid_beaten: {
    title: 'The Raiders Fall Back', description: 'Your people at {city} drove off {raiders}. Their wounded are still on the road home.',
    options: [
      { label: 'Pursue them to their camp', effects: { hr: -20, prestige: 5, indepGrudge: 15 } },
      { label: 'Send envoys to make peace', effects: { prestige: -2, indepGrudge: -25 } },
      { label: 'Let them go and mend the walls', effects: { cityLoyalty: 3, defenseBonus: 0.03 } }
    ]
  },
  raid_suffered: {
    title: 'After the Raid', description: '{raiders} struck {city} and went home with what they could carry. The people want an answer.',
    options: [
      { label: 'Swear revenge', effects: { stability: 1, prestige: 3, indepGrudge: 10 } },
      { label: 'Seek terms with their chiefs', effects: { prestige: -4, indepGrudge: -30 } },
      { label: 'Raise a watch on the border', effects: { hr: -15, defenseBonus: 0.04, cityLoyalty: 3 } }
    ]
  }
};
export const raidAftermathCard = (state) => {
  const turn = state.turnNumber || 0;
  const raider = Object.values(state.nations || {}).filter((n) => {
    const last = n.indep?.lastRaidOnPlayer;
    return !n.isEliminated && last && turn - last.turn <= RAID_AFTERMATH_TURNS && state.eventHistory?.[`raid:${n.id}`] !== last.turn
      && state.regions?.[last.cityId]?.owner === state.playerNationId;
  }).sort((a, b) => b.indep.lastRaidOnPlayer.turn - a.indep.lastRaidOnPlayer.turn || (a.id < b.id ? -1 : 1))[0];
  if (!raider) return null;
  const last = raider.indep.lastRaidOnPlayer;
  const city = state.regions[last.cityId];
  const templateId = last.won ? 'raid_suffered' : 'raid_beaten';
  const card = RAID_ANSWERS[templateId];
  const fill = (t) => t.replaceAll('{city}', city.name).replaceAll('{raiders}', raider.name);
  return {
    id: `${templateId}_${raider.id}_${last.turn}`, templateId, procedural: true, mandatory: false, year: state.year,
    cityId: city.id, tile: city.tile, indepId: raider.id, raidTurn: last.turn, textVars: { raiders: raider.name, raidersId: raider.id },
    title: fill(card.title), description: fill(card.description), options: card.options
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
    // A crisis answer carries the majors it struck (crises.js), for its effects on them.
    if (link.nations) return { ...out, pendingEventChains: rest, activeProceduralEvent: { ...CARDS[link.id], year: state.year, nations: link.nations } };
    // A link keeps the city its story bound while the player still holds it.
    if (city?.owner === state.playerNationId) {
      const card = CARDS[link.id];
      const named = (t) => t?.replaceAll('{city}', city.name);
      return { ...out, pendingEventChains: rest, activeProceduralEvent: { ...card, title: named(card.title), description: named(card.description), year: state.year, cityId: city.id, tile: city.tile } };
    }
    // A consequence told in the city it bound passes with the city.
    return { ...out, pendingEventChains: rest, activeEventId: CARDS[link.id].description?.includes('{city}') ? null : link.id };
  }

  // A raid on the player is answered within a few turns, like a link (it is its consequence).
  const raid = raidAftermathCard(state);
  if (raid) return { ...out, activeProceduralEvent: raid, eventHistory: { ...out.eventHistory, [`raid:${raid.indepId}`]: raid.raidTurn } };

  // The age's dawn card takes the first free draw slot of the age; other draws come on a few quiet
  // turns, a random few turns apart.
  const dawn = out.proceduralEventCooldown <= 0 ? eraDawnCard(state) : null;
  if (dawn) return { ...out, activeProceduralEvent: dawn, eventHistory: { ...out.eventHistory, [`dawn:${ageOf(state, state.playerNationId)}`]: state.turnNumber }, proceduralEventCooldown: 3 };
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
