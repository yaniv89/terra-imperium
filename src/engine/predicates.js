// src/engine/predicates.js
// Predicates over a nation's facts (differentiation plan KTD8 and KTD13): the one test language of
// ambitions (ambitions.js), and later the event deck (U26) and crises (U31). A predicate is data:
//   leaf      { fact, min = 1, gain = false }   met when the fact (a number; true = 1) is >= min;
//             with gain, only what came after the base counts (gainBase, taken when it was offered)
//   compound  { all: [p] } | { any: [p] } | { not: p }
// Facts are read lazily, once per context (factContext): only the facts a predicate names are
// computed, so a check costs nothing beyond what it reads. Pure.
import { nationFacts } from './boosts';
import { citiesTakenThisAge } from './eraGoals';
import { getResearched } from './nationState';

const map = (k) => (ctx) => (ctx.map ||= nationFacts(ctx.state, ctx.nationId))[k];

/** Every fact a predicate may name: (ctx) -> number or boolean. */
export const FACTS = {
  cities: map('cities'),
  maxSize: map('maxSize'),
  river: map('river'),
  coastal: map('coastal'),
  harbour: map('harbour'),
  forest: map('forest'),
  hills: map('hills'),
  roads: map('roads'),
  trade: map('trade'),
  atWar: map('atWar'),
  sieged: map('sieged'),
  resources: (ctx) => map('resources')(ctx).size,
  battlesWon: map('battlesWon'),
  citiesTaken: ({ state, nationId }) => citiesTakenThisAge(state, nationId),
  techs: ({ state, nationId }) => getResearched(state, nationId).length,
  wonders: ({ state, nationId }) => Object.values(state.greatProjects || {}).filter((p) => state.regions?.[p.regionId]?.owner === nationId).length
};

/** The facts of `nationId` in `state`, read on demand. */
export const factContext = (state, nationId) => ({ state, nationId, memo: {} });

const fact = (ctx, id) => {
  if (id in ctx.memo) return ctx.memo[id];
  if (!FACTS[id]) throw new Error(`Unknown predicate fact: ${id}`);
  return (ctx.memo[id] = Number(FACTS[id](ctx)) || 0);
};

/** The fact ids a predicate names, in order (`onlyGain`: the gain leaves only). */
export const factsUsed = (p, onlyGain = false) => {
  if (p.all || p.any) return (p.all || p.any).flatMap((q) => factsUsed(q, onlyGain));
  if (p.not) return factsUsed(p.not, onlyGain);
  return !onlyGain || p.gain ? [p.fact] : [];
};

/** The base a gain predicate counts from: { fact: value now } for each gain leaf. */
export const gainBase = (p, ctx) => Object.fromEntries(factsUsed(p, true).map((id) => [id, fact(ctx, id)]));

/** True when `p` holds for the context's nation. */
export const predicateMet = (p, ctx, base = {}) => {
  if (p.all) return p.all.every((q) => predicateMet(q, ctx, base));
  if (p.any) return p.any.some((q) => predicateMet(q, ctx, base));
  if (p.not) return !predicateMet(p.not, ctx, base);
  return fact(ctx, p.fact) - (p.gain ? base[p.fact] || 0 : 0) >= (p.min ?? 1);
};
