// src/data/ambitionsByPeople.js
// One historical ambition per people (differentiation plan KTD8), offered only in its peak age: the
// age of its signature unit (src/data/signatureUnits.js). U12 ships samples; U13 fills the 150 peoples.
//   { [peopleId]: { id, label, requires } }   requires: a predicate (src/engine/predicates.js)
export const HISTORICAL_AMBITIONS = {
  akkad: { id: 'akkadUnite', label: 'Unite the land of Sumer and Akkad: rule 6 cities', requires: { fact: 'cities', min: 6 } },
  elam: { id: 'elamHighlands', label: 'Hold the highland roads: rule hills and 4 cities', requires: { all: [{ fact: 'hills' }, { fact: 'cities', min: 4 }] } }
};
