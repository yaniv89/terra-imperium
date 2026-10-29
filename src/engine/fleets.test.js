// src/engine/fleets.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { REGIONS_DATA } from '../data/regions';
import { findSeaPath, portWaters, seaPassable, isBlockaded, atSea, NAVAL_MOVES_BY_AGE } from './fleets';
import { planMarch, advanceMarches, shorePlan } from './routes';
import { validateAmphibious } from './invasion';
import { normalizeUnitTiles } from './armies';
import { assertGameState } from './stateAudit';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ player: 'ahhiyawa', seed: 3 });
const FR_ID = PEOPLES_WORLD.playerNationId;
// The farthest rival with a coastal capital: the far shore across an ocean (Washington in the old fixture).
const coastalRivals = Object.keys(PEOPLES_WORLD.nations).filter((id) => id !== PEOPLES_WORLD.playerNationId && PEOPLES_WORLD.nations[id].kind !== 'independent' && REGIONS_DATA[PEOPLES_WORLD.nations[id].capitalRegionId]?.isCoastal);
const km = (id) => distanceKm(getTiles().centres[PEOPLES_WORLD.regions[PEOPLES_WORLD.nations[id].capitalRegionId].tile], getTiles().centres[PEOPLES_WORLD.regions[PEOPLES_WORLD.nations[PEOPLES_WORLD.playerNationId].capitalRegionId].tile]);
const US_ID = coastalRivals.sort((a, b) => km(b) - km(a))[0];
const CH_ID = rivalOf(PEOPLES_WORLD, 1);
const GB_ID = rivalOf(PEOPLES_WORLD, 2);

const tiles = getTiles();
const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const S = (() => { const s = quiet(neighbourWorld({ player: 'ahhiyawa', seed: 3, age: 'bronze' })); return { ...s, units: {} }; })();
const FR = getNationCapital(FR_ID);
const fleet = (id, regionId, extra = {}) => ({ id, ownerId: FR_ID, regionId, domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, transportCapacity: 2, embarkedOn: null, promotions: [], ...extra });
const army = (id, regionId, extra = {}) => ({ id, ownerId: FR_ID, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w-sea', aggressor: FR_ID, enemy, active: true, startYear: s.year }] });
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
    const r = findSeaPath(port.s, port.s.regions[port.id].tile, target, FR_ID);
    expect(r.path[0]).toBe(port.s.regions[port.id].tile);
    expect(r.path[r.path.length - 1]).toBe(target);
    r.path.slice(1).forEach((t, i) => { expect(tiles.land[t]).not.toBe(1); if (i) expect(tiles.neighbors[r.path[i]]).toContain(t); });
    // The Atlantic to Washington is closed before the Age of Gunpowder, open after.
    const US = getNationCapital(US_ID);
    const usWar = atWar(port.s, US_ID);
    expect(findSeaPath(usWar, port.s.regions[port.id].tile, port.s.regions[US].tile, FR_ID).reason).toMatch(/ocean|No sea route|Too far/);
    const modern = { ...usWar, age: 'modern', techAgeId: 'modern' };
    const far = findSeaPath(modern, port.s.regions[port.id].tile, port.s.regions[US].tile, FR_ID);
    expect(far.path?.[far.path.length - 1]).toBe(port.s.regions[US].tile);
    expect(findSeaPath(port.s, port.s.regions[port.id].tile, port.s.regions[getNationCapital(CH_ID)].tile, FR_ID).reason).toMatch(/city|route|access/);
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
    // End Turns: the order sails this turn's tiles at once (routes.js stepMarchesNow).
    expect(plan.turns).toBe(Math.ceil(plan.steps.length / NAVAL_MOVES_BY_AGE.bronze) - 1);
    s = gameReducer(s, { type: ActionTypes.SET_ROUTE, payload: { fromRegionId: port.id, toTile: target, naval: true } });
    expect(s.units.f.route ?? []).toEqual(plan.steps.slice(NAVAL_MOVES_BY_AGE.bronze));
    expect(s.units.f.tile).toBe(plan.steps[Math.min(NAVAL_MOVES_BY_AGE.bronze, plan.steps.length) - 1]);
    expect(s.units.a.tile).toBe(s.units.f.tile); // cargo rides along
    expect(s.units.a.route).toBeUndefined();
    for (let i = 0; i < plan.turns + 1 && s.units.f.route?.length; i++) { s = resolveTurn(s); if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; }
    expect(s.units.f.tile).toBe(target);
    expect(atSea(s, s.units.f)).toBe(true);
    expect(s.units.a.tile).toBe(target); // cargo rides along
    expect(s.units.a.regionId).toBe(s.units.f.regionId);
    assertGameState(s);
    // A fleet out at sea still names its port: an army in that port cannot board it from there.
    const ashore = withUnits(s, [army('b', port.id, { tile: S.regions[port.id].tile })]);
    expect(gameReducer(ashore, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'b', navalUnitId: 'f' } }).units.b.embarkedOn).toBeNull();
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

  it('puts in at its own port from any of the port\'s waters, even one not beside the city centre', () => {
    const centre = S.regions[port.id].tile;
    const far = portWaters(S, tiles, port.id).find((t) => !tiles.neighbors[t].includes(centre));
    if (far == null) return; // this port's waters all touch its centre
    const s = withUnits(S, [fleet('f', port.id, { tile: far })]);
    const units = { ...s.units, f: { ...s.units.f, route: [centre], routePace: 5 } };
    advanceMarches(s, units, {});
    expect(units.f.tile).toBe(centre);
    expect(atSea(s, units.f)).toBe(false);
  });

  it('halts outside an enemy port and lands by assault from beside its coast', () => {
    const s0 = atWar(withUnits(S, [fleet('f', port.id), army('a', port.id, { embarkedOn: 'f' })]), GB_ID);
    const s = normalizeUnitTiles(s0);
    // The nearest British coastal city a Dawn fleet can reach, if any; else the test only checks the gate.
    const british = Object.values(s.regions).filter((c) => c.owner === GB_ID && portWaters(s, tiles, c.id).length);
    const reach = british.map((c) => ({ c, r: findSeaPath(s, s.regions[port.id].tile, c.tile, FR_ID) })).find((x) => x.r.path);
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

describe('sea depths (plan D5b)', () => {
  it('classes every water tile as lake, coast, shelf or deep, and opens them by age or tech', async () => {
    const { seaDepth, shelfOk, deepOk } = await import('./fleets');
    const tiles = getTiles();
    const counts = { lake: 0, coast: 0, shelf: 0, deep: 0 };
    for (let i = 0; i < tiles.neighbors.length; i++) { const d = seaDepth(tiles, i); if (d) counts[d]++; else expect(tiles.land[i]).toBe(1); }
    expect(counts.coast).toBeGreaterThan(2000);
    expect(counts.shelf).toBeGreaterThan(1000);
    expect(counts.deep).toBeGreaterThan(counts.shelf * 5);
    const shelf = [...Array(tiles.neighbors.length).keys()].find((i) => seaDepth(tiles, i) === 'shelf');
    const deep = [...Array(tiles.neighbors.length).keys()].find((i) => seaDepth(tiles, i) === 'deep');
    expect(tiles.neighbors[shelf].some((n) => seaDepth(tiles, n) === 'coast')).toBe(true);
    expect(tiles.neighbors[deep].every((n) => seaDepth(tiles, n) !== 'coast')).toBe(true);
    expect(seaPassable(tiles, shelf, 'bronze')).toBe(false);
    expect(seaPassable(tiles, shelf, 'bronze', false, true)).toBe(true); // a sailing tech
    expect(seaPassable(tiles, shelf, 'classical')).toBe(true);
    expect(seaPassable(tiles, deep, 'classical')).toBe(false);
    expect(seaPassable(tiles, deep, 'classical', true)).toBe(true); // a tech that opens the ocean
    expect(seaPassable(tiles, deep, 'gunpowder')).toBe(true);
    expect(shelfOk('bronze')).toBe(false); expect(shelfOk('classical')).toBe(true); expect(deepOk('kingdoms')).toBe(false);
  });
});

describe('sailing to a shore (manual playtest 29 Oct: "A fleet can only put in at a city")', () => {
  // A sea tile off the port with a free shore beside it, and a free shore farther out.
  const waters = portWaters(port.s, tiles, port.id).filter((t) => seaPassable(tiles, t, 'bronze'));
  const free = (t) => tiles.land[t] === 1 && port.s.world.tileOwner[t] == null;
  const sea = waters.find((t) => tiles.neighbors[t].some(free));
  const shore = tiles.neighbors[sea].find(free);
  it('from port: sails to the water beside the shore, the landing to follow', () => {
    const s = withUnits(port.s, [fleet('f1', port.id, { tile: S.regions[port.id].tile })]);
    const p = shorePlan(s, port.id, shore, ['f1']);
    expect(p).toMatchObject({ ok: true, shoreOf: shore });
    expect(tiles.neighbors[shore]).toContain(p.approachTile);
    expect(tiles.land[p.approachTile]).not.toBe(1);
  });
  it('beside the shore: lands the troops aboard, or says there are none', () => {
    const s = withUnits(port.s, [fleet('f1', port.id, { tile: sea }), army('a1', port.id, { tile: sea, embarkedOn: 'f1' })]);
    expect(shorePlan(s, port.id, shore, ['f1'])).toMatchObject({ shoreOf: shore, landHere: ['a1'] });
    const landed = gameReducer(s, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: 'a1', tile: shore } });
    expect(landed.units.a1).toMatchObject({ embarkedOn: null, tile: shore });
    const empty = withUnits(port.s, [fleet('f1', port.id, { tile: sea })]);
    expect(shorePlan(empty, port.id, shore, ['f1'])).toMatchObject({ landHere: [], reasonMsg: { key: 'm.why.noneAboard' } });
  });
  it('a sea tile is no shore', () => {
    expect(shorePlan(port.s, port.id, sea)).toBeNull();
  });
});
