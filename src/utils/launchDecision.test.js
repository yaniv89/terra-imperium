import { describe, it, expect } from 'vitest';
import { launchScreen, playedAgo, describeSave } from './launchDecision';
import { CURRENT_SAVE_VERSION } from '../engine/saveMigrations';
import { peoplesWorld } from '../engine/testWorld';
import { syncWorldRegistry, WORLD_REGISTRY } from '../engine/world/registry';

describe('launchScreen (X26: the title screen on every launch)', () => {
  it('shows the title screen whenever a readable save exists, never the game', () => {
    expect(launchScreen({ hasSave: true })).toBe('title');
  });
  it('goes to the new game steps with no save', () => {
    expect(launchScreen({ hasSave: false })).toBe('start');
    expect(launchScreen({})).toBe('start');
  });
  it('starts a pending new game at once (the player chose it before the reload)', () => {
    expect(launchScreen({ pendingStart: true, hasSave: true })).toBe('game');
    expect(launchScreen({ pendingStart: true, hasSave: false })).toBe('game');
  });
});

describe('playedAgo', () => {
  const now = 1_000_000_000_000;
  it('says how long ago in plain words', () => {
    expect(playedAgo(now - 5_000, now)).toBe('just now');
    expect(playedAgo(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(playedAgo(now - 60 * 60_000, now)).toBe('1 hour ago');
    expect(playedAgo(now - 4 * 24 * 3_600_000, now)).toBe('4 days ago');
    expect(playedAgo(now - 90 * 24 * 3_600_000, now)).toBe('3 months ago');
    expect(playedAgo(undefined, now)).toBe('');
  });
});

describe('describeSave', () => {
  it('reads the people, turn, year and time of a save', () => {
    const state = peoplesWorld({ seed: 7 });
    const raw = JSON.stringify({ version: CURRENT_SAVE_VERSION, state, savedAt: 1234 });
    const info = describeSave(raw);
    expect(info.status).toBe('ok');
    expect(info.nation).toBe(state.nations[state.playerNationId].name);
    expect(info.turn).toBe(state.turnNumber);
    expect(info.savedAt).toBe(1234);
    expect(info.year).toMatch(/BCE|CE/);
  });
  it('marks a save this build cannot read as old and nothing as none', () => {
    expect(describeSave(null).status).toBe('none');
    expect(describeSave('not json').status).toBe('old');
    expect(describeSave(JSON.stringify({ version: 999, state: {} })).status).toBe('old');
  });

  // Playtest 4 H1, C2: reading a save for its card (migrateSave backfills from a fresh game) left
  // the city registry on that fresh game, so the game on screen, and a commanded battle resumed
  // after a reload, read another game's cities until the first action.
  it('leaves the city registry on the game on screen', () => {
    const raw = JSON.stringify({ version: CURRENT_SAVE_VERSION, state: peoplesWorld({ seed: 11 }), savedAt: 1 });
    const playing = syncWorldRegistry(peoplesWorld({ seed: 7 }));
    const before = { ids: Object.keys(WORLD_REGISTRY.regions).sort().join(',') };
    expect(describeSave(raw).status).toBe('ok');
    expect(WORLD_REGISTRY.source).toBe(playing.regions);
    expect(Object.keys(WORLD_REGISTRY.regions).sort().join(',')).toBe(before.ids);
  });
});
