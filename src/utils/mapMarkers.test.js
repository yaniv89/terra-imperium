import { describe, it, expect } from 'vitest';
import { createInitialState } from '../engine/gameReducer';
import { getMapMarkers, shortMen, sizeBand } from './mapMarkers';
import { visibleTiles } from '../engine/sight';
import { getTiles } from '../data/geo/tiles';

const fresh = () => createInitialState({ playerNationId: 'fr', rngSeed: 5 });
const unit = (id, ownerId, regionId, extra = {}) => ({ id, ownerId, regionId, classId: 'infantry', domain: 'land', strength: 100, maxStrength: 100, morale: 80, movesLeft: 1, embarkedOn: null, ...extra });
const onlyUnits = (s, list) => ({ ...s, units: Object.fromEntries(list.map((u) => [u.id, u])) });

// A French province, a foreign province next to France, and one far from anything French.
const setup = () => {
  const s = fresh();
  const mine = Object.keys(s.regions).find((id) => s.regions[id].owner === 'fr');
  // Sight is by tile (sight.js): a foreign city whose centre France can see, and one it cannot.
  const sight = visibleTiles(s, 'fr');
  const border = Object.keys(s.regions).find((id) => s.regions[id].owner !== 'fr' && s.regions[id].owner && sight.has(s.regions[id].tile));
  const far = Object.keys(s.regions).find((id) => {
    const o = s.regions[id].owner;
    return o && o !== 'fr' && !sight.has(s.regions[id].tile) && !s.nations[o]?.hasMilitaryPact && s.nations[o]?.vassalOf !== 'fr';
  });
  return { s, mine, border, far, farOwner: s.regions[far].owner, borderOwner: s.regions[border].owner };
};

describe('map markers', () => {
  it('stacks own units per province with men, main class, morale and moves', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('a', 'fr', mine), unit('b', 'fr', mine, { strength: 50, morale: 60, movesLeft: 0 }), unit('c', 'fr', mine, { classId: 'cavalry', strength: 20 })]);
    const { armies } = getMapMarkers(st);
    expect(armies).toHaveLength(1);
    expect(armies[0]).toMatchObject({ regionId: mine, own: true, men: 1700, mainClass: 'infantry', canMove: true });
    expect(armies[0].units).toEqual(['a', 'b', 'c']);
    expect(armies[0].morale).toBe(73);
  });

  it('calls an army mixed when no class has 60% of it', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('a', 'fr', mine), unit('b', 'fr', mine, { classId: 'cavalry' })]);
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
    // A French scout two tiles from the far city sees the army there.
    const tiles = getTiles();
    const lookout = tiles.neighbors[tiles.neighbors[s.regions[far].tile].find((t) => tiles.land[t])].find((t) => tiles.land[t] && !s.world.tileOwner[t]);
    const scouted = onlyUnits(s, [unit('y', farOwner, far, { strength: 1500 }), unit('me', 'fr', 'c0', { regionId: Object.keys(s.regions).find((id) => s.regions[id].owner === 'fr'), tile: lookout })]);
    expect(getMapMarkers(scouted).armies.some((a) => a.regionId === far)).toBe(true);
    const intel = { ...st, intel: { [farOwner]: (s.turnNumber || 1) + 3 } };
    const seen = getMapMarkers(intel).armies.find((a) => a.regionId === far);
    expect(seen.band).toBe('medium');
  });

  it('puts fleets apart from armies and counts what they carry', () => {
    const { s, mine } = setup();
    const st = onlyUnits(s, [unit('f', 'fr', mine, { domain: 'naval', classId: 'galley' }), unit('l', 'fr', mine, { embarkedOn: 'f' })]);
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
    const st = { ...s, regions: { ...s.regions, [mine]: { ...s.regions[mine], colony: { ownerId: 'fr', progress: 40 } }, [far]: { ...s.regions[far], colony: { ownerId: farOwner, progress: 10 } } } };
    expect(getMapMarkers(st).colonies).toEqual([{ id: mine, regionId: mine, ownerId: 'fr', own: true, progress: 40 }]);
  });

  it('formats soldier counts and bands', () => {
    expect(shortMen(850)).toBe('850');
    expect(shortMen(1250)).toBe('1.3k');
    expect(shortMen(12000)).toBe('12k');
    expect(shortMen(2500000)).toBe('2.5M');
    expect([sizeBand(500), sizeBand(1000), sizeBand(3000)]).toEqual(['small', 'medium', 'large']);
  });
});
