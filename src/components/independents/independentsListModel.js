// src/components/independents/independentsListModel.js
// The independents list in Relations (phase W4): every independent the player has met, with its
// personality, distance, attitude, grudge and the current deal, sorted and filtered. Read only.
// Distance is from the player's nearest city (km, great circle between tile centres).
import { getTiles } from '../../data/geo/tiles';
import { tileKm } from '../../engine/tradeValue';
import { isIndependentNation, PERSONALITIES, PERSONALITY_IDS } from '../../data/independents';
import { grudgeOf } from '../../engine/grudges';
import { attitudeOf } from '../../engine/indepPolicy';
import { hasMet } from '../../engine/fog';
import { attitudeLabel, grudgeTone } from './independentSheetModel';
import { shieldUrl, shieldColour } from './independentArt';
import { cityStateViewOf } from './cityStateView';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { independentKindName } from '../../i18n/gameText';

// Labels are read when drawn (getters), so they follow the language.
export const LIST_SORTS = ['distance', 'attitude', 'grudge', 'name'].map((id) => ({ id, get label() { return t(`sw.ind.sort.${id}`); } }));
export const LIST_FILTERS = [
  ...['all', 'deals', 'threats'].map((id) => ({ id, get label() { return t(`sw.ind.filter.${id}`); } })),
  ...PERSONALITY_IDS.map((p) => ({ id: p, get label() { return independentKindName(p, PERSONALITIES[p].name); } }))
];

/** The deal that matters most between the player and `n`, or null: { kind, label, tone }. */
export const dealOf = (state, n) => {
  const me = state.playerNationId;
  const ind = n.indep || {};
  if (ind.raid && ind.raid.targetNationId === me && ind.raid.phase !== 'home') return { kind: 'raiding', label: t('ind.raidingYou'), tone: 'bad' };
  const demand = (state.tributeDemands || []).find((d) => d.indepId === n.id);
  if (demand) return { kind: 'demand', label: t('sw.ind.deal.demand', { gold: demand.gold }), tone: 'warn' };
  if ((state.joinOffers || []).some((o) => o.indepId === n.id)) return { kind: 'joinOffer', label: t('sw.ind.deal.joinOffer'), tone: 'good' };
  if (ind.tributeFrom?.[me]) return { kind: 'youPay', label: t('sw.ind.deal.youPay', { gold: ind.tributeFrom[me].gold }), tone: 'neutral' };
  if (ind.tributeTo?.[me]) return { kind: 'theyPay', label: t('sw.ind.deal.theyPay', { gold: ind.tributeTo[me].gold }), tone: 'good' };
  if (ind.tradeWith?.[me] != null) return { kind: 'trade', label: t('sw.ind.deal.trade'), tone: 'good' };
  const hired = Object.values(state.units || {}).some((u) => u.ownerId === me && u.mercenary?.from === n.id);
  if (hired) return { kind: 'mercs', label: t('sw.ind.deal.mercs'), tone: 'neutral' };
  return null;
};

const THREATS = new Set(['raiding', 'demand']);

/**
 * { rows, total, counts } for the list. `sort`: LIST_SORTS id; `filter`: LIST_FILTERS id.
 * Each row: { id, name, cityId, cityName, size, personality, personalityName, colour, shieldUrl,
 * km, attitude, attitudeWord, attitudeTone, grudge, grudgeTone, deal }.
 */
export const independentsListModel = (state, { sort = 'distance', filter = 'all' } = {}) => {
  const me = state.playerNationId;
  const tiles = getTiles();
  const mine = Object.values(state.regions || {}).filter((c) => c.owner === me && !c.outpost && c.tile != null).map((c) => c.tile);
  const all = [];
  Object.values(state.nations || {}).forEach((n) => {
    if (!isIndependentNation(n) || n.isEliminated || !hasMet(state, me, n.id)) return;
    const city = state.regions?.[n.capitalRegionId];
    if (!city || city.owner !== n.id) return;
    const p = n.indep?.personality || 'tribal';
    const km = mine.reduce((best, t) => Math.min(best, tileKm(tiles, t, city.tile)), Infinity);
    const attitude = Math.round(attitudeOf(state, n.id, me));
    const label = attitudeLabel(state, n, me, attitude);
    const grudge = Math.round(grudgeOf(n, me));
    all.push({
      id: n.id, name: nameNow('people', n.id, n.name), cityId: city.id, cityName: nameNow('city', city.id, city.name), size: city.size || 1,
      personality: p, personalityName: independentKindName(p, PERSONALITIES[p]?.name || p), cityState: cityStateViewOf(state, n, me), colour: shieldColour(p), shieldUrl: shieldUrl(p),
      km, attitude, attitudeWord: label.word, attitudeTone: label.tone, grudge, grudgeTone: grudgeTone(grudge),
      deal: dealOf(state, n)
    });
  });
  const counts = { all: all.length, deals: 0, threats: 0 };
  PERSONALITY_IDS.forEach((p) => { counts[p] = 0; });
  all.forEach((r) => { counts[r.personality] += 1; if (r.deal) counts.deals += 1; if (r.deal && THREATS.has(r.deal.kind)) counts.threats += 1; });
  const keep = filter === 'all' ? () => true
    : filter === 'deals' ? (r) => !!r.deal
      : filter === 'threats' ? (r) => !!r.deal && THREATS.has(r.deal.kind)
        : (r) => r.personality === filter;
  const by = {
    distance: (a, b) => a.km - b.km,
    attitude: (a, b) => b.attitude - a.attitude,
    grudge: (a, b) => b.grudge - a.grudge,
    name: () => 0
  }[sort] || ((a, b) => a.km - b.km);
  const rows = all.filter(keep).sort((a, b) => by(a, b) || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1));
  return { rows, total: all.length, counts };
};

/** "540 km" / "far" for a row. */
export const kmLabel = (km) => (Number.isFinite(km) ? t('sw.km', { n: Math.round(km / 10) * 10 }) : t('sw.far'));
