import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, checkAchievements } from './achievements';
import { createInitialState } from '../context/GameContext';
import { GamePhases, GameStatus } from './types';

describe('checkAchievements', () => {
  it('reports nothing for a brand-new PRE_STATE game', () => {
    const state = createInitialState();
    expect(checkAchievements(state)).toEqual([]);
  });

  it('detects declare_independence once the phase flips to POST_STATE', () => {
    const state = { ...createInitialState(), phase: GamePhases.POST_STATE };
    expect(checkAchievements(state)).toContain('declare_independence');
  });

  it('detects survive_to_2000 only once BOTH post-state AND year >= 2000 hold', () => {
    const preState2000 = { ...createInitialState(), year: 2000 }; // still PRE_STATE
    expect(checkAchievements(preState2000)).not.toContain('survive_to_2000');

    const postState1990 = { ...createInitialState(), phase: GamePhases.POST_STATE, year: 1990 };
    expect(checkAchievements(postState1990)).not.toContain('survive_to_2000');

    const postState2000 = { ...createInitialState(), phase: GamePhases.POST_STATE, year: 2000 };
    expect(checkAchievements(postState2000)).toContain('survive_to_2000');
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
    const techIds = Object.keys(state.techTree).slice(0, 12);
    const researched = { ...state, techTree: { ...state.techTree } };
    techIds.forEach(id => { researched.techTree[id] = { ...researched.techTree[id], researched: true }; });
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
