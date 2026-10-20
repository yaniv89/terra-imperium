// src/components/map/ghostCity.test.js
// Playtest 4 P4-C1: a city the player founded went over to another people out of the player's
// sight; the player's remembered picture kept it as "mine" (fog.seen.cities owner = the player)
// as a ghost record without worked or locked tiles, the city rail took it for one of the player's
// cities and the WebGL map crashed on every load. The save that showed it is the fixture here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { migrateSave } from '../../engine/saveMigrations';
import { syncWorldRegistry, WORLD_REGISTRY } from '../../engine/world/registry';
import { auditGameState } from '../../engine/stateAudit';
import { updateFog } from '../../engine/fog';
import { getTiles } from '../../data/geo/tiles';
import { getNationCapital } from '../../data/regions';
import { fogView } from './fogView';
import { cityRailModel } from '../city/cityRailModel';
import { cityLive } from '../../engine/cityEconomy';
import { indexCities, buildTileTexels, buildCityTexels, buildFogStates } from './gl/territoryData';
import { peoplesWorld } from '../../engine/testWorld';
import { describeSave } from '../../utils/launchDecision';

const FIXTURE = fileURLToPath(new URL('../../engine/__fixtures__/save-t202-ghost-city.json.gz', import.meta.url));
const rawSave = () => gunzipSync(readFileSync(FIXTURE)).toString('utf8');
const loadFixture = () => syncWorldRegistry(migrateSave(JSON.parse(rawSave())).state);

const mapModel = (state) => {
  const fog = fogView(state);
  const v = fog.state;
  const index = indexCities(v.regions);
  const fogStates = buildFogStates(getTiles().count, fog);
  buildTileTexels({ tileCount: getTiles().count, tileOwner: v.world.tileOwner, regions: v.regions, fog, index, fogStates });
  buildCityTexels({ regions: v.regions, index, playerNationId: v.playerNationId, selectedRegion: null, atWarNationIds: new Set(), nations: v.nations });
  return { fog, rail: cityRailModel(v) };
};

describe('a city lost out of sight (P4-C1)', () => {
  it('the turn 202 save loads, passes the audit and builds the map model', () => {
    const state = loadFixture();
    expect(state.regions.c81662.owner).toBe('pontus');
    expect(auditGameState(state)).toEqual([]);
    const { fog, rail } = mapModel(state);
    const ghost = fog.state.regions.c81662;
    expect(ghost.ghost).toBe(true);
    expect(ghost.owner).toBe('pontus'); // the player knows it went over
    expect(rail.map((r) => r.id)).not.toContain('c81662');
    expect(rail.every((r) => state.regions[r.id].owner === 'kemet')).toBe(true);
  });

  it('the next fog pass refreshes the memory of the lost city', () => {
    const state = loadFixture();
    expect(state.fog.seen.cities.c81662.owner).toBe('pontus');
  });

  it('a ghost record never crashes the city readers', () => {
    const state = loadFixture();
    const v = fogView(state).state;
    expect(() => cityLive(v, 'c81662')).not.toThrow();
    expect(cityLive(v, 'c81662').worked).toEqual([]);
  });
});

describe('the remembered picture of the player\'s own cities', () => {
  const S = peoplesWorld({ seed: 7 });
  const FR = S.playerNationId;
  const far = Object.keys(S.nations).filter((id) => id !== FR && S.regions[getNationCapital(id)]?.tile != null).sort()
    .find((id) => !fogView(S).isVisible(S.regions[getNationCapital(id)].tile));
  const id = getNationCapital(far);
  const tile = S.regions[id].tile;
  const scout = { id: 'scout', ownerId: FR, tile, regionId: getNationCapital(FR), domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [] };
  // Seen once, then remembered as the player's (as a city the player founded and lost out of sight).
  const scouted = updateFog({ ...S, units: { ...S.units, scout } }, { onlyPlayer: true });
  const seen = scouted.fog.seen;
  const stale = { ...scouted, units: S.units, fog: { ...scouted.fog, seen: { ...seen, cities: { ...seen.cities, [id]: { ...seen.cities[id], owner: FR } } } } };

  it('the audit names a memory that claims a city the player does not hold', () => {
    expect(auditGameState(stale).map((i) => i.code)).toContain('fog_ghost_owner');
  });

  it('the fog pass learns the new owner, and the map view never shows it as the player\'s', () => {
    const fixed = updateFog(stale, { onlyPlayer: true });
    expect(fixed.fog.seen.cities[id].owner).toBe(far);
    expect(auditGameState(fixed).map((i) => i.code)).not.toContain('fog_ghost_owner');
    const ghost = fogView(stale).state.regions[id];
    expect(ghost.ghost).toBe(true);
    expect(ghost.owner).toBe(far);
    expect(cityRailModel(fogView(stale).state).map((r) => r.id)).not.toContain(id);
  });

  it('a lost city that no longer stands is forgotten', () => {
    const regions = { ...stale.regions }; delete regions[id];
    const gone = { ...stale, regions };
    expect(fogView(gone).state.regions[id]).toBeUndefined();
    expect(updateFog(gone, { onlyPlayer: true }).fog.seen.cities[id]).toBeUndefined();
  });
});

describe('reading a save keeps the running game\'s registry (P4-H1)', () => {
  it('the title screen describing a save does not repoint the city registry', () => {
    const state = loadFixture();
    expect(WORLD_REGISTRY.source).toBe(state.regions);
    const before = Object.keys(WORLD_REGISTRY.regions).length;
    expect(describeSave(rawSave()).status).toBe('ok');
    expect(WORLD_REGISTRY.source).toBe(state.regions);
    expect(Object.keys(WORLD_REGISTRY.regions).length).toBe(before);
    expect(WORLD_REGISTRY.regions.c81662).toBeTruthy();
  });
});
