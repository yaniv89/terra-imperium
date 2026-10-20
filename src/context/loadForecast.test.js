// src/context/loadForecast.test.js
// Mobile campaign audit H-23: after a page load the HUD gold forecast read a registry that was
// never synced (-5 against the real -1) until the first action.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { peoplesWorld } from '../engine/testWorld';
import { WORLD_REGISTRY } from '../engine/world/registry';
import { topBarModel } from '../components/ui/topBarModel';
import { loadOrCreateState, AUTOSAVE_KEY } from './GameContext';
import { CURRENT_SAVE_VERSION } from '../engine/saveMigrations';

afterEach(() => vi.unstubAllGlobals());

describe('loading a save', () => {
  it('syncs the city registry, so the first forecast is the real one', () => {
    const world = peoplesWorld({ seed: 7 });
    const real = topBarModel(world).gold.perTurn;
    const saved = JSON.stringify({ version: CURRENT_SAVE_VERSION, state: world, savedAt: 1 });
    WORLD_REGISTRY.source = null; // a fresh page: nothing synced yet
    Object.keys(WORLD_REGISTRY.regions).forEach((k) => delete WORLD_REGISTRY.regions[k]);
    vi.stubGlobal('localStorage', { getItem: (k) => (k === AUTOSAVE_KEY ? saved : null), setItem: () => {}, removeItem: () => {} });
    const loaded = loadOrCreateState();
    expect(loaded.playerNationId).toBe(world.playerNationId);
    expect(WORLD_REGISTRY.source).toBe(loaded.regions);
    expect(topBarModel(loaded).gold.perTurn).toBe(real);
  });
});
