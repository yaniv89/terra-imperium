// The effect text of a building tier or an improvement is what the engine then applies (I043).
import { describe, it, expect, vi } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { getNationCapital } from '../data/regions';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { IMPROVEMENTS, canImprove, tileFacts, tileYields } from '../data/tileYields';
import { calcIncome } from '../utils/helpers';
import { calcNationBalance } from './economy';
import { housingOf, amenitiesOf, processCity, productionCost } from './world/cities';
import { wallsOf } from './sieges';
import { cityCtx, worldOf } from './cityEconomy';
import { buildingEffect, improvementEffect, effectText, NO_EFFECT_TEXT } from './cityEffects';
import { peoplesWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 5 });
const FR_ID = PEOPLES_WORLD.playerNationId;

vi.setConfig({ testTimeout: 240000 });

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const turn = (s) => { let n = resolveTurn(s); if (n.pendingPeaceOffer) n = gameReducer(n, { type: ActionTypes.REJECT_PENDING_PEACE }); return n; };
const paris = () => getNationCapital(FR_ID);
const withTier = (s, id, category, tier) => ({ ...s, regions: { ...s.regions, [id]: { ...s.regions[id], buildings: { ...s.regions[id].buildings, categories: { ...s.regions[id].buildings.categories, [category]: tier } } } } });

describe('building effect text is the effect the turn applies', () => {
  // One settled start (a first turn puts the market's numbers on the record), a low food bank so
  // no tier makes the city grow inside the measured turn.
  const start = () => {
    const s = turn(quiet(peoplesWorld({ seed: 5 })));
    const id = paris();
    return { ...s, regions: { ...s.regions, [id]: { ...s.regions[id], food: 0, size: 4 } } };
  };

  it('every line, first and last tier: predicted deltas equal a resolved turn with the tier standing', () => {
    const s = start();
    const id = paris();
    const plain = turn(s);
    const base = plain.regions[id];
    const baseBalance = calcNationBalance(plain, FR_ID);
    const seen = {};
    Object.entries(BUILDING_CATEGORIES).forEach(([category, cat]) => {
      [0, cat.tiers.length - 1].forEach((tier) => {
        const predicted = buildingEffect(s, id, category, tier, -1);
        const built = turn(withTier(s, id, category, tier));
        const city = built.regions[id];
        expect(city.size, `${category} ${tier}: the fixture must not grow`).toBe(base.size);
        const label = `${category} tier ${tier} (${predicted.text})`;
        // The city's own yields, exactly.
        expect(predicted.deltas.food, label).toBeCloseTo(city.lastYields.food - base.lastYields.food, 5);
        expect(predicted.deltas.production, label).toBeCloseTo(city.lastYields.production - base.lastYields.production, 5);
        expect(predicted.deltas.culture, label).toBeCloseTo(city.lastYields.culture - base.lastYields.culture, 5);
        expect(predicted.deltas.housing, label).toBe(housingOf(city, cityCtx(built, city).researched) - housingOf(base, cityCtx(plain, base).researched));
        expect(predicted.deltas.amenities, label).toBe(amenitiesOf(city, cityCtx(built, city)).supply - amenitiesOf(base, cityCtx(plain, base)).supply);
        expect(predicted.deltas.walls, label).toBe(wallsOf(city) - wallsOf(base));
        // The realm's income after the turn (rounded to whole numbers by calcIncome: one off at most).
        const balance = calcNationBalance(built, FR_ID);
        expect(Math.abs(predicted.deltas.gold - (balance.income.gold - baseBalance.income.gold)), `${label}: gold`).toBeLessThanOrEqual(1);
        expect(Math.abs(predicted.deltas.manpower - (balance.income.hr - baseBalance.income.hr)), `${label}: manpower`).toBeLessThanOrEqual(1);
        expect(Math.abs(predicted.deltas.science - ((balance.income.techPoints || 0) - (baseBalance.income.techPoints || 0))), `${label}: science`).toBeLessThanOrEqual(1);
        expect(predicted.deltas.upkeep, label).toBe(balance.expenses.fortUpkeep - baseBalance.expenses.fortUpkeep);
        seen[`${category}:${tier}`] = predicted;
      });
    });
    // What the measured text says, where the data table says something else or nothing.
    expect(seen['food:0'].text).toBe('+1 food, +1 housing'); // no `effects` entry in the data at all
    expect(seen['culture:0'].deltas).toMatchObject({ culture: 2, amenities: 1, unrest: -1 });
    expect(seen['defense:0'].deltas).toMatchObject({ walls: 1, fort: 1, upkeep: 1 });
    expect(seen['science:0'].deltas.science).toBeGreaterThanOrEqual(2);
    expect(seen['logistics:0'].text).toBe(NO_EFFECT_TEXT); // local.supplyRange has no reader
    expect(seen['military:0'].deltas.manpower).toBeGreaterThan(0);
  });

  it('the default is what the NEXT tier adds to the one standing', () => {
    const s = withTier(start(), paris(), 'food', 0);
    const next = buildingEffect(s, paris(), 'food', 1);
    expect(next.deltas).toMatchObject({ food: 1, housing: 1 });
    const whole = buildingEffect(s, paris(), 'food', 0, -1);
    expect(whole.deltas).toMatchObject({ food: 1, housing: 1 });
    expect(effectText({})).toBe(NO_EFFECT_TEXT);
    expect(buildingEffect(s, 'nowhere', 'food', 0)).toBeNull();
  });

  it('income is the treasury\'s: a tier that raises production also raises gold', () => {
    const s = start();
    const e = buildingEffect(s, paris(), 'industry', 0, -1);
    expect(e.deltas.production).toBeGreaterThan(0);
    expect(e.deltas.gold).toBeGreaterThan(0);
    const real = calcIncome(turn(withTier(s, paris(), 'industry', 0))).gold - calcIncome(turn(s)).gold;
    expect(Math.abs(e.deltas.gold - real)).toBeLessThanOrEqual(1);
  });
});

describe('improvement effect text is the tile after the build', () => {
  it('every improvement the capital can build: the predicted yields are the tile\'s yields once the city builds it', () => {
    const s = quiet(peoplesWorld({ seed: 5 }));
    const id = paris();
    const tiles = getTiles();
    const city = s.regions[id];
    const researched = Object.keys(s.techTree);
    const all = { ...s, techTree: Object.fromEntries(researched.map((t) => [t, { ...s.techTree[t], researched: true }])) };
    const ctx = cityCtx(all, city);
    let checked = 0;
    const kinds = new Set();
    city.tiles.forEach((tile) => {
      if (tile === city.tile) return;
      Object.keys(IMPROVEMENTS).forEach((improvement) => {
        if (kinds.has(improvement) && checked > 12) return;
        const facts = tileFacts(tiles, tile, all.world.tileState[tile]);
        if (!canImprove(facts, improvement, ctx.researched)) return;
        const item = { kind: 'improvement', improvement, tile };
        const predicted = improvementEffect(all, id, item);
        const cost = productionCost(item, ctx);
        const r = processCity(worldOf(all), tiles, { ...city, production: { current: item, queue: [], progress: cost } }, ctx);
        const after = tileYields(tileFacts(tiles, tile, r.world.tileState[tile]), ctx.researched);
        const before = tileYields(facts, ctx.researched);
        expect(predicted.deltas).toEqual({ food: after.food - before.food, production: after.production - before.production, gold: after.gold - before.gold });
        expect(predicted.yieldsAfter).toEqual(after);
        expect(predicted.text.length).toBeGreaterThan(0);
        kinds.add(improvement); checked += 1;
      });
    });
    expect(checked).toBeGreaterThan(3);
    expect(kinds.has('farm') || kinds.has('mine') || kinds.has('road')).toBe(true);
  });

  it('a mine on iron says it supplies iron; a road says what a road is for; a replaced farm is named', () => {
    const s = quiet(peoplesWorld({ seed: 5 }));
    const id = paris();
    const tiles = getTiles();
    const city = s.regions[id];
    const land = city.tiles.find((t) => t !== city.tile && tiles.land[t] === 1 && tiles.reliefOf(t) !== 'mountains' && tiles.featureOf(t) !== 'ice');
    const road = improvementEffect(s, id, { kind: 'improvement', improvement: 'road', tile: land });
    expect(road.text).toMatch(/armies cross this tile faster/);
    const farmed = { ...s, world: { ...s.world, tileState: { ...s.world.tileState, [land]: { improvement: 'farm' } } } };
    const overFarm = improvementEffect(farmed, id, { kind: 'improvement', improvement: 'road', tile: land });
    expect(overFarm.replaces).toBe('Farm');
    expect(overFarm.deltas.food).toBeLessThan(0); // the engine replaces the farm: the text must say so
    // An iron tile anywhere on the map, given to the city for the test.
    let iron = -1;
    for (let t = 0; t < tiles.count && iron < 0; t++) if (tiles.land[t] === 1 && tiles.resourceOf(t) === 'iron' && tiles.reliefOf(t) !== 'mountains') iron = t;
    if (iron < 0) return;
    const withIron = { ...s, techTree: { ...s.techTree, military_bronze_casting: { ...s.techTree.military_bronze_casting, researched: true } }, regions: { ...s.regions, [id]: { ...city, tiles: [...city.tiles, iron] } } };
    const mine = improvementEffect(withIron, id, { kind: 'improvement', improvement: 'mine', tile: iron });
    expect(mine.supply).toEqual({ resource: 'iron', amount: 1 });
    expect(mine.text).toMatch(/supplies 1 iron a turn/);
  });
});
