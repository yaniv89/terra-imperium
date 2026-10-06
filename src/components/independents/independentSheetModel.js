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
import { unitDisplayName } from '../../data/unitNames';
import { ActionTypes } from '../../data/types';
import {
  isIndependentNation, PERSONALITIES, GRUDGE_MAX, GRUDGE_DECAY, GRUDGE_REFUSED, MERC_SELLERS, MERC_CONTRACT_TURNS, MERC_MAX_GRUDGE,
  TRADE_MAX_GRUDGE, TRIBUTE_DEMAND_GRUDGE, FORTRESS_REVENGE_GRUDGE, GIFT_GOLD, GIFT_FAVOUR, JOIN_OPINION, JOIN_TURNS,
  JOIN_STRENGTH_OPINION, JOIN_STRENGTH_RATIO, INDEPENDENT_CONQUEST_AE_MULT, RAID_KM, tradeGoldOf, tributeGold, garrisonTarget
} from '../../data/independents';
import { grudgeOf, grudgeCausesOf, GRUDGE_CAUSES } from '../../engine/grudges';
import { canAttack } from '../../engine/hostility';
import { attitudeOf, mayJoin, joinCheck, demandTributeCheck, tradeCheck, offerTributeCheck } from '../../engine/indepPolicy';
import { opinionReasons } from '../../engine/opinion';
import { mercOffer, mercStockOf } from '../../engine/mercenaries';
import { raidEta } from '../../engine/raids';
import { wallsOf } from '../../engine/sieges';
import { unitTile } from '../../engine/armies';
import { shieldUrl, shieldColour } from './independentArt';

/** Attitude words by value (the W08 meter): -100..100. */
export const attitudeWord = (v) => (v >= JOIN_OPINION ? 'Devoted' : v >= JOIN_STRENGTH_OPINION ? 'Friendly' : v >= 10 ? 'Warm' : v > -20 ? 'Wary' : v > -50 ? 'Unfriendly' : 'Hostile');
/** good / neutral / bad for an attitude. */
export const attitudeTone = (v) => (v >= JOIN_STRENGTH_OPINION ? 'good' : v > -20 ? 'neutral' : 'bad');

/** Grudge bands of the W15 meter: [from, word]. */
export const GRUDGE_BANDS = [[0, 'Calm'], [25, 'Wary'], [50, 'Hostile'], [75, 'Blood feud']];
export const grudgeWord = (g) => GRUDGE_BANDS.reduce((w, [from, word]) => (g >= from ? word : w), 'Calm');
export const grudgeTone = (g) => (g >= 50 ? 'bad' : g > 0 ? 'neutral' : 'good');

const WALL_WORDS = ['no walls', 'walls low', 'walls strong', 'walls great'];
const MOOD = { calm: null, raiding: 'raid party out', besieged: 'under threat', recovering: 'licking its wounds' };

/** What a raid goes for, in a few words. */
export const RAID_KIND_WORDS = { pillage: 'pillage', route: 'trade route', settler: 'settlers', outpost: 'outpost', sack: 'sack' };

const placeName = (state, tile) => getTiles().names?.[tile] || state.regions?.[state.world?.tileOwner?.[tile]]?.name || 'the frontier';

/** A raid's target in words: "the fields of Kish", "Uruk", "your settlers near X". */
export const raidTargetName = (state, raid) => {
  if (!raid) return '';
  const city = raid.targetCityId != null ? state.regions?.[raid.targetCityId] : state.regions?.[state.world?.tileOwner?.[raid.targetTile]];
  switch (raid.kind) {
    case 'sack': return city?.name || placeName(state, raid.targetTile);
    case 'outpost': return `the outpost of ${city?.name || placeName(state, raid.targetTile)}`;
    case 'settler': return `settlers near ${placeName(state, raid.targetTile)}`;
    case 'route': return `the trade route at ${placeName(state, raid.targetTile)}`;
    default: return city ? `the land of ${city.name} (${placeName(state, raid.targetTile)})` : placeName(state, raid.targetTile);
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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

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
    facts.push(city.name);
    const place = city.tile != null ? getTiles().names?.[city.tile] : null;
    if (place && place !== city.name) facts.push(place);
    facts.push(`size ${city.size || 1}`);
    facts.push(WALL_WORDS[wallsOf(city)] || 'walls');
    facts.push(`garrison ${garrison.length}`);
    if (MOOD[ind.mood]) facts.push(MOOD[ind.mood]);
    if (city.razing) facts.push('burning');
  } else facts.push(ind.joined ? `joined ${state.nations[ind.joined.to]?.name || 'a nation'}` : 'fallen');

  // Attitude.
  const attitude = attitudeOf(state, indepId, me);
  const reasons = opinionReasons(state, indepId, me).filter((r) => r.id !== 'baseline' && r.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 6).map((r) => ({ id: r.id, label: r.label, value: Math.round(r.value) }));
  const joinable = mayJoin(n);
  const join = alive ? joinCheck(state, indepId, me) : { ok: false, reason: 'Their city is gone.' };
  const joinRule = !joinable
    ? (p === 'fortress' ? 'A fortress people never joins anyone peacefully.' : 'Raiders keep their freedom: they never join peacefully.')
    : `They join at attitude ${JOIN_OPINION} held ${JOIN_TURNS} turns, or at ${JOIN_STRENGTH_OPINION} with your army ${JOIN_STRENGTH_RATIO} times theirs.`;

  // Grudge.
  const g = grudgeOf(n, me);
  const effects = [];
  if (g > 0 && RAID_KM[p]) effects.push(`raids on you ${Math.round(g)}% likelier`);
  if (g >= TRIBUTE_DEMAND_GRUDGE && ['raiders', 'tribal'].includes(p)) effects.push('they may demand tribute');
  if (p === 'fortress') effects.push(g >= FORTRESS_REVENGE_GRUDGE ? 'a fortress out for revenge: it raids you' : `a fortress raids only in revenge (grudge ${FORTRESS_REVENGE_GRUDGE})`);
  if (MERC_SELLERS.includes(p) && g >= MERC_MAX_GRUDGE) effects.push('they sell you no mercenaries');
  if (p === 'mercantile' && g >= TRADE_MAX_GRUDGE) effects.push('they will not trade with you');
  const grudge = {
    value: Math.round(g), max: GRUDGE_MAX, word: grudgeWord(g), tone: grudgeTone(g), decay: GRUDGE_DECAY,
    fadesIn: g > 0 ? Math.ceil(g / GRUDGE_DECAY) : 0,
    causes: grudgeCausesOf(n, me).map((c) => ({ label: GRUDGE_CAUSES[c.id] || c.id, turn: c.turn, amount: Math.round(c.amount) })),
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
    trade: trades ? { gold: tradeGoldOf(state.age) } : null,
    joinOffer: joinOffer ? { id: joinOffer.id, expires: joinOffer.expires } : null,
    raid: raid ? { kind: raid.kind, kindWord: RAID_KIND_WORDS[raid.kind] || raid.kind, target: raidTargetName(state, raid), tile: raid.targetTile, eta: eta?.turns ?? null } : null
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
        unit: unitDisplayName(state.age || 'bronze', offer.classId), classId: offer.classId, price: offer.price, upkeep: offer.upkeep, turns: MERC_CONTRACT_TURNS,
        waitIn: state.regions[offer.cityId]?.name || '', affordable: gold >= offer.price
      } : null,
      reason: offer.ok ? (gold < offer.price ? `You need ${offer.price} gold (you have ${Math.floor(gold)}).` : null) : offer.reason,
      hired,
      note: 'A band serves until its contract ends, or leaves at once when you cannot pay its upkeep.'
    };
  }

  // Actions (honest names; `ok` false keeps the button tappable to show the reason).
  const send = (type, extra = {}) => ({ type, payload: { independentId: indepId, ...extra } });
  const actions = [];
  if (alive) {
    const attackOk = canAttack(state, me, indepId);
    actions.push({
      id: 'attack', label: 'Attack without war', tone: 'danger',
      sub: attackOk ? 'no declaration needed' : 'truce while you pay',
      ok: attackOk,
      reason: attackOk ? `Anyone may attack an independent: no war, ${Math.round(INDEPENDENT_CONQUEST_AE_MULT * 100)}% of the usual anger from your neighbours, and their kin hold a grudge. March an army from the city card.`
        : `You pay them tribute until turn ${youPay?.until}: no attacks meanwhile.`,
      run: { kind: 'focusCity', cityId: city.id }
    });
    if (demand) {
      actions.push({ id: 'payTribute', label: 'Pay tribute', sub: `${demand.gold} gold a turn`, ok: true, reason: `${demand.gold} gold a turn for ${demand.turns} turns: no raids from them, and no attacks on them meanwhile.`, run: { action: { type: ActionTypes.ANSWER_TRIBUTE_DEMAND, payload: { id: demand.id, pay: true } } } });
    } else {
      const t = offerTributeCheck(state, indepId, me);
      actions.push({ id: 'payTribute', label: 'Pay tribute', sub: t.ok ? `${t.gold} gold a turn, no raids` : youPay ? 'paying now' : 'not taken', ok: t.ok, reason: t.reason, run: { action: send(ActionTypes.OFFER_INDEPENDENT_TRIBUTE) } });
    }
    actions.push({
      id: 'join', label: joinOffer ? 'Accept them' : 'Ask to join', tone: 'good',
      sub: !joinable ? (p === 'fortress' ? 'fortresses never join' : 'raiders never join') : join.ok ? 'they would say yes' : `attitude ${attitude}`,
      ok: !!joinOffer || join.ok,
      reason: joinOffer ? 'They offered to join: their city and soldiers become yours, with no anger from your neighbours.' : join.ok ? 'They would join you now: their city and soldiers become yours, peacefully.' : join.reason,
      run: { action: joinOffer ? { type: ActionTypes.ANSWER_JOIN_OFFER, payload: { id: joinOffer.id, accept: true } } : send(ActionTypes.PROPOSE_JOINING) }
    });
    actions.push({
      id: 'gift', label: `Gift ${GIFT_GOLD} gold`, sub: `+${GIFT_FAVOUR} favour`, ok: gold >= GIFT_GOLD,
      reason: gold >= GIFT_GOLD ? `${GIFT_GOLD} gold raises their attitude to you by ${GIFT_FAVOUR} (favour fades slowly).` : `You need ${GIFT_GOLD} gold (you have ${Math.floor(gold)}).`,
      run: { action: send(ActionTypes.GIFT_INDEPENDENT) }
    });
    const dt = demandTributeCheck(state, indepId, me);
    actions.push({
      id: 'demandTribute', label: 'Demand tribute', sub: !dt.ok ? 'not now' : dt.would ? `+${tributeGold(state.age)} gold a turn` : 'they would refuse',
      ok: dt.ok, warn: dt.ok && !dt.would, reason: dt.ok && !dt.would ? `${dt.reason} A refusal adds ${GRUDGE_REFUSED} grudge.` : dt.reason,
      run: { action: send(ActionTypes.DEMAND_INDEPENDENT_TRIBUTE) }
    });
    if (p === 'mercantile') {
      const tc = tradeCheck(state, indepId, me);
      actions.push({ id: 'trade', label: trades ? 'Trading' : 'Offer trade', sub: trades ? `${tradeGoldOf(state.age)} gold a turn each way` : tc.ok ? 'gold both ways' : 'not now', ok: tc.ok, reason: tc.reason, run: { action: send(ActionTypes.PROPOSE_INDEPENDENT_TRADE) } });
    }
    if (sells) {
      const o = mercs?.offer;
      actions.push({
        id: 'hire', label: 'Hire mercenaries', sub: o ? `${o.price} gold, ${plural(mercs.stock, 'band')} free` : 'none for you',
        ok: !!o && o.affordable, reason: o ? (o.affordable ? `${o.unit}: ${o.price} gold now, then ${o.upkeep} gold a turn for ${o.turns} turns. They wait in ${o.waitIn}.` : mercs.reason) : mercs?.reason,
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
    name: n.name,
    people: people && people.name !== city?.name ? people.name : null,
    land: people?.landName || null,
    personality: { id: p, name: PERSONALITIES[p]?.name || p, where: PERSONALITIES[p]?.where || '', colour: shieldColour(p), shieldUrl: shieldUrl(p) },
    freeCity: !!ind.freeCity,
    city: city ? { id: city.id, name: city.name, tile: city.tile, size: city.size || 1, garrisonTarget: garrisonTarget(city.size, p) } : null,
    facts,
    km: alive ? kmFromNearest(state, me, city.tile) : Infinity,
    attitude: { value: Math.round(attitude), word: attitudeWord(attitude), tone: attitudeTone(attitude), reasons, joinable, joinRule, join: { ok: join.ok, reason: join.ok ? null : join.reason } },
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
  if (m.deals.raid) lines.push({ tone: 'bad', text: `Their raiders are heading for ${m.deals.raid.target}${m.deals.raid.eta != null ? `, ${plural(m.deals.raid.eta, 'turn')} away` : ''}.` });
  if (m.deals.demand) lines.push({ tone: 'warn', text: `They demand ${m.deals.demand.gold} gold a turn; answer within ${plural(m.deals.demand.turnsLeft, 'turn')}.` });
  if (m.deals.joinOffer) lines.push({ tone: 'good', text: 'They offer to join you.' });
  if (m.deals.youPay) lines.push({ tone: 'neutral', text: `You pay them ${m.deals.youPay.gold} gold a turn until turn ${m.deals.youPay.until}.` });
  if (m.deals.theyPay) lines.push({ tone: 'good', text: `They pay you ${m.deals.theyPay.gold} gold a turn until turn ${m.deals.theyPay.until}.` });
  if (m.deals.trade) lines.push({ tone: 'good', text: `You trade: ${m.deals.trade.gold} gold a turn each way.` });
  return { id: m.id, name: m.name, personality: m.personality, attitude: m.attitude, grudge: m.grudge, lines };
};
