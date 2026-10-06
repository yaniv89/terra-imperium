import { describe, it, expect } from 'vitest';
import { createInitialState } from '../gameReducer';
import { getNationCapital } from '../../data/regions';
import { migrateSave, CURRENT_SAVE_VERSION } from '../saveMigrations';
import { assertGameState } from '../stateAudit';
import { resolveTurn } from '../resolveTurn';
import { HISTORICAL_EVENTS } from '../../data/events';
import { NATION_COUNTS, generateStarts, applyScenario } from './emergentWorld';
import { processEmergence } from '../emergence';
import { getTiles } from '../../data/geo/tiles';
import { spacingBreaches } from '../../data/geo/citySpacing';
import { SCENARIO_IDS, DAWN_SETTLER_NATIONS, UNPEOPLED_AT_DAWN, absentAtStart } from '../../data/scenarios';

describe('world scenarios on the tile grid', () => {
  it('the full world: 240 peoples less the ones with no room, one city each at the Dawn start, every capital on its own land', () => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    expect(state.scenario.mode).toBe('full');
    expect(state.scenario.start).toBe('dawn');
    // The crowded small lands with no room are absent (settle-rules R4, option A): dormant, not in
    // the nations, and never emerging in the full world.
    const absent = absentAtStart(getTiles(), Object.keys(getTiles().capitals), { priority: 'fr' });
    expect(absent).toContain('ps');
    expect([...state.scenario.dormantNationIds].sort()).toEqual(absent);
    absent.forEach((id) => expect(state.nations[id], id).toBeUndefined());
    const total = 240 - absent.length;
    expect(Object.keys(state.regions)).toHaveLength(total);
    expect(Object.keys(state.nations)).toHaveLength(total);
    Object.values(state.nations).forEach((n) => {
      const capital = state.regions[n.capitalRegionId];
      expect(capital.owner).toBe(n.id);
      expect(capital.isCapital).toBe(true);
      expect(capital.tiles).toContain(capital.tile);
      expect(state.world.tileOwner[capital.tile]).toBe(capital.id);
    });
    expect(Object.values(state.units).filter((u) => u.classId === 'infantry')).toHaveLength(total);
    // The Dawn settlers: the five river peoples and every unpeopled land (scenarios.js).
    expect(Object.values(state.units).filter((u) => u.classId === 'settler').length).toBe(DAWN_SETTLER_NATIONS.length + [...UNPEOPLED_AT_DAWN].filter((id) => !absent.includes(id)).length);
    assertGameState(state);
  });

  it('later starts give more cities and more land', () => {
    const base = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    const counts = SCENARIO_IDS.map((start) => Object.keys(applyScenario(base, { mode: 'full', start }).regions).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    const modern = applyScenario(base, { mode: 'full', start: 'modern' });
    expect(Object.values(modern.regions).filter((c) => c.owner === 'fr').length).toBeGreaterThan(3);
  }, 20000);

  it('isolated starts do not depend on previously generated games', () => {
    const first = generateStarts('va', 75, 4242);
    generateStarts('fr', 15, 7);
    generateStarts('sg', 60, 2026);
    expect(generateStarts('va', 75, 4242)).toEqual(first);
  });

  it.each(NATION_COUNTS)('%i seeded nations have distinct capitals, one city and a starting army each', (nationCount) => {
    const state = createInitialState({ playerNationId: 'fr', rngSeed: 7, scenario: { mode: 'emergent', nationCount, seed: 7 } });
    expect(Object.keys(state.nations)).toHaveLength(nationCount);
    expect(new Set(Object.values(state.scenario.starts)).size).toBe(nationCount);
    expect(state.nations.fr).toBeDefined();
    for (const n of Object.values(state.nations)) {
      expect(Object.values(state.regions).filter((r) => r.owner === n.id)).toHaveLength(1);
      expect(Object.values(state.units).filter((u) => u.ownerId === n.id && u.classId === 'infantry')).toHaveLength(1);
    }
    expect(Object.keys(generateStarts('fr', nationCount, 7).starts).sort()).toEqual(state.scenario.activeNationIds);
    expect(state.scenario.dormantNationIds).toHaveLength(240 - nationCount);
    assertGameState(state);
    const loaded = migrateSave({ version: CURRENT_SAVE_VERSION, state }).state;
    expect(Object.keys(loaded.nations)).toHaveLength(nationCount);
    expect(loaded.scenario).toEqual(state.scenario);
  });

  it('spreads the chosen peoples across the globe', () => {
    const { starts } = generateStarts('fr', 15, 7);
    const ids = Object.keys(starts);
    const continents = new Set(ids.map((id) => ['us', 'ca', 'mx', 'br', 'ar'].includes(id) ? 'americas' : ['cn', 'jp', 'in', 'id', 'au'].includes(id) ? 'far' : 'other'));
    expect(ids).toContain('fr');
    expect(continents.size).toBeGreaterThan(1);
  });

  it('a dormant people emerges on free land every 50 turns', () => {
    let state = createInitialState({ playerNationId: 'fr', rngSeed: 7, scenario: { mode: 'emergent', nationCount: 15, seed: 7 } });
    state = { ...state, turnNumber: 50 };
    const next = processEmergence(state);
    expect(Object.keys(next.nations)).toHaveLength(16);
    const id = next.scenario.activeNationIds.at(-1);
    const capital = next.regions[next.nations[id].capitalRegionId];
    expect(capital.owner).toBe(id);
    expect(state.world.tileOwner[capital.tile]).toBeUndefined();
    const added = Object.values(next.units).find((u) => u.id.startsWith('emerged_'));
    expect(added.commanderId).toBeNull();
    expect(added.embarkedOn).toBeUndefined();
    expect(added.homeRegionId).toBe(added.regionId);
    assertGameState(next);
  });

  it('a people never emerges closer to a city than the settling rule allows', () => {
    let state = createInitialState({ playerNationId: 'fr', rngSeed: 7, scenario: { mode: 'emergent', nationCount: 15, seed: 7 } });
    state = { ...state, turnNumber: 50 };
    const tiles = getTiles();
    const next = processEmergence(state);
    const id = next.scenario.activeNationIds.at(-1);
    const capital = next.regions[next.nations[id].capitalRegionId];
    // the shared rule (citySpacing.js): 4 rings on one landmass, 3 across water
    expect(spacingBreaches(tiles, Object.values(next.regions).map((c) => c.tile))).toEqual([]);
    // a city two rings from that people's home: it waits (or another people emerges instead)
    const near = tiles.neighbors[tiles.neighbors[capital.tile][0]].find((t) => t !== capital.tile && !tiles.neighbors[capital.tile].includes(t));
    const blocker = { ...Object.values(state.regions)[0], id: 'blocker', tile: near, tiles: [near], owner: 'fr' };
    const crowded = processEmergence({ ...state, regions: { ...state.regions, blocker } });
    expect(crowded.scenario.activeNationIds.at(-1)).not.toBe(id);
  });

  it('an emergent world plays turns and stays valid', () => {
    let state = createInitialState({ playerNationId: 'fr', rngSeed: 3, scenario: { mode: 'emergent', nationCount: 15, seed: 3 } });
    state = { ...state, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 99999, battleSettings: { autoDefend: true } };
    for (let i = 0; i < 5; i++) state = resolveTurn({ ...state, activeProceduralEvent: null });
    expect(state.turnNumber).toBe(6);
    expect(Object.keys(state.nations)).toHaveLength(15);
    expect(state.regions[getNationCapital('fr')].owner).toBe('fr');
    assertGameState(state);
  });
});
