// ECON-02: the Military tab's supply summary reads the turn's own selectors, so what it says
// (campaigning, home, consumption, how fast the meters fall) is what the next turn does.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { armySupplySummary, supplyOf } from './supplyMeter';
import { computeSupplyFlow } from './supplies';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { tileAccess } from './armies';

const tiles = getTiles();
const base = { ...createInitialState({ playerNationId: 'in', rngSeed: 3 }), units: {} };
const quiet = { ...base, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } };
const P = getNationCapital('in');
const home = quiet.regions[P].tile;
const unit = (id, extra = {}) => ({ id, ownerId: 'in', regionId: P, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
// A free tile some steps out, in the wild.
const wildTile = (() => {
  let ring = [home]; const seen = new Set(ring);
  for (let d = 0; d < 20; d++) {
    const next = [];
    for (const t of ring) for (const n of tiles.neighbors[t]) if (!seen.has(n) && tiles.land[n] === 1) { seen.add(n); next.push(n); }
    const hit = next.find((t) => tileAccess(quiet, t, 'in') === 'wild');
    if (hit != null) return hit;
    ring = next;
  }
  return null;
})();

describe('army supply summary', () => {
  it('counts regiments abroad as campaigning, even though their region record still says home', () => {
    expect(tileAccess(quiet, wildTile, 'in')).toBe('wild');
    const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => unit(id, { tile: wildTile, supply: 60 }));
    const s = { ...quiet, units: { ...Object.fromEntries(list.map((u) => [u.id, u])), g: unit('g', { tile: home }) } };
    const sum = armySupplySummary(s);
    expect(sum.campaigning).toBe(6);
    expect(sum.home).toBe(1);
    expect(sum.draining).toBe(6);
    expect(sum.drain).toBeGreaterThan(0);
    // The national stock pays what the turn's own flow says.
    const flow = computeSupplyFlow({ regions: s.regions, units: s.units, nationId: 'in', ageId: 'bronze', resources: s.resources, turnNumber: s.turnNumber, tileOwner: s.world.tileOwner });
    expect(sum.consumed).toBe(flow.consumed);
    expect(sum.consumed).toBeGreaterThanOrEqual(6);
    // And the meters fall by what it says.
    const next = resolveTurn(s);
    const fell = ['a', 'b', 'c', 'd', 'e', 'f'].reduce((t, id) => t + (supplyOf(s.units[id]) - supplyOf(next.units[id])), 0);
    expect(fell).toBe(sum.drain);
    expect(armySupplySummary(next).campaigning).toBe(6);
  });

  it('says nothing is abroad when every army is home', () => {
    const s = { ...quiet, units: { g: unit('g', { tile: home }), h: unit('h', { tile: home }) } };
    const sum = armySupplySummary(s);
    expect(sum).toMatchObject({ campaigning: 0, home: 2, draining: 0, drain: 0 });
  });
});
