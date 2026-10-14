// src/engine/conquest.js
// Taking land by force. A battle that takes a province hands it to the victor on the spot — the
// region's owner changes, it isn't merely "occupied" pending a peace deal. One shared step for
// every path that captures a region in war, so the player and the AI play by the same rule:
//   - the player's own invasions and amphibious landings (invasion.js, commanded or auto-resolved)
//   - an AI assault that beats (or finds no) garrison in the player's land (defense.js)
//   - AI-vs-AI wars' capture rolls (diplomacy.js resolveWarProgress)
// The freshly conquered province starts restless (control 25, unrest ≥ 50, formerOwner set, so the
// revolt system can take it back), costs the conqueror Aggressive Expansion like a ceded one, and
// carries a `conquest` marker ({ warId, from, turn }) so the war still scores it
// (diplomacy.js getOccupationScore) and the loser can demand it back at the peace table.
// A lost capital moves to the loser's richest remaining province (the same move a peace deal makes).
import { transferRegion } from './regionTransfer';
import { applyAggressiveExpansion } from './expansion';
import { aeMultFor } from './claims';
import { LOYALTY_ON_CONQUEST } from './loyalty';
import { getTotalDev } from './development';
import { clampStability } from './nationalPower';
import { getCapital } from '../data/regions';
import { CAPITAL_LOST_IN_PEACE_STABILITY_PENALTY } from '../data/actionCosts';
import { isIndependentNation, INDEPENDENT_CONQUEST_AE_MULT } from '../data/independents';
import { grudgeForKinCity } from './grudges';

export const CONQUEST_CONTROL = 25;
export const CONQUEST_MIN_UNREST = 50;

// Occupation and the city's own history (playtest audits I126, I132; capture.js is the player's choice).
//   Grace    for OCCUPATION_GRACE_TURNS after a conquest the city cannot break away (loyalty.js holds
//            its loyalty at OCCUPATION_GRACE_FLOOR and its unrest under the uprising line): time to
//            bring a garrison, never a permanent shield (`conquest.graceUntil`, a fixed turn).
//   History  every conquest is written on the CITY (`captureLog`, the last CAPTURE_HISTORY entries
//            { by, from, turn }), so it survives every later change of hands. A nation that takes
//            the same city again within CAPTURE_REPEAT_TURNS gets no second grace, no second
//            "city taken" on its battle record and no second thanks for freeing it
//            (`conquest.repeat`): take, lose, retake is never a way to farm them.
export const OCCUPATION_GRACE_TURNS = 10;
export const OCCUPATION_GRACE_FLOOR = 20;
export const OCCUPATION_GRACE_UNREST_CAP = 80;
export const CAPTURE_REPEAT_TURNS = 30;
export const CAPTURE_HISTORY = 6;

/** Did `nationId` already take this city within the last CAPTURE_REPEAT_TURNS turns? */
export const isRepeatCapture = (region, nationId, turn) => (region?.captureLog || []).some((e) => e.by === nationId && turn - e.turn < CAPTURE_REPEAT_TURNS);
/** Is the city inside its occupation grace on `turn`? */
export const inOccupationGrace = (region, turn) => region?.conquest?.graceUntil != null && turn < region.conquest.graceUntil;

// If `nationId`'s capital is no longer its own, move it to its richest remaining province (and cost
// it stability). Returns `nations` unchanged when nothing moved or nothing is left.
export const relocateLostCapital = (nations, regions, nationId, stabilityPenalty = CAPITAL_LOST_IN_PEACE_STABILITY_PENALTY) => {
  const nation = nations[nationId];
  const capitalId = getCapital({ nations }, nationId);
  if (!nation || !capitalId || regions[capitalId]?.owner === nationId) return nations;
  const remaining = Object.values(regions).filter((r) => r.owner === nationId);
  if (!remaining.length) return nations;
  const newCapital = remaining.reduce((best, r) => (getTotalDev(r) > getTotalDev(best) ? r : best));
  return { ...nations, [nationId]: { ...nation, capitalRegionId: newCapital.id, stability: clampStability((nation.stability || 0) - stabilityPenalty) } };
};

/**
 * `conquerorId` takes `regionId` by force in `war`. Pure: returns { regions, nations, loserId,
 * capitalTaken } for the caller to write back.
 */
export const conquerRegion = ({ regions, nations, turnNumber }, regionId, conquerorId, war = null) => {
  const region = regions[regionId];
  const loserId = region.owner;
  const loserCapital = getCapital({ nations }, loserId);
  const { region: taken } = transferRegion(region, conquerorId, nations, {
    control: CONQUEST_CONTROL,
    unrest: Math.max(region.unrest || 0, CONQUEST_MIN_UNREST),
    lastAttackedTurn: turnNumber,
    conquest: { warId: war?.id || null, from: loserId, turn: turnNumber, capital: loserCapital === regionId, ...(isRepeatCapture(region, conquerorId, turnNumber) ? { repeat: true } : { graceUntil: turnNumber + OCCUPATION_GRACE_TURNS }) },
    captureLog: [...(region.captureLog || []), { by: conquerorId, from: loserId, turn: turnNumber }].slice(-CAPTURE_HISTORY),
    // Loyalty (loyalty.js): a taken city starts half loyal and resents the conquest for a while.
    loyalty: LOYALTY_ON_CONQUEST, freeCity: undefined
  });
  const nextRegions = { ...regions, [regionId]: taken };
  // Taking an independent's city costs half the usual AE (plans/independent-cities.md 5).
  const indepMult = isIndependentNation(nations[loserId]) ? INDEPENDENT_CONQUEST_AE_MULT : 1;
  let nextNations = applyAggressiveExpansion(nations, nextRegions, regionId, loserId, conquerorId, aeMultFor({ nations, regions }, conquerorId, region) * indepMult);
  // The claim the city was taken for is settled.
  if (nextNations[conquerorId]?.claims?.includes(regionId)) nextNations = { ...nextNations, [conquerorId]: { ...nextNations[conquerorId], claims: nextNations[conquerorId].claims.filter((id) => id !== regionId) } };
  // Its kin among the independents remember (grudges.js, phase W2).
  if (isIndependentNation(nations[loserId])) nextNations = grudgeForKinCity(nextNations, loserId, conquerorId, turnNumber);
  nextNations = relocateLostCapital(nextNations, nextRegions, loserId);
  return { regions: nextRegions, nations: nextNations, loserId, capitalTaken: loserCapital === regionId };
};

// Is `region` land that `takerId` conquered from `fromId` during the (still running) war `war`?
export const isConqueredInWar = (region, war, takerId, fromId) =>
  !!region?.conquest && region.conquest.warId === war.id && region.owner === takerId && region.conquest.from === fromId;
