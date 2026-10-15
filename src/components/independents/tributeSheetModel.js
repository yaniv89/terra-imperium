// src/components/independents/tributeSheetModel.js
// The two sheets an independent opens on the player (phase W4): a tribute demand (the W15 sketch:
// Pay, Refuse with the expected loss, or Refuse and hire mercenaries; the grudge meter) and a
// join offer (W3's offer, Accept or Decline). Plain data for TributeDemandSheet.jsx and
// JoinOfferSheet.jsx. Read only.
import { getTiles } from '../../data/geo/tiles';
import { isIndependentNation, PERSONALITIES, GRUDGE_MAX, GRUDGE_REFUSED, MERC_SELLERS, MERC_CONTRACT_TURNS, ROUTE_LOOT, JOIN_LOYALTY } from '../../data/independents';
import { unitName as unitDisplayName, independentKindName } from '../../i18n/gameText';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';

import { ActionTypes } from '../../data/types';
import { grudgeOf } from '../../engine/grudges';
import { raidForecast } from '../../engine/raids';
import { mercOffer } from '../../engine/mercenaries';
import { grudgeWord, grudgeBands, garrisonOf } from './independentSheetModel';
import { shieldUrl, shieldColour } from './independentArt';

const placeName = (state, tile) => { const n = getTiles().names?.[tile] || state.regions?.[state.world?.tileOwner?.[tile]]?.name; return n ? nameNow('place', null, n) : t('ind.frontier'); };
const cityNow = (c) => (c?.name ? nameNow('city', null, c.name) : null);

/** What a refused demand would most likely cost: { text, where, tile } or null when nothing is in reach. */
export const expectedLoss = (state, indepId) => {
  const f = raidForecast(state, indepId, state.playerNationId);
  if (!f) return null;
  const city = f.cityId != null ? state.regions?.[f.cityId] : null;
  const place = placeName(state, f.tile);
  const where = cityNow(city) || place;
  const text = {
    pillage: t('td.loss.pillage', { city: where, place, loot: f.loot }),
    route: t('td.loss.route', { place, loot: ROUTE_LOOT }),
    settler: t('td.loss.settler', { place }),
    outpost: t('td.loss.outpost', { city: where }),
    sack: t('td.loss.sack', { city: where, loot: f.loot })
  }[f.kind] || t('td.loss.other', { place });
  return { text, kind: f.kind, tile: f.tile, cityId: city?.id ?? null, where, likely: f.likely };
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
      id: 'pay', title: t('td.c.pay', { gold: d.gold }), figure: t('td.c.payFigure', { have: gold, all: d.gold * d.turns }),
      text: t('td.c.payText', { turns: d.turns, n: GRUDGE_REFUSED }),
      ok: true, warn: gold < d.gold ? t('td.c.payWarn', { have: gold }) : null,
      actions: [{ type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay: true } }]
    },
    {
      id: 'refuse', title: t('td.c.refuse'), figure: t('td.c.refuseFigure'),
      text: loss ? t('td.c.refuseLoss', { loss: loss.text, n: GRUDGE_REFUSED }) : t('td.c.refuseNone', { n: GRUDGE_REFUSED }),
      ok: true, warn: null,
      actions: [{ type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay: false } }]
    }
  ];
  if (merc) {
    const seller = state.nations[merc.sellerId];
    const o = merc.offer;
    choices.push({
      id: 'hire', title: t('td.c.hire'), figure: t('td.c.hireFigure', { price: o.price, upkeep: o.upkeep }),
      text: t('td.c.hireText', { unit: unitDisplayName(state.age || 'bronze', o.classId), seller: nameNow('people', merc.sellerId, seller.name), kind: independentKindName(seller.indep?.personality, PERSONALITIES[seller.indep?.personality]?.name || ''), turns: MERC_CONTRACT_TURNS, city: cityNow(state.regions[o.cityId]) || t('td.c.yourCity'), n: GRUDGE_REFUSED }),
      ok: gold >= o.price, warn: gold >= o.price ? null : t('td.c.hireWarn', { price: o.price, have: gold }),
      actions: [{ type: ActionTypes.HIRE_MERCENARY, payload: { independentId: merc.sellerId } }, { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: d.id, pay: false } }]
    });
  }
  return {
    id: d.id, indepId: d.indepId, name: nameNow('people', d.indepId, n.name), nameEn: n.name, personality: { id: p, name: independentKindName(p, PERSONALITIES[p]?.name || p), colour: shieldColour(p), shieldUrl: shieldUrl(p) },
    gold: d.gold, turns: d.turns, expires: d.expires, turnsLeft: Math.max(0, d.expires - turn),
    grudge: { value: g, after, word: grudgeWord(g), afterWord: grudgeWord(after), max: GRUDGE_MAX, bands: grudgeBands().map(([from, word]) => ({ from, word })) },
    loss,
    footnote: loss && guard && guard.owner === me ? t('td.guard', { city: cityNow(guard), count: guardUnits }) : null,
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
    id: o.id, indepId: o.indepId, name: nameNow('people', o.indepId, n.name), nameEn: n.name, personality: { id: p, name: independentKindName(p, PERSONALITIES[p]?.name || p), colour: shieldColour(p), shieldUrl: shieldUrl(p) },
    city: { id: city.id, name: cityNow(city), size: city.size || 1 }, units,
    expires: o.expires, turnsLeft: Math.max(0, o.expires - (state.turnNumber || 0)),
    gains: [t('td.gain.city', { city: cityNow(city), n: city.size || 1 }), t('td.gain.units', { count: units }), t('td.gain.noAnger'), t('td.gain.loyal', { n: JOIN_LOYALTY })],
    accept: { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: true } },
    decline: { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: o.id, accept: false } }
  };
};
