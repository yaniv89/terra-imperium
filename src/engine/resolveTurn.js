// src/engine/resolveTurn.js
// Pure turn-resolution engine. Takes one state snapshot and returns the fully resolved next
// state, using the RNG seed carried on state (never Math.random() directly) so replays and
// multiplayer resolution are deterministic.
//
// Deliberately minimal for Phase A: calendar/age advance, resource income, AI nations' passive
// growth, and the (currently empty) scripted/procedural event pipeline. Combat, invasions,
// AI-declared wars and tech effects are NOT resolved here yet — they're rebuilt from scratch in
// Phase C/D against the new unit-class and diplomacy systems, rather than adapted from the old
// infantry/armor/air model this replaced.

import { GameStatus, LogTypes } from '../data/types';
import { AGES, getCalendarAgeId, getYearsPerTurn } from '../data/ages';
import { createEmptyResourcePool } from '../data/resources';
import { pickNextEvent } from '../data/events';
import { pickProceduralEvent } from '../data/proceduralEvents';
import { EVENT_CHAINS } from '../data/eventChains';
import { calcIncome, formatMoney, nextUnrest, getSupplyCapacity, getNationBonusTotal, getPowerIncome } from '../utils/helpers';
import { nextSiegeControlRegen, SIEGE_REGEN_COOLDOWN_TURNS } from './siege';
import { getPopulationGrowthRate, nextRegionPopulation } from './population';
import { checkNationElimination, closeWarsForEliminatedNation, wasEliminatedByPlayer, NATION_ELIMINATION_REWARD } from './elimination';
import { processAllAINations, processAIWarDecisions, processAIRecruitment, getSortedByMilitary, getRelationFromHostility } from '../utils/aiLogic';
import { resolveWarProgress } from './diplomacy';
import { checkVictoryConditions, applyVictory, VICTORY_CONDITIONS, getDiplomaticAlignmentShare, DIPLOMATIC_LEADERSHIP_SHARE } from '../data/victoryConditions';
import { SPACE_MISSIONS_BY_ID } from '../data/spaceMissions';
import { REGIONS_DATA, getOwnedRegionIds, regionsWithinRange } from '../data/regions';
import {
  REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, REBEL_GROWTH_RATE, getRebelSpawnStrength,
  REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD, REVOLT_RECLAIMED_CONTROL, REVOLT_RECLAIMED_UNREST
} from '../data/rebellion';
import { createRng } from '../utils/rng';
import { expireNationModifiers, expireRegionModifiers } from './modifiers/timed';
import { TAX_RATES } from '../data/taxRates';
import { getSatelliteEffectTotal, MAX_ORBITAL_DEBRIS } from '../data/satellites';
import { ORBITAL_DEBRIS_DECAY_PER_TURN, UNIT_UPKEEP_GOLD_PER_TURN } from '../data/actionCosts';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const WAR_EXHAUSTION_RISE_PER_TURN = 5;
const WAR_EXHAUSTION_DECAY_PER_TURN = 3;

// `onPhase(name, ms)` is an optional perf hook (src/engine/aiQualityBenchmark.test.js's M0.4 perf
// harness is the only caller) fired after each named phase below with how long it took. It costs
// one optional-chained call per phase when absent, so normal play and every other test pay nothing
// for it; when present the closure trades one `performance.now()` read per phase for the timing.
export const resolveTurn = (state, { onPhase } = {}) => {
  // Guard: nothing to resolve if the game already ended or an event is blocking play.
  if (state.gameStatus !== GameStatus.ACTIVE || state.activeEventId || state.activeProceduralEvent) {
    return state;
  }

  let phaseStart = onPhase ? performance.now() : 0;
  const mark = (name) => {
    if (!onPhase) return;
    const now = performance.now();
    onPhase(name, now - phaseStart);
    phaseStart = now;
  };

  const rng = createRng(state.rngSeed);
  const logs = [];
  // --- time ---
  const newYear = state.year + getYearsPerTurn(state.age, state.gameSpeed);
  const newAge = getCalendarAgeId(newYear);
  const newTurnNumber = state.turnNumber + 1;
  // The calendar age is a shared floor every nation crosses automatically (plan §2) — this is the
  // one moment that actually happens to everyone, so it gets a log line the same turn it lands
  // (the UI layer, App.jsx's GameLayout, is what turns this into the globe-wide banner/effect,
  // since resolveTurn is pure and has no access to EffectsContext).
  if (newAge !== state.age) {
    logs.push({ year: newYear, message: `A new era dawns: the world enters the ${AGES[newAge].name}.`, type: LogTypes.MILESTONE });
  }

  // Timed modifier expiry (plan §A.2) — runs right after the time step so an entry that expires
  // this turn no longer affects this turn's income/unrest/etc below. Nothing pushes an entry into
  // nation.modifiers[] or state.regionModifiers yet (a later milestone's event/law/disaster effect
  // will be the first real writer), so both calls are a same-reference no-op today.
  const modifierExpiredNations = expireNationModifiers(state.nations, newTurnNumber);
  const regionModifiers = expireRegionModifiers(state.regionModifiers, newTurnNumber);
  mark('time');

  // --- income ---
  const income = calcIncome({ ...state, nations: modifierExpiredNations });
  const resources = { ...createEmptyResourcePool(newAge), ...state.resources };
  Object.entries(income).forEach(([id, amount]) => { resources[id] = (resources[id] || 0) + amount; });
  logs.push({ year: newYear, message: `${Math.round(newYear)}: +${formatMoney(income.gold || 0)}`, type: LogTypes.ACTION });
  mark('income');

  // --- army maintenance ---
  // A flat per-turn gold upkeep per player-owned unit (UNIT_UPKEEP_GOLD_PER_TURN, actionCosts.js):
  // RECRUIT_UNIT/DISBAND_UNIT only ever charged a one-time cost, so a standing army was free to hold
  // once raised — this makes army size a real, continuous tradeoff against everything else gold
  // buys, not just a one-time purchase. AI nations aren't charged this: they have no simulated gold
  // economy of their own (calcIncome only computes the player's), and their fielded-army size is
  // already bounded by aiLogic.js's own age-scaled standing-unit cap.
  const playerUnitCount = Object.values(state.units).filter(u => u.ownerId === state.playerNationId).length;
  const upkeepCost = playerUnitCount * UNIT_UPKEEP_GOLD_PER_TURN;
  if (upkeepCost > 0) {
    resources.gold = Math.max(0, resources.gold - upkeepCost);
    logs.push({ year: newYear, message: `Army upkeep: -${formatMoney(upkeepCost)} (${playerUnitCount} unit${playerUnitCount === 1 ? '' : 's'})`, type: LogTypes.ACTION });
  }

  // ADM/DIP/MIL (plan §M2) each top up to the nation's per-turn budget every turn, but unspent
  // power now BANKS instead of being wiped — a turn with nothing worth spending ADM on right now
  // becomes "save up for a pricier wonder next turn" instead of pure waste. Capped at 2x the
  // current max so banking can't grow unbounded over a ~500-turn game; a fully-spent turn (0 left)
  // still lands exactly on the flat income a player always got before this existed.
  // getPowerIncome (Administrative Capacity) is recomputed fresh from current government/tech
  // every turn rather than read from a stored field, so adopting a government or finishing a
  // Governance tech takes effect on the very next turn automatically.
  const powerIncome = getPowerIncome({ ...state, nations: modifierExpiredNations });
  const POWER_BANK_CAP_MULTIPLIER = 2;
  ['adm', 'dip', 'mil'].forEach((pool) => {
    const income = powerIncome[pool];
    // Reads `resources[pool]` (already `state.resources[pool]` at this point, or that PLUS
    // this turn's calcIncome addition — e.g. a Communications Satellite's dipPerTurn trickle —
    // never `state.resources[pool]` directly, or a satellite's contribution would be silently
    // overwritten by this bank-up step immediately after calcIncome applied it.
    resources[`max${pool[0].toUpperCase()}${pool.slice(1)}`] = income;
    resources[pool] = Math.min((resources[pool] || 0) + income, income * POWER_BANK_CAP_MULTIPLIER);
  });
  mark('maintenanceAndPower');

  // --- unrest drift (every region, not just the player's — this is a generic mechanic every
  // nation's own territory is subject to) ---
  const regions = { ...state.regions };
  const satellites = state.satellites || {};
  Object.entries(regions).forEach(([id, region]) => {
    const owner = modifierExpiredNations[region.owner];
    const taxUnrestDelta = TAX_RATES[owner?.taxRate]?.unrestDeltaPerTurn || 0;
    const stabilityBonus = getNationBonusTotal(owner, 'stabilityBonus') + getSatelliteEffectTotal(satellites, region.owner, 'stabilityBonus', state.orbitalDebrisLevel);
    const unrest = nextUnrest(region, stabilityBonus, taxUnrestDelta);
    // Siege recovery (src/engine/siege.js): a region not attacked recently regenerates the control
    // combat ground down — an interrupted siege doesn't bank its damage forever. Also clears the
    // `underInvasion` map/UI flag once the cooldown passes, so a region stops reading as "under
    // attack" once it genuinely no longer is.
    const control = region.lastAttackedTurn != null ? nextSiegeControlRegen(region, newTurnNumber) : region.control;
    const stillUnderCooldown = region.lastAttackedTurn != null && (newTurnNumber - region.lastAttackedTurn) < SIEGE_REGEN_COOLDOWN_TURNS;

    // Population (plan item 3): driven by the Food & Growth building tier, infrastructure,
    // government/policy/wonder popGrowthBonus and unrest — not automatic time-based growth. A
    // region actively under invasion this turn loses population instead of growing (src/engine/
    // population.js has the full breakdown).
    const modernBaseline = REGIONS_DATA[id]?.population || 0;
    const growthRate = getPopulationGrowthRate({
      foodTier: region.buildings?.categories?.food ?? -1,
      infrastructure: region.currentInfrastructure || 0,
      popGrowthBonus: getNationBonusTotal(owner, 'popGrowthBonus'),
      unrest
    });
    const currentPopulation = nextRegionPopulation({
      currentPopulation: region.currentPopulation || modernBaseline,
      modernBaseline,
      growthRate,
      underInvasion: region.underInvasion
    });

    if (unrest !== region.unrest || control !== region.control || (region.underInvasion && !stillUnderCooldown) || currentPopulation !== region.currentPopulation) {
      regions[id] = { ...region, unrest, control, underInvasion: stillUnderCooldown ? region.underInvasion : false, currentPopulation };
    }
  });
  mark('regionUnrestAndPopulation');

  // --- rebellion (plan §9): unrest crossing the threshold spawns an actual rebel army in the
  // region rather than just a number. Falling back below the threshold (e.g. after Quell Unrest,
  // or SUPPRESS_REBELLION restoring control) lets the uprising dissolve; staying above it lets
  // the existing rebel force grow instead of spawning a second one.
  //
  // Conquered territory (region.formerOwner set — see src/data/rebellion.js) has a real endgame
  // beyond "keep fighting the same army forever": left unresolved for REVOLT_SUCCESS_TURNS, the
  // revolt succeeds outright and the region reverts to whoever held it before its current owner.
  // Home territory (no formerOwner) has nothing to revert to, so it never takes this branch.
  const units = { ...state.units };
  const rebelUnitIdByRegion = {};
  Object.values(units).forEach(u => { if (u.ownerId === REBEL_OWNER_ID) rebelUnitIdByRegion[u.regionId] = u.id; });
  Object.entries(regions).forEach(([regionId, region]) => {
    const existingRebelId = rebelUnitIdByRegion[regionId];
    if (region.unrest >= REBELLION_UNREST_THRESHOLD) {
      if (existingRebelId) {
        const rebel = units[existingRebelId];
        const turnsActive = newTurnNumber - (rebel.spawnedTurn ?? newTurnNumber);
        if (region.formerOwner && turnsActive >= REVOLT_SUCCESS_TURNS) {
          const reclaimedBy = region.formerOwner;
          const occupierId = region.owner;
          delete units[existingRebelId];
          Object.values(units)
            .filter(u => u.regionId === regionId && u.ownerId === occupierId)
            .forEach(u => { delete units[u.id]; });
          regions[regionId] = {
            ...region,
            owner: reclaimedBy,
            formerOwner: undefined,
            control: REVOLT_RECLAIMED_CONTROL,
            unrest: REVOLT_RECLAIMED_UNREST
          };
          logs.push({
            year: newYear,
            message: `The uprising in ${REGIONS_DATA[regionId]?.name || regionId} succeeds — ${state.nations[reclaimedBy]?.name || reclaimedBy} reclaims it from ${state.nations[occupierId]?.name || occupierId}.`,
            type: LogTypes.CRISIS
          });
        } else {
          const strength = Math.round(rebel.strength * (1 + REBEL_GROWTH_RATE));
          units[existingRebelId] = { ...rebel, strength, maxStrength: Math.max(rebel.maxStrength, strength) };
        }
      } else {
        const rebelId = `rebel_${regionId}_${newTurnNumber}`;
        const strength = getRebelSpawnStrength(region);
        units[rebelId] = {
          id: rebelId, regionId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: newAge,
          strength, maxStrength: strength, morale: 100, organization: 100,
          xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
          spawnedTurn: newTurnNumber
        };
        regions[regionId] = { ...region, control: Math.max(0, (region.control || 0) - 30) };
        logs.push({ year: newYear, message: `Rebellion breaks out in ${REGIONS_DATA[regionId]?.name || regionId}!`, type: LogTypes.CRISIS });
      }
    } else if (existingRebelId) {
      delete units[existingRebelId];
      logs.push({ year: newYear, message: `The unrest behind the rebellion in ${REGIONS_DATA[regionId]?.name || regionId} has eased, and it dissolves.`, type: LogTypes.CRISIS });
    }

    // Integration (the other end condition — the good ending): conquered land that has climbed to
    // a secure level of control without presently rebelling counts as fully absorbed. formerOwner
    // clears permanently, even if the region rebels again later for some unrelated reason.
    const current = regions[regionId] || region;
    if (current.formerOwner && current.unrest < REBELLION_UNREST_THRESHOLD && (current.control || 0) >= INTEGRATION_CONTROL_THRESHOLD) {
      regions[regionId] = { ...current, formerOwner: undefined };
    }
  });

  // --- supply attrition (plan §9): armies beyond their nation's supply reach bleed strength each
  // turn — this is what makes Build Infrastructure strategically load-bearing, not just an
  // economy button. Every nation's units are subject to it, not just the player's. A unit
  // stationed on one of its own regions is always distance 0 from itself and never bled; only
  // units that have marched beyond every region their nation actually holds pay the cost.
  const SUPPLY_ATTRITION_RATE = 0.1;
  const unitsByOwner = {};
  Object.values(units).forEach(u => { (unitsByOwner[u.ownerId] = unitsByOwner[u.ownerId] || []).push(u); });
  Object.entries(unitsByOwner).forEach(([ownerId, ownerUnits]) => {
    const ownedRegionIds = getOwnedRegionIds(regions, ownerId);
    if (ownedRegionIds.length === 0) return; // no territory of its own (e.g. rebels) — nothing to be supplied from
    const maxSupplyRange = Math.max(...ownedRegionIds.map(id => getSupplyCapacity(regions[id].currentInfrastructure)));
    // One bounded multi-source BFS covers every in-range region at once, rather than a fresh
    // search per distinct region a unit happens to occupy — the set of in-range regions is the
    // same for every one of this nation's units this turn regardless of how many distinct
    // regions they're spread across.
    const inSupplyRegions = regionsWithinRange(ownedRegionIds, maxSupplyRange);
    ownerUnits.forEach(u => {
      if (u.embarkedOn) return; // cargo shares its transport's supply state, not its own
      if (inSupplyRegions.has(u.regionId)) return; // in supply
      // Math.floor, not round: a unit's strength must actually reach 0 under sustained attrition
      // rather than rounding back up to 1 forever once it gets small.
      const strength = Math.max(0, Math.floor(u.strength * (1 - SUPPLY_ATTRITION_RATE)));
      if (strength <= 0) { delete units[u.id]; return; }
      units[u.id] = { ...u, strength };
    });
  });
  mark('rebellionAndSupply');

  // --- AI nations: passive growth + hostility drift ---
  const aiUpdates = processAllAINations(state, newYear, rng);
  const nations = { ...modifierExpiredNations };
  Object.entries(nations).forEach(([nId, nation]) => {
    if (nation.isPlayer) return;
    const growthUpdate = aiUpdates.nationUpdates[nId];
    const militaryStrength = Math.max(100, nation.militaryStrength + (growthUpdate?.militaryStrengthChange || 0));
    const hostility = clamp(nation.hostility + (growthUpdate?.hostilityChange || 0), nation.hostilityFloor || 0, 100);
    const relationStatus = nation.isAtWar || nation.hasPeaceTreaty || nation.hasTradeAgreement
      ? nation.relationStatus
      : getRelationFromHostility(hostility, nation.isAtWar, nation.hasPeaceTreaty, nation.hasTradeAgreement);
    nations[nId] = { ...nation, militaryStrength, hostility, relationStatus };
  });
  logs.push(...aiUpdates.logs.map(l => ({ year: newYear, ...l })));
  mark('aiGrowthAndHostility');

  // sortedByMilitary is computed once here, not per nation, to keep both of the following passes
  // affordable across 240 nations.
  const sortedByMilitary = getSortedByMilitary({ ...state, nations });

  // --- AI recruitment (plan §8.5's counter-building, Task 36): Tier 1 nations turn some of their
  // abstract militaryStrength growth into real, counterable units in state.units — recruiting
  // whatever class beats their most relevant rival's dominant class. Uses the calendar age, not a
  // per-nation tech age (AI nations don't track one independently). ---
  const recruitment = processAIRecruitment({ ...state, nations }, units, nations, regions, sortedByMilitary, newAge, rng);
  Object.assign(units, recruitment.units);
  Object.assign(nations, recruitment.nations);
  logs.push(...recruitment.logs.map(l => ({ year: newYear, ...l })));
  mark('aiRecruitment');

  // --- AI war declarations (plan §8.5's tiered AI): Tier 1 nations (at war, bordering the
  // player, or a top-20 military power) may each declare one war this turn against a weaker
  // neighbor, biased by doctrine and hostility. ---
  const warDecisions = processAIWarDecisions({ ...state, nations }, nations, state.wars, sortedByMilitary, rng);
  let nationsAfterWars = warDecisions.nations;
  let wars = warDecisions.wars;
  logs.push(...warDecisions.logs.map(l => ({ year: newYear, ...l })));
  mark('aiWarDeclarations');

  // --- AI war progress (plan §8.5's war-goal resolution): territorial conquest rolls, mutual
  // attrition, and ending a war outright once its goal is met — this is what makes every one of
  // the 240 nations conquerable by ANY nation, not just the player. A war the player started is
  // untouched here; that's resolved by the player's own invasion actions instead.
  const warProgress = resolveWarProgress({ ...state, regions, nations: nationsAfterWars }, regions, nationsAfterWars, wars, rng);
  Object.assign(regions, warProgress.regions);
  nationsAfterWars = warProgress.nations;
  wars = warProgress.wars;
  logs.push(...warProgress.logs.map(l => ({ year: newYear, ...l })));
  mark('aiWarProgress');

  // --- nation elimination (src/engine/elimination.js): a nation reduced to zero regions this turn
  // — by the player's own invasions (which land immediately via gameReducer.js, so this sweep is
  // what actually notices them), by AI-vs-AI conquest just above, or by losing its last region to
  // a rebellion — has nothing left to govern or fight with. playerEliminatedNationId is a
  // transient, one-turn signal (App.jsx diffs it to show a one-shot reward popup); it's not
  // persisted anywhere else on state. ---
  let playerEliminatedNationId = null;
  Object.keys(nationsAfterWars).forEach((nId) => {
    const eliminated = checkNationElimination(nationsAfterWars, regions, nId);
    if (!eliminated) return;
    nationsAfterWars = { ...nationsAfterWars, [nId]: eliminated };
    wars = closeWarsForEliminatedNation(wars, nId);
    logs.push({ year: newYear, message: `${eliminated.name} has been eliminated — no territory remains under its control.`, type: LogTypes.MILESTONE });
    if (wasEliminatedByPlayer(regions, state.playerNationId, nId)) {
      resources.gold = (resources.gold || 0) + NATION_ELIMINATION_REWARD.gold;
      resources.dip = (resources.dip || 0) + NATION_ELIMINATION_REWARD.dip;
      playerEliminatedNationId = nId;
      logs.push({
        year: newYear,
        message: `You have conquered ${eliminated.name} entirely! +${formatMoney(NATION_ELIMINATION_REWARD.gold)}, +${NATION_ELIMINATION_REWARD.dip} DIP.`,
        type: LogTypes.MILESTONE
      });
    }
  });
  mark('elimination');

  // --- war exhaustion (plan §9/§11): rises for every nation at war, including the player,
  // decays at peace. Makes a long war's eventual Sue for Peace cheaper (GameContext.jsx) — this
  // is what "forces you to actually end them" rather than letting a war run forever for free.
  Object.entries(nationsAfterWars).forEach(([nId, nation]) => {
    const delta = nation.isAtWar ? WAR_EXHAUSTION_RISE_PER_TURN : -WAR_EXHAUSTION_DECAY_PER_TURN;
    const warExhaustion = clamp((nation.warExhaustion || 0) + delta, 0, 100);
    if (warExhaustion !== nation.warExhaustion) nationsAfterWars[nId] = { ...nation, warExhaustion };
  });
  mark('warExhaustion');

  // --- space mission ladder (plan §10.4 Layer 3): each in-progress mission ticks down one turn;
  // reaching 0 moves it into completedMissions and applies its one-time reward. Recurring rewards
  // are read generically from completedMissions every turn by calcIncome instead of being applied
  // once here, so there's exactly one place that sums them. ---
  const completedMissions = [...(state.completedMissions || [])];
  const spaceMissionProgress = {};
  Object.entries(state.spaceMissionProgress || {}).forEach(([missionId, turnsRemaining]) => {
    const remaining = turnsRemaining - 1;
    if (remaining > 0) {
      spaceMissionProgress[missionId] = remaining;
      return;
    }
    completedMissions.push(missionId);
    const mission = SPACE_MISSIONS_BY_ID[missionId];
    if (mission?.oneTimeReward?.gold) resources.gold = (resources.gold || 0) + mission.oneTimeReward.gold;
    if (mission?.oneTimeReward?.dip) resources.dip = (resources.dip || 0) + mission.oneTimeReward.dip;
    logs.push({ year: newYear, message: `${mission?.name || missionId} complete!`, type: LogTypes.MILESTONE });
  });
  mark('spaceMissions');

  // --- diplomatic leadership streak (plan §10.4's Diplomatic victory) ---
  const alignmentShare = getDiplomaticAlignmentShare({ ...state, nations: nationsAfterWars });
  const diplomaticLeadershipStreak = alignmentShare >= DIPLOMATIC_LEADERSHIP_SHARE ? (state.diplomaticLeadershipStreak || 0) + 1 : 0;

  // --- events ---
  const dueEvent = pickNextEvent(newYear, nations, state.firedEvents, state.playerNationId, regions);

  // --- event chains ---
  // A scripted follow-up scheduled earlier by applyEventEffects.js (effects.spawnFollowUp) fires
  // as soon as its dueTurn is reached, but only when no scripted historical event is already due
  // this turn.
  const pendingEventChains = state.pendingEventChains || [];
  let chainEventId = null;
  let nextPendingEventChains = pendingEventChains;
  if (!dueEvent) {
    const dueIndex = pendingEventChains.findIndex(c => c.dueTurn <= newTurnNumber && EVENT_CHAINS[c.id]);
    if (dueIndex !== -1) {
      chainEventId = pendingEventChains[dueIndex].id;
      nextPendingEventChains = pendingEventChains.filter((_, i) => i !== dueIndex);
    }
  }

  // --- procedural events ---
  // Only rolled when no scripted event or chain event is already due this turn. Gated behind a
  // cooldown (a random few turns after each firing) so these don't cluster.
  let proceduralEventCooldown = Math.max(0, (state.proceduralEventCooldown || 0) - 1);
  let activeProceduralEvent = null;
  if (!dueEvent && !chainEventId && proceduralEventCooldown <= 0 && rng.next() < 0.3) {
    const candidate = pickProceduralEvent({ ...state, nations, turnNumber: newTurnNumber, year: newYear }, rng);
    if (candidate) {
      activeProceduralEvent = candidate;
      proceduralEventCooldown = 3 + Math.floor(rng.next() * 5);
    }
  }

  // --- orbital debris (plan §10.4): decays slowly every turn, whether or not anyone's fighting
  // over orbit this turn (ASAT_STRIKE, GameContext.jsx, is what raises it) ---
  const orbitalDebrisLevel = clamp((state.orbitalDebrisLevel || 0) - ORBITAL_DEBRIS_DECAY_PER_TURN, 0, MAX_ORBITAL_DEBRIS);
  mark('diplomacyStreakEventsAndDebris');

  // --- assemble next state ---
  let next = {
    ...state,
    year: newYear,
    age: newAge,
    turnNumber: newTurnNumber,
    resources,
    regions,
    nations: nationsAfterWars,
    units,
    wars,
    regionModifiers,
    orbitalDebrisLevel,
    spaceMissionProgress,
    completedMissions,
    diplomaticLeadershipStreak,
    playerEliminatedNationId,
    activeEventId: dueEvent ? dueEvent.id : chainEventId,
    activeProceduralEvent,
    proceduralEventCooldown,
    pendingEventChains: nextPendingEventChains,
    rngSeed: rng.getSeed(),
    logs: [...state.logs, ...logs]
  };
  mark('assembleNextState');

  // --- victory (checked against THIS turn's resolved state, not last turn's) ---
  // Not checked while an event is actively pending, so a victory never lands mid-event-resolution.
  if (next.gameStatus === GameStatus.ACTIVE && !next.activeEventId && !next.activeProceduralEvent) {
    const conditionId = checkVictoryConditions(next);
    if (conditionId) {
      const condition = VICTORY_CONDITIONS[conditionId];
      next = applyVictory(next, conditionId);
      next.logs = [...next.logs, { year: newYear, message: `VICTORY: ${condition.name} achieved!`, type: LogTypes.MILESTONE }];
    }
  }
  mark('victory');

  return next;
};
