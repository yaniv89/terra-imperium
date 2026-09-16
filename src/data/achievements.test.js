import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, checkAchievements } from './achievements';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from './types';

describe('checkAchievements', () => {
  it('reports nothing for a brand-new game', () => {
    const state = createInitialState();
    expect(checkAchievements(state)).toEqual([]);
  });

  it('detects enter_classical_age once the age advances', () => {
    const bronze = createInitialState();
    expect(checkAchievements(bronze)).not.toContain('enter_classical_age');

    const classical = { ...bronze, age: 'classical' };
    expect(checkAchievements(classical)).toContain('enter_classical_age');
  });

  it('detects enter_modern_age only once modern is reached', () => {
    const kingdoms = { ...createInitialState(), age: 'kingdoms' };
    expect(checkAchievements(kingdoms)).not.toContain('enter_modern_age');

    const modern = { ...createInitialState(), age: 'modern' };
    expect(checkAchievements(modern)).toContain('enter_modern_age');
  });

  it('detects survive_to_victory only on GameStatus.VICTORY', () => {
    const active = createInitialState();
    expect(checkAchievements(active)).not.toContain('survive_to_victory');

    const won = { ...createInitialState(), gameStatus: GameStatus.VICTORY };
    expect(checkAchievements(won)).toContain('survive_to_victory');
  });

  it('detects master_diplomat at exactly the 3-nation threshold, not below it', () => {
    const state = createInitialState();
    const nationIds = Object.keys(state.nations).filter(id => !state.nations[id].isPlayer);

    const twoFriendly = { ...state, nations: { ...state.nations } };
    nationIds.slice(0, 2).forEach(id => {
      twoFriendly.nations[id] = { ...twoFriendly.nations[id], hasPeaceTreaty: true };
    });
    expect(checkAchievements(twoFriendly)).not.toContain('master_diplomat');

    const threeFriendly = { ...state, nations: { ...state.nations } };
    nationIds.slice(0, 3).forEach(id => {
      threeFriendly.nations[id] = { ...threeFriendly.nations[id], hasPeaceTreaty: true };
    });
    expect(checkAchievements(threeFriendly)).toContain('master_diplomat');
  });

  it('detects tech_titan once 12+ techs are researched', () => {
    const state = createInitialState();
    const fakeTechTree = {};
    for (let i = 0; i < 12; i++) fakeTechTree[`tech_${i}`] = { researched: true };
    const researched = { ...state, techTree: fakeTechTree };
    expect(checkAchievements(researched)).toContain('tech_titan');
    expect(checkAchievements(state)).not.toContain('tech_titan');
  });

  it('detects three_front_war at 3 simultaneous wars', () => {
    const state = createInitialState();
    const nationIds = Object.keys(state.nations).filter(id => !state.nations[id].isPlayer).slice(0, 3);
    const atWar = { ...state, nations: { ...state.nations } };
    nationIds.forEach(id => { atWar.nations[id] = { ...atWar.nations[id], isAtWar: true }; });
    expect(checkAchievements(atWar)).toContain('three_front_war');
  });

  it('every ACHIEVEMENTS entry has an id matching its key and a check function', () => {
    Object.entries(ACHIEVEMENTS).forEach(([key, def]) => {
      expect(def.id).toBe(key);
      expect(typeof def.check).toBe('function');
      expect(typeof def.name).toBe('string');
    });
  });
});
