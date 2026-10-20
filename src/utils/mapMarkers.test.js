import { describe, it, expect } from 'vitest';
import { getMapMarkers, shortMen, sizeBand } from './mapMarkers';
import { visibleTiles } from '../engine/sight';
import { getTiles } from '../data/geo/tiles';
import { peoplesWorld, rivalOf, addCity } from '../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 5 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

// A rival city is founded beside the player's capital: the world starts with every people far apart.
const fresh = () => addCity(WORLD, DE, { near: WORLD.nations[FR].capitalRegionId }).state;
const unit = (id, ownerId, regionId, extra = {}) => ({ id, ownerId, regionId, classId: 'infantry', domain: 'land', strength: 100, maxStrength: 100, morale: 80, movesLeft: 1, embarkedOn: null, ...extra });
const onlyUnits = (s, list) => ({ ...s, units: Object.fromEntries(list.map((u) => [u.id, u])) });

// A French province, a foreign province next to France, and one far from anything French.
const setup = () => {
  const s = fresh();
  const mine = Object.keys(s.regions).find((id) => s.regions[id].owner === FR);
  // Sight is by tile (sight.js): a foreign city whose centre France can see, and one it cannot.
  const sight = visibleTiles(s, FR);
  const border = Object.keys(s.regions).find((id) => s.regions[id].owner !== FR && s.regions[id].owner && sight.has(s.regions[id].tile));
  const far = Object.keys(s.regions).find((id) => {
    const o = s.regions[id].owner;
    return o && o !== FR && !sight.has(s.regions[id].tile) && !s.nations[o]?.hasMilitaryPact && s.nations[o]?.vassalOf !== FR;
  });
  return { s, mine, border, far, farOwner: s.regions[far].owner, borderOwner: s.regions[border].owner };
};

describe('map markers', () => {
  it('stacks own units per province with men, main class, morale and moves', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('a', FR, mine), unit('b', FR, mine, { strength: 50, morale: 60, movesLeft: 0 }), unit('c', FR, mine, { classId: 'cavalry', strength: 20 })]);
    const { armies } = getMapMarkers(st);
    expect(armies).toHaveLength(1);
    expect(armies[0]).toMatchObject({ regionId: mine, own: true, men: 1700, mainClass: 'infantry', canMove: true });
    expect(armies[0].units).toEqual(['a', 'b', 'c']);
    expect(armies[0].morale).toBe(73);
  });

  it('calls an army mixed when no class has 60% of it', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('a', FR, mine), unit('b', FR, mine, { classId: 'cavalry' })]);
    expect(getMapMarkers(st).armies[0].mainClass).toBe('mixed');
  });

  it('shows foreign armies at the border without numbers and hides far ones in fog', () => {
    const { s, border, far, borderOwner } = setup();
    const st = onlyUnits(s, [unit('x', borderOwner, border), unit('y', s.regions[far].owner, far)]);
    const { armies } = getMapMarkers(st);
    expect(armies.map((a) => a.regionId)).toEqual([border]);
    expect(armies[0].men).toBeUndefined();
    expect(armies[0].band).toBe(null);
  });

  it('sees past the fog next to an own army, and gives a size band with intel', () => {
    const { s, far, farOwner } = setup();
    const st = onlyUnits(s, [unit('y', farOwner, far, { strength: 1500 })]);
    expect(getMapMarkers(st).armies).toHaveLength(0);
    // A scout beside the far city sees the army there.
    const tiles = getTiles();
    const lookout = tiles.neighbors[s.regions[far].tile].find((t) => tiles.land[t]); // a land tile beside the far city
    const scouted = onlyUnits(s, [unit('y', farOwner, far, { strength: 1500 }), unit('me', FR, 'c0', { regionId: Object.keys(s.regions).find((id) => s.regions[id].owner === FR), tile: lookout })]);
    expect(getMapMarkers(scouted).armies.some((a) => a.regionId === far)).toBe(true);
    const intel = { ...st, intel: { [farOwner]: (s.turnNumber || 1) + 3 } };
    const seen = getMapMarkers(intel).armies.find((a) => a.regionId === far);
    expect(seen.band).toBe('medium');
  });

  it('puts fleets apart from armies and counts what they carry', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('f', FR, mine, { domain: 'naval', classId: 'galley' }), unit('l', FR, mine, { embarkedOn: 'f' })]);
    const { armies, fleets } = getMapMarkers(st);
    expect(armies).toHaveLength(0);
    expect(fleets[0]).toMatchObject({ domain: 'naval', embarked: 1 });
  });

  it('lists battles from this turn and the last', () => {
    const { s, border } = setup();
    const t = s.turnNumber || 1;
    const st = { ...s, battleReports: [
      { id: 'battle-2', turn: t, targetRegionId: border, outcome: 'attacker', playerSide: 'attacker' },
      { id: 'battle-1', turn: t - 5, targetRegionId: border, outcome: 'defender', playerSide: 'attacker' }
    ] };
    expect(getMapMarkers(st).battles).toEqual([{ id: 'battle-2', regionId: border, outcome: 'attacker', playerSide: 'attacker', won: true }]);
  });

  it('shows your colonies with their progress, and hides far foreign ones', () => {
    const { s, mine, far, farOwner } = setup();
    const st = { ...s, regions: { ...s.regions, [mine]: { ...s.regions[mine], colony: { ownerId: FR, progress: 40 } }, [far]: { ...s.regions[far], colony: { ownerId: farOwner, progress: 10 } } } };
    expect(getMapMarkers(st).colonies).toEqual([{ id: mine, regionId: mine, ownerId: FR, own: true, progress: 40 }]);
  });

  it('formats soldier counts and bands', () => {
    expect(shortMen(850)).toBe('850');
    expect(shortMen(1250)).toBe('1.3k');
    expect(shortMen(12000)).toBe('12k');
    expect(shortMen(2500000)).toBe('2.5M');
    expect([sizeBand(500), sizeBand(1000), sizeBand(3000)]).toEqual(['small', 'medium', 'large']);
  });
  it('wonders show on their tile: yours always, a foreign one only in sight or with intel', () => {
    const s = fresh();
    const paris = Object.values(s.regions).find((r) => r.owner === FR);
    const berlin = Object.values(s.regions).find((r) => r.owner === DE);
    const tiles = getTiles();
    const mineTile = paris.tiles.find((t) => t !== paris.tile && tiles.land[t] === 1);
    const theirTile = berlin.tiles.find((t) => t !== berlin.tile && tiles.land[t] === 1);
    const st = { ...s, greatProjects: { great_wall: { regionId: paris.id, tier: 2, tile: mineTile }, great_pyramids: { regionId: berlin.id, tier: 1, tile: theirTile }, hanging_gardens: { regionId: berlin.id, tier: 1, tile: null } } };
    const w = getMapMarkers(st).wonders;
    expect(w.find((x) => x.id === 'great_wall')).toMatchObject({ own: true, tier: 2, tile: mineTile, regionId: paris.id, name: 'The Great Wall' });
    expect(w.some((x) => x.id === 'hanging_gardens')).toBe(false); // no tile yet: nothing to draw
    const seen = visibleTiles(st, FR).has(theirTile);
    expect(w.some((x) => x.id === 'great_pyramids')).toBe(seen);
  });
  it('the open event marks its city while the sheet is up', () => {
    const s = fresh();
    const paris = Object.values(s.regions).find((r) => r.owner === FR);
    expect(getMapMarkers(s).events).toEqual([]);
    const ev = { ...s, activeProceduralEvent: { id: 'flood-1', title: 'The river floods', cityId: paris.id, options: [] } };
    expect(getMapMarkers(ev).events).toEqual([{ id: 'event:flood-1', regionId: paris.id, ownerId: FR, own: true, tile: paris.tile, title: 'The river floods' }]);
  });

  // Civilization: ONE flag and ONE model per tile, whatever the units' home cities
  it('makes one marker per tile, owner and domain, whichever cities the units belong to', () => {
    const { s, mine } = setup();
    const other = Object.keys(s.regions).find((id) => id !== mine && s.regions[id].owner === FR) || mine;
    const tile = getTiles().neighbors[s.regions[mine].tile].find((t) => getTiles().land[t] === 1);
    const st = onlyUnits(s, [unit('a', FR, mine, { tile }), unit('b', FR, other, { tile, classId: 'cavalry', strength: 300 })]);
    const { armies } = getMapMarkers(st);
    expect(armies).toHaveLength(1);
    expect(armies[0].units.sort()).toEqual(['a', 'b']);
    expect(armies[0].count).toBe(2);
  });

  it('shows the strongest soldier, else the selected one, and counts settlers in the flag', () => {
    const { s, mine } = setup();
    const tile = getTiles().neighbors[s.regions[mine].tile].find((t) => getTiles().land[t] === 1);
    const st = onlyUnits(s, [unit('a', FR, mine, { tile, strength: 50 }), unit('b', FR, mine, { tile, classId: 'cavalry', strength: 300 }), unit('s', FR, mine, { tile, classId: 'settler', strength: 900 })]);
    const [m] = getMapMarkers(st).armies;
    expect(m.topClass).toBe('cavalry'); expect(m.top).toBe('b');
    expect(m.civilians).toBe(1); expect(m.count).toBe(3);
    expect(m.stack).toEqual(['b', 'a']);
    const picked = getMapMarkers(st, { selected: { tile, unitId: 'a' } }).armies[0];
    expect(picked.top).toBe('a'); expect(picked.topClass).toBe('infantry');
    // a selection on another tile changes nothing
    expect(getMapMarkers(st, { selected: { tile: tile + 1, unitId: 'a' } }).armies[0].top).toBe('b');
  });

  it('marks a stack standing on a city tile', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('a', FR, mine)]);
    expect(getMapMarkers(st).armies[0].inCity).toBe(true);
    const tile = getTiles().neighbors[s.regions[mine].tile].find((t) => getTiles().land[t] === 1);
    expect(getMapMarkers(onlyUnits(s, [unit('a', FR, mine, { tile })])).armies[0].inCity).toBe(false);
  });
});
