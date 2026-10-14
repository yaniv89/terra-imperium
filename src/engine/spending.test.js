// Lane CB04 (playtest audits I019, I021, I024, X24): what gold buys, priced in one place.
import { describe, it, expect, vi } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { speedCostMult, speedTrainMult, TRAIN_SPEED_SHARE } from '../data/ages';
import { productionCost, queueItem, dequeueItem, itemProgress } from './world/cities';
import { queueView, investInGrowth, growthView, GROWTH_BUY_SHARE } from './cityEconomy';
import {
  rushQuote, applyRush, rushGold, rushAffordable, rushHeat, rushPriceMult, RUSH_GOLD_PER_HAMMER, RUSH_KIND_MULT, RUSH_HEAT_MAX, RUSH_COOL_REF_TURNS,
  scaledGold, eraGoldFactor, infrastructureCosts, defensesCosts, growthCosts
} from './spending';
import { speedTurns } from '../data/ages';

vi.setConfig({ testTimeout: 180000 }); // whole-world turns

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const fresh = (seed = 5, extra = {}) => quiet(createInitialState({ playerNationId: 'fr', rngSeed: seed, ...extra }));
const turn = (s) => { let n = resolveTurn(s); if (n.pendingPeaceOffer) n = gameReducer(n, { type: ActionTypes.REJECT_PENDING_PEACE }); return n; };
const paris = () => getNationCapital('fr');
const patch = (s, id, over) => ({ ...s, regions: { ...s.regions, [id]: { ...s.regions[id], ...over } } });
const withGold = (s, gold) => ({ ...s, resources: { ...s.resources, gold } });
const GRANARY = { kind: 'building', category: 'food', tier: 0 };
const SPEAR = { kind: 'unit', classId: 'infantry' };
const empty = { current: null, queue: [], progress: 0 };

describe('training has its own speed share (I024, the Civ model)', () => {
  it('follows the cost multiplier up to Normal and only half the extra beyond it', () => {
    for (const age of ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern']) {
      expect(speedTrainMult('normal', age)).toBe(speedCostMult('normal', age));
      expect(speedTrainMult('fast', age)).toBe(speedCostMult('fast', age));
      const m = speedCostMult('marathon', age); const n = speedCostMult('normal', age);
      expect(speedTrainMult('marathon', age)).toBeCloseTo(m <= n ? m : n + (m - n) * TRAIN_SPEED_SHARE, 9);
    }
    expect(speedTrainMult('marathon', 'bronze')).toBeCloseTo(2.8, 9); // buildings 4.0
  });
  it('prices units, settlers and army orders by it, buildings by the cost multiplier', () => {
    const ctx = { ageId: 'bronze', citiesOwned: 1, speedMult: 4, trainMult: 2.8 };
    expect(productionCost(SPEAR, ctx)).toBe(Math.round(40 * 2.8));
    expect(productionCost({ kind: 'settler' }, ctx)).toBe(Math.round(70 * 2.8));
    expect(productionCost(GRANARY, ctx)).toBe(productionCost(GRANARY, { ...ctx, trainMult: 1 }));
    expect(productionCost(SPEAR, { ageId: 'bronze', speedMult: 4 })).toBe(160); // no trainMult: as before
  });
});

describe('rush (I019)', () => {
  it('quotes the missing production at the rush price, and the reducer charges exactly that', () => {
    const id = paris();
    let s = withGold(patch(fresh(), id, { production: queueItem({ ...fresh().regions[id], production: empty }, GRANARY).production }), 5000);
    s = patch(s, id, { production: { ...s.regions[id].production, progress: 10 } });
    const q = rushQuote(s, id, 0);
    const row = queueView(s, id)[0];
    expect(q.ok).toBe(true);
    expect(q.hammers).toBe(row.cost - 10);
    expect(q.gold).toBe(Math.ceil(q.hammers * RUSH_GOLD_PER_HAMMER));
    const after = gameReducer(s, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: id, index: 0 } });
    expect(after.resources.gold).toBe(5000 - q.gold);
    expect(after.regions[id].production.progress).toBe(row.cost);
    expect(after.regions[id].rush).toEqual({ heat: 1, turn: s.turnNumber });
    // The next turn completes it, and the city's own production of that turn goes to what follows.
    const next = turn(after);
    expect(next.regions[id].buildings.categories.food).toBe(0);
  });

  it('refuses without the gold, for a wonder, under siege, twice, and for a later order of the same kind', () => {
    const id = paris();
    const base = fresh();
    let s = patch(base, id, { production: queueItem({ ...base.regions[id], production: empty }, GRANARY).production });
    expect(rushQuote(withGold(s, 0), id, 0)).toMatchObject({ ok: false });
    expect(rushQuote(withGold(s, 0), id, 0).reason).toMatch(/^Needs \d+ gold\.$/);
    expect(gameReducer(withGold(s, 0), { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: id } }).resources.gold).toBe(0);
    s = withGold(s, 99999);
    expect(rushQuote(patch(s, id, { siege: { by: 'x' } }), id, 0).reason).toMatch(/enemy/);
    const wonder = patch(s, id, { production: { current: { kind: 'wonder', projectId: 'p', tier: 1, tile: base.regions[id].tile, cost: 300 }, queue: [], progress: 0 } });
    expect(rushQuote(wonder, id, 0).ok).toBe(false);
    const once = gameReducer(s, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: id } });
    expect(rushQuote(once, id, 0).reason).toMatch(/Already paid/);
    expect(gameReducer(once, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: id } }).resources.gold).toBe(once.resources.gold);
    const two = patch(s, id, { production: { current: SPEAR, queue: [SPEAR], progress: 0 } });
    expect(rushQuote(two, id, 1).reason).toMatch(/first order/);
  });

  it('bought progress is never refunded and stays with its order through a cancel', () => {
    const id = paris();
    const base = fresh();
    let s = withGold(patch(base, id, { production: { current: SPEAR, queue: [GRANARY], progress: 0 } }), 99999);
    s = gameReducer(s, { type: ActionTypes.RUSH_PRODUCTION, payload: { cityId: id, index: 1 } });
    const paidFor = queueView(s, id)[1].cost;
    expect(itemProgress(s.regions[id], 1)).toBe(paidFor);
    const gold = s.resources.gold;
    const cancelled = { ...s.regions[id], ...dequeueItem(s.regions[id], 1) };
    expect(cancelled.production.stored?.['building:food:0']).toBe(paidFor); // kept for the granary, no gold back
    expect(gold).toBe(s.resources.gold);
  });

  it('heats up with use, capped, and cools over speed-scaled turns', () => {
    expect(rushPriceMult(0)).toBe(1);
    expect(rushPriceMult(99)).toBe(rushPriceMult(RUSH_HEAT_MAX));
    expect(rushGold(10, 2)).toBe(Math.ceil(10 * RUSH_GOLD_PER_HAMMER * 1.4));
    expect(rushGold(10, 0, 'settler')).toBe(Math.ceil(10 * RUSH_GOLD_PER_HAMMER * RUSH_KIND_MULT.settler));
    const cool = speedTurns(RUSH_COOL_REF_TURNS, 'normal', 'bronze');
    const city = { rush: { heat: 3, turn: 10 } };
    expect(rushHeat(city, 10, 'normal')).toBe(3);
    expect(rushHeat(city, 10 + cool, 'normal')).toBe(2);
    expect(rushHeat(city, 10 + 3 * cool, 'normal')).toBe(0);
    expect(applyRush({ production: empty, rush: { heat: RUSH_HEAT_MAX, turn: 1 } }, 0, { cost: 5, heat: RUSH_HEAT_MAX }, 2).rush.heat).toBe(RUSH_HEAT_MAX);
  });

  it('a budget buys whole points at the same price, never more than it holds', () => {
    expect(rushAffordable(50, 3)).toBeNull();
    expect(rushAffordable(50, 41)).toEqual({ hammers: 10, gold: 40 });
    expect(rushAffordable(5, 1000)).toEqual({ hammers: 5, gold: 20 });
    expect(rushAffordable(10, 1000, 0, 'settler').gold).toBe(rushGold(10, 0, 'settler'));
  });

  it('an AI nation rushes through the same quote instead of writing buildings in', () => {
    let s = fresh(7);
    const ai = Object.keys(s.nations).find((n) => n !== s.playerNationId && Object.values(s.regions).some((c) => c.owner === n && c.size != null));
    expect(ai).toBeTruthy();
    s = { ...s, nations: { ...s.nations, [ai]: { ...s.nations[ai], economy: { ...s.nations[ai].economy, gold: 100000 } } } };
    for (let t = 0; t < 12; t++) s = quiet(turn(s));
    const rushed = Object.values(s.regions).filter((c) => c.owner === ai && c.rush);
    expect(rushed.length).toBeGreaterThan(0);
    expect(s.nations[ai].economy.gold).toBeLessThan(100000);
  });
});

describe('standing works and growth follow age, speed and level (I021)', () => {
  it('scales the gold of infrastructure and defenses, never by the treasury', () => {
    const s = fresh();
    const id = paris();
    const c0 = { ...s.regions[id], currentInfrastructure: 0, defenseLevel: 0 };
    const c4 = { ...c0, currentInfrastructure: 4, defenseLevel: 4 };
    expect(infrastructureCosts(s, c4).gold).toBeGreaterThan(infrastructureCosts(s, c0).gold);
    expect(defensesCosts(s, c4).gold).toBeGreaterThan(defensesCosts(s, c0).gold);
    expect(infrastructureCosts(withGold(s, 1e6), c0)).toEqual(infrastructureCosts(withGold(s, 0), c0));
    expect(eraGoldFactor('modern')).toBeGreaterThan(eraGoldFactor('bronze'));
    expect(scaledGold({ ...s, gameSpeed: 'marathon' }, 'buildInfrastructure')).toBeGreaterThan(scaledGold({ ...s, gameSpeed: 'normal' }, 'buildInfrastructure'));
    expect(infrastructureCosts(s, c0).adm).toBe(1); // other currencies untouched
  });

  it('the reducer charges the scaled price', () => {
    const id = paris();
    const s = withGold(fresh(), 5000);
    const price = infrastructureCosts(s, s.regions[id]).gold;
    const after = gameReducer(s, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: id } });
    expect(after.resources.gold).toBe(5000 - price);
  });

  it('Invest in growth banks a quarter of the next citizen and charges by size', () => {
    const id = paris();
    let s = withGold(fresh(), 5000);
    s = patch(s, id, { food: 0 });
    const g = growthView(s, id);
    const next = investInGrowth(s, id);
    expect(next.food).toBeCloseTo(Math.round(g.threshold * GROWTH_BUY_SHARE * 10) / 10, 1);
    const price = growthCosts(s, s.regions[id]).gold;
    const after = gameReducer(s, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: id } });
    expect(after.resources.gold).toBe(5000 - price);
    expect(growthCosts(s, { ...s.regions[id], size: 8 }).gold).toBeGreaterThan(growthCosts(s, { ...s.regions[id], size: 1 }).gold);
  });
});
