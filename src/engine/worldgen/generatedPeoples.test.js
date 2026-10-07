// Peoples on a generated world (plans/MAP-VARIATIONS-PLAN.md 6.1 to 6.3, MV5): fair sites, the
// gap, the settling rule, determinism, the save round trip, and switching worlds in one process.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installGeneratedWorld, installEarth } from '../../worldgen/nodeWorld';
import { getTiles, loadedWorldSpec } from '../../data/geo/tiles';
import { distanceKm } from '../../data/geo/geodesic';
import { spacingBreaches } from '../../data/geo/citySpacing';
import { createInitialState, gameReducer } from '../gameReducer';
import { migrateSave, CURRENT_SAVE_VERSION } from '../saveMigrations';
import { auditGameState } from '../stateAudit';
import { MAJOR_MIN_GAP_KM, WORLD_SIZES } from '../../data/worldSizes';
import { hungarian, affinity, siteProfile, placeGeneratedPeoples } from './generatedPeoples';
import { fnv1a } from '../../worldgen/spec';

const digest = (s) => fnv1a(new TextEncoder().encode(JSON.stringify({ regions: s.regions, nations: s.nations, units: s.units, scenario: s.scenario, world: s.world })));
const earthState = () => createInitialState({ playerNationId: 'akkad', rngSeed: 5, scenario: { mode: 'peoples', size: 'small', seed: 5 } });

let earthDigest;
let spec;
let state;
beforeAll(() => {
  installEarth();
  earthDigest = digest(earthState());
  spec = installGeneratedWorld({ seed: 2, params: {} }).spec;
  state = createInitialState({ playerNationId: 'kemet', rngSeed: 21, scenario: { mode: 'peoples', size: 'standard', seed: 33, map: spec } });
}, 180000);
afterAll(() => installEarth());

describe('the Hungarian assignment', () => {
  it('finds the cheapest assignment', () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
    expect(hungarian([[1, 2, 3, 0]])).toEqual([3]);
  });
});

describe('a game on a generated world', () => {
  it('saves the world descriptor and the site table, not the map', () => {
    expect(state.scenario.map).toEqual(expect.objectContaining({ kind: 'generated', generatorVersion: 1, seed: 2, worldHash: spec.worldHash }));
    expect(Object.keys(state.scenario.sites).length).toBeGreaterThan(60);
    expect(JSON.stringify(state).length).toBeLessThan(5e6);
  });

  it('places every major on a fair site: land with room, 612 km apart, the settle rule kept everywhere', () => {
    const tiles = getTiles();
    const majors = Object.values(state.nations).filter((n) => n.kind !== 'independent');
    expect(majors).toHaveLength(WORLD_SIZES.standard.majors);
    const caps = majors.map((n) => state.regions[n.capitalRegionId].tile);
    caps.forEach((t) => {
      expect(tiles.isLand(t)).toBe(true);
      const room = []; let frontier = [t]; const seen = new Set(frontier);
      for (let d = 1; d <= 3; d++) { const next = []; frontier.forEach((i) => tiles.neighbors[i].forEach((j) => { if (!seen.has(j)) { seen.add(j); next.push(j); if (tiles.isLand(j) && tiles.terrainOf(j) !== 'lake') room.push(j); } })); frontier = next; }
      expect(room.length).toBeGreaterThanOrEqual(12);
    });
    for (let a = 0; a < caps.length; a++) for (let b = a + 1; b < caps.length; b++) expect(distanceKm(tiles.centres[caps[a]], tiles.centres[caps[b]])).toBeGreaterThanOrEqual(MAJOR_MIN_GAP_KM - 1);
    expect(spacingBreaches(tiles, Object.values(state.regions).map((c) => c.tile))).toEqual([]);
    expect(auditGameState(state)).toEqual([]);
  });

  it('matches peoples to sites by climate: better than a random assignment', () => {
    const tiles = getTiles();
    const majors = Object.values(state.nations).filter((n) => n.kind !== 'independent').map((n) => n.id).sort();
    const sites = majors.map((id) => state.scenario.sites[id]);
    const total = (perm) => majors.reduce((s, id, i) => s + affinity(siteProfile(tiles, sites[perm[i]]), id), 0);
    const chosen = total(majors.map((_, i) => i));
    const rotated = total(majors.map((_, i) => (i + 7) % majors.length));
    expect(chosen).toBeGreaterThan(rotated);
  });

  it('is deterministic and keeps the people of the player and the pinned people', () => {
    const again = placeGeneratedPeoples('kemet', 'standard', 33, getTiles());
    expect(again.sites).toEqual(state.scenario.sites);
    expect(again.majors[0]).toBe('kemet');
    expect(again.majors).toContain('israel');
    expect(digest(createInitialState({ playerNationId: 'kemet', rngSeed: 21, scenario: { mode: 'peoples', size: 'standard', seed: 33, map: spec } }))).toBe(digest(state));
  }, 60000);

  it('round-trips through a save', () => {
    const json = JSON.stringify({ version: CURRENT_SAVE_VERSION, state });
    const loaded = migrateSave(JSON.parse(json)).state;
    expect(loaded.scenario.map).toEqual(state.scenario.map);
    expect(loaded.scenario.sites).toEqual(state.scenario.sites);
    expect(digest(loaded)).toBe(digest(state));
  }, 60000);

  it('plays turns', () => {
    let s = { ...state, battleSettings: { autoDefend: true }, proceduralEventCooldown: 999999 };
    for (let k = 0; k < 4; k++) {
      s = { ...s, activeEventId: null, pendingPeaceOffer: null };
      s = gameReducer(s, { type: 'ADVANCE_TURN' });
    }
    expect(s.turnNumber).toBeGreaterThan(state.turnNumber);
    expect(auditGameState(s)).toEqual([]);
  }, 120000);

  it('refuses a generated world the process has not loaded', () => {
    expect(() => createInitialState({ playerNationId: 'kemet', rngSeed: 1, scenario: { mode: 'peoples', size: 'small', seed: 1, map: { ...spec, seed: 999 } } })).toThrow(/not the loaded one/);
  });
});

describe('switching worlds in one process', () => {
  it('Earth, a generated world, then Earth again gives the same Earth state', () => {
    expect(loadedWorldSpec().kind).toBe('generated');
    installEarth();
    expect(loadedWorldSpec().kind).toBe('earth');
    expect(digest(earthState())).toBe(earthDigest);
    installGeneratedWorld({ seed: 2, params: {} });
  }, 120000);
});
