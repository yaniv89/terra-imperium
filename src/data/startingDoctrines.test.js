import { describe, it, expect } from 'vitest';
import { STARTING_DOCTRINES, applyStartingDoctrine } from './startingDoctrines';
import { ACHIEVEMENTS } from './achievements';
import { getCapital } from './regions';
import { peoplesWorld } from '../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld();
const FR = WORLD.playerNationId;

describe('applyStartingDoctrine', () => {
  it('leaves state untouched for "none" (no effects)', () => {
    const state = peoplesWorld();
    const next = applyStartingDoctrine(state, 'none');
    expect(next.resources).toEqual(state.resources);
  });

  it('leaves state untouched for an unknown doctrine id rather than throwing', () => {
    const state = peoplesWorld();
    expect(() => applyStartingDoctrine(state, 'not_a_real_doctrine')).not.toThrow();
    expect(applyStartingDoctrine(state, 'not_a_real_doctrine')).toEqual(state);
  });

  it('does not mutate the input state', () => {
    const state = peoplesWorld();
    const snapshotGold = state.resources.gold;
    applyStartingDoctrine(state, 'none');
    expect(state.resources.gold).toBe(snapshotGold);
  });

  it('every non-"none" doctrine requires a real, existing achievement id', () => {
    Object.values(STARTING_DOCTRINES).forEach(d => {
      if (d.id === 'none') {
        expect(d.requiresAchievement).toBeNull();
      } else {
        expect(ACHIEVEMENTS[d.requiresAchievement], `${d.id} references unknown achievement ${d.requiresAchievement}`).toBeDefined();
      }
    });
  });

  it('administrators_start banks one decree', () => {
    const state = peoplesWorld();
    const next = applyStartingDoctrine(state, 'administrators_start');
    expect(next.nations[FR].ruler.decrees).toBe((state.nations[FR].ruler.decrees || 0) + 1);
  });

  it('restored_reputation grants +10 prestige to the player nation', () => {
    const state = peoplesWorld();
    const next = applyStartingDoctrine(state, 'restored_reputation');
    expect(next.nations[FR].prestige).toBe((state.nations[FR].prestige || 0) + 10);
  });

  it('veteran_diplomacy grants +5 legitimacy to the player nation', () => {
    const state = peoplesWorld();
    const next = applyStartingDoctrine(state, 'veteran_diplomacy');
    expect(next.nations[FR].legitimacy).toBe((state.nations[FR].legitimacy ?? 50) + 5);
  });

  it('master_builder grants a free Shrine (Culture tier 1, after the Stone Circle) in the capital, once', () => {
    const state = peoplesWorld();
    const capitalId = getCapital(state, FR);
    const next = applyStartingDoctrine(state, 'master_builder');
    expect(next.regions[capitalId].buildings.categories.culture).toBe(1);

    // Applying it again to a state that already has one is a no-op, not a second free grant.
    const again = applyStartingDoctrine(next, 'master_builder');
    expect(again.regions[capitalId].buildings.categories.culture).toBe(1);
  });

  it('seasoned_court grants a real, named level-2 advisor in the ADM slot, deterministically from the state\'s own rngSeed', () => {
    const state = peoplesWorld();
    const next = applyStartingDoctrine(state, 'seasoned_court');
    expect(next.nations[FR].advisors.adm).toMatchObject({ level: 2 });
    expect(typeof next.nations[FR].advisors.adm.name).toBe('string');
    expect(next.rngSeed).not.toBe(state.rngSeed); // the rng it consumed is threaded back onto state

    // Same seed in, same advisor out — this doctrine must stay replay-deterministic.
    const again = applyStartingDoctrine(state, 'seasoned_court');
    expect(again.nations[FR].advisors.adm.name).toBe(next.nations[FR].advisors.adm.name);
  });
});
