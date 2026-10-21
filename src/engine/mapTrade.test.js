// src/engine/mapTrade.test.js (playtest audit I116)
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { peoplesWorld, rivalOf } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { hasMet, metNations, bitsHas, bitsCount, shareExploredMap } from './fog';
import { opinionOf, opinionReasons } from './opinion';
import { getTiles } from '../data/geo/tiles';
import {
  mapGain, mapTradeQuote, tradeMaps, processAIMapOffers, answerMapOffer, mapOfferTerms,
  MAP_ASK_OPINION, MAP_OFFER_TURNS, MAP_MIN_VALUE
} from './mapTrade';
import { AI_ACCORD_PERIOD } from './aiAccords';
import { GAVE_US_MAP } from '../data/opinion';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { defaultMode: 'auto', autoDefend: true } });
const S0 = quiet(peoplesWorld({ seed: 7 }));
const me = S0.playerNationId;
const partner = rivalOf(S0);
// The peoples start has met nobody: the player and the first rival have met, and each holds its own homeland map (something new for the other).
const met = { ...S0.fog.met, [me]: { ...S0.fog.met?.[me], [partner]: 1 }, [partner]: { ...S0.fog.met?.[partner], [me]: 1 } };
const S = { ...S0, fog: { ...S0.fog, met }, resources: { ...S0.resources, gold: 5000, dip: 200 } };
if (!(mapGain(S, partner, me).value >= 100 && mapGain(S, me, partner).value >= 100)) throw new Error('mapTrade fixture: the pair has nothing to trade');
const withNation = (s, id, patch) => ({ ...s, nations: { ...s.nations, [id]: { ...s.nations[id], ...patch } } });
const warWith = (s, id) => ({ ...s, wars: [...(s.wars || []), { id: 'w-test', aggressor: me, enemy: id, active: true, score: 0, startTurn: s.turnNumber }] });

describe('map trading: the quote', () => {
  it('finds a met people with something to trade both ways', () => {
    expect(partner).toBeTruthy();
    const q = mapTradeQuote(S, partner);
    expect(q.ok).toBe(true);
    expect(q.theirs.land + q.theirs.sea).toBe(q.theirs.tiles);
    expect(q.theirs.value).toBeGreaterThanOrEqual(MAP_MIN_VALUE);
    expect(q.options.give.accepted).toBe(true);
    expect(q.options.buy.gold).toBeGreaterThan(0);
  });

  it('refuses unmet peoples, enemies at war, peoples that dislike you, and fog-off games', () => {
    const far = Object.keys(S.nations).find((id) => id !== me && !hasMet(S, me, id) && !S.nations[id].isEliminated);
    expect(mapTradeQuote(S, far).ok).toBe(false);
    expect(mapTradeQuote(warWith(S, partner), partner).reason).toMatch(/war/i);
    const cold = withNation(S, partner, { hostility: 100 });
    expect(opinionOf(cold, partner, me)).toBeLessThan(-10);
    expect(mapTradeQuote(cold, partner).ok).toBe(false);
    const open = peoplesWorld({ seed: 7, fog: false });
    expect(mapTradeQuote(open, partner).ok).toBe(false);
  });

  it('asks only of a friend; a friend also swaps for less', () => {
    expect(opinionOf(S, partner, me)).toBeLessThan(MAP_ASK_OPINION);
    expect(mapTradeQuote(S, partner).options.ask.accepted).toBe(false);
    const friend = withNation(withNation(S, me, { marriageWith: [partner] }), partner, { hasTradeAgreement: true, demandMet: { [me]: { until: 9999, kind: 'tribute' } } });
    expect(opinionOf(friend, partner, me)).toBeGreaterThanOrEqual(MAP_ASK_OPINION);
    expect(mapTradeQuote(friend, partner).options.ask.accepted).toBe(true);
    // A friend's price is lower.
    expect(mapTradeQuote(friend, partner).options.buy.gold).toBeLessThanOrEqual(mapTradeQuote(S, partner).options.buy.gold);
  });
});

describe('map trading: the trades', () => {
  it('give: they learn every tile you explored, remember it, and it costs nothing', () => {
    const r = tradeMaps(S, partner, 'give');
    expect(r.reason).toBeUndefined();
    const t = r.state;
    const mine = S.fog.explored[me];
    for (let i = 0; i < getTiles().count; i += 97) if (bitsHas(mine, i)) expect(bitsHas(t.fog.explored[partner], i)).toBe(true);
    expect(mapGain(t, me, partner).value).toBe(0);
    expect(t.resources).toBe(S.resources);
    const reason = opinionReasons(t, partner, me).find((x) => x.id === 'sharedMaps');
    expect(reason.value).toBe(GAVE_US_MAP);
    // A second gift right away holds nothing new: refused, nothing changes.
    expect(tradeMaps(t, partner, 'give').reason).toMatch(/nothing new for them/);
  });

  it('swap: both learn, and the player sees the cities on the new land, but meets nobody and sees no army', () => {
    const q = mapTradeQuote(S, partner);
    const r = tradeMaps(S, partner, 'swap');
    if (!q.options.swap.accepted) { expect(r.reason).toBeTruthy(); return; }
    const t = r.state;
    expect(mapGain(t, me, partner).value).toBe(0);
    expect(mapGain(t, partner, me).value).toBe(0);
    expect(bitsCount(t.fog.explored[me])).toBe(bitsCount(S.fog.explored[me]) + q.theirs.tiles);
    expect(metNations(t, me)).toEqual(metNations(S, me));
    // A city on the learned land is in the player's last-seen picture.
    const city = Object.values(t.regions).find((c) => c.tile != null && c.owner !== me && !bitsHas(S.fog.explored[me], c.tile) && bitsHas(t.fog.explored[me], c.tile));
    if (city) expect(t.fog.seen.cities[city.id]).toBeTruthy();
    expect(t.units).toBe(S.units);
  });

  it('buy and sell move gold between the treasury and their economy', () => {
    const q = mapTradeQuote(S, partner);
    const b = tradeMaps(S, partner, 'buy').state;
    expect(b.resources.gold).toBe(S.resources.gold - q.options.buy.gold);
    expect(b.nations[partner].economy.gold).toBe((S.nations[partner].economy.gold || 0) + q.options.buy.gold);
    if (q.options.sell.accepted) {
      const s = tradeMaps(S, partner, 'sell').state;
      expect(s.resources.gold).toBe(S.resources.gold + q.options.sell.gold);
    }
    const poor = { ...S, resources: { ...S.resources, gold: 0 } };
    expect(tradeMaps(poor, partner, 'buy').reason).toMatch(/gold/);
  });

  it('runs through the reducer with a log line, and a refusal changes nothing but the log', () => {
    const t = gameReducer(S, { type: ActionTypes.TRADE_MAPS, payload: { nationId: partner, kind: 'give' } });
    expect(t.logs.at(-1).message).toMatch(/your map/);
    const again = gameReducer(t, { type: ActionTypes.TRADE_MAPS, payload: { nationId: partner, kind: 'give' } });
    expect(again.fog).toBe(t.fog);
    expect(again.resources).toBe(t.resources);
  });

  it('shareExploredMap is a no-op when there is nothing to learn', () => {
    const once = shareExploredMap(S, partner, me).state;
    expect(shareExploredMap(once, partner, me).state).toBe(once);
  });
});

describe('map trading: the AI offers a swap', () => {
  // A friendly partner (a royal marriage, +15) and the turn its slot and roll come up.
  const friendly = withNation(S, me, { marriageWith: [partner] });
  const ids = Object.keys(friendly.nations).filter((id) => id !== me && !friendly.nations[id].isEliminated && !friendly.nations[id].isPlayer && friendly.nations[id].kind !== 'independent').sort();
  const findTurn = () => { for (let t = 2; t < 400; t++) { const s = processAIMapOffers({ ...friendly, turnNumber: t }); if (s.pendingMapOffer) return s; } return null; };

  it('comes on a slot turn, rarely, from a people that would accept it', () => {
    const s = findTurn();
    expect(s).toBeTruthy();
    const o = s.pendingMapOffer;
    expect(ids.indexOf(o.from) % AI_ACCORD_PERIOD).toBe(s.turnNumber % AI_ACCORD_PERIOD);
    expect(o.until).toBe(s.turnNumber + MAP_OFFER_TURNS);
    expect(s.mapTradeStats.offers).toBe(1);
    expect(s.logs.at(-1).message).toMatch(/swap maps/);
    expect(mapOfferTerms(s).ok).toBe(true);
    // The same input gives the same offer (deterministic), and no second one inside the gap.
    expect(processAIMapOffers({ ...friendly, turnNumber: s.turnNumber }).pendingMapOffer).toEqual(o);
    const later = processAIMapOffers({ ...s, pendingMapOffer: null, turnNumber: s.turnNumber + 1 });
    expect(later.pendingMapOffer).toBeNull();
  });

  it('accepting swaps the maps; declining or waiting drops it', () => {
    const s = findTurn();
    const yes = answerMapOffer(s, true);
    expect(yes.state.pendingMapOffer).toBeNull();
    expect(mapGain(yes.state, s.pendingMapOffer.from, me).value).toBe(0);
    expect(yes.state.mapTradeStats.accepted).toBe(1);
    const no = answerMapOffer(s, false);
    expect(no.state.pendingMapOffer).toBeNull();
    expect(no.state.fog).toBe(s.fog);
    const expired = processAIMapOffers({ ...s, turnNumber: s.pendingMapOffer.until + 1 });
    expect(expired.pendingMapOffer).toBeNull();
    // Through the reducer.
    const r = gameReducer(s, { type: ActionTypes.ANSWER_MAP_OFFER, payload: { accept: true } });
    expect(r.logs.at(-1).message).toMatch(/swap maps/);
  });

  it('never offers to a people at war with it, and an old save without the fields plays on', () => {
    const s = findTurn();
    const war = warWith({ ...friendly, turnNumber: s.turnNumber }, s.pendingMapOffer.from);
    expect(processAIMapOffers(war).pendingMapOffer?.from).not.toBe(s.pendingMapOffer.from);
    // eslint-disable-next-line no-unused-vars
    const { pendingMapOffer, mapOfferTurn, mapTradeStats, ...old } = S;
    const next = resolveTurn(old);
    expect(next.turnNumber).toBe(S.turnNumber + 1);
  }, 60000);
});
