// The land-change save repair (world/landChanges.js, plans/math/straits.md): when a rebuild that
// keeps tile ids turns land into water (a strait opens) or water into land, a save's cities,
// roads and units on those tiles are moved or cleared. Version 9 used it; version 10 (the
// frequency-100 grid) is a clean break, so the test builds its own change list on the shipped
// grid: a coast tile beside the Finnish capital plays a tile that "became water".
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../gameReducer';
import { applyLandChanges } from './landChanges';
import { getTiles } from '../../data/geo/tiles';
import { auditGameState } from '../stateAudit';

const tiles = getTiles();
const fresh = createInitialState({ playerNationId: 'fi', rngSeed: 21 });
const [cityId, city] = Object.entries(fresh.regions).find(([, r]) => r.owner === 'fi' && r.isCapital);
// a sea tile next to the capital's land (the old centre) and a land tile of its own (where an old
// save's fleet sat)
const OLD_CENTRE = city.tiles.flatMap((t) => tiles.neighbors[t]).find((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) === 'coast');
const NOW_LAND = city.tiles.find((t) => t !== city.tile && tiles.land[t] === 1);
const CHANGES = { toWater: [OLD_CENTRE], toLand: [NOW_LAND] };

// An old save: the capital centred on OLD_CENTRE with a road there, an army on it and a fleet on
// NOW_LAND.
const oldSave = () => {
  const tileOwner = { ...fresh.world.tileOwner, [OLD_CENTRE]: cityId };
  const units = { ...fresh.units };
  const fiUnits = Object.values(units).filter((u) => u.ownerId === 'fi');
  const army = fiUnits.find((u) => u.domain !== 'naval');
  if (army) units[army.id] = { ...army, tile: OLD_CENTRE };
  units.fleet_test = { ...(army || fiUnits[0]), id: 'fleet_test', domain: 'naval', classId: army?.classId, tile: NOW_LAND, regionId: cityId };
  return {
    ...fresh,
    units,
    regions: { ...fresh.regions, [cityId]: { ...city, tile: OLD_CENTRE, tiles: [OLD_CENTRE, ...city.tiles.filter((t) => t !== OLD_CENTRE)] } },
    world: { ...fresh.world, tileOwner, tileState: { ...fresh.world.tileState, [OLD_CENTRE]: { road: true } } }
  };
};

describe('land changes after a grid rebuild', () => {
  it('has a coast tile and a land tile to play with', () => {
    expect(OLD_CENTRE).toBeDefined();
    expect(NOW_LAND).toBeDefined();
  });

  it('moves a city off a tile that became water, keeps its name, and clears what stood there', () => {
    const state = oldSave();
    const fixed = applyLandChanges(JSON.parse(JSON.stringify(state)), CHANGES, tiles);
    const c = fixed.regions[cityId];
    expect(tiles.land[c.tile]).toBe(1);
    expect(c.name).toBe(state.regions[cityId].name);
    expect(c.tiles).toContain(c.tile);
    expect(fixed.world.tileOwner[c.tile]).toBe(cityId);
    expect(fixed.world.tileState[OLD_CENTRE]).toBeUndefined();
    // The old centre is coast: still the city's to work.
    expect(fixed.world.tileOwner[OLD_CENTRE]).toBe(cityId);
    Object.values(fixed.units).forEach((u) => {
      if (u.tile == null || u.embarkedOn) return;
      if (u.domain === 'naval') expect(tiles.land[u.tile] !== 1 || fixed.regions[u.regionId]?.tile === u.tile, u.id).toBe(true);
      else expect(tiles.land[u.tile], u.id).toBe(1);
    });
    const issues = auditGameState(fixed).filter((i) => /tile|city/.test(i.code || i.kind || ''));
    expect(issues).toEqual([]);
  });

  it('changes nothing in a save that has nothing on the changed tiles', () => {
    const other = createInitialState({ playerNationId: 'fr', rngSeed: 22 });
    expect(applyLandChanges(other, CHANGES, tiles)).toBe(other);
  });
});
