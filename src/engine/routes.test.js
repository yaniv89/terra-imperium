// src/engine/routes.test.js
// Marches on tiles (workstream 5): costs, planning, walking over End Turns, halts, zone of control.
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital, getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { computeSupplyFlow, MARCH_SUPPLY_PER_UNIT } from './supplies';
import { calcNationBalance } from './economy';
import { UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';
import { accessOf, advanceMarches, findRoute, planMarch, scheduleSteps, stackPace, stepCost, ENEMY_STEP_COST } from './routes';
import { ROAD_COST, RIVER_CROSSING, TILE_COST_MOUNTAINS, MOVE_POINTS, findTilePath, normalizeUnitTiles, tileAccess, tileStepCost, unitTile, inEnemyZoc } from './armies';
import { validateInvasion } from './invasion';
import { addCity } from './testWorld';
import { assertGameState } from './stateAudit';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWarWith = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-test', aggressor: 'in', enemy, active: true, startYear: s.year }] });
const play = (st, until) => {
  let x = st;
  for (let t = 0; t < 12 && !until(x); t++) {
    if (x.pendingPeaceOffer) x = gameReducer(x, { type: ActionTypes.REJECT_PENDING_PEACE });
    x = resolveTurn(x);
    if (x.activeProceduralEvent) x = { ...x, activeProceduralEvent: null };
  }
  return x;
};

const tiles = getTiles();
// The Dawn start gives India one city and one army; the tests place their own units.
const S = (() => { const s = quiet(createInitialState({ playerNationId: 'in', rngSeed: 3 })); return { ...s, units: {} }; })();
const P = getNationCapital('in');
const PK = getNationCapital('pk');
const homeTile = S.regions[P].tile;
// Tiles by walking distance from New Delhi over land India may cross at peace (New Delhi sits among the
// capitals of its neighbours, so free land is not simply "ring 4").
const free = (s, t) => tiles.land[t] === 1 && !s.world.tileOwner[t] && tiles.terrainOf(t) !== 'snow' && tiles.featureOf(t) !== 'ice';
const reachableRings = (s, from, max) => {
  const out = [[from]]; const seen = new Set([from]);
  for (let d = 1; d <= max; d++) {
    const next = [];
    out[d - 1].forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n) && tiles.land[n] && tileAccess(s, n, 'in') !== 'closed') { seen.add(n); next.push(n); } }));
    out.push(next.sort((a, b) => a - b));
  }
  return out;
};
const RINGS = reachableRings(S, homeTile, 10);
const freeAt = (ring) => RINGS.slice(ring).flat().find((t) => free(S, t));

describe('tile step costs', () => {
  it('prices a step by relief, cover, rivers, roads and enemy land', () => {
    const open = [...Array(tiles.count).keys()].find((t) => tiles.land[t] && tiles.reliefOf(t) === 'flat' && tiles.featureOf(t) === 'none' && tiles.terrainOf(t) === 'grassland');
    const mountain = [...Array(tiles.count).keys()].find((t) => tiles.land[t] && tiles.reliefOf(t) === 'mountains');
    const hillForest = [...Array(tiles.count).keys()].find((t) => tiles.land[t] && tiles.reliefOf(t) === 'hills' && tiles.featureOf(t) === 'forest' && ['grassland', 'plains'].includes(tiles.terrainOf(t)));
    expect(tileStepCost(S, tiles, null, open)).toBe(1);
    expect(tileStepCost(S, tiles, null, mountain)).toBe(TILE_COST_MOUNTAINS);
    expect(tileStepCost(S, tiles, null, hillForest)).toBe(3);
    const river = [...Array(tiles.count).keys()].find((t) => tiles.land[t] && tiles.neighbors[t].some((n) => tiles.land[n] && tiles.riverBetween(t, n)));
    const across = tiles.neighbors[river].find((n) => tiles.land[n] && tiles.riverBetween(river, n));
    expect(tileStepCost(S, tiles, river, across)).toBe(tileStepCost(S, tiles, null, across) + RIVER_CROSSING);
    const road = { ...S, world: { ...S.world, tileState: { ...S.world.tileState, [open]: { road: true } } } };
    expect(tileStepCost(road, tiles, null, open)).toBe(ROAD_COST);
    expect(tileStepCost(S, tiles, null, open, 'enemy')).toBeGreaterThanOrEqual(ENEMY_STEP_COST);
    expect(stepCost(S, open)).toBe(1);
  });

  it('moves at the pace of the slowest unit, plus Forced March', () => {
    expect(stackPace([unit('a', P), unit('b', P, { classId: 'cavalry' })])).toBe(MOVE_POINTS.infantry);
    expect(stackPace([unit('a', P, { classId: 'cavalry', promotions: ['forcedMarch'] })])).toBe(MOVE_POINTS.cavalry + 1);
    expect(stackPace([unit('a', P, { classId: 'siege' })])).toBe(MOVE_POINTS.siege);
  });

  it('schedules the steps a turn by banked points', () => {
    const path = findRoute(S, homeTile, freeAt(4)).path;
    const steps = path.slice(1);
    const turns = scheduleSteps(S, homeTile, steps, 2);
    expect(turns.length).toBe(steps.length);
    turns.forEach((t, i) => { expect(t).toBeGreaterThanOrEqual(1); if (i) expect(t).toBeGreaterThanOrEqual(turns[i - 1]); });
    expect(scheduleSteps(S, homeTile, steps, 1)[steps.length - 1]).toBeGreaterThanOrEqual(turns[steps.length - 1]);
    expect(scheduleSteps(S, homeTile, steps, 4)[steps.length - 1]).toBeLessThanOrEqual(turns[steps.length - 1]);
  });
});

describe('planning a route', () => {
  it('finds a path over adjacent tiles through free land and refuses a neighbour at peace', () => {
    const to = freeAt(5);
    const r = findRoute(S, homeTile, to);
    expect(r.path[0]).toBe(homeTile);
    expect(r.path[r.path.length - 1]).toBe(to);
    r.path.forEach((t, i) => { if (i) expect(tiles.neighbors[r.path[i - 1]]).toContain(t); });
    expect(findRoute(S, homeTile, PK).reason).toMatch(/No access to/);
    expect(accessOf(S, PK)).toBe('closed');
    expect(findTilePath(S, homeTile, homeTile).reason).toMatch(/already there/);
  });

  it('plans into enemy land at war and says where the march halts', () => {
    const s = withUnits(atWarWith(S, 'pk'), [unit('a', P)]);
    const plan = planMarch(s, P, PK);
    expect(plan.ok, plan.reason).toBe(true);
    expect(plan.haltAt).toBe(PK);
    expect(s.world.tileOwner[plan.haltTile]).toBe(PK);
    expect(plan.path[plan.path.length - 1]).toBe(s.regions[PK].tile);
  });

  it('needs a fleet for an island', () => {
    const s = withUnits(S, [unit('a', P)]);
    const island = [...Array(tiles.count).keys()].find((t) => free(S, t) && tiles.neighbors[t].every((n) => !tiles.land[n]));
    expect(planMarch(s, P, island).reason).toMatch(/fleet/);
  });

  it('refuses a march from a city with no army', () => {
    expect(planMarch(S, P, freeAt(3)).reason).toMatch(/No army/);
  });
});

describe('marching', () => {
  const marchTo = (s, from, target) => gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: typeof target === 'number' ? { fromRegionId: from, toTile: target } : { fromRegionId: from, toRegionId: target } });

  it('walks the route over several End Turns, the stack together, and logs the arrival', () => {
    const to = freeAt(4);
    let s = withUnits(S, [unit('a', P), unit('b', P, { classId: 'cavalry' })]);
    s = marchTo(s, P, to);
    const plan = planMarch(s, P, to);
    expect(s.units.a.route).toEqual(plan.steps);
    expect(s.units.b.route).toEqual(plan.steps);
    expect(s.resources).toEqual(S.resources); // the order is free
    const a = play(s, (x) => !x.units.a.route?.length);
    const b = play(s, (x) => !x.units.a.route?.length);
    expect(a.units.a.tile).toBe(to);
    expect(a.units.b.tile).toBe(to);
    expect(a.units.a.regionId).toBe(P); // free land: the nearest own city stays its base
    expect(a.turnNumber - s.turnNumber).toBe(plan.turns);
    expect(b.units.a).toEqual(a.units.a);
    expect(a.logs.some((l) => l.message.includes('reached'))).toBe(true);
    assertGameState(a);
  });

  it('a step into the mountains costs strength', () => {
    // a plain mountain step (no river on the edge, no desert or tundra), so the bank of 4 pays it
    const step = (t, n) => free(S, n) && tiles.reliefOf(n) !== 'mountains' && tileStepCost(S, tiles, n, t) === TILE_COST_MOUNTAINS;
    const M = [...Array(tiles.count).keys()].find((t) => tiles.land[t] && tiles.reliefOf(t) === 'mountains' && !S.world.tileOwner[t] && tiles.neighbors[t].some((n) => step(t, n)));
    const beside = tiles.neighbors[M].find((n) => step(M, n));
    const near = withUnits(S, [unit('m', P, { tile: beside, route: [M], routePace: 2, routeBank: 2 })]);
    const units = { ...near.units };
    advanceMarches(near, units, {});
    expect(units.m.tile).toBe(M);
    expect(units.m.strength).toBe(970);
  });

  it('walks into enemy land at war, halts before the city, and marches on once it is taken', () => {
    let s = withUnits(atWarWith(S, 'pk'), [unit('a', P)]);
    s = marchTo(s, P, PK);
    const plan = planMarch(s, P, PK);
    expect(plan.haltTile).toBe(s.regions[PK].tile);
    const units = { ...s.units };
    let st = s;
    for (let i = 0; i < 8 && units.a.routeHalt !== 'attack'; i++) { advanceMarches(st, units, { year: s.year }); st = { ...st, units: { ...units } }; }
    expect(units.a.routeHalt).toBe('attack');
    expect(units.a.route[0]).toBe(plan.haltTile);
    expect(st.world.tileOwner[units.a.tile]).toBe(PK); // stands on Pakistani land, beside the city
    expect(units.a.regionId).toBe(P); // its base stays its own city
    expect(tiles.neighbors[units.a.tile]).toContain(plan.haltTile);
    // The waiting army can attack the city from its tile.
    const v = validateInvasion({ ...st, resources: { ...st.resources, mil: 1000, gold: 1000 } }, P, PK, { ignoreCost: true });
    expect(v.ok, v.reason).toBe(true);
    expect(v.attackerUnits.map((u) => u.id)).toEqual(['a']);
    // Winning the attack moves the army in: the route is then done.
    const won = { ...st, units: { ...units, a: { ...units.a, regionId: PK, tile: st.regions[PK].tile } } };
    const after = { ...won.units };
    advanceMarches(won, after, { year: s.year });
    expect(after.a.route).toBe(null);
  });

  it('stops when access is lost (the war ended)', () => {
    let s = withUnits(atWarWith(S, 'pk'), [unit('a', P)]);
    s = marchTo(s, P, PK);
    const peace = { ...s, wars: s.wars.filter((w) => w.id !== 'w-test') };
    const units = { ...peace.units };
    let st = peace; let logs = [];
    for (let i = 0; i < 6 && units.a.route; i++) { ({ logs } = advanceMarches(st, units, { year: s.year })); st = { ...st, units: { ...units } }; }
    expect(units.a.route).toBe(null);
    expect(logs[0].message).toMatch(/no access/);
  });

  it('ends the move next to an enemy army (zone of control) and halts before one on the road', () => {
    const to = freeAt(8);
    let s = withUnits(atWarWith(S, 'pk'), [unit('a', P, { classId: 'cavalry' })]);
    s = marchTo(s, P, to);
    const steps = s.units.a.route;
    const sched = scheduleSteps(s, homeTile, steps, s.units.a.routePace);
    // A turn in which the army would cover two steps: an enemy beside the first of them ends it there.
    const k = sched.findIndex((t, i) => i + 1 < sched.length && sched[i + 1] === t);
    expect(k).toBeGreaterThanOrEqual(0);
    const before = new Set([homeTile, ...steps.slice(0, k)]);
    const watch = tiles.neighbors[steps[k]].find((t) => tiles.land[t] && !steps.includes(t) && !before.has(t) && !tiles.neighbors[t].some((n) => before.has(n)));
    expect(watch).toBeDefined();
    const guarded = withUnits(s, [unit('e', PK, { ownerId: 'pk', tile: watch })]);
    expect(inEnemyZoc(guarded, tiles, steps[k], 'in')).toBe(true);
    const units = { ...guarded.units };
    let st = guarded;
    for (let t = 0; t < sched[k]; t++) { advanceMarches(st, units, {}); st = { ...st, units: { ...units } }; }
    expect(units.a.tile).toBe(steps[k]);
    expect(units.a.route[0]).toBe(steps[k + 1]);
    expect(units.a.routeBank).toBe(0);
    // An enemy army standing on the next tile halts the march before it.
    const blocked = withUnits(s, [unit('e', s.world.tileOwner[steps[0]] || PK, { ownerId: 'pk', tile: steps[0] })]);
    const u2 = { ...blocked.units };
    for (let t = 0; t < 3; t++) advanceMarches(blocked, u2, {});
    expect(u2.a.tile).toBe(homeTile);
    expect(u2.a.routeHalt).toBe('enemy');
  });

  it('charges supplies and upkeep only for the units that marched this turn', () => {
    const s = withUnits(S, [unit('a', P, { marchedTurn: S.turnNumber }), unit('b', P)]);
    const flow = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'in', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber });
    expect(flow.marching).toBe(MARCH_SUPPLY_PER_UNIT);
    const idle = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'in', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber + 1 });
    expect(idle.marching).toBe(0);
    expect(calcNationBalance(s, 'in').expenses.marchingUpkeep).toBe(Math.round(UNIT_UPKEEP_GOLD_PER_TURN * ((s.nations.in.armyMaintenance ?? 100) / 100) * 0.25));
  });

  it('a manual move replaces the march, puts the unit on the city centre and costs no military power', () => {
    const { state: s0, cityId: B } = addCity(S, 'in', { near: P });
    expect(getNeighborIds(P)).toContain(B);
    let s = withUnits(s0, [unit('a', P)]);
    s = marchTo(s, P, freeAt(4));
    const moved = gameReducer(s, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a', toRegionId: B } });
    expect(moved.units.a.regionId).toBe(B);
    expect(moved.units.a.tile).toBe(s0.regions[B].tile);
    expect(moved.units.a.route).toBe(null);
    expect(moved.resources.mil).toBe(s.resources.mil);
    expect(moved.units.a.marchedTurn).toBe(s.turnNumber);
  });

  it('a route survives a save and load', () => {
    let s = withUnits(S, [unit('a', P)]);
    s = marchTo(s, P, freeAt(4));
    const loaded = JSON.parse(JSON.stringify(s));
    const u1 = { ...s.units }; const u2 = { ...loaded.units };
    advanceMarches(s, u1, {}); advanceMarches(loaded, u2, {});
    expect(u2.a).toEqual(u1.a);
  });
});

describe('units and tiles', () => {
  it('a unit without a tile stands on its city centre; one on foreign land keeps its base; one on its nation\'s other city\'s land joins that city', () => {
    const s = normalizeUnitTiles(withUnits(S, [unit('a', P), unit('n', P, { domain: 'naval' })]));
    expect(s.units.a.tile).toBe(homeTile);
    expect(s.units.n.tile).toBe(homeTile);
    expect(unitTile(s, { regionId: P })).toBe(homeTile);
    const foreign = S.regions[PK].tiles.find((t) => t !== S.regions[PK].tile && tiles.land[t] === 1);
    const abroad = normalizeUnitTiles(withUnits(S, [unit('a', P, { tile: foreign })]));
    expect(abroad.units.a.regionId).toBe(P);
    expect(abroad.units.a.tile).toBe(foreign);
    const { state: s2, cityId: B } = addCity(S, 'in', { near: P });
    const ownLand = s2.regions[B].tiles.find((t) => t !== s2.regions[B].tile && tiles.land[t] === 1);
    const rebased = normalizeUnitTiles(withUnits(s2, [unit('a', P, { tile: ownLand })]));
    expect(rebased.units.a.regionId).toBe(B);
    expect(normalizeUnitTiles(s)).toBe(s);
  });

  it('an army at home no longer attacks across the Dawn bridge: it must stand beside the city', () => {
    const home = withUnits(atWarWith(S, 'pk'), [unit('a', P, { tile: homeTile })]);
    const touching = getTouchingIds(P).includes(PK);
    const v = validateInvasion(home, P, PK, { ignoreCost: true });
    expect(v.ok).toBe(touching);
    if (!touching) expect(v.reason).toBe('not_adjacent');
    const gate = getTiles().neighbors[S.regions[PK].tile].find((n) => getTiles().land[n] === 1);
    const beside = withUnits(atWarWith(S, 'pk'), [unit('a', P, { tile: gate })]);
    expect(validateInvasion(beside, P, PK, { ignoreCost: true }).ok).toBe(true);
    const far = withUnits(atWarWith(S, 'pk'), [unit('a', P, { tile: freeAt(6) })]);
    expect(['no_units', 'not_adjacent']).toContain(validateInvasion(far, P, PK, { ignoreCost: true }).reason);
  });
});
