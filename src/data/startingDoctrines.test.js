import { describe, it, expect } from 'vitest';
import { STARTING_DOCTRINES, applyStartingDoctrine } from './startingDoctrines';
import { ACHIEVEMENTS } from './achievements';
import { createInitialState } from '../context/GameContext';
import { getCapital } from './regions';

describe('applyStartingDoctrine', () => {
  it('leaves state untouched for "none" (no effects)', () => {
    const state = createInitialState();
    const next = applyStartingDoctrine(state, 'none');
    expect(next.resources).toEqual(state.resources);
  });

  it('leaves state untouched for an unknown doctrine id rather than throwing', () => {
    const state = createInitialState();
    expect(() => applyStartingDoctrine(state, 'not_a_real_doctrine')).not.toThrow();
    expect(applyStartingDoctrine(state, 'not_a_real_doctrine')).toEqual(state);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState();
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

  it('administrators_start grants +50 ADM', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyStartingDoctrine(state, 'administrators_start');
    expect(next.resources.adm).toBe(state.resources.adm + 50);
  });

  it('restored_reputation grants +10 prestige to the player nation', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyStartingDoctrine(state, 'restored_reputation');
    expect(next.nations.fr.prestige).toBe((state.nations.fr.prestige || 0) + 10);
  });

  it('veteran_diplomacy grants +5 legitimacy to the player nation', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyStartingDoctrine(state, 'veteran_diplomacy');
    expect(next.nations.fr.legitimacy).toBe((state.nations.fr.legitimacy ?? 50) + 5);
  });

  it('master_builder grants a free tier-0 Culture building in the capital, once', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const capitalId = getCapital(state, 'fr');
    const next = applyStartingDoctrine(state, 'master_builder');
    expect(next.regions[capitalId].buildings.categories.culture).toBe(0);

    // Applying it again to a state that already has one is a no-op, not a second free grant.
    const again = applyStartingDoctrine(next, 'master_builder');
    expect(again.regions[capitalId].buildings.categories.culture).toBe(0);
  });

  it('seasoned_court grants a real, named level-2 advisor in the ADM slot, deterministically from the state\'s own rngSeed', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyStartingDoctrine(state, 'seasoned_court');
    expect(next.nations.fr.advisors.adm).toMatchObject({ level: 2 });
    expect(typeof next.nations.fr.advisors.adm.name).toBe('string');
    expect(next.rngSeed).not.toBe(state.rngSeed); // the rng it consumed is threaded back onto state

    // Same seed in, same advisor out — this doctrine must stay replay-deterministic.
    const again = applyStartingDoctrine(state, 'seasoned_court');
    expect(again.nations.fr.advisors.adm.name).toBe(next.nations.fr.advisors.adm.name);
  });
});
