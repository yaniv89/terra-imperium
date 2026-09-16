// src/data/deposits.js
// Curated real-world strategic resource deposits, by country code (plan §4: "Deposits are the
// reason the map matters"). To actually extract a deposit you need (a) the deposit itself, (b)
// its age unlocked (src/data/resources.js), and (c) the matching extraction building
// (src/data/buildings.js) — this file only answers "does this region have it at all".
//
// Deliberately NOT exhaustive over all 240 nations — most nations have none of these three, which
// is the point: if you lack a resource you trade for it or take it. Real major producers/
// historically significant deposit sites only.
export const RESOURCE_DEPOSITS = {
  // Copper
  cl: ['copper'], pe: ['copper'], cd: ['copper'], zm: ['copper'], mn: ['copper'],
  id: ['copper', 'oil'], au: ['copper', 'iron'], cy: ['copper'],

  // Iron
  br: ['iron'], in: ['iron'], ua: ['iron'], se: ['iron'], za: ['iron'],
  mr: ['iron'], kr: ['iron'],

  // Oil
  sa: ['oil'], iq: ['oil'], ae: ['oil'], kw: ['oil'], qa: ['oil'], ir: ['iron', 'oil'],
  ve: ['oil'], ng: ['oil'], ly: ['oil'], dz: ['oil'], ao: ['oil'],
  no: ['oil'], gb: ['oil'], ca: ['oil'], mx: ['oil'], kz: ['oil'], az: ['oil'], bn: ['oil'],

  // Nations with more than one major deposit — the historically-dominant, resource-rich powers.
  us: ['copper', 'iron', 'oil'], ru: ['copper', 'iron', 'oil'], cn: ['copper', 'iron'],
  tr: ['copper', 'iron']
};

export const hasDeposit = (countryId, resourceId) => (RESOURCE_DEPOSITS[countryId] || []).includes(resourceId);

export const getDepositsFor = (countryId) => RESOURCE_DEPOSITS[countryId] || [];
