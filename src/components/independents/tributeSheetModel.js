// src/components/independents/tributeSheetModel.js
// The two sheets an independent opens on the player (phase W4): a tribute demand (the W15 sketch:
// Pay, Refuse with the expected loss, or Refuse and hire mercenaries; the grudge meter) and a
// join offer (W3's offer, Accept or Decline). Plain data for TributeDemandSheet.jsx and
// JoinOfferSheet.jsx. Read only.
import { getTiles } from '../../data/geo/tiles';
import { isIndependentNation, PERSONALITIES, GRUDGE_MAX, GRUDGE_REFUSED, MERC_SELLERS, MERC_CONTRACT_TURNS, ROUTE_LOOT, JOIN_LOYALTY } from '../../data/independents';
import { unitDisplayName } from '../../data/unitNames';
import { ActionTypes } from '../../data/types';
import { grudgeOf } from '../../engine/grudges';
import { raidForecast } from '../../engine/raids';
import { mercOffer } from '../../engine/mercenaries';
import { grudgeWord, GRUDGE_BANDS, garrisonOf } from './independentSheetModel';
import { shieldUrl, shieldColour } from './independentArt';

const placeName = (state, tile) => getTiles().names?.[tile] || state.regions?.[state.world?.tileOwner?.[tile]]?.name || 'the frontier';

/** What a refused demand would most likely cost: { text, where, tile } or null when nothing is in reach. */
export const expectedLoss = (state, indepId) => {
  const f = raidForecast(state, indepId, state.playerNationId);
  if (!f) return null;
  const city = f.cityId != null ? state.regions?.[f.cityId] : null;
  const place = placeName(state, f.tile);
  const text = {
    pillage: `the land of ${city?.name || place} pillaged (${place}): no yield there until repaired, ${f.loot} gold to them`,
    route: `your trade route cut at ${place} while they stand on it, ${ROUTE_LOOT} gold taken`,
    settler: `your settlers near ${place} killed`,
    outpost: `the outpost of ${city?.name || place} burned: half its growth lost`,
    sack: `${city?.name || place} sacked: ${f.loot} gold, one size and one building tier (never more than half)`
  }[f.kind] || `a raid near ${place}`;
  return { text, kind: f.kind, tile: f.tile, cityId: city?.id ?? null, where: city?.name || place, likely: f.likely };
};

/** The best mercenary offer from another seller (the demander left out), or null. */
export const bestOtherOffer = (state, indepId) => {
  const me = state.playerNationId;
  let best = null;
  Object.keys(state.nations || {}).sort().forEach((id) => {
    const n = state.nations[id];
    if (id === indepId || !isIndependentNation(n) || n.isEliminated || !MERC_SELLERS.includes(n.indep?.personality)) return;
    const o = mercOffer(state, id, me);
    if (o.ok && (!best || o.rings < best.offer.rings)) best = { sellerId: id, offer: o };
  });
  return best;
};

/** The tribute demand sheet for demand `demandId`, or null when it is gone. */
export const tributeDemandModel = (state, demandId) => {
  const d = (state.tributeDemands || []).find((x) => x.id === demandId);
  const n = d ? state.nations?.[d.indepId] : null;
  if (!d || !isIndependentNation(n) || n.isEliminated) return null;
  const me = state.playerNationId;
  const turn = state.turnNumber || 0;
  const gold = Math.floor(state.resources?.gold || 0);
  const p = n.indep?.personality || 'tribal';
  const g = Math.round(grudgeOf(n, me));
  const after = Math.min(GRUDGE_MAX, g + GRUDGE_REFUSED);
  const loss = expectedLoss(state, d.indepId);
  const merc = bestOtherOffer(state, d.indepId);
  // Who stands at the likely target (the W15 footnote "Kish garrison is 1 turn from the fields").
  const guard = loss?.cityId != null ? state.regions[loss.cityId] : null;
  const guardUnits = guard && guard.owner === me ? garrisonOf(state, me, guard).length : 0;
  const choices = [
    {
      id: 'pay', title: `Pay ${d.gold} gold a turn`, figure: `gold ${gold}, ${d.gold * d.turns} in all`,
      text: `For ${d.turns} turns: no raids from them, and you may not attack them meanwhile. A missed payment ends the deal and adds ${GRUDGE_REFUSED} grudge.`,
      ok: true, warn: gold < d.gold ? `You hold ${gold} gold: the first payment would be missed.` : null,
      actions: [{ type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay: true } }]
    },
    {
      id: 'refuse', title: 'Refuse and prepare', figure: 'expected loss',
      text: loss ? `If they come: ${loss.text}. Grudge +${GRUDGE_REFUSED}. Or meet them there with an army.` : `Nothing of yours in their reach is worth a raid now. Grudge +${GRUDGE_REFUSED}.`,
      ok: true, warn: null,
      actions: [{ type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay: false } }]
    }
  ];
  if (merc) {
    const seller = state.nations[merc.sellerId];
    const o = merc.offer;
    choices.push({
      id: 'hire', title: 'Refuse and hire mercenaries', figure: `${o.price} gold + ${o.upkeep} a turn`,
      text: `${unitDisplayName(state.age || 'bronze', o.classId)} from ${seller.name} (${PERSONALITIES[seller.indep?.personality]?.name || ''}), ${MERC_CONTRACT_TURNS} turns, waiting in ${state.regions[o.cityId]?.name || 'your city'}. Grudge +${GRUDGE_REFUSED}.`,
      ok: gold >= o.price, warn: gold >= o.price ? null : `You need ${o.price} gold (you have ${gold}).`,
      actions: [{ type: ActionTypes.HIRE_MERCENARY, payload: { independentId: merc.sellerId } }, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay: false } }]
    });
  }
  return {
    id: d.id, indepId: d.indepId, name: n.name, personality: { id: p, name: PERSONALITIES[p]?.name || p, colour: shieldColour(p), shieldUrl: shieldUrl(p) },
    gold: d.gold, turns: d.turns, expires: d.expires, turnsLeft: Math.max(0, d.expires - turn),
    grudge: { value: g, after, word: grudgeWord(g), afterWord: grudgeWord(after), max: GRUDGE_MAX, bands: GRUDGE_BANDS.map(([from, word]) => ({ from, word })) },
    loss,
    footnote: loss && guard && guard.owner === me ? `${guard.name} has ${guardUnits} unit${guardUnits === 1 ? '' : 's'} in its garrison.` : null,
    choices,
    // The default pick: pay when they would hit a city, else refuse.
    preferred: loss?.kind === 'sack' && gold >= d.gold ? 'pay' : 'refuse'
  };
};

/** The join offer sheet for offer `offerId`, or null. */
export const joinOfferModel = (state, offerId) => {
  const o = (state.joinOffers || []).find((x) => x.id === offerId);
  const n = o ? state.nations?.[o.indepId] : null;
  if (!o || !isIndependentNation(n) || n.isEliminated) return null;
  const city = state.regions?.[n.capitalRegionId];
  if (!city || city.owner !== o.indepId) return null;
  const units = Object.values(state.units || {}).filter((u) => u.ownerId === o.indepId && u.strength > 0).length;
  const p = n.indep?.personality || 'tribal';
  return {
    id: o.id, indepId: o.indepId, name: n.name, personality: { id: p, name: PERSONALITIES[p]?.name || p, colour: shieldColour(p), shieldUrl: shieldUrl(p) },
    city: { id: city.id, name: city.name, size: city.size || 1 }, units,
    expires: o.expires, turnsLeft: Math.max(0, o.expires - (state.turnNumber || 0)),
    gains: [`${city.name}, size ${city.size || 1}`, `${units} unit${units === 1 ? '' : 's'} of soldiers`, 'no anger from your neighbours (no aggressive expansion)', `a loyal city (loyalty ${JOIN_LOYALTY})`],
    accept: { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: true } },
    decline: { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: false } }
  };
};
