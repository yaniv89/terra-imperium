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
import { getBorderingNationIds, getNeighborIds } from '../data/regions';
import { declareWar, isInTruce, hasActiveWarBetween } from '../engine/diplomacy';
import { UNIT_CLASSES, UNIT_CLASS_IDS, getAvailableClasses } from '../data/unitClasses';
import { AE_COALITION_ROLL_SCALE, AE_COALITION_ROLL_CAP } from '../data/actionCosts';
import { independenceChance } from '../engine/vassals';
import { getEffectiveMilitaryPower, canAffordAIRecruit, applyAIRecruitCost } from '../engine/aiEconomy';

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
// Nations fight on several fronts at once. An AI opens at most MAX_AI_WARS wars of its own
// accord (a second front is a rarer, riskier roll), and piles onto a target only while that
// target is fighting fewer than MAX_TARGET_WARS wars — a nation busy elsewhere is an opportunity.
export const MAX_AI_WARS = 2;
export const MAX_TARGET_WARS = 3;
const SECOND_FRONT_ROLL_MULT = 0.35;
export const countActiveWars = (wars, nationId) => (wars || []).filter((w) => w.active && (w.aggressor === nationId || w.enemy === nationId)).length;

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
  const entries = Object.values(nations).filter(n => !n.isEliminated);
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
  if (!nation || nation.isPlayer || nation.isEliminated) return null;
  if (nation.isAtWar) return 1;
  if (getBorderingNationIds(state.regions, nationId).includes(state.playerNationId)) return 1;
  const rank = sortedByMilitary.indexOf(nationId);
  if (rank !== -1 && rank < TOP_MILITARY_TIER_1_COUNT) return 1;
  if (getBorderingNationIds(state.regions, nationId).length > 0) return 2;
  return 3;
};

// Plan §M16: "getSortedByMilitary uses getFieldedStrength plus the garrison value" — a nation's real
// recruited army now outweighs its abstract militaryStrength number (which still feeds in, damped,
// as a stand-in "reserve" for a nation that hasn't recruited much yet — src/engine/aiEconomy.js's
// own GARRISON_STRENGTH_WEIGHT). findRunawayLeader and pickWarTarget below are NOT switched — the
// plan only names this one function, and both of those have many existing call sites/tests built
// around plain nations-map fixtures with no state.units at all; narrowing the change to exactly what
// the plan calls out keeps this a safe, well-scoped step rather than a blanket rip-and-replace.
export const getSortedByMilitary = (state) =>
  Object.values(state.nations)
    .filter(n => !n.isPlayer && !n.isEliminated)
    .sort((a, b) => getEffectiveMilitaryPower(state, b.id) - getEffectiveMilitaryPower(state, a.id))
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

// Which class a Tier 1 nation recruits next. A combined-arms doctrine (roughly half infantry, the rest
// ranged, cavalry and a few engines — whatever this age can field) with plan §8.5's counter-building
// on top: the counter to its rival's dominant class gets a bigger share. Each recruit fills the
// biggest gap between the army it has and that target mix. (It used to pick the counter — or
// infantry — every single time, so AI armies were >80% one class: single-unit spam.)
export const AI_DOCTRINE_MIX = { infantry: 0.45, ranged: 0.25, cavalry: 0.2, siege: 0.1 };
export const AI_COUNTER_BONUS = 0.3;
export const chooseAIRecruitClass = (state, units, nationId, ageId) => {
  const available = getAvailableClasses(ageId).filter(id => AI_RECRUITABLE_CLASSES.includes(id));
  if (available.length === 0) return null;
  const target = {};
  available.forEach((c) => { target[c] = AI_DOCTRINE_MIX[c] ?? 0.05; });
  const rivalId = getRivalId(state, nationId);
  if (rivalId) {
    const dominant = getDominantClass(countUnitsByClass(units, rivalId));
    const counter = dominant ? getCounterClassFor(dominant) : null;
    if (counter && available.includes(counter)) target[counter] += AI_COUNTER_BONUS;
  }
  const sum = Object.values(target).reduce((a, b) => a + b, 0);
  const mine = countUnitsByClass(units, nationId);
  const total = Object.values(mine).reduce((a, b) => a + b, 0) + 1; // the army after this recruit
  let best = available[0]; let bestGap = -Infinity;
  available.forEach((c) => {
    const gap = (target[c] / sum) * total - (mine[c] || 0);
    if (gap > bestGap + 1e-9) { best = c; bestGap = gap; }
  });
  return best;
};

// Recruit into controlled provinces, prioritizing threatened war goals and enemy borders.
// Population breaks ties; peace-time recruitment still favors population centers.
export const chooseAIRecruitRegion = (state, regions, nationId) => {
  const enemies = new Set();
  const goals = new Set();
  (state.wars || []).forEach(w => {
    if (!w.active || (w.aggressor !== nationId && w.enemy !== nationId)) return;
    enemies.add(w.aggressor === nationId ? w.enemy : w.aggressor);
    if (w.goal?.type === 'capture_region') goals.add(w.goal.regionId);
  });
  let best = null; let bestThreat = -1;
  Object.entries(regions).forEach(([id, r]) => {
    if (r.owner !== nationId || (r.occupiedBy && r.occupiedBy !== nationId)) return;
    const threatened = getNeighborIds(id).some(n => enemies.has(regions[n]?.occupiedBy || regions[n]?.owner));
    const threat = (r.underInvasion ? 4 : 0) + (goals.has(id) ? 2 : 0) + (threatened ? 1 : 0);
    if (threat > bestThreat || (threat === bestThreat && (r.currentPopulation || 0) > (regions[best]?.currentPopulation || 0))) {
      best = id; bestThreat = threat;
    }
  });
  return best;
};

// Tier 1 nations may each recruit one real land unit this turn (AI_RECRUIT_CHANCE).
// Spends AI_RECRUIT_MILITARY_STRENGTH_COST off
// the nation's militaryStrength (already grown this turn by processAllAINations) and stops once a
// nation holds its age's standing-unit cap (getAIMaxStandingUnits). Pure: returns new
// `units`/`nations` maps rather than mutating the ones passed in, exactly like processAIWarDecisions.
export const processAIRecruitment = (state, units, nations, regions, sortedByMilitary, ageId, rng) => {
  const nextUnits = { ...units };
  const nextNations = { ...nations };
  const logs = [];

  Object.keys(nations).forEach(nationId => {
    const nation = nextNations[nationId];
    if (!nation || nation.isPlayer || nation.isEliminated) return;
    if (getNationTier({ ...state, nations: nextNations }, nationId, sortedByMilitary) !== 1) return;
    // Plan §M16: "Tier 1 recruits from treasury and manpower with the same costs" once a nation has
    // a real economy (src/engine/aiEconomy.js, populated every turn by resolveTurn.js's own AI-
    // economy phase); a nation without one yet (a hand-built test fixture, mainly) falls back to the
    // original abstract-militaryStrength debit so this function still works standalone.
    const usesRealEconomy = !!nation.economy;
    if (usesRealEconomy ? !canAffordAIRecruit(nation) : nation.militaryStrength < AI_RECRUIT_MILITARY_STRENGTH_COST) return;
    const standingCount = Object.values(nextUnits).filter(u => u.ownerId === nationId).length;
    if (standingCount >= getAIMaxStandingUnits(ageId)) return;
    if (rng.next() >= AI_RECRUIT_CHANCE) return;

    const classId = chooseAIRecruitClass({ ...state, nations: nextNations }, nextUnits, nationId, ageId);
    if (!classId) return;
    const regionId = chooseAIRecruitRegion(state, regions, nationId);
    if (!regionId) return;

    const unitId = `unit_ai_${nationId}_${state.turnNumber}`;
    nextUnits[unitId] = {
      id: unitId, regionId, homeRegionId: regionId, ownerId: nationId, domain: 'land', classId,
      strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1,
      xp: 0, rank: 'recruit', promotions: [], commanderId: null,
      transportCapacity: null, embarkedOn: null
    };
    nextNations[nationId] = usesRealEconomy
      ? applyAIRecruitCost(nation)
      : { ...nation, militaryStrength: nation.militaryStrength - AI_RECRUIT_MILITARY_STRENGTH_COST };
  });

  return { units: nextUnits, nations: nextNations, logs };
};

// Among a nation's bordering nations (including the player) it isn't already fighting, the weakest
// one — "attacks the weakest valuable region reachable", not the nearest pixel, per the plan. A
// neighbour already at war elsewhere counts as weaker (its army is split between fronts). A
// coalition member with a valid shot at the runaway leader ignores that and goes straight for the
// leader instead, regardless of how it compares to other neighbors — that's the whole point of
// ganging up on it.
const pickWarTarget = (state, nationId, preferredTargetId = null) => {
  // Plan §M12/M13: the AI never breaks a truce (isInTruce, src/engine/diplomacy.js) — a
  // truce-active neighbor is filtered out of consideration entirely.
  const candidates = getBorderingNationIds(state.regions, nationId)
    .filter(id => state.nations[id] && !state.nations[id].isEliminated && !isInTruce(state, nationId, id)
      && !hasActiveWarBetween(state, nationId, id) && countActiveWars(state.wars, id) < MAX_TARGET_WARS);
  if (candidates.length === 0) return null;
  if (preferredTargetId && candidates.includes(preferredTargetId)) return preferredTargetId;
  const effective = (id) => state.nations[id].militaryStrength / (1 + countActiveWars(state.wars, id));
  return candidates.reduce((weakest, id) => (effective(id) < effective(weakest) ? id : weakest), candidates[0]);
};

const shouldDeclareWar = (nation, rng, aggressionMult = 1, coalitionMult = 1) => {
  const doctrine = DOCTRINES[nation.doctrine] || DEFAULT_DOCTRINE;
  if (doctrine.warRollMult <= 0) return false;
  const chance = BASE_WAR_ROLL_CHANCE * doctrine.warRollMult * aggressionMult * coalitionMult * (nation.hostility / 100 + 0.2);
  return rng.next() < chance;
};

// Tier 1 nations may each declare one war this turn (a second front only rarely, never a third), biased by their own doctrine, hostility, the
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
  const draggedIn = new Set(); // nations declared on this pass — they don't also declare this turn

  Object.keys(nations).forEach(nationId => {
    // Re-read from currentNations, not the original `nations` snapshot — a nation earlier in this
    // same pass may just have been dragged into a war as someone's target, and a freshly-invaded
    // nation shouldn't also get to fire off its own declaration this turn.
    const nation = currentNations[nationId];
    if (!nation || nation.isPlayer || nation.isEliminated || draggedIn.has(nationId)) return;
    const fronts = countActiveWars(currentWars, nationId);
    if (fronts >= MAX_AI_WARS) return;
    // Plan §M12: a vassal "can't declare wars except independence". Once its liberty desire is
    // past the threshold (src/engine/vassals.js reads it from the overlord's real weakness), it may
    // issue its ultimatum and fight for freedom — more likely the further past it is and the more
    // wars its overlord is already tangled in. The same war the player's DECLARE_INDEPENDENCE starts.
    if (nation.vassalOf) {
      const overlordId = nation.vassalOf;
      if (fronts > 0 || !currentNations[overlordId] || hasActiveWarBetween({ wars: currentWars }, nationId, overlordId)) return;
      const chance = independenceChance(nation.libertyDesire, countActiveWars(currentWars, overlordId));
      if (!chance || rng.next() >= chance) return;
      const result = declareWar({ ...state, nations: currentNations, wars: currentWars }, overlordId, { aggressor: nationId, goal: { type: 'independence' } });
      if (result.wars === currentWars) return;
      const wars = [...result.wars];
      wars[wars.length - 1] = { ...wars[wars.length - 1], cb: 'independence' };
      draggedIn.add(overlordId);
      currentNations = result.nations;
      currentWars = wars;
      logs.push({ message: `${nation.name} rises up and declares independence from ${state.nations[overlordId]?.name || overlordId}!`, type: 'diplomacy' });
      return;
    }
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
    const canStrikeLeader = !!leader && !hasActiveWarBetween({ wars: currentWars }, nationId, runawayLeaderId)
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

    if (!shouldDeclareWar(activeNation, rng, aggressionMult, coalitionMult * (fronts > 0 ? SECOND_FRONT_ROLL_MULT : 1))) return;
    const targetId = pickWarTarget({ ...state, nations: currentNations, wars: currentWars }, nationId, canStrikeLeader ? runawayLeaderId : null);
    if (!targetId) return;
    const result = declareWar({ ...state, nations: currentNations, wars: currentWars }, targetId, { aggressor: nationId });
    if (result.wars === currentWars) return; // no-op (shouldn't happen given pickWarTarget's filter, but stay defensive)
    draggedIn.add(targetId);
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
  if (nation.isPlayer || nation.isEliminated) return updates;

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
    if (nation.isPlayer || nation.isEliminated) return;
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
