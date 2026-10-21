// src/engine/ambitions.js
// Ambitions (differentiation plan KTD8, U12): named goals a ruler is offered for each age.
//   offer     when a major's own age (ageOf) differs from the age of its offers, AMBITION_OFFERS
//             templates whose window holds the age are drawn, ranked by hashRoll(nation|age|id) (no
//             rng draw: the same nation and age always get the same offer), plus the people's
//             historical ambition when the age is its peak age (its signature unit's age). Offers
//             of the age left behind lapse.
//   progress  checked once a turn (the rulers phase of resolveTurn) through predicates.js; a gain
//             predicate counts from its base, taken when it was offered.
//   pays      once per offer: RENOWN.ambition renown, one decree, and a record on ambitions.done
//             ({ id, ageId, turn, legacy }) that the legacy score (U16) reads.
// State: nation.ambitions = { ageId, offers: [{ id, base, done? }], done: [...] }. A nation without
// a ruler (an independent) is never offered any. Pure.
import { AMBITION_OFFERS, AMBITION_LEGACY, AMBITION_TEMPLATES } from '../data/ambitions';
import { HISTORICAL_AMBITIONS } from '../data/ambitionsByPeople';
import { SIGNATURE_UNITS } from '../data/signatureUnits';
import { isAgeAtLeast, isAgeBefore } from '../data/ages';
import { RENOWN } from '../data/rulers';
import { hashRoll } from './aftermath';
import { ageOf } from './nationState';
import { factContext, gainBase, predicateMet } from './predicates';
import { grantRenown } from './renown';
import { grantDecree } from './decrees';

const HISTORICAL_BY_ID = Object.fromEntries(Object.values(HISTORICAL_AMBITIONS).map((a) => [a.id, a]));

/** An ambition's definition by id (a template or a people's historical one). */
export const ambitionDef = (id) => AMBITION_TEMPLATES[id] || HISTORICAL_BY_ID[id] || null;

/** The ambition ids offered to `nationId` in `ageId`. */
export const ambitionOffer = (nationId, ageId) => {
  const ids = Object.entries(AMBITION_TEMPLATES)
    .filter(([, t]) => isAgeAtLeast(ageId, t.from) && (!t.until || isAgeBefore(ageId, t.until)))
    .map(([id]) => id)
    .sort((a, b) => hashRoll(`${nationId}|${ageId}|${a}`) - hashRoll(`${nationId}|${ageId}|${b}`))
    .slice(0, AMBITION_OFFERS);
  const own = HISTORICAL_AMBITIONS[nationId];
  return own && SIGNATURE_UNITS[nationId]?.ageId === ageId ? [...ids, own.id] : ids;
};

/**
 * One turn of a nation's ambitions: draws the offer of a new age, then pays every offer now met.
 * Returns { nation, done } with `done` the ambition ids completed this call (nation unchanged when
 * nothing happened).
 */
export const tickAmbitions = (state, nationId, nation, turn) => {
  if (!nation?.ruler || nation.isEliminated) return { nation, done: [] };
  const ageId = ageOf(state, nationId);
  const ctx = factContext(state, nationId);
  let amb = nation.ambitions;
  if (amb?.ageId !== ageId) {
    const offers = ambitionOffer(nationId, ageId).map((id) => ({ id, base: gainBase(ambitionDef(id).requires, ctx) }));
    amb = { ageId, offers, done: amb?.done || [] };
  }
  const met = amb.offers.filter((o) => !o.done && predicateMet(ambitionDef(o.id).requires, ctx, o.base)).map((o) => o.id);
  if (amb === nation.ambitions && !met.length) return { nation, done: [] };
  let next = nation;
  met.forEach((id) => { next = grantRenown(grantDecree(next, 'ambition', turn, id), 'ambition', RENOWN.ambition, turn, id); });
  if (met.length) {
    amb = {
      ...amb,
      offers: amb.offers.map((o) => (met.includes(o.id) ? { ...o, done: turn } : o)),
      done: [...amb.done, ...met.map((id) => ({ id, ageId, turn, legacy: AMBITION_LEGACY }))]
    };
  }
  return { nation: { ...next, ambitions: amb }, done: met };
};
