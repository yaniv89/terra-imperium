// Lane L3 (playtest audits CB05 plus I031, I032): what the city sheet says is what the engine does.
import { describe, it, expect, vi } from 'vitest';
import { gameReducer } from './gameReducer';
import { peoplesWorld, rivalOf } from './testWorld';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';
import { conquerRegion } from './conquest';
import { calcIncome } from '../utils/helpers';
import { chooseProduction } from './aiProduction';
import { getDevelopProvinceCost, investmentOf } from './development';
import {
  queueItem, dequeueItem, moveQueueItem, itemProgress, itemKey, processCity, productionCost, canQueue, hasSeaCoast, NEEDS_SEA_COAST, buyTileCost, claimCandidates
} from './world/cities';
import { cityLive, queueView, buildQuote, landQuotes, quoteBuyTile, focusPreview, growthView, resourceNeed, worldOf, cityCtx, isLongBuild, longBuildTurns, LONG_BUILD_TURNS } from './cityEconomy';
import { cityRailModel } from '../components/city/cityRailModel';

vi.setConfig({ testTimeout: 180000 }); // whole-world turns

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const fresh = (seed = 5) => quiet(peoplesWorld({ seed, independents: true }));
const turn = (s) => { let n = resolveTurn(s); if (n.pendingPeaceOffer) n = gameReducer(n, { type: ActionTypes.REJECT_PENDING_PEACE }); return n; };
const W = fresh();
const ME = W.playerNationId; // the player's people (France in the old fixture)
const RIVAL = rivalOf(W); // a neighbour in the old fixture (Germany)
const paris = () => W.nations[ME].capitalRegionId;
const patch = (s, id, over) => ({ ...s, regions: { ...s.regions, [id]: { ...s.regions[id], ...over } } });

const SPEAR = { kind: 'unit', classId: 'infantry' };
const GRANARY = { kind: 'building', category: 'food', tier: 0 };
const SHRINE = { kind: 'building', category: 'culture', tier: 0 };

describe('per-item production progress (I046, I047)', () => {
  const city = () => ({ id: 'c1', name: 'Test', production: { current: null, queue: [], progress: 0 } });

  it('moving an item to the front keeps both items\' progress', () => {
    let c = queueItem(queueItem(queueItem(city(), GRANARY), SPEAR), SHRINE);
    c = { ...c, production: { ...c.production, progress: 30 } };
    const moved = moveQueueItem(c, 2, 0);
    expect(moved.production.current).toEqual(SHRINE);
    expect(moved.production.queue).toEqual([GRANARY, SPEAR]);
    expect(moved.production.progress).toBe(0);
    expect(itemProgress(moved, 1)).toBe(30); // the granary kept its 30
    const back = moveQueueItem({ ...moved, production: { ...moved.production, progress: 7 } }, 1, 0);
    expect(back.production.current).toEqual(GRANARY);
    expect(back.production.progress).toBe(30);
    expect(itemProgress(back, 1)).toBe(7); // and the shrine its 7
    expect(back.production.stored).toEqual({ [itemKey(SHRINE)]: 7 });
  });

  it('reordering behind the front touches no progress, and bad moves change nothing', () => {
    let c = queueItem(queueItem(queueItem(city(), GRANARY), SPEAR), SHRINE);
    c = { ...c, production: { ...c.production, progress: 12 } };
    const up = moveQueueItem(c, 2, 1);
    expect(up.production.current).toEqual(GRANARY);
    expect(up.production.queue).toEqual([SHRINE, SPEAR]);
    expect(up.production.progress).toBe(12);
    expect(up.production.stored).toBeUndefined();
    expect(moveQueueItem(c, 1, 1)).toBe(c);
    expect(moveQueueItem(c, 9, 0)).toBe(c);
    expect(moveQueueItem(c, 0, 99).production.queue[1]).toEqual(GRANARY); // clamped to the end
  });

  it('a removed item keeps its progress and gets it back when queued again', () => {
    let c = queueItem(queueItem(city(), GRANARY), SPEAR);
    c = { ...c, production: { ...c.production, progress: 25 } };
    const removed = dequeueItem(c, 0);
    expect(removed.production.current).toEqual(SPEAR);
    expect(removed.production.progress).toBe(0);
    expect(removed.production.stored).toEqual({ [itemKey(GRANARY)]: 25 });
    const again = queueItem(removed, GRANARY);
    expect(itemProgress(again, 1)).toBe(25);
    const alone = queueItem(dequeueItem(again, 0), SHRINE); // spear out: the granary is current again
    expect(alone.production.current).toEqual(GRANARY);
    expect(alone.production.progress).toBe(25);
    expect(alone.production.stored).toBeUndefined();
  });

  it('hammers are never made or lost by reordering and removing', () => {
    let c = queueItem(queueItem(queueItem(city(), GRANARY), SPEAR), SHRINE);
    c = { ...c, production: { ...c.production, progress: 40 } };
    const total = (x) => (x.production.progress || 0) + Object.values(x.production.stored || {}).reduce((s, v) => s + v, 0);
    const steps = [(x) => moveQueueItem(x, 1, 0), (x) => ({ ...x, production: { ...x.production, progress: x.production.progress + 9 } }), (x) => moveQueueItem(x, 2, 0), (x) => dequeueItem(x, 0), (x) => queueItem(x, SHRINE), (x) => moveQueueItem(x, 2, 0), (x) => moveQueueItem(x, 0, 2)];
    let expected = 40;
    steps.forEach((step, i) => { c = step(c); if (i === 1) expected += 9; expect(total(c)).toBe(expected); });
  });

  it('the turn hands stored progress to the next order and completes through the engine', () => {
    const s = fresh();
    const id = paris();
    const tiles = getTiles();
    const base = { ...s.regions[id], production: { current: null, queue: [], progress: 0 } };
    const ctx = cityCtx(s, base);
    const cost = productionCost(GRANARY, ctx);
    let c = queueItem(queueItem(base, SPEAR), GRANARY);
    c = moveQueueItem({ ...c, production: { ...c.production, progress: 5 } }, 1, 0); // granary first, the spear keeps 5
    c = { ...c, production: { ...c.production, progress: cost } }; // the granary is paid for
    const r = processCity(worldOf(s), tiles, c, ctx);
    expect(r.city.buildings.categories.food).toBe(0);
    expect(r.city.production.current).toEqual(SPEAR);
    expect(r.city.production.progress).toBeCloseTo(5 + r.yields.production, 5); // overflow plus its own 5
    expect(r.city.production.stored).toBeUndefined();
  });

  it('MOVE_PRODUCTION reorders the player\'s queue and refuses a foreign city', () => {
    let s = fresh();
    const id = paris();
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: id, item: GRANARY } });
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: id, item: SPEAR } });
    s = patch(s, id, { production: { ...s.regions[id].production, progress: 11 } });
    const moved = gameReducer(s, { type: ActionTypes.MOVE_PRODUCTION, payload: { cityId: id, index: 1, to: 0 } });
    expect(moved.regions[id].production.current).toEqual(SPEAR);
    expect(itemProgress(moved.regions[id], 1)).toBe(11);
    const berlin = W.nations[RIVAL].capitalRegionId;
    expect(gameReducer(s, { type: ActionTypes.MOVE_PRODUCTION, payload: { cityId: berlin, index: 1, to: 0 } }).regions[berlin]).toBe(s.regions[berlin]);
  });
});

describe('bought development lasts (I031)', () => {
  const develop = (s, id, devType) => gameReducer({ ...s, resources: { ...s.resources, adm: 9999, dip: 9999, mil: 9999 } }, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: id, devType } });

  it('survives turn resolution: every type still counts five turns later', () => {
    const id = paris();
    let plain = fresh();
    let bought = ['tax', 'production', 'manpower', 'production'].reduce((s, t) => develop(s, id, t), fresh());
    expect(investmentOf(bought.regions[id])).toEqual({ tax: 1, production: 2, manpower: 1 });
    expect(bought.regions[id].dev.production).toBe(plain.regions[id].dev.production + 2); // shown at once
    for (let i = 0; i < 5; i++) { plain = turn(plain); bought = turn(bought); }
    const a = plain.regions[id]; const b = bought.regions[id];
    expect(investmentOf(b)).toEqual({ tax: 1, production: 2, manpower: 1 });
    expect(b.size).toBe(a.size);
    expect(b.dev.manpower).toBe(a.dev.manpower + 1);
    expect(b.lastYields.production).toBeCloseTo(a.lastYields.production + 2, 5);
    expect(b.dev.tax).toBe(a.dev.tax + 1);
    expect(calcIncome(bought).gold).toBeGreaterThan(calcIncome(plain).gold);
  }, 120000);

  it('the next Develop costs more: investment counts in total development', () => {
    const id = paris();
    const s = fresh();
    const after = develop(s, id, 'tax');
    expect(getDevelopProvinceCost(after.regions[id])).toBeGreaterThan(getDevelopProvinceCost(s.regions[id]));
  });

  it('survives a focus change, a save and load, and a conquest', () => {
    const id = paris();
    let s = develop(develop(fresh(), id, 'production'), id, 'tax');
    s = gameReducer(s, { type: ActionTypes.SET_CITY_FOCUS, payload: { cityId: id, focus: 'gold' } });
    s = turn(s);
    expect(investmentOf(s.regions[id])).toEqual({ tax: 1, production: 1, manpower: 0 });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: JSON.parse(JSON.stringify(s)) }).state;
    expect(investmentOf(loaded.regions[id])).toEqual({ tax: 1, production: 1, manpower: 0 });
    const withProduction = cityLive(loaded, id).yields.production;
    const without = cityLive(patch(loaded, id, { investment: undefined }), id).yields.production;
    expect(withProduction).toBeCloseTo(without + 1, 5);
    const taken = conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, id, RIVAL);
    expect(taken.regions[id].owner).toBe(RIVAL);
    expect(investmentOf(taken.regions[id])).toEqual({ tax: 1, production: 1, manpower: 0 });
  });

  it('a save from before the field reads as no investment', () => {
    const s = fresh();
    expect(s.regions[paris()].investment).toBeUndefined();
    expect(investmentOf(s.regions[paris()])).toEqual({ tax: 0, production: 0, manpower: 0 });
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state: JSON.parse(JSON.stringify(s)) }).state;
    expect(cityLive(loaded, paris()).yields.production).toBe(cityLive(s, paris()).yields.production);
  });
});

describe('Invest in growth (I032)', () => {
  it('adds food to the bank, the bank is still there next turn, and a full bank is not charged', () => {
    const id = paris();
    let s = fresh();
    s = { ...patch(s, id, { food: 0 }), resources: { ...s.resources, gold: 5000, adm: 50 } };
    const bought = gameReducer(s, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: id } });
    expect(bought.regions[id].food).toBeGreaterThan(0);
    expect(bought.resources.gold).toBeLessThan(s.resources.gold);
    const plainNext = turn(s); const boughtNext = turn(bought);
    const gained = boughtNext.regions[id].size * 1000 + boughtNext.regions[id].food - (plainNext.regions[id].size * 1000 + plainNext.regions[id].food);
    expect(gained).toBeGreaterThan(0); // still ahead a turn later
    const g = growthView(bought, id);
    const full = patch(bought, id, { food: g.threshold - 0.1 });
    const refused = gameReducer(full, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: id } });
    expect(refused.resources.gold).toBe(full.resources.gold);
    expect(refused.logs[refused.logs.length - 1].message).toMatch(/food bank is full/);
  });
});

describe('land: the price shown is the price charged (I036, I037, I038)', () => {
  const withTech = (s, ...ids) => ({ ...s, techTree: { ...s.techTree, ...Object.fromEntries(ids.map((t) => [t, { ...(s.techTree[t] || {}), researched: true }])) } });

  it('BUY_TILE debits exactly the quote, with the land discounts researched', () => {
    const id = paris();
    let s = withTech(fresh(), 'economy_silk_road_trade', 'science_cuneiform_records', 'governance_bureaucratic_reform');
    s = { ...s, resources: { ...s.resources, gold: 100000 } };
    const quotes = landQuotes(s, id);
    expect(quotes.length).toBeGreaterThan(0);
    const q = quotes[0];
    // The old reducer priced without the research: that number is higher than the quote.
    const city = s.regions[id];
    const undiscounted = buyTileCost(city, claimCandidates(city, getTiles(), worldOf(s), { ageId: cityCtx(s, city).ageId }).find((c) => c.tile === q.tile));
    expect(q.cost).toBeLessThan(undiscounted);
    const after = gameReducer(s, { type: ActionTypes.BUY_TILE, payload: { cityId: id, tile: q.tile } });
    expect(s.resources.gold - after.resources.gold).toBe(q.cost);
    expect(after.regions[id].tiles).toContain(q.tile);
    expect(after.world.tileOwner[q.tile]).toBe(id);
    // I037: the bought tile leaves the list at once.
    expect(landQuotes(after, id).some((x) => x.tile === q.tile)).toBe(false);
    // Consecutive buys: each debit is that moment's quote.
    const q2 = landQuotes(after, id)[0];
    const after2 = gameReducer(after, { type: ActionTypes.BUY_TILE, payload: { cityId: id, tile: q2.tile } });
    expect(after.resources.gold - after2.resources.gold).toBe(q2.cost);
  });

  it('a tile opened by a border technology can be bought (the reducer sees the same reach)', () => {
    const id = paris();
    const s0 = { ...fresh(), resources: { ...fresh().resources, gold: 100000 } };
    const s = withTech(s0, 'governance_provincial_administration', 'science_geometry');
    const before = new Set(landQuotes(s0, id).map((q) => q.tile));
    // Buy outwards until a tile appears that only the wider border allows, then buy it.
    let cur = s; let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      const qs = landQuotes(cur, id);
      const base = new Set(landQuotes({ ...cur, techTree: s0.techTree }, id).map((q) => q.tile));
      target = qs.find((q) => !base.has(q.tile) && !before.has(q.tile)) || null;
      if (!target) { if (!qs.length) break; cur = gameReducer(cur, { type: ActionTypes.BUY_TILE, payload: { cityId: id, tile: qs[0].tile } }); }
    }
    if (!target) return; // no such tile around this capital on this grid: nothing to prove
    const bought = gameReducer(cur, { type: ActionTypes.BUY_TILE, payload: { cityId: id, tile: target.tile } });
    expect(bought.regions[id].tiles).toContain(target.tile);
    expect(cur.resources.gold - bought.resources.gold).toBe(target.cost);
  }, 60000);

  it('refuses with the reason, and charges nothing, when the gold is short or the tile is not on offer', () => {
    const id = paris();
    const s = { ...fresh(), resources: { ...fresh().resources, gold: 0 } };
    const q = landQuotes(s, id)[0];
    expect(quoteBuyTile(s, id, q.tile)).toMatchObject({ ok: false, cost: q.cost });
    const poor = gameReducer(s, { type: ActionTypes.BUY_TILE, payload: { cityId: id, tile: q.tile } });
    expect(poor.regions[id].tiles).not.toContain(q.tile);
    expect(poor.logs[poor.logs.length - 1].message).toBe(`Needs ${q.cost} gold.`);
    expect(quoteBuyTile(s, id, s.regions[id].tile).ok).toBe(false);
  });

  it('says that an iron tile gives no iron without a mine', () => {
    const iron = resourceNeed({ resource: 'iron', improvement: null, pillaged: false }, []);
    expect(iron).toMatchObject({ kind: 'strategic', improvement: 'mine', built: false, needsTech: 'military_copper_working' });
    expect(iron.text).toMatch(/gives no iron/);
    expect(iron.text).toMatch(/Mine/);
    expect(resourceNeed({ resource: 'iron', improvement: 'mine', pillaged: false }, ['military_copper_working']).built).toBe(true);
    expect(resourceNeed({ resource: null }, [])).toBeNull();
    expect(resourceNeed({ resource: 'wheat', improvement: null }, []).text).toMatch(/Farm/);
  });
});

describe('ships need the sea (I039, I040)', () => {
  const find = (s, pred) => Object.values(s.regions).find((c) => c.tile != null && !c.outpost && pred(c));

  it('an inland city, river or not, cannot queue a ship or a harbor; a coastal one can', () => {
    const s = fresh();
    const tiles = getTiles();
    const inland = find(s, (c) => tiles.coastal[c.tile] !== 1 && tiles.rivers[c.tile] !== 0) || find(s, (c) => tiles.coastal[c.tile] !== 1);
    const coastal = find(s, (c) => tiles.coastal[c.tile] === 1);
    expect(inland).toBeTruthy(); expect(coastal).toBeTruthy();
    expect(hasSeaCoast(tiles, inland)).toBe(false);
    expect(hasSeaCoast(tiles, coastal)).toBe(true);
    const ctx = { researched: ['economy_silk_road_trade'], ageId: 'classical' };
    const ship = { kind: 'unit', classId: 'naval', navalLine: 'warship' };
    const harbor = { kind: 'building', category: 'naval', tier: 0 };
    expect(canQueue(inland, tiles, worldOf(s), ship, ctx)).toMatchObject({ ok: false, reason: NEEDS_SEA_COAST });
    expect(canQueue(inland, tiles, worldOf(s), harbor, ctx)).toMatchObject({ ok: false, reason: NEEDS_SEA_COAST });
    expect(canQueue(coastal, tiles, worldOf(s), ship, ctx).ok).toBe(true);
    expect(canQueue(coastal, tiles, worldOf(s), harbor, ctx).ok).toBe(true);
    expect(canQueue(inland, tiles, worldOf(s), { kind: 'unit', classId: 'infantry' }, ctx).ok).toBe(true);
  });

  it('the reducer refuses an inland ship with the reason', () => {
    let s = fresh();
    const tiles = getTiles();
    const id = paris();
    if (tiles.coastal[s.regions[id].tile] === 1) return; // Paris is inland on the Earth grid
    s = { ...s, age: 'classical', techAgeId: 'classical' };
    const after = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: id, item: { kind: 'unit', classId: 'naval', navalLine: 'warship' } } });
    expect(after.regions[id].production.current).toBeNull();
    expect(after.logs[after.logs.length - 1].message).toBe(NEEDS_SEA_COAST);
  });

  it('an inland AI city never picks the Naval line, whatever its doctrine order', () => {
    const s = fresh();
    const tiles = getTiles();
    const inland = find(s, (c) => c.owner && c.owner !== ME && tiles.coastal[c.tile] !== 1);
    // Every other line already stands, every technology is known: only Naval is left to build.
    const categories = Object.fromEntries(Object.keys(inland.buildings.categories).map((c) => [c, c === 'naval' ? -1 : 9]));
    const city = { ...inland, buildings: { ...inland.buildings, categories }, lastYields: { production: 500, food: 2 }, production: { current: null, queue: [], progress: 0 } };
    const st = { ...s, regions: { ...s.regions, [city.id]: city } };
    const pick = chooseProduction(st, city, { researched: Object.keys(s.techTree), ageId: 'modern', citiesOwned: 1, turnNumber: 2, units: {}, counts: { settlers: 1, outposts: 0, landUnits: 99 }, wonders: false });
    expect(pick?.category).not.toBe('naval');
    expect(pick?.classId).not.toBe('naval');
  });
});

describe('one ETA for the sheet and the city list (I052)', () => {
  it('the rail and the queue give the same turns, counted down the queue', () => {
    let s = fresh();
    const id = paris();
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: id, item: GRANARY } });
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: id, item: SPEAR } });
    // Stale mirror numbers must not matter: the city list reads the live city, like the sheet.
    s = patch(s, id, { lastYields: undefined });
    const view = queueView(s, id);
    expect(view.length).toBe(2);
    expect(view[1].turns).toBeGreaterThanOrEqual(view[0].turns);
    const live = cityLive(s, id);
    expect(view[0].turns).toBe(Math.max(1, Math.ceil(view[0].cost / live.yields.production)));
    expect(view[1].turns).toBe(Math.max(1, Math.ceil((view[0].cost + view[1].cost) / live.yields.production)));
    expect(cityRailModel(s).find((r) => r.id === id).buildTurns).toBe(view[0].turns);
    expect(buildQuote(s, id, SPEAR).turns).toBe(Math.max(1, Math.ceil(view[1].cost / live.yields.production)));
  });

  it('the live yields are the yields the turn then uses', () => {
    // After a first turn: the market's food and housing (world/market.js) are on the record by then.
    const s = turn(fresh());
    const id = paris();
    const live = cityLive(s, id);
    const next = turn(s);
    expect(next.regions[id].lastYields.production).toBe(live.yields.production);
    expect(next.regions[id].lastYields.food).toBe(live.yields.food);
    expect(next.regions[id].lastYields.culture).toBe(live.yields.culture);
  }, 60000);

  it('a build is long past about twenty Normal turns, later on slower speeds', () => {
    const s = fresh();
    expect(longBuildTurns({ ...s, gameSpeed: 'normal' }, 'bronze')).toBe(LONG_BUILD_TURNS);
    expect(longBuildTurns({ ...s, gameSpeed: 'marathon' }, 'bronze')).toBeGreaterThan(LONG_BUILD_TURNS);
    expect(isLongBuild({ ...s, gameSpeed: 'normal' }, 'bronze', 21)).toBe(true);
    expect(isLongBuild({ ...s, gameSpeed: 'normal' }, 'bronze', 20)).toBe(false);
    expect(isLongBuild({ ...s, gameSpeed: 'normal' }, 'bronze', null)).toBe(true); // no production at all
  });
});

describe('focus preview', () => {
  it('gives the yields of every focus and marks the current one', () => {
    const s = patch(fresh(), paris(), { size: 6 });
    const p = focusPreview(s, paris());
    expect(p.rows.map((r) => r.focus)).toEqual(['balanced', 'food', 'production', 'gold']);
    expect(p.rows.filter((r) => r.current).length).toBe(1);
    const prod = p.rows.find((r) => r.focus === 'production'); const food = p.rows.find((r) => r.focus === 'food');
    expect(prod.production).toBeGreaterThanOrEqual(food.production);
    expect(food.food).toBeGreaterThanOrEqual(prod.food);
    // The preview is the engine's own answer for that focus.
    const set = gameReducer(s, { type: ActionTypes.SET_CITY_FOCUS, payload: { cityId: paris(), focus: 'production' } });
    expect(cityLive(set, paris()).yields.production).toBe(prod.production);
  });

  it('says why when no focus changes anything', () => {
    const s = fresh();
    const id = paris();
    const city = s.regions[id];
    // One citizen and one tile: nothing to choose.
    const tiny = patch(s, id, { size: 1, tiles: [city.tile, city.tiles[1]], locked: [] });
    const p = focusPreview(tiny, id);
    expect(p.allSame).toBe(true);
    expect(p.reason).toMatch(/every tile is worked/);
    const outpost = focusPreview(patch(s, id, { outpost: { turns: 3 } }), id);
    expect(outpost.allSame).toBe(true);
    expect(outpost.reason).toMatch(/outpost/i);
  });
});
