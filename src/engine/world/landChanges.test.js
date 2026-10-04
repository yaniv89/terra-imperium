// The version 8 -> 9 save repair (plans/math/straits.md): a save from the grid before the straits
// opened has Helsinki centred on a tile that is now the Gulf of Finland.
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../gameReducer';
import { migrateSave, V9_LAND_CHANGES, CURRENT_SAVE_VERSION } from '../saveMigrations';
import { applyLandChanges } from './landChanges';
import { getTiles } from '../../data/geo/tiles';
import { auditGameState } from '../stateAudit';

const tiles = getTiles();
const OLD_HELSINKI = 46255; // land on the version 8 grid, water now

// A version 8 save: the Finnish capital back on its old tile, with a road there, a fleet on a
// tile that is land now and an army on a tile that is water now.
const v8Save = () => {
  const fresh = createInitialState({ playerNationId: 'fi', rngSeed: 21 });
  const [cityId, city] = Object.entries(fresh.regions).find(([, r]) => r.owner === 'fi' && r.isCapital);
  const tilesOwned = city.tiles.includes(OLD_HELSINKI) ? city.tiles : [...city.tiles, OLD_HELSINKI];
  const tileOwner = { ...fresh.world.tileOwner, [OLD_HELSINKI]: cityId };
  const units = { ...fresh.units };
  const fiUnits = Object.values(units).filter((u) => u.ownerId === 'fi');
  const army = fiUnits.find((u) => u.domain !== 'naval');
  if (army) units[army.id] = { ...army, tile: OLD_HELSINKI };
  const nowLand = V9_LAND_CHANGES.toLand[0];
  units.fleet_test = { ...(army || fiUnits[0]), id: 'fleet_test', domain: 'naval', classId: army?.classId, tile: nowLand, regionId: cityId };
  return {
    cityId,
    state: {
      ...fresh,
      units,
      regions: { ...fresh.regions, [cityId]: { ...city, tile: OLD_HELSINKI, tiles: tilesOwned } },
      world: { ...fresh.world, tileOwner, tileState: { ...fresh.world.tileState, [OLD_HELSINKI]: { road: true } } }
    }
  };
};

describe('land changes after a grid rebuild', () => {
  it('lists only tiles whose flag really changed on the shipped grid', () => {
    V9_LAND_CHANGES.toWater.forEach((t) => expect(tiles.land[t], `tile ${t}`).not.toBe(1));
    V9_LAND_CHANGES.toLand.forEach((t) => expect(tiles.land[t], `tile ${t}`).toBe(1));
  });

  it('moves a city off a tile that became water, keeps its name, and clears what stood there', () => {
    const { state, cityId } = v8Save();
    const loaded = migrateSave({ version: 8, state: JSON.parse(JSON.stringify(state)) });
    expect(loaded.version).toBe(CURRENT_SAVE_VERSION);
    const city = loaded.state.regions[cityId];
    expect(tiles.land[city.tile]).toBe(1);
    expect(city.name).toBe(state.regions[cityId].name);
    expect(city.tiles).toContain(city.tile);
    expect(loaded.state.world.tileOwner[city.tile]).toBe(cityId);
    expect(loaded.state.world.tileState[OLD_HELSINKI]).toBeUndefined();
    // The old centre is coast now: still the city's to work.
    expect(loaded.state.world.tileOwner[OLD_HELSINKI]).toBe(cityId);
    Object.values(loaded.state.units).forEach((u) => {
      if (u.tile == null || u.embarkedOn) return;
      if (u.domain === 'naval') expect(tiles.land[u.tile] !== 1 || loaded.state.regions[u.regionId]?.tile === u.tile, u.id).toBe(true);
      else expect(tiles.land[u.tile], u.id).toBe(1);
    });
    const issues = auditGameState(loaded.state).filter((i) => /tile|city/.test(i.code || i.kind || ''));
    expect(issues).toEqual([]);
  });

  it('changes nothing in a save that has nothing on the changed tiles', () => {
    const fresh = createInitialState({ playerNationId: 'fr', rngSeed: 22 });
    expect(applyLandChanges(fresh, V9_LAND_CHANGES, tiles)).toBe(fresh);
  });
});
