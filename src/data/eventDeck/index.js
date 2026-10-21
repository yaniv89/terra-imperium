// src/data/eventDeck/index.js
// Turns the stories (stories.js) into the deck's cards: openers are draws (a city subject, once a
// game, inside their age), the rest are links keyed `<id>_2` to `<id>_4`.
import { STORIES } from './stories';
import { getAgeIndex } from '../ages';
import { mine, facts, frontier } from '../proceduralEvents';

const SUBJECTS = {
  any: (state) => mine(state),
  river: (state) => mine(state).filter((c) => facts(c).river),
  coast: (state) => mine(state).filter((c) => facts(c).coastal),
  frontier: (state) => mine(state).filter((c) => frontier(state, c))
};
export const linkId = (story, i) => `${story.id}_${i + 1}`;
const withNext = (story, i) => (o) => ({
  label: o.label,
  effects: o.to ? { ...o.effects, spawnFollowUp: { id: linkId(story, i + 1), delayTurns: o.to } } : o.effects
});

/** The openers, in the shape of a procedural template. */
export const DECK_DRAWS = STORIES.map((s) => ({
  id: s.id,
  family: s.id,
  weight: 30,
  once: true,
  requires: { fact: 'ageIndex', min: getAgeIndex(s.ages[0]), max: getAgeIndex(s.ages[1]) },
  subjects: { city: SUBJECTS[s.subject] },
  build: (state, rng, city) => ({
    title: s.cards[0].title.replace('{city}', city.name),
    description: s.cards[0].desc.replaceAll('{city}', city.name),
    options: s.cards[0].options.map(withNext(s, 0))
  })
}));

/** The follow-ups, in the shape of an event chain entry. */
export const DECK_LINKS = Object.fromEntries(STORIES.flatMap((s) => s.cards.slice(1).map((c, k) => {
  const i = k + 1;
  return [linkId(s, i), { id: linkId(s, i), title: c.title, description: c.desc, options: c.options.map(withNext(s, i)) }];
})));
