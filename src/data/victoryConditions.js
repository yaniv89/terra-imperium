// src/data/victoryConditions.js
// Multiple win conditions (plan §10.4: Domination / Space Ascendancy / Economic Hegemony /
// Diplomatic / Score). Each condition here is a pure predicate over a resolved state snapshot,
// checked every turn in resolveTurn.js; the first one satisfied ends the game and its id is
// recorded so a game-over screen can show which victory was actually achieved. Adding a condition
// here is additive and never requires touching resolveTurn.js, which just iterates this table.

import { GameStatus } from './types';
import { END_YEAR } from './ages';
import { getCapital, getNationCapital } from './regions';
import { FINAL_SPACE_MISSION_ID } from './spaceMissions';

// Retargeted to the tile world (plans/civ-map-rework.md C10): domination counts the CAPITALS held,
// conqueror counts the CITIES held, economic hegemony counts the world's gold income and the
// player's trade, score counts population, wonders and techs (score.js).
// Domination: the capitals of DOMINATION_CAPITAL_SHARE of every other nation under the player's
// flag (their historic seat or wherever they moved it after losing it; a nation eliminated by
// elimination.js still counts), rewarding decapitating strikes on the seats of power.
export const DOMINATION_CAPITAL_SHARE = 0.25;
// Conqueror: CONQUEROR_CITY_SHARE of the world's cities (outposts included) held by the player.
export const CONQUEROR_CITY_SHARE = 0.4;
// Economic hegemony: the player's share of the world's gold income (every city's last yields, the
// same number the cities phase mirrors into dev) plus a trade route's share of each partner's own
// gold (ECONOMIC_ROUTE_SHARE, so trade scales with the world's economy and a Dawn world of one-city
// nations cannot be bought with agreements alone), at ECONOMIC_HEGEMONY_SHARE or more.
export const ECONOMIC_HEGEMONY_SHARE = 0.35;
export const ECONOMIC_ROUTE_SHARE = 0.4; // trade with the whole world alone tops out at 0.4 / 1.4 = 0.29
// The older names, for readers written against the province world.
export const DOMINATION_REGION_SHARE = CONQUEROR_CITY_SHARE;
export const CONQUEROR_CAPITAL_SHARE = DOMINATION_CAPITAL_SHARE;
export const ECONOMIC_HEGEMONY_GDP_SHARE = ECONOMIC_HEGEMONY_SHARE;

/** The player's share of the world's gold income, trade included: { share, mine, world, routes }. */
export const getEconomicShare = (state) => {
  let mine = 0; let world = 0;
  const byNation = {};
  Object.values(state.regions || {}).forEach((c) => {
    if (!c.owner) return;
    const gold = Math.max(0, c.lastYields?.gold ?? c.dev?.tax ?? 0);
    world += gold;
    byNation[c.owner] = (byNation[c.owner] || 0) + gold;
    if (c.owner === state.playerNationId) mine += gold;
  });
  const routes = Object.values(state.nations || {}).reduce((s, n) => (!n.isPlayer && n.hasTradeAgreement ? s + (byNation[n.id] || 0) * ECONOMIC_ROUTE_SHARE : s), 0);
  mine += routes; world += routes;
  return { share: world > 0 ? mine / world : 0, mine, world, routes };
};
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
  // Only nations still in the game — an eliminated nation can't be befriended, and counting it made
  // every AI conquest quietly push this victory further out of reach.
  const others = Object.values(state.nations).filter(n => !n.isPlayer && !n.isEliminated);
  if (others.length === 0) return 0;
  return others.filter(isDiplomaticallyAligned).length / others.length;
};

export const VICTORY_CONDITIONS = {
  domination: {
    id: 'domination',
    name: 'Domination Victory',
    description: `Hold the capital of at least ${Math.round(DOMINATION_CAPITAL_SHARE * 100)}% of the world's other nations.`,
    check: (state) => {
      const others = Object.values(state.nations).filter(n => !n.isPlayer);
      if (others.length === 0) return false;
      // Their historic capital or wherever they moved it after losing it — conquering the capital
      // relocates it (src/engine/conquest.js), and taking it should still count.
      const held = (id) => !!id && state.regions[id]?.owner === state.playerNationId;
      const capitalsHeld = others.filter(n => held(getCapital(state, n.id)) || held(state.scenario?.starts?.[n.id] || getNationCapital(n.id))).length;
      return capitalsHeld / others.length >= DOMINATION_CAPITAL_SHARE;
    }
  },
  conqueror: {
    id: 'conqueror',
    name: 'Conqueror Victory',
    description: `Hold at least ${Math.round(CONQUEROR_CITY_SHARE * 100)}% of the world's cities.`,
    check: (state) => {
      const total = Object.keys(state.regions).length;
      if (total === 0) return false;
      const owned = Object.values(state.regions).filter(r => r.owner === state.playerNationId).length;
      return owned / total >= CONQUEROR_CITY_SHARE;
    }
  },
  economicHegemony: {
    id: 'economicHegemony',
    name: 'Economic Hegemony Victory',
    description: `Earn at least ${Math.round(ECONOMIC_HEGEMONY_SHARE * 100)}% of the world's gold, trade included.`,
    check: (state) => { const { share, world } = getEconomicShare(state); return world > 0 && share >= ECONOMIC_HEGEMONY_SHARE; }
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
  // Plan §M18: "Remove the free win. survival no longer grants VICTORY." — reaching END_YEAR is no
  // longer a `check` in this table at all; it's handled as its own ranked step in resolveTurn.js
  // (src/engine/score.js), since "did the game end at the calendar limit" and "did THIS PARTICULAR
  // AMBITION'S threshold get met" are different enough shapes (one needs to rank against all 240
  // nations, not just check the player) that forcing them through one `check(state) -> bool`
  // signature would be more confusing than the two real entries below, kept for GameOverModal's
  // `VICTORY_CONDITIONS[state.victoryConditionId]` display lookup — their own `check` always
  // returns false since neither is ever meant to fire through this table's own loop.
  eventVictory: {
    id: 'eventVictory',
    name: 'Victory',
    description: 'A decisive turning point secured your nation\'s triumph.',
    check: () => false
  },
  finalScore: {
    id: 'finalScore',
    name: 'Score Victory',
    description: `Lead your nation to the highest score in the world by ${END_YEAR}.`,
    check: () => false
  }
};

// Returns the id of the first satisfied AMBITION, or null — an ambition already recorded in
// `state.victoriesAchieved` (plan §M18: "Continue playing after victory") is skipped, so choosing
// to keep playing past an earlier win doesn't immediately re-trigger the SAME game-over screen the
// very next turn just because its threshold is, naturally, still met.
export const checkVictoryConditions = (state) => {
  const alreadyAchieved = state.victoriesAchieved || [];
  const satisfied = Object.values(VICTORY_CONDITIONS).find(
    (condition) => !alreadyAchieved.includes(condition.id) && condition.check(state)
  );
  return satisfied ? satisfied.id : null;
};

// Applies a victory: sets gameStatus and records which condition triggered it, for a game-over screen.
export const applyVictory = (state, conditionId) => ({
  ...state,
  gameStatus: GameStatus.VICTORY,
  victoryConditionId: conditionId
});
