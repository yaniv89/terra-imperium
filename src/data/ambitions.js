// src/data/ambitions.js
// Ambition templates (differentiation plan KTD8, U12 engine, U13 content: 17 templates). Each age a
// major is offered AMBITION_OFFERS of the templates whose window holds its age, drawn
// by a hash of nation and age (src/engine/ambitions.js). `requires` is a predicate
// (src/engine/predicates.js); a gain leaf counts only from the turn of the offer (so it is never met at once;
// the static ones are set above what a nation holds on entering their window).
//   { [id]: { label, from, until?, requires } }   from/until: age ids, until exclusive
// Hebrew: `ambition.<id>` in src/i18n/locales/data/he.ambitions.js.
export const AMBITION_OFFERS = 3;
// What one ambition pays: renown (RENOWN.ambition, src/data/rulers.js), one decree (DECREE_DEEDS.ambition)
// and this many legacy points, kept on the record for the legacy score (U16).
export const AMBITION_LEGACY = 1;

export const AMBITION_TEMPLATES = {
  // Settle and gather
  twoCities: { label: 'Rule 2 cities', from: 'stone', until: 'bronze', requires: { fact: 'cities', min: 2 } },
  threeCities: { label: 'Rule 3 cities', from: 'stone', until: 'bronze', requires: { fact: 'cities', min: 3 } },
  fiveCities: { label: 'Rule 5 cities', from: 'bronze', until: 'classical', requires: { fact: 'cities', min: 5 } },
  foundTwo: { label: 'Add 2 cities', from: 'bronze', until: 'classical', requires: { fact: 'cities', min: 2, gain: true } },
  addCities: { label: 'Add 3 cities', from: 'classical', requires: { fact: 'cities', min: 3, gain: true } },
  gatherers: { label: 'Gain 2 new kinds of resource', from: 'stone', until: 'classical', requires: { fact: 'resources', min: 2, gain: true } },
  wideRealm: { label: 'Gain 3 new kinds of resource', from: 'classical', until: 'gunpowder', requires: { fact: 'resources', min: 3, gain: true } },
  // Learn
  lore: { label: 'Learn 3 discoveries', from: 'stone', until: 'classical', requires: { fact: 'techs', min: 3, gain: true } },
  scholars: { label: 'Learn 6 discoveries', from: 'classical', until: 'kingdoms', requires: { fact: 'techs', min: 6, gain: true } },
  deepLore: { label: 'Learn 8 discoveries', from: 'kingdoms', requires: { fact: 'techs', min: 8, gain: true } },
  // Grow and build
  growVillage: { label: 'Grow your biggest city by 2', from: 'stone', until: 'classical', requires: { fact: 'maxSize', min: 2, gain: true } },
  greatCity: { label: 'Grow a city to size 8', from: 'classical', until: 'kingdoms', requires: { fact: 'maxSize', min: 8 } },
  metropolis: { label: 'Grow a city to size 12', from: 'kingdoms', until: 'gunpowder', requires: { fact: 'maxSize', min: 12 } },
  bigGrowth: { label: 'Grow your biggest city by 4', from: 'gunpowder', requires: { fact: 'maxSize', min: 4, gain: true } },
  wonder: { label: 'Build a wonder', from: 'classical', requires: { fact: 'wonders', min: 1, gain: true } },
  // Fight (the AI world is quiet by design, so only two)
  veterans: { label: 'Win 5 battles', from: 'classical', requires: { fact: 'battlesWon', min: 5, gain: true } },
  conquest: { label: 'Take a city by force', from: 'classical', requires: { fact: 'citiesTaken' } }
};
