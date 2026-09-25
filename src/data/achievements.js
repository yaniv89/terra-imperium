// src/data/achievements.js
// Meta-progression: cross-playthrough achievements. Each `check` is a pure predicate over a
// single state snapshot (no history tracking needed) so it can be re-evaluated cheaply after
// every state change and diffed against what's already unlocked (see src/utils/metaProgression.js).
//
// Plan §M18: "The free calendar achievements (Enter Classical/Modern Age) are replaced with skill
// ones" — reaching an age is a clock ticking, not a choice; every achievement below instead needs
// the player to have actually done something (survived a real crisis, built something, won
// something) at least once. Each reads a real, engine-tracked field rather than inventing a
// parallel history system: stability3Streak/sameDynastyStreak (src/engine/resolveTurn.js),
// hasBeenBankrupt (src/engine/economy.js's applyBankruptcy), hasCededRegionInPeace
// (src/engine/peace.js's applyPeace).
import { GameStatus } from './types';
import { getAgeIndex } from './ages';
import { getOwnedRegionIds } from './regions';
import { GREAT_PROJECTS, getGreatProjectOwner } from './greatProjects';

export const ACHIEVEMENTS = {
  iron_grip: {
    id: 'iron_grip',
    name: 'Iron Grip',
    description: 'Sustain +3 stability for 20 turns straight.',
    check: (state) => (state.nations[state.playerNationId]?.stability3Streak || 0) >= 20
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix',
    description: 'Recover from bankruptcy to a 5,000g treasury.',
    check: (state) => !!state.nations[state.playerNationId]?.hasBeenBankrupt && (state.resources.gold || 0) >= 5000
  },
  // Adapted: the plan's own "win a war against a coalition" names a system (formal AI coalitions,
  // plan §B/§12) this codebase never built — M12 kept the simpler existing hostility/opinion model
  // instead (documented there as its own scope trim). A real, checkable stand-in for "an underdog
  // war win": winning a CLOSED war (src/engine/score.js's own getWarsWonCount) against a nation
  // that currently holds more territory than you do — no history of relative strength at the war's
  // OWN start is tracked, so this reads current state rather than a stale snapshot.
  great_game: {
    id: 'great_game',
    name: 'The Great Game',
    description: 'Win a war against a nation larger than your own.',
    check: (state) => {
      const playerRegions = getOwnedRegionIds(state.regions, state.playerNationId).length;
      return (state.wars || []).some((w) => {
        if (w.active) return false;
        const wonByPlayer = (w.aggressor === state.playerNationId && (w.score || 0) > 0) ||
          (w.enemy === state.playerNationId && (w.score || 0) < 0);
        if (!wonByPlayer) return false;
        const enemyId = w.aggressor === state.playerNationId ? w.enemy : w.aggressor;
        return getOwnedRegionIds(state.regions, enemyId).length > playerRegions;
      });
    }
  },
  builder_of_wonders: {
    id: 'builder_of_wonders',
    name: 'Builder of Wonders',
    description: 'Own 3 Great Projects at tier 3.',
    check: (state) => Object.keys(GREAT_PROJECTS).filter((id) =>
      (state.greatProjects?.[id]?.tier || 0) >= 3 && getGreatProjectOwner(state, id) === state.playerNationId
    ).length >= 3
  },
  dynasty: {
    id: 'dynasty',
    name: 'Dynasty',
    description: 'Keep the same royal house for 10 consecutive rulers.',
    check: (state) => (state.nations[state.playerNationId]?.sameDynastyStreak || 0) >= 10
  },
  unbroken: {
    id: 'unbroken',
    name: 'Unbroken',
    description: 'Reach the Modern Age without ever ceding a region in a peace deal.',
    check: (state) => getAgeIndex(state.age) >= getAgeIndex('modern') && !state.nations[state.playerNationId]?.hasCededRegionInPeace
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
