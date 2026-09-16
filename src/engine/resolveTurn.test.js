import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from '../data/types';
import { getYearsPerTurn, getCalendarAgeId, END_YEAR } from '../data/ages';

describe('resolveTurn determinism', () => {
  it('produces identical output for identical input (same rngSeed)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const a = resolveTurn(state);
    const b = resolveTurn(state);
    expect(a).toEqual(b);
  });

  it('is a no-op once the game has ended', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), gameStatus: GameStatus.DEFEAT };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while a scripted event is blocking play', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), activeEventId: 'some_event' };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while a procedural event is blocking play', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), activeProceduralEvent: { id: 'x', options: [] } };
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn calendar advance', () => {
  it('advances the year by the age/speed years-per-turn table', () => {
    const state = createInitialState({ playerNationId: 'fr', gameSpeed: 'normal' });
    const next = resolveTurn(state);
    expect(next.year).toBe(state.year + getYearsPerTurn(state.age, 'normal'));
  });

  it('advances faster at Fast speed than Marathon, all else equal', () => {
    const fast = resolveTurn(createInitialState({ playerNationId: 'fr', gameSpeed: 'fast' }));
    const marathon = resolveTurn(createInitialState({ playerNationId: 'fr', gameSpeed: 'marathon' }));
    expect(fast.year).toBeGreaterThan(marathon.year);
  });

  it('recomputes age from the new calendar year', () => {
    // Bronze -> Classical boundary is -800; jump the state right up to it.
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: -840, age: 'bronze' };
    const next = resolveTurn(state);
    expect(next.age).toBe(getCalendarAgeId(next.year));
  });

  it('increments turnNumber', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = resolveTurn(state);
    expect(next.turnNumber).toBe(state.turnNumber + 1);
  });
});

describe('resolveTurn resource income', () => {
  it('grows the player\'s gold and hr each turn', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = resolveTurn(state);
    expect(next.resources.gold).toBeGreaterThan(state.resources.gold);
    expect(next.resources.hr).toBeGreaterThan(state.resources.hr);
  });

  it('unlocks a newly-available resource at 0 the turn its age arrives', () => {
    // Classical unlocks Iron; start one tick before the boundary.
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: -820, age: 'bronze' };
    expect(state.resources.iron).toBeUndefined();
    const next = resolveTurn(state);
    expect(next.age).toBe('classical');
    expect(next.resources.iron).toBeDefined();
  });
});

describe('resolveTurn unrest drift', () => {
  it('settles unrest toward 0 when every region is at full control', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), regions: { ...createInitialState({ playerNationId: 'fr' }).regions, fr: { ...createInitialState({ playerNationId: 'fr' }).regions.fr, unrest: 10 } } };
    const next = resolveTurn(state);
    expect(next.regions.fr.unrest).toBeLessThan(10);
  });

  it('raises unrest for a region under the control threshold', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const lowControl = { ...state, regions: { ...state.regions, fr: { ...state.regions.fr, control: 10, unrest: 0 } } };
    const next = resolveTurn(lowControl);
    expect(next.regions.fr.unrest).toBeGreaterThan(0);
  });
});

describe('resolveTurn AI nations', () => {
  it('grows non-player nations\' military strength over many turns without crashing', () => {
    let state = createInitialState({ playerNationId: 'fr' });
    for (let i = 0; i < 20; i++) {
      state = resolveTurn(state);
    }
    Object.values(state.nations).forEach(n => {
      if (n.isPlayer) return;
      expect(n.militaryStrength).toBeGreaterThanOrEqual(100);
      expect(Number.isFinite(n.militaryStrength)).toBe(true);
    });
  });

  it('never touches the player nation\'s own stats via the AI pass', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = resolveTurn(state);
    expect(next.nations.fr.militaryStrength).toBe(state.nations.fr.militaryStrength);
  });
});

describe('resolveTurn victory', () => {
  it('triggers survival victory once the year reaches END_YEAR', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: END_YEAR - 1 };
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('survival');
  });

  it('does not check victory conditions while an event is pending', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: END_YEAR - 1, activeEventId: 'some_event' };
    // resolveTurn is a no-op while an event is pending (existing guard) — this just confirms
    // that guard still holds even when a victory condition would otherwise already be met.
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn event chains', () => {
  it('does not fire a chain event before its dueTurn', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 5, pendingEventChains: [{ id: 'not_registered', dueTurn: 10 }] };
    const next = resolveTurn(state);
    expect(next.activeEventId).toBeNull();
    expect(next.pendingEventChains).toEqual([{ id: 'not_registered', dueTurn: 10 }]);
  });

  it('ignores a pending entry whose id has no matching registry entry, rather than throwing', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 5, pendingEventChains: [{ id: 'not_a_real_chain', dueTurn: 6 }] };
    expect(() => resolveTurn(state)).not.toThrow();
  });
});
