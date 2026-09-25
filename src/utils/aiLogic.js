// src/utils/aiLogic.js
// AI logic for non-player nations: passive economic growth, hostility drift, and — Task 23 — a
// tiered decision loop (plan §8.5). 240 nations can't all think hard every turn, so only Tier 1
// (at war, bordering the player, or top-20 by military) actually evaluates a war declaration each
// turn; Tier 2/3 nations still get the passive growth/drift every nation gets, just nothing more
// expensive.
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
//
// Task 36 fills in what Task 23's header used to call out as missing: counter-building. Tier 1
// nations now recruit real units into state.units (processAIRecruitment), and the class they pick
// is read straight off the same beats/losesTo table combat actually resolves against
// (src/data/unitClasses.js) — spam cavalry at a Tier 1 neighbor and its own recruiting starts
// favoring infantry, the real counter, not a scripted response to "cavalry" by name.

import { DOCTRINES } from '../data/nations';
import { RelationStatus } from '../data/types';
import { getBorderingNationIds } from '../data/regions';
import { declareWar, isInTruce } from '../engine/diplomacy';
import { UNIT_CLASSES, UNIT_CLASS_IDS, getAvailableClasses } from '../data/unitClasses';
import { AE_COALITION_ROLL_SCALE, AE_COALITION_ROLL_CAP } from '../data/actionCosts';

const DEFAULT_RNG = { next: () => Math.random() };
const DEFAULT_DOCTRINE = DOCTRINES.attrition;

// Naval/air are left out of AI recruitment for now — there's no AI amphibious or air-defense
// logic yet to make use of them, so Tier 1 nations only ever build from the land triangle plus
// siege until that exists.
const AI_RECRUITABLE_CLASSES = ['infantry', 'cavalry', 'ranged', 'siege'];
// Per-turn chance a single Tier 1 nation recruits one unit, and the militaryStrength cost of doing
// so — spent from the same abstract stat processAllAINations already grows every turn, so
// recruiting a real unit converts existing growth into a visible, counterable force rather than
// creating power from nothing.
const AI_RECRUIT_CHANCE = 0.35;
const AI_RECRUIT_MILITARY_STRENGTH_COST = 300;
// A standing cap per nation keeps state.units bounded across a 240-nation, centuries-long game —
// once at the cap a nation stops recruiting until losses (combat, attrition) free up room, the
// same way a real standing army is sized to what the state can support. Scaled by age rather than
// held flat: a Bronze-age nation's 8-unit cap is fine for the game's opening, but a Modern-age
// great power capping at the exact same 8 total units makes wars feel small next to a 240-nation,
// 4,300-year game's actual scale — an empire's real military capacity should grow across the ages
// the same way its buildings, units and tech tiers already do. (Tier itself doesn't get a separate
// multiplier here: only Tier 1 nations ever recruit real units at all — see the tier check below —
// so there's nothing for a tier-based cap to scale until Tier 2/3 nations recruit too, which is a
// separate expansion of who fields armies, not of how big the cap on an existing recruiter is.)
const AI_MAX_STANDING_UNITS_BY_AGE = {
  bronze: 8,
  classical: 10,
  kingdoms: 14,
  gunpowder: 20,
  modern: 30
};
const AI_MAX_STANDING_UNITS_DEFAULT = 8;
const getAIMaxStandingUnits = (ageId) => AI_MAX_STANDING_UNITS_BY_AGE[ageId] || AI_MAX_STANDING_UNITS_DEFAULT;

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
// Cultural Export (gameReducer.js's CULTURAL_EXPORT action) accumulates a nation's culturalInfluence
// as real soft power: when that nation is the runaway leader, this discounts the coalition's
// eagerness to strike it — diminishing returns, and floored well short of 1 so cultural investment
// tempers the anti-snowball check rather than defeating it outright.
const CULTURAL_COALITION_DISCOUNT_FLOOR = 0.5;
const CULTURAL_COALITION_DISCOUNT_SCALE = 2000;
const getCulturalCoalitionDiscount = (culturalInfluence) =>
  Math.max(CULTURAL_COALITION_DISCOUNT_FLOOR, 1 - (culturalInfluence || 0) / CULTURAL_COALITION_DISCOUNT_SCALE);
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
  if (getBorderingNationIds(state.regions, nationId).includes(state.playerNationId)) return 1;
  const rank = sortedByMilitary.indexOf(nationId);
  if (rank !== -1 && rank < TOP_MILITARY_TIER_1_COUNT) return 1;
  if (getBorderingNationIds(state.regions, nationId).length > 0) return 2;
  return 3;
};

export const getSortedByMilitary = (state) =>
  Object.values(state.nations)
    .filter(n => !n.isPlayer)
    .sort((a, b) => b.militaryStrength - a.militaryStrength)
    .map(n => n.id);

// The rival whose composition a Tier 1 nation actually reacts to: its live war opponent if it has
// one, else the player if they're neighbors (the plan's "spam cavalry, neighbors field pikes"
// example is specifically about the player), else its first real bordering nation. Returns null
// for a nation with no war, no player border, and no neighbors at all (an island Tier-1 power).
const getRivalId = (state, nationId) => {
  const war = (state.wars || []).find(w => w.active && (w.enemy === nationId || w.aggressor === nationId));
  if (war) return war.enemy === nationId ? war.aggressor : war.enemy;
  const neighbors = getBorderingNationIds(state.regions, nationId).filter(id => state.nations[id]);
  if (neighbors.includes(state.playerNationId)) return state.playerNationId;
  return neighbors[0] || null;
};

const countUnitsByClass = (units, ownerId) => {
  const counts = {};
  Object.values(units).forEach(u => {
    if (u.ownerId !== ownerId) return;
    counts[u.classId] = (counts[u.classId] || 0) + 1;
  });
  return counts;
};

const getDominantClass = (counts) => {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0])[0];
};

// The class that beats `classId`, per the real counter table (src/data/unitClasses.js) — null if
// nothing explicitly does (e.g. classId itself has no natural predator in the closed triangle).
const getCounterClassFor = (classId) => UNIT_CLASS_IDS.find(id => UNIT_CLASSES[id].beats.includes(classId)) || null;

// Which class a Tier 1 nation recruits next (plan §8.5's counter-building): the counter to its
// rival's dominant class, if one exists, is recruitable by AI nations at all, and is available
// this age — otherwise infantry, the cheap default backbone, or whatever's first available if even
// that isn't unlocked yet.
export const chooseAIRecruitClass = (state, units, nationId, ageId) => {
  const available = getAvailableClasses(ageId).filter(id => AI_RECRUITABLE_CLASSES.includes(id));
  if (available.length === 0) return null;
  const rivalId = getRivalId(state, nationId);
  if (rivalId) {
    const dominant = getDominantClass(countUnitsByClass(units, rivalId));
    const counter = dominant ? getCounterClassFor(dominant) : null;
    if (counter && available.includes(counter)) return counter;
  }
  return available.includes('infantry') ? 'infantry' : available[0];
};

// Tier 1 nations may each recruit one real land unit this turn (AI_RECRUIT_CHANCE), placed in
// whichever of their own regions has the largest population — a reasonable stand-in for "capital"
// since nations don't have one tracked explicitly. Spends AI_RECRUIT_MILITARY_STRENGTH_COST off
// the nation's militaryStrength (already grown this turn by processAllAINations) and stops once a
// nation holds its age's standing-unit cap (getAIMaxStandingUnits). Pure: returns new
// `units`/`nations` maps rather than mutating the ones passed in, exactly like processAIWarDecisions.
export const processAIRecruitment = (state, units, nations, regions, sortedByMilitary, ageId, rng) => {
  const nextUnits = { ...units };
  const nextNations = { ...nations };
  const logs = [];

  Object.keys(nations).forEach(nationId => {
    const nation = nextNations[nationId];
    if (!nation || nation.isPlayer) return;
    if (getNationTier({ ...state, nations: nextNations }, nationId, sortedByMilitary) !== 1) return;
    if (nation.militaryStrength < AI_RECRUIT_MILITARY_STRENGTH_COST) return;
    const standingCount = Object.values(nextUnits).filter(u => u.ownerId === nationId).length;
    if (standingCount >= getAIMaxStandingUnits(ageId)) return;
    if (rng.next() >= AI_RECRUIT_CHANCE) return;

    const classId = chooseAIRecruitClass({ ...state, nations: nextNations }, nextUnits, nationId, ageId);
    if (!classId) return;
    const ownedRegionIds = Object.entries(regions).filter(([, r]) => r.owner === nationId).map(([id]) => id);
    if (ownedRegionIds.length === 0) return;
    const regionId = ownedRegionIds.reduce((best, id) =>
      ((regions[id].currentPopulation || 0) > (regions[best].currentPopulation || 0) ? id : best), ownedRegionIds[0]);

    const unitId = `unit_ai_${nationId}_${state.turnNumber}`;
    nextUnits[unitId] = {
      id: unitId, regionId, ownerId: nationId, domain: 'land', classId,
      strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1,
      xp: 0, rank: 'recruit', promotions: [], commanderId: null,
      transportCapacity: null, embarkedOn: null
    };
    nextNations[nationId] = { ...nation, militaryStrength: nation.militaryStrength - AI_RECRUIT_MILITARY_STRENGTH_COST };
  });

  return { units: nextUnits, nations: nextNations, logs };
};

// Among a nation's bordering nations (including the player) not already at war, the weakest one
// — "attacks the weakest valuable region reachable", not the nearest pixel, per the plan. A
// coalition member with a valid shot at the runaway leader ignores that and goes straight for the
// leader instead, regardless of how it compares to other neighbors — that's the whole point of
// ganging up on it.
const pickWarTarget = (state, nationId, preferredTargetId = null) => {
  // Plan §M12/M13: the AI never breaks a truce (isInTruce, src/engine/diplomacy.js) — a
  // truce-active neighbor is filtered out of consideration entirely, the same way an already-
  // isAtWar one is.
  const candidates = getBorderingNationIds(state.regions, nationId)
    .filter(id => state.nations[id] && !state.nations[id].isAtWar && !isInTruce(state, nationId, id));
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
    // Plan §M12: a vassal "can't declare wars except independence" — no independence-war mechanic
    // exists yet (deferred), but the self-declaration lockout itself is real and simple.
    if (nation.vassalOf) return;
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
    const canStrikeLeader = !!leader && !leader.isAtWar
      && getBorderingNationIds(state.regions, nationId).includes(runawayLeaderId)
      && !isInTruce({ ...state, nations: currentNations }, nationId, runawayLeaderId);
    // Plan §M12: real Aggressive Expansion (this nation's own accrued AE against the leader,
    // expansion.js) scales the coalition roll further on top of the flat COALITION_WAR_ROLL_MULT —
    // a nation the leader has personally wronged joins more eagerly than one merely nervous about
    // its overall power share. doctrine.bandwagonMult (src/data/nations.js) was declared but never
    // actually multiplied into anything before this — an isolationist doctrine's 0.1 now genuinely
    // dampens its willingness to join a pile-on, and an opportunist's 1.8 genuinely sharpens it.
    const doctrine = DOCTRINES[activeNation.doctrine] || DEFAULT_DOCTRINE;
    const aeAgainstLeader = activeNation.ae?.[runawayLeaderId] || 0;
    const aeScale = 1 + Math.min(AE_COALITION_ROLL_CAP - 1, aeAgainstLeader / AE_COALITION_ROLL_SCALE);
    const coalitionMult = canStrikeLeader
      ? COALITION_WAR_ROLL_MULT * getCulturalCoalitionDiscount(leader.culturalInfluence) * aeScale * doctrine.bandwagonMult
      : 1;

    if (!shouldDeclareWar(activeNation, rng, aggressionMult, coalitionMult)) return;
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
  // Below 5x the player's current strength this is the original, unthrottled formula. Past that
  // ratio, growth is damped in inverse proportion to it (turning compounding into roughly linear
  // growth beyond the threshold): left uncapped, strength * 1%/turn forever is mathematically
  // guaranteed to put some AI nation at 20x+ the player's strength well within the game's ~500-turn
  // span (confirmed by direct simulation) — long before the existing world-military-share coalition
  // mechanic (findRunawayLeader, 15% of the WORLD total) would ever engage, since one nation
  // dwarfing the player is a much lower bar than one nation dwarfing all 239 others combined.
  const playerStrength = state.nations?.[state.playerNationId]?.militaryStrength;
  const ratioToPlayer = playerStrength > 0 ? nation.militaryStrength / playerStrength : 1;
  const runawayDamping = ratioToPlayer <= 5 ? 1 : Math.max(0.05, 5 / ratioToPlayer);
  const baseGrowth = Math.floor(nation.militaryStrength * 0.01 * doctrine.economyGrowthMult * runawayDamping);
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
