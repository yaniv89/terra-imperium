// src/engine/civilWar.js
// Plan §M15: civil war. Runs generically for every nation (player and AI alike) — stability,
// estates, and government type already get real per-turn processing for every nation since M3/M4/M9
// (resolveTurn.js's own comments on why: "AI nations get real numbers even though nothing reads them
// mechanically until M16"), so a civil war is just another consequence of numbers every nation
// already tracks.
//
// Scope trim: the plan describes a civil war using the same `state.wars` war-score/peace-deal
// machinery M13 built. That machinery is for a war BETWEEN TWO DIPLOMATIC NATIONS — a pretender
// claimant isn't a nation in state.nations, has no economy/diplomacy of its own, and can't sign a
// peace deal. Reusing it would mean inventing a fake nation record for every pretender, which is a
// bigger and riskier change than this milestone's other items for no real gameplay gain. Instead,
// this is its own small, purpose-built tracker (`nation.civilWar`), and "holds >= 50% of your
// regions" is answered with the exact mechanism M13 already uses for military control without
// ownership: a pretender-held region gets `region.occupiedBy` set to PRETENDER_MARKER, the same
// sparse field a foreign war's occupier uses, which every existing consumer (calcIncome's occupied-
// region exclusion, reinforcement's "supplied home territory" gate, construction/develop guards) is
// already unconditionally safe with regardless of what non-nation string ends up in it.
//
// Pretender rebel UNITS reuse REBEL_OWNER_ID (src/data/rebellion.js) rather than a distinct owner id
// — SUPPRESS_REBELLION (gameReducer.js) hardcodes that id, and a pretender army you can't fight with
// the game's one existing anti-rebel action would be a real regression, not a feature. They're tagged
// `isPretender: true` instead, and resolveTurn.js's own unrest-driven rebellion block skips any unit
// carrying that flag, so ordinary unrest-rebellion bookkeeping (grow/dissolve by REGION unrest) never
// touches a civil war's pretenders — this module owns their entire lifecycle instead.
import { REBEL_OWNER_ID } from '../data/rebellion';
import { generateRuler } from './succession';
import { getAvailableGovernmentTypes, resetReformsForType } from '../data/government';
import { DEFAULT_LAWS } from '../data/laws';
import { clampStability, clampLegitimacy, clampPrestige } from './nationalPower';
import {
  CIVIL_WAR_STABILITY_STREAK_TURNS, CIVIL_WAR_PRETENDER_REGION_SHARE, CIVIL_WAR_PRETENDER_STRENGTH_SHARE,
  CIVIL_WAR_HOLD_SHARE_TO_LOSE, CIVIL_WAR_HOLD_STREAK_TO_LOSE_TURNS, CIVIL_WAR_LOSE_PRESTIGE_PENALTY,
  CIVIL_WAR_CRUSH_STABILITY_REWARD, CIVIL_WAR_CRUSH_LEGITIMACY_REWARD
} from '../data/actionCosts';

export const PRETENDER_MARKER = 'pretenders';
export const STABILITY_MIN_FOR_CIVIL_WAR = -3; // nationalPower.js's own STABILITY_MIN — a civil war needs the floor, not just "low"

// Plan: "starts after 3 consecutive turns at stability -3" — call every turn, for every nation,
// regardless of whether a civil war is already active, so the streak still tracks correctly through
// one and resets cleanly once stability recovers afterward.
export const nextLowStabilityStreak = (nation) =>
  (nation.stability || 0) <= STABILITY_MIN_FOR_CIVIL_WAR ? (nation.lowStabilityStreak || 0) + 1 : 0;

export const isStabilityCivilWarTrigger = (streak) => streak >= CIVIL_WAR_STABILITY_STREAK_TURNS;

// Spawns pretender rebels in CIVIL_WAR_PRETENDER_REGION_SHARE of the nation's own regions (min 1),
// each region's defender sized off a share of the nation's REAL fielded strength (not the abstract
// militaryStrength number) split evenly across the spawned regions — plan: "strength scaled to your
// army". Region selection is a seeded "score every candidate once, keep the lowest N" pick (the same
// no-bias-from-Set-iteration-order idiom other AI/rebellion code in this codebase already uses),
// not a Fisher-Yates shuffle, so it's trivially reproducible from the RNG stream alone.
export const startCivilWar = (regions, units, nationId, fieldedStrength, rng, turnNumber) => {
  const ownedIds = Object.keys(regions).filter((id) => regions[id].owner === nationId);
  if (ownedIds.length === 0) return null;
  const count = Math.max(1, Math.round(ownedIds.length * CIVIL_WAR_PRETENDER_REGION_SHARE));
  const chosenIds = ownedIds
    .map((id) => ({ id, roll: rng.next() }))
    .sort((a, b) => a.roll - b.roll)
    .slice(0, count)
    .map((x) => x.id);
  const strength = Math.max(1, Math.round((fieldedStrength * CIVIL_WAR_PRETENDER_STRENGTH_SHARE) / chosenIds.length));

  const nextRegions = { ...regions };
  const nextUnits = { ...units };
  chosenIds.forEach((regionId) => {
    const unitId = `pretender_${nationId}_${regionId}_${turnNumber}`;
    nextUnits[unitId] = {
      id: unitId, regionId, ownerId: REBEL_OWNER_ID, isPretender: true, domain: 'land', classId: 'infantry',
      strength, maxStrength: strength, morale: 100, movesLeft: 1,
      xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
      spawnedTurn: turnNumber
    };
    nextRegions[regionId] = { ...nextRegions[regionId], occupiedBy: PRETENDER_MARKER };
  });

  return { regions: nextRegions, units: nextUnits, civilWar: { active: true, startedTurn: turnNumber, holdStreak: 0 } };
};

// One turn of an ALREADY-ACTIVE civil war: reconciles which pretender-marked regions still have a
// surviving pretender army (a region the player/AI suppressed this turn is liberated automatically,
// the same way a foreign war's occupation clears on liberation), then checks the two end conditions —
// crushed (no pretender-held regions left) or lost (held >= 50% of the nation's regions for 5
// consecutive turns). Returns null when nothing about this civil war changes that resolveTurn.js
// needs to react to beyond the streak counter (still active, share below the losing threshold).
export const processCivilWarTurn = (state, regions, units, nation, nationId, rng, turnNumber) => {
  const ownedIds = Object.keys(regions).filter((id) => regions[id].owner === nationId);
  const pretenderRegionIds = new Set(
    Object.values(units)
      .filter((u) => u.isPretender && regions[u.regionId]?.owner === nationId)
      .map((u) => u.regionId)
  );

  // Liberate any region still marked occupied-by-pretenders whose pretender army no longer exists
  // (suppressed by the owner, or lost some other way) — same "occupation clears on liberation"
  // semantics a foreign war's occupiedBy already has.
  let nextRegions = regions;
  Object.keys(regions).forEach((id) => {
    if (regions[id].owner === nationId && regions[id].occupiedBy === PRETENDER_MARKER && !pretenderRegionIds.has(id)) {
      if (nextRegions === regions) nextRegions = { ...regions };
      // eslint-disable-next-line no-unused-vars -- destructured only to omit occupiedBy from rest
      const { occupiedBy, ...rest } = nextRegions[id];
      nextRegions[id] = rest;
    }
  });

  if (pretenderRegionIds.size === 0) {
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

  const holdShare = ownedIds.length > 0 ? pretenderRegionIds.size / ownedIds.length : 0;
  const holdStreak = holdShare >= CIVIL_WAR_HOLD_SHARE_TO_LOSE ? (nation.civilWar.holdStreak || 0) + 1 : 0;

  if (holdStreak >= CIVIL_WAR_HOLD_STREAK_TO_LOSE_TURNS) {
    // Plan: "new ruler and dynasty, government type reroll, laws reset to base, -20 prestige" — the
    // pretenders win, but the NATION survives (this is explicitly not a defeat condition). Its own
    // pretender units/region markers are cleared as part of the regime change, not left to dissolve
    // on their own the following turn.
    let clearedRegions = { ...nextRegions };
    const clearedUnits = { ...units };
    pretenderRegionIds.forEach((id) => {
      // eslint-disable-next-line no-unused-vars -- destructured only to omit occupiedBy from rest
      const { occupiedBy, ...rest } = clearedRegions[id];
      clearedRegions[id] = rest;
    });
    Object.values(units).forEach((u) => { if (u.isPretender && pretenderRegionIds.has(u.regionId)) delete clearedUnits[u.id]; });

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
        heir: null,
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
