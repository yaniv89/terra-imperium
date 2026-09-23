// src/data/victoryConditions.js
// Multiple win conditions (plan §10.4: Domination / Space Ascendancy / Economic Hegemony /
// Diplomatic / Score). Each condition here is a pure predicate over a resolved state snapshot,
// checked every turn in resolveTurn.js; the first one satisfied ends the game and its id is
// recorded so a game-over screen can show which victory was actually achieved. Adding a condition
// here is additive and never requires touching resolveTurn.js, which just iterates this table.

import { GameStatus } from './types';
import { END_YEAR } from './ages';
import { REGIONS_DATA, getNationCapital } from './regions';
import { FINAL_SPACE_MISSION_ID } from './spaceMissions';

// Domination: a real share of the world's regions (real admin-1 provinces — see regions.js) held
// by the player.
export const DOMINATION_REGION_SHARE = 0.4;
// Conqueror: a share of every OTHER nation's capital region under the player's flag — a different
// flavor of dominance than Domination's raw region-count share, rewarding decapitating strikes on
// the seats of power (including nations fully eliminated by src/engine/elimination.js, whose
// former capital the player necessarily already holds) rather than grinding through peripheral
// provinces. Set comparably "late-game dominant" to Domination's 40% region share: ~25% of the
// ~239 other nations is ~60 capitals.
export const CONQUEROR_CAPITAL_SHARE = 0.25;
// Economic Hegemony: a real share of the world's total GDP, using each region's own gdpMillions
// (REGIONS_DATA, a province's share of its country's real countries-meta.json GDP figure — see
// build-world-regions.mjs) — the closest thing to "world trade share" this data model can compute
// without simulating every AI nation's own economy in full.
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
  conqueror: {
    id: 'conqueror',
    name: 'Conqueror Victory',
    description: `Hold the capital of at least ${Math.round(CONQUEROR_CAPITAL_SHARE * 100)}% of the world's other nations.`,
    check: (state) => {
      const others = Object.values(state.nations).filter(n => !n.isPlayer);
      if (others.length === 0) return false;
      const capitalsHeld = others.filter(n => {
        const capitalId = getNationCapital(n.id);
        return capitalId && state.regions[capitalId]?.owner === state.playerNationId;
      }).length;
      return capitalsHeld / others.length >= CONQUEROR_CAPITAL_SHARE;
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
        const gdp = REGIONS_DATA[id]?.gdpMillions || 0;
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
