import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { GamePhases, GameStatus } from '../data/types';
import { sumUnits } from '../utils/helpers';

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

const overwhelmingPlayerInvasion = (id, targetRegion) => ({
  id,
  targetRegion,
  composition: { infantry: 999999, armor: 0, air: 0 },
  morale: 100,
  supply: 100,
  active: true,
  isPlayerAttacker: true
});

const postStateBase = () => {
  const state = createInitialState();
  state.phase = GamePhases.POST_STATE;
  state.militaryUnits = { infantry: 100, armor: 0, air: 0 }; // deliberately weak defense
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

    expect(sumUnits(next.militaryUnits)).toBeLessThan(sumUnits(state.militaryUnits));
  });

  it('reduces the attacking nation strength when a player offensive wins', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'syria', control: 100 };
    state.invasions = [overwhelmingPlayerInvasion('inv1', 'golan')];

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

describe('resolveTurn unit composition (Phase 3: terrain-vs-composition tradeoffs)', () => {
  it('casualties from a player offensive land on the invasion force, not the home defense pool', () => {
    const state = postStateBase();
    state.militaryUnits = { infantry: 200000, armor: 0, air: 0 };
    state.regions.golan = { ...state.regions.golan, owner: 'syria', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'golan', composition: { infantry: 999999, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];

    const next = resolveTurn(state);

    // The committed 999999 was already deducted at launch time (reducer concern, not tested
    // here) — resolveTurn itself must not ALSO touch the home militaryUnits pool for an
    // attacking invasion's own casualties.
    expect(next.militaryUnits).toEqual(state.militaryUnits);
  });

  it('composition vs. terrain can be the difference between a stalemate and a rout', () => {
    // iran_west: mountains, defense = 20000 (startMilitary) * 0.3 * fortification(4) = 24000,
    // further *1.4 terrain mod = 33600 defenderScore. At headcount 25000: infantry's terrain
    // bonus (x1.3 = 32500 effective) reaches the 0.7 stalemate threshold across the whole
    // 0.8-1.2 random band; armor's terrain penalty (x0.6 = 15000 effective) never does — it's
    // repelled outright regardless of the roll. This is the real, seed-independent effect of
    // composition-vs-terrain: which combat bucket you land in, not fine-grained casualty math
    // within the same bucket (that stays a flat percentage either way).
    const buildState = (composition) => {
      const state = postStateBase();
      state.regions.iran_west = { ...state.regions.iran_west, owner: 'iran', control: 100 };
      state.invasions = [{
        id: 'inv1', targetRegion: 'iran_west', composition, morale: 100, supply: 100,
        active: true, isPlayerAttacker: true
      }];
      return state;
    };

    for (const seed of [1, 2, 3, 4, 5]) {
      const armorState = buildState({ infantry: 0, armor: 25000, air: 0 });
      armorState.rngSeed = seed;
      const infantryState = buildState({ infantry: 25000, armor: 0, air: 0 });
      infantryState.rngSeed = seed;

      const armorNext = resolveTurn(armorState).invasions.find(i => i.id === 'inv1');
      const infantryNext = resolveTurn(infantryState).invasions.find(i => i.id === 'inv1');

      // Armor: repelled every time -> morale -25 AND a further 0.85 attrition scale-down.
      expect(armorNext.morale).toBe(75);
      // Infantry: stalemate every time -> morale -10 only, no extra scale-down.
      expect(infantryNext.morale).toBe(90);
    }
  });
});
