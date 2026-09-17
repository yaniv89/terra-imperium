// src/utils/aiLogic.js
// AI logic for non-player nations: passive economic growth, hostility drift, and — Task 23 — a
// tiered decision loop (plan §8.5). 240 nations can't all think hard every turn, so only Tier 1
// (at war, bordering the player, or top-20 by military) actually evaluates a war declaration each
// turn; Tier 2/3 nations still get the passive growth/drift every nation gets, just nothing more
// expensive. Counter-building (reading a rival's visible unit composition and recruiting the
// counter) needs AI nations to have real recruited units in state.units first, which they don't
// yet — that's real, separate follow-up work, not something this task fakes with a number bump.
//
// Task 24 adds two things on top of that loop: difficulty scales every Tier 1 nation's war-roll
// chance by state.difficultyMultiplier (src/data/difficulty.js's aiAggressionMult — set at game
// start, previously declared but never read anywhere), and coalitions (plan §8's "AI bands
// against a runaway leader") bias Tier 1 nations toward attacking whoever — AI or the player —
// holds a runaway share of the world's military. There's no new alliance data structure for this:
// coalition members just get a much larger roll chance specifically against the leader, and
// prefer the leader as a target over any other neighbor. AI nations forming alliances with each
// other is future work; this is the scripted "the world gangs up on the leader" behavior the plan
// asks for using only the war-declaration machinery that already exists.

import { DOCTRINES } from '../data/nations';
import { RelationStatus } from '../data/types';
import { getNeighborIds } from '../data/regions';
import { declareWar } from '../engine/diplomacy';

const DEFAULT_RNG = { next: () => Math.random() };
const DEFAULT_DOCTRINE = DOCTRINES.attrition;

// Nations ranked by military strength enter Tier 1 regardless of geography — a great power's
// moves matter globally, not just to its neighbors.
const TOP_MILITARY_TIER_1_COUNT = 20;
// The base per-turn probability a Tier 1 nation rolls to declare war, before its doctrine's
// warRollMult, the difficulty's aiAggressionMult, any coalition bonus, and its own hostility scale
// it up or down.
const BASE_WAR_ROLL_CHANCE = 0.02;

// A nation (AI or the player) commanding this share of the world's total military strength is a
// runaway leader — real numbers are tiny at game start (the largest starting nation is well under
// 1% of the world total, see worldNations.test.js), so this only fires after a lot of unchecked
// compounding growth, exactly when the plan wants the world to start pushing back.
export const COALITION_MILITARY_SHARE_THRESHOLD = 0.15;
// A coalition member's roll chance against the runaway leader specifically, on top of every other
// multiplier — large enough that "the world gangs up" is a real, visible pressure once it starts.
const COALITION_WAR_ROLL_MULT = 4;
// Every Tier 1 coalition member's hostility ratchets toward the leader each turn a coalition is
// active, reusing the existing single hostility scalar (already the aggregate "how justified/
// likely a war" stat every other diplomacy action reads and writes) rather than adding a new
// pairwise relation just for this.
const COALITION_HOSTILITY_RISE_PER_TURN = 3;

// The nation with the largest share of world military strength, if that share clears the
// coalition threshold — otherwise null. Pure and cheap: one pass over the nations already in
// hand, no new state.
export const findRunawayLeader = (nations) => {
  const entries = Object.values(nations);
  const total = entries.reduce((sum, n) => sum + (n.militaryStrength || 0), 0);
  if (total <= 0) return null;
  const leader = entries.reduce((max, n) => (n.militaryStrength > (max?.militaryStrength || 0) ? n : max), null);
  if (!leader || leader.militaryStrength / total < COALITION_MILITARY_SHARE_THRESHOLD) return null;
  return leader.id;
};

// Tier 1: at war, bordering the player, or ranked in the top 20 by military strength — the AI
// that gets the full evaluation loop. Tier 2: has neighbors and is worth a cheap reactive check
// (not built yet — reserved for the game-scale AI pass, plan §8.5's "cheap, reactive" tier).
// Tier 3: everyone else, passive-only. `sortedByMilitary` is every non-player nation id ranked
// descending — computed once per turn by the caller, not per nation, to keep this affordable
// across 240 nations.
export const getNationTier = (state, nationId, sortedByMilitary) => {
  const nation = state.nations[nationId];
  if (!nation || nation.isPlayer) return null;
  if (nation.isAtWar) return 1;
  if (getNeighborIds(nationId).includes(state.playerNationId)) return 1;
  const rank = sortedByMilitary.indexOf(nationId);
  if (rank !== -1 && rank < TOP_MILITARY_TIER_1_COUNT) return 1;
  if (getNeighborIds(nationId).length > 0) return 2;
  return 3;
};

export const getSortedByMilitary = (state) =>
  Object.values(state.nations)
    .filter(n => !n.isPlayer)
    .sort((a, b) => b.militaryStrength - a.militaryStrength)
    .map(n => n.id);

// Among a nation's bordering nations (including the player) not already at war, the weakest one
// — "attacks the weakest valuable region reachable", not the nearest pixel, per the plan. A
// coalition member with a valid shot at the runaway leader ignores that and goes straight for the
// leader instead, regardless of how it compares to other neighbors — that's the whole point of
// ganging up on it.
const pickWarTarget = (state, nationId, preferredTargetId = null) => {
  const candidates = getNeighborIds(nationId).filter(id => state.nations[id] && !state.nations[id].isAtWar);
  if (candidates.length === 0) return null;
  if (preferredTargetId && candidates.includes(preferredTargetId)) return preferredTargetId;
  return candidates.reduce((weakest, id) =>
    (state.nations[id].militaryStrength < state.nations[weakest].militaryStrength ? id : weakest), candidates[0]);
};

const shouldDeclareWar = (nation, rng, aggressionMult = 1, coalitionMult = 1) => {
  const doctrine = DOCTRINES[nation.doctrine] || DEFAULT_DOCTRINE;
  if (doctrine.warRollMult <= 0) return false;
  const chance = BASE_WAR_ROLL_CHANCE * doctrine.warRollMult * aggressionMult * coalitionMult * (nation.hostility / 100 + 0.2);
  return rng.next() < chance;
};

// Tier 1 nations may each declare one war this turn, biased by their own doctrine, hostility, the
// game's difficulty (state.difficultyMultiplier), and any active coalition against a runaway
// leader. Pure: takes the in-progress `nations`/`wars` resolveTurn.js has built so far this turn
// and returns updated versions, threading src/engine/diplomacy.js's declareWar so a war an AI
// starts is identical in shape to one the player starts.
export const processAIWarDecisions = (state, nations, wars, sortedByMilitary, rng) => {
  let currentNations = nations;
  let currentWars = wars;
  const logs = [];
  const aggressionMult = state.difficultyMultiplier || 1;
  const runawayLeaderId = findRunawayLeader(nations);

  Object.keys(nations).forEach(nationId => {
    // Re-read from currentNations, not the original `nations` snapshot — a nation earlier in this
    // same pass may just have been dragged into a war as someone's target, and a freshly-invaded
    // nation shouldn't also get to fire off its own declaration this turn.
    const nation = currentNations[nationId];
    if (!nation || nation.isPlayer || nation.isAtWar) return;
    if (getNationTier({ ...state, nations: currentNations }, nationId, sortedByMilitary) !== 1) return;

    const isCoalitionMember = !!runawayLeaderId && runawayLeaderId !== nationId;
    if (isCoalitionMember) {
      currentNations = {
        ...currentNations,
        [nationId]: { ...nation, hostility: Math.min(100, (nation.hostility || 0) + COALITION_HOSTILITY_RISE_PER_TURN) }
      };
    }
    const activeNation = currentNations[nationId];
    const leader = isCoalitionMember ? currentNations[runawayLeaderId] : null;
    const canStrikeLeader = !!leader && !leader.isAtWar && getNeighborIds(nationId).includes(runawayLeaderId);

    if (!shouldDeclareWar(activeNation, rng, aggressionMult, canStrikeLeader ? COALITION_WAR_ROLL_MULT : 1)) return;
    const targetId = pickWarTarget({ ...state, nations: currentNations }, nationId, canStrikeLeader ? runawayLeaderId : null);
    if (!targetId) return;
    const result = declareWar({ ...state, nations: currentNations, wars: currentWars }, targetId, { aggressor: nationId });
    if (result.wars === currentWars) return; // no-op (shouldn't happen given the isAtWar filter above, but stay defensive)
    currentNations = result.nations;
    currentWars = result.wars;
    const targetName = state.nations[targetId]?.name || targetId;
    logs.push({
      message: targetId === runawayLeaderId
        ? `${nation.name} joins a coalition against ${targetName}, the world's runaway power, and declares war!`
        : `${nation.name} has declared war on ${targetName}!`,
      type: 'diplomacy'
    });
  });
  return { nations: currentNations, wars: currentWars, logs };
};

// Process AI turn for a single nation. `rng` must be a { next(): number } generator
// (see src/utils/rng.js) so turn resolution stays deterministic and replayable.
export const processAINationTurn = (nation, state, year, rng = DEFAULT_RNG) => {
  const updates = { militaryStrengthChange: 0, hostilityChange: 0, logs: [] };
  if (nation.isPlayer) return updates;

  const doctrine = DOCTRINES[nation.doctrine] || DEFAULT_DOCTRINE;

  // Passive economic growth — nations build military over time (cautious doctrines grow faster).
  const baseGrowth = Math.floor(nation.militaryStrength * 0.01 * doctrine.economyGrowthMult);
  const economyBonus = Math.floor(rng.next() * 50 * doctrine.economyGrowthMult);
  updates.militaryStrengthChange = baseGrowth + economyBonus;

  // Hostility drifts down toward its floor over time — no scripted conflict is pushing it up in
  // the other direction yet (that's Phase D's casus belli / AI war-decision work).
  const hostilityFloor = nation.hostilityFloor || 0;
  if (nation.hostility > hostilityFloor) {
    updates.hostilityChange = -1;
  }

  return updates;
};

// Process all AI nations for a turn. Returns per-nation strength/hostility deltas.
export const processAllAINations = (state, year, rng = DEFAULT_RNG) => {
  const allUpdates = { nationUpdates: {}, logs: [] };

  Object.values(state.nations).forEach(nation => {
    if (nation.isPlayer) return;
    const updates = processAINationTurn(nation, state, year, rng);
    allUpdates.nationUpdates[nation.id] = {
      militaryStrengthChange: updates.militaryStrengthChange,
      hostilityChange: updates.hostilityChange
    };
    allUpdates.logs.push(...updates.logs);
  });

  return allUpdates;
};

// Get relation status from hostility.
export const getRelationFromHostility = (hostility, isAtWar, hasPeace, hasTrade) => {
  if (isAtWar) return RelationStatus.WAR;
  if (hasTrade) return RelationStatus.FRIENDLY;
  if (hasPeace) return RelationStatus.COLD_PEACE;
  if (hostility >= 80) return RelationStatus.HOSTILE;
  return RelationStatus.NEUTRAL;
};
