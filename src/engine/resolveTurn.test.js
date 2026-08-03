import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { GamePhases, GameStatus } from '../data/types';

// A minimal, deterministic "overwhelming attacker" invasion: strength so far above the
// defender's that the 0.8-1.2 random factor can never flip the outcome, so tests don't need
// to average over many runs to be reliable.
const overwhelmingInvasion = (id, targetRegion, attackerNation) => ({
  id,
  targetRegion,
  strength: 999999,
  morale: 100,
  supply: 100,
  active: true,
  isPlayerAttacker: false,
  attackerNation
});

const postStateBase = () => {
  const state = createInitialState();
  state.phase = GamePhases.POST_STATE;
  state.militaryPower = 100; // deliberately weak defense
  return state;
};

describe('resolveTurn determinism', () => {
  it('produces identical output for identical input (same rngSeed)', () => {
    const state = postStateBase();
    const a = resolveTurn(state);
    const b = resolveTurn(state);
    expect(a).toEqual(b);
  });

  it('is a no-op once the game has ended', () => {
    const state = { ...postStateBase(), gameStatus: GameStatus.DEFEAT };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while an event is blocking play', () => {
    const state = { ...postStateBase(), activeEventId: 'balfour_1917' };
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn combat resolution (regression: same-region stale-read damage loss)', () => {
  it('applies damage from two invasions on the same region additively, not by overwriting each other', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'player', control: 100, underInvasion: true };
    state.invasions = [
      overwhelmingInvasion('inv1', 'golan', 'syria'),
      overwhelmingInvasion('inv2', 'golan', 'egypt')
    ];

    const next = resolveTurn(state);

    // Each overwhelming win deals 25 damage. The old code computed both from the same
    // pre-turn control value (100), so the second dispatch silently overwrote the first and
    // the net result was a single -25 instead of -50.
    expect(next.regions.golan.control).toBe(50);
    expect(next.regions.golan.owner).toBe('player');
  });
});

describe('resolveTurn territory capture (regression: AI conquest never transferred ownership)', () => {
  it('flips region ownership when an overwhelming invasion drives control to 0', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'player', control: 20, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'golan', 'syria')];

    const next = resolveTurn(state);

    expect(next.regions.golan.owner).toBe('syria');
    expect(next.regions.golan.isOccupied).toBe(true);
    expect(next.invasions.find(i => i.id === 'inv1').active).toBe(false);
  });
});

describe('resolveTurn victory/defeat (regression: no terminal state, checked against stale data)', () => {
  it('triggers DEFEAT the same turn a core city falls, not one turn late', () => {
    const state = postStateBase();
    state.regions.tel_aviv = { ...state.regions.tel_aviv, owner: 'player', control: 20, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'tel_aviv', 'egypt')];

    const next = resolveTurn(state);

    expect(next.regions.tel_aviv.owner).not.toBe('player');
    expect(next.gameStatus).toBe(GameStatus.DEFEAT);
  });

  it('does not flag defeat while both core cities are held', () => {
    const state = postStateBase();
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.ACTIVE);
  });
});

describe('resolveTurn casualties (regression: player military was a free, undamageable pool)', () => {
  it('reduces the player military pool when their defense takes losses', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'player', control: 100, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'golan', 'syria')];

    const next = resolveTurn(state);

    expect(next.militaryPower).toBeLessThan(state.militaryPower);
  });

  it('reduces the attacking nation strength when a player offensive wins', () => {
    const state = postStateBase();
    state.militaryPower = 999999; // overwhelming attacker this time
    state.regions.golan = { ...state.regions.golan, owner: 'syria', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'golan', strength: 999999, morale: 100, supply: 100,
      active: true, isPlayerAttacker: true
    }];
    const next = resolveTurn(state);
    expect(next.nations.syria.militaryStrength).toBeLessThan(state.nations.syria.militaryStrength);
    expect(next.regions.golan.owner).toBe('player');
  });
});

describe('resolveTurn AI vs AI conflicts (regression: computed and discarded)', () => {
  it('is wired so AI-vs-AI casualties can affect nation military strength (no crash across many turns)', () => {
    let state = postStateBase();
    for (let i = 0; i < 50; i++) {
      state = resolveTurn(state);
    }
    // Not asserting a specific delta (it's probabilistic) — the meaningful regression check is
    // that resolving 50 turns doesn't throw and nation strengths stay sane (never negative,
    // never below the reducer's floor).
    Object.values(state.nations).forEach(n => {
      if (n.isPlayer) return;
      expect(n.militaryStrength).toBeGreaterThanOrEqual(100);
    });
  });
});
