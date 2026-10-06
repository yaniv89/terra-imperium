// src/engine/civilWar.js
// Plan §M15: civil war. Runs generically for every nation (player and AI alike). Its causes are
// numbers every nation already tracks: three turns at the stability floor, authority under
// AUTHORITY_CIVIL_WAR (authority.js), or a Revolution disaster (disasters.js). Succession crises and
// throne pretenders were removed with succession (master plan decision 37): the rising is an
// insurgency against the regime, not a rival claimant.
//
// Scope trim: the plan describes a civil war using the same `state.wars` war-score/peace-deal
// machinery M13 built. That machinery is for a war BETWEEN TWO DIPLOMATIC NATIONS: the insurgents
// are not a nation in state.nations, have no economy or diplomacy of their own, and can't sign a
// peace deal. So this is its own small tracker (`nation.civilWar`), and "holds >= 50% of your
// regions" is answered with the mechanism M13 already uses for military control without
// ownership: an insurgent-held region gets `region.occupiedBy` set to INSURGENT_MARKER, the same
// sparse field a foreign war's occupier uses, which every existing consumer (calcIncome's occupied-
// region exclusion, reinforcement's "supplied home territory" gate, construction/develop guards) is
// already safe with regardless of what non-nation string ends up in it.
//
// Insurgent UNITS reuse REBEL_OWNER_ID (src/data/rebellion.js) rather than a distinct owner id, so
// SUPPRESS_REBELLION (gameReducer.js) fights them too. They're tagged `isInsurgent: true`, and
// resolveTurn.js's unrest-driven rebellion block skips any unit carrying that flag, so ordinary
// unrest-rebellion bookkeeping (grow/dissolve by REGION unrest) never touches them: this module owns
// their entire lifecycle.
//
// A civil war also has to be winnable by BOTH sides: insurgents spread into neighbouring provinces
// the loyal garrison can't hold (INSURGENT_SPREAD_CHANCE), so the 50% "lost" threshold is reachable
// from the 15% start, and an AI nation (which has no SUPPRESS_REBELLION of its own) grinds its
// insurgents down in proportion to its real fielded strength (AI_SUPPRESS_CHANCE_SCALE).
import { REBEL_OWNER_ID } from '../data/rebellion';
import { getNeighborIds } from '../data/regions';
import { generateRuler } from './rulers';
import { getAvailableGovernmentTypes, resetReformsForType } from '../data/government';
import { DEFAULT_LAWS } from '../data/laws';
import { clampStability, clampLegitimacy, clampPrestige } from './nationalPower';
import {
  CIVIL_WAR_STABILITY_STREAK_TURNS, CIVIL_WAR_INSURGENT_REGION_SHARE, CIVIL_WAR_INSURGENT_STRENGTH_SHARE,
  CIVIL_WAR_HOLD_SHARE_TO_LOSE, CIVIL_WAR_HOLD_STREAK_TO_LOSE_TURNS, CIVIL_WAR_LOSE_PRESTIGE_PENALTY,
  CIVIL_WAR_CRUSH_STABILITY_REWARD, CIVIL_WAR_CRUSH_LEGITIMACY_REWARD
} from '../data/actionCosts';

export const INSURGENT_MARKER = 'insurgents';
// Plans/playtest-1.md P4: a nation falls into no second civil war for CIVIL_WAR_COOLDOWN_TURNS
// after one ends.
export const CIVIL_WAR_COOLDOWN_TURNS = 40;
export const inCivilWarCooldown = (nation, turn) => nation?.civilWarEndedTurn != null && turn - nation.civilWarEndedTurn < CIVIL_WAR_COOLDOWN_TURNS;
export const STABILITY_MIN_FOR_CIVIL_WAR = -3; // nationalPower.js's own STABILITY_MIN: a civil war needs the floor, not just "low"
export const INSURGENT_SPREAD_CHANCE = 0.25; // per insurgent stack per turn
export const INSURGENT_SPLIT_STRENGTH_SHARE = 0.6; // a spreading stack's offshoot, vs. its parent
export const AI_SUPPRESS_CHANCE_SCALE = 0.5; // max per-stack per-turn destruction chance for an AI loyalist army

// Plan: "starts after 3 consecutive turns at stability -3" — call every turn, for every nation,
// regardless of whether a civil war is already active, so the streak still tracks correctly through
// one and resets cleanly once stability recovers afterward.
// `lowAuthority`: authority under AUTHORITY_CIVIL_WAR (authority.js) counts as a low turn too.
export const nextLowStabilityStreak = (nation, lowAuthority = false) =>
  ((nation.stability || 0) <= STABILITY_MIN_FOR_CIVIL_WAR || lowAuthority) ? (nation.lowStabilityStreak || 0) + 1 : 0;

export const isStabilityCivilWarTrigger = (streak) => streak >= CIVIL_WAR_STABILITY_STREAK_TURNS;

// Spawns insurgent rebels in CIVIL_WAR_INSURGENT_REGION_SHARE of the nation's own regions (min 1),
// each region's defender sized off a share of the nation's REAL fielded strength (not the abstract
// militaryStrength number) split evenly across the spawned regions — plan: "strength scaled to your
// army". Region selection is a seeded "score every candidate once, keep the lowest N" pick (the same
// no-bias-from-Set-iteration-order idiom other AI/rebellion code in this codebase already uses),
// not a Fisher-Yates shuffle, so it's trivially reproducible from the RNG stream alone.
export const startCivilWar = (regions, units, nationId, fieldedStrength, rng, turnNumber) => {
  // Never a province a foreign war already occupies — overwriting that occupiedBy with the
  // insurgent marker would silently erase the foreign war's occupation score.
  const ownedIds = Object.keys(regions).filter((id) => regions[id].owner === nationId && !regions[id].occupiedBy);
  if (ownedIds.length === 0) return null;
  const count = Math.max(1, Math.round(ownedIds.length * CIVIL_WAR_INSURGENT_REGION_SHARE));
  const chosenIds = ownedIds
    .map((id) => ({ id, roll: rng.next() }))
    .sort((a, b) => a.roll - b.roll)
    .slice(0, count)
    .map((x) => x.id);
  const strength = Math.max(1, Math.round((fieldedStrength * CIVIL_WAR_INSURGENT_STRENGTH_SHARE) / chosenIds.length));

  const nextRegions = { ...regions };
  const nextUnits = { ...units };
  chosenIds.forEach((regionId) => {
    const unitId = `insurgent_${nationId}_${regionId}_${turnNumber}`;
    nextUnits[unitId] = {
      id: unitId, regionId, ownerId: REBEL_OWNER_ID, isInsurgent: true, domain: 'land', classId: 'infantry',
      strength, maxStrength: strength, morale: 100, movesLeft: 1,
      xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
      spawnedTurn: turnNumber
    };
    nextRegions[regionId] = { ...nextRegions[regionId], occupiedBy: INSURGENT_MARKER };
  });

  return { regions: nextRegions, units: nextUnits, civilWar: { active: true, startedTurn: turnNumber, holdStreak: 0 } };
};

// One turn of an ALREADY-ACTIVE civil war: reconciles which insurgent-marked regions still have a
// surviving insurgent army (a region the player/AI suppressed this turn is liberated automatically,
// the same way a foreign war's occupation clears on liberation), then checks the two end conditions —
// crushed (no insurgent-held regions left) or lost (held >= 50% of the nation's regions for 5
// consecutive turns). Returns null when nothing about this civil war changes that resolveTurn.js
// needs to react to beyond the streak counter (still active, share below the losing threshold).
// The nation's land strength per region, built once per call: a long civil war has many insurgent
// stacks, and a scan of every unit per stack per neighbour was the phase's cost.
const loyalLandStrengthMap = (units, nationId) => {
  const map = new Map();
  Object.values(units).forEach((u) => { if (u.ownerId === nationId && u.domain === 'land') map.set(u.regionId, (map.get(u.regionId) || 0) + (u.strength || 0)); });
  return map;
};

// One turn of insurgent movement and (AI-only) loyalist suppression. Mutates the passed-in copies.
const advanceInsurgents = (state, regions, units, nationId, rng, turnNumber) => {
  const insurgents = Object.values(units).filter((u) => u.isInsurgent && regions[u.regionId]?.owner === nationId);
  if (insurgents.length === 0) return;

  // AI loyalists: a player fights insurgents with SUPPRESS_REBELLION; an AI nation has no such
  // action, so each stack is destroyed with a chance scaled by the nation's real fielded strength vs.
  // the insurgents' total — a strong AI crushes a small uprising in a few turns, a weak one may lose.
  if (nationId !== state.playerNationId) {
    const loyalStrength = Object.values(units).reduce((sum, u) => sum + (u.ownerId === nationId && u.domain === 'land' ? (u.strength || 0) : 0), 0);
    const insurgentStrength = insurgents.reduce((sum, u) => sum + (u.strength || 0), 0);
    const chance = AI_SUPPRESS_CHANCE_SCALE * (loyalStrength / Math.max(1, loyalStrength + insurgentStrength));
    insurgents.forEach((u) => { if (rng.next() < chance) delete units[u.id]; });
  }

  // Spread: a surviving stack stronger than the loyal garrison next door may take that province.
  const loyal = loyalLandStrengthMap(units, nationId);
  Object.values(units).filter((u) => u.isInsurgent && regions[u.regionId]?.owner === nationId).forEach((u) => {
    if (rng.next() >= INSURGENT_SPREAD_CHANCE) return;
    const target = getNeighborIds(u.regionId).find((id) =>
      regions[id]?.owner === nationId && !regions[id].occupiedBy && (loyal.get(id) || 0) < u.strength);
    if (!target) return;
    const strength = Math.max(1, Math.round(u.strength * INSURGENT_SPLIT_STRENGTH_SHARE));
    const id = `insurgent_${nationId}_${target}_${turnNumber}`;
    units[id] = { ...u, id, regionId: target, tile: regions[target]?.tile ?? null, strength, maxStrength: strength, spawnedTurn: turnNumber };
    regions[target] = { ...regions[target], occupiedBy: INSURGENT_MARKER };
  });
};

export const processCivilWarTurn = (state, regionsIn, unitsIn, nation, nationId, rng, turnNumber) => {
  const regions = { ...regionsIn };
  const units = { ...unitsIn };
  advanceInsurgents(state, regions, units, nationId, rng, turnNumber);
  const ownedIds = Object.keys(regions).filter((id) => regions[id].owner === nationId);
  const insurgentRegionIds = new Set(
    Object.values(units)
      .filter((u) => u.isInsurgent && regions[u.regionId]?.owner === nationId)
      .map((u) => u.regionId)
  );

  // Liberate any region still marked occupied-by-insurgents whose insurgent army no longer exists
  // (suppressed by the owner, or lost some other way) — same "occupation clears on liberation"
  // semantics a foreign war's occupiedBy already has.
  let nextRegions = regions;
  Object.keys(regions).forEach((id) => {
    if (regions[id].owner === nationId && regions[id].occupiedBy === INSURGENT_MARKER && !insurgentRegionIds.has(id)) {
      if (nextRegions === regions) nextRegions = { ...regions };
      // eslint-disable-next-line no-unused-vars -- destructured only to omit occupiedBy from rest
      const { occupiedBy, ...rest } = nextRegions[id];
      nextRegions[id] = rest;
    }
  });

  if (insurgentRegionIds.size === 0) {
    return {
      regions: nextRegions,
      units,
      nation: {
        ...nation,
        civilWar: null,
        stability: clampStability((nation.stability || 0) + CIVIL_WAR_CRUSH_STABILITY_REWARD),
        legitimacy: clampLegitimacy((nation.legitimacy ?? 50) + CIVIL_WAR_CRUSH_LEGITIMACY_REWARD)
      },
      result: 'crushed'
    };
  }

  const holdShare = ownedIds.length > 0 ? insurgentRegionIds.size / ownedIds.length : 0;
  const holdStreak = holdShare >= CIVIL_WAR_HOLD_SHARE_TO_LOSE ? (nation.civilWar.holdStreak || 0) + 1 : 0;

  if (holdStreak >= CIVIL_WAR_HOLD_STREAK_TO_LOSE_TURNS) {
    // Plan: "new ruler and dynasty, government type reroll, laws reset to base, -20 prestige" — the
    // insurgents win, but the NATION survives (this is explicitly not a defeat condition). Its own
    // insurgent units/region markers are cleared as part of the regime change, not left to dissolve
    // on their own the following turn.
    let clearedRegions = { ...nextRegions };
    const clearedUnits = { ...units };
    insurgentRegionIds.forEach((id) => {
      // eslint-disable-next-line no-unused-vars -- destructured only to omit occupiedBy from rest
      const { occupiedBy, ...rest } = clearedRegions[id];
      clearedRegions[id] = rest;
    });
    Object.values(units).forEach((u) => { if (u.isInsurgent && insurgentRegionIds.has(u.regionId)) delete clearedUnits[u.id]; });

    const availableTypes = getAvailableGovernmentTypes(state.age, nation.identity).filter((t) => t.id !== nation.government?.type);
    const newType = availableTypes.length > 0 ? availableTypes[Math.floor(rng.next() * availableTypes.length)].id : nation.government?.type;
    const newRuler = generateRuler(nationId, rng, { turnNumber, age: state.age, gameSpeed: state.gameSpeed });

    return {
      regions: clearedRegions,
      units: clearedUnits,
      nation: {
        ...nation,
        civilWar: null,
        ruler: newRuler,
        government: { type: newType, reforms: resetReformsForType(newType, state.age) },
        laws: { ...DEFAULT_LAWS },
        prestige: clampPrestige((nation.prestige || 0) - CIVIL_WAR_LOSE_PRESTIGE_PENALTY)
      },
      result: 'lost'
    };
  }

  return {
    regions: nextRegions,
    units,
    nation: { ...nation, civilWar: { ...nation.civilWar, holdStreak } },
    result: 'ongoing'
  };
};
