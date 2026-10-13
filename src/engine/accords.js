// src/engine/accords.js
// Open borders and demands (plans/civ-map-rework.md, C6.4 and C6.5; workstream 7).
//   Open borders  a pact between two nations (`nation.openBordersWith[otherId] = true` on both):
//                 armies move through the other's land as a friend's (armies.js regionAccess),
//                 settlers walk across it (settlers.js), trade routes may pass (tradeRoutes.js),
//                 and each thinks OPEN_BORDERS better of the other (opinion.js). The player
//                 offers it (OPEN_BORDERS, actionCosts.openBorders); the AI accepts when its
//                 opinion of the player is OPEN_BORDERS_OPINION or more and no war runs between
//                 them. Either side may close them (CLOSE_BORDERS); a war between the two ends
//                 them (diplomacy.js declareWar).
//   Demands       the player demands of a nation (DEMAND, kinds below); the target accepts when
//                 its acceptance score is 0 or more:
//                   score = DEMAND_STRENGTH_WEIGHT x (strength ratio - 1) + opinion / 4 - base
//                 with the strength ratio my fielded power over theirs (0 to DEMAND_RATIO_CAP) and
//                 `base` the demand's weight (DEMANDS[kind].base). A refusal gives the demander a
//                 cause for war (a casus belli) for demandCbTurns (`nation.demandCasusBelli[targetId]`,
//                 diplomacy.js hasCasusBelli); accepted or not, the target resents the demand
//                 (hostility + DEMANDS[kind].hostility), and the same nation cannot be pressed
//                 again for demandCooldownTurns.
//                   tribute       tributeQuote: from relative power and the payer's income, capped
//                                 by what the payer holds (below)
//                   city          a city you hold a claim on changes hands peacefully (claims.js
//                                 settles the claim; aggressive expansion at the claim's rate)
//                   stopSettling  they found no city within SETTLED_NEAR_KM of yours for
//                                 DEMAND_STOP_SETTLING_TURNS (`nation.noSettleNear[yourId]`)
//
// Tribute rules (playtest audits CB08: I100 to I104, I109, addendum X21). The same rules whoever
// asks (an AI major of the player, of another AI, or the player of an AI):
//   amount   = city income of the payer x demandCooldownTurns x DEMAND_TRIBUTE_INCOME_SHARE
//              x strength ratio (1 to DEMAND_RATIO_CAP), at least DEMAND_TRIBUTE_MIN, never more than
//              DEMAND_TRIBUTE_BANK_CAP of the gold the payer holds. "City income" is the tax and
//              production of its cities (what they add to the treasury a turn). So a people that
//              paid every demand of one neighbour would hand over 16% (ratio 2) to 24% (ratio 3 or
//              more) of that income, at every game speed; a saved treasury is not taxed.
//   met      a demand that is met (paid, yielded, promised) buys a truce between the two for
//              demandTruceTurns (the war truce records, `nation.truces`: the AI never breaks one)
//              and the demander thinks MET_OUR_DEMAND better of the payer while it lasts
//              (`nation.demandMet[payerId] = { until, kind }`, opinion.js).
//   refused  a cause for war for demandCbTurns and DEMANDS[kind].hostility (0.6 opinion a point).
//   waits    all waits are reference turns through the speed helper (ages.js speedTurns), so they
//            last the same span of history at every speed. At Normal in the Bronze Age: cause for
//            war 20 turns, per-pair cooldown 24, truce 24.
// Pure of randomness.
import { getTiles } from '../data/geo/tiles';
import { SETTLED_NEAR_KM } from '../data/opinion';
import { ringsForKm } from '../data/geo/gridScale';
import { ringsAround } from './world/cities';
import { getEffectiveMilitaryPower } from './aiEconomy';
import { opinionOf } from './opinion';
import { claimOn, aeMultFor } from './claims';
import { applyAggressiveExpansion } from './expansion';
import { transferRegion } from './regionTransfer';
import { relocateLostCapital } from './conquest';
import { getPool } from './nationState';
import { LOYALTY_ON_FLIP } from './loyalty';
import { speedTurns } from '../data/ages';
import { cityIncomeOf } from './tributePricing';

export const OPEN_BORDERS_OPINION = 20;
export const DEMAND_STRENGTH_WEIGHT = 20;
export const DEMAND_RATIO_CAP = 3;
// Waits in reference turns (ages.js speedTurns). PROVISIONAL numbers: the rule is fixed, the
// values wait for the tuning pass against the W00 baseline (conflicts trap T1).
export const DEMAND_CB_REF_TURNS = 12;        // 20 turns at Normal in the Bronze Age (as before)
export const DEMAND_COOLDOWN_REF_TURNS = 15;  // 24 turns at Normal (was a flat 10)
export const DEMAND_TRUCE_REF_TURNS = 15;     // 24 turns at Normal: what meeting a demand buys
export const DEMAND_TRIBUTE_INCOME_SHARE = 0.08; // of the payer's city income over one cooldown, per point of strength ratio
export const DEMAND_TRIBUTE_BANK_CAP = 0.5;   // never more than this share of the gold the payer holds
export const DEMAND_TRIBUTE_MIN = 50;
export const DEMAND_STOP_SETTLING_TURNS = 50;
export const demandCbTurns = (state) => speedTurns(DEMAND_CB_REF_TURNS, state?.gameSpeed, state?.age);
export const demandCooldownTurns = (state) => speedTurns(DEMAND_COOLDOWN_REF_TURNS, state?.gameSpeed, state?.age);
export const demandTruceTurns = (state) => speedTurns(DEMAND_TRUCE_REF_TURNS, state?.gameSpeed, state?.age);
export const DEMANDS = {
  tribute: { label: 'Demand tribute', base: 10, hostility: 10 },
  city: { label: 'Demand the city', base: 40, hostility: 20 },
  stopSettling: { label: 'Demand they stop settling near you', base: 5, hostility: 5 }
};

export const hasOpenBorders = (state, a, b) => !!state.nations?.[a]?.openBordersWith?.[b] || !!state.nations?.[b]?.openBordersWith?.[a];

/** Would `nationId` open its borders to the player today? */
export const openBordersAcceptance = (state, nationId) => {
  const opinion = opinionOf(state, nationId);
  const atWar = (state.wars || []).some((w) => w.active && ((w.aggressor === nationId && w.enemy === state.playerNationId) || (w.enemy === nationId && w.aggressor === state.playerNationId)));
  return { accepted: !atWar && opinion >= OPEN_BORDERS_OPINION, opinion, needed: OPEN_BORDERS_OPINION, atWar };
};

const withBorders = (nation, otherId, open) => {
  const next = { ...(nation.openBordersWith || {}) };
  if (open) next[otherId] = true; else delete next[otherId];
  return { ...nation, openBordersWith: next };
};
/** Both records with the pact set or cleared. */
export const setOpenBorders = (nations, a, b, open) => ({ ...nations, [a]: withBorders(nations[a], b, open), [b]: withBorders(nations[b], a, open) });

/** True while `nationId` promised `toId` not to settle near its cities and `tile` lies within reach of one. */
// City centres by tile, once per regions map: the settler's site search asks for hundreds of tiles.
const centresCache = new WeakMap(); // regions -> Map tile -> [city]
const centresOf = (regions) => {
  let m = centresCache.get(regions);
  if (!m) { m = new Map(); Object.values(regions).forEach((c) => { if (c.tile != null) (m.get(c.tile) || m.set(c.tile, []).get(c.tile)).push(c); }); centresCache.set(regions, m); }
  return m;
};
export const settlingBarred = (state, nationId, tile) => {
  const promises = state.nations?.[nationId]?.noSettleNear;
  if (!promises) return false;
  const turn = state.turnNumber || 1;
  const tiles = getTiles();
  return Object.entries(promises).some(([toId, until]) => {
    if (turn > until) return false;
    const centres = centresOf(state.regions || {});
    for (const t of ringsAround(tiles, tile, ringsForKm(SETTLED_NEAR_KM)).keys()) if ((centres.get(t) || []).some((c) => c.owner === toId)) return true;
    return false;
  });
};

// City income (what a nation's cities add to its treasury a turn): tributePricing.js, shared with
// the independents' running tribute.
export { cityIncomeOf };

/** The strength ratio a demand is weighed by: the demander's power over the target's, 0 to DEMAND_RATIO_CAP. */
export const demandRatio = (state, demanderId, targetId) => Math.min(DEMAND_RATIO_CAP, getEffectiveMilitaryPower(state, demanderId) / Math.max(1, getEffectiveMilitaryPower(state, targetId)));

/**
 * The tribute `demanderId` may ask of `targetId` today (the header's rule): { amount, byPower,
 * cap, ratio, income, turns, viable }. `amount` is what would change hands; `viable` is false when
 * the payer holds too little for even DEMAND_TRIBUTE_MIN (an AI then asks for nothing).
 */
export const tributeQuote = (state, demanderId, targetId) => {
  const ratio = demandRatio(state, demanderId, targetId);
  const income = cityIncomeOf(state, targetId);
  const turns = demandCooldownTurns(state);
  const byPower = Math.max(DEMAND_TRIBUTE_MIN, Math.round(income * turns * DEMAND_TRIBUTE_INCOME_SHARE * Math.max(1, ratio)));
  const cap = Math.max(0, Math.floor((getPool(state, targetId).gold || 0) * DEMAND_TRIBUTE_BANK_CAP));
  return { amount: Math.min(byPower, cap), byPower, cap, ratio: Math.round(ratio * 100) / 100, income, turns, viable: cap >= DEMAND_TRIBUTE_MIN };
};

/** Is a truce running between the two (the war truce records, diplomacy.js isInTruce)? */
export const demandTruce = (state, a, b) => (state.nations?.[a]?.truces?.[b] || 0) > (state.turnNumber || 0);
const withTruce = (nations, a, b, until) => ({
  ...nations,
  [a]: { ...nations[a], truces: { ...(nations[a].truces || {}), [b]: Math.max(until, nations[a].truces?.[b] || 0) } },
  [b]: { ...nations[b], truces: { ...(nations[b].truces || {}), [a]: Math.max(until, nations[b].truces?.[a] || 0) } }
});

/** Does `fromId` hold an open (unanswered) demand on `targetId`? Only the player's are kept open
 * (`state.pendingDemand`); an AI answers at once. The AI's war roll skips such a target (aiLogic.js). */
export const hasOpenDemand = (state, fromId, targetId) => !!state.pendingDemand && state.pendingDemand.from === fromId && targetId === state.playerNationId;

/** The target's answer to a demand of `kind` from the player: { accepted, score, ratio, opinion, base, reason }. */
export const demandAcceptance = (state, targetId, kind, cityId = null, demanderId = state.playerNationId) => {
  const me = demanderId;
  const d = DEMANDS[kind];
  const target = state.nations?.[targetId];
  if (!d || !target || target.isEliminated) return { accepted: false, score: -Infinity, reason: 'No such demand.' };
  if ((state.wars || []).some((w) => w.active && ((w.aggressor === targetId && w.enemy === me) || (w.enemy === targetId && w.aggressor === me)))) return { accepted: false, score: -Infinity, reason: 'At war: settle it at the peace table.' };
  const cooldown = state.nations[me]?.demandCooldowns?.[targetId];
  if (cooldown != null && (state.turnNumber || 1) < cooldown) return { accepted: false, score: -Infinity, reason: `They will hear no demand before turn ${cooldown}.` };
  if (demandTruce(state, me, targetId)) return { accepted: false, score: -Infinity, reason: `A truce holds until turn ${state.nations[me]?.truces?.[targetId]}: no demand meanwhile.` };
  if (kind === 'city') {
    const city = state.regions?.[cityId];
    if (!city || city.owner !== targetId) return { accepted: false, score: -Infinity, reason: 'Not their city.' };
    if (!claimOn(state, me, city)) return { accepted: false, score: -Infinity, reason: 'You hold no claim on it.' };
    if (target.capitalRegionId === cityId) return { accepted: false, score: -Infinity, reason: 'No nation gives up its capital.' };
  }
  const ratio = demandRatio(state, me, targetId);
  const opinion = opinionOf(state, targetId, me);
  const score = Math.round(DEMAND_STRENGTH_WEIGHT * (ratio - 1) + opinion / 4 - d.base);
  return { accepted: score >= 0, score, ratio: Math.round(ratio * 100) / 100, opinion, base: d.base, reason: null };
};

/**
 * Applies a demand the player made: returns { state, accepted, message } with the target's
 * resentment, the cooldown, the effect when accepted and the casus belli when refused.
 */
export const applyDemand = (state, targetId, kind, cityId = null, demanderId = state.playerNationId) => {
  const me = demanderId;
  const turn = state.turnNumber || 1;
  const answer = demandAcceptance(state, targetId, kind, cityId, me);
  if (answer.reason) return { state, accepted: false, message: answer.reason };
  const d = DEMANDS[kind];
  const target = state.nations[targetId];
  let nations = { ...state.nations, [targetId]: { ...target, hostility: Math.min(100, (target.hostility || 0) + d.hostility) } };
  nations[me] = { ...nations[me], demandCooldowns: { ...(nations[me].demandCooldowns || {}), [targetId]: turn + demandCooldownTurns(state) } };
  if (!answer.accepted) {
    const cb = demandCbTurns(state);
    nations[me] = { ...nations[me], demandCasusBelli: { ...(nations[me].demandCasusBelli || {}), [targetId]: turn + cb } };
    return { state: { ...state, nations }, accepted: false, message: `${target.name} refuses: you have a cause for war against them for ${cb} turns.` };
  }
  const granted = grantDemand(state, nations, me, targetId, kind, cityId, state.resources);
  return { state: { ...state, nations: granted.nations, regions: granted.regions, resources: granted.resources }, accepted: true, message: granted.message };
};

/** The effect of a demand that was accepted, whoever asked: { nations, regions, resources, message,
 * amount, truceUntil }. Gold moves between the treasury (the player's `resources`) and the AI
 * economies: `amount` when given (the sum that was quoted), else today's tributeQuote; never more
 * than the payer holds. Meeting a demand of any kind buys the truce and the opinion of the header. */
export const grantDemand = (state, nations, me, targetId, kind, cityId, resources = state.resources, { amount: quoted = null } = {}) => {
  const turn = state.turnNumber || 1;
  const isPlayer = me === state.playerNationId;
  const targetIsPlayer = targetId === state.playerNationId;
  const target = nations[targetId];
  let regions = state.regions;
  let message;
  let amount = null;
  nations = { ...nations };
  const truceUntil = turn + demandTruceTurns(state);
  const truceNote = ` A truce holds between you until turn ${truceUntil}.`;
  if (kind === 'tribute') {
    const pool = targetIsPlayer ? resources : getPool({ ...state, nations }, targetId);
    const asked = quoted != null ? quoted : tributeQuote({ ...state, nations, resources }, me, targetId).amount;
    amount = Math.max(0, Math.min(Math.round(asked), Math.floor(Math.max(0, pool.gold || 0))));
    if (targetIsPlayer) resources = { ...resources, gold: (resources.gold || 0) - amount };
    else nations[targetId] = { ...nations[targetId], economy: { ...(nations[targetId].economy || {}), gold: (nations[targetId].economy?.gold || 0) - amount } };
    if (isPlayer) resources = { ...resources, gold: (resources.gold || 0) + amount };
    else nations[me] = { ...nations[me], economy: { ...(nations[me].economy || {}), gold: (nations[me].economy?.gold || 0) + amount } };
    message = targetIsPlayer ? `You pay ${nations[me].name} ${amount} gold in tribute.` : `${target.name} pays ${amount} gold in tribute${isPlayer ? '' : ` to ${nations[me].name}`}.`;
  } else if (kind === 'city') {
    const city = state.regions[cityId];
    const { region } = transferRegion(city, me, nations, { loyalty: LOYALTY_ON_FLIP, control: 100, unrest: 0, siege: null, lastFlipTurn: turn });
    regions = { ...state.regions, [cityId]: region };
    nations = applyAggressiveExpansion(nations, regions, cityId, targetId, me, aeMultFor({ nations, regions: state.regions }, me, city));
    if (nations[me].claims?.includes(cityId)) nations[me] = { ...nations[me], claims: nations[me].claims.filter((id) => id !== cityId) };
    nations = relocateLostCapital(nations, regions, targetId);
    message = targetIsPlayer ? `You yield ${city.name} to ${nations[me].name}.` : `${target.name} yields ${city.name} to ${isPlayer ? 'you' : nations[me].name}.`;
  } else {
    nations[targetId] = { ...nations[targetId], noSettleNear: { ...(nations[targetId].noSettleNear || {}), [me]: turn + DEMAND_STOP_SETTLING_TURNS } };
    message = targetIsPlayer ? `You promise ${nations[me].name} to found no city near theirs for ${DEMAND_STOP_SETTLING_TURNS} turns.` : `${target.name} agrees to found no city near ${isPlayer ? 'yours' : `${nations[me].name}'s`} for ${DEMAND_STOP_SETTLING_TURNS} turns.`;
  }
  // The demand was met: a truce between the two, and the demander remembers it while it lasts.
  if (nations[me] && nations[targetId]) {
    nations = withTruce(nations, me, targetId, truceUntil);
    nations[me] = { ...nations[me], demandMet: { ...(nations[me].demandMet || {}), [targetId]: { until: truceUntil, kind } } };
    if (isPlayer || targetIsPlayer) message += truceNote;
  }
  return { nations, regions, resources, message, amount, truceUntil };
};

/** A refused demand's casus belli, while it lasts. */
export const hasDemandCasusBelli = (state, aggressorId, targetId) => {
  const until = state.nations?.[aggressorId]?.demandCasusBelli?.[targetId];
  return until != null && (state.turnNumber || 1) <= until;
};
