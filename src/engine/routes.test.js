import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { REGIONS_DATA, getNeighborIds } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { computeSupplyFlow, MARCH_SUPPLY_PER_UNIT } from './supplies';
import { calcNationBalance } from './economy';
import { UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';
import { accessOf, advanceMarches, findRoute, planMarch, scheduleSteps, stackPace, stepCost, ENEMY_STEP_COST, ROAD_FACTOR } from './routes';
import { addCity, borderPair } from './testWorld';
import { legacyTerrainOf } from './world/registry';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWarWith = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-test', aggressor: 'fr', enemy, active: true, startYear: s.year }] });

// The Dawn world gives France one city, so the fixture founds a chain of three more (P -> A -> B
// -> C), one on a French mountain tile and one on an island, through the real foundCity.
const buildWorld = () => {
  const tiles = getTiles();
  let s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 }));
  const P = s.nations.fr.capitalRegionId;
  const open = (t) => ['plains', 'mixed'].includes(legacyTerrainOf(tiles, t));
  // A chain of three open-land cities, each bordering the one before, on the nearest open country
  // to Paris that has room for it (every tile around Paris belongs to a capital at Dawn, and
  // central Europe is forest and hills).
  const found = (base, t) => { let r; try { r = addCity(base, 'fr', { near: t }); } catch { return null; } return r.state.regions[r.cityId].tile === t ? r : null; };
  const openFree = (base, from) => {
    const pool = [];
    for (let t = 0; t < tiles.count; t++) if (tiles.land[t] && open(t) && !base.world.tileOwner[t]) pool.push(t);
    return pool.sort((a, b) => distanceKm(tiles.centres[from], tiles.centres[a]) - distanceKm(tiles.centres[from], tiles.centres[b]));
  };
  const tryChain = (startTile) => {
    const first = found(s, startTile);
    if (!first) return null;
    let st = first.state; const ids = [first.cityId];
    for (let i = 1; i < 3; i++) {
      const prevTile = st.regions[ids[i - 1]].tile;
      let next = null;
      for (const t of openFree(st, prevTile).slice(0, 12)) {
        const r = found(st, t); // syncs the registry to r.state, so the adjacency check is live
        if (r && getNeighborIds(ids[i - 1]).includes(r.cityId)) { next = r; break; }
      }
      if (!next) return null;
      st = next.state; ids.push(next.cityId);
    }
    return { state: st, ids };
  };
  let chain = null;
  for (const start of openFree(s, s.regions[P].tile).slice(0, 80)) { chain = tryChain(start); if (chain) break; }
  if (!chain) throw new Error('no room for a chain of open-land cities');
  s = chain.state;
  const [A, B, C] = chain.ids;
  // The nearest free tile to Paris that fits (France's own two mountain tiles sit next to the
  // Alpine capitals, and it has no one-tile island at this grid size) becomes a French city.
  const paris = tiles.centres[s.regions[P].tile];
  const cityOn = (label, pred) => {
    const pool = [];
    for (let t = 0; t < tiles.count; t++) if (tiles.land[t] && pred(t)) pool.push(t);
    pool.sort((a, b) => distanceKm(paris, tiles.centres[a]) - distanceKm(paris, tiles.centres[b]));
    for (const t of pool) {
      if (s.world.tileOwner[t]) continue;
      let r;
      try { r = addCity(s, 'fr', { near: t }); } catch { continue; }
      if (r.state.regions[r.cityId].tile === t) { s = r.state; return r.cityId; }
    }
    throw new Error(`no ${label} tile found`);
  };
  const M = cityOn('mountain', (t) => tiles.reliefOf(t) === 'mountains');
  const I = cityOn('island', (t) => tiles.neighbors[t].every((n) => !tiles.land[n]));
  const [, ES] = borderPair(s, 'fr', 'es');
  return { s, P, A, B, C, M, I, ES };
};
const W = buildWorld();
const fresh = () => W.s;
const { P, A, B, C, M, I, ES } = W;

describe('route costs', () => {
  it('prices a step by terrain, roads and enemy land', () => {
    const s = fresh();
    expect(getRegionTerrain(M, REGIONS_DATA)).toBe('mountains');
    expect(stepCost(s, M)).toBe(4);
    expect(stepCost(s, A)).toBe(1);
    const road = { ...s, regions: { ...s.regions, [A]: { ...s.regions[A], buildings: { ...s.regions[A].buildings, categories: { ...s.regions[A].buildings?.categories, logistics: 0 } } } } };
    expect(stepCost(road, A)).toBeCloseTo(ROAD_FACTOR);
    const war = atWarWith(s, 'es');
    expect(accessOf(war, ES)).toBe('enemy');
    expect(stepCost(war, ES)).toBeGreaterThanOrEqual(ENEMY_STEP_COST);
  });

  it('moves at the pace of the slowest unit, plus Forced March', () => {
    expect(stackPace([unit('a', 'x'), unit('b', 'x', { classId: 'cavalry' })])).toBe(2);
    expect(stackPace([unit('a', 'x', { classId: 'cavalry', promotions: ['forcedMarch'] })])).toBe(4);
    expect(stackPace([unit('a', 'x', { classId: 'siege' })])).toBe(1);
  });

  it('schedules two open provinces a turn for infantry and banks points for a mountain', () => {
    const s = fresh();
    expect(scheduleSteps(s, [A, B, C], 2)).toEqual([1, 1, 2]);
    expect(scheduleSteps(s, [M], 2)).toEqual([2]);
    expect(scheduleSteps(s, [M], 1)).toEqual([4]);
  });
});

describe('planning a route', () => {
  it('finds a path through your own land and refuses foreign land at peace', () => {
    const s = fresh();
    const r = findRoute(s, A, C);
    expect(r.path[0]).toBe(A);
    expect(r.path[r.path.length - 1]).toBe(C);
    r.path.forEach((id, i) => { if (i) expect(REGIONS_DATA[r.path[i - 1]].neighbors).toContain(id); });
    expect(findRoute(s, P, ES).reason).toMatch(/No access to/);
  });

  it('enters enemy land at war and says where the march halts', () => {
    const s = withUnits(atWarWith(fresh(), 'es'), [unit('a', P)]);
    const plan = planMarch(s, P, ES);
    expect(plan.ok).toBe(true);
    expect(plan.haltAt).toBe(ES);
  });

  it('needs a fleet for an island', () => {
    const s = withUnits(fresh(), [unit('a', P)]);
    expect(planMarch(s, P, I).reason).toMatch(/fleet/);
  });
});

describe('marching', () => {
  const marchTo = (s, from, to) => gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: from, toRegionId: to } });

  it('walks the route over several End Turns, the stack together, and logs the arrival', () => {
    let s = withUnits(fresh(), [unit('a', A), unit('b', A, { classId: 'cavalry' })]);
    s = marchTo(s, A, C);
    const plan = planMarch(s, A, C);
    expect(s.units.a.route).toEqual(plan.steps);
    expect(s.resources).toEqual(fresh().resources); // the order is free
    const play = (st) => {
      let x = st;
      for (let t = 0; t < 10 && x.units.a.route?.length; t++) {
        if (x.pendingPeaceOffer) x = gameReducer(x, { type: ActionTypes.REJECT_PENDING_PEACE });
        x = resolveTurn(x);
        if (x.activeProceduralEvent) x = { ...x, activeProceduralEvent: null };
        expect(x.units.a.regionId).toBe(x.units.b.regionId);
      }
      return x;
    };
    const a = play(s); const b = play(s);
    expect(a.units.a, JSON.stringify({ plan, unit: a.units.a, logs: a.logs.slice(-5) })).toHaveProperty('regionId', C);
    expect(a.turnNumber - s.turnNumber).toBe(plan.turns);
    expect(b.units.a).toEqual(a.units.a);
    expect(a.logs.some((l) => l.message.includes(`reached ${REGIONS_DATA[C].name}`))).toBe(true);
    // The mountain step costs strength (refilled later at home by reinforcement).
    const beside = getNeighborIds(M).find((id) => fresh().regions[id].owner === 'fr') || getNeighborIds(M)[0];
    const near = withUnits(fresh(), [unit('m', beside, { route: [M], routePace: 2, routeBank: 2 })]);
    const units = { ...near.units };
    advanceMarches(near, units, {});
    expect(units.m.regionId).toBe(M);
    expect(units.m.strength).toBe(970);
  });

  it('halts at an enemy border and marches on once the province is taken', () => {
    let s = withUnits(atWarWith(fresh(), 'es'), [unit('a', P)]);
    s = marchTo(s, P, ES);
    const units = { ...s.units };
    advanceMarches(s, units, { year: s.year });
    expect(units.a.regionId).toBe(P);
    expect(units.a.routeHalt).toBe('attack');
    expect(units.a.route).toEqual([ES]);
    // Winning the attack moves the army in: the route is then done.
    const won = { ...s, units: { ...units, a: { ...units.a, regionId: ES } } };
    const after = { ...won.units };
    advanceMarches(won, after, { year: s.year });
    expect(after.a.route).toBe(null);
  });

  it('stops when access is lost (the alliance ended)', () => {
    let s = withUnits(atWarWith(fresh(), 'es'), [unit('a', P)]);
    s = marchTo(s, P, ES);
    const peace = { ...s, wars: s.wars.filter((w) => w.id !== 'w-test') };
    const units = { ...peace.units };
    const { logs } = advanceMarches(peace, units, { year: s.year });
    expect(units.a.route).toBe(null);
    expect(logs[0].message).toMatch(/no access/);
  });

  it('charges supplies and upkeep only for the units that marched this turn', () => {
    const s = withUnits(fresh(), [unit('a', P, { marchedTurn: fresh().turnNumber }), unit('b', P)]);
    const flow = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'fr', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber });
    expect(flow.marching).toBe(MARCH_SUPPLY_PER_UNIT);
    const idle = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'fr', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber + 1 });
    expect(idle.marching).toBe(0);
    expect(calcNationBalance(s, 'fr').expenses.marchingUpkeep).toBe(Math.round(UNIT_UPKEEP_GOLD_PER_TURN * ((s.nations.fr.armyMaintenance ?? 100) / 100) * 0.25));
  });

  it('a manual move replaces the march and costs no military power', () => {
    let s = withUnits(fresh(), [unit('a', A)]);
    s = marchTo(s, A, C);
    const moved = gameReducer(s, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a', toRegionId: B } });
    expect(moved.units.a.regionId).toBe(B);
    expect(moved.units.a.route).toBe(null);
    expect(moved.resources.mil).toBe(s.resources.mil);
    expect(moved.units.a.marchedTurn).toBe(s.turnNumber);
  });

  it('a route survives a save and load', () => {
    let s = withUnits(fresh(), [unit('a', A)]);
    s = marchTo(s, A, C);
    const loaded = JSON.parse(JSON.stringify(s));
    const u1 = { ...s.units }; const u2 = { ...loaded.units };
    advanceMarches(s, u1, {}); advanceMarches(loaded, u2, {});
    expect(u2.a).toEqual(u1.a);
  });
});
