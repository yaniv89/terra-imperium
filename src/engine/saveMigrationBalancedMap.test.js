// v5 -> v6: a save from the detailed 4,482-province map loads onto the balanced map.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { migrateSave, combineRegions } from './saveMigrations';
import { auditGameState } from './stateAudit';
import REGION_MERGE from '../data/geo/regionMerge.json';
import { REGIONS_DATA } from '../data/regions';

// Members of each balanced region: itself plus every old id merged into it.
const MEMBERS = {};
Object.keys(REGIONS_DATA).forEach((id) => { MEMBERS[id] = [id]; });
Object.entries(REGION_MERGE).forEach(([oldId, newId]) => { MEMBERS[newId].push(oldId); });

// Rebuild what an old save looked like: the same game, with each region split back into its
// original provinces (population shared out, the same owner and buildings on each).
const oldSaveOf = (state) => {
  const regions = {};
  Object.entries(state.regions).forEach(([id, r]) => {
    const parts = MEMBERS[id] || [id];
    parts.forEach((oldId, i) => {
      const share = Math.floor(r.currentPopulation / parts.length);
      regions[oldId] = { ...r, id: oldId, currentPopulation: i === 0 ? r.currentPopulation - share * (parts.length - 1) : share };
    });
  });
  const gbOld = Object.values(regions).filter((r) => r.owner === 'gb').length;
  return { ...state, regions, nations: { ...state.nations, gb: { ...state.nations.gb, startRegionCount: gbOld } } };
};

describe('balanced map save migration (v6)', () => {
  it('turns an old save into the balanced map with nothing lost', () => {
    const fresh = createInitialState({ playerNationId: 'gb', rngSeed: 11 });
    const london = fresh.nations.gb.capitalRegionId;
    const oldLondonPart = MEMBERS[london].find((id) => id !== london) || london;
    const old = oldSaveOf({
      ...fresh,
      units: { u1: { id: 'u1', ownerId: 'gb', regionId: oldLondonPart, homeRegionId: oldLondonPart, domain: 'land', classId: 'infantry', strength: 500, maxStrength: 500, morale: 100, movesLeft: 1 } }
    });
    expect(Object.keys(old.regions).length).toBe(4482);

    const { version, state } = migrateSave({ version: 5, state: old });
    expect(version).toBe(6);
    expect(Object.keys(state.regions).length).toBe(Object.keys(REGIONS_DATA).length);
    expect(Object.keys(state.regions).every((id) => REGIONS_DATA[id])).toBe(true);
    // People are conserved, region by region.
    Object.keys(REGIONS_DATA).slice(0, 300).forEach((id) => expect(state.regions[id].currentPopulation).toBe(fresh.regions[id].currentPopulation));
    // Units follow their province into its new region.
    expect(state.units.u1.regionId).toBe(london);
    expect(state.units.u1.homeRegionId).toBe(london);
    // The overextension reference shrinks with the map: the UK's 232 provinces are now 8 regions.
    expect(state.nations.gb.startRegionCount).toBe(Object.values(REGIONS_DATA).filter((r) => r.startOwner === 'gb').length);
    expect(state.logs[state.logs.length - 1].message).toMatch(/map was simplified/);
    expect(auditGameState(state).filter((i) => !auditGameState(fresh).some((f) => f.code === i.code))).toEqual([]);
  });

  it('combines a region from its members: owner of the most people, sums, weighted averages, best buildings', () => {
    const a = { id: 'x-a', owner: 'aa', control: 100, unrest: 0, currentPopulation: 3000, defenseLevel: 1, underInvasion: false, dev: { tax: 2 }, buildings: { categories: { food: 1, military: -1 }, extraction: { iron: false } } };
    const b = { id: 'x-b', owner: 'bb', control: 20, unrest: 40, currentPopulation: 1000, defenseLevel: 3, underInvasion: true, dev: { tax: 1 }, buildings: { categories: { food: 0, military: 2 }, extraction: { iron: true } } };
    const c = combineRegions('x-a', [a, b]);
    expect(c).toMatchObject({ id: 'x-a', owner: 'aa', currentPopulation: 4000, control: 80, unrest: 10, defenseLevel: 3, underInvasion: true, dev: { tax: 3 } });
    expect(c.buildings).toEqual({ categories: { food: 1, military: 2 }, extraction: { iron: true } });
  });

  it('leaves a current save untouched', () => {
    const fresh = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const { state } = migrateSave({ version: 6, state: fresh });
    expect(Object.keys(state.regions)).toEqual(Object.keys(fresh.regions));
  });
});
