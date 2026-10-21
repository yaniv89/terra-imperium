// src/data/ambitions.js
// Ambition templates (differentiation plan KTD8, U12 engine samples; U13 writes the full set of about
// 20). Each age a major is offered AMBITION_OFFERS of the templates whose window holds its age, drawn
// by a hash of nation and age (src/engine/ambitions.js). `requires` is a predicate
// (src/engine/predicates.js); a gain leaf counts only from the turn of the offer.
//   { [id]: { label, from, until?, requires } }   from/until: age ids, until exclusive
export const AMBITION_OFFERS = 3;
// What one ambition pays: renown (RENOWN.ambition, src/data/rulers.js), one decree (DECREE_DEEDS.ambition)
// and this many legacy points, kept on the record for the legacy score (U16).
export const AMBITION_LEGACY = 1;

export const AMBITION_TEMPLATES = {
  riverValley: { label: 'Found a city on a river', from: 'stone', until: 'classical', requires: { fact: 'river' } },
  threeCities: { label: 'Rule 3 cities', from: 'stone', until: 'kingdoms', requires: { fact: 'cities', min: 3 } },
  firstVictories: { label: 'Win 2 battles', from: 'stone', requires: { fact: 'battlesWon', min: 2, gain: true } },
  lore: { label: 'Learn 3 discoveries', from: 'stone', requires: { fact: 'techs', min: 3, gain: true } },
  seaGate: { label: 'Build a harbour in a coastal city', from: 'bronze', requires: { all: [{ fact: 'coastal' }, { fact: 'harbour' }] } },
  conquest: { label: 'Take 2 cities by force', from: 'bronze', requires: { fact: 'citiesTaken', min: 2 } },
  greatCity: { label: 'Grow a city to size 6', from: 'classical', requires: { fact: 'maxSize', min: 6 } },
  wonder: { label: 'Build a wonder', from: 'classical', requires: { fact: 'wonders', min: 1, gain: true } }
};
