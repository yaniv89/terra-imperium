import { describe, it, expect, beforeAll } from 'vitest';
import { loadTiles } from '../../data/geo/tiles';
import {
  emptyWorld, foundCity, canFoundCity, allocateTiles, cityYields, housingOf, processCity, processCities, queueItem,
  canQueue, productionCost, claimCandidates, growthThreshold, setFocus, toggleLock, FOOD_PER_CITIZEN, MIN_CITY_SPACING, sizeToPeople
} from './cities';

let tiles;
beforeAll(async () => { tiles = await loadTiles(); });

const ctx = (over = {}) => ({ researched: [], ageId: 'bronze', turnNumber: 1, citiesOwned: 1, luxuries: 0, ...over });

describe('cities on the grid', () => {
  it('founds a city on the Nile with its ring and refuses one too close', () => {
    const tile = tiles.capitals.eg;
    const { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile, name: 'Memphis', size: 3, isCapital: true });
    expect(city.tiles[0]).toBe(tile);
    expect(city.tiles.length).toBeGreaterThan(3);
    city.tiles.forEach((t) => expect(world.tileOwner[t]).toBe(city.id));
    const near = tiles.neighbors[tile][0];
    expect(canFoundCity(world, tiles, near, 'eg').ok).toBe(false);
    const far = tiles.countryTiles.eg.find((t) => t !== tile && !world.tileOwner[t] && tiles.terrainOf(t) !== 'snow');
    const okFar = canFoundCity(world, tiles, far, 'eg');
    // Either far enough, or the reason is the spacing rule.
    expect(okFar.ok || /Too close/.test(okFar.reason)).toBe(true);
    expect(MIN_CITY_SPACING).toBe(3);
  });

  it('works its best tiles by focus, never starving when food is reachable', () => {
    const tile = tiles.capitals.eg;
    const { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile, size: 3 });
    const worked = allocateTiles(city, tiles, world);
    expect(worked.length).toBe(3);
    expect(new Set(worked).size).toBe(3);
    worked.forEach((t) => expect(city.tiles).toContain(t));
    const y = cityYields(city, tiles, world, worked);
    expect(y.food).toBeGreaterThanOrEqual(0);
    const gold = setFocus(city, 'gold');
    const workedGold = allocateTiles(gold, tiles, world);
    const yg = cityYields(gold, tiles, world, workedGold);
    expect(yg.raw.gold).toBeGreaterThanOrEqual(y.raw.gold);
    // Locks win.
    const lockTile = city.tiles[city.tiles.length - 1];
    const locked = toggleLock(city, lockTile);
    expect(allocateTiles(locked, tiles, world)).toContain(lockTile);
  });

  it('grows with surplus food, slows at the housing cap and starves on a deficit', () => {
    const tile = tiles.capitals.eg;
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile, size: 1 });
    const housing = housingOf(city);
    expect(housing).toBeGreaterThanOrEqual(3);
    let turns = 0;
    while (city.size < 2 && turns < 40) { const r = processCity(world, tiles, city, ctx()); world = r.world; city = r.city; turns++; }
    expect(city.size).toBe(2);
    expect(turns).toBeLessThan(40);
    expect(growthThreshold(1)).toBe(22);
    // Starvation: a size-10 city on nothing.
    const big = { ...city, size: 10, food: 0, tiles: [city.tile], locked: [] };
    const r = processCity(world, tiles, big, ctx());
    expect(r.city.size).toBe(9);
    expect(r.logs.some((l) => /starves/.test(l))).toBe(true);
    expect(FOOD_PER_CITIZEN).toBe(2);
  });

  it('builds the queue with overflow, improvements change tiles, settlers cost a citizen', () => {
    const tile = tiles.capitals.eg;
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile, size: 4 });
    expect(canQueue(city, tiles, world, { kind: 'building', category: 'food', tier: 0 }).ok).toBe(true);
    expect(canQueue(city, tiles, world, { kind: 'building', category: 'food', tier: 1 }).ok).toBe(false);
    expect(canQueue(city, tiles, world, { kind: 'unit', classId: 'air' }).ok).toBe(false);
    expect(canQueue(city, tiles, world, { kind: 'unit', classId: 'infantry' }).ok).toBe(true);
    const farmTile = city.tiles.find((t) => t !== tile && canQueue(city, tiles, world, { kind: 'improvement', improvement: 'farm', tile: t }).ok);
    expect(farmTile).toBeDefined();
    city = queueItem(city, { kind: 'building', category: 'food', tier: 0 });
    city = queueItem(city, { kind: 'improvement', improvement: 'farm', tile: farmTile });
    city = queueItem(city, { kind: 'settler' });
    const cost = productionCost({ kind: 'building', category: 'food', tier: 0 });
    expect(cost).toBe(48);
    let turns = 0; let built = false; let settled = null;
    while (turns < 60 && !settled) {
      const r = processCity(world, tiles, city, ctx()); world = r.world; city = r.city; turns++;
      if (city.buildings.categories.food === 0) built = true;
      settled = r.completed.find((x) => x.kind === 'settler') || null;
    }
    expect(built).toBe(true);
    expect(world.tileState[farmTile]?.improvement).toBe('farm');
    expect(settled).toBeTruthy();
    expect(city.production.current).toBeNull();
    expect(city.size).toBeGreaterThanOrEqual(1);
  });

  it('claims the best tile when its culture bank covers it, and lists candidates', () => {
    const tile = tiles.capitals.eg;
    let { world, city } = foundCity(emptyWorld(), tiles, { nationId: 'eg', tile, size: 2 });
    const cands = claimCandidates(city, tiles, world, { ageId: 'bronze' });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0].ring).toBe(2);
    expect(cands[0].score).toBeGreaterThanOrEqual(cands[cands.length - 1].score);
    const before = city.tiles.length;
    let turns = 0;
    while (city.tiles.length === before && turns < 60) { const r = processCity(world, tiles, city, ctx()); world = r.world; city = r.city; turns++; }
    expect(city.tiles.length).toBe(before + 1);
    expect(world.tileOwner[city.tiles[before]]).toBe(city.id);
  });

  it('processes two nations deterministically without touching each other\'s land', () => {
    let world = emptyWorld();
    ({ world } = foundCity(world, tiles, { nationId: 'il', tile: tiles.capitals.il, size: 3 }));
    ({ world } = foundCity(world, tiles, { nationId: 'jo', tile: tiles.capitals.jo, size: 3 }));
    const run = (w) => { for (let i = 0; i < 30; i++) w = processCities(w, tiles, () => ctx()).world; return w; };
    const a = run(world); const b = run(world);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    Object.values(a.cities).forEach((c) => c.tiles.forEach((t) => expect(a.tileOwner[t]).toBe(c.id)));
    const owners = Object.values(a.tileOwner);
    expect(owners.length).toBe(new Set(Object.keys(a.tileOwner)).size);
  });

  it('runs 2,000 cities in under 150 ms a turn on this sandbox', () => {
    let world = emptyWorld();
    const sites = []; const taken = new Set();
    for (let i = 0; i < tiles.count && sites.length < 2000; i += 1) {
      if (!tiles.land[i] || tiles.terrainOf(i) === 'snow' || tiles.featureOf(i) === 'ice' || taken.has(i)) continue;
      sites.push(i); taken.add(i); tiles.neighbors[i].forEach((n) => taken.add(n));
    }
    sites.forEach((t, k) => { ({ world } = foundCity(world, tiles, { nationId: `n${k % 240}`, tile: t, size: 3 })); });
    expect(Object.keys(world.cities).length).toBe(2000);
    const t0 = performance.now();
    for (let i = 0; i < 3; i++) world = processCities(world, tiles, () => ctx()).world;
    const ms = (performance.now() - t0) / 3;
    expect(ms).toBeLessThan(150);
  }, 60000);

  it('derives people from size', () => {
    expect(sizeToPeople(1)).toBe(1000);
    expect(sizeToPeople(8)).toBeGreaterThan(sizeToPeople(4) * 4);
  });
});
