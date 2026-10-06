// src/data/nationTitles.js
// How a people's nation is named in the game (plans/peoples-and-world-setup.md 4.5, master plan
// section 4 "Names everywhere"): one name for all ages, with a title that follows the government
// and the size of the realm. "the Akkadian tribes", "Kingdom of Akkad", "Holy Akkad", "Republic of
// Akkad"; at EMPIRE_CITY_COUNT cities or more the realm form ("the Akkadian Empire"). Titles for
// Dictatorship, Technocracy and the Corporate State are written here too (the last two are not
// governments yet; they come with the later ages and need no change here when they do).
//
// Templates: {name} is the people's stem as it reads inside a sentence ("Akkad", "the Nuragi"),
// {adj} its adjective ("Akkadian"). A people whose name is plural ("The Nuragi") never takes a
// form that puts its name right after a word ("Holy the Nuragi"): those forms have a plural twin.
// Pure data and functions; nothing in the engine reads a title, so titles never touch balance.
import { peopleOf } from './peoples';

export const EMPIRE_CITY_COUNT = 15;

export const GOVERNMENT_TITLES = {
  tribal: { realm: 'the {adj} tribes', empire: 'the {adj} Confederacy' },
  monarchy: { realm: 'Kingdom of {name}', empire: 'the {adj} Empire' },
  theocracy: { realm: 'Holy {name}', empire: 'the Holy {adj} Empire', pluralRealm: 'the Holy {adj} Realm' },
  republic: { realm: 'Republic of {name}', empire: 'the {adj} Commonwealth' },
  dictatorship: { realm: 'the {adj} State', empire: 'Greater {name}', pluralEmpire: 'the Greater {adj} State' },
  technocracy: { realm: 'the {adj} Technate', empire: 'the Grand {adj} Technate' },
  corporate: { realm: 'the {adj} Combine', empire: 'the {adj} Conglomerate' }
};

const fill = (template, people) => template.replaceAll('{name}', people.stem).replaceAll('{adj}', people.adjective);
const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** The titled name of a people under a government with `cityCount` cities, as it reads at the start
 * of a line ("The Akkadian tribes", "Kingdom of Akkad"). */
export const titleFor = (people, governmentType = 'tribal', cityCount = 1) => {
  if (!people) return null;
  const big = cityCount >= EMPIRE_CITY_COUNT;
  const override = people.titles?.[`${governmentType}${big ? 'Empire' : ''}`] || (!big && people.titles?.[governmentType]);
  if (override) return capitalise(override);
  const forms = GOVERNMENT_TITLES[governmentType] || GOVERNMENT_TITLES.tribal;
  const template = big
    ? (people.plural && forms.pluralEmpire) || forms.empire
    : (people.plural && forms.pluralRealm) || forms.realm;
  return capitalise(fill(template, people));
};

/** The title of a nation in a state (its people, government and city count), or null for a legacy
 * nation (which keeps its stored name). `cityCount` may be passed when the caller has counted. */
export const nationTitle = (nation, cityCount) => {
  const people = peopleOf(nation?.people || nation?.id);
  if (!people) return null;
  return titleFor(people, nation?.government?.type || 'tribal', cityCount ?? 1);
};
