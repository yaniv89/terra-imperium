import { orderMarch, cancelRoute, placeName } from './routes';
import { normalizeUnitTiles, regionForTile, tileAccess, passableTile, unitTile } from './armies';
import { atSea, touchesCoastOf } from './fleets';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs, applyFieldResult } from './fieldBattle';
import { validateFleetAttack, getFleetBattleContext, getFleetResolveArgs, applyFleetResult } from './navalBattle';
import { abandonColony, foundColony, validateColony } from './colonies';
import { chooseResearch, emptyResearch, queueResearch, unqueueResearch } from './research';
import { applyScenario } from './worldgen/emergentWorld';
import { syncWorldRegistry } from './world/registry';
import { queueItem, dequeueItem, setFocus, toggleLock, canQueue, claimCandidates, buyTileCost, canFoundCity, addPeople, sizeToPeople } from './world/cities';
import { isSettler, settlerPath, canSettle, foundOutpost, SETTLER_MOVES } from './settlers';
import { markTutorialStep } from './tutorial';
import { answerDemand } from './aiAccords';
import { getTiles } from '../data/geo/tiles';
import { canSubjugate, reconcileTerritory } from './worldLifecycle';
// src/engine/gameReducer.js
// The pure reducer + initial-state factory, extracted from src/context/GameContext.jsx (Phase F,
// plan §10): "the same module runs client-side for instant local feedback and fully offline
// skirmish" AND, unmodified, inside a server-authoritative resolution context (a Supabase Edge
// Function replaying a client's submitted actions) — which requires it to import nothing from
// React or the DOM. It lived inside GameContext.jsx for phases A-F because nothing besides the
// React Provider needed it anywhere else; now that a server-side caller does, it's a real module
// boundary rather than a convenience.
//
// gameReducer is the authoritative validation point for every player action: dispatch(action) ->
// gameReducer(state, action) -> next state, exactly once, with no other path to mutate state.
// GameContext.jsx re-exports both `createInitialState` and `gameReducer` from here so every
// existing import site (`from '../context/GameContext'`) keeps working unchanged.
import { GameStatus, ActionTypes, RelationStatus, LogTypes, TechCategories } from '../data/types';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner, distanceFromAnchor, getNationCapital, getCapital, getBorderingNationIds } from '../data/regions';
import { WORLD_NATIONS, peopleNationRecord } from '../data/worldNations';
import { peopleForNationId } from '../data/peoples';
import { DEFAULT_WORLD_SIZE } from '../data/worldSizes';
import { pickMajors } from './worldgen/peoplesWorld';
import { pickIndependents, asIndependentSource, finalizeIndependents } from './independents';
import { refreshPeopleNames } from './peopleNames';
import { TECH_TREE } from '../data/techTree';
import {
  GOVERNMENT_TYPES, canChangeGovernmentType, canEnactReform, resetReformsForType, getReformChoices
} from '../data/government';
import { IDENTITY_AXES, IDENTITY_SHIFT_STEP, IDENTITY_SHIFT_COOLDOWN_TURNS, clampIdentity } from '../data/identity';
import { getLaw, canEnactLaw, getLawChangeCost, LAW_CHANGE_COOLDOWN_TURNS, COLLECTIVIZATION_UNREST_MODIFIER, COLLECTIVIZATION_UNREST_TURNS, DEFAULT_LAWS } from '../data/laws';
import { transferRegion } from './regionTransfer';
import { grantIntel } from './intel';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs, applyInvasionResult, isUnitInBattle, MISSILE_POWER_TIERS, validateAmphibious, applyAmphibiousLanding, getAmphibiousBattleContext } from './invasion';
import { declareWar, hasCasusBelli, isWarBetween, isAtWarWithPlayer, isInTruce, getTradePactCapacity, recordBattle, setTruce, refreshWarFlags, PEACE_OFFER_COOLDOWN_TURNS } from './diplomacy';
import { canAttack } from './hostility';
import { isIndependent, isIndependentNation, GRUDGE_ATTACKED } from '../data/independents';
import { addGrudge } from './grudges';
import { hireMercenaryForPlayer } from './mercenaries';
import { answerTributeDemand, resolveRaidBattle } from './raids';
import { isRaidKind, queuedRaidArmies } from './raidBattle';
import { interceptArmies, landingArmies, resolveInterceptQueued, resolveLandingQueued } from './aiLanding';
import { giftIndependent, proposeJoining, answerJoinOffer, demandIndependentTribute, proposeIndependentTrade, offerIndependentTribute, razeCityForPlayer } from './indepPolicy';
import { canRaze, stopRazing } from './razing';

const endWar = (wars, id) => wars.map((w) => (w.id === id ? { ...w, active: false, goalAchieved: true } : w));
import { addNationModifier } from './modifiers/timed';
import { getEffectiveMilitaryPower } from './aiEconomy';
import { applyPeace, getPeaceAcceptance } from './peace';
import { levyUnit } from './aftermath';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { START_YEAR, END_YEAR, getCalendarAgeId, getEffectiveAgeId } from '../data/ages';
import { getRegionTerrain } from '../data/terrain';
import { createEmptyResourcePool } from '../data/resources';
import {
  canBuildTier, canBuildExtraction, BUILDING_CATEGORIES,
  getBuildingSlots, getUsedBuildingSlots, getBuildingTierCost, getCategoryTierName
} from '../data/buildings';
import { hasDeposit } from '../data/deposits';
import { getAvailableClasses } from '../data/unitClasses';
import {
  ACTION_COSTS, DISBAND_HR_REFUND_RATIO, FUND_SCHOLARS_TECHPOINTS,
  SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD, GIFT_HOSTILITY_REDUCTION,
  UNJUSTIFIED_WAR_GLOBAL_HOSTILITY, UNJUSTIFIED_WAR_HOME_UNREST,
  SETTLE_COLONIZE_CONTROL_THRESHOLD, SETTLE_COLONIZE_START_CONTROL, SETTLE_COLONIZE_START_UNREST, SETTLE_COLONIZE_OWNER_HOSTILITY,
  POPULATION_POLICY_GROWTH_RATE, ASAT_DEBRIS_RISE,
  ESPIONAGE_SUCCESS_CHANCE, ESPIONAGE_TECH_POINTS_STOLEN, ESPIONAGE_FAILURE_HOSTILITY_INCREASE,
  COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD, CLIMATE_RESILIENCE_MAX,
  CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION,
  ARMY_MAINTENANCE_DEFAULT, FUSION_GRID_ACTIVATION_HELIUM3,
  MAX_RIVALS, MARRIAGE_HOSTILITY_REDUCTION,
  BREAK_ALLIANCE_HOSTILITY_INCREASE, INSULT_HOSTILITY_INCREASE, STARTING_DIPLOMATS,
  TRUCE_BREAK_STABILITY_PENALTY, TRUCE_BREAK_PRESTIGE_PENALTY, TRUCE_BREAK_AE_AGAINST_NEIGHBORS,
  VASSALIZE_HOSTILITY_CEILING, VASSALIZE_STRENGTH_RATIO, VASSAL_ANNEX_COOLDOWN_TURNS, VASSAL_ANNEX_DIP_PER_DEV,
  ESPIONAGE_SUPPORT_REBELS_UNREST_INCREASE, INTEL_DURATION_TURNS, MOVE_CAPITAL_FOREIGN_STABILITY_PENALTY, LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD } from '../data/actionCosts';
import { resolveTurn } from './resolveTurn';
import { buildInvasionSetup } from '../battle/setup/buildBattleSetup';
import { resolveAutoBattle } from './autoBattle';
import { applyBattleOutcome, makeBattleOutcome, battleIdOf } from './battleOutcome';
import { cityMilitia, reinforcementSources } from './battleInputs';
import { battleQueueBlocked, queuedKind, queuedArmies, resolveQueuedAuto, resolveAllQueuedAuto, drainAutoBattles, aggressorView } from './battleQueue';
import { replayBattle } from '../battle/sim/replay';

// Re-exported so the edge-function bundle (scripts/build-edge-engine.mjs) can verify a battle log
// on its own, too.
export { replayBattle };
import { applyDefenseResult, getDefenseArmies, resolveDefenseAuto, applyDefenseWithdrawal } from './defense';
import { applyEventEffects } from './applyEventEffects';
import { getDefenseLevelDamageReductionMultiplier, getZoneOfControlMultiplier } from './siege';
import { pillageTile } from './threat';
import { canPromote, getPerk } from '../data/promotions';
import { generateGeneral } from '../data/generals';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { randomSeed, createRng } from '../utils/rng';
import { applyStartingDoctrine } from '../data/startingDoctrines';
import { applyDifficulty } from '../data/difficulty';
import { initFog, updateFog, fogOn, hasMet } from './fog';
import { generateRuler, generateAdvisorCandidates, getAdvisorHireCost } from './rulers';
import { clampStability, clampPrestige, getIncreaseStabilityCost } from './nationalPower';
import { getTotalDev, DEV_TYPE_POOL, getDevelopProvinceCost, DEVELOP_PROVINCE_POP_GAIN_RATIO } from './development';
import { getModifier, getRegionModifier } from './modifiers/sheet';
import { canAfford, applyCosts, BASE_POWER_PER_TURN, formatMoney } from '../utils/helpers';
import { SATELLITE_TYPES, canLaunchSatellite, MAX_ORBITAL_DEBRIS } from '../data/satellites';
import {
  MISSILE_TIERS, MAX_ABM_LEVEL, getAbmReductionMult, canBuildMissile, isMissileInRange, NUCLEAR_GLOBAL_HOSTILITY,
  NUCLEAR_PRESTIGE_PENALTY, NUCLEAR_PARIAH_DURATION_TURNS, NUCLEAR_PARIAH_GOLD_MULT_PENALTY
} from '../data/missiles';
import { SPACE_MISSIONS_BY_ID, canLaunchMission } from '../data/spaceMissions';
import { TAX_RATE_IDS, DEFAULT_TAX_RATE, TAX_RATE_CHANGE_COOLDOWN_TURNS } from '../data/taxRates';
import { getLoanCapacity, getLoanInterestRate, getLoanSize, clampMaintenance, getRecruitUnitCost, hasBankingHouses } from './economy';
import { canFabricateClaim, claimableCities, startClaim, CLAIM_FABRICATE_TURNS } from './claims';
import { hasOpenBorders, openBordersAcceptance, setOpenBorders, applyDemand, DEMANDS } from './accords';
import { turnBlockers } from './turnBlockers';
import { cityGroups, governorChoices, assignGovernor, dismissGovernor, GOVERNOR_ASSIGN_TURNS } from './governors';
import { validateTemplate, saveTemplate, deleteTemplate, templatesOf, armyOrder } from './armyTemplates';
import { NAVAL_LINES, navalCargo, navalAir } from '../data/navalLines';
import { canQueueWonder, wonderItem } from './wonders';


// How many land units one naval unit can carry (plan §7.5's Embark/Disembark).

// Any of the 240 nations works as a fallback default — only used when no explicit choice (from
// the country-select start screen) or saved game is present yet.
const DEFAULT_PLAYER_NATION_ID = 'us';

const formatYear = (year) => (year < 0 ? `${-year} BCE` : `${year} CE`);

// ============ INITIAL STATE FACTORY ============
// Exported (not just used internally) so it doubles as test fixture data — resolveTurn.test.js
// and applyEventEffects.test.js build realistic states from it rather than hand-rolling partial
// mocks that could silently drift from the real shape.
export const createInitialState = ({ playerNationId = DEFAULT_PLAYER_NATION_ID, gameSpeed = 'normal', rngSeed, scenario, guided = false, fog = true } = {}) => {
  const year = START_YEAR;
  const age = getCalendarAgeId(year);

  // Cities and land come from the scenario (src/engine/worldgen/emergentWorld.js applies the
  // start on the tile grid at the end of this function); `regions` is empty until then.
  const regions = {};

  // Ruler generation (plan §M3) draws from a seeded rng so the whole nations table stays
  // reproducible from state.rngSeed alone — the seed captured at the end of this loop already
  // reflects every draw made generating all 240 rulers, so turn 1 continues deterministically
  // from there rather than replaying the same draws again. `rngSeed` is an optional override (tests,
  // and the edge-bundle parity check) so the WHOLE initial state — not just the final stored seed —
  // can be pinned and reproduced; real gameplay always omits it and gets fresh randomness.
  const baseSeed = rngSeed ?? randomSeed();
  const rulerRng = createRng(baseSeed);

  // A peoples world (new games, phase W0: src/engine/worldgen/peoplesWorld.js) draws its majors
  // from the 150-people pool with the world seed; an old country id for the player maps to the
  // people of that land (LEGACY_NATION_IDS). The legacy worlds keep all 240 country records.
  const peoplesMode = scenario?.mode === 'peoples';
  if (peoplesMode) {
    const mapped = peopleForNationId(playerNationId);
    if (!mapped) throw new Error(`Unknown people ${playerNationId}`);
    playerNationId = mapped;
  }
  const worldSeed = peoplesMode ? (scenario?.seed ?? baseSeed) : (scenario?.seed ?? rngSeed ?? 1);
  const majorIds = peoplesMode ? pickMajors(playerNationId, scenario.size || DEFAULT_WORLD_SIZE, worldSeed, { tiles: getTiles() }) : null;
  // Every other people of the pool is an independent city (phase W1, src/engine/independents.js);
  // `independents: false` in the scenario leaves them out (majors only, as phase W0 built it).
  const independentPick = peoplesMode && scenario.independents !== false ? pickIndependents(majorIds, scenario.size || DEFAULT_WORLD_SIZE, worldSeed) : { ids: [], late: [] };
  const nationSource = peoplesMode
    ? Object.fromEntries([
      ...majorIds.sort().map((id) => [id, peopleNationRecord(id)]),
      ...independentPick.ids.map((id) => [id, asIndependentSource(peopleNationRecord(id))])
    ])
    : WORLD_NATIONS;

  // Plan §M4: overextension is measured relative to each nation's OWN starting size, so a 50-region
  // nation and a 1-region nation are equally "at capacity" at the same overextension% — captured
  // once, here, since region ownership churns every game while this stays a fixed reference point.
  const startRegionCountByOwner = {};

  // Every nation of the world gets a record — any of them can be the player's.
  const nations = {};
  Object.entries(nationSource).forEach(([id, data]) => {
    const ruler = generateRuler(id, rulerRng, { turnNumber: 1, age, gameSpeed });
    nations[id] = {
      id,
      name: data.name,
      ...(data.people ? { people: data.people } : {}),
      color: data.color,
      isPlayer: id === playerNationId,
      hostility: data.startHostility,
      militaryStrength: data.startMilitary,
      doctrine: data.doctrine || 'attrition',
      relationStatus: RelationStatus.NEUTRAL,
      isAtWar: false,
      hasPeaceTreaty: false,
      hasTradeAgreement: false,
      hasMilitaryPact: false,
      // Permanent floor hostility decay can't cross below, set once a peace treaty with this
      // nation is broken by a new war — see src/engine/diplomacy.js declareWar().
      hostilityFloor: 0,

      // Government (plan §M8.1) — a TYPE plus one reform choice per age tier reached, replacing
      // the old flat 10-id model. Every nation gets the field so resolveTurn.js's stability pass
      // can read any nation's bonus generically, but only the player can change it via
      // CHANGE_GOVERNMENT_TYPE/ENACT_GOVERNMENT_REFORM today; AI adoption is M16's job.
      government: { type: 'tribal', reforms: {} },
      // Laws (plan §M8.2) — one law per category, replacing the old shared policy-slot pool
      // (policies.js, deleted). Every nation starts on each category's tier-1 law.
      laws: { ...DEFAULT_LAWS },
      lawCooldowns: {},
      identityShiftCooldownTurn: 0,
      // Set Tax Rate (plan §M11) — every nation gets a rate so calcIncome/nextUnrest can read any
      // nation's generically; only the player can change theirs today. taxRateCooldownUntil is the
      // turn the rate can next change (0 = available now), the same "store the unlock turn, default
      // 0" shape lawCooldowns already uses so a fresh nation isn't already
      // on cooldown at turn 0. extortionateTaxProgress backs the extortionate tier's periodic
      // stability drain (nationalPower.js), the same shape stabilityDecayProgress already uses.
      taxRate: DEFAULT_TAX_RATE,
      taxRateCooldownUntil: 0,
      extortionateTaxProgress: 0,

      // Economy overhaul (plan §M11) — army/navy maintenance sliders (upkeep scaling; see
      // economy.js's header for the morale-recovery/reinforcement scope trim), loans, and the
      // Fusion Grid national decision's active/supplied flag.
      armyMaintenance: ARMY_MAINTENANCE_DEFAULT,
      navyMaintenance: ARMY_MAINTENANCE_DEFAULT,
      loans: [],
      fusionGridActive: false,

      // National Identity (added alongside Government/Laws, but a separate axis — see
      // src/data/identity.js): three independent sliders shifted a step at a time via SHIFT_IDENTITY.
      // Every nation carries the field for the same generic-read reason as government/laws/taxRate
      // above; only the player can shift theirs today.
      identity: { collectivism: 0, secularism: 0, globalism: 0 },
      // Cultural Export (Modern age, CULTURAL_EXPORT action) — a "Great Innovator"-style prestige
      // score for culture rather than tech: a persistent, ever-growing soft-power total on top of
      // the one-shot hostility reduction the action also grants. Real mechanical teeth: aiLogic.js's
      // coalition-vs-runaway-leader check discounts its own eagerness to strike a leader by their
      // culturalInfluence (getCulturalCoalitionDiscount) — soft power genuinely buys down the world
      // ganging up on you, without defeating that anti-snowball check outright.
      culturalInfluence: 0,

      // Missiles and ABM defense (plan §10.4 Layer 2) — a flat stockpile per tier, not individual
      // unit objects, since a missile has no position/movement of its own before it's fired.
      missiles: { tactical: 0, theatre: 0, icbm: 0, nuclear: 0 },
      abmDefenseLevel: 0,

      // Diplomacy (plan §11's nation data model: "+ warExhaustion, legitimacy, claims[], vassals[]")
      // — claims make a later DECLARE_WAR against that nation justified (FABRICATE_CLAIM);
      // warExhaustion rises every turn a nation is at war and decays at peace (resolveTurn.js),
      // making a long war's eventual SUE_FOR_PEACE cheaper. vassals[] is scaffolded now (an empty
      // array every nation carries) for the Vassalize/Release action a later task adds.
      claims: [],
      warExhaustion: 0,
      // Vassals (plan §M12; scaffolded since M4, this milestone finally gives it a real writer:
      // VASSALIZE/ANNEX_VASSAL/RELEASE_VASSAL, gameReducer.js below). vassalOf/vassalizedTurn are
      // set on the VASSAL's own record; vassals[] lives on the OVERLORD.
      vassals: [],
      vassalOf: null,
      vassalizedTurn: 0,
      // Truces (plan §M12/M13, set by diplomacy.js's setTruce whenever a war ends): mirrored
      // { [otherNationId]: expiresTurn } on both former belligerents.
      truces: {},
      // Aggressive Expansion (plan §M12, src/engine/expansion.js): { [targetId]: number }, this
      // nation's own accrued anger at whoever captured land near it.
      ae: {},
      // Rivals (plan §M12) — up to MAX_RIVALS nation ids the player has designated; only the
      // player acts on this today, the same "every nation carries the field generically" pattern
      // as laws/taxRate above.
      rivals: [],
      // Diplomats (plan §M12) — a flat count for now (no bonus sources wired yet); diplomatTasks
      // holds at most `diplomats` concurrent { targetId, task, startedTurn } assignments.
      diplomats: STARTING_DIPLOMATS,
      diplomatTasks: [],
      // Royal Marriage (plan §M12) — nation ids the player has already married into, so the
      // action can't be spammed for repeated hostility reduction against the same target.
      marriageWith: [],

      // Rulers and advisors (plan §M3) — every nation gets a ruler so resolveTurn.js's
      // rulers pass and the modifier engine's ruler-skill source (src/engine/modifiers/
      // sources.js) can read any nation's generically; only the player's ruler/advisors actually
      // affect anything mechanically today (AI nations don't consume power pools until M16).
      ruler,
      advisors: { adm: null, dip: null, mil: null },

      // National stability, legitimacy, prestige, overextension (plan §M4) — every nation carries
      // these so resolveTurn.js's national-power pass (src/engine/nationalPower.js) and the
      // modifier engine's stability/overextension source can read any nation's generically, the
      // same "every nation gets the field, only the player acts on it today" pattern as above.
      // Legitimacy starts neutral (50) rather than 0 so a fresh nation isn't already suffering the
      // below-50 penalty before a government/ruler has had any turns to earn it.
      stability: 0,
      stabilityDecayProgress: 0,
      legitimacy: 50,
      prestige: 0,
      startRegionCount: startRegionCountByOwner[id] || 0,

      // Crises & defeat (plan §M15). capitalRegionId seeds from the nation's static native capital
      // (getNationCapital) and is the live source of truth from here on — see src/data/regions.js's
      // getCapital for why getNationCapital ITSELF stays untouched (buildings.js/greatProjects.js's
      // site rules read the ORIGINAL capital deliberately). lowStabilityStreak backs the civil war
      // stability trigger (src/engine/civilWar.js); civilWar/disasters/libertyDesire are scaffolded
      // for every nation the same "generic reader, real for player and AI both" way stability
      // and rulers already are (every nation gets real per-turn crisis processing, matching
      // M3/M4's own precedent — this is deliberately NOT deferred to M16's AI-parity milestone).
      capitalRegionId: getNationCapital(id),
      lowStabilityStreak: 0,
      civilWar: null,
      disasters: { economicCollapse: 0, revolution: 0 },
      libertyDesire: 0,

      // AI parity (plan §M16). Only non-player nations get these — the player keeps living on
      // state.resources/techTree/techAgeId (src/engine/nationState.js's own header explains why:
      // moving the player onto this shape too would touch every existing test and UI component that
      // reads state.resources directly, for zero present benefit). tech.ageId starts equal to the
      // calendar age, mirroring state.techAgeId's own seeding.
      ...(id !== playerNationId ? { economy: { gold: 0, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 }, tech: { researched: [], ageId: age } } : {}),
      ...(data.kind ? { kind: data.kind } : {}) // an independent (phase W1, independents.js finalizes it)
    };
  });

  // Initialize tech tree (currently empty content — see src/data/techTree.js).
  const techTree = {};
  Object.entries(TECH_TREE).forEach(([id, data]) => {
    techTree[id] = { id, researched: false, available: data.yearAvailable <= year };
  });

  const initial = {
    // Identity
    playerNationId,

    // Time
    year,
    age,
    // The nation's tech-earned age (plan §2) — starts equal to the calendar age; RESEARCH_TECH
    // advances it once enough of its current age's tech line is researched. Never used directly
    // for gating; src/data/ages.js's getEffectiveAgeId(age, techAgeId) is what buildings/units/
    // extraction actually read, capped at one age ahead of the calendar. See techTree.js's file
    // header for what this currently does and doesn't unlock beyond Phase B's existing rush rule.
    techAgeId: age,
    gameSpeed,
    turnNumber: 1,
    // Player intel on foreign nations: { [nationId]: lastTurnWithIntel } — src/engine/intel.js.
    intel: {},
    // Tactical Battles (design/rts-battles-implementation-plan.md §4.1): the one commanded battle
    // in progress (its units are locked and the turn can't end until it resolves), a counter for
    // unique battle ids, and how the player likes to fight ('ask' | 'auto' | 'command').
    pendingBattle: null,
    battleCounter: 0,
    battleSettings: { defaultMode: 'ask', autoDefend: false },
    // AI assaults on the player's garrisons, fought before the turn can end (src/engine/defense.js).
    pendingDefenses: [],
    gameStatus: GameStatus.ACTIVE,
    // Which VICTORY_CONDITIONS entry ended the game, if any.
    victoryConditionId: null,
    // Difficulty select — 'prince' is fully symmetrical (a no-op multiplier), matching
    // DIFFICULTIES.prince.
    difficultyId: 'prince',
    difficultyMultiplier: 1,

    // Resources — Gold/HR always present; Copper/Iron/Oil (and later Rare Metals/Helium-3) join
    // as their age unlocks (see src/data/resources.js). techPoints/adm/dip/mil are meta-currencies,
    // not age-gated resources. adm/dip/mil (plan §M2) replace the old single actionPoints pool
    // (and the separate diplomacyPoints currency, folded into dip) with three EU4-style power
    // pools that compete only against actions of their own kind.
    resources: {
      ...createEmptyResourcePool(age),
      gold: 500,
      hr: 100,
      techPoints: 0,
      // Matches BASE_POWER_PER_TURN (src/utils/helpers.js) — a fresh nation has no government and
      // no researched tech yet, so getPowerIncome(state) would return exactly the base anyway.
      adm: BASE_POWER_PER_TURN,
      dip: BASE_POWER_PER_TURN,
      mil: BASE_POWER_PER_TURN,
      maxAdm: BASE_POWER_PER_TURN,
      maxDip: BASE_POWER_PER_TURN,
      maxMil: BASE_POWER_PER_TURN
    },

    // World state
    regions,
    nations,
    techTree,
    // Set Research Focus (Research tab) — which TechCategory the nation is committing research
    // effort toward; null until first set. See helpers.js's calcIncome for its effect.
    researchFocus: null,
    // Civ-style research (src/engine/research.js): the tech being researched, the queue after it,
    // progress kept per tech, and whether the advisor picks the next tech when the queue runs out.
    research: emptyResearch(),

    // Per-region armies (plan §7) — a flat dict keyed by unit id, not nested under regions, since
    // units move between regions over their lifetime. See src/data/unitClasses.js for the class/
    // roster data a unit's classId/ageId reference.
    units: {},
    nextUnitSeq: 0,
    // Loan ids come from a counter (like units/satellites) — the old `loan_${turn}_${loans.length}`
    // repeated after a repay-then-borrow, and REPAY_LOAN's id filter then cleared BOTH loans.
    nextLoanSeq: 1,

    // Wars and invasions — the combat/invasion resolution engine that reads these is Phase C work.
    wars: [],
    // Set by resolveWarProgress when an AI side wins a war by enough to demand terms (plan §M13);
    // blocks END_TURN the same way an active event does until ACCEPT_PENDING_PEACE/
    // REJECT_PENDING_PEACE clears it — shape: { warId, from: nationId, terms: PeaceTerm[] }.
    pendingPeaceOffer: null,
    invasions: [],
    nextInvasionSeq: 0,
    counterAttackWindows: {},

    // Generals (plan §7) — a flat dict keyed by id, mirroring state.units. A general is assigned
    // to a single unit via that unit's own commanderId (see src/data/generals.js).
    hiredCommanders: {},
    nextCommanderSeq: 0,

    // Set by LAUNCH_INVASION to the itemized phase-by-phase result of the most recent battle (see
    // src/engine/battle.js) — read by the UI for an after-action report, never by the reducer.
    lastBattleReport: null,
    battleReports: [], // the player's last 30 battles (src/engine/battleReports.js)

    // Events
    activeEventId: null,
    activeProceduralEvent: null,
    proceduralEventCooldown: 0,
    pendingEventChains: [],
    firedEvents: {},

    // Great Projects (plan §M10) — { projectId: { regionId, tier } }, keyed globally so a project
    // can only ever be built once anywhere (wonders.js canQueueWonder). Its current owner is derived
    // from `regions[regionId].owner`, never stored here — see src/data/greatProjects.js's header
    // comment on why that can't drift out of sync the way a stored copy could.
    greatProjects: {},

    // Space Race, orbital layer (plan §10.4) — a flat dict keyed by satellite id, mirroring
    // state.units/state.hiredCommanders, since satellites are per-nation persistent assets, not
    // per-region. orbitalDebrisLevel is the shared, global cost of ASAT strikes (src/data/
    // satellites.js) — it degrades every nation's satellite effectiveness, not just the target's.
    satellites: {},
    nextSatelliteSeq: 0,
    orbitalDebrisLevel: 0,

    // Advisor candidates (plan §M3) — only the player's own is ever generated/read today (AI
    // nations don't hire advisors until M16 gives them a real economy to hire with), keyed by
    // nation id the same way state.satellites is, in case that changes later.
    advisorPool: { [playerNationId]: generateAdvisorCandidates(playerNationId, rulerRng) },

    // Space Race mission ladder (plan §10.4 Layer 3, src/data/spaceMissions.js) — a mission in
    // progress lives in spaceMissionProgress keyed by id with turns remaining; completing it moves
    // the id into completedMissions and applies its reward. diplomaticLeadershipStreak is the
    // Diplomatic victory condition's sustained-majority counter (victoryConditions.js).
    spaceMissionProgress: {},
    completedMissions: [],
    diplomaticLeadershipStreak: 0,

    // Deterministic turn resolution — see src/utils/rng.js
    // Carries forward whatever rulerRng advanced to while generating all 240 nations' rulers
    // above, rather than a fresh randomSeed() — turn 1 then continues deterministically from
    // exactly where ruler generation left off, instead of silently discarding those draws.
    rngSeed: rulerRng.getSeed(),

    // Logs
    logs: [
      { year, message: `${formatYear(year)}: Your nation's story begins.`, type: LogTypes.MILESTONE }
    ]
  };
  // Fog of war (fog.js): each people knows its homeland; `fog: false` is the "explored world" option.
  const started = initFog(refreshPeopleNames(syncWorldRegistry(finalizeIndependents(applyScenario(initial, { ...scenario, seed: worldSeed }), { late: independentPick.late }))), { on: fog });
  // The guided start (src/engine/tutorial.js): ten turns of prompts for a new player.
  return guided ? { ...started, tutorial: { startTurn: started.turnNumber || 1, done: {}, ended: false } } : started;
};

// A player action the engine refuses still has to SAY why — a bare `return state` is invisible to
// the player (the lesson of this codebase's diplomacy "buttons do nothing" bug). New guards use this;
// older ones are migrated as they're touched (implementation plan §0.3).
const reject = (state, message) => ({
  ...state,
  logs: [...state.logs, { year: state.year, message, type: LogTypes.ACTION }]
});

// Why an attack was refused, in the player's words, so a click never silently does nothing.
const ATTACK_REFUSALS = {
  not_your_region: 'You can only attack from a province you hold.',
  bad_target: "That region can't be attacked — it's already yours.",
  already_held: 'Your army already holds that region — there is nothing left to fight for there.',
  not_adjacent: "That region isn't next to your army.",
  no_enemy: 'There is no enemy army on that tile.',
  is_city: 'That is a city: attack it as a city.',
  cost: 'Not enough resources to attack.',
  no_units: 'There are no troops there to attack with.',
  no_moves: 'That army has already moved or fought this turn.',
  bad_fleet: "That fleet can't carry out a landing.",
  not_coastal: 'That region has no coast to land on.',
  out_of_reach: "Your fleet can't reach that coast yet."
};
const refuseAttack = (state, reason, targetRegionId) => {
  if (reason === 'no_war') {
    const owner = state.nations[state.regions[targetRegionId]?.owner];
    return reject(state, `You're at peace with ${owner?.name || 'them'} — declare war before attacking ${REGIONS_DATA[targetRegionId]?.name || 'that region'}.`);
  }
  return reject(state, ATTACK_REFUSALS[reason] || "That attack isn't possible right now.");
};

// ============ REDUCER ============
// Exported for direct unit testing (see GameContext.test.js) — the reducer is the authoritative
// validation point for every player action, so it should be testable without mounting React.
// While a commanded battle is in progress: the turn can't end, and the units fighting it can't be
// moved, disbanded, embarked or promoted until it resolves.
const TURN_ACTIONS = new Set([ActionTypes.ADVANCE_TURN, ActionTypes.FAST_FORWARD]);
const UNIT_ACTION_IDS = {
  [ActionTypes.MOVE_ARMY]: (p) => [p.unitId],
  [ActionTypes.DISBAND_UNIT]: (p) => [p.unitId],
  [ActionTypes.PROMOTE_UNIT]: (p) => [p.unitId],
  [ActionTypes.APPOINT_GENERAL]: (p) => [p.unitId],
  [ActionTypes.EMBARK_UNIT]: (p) => [p.landUnitId, p.navalUnitId],
  [ActionTypes.DISEMBARK_UNIT]: (p) => [p.landUnitId],
  [ActionTypes.AMPHIBIOUS_ASSAULT]: (p) => [p.navalUnitId]
};
const guardPendingBattle = (state, action) => {
  const defenses = state.pendingDefenses?.length > 0;
  if (!state.pendingBattle && !defenses) return null;
  if (TURN_ACTIONS.has(action.type)) {
    return reject(state, state.pendingBattle ? 'Finish your battle (or auto-resolve it) before ending the turn.' : 'Your regions are under attack — fight (or auto-resolve) the assaults before ending the turn.');
  }
  const ids = UNIT_ACTION_IDS[action.type]?.(action.payload || {}) || [];
  if (ids.some((id) => id && isUnitInBattle(state, id))) return reject(state, 'That unit is fighting a battle right now.');
  return null;
};

// Rebuilds a commanded battle's result from the REAL units in state, so a tampered or buggy result
// can never mint soldiers: only the locked units, strength can only go down, morale stays in range,
// ids and outcome are validated, and the command-mode XP bonus stays capped.
const sanitizePowersUsed = (used) => [0, 1].map((side) => {
  const out = {};
  Object.entries((Array.isArray(used) && used[side]) || {}).forEach(([id, n]) => { if (MISSILE_POWER_TIERS[id] && Number.isFinite(n) && n > 0) out[id] = Math.floor(n); });
  return out;
});

// Missiles fired inside a battle, the city's damage and the razed buildings are applied by the one
// outcome service (battleOutcome.js applyPowers, applyCityDamage).
const MANIFEST_ID = /^[a-z][a-z0-9_-]{0,47}$/;
const cleanIds = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === 'string' && MANIFEST_ID.test(id)))].slice(0, 600) : []);

const DISPOSITIONS = ['dead', 'fled', 'field', 'reserve'];
export const sanitizeTacticalResult = (state, pb, result) => {
  const OUTCOMES = ['attacker', 'defender', 'stalemate'];
  // Synthetic expeditionary troops (defense battles) live on the battle record, not in state.units.
  const clampUnits = (ids, reported) => ids.map((id) => {
    const real = state.units[id] || (pb.synthetic || []).find((u) => u.id === id) || (pb.militia || []).find((u) => u.id === id);
    if (!real) return null;
    const r = (reported || []).find((u) => u && u.id === id) || {};
    const strength = Number.isFinite(r.strength) ? Math.max(0, Math.min(real.strength, Math.round(r.strength))) : real.strength;
    const morale = Number.isFinite(r.morale) ? Math.max(0, Math.min(100, Math.round(r.morale))) : real.morale;
    const disposition = DISPOSITIONS.includes(r.disposition) ? (strength <= 0 ? 'dead' : r.disposition === 'dead' ? 'field' : r.disposition) : undefined;
    return { ...real, strength, morale, routed: !!r.routed, ...(disposition ? { disposition } : {}) };
  }).filter(Boolean);
  // Reinforcements count only if the battle says they actually marched in (and they were really
  // standing by for this battle).
  const joined = Array.isArray(result?.report?.tactical?.joinedReinforcements) ? result.report.tactical.joinedReinforcements : [];
  const standby = (sources) => (sources || []).flatMap((src) => src.unitIds);
  const attackerIds = [...pb.attackerUnitIds, ...(pb.synthetic || []).map((u) => u.id), ...standby(pb.attackerReinforcements).filter((id) => joined.includes(id))];
  const defenderIds = [...pb.defenderUnitIds, ...(pb.militia || []).map((u) => u.id), ...standby(pb.defenderReinforcements).filter((id) => joined.includes(id))];
  const attackerUnits = clampUnits(attackerIds, result?.attackerUnits);
  const defenderUnits = clampUnits(defenderIds, result?.defenderUnits);
  const report = result?.report || {};
  const onlyIds = (list, allowed) => (Array.isArray(list) ? list.filter((id) => allowed.includes(id)) : []);
  const bonus = {};
  Object.entries(report.tactical?.xpBonusById || {}).forEach(([id, v]) => {
    if ([...attackerIds, ...defenderIds].includes(id) && Number.isFinite(v)) bonus[id] = Math.max(0, Math.min(20, Math.round(v)));
  });
  return {
    outcome: OUTCOMES.includes(result?.outcome) ? result.outcome : 'defender',
    attackerUnits,
    defenderUnits,
    report: {
      ...report,
      log: Array.isArray(report.log) ? report.log.slice(0, 60) : [],
      deployedAttackerIds: onlyIds(report.deployedAttackerIds, attackerIds),
      deployedDefenderIds: onlyIds(report.deployedDefenderIds, defenderIds),
      tactical: {
        ...(report.tactical || {}),
        decisive: !!report.tactical?.decisive,
        xpBonusById: bonus,
        powersUsed: sanitizePowersUsed(report.tactical?.powersUsed),
        // Generals on the field (row 5): only commanders of the battle's own units.
        generalsFielded: onlyIds(report.tactical?.generalsFielded, [...attackerUnits, ...defenderUnits].map((u) => u.commanderId).filter(Boolean)),
        generalsStruck: onlyIds(report.tactical?.generalsStruck, [...attackerUnits, ...defenderUnits].map((u) => u.commanderId).filter(Boolean)),
        razed: Array.isArray(report.tactical?.razed) ? report.tactical.razed.filter((c) => BUILDING_CATEGORIES[c] && c !== 'defense').slice(0, 12) : [],
        ...(report.tactical?.cityDamage ? { cityDamage: { destroyed: cleanIds(report.tactical.cityDamage.destroyed), damaged: cleanIds(report.tactical.cityDamage.damaged) } } : {})
      }
    }
  };
};

// Independents (plans/independent-cities.md 3.2, 6) take part in no diplomacy: no wars (they are
// attacked without one), treaties, marriages, vassalage, claims or diplomats. W3 adds their own
// actions (tribute, trade, mercenaries, gifts).
const DIPLOMACY_ACTIONS = new Set([ActionTypes.DECLARE_WAR, ActionTypes.FABRICATE_CLAIM, ActionTypes.OFFER_PEACE, ActionTypes.TRADE_AGREEMENT, ActionTypes.OPEN_BORDERS, ActionTypes.DEMAND, ActionTypes.MILITARY_ALLIANCE, ActionTypes.GIFT_BRIBE, ActionTypes.RIVAL_NATION, ActionTypes.PROPOSE_MARRIAGE, ActionTypes.BREAK_ALLIANCE, ActionTypes.INSULT, ActionTypes.VASSALIZE, ActionTypes.ANNEX_VASSAL, ActionTypes.ASSIGN_DIPLOMAT].filter(Boolean));
const independentDiplomacyRefused = (state, action) => {
  if (!DIPLOMACY_ACTIONS.has(action.type)) return null;
  const p = action.payload || {};
  const target = p.nationId ?? p.targetId ?? p.targetNationId;
  return isIndependent(state.nations, target) ? reject(state, `${state.nations[target].name} is an independent city: it makes no treaties, and you may attack it without a war.`) : null;
};

const reduceAction = (state, action) => {
  const blocked = guardPendingBattle(state, action) || independentDiplomacyRefused(state, action);
  if (blocked) return blocked;
  switch (action.type) {
    case ActionTypes.ADVANCE_TURN:
      return resolveTurn(state);

    case ActionTypes.FAST_FORWARD: {
      // Fast-forward: repeatedly resolves turns within a single atomic dispatch, so the component
      // doesn't need to loop across async re-renders. Stops the moment there's a decision worth
      // the player's attention — an event becomes active, a war starts or ends, the game ends —
      // or a turn cap is hit, so a single click can't silently skip to the end of the game.
      // It is the player's button only, so it also stops at (and never starts over) the End Turn
      // blockers (turnBlockers.js): a city with nothing to build, no research, a demand to answer.
      if (turnBlockers(state).length) return state;
      const MAX_TURNS = 20;
      // Which wars are live (a nation can fight several, so count wars, not belligerents).
      const warKey = (s) => (s.wars || []).filter(w => w.active).map(w => w.id).join('|');
      let current = state;
      const startingWars = warKey(current);
      for (let i = 0; i < MAX_TURNS; i++) {
        const next = resolveTurn(current);
        if (next === current) break; // resolveTurn's own no-op guard (event pending / game over)
        current = next;
        if (current.gameStatus !== GameStatus.ACTIVE) break;
        if (current.activeEventId || current.activeProceduralEvent || current.pendingPeaceOffer || current.pendingDefenses?.length) break;
        if (warKey(current) !== startingWars) break;
        if (turnBlockers(current).length) break;
      }
      return current;
    }

    case ActionTypes.RESOLVE_EVENT: {
      // A procedural event is never in HISTORICAL_EVENTS — it's carried in full on the state
      // itself since it was generated fresh, not looked up from a static registry. A chain event
      // IS looked up by id, but from EVENT_CHAINS rather than HISTORICAL_EVENTS.
      const event = state.activeEventId
        ? (HISTORICAL_EVENTS[state.activeEventId] || EVENT_CHAINS[state.activeEventId])
        : state.activeProceduralEvent;
      if (!event) return state;
      return applyEventEffects(state, event, action.payload.optionIndex);
    }

    // ---- Domestic tab (plan §5) — atomic, cost-validated player actions ----

    case ActionTypes.GAIN_CONTROL: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.gainControl;
      if (!region || region.owner !== state.playerNationId || region.control >= 100) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, control: Math.min(100, region.control + 5) } },
        logs: [...state.logs, { year: state.year, message: `Gained control in ${REGIONS_DATA[regionId]?.name}. Control +5%`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_INFRASTRUCTURE: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.buildInfrastructure;
      if (!region || region.owner !== state.playerNationId || region.currentInfrastructure >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, currentInfrastructure: region.currentInfrastructure + 1 } },
        logs: [...state.logs, { year: state.year, message: `Built infrastructure in ${REGIONS_DATA[regionId]?.name}. Level ${region.currentInfrastructure + 1}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_DEFENSES: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.buildDefenses;
      if (!region || region.owner !== state.playerNationId || region.defenseLevel >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, defenseLevel: region.defenseLevel + 1 } },
        logs: [...state.logs, { year: state.year, message: `Built defenses in ${REGIONS_DATA[regionId]?.name}. Level ${region.defenseLevel + 1}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_CLIMATE_RESILIENCE: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.buildClimateResilience;
      if (!region || region.owner !== state.playerNationId || (region.climateResilience || 0) >= CLIMATE_RESILIENCE_MAX) return state;
      if (getEffectiveAgeId(state.age, state.techAgeId) !== 'modern') return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextLevel = (region.climateResilience || 0) + 1;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, climateResilience: nextLevel } },
        logs: [...state.logs, { year: state.year, message: `Built climate resilience infrastructure in ${REGIONS_DATA[regionId]?.name}. Level ${nextLevel}`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CULTURAL_EXPORT: {
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.culturalExport;
      if (getEffectiveAgeId(state.age, state.techAgeId) !== 'modern') return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextInfluence = (nation.culturalInfluence || 0) + CULTURAL_EXPORT_INFLUENCE_GAIN;
      const nextNations = {
        ...state.nations,
        [state.playerNationId]: { ...nation, culturalInfluence: nextInfluence }
      };
      // Broad soft power: every other nation's hostility eases slightly, not just one chosen target.
      Object.values(state.nations).forEach((n) => {
        if (n.isPlayer) return;
        nextNations[n.id] = {
          ...nextNations[n.id],
          hostility: Math.max(n.hostilityFloor || 0, n.hostility - CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION)
        };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: nextNations,
        logs: [...state.logs, { year: state.year, message: `Your culture spreads abroad, easing tensions worldwide. Cultural Influence: ${nextInfluence}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.ASSIGN_GOVERNOR: {
      // Governors (governors.js): a court candidate takes a city group's seat.
      const { seatId, candidateId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const group = cityGroups(state, state.playerNationId).find((g) => g.seat === seatId);
      const candidate = governorChoices(nation).find((c) => c.id === candidateId);
      if (!group || !candidate) return state;
      const next = assignGovernor(nation, seatId, candidate, state.turnNumber);
      return { ...state, nations: { ...state.nations, [state.playerNationId]: next }, logs: [...state.logs, { year: state.year, message: `${candidate.name} sets out to govern ${state.regions[seatId]?.name} and ${group.cities.length - 1} more cit${group.cities.length === 2 ? 'y' : 'ies'}: in office in ${GOVERNOR_ASSIGN_TURNS} turns.`, type: LogTypes.ACTION }] };
    }

    case ActionTypes.DISMISS_GOVERNOR: {
      const { seatId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const next = dismissGovernor(nation, seatId);
      if (next === nation) return state;
      return { ...state, nations: { ...state.nations, [state.playerNationId]: next }, logs: [...state.logs, { year: state.year, message: `The governor of ${state.regions[seatId]?.name} is recalled.`, type: LogTypes.ACTION }] };
    }

    case ActionTypes.HIRE_ADVISOR: {
      // Plan §M3: hires one of the 3 current candidates for a slot, replacing whoever (if anyone)
      // already held it — a mid-reign dismissal, not something the plan asks to cost extra on top
      // of the new hire's own price.
      const { pool, candidateIndex } = action.payload;
      if (!['adm', 'dip', 'mil'].includes(pool)) return state;
      const candidate = state.advisorPool?.[state.playerNationId]?.[pool]?.[candidateIndex];
      if (!candidate) return state;
      const cost = getAdvisorHireCost(candidate.level);
      if ((state.resources.gold || 0) < cost) return state;

      const nation = state.nations[state.playerNationId];
      const rng = createRng(state.rngSeed);
      const refreshedCandidates = { ...state.advisorPool[state.playerNationId] };
      refreshedCandidates[pool] = [0, 1, 2].map((i) => (i === candidateIndex
        ? generateAdvisorCandidates(state.playerNationId, rng)[pool][0] // a fresh face fills the now-hired slot
        : refreshedCandidates[pool][i]));

      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, advisors: { ...nation.advisors, [pool]: candidate } } },
        advisorPool: { ...state.advisorPool, [state.playerNationId]: refreshedCandidates },
        rngSeed: rng.getSeed(),
        logs: [...state.logs, { year: state.year, message: `${candidate.name} (level ${candidate.level}) hired as your ${pool.toUpperCase()} advisor.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.INCREASE_STABILITY: {
      // Plan §M4: costs scale with both current overextension and how high stability already is
      // (getIncreaseStabilityCost) — no cap check beyond that, since the ADM cost itself already
      // makes pushing stability to its +3 ceiling progressively more expensive.
      const nation = state.nations[state.playerNationId];
      if ((nation.stability || 0) >= 3) return state;
      const stabilityCostMult = getModifier(state, state.playerNationId, 'national.stabilityCost').total;
      const cost = getIncreaseStabilityCost(state, state.playerNationId, stabilityCostMult);
      if ((state.resources.adm || 0) < cost) return state;
      return {
        ...state,
        resources: { ...state.resources, adm: state.resources.adm - cost },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, stability: clampStability((nation.stability || 0) + 1) } },
        logs: [...state.logs, { year: state.year, message: `Stability increased to ${clampStability((nation.stability || 0) + 1)}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CONSTRUCT_BUILDING: {
      // Plan §M6: tech-gated (not age-gated — the old free "rush one tier ahead" allowance is
      // gone), real per-tier gold cost, and slot-limited (upgrading an existing category is free
      // of slots; only a brand-new category needs a free one). Naval is now actually coastal-only
      // in the reducer, a real pre-existing gap the plan calls out by name.
      const { regionId, categoryId } = action.payload;
      const region = state.regions[regionId];
      // Plan §M13: an occupied region can't build — it isn't producing anything for its owner
      // while occupied (see helpers.js's calcIncome), so there's nothing to invest in either.
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      const currentTier = region.buildings.categories[categoryId];
      if (currentTier === undefined) return state; // unknown category
      const nextTier = currentTier + 1;
      if (BUILDING_CATEGORIES[categoryId]?.coastalOnly && !isCoastal(regionId)) return state;
      const researchedTechIds = new Set(Object.keys(state.techTree).filter((id) => state.techTree[id].researched));
      if (!canBuildTier(categoryId, researchedTechIds, nextTier)) return state;
      if (currentTier < 0) {
        const totalDev = getTotalDev(region);
        const slots = getBuildingSlots(totalDev, !!REGIONS_DATA[regionId]?.isCapital);
        if (getUsedBuildingSlots(region.buildings) >= slots) return state;
      }
      const buildingCostMult = getModifier(state, state.playerNationId, 'national.buildingCost').total;
      const cost = getBuildingTierCost(categoryId, nextTier, buildingCostMult);
      if ((state.resources.gold || 0) < cost) return state;
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        regions: {
          ...state.regions,
          [regionId]: {
            ...region,
            buildings: { ...region.buildings, categories: { ...region.buildings.categories, [categoryId]: nextTier } }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Constructed ${getCategoryTierName(categoryId, nextTier)} in ${REGIONS_DATA[regionId]?.name} (-${formatMoney(cost)}).`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DEVELOP_RESOURCE_SITE: {
      const { regionId, resourceId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.developResourceSite;
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (region.buildings.extraction[resourceId] === undefined || region.buildings.extraction[resourceId]) return state;
      if (!hasDeposit(REGIONS_DATA[regionId]?.startOwner, resourceId) || !canBuildExtraction(resourceId, getEffectiveAgeId(state.age, state.techAgeId))) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [regionId]: {
            ...region,
            buildings: { ...region.buildings, extraction: { ...region.buildings.extraction, [resourceId]: true } }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Developed a ${resourceId} extraction site in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DEVELOP_PROVINCE: {
      // Plan §M5: +1 to one of the region's own tax/production/manpower development, spending the
      // matching power pool (DEV_TYPE_POOL) rather than gold — the cost scales with the region's
      // OWN current total development, so an already-developed province costs progressively more
      // to push further, same shape as Increase Stability's own cost curve (M4).
      const { regionId, devType } = action.payload;
      const region = state.regions[regionId];
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (!DEV_TYPE_POOL[devType]) return state;
      const pool = DEV_TYPE_POOL[devType];
      const developmentCostMult = getModifier(state, state.playerNationId, 'national.developmentCost').total;
      const cost = getDevelopProvinceCost(region, developmentCostMult);
      if ((state.resources[pool] || 0) < cost) return state;
      const modernBaseline = REGIONS_DATA[regionId]?.population || 0;
      const popGain = Math.round(modernBaseline * DEVELOP_PROVINCE_POP_GAIN_RATIO);
      return {
        ...state,
        resources: { ...state.resources, [pool]: state.resources[pool] - cost },
        regions: {
          ...state.regions,
          [regionId]: {
            ...region,
            ...(region.size != null ? addPeople(region, sizeToPeople(region.size) * DEVELOP_PROVINCE_POP_GAIN_RATIO) : { currentPopulation: (region.currentPopulation || modernBaseline) + popGain }),
            dev: { ...region.dev, [devType]: (region.dev?.[devType] || 0) + 1 }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Developed ${devType} in ${REGIONS_DATA[regionId]?.name} (+1).`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.QUELL_UNREST: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.quellUnrest;
      if (!region || region.owner !== state.playerNationId || region.unrest <= 0) return state;
      if (region.occupiedBy) return reject(state, `${REGIONS_DATA[regionId]?.name} is occupied — liberate it first.`);
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, unrest: Math.max(0, region.unrest - 30) } },
        logs: [...state.logs, { year: state.year, message: `Quelled unrest in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SETTLE_COLONIZE: {
      // Peaceful settlement of land NOBODY really governs any more: a province held by rebels, or
      // the remnant of a nation that's been wiped out. It used to accept ANY adjacent province under
      // 20 control — including an ally's — with no diplomatic cost, and since a missile strike could
      // push control that low at peace, the pair was conquest without a war.
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.settleColonize;
      if (!region || region.owner === state.playerNationId) return state;
      const regionName = REGIONS_DATA[regionId]?.name || regionId;
      const owner = state.nations[region.owner];
      const rebelUnitIds = Object.values(state.units).filter((u) => u.regionId === regionId && u.ownerId === REBEL_OWNER_ID).map((u) => u.id);
      if (owner && !owner.isEliminated && rebelUnitIds.length === 0) return reject(state, `${owner.name} still governs ${regionName} — only rebel-held or abandoned land can be settled peacefully.`);
      if (owner && !owner.isEliminated && (owner.hasMilitaryPact || owner.vassalOf === state.playerNationId)) return reject(state, `${regionName} belongs to your ally or vassal ${owner.name}.`);
      if (region.control >= SETTLE_COLONIZE_CONTROL_THRESHOLD) return reject(state, `Control in ${regionName} is still ${Math.round(region.control)} — it must fall below ${SETTLE_COLONIZE_CONTROL_THRESHOLD}.`);
      if (!isAdjacentToOwner(regionId, state.regions, state.playerNationId)) return reject(state, `${regionName} must border your territory.`);
      if (!canAfford(state.resources, costs)) return reject(state, `Not enough resources to settle ${regionName}.`);
      const { region: settled } = transferRegion(region, state.playerNationId, state.nations, {
        control: SETTLE_COLONIZE_START_CONTROL,
        unrest: Math.max(region.unrest || 0, SETTLE_COLONIZE_START_UNREST)
      });
      const nextUnits = { ...state.units };
      rebelUnitIds.forEach((id) => { delete nextUnits[id]; });
      // Taking a living nation's rebel-held province still costs you with that nation.
      const nextNations = owner && !owner.isEliminated
        ? { ...state.nations, [owner.id]: { ...owner, hostility: Math.min(100, (owner.hostility || 0) + SETTLE_COLONIZE_OWNER_HOSTILITY) } }
        : state.nations;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: settled },
        units: nextUnits,
        nations: nextNations,
        logs: [...state.logs, { year: state.year, message: `Settlers absorbed ${regionName}, which ${owner && !owner.isEliminated ? `${owner.name} had lost to rebels` : 'no one governed any more'}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.POPULATION_POLICY: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.populationPolicy;
      if (!region || region.owner !== state.playerNationId) return state;
      if (region.occupiedBy) return reject(state, `${REGIONS_DATA[regionId]?.name} is occupied — liberate it first.`);
      if (!canAfford(state.resources, costs)) return state;
      // A city banks the new people as food toward its next size (population.js, one model).
      const nextRegion = region.size != null
        ? addPeople(region, (region.currentPopulation || sizeToPeople(region.size)) * POPULATION_POLICY_GROWTH_RATE)
        : { ...region, currentPopulation: Math.round((region.currentPopulation || 1) * (1 + POPULATION_POLICY_GROWTH_RATE)) };
      const nextPopulation = nextRegion.currentPopulation ?? sizeToPeople(nextRegion.size);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: nextRegion },
        logs: [...state.logs, { year: state.year, message: `Population growth invested in ${REGIONS_DATA[regionId]?.name} — now ${nextPopulation.toLocaleString()}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SET_TAX_RATE: {
      const { rate } = action.payload;
      const costs = ACTION_COSTS.setTaxRate;
      const nation = state.nations[state.playerNationId];
      if (!TAX_RATE_IDS.includes(rate) || nation.taxRate === rate) return state;
      if (state.turnNumber < (nation.taxRateCooldownUntil || 0)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            taxRate: rate,
            taxRateCooldownUntil: state.turnNumber + TAX_RATE_CHANGE_COOLDOWN_TURNS,
            extortionateTaxProgress: 0
          }
        },
        logs: [...state.logs, { year: state.year, message: `Tax rate set to ${rate}.`, type: LogTypes.ACTION }]
      };
    }

    // Military maintenance slider (plan §M11) — free, adjustable any time (unlike Set Tax Rate,
    // no cooldown), clamped to ARMY_MAINTENANCE_MIN/MAX. economy.js's calcNationBalance reads it
    // to scale army/navy upkeep; see that file's header for the morale/reinforcement scope trim.
    case ActionTypes.SET_ARMY_MAINTENANCE: {
      const { value } = action.payload;
      const nation = state.nations[state.playerNationId];
      const clamped = clampMaintenance(value);
      if (nation.armyMaintenance === clamped) return state;
      return {
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...nation, armyMaintenance: clamped } }
      };
    }

    case ActionTypes.SET_NAVY_MAINTENANCE: {
      const { value } = action.payload;
      const nation = state.nations[state.playerNationId];
      const clamped = clampMaintenance(value);
      if (nation.navyMaintenance === clamped) return state;
      return {
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...nation, navyMaintenance: clamped } }
      };
    }

    // Loans (plan §M11) — requires Banking Houses; sized off the current balance (economy.js's
    // getLoanSize) and capped by getLoanCapacity. Interest accrues per-turn in resolveTurn.js via
    // calcNationBalance; auto-loans on a shortfall are also resolveTurn.js's job (the reducer only
    // handles the player's own manual request/repay).
    case ActionTypes.REQUEST_LOAN: {
      const nation = state.nations[state.playerNationId];
      if (!hasBankingHouses(state, state.playerNationId)) return state;
      if ((nation.loans || []).length >= getLoanCapacity(state, state.playerNationId)) return state;
      const principal = getLoanSize(state, state.playerNationId);
      const loanSeq = state.nextLoanSeq || 1;
      const loan = { id: `loan_${loanSeq}`, principal, interestRate: getLoanInterestRate(state, state.playerNationId), takenTurn: state.turnNumber };
      return {
        ...state,
        nextLoanSeq: loanSeq + 1,
        resources: { ...state.resources, gold: (state.resources.gold || 0) + principal },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, loans: [...(nation.loans || []), loan] } },
        logs: [...state.logs, { year: state.year, message: `Took out a loan of ${formatMoney(principal)} gold.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.REPAY_LOAN: {
      const { loanId } = action.payload;
      const nation = state.nations[state.playerNationId];
      // By index, not by id filter: a save from before nextLoanSeq can still hold two loans with the
      // same id, and repaying one must never clear the other for free.
      const loanIndex = (nation.loans || []).findIndex((l) => l.id === loanId);
      const loan = nation.loans?.[loanIndex];
      if (!loan) return reject(state, 'No such loan.');
      if ((state.resources.gold || 0) < loan.principal) return reject(state, `Not enough gold to repay this loan (need ${formatMoney(loan.principal)}).`);
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - loan.principal },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, loans: nation.loans.filter((_, i) => i !== loanIndex) } },
        logs: [...state.logs, { year: state.year, message: `Repaid a loan of ${formatMoney(loan.principal)} gold.`, type: LogTypes.ACTION }]
      };
    }

    // Fusion Grid (plan §M11 resource sink) — a standalone national decision rather than a Future-
    // age building upkeep, since no Future building tier exists yet in this codebase (M6's own
    // buildings.js caps at Modern; see types.js's ACTIVATE_FUSION_GRID comment). Its ongoing
    // helium3 upkeep and goldMult bonus while supplied are applied in resolveTurn.js.
    case ActionTypes.ACTIVATE_FUSION_GRID: {
      const nation = state.nations[state.playerNationId];
      if (nation.fusionGridActive) return state;
      // Gated on the Outer Planets mission (plan: "Computing + mission outer_planets") — that
      // mission is helium3's own real income gate (spaceMissions.js's own header), so it's the one
      // clear prerequisite rather than stacking an extra tech check on top of an already-real gate.
      if (!(state.completedMissions || []).includes('outer_planets')) return state;
      if ((state.resources.helium3 || 0) < FUSION_GRID_ACTIVATION_HELIUM3) return state;
      return {
        ...state,
        resources: { ...state.resources, helium3: state.resources.helium3 - FUSION_GRID_ACTIVATION_HELIUM3 },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, fusionGridActive: true } },
        logs: [...state.logs, { year: state.year, message: 'The Fusion Grid is online.', type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.LAUNCH_SATELLITE: {
      const { typeId } = action.payload;
      const costs = ACTION_COSTS.launchSatellite;
      if (!SATELLITE_TYPES[typeId]) return state;
      if (!canLaunchSatellite(state.age, state.techAgeId, state.year)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const satelliteId = `satellite_${state.nextSatelliteSeq}`;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        satellites: { ...state.satellites, [satelliteId]: { id: satelliteId, ownerId: state.playerNationId, typeId, launchedYear: state.year } },
        nextSatelliteSeq: state.nextSatelliteSeq + 1,
        logs: [...state.logs, { year: state.year, message: `${SATELLITE_TYPES[typeId].name} launched into orbit.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.ASAT_STRIKE: {
      const { targetSatelliteId } = action.payload;
      const costs = ACTION_COSTS.asatStrike;
      const target = state.satellites[targetSatelliteId];
      if (!target || target.ownerId === state.playerNationId) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextSatellites = { ...state.satellites };
      delete nextSatellites[targetSatelliteId];
      const targetNationName = state.nations[target.ownerId]?.name || target.ownerId;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        satellites: nextSatellites,
        orbitalDebrisLevel: Math.min(MAX_ORBITAL_DEBRIS, (state.orbitalDebrisLevel || 0) + ASAT_DEBRIS_RISE),
        logs: [...state.logs, { year: state.year, message: `An ASAT strike destroyed ${targetNationName}'s ${SATELLITE_TYPES[target.typeId]?.name}. Orbital debris rises.`, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.BUILD_MISSILE: {
      const { tierId } = action.payload;
      if (!MISSILE_TIERS[tierId]) return state;
      if (!canBuildMissile(getEffectiveAgeId(state.age, state.techAgeId))) return reject(state, 'Missiles unlock in the Modern age.');
      const costs = ACTION_COSTS.buildMissile[tierId];
      if (!canAfford(state.resources, costs)) return reject(state, `Not enough resources to build a ${MISSILE_TIERS[tierId].name}.`);
      const nation = state.nations[state.playerNationId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...nation, missiles: { ...nation.missiles, [tierId]: (nation.missiles[tierId] || 0) + 1 } } },
        logs: [...state.logs, { year: state.year, message: `${MISSILE_TIERS[tierId].name} added to your stockpile.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.MISSILE_STRIKE: {
      // A missile strikes a region directly — no army, no supply line, no battle.js combat
      // resolution (see src/data/missiles.js's header). Range is real land-adjacency hops for the
      // finite tiers; icbm/nuclear have unlimited range.
      const { tierId, targetRegionId } = action.payload;
      const tier = MISSILE_TIERS[tierId];
      const nation = state.nations[state.playerNationId];
      const targetRegion = state.regions[targetRegionId];
      if (!tier || !nation.missiles[tierId]) return reject(state, 'No missile of that type in stock.');
      if (!targetRegion || targetRegion.owner === state.playerNationId) return state;
      // A strike is an act of war, not a free action: before this, a nation at peace could be
      // missiled with no war, no hostility and no AE — and SETTLE_COLONIZE could then annex the
      // province once its control collapsed. Rebel-held land is fair game without a war.
      const strikeTargetOwner = targetRegion.occupiedBy ?? targetRegion.owner;
      const atWarWithTarget = state.wars.some((w) => w.active && isWarBetween(w, state.playerNationId, strikeTargetOwner));
      if (!atWarWithTarget && !canAttack(state, state.playerNationId, strikeTargetOwner)) { // rebels and independents need no war (hostility.js)
        return reject(state, `You must be at war with ${state.nations[strikeTargetOwner]?.name || strikeTargetOwner} to strike ${REGIONS_DATA[targetRegionId]?.name}.`);
      }
      const costs = ACTION_COSTS.missileStrike;
      if (!canAfford(state.resources, costs)) return state;
      const ownRegionIds = Object.keys(state.regions).filter(id => state.regions[id].owner === state.playerNationId);
      if (!isMissileInRange(tierId, ownRegionIds, targetRegionId, distanceFromAnchor)) return state;

      const targetNation = state.nations[targetRegion.owner];
      const reductionMult = getAbmReductionMult(targetNation?.abmDefenseLevel);
      const nextRegions = {
        ...state.regions,
        [targetRegionId]: {
          ...targetRegion,
          control: Math.max(0, targetRegion.control - tier.controlDamage * reductionMult),
          unrest: Math.min(100, targetRegion.unrest + tier.unrestDamage * reductionMult),
          nuclearScarred: targetRegion.nuclearScarred || tierId === 'nuclear'
        }
      };
      let nextNations = {
        ...state.nations,
        [state.playerNationId]: { ...nation, missiles: { ...nation.missiles, [tierId]: nation.missiles[tierId] - 1 } }
      };
      if (targetNation) {
        nextNations[targetRegion.owner] = {
          ...targetNation,
          militaryStrength: Math.max(0, targetNation.militaryStrength - tier.militaryDamage * reductionMult),
          hostility: tierId === 'nuclear' ? 100 : targetNation.hostility
        };
      }
      // Nuclear "instant global condemnation" (plan §10.4): every other nation's hostility toward
      // the striker jumps, not just the target's — reusing DECLARE_WAR's own unjustified-war
      // global-hostility pattern.
      if (tierId === 'nuclear') {
        Object.keys(nextNations).forEach(id => {
          if (id === state.playerNationId || id === targetRegion.owner) return;
          nextNations[id] = { ...nextNations[id], hostility: Math.min(100, (nextNations[id].hostility || 0) + NUCLEAR_GLOBAL_HOSTILITY) };
        });
      }

      // Plan §M19: "Missiles and nuclear strikes now affect war score (+2 per strike, +10 per
      // nuclear strike)." recordBattle's own `2 + min(8, 10 x lossShare)` formula already produces
      // exactly 2 at lossShare 0 and exactly 10 at lossShare >= 0.8 — a missile strike is expressed
      // as that same battle-score bump rather than a bespoke war-score formula, so it rolls into
      // war.score the same way an invasion's battleScore already does (resolveWarProgress
      // recomputes war.score from battleScore + occupation + tick every turn).
      let nextWars = state.wars;
      const missileWar = state.wars.find(w => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner));
      if (missileWar) {
        const lossShare = tierId === 'nuclear' ? 1 : 0;
        nextWars = state.wars.map(w => (w.id === missileWar.id ? { ...w, battleScore: recordBattle(w, state.playerNationId, lossShare) } : w));
      }

      // Plan §M19: "-50 prestige and a 'Nuclear Pariah' 20-turn modifier" for the striker.
      if (tierId === 'nuclear') {
        const striker = nextNations[state.playerNationId];
        nextNations[state.playerNationId] = addNationModifier(
          { ...striker, prestige: clampPrestige((striker.prestige || 0) - NUCLEAR_PRESTIGE_PENALTY) },
          { sourceType: 'nuclear', sourceId: 'nuclear_pariah', label: 'Nuclear Pariah', mods: { 'national.goldMult': -NUCLEAR_PARIAH_GOLD_MULT_PENALTY }, duration: NUCLEAR_PARIAH_DURATION_TURNS, turnNumber: state.turnNumber }
        );
      }

      const targetNationName = targetNation?.name || targetRegion.owner;
      const message = tierId === 'nuclear'
        ? `A nuclear strike devastates ${REGIONS_DATA[targetRegionId]?.name} (${targetNationName}). The world condemns the attack.`
        : `${tier.name} strikes ${REGIONS_DATA[targetRegionId]?.name} (${targetNationName}).`;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        nations: nextNations,
        wars: nextWars,
        logs: [...state.logs, { year: state.year, message, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.BUILD_ABM_DEFENSE: {
      const costs = ACTION_COSTS.buildAbmDefense;
      const nation = state.nations[state.playerNationId];
      if (!canBuildMissile(getEffectiveAgeId(state.age, state.techAgeId))) return reject(state, 'ABM defense unlocks in the Modern age.');
      if ((nation.abmDefenseLevel || 0) >= MAX_ABM_LEVEL) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...nation, abmDefenseLevel: (nation.abmDefenseLevel || 0) + 1 } },
        logs: [...state.logs, { year: state.year, message: `ABM defense upgraded to level ${(nation.abmDefenseLevel || 0) + 1}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.LAUNCH_MISSION: {
      const { missionId } = action.payload;
      const mission = SPACE_MISSIONS_BY_ID[missionId];
      if (!mission) return state;
      if (!canLaunchSatellite(state.age, state.techAgeId, state.year)) return state;
      if (!canLaunchMission(missionId, state.completedMissions, state.spaceMissionProgress)) return state;
      const costs = { ...mission.cost, dip: ACTION_COSTS.launchMission.dip };
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        spaceMissionProgress: { ...state.spaceMissionProgress, [missionId]: mission.turns },
        logs: [...state.logs, { year: state.year, message: `${mission.name} launched — ${mission.turns} turns to completion.`, type: LogTypes.ACTION }]
      };
    }

    // ---- Military tab (plan §7) — per-region armies ----

    case ActionTypes.RECRUIT_UNIT: {
      const navalLine = action.payload?.navalLine && NAVAL_LINES[action.payload.navalLine] ? action.payload.navalLine : 'warship'; // naval lines (navalLines.js)
      const { regionId, classId } = action.payload;
      const region = state.regions[regionId];
      // Plan §M11 resource sink: costs the age's strategic resource when available, else a gold
      // penalty (getRecruitUnitCost's own header) — computed fresh per recruit, not a flat table
      // entry, the same "dynamically-priced action" shape RESEARCH_TECH/CHANGE_LAW already use.
      const costs = getRecruitUnitCost(state, state.age);
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (!getAvailableClasses(getEffectiveAgeId(state.age, state.techAgeId)).includes(classId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const unitId = `unit_${state.nextUnitSeq}`;
      const isNaval = classId === 'naval';
      if(isNaval && !isCoastal(regionId))return state;
      const newUnit = {
        id: unitId,
        regionId,
        tile: region.tile ?? null, // the tile it stands on (armies.js)
        homeRegionId: regionId, // where its men come from: levy and casualty scars (aftermath.js)
        ownerId: state.playerNationId,
        domain: isNaval ? 'naval' : 'land',
        classId,
        // Plan §M14: the stale, frozen-at-recruitment ageId is gone — a unit's roster stats
        // (src/data/unitClasses.js) are now looked up live via its OWNER's current effective age
        // every time combat needs them, so a unit auto-upgrades as its nation researches forward
        // instead of being permanently stuck at whatever age it was recruited in.
        strength: 1000,
        maxStrength: 1000,
        morale: 100,
        // Plan §M14: `organization` is removed — it was written everywhere and read nowhere but a
        // cosmetic UI label (MilitaryPanel.jsx), never mutated by battle or turn resolution.
        // Plan §M14: resets to a full move every turn (see resolveTurn.js's own reset phase);
        // consumed by MOVE_ARMY/LAUNCH_INVASION/AMPHIBIOUS_ASSAULT/NAVAL_ENGAGEMENT.
        movesLeft: 1,
        xp: 0,
        rank: 'recruit',
        promotions: [],
        commanderId: null,
        // Naval-only: how many land units it can carry (plan §7.5's Embark/Disembark). Land-only:
        // which naval unit currently carries it, if any — set by EMBARK_UNIT/AMPHIBIOUS_ASSAULT.
        transportCapacity: isNaval ? navalCargo(navalLine, getEffectiveAgeId(state.age, state.techAgeId)) : null,
        ...(isNaval ? { navalLine } : {}),
        embarkedOn: null
      };
      const recruitingNation = state.nations[state.playerNationId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [unitId]: newUnit },
        // Its men leave the fields and workshops of the province they're raised in.
        regions: isNaval ? state.regions : levyUnit(state.regions, newUnit),
        nations: {
          ...state.nations,
          // Every other reader of militaryStrength (AI tiering, coalition thresholds, a
          // destroy_military war goal against the player) needs it to actually reflect the
          // player's real recruited army, not sit frozen at its game-start value forever.
          [state.playerNationId]: { ...recruitingNation, militaryStrength: (recruitingNation.militaryStrength || 0) + newUnit.strength }
        },
        nextUnitSeq: state.nextUnitSeq + 1,
        logs: [...state.logs, { year: state.year, message: `Recruited a new ${classId} unit in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DISBAND_UNIT: {
      const { unitId } = action.payload;
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== state.playerNationId) return state;
      const refundHr = Math.round(ACTION_COSTS.recruitUnit.hr * DISBAND_HR_REFUND_RATIO);
      const remainingUnits = { ...state.units };
      delete remainingUnits[unitId];
      // Disbanding a transport strands its cargo in place rather than sinking it with the ship.
      if (unit.domain === 'naval') {
        Object.values(remainingUnits).forEach(u => {
          if (u.embarkedOn === unitId) remainingUnits[u.id] = { ...u, embarkedOn: null };
        });
      }
      const disbandingNation = state.nations[state.playerNationId];
      return {
        ...state,
        resources: { ...state.resources, hr: (state.resources.hr || 0) + refundHr },
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...disbandingNation, militaryStrength: Math.max(0, (disbandingNation.militaryStrength || 0) - unit.strength) }
        },
        units: remainingUnits,
        logs: [...state.logs, { year: state.year, message: `Disbanded a ${unit.classId} unit. +${refundHr} HR`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.MOVE_ARMY: {
      const { unitId, toRegionId } = action.payload;
      const unit = state.units[unitId];
      const costs = ACTION_COSTS.moveArmy;
      if (!unit || unit.ownerId !== state.playerNationId) return state;
      if (unit.embarkedOn) return state; // embarked units move with their transport, not on their own
      // Plan §M14: a stack moves at most once per turn — forcedMarch grants a unit a second move.
      if ((unit.movesLeft ?? 1) <= 0) return state;
      const isLandAdjacent = getNeighborIds(unit.regionId).includes(toRegionId);
      const isSeaLaneReachable = unit.domain === 'naval' && isReachableBySea(unit.regionId, toRegionId, state.age);
      if (!isLandAdjacent && !isSeaLaneReachable) return state;
      // MOVE_ARMY is redeployment within your own territory, not an invasion — it has no war
      // declaration, no combat resolution, and no AP/gold cost beyond the ordinary move, so it must
      // never be able to walk a unit straight into someone else's region. Entering foreign
      // territory is what LAUNCH_INVASION/AMPHIBIOUS_ASSAULT are for.
      if (state.regions[toRegionId]?.owner !== state.playerNationId) return state;
      if (!canAfford(state.resources, costs)) return state;
      // A manual move replaces any march order and counts as marching this turn (routes.js costs).
      const toTile = state.regions[toRegionId]?.tile ?? null;
      const nextUnits = { ...state.units, [unitId]: { ...cancelRoute(unit), regionId: toRegionId, tile: toTile, movesLeft: (unit.movesLeft ?? 1) - 1, ...(unit.domain === 'naval' ? {} : { marchedTurn: state.turnNumber }) } };
      // A transport takes its embarked cargo along with it.
      Object.values(state.units).forEach(u => {
        if (u.embarkedOn === unitId) nextUnits[u.id] = { ...u, regionId: toRegionId, tile: toTile };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        logs: [...state.logs, { year: state.year, message: `Moved a ${unit.classId} unit to ${REGIONS_DATA[toRegionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    // March anywhere over several turns (plan §4g, routes.js): the stack in `fromRegionId` (or the
    // units in `unitIds`) gets a route to `toRegionId`, walked at End Turn. Giving the order is free.
    case ActionTypes.SET_ROUTE: {
      // The target is a city id or a tile id (free land).
      const { fromRegionId, toRegionId, toTile, unitIds = null, naval = false } = action.payload || {};
      const target = toTile != null ? toTile : toRegionId;
      const order = orderMarch(state, fromRegionId, target, unitIds, { naval });
      if (!order.units) return reject(state, order.reason || 'That march is not possible.');
      const p = order.plan;
      return {
        ...state,
        units: order.units,
        logs: [...state.logs, { year: state.year, message: `${p.naval ? (p.units.length > 1 ? `${p.units.length} ships` : 'A fleet') : (p.units.length > 1 ? `${p.units.length} units` : 'An army')} set out for ${placeName(state, p.path[p.path.length - 1])}: about ${p.turns} turn${p.turns > 1 ? 's' : ''}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CANCEL_ROUTE: {
      const { regionId = null, unitIds = null } = action.payload || {};
      const targets = Object.values(state.units).filter((u) => u.ownerId === state.playerNationId && u.route?.length && (unitIds ? unitIds.includes(u.id) : u.regionId === regionId));
      if (!targets.length) return state;
      const units = { ...state.units };
      targets.forEach((u) => { units[u.id] = cancelRoute(u); });
      return { ...state, units };
    }

    case ActionTypes.EMBARK_UNIT: {
      const { landUnitId, navalUnitId } = action.payload;
      const landUnit = state.units[landUnitId];
      const navalUnit = state.units[navalUnitId];
      const costs = ACTION_COSTS.embarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || landUnit.domain !== 'land' || landUnit.embarkedOn) return state;
      if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return state;
      if (landUnit.regionId !== navalUnit.regionId) return state;
      // Aircraft board a carrier by its air capacity (navalLines.js); troops by the ship's cargo.
      const air = landUnit.classId === 'air';
      const cargoCount = Object.values(state.units).filter(u => u.embarkedOn === navalUnitId && (u.classId === 'air') === air).length;
      const capacity = air ? navalAir(navalUnit.navalLine || 'warship') : navalUnit.transportCapacity;
      if (cargoCount >= capacity) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: { ...landUnit, embarkedOn: navalUnitId } },
        logs: [...state.logs, { year: state.year, message: `A ${landUnit.classId} unit embarked for transport.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DISEMBARK_UNIT: {
      // In port the unit steps ashore into the city; at sea it lands on `tile`, a land tile next to
      // the fleet on own, allied or free land (enemy land is an AMPHIBIOUS_ASSAULT).
      const { landUnitId, tile = null } = action.payload;
      const landUnit = state.units[landUnitId];
      const costs = ACTION_COSTS.disembarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || !landUnit.embarkedOn) return state;
      if (!canAfford(state.resources, costs)) return state;
      const ship = state.units[landUnit.embarkedOn];
      let landed;
      if (ship && atSea(state, ship)) {
        const tiles = getTiles();
        if (tile == null || !passableTile(tiles, tile) || !tiles.neighbors[ship.tile].includes(tile)) return reject(state, 'Pick a shore next to the fleet to land on.');
        const access = tileAccess(state, tile, state.playerNationId);
        if (access === 'enemy' || access === 'held' || access === 'closed') return reject(state, access === 'closed' ? 'No access to that shore.' : 'Enemy shore: use an amphibious assault.');
        landed = { ...landUnit, embarkedOn: null, tile, regionId: regionForTile(state, tile, state.playerNationId, landUnit.regionId), movesLeft: 0 };
      } else landed = { ...landUnit, embarkedOn: null, tile: state.regions[landUnit.regionId]?.tile ?? landUnit.tile };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: landed },
        logs: [...state.logs, { year: state.year, message: `A ${landUnit.classId} unit disembarked at ${placeName(state, landed.tile)}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.ATTACK_ARMY: {
      // A field battle (fieldBattle.js), auto-resolved: the stack in `fromRegionId` beside `tile`
      // attacks the enemy stack standing there.
      const { fromRegionId, tile } = action.payload || {};
      const v = validateFieldAttack(state, fromRegionId, tile);
      if (!v.ok) return refuseAttack(state, v.reason, fromRegionId);
      const ctx = getFieldBattleContext(state, v);
      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, getFieldResolveArgs(v, ctx), { kind: 'field', fromRegionId }, rng);
      const paid = { ...state, resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion) };
      return applyFieldResult(paid, v, battle, { rngSeed: rng.getSeed() });
    }

    case ActionTypes.ATTACK_FLEET: {
      // A sea battle (navalBattle.js), auto-resolved: the fleets on `fromTile` attack the enemy
      // fleets on the neighbouring sea tile `tile`.
      const { fromTile, tile } = action.payload || {};
      const v = validateFleetAttack(state, fromTile, tile);
      if (!v.ok) return refuseAttack(state, v.reason, state.world?.tileOwner?.[tile] ?? null);
      const ctx = getFleetBattleContext(state, v);
      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, getFleetResolveArgs(v, ctx), { kind: 'naval' }, rng);
      const paid = { ...state, resources: applyCosts(state.resources, ACTION_COSTS.navalEngagement) };
      return applyFleetResult(paid, v, battle, { rngSeed: rng.getSeed() });
    }

    case ActionTypes.LAUNCH_INVASION: {
      // Auto-resolve. The gate, the battle inputs and every consequence live in
      // src/engine/invasion.js so a commanded (real-time) battle shares them exactly — see
      // BEGIN_TACTICAL_BATTLE/RESOLVE_TACTICAL_BATTLE.
      const { fromRegionId, targetRegionId } = action.payload;
      const v = validateInvasion(state, fromRegionId, targetRegionId);
      if (!v.ok) return refuseAttack(state, v.reason, targetRegionId);
      const ctx = getInvasionBattleContext(state, { targetRegionId, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, getResolveBattleArgs(v, ctx), { kind: 'invasion', cityId: targetRegionId, fromRegionId }, rng);
      const paid = { ...state, resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion) };
      return applyInvasionResult(paid, { fromRegionId, targetRegionId, war: v.war, targetRegion: v.targetRegion, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed(), militia: battle.inputs.militia });
    }

    // ---- Tactical Battles (design/rts-battles-implementation-plan.md §10.1) ----

    case ActionTypes.BEGIN_TACTICAL_BATTLE: {
      if (state.pendingBattle) return reject(state, 'Finish the battle already in progress first.');
      const { fromRegionId, targetRegionId, tile = null, fromTile = null, naval = false } = action.payload;
      if (naval) {
        // A commanded sea battle (navalBattle.js): the fleets on `fromTile` against the enemy fleets on `tile`.
        const nv = validateFleetAttack(state, fromTile, tile);
        if (!nv.ok) return refuseAttack(state, nv.reason, state.world?.tileOwner?.[tile] ?? null);
        const nrng = createRng(state.rngSeed);
        const nseed = Math.floor(nrng.next() * 0xffffffff) >>> 0;
        const ncounter = (state.battleCounter || 0) + 1;
        const anchor = state.world?.tileOwner?.[tile] ?? regionForTile(state, tile, state.playerNationId, nv.fromRegionId);
        return {
          ...state,
          resources: applyCosts(state.resources, ACTION_COSTS.navalEngagement),
          rngSeed: nrng.getSeed(),
          battleCounter: ncounter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${ncounter}`, kind: 'naval', fromRegionId: nv.fromRegionId, fromTile, tile, targetRegionId: anchor, warId: nv.war?.id ?? null,
            attackerNationId: state.playerNationId, defenderNationId: nv.defenderNationId, seed: nseed, startedTurn: state.turnNumber, playerSide: 'attacker',
            attackerUnitIds: nv.attackerUnits.map((u) => u.id), defenderUnitIds: nv.defenderUnits.map((u) => u.id), attackerReinforcements: [], defenderReinforcements: []
          },
          logs: [...state.logs, { year: state.year, message: 'Your fleet gives battle at sea; you take command.', type: LogTypes.COMBAT }]
        };
      }
      if (tile != null) {
        // A commanded field battle (fieldBattle.js): the stack beside `tile` against the enemy on it.
        const fv = validateFieldAttack(state, fromRegionId, tile);
        if (!fv.ok) return refuseAttack(state, fv.reason, fromRegionId);
        const frng = createRng(state.rngSeed);
        const fseed = Math.floor(frng.next() * 0xffffffff) >>> 0;
        const fcounter = (state.battleCounter || 0) + 1;
        const anchor = state.world?.tileOwner?.[tile] ?? fromRegionId;
        return {
          ...state,
          resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion),
          rngSeed: frng.getSeed(),
          battleCounter: fcounter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${fcounter}`, kind: 'field', fromRegionId, tile, targetRegionId: anchor, warId: fv.war?.id ?? null,
            attackerNationId: state.playerNationId, defenderNationId: fv.defenderNationId, seed: fseed, startedTurn: state.turnNumber, playerSide: 'attacker',
            attackerUnitIds: fv.attackerUnits.map((u) => u.id), defenderUnitIds: fv.defenderUnits.map((u) => u.id), attackerReinforcements: [], defenderReinforcements: []
          },
          logs: [...state.logs, { year: state.year, message: 'Your army gives battle in the field; you take command.', type: LogTypes.COMBAT }]
        };
      }
      const v = validateInvasion(state, fromRegionId, targetRegionId);
      if (!v.ok) return refuseAttack(state, v.reason, targetRegionId);
      // Nothing to fight: an undefended region is simply taken, exactly as auto-resolve does.
      if (v.defenderUnits.length === 0) return gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } });
      const rng = createRng(state.rngSeed);
      const seed = Math.floor(rng.next() * 0xffffffff) >>> 0;
      const counter = (state.battleCounter || 0) + 1;
      return {
        ...state,
        resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion), // paid once, when the battle begins
        rngSeed: rng.getSeed(),
        battleCounter: counter,
        pendingBattle: {
          id: `b_${state.turnNumber}_${counter}`,
          kind: 'invasion',
          fromRegionId,
          targetRegionId,
          warId: v.war?.id ?? null,
          attackerNationId: state.playerNationId,
          defenderNationId: v.targetRegion.owner,
          seed,
          startedTurn: state.turnNumber,
          playerSide: 'attacker',
          attackerUnitIds: v.attackerUnits.map((u) => u.id),
          defenderUnitIds: v.defenderUnits.map((u) => u.id),
          // Own and allied troops near the city stand by (battleInputs.js, master plan 6.7 row 16);
          // the city's militia defends it (row 19).
          attackerReinforcements: reinforcementSources(state, targetRegionId, state.playerNationId, v.targetRegion.owner, [fromRegionId]),
          defenderReinforcements: reinforcementSources(state, targetRegionId, v.targetRegion.owner, state.playerNationId),
          militia: cityMilitia(state, targetRegionId)
        },
        logs: [...state.logs, { year: state.year, message: `Your army marches on ${REGIONS_DATA[targetRegionId]?.name} — you take command of the battle.`, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.RESOLVE_TACTICAL_BATTLE: {
      const pb = state.pendingBattle;
      const { battleId, log } = action.payload || {};
      if (!pb || pb.id !== battleId) return state;
      // With the command log, the battle is re-simulated here from the authoritative game state
      // (src/battle/sim/replay.js), and the client's reported result is ignored. This is what the
      // edge function runs too. Without a log (older clients) the reported result is sanitized.
      let result = action.payload.result;
      if (Array.isArray(log)) {
        const setup = buildInvasionSetup(state, pb);
        if (setup) {
          const replay = replayBattle(setup, log);
          result = { ...replay.result, report: { ...replay.result.report, tactical: { ...replay.result.report?.tactical, verified: true, hash: replay.hash } } };
        }
      }
      const targetRegion = state.regions[pb.targetRegionId];
      // If peace was signed while the battle was being fought, the battle has no consequences.
      const war = state.wars.find((w) => w.id === pb.warId && w.active);
      const cleared = { ...state, pendingBattle: null };
      // Every kind ends in the one outcome service (battleOutcome.js), under the pending battle's
      // id: powers spent, the city's damage, XP, war score, aftermath and report, exactly once.
      const opts = { rngSeed: state.rngSeed, id: pb.id, mode: 'command' };
      // A field or sea battle the AI started (battleQueue.js): the gate is the aggressor's, the
      // operation id the queued record's (so its Auto can never also land).
      // An AI landing on the player's coast (aiLanding.js): the interception at sea, then the landing.
      if (pb.defenseId && (pb.kind === 'intercept' || (pb.kind === 'amphibious' && pb.playerSide === 'defender'))) {
        const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
        if (!def) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result);
        const opts = { mode: 'command', decisive: safe.report.tactical.decisive, xpBonusById: safe.report.tactical.xpBonusById };
        return pb.kind === 'intercept' ? resolveInterceptQueued(cleared, def, safe, opts) : resolveLandingQueued(cleared, def, safe, opts);
      }
      // A raid or a sack against the player (raidBattle.js): the queued record's id, then the raid carries on (raids.js).
      if (pb.defenseId && isRaidKind(pb.kind)) {
        const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
        if (!def) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result);
        return resolveRaidBattle(cleared, def, safe, { mode: 'command', xpBonusById: safe.report.tactical.xpBonusById });
      }
      const aiStarted = !!pb.defenseId && (pb.kind === 'field' || pb.kind === 'naval');
      const gateState = aiStarted ? aggressorView(cleared, pb.attackerNationId) : cleared;
      const sideOpts = aiStarted ? { ...opts, id: pb.defenseId, defenseId: pb.defenseId, attackerNationId: pb.attackerNationId, viewerId: state.playerNationId } : opts;
      if (pb.kind === 'naval') {
        const nv = validateFleetAttack(gateState, pb.fromTile, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!nv.ok || (pb.warId && !war)) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result);
        const vv = { ...nv, attackerUnits: nv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: nv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)), war };
        return applyFleetResult(cleared, vv, safe, sideOpts);
      }
      if (pb.kind === 'field') {
        const fv = validateFieldAttack(gateState, pb.fromRegionId, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!fv.ok || (pb.warId && !war)) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result);
        const vv = { ...fv, attackerUnits: fv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: fv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)), war };
        return applyFieldResult(cleared, vv, safe, { ...sideOpts, xpBonusById: safe.report.tactical.xpBonusById });
      }
      if (pb.kind === 'defense') {
        const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
        if (!def) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result);
        return applyDefenseResult(cleared, def, safe, { decisive: safe.report.tactical.decisive, xpBonusById: safe.report.tactical.xpBonusById, mode: 'command', militia: pb.militia || [] });
      }
      // An assault on an independent has no war (hostility.js): it stands while the target may still be attacked.
      if (!targetRegion || (pb.warId ? !war : !canAttack(state, pb.attackerNationId || state.playerNationId, targetRegion.owner))) return cleared;
      const safe = sanitizeTacticalResult(state, pb, result);
      const cityOpts = { ...opts, decisive: safe.report.tactical.decisive, xpBonusById: safe.report.tactical.xpBonusById, militia: pb.militia || [] };
      if (pb.kind === 'amphibious') {
        return applyAmphibiousLanding(cleared, { navalUnitId: pb.navalUnitId, fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war, targetRegion, isDefended: pb.defenderUnitIds.length > 0 }, safe, cityOpts);
      }
      return applyInvasionResult(cleared, { fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war, targetRegion, isDefended: pb.defenderUnitIds.length > 0 }, safe, cityOpts);
    }

    case ActionTypes.ABANDON_TACTICAL_BATTLE: {
      // "Auto-resolve instead": the same battle through the honest auto-resolve (autoBattle.js),
      // with the original units, the same inputs and the battle's own seed, under the pending
      // battle's id. The cost was already paid when it began, so it isn't charged again.
      const pb = state.pendingBattle;
      if (!pb) return state;
      const cleared = { ...state, pendingBattle: null };
      const opts = { rngSeed: state.rngSeed, id: pb.id, mode: 'auto' };
      // A queued battle (a defence, or a field or sea battle the AI started): its own Auto.
      if (pb.defenseId) return resolveQueuedAuto(cleared, pb.defenseId);
      if (pb.kind === 'naval') {
        const nv = validateFleetAttack(cleared, pb.fromTile, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!nv.ok) return cleared;
        const vv = { ...nv, attackerUnits: nv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: nv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)) };
        if (!vv.attackerUnits.length || !vv.defenderUnits.length) return cleared;
        const battle = resolveAutoBattle(cleared, getFleetResolveArgs(vv, getFleetBattleContext(cleared, vv)), { kind: 'naval' }, createRng(pb.seed));
        return applyFleetResult(cleared, vv, battle, opts);
      }
      if (pb.kind === 'field') {
        const fv = validateFieldAttack(cleared, pb.fromRegionId, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!fv.ok) return cleared;
        const vv = { ...fv, attackerUnits: fv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: fv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)) };
        if (!vv.attackerUnits.length || !vv.defenderUnits.length) return cleared;
        const battle = resolveAutoBattle(cleared, getFieldResolveArgs(vv, getFieldBattleContext(cleared, vv)), { kind: 'field', fromRegionId: pb.fromRegionId }, createRng(pb.seed));
        return applyFieldResult(cleared, vv, battle, opts);
      }
      if (pb.kind === 'amphibious') {
        const av = validateAmphibious(cleared, pb.navalUnitId, pb.targetRegionId, { ignoreCost: true, ignoreBattleLocks: true });
        if (!av.ok) return cleared;
        const attackers = av.embarkedLandUnits.filter((u) => pb.attackerUnitIds.includes(u.id));
        const defenders = av.defenderLandUnits.filter((u) => pb.defenderUnitIds.includes(u.id));
        if (!attackers.length) return cleared;
        const actx = getAmphibiousBattleContext(cleared, av, defenders);
        const battle = resolveAutoBattle(cleared, { attackerUnits: attackers, defenderUnits: defenders, ...actx }, { kind: 'landing', cityId: pb.targetRegionId, fromRegionId: pb.fromRegionId, militia: pb.militia }, createRng(pb.seed));
        return applyAmphibiousLanding(cleared, { navalUnitId: pb.navalUnitId, fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war: av.war, targetRegion: av.targetRegion, isDefended: defenders.length > 0 }, battle, { ...opts, militia: battle.inputs.militia });
      }
      const v = validateInvasion(cleared, pb.fromRegionId, pb.targetRegionId, { ignoreCost: true, ignoreBattleLocks: true });
      if (!v.ok) return cleared;
      const attackers = v.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id));
      const defenders = v.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id));
      if (!attackers.length) return cleared;
      const vv = { ...v, attackerUnits: attackers, defenderUnits: defenders };
      const ctx = getInvasionBattleContext(cleared, { targetRegionId: pb.targetRegionId, targetRegion: v.targetRegion, defenderUnits: defenders });
      const battle = resolveAutoBattle(cleared, getResolveBattleArgs(vv, ctx), { kind: 'invasion', cityId: pb.targetRegionId, fromRegionId: pb.fromRegionId, militia: pb.militia }, createRng(pb.seed));
      return applyInvasionResult(cleared, { fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war: v.war, targetRegion: v.targetRegion, isDefended: ctx.isDefended }, battle, { ...opts, militia: battle.inputs.militia });
    }

    // ---- Commanded amphibious landing (Tactical Battles T9) ----

    case ActionTypes.BEGIN_AMPHIBIOUS_BATTLE: {
      if (state.pendingBattle) return reject(state, 'Finish the battle already in progress first.');
      const { navalUnitId, targetRegionId } = action.payload || {};
      const v = validateAmphibious(state, navalUnitId, targetRegionId);
      if (!v.ok) return refuseAttack(state, v.reason, targetRegionId);
      // An enemy fleet has to be fought at sea first, and an empty beach needs no battle: both go
      // through the auto-resolved assault exactly as before.
      if (v.defenderNavalUnits.length || !v.defenderLandUnits.length) return gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId } });
      const rng = createRng(state.rngSeed);
      const seed = Math.floor(rng.next() * 0xffffffff) >>> 0;
      const counter = (state.battleCounter || 0) + 1;
      return {
        ...state,
        resources: applyCosts(state.resources, ACTION_COSTS.amphibiousAssault),
        rngSeed: rng.getSeed(),
        battleCounter: counter,
        pendingBattle: {
          id: `b_${state.turnNumber}_${counter}`,
          kind: 'amphibious',
          navalUnitId,
          fromRegionId: v.navalUnit.regionId,
          targetRegionId,
          warId: v.war?.id ?? null,
          attackerNationId: state.playerNationId,
          defenderNationId: v.targetRegion.owner,
          seed,
          startedTurn: state.turnNumber,
          playerSide: 'attacker',
          hasBeachhead: v.hasBeachhead,
          attackerUnitIds: v.embarkedLandUnits.map((u) => u.id),
          defenderUnitIds: v.defenderLandUnits.map((u) => u.id),
          attackerReinforcements: [],
          defenderReinforcements: reinforcementSources(state, targetRegionId, v.targetRegion.owner, state.playerNationId),
          militia: cityMilitia(state, targetRegionId)
        },
        logs: [...state.logs, { year: state.year, message: `Your fleet closes on ${REGIONS_DATA[targetRegionId]?.name} — you take command of the landing.`, type: LogTypes.COMBAT }]
      };
    }

    // ---- The battle queue (battleQueue.js): battles others started against the player ----
    // City assaults (defense.js), field battles and sea battles the AI started, in the order its
    // armies moved. Each is fought on Command or Auto; none while an event or a peace offer waits.

    case ActionTypes.RESOLVE_DEFENSE_AUTO:
      if (state.pendingBattle?.defenseId === action.payload?.defenseId) return state;
      if (battleQueueBlocked(state)) return reject(state, 'Answer the open event or peace offer first: the battles wait for it.');
      return resolveQueuedAuto(state, action.payload?.defenseId);

    case ActionTypes.RESOLVE_ALL_DEFENSES_AUTO:
      // A battle already being commanded is left alone; everything else is fought now, in order.
      if (battleQueueBlocked(state)) return reject(state, 'Answer the open event or peace offer first: the battles wait for it.');
      return resolveAllQueuedAuto(state);

    case ActionTypes.WITHDRAW_FROM_DEFENSE: {
      if (state.pendingBattle?.defenseId === action.payload?.defenseId) return state;
      const queued = (state.pendingDefenses || []).find((d) => d.id === action.payload?.defenseId);
      if (queued && queuedKind(queued) !== 'defense') return reject(state, 'An army in the field cannot give up a city: fight, or let the battle be fought on Auto.');
      const w = applyDefenseWithdrawal(state, action.payload?.defenseId);
      return w.ok ? w.state : reject(state, w.reason === 'nowhere' ? 'Your garrison has nowhere to fall back to — it has to fight.' : 'That assault is already over.');
    }

    case ActionTypes.BEGIN_DEFENSE_BATTLE: {
      if (state.pendingBattle) return reject(state, 'Finish the battle already in progress first.');
      if (battleQueueBlocked(state)) return reject(state, 'Answer the open event or peace offer first: the battles wait for it.');
      const def = (state.pendingDefenses || []).find((d) => d.id === action.payload?.defenseId);
      if (!def) return state;
      const counter = (state.battleCounter || 0) + 1;
      const kind = queuedKind(def);
      if (kind === 'intercept' || kind === 'landing') {
        // An AI landing on the player's coast: the player's fleets intercept, then the garrison holds the beach.
        const armies = kind === 'intercept' ? interceptArmies(state, def) : landingArmies(state, def);
        if (!armies || (kind === 'landing' && !armies.defenderUnits.length && !(def.militia || []).length)) return resolveQueuedAuto(state, def.id);
        return {
          ...state,
          battleCounter: counter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${counter}`, kind: kind === 'intercept' ? 'intercept' : 'amphibious', defenseId: def.id,
            navalUnitId: def.navalUnitId, fromRegionId: def.fromRegionId, targetRegionId: def.regionId, warId: def.warId, hasBeachhead: def.hasBeachhead,
            attackerNationId: def.aggressorId, defenderNationId: state.playerNationId, seed: def.seed, startedTurn: state.turnNumber, playerSide: 'defender',
            attackerUnitIds: armies.attackerUnits.map((u) => u.id), defenderUnitIds: armies.defenderUnits.map((u) => u.id), attackerReinforcements: [],
            defenderReinforcements: kind === 'landing' ? reinforcementSources(state, def.regionId, state.playerNationId, def.aggressorId) : [], militia: kind === 'landing' ? def.militia || [] : []
          },
          logs: [...state.logs, { year: state.year, message: kind === 'intercept' ? `Your fleet sails out against ${state.nations[def.aggressorId]?.name || 'the enemy'}'s invasion fleet.` : `You take command of the defense of ${REGIONS_DATA[def.regionId]?.name} against the landing.`, type: LogTypes.COMBAT }]
        };
      }
      if (isRaidKind(kind)) {
        // Raiders against the player's troops or town: the player defends (raidBattle.js).
        const armies = queuedRaidArmies(state, def);
        if (!armies.attackerUnits.length || (!armies.defenderUnits.length && kind !== 'sack')) return resolveQueuedAuto(state, def.id);
        return {
          ...state,
          battleCounter: counter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${counter}`, kind, defenseId: def.id, raidKind: def.raidKind,
            fromRegionId: null, fromTile: def.fromTile ?? null, tile: def.tile, targetRegionId: def.regionId, cityId: def.cityId ?? null, warId: null,
            attackerNationId: def.aggressorId, defenderNationId: state.playerNationId, seed: def.seed, startedTurn: state.turnNumber, playerSide: 'defender',
            attackerUnitIds: armies.attackerUnits.map((u) => u.id), defenderUnitIds: armies.defenderUnits.map((u) => u.id), attackerReinforcements: [], defenderReinforcements: [], militia: def.militia || []
          },
          logs: [...state.logs, { year: state.year, message: `You take command against ${state.nations[def.aggressorId]?.name || 'the raiders'}.`, type: LogTypes.COMBAT }]
        };
      }
      if (kind !== 'defense') {
        // A field or sea battle the AI started against the player's stack: the player defends it.
        // A fort that stopped the player's army (forts.js): the player attacks it.
        const armies = queuedArmies(state, def);
        if (!armies) return resolveQueuedAuto(state, def.id);
        const attacking = def.aggressorId === state.playerNationId;
        const foe = attacking ? armies.v.defenderNationId : def.aggressorId;
        return {
          ...state,
          battleCounter: counter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${counter}`, kind, defenseId: def.id, fort: !!def.fort,
            fromRegionId: def.fromRegionId, fromTile: def.fromTile ?? null, tile: def.tile, targetRegionId: state.world?.tileOwner?.[def.tile] ?? def.regionId, warId: def.warId,
            attackerNationId: def.aggressorId, defenderNationId: attacking ? foe : state.playerNationId, seed: def.seed, startedTurn: state.turnNumber, playerSide: attacking ? 'attacker' : 'defender',
            attackerUnitIds: armies.v.attackerUnits.map((u) => u.id), defenderUnitIds: armies.v.defenderUnits.map((u) => u.id), attackerReinforcements: [], defenderReinforcements: []
          },
          logs: [...state.logs, { year: state.year, message: attacking ? `You take command of the attack on the fort of ${state.nations[foe]?.name || foe}.` : `You take command of your ${kind === 'naval' ? 'fleet' : 'army'} against ${state.nations[def.aggressorId]?.name || def.aggressorId}.`, type: LogTypes.COMBAT }]
        };
      }
      const armies = getDefenseArmies(state, def);
      // Nothing left to command (the garrison or the attackers are gone): settle it as auto does.
      if (!armies.defenderUnits.length || !armies.attackerUnits.length) return resolveDefenseAuto(state, def.id);
      return {
        ...state,
        battleCounter: counter,
        pendingBattle: {
          id: `b_${state.turnNumber}_${counter}`,
          kind: 'defense',
          defenseId: def.id,
          fromRegionId: def.fromRegionId,
          targetRegionId: def.regionId,
          warId: def.warId,
          attackerNationId: def.aggressorId,
          defenderNationId: state.playerNationId,
          seed: def.seed,
          startedTurn: state.turnNumber,
          playerSide: 'defender',
          attackerUnitIds: armies.attackerUnits.filter((u) => !u.synthetic).map((u) => u.id),
          synthetic: def.synthetic || [],
          defenderUnitIds: armies.defenderUnits.map((u) => u.id),
          attackerReinforcements: [],
          defenderReinforcements: reinforcementSources(state, def.regionId, state.playerNationId, def.aggressorId),
          militia: cityMilitia(state, def.regionId)
        },
        logs: [...state.logs, { year: state.year, message: `You take command of the defense of ${REGIONS_DATA[def.regionId]?.name}.`, type: LogTypes.COMBAT }]
      };
    }

    // battleSettings: `defaultMode` only PRE-SELECTS a choice in the pre-battle modal (your own
    // attacks always ask); `autoDefend` is the one explicit opt-in to auto-resolve enemy assaults.
    case ActionTypes.SET_BATTLE_SETTINGS: {
      const next = { ...(state.battleSettings || {}), ...(action.payload || {}) };
      if (!['ask', 'auto', 'command'].includes(next.defaultMode)) next.defaultMode = 'ask';
      next.autoDefend = next.autoDefend === true;
      next.instantBattles = next.instantBattles === true; // skip the auto-resolve replay
      return { ...state, battleSettings: next };
    }

    case ActionTypes.AMPHIBIOUS_ASSAULT: {
      const { navalUnitId, targetRegionId } = action.payload;
      const costs = ACTION_COSTS.amphibiousAssault;
      // The shared gate (src/engine/invasion.js): a player fleet with troops aboard, a reachable
      // enemy coast, an active war with its owner (plan §M13), moves left (§M14), and the cost.
      const gate = validateAmphibious(state, navalUnitId, targetRegionId);
      if (!gate.ok) return refuseAttack(state, gate.reason, targetRegionId);
      const { navalUnit, targetRegion, embarkedLandUnits, war: invasionWar } = gate;

      const rng = createRng(state.rngSeed);
      let nextUnits = { ...state.units };
      const terrain = getRegionTerrain(targetRegionId, REGIONS_DATA);
      const attackerAgeId = getEffectiveAgeId(state.age, state.techAgeId);
      let paid = { ...state, resources: applyCosts(state.resources, costs) };

      // Naval interception (plan §7.5): a defending fleet forces a naval battle before the landing,
      // fought and applied through the outcome service like any sea battle. Losing it sinks the
      // transport and everything still aboard, and the assault never lands.
      const defenderNavalUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
      if (defenderNavalUnits.length > 0) {
        const navalBattle = resolveAutoBattle(state, {
          attackerUnits: [navalUnit],
          defenderUnits: defenderNavalUnits,
          terrain,
          isAttackingFortification: false,
          generals: state.hiredCommanders,
          attackerAgeId,
          defenderAgeId: state.age
        }, { kind: 'lane' }, rng);
        const sunk = navalBattle.outcome !== 'attacker';
        const fought = sunk ? { ...navalBattle, attackerUnits: navalBattle.attackerUnits.map((u) => ({ ...u, strength: 0 })) } : navalBattle;
        const meta = { kind: 'lane', warId: invasionWar?.id ?? null, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner, fromRegionId: navalUnit.regionId, regionId: targetRegionId, attackerStart: [navalUnit], defenderStart: defenderNavalUnits, rngSeed: rng.getSeed() };
        paid = applyBattleOutcome(paid, makeBattleOutcome({ ...meta, id: battleIdOf(state, { ...meta, seed: rng.getSeed() }) }, fought));
        if (sunk) {
          // The transport went down with everything aboard.
          const units = { ...paid.units };
          delete units[navalUnitId];
          embarkedLandUnits.forEach(u => delete units[u.id]);
          return { ...paid, units, logs: [...paid.logs, { year: state.year, message: `Your invasion fleet was intercepted and sunk approaching ${REGIONS_DATA[targetRegionId]?.name}.`, type: LogTypes.COMBAT }] };
        }
        nextUnits = paid.units;
      }

      // No existing foothold near the target means the landing itself takes the amphibious malus;
      // once the attacker already holds a neighboring region, further attacks staged from it are normal.
      const hasBeachhead = getNeighborIds(targetRegionId).some(nId => state.regions[nId]?.owner === state.playerNationId);
      const attackerLandUnits = embarkedLandUnits.map(u => nextUnits[u.id] || u).filter(Boolean);
      const defenderLandUnits = Object.values(nextUnits).filter(u => u.regionId === targetRegionId && u.domain === 'land');
      const isDefended = defenderLandUnits.length > 0;

      const battle = resolveAutoBattle(paid, {
        attackerUnits: attackerLandUnits,
        defenderUnits: defenderLandUnits,
        terrain,
        isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
        generals: state.hiredCommanders,
        attackerAgeId,
        defenderAgeId: state.age,
        attackerPenaltyMultiplier: 1,
        battleType: hasBeachhead ? 'field' : 'landing', // the landing's odds live in battleType.js
        defenderDamageReductionMultiplier: isDefended
          ? getDefenseLevelDamageReductionMultiplier((targetRegion.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total) * getZoneOfControlMultiplier(state.regions, targetRegionId, targetRegion.owner)
          : 1
      }, { kind: 'landing', cityId: targetRegionId, fromRegionId: navalUnit.regionId }, rng);

      return applyAmphibiousLanding({ ...paid, units: nextUnits }, { navalUnitId, fromRegionId: navalUnit.regionId, targetRegionId, war: invasionWar, targetRegion: paid.regions[targetRegionId] || targetRegion, isDefended }, battle, { rngSeed: rng.getSeed(), militia: battle.inputs.militia });
    }

    case ActionTypes.NAVAL_ENGAGEMENT: {
      const { fromRegionId, targetRegionId } = action.payload;
      const fromRegion = state.regions[fromRegionId];
      const costs = ACTION_COSTS.navalEngagement;
      if (!fromRegion || fromRegion.owner !== state.playerNationId) return state;
      const attackerNavalUnits = Object.values(state.units).filter(u => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'naval');
      const isLandAdjacent = getNeighborIds(fromRegionId).includes(targetRegionId);
      const isSeaLaneReachable = isReachableBySea(fromRegionId, targetRegionId, state.age);
      // A fleet at sea beside the target's coast (fleets.js) engages too.
      const besideCoast = attackerNavalUnits.some(u => atSea(state, u) && touchesCoastOf(state, getTiles(), u.tile, targetRegionId));
      if (!isLandAdjacent && !isSeaLaneReachable && !besideCoast) return state;
      if (attackerNavalUnits.length === 0) return state;
      // Plan §M14: one attack per stack per turn.
      if (!attackerNavalUnits.every(u => (u.movesLeft ?? 1) > 0)) return state;
      // Only fleets of nations you're at war with can be engaged (plan §M13, as for invasions).
      const presentNavalUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
      const defenderNavalUnits = presentNavalUnits.filter(u => canAttack(state, state.playerNationId, u.ownerId));
      if (presentNavalUnits.length === 0) return state;
      if (defenderNavalUnits.length === 0) return reject(state, `You're at peace with ${state.nations[presentNavalUnits[0].ownerId]?.name || 'that fleet\'s nation'} — declare war before engaging their fleet.`);
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, {
        attackerUnits: attackerNavalUnits,
        defenderUnits: defenderNavalUnits,
        terrain: getRegionTerrain(targetRegionId, REGIONS_DATA),
        isAttackingFortification: false,
        generals: state.hiredCommanders,
        attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
        defenderAgeId: state.age
      }, { kind: 'lane' }, rng);
      // A naval engagement only contests the lane: survivors hold their own positions, win or
      // lose (battleOutcome.js, kind 'lane').
      const defenderNationId = defenderNavalUnits[0].ownerId;
      const laneWar = state.wars.find((w) => w.active && isWarBetween(w, state.playerNationId, defenderNationId));
      const meta = { kind: 'lane', warId: laneWar?.id ?? null, attackerNationId: state.playerNationId, defenderNationId, fromRegionId, regionId: targetRegionId, attackerStart: attackerNavalUnits, defenderStart: defenderNavalUnits, rngSeed: rng.getSeed() };
      return applyBattleOutcome({ ...state, resources: applyCosts(state.resources, costs) }, makeBattleOutcome({ ...meta, id: battleIdOf(state, { ...meta, seed: rng.getSeed() }) }, battle));
    }

    case ActionTypes.SUPPRESS_REBELLION: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.suppressRebellion;
      if (!region || region.owner !== state.playerNationId) return state;
      const rebelUnits = Object.values(state.units).filter(u => u.regionId === regionId && u.ownerId === REBEL_OWNER_ID);
      if (rebelUnits.length === 0) return state;
      const garrisonUnits = Object.values(state.units).filter(u => u.regionId === regionId && u.ownerId === state.playerNationId && u.domain === 'land');
      if (garrisonUnits.length === 0) return state;
      // Plan §M14: one attack per stack per turn — suppressing a rebellion is an attack too.
      if (!garrisonUnits.every(u => (u.movesLeft ?? 1) > 0)) return state;
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, {
        attackerUnits: garrisonUnits,
        defenderUnits: rebelUnits,
        terrain: getRegionTerrain(regionId, REGIONS_DATA),
        isAttackingFortification: false,
        generals: state.hiredCommanders,
        attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
        defenderAgeId: state.age
      }, { kind: 'suppress' }, rng);
      // The rebels are fought like any battle (master plan 6.7 row 17), through the outcome service.
      const meta = { kind: 'suppress', warId: null, attackerNationId: state.playerNationId, defenderNationId: REBEL_OWNER_ID, fromRegionId: regionId, regionId, tile: region.tile ?? null, rngSeed: rng.getSeed() };
      return applyBattleOutcome({ ...state, resources: applyCosts(state.resources, costs) }, makeBattleOutcome({ ...meta, id: battleIdOf(state, { ...meta, seed: rng.getSeed() }) }, battle));
    }

    // Research (src/engine/research.js): choosing a tech sets it as the target (its missing earlier
    // techs are queued first); science pays for it turn by turn in resolveTurn. Nothing is spent here.
    case ActionTypes.RESEARCH_TECH: {
      const { techId } = action.payload;
      if (!TECH_TREE[techId] || state.techTree[techId]?.researched) return state;
      const researched = new Set(Object.keys(state.techTree).filter((id) => state.techTree[id]?.researched));
      const research = chooseResearch(state.research || emptyResearch(), techId, researched);
      if (research === state.research) return state;
      return { ...state, research, logs: [...state.logs, { year: state.year, message: `Now researching ${TECH_TREE[research.current]?.name}${research.queue.length ? `, then ${research.queue.map((id) => TECH_TREE[id]?.name).join(', ')}` : ''}.`, type: LogTypes.TECH }] };
    }

    case ActionTypes.QUEUE_RESEARCH: {
      const { techId } = action.payload;
      if (!TECH_TREE[techId] || state.techTree[techId]?.researched) return state;
      const researched = new Set(Object.keys(state.techTree).filter((id) => state.techTree[id]?.researched));
      const research = queueResearch(state.research || emptyResearch(), techId, researched);
      return research === state.research ? state : { ...state, research };
    }

    case ActionTypes.UNQUEUE_RESEARCH: {
      const { techId } = action.payload;
      const current = state.research || emptyResearch();
      // Removing the current tech moves the queue up (its progress is kept for later).
      if (current.current === techId) return { ...state, research: unqueueResearch({ ...current, current: current.queue[0] || null, queue: current.queue.slice(1) }, techId) };
      return { ...state, research: unqueueResearch(current, techId) };
    }

    case ActionTypes.SET_RESEARCH_AUTO: {
      return { ...state, research: { ...(state.research || emptyResearch()), auto: action.payload?.auto === true } };
    }

    case ActionTypes.SET_RESEARCH_FOCUS: {
      const { categoryId } = action.payload;
      const costs = ACTION_COSTS.setResearchFocus;
      if (!Object.values(TechCategories).includes(categoryId)) return state;
      if (state.researchFocus === categoryId) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        researchFocus: categoryId,
        logs: [...state.logs, { year: state.year, message: `Research focus set to ${categoryId}.`, type: LogTypes.TECH }]
      };
    }

    case ActionTypes.FUND_SCHOLARS: {
      const costs = ACTION_COSTS.fundScholars;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: { ...applyCosts(state.resources, costs), techPoints: (state.resources.techPoints || 0) + FUND_SCHOLARS_TECHPOINTS },
        logs: [...state.logs, { year: state.year, message: `Funded scholars for +${FUND_SCHOLARS_TECHPOINTS} tech points.`, type: LogTypes.TECH }]
      };
    }

    case ActionTypes.CHANGE_GOVERNMENT_TYPE: {
      const { typeId } = action.payload;
      const type = GOVERNMENT_TYPES[typeId];
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.changeGovernmentType;
      if (!type || !canChangeGovernmentType(nation, typeId, state.age)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            government: { type: typeId, reforms: resetReformsForType(typeId, state.age) },
            stability: clampStability((nation.stability || 0) - 2)
          }
        },
        logs: [...state.logs, { year: state.year, message: `Your empire has become a ${type.name}. (-2 stability)`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.ENACT_GOVERNMENT_REFORM: {
      const { ageId, reformId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.enactGovernmentReform;
      if (!canEnactReform(nation, ageId, reformId, state.age)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const reform = getReformChoices(nation.government.type, ageId).find((r) => r.id === reformId);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...nation, government: { ...nation.government, reforms: { ...nation.government.reforms, [ageId]: reformId } } }
        },
        logs: [...state.logs, { year: state.year, message: `Enacted the ${reform.name} reform.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.CHANGE_LAW: {
      const { category, lawId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const law = getLaw(category, lawId);
      if (!law || !canEnactLaw(state, state.playerNationId, category, lawId)) return state;
      const costs = { adm: getLawChangeCost(state, state.playerNationId, category, lawId) };
      if (!canAfford(state.resources, costs)) return state;

      // Plan §M8.2: two law tiers apply a one-shot effect on top of their ongoing `effects` —
      // Collectivization pushes a real 10-turn timed modifier (plan §A.2's nation.modifiers[]),
      // Martial Law costs a permanent -1 stability the instant it's enacted.
      let modifiers = nation.modifiers || [];
      let stability = nation.stability || 0;
      if (lawId === 'collectivization') {
        modifiers = [...modifiers, {
          id: `collectivization_${state.turnNumber}`,
          sourceType: 'law',
          sourceId: 'collectivization',
          label: 'Collectivization',
          mods: { 'national.stabilityBonus': COLLECTIVIZATION_UNREST_MODIFIER },
          expiresTurn: state.turnNumber + COLLECTIVIZATION_UNREST_TURNS
        }];
      } else if (lawId === 'martial_law') {
        stability = clampStability(stability - 1);
      }

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            laws: { ...nation.laws, [category]: lawId },
            lawCooldowns: { ...nation.lawCooldowns, [category]: state.turnNumber + LAW_CHANGE_COOLDOWN_TURNS },
            modifiers,
            stability
          }
        },
        logs: [...state.logs, { year: state.year, message: `Enacted the ${law.name} law.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.SHIFT_IDENTITY: {
      const { axis, direction } = action.payload;
      const nation = state.nations[state.playerNationId];
      const axisSpec = IDENTITY_AXES[axis];
      const costs = ACTION_COSTS.shiftIdentity;
      if (!axisSpec || (direction !== 1 && direction !== -1)) return state;
      if ((state.turnNumber || 0) < (nation.identityShiftCooldownTurn || 0)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const currentValue = nation.identity?.[axis] || 0;
      const nextValue = clampIdentity(currentValue + direction * IDENTITY_SHIFT_STEP);
      if (nextValue === currentValue) return state;
      const poleName = direction > 0 ? axisSpec.positivePole : axisSpec.negativePole;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            identity: { ...nation.identity, [axis]: nextValue },
            identityShiftCooldownTurn: state.turnNumber + IDENTITY_SHIFT_COOLDOWN_TURNS
          }
        },
        logs: [...state.logs, { year: state.year, message: `Your nation leans further ${poleName}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DECLARE_WAR: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const player = state.nations[state.playerNationId];
      // Plan §M12/§M15: "a vassal... can't declare wars except independence" — DECLARE_INDEPENDENCE
      // below is the one exception, and it doesn't go through this case.
      // A nation already fighting someone else can still be attacked — only a second war against the
      // same enemy is refused.
      if (!target || nationId === state.playerNationId || isAtWarWithPlayer(state, nationId) || player?.vassalOf) return state;
      const justified = hasCasusBelli(state, state.playerNationId, nationId);
      const costs = justified ? ACTION_COSTS.declareWarJustified : ACTION_COSTS.declareWarUnjustified;
      if (!canAfford(state.resources, costs)) return state;

      // Truce-breaking (plan §M12/M13): the player MAY declare anyway — unlike the AI, which
      // pickWarTarget filters out entirely (aiLogic.js) — but pays a real price: home stability,
      // prestige, and AE with every neighbor, as if this were the most aggressive kind of war.
      const breakingTruce = isInTruce(state, state.playerNationId, nationId);
      const playerAfterTruceBreak = breakingTruce
        ? {
            ...player,
            stability: clampStability((player.stability || 0) - TRUCE_BREAK_STABILITY_PENALTY),
            prestige: clampPrestige((player.prestige || 0) - TRUCE_BREAK_PRESTIGE_PENALTY),
            truces: { ...(player.truces || {}), [nationId]: 0 }
          }
        : player;
      let stateBeforeWar = breakingTruce
        ? { ...state, nations: { ...state.nations, [state.playerNationId]: playerAfterTruceBreak, [nationId]: { ...target, truces: { ...(target.truces || {}), [state.playerNationId]: 0 } } } }
        : state;
      if (breakingTruce) {
        const neighborIds = getBorderingNationIds(state.regions, state.playerNationId);
        const nextNations = { ...stateBeforeWar.nations };
        neighborIds.forEach((id) => {
          if (id === nationId) return;
          const neighbor = nextNations[id];
          if (!neighbor) return;
          nextNations[id] = { ...neighbor, ae: { ...(neighbor.ae || {}), [state.playerNationId]: (neighbor.ae?.[state.playerNationId] || 0) + TRUCE_BREAK_AE_AGAINST_NEIGHBORS } };
        });
        stateBeforeWar = { ...stateBeforeWar, nations: nextNations };
      }

      const afterWar = declareWar(stateBeforeWar, nationId, { aggressor: state.playerNationId });
      const homeRegionId = getCapital(afterWar, state.playerNationId);
      const homeRegion = afterWar.regions[homeRegionId];
      const nextNations = { ...afterWar.nations };
      let nextRegions = afterWar.regions;
      if (!justified) {
        // Unjustified aggression costs stability at home and relations with everyone else — the
        // plan's own framing, not just a bigger gold bill.
        nextRegions = { ...afterWar.regions, [homeRegionId]: { ...homeRegion, unrest: Math.min(100, (homeRegion.unrest || 0) + UNJUSTIFIED_WAR_HOME_UNREST) } };
        Object.keys(nextNations).forEach(id => {
          if (id === state.playerNationId || id === nationId) return;
          nextNations[id] = { ...nextNations[id], hostility: Math.min(100, (nextNations[id].hostility || 0) + UNJUSTIFIED_WAR_GLOBAL_HOSTILITY) };
        });
      }

      return {
        ...afterWar,
        resources: applyCosts(state.resources, costs),
        nations: nextNations,
        regions: nextRegions,
        logs: [...afterWar.logs, {
          year: state.year,
          message: breakingTruce
            ? `You broke your truce with ${target.name} to declare war! (-${TRUCE_BREAK_STABILITY_PENALTY} stability, -${TRUCE_BREAK_PRESTIGE_PENALTY} prestige, neighbors take note)`
            : justified ? `You declared a justified war on ${target.name}.` : `You declared an unjustified war on ${target.name} — the world takes note.`,
          type: LogTypes.DIPLOMACY
        }]
      };
    }

    case ActionTypes.FABRICATE_CLAIM: {
      // Claims are on cities (claims.js): `cityId`, or the nearest claimable city of `nationId`.
      const { nationId, cityId } = action.payload;
      const player = state.nations[state.playerNationId];
      const city = cityId ? state.regions[cityId] : claimableCities(state, state.playerNationId, nationId)[0]?.city;
      if (!city || !canFabricateClaim(state, state.playerNationId, city.id).ok) return state;
      const costs = ACTION_COSTS.fabricateClaim;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: startClaim(player, city.id, state.turnNumber) },
        logs: [...state.logs, { year: state.year, message: `Your agents start fabricating a claim on ${city.name} (${state.nations[city.owner]?.name || city.owner}): ready in ${CLAIM_FABRICATE_TURNS} turns.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.SUE_FOR_PEACE: {
      // Plan §M13: kept as a white-peace alias (no cede/gold/reparations/humiliate/vassalize terms)
      // rather than removed outright — routes through the same applyPeace/setTruce path OFFER_PEACE
      // uses below, so it now also liberates any occupied regions and starts a truce (a real
      // pre-existing gap: the old version of this case never called setTruce at all).
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target || !target.isAtWar) return state;
      const war = state.wars.find(w => w.active && isWarBetween(w, state.playerNationId, nationId));
      if (!war) return state;
      const costs = { gold: Math.max(SUE_FOR_PEACE_MIN_GOLD, Math.round(SUE_FOR_PEACE_BASE_GOLD - target.warExhaustion * 2)), dip: 1 };
      if (!canAfford(state.resources, costs)) return state;
      const applied = applyPeace(state, war, state.playerNationId, []);
      const player = applied.nations[state.playerNationId];
      const targetAfter = applied.nations[nationId];
      let nextNations = {
        ...applied.nations,
        // The war record names an aggressor and an enemy, not "the player's side" — an AI could
        // have declared this war on the player just as easily as the reverse, and either way the
        // player's own isAtWar must clear too, or they'd be permanently immune to any FUTURE war
        // declaration (aiLogic.js's pickWarTarget filters out any nation still flagged isAtWar).
        [state.playerNationId]: { ...player, isAtWar: false },
        [nationId]: { ...targetAfter, isAtWar: false, hasPeaceTreaty: true, hostility: Math.min(targetAfter.hostility, 50), relationStatus: RelationStatus.COLD_PEACE }
      };
      nextNations = setTruce(nextNations, war.aggressor, war.enemy, state.turnNumber);
      return {
        ...state,
        resources: applyCosts(applied.resources, costs),
        regions: applied.regions,
        // The two sides may still be fighting other wars — isAtWar follows the live wars list.
        nations: refreshWarFlags(nextNations, endWar(state.wars, war.id), [war.aggressor, war.enemy]),
        wars: endWar(state.wars, war.id),
        logs: [...state.logs, { year: state.year, message: `Signed a peace treaty with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.OFFER_PEACE: {
      // Plan §M13: negotiated peace with real terms — the AI recipient accepts iff its own
      // acceptance ledger (src/engine/peace.js) covers the terms' combined war-score cost.
      const { warId, terms = [] } = action.payload;
      const war = state.wars.find(w => w.id === warId && w.active);
      if (!war || (war.aggressor !== state.playerNationId && war.enemy !== state.playerNationId)) return state;
      const recipientId = war.aggressor === state.playerNationId ? war.enemy : war.aggressor;
      const recipient = state.nations[recipientId];
      if (!recipient) return state;
      const acceptance = getPeaceAcceptance(state, war, state.playerNationId, terms);
      if (!acceptance.accepted) {
        return { ...state, logs: [...state.logs, { year: state.year, message: `${recipient.name} rejects your peace terms.`, type: LogTypes.DIPLOMACY }] };
      }
      const applied = applyPeace(state, war, state.playerNationId, terms);
      const winner = applied.nations[state.playerNationId];
      const loser = applied.nations[recipientId];
      let nextNations = {
        ...applied.nations,
        [state.playerNationId]: { ...winner, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE },
        [recipientId]: { ...loser, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE }
      };
      nextNations = setTruce(nextNations, war.aggressor, war.enemy, state.turnNumber);
      return {
        ...state,
        resources: applied.resources,
        regions: applied.regions,
        // The two sides may still be fighting other wars — isAtWar follows the live wars list.
        nations: refreshWarFlags(nextNations, endWar(state.wars, war.id), [war.aggressor, war.enemy]),
        wars: endWar(state.wars, war.id),
        logs: [...state.logs, { year: state.year, message: `Peace signed with ${recipient.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.ACCEPT_PENDING_PEACE: {
      // Plan §M13: the player accepting an AI's own OFFER_PEACE-equivalent (queued into
      // state.pendingPeaceOffer by resolveWarProgress once the AI is winning enough to demand terms).
      const offer = state.pendingPeaceOffer;
      if (!offer) return state;
      const war = state.wars.find(w => w.id === offer.warId && w.active);
      if (!war) return { ...state, pendingPeaceOffer: null };
      const recipientId = offer.from === war.aggressor ? war.enemy : war.aggressor;
      const applied = applyPeace(state, war, offer.from, offer.terms);
      const winner = applied.nations[offer.from];
      const loser = applied.nations[recipientId];
      let nextNations = {
        ...applied.nations,
        [offer.from]: { ...winner, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE },
        [recipientId]: { ...loser, isAtWar: false, hasPeaceTreaty: true, relationStatus: RelationStatus.COLD_PEACE }
      };
      nextNations = setTruce(nextNations, war.aggressor, war.enemy, state.turnNumber);
      return {
        ...state,
        resources: applied.resources,
        regions: applied.regions,
        // The two sides may still be fighting other wars — isAtWar follows the live wars list.
        nations: refreshWarFlags(nextNations, endWar(state.wars, war.id), [war.aggressor, war.enemy]),
        wars: endWar(state.wars, war.id),
        pendingPeaceOffer: null,
        logs: [...state.logs, { year: state.year, message: `You accept peace with ${nextNations[offer.from]?.name || offer.from}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.REJECT_PENDING_PEACE: {
      const offer = state.pendingPeaceOffer;
      if (!offer) return state;
      return {
        ...state,
        pendingPeaceOffer: null,
        wars: state.wars.map(w => (w.id === offer.warId ? { ...w, peaceOfferCooldownTurn: state.turnNumber + PEACE_OFFER_COOLDOWN_TURNS } : w)),
        logs: [...state.logs, { year: state.year, message: `You reject ${state.nations[offer.from]?.name || offer.from}'s peace offer — they may ask again later.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.TRADE_AGREEMENT: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.tradeAgreement;
      if (!target || target.isAtWar || target.hasTradeAgreement) return state;
      // Trade Pact capacity (plan §M8.3/§M12) — Globalism/Isolationism identity swings it; see
      // diplomacy.js's getTradePactCapacity. Counts every OTHER nation currently pacted with the
      // player, since hasTradeAgreement lives on the target's own record.
      const activePactCount = Object.values(state.nations).filter((n) => n.hasTradeAgreement).length;
      if (activePactCount >= getTradePactCapacity(state.nations[state.playerNationId])) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hasTradeAgreement: true, relationStatus: RelationStatus.FRIENDLY } },
        logs: [...state.logs, { year: state.year, message: `Signed a trade agreement with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.OPEN_BORDERS: {
      // Open borders (accords.js): the AI accepts at OPEN_BORDERS_OPINION; the offer costs either way.
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.openBorders;
      if (!target || target.isEliminated || nationId === state.playerNationId || hasOpenBorders(state, state.playerNationId, nationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const answer = openBordersAcceptance(state, nationId);
      if (!answer.accepted) {
        return { ...state, resources: applyCosts(state.resources, costs), logs: [...state.logs, { year: state.year, message: `${target.name} keeps its borders closed to you (opinion ${answer.opinion}, needs ${answer.needed}${answer.atWar ? ', and you are at war' : ''}).`, type: LogTypes.DIPLOMACY }] };
      }
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: setOpenBorders(state.nations, state.playerNationId, nationId, true),
        logs: [...state.logs, { year: state.year, message: `${target.name} opens its borders: your armies, settlers and traders may cross its land, and theirs yours.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.CLOSE_BORDERS: {
      const { nationId } = action.payload;
      if (!state.nations[nationId] || !hasOpenBorders(state, state.playerNationId, nationId)) return state;
      return { ...state, nations: setOpenBorders(state.nations, state.playerNationId, nationId, false), logs: [...state.logs, { year: state.year, message: `You close your borders with ${state.nations[nationId].name}.`, type: LogTypes.DIPLOMACY }] };
    }

    case ActionTypes.DEMAND: {
      // Demands (accords.js): tribute, a claimed city, or a stop to settling near you.
      const { nationId, kind, cityId = null } = action.payload;
      const costs = ACTION_COSTS.demand;
      if (!state.nations[nationId] || nationId === state.playerNationId || !DEMANDS[kind]) return state;
      if (!canAfford(state.resources, costs)) return state;
      const r = applyDemand(state, nationId, kind, cityId);
      if (r.state === state) return state;
      return { ...r.state, resources: applyCosts(r.state.resources, costs), logs: [...r.state.logs, { year: state.year, message: r.message, type: LogTypes.DIPLOMACY }] };
    }

    case ActionTypes.MILITARY_ALLIANCE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.militaryAlliance;
      if (!target || isAtWarWithPlayer(state, nationId) || target.hasMilitaryPact) return state;
      // Alliance acceptance (plan §M12: "opinion/4 + prestige/10 ... accept if > 0"), adapted onto
      // this codebase's real axes: hostility stands in for opinion (inverted, since 50 is neutral
      // on a 0-100 hostility scale the way 0 is neutral on a signed opinion scale), and an existing
      // trade agreement is a flat vote of confidence — replacing the old flat hostility-ceiling
      // gate with a real scored formula.
      // Prestige is the ASKER's (the player's) standing — the formula used to read the target's own.
      const acceptanceScore = (50 - (target.hostility || 0)) / 2 + (state.nations[state.playerNationId]?.prestige || 0) / 10 + (target.hasTradeAgreement ? 20 : 0);
      if (acceptanceScore < 0) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hasMilitaryPact: true, relationStatus: RelationStatus.ALLIED } },
        logs: [...state.logs, { year: state.year, message: `Formed a military alliance with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.GIFT_BRIBE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.giftBribe;
      if (!target) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - GIFT_HOSTILITY_REDUCTION) } },
        logs: [...state.logs, { year: state.year, message: `Sent a gift to ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    // Espionage/Counter-Intelligence (types.js's header on this pair): a real coin-flip covert
    // operation against a chosen nation, and a real defensive action that catches whoever's
    // currently most hostile toward you — see ESPIONAGE_SUCCESS_CHANCE etc., actionCosts.js.
    case ActionTypes.ESPIONAGE: {
      // Plan §M12: "Steal Tech, Sabotage Reputation, Support Rebels" — Steal Tech is the original,
      // unchanged behavior (default `type`, so every existing caller keeps working). Support
      // Rebels is real and new: it directly raises unrest in one of the target's own regions,
      // reusing the same unrest/rebellion mechanic resolveTurn.js already runs — defaulting to
      // their capital when no regionId is given, the same auto-target convenience Counter-
      // Intelligence already uses. Sabotage Reputation is deferred (actionCosts.js's own header on
      // why: no pairwise AI-AI opinion substrate exists to damage).
      const { nationId, type = 'steal_tech', regionId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.espionage;
      if (!target) return state;
      if (!canAfford(state.resources, costs)) return state;
      const rng = createRng(state.rngSeed);
      const success = rng.next() < ESPIONAGE_SUCCESS_CHANCE;
      const resourcesAfterCost = applyCosts(state.resources, costs);
      if (success) {
        // Every successful op leaves agents in place: the target's provinces become visible.
        const intel = grantIntel(state, nationId);
        if (type === 'gather_intel') {
          return {
            ...state,
            resources: resourcesAfterCost,
            intel,
            rngSeed: rng.getSeed(),
            logs: [...state.logs, { year: state.year, message: `Your agents mapped ${target.name}'s provinces — their armies, buildings and resources are visible for ${INTEL_DURATION_TURNS} turns.`, type: LogTypes.DIPLOMACY }]
          };
        }
        if (type === 'support_rebels') {
          const targetRegionId = regionId && state.regions[regionId]?.owner === nationId ? regionId : getCapital(state, nationId);
          const targetRegion = state.regions[targetRegionId];
          if (!targetRegion) return state;
          return {
            ...state,
            resources: resourcesAfterCost,
            regions: { ...state.regions, [targetRegionId]: { ...targetRegion, unrest: Math.min(100, (targetRegion.unrest || 0) + ESPIONAGE_SUPPORT_REBELS_UNREST_INCREASE) } },
            intel,
            rngSeed: rng.getSeed(),
            logs: [...state.logs, { year: state.year, message: `Your agents stirred unrest in ${REGIONS_DATA[targetRegionId]?.name || targetRegionId}.`, type: LogTypes.DIPLOMACY }]
          };
        }
        return {
          ...state,
          resources: { ...resourcesAfterCost, techPoints: (resourcesAfterCost.techPoints || 0) + ESPIONAGE_TECH_POINTS_STOLEN },
          intel,
          rngSeed: rng.getSeed(),
          logs: [...state.logs, { year: state.year, message: `Your agents stole technological secrets from ${target.name}. +${ESPIONAGE_TECH_POINTS_STOLEN} Tech Points.`, type: LogTypes.DIPLOMACY }]
        };
      }
      return {
        ...state,
        resources: resourcesAfterCost,
        nations: { ...state.nations, [nationId]: { ...target, hostility: Math.min(100, target.hostility + ESPIONAGE_FAILURE_HOSTILITY_INCREASE) } },
        rngSeed: rng.getSeed(),
        logs: [...state.logs, { year: state.year, message: `Your spies were caught in ${target.name}! Relations have soured.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.COUNTER_INTELLIGENCE: {
      const costs = ACTION_COSTS.counterIntelligence;
      if (!canAfford(state.resources, costs)) return state;
      const candidates = Object.values(state.nations).filter(n => !n.isPlayer);
      if (candidates.length === 0) return state;
      const target = candidates.reduce((max, n) => (n.hostility > max.hostility ? n : max), candidates[0]);
      const resourcesAfterCost = applyCosts(state.resources, costs);
      return {
        ...state,
        resources: { ...resourcesAfterCost, dip: (resourcesAfterCost.dip || 0) + COUNTER_INTEL_DIPLOMACY_POINTS_REWARD },
        nations: { ...state.nations, [target.id]: { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - COUNTER_INTEL_HOSTILITY_REDUCTION) } },
        logs: [...state.logs, { year: state.year, message: `Your counter-intelligence service uncovered a plot by ${target.name}. Hostility reduced, +${COUNTER_INTEL_DIPLOMACY_POINTS_REWARD} DIP.`, type: LogTypes.DIPLOMACY }]
      };
    }

    // Diplomacy overhaul (plan §M12) — rivals, royal marriages, alliance lifecycle, diplomats,
    // and the vassal lifecycle. See types.js's own header comment on this group for scope notes.
    case ActionTypes.RIVAL_NATION: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      if (!target || nationId === state.playerNationId) return state;
      if ((player.rivals || []).includes(nationId)) return state;
      if ((player.rivals || []).length >= MAX_RIVALS) return state;
      if (!getBorderingNationIds(state.regions, state.playerNationId).includes(nationId)) return state;
      return {
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...player, rivals: [...(player.rivals || []), nationId] } },
        logs: [...state.logs, { year: state.year, message: `${target.name} is now considered a rival.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.UNRIVAL_NATION: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      if (!(player.rivals || []).includes(nationId)) return state;
      return {
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...player, rivals: player.rivals.filter((id) => id !== nationId) } }
      };
    }

    case ActionTypes.PROPOSE_MARRIAGE: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.proposeMarriage;
      if (!target || target.isAtWar) return state;
      // Plan: "both monarchies".
      if (player.government?.type !== 'monarchy' || target.government?.type !== 'monarchy') return state;
      if ((player.marriageWith || []).includes(nationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextTarget = { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - MARRIAGE_HOSTILITY_REDUCTION) };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...player, marriageWith: [...(player.marriageWith || []), nationId] }, [nationId]: nextTarget },
        logs: [...state.logs, { year: state.year, message: `A royal marriage binds your house to ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.BREAK_ALLIANCE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target || !target.hasMilitaryPact) return state;
      return {
        ...state,
        nations: { ...state.nations, [nationId]: { ...target, hasMilitaryPact: false, hostility: Math.min(100, (target.hostility || 0) + BREAK_ALLIANCE_HOSTILITY_INCREASE) } },
        logs: [...state.logs, { year: state.year, message: `You broke the military alliance with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.INSULT: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target) return state;
      return {
        ...state,
        nations: { ...state.nations, [nationId]: { ...target, hostility: Math.min(100, (target.hostility || 0) + INSULT_HOSTILITY_INCREASE) } },
        logs: [...state.logs, { year: state.year, message: `You publicly insulted ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.ASSIGN_DIPLOMAT: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.assignDiplomat;
      if (!target || nationId === state.playerNationId) return state;
      const tasks = player.diplomatTasks || [];
      if (tasks.some((t) => t.targetId === nationId)) return state;
      if (tasks.length >= (player.diplomats || 0)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, diplomatTasks: [...tasks, { targetId: nationId, task: 'improve_relations', startedTurn: state.turnNumber }] }
        },
        logs: [...state.logs, { year: state.year, message: `A diplomat was sent to improve relations with ${target.name}.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.RECALL_DIPLOMAT: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const tasks = player.diplomatTasks || [];
      if (!tasks.some((t) => t.targetId === nationId)) return state;
      return {
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...player, diplomatTasks: tasks.filter((t) => t.targetId !== nationId) } }
      };
    }

    case ActionTypes.VASSALIZE: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.vassalize;
      if (!canSubjugate(state.nations, state.playerNationId, nationId) || target.isAtWar) return state;
      if ((target.hostility || 0) > VASSALIZE_HOSTILITY_CEILING) return state;
      // Plan §M16: real fielded strength (+ damped garrison), not the abstract number alone — see
      // src/engine/aiEconomy.js's getEffectiveMilitaryPower and peace.js's own use of the same metric.
      if (getEffectiveMilitaryPower(state, state.playerNationId) < getEffectiveMilitaryPower(state, nationId) * VASSALIZE_STRENGTH_RATIO) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, vassals: [...(player.vassals || []), nationId] },
          [nationId]: { ...target, vassalOf: state.playerNationId, vassalizedTurn: state.turnNumber }
        },
        logs: [...state.logs, { year: state.year, message: `${target.name} has become your vassal.`, type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.ANNEX_VASSAL: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      if (!target || target.vassalOf !== state.playerNationId) return state;
      if (state.turnNumber < (target.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS) return state;
      const totalDev = Object.values(state.regions).reduce((sum, r) => sum + (r.owner === nationId ? getTotalDev(r) : 0), 0);
      const costs = { dip: Math.round(VASSAL_ANNEX_DIP_PER_DEV * totalDev) };
      if (!canAfford(state.resources, costs)) return state;
      const nextRegions = { ...state.regions };
      Object.keys(nextRegions).forEach((regionId) => {
        if (nextRegions[regionId].owner === nationId) nextRegions[regionId] = transferRegion(nextRegions[regionId], state.playerNationId, state.nations).region;
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: Object.fromEntries(Object.entries(state.units).map(([id,u])=>[id,u.ownerId===nationId?{...u,ownerId:state.playerNationId}:u])),
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, vassals: player.vassals.filter((id) => id !== nationId) },
          [nationId]: { ...target, vassalOf: null, vassals: [], isEliminated: true, isAtWar: false, capitalRegionId: null }
        },
        logs: [...state.logs, { year: state.year, message: `${target.name} has been annexed into your realm.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.RELEASE_VASSAL: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      if (!target || target.vassalOf !== state.playerNationId) return state;
      return {
        ...state,
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, vassals: player.vassals.filter((id) => id !== nationId) },
          [nationId]: { ...target, vassalOf: null }
        },
        logs: [...state.logs, { year: state.year, message: `${target.name} has been released from vassalage.`, type: LogTypes.DIPLOMACY }]
      };
    }

    // Crises & defeat (plan §M15). Move Capital: a deliberate, costly relocation to any owned,
    // unoccupied region — the plan's own "-1 stability if outside the original start regions" reuses
    // REGIONS_DATA[id].startOwner, the same "is this the nation's own native soil" test
    // getFormerOwnerOnConquest (rebellion.js) already applies for conquered-territory purposes.
    case ActionTypes.MOVE_CAPITAL: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const player = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.moveCapital;
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (regionId === getCapital(state, state.playerNationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const isForeignSoil = REGIONS_DATA[regionId]?.startOwner !== state.playerNationId;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...player,
            capitalRegionId: regionId,
            stability: isForeignSoil ? clampStability((player.stability || 0) - MOVE_CAPITAL_FOREIGN_STABILITY_PENALTY) : player.stability
          }
        },
        logs: [...state.logs, {
          year: state.year,
          message: `The capital has moved to ${REGIONS_DATA[regionId]?.name || regionId}.${isForeignSoil ? ' (-1 stability)' : ''}`,
          type: LogTypes.MILESTONE
        }]
      };
    }

    // A vassal's own path out of subjection (plan §M12/§M15) — the one war DECLARE_WAR's own
    // vassalOf guard above still allows. Winning is resolved entirely inside resolveWarProgress
    // (src/engine/diplomacy.js's own 'independence' cb branch), not here; this only opens the war.
    case ActionTypes.DECLARE_INDEPENDENCE: {
      const player = state.nations[state.playerNationId];
      const overlordId = player?.vassalOf;
      const overlord = overlordId ? state.nations[overlordId] : null;
      if (!overlord || player.isAtWar || (player.libertyDesire || 0) < LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD) return state;
      const afterWar = declareWar(state, overlordId, { aggressor: state.playerNationId, goal: { type: 'independence' } });
      if (afterWar === state) return state;
      const wars = [...afterWar.wars];
      wars[wars.length - 1] = { ...wars[wars.length - 1], cb: 'independence' };
      return {
        ...afterWar,
        wars,
        logs: [...afterWar.logs, { year: state.year, message: `${player.name} declares independence from ${overlord.name}!`, type: LogTypes.DIPLOMACY }]
      };
    }

    // Plan §M18: "Continue playing after victory" — only valid for an AMBITION win reached BEFORE
    // the calendar's own end (year < END_YEAR); the END_YEAR ranked ending (finalScore) is the
    // real, final game-over and has nothing left to continue toward. Records the condition in
    // victoriesAchieved so checkVictoryConditions (still true every later turn, since the region/
    // GDP/streak/etc. threshold that was met usually stays met) doesn't immediately re-fire the
    // SAME victory the very next turn.
    case ActionTypes.CONTINUE_AFTER_VICTORY: {
      if (state.gameStatus !== GameStatus.VICTORY || state.year >= END_YEAR) return state;
      const conditionId = state.victoryConditionId;
      return {
        ...state,
        gameStatus: GameStatus.ACTIVE,
        victoryConditionId: null,
        victoriesAchieved: [...(state.victoriesAchieved || []), conditionId],
        logs: [...state.logs, { year: state.year, message: 'You choose to continue your reign.', type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.PROMOTE_UNIT: {
      const { unitId, perkId } = action.payload;
      const unit = state.units[unitId];
      const costs = ACTION_COSTS.promoteUnit;
      if (!unit || unit.ownerId !== state.playerNationId) return state;
      if (!canPromote(unit)) return state;
      const perk = getPerk(perkId);
      if (!perk || (unit.promotions || []).includes(perkId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [unitId]: { ...unit, promotions: [...(unit.promotions || []), perkId] } },
        logs: [...state.logs, { year: state.year, message: `Your ${unit.classId} unit earned the ${perk.name} promotion.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.HIRE_GENERAL: {
      const costs = ACTION_COSTS.hireGeneral;
      if (!canAfford(state.resources, costs)) return state;
      const rng = createRng(state.rngSeed);
      const generalId = `general_${state.nextCommanderSeq}`;
      const general = generateGeneral(rng, generalId, state.playerNationId);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        hiredCommanders: { ...state.hiredCommanders, [generalId]: general },
        nextCommanderSeq: state.nextCommanderSeq + 1,
        rngSeed: rng.getSeed(),
        logs: [...state.logs, { year: state.year, message: `${general.name} has joined your officer corps.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.APPOINT_GENERAL: {
      const { generalId, unitId } = action.payload;
      const general = state.hiredCommanders[generalId];
      const costs = ACTION_COSTS.appointGeneral;
      if (!general || general.nationId !== state.playerNationId) return state;
      if (unitId) {
        const unit = state.units[unitId];
        if (!unit || unit.ownerId !== state.playerNationId) return state;
      }
      if (!canAfford(state.resources, costs)) return state;

      const nextUnits = { ...state.units };
      // Vacate wherever this general was previously assigned before taking the new post.
      if (general.assignedUnitId && nextUnits[general.assignedUnitId]) {
        nextUnits[general.assignedUnitId] = { ...nextUnits[general.assignedUnitId], commanderId: null };
      }
      if (unitId) {
        nextUnits[unitId] = { ...nextUnits[unitId], commanderId: generalId };
      }

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        hiredCommanders: { ...state.hiredCommanders, [generalId]: { ...general, assignedUnitId: unitId || null } },
        logs: [...state.logs, {
          year: state.year,
          message: unitId ? `${general.name} took command of a unit.` : `${general.name} was recalled from the field.`,
          type: LogTypes.ACTION
        }]
      };
    }

    case ActionTypes.ADD_LOG:
      return {
        ...state,
        logs: [...state.logs, { year: state.year, message: action.payload.message, type: action.payload.type || LogTypes.ACTION }]
      };

    case ActionTypes.LOAD_GAME: {
      const fresh = createInitialState();
      const incoming = action.payload || {};
      return { ...fresh, ...incoming, gameStatus: incoming.gameStatus || GameStatus.ACTIVE };
    }

    // Settling frontier land is a colony that grows over turns (plan §4h, colonies.js).
    // FRONTIER_EXPEDITION is the older name, kept for saved actions: it founds a colony that
    // lives alongside the natives.
    case ActionTypes.FRONTIER_EXPEDITION:
    case ActionTypes.FOUND_COLONY: {
      const regionId = action.payload?.regionId ?? action.payload?.targetRegionId;
      const v = validateColony(state, regionId);
      if (!v.ok) return reject(state, v.reason);
      return foundColony(state, regionId, action.payload?.policy || 'coexist');
    }

    case ActionTypes.ABANDON_COLONY:
      return abandonColony(state, action.payload?.regionId);

    // Cities (plans/civ-map-rework.md C1): production queue, focus, locks, buying tiles. All on
    // the player's own cities; the AI governor (workstream 9) drives the same functions.
    case ActionTypes.SAVE_ARMY_TEMPLATE: {
      // Army templates (armyTemplates.js): a named composition the cities build as one order.
      const { template } = action.payload || {};
      const ok = validateTemplate(template, getEffectiveAgeId(state.age, state.techAgeId));
      if (!ok.ok) return reject(state, ok.reason);
      const me = state.nations[state.playerNationId];
      return { ...state, nations: { ...state.nations, [state.playerNationId]: saveTemplate(me, template, state.turnNumber) } };
    }
    case ActionTypes.HIRE_MERCENARY: {
      // A band from a mercantile or raiders independent (mercenaries.js, phase W2).
      const r = hireMercenaryForPlayer(state, action.payload?.independentId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.ANSWER_TRIBUTE_DEMAND: {
      // Pay an independent's tribute (no raids from it meanwhile) or refuse it (raids.js, phase W2).
      const { id, pay } = action.payload || {};
      return answerTributeDemand(state, id, !!pay);
    }
    // Phase W3 (indepPolicy.js, razing.js): influence, joining, tribute, trade and razing.
    case ActionTypes.GIFT_INDEPENDENT: {
      const r = giftIndependent(state, action.payload?.independentId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.PROPOSE_JOINING: {
      const r = proposeJoining(state, action.payload?.independentId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.ANSWER_JOIN_OFFER: {
      const { id, accept } = action.payload || {};
      return answerJoinOffer(state, id, !!accept);
    }
    case ActionTypes.DEMAND_INDEPENDENT_TRIBUTE: {
      const r = demandIndependentTribute(state, action.payload?.independentId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.PROPOSE_INDEPENDENT_TRADE: {
      const r = proposeIndependentTrade(state, action.payload?.independentId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.OFFER_INDEPENDENT_TRIBUTE: {
      // Phase W4: tribute paid unasked, for peace (indepPolicy.js).
      const r = offerIndependentTribute(state, action.payload?.independentId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.RAZE_CITY: {
      const why = canRaze(state, state.playerNationId, action.payload?.regionId);
      if (!why.ok) return reject(state, why.reason);
      const r = razeCityForPlayer(state, action.payload.regionId);
      return r.reason ? reject(state, r.reason) : r;
    }
    case ActionTypes.STOP_RAZING: {
      const regions = stopRazing(state, state.playerNationId, action.payload?.regionId);
      if (!regions) return state;
      return { ...state, regions, logs: [...state.logs, { year: state.year, message: `You stop the burning of ${regions[action.payload.regionId].name}.`, type: LogTypes.ACTION }] };
    }
    case ActionTypes.PILLAGE_TILE: {
      // The army sheet's pillage order (plan D6): a stack halted on an enemy tile with an
      // improvement burns it (threat.js pillageTile: the raid's gold, doubled by Chieftaincy) and
      // spends the stack's moves. Needs at least one unit with a move left.
      const { unitIds = [] } = action.payload || {};
      const mine = unitIds.map((id) => state.units[id]).filter((u) => u && u.ownerId === state.playerNationId && u.domain !== 'naval' && !u.embarkedOn && u.strength > 0);
      if (!mine.length || !mine.some((u) => (u.movesLeft ?? 0) > 0)) return state;
      const tile = unitTile(state, mine[0]);
      const enemies = new Set([REBEL_OWNER_ID, ...(state.wars || []).filter((w) => w.active && (w.aggressor === state.playerNationId || w.enemy === state.playerNationId)).map((w) => (w.aggressor === state.playerNationId ? w.enemy : w.aggressor))]);
      // An independent's land may be pillaged without a war; it holds a grudge (phase W2, grudges.js).
      const landOwner = tile == null ? null : state.regions[state.world?.tileOwner?.[tile]]?.owner;
      const independentLand = isIndependentNation(state.nations[landOwner]) && canAttack(state, state.playerNationId, landOwner);
      if (independentLand) enemies.add(landOwner);
      const raid = tile == null ? null : pillageTile(state, state.playerNationId, tile, enemies);
      if (!raid) return state;
      const units = { ...state.units };
      mine.forEach((u) => { units[u.id] = { ...u, movesLeft: 0, route: null }; });
      return {
        ...state,
        units,
        nations: independentLand ? addGrudge(state.nations, landOwner, state.playerNationId, GRUDGE_ATTACKED, { id: 'pillaged', turn: state.turnNumber }) : state.nations,
        world: { ...state.world, tileState: raid.tileState },
        resources: { ...state.resources, gold: (state.resources.gold || 0) + raid.gold },
        logs: [...state.logs, { year: state.year, message: `Your army pillages ${getTiles().names[tile] || 'the land'} of ${state.regions[raid.cityId]?.name || 'the enemy'}: +${raid.gold} gold.`, type: LogTypes.COMBAT }]
      };
    }
    case ActionTypes.RENAME_ARMY: {
      // The army sheet names a stack: every unit of it carries the same army tag from now on.
      const { unitIds = [], name } = action.payload || {};
      const label = (name || '').trim();
      const mine = unitIds.filter((id) => state.units[id]?.ownerId === state.playerNationId);
      if (!label || !mine.length) return state;
      const army = { id: `army_${state.turnNumber}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name: label };
      const units = { ...state.units };
      mine.forEach((id) => { units[id] = { ...units[id], army }; });
      return { ...state, units };
    }
    case ActionTypes.DELETE_ARMY_TEMPLATE: {
      const me = state.nations[state.playerNationId];
      return { ...state, nations: { ...state.nations, [state.playerNationId]: deleteTemplate(me, action.payload?.id) } };
    }
    case ActionTypes.QUEUE_PRODUCTION: {
      const { cityId: id, item: raw } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId || !raw) return reject(state, 'Not your city.');
      // An army order is expanded from its template here, so later edits never change a queued order.
      const template = raw.kind === 'army' ? templatesOf(state.nations[state.playerNationId]).find((t) => t.id === raw.templateId) : null;
      if (raw.kind === 'army' && !template) return reject(state, 'No such army template.');
      let item = template ? armyOrder(template, city, state.turnNumber) : raw;
      if (raw.kind === 'wonder') {
        // Wonders (wonders.js): the project's rules with the whole state, and the tile it takes.
        const can = canQueueWonder(state, city, raw.projectId, raw.tier || 1);
        if (!can.ok) return reject(state, can.reason);
        item = wonderItem(raw.projectId, raw.tier || 1, raw.tile ?? can.tile);
      }
      const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
      const ok = canQueue(city, getTiles(), world, item, { researched: Object.keys(state.techTree || {}).filter((t) => state.techTree[t]?.researched), ageId: getEffectiveAgeId(state.age, state.techAgeId) });
      if (!ok.ok) return reject(state, ok.reason);
      return { ...state, regions: { ...state.regions, [id]: queueItem(city, item) } };
    }
    case ActionTypes.SET_SETTLER_TARGET: {
      const { unitId, tile } = action.payload || {};
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== state.playerNationId || !isSettler(unit)) return reject(state, 'Not your settlers.');
      if (tile == null) return { ...state, units: { ...state.units, [unitId]: { ...unit, target: null } } };
      const can = canFoundCity({ cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} }, getTiles(), tile, state.playerNationId);
      if (!can.ok) return reject(state, can.reason);
      const path = settlerPath(state, unit.tile, tile, state.playerNationId);
      if (!path) return reject(state, 'No way there over land.');
      const turns = Math.ceil(path.length / SETTLER_MOVES);
      return { ...state, units: { ...state.units, [unitId]: { ...unit, target: tile } }, logs: [...state.logs, { year: state.year, message: `Settlers set out for ${getTiles().names[tile] || 'new land'}: ${turns} turn${turns === 1 ? '' : 's'}.`, type: 'action' }] };
    }
    case ActionTypes.FOUND_CITY: {
      const { unitId } = action.payload || {};
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== state.playerNationId || !isSettler(unit)) return reject(state, 'Not your settlers.');
      const can = canSettle(state, unit.tile, state.playerNationId, getEffectiveAgeId(state.age, state.techAgeId));
      if (!can.ok) return reject(state, can.reason);
      const founded = foundOutpost(state, state.regions, { tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} }, unit, state.turnNumber);
      if (!founded) return reject(state, 'This is no place for a city.');
      const units = { ...state.units }; delete units[unitId];
      return normalizeUnitTiles(syncWorldRegistry({ ...state, regions: founded.regions, world: { ...(state.world || {}), tileOwner: founded.world.tileOwner, tileState: founded.world.tileState }, units, logs: [...state.logs, { year: state.year, message: `${founded.city.name} is founded as an outpost.`, type: 'action' }] }));
    }
    case ActionTypes.DEQUEUE_PRODUCTION: {
      const { cityId: id, index } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, 'Not your city.');
      return { ...state, regions: { ...state.regions, [id]: dequeueItem(city, index || 0) } };
    }
    case ActionTypes.SET_CITY_FOCUS: {
      const { cityId: id, focus } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, 'Not your city.');
      const next = setFocus(city, focus);
      return next === city ? state : { ...state, regions: { ...state.regions, [id]: next } };
    }
    case ActionTypes.TOGGLE_TILE_LOCK: {
      const { cityId: id, tile } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId || !city.tiles.includes(tile)) return reject(state, 'Not your land.');
      return { ...state, regions: { ...state.regions, [id]: toggleLock(city, tile) } };
    }
    case ActionTypes.BUY_TILE: {
      const { cityId: id, tile } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, 'Not your city.');
      const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
      const candidate = claimCandidates(city, getTiles(), world, { ageId: getEffectiveAgeId(state.age, state.techAgeId) }).find((c) => c.tile === tile);
      if (!candidate) return reject(state, 'That tile cannot be claimed.');
      const cost = buyTileCost(city, candidate);
      if ((state.resources.gold || 0) < cost) return reject(state, `Needs ${cost} gold.`);
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        regions: { ...state.regions, [id]: { ...city, tiles: [...city.tiles, tile] } },
        world: { ...state.world, tileOwner: { ...(state.world?.tileOwner || {}), [tile]: id } }
      };
    }

    case ActionTypes.RESET_GAME: {
      // playerNationId/gameSpeed/difficultyId come from the start screen; doctrineId comes from
      // meta-progression localStorage via the component layer — see GameProvider.resetGame below.
      // This keeps gameReducer a pure function of (state, action).
      const { playerNationId, gameSpeed, doctrineId, difficultyId, scenario, rngSeed, guided, exploredWorld } = action.payload || {};
      const fresh = createInitialState({ playerNationId, gameSpeed, scenario, rngSeed, guided, fog: !exploredWorld });
      const withDoctrine = doctrineId ? applyStartingDoctrine(fresh, doctrineId) : fresh;
      return difficultyId ? applyDifficulty(withDoctrine, difficultyId) : withDoctrine;
    }

    case ActionTypes.MARK_TUTORIAL_STEP:
      return markTutorialStep(state, action.payload?.stepId);

    case ActionTypes.SET_AIR_PATROL: {
      // Patrol (airPower.js): the aircraft intercept enemy strikes within AIR_PATROL_RINGS of their base.
      const { unitIds = [], patrol = true } = action.payload || {};
      const mine = unitIds.filter((id) => state.units[id]?.ownerId === state.playerNationId && state.units[id].classId === 'air');
      if (!mine.length) return state;
      const units = { ...state.units };
      mine.forEach((id) => { units[id] = { ...units[id], patrol: !!patrol }; });
      return { ...state, units };
    }

    case ActionTypes.ANSWER_DEMAND: {
      // An AI's tribute demand (aiAccords.js): pay it or refuse and hand them a casus belli.
      const r = answerDemand(state, !!action.payload?.accept);
      return r.message ? { ...r.state, logs: [...r.state.logs, { year: state.year, message: r.message, type: LogTypes.DIPLOMACY }] } : r.state;
    }

    default:
      return state;
  }
};

// Re-exported so the Supabase edge bundle (scripts/build-edge-engine.mjs, whose entry point is
// this file) carries the save-migration layer automatically, without a separate bundling step —
// see src/engine/saveMigrations.js for why this exists and what it does.
export { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';

// Diplomacy needs contact (fog.js): these actions name a people in `payload.nationId`.
const CONTACT_ACTIONS = new Set([
  ActionTypes.DECLARE_WAR, ActionTypes.FABRICATE_CLAIM, ActionTypes.TRADE_AGREEMENT, ActionTypes.OPEN_BORDERS,
  ActionTypes.DEMAND, ActionTypes.MILITARY_ALLIANCE, ActionTypes.GIFT_BRIBE, ActionTypes.ESPIONAGE,
  ActionTypes.RIVAL_NATION, ActionTypes.PROPOSE_MARRIAGE, ActionTypes.INSULT, ActionTypes.ASSIGN_DIPLOMAT, ActionTypes.VASSALIZE
]);
// Actions after which the player's own sight is refreshed at once (an army moved, a city rose):
// exploring and meeting peoples happen as you move, not only at the end of the turn.
const NO_FOG_REFRESH = new Set([ActionTypes.ADVANCE_TURN, ActionTypes.FAST_FORWARD, ActionTypes.RESET_GAME, ActionTypes.LOAD_GAME]);

export const gameReducer = (state, action) => {
  // A turn the worker resolved from `from` (src/services/turnClient.js): taken only while the game
  // still stands at `from`, so an action taken meanwhile is never lost or doubled.
  if (action?.type === ActionTypes.APPLY_TURN_RESULT) {
    const { from, state: resolved } = action.payload || {};
    return from === state && resolved ? syncWorldRegistry(resolved) : state;
  }
  syncWorldRegistry(state);
  const target = action?.payload?.nationId;
  if (CONTACT_ACTIONS.has(action?.type) && target && state.nations?.[target] && !hasMet(state, state.playerNationId, target)) {
    return reject(state, 'You have not met that people yet: send scouts, armies or ships until you see their land.');
  }
  let next = reduceAction(state, action);
  // The battle queue fights itself on Auto (battleSettings.autoDefend) once no event, peace offer
  // or battle holds it (battleQueue.js): after a peace offer is answered, for instance.
  if (next !== state && next.pendingDefenses?.length) next = drainAutoBattles(next);
  if (next !== state && !NO_FOG_REFRESH.has(action?.type) && fogOn(next) && (next.units !== state.units || next.regions !== state.regions)) next = updateFog(next, { onlyPlayer: true });
  const synced = syncWorldRegistry(next !== state && next.regions !== state.regions ? reconcileTerritory(next) : next);
  // A peoples world keeps its titles and regiment numbers current (peopleNames.js; names only).
  return synced === state ? state : refreshPeopleNames(synced, state);
};
