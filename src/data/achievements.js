// src/data/achievements.js
// Meta-progression: cross-playthrough achievements. Each `check` is a pure predicate over a
// single state snapshot (no history tracking needed) so it can be re-evaluated cheaply after
// every state change and diffed against what's already unlocked (see src/utils/metaProgression.js).

import { GameStatus } from './types';
import { getAgeIndex } from './ages';

export const ACHIEVEMENTS = {
  enter_classical_age: {
    id: 'enter_classical_age',
    name: 'Beyond the Bronze',
    description: 'Advance your nation into the Classical Age.',
    check: (state) => getAgeIndex(state.age) >= getAgeIndex('classical')
  },
  enter_modern_age: {
    id: 'enter_modern_age',
    name: 'Into the Modern World',
    description: 'Advance your nation into the Modern Age.',
    check: (state) => getAgeIndex(state.age) >= getAgeIndex('modern')
  },
  survive_to_victory: {
    id: 'survive_to_victory',
    name: 'Terra Imperium',
    description: 'Win the game.',
    check: (state) => state.gameStatus === GameStatus.VICTORY
  },
  master_diplomat: {
    id: 'master_diplomat',
    name: 'Master Diplomat',
    description: 'Hold peace treaties or trade agreements with at least 3 nations at once.',
    check: (state) => Object.values(state.nations)
      .filter(n => !n.isPlayer && (n.hasPeaceTreaty || n.hasTradeAgreement)).length >= 3
  },
  tech_titan: {
    id: 'tech_titan',
    name: 'Tech Titan',
    description: 'Research at least 12 technologies.',
    check: (state) => Object.values(state.techTree).filter(t => t.researched).length >= 12
  },
  three_front_war: {
    id: 'three_front_war',
    name: 'Three-Front War',
    description: 'Be simultaneously at war with 3 or more nations.',
    check: (state) => Object.values(state.nations).filter(n => !n.isPlayer && n.isAtWar).length >= 3
  }
};

// Returns the ids of every achievement this exact state snapshot currently satisfies. The
// caller (GameProvider) diffs this against what's already persisted to find newly-earned ones —
// this function itself has no notion of "newly" earned, only "currently" true.
export const checkAchievements = (state) =>
  Object.values(ACHIEVEMENTS).filter(a => a.check(state)).map(a => a.id);
