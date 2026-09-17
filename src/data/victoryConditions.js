// src/data/victoryConditions.js
// Multiple win conditions (plan §10.4: Domination / Space Ascendancy / Economic Hegemony /
// Diplomatic / Score). Each condition here is a pure predicate over a resolved state snapshot,
// checked every turn in resolveTurn.js; the first one satisfied ends the game and its id is
// recorded so a game-over screen can show which victory was actually achieved. Adding a condition
// here is additive and never requires touching resolveTurn.js, which just iterates this table.

import { GameStatus } from './types';
import { END_YEAR } from './ages';
import { WORLD_NATIONS } from './worldNations';
import { FINAL_SPACE_MISSION_ID } from './spaceMissions';

// Domination: a real share of the world's regions (each region is a whole nation, one-per-nation
// in this phase — see regions.js) held by the player.
export const DOMINATION_REGION_SHARE = 0.4;
// Economic Hegemony: a real share of the world's total GDP, using every NATION's own static
// gdpMillions (WORLD_NATIONS, sourced from real-world countries-meta.json figures — region-level
// REGIONS_DATA has no gdpMillions field of its own) — the closest thing to "world trade share"
// this data model can compute without simulating every AI nation's own economy in full.
export const ECONOMIC_HEGEMONY_GDP_SHARE = 0.35;
// Diplomatic: friendly standing (trade, alliance, or genuinely low hostility) with a majority of
// every other nation, SUSTAINED for a real stretch of turns (state.diplomaticLeadershipStreak,
// incremented in resolveTurn.js) — a momentary majority shouldn't win outright; "leadership" per
// the plan implies holding it.
export const DIPLOMATIC_LEADERSHIP_SHARE = 0.5;
export const DIPLOMATIC_LEADERSHIP_STREAK_TURNS = 20;

// Genuine engagement only (a trade agreement or a military pact the player actually formed) — NOT
// low hostility on its own. Every nation starts at hostility 5 (src/data/worldNations.js), so a
// mere "not hostile" bar would make this trivially true for the whole passive world by default,
// turning "Diplomatic Victory" into an accidental win a few turns into any peaceful game rather
// than the real, deliberate leadership the plan describes.
export const isDiplomaticallyAligned = (nation) => !!(nation.hasTradeAgreement || nation.hasMilitaryPact);

// The share of every OTHER nation the player currently holds friendly standing with — exported so
// resolveTurn.js can both check it for the streak counter and reuse the exact same math.
export const getDiplomaticAlignmentShare = (state) => {
  const others = Object.values(state.nations).filter(n => !n.isPlayer);
  if (others.length === 0) return 0;
  return others.filter(isDiplomaticallyAligned).length / others.length;
};

export const VICTORY_CONDITIONS = {
  domination: {
    id: 'domination',
    name: 'Domination Victory',
    description: `Hold at least ${Math.round(DOMINATION_REGION_SHARE * 100)}% of the world's regions.`,
    check: (state) => {
      const total = Object.keys(state.regions).length;
      if (total === 0) return false;
      const owned = Object.values(state.regions).filter(r => r.owner === state.playerNationId).length;
      return owned / total >= DOMINATION_REGION_SHARE;
    }
  },
  economicHegemony: {
    id: 'economicHegemony',
    name: 'Economic Hegemony Victory',
    description: `Command at least ${Math.round(ECONOMIC_HEGEMONY_GDP_SHARE * 100)}% of the world's total GDP.`,
    check: (state) => {
      let ownedGdp = 0;
      let totalGdp = 0;
      Object.entries(state.regions).forEach(([id, region]) => {
        const gdp = WORLD_NATIONS[id]?.gdpMillions || 0;
        totalGdp += gdp;
        if (region.owner === state.playerNationId) ownedGdp += gdp;
      });
      if (totalGdp === 0) return false;
      return ownedGdp / totalGdp >= ECONOMIC_HEGEMONY_GDP_SHARE;
    }
  },
  diplomatic: {
    id: 'diplomatic',
    name: 'Diplomatic Victory',
    description: `Sustain friendly standing with a majority of the world for ${DIPLOMATIC_LEADERSHIP_STREAK_TURNS} turns.`,
    check: (state) => (state.diplomaticLeadershipStreak || 0) >= DIPLOMATIC_LEADERSHIP_STREAK_TURNS
  },
  spaceAscendancy: {
    id: 'spaceAscendancy',
    name: 'Space Ascendancy Victory',
    description: 'Complete the entire space mission ladder.',
    check: (state) => (state.completedMissions || []).includes(FINAL_SPACE_MISSION_ID)
  },
  survival: {
    id: 'survival',
    name: 'Score Victory',
    description: `Lead your nation all the way to ${END_YEAR}.`,
    check: (state) => state.year >= END_YEAR
  }
};

// Returns the id of the first satisfied victory condition, or null.
export const checkVictoryConditions = (state) => {
  const satisfied = Object.values(VICTORY_CONDITIONS).find(condition => condition.check(state));
  return satisfied ? satisfied.id : null;
};

// Applies a victory: sets gameStatus and records which condition triggered it, for a game-over screen.
export const applyVictory = (state, conditionId) => ({
  ...state,
  gameStatus: GameStatus.VICTORY,
  victoryConditionId: conditionId
});
