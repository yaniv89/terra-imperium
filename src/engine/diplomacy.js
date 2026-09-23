// src/engine/diplomacy.js
// Pure diplomatic state transitions shared between the reducer (player-initiated actions) and
// resolveTurn.js (AI-initiated wars). Keeping one implementation means a war declared by the
// player and one declared by an AI nation always produce the same shape of state change. Every
// nation (the player's included) is just an entry in state.nations with the same militaryStrength
// stat, so none of this needs to special-case which nation is the player.

import { RelationStatus } from '../data/types';
import { isAdjacentToOwner, REGIONS_DATA } from '../data/regions';
import { CAPTURE_PREFERRING_DOCTRINES } from '../data/nations';
import { getFormerOwnerOnConquest } from '../data/rebellion';

// A casus belli (plan §8/§9's "unjustified wars cost stability and global relations"): either a
// claim the aggressor already fabricated against this target (FABRICATE_CLAIM), or a naturally
// hostile relationship that needs no manufacturing. War without either is still possible — it's
// just costlier and carries a real diplomatic penalty (see GameContext.jsx's DECLARE_WAR).
export const CASUS_BELLI_HOSTILITY_THRESHOLD = 70;

export const hasCasusBelli = (state, aggressorId, targetId) => {
  const aggressor = state.nations[aggressorId];
  const target = state.nations[targetId];
  if (aggressor?.claims?.includes(targetId)) return true;
  return (target?.hostility || 0) >= CASUS_BELLI_HOSTILITY_THRESHOLD;
};

// Finds a region owned by `ownerId` that borders territory `attackerId` already holds — the
// natural "next target" for a war goal.
const findCaptureTarget = (regions, ownerId, attackerId) =>
  Object.keys(regions).find(id => regions[id].owner === ownerId && isAdjacentToOwner(id, regions, attackerId)) || null;

// Builds a war goal of a SPECIFIC type — exported so a player can pick one explicitly rather than
// only ever getting an auto-assigned one. Gracefully falls back to destroy_military if
// 'capture_region' is requested but no valid bordering target exists.
export const buildWarGoal = (state, nationId, aggressor, type) => {
  if (type === 'capture_region') {
    const targetRegion = findCaptureTarget(state.regions, nationId, aggressor);
    if (targetRegion) return { type: 'capture_region', regionId: targetRegion };
  }
  const nation = state.nations[nationId];
  return { type: 'destroy_military', threshold: Math.round((nation?.militaryStrength || 1000) * 0.5) };
};

// Picks a war goal for a newly-declared war when the caller doesn't supply one. Every war has a
// concrete objective instead of running until hostility happens to decay enough to seek peace.
export const assignDefaultWarGoal = (state, nationId, aggressor) => {
  // The human player always prefers taking territory over grinding down an army — this is a UI
  // default, not a doctrine-driven AI behavior.
  if (aggressor === state.playerNationId) {
    return buildWarGoal(state, nationId, aggressor, 'capture_region');
  }
  const aggressorNation = state.nations[aggressor];
  // Blitz/opportunist doctrines fight for territory; attrition/cautious nations (when they do go
  // to war) grind down the defender's army instead.
  const prefersCapture = CAPTURE_PREFERRING_DOCTRINES.includes(aggressorNation?.doctrine);
  return buildWarGoal(state, nationId, aggressor, prefersCapture ? 'capture_region' : 'destroy_military');
};

// A war record names an `aggressor` and an `enemy`, not "the player's side" and "the other side"
// — either nation could be either one, depending on who declared on whom. Callers that make peace
// or check status FROM one nation's perspective (e.g. "the player is suing nationId for peace")
// need to match a war regardless of which of the two fields holds which id.
export const isWarBetween = (war, idA, idB) =>
  (war.aggressor === idA && war.enemy === idB) || (war.aggressor === idB && war.enemy === idA);

// nation.isAtWar is true whenever a nation is in ANY war, anywhere — that's the correct signal for
// AI-tiering (a nation embroiled in a war becomes globally relevant) but it is NOT "at war with the
// player", and player-facing UI (map coloring, war badges, the diplomacy/military tab war lists)
// must use this instead, or two AI nations fighting each other lights up as if they'd attacked you.
export const isAtWarWithPlayer = (state, nationId) =>
  state.wars.some((w) => w.active && isWarBetween(w, state.playerNationId, nationId));

// True once a war's goal condition is actually met. Pure and side-effect-free — the caller
// (resolveTurn.js) decides what to do with a newly-achieved goal.
export const checkWarGoal = (war, state) => {
  if (!war.goal || war.goalAchieved || !war.active) return false;

  if (war.goal.type === 'capture_region') {
    const region = state.regions[war.goal.regionId];
    return !!region && region.owner === war.aggressor;
  }

  if (war.goal.type === 'destroy_military') {
    const nation = state.nations[war.enemy];
    return !!nation && nation.militaryStrength <= war.goal.threshold;
  }

  return false;
};

// Declares war on `nationId`. No-op (returns state unchanged) if the nation doesn't exist or is
// already at war. If the target had a peace treaty, this sets a permanent hostilityFloor — the
// nation remembers the betrayal and can never fully cool back down, even after a later peace.
// Marks BOTH sides isAtWar — every isAtWar reader in the codebase (UI war counts, the globe's
// war-red coloring, resolveTurn.js's war exhaustion accrual, aiLogic.js's "one war per turn" gate)
// means "this nation is currently a belligerent," not "this nation is currently a war's target."
export const declareWar = (state, nationId, { aggressor, goal = null } = {}) => {
  const nation = state.nations[nationId];
  if (!nation || nation.isAtWar) return state;

  const brokePeace = !!nation.hasPeaceTreaty;
  const resolvedGoal = goal || assignDefaultWarGoal(state, nationId, aggressor);
  const aggressorNation = state.nations[aggressor];
  // A fabricated claim is spent the moment it justifies a war — it doesn't carry over to the next one.
  const nextNations = {
    ...state.nations,
    [nationId]: {
      ...nation,
      isAtWar: true,
      hostility: 100,
      relationStatus: RelationStatus.WAR,
      hostilityFloor: brokePeace ? Math.max(nation.hostilityFloor || 0, 40) : (nation.hostilityFloor || 0)
    }
  };
  if (aggressorNation) {
    nextNations[aggressor] = {
      ...aggressorNation,
      isAtWar: true,
      relationStatus: RelationStatus.WAR,
      claims: aggressorNation.claims?.includes(nationId)
        ? aggressorNation.claims.filter((id) => id !== nationId)
        : aggressorNation.claims
    };
  }
  return {
    ...state,
    nations: nextNations,
    wars: [...state.wars, {
      id: `war_${nationId}_${state.year}`,
      enemy: nationId,
      startYear: state.year,
      active: true,
      aggressor,
      goal: resolvedGoal,
      goalAchieved: false
    }]
  };
};

// Mutual military attrition every turn a war actively runs — this is what makes a
// `destroy_military` goal (checkWarGoal above) something that can genuinely happen, and it costs
// both sides, not just whoever eventually loses.
const WAR_ATTRITION_RATE = 0.02;

// Per-turn probability an AI aggressor's `capture_region` goal actually succeeds this turn, scaled
// by its share of the two belligerents' combined military strength and the game's difficulty.
// Deliberately NOT a full battle.js simulation — running that for every active AI war, every turn,
// across up to 240 nations, would be far too expensive. This is the "simpler, probabilistic
// resolver" tier the AI's territorial wars need, mirroring the tiered-cost model the AI's war
// DECISIONS already use (plan §8.5).
const AI_CAPTURE_BASE_CHANCE = 0.15;

// Advances every ACTIVE war whose aggressor is an AI nation by one turn: mutual military
// attrition, a capture_region roll against the goal's target region, and — once checkWarGoal
// reports the goal met — the war actually ends and peace is restored to both sides. A war the
// PLAYER started is left untouched here; it's resolved by the player's own LAUNCH_INVASION/
// AMPHIBIOUS_ASSAULT actions, not synthetically. This is what makes AI wars — AI-vs-AI and
// AI-vs-player alike — actually go somewhere instead of running forever as a pair of flags with a
// number ticking up: every one of the 240 nations must be conquerable by ANY nation, not just the
// player, for the game's own reachability guarantee to mean anything.
//
// Each nation can be party to at most one active war at a time — declareWar refuses to target an
// already-isAtWar nation, and the AI's own decision loop (aiLogic.js) never picks an
// already-isAtWar aggressor either — so ending a war here by clearing both belligerents' isAtWar
// can never stomp on some OTHER war either of them is still fighting.
export const resolveWarProgress = (state, regions, nations, wars, rng) => {
  let nextRegions = regions;
  let nextNations = nations;
  const logs = [];

  const nextWars = wars.map(war => {
    if (!war.active || war.aggressor === state.playerNationId) return war;
    const aggressor = nextNations[war.aggressor];
    const defender = nextNations[war.enemy];
    if (!aggressor || !defender) return war;

    const aggressorLoss = Math.round(defender.militaryStrength * WAR_ATTRITION_RATE);
    const defenderLoss = Math.round(aggressor.militaryStrength * WAR_ATTRITION_RATE);
    nextNations = {
      ...nextNations,
      [war.aggressor]: { ...aggressor, militaryStrength: Math.max(100, aggressor.militaryStrength - aggressorLoss) },
      [war.enemy]: { ...defender, militaryStrength: Math.max(100, defender.militaryStrength - defenderLoss) }
    };

    // A capture_region goal only advances while the target region is still held by the defender —
    // if it changed hands some other way mid-war, this war keeps running on destroy_military
    // terms instead (checkWarGoal below watches militaryStrength regardless of goal.type).
    if (war.goal?.type === 'capture_region' && !war.goalAchieved) {
      const targetRegion = nextRegions[war.goal.regionId];
      if (targetRegion && targetRegion.owner === war.enemy) {
        const updatedAggressor = nextNations[war.aggressor];
        const updatedDefender = nextNations[war.enemy];
        const totalStrength = updatedAggressor.militaryStrength + updatedDefender.militaryStrength;
        const chance = AI_CAPTURE_BASE_CHANCE * (updatedAggressor.militaryStrength / totalStrength) * (state.difficultyMultiplier || 1);
        if (rng.next() < chance) {
          nextRegions = {
            ...nextRegions,
            [war.goal.regionId]: {
              ...targetRegion,
              owner: war.aggressor,
              formerOwner: getFormerOwnerOnConquest(war.goal.regionId, targetRegion.owner, war.aggressor),
              control: 25,
              unrest: Math.max(targetRegion.unrest || 0, 50)
            }
          };
          logs.push({
            message: `${updatedAggressor.name} captures ${REGIONS_DATA[war.goal.regionId]?.name || war.goal.regionId} from ${updatedDefender.name}!`,
            type: 'combat'
          });
        }
      }
    }

    if (checkWarGoal(war, { ...state, regions: nextRegions, nations: nextNations })) {
      const winner = nextNations[war.aggressor];
      const loser = nextNations[war.enemy];
      nextNations = {
        ...nextNations,
        [war.aggressor]: { ...winner, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE },
        [war.enemy]: { ...loser, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE }
      };
      logs.push({ message: `${winner.name}'s war against ${loser.name} ends in victory.`, type: 'diplomacy' });
      return { ...war, active: false, goalAchieved: true };
    }

    return war;
  });

  return { regions: nextRegions, nations: nextNations, wars: nextWars, logs };
};
