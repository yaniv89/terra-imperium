// src/components/independents/independentSheetModel.js
// The independent city sheet (phase W4; plans/independent-cities.md 7, the W08 sketch): what the
// sheet shows of one independent, as plain data, so the component only lays it out and the tests
// read the rules. Read only: every number comes from the engine (indepPolicy.js, raids.js,
// mercenaries.js, grudges.js, hostility.js).
//
// The sheet, top to bottom:
//   header      personality shield, name, "Independent, <personality>", one line of facts (place,
//               size, walls, garrison, raid party out)
//   attitude    their attitude to you (-100..100) with the reasons, and the join rule
//   grudge      0..100 with its causes, how fast it fades, and what it does
//   deals       their tribute demand (Pay / Refuse), the tribute you pay or they pay, trade, a join
//               offer, a raid of theirs on its way to you
//   mercenaries for hire: cost, upkeep, contract, where they wait
//   actions     honest names: Attack without war, Pay tribute, Ask to join, Gift, Demand tribute,
//               Offer trade, Hire mercenaries; each carries `ok` and the reason it would be refused,
//               shown on tap. One primary (brass) action at most.
import { getTiles } from '../../data/geo/tiles';
import { tileKm } from '../../engine/tradeValue';
import { PEOPLES } from '../../data/peoples';
import { unitName as unitDisplayName, independentKindName, independentWhere } from '../../i18n/gameText';
import { t } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { reasonText } from '../../i18n/messageText';
import { carryText } from '../battle/battleText';
import { opinionLabel } from '../panels/opinionText';
import { ActionTypes } from '../../data/types';
import {
  isIndependentNation, PERSONALITIES, GRUDGE_MAX, GRUDGE_DECAY, GRUDGE_REFUSED, MERC_SELLERS, MERC_CONTRACT_TURNS, MERC_MAX_GRUDGE,
  TRADE_MAX_GRUDGE, TRIBUTE_DEMAND_GRUDGE, FORTRESS_REVENGE_GRUDGE, GIFT_GOLD, GIFT_FAVOUR, JOIN_OPINION, JOIN_TURNS,
  JOIN_STRENGTH_OPINION, JOIN_STRENGTH_RATIO, INDEPENDENT_CONQUEST_AE_MULT, RAID_KM, tradeGoldOf, garrisonTarget
} from '../../data/independents';
import { grudgeOf, grudgeCausesOf, GRUDGE_CAUSES } from '../../engine/grudges';
import { tributePerTurn } from '../../engine/tributePricing';
import { canAttack } from '../../engine/hostility';
import { attitudeOf, mayJoin, joinCheck, demandTributeCheck, tradeCheck, offerTributeCheck } from '../../engine/indepPolicy';
import { opinionBreakdown } from '../../engine/opinion';
import { mercOffer, mercStockOf } from '../../engine/mercenaries';
import { raidEta } from '../../engine/raids';
import { wallsLabel } from '../battle/warModel';
import { unitTile } from '../../engine/armies';
import { shieldUrl, shieldColour } from './independentArt';
import { cityStateViewOf } from './cityStateView';
import { independentAgeOf } from '../../engine/ageRefs';

/** Attitude words by value (the W08 meter): -100..100. */
export const attitudeWord = (v) => t(`ind.att.${v >= JOIN_OPINION ? 'Devoted' : v >= JOIN_STRENGTH_OPINION ? 'Friendly' : v >= 10 ? 'Warm' : v > -20 ? 'Wary' : v > -50 ? 'Unfriendly' : 'Hostile'}`);
/** good / neutral / bad for an attitude. */
export const attitudeTone = (v) => (v >= JOIN_STRENGTH_OPINION ? 'good' : v > -20 ? 'neutral' : 'bad');

/**
 * The attitude word and tone that match what they are doing (CB08, I111). Warmth from kin and
 * culture stays in the number, but while a party of theirs is out against you, or one hit you in
 * the last LAST_RAID_TURNS turns, the label says so instead of a plain "Warm".
 * Returns { word, tone, raiding: 'now' | 'lately' | null }.
 */
export const attitudeLabel = (state, n, me, value) => {
  const ind = n?.indep;
  const raid = ind?.raid;
  const now = !!raid && raid.targetNationId === me && raid.phase !== 'home';
  const last = ind?.lastRaidOnPlayer;
  const lately = !now && !!last && (state.turnNumber || 0) - last.turn <= LAST_RAID_TURNS;
  const base = attitudeWord(value);
  if (!now && !lately) return { word: base, tone: attitudeTone(value), raiding: null };
  const tail = t(now ? 'ind.raidingYou' : 'ind.raidedLately');
  const word = t(value > -20 ? 'ind.attBut' : 'ind.attComma', { base, tail });
  return { word, tone: 'bad', raiding: now ? 'now' : 'lately' };
};

/** Grudge bands of the W15 meter: [from, word]. */
const GRUDGE_BAND_DEFS = [[0, 'calm'], [25, 'wary'], [50, 'hostile'], [75, 'feud']];
/** The bands with their words in the current language. */
export const grudgeBands = () => GRUDGE_BAND_DEFS.map(([from, id]) => [from, t(`ind.gw.${id}`)]);
export const grudgeWord = (g) => t(`ind.gw.${GRUDGE_BAND_DEFS.reduce((w, [from, id]) => (g >= from ? id : w), 'calm')}`);
export const grudgeTone = (g) => (g >= 50 ? 'bad' : g > 0 ? 'neutral' : 'good');

const moodText = (mood) => (['raiding', 'besieged', 'recovering'].includes(mood) ? t(`ind.mood.${mood}`) : null);

/** How long the sheet and the city card name the last raid's outcome. */
export const LAST_RAID_TURNS = 10;

/** What a raid goes for, in a few words. */
export const RAID_KIND_WORDS = Object.fromEntries(['pillage', 'route', 'settler', 'outpost', 'sack'].map((k) => [k, k]));
export const raidKindWord = (kind) => (RAID_KIND_WORDS[kind] ? t(`ind.raidKind.${kind}`) : kind);

const placeName = (state, tile) => { const n = getTiles().names?.[tile] || state.regions?.[state.world?.tileOwner?.[tile]]?.name; return n ? nameNow('place', null, n) : t('ind.frontier'); };

/** A raid's target in words: "the fields of Kish", "Uruk", "your settlers near X". */
export const raidTargetName = (state, raid) => {
  if (!raid) return '';
  const city = raid.targetCityId != null ? state.regions?.[raid.targetCityId] : state.regions?.[state.world?.tileOwner?.[raid.targetTile]];
  switch (raid.kind) {
    case 'sack': return city?.name ? nameNow('city', null, city.name) : placeName(state, raid.targetTile);
    case 'outpost': return t('ind.target.outpost', { place: city?.name ? nameNow('city', null, city.name) : placeName(state, raid.targetTile) });
    case 'settler': return t('ind.target.settler', { place: placeName(state, raid.targetTile) });
    case 'route': return t('ind.target.route', { place: placeName(state, raid.targetTile) });
    default: return city ? t('ind.target.land', { city: nameNow('city', null, city.name), place: placeName(state, raid.targetTile) }) : placeName(state, raid.targetTile);
  }
};

/** Land units of `id` standing in its city (its garrison, the raid party left out). */
export const garrisonOf = (state, id, city) => Object.values(state.units || {}).filter((u) => u.ownerId === id && !u.raidOf && u.domain !== 'naval' && !u.embarkedOn && u.strength > 0 && u.classId !== 'settler' && unitTile(state, u) === city?.tile);

/** km from the nearest city of `nationId` to `tile` (Infinity without one). */
export const kmFromNearest = (state, nationId, tile) => {
  const tiles = getTiles();
  let best = Infinity;
  Object.values(state.regions || {}).forEach((c) => { if (c.owner === nationId && !c.outpost && c.tile != null) best = Math.min(best, tileKm(tiles, c.tile, tile)); });
  return best;
};

const turnsText = (n) => t('ind.turns', { count: n });
const bandsText = (n) => t('ind.bands', { count: n });

/** The full sheet of independent `indepId` for the player, or null. */
export const independentSheetModel = (state, indepId) => {
  const n = state?.nations?.[indepId];
  if (!isIndependentNation(n)) return null;
  const me = state.playerNationId;
  const turn = state.turnNumber || 0;
  const gold = state.resources?.gold || 0;
  const ind = n.indep || {};
  const p = ind.personality || 'tribal';
  const city = state.regions?.[n.capitalRegionId];
  const alive = !n.isEliminated && !!city && city.owner === indepId;
  const people = PEOPLES[n.people];

  // Header facts.
  const garrison = alive ? garrisonOf(state, indepId, city) : [];
  const facts = [];
  if (alive) {
    facts.push(nameNow('city', null, city.name));
    const place = city.tile != null ? getTiles().names?.[city.tile] : null;
    if (place && place !== city.name) facts.push(nameNow('place', null, place));
    facts.push(t('ind.fact.size', { n: city.size || 1 }));
    facts.push(wallsLabel(city).toLowerCase()); // the walls' one name on every screen (I009)
    facts.push(t('ind.fact.garrison', { n: garrison.length }));
    if (moodText(ind.mood)) facts.push(moodText(ind.mood));
    if (city.razing) facts.push(t('ind.fact.burning'));
  } else facts.push(ind.joined ? t('ind.fact.joined', { name: state.nations[ind.joined.to]?.name ? nameNow('people', ind.joined.to, state.nations[ind.joined.to].name) : t('ind.fact.aNation') }) : t('ind.fact.fallen'));

  // Attitude.
  const attitude = attitudeOf(state, indepId, me);
  // Why: every part, the starting point first, then the rest by size, and a line for what rounding
  // or the end of the scale takes, so the lines add up to the number shown (CB08, I112).
  const bd = opinionBreakdown(state, indepId, me);
  const reasons = [
    ...bd.rows.filter((r) => r.id === 'baseline'),
    ...bd.rows.filter((r) => r.id !== 'baseline' && r.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  ].map((r) => ({ id: r.id, label: opinionLabel(r, true), value: r.value }));
  if (bd.rounding !== 0) reasons.push({ id: 'rounding', label: t('ind.reason.rounding'), value: bd.rounding });
  if (bd.clamped) reasons.push({ id: 'scaleEnd', label: t('ind.reason.scaleEnd'), value: Math.round((bd.total - bd.sum) * 10) / 10 });
  const attitudeShown = attitudeLabel(state, n, me, attitude);
  const joinable = mayJoin(n);
  const join = alive ? joinCheck(state, indepId, me) : { ok: false, reason: t('m.why.indepCityGone') };
  const joinRule = !joinable
    ? (p === 'fortress' ? t('ind.joinRule.fortress') : t('ind.joinRule.raiders'))
    : t('ind.joinRule.other', { open: JOIN_OPINION, turns: JOIN_TURNS, strong: JOIN_STRENGTH_OPINION, ratio: JOIN_STRENGTH_RATIO });

  // Grudge.
  const g = grudgeOf(n, me);
  const effects = [];
  if (g > 0 && RAID_KM[p]) effects.push(t('ind.grudge.raids', { n: Math.round(g) }));
  if (g >= TRIBUTE_DEMAND_GRUDGE && ['raiders', 'tribal'].includes(p)) effects.push(t('ind.grudge.tribute'));
  if (p === 'fortress') effects.push(g >= FORTRESS_REVENGE_GRUDGE ? t('ind.grudge.fortressRevenge') : t('ind.grudge.fortressOnly', { n: FORTRESS_REVENGE_GRUDGE }));
  if (MERC_SELLERS.includes(p) && g >= MERC_MAX_GRUDGE) effects.push(t('ind.grudge.noMercs'));
  if (p === 'mercantile' && g >= TRADE_MAX_GRUDGE) effects.push(t('ind.grudge.noTrade'));
  const grudge = {
    value: Math.round(g), max: GRUDGE_MAX, word: grudgeWord(g), tone: grudgeTone(g), decay: GRUDGE_DECAY,
    fadesIn: g > 0 ? Math.ceil(g / GRUDGE_DECAY) : 0,
    causes: grudgeCausesOf(n, me).map((c) => ({ label: GRUDGE_CAUSES[c.id] ? t(`ind.cause.${c.id}`) : c.id, turn: c.turn, amount: Math.round(c.amount) })),
    effects
  };

  // Deals.
  const demand = (state.tributeDemands || []).find((d) => d.indepId === indepId) || null;
  const youPay = ind.tributeFrom?.[me] || null;
  const theyPay = ind.tributeTo?.[me] || null;
  const trades = ind.tradeWith?.[me] != null;
  const joinOffer = (state.joinOffers || []).find((o) => o.indepId === indepId) || null;
  const raid = ind.raid && ind.raid.targetNationId === me && ind.raid.phase !== 'home' ? ind.raid : null;
  const eta = raid ? raidEta(state, indepId) : null;
  const deals = {
    demand: demand ? { id: demand.id, gold: demand.gold, turns: demand.turns, expires: demand.expires, turnsLeft: Math.max(0, demand.expires - turn), afterRefuse: Math.min(GRUDGE_MAX, Math.round(g) + GRUDGE_REFUSED) } : null,
    youPay: youPay ? { gold: youPay.gold, until: youPay.until } : null,
    theyPay: theyPay ? { gold: theyPay.gold, until: theyPay.until } : null,
    trade: trades ? { gold: tradeGoldOf(independentAgeOf(state, indepId)) } : null,
    joinOffer: joinOffer ? { id: joinOffer.id, expires: joinOffer.expires } : null,
    // The outcome of their last raid on you (raids.js lastRaidOnPlayer), shown LAST_RAID_TURNS turns.
    lastRaid: ind.lastRaidOnPlayer && turn - ind.lastRaidOnPlayer.turn <= LAST_RAID_TURNS ? { ...ind.lastRaidOnPlayer, englishText: ind.lastRaidOnPlayer.text, text: carryText(ind.lastRaidOnPlayer.textMsg ? { msgKey: ind.lastRaidOnPlayer.textMsg.key, msgVars: ind.lastRaidOnPlayer.textMsg.vars, message: ind.lastRaidOnPlayer.text } : null, ind.lastRaidOnPlayer.text), ago: turn - ind.lastRaidOnPlayer.turn } : null,
    raid: raid ? { kind: raid.kind, kindWord: raidKindWord(raid.kind), target: raidTargetName(state, raid), tile: raid.targetTile, eta: eta?.turns ?? null } : null
  };

  // Mercenaries.
  const sells = MERC_SELLERS.includes(p);
  let mercs = null;
  if (sells && alive) {
    const offer = mercOffer(state, indepId, me);
    const stock = mercStockOf(n, turn);
    const hired = Object.values(state.units || {}).filter((u) => u.ownerId === me && u.mercenary?.from === indepId).map((u) => ({ id: u.id, until: u.mercenary.until, upkeep: u.mercenary.upkeep }));
    mercs = {
      stock,
      offer: offer.ok ? {
        unit: unitDisplayName(independentAgeOf(state, indepId), offer.classId), classId: offer.classId, price: offer.price, upkeep: offer.upkeep, turns: MERC_CONTRACT_TURNS,
        waitIn: state.regions[offer.cityId]?.name ? nameNow('city', null, state.regions[offer.cityId].name) : '', affordable: gold >= offer.price
      } : null,
      reason: offer.ok ? (gold < offer.price ? t('ind.merc.youNeed', { gold: offer.price, have: Math.floor(gold) }) : null) : reasonText(offer),
      hired,
      note: t('ind.merc.note')
    };
  }

  // Actions (honest names; `ok` false keeps the button tappable to show the reason).
  const send = (type, extra = {}) => ({ type, payload: { independentId: indepId, ...extra } });
  const actions = [];
  if (alive) {
    const attackOk = canAttack(state, me, indepId);
    actions.push({
      id: 'attack', label: t('ind.act.attack'), tone: 'danger',
      sub: attackOk ? t('ind.act.attackSubOk') : t('ind.act.attackSubNo'),
      ok: attackOk,
      reason: attackOk ? t('ind.act.attackReasonOk', { pct: Math.round(INDEPENDENT_CONQUEST_AE_MULT * 100) })
        : t('ind.act.attackReasonNo', { n: youPay?.until }),
      run: { kind: 'focusCity', cityId: city.id }
    });
    if (demand) {
      actions.push({ id: 'payTribute', label: t('ind.act.payTribute'), sub: t('ind.act.goldTurn', { gold: demand.gold }), ok: true, reason: t('ind.act.payReasonDemand', { gold: demand.gold, turns: demand.turns }), run: { action: { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: demand.id, pay: true } } } });
    } else {
      const tr = offerTributeCheck(state, indepId, me);
      actions.push({ id: 'payTribute', label: t('ind.act.payTribute'), sub: tr.ok ? t('ind.act.paySubOk', { gold: tr.gold }) : youPay ? t('ind.act.paySubNow') : t('ind.act.paySubNo'), ok: tr.ok, reason: reasonText(tr), run: { action: send(ActionTypes.OFFER_INDEPENDENT_TRIBUTE) } });
    }
    actions.push({
      id: 'join', label: joinOffer ? t('ind.act.accept') : t('ind.act.askJoin'), tone: 'good',
      sub: !joinable ? (p === 'fortress' ? t('ind.act.joinNever.fortress') : t('ind.act.joinNever.raiders')) : join.ok ? t('ind.act.joinYes') : t('ind.act.joinAttitude', { n: attitude }),
      ok: !!joinOffer || join.ok,
      reason: joinOffer ? t('ind.act.joinReasonOffer') : join.ok ? t('ind.act.joinReasonYes') : reasonText(join),
      run: { action: joinOffer ? { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: joinOffer.id, accept: true } } : send(ActionTypes.PROPOSE_JOINING) }
    });
    actions.push({
      id: 'gift', label: t('ind.act.gift', { gold: GIFT_GOLD }), sub: t('ind.act.giftSub', { n: GIFT_FAVOUR }), ok: gold >= GIFT_GOLD,
      reason: gold >= GIFT_GOLD ? t('ind.act.giftReason', { gold: GIFT_GOLD, n: GIFT_FAVOUR }) : t('ind.merc.youNeed', { gold: GIFT_GOLD, have: Math.floor(gold) }),
      run: { action: send(ActionTypes.GIFT_INDEPENDENT) }
    });
    const dt = demandTributeCheck(state, indepId, me);
    actions.push({
      id: 'demandTribute', label: t('ind.act.demand'), sub: !dt.ok ? t('ind.act.demandNot') : dt.would ? t('ind.act.demandWould', { gold: tributePerTurn(state, indepId, indepId) }) : t('ind.act.demandRefuse'),
      ok: dt.ok, warn: dt.ok && !dt.would, reason: dt.ok && !dt.would ? t('ind.act.demandRefusal', { reason: reasonText(dt), n: GRUDGE_REFUSED }) : reasonText(dt),
      run: { action: send(ActionTypes.DEMAND_INDEPENDENT_TRIBUTE) }
    });
    if (p === 'mercantile') {
      const tc = tradeCheck(state, indepId, me);
      actions.push({ id: 'trade', label: trades ? t('ind.act.trading') : t('ind.act.offerTrade'), sub: trades ? t('ind.act.tradeSub', { gold: tradeGoldOf(independentAgeOf(state, indepId)) }) : tc.ok ? t('ind.act.tradeOk') : t('ind.act.demandNot'), ok: tc.ok, reason: reasonText(tc), run: { action: send(ActionTypes.PROPOSE_INDEPENDENT_TRADE) } });
    }
    if (sells) {
      const o = mercs?.offer;
      actions.push({
        id: 'hire', label: t('ind.act.hire'), sub: o ? t('ind.act.hireSub', { price: o.price, bands: bandsText(mercs.stock) }) : t('ind.act.hireNone'),
        ok: !!o && o.affordable, reason: o ? (o.affordable ? t('ind.act.hireReason', { unit: o.unit, price: o.price, upkeep: o.upkeep, turns: o.turns, wait: o.waitIn }) : mercs.reason) : mercs?.reason,
        run: { action: { type: ActionTypes.HIRE_MERCENARY, payload: { independentId: indepId } } }
      });
    }
    // One primary at most: answer what they asked, else what would work now.
    const primary = demand ? 'payTribute' : joinOffer || join.ok ? 'join' : null;
    actions.forEach((a) => { if (a.id === primary) a.tone = 'primary'; });
  }

  return {
    id: indepId,
    alive,
    name: nameNow('people', indepId, n.name),
    people: people && people.name !== city?.name ? nameNow('people', n.people, people.name) : null,
    land: people?.landName || null,
    personality: { id: p, name: independentKindName(p, PERSONALITIES[p]?.name || p), where: independentWhere(p, PERSONALITIES[p]?.where || ''), colour: shieldColour(p), shieldUrl: shieldUrl(p) },
    freeCity: !!ind.freeCity,
    cityState: cityStateViewOf(state, n, me),
    city: city ? { id: city.id, name: nameNow('city', null, city.name), tile: city.tile, size: city.size || 1, garrisonTarget: garrisonTarget(city.size, p) } : null,
    facts,
    km: alive ? kmFromNearest(state, me, city.tile) : Infinity,
    attitude: { value: Math.round(attitude), word: attitudeShown.word, tone: attitudeShown.tone, raiding: attitudeShown.raiding, reasons, joinable, joinRule, join: { ok: join.ok, reason: join.ok ? null : join.reason } },
    grudge,
    deals,
    mercs,
    actions
  };
};

/** The short form for the city card (RegionInfoModal): one line each, and the sheet behind a button. */
export const independentSummary = (state, indepId) => {
  const m = independentSheetModel(state, indepId);
  if (!m) return null;
  const lines = [];
  if (m.deals.raid) lines.push({ tone: 'bad', text: t('ind.sum.raiders', { target: m.deals.raid.target, eta: m.deals.raid.eta != null ? t('ind.sum.etaAway', { turns: turnsText(m.deals.raid.eta) }) : '' }) });
  if (m.deals.lastRaid) lines.push({ tone: m.deals.lastRaid.won ? 'bad' : 'good', text: t('ind.sum.lastRaid', { n: m.deals.lastRaid.turn, text: m.deals.lastRaid.text }) });
  if (m.deals.demand) lines.push({ tone: 'warn', text: t('ind.sum.demand', { gold: m.deals.demand.gold, turns: turnsText(m.deals.demand.turnsLeft) }) });
  if (m.deals.joinOffer) lines.push({ tone: 'good', text: t('ind.sum.join') });
  if (m.deals.youPay) lines.push({ tone: 'neutral', text: t('ind.sum.youPay', { gold: m.deals.youPay.gold, n: m.deals.youPay.until }) });
  if (m.deals.theyPay) lines.push({ tone: 'good', text: t('ind.sum.theyPay', { gold: m.deals.theyPay.gold, n: m.deals.theyPay.until }) });
  if (m.deals.trade) lines.push({ tone: 'good', text: t('ind.sum.trade', { gold: m.deals.trade.gold }) });
  return { id: m.id, name: m.name, personality: m.personality, attitude: m.attitude, grudge: m.grudge, lines };
};
