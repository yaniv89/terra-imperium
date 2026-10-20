// Tribal camps (eight-ages plan U26).
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getTiles } from '../data/geo/tiles';
import { distanceKm } from '../data/geo/geodesic';
import { CITY_SPACING_KM } from '../data/geo/citySpacing';
import { placeCamps, updateCamps, CAMP_TECH_SHARE, TRIBAL_CAMP_COUNT } from './tribalCamps';
import { bandsOf, foundVillage } from './settlers';
import { getResearchCost } from './research';
import { majorIds } from './testWorld';

const fresh = () => createInitialState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'small', seed: 7, band: true } });
const S = fresh();
const ME = S.playerNationId;
const homes = majorIds(S).map((id) => bandsOf(S.units, id)[0].band.home);
const campTiles = Object.keys(S.tribalCamps).map(Number);
// The player's village, and a camp with one of the player's units standing on it.
const village = foundVillage(S, bandsOf(S.units, ME)[0].id);
const camp = campTiles.find((t) => !village.world.tileOwner[t]);
const unitId = Object.values(village.units).find((u) => u.ownerId === ME).id;
const onCamp = { ...village, units: { ...village.units, [unitId]: { ...village.units[unitId], tile: camp } } };

describe('tribal camps (U26)', () => {
  it('places the same camps for the same seed, none within the settling distance of a home', () => {
    const tiles = getTiles();
    expect(campTiles.length).toBeGreaterThan(TRIBAL_CAMP_COUNT / 2);
    expect(campTiles.length).toBeLessThanOrEqual(TRIBAL_CAMP_COUNT);
    expect(Object.keys(placeCamps(7, homes))).toEqual(Object.keys(placeCamps(7, homes)));
    expect(fresh().tribalCamps).toEqual(S.tribalCamps);
    campTiles.forEach((t) => homes.forEach((h) => expect(distanceKm(tiles.centres[t], tiles.centres[h])).toBeGreaterThanOrEqual(CITY_SPACING_KM)));
  });

  it('a unit on a camp opens one choice; absorbing grows the nearest city and the camp is gone', () => {
    const met = updateCamps(onCamp);
    expect(met.pendingCamp).toEqual({ tile: camp, unitId });
    const city = met.regions[met.nations[ME].capitalRegionId];
    const after = gameReducer(met, { type: ActionTypes.RESOLVE_CAMP, payload: { choice: 'absorb' } });
    expect(after.pendingCamp).toBeNull();
    expect(after.tribalCamps[camp]).toBeUndefined();
    expect(after.regions[city.id].size).toBe(city.size + 1);
    expect(updateCamps(after).pendingCamp).toBeNull();
  });

  it('trading pays a share of the current research', () => {
    const tech = 'military_hunting_bands';
    const met = updateCamps({ ...onCamp, research: { ...onCamp.research, current: tech, progress: {} } });
    const after = gameReducer(met, { type: ActionTypes.RESOLVE_CAMP, payload: { choice: 'trade' } });
    expect(after.research.progress[tech]).toBe(Math.round(getResearchCost(met, ME, tech) * CAMP_TECH_SHARE));
    expect(after.tribalCamps[camp]).toBeUndefined();
  });

  it('an AI unit absorbs a camp at once, and a border covering a camp removes it', () => {
    const ai = majorIds(S).find((id) => id !== ME);
    const withAi = foundVillage(village, bandsOf(village.units, ai)[0].id);
    const aiUnit = Object.values(withAi.units).find((u) => u.ownerId === ai);
    const aiCamp = campTiles.find((t) => !withAi.world.tileOwner[t]);
    const next = updateCamps({ ...withAi, units: { ...withAi.units, [aiUnit.id]: { ...aiUnit, tile: aiCamp } } });
    expect(next.tribalCamps[aiCamp]).toBeUndefined();
    const capital = withAi.nations[ai].capitalRegionId;
    expect(next.regions[capital].size).toBe(withAi.regions[capital].size + 1);
    const covered = updateCamps({ ...village, world: { ...village.world, tileOwner: { ...village.world.tileOwner, [camp]: village.nations[ME].capitalRegionId } } });
    expect(covered.tribalCamps[camp]).toBeUndefined();
  });
});
