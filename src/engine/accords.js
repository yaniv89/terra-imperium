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
//                 casus belli for DEMAND_CB_TURNS turns (`nation.demandCasusBelli[targetId]`,
//                 diplomacy.js hasCasusBelli); accepted or not, the target resents the demand
//                 (hostility + DEMANDS[kind].hostility), and the same nation cannot be pressed
//                 again for DEMAND_COOLDOWN_TURNS.
//                   tribute       DEMAND_TRIBUTE_SHARE of their treasury, at least DEMAND_TRIBUTE_MIN
//                   city          a city you hold a claim on changes hands peacefully (claims.js
//                                 settles the claim; aggressive expansion at the claim's rate)
//                   stopSettling  they found no city within SETTLED_NEAR_RINGS of yours for
//                                 DEMAND_STOP_SETTLING_TURNS (`nation.noSettleNear[yourId]`)
// Pure of randomness.
import { getTiles } from '../data/geo/tiles';
import { SETTLED_NEAR_RINGS } from '../data/opinion';
import { ringsAround } from './world/cities';
import { getEffectiveMilitaryPower } from './aiEconomy';
import { opinionOf } from './opinion';
import { claimOn, aeMultFor } from './claims';
import { applyAggressiveExpansion } from './expansion';
import { transferRegion } from './regionTransfer';
import { relocateLostCapital } from './conquest';
import { getPool } from './nationState';
import { LOYALTY_ON_FLIP } from './loyalty';

export const OPEN_BORDERS_OPINION = 20;
export const DEMAND_STRENGTH_WEIGHT = 20;
export const DEMAND_RATIO_CAP = 3;
export const DEMAND_CB_TURNS = 20;
export const DEMAND_COOLDOWN_TURNS = 10;
export const DEMAND_TRIBUTE_SHARE = 0.2;
export const DEMAND_TRIBUTE_MIN = 50;
export const DEMAND_STOP_SETTLING_TURNS = 50;
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
export const settlingBarred = (state, nationId, tile) => {
  const promises = state.nations?.[nationId]?.noSettleNear;
  if (!promises) return false;
  const turn = state.turnNumber || 1;
  const tiles = getTiles();
  return Object.entries(promises).some(([toId, until]) => {
    if (turn > until) return false;
    const near = ringsAround(tiles, tile, SETTLED_NEAR_RINGS);
    return Object.values(state.regions || {}).some((c) => c.owner === toId && c.tile != null && near.has(c.tile));
  });
};

/** The target's answer to a demand of `kind` from the player: { accepted, score, ratio, opinion, base, reason }. */
export const demandAcceptance = (state, targetId, kind, cityId = null) => {
  const me = state.playerNationId;
  const d = DEMANDS[kind];
  const target = state.nations?.[targetId];
  if (!d || !target || target.isEliminated) return { accepted: false, score: -Infinity, reason: 'No such demand.' };
  if ((state.wars || []).some((w) => w.active && ((w.aggressor === targetId && w.enemy === me) || (w.enemy === targetId && w.aggressor === me)))) return { accepted: false, score: -Infinity, reason: 'At war: settle it at the peace table.' };
  const cooldown = state.nations[me]?.demandCooldowns?.[targetId];
  if (cooldown != null && (state.turnNumber || 1) < cooldown) return { accepted: false, score: -Infinity, reason: `They will hear no demand before turn ${cooldown}.` };
  if (kind === 'city') {
    const city = state.regions?.[cityId];
    if (!city || city.owner !== targetId) return { accepted: false, score: -Infinity, reason: 'Not their city.' };
    if (!claimOn(state, me, city)) return { accepted: false, score: -Infinity, reason: 'You hold no claim on it.' };
    if (target.capitalRegionId === cityId) return { accepted: false, score: -Infinity, reason: 'No nation gives up its capital.' };
  }
  const ratio = Math.min(DEMAND_RATIO_CAP, getEffectiveMilitaryPower(state, me) / Math.max(1, getEffectiveMilitaryPower(state, targetId)));
  const opinion = opinionOf(state, targetId);
  const score = Math.round(DEMAND_STRENGTH_WEIGHT * (ratio - 1) + opinion / 4 - d.base);
  return { accepted: score >= 0, score, ratio: Math.round(ratio * 100) / 100, opinion, base: d.base, reason: null };
};

/**
 * Applies a demand the player made: returns { state, accepted, message } with the target's
 * resentment, the cooldown, the effect when accepted and the casus belli when refused.
 */
export const applyDemand = (state, targetId, kind, cityId = null) => {
  const me = state.playerNationId;
  const turn = state.turnNumber || 1;
  const answer = demandAcceptance(state, targetId, kind, cityId);
  if (answer.reason) return { state, accepted: false, message: answer.reason };
  const d = DEMANDS[kind];
  const target = state.nations[targetId];
  let nations = { ...state.nations, [targetId]: { ...target, hostility: Math.min(100, (target.hostility || 0) + d.hostility) } };
  nations[me] = { ...nations[me], demandCooldowns: { ...(nations[me].demandCooldowns || {}), [targetId]: turn + DEMAND_COOLDOWN_TURNS } };
  let regions = state.regions; let resources = state.resources;
  if (!answer.accepted) {
    nations[me] = { ...nations[me], demandCasusBelli: { ...(nations[me].demandCasusBelli || {}), [targetId]: turn + DEMAND_CB_TURNS } };
    return { state: { ...state, nations }, accepted: false, message: `${target.name} refuses: you have a casus belli against them for ${DEMAND_CB_TURNS} turns.` };
  }
  let message;
  if (kind === 'tribute') {
    const pool = getPool({ ...state, nations }, targetId);
    const amount = Math.max(0, Math.round(Math.max(DEMAND_TRIBUTE_MIN, (pool.gold || 0) * DEMAND_TRIBUTE_SHARE)));
    nations[targetId] = { ...nations[targetId], economy: { ...(nations[targetId].economy || {}), gold: (nations[targetId].economy?.gold || 0) - amount } };
    resources = { ...resources, gold: (resources.gold || 0) + amount };
    message = `${target.name} pays ${amount} gold in tribute.`;
  } else if (kind === 'city') {
    const city = state.regions[cityId];
    const { region } = transferRegion(city, me, nations, { loyalty: LOYALTY_ON_FLIP, control: 100, unrest: 0, siege: null, lastFlipTurn: turn });
    regions = { ...state.regions, [cityId]: region };
    nations = applyAggressiveExpansion(nations, regions, cityId, targetId, me, aeMultFor({ nations, regions: state.regions }, me, city));
    if (nations[me].claims?.includes(cityId)) nations[me] = { ...nations[me], claims: nations[me].claims.filter((id) => id !== cityId) };
    nations = relocateLostCapital(nations, regions, targetId);
    message = `${target.name} yields ${city.name} to you.`;
  } else {
    nations[targetId] = { ...nations[targetId], noSettleNear: { ...(nations[targetId].noSettleNear || {}), [me]: turn + DEMAND_STOP_SETTLING_TURNS } };
    message = `${target.name} agrees to found no city near yours for ${DEMAND_STOP_SETTLING_TURNS} turns.`;
  }
  return { state: { ...state, nations, regions, resources }, accepted: true, message };
};

/** A refused demand's casus belli, while it lasts. */
export const hasDemandCasusBelli = (state, aggressorId, targetId) => {
  const until = state.nations?.[aggressorId]?.demandCasusBelli?.[targetId];
  return until != null && (state.turnNumber || 1) <= until;
};
