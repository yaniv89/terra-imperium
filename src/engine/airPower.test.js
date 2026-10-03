import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { AIR_RANGE, airBaseTile, airUnitsInRange, withAirSupport, airRanges } from './airPower';
import { validateFieldAttack } from './fieldBattle';
import { getDefenseArmies } from './defense';
import { ringsAround } from './world/cities';

const tiles = getTiles();
const S = (() => { const s = createInitialState({ playerNationId: 'in', rngSeed: 3 }); return { ...s, units: {}, resources: { ...s.resources, mil: 100, gold: 1000 } }; })();
const IN = getNationCapital('in'); const PK = getNationCapital('pk');
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], xp: 0, ...extra });
const withUnits = (s, list) => ({ ...s, units: { ...s.units, ...Object.fromEntries(list.map((u) => [u.id, u])) } });
const atWar = (s) => ({ ...s, wars: [...s.wars, { id: 'w-f', aggressor: 'in', enemy: 'pk', active: true, startYear: s.year, battleScore: 0 }], nations: { ...s.nations, in: { ...s.nations.in, isAtWar: true }, pk: { ...s.nations.pk, isAtWar: true } } });
const pair = (() => {
  const seen = new Set([S.regions[IN].tile]); let f = [S.regions[IN].tile];
  for (let d = 0; d < 8; d++) {
    const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); f = n.sort((a, b) => a - b);
    for (const t of f) { if (tiles.land[t] !== 1 || S.world.tileOwner[t]) continue; const o = tiles.neighbors[t].find((x) => tiles.land[x] === 1 && !S.world.tileOwner[x] && x !== t); if (o != null) return [t, o]; }
  }
  throw new Error('no free pair');
})();
const [ours, theirs] = pair;
const delhi = S.regions[IN].tile;

describe('air power (plan D5b)', () => {
  it('an aircraft flies from its own city or a carrier, never from open ground or a foreign city', () => {
    const atHome = withUnits(S, [unit('j', IN, { classId: 'air', tile: delhi })]);
    expect(airBaseTile(atHome, atHome.units.j)).toBe(delhi);
    const inField = withUnits(S, [unit('j', IN, { classId: 'air', tile: ours })]);
    expect(airBaseTile(inField, inField.units.j)).toBeNull();
    const abroad = withUnits(S, [unit('j', PK, { classId: 'air', tile: S.regions[PK].tile })]);
    expect(airBaseTile(abroad, abroad.units.j)).toBeNull();
    const sea = [...Array(tiles.neighbors.length).keys()].find((i) => tiles.land[i] !== 1 && tiles.terrainOf(i) === 'coast'); // any sea tile: a carrier's deck is its base
    const carrier = unit('c', IN, { domain: 'naval', classId: 'naval', navalLine: 'carrier', tile: sea, transportCapacity: 0 });
    const aboard = withUnits(S, [carrier, unit('j', IN, { classId: 'air', tile: sea, embarkedOn: 'c' })]);
    expect(airBaseTile(aboard, aboard.units.j)).toBe(sea);
    const onCog = withUnits(S, [{ ...carrier, navalLine: 'warship' }, unit('j', IN, { classId: 'air', tile: sea, embarkedOn: 'c' })]);
    expect(airBaseTile(onCog, onCog.units.j)).toBeNull();
    expect(airBaseTile(S, unit('i', IN, { tile: delhi }))).toBeNull();
  });

  it('reaches AIR_RANGE rings from the base, no further, and the rings memo keeps the two apart', () => {
    const s = withUnits(S, [unit('j', IN, { classId: 'air', tile: delhi })]);
    const rings = ringsAround(tiles, delhi, AIR_RANGE);
    const edge = [...rings].find(([, d]) => d === AIR_RANGE)[0];
    const beyond = tiles.neighbors[edge].find((n) => !rings.has(n));
    expect(airUnitsInRange(s, 'in', edge).map((u) => u.id)).toEqual(['j']);
    expect(airUnitsInRange(s, 'in', beyond)).toEqual([]);
    expect(airUnitsInRange(s, 'pk', edge)).toEqual([]);
    expect(withAirSupport(s, 'in', edge, [s.units.j])).toEqual([s.units.j]);
    expect(ringsAround(tiles, delhi + 1, 0).size).toBe(1);
    expect(airRanges(s)).toEqual([{ tile: delhi, nationId: 'in', own: true, count: 1, edgeTile: edge }]);
  });

  it('joins a field battle and a defence on its nation\'s side, and boards only a carrier, two at most', () => {
    const war = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs }), unit('j', IN, { classId: 'air', tile: delhi }), unit('k', PK, { ownerId: 'pk', classId: 'air', tile: S.regions[PK].tile })]));
    const v = validateFieldAttack(war, IN, theirs);
    expect(v.ok, v.reason).toBe(true);
    expect(v.attackerUnits.map((u) => u.id)).toEqual(['a', 'j']);
    const pkReach = ringsAround(tiles, S.regions[PK].tile, AIR_RANGE).has(theirs);
    expect(v.defenderUnits.map((u) => u.id)).toEqual(pkReach ? ['e', 'k'] : ['e']);
    const def = { id: 'd1', regionId: IN, aggressorId: 'pk', attackerUnitIds: ['e'], defenderUnitIds: ['a'], synthetic: [] };
    const home = { ...war, units: { ...war.units, a: { ...war.units.a, tile: delhi } } };
    const armies = getDefenseArmies(home, def);
    expect(armies.defenderUnits.map((u) => u.id)).toEqual(['a', 'j']);
    expect(armies.attackerUnits.map((u) => u.id)).toEqual(ringsAround(tiles, S.regions[PK].tile, AIR_RANGE).has(delhi) ? ['e', 'k'] : ['e']);
    // Embarking: a carrier takes two aircraft and no troops; a cog takes troops, no aircraft.
    const carrier = unit('c', IN, { domain: 'naval', classId: 'naval', navalLine: 'carrier', tile: delhi, transportCapacity: 0 });
    const port = withUnits(S, [carrier, unit('j1', IN, { classId: 'air', tile: delhi }), unit('j2', IN, { classId: 'air', tile: delhi }), unit('j3', IN, { classId: 'air', tile: delhi }), unit('i', IN, { tile: delhi })]);
    let s = gameReducer(port, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'j1', navalUnitId: 'c' } });
    s = gameReducer(s, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'j2', navalUnitId: 'c' } });
    expect(s.units.j1.embarkedOn).toBe('c'); expect(s.units.j2.embarkedOn).toBe('c');
    expect(gameReducer(s, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'j3', navalUnitId: 'c' } })).toBe(s);
    expect(gameReducer(s, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'i', navalUnitId: 'c' } })).toBe(s);
    const cog = withUnits(S, [{ ...carrier, navalLine: 'warship', transportCapacity: 1 }, unit('j1', IN, { classId: 'air', tile: delhi }), unit('i', IN, { tile: delhi })]);
    expect(gameReducer(cog, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'j1', navalUnitId: 'c' } })).toBe(cog);
    expect(gameReducer(cog, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: 'i', navalUnitId: 'c' } }).units.i.embarkedOn).toBe('c');
  });
});

describe('air defence (plan D5b)', () => {
  it('anti-air on the tile and patrols near it turn back a share of the joining aircraft', async () => {
    const { turnedBackShare, interceptorsAt, ANTI_AIR_SHARE, PATROL_SHARE, MAX_TURNED_BACK, AIR_PATROL_RINGS } = await import('./airPower');
    const jets = [1, 2, 3, 4, 5].map((i) => unit(`j${i}`, IN, { classId: 'air', tile: delhi }));
    const base = atWar(withUnits(S, [unit('a', IN, { tile: ours }), unit('e', PK, { ownerId: 'pk', tile: theirs }), ...jets]));
    expect(validateFieldAttack(base, IN, theirs).attackerUnits.map((u) => u.id)).toEqual(['a', 'j1', 'j2', 'j3', 'j4', 'j5']);
    const flak = withUnits(base, [unit('f1', PK, { ownerId: 'pk', classId: 'support', tile: theirs }), unit('f2', PK, { ownerId: 'pk', classId: 'support', tile: theirs })]);
    expect(turnedBackShare(flak, 'pk', theirs, [flak.units.e, flak.units.f1, flak.units.f2])).toBeCloseTo(2 * ANTI_AIR_SHARE);
    expect(validateFieldAttack(flak, IN, theirs).attackerUnits.map((u) => u.id)).toEqual(['a', 'j1', 'j2', 'j3']); // 5 x 0.4 = 2 turned back
    // A Pakistani patrol within reach of the tile turns back more; off patrol it does nothing.
    const pkBase = S.regions[PK].tile;
    const near = ringsAround(tiles, theirs, AIR_PATROL_RINGS).has(pkBase);
    const patrol = withUnits(flak, [unit('p1', PK, { ownerId: 'pk', classId: 'air', tile: pkBase, patrol: true })]);
    expect(interceptorsAt(patrol, 'pk', theirs).length).toBe(near ? 1 : 0);
    expect(turnedBackShare(patrol, 'pk', theirs, [patrol.units.e, patrol.units.f1, patrol.units.f2])).toBeCloseTo(Math.min(MAX_TURNED_BACK, 2 * ANTI_AIR_SHARE + (near ? PATROL_SHARE : 0)));
    const idle = { ...patrol, units: { ...patrol.units, p1: { ...patrol.units.p1, patrol: false } } };
    expect(interceptorsAt(idle, 'pk', theirs)).toEqual([]);
    // The patrol order is the player's, for aircraft only.
    const ordered = gameReducer(base, { type: ActionTypes.SET_AIR_PATROL, payload: { unitIds: ['j1', 'a'] } });
    expect(ordered.units.j1.patrol).toBe(true); expect(ordered.units.a.patrol).toBeUndefined();
    expect(gameReducer(ordered, { type: ActionTypes.SET_AIR_PATROL, payload: { unitIds: ['j1'], patrol: false } }).units.j1.patrol).toBe(false);
  });
});
