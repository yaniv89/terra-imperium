import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { REGIONS_DATA } from '../data/regions';
import { getRegionTerrain } from '../data/terrain';
import { computeSupplyFlow, MARCH_SUPPLY_PER_UNIT } from './supplies';
import { calcNationBalance } from './economy';
import { UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';
import { accessOf, advanceMarches, findRoute, planMarch, scheduleSteps, stackPace, stepCost, ENEMY_STEP_COST, ROAD_FACTOR } from './routes';

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const fresh = () => quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 }));
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWarWith = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-test', aggressor: 'fr', enemy, active: true, startYear: s.year }] });

describe('route costs', () => {
  it('prices a step by terrain, roads and enemy land', () => {
    const s = fresh();
    expect(getRegionTerrain('fr-04', REGIONS_DATA)).toBe('mountains');
    expect(stepCost(s, 'fr-04')).toBe(4);
    expect(stepCost(s, 'fr-75')).toBe(1);
    const road = { ...s, regions: { ...s.regions, 'fr-75': { ...s.regions['fr-75'], buildings: { ...s.regions['fr-75'].buildings, categories: { ...s.regions['fr-75'].buildings?.categories, logistics: 0 } } } } };
    expect(stepCost(road, 'fr-75')).toBeCloseTo(ROAD_FACTOR);
    const war = atWarWith(s, 'es');
    expect(accessOf(war, 'es-z')).toBe('enemy');
    expect(stepCost(war, 'es-z')).toBeGreaterThanOrEqual(ENEMY_STEP_COST);
  });

  it('moves at the pace of the slowest unit, plus Forced March', () => {
    expect(stackPace([unit('a', 'x'), unit('b', 'x', { classId: 'cavalry' })])).toBe(2);
    expect(stackPace([unit('a', 'x', { classId: 'cavalry', promotions: ['forcedMarch'] })])).toBe(4);
    expect(stackPace([unit('a', 'x', { classId: 'siege' })])).toBe(1);
  });

  it('schedules two open provinces a turn for infantry and banks points for a mountain', () => {
    const s = fresh();
    expect(scheduleSteps(s, ['fr-75', 'fr-45', 'fr-18'], 2)).toEqual([1, 1, 2]);
    expect(scheduleSteps(s, ['fr-04'], 2)).toEqual([2]);
    expect(scheduleSteps(s, ['fr-04'], 1)).toEqual([4]);
  });
});

describe('planning a route', () => {
  it('finds a path through your own land and refuses foreign land at peace', () => {
    const s = fresh();
    const r = findRoute(s, 'fr-35', 'fr-04');
    expect(r.path[0]).toBe('fr-35');
    expect(r.path[r.path.length - 1]).toBe('fr-04');
    r.path.forEach((id, i) => { if (i) expect(REGIONS_DATA[r.path[i - 1]].neighbors).toContain(id); });
    expect(findRoute(s, 'fr-31', 'es-z').reason).toMatch(/No access to/);
  });

  it('enters enemy land at war and says where the march halts', () => {
    const s = withUnits(atWarWith(fresh(), 'es'), [unit('a', 'fr-31')]);
    const plan = planMarch(s, 'fr-31', 'es-z');
    expect(plan.ok).toBe(true);
    expect(plan.haltAt).toBe('es-z');
  });

  it('needs a fleet for an island', () => {
    const s = withUnits(fresh(), [unit('a', 'fr-35')]);
    expect(planMarch(s, 'fr-35', 'fr-2a').reason).toMatch(/fleet/);
  });
});

describe('marching', () => {
  const marchTo = (s, from, to) => gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: from, toRegionId: to } });

  it('walks the route over several End Turns, the stack together, and logs the arrival', () => {
    let s = withUnits(fresh(), [unit('a', 'fr-35'), unit('b', 'fr-35', { classId: 'cavalry' })]);
    s = marchTo(s, 'fr-35', 'fr-04');
    const plan = planMarch(s, 'fr-35', 'fr-04');
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
    expect(a.units.a.regionId).toBe('fr-04');
    expect(a.turnNumber - s.turnNumber).toBe(plan.turns);
    expect(b.units.a).toEqual(a.units.a);
    expect(a.logs.some((l) => /reached Alpes-de-Haute-Provence/.test(l.message))).toBe(true);
    // The mountain step costs strength (refilled later at home by reinforcement).
    const near = withUnits(fresh(), [unit('m', 'fr-31', { route: ['fr-04'], routePace: 2, routeBank: 2 })]);
    const units = { ...near.units };
    advanceMarches(near, units, {});
    expect(units.m.regionId).toBe('fr-04');
    expect(units.m.strength).toBe(970);
  });

  it('halts at an enemy border and marches on once the province is taken', () => {
    let s = withUnits(atWarWith(fresh(), 'es'), [unit('a', 'fr-31')]);
    s = marchTo(s, 'fr-31', 'es-z');
    const units = { ...s.units };
    advanceMarches(s, units, { year: s.year });
    expect(units.a.regionId).toBe('fr-31');
    expect(units.a.routeHalt).toBe('attack');
    expect(units.a.route).toEqual(['es-z']);
    // Winning the attack moves the army in: the route is then done.
    const won = { ...s, units: { ...units, a: { ...units.a, regionId: 'es-z' } } };
    const after = { ...won.units };
    advanceMarches(won, after, { year: s.year });
    expect(after.a.route).toBe(null);
  });

  it('stops when access is lost (the alliance ended)', () => {
    let s = withUnits(atWarWith(fresh(), 'es'), [unit('a', 'fr-31')]);
    s = marchTo(s, 'fr-31', 'es-z');
    const peace = { ...s, wars: s.wars.filter((w) => w.id !== 'w-test') };
    const units = { ...peace.units };
    const { logs } = advanceMarches(peace, units, { year: s.year });
    expect(units.a.route).toBe(null);
    expect(logs[0].message).toMatch(/no access/);
  });

  it('charges supplies and upkeep only for the units that marched this turn', () => {
    const s = withUnits(fresh(), [unit('a', 'fr-35', { marchedTurn: fresh().turnNumber }), unit('b', 'fr-35')]);
    const flow = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'fr', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber });
    expect(flow.marching).toBe(MARCH_SUPPLY_PER_UNIT);
    const idle = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'fr', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber + 1 });
    expect(idle.marching).toBe(0);
    expect(calcNationBalance(s, 'fr').expenses.marchingUpkeep).toBe(Math.round(UNIT_UPKEEP_GOLD_PER_TURN * ((s.nations.fr.armyMaintenance ?? 100) / 100) * 0.25));
  });

  it('a manual move replaces the march and costs no military power', () => {
    let s = withUnits(fresh(), [unit('a', 'fr-35')]);
    s = marchTo(s, 'fr-35', 'fr-04');
    const moved = gameReducer(s, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a', toRegionId: 'fr-75' } });
    expect(moved.units.a.regionId).toBe('fr-75');
    expect(moved.units.a.route).toBe(null);
    expect(moved.resources.mil).toBe(s.resources.mil);
    expect(moved.units.a.marchedTurn).toBe(s.turnNumber);
  });

  it('a route survives a save and load', () => {
    let s = withUnits(fresh(), [unit('a', 'fr-35')]);
    s = marchTo(s, 'fr-35', 'fr-04');
    const loaded = JSON.parse(JSON.stringify(s));
    const u1 = { ...s.units }; const u2 = { ...loaded.units };
    advanceMarches(s, u1, {}); advanceMarches(loaded, u2, {});
    expect(u2.a).toEqual(u1.a);
  });
});
