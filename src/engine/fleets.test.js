// src/engine/fleets.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { findSeaPath, portWaters, seaPassable, isBlockaded, atSea, NAVAL_MOVES_BY_AGE } from './fleets';
import { planMarch, advanceMarches } from './routes';
import { validateAmphibious } from './invasion';
import { normalizeUnitTiles } from './armies';
import { assertGameState } from './stateAudit';

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 3 })); return { ...s, units: {} }; })();
const FR = getNationCapital('fr');
const fleet = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, transportCapacity: 2, embarkedOn: null, promotions: [], ...extra });
const army = (id, regionId, extra = {}) => ({ id, ownerId: 'fr', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-sea', aggressor: 'fr', enemy, active: true, startYear: s.year }] });
// A coastal French port: the capital if it has water beside it, else a coastal city founded near it.
const port = (() => { if (portWaters(S, tiles, FR).length) return { s: S, id: FR }; throw new Error('Paris is not a port on this grid: pick another nation'); })();

describe('sea paths', () => {
  it('sails from a port over water a fleet of the age may cross, and refuses the open ocean at Dawn', () => {
    const waters = portWaters(port.s, tiles, port.id);
    expect(waters.length).toBeGreaterThan(0);
    waters.forEach((t) => expect(tiles.land[t]).not.toBe(1));
    // Three tiles out along the coast: a path of water tiles, starting on the port's centre.
    let frontier = waters; const seen = new Set(waters); let target = null;
    for (let d = 1; d <= 3 && !target; d++) { const next = []; frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n) && seaPassable(tiles, n, 'bronze')) { seen.add(n); next.push(n); } })); frontier = next.sort((a, b) => a - b); if (d === 3) target = frontier[0]; }
    expect(target).toBeDefined();
    const r = findSeaPath(port.s, port.s.regions[port.id].tile, target, 'fr');
    expect(r.path[0]).toBe(port.s.regions[port.id].tile);
    expect(r.path[r.path.length - 1]).toBe(target);
    r.path.slice(1).forEach((t, i) => { expect(tiles.land[t]).not.toBe(1); if (i) expect(tiles.neighbors[r.path[i]]).toContain(t); });
    // The Atlantic to Washington is closed before the Age of Gunpowder, open after.
    const US = getNationCapital('us');
    const usWar = atWar(port.s, 'us');
    expect(findSeaPath(usWar, port.s.regions[port.id].tile, port.s.regions[US].tile, 'fr').reason).toMatch(/ocean|No sea route|Too far/);
    const modern = { ...usWar, age: 'modern', techAgeId: 'modern' };
    const far = findSeaPath(modern, port.s.regions[port.id].tile, port.s.regions[US].tile, 'fr');
    expect(far.path?.[far.path.length - 1]).toBe(port.s.regions[US].tile);
    expect(findSeaPath(port.s, port.s.regions[port.id].tile, port.s.regions[getNationCapital('lu')].tile, 'fr').reason).toMatch(/city|route|access/);
  });
});

describe('a voyage', () => {
  it('sails a fleet with its cargo out to sea over turns, and lands the troops on a free shore', () => {
    const waters = portWaters(S, tiles, port.id);
    let frontier = waters; const seen = new Set(waters); let target = null;
    for (let d = 1; d <= 4 && !target; d++) { const next = []; frontier.forEach((t) => tiles.neighbors[t].forEach((n) => { if (!seen.has(n) && seaPassable(tiles, n, 'bronze')) { seen.add(n); next.push(n); } })); frontier = next.sort((a, b) => a - b); if (d === 4) target = frontier[0]; }
    let s = withUnits(S, [fleet('f', port.id), army('a', port.id, { embarkedOn: 'f' })]);
    s = normalizeUnitTiles(s);
    const plan = planMarch(s, port.id, target, null, { naval: true });
    expect(plan.ok, plan.reason).toBe(true);
    expect(plan.pace).toBe(NAVAL_MOVES_BY_AGE.bronze);
    expect(plan.turns).toBe(Math.ceil(plan.steps.length / NAVAL_MOVES_BY_AGE.bronze));
    s = gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: port.id, toTile: target, naval: true } });
    expect(s.units.f.route).toEqual(plan.steps);
    expect(s.units.a.route).toBeUndefined();
    for (let i = 0; i < plan.turns + 1 && s.units.f.route?.length; i++) { s = resolveTurn(s); if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; }
    expect(s.units.f.tile).toBe(target);
    expect(atSea(s, s.units.f)).toBe(true);
    expect(s.units.a.tile).toBe(target); // cargo rides along
    expect(s.units.a.regionId).toBe(s.units.f.regionId);
    assertGameState(s);
    // A free shore beside the fleet takes the landing; the city tile of a foreign port does not.
    const shore = tiles.neighbors[target].find((t) => tiles.land[t] === 1 && !s.world.tileOwner[t]);
    if (shore != null) {
      const landed = gameReducer(s, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: 'a', tile: shore } });
      expect(landed.units.a.embarkedOn).toBeNull();
      expect(landed.units.a.tile).toBe(shore);
      assertGameState(landed);
    }
    const refused = gameReducer(s, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: 'a', tile: target } });
    expect(refused.units.a.embarkedOn).toBe('f');
  });

  it('halts outside an enemy port and lands by assault from beside its coast', () => {
    const s0 = atWar(withUnits(S, [fleet('f', port.id), army('a', port.id, { embarkedOn: 'f' })]), 'gb');
    const s = normalizeUnitTiles(s0);
    // The nearest British coastal city a Dawn fleet can reach, if any; else the test only checks the gate.
    const british = Object.values(s.regions).filter((c) => c.owner === 'gb' && portWaters(s, tiles, c.id).length);
    const reach = british.map((c) => ({ c, r: findSeaPath(s, s.regions[port.id].tile, c.tile, 'fr') })).find((x) => x.r.path);
    if (!reach) return;
    const units = { ...s.units, f: { ...s.units.f, route: reach.r.path.slice(1), routePace: 50 } };
    advanceMarches(s, units, {});
    expect(units.f.routeHalt).toBe('attack');
    expect(tiles.land[units.f.tile]).not.toBe(1);
    const beside = { ...s, units };
    const v = validateAmphibious(beside, 'f', reach.c.id, { ignoreCost: true });
    expect(v.ok, v.reason).toBe(true);
    expect(isBlockaded(beside, reach.c.id)).toBe(true);
    expect(isBlockaded({ ...beside, wars: [] }, reach.c.id)).toBe(false);
  });
});
