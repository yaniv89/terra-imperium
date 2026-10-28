import { orderMarch, cancelRoute, placeName, moveNowCheck, released, stepMarchesNow, MARCH_ATTRITION } from './routes';
import { orderMarchAttack } from './marchAttack';
import { orderExplore, stopExplore } from './scouting';
import { normalizeUnitTiles, regionForTile, tileAccess, passableTile, unitTile } from './armies';
import { atSea, touchesCoastOf } from './fleets';
import { validateFieldAttack, getFieldBattleContext, getFieldResolveArgs, applyFieldResult } from './fieldBattle';
import { validateFleetAttack, getFleetBattleContext, getFleetResolveArgs, applyFleetResult } from './navalBattle';
import { abandonColony, foundColony, validateColony } from './colonies';
import { chooseResearch, emptyResearch, queueResearch, unqueueResearch } from './research';
import { pendingLandmarkAge, withLandmark } from './ageLandmarks';
import { landmarkOf } from '../data/ageLandmarks';
import { applyScenario } from './worldgen/emergentWorld';
import { syncWorldRegistry } from './world/registry';
import { queueItem, dequeueItem, moveQueueItem, itemKey, setFocus, toggleLock, canQueue, canFoundCity, addPeople, sizeToPeople } from './world/cities';
import { quoteBuyTile, investInGrowth } from './cityEconomy';
import { stonePhaseOf, canAnnex } from './stonePhase';
import { placeCamps, resolveCamp } from './tribalCamps';
import { isSettler, settlerPath, canSettle, foundOutpost, SETTLER_MOVES, setSettlerHold, disbandSettlers, isBand, canFoundVillage, foundVillage, withVillageLog } from './settlers';
import { markTutorialStep } from './tutorial';
import { answerDemand } from './aiAccords';
import { getTiles, loadedWorldSpec } from '../data/geo/tiles';
import { canSubjugate, reconcileTerritory } from './worldLifecycle';
import { msg, carry, sub, people, cityRef, person, place, thing } from './messages';
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
import { GameStatus, ActionTypes, RelationStatus, LogTypes, TechCategories, ACTION_AGE_GATES } from '../data/types';
import { REGIONS_DATA, getNeighborIds, isAdjacentToOwner, getNationCapital, getCapital, getBorderingNationIds } from '../data/regions';
import { PEOPLES } from '../data/peoples';
import { peopleNationRecord } from '../data/peopleNation';
import { DEFAULT_WORLD_SIZE, CITY_STATE_DENSITIES, DEFAULT_CITY_STATES, CITY_STATES_PACKED } from '../data/worldSizes';
import { pickMajors } from './worldgen/peoplesWorld';
import { placeGeneratedPeoples } from './worldgen/generatedPeoples';
import { normalizeSpec, sameWorld } from '../worldgen/spec';
import { placeCityStatesOnEarth, asIndependentSource, finalizeIndependents } from './independents';
// The City-states setting rides on the saved scenario (decision 42; old saves read it as Normal).
const withCityStates = (state, density) => (density ? { ...state, scenario: { ...state.scenario, cityStates: density } } : state);
import { refreshPeopleNames } from './peopleNames';
import { TECH_TREE } from '../data/techTree';
import {
  GOVERNMENT_TYPES, canChangeGovernmentType, canEnactReform, resetReformsForType, getReformChoices
} from '../data/government';
import { IDENTITY_AXES, IDENTITY_SHIFT_STEP, IDENTITY_SHIFT_COOLDOWN_TURNS, clampIdentity } from '../data/identity';
import { getLaw, canEnactLaw, lawChangeCost, LAW_CHANGE_COOLDOWN_TURNS, COLLECTIVIZATION_UNREST_MODIFIER, COLLECTIVIZATION_UNREST_TURNS, DEFAULT_LAWS } from '../data/laws';
import { transferRegion } from './regionTransfer';
import { grantIntel } from './intel';
import { validateInvasion, getInvasionBattleContext, getResolveBattleArgs, applyInvasionResult, isUnitInBattle, validateAmphibious, applyAmphibiousLanding, getAmphibiousBattleContext } from './invasion';
import { declareWar, hasCasusBelli, isWarBetween, isAtWarWithPlayer, isInTruce, getTradePactCapacity, setTruce, refreshWarFlags, PEACE_OFFER_COOLDOWN_TURNS } from './diplomacy';
import { canAttack, isNoMansLand, exploreOn } from './hostility';
import { setHold, setSiege } from './standingOrders';
import { isIndependent, isIndependentNation, GRUDGE_ATTACKED } from '../data/independents';
import { addGrudge } from './grudges';
import { hireMercenaryForPlayer } from './mercenaries';
import { answerTributeDemand, resolveRaidBattle } from './raids';
import { isRaidKind, queuedRaidArmies } from './raidBattle';
import { interceptArmies, landingArmies, resolveInterceptQueued, resolveLandingQueued } from './aiLanding';
import { giftIndependent, proposeJoining, answerJoinOffer, demandIndependentTribute, proposeIndependentTrade, offerIndependentTribute, razeCityForPlayer } from './indepPolicy';
import { canRaze, stopRazing } from './razing';
import { resolveCapture } from './capture';

const endWar = (wars, id) => wars.map((w) => (w.id === id ? { ...w, active: false, goalAchieved: true } : w));
import { getEffectiveMilitaryPower } from './aiEconomy';
import { applyPeace, getPeaceAcceptance } from './peace';
import { levyUnit } from './aftermath';
import { cardOf } from './eventDeck';
import { crisisComing } from './crises';
import { crisisCardId } from '../data/crises';
import { AGES, FIRST_AGE_ID, isAgeAtLeast, isAgeBefore } from '../data/ages';
import { endingSignal } from './ending';
import { ageOf, getResearched } from './nationState';
import { congressMembers } from './worldCongress';
import { sideAgeOf } from './ageRefs';
import { getRegionTerrain } from '../data/terrain';
import { createEmptyResourcePool } from '../data/resources';
import {
  canBuildTier, canBuildExtraction, BUILDING_CATEGORIES,
  getBuildingSlots, getUsedBuildingSlots, getBuildingTierCost, getCategoryTierName
} from '../data/buildings';
import { regionHasDeposit } from '../data/deposits';
import { getUnlockedClasses, isRobotUnlocked } from '../data/unitClasses';
import { robotRecruitCost } from './robots';
import { isBound } from '../data/worldCongress';
import { upgradeUnits, stampUnitAges } from './unitUpgrades';
import {
  ACTION_COSTS, DISBAND_HR_REFUND_RATIO, FUND_SCHOLARS_TECHPOINTS,
  SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD, GIFT_HOSTILITY_REDUCTION,
  UNJUSTIFIED_WAR_GLOBAL_HOSTILITY, UNJUSTIFIED_WAR_HOME_UNREST,
  SETTLE_COLONIZE_CONTROL_THRESHOLD, SETTLE_COLONIZE_START_CONTROL, SETTLE_COLONIZE_START_UNREST, SETTLE_COLONIZE_OWNER_HOSTILITY,
  POPULATION_POLICY_GROWTH_RATE,
  ESPIONAGE_SUCCESS_CHANCE, ESPIONAGE_TECH_POINTS_STOLEN, ESPIONAGE_FAILURE_HOSTILITY_INCREASE,
  COUNTER_INTEL_HOSTILITY_REDUCTION, CLIMATE_RESILIENCE_MAX,
  CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION,
  ARMY_MAINTENANCE_DEFAULT,
  MAX_RIVALS, MARRIAGE_HOSTILITY_REDUCTION,
  BREAK_ALLIANCE_HOSTILITY_INCREASE, INSULT_HOSTILITY_INCREASE, STARTING_DIPLOMATS,
  TRUCE_BREAK_STABILITY_PENALTY, TRUCE_BREAK_PRESTIGE_PENALTY, TRUCE_BREAK_AE_AGAINST_NEIGHBORS,
  VASSALIZE_HOSTILITY_CEILING, VASSALIZE_STRENGTH_RATIO, VASSAL_ANNEX_COOLDOWN_TURNS,
  ESPIONAGE_SUPPORT_REBELS_UNREST_INCREASE, INTEL_DURATION_TURNS, MOVE_CAPITAL_FOREIGN_STABILITY_PENALTY, LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD } from '../data/actionCosts';
import { resolveTurn } from './resolveTurn';
import { resolveAutoBattle } from './autoBattle';
import { switchedBattleState } from './battleSwitch';
import { applyBattleOutcome, makeBattleOutcome, battleIdOf } from './battleOutcome';
import { cityMilitia, reinforcementSources, fieldReinforcements } from './battleInputs';
import { battleRequired, autoSiegeOn } from './battleThreshold';
import { battleQueueBlocked, queuedKind, queuedArmies, queuedCommandBlock, resolveQueuedAuto, resolveAllQueuedAuto, drainAutoBattles, aggressorView } from './battleQueue';
import { replayBattle } from '../battle/sim/replay';
import { verifyCommandedBattle, fieldedUnitIds } from './battleVerify';

// Re-exported so the edge-function bundle (scripts/build-edge-engine.mjs) can verify a battle log
// on its own, too.
export { replayBattle };
import { applyDefenseResult, getDefenseArmies, applyDefenseWithdrawal } from './defense';
import { applyEventEffects } from './applyEventEffects';
import { getDefenseLevelDamageReductionMultiplier, getZoneOfControlMultiplier } from './siege';
import { pillageTile } from './threat';
import { canPromote, getPerk } from '../data/promotions';
import { generateGeneral, commandGenerals } from '../data/generals';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { randomSeed, createRng } from '../utils/rng';
import { applyStartingDoctrine } from '../data/startingDoctrines';
import { applyDifficulty } from '../data/difficulty';
import { initFog, updateFog, fogOn, hasMet } from './fog';
import { createRuler, generateAdvisorCandidates, getAdvisorHireCost, courtNames, raiseAttribute, takeVirtue, reshapeRuler } from './rulers';
import { clampStability, clampPrestige, getIncreaseStabilityCost } from './nationalPower';
import { getTotalDev, DEV_TYPE_IDS, getDevelopProvinceCost, DEVELOP_PROVINCE_POP_GAIN_RATIO, applyDevelopment } from './development';
import { getModifier, getRegionModifier } from './modifiers/sheet';
import { canAfford, applyCosts } from '../utils/helpers';
import { canPay, payCost } from '../utils/costs';
import { TAX_RATE_IDS, DEFAULT_TAX_RATE, TAX_RATE_CHANGE_COOLDOWN_TURNS } from '../data/taxRates';
import { getLoanCapacity, getLoanInterestRate, getLoanSize, clampMaintenance, getRecruitUnitCost, hasBankingHouses } from './economy';
import { canFabricateClaim, claimableCities, startClaim, CLAIM_FABRICATE_TURNS } from './claims';
import { hasOpenBorders, openBordersAcceptance, setOpenBorders, applyDemand, DEMANDS, hasStele, steleAcceptance, steleTurns, setStele } from './accords';
import { turnBlockers } from './turnBlockers';
import { advisorPick, advisorPicks } from './productionAdvisor';
import { cityGroups, governorChoices, assignGovernor, dismissGovernor, GOVERNOR_ASSIGN_TURNS } from './governors';
import { validateTemplate, saveTemplate, deleteTemplate, templatesOf, armyOrder } from './armyTemplates';
import { NAVAL_LINES, navalCargo, navalAir } from '../data/navalLines';
import { canQueueWonder, wonderItem } from './wonders';
import { rushQuote, applyRush, rushItemName, infrastructureCosts, defensesCosts, growthCosts } from './spending';
import { tradeMaps, answerMapOffer } from './mapTrade';
import { opinionOf, withGift } from './opinion';


// How many land units one naval unit can carry (plan §7.5's Embark/Disembark).

// Any of the 240 nations works as a fallback default — only used when no explicit choice (from
// the country-select start screen) or saved game is present yet.
const DEFAULT_PLAYER_NATION_ID = 'akkad';

// ============ INITIAL STATE FACTORY ============
// Exported (not just used internally) so it doubles as test fixture data — resolveTurn.test.js
// and applyEventEffects.test.js build realistic states from it rather than hand-rolling partial
// mocks that could silently drift from the real shape.
export const createInitialState = ({ playerNationId = DEFAULT_PLAYER_NATION_ID, gameSpeed = 'normal', rngSeed, scenario = { mode: 'peoples' }, guided = false, fog = true } = {}) => {
  // Every nation starts in the first age by research (KTD1); the year is only its label (KTD3).
  const age = FIRST_AGE_ID;
  const year = AGES[age].startYear;

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

  // Every world is a peoples world (src/engine/worldgen/peoplesWorld.js): the majors are drawn from
  // the 150-people pool with the world seed.
  if (scenario.mode !== 'peoples') throw new Error('Every world is a peoples world (scenario.mode "peoples")');
  if (!PEOPLES[playerNationId]) throw new Error(`Unknown people ${playerNationId}`);
  const worldSeed = scenario.seed ?? baseSeed;
  // The world (plans/MAP-VARIATIONS-PLAN.md 3.2): the real Earth, or a generated world, which must
  // be the one this page (or test) has loaded; peoples then stand on its fair sites by affinity
  // (generatedPeoples.js) instead of their real capitals, and the site table is saved.
  const mapSpec = normalizeSpec(scenario?.map);
  const generated = mapSpec.kind === 'generated';
  if (generated) {
    if (!sameWorld(loadedWorldSpec(), mapSpec)) throw new Error('This generated world is not the loaded one: boot into it first (src/worldgen/worldLoader.js)');
  }
  const mapRecord = generated ? { ...mapSpec, worldHash: loadedWorldSpec().worldHash } : { kind: 'earth' };
  // City-states: Few / Normal / Many (decision 42); absent = Normal.
  const cityStates = CITY_STATE_DENSITIES[scenario?.cityStates] || scenario?.cityStates === CITY_STATES_PACKED ? scenario.cityStates : DEFAULT_CITY_STATES;
  const generatedPlacement = generated ? placeGeneratedPeoples(playerNationId, scenario.size || DEFAULT_WORLD_SIZE, worldSeed, getTiles(), { independents: scenario.independents !== false, density: cityStates }) : null;
  const majorIds = generatedPlacement ? generatedPlacement.majors.slice() : pickMajors(playerNationId, scenario.size || DEFAULT_WORLD_SIZE, worldSeed, { tiles: getTiles() });
  // City-state peoples become independent cities (phase W1, src/engine/independents.js; on Earth
  // spaced by START_MIN_GAP_KM, some moved off their real capital: `sites`);
  // `independents: false` in the scenario leaves them out (majors only, as phase W0 built it).
  const independentPick = generatedPlacement ? { ids: generatedPlacement.independents, late: generatedPlacement.late }
    : scenario.independents !== false ? placeCityStatesOnEarth(majorIds, scenario.size || DEFAULT_WORLD_SIZE, worldSeed, { density: cityStates, tiles: getTiles() }) : { ids: [], late: [] };
  const startSites = generatedPlacement ? generatedPlacement.sites : (independentPick.sites && Object.keys(independentPick.sites).length ? independentPick.sites : null);
  const nationSource = Object.fromEntries([
    ...majorIds.sort().map((id) => [id, peopleNationRecord(id)]),
    ...independentPick.ids.map((id) => [id, asIndependentSource(peopleNationRecord(id))])
  ]);

  // Plan §M4: overextension is measured relative to each nation's OWN starting size, so a 50-region
  // nation and a 1-region nation are equally "at capacity" at the same overextension% — captured
  // once, here, since region ownership churns every game while this stays a fixed reference point.
  const startRegionCountByOwner = {};

  // Every nation of the world gets a record — any of them can be the player's.
  const nations = {};
  Object.entries(nationSource).forEach(([id, data]) => {
    const ruler = createRuler(id);
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
      // economy.js's header for the morale-recovery/reinforcement scope trim), and loans.
      armyMaintenance: ARMY_MAINTENANCE_DEFAULT,
      navyMaintenance: ARMY_MAINTENANCE_DEFAULT,
      loans: [],

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
      // affect anything mechanically today.
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
      // reads state.resources directly, for zero present benefit). tech.ageId starts in the first
      // age, as state.techAgeId does.
      ...(id !== playerNationId ? { economy: { gold: 0, hr: 0, techPoints: 0 }, tech: { researched: [], ageId: age } } : {}),
      ...(data.kind ? { kind: data.kind } : {}) // an independent (phase W1, independents.js finalizes it)
    };
  });

  // Initialize tech tree (currently empty content — see src/data/techTree.js).
  const techTree = {};
  Object.keys(TECH_TREE).forEach((id) => {
    techTree[id] = { id, researched: false };
  });

  const initial = {
    // Identity
    playerNationId,

    // Time
    year,
    // The player's age: its research age (ageOf in nationState.js, eight-ages plan KTD1). RESEARCH_TECH
    // advances it once 6 of its current age's 10 techs are researched.
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

    // Resources — Gold/HR always present; Copper/Iron/Oil (and later Rare Metals) join
    // as their age unlocks (see src/data/resources.js). techPoints is a meta-currency,
    // not an age-gated resource (the ADM/DIP/MIL pools are gone: differentiation plan U7).
    resources: {
      ...createEmptyResourcePool(age),
      gold: 500,
      hr: 100,
      techPoints: 0
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
    // Loan ids come from a counter (like units) — the old `loan_${turn}_${loans.length}`
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

    // Advisor candidates (plan §M3) — only the player's own is ever generated/read today (AI
    // nations don't hire advisors until M16 gives them a real economy to hire with), keyed by
    // nation id, in case that changes later.
    advisorPool: { [playerNationId]: generateAdvisorCandidates(playerNationId, rulerRng, [nations[playerNationId]?.ruler?.name]) },

    // Deterministic turn resolution — see src/utils/rng.js
    // Carries forward whatever rulerRng advanced to while generating all 240 nations' rulers
    // above, rather than a fresh randomSeed() — turn 1 then continues deterministically from
    // exactly where ruler generation left off, instead of silently discarding those draws.
    rngSeed: rulerRng.getSeed(),

    // Logs
    logs: [
      { year, ...msg('m.act.storyBegins', { when: yearRef(year) }), type: LogTypes.MILESTONE }
    ]
  };
  // Fog of war (fog.js): each people knows its homeland; `fog: false` is the "explored world" option.
  const built = refreshPeopleNames(syncWorldRegistry(finalizeIndependents(withCityStates(applyScenario(initial, { ...scenario, seed: worldSeed, map: mapRecord, ...(startSites ? { sites: startSites } : {}) }), cityStates), { late: independentPick.late })));
  // A Stone Age start (U26): the tribal camps, away from every band's home and every city.
  const homes = [...Object.values(built.units).filter(isBand).map((u) => u.band.home), ...Object.values(built.regions).map((c) => c.tile)];
  const started = stampUnitAges(initFog(built.scenario?.band ? { ...built, tribalCamps: placeCamps(worldSeed, homes), pendingCamp: null } : built, { on: fog })); // the start's units are of the first age (unitUpgrades.js)
  // The guided start (src/engine/tutorial.js): twenty-five turns of prompts for a new player.
  return guided ? { ...started, tutorial: { startTurn: started.turnNumber || 1, done: {}, ended: false } } : started;
};

// A player action the engine refuses still has to SAY why — a bare `return state` is invisible to
// the player (the lesson of this codebase's diplomacy "buttons do nothing" bug). New guards use this;
// older ones are migrated as they're touched (implementation plan §0.3).
// Why a commanded battle was settled on Auto without being shown (ABANDON_TACTICAL_BATTLE `reason`).
export const ABANDON_REASONS = {
  no_setup: 'the armies are no longer where the battle was',
  no_attackers: 'no attacking troops were left to command',
  no_defenders: 'no defenders were left to fight',
  setup_error: 'the battle could not be set up',
  screen_error: 'the battle screen failed'
};
/**
 * DEF-01: a battle the player chose to Command but that was fought on Auto says so on its result
 * (`autoBecause` on the newest report: BattleReplay and the report sheet show it), never silently.
 */
// `m` is the msg() record of the sentence (messages.js): its English is `autoBecause`, the key and vars
// ride beside it as `autoBecauseMsg` so the report is read in the reader's language.
const stampAutoBecause = (before, after, m) => {
  if ((after.battleReportSeq || 0) === (before.battleReportSeq || 0) || !after.battleReports?.[0]) return after;
  return { ...after, battleReports: [{ ...after.battleReports[0], autoBecause: m.message, autoBecauseMsg: sub(m.msgKey, m.msgVars) }, ...after.battleReports.slice(1)] };
};
/** How the Log line of a finished battle that changed nothing begins (battleReceipt.js reads it). */
export const BATTLE_VOID_PREFIX = 'The battle at';

// `message` is an English string (a sub-system's reason) or a msg() result: the key travels.
// A refusal's reason as a message when it carries one (messages.js reasonOf), else its English.
const whyOf = (r) => (r?.reasonMsg ? msg(r.reasonMsg.key, r.reasonMsg.vars) : r?.reason);
const reject = (state, message) => ({
  ...state,
  logs: [...state.logs, { year: state.year, ...carry(message), type: LogTypes.ACTION }]
});

// Log line pieces (phase H3, src/engine/messages.js).
const yearRef = (y) => sub(y < 0 ? 'm.act.yearBce' : 'm.act.yearCe', { y: Math.abs(y) });
const aboutTurns = (n) => (n <= 0 ? sub('m.act.thisTurn') : sub(n > 1 ? 'm.act.aboutTurnsMany' : 'm.act.aboutTurnsOne', { n }));
/** A march order steps at once with this turn's points (routes.js stepMarchesNow): the ordered
 * units on `units`, and the walk's own log lines (arrived, halted) after the order's line. */
const stepOrdered = (state, units, ids, orderLog) => {
  const step = stepMarchesNow({ ...state, units }, ids);
  return { ...state, units: step.units, logs: [...state.logs, orderLog, ...step.logs.map((l) => ({ ...l, year: state.year }))] };
};
/** A nation by id, else the fallback words (a sub-message key). */
const nationOr = (state, id, fallbackKey) => (state.nations[id]?.name ? people(id, state.nations[id].name) : sub(fallbackKey));
/** A city by id with the name the line used, else the fallback words. */
const cityOr = (id, name, fallbackKey) => (name ? cityRef(id, name) : sub(fallbackKey));
/** "a, b, c" of tech names. */
const techList = (ids) => ids.map((id) => thing('tech', id, TECH_TREE[id]?.name)).reduceRight((acc, r) => (acc === null ? r : sub('m.act.listNext', { a: r, b: acc })), null);

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
    return reject(state, msg('m.act.no.atPeaceAttack', { nation: owner?.name ? people(owner.id, owner.name) : sub('m.act.them'), city: cityOr(targetRegionId, REGIONS_DATA[targetRegionId]?.name, 'm.act.thatRegion') }));
  }
  return reject(state, ATTACK_REFUSALS[reason] ? msg(`m.act.refuse.${reason}`) : msg('m.act.refuse.default'));
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
  [ActionTypes.UPGRADE_UNIT]: (p) => (Array.isArray(p.unitIds) ? p.unitIds : []),
  [ActionTypes.APPOINT_GENERAL]: (p) => [p.unitId],
  [ActionTypes.EMBARK_UNIT]: (p) => [p.landUnitId, p.navalUnitId],
  [ActionTypes.DISEMBARK_UNIT]: (p) => [p.landUnitId],
  [ActionTypes.AMPHIBIOUS_ASSAULT]: (p) => [p.navalUnitId]
};
const guardPendingBattle = (state, action) => {
  const defenses = state.pendingDefenses?.length > 0;
  if (!state.pendingBattle && !defenses) return null;
  if (TURN_ACTIONS.has(action.type)) {
    return reject(state, msg(state.pendingBattle ? 'm.act.no.finishBattleTurn' : 'm.act.no.underAttackTurn'));
  }
  const ids = UNIT_ACTION_IDS[action.type]?.(action.payload || {}) || [];
  if (ids.some((id) => id && isUnitInBattle(state, id))) return reject(state, msg('m.act.no.unitInBattle'));
  return null;
};

// The city's damage and the razed buildings are applied by the one outcome service
// (battleOutcome.js applyCityDamage).

// Rebuilds a commanded battle's result from the REAL units in state, so a tampered or buggy result
// can never mint soldiers: only the locked units, strength can only go down, morale stays in range,
// ids and outcome are validated, and the command-mode XP bonus stays capped.
const MANIFEST_ID = /^[a-z][a-z0-9_-]{0,47}$/;
const cleanIds = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === 'string' && MANIFEST_ID.test(id)))].slice(0, 600) : []);

const DISPOSITIONS = ['dead', 'fled', 'field', 'reserve'];
// The ledger invariant (playtest audit X04, the ghost cavalry): `fielded` is [attacker ids, defender
// ids] of the units that took the field (battleVerify.js fieldedUnitIds, from the battle's setup).
// Every one of them is in an honest result. One that is missing is NOT handed back at full strength
// (it used to be: a regiment the battle lost could stand whole on the map): it counts as lost in
// the battle and is listed in `report.tactical.missingUnitIds`, so the breach is on the record.
// Without `fielded` (no setup could be built) a missing unit is left as it was, as before.
export const sanitizeTacticalResult = (state, pb, result, { fielded = null } = {}) => {
  const OUTCOMES = ['attacker', 'defender', 'stalemate'];
  const tookField = new Set(Array.isArray(fielded) ? fielded.flat() : []);
  const missingUnitIds = [];
  // Synthetic expeditionary troops (defense battles) live on the battle record, not in state.units.
  const clampUnits = (ids, reported) => ids.map((id) => {
    const real = state.units[id] || (pb.synthetic || []).find((u) => u.id === id) || (pb.militia || []).find((u) => u.id === id);
    if (!real) return null;
    const found = (reported || []).find((u) => u && u.id === id);
    if (!found && tookField.has(id)) {
      missingUnitIds.push(id);
      return { ...real, strength: 0, morale: 0, routed: false, disposition: 'dead' };
    }
    const r = found || {};
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
        missingUnitIds,
        xpBonusById: bonus,
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
  return isIndependent(state.nations, target) ? reject(state, msg('m.act.no.independentTreaty', { nation: people(target, state.nations[target].name) })) : null;
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
      // A story or a link fired by id is a deck card (eventDeck.js cardOf); a drawn card or a link
      // bound to a city is carried in full on the state.
      const event = state.activeEventId
        ? cardOf(state.activeEventId)
        : state.activeProceduralEvent;
      if (!event) return state;
      // A crisis card answered during its warning: the choice waits on state.crises.coming and is paid at the strike.
      const coming = state.crises?.coming;
      if (coming?.answered && state.activeEventId === crisisCardId(coming.id)) {
        const i = action.payload.optionIndex;
        if (!Number.isInteger(i) || !event.options[i]) return state;
        return { ...state, activeEventId: null, crises: { ...state.crises, coming: { ...coming, choice: i } } };
      }
      return applyEventEffects(state, event, action.payload.optionIndex);
    }

    case ActionTypes.ANSWER_CRISIS_EARLY: {
      // The coming crisis's card opens during its warning; answered now (RESOLVE_EVENT keeps the choice
      // until the strike), it does not open again when the crisis strikes.
      const coming = crisisComing(state);
      if (!coming || coming.answered || state.activeEventId || state.activeProceduralEvent) return state;
      return { ...state, activeEventId: crisisCardId(coming.crisis.id), crises: { ...state.crises, coming: { ...state.crises.coming, answered: true } } };
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.gainedControl', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_INFRASTRUCTURE: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = infrastructureCosts(state, region); // by age, speed and level (spending.js, I021)
      if (!region || region.owner !== state.playerNationId || region.currentInfrastructure >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, currentInfrastructure: region.currentInfrastructure + 1 } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.builtInfrastructure', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name), level: region.currentInfrastructure + 1 }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_DEFENSES: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = defensesCosts(state, region); // by age, speed and level (spending.js, I021)
      if (!region || region.owner !== state.playerNationId || region.defenseLevel >= 10) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, defenseLevel: region.defenseLevel + 1 } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.builtDefenses', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name), level: region.defenseLevel + 1 }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.BUILD_CLIMATE_RESILIENCE: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.buildClimateResilience;
      if (!region || region.owner !== state.playerNationId || (region.climateResilience || 0) >= CLIMATE_RESILIENCE_MAX) return state;
      if (!isAgeAtLeast(ageOf(state, state.playerNationId), 'modern')) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextLevel = (region.climateResilience || 0) + 1;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, climateResilience: nextLevel } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.builtResilience', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name), level: nextLevel }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CULTURAL_EXPORT: {
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.culturalExport;
      if (!isAgeAtLeast(ageOf(state, state.playerNationId), 'modern')) return state;
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.cultureSpreads', { n: nextInfluence }), type: LogTypes.DIPLOMACY }]
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
      return { ...state, nations: { ...state.nations, [state.playerNationId]: next }, logs: [...state.logs, { year: state.year, ...msg('m.act.governorSets', { governor: person(candidate.name), city: cityRef(seatId, state.regions[seatId]?.name), count: group.cities.length - 1, turns: GOVERNOR_ASSIGN_TURNS }), type: LogTypes.ACTION }] };
    }

    case ActionTypes.DISMISS_GOVERNOR: {
      const { seatId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const next = dismissGovernor(nation, seatId);
      if (next === nation) return state;
      return { ...state, nations: { ...state.nations, [state.playerNationId]: next }, logs: [...state.logs, { year: state.year, ...msg('m.act.governorRecalled', { city: cityRef(seatId, state.regions[seatId]?.name) }), type: LogTypes.ACTION }] };
    }

    // The ruler's growth (rulers.js, differentiation plan U11): each refused move returns the same state.
    case ActionTypes.RAISE_RULER_ATTRIBUTE: return raiseAttribute(state, state.playerNationId, action.payload?.attr);
    case ActionTypes.TAKE_RULER_VIRTUE: return takeVirtue(state, state.playerNationId, action.payload?.virtueId);
    case ActionTypes.RESHAPE_RULER: return reshapeRuler(state, state.playerNationId);

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
        ? generateAdvisorCandidates(state.playerNationId, rng, [...courtNames(nation, state.advisorPool[state.playerNationId]), candidate.name])[pool][0] // a fresh face (a name nobody at court has) fills the now-hired slot
        : refreshedCandidates[pool][i]));

      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, advisors: { ...nation.advisors, [pool]: candidate } } },
        advisorPool: { ...state.advisorPool, [state.playerNationId]: refreshedCandidates },
        rngSeed: rng.getSeed(),
        logs: [...state.logs, { year: state.year, ...msg('m.act.advisorHired', { advisor: person(candidate.name), level: candidate.level, pool: sub(`m.act.pool.${pool}`) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.INCREASE_STABILITY: {
      // Plan §M4: costs scale with both current overextension and how high stability already is
      // (getIncreaseStabilityCost) — no cap check beyond that, since the gold cost itself already
      // makes pushing stability to its +3 ceiling progressively more expensive.
      const nation = state.nations[state.playerNationId];
      if ((nation.stability || 0) >= 3) return state;
      const stabilityCostMult = getModifier(state, state.playerNationId, 'national.stabilityCost').total;
      const cost = getIncreaseStabilityCost(state, state.playerNationId, stabilityCostMult);
      if (!canPay(state, cost)) return state;
      return payCost({
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...nation, stability: clampStability((nation.stability || 0) + 1) } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.stabilityUp', { n: clampStability((nation.stability || 0) + 1) }), type: LogTypes.ACTION }]
      }, cost, 'increaseStability');
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
      if (currentTier < 0 && !BUILDING_CATEGORIES[categoryId].freeSlot) {
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.constructed', { building: thing('building', null, getCategoryTierName(categoryId, nextTier)), city: cityRef(regionId, REGIONS_DATA[regionId]?.name), cost }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DEVELOP_RESOURCE_SITE: {
      const { regionId, resourceId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.developResourceSite;
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (region.buildings?.extraction?.[resourceId]) return state; // an unknown resource fails canBuildExtraction below
      if (!regionHasDeposit(REGIONS_DATA[regionId], resourceId) || !canBuildExtraction(resourceId, ageOf(state, state.playerNationId))) return state;
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.extractionSite', { resource: thing('resource', resourceId, resourceId), city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DEVELOP_PROVINCE: {
      // Plan §M5: +1 to one of the region's own tax/production/manpower development, for gold
      // (getDevelopProvinceCost, differentiation plan U7) — the cost scales with the region's
      // OWN current total development, so an already-developed province costs progressively more
      // to push further, same shape as Increase Stability's own cost curve (M4).
      const { regionId, devType } = action.payload;
      const region = state.regions[regionId];
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (!DEV_TYPE_IDS.includes(devType)) return state;
      const developmentCostMult = getModifier(state, state.playerNationId, 'national.developmentCost').total;
      const cost = getDevelopProvinceCost(region, developmentCostMult);
      if ((state.resources.gold || 0) < cost) return state;
      const modernBaseline = REGIONS_DATA[regionId]?.population || 0;
      const popGain = Math.round(modernBaseline * DEVELOP_PROVINCE_POP_GAIN_RATIO);
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        regions: {
          ...state.regions,
          [regionId]: {
            // applyDevelopment (development.js): a city keeps the point as lasting investment (I031).
            ...applyDevelopment(region.size != null ? addPeople(region, sizeToPeople(region.size) * DEVELOP_PROVINCE_POP_GAIN_RATIO) : { ...region, currentPopulation: (region.currentPopulation || modernBaseline) + popGain }, devType)
          }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.developed', { dev: thing('devType', devType, devType), city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.QUELL_UNREST: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.quellUnrest;
      if (!region || region.owner !== state.playerNationId || region.unrest <= 0) return state;
      if (region.occupiedBy) return reject(state, msg('m.act.no.occupied', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }));
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, unrest: Math.max(0, region.unrest - 30) } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.quelled', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SETTLE_COLONIZE: {
      // Peaceful settlement of land NOBODY really governs any more: a province held by rebels, or
      // the remnant of a nation that's been wiped out. It used to accept ANY adjacent province under
      // 20 control — including an ally's — with no diplomatic cost.
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.settleColonize;
      if (!region || region.owner === state.playerNationId) return state;
      const regionName = REGIONS_DATA[regionId]?.name || regionId;
      const owner = state.nations[region.owner];
      const rebelUnitIds = Object.values(state.units).filter((u) => u.regionId === regionId && u.ownerId === REBEL_OWNER_ID).map((u) => u.id);
      if (owner && !owner.isEliminated && rebelUnitIds.length === 0) return reject(state, msg('m.act.no.stillGoverns', { nation: people(owner.id, owner.name), city: cityRef(regionId, regionName) }));
      if (owner && !owner.isEliminated && (owner.hasMilitaryPact || owner.vassalOf === state.playerNationId)) return reject(state, msg('m.act.no.allyLand', { nation: people(owner.id, owner.name), city: cityRef(regionId, regionName) }));
      if (region.control >= SETTLE_COLONIZE_CONTROL_THRESHOLD) return reject(state, msg('m.act.no.controlHigh', { city: cityRef(regionId, regionName), control: Math.round(region.control), max: SETTLE_COLONIZE_CONTROL_THRESHOLD }));
      if (!isAdjacentToOwner(regionId, state.regions, state.playerNationId)) return reject(state, msg('m.act.no.mustBorder', { city: cityRef(regionId, regionName) }));
      if (!canAfford(state.resources, costs)) return reject(state, msg('m.act.no.settleCost', { city: cityRef(regionId, regionName) }));
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.settlersAbsorbed', { city: cityRef(regionId, regionName), which: owner && !owner.isEliminated ? sub('m.act.lostToRebels', { nation: people(owner.id, owner.name) }) : sub('m.act.noOneGoverned') }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.POPULATION_POLICY: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = region?.size != null ? growthCosts(state, region) : ACTION_COSTS.populationPolicy; // by age, speed and size (spending.js)
      if (!region || region.owner !== state.playerNationId) return state;
      if (region.occupiedBy) return reject(state, msg('m.act.no.occupied', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }));
      if (!canAfford(state.resources, costs)) return state;
      // A city banks the new people as food toward its next size (population.js, one model).
      const nextRegion = region.size != null
        ? investInGrowth(state, regionId) // a quarter of the next citizen's food (cityEconomy.js)
        : { ...region, currentPopulation: Math.round((region.currentPopulation || 1) * (1 + POPULATION_POLICY_GROWTH_RATE)) };
      // Nothing to buy: the food bank is already full (I032). No charge for no effect.
      if (nextRegion === region) return reject(state, msg('m.act.no.foodFull', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }));
      const nextPopulation = nextRegion.currentPopulation ?? sizeToPeople(nextRegion.size);
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: nextRegion },
        logs: [...state.logs, { year: state.year, ...msg('m.act.growthInvested', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name), n: nextPopulation }), type: LogTypes.ACTION }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.taxRate', { rate: thing('taxRate', rate, rate) }), type: LogTypes.ACTION }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.loanTaken', { gold: principal }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.REPAY_LOAN: {
      const { loanId } = action.payload;
      const nation = state.nations[state.playerNationId];
      // By index, not by id filter: a save from before nextLoanSeq can still hold two loans with the
      // same id, and repaying one must never clear the other for free.
      const loanIndex = (nation.loans || []).findIndex((l) => l.id === loanId);
      const loan = nation.loans?.[loanIndex];
      if (!loan) return reject(state, msg('m.act.no.loan'));
      if ((state.resources.gold || 0) < loan.principal) return reject(state, msg('m.act.no.repayGold', { gold: loan.principal }));
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - loan.principal },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, loans: nation.loans.filter((_, i) => i !== loanIndex) } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.loanRepaid', { gold: loan.principal }), type: LogTypes.ACTION }]
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
      const robot = !!action.payload?.robot; // a robot variant (robots.js): no manpower, no levy
      const costs = robot ? robotRecruitCost(getRecruitUnitCost(state, ageOf(state, state.playerNationId))) : getRecruitUnitCost(state, ageOf(state, state.playerNationId));
      if (!region || region.owner !== state.playerNationId || region.occupiedBy) return state;
      if (!getUnlockedClasses(ageOf(state, state.playerNationId), getResearched(state, state.playerNationId)).includes(classId)) return state;
      if (robot && !isRobotUnlocked(ageOf(state, state.playerNationId), classId, getResearched(state, state.playerNationId))) return state;
      if (robot && isBound(state, 'weaponsBan', state.playerNationId)) return reject(state, msg('m.why.weaponsBan')); // a ban means a ban (worldCongress.js)
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
        // The age it is built in: it keeps that age's unit until UPGRADE_UNIT (unitUpgrades.js).
        ageId: ageOf(state, state.playerNationId),
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
        ...(robot ? { robot: true } : {}),
        // Naval-only: how many land units it can carry (plan §7.5's Embark/Disembark). Land-only:
        // which naval unit currently carries it, if any — set by EMBARK_UNIT/AMPHIBIOUS_ASSAULT.
        transportCapacity: isNaval ? navalCargo(navalLine, ageOf(state, state.playerNationId)) : null,
        ...(isNaval ? { navalLine } : {}),
        embarkedOn: null
      };
      const recruitingNation = state.nations[state.playerNationId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [unitId]: newUnit },
        // Its men leave the fields and workshops of the province they're raised in.
        regions: isNaval || robot ? state.regions : levyUnit(state.regions, newUnit),
        nations: {
          ...state.nations,
          // Every other reader of militaryStrength (AI tiering, coalition thresholds, a
          // destroy_military war goal against the player) needs it to actually reflect the
          // player's real recruited army, not sit frozen at its game-start value forever.
          [state.playerNationId]: { ...recruitingNation, militaryStrength: (recruitingNation.militaryStrength || 0) + newUnit.strength }
        },
        nextUnitSeq: state.nextUnitSeq + 1,
        logs: [...state.logs, { year: state.year, ...msg('m.act.recruited', { unit: thing('unitClass', classId, classId), city: cityRef(regionId, REGIONS_DATA[regionId]?.name) }), type: LogTypes.ACTION }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.disbanded', { unit: thing('unitClass', unit.classId, unit.classId), hr: refundHr }), type: LogTypes.ACTION }]
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
      const isSeaLaneReachable = unit.domain === 'naval' && isReachableBySea(unit.regionId, toRegionId, ageOf(state, unit.ownerId));
      // A land unit moves now only where its march would arrive this turn (routes.js moveNowCheck,
      // the same route and schedule as the preview): never a jump over a march of several turns
      // (playtest audit I065). Fleets keep the sea-lane rule.
      const walk = unit.domain === 'naval' ? null : moveNowCheck(state, unit, toRegionId);
      if (walk && !walk.ok) return reject(state, whyOf(walk));
      if (!walk && !isLandAdjacent && !isSeaLaneReachable) return state;
      // MOVE_ARMY is redeployment within your own territory, not an invasion — it has no war
      // declaration, no combat resolution, and no AP/gold cost beyond the ordinary move, so it must
      // never be able to walk a unit straight into someone else's region. Entering foreign
      // territory is what LAUNCH_INVASION/AMPHIBIOUS_ASSAULT are for.
      if (state.regions[toRegionId]?.owner !== state.playerNationId) return state;
      if (!canAfford(state.resources, costs)) return state;
      // A manual move replaces any march order and counts as marching this turn (routes.js costs).
      const toTile = state.regions[toRegionId]?.tile ?? null;
      // Harsh ground on the way costs what a march pays (routes.js MARCH_ATTRITION per step).
      let walkedStrength = unit.strength;
      for (let i = 0; i < (walk?.harshSteps || 0); i++) walkedStrength = Math.max(1, Math.round(walkedStrength * (1 - MARCH_ATTRITION)));
      const walked = walk?.harshSteps ? { strength: walkedStrength } : {};
      const nextUnits = { ...state.units, [unitId]: { ...released(cancelRoute(unit)), ...walked, regionId: toRegionId, tile: toTile, movesLeft: (unit.movesLeft ?? 1) - 1, ...(unit.domain === 'naval' ? {} : { marchedTurn: state.turnNumber, movedNowTurn: state.turnNumber }) } };
      // A transport takes its embarked cargo along with it.
      Object.values(state.units).forEach(u => {
        if (u.embarkedOn === unitId) nextUnits[u.id] = { ...u, regionId: toRegionId, tile: toTile };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        logs: [...state.logs, { year: state.year, ...msg('m.act.moved', { unit: thing('unitClass', unit.classId, unit.classId), city: cityRef(toRegionId, REGIONS_DATA[toRegionId]?.name) }), type: LogTypes.ACTION }]
      };
    }

    // March anywhere over several turns (plan §4g, routes.js): the stack in `fromRegionId` (or the
    // units in `unitIds`) gets a route to `toRegionId`. It steps at once as far as this turn's
    // points go (stepMarchesNow) and walks the rest at the start of each later turn. Giving the order is free.
    case ActionTypes.SET_ROUTE: {
      // The target is a city id or a tile id (free land).
      const { fromRegionId, toRegionId, toTile, unitIds = null, naval = false, attack = false, via = null } = action.payload || {}; // via: the tiles of a drawn path (U38)
      // March to attack (marchAttack.js): the route to an enemy city the army does not border,
      // with the intent to assault it on arrival.
      if (attack && !naval && toRegionId != null && toTile == null) {
        const order = orderMarchAttack(state, fromRegionId, toRegionId, unitIds);
        if (!order.units) return reject(state, order.reason === 'no_war' ? msg('m.act.no.marchWar') : order.reason === 'adjacent' ? msg('m.act.no.marchAdjacent') : order.reason || msg('m.act.no.march'));
        const p = order.plan;
        const who = p.units.length > 1 ? sub('m.act.unitsMarch', { n: p.units.length }) : sub('m.act.anArmyMarches');
        const dest = state.regions[toRegionId]?.name ? cityRef(toRegionId, state.regions[toRegionId].name) : place(placeName(state, p.path[p.path.length - 1]));
        // Reaching the city's ring now opens the assault at once (marchAttack.js readyAttacks).
        return stepOrdered(state, order.units, p.units, { year: state.year, ...msg('m.act.marchAttack', { who, dest, turns: aboutTurns(p.turns), stops: p.stopsAt ? sub('m.act.stoppingAt', { city: cityOr(p.stopsAt, state.regions[p.stopsAt]?.name, 'm.act.anEnemyCity') }) : '' }), type: LogTypes.ACTION });
      }
      const target = toTile != null ? toTile : toRegionId;
      const order = orderMarch(state, fromRegionId, target, unitIds, { naval, via: Array.isArray(via) ? via.filter(Number.isInteger).slice(0, 12) : null });
      if (!order.units) return reject(state, order.reasonMsg ? whyOf(order) : order.reason || msg('m.act.no.march'));
      const p = order.plan;
      return stepOrdered(state, order.units, p.units, { year: state.year, ...msg('m.act.march', { who: p.naval ? (p.units.length > 1 ? sub('m.act.whoShips', { n: p.units.length }) : sub('m.act.whoFleet')) : (p.units.length > 1 ? sub('m.act.whoUnits', { n: p.units.length }) : sub('m.act.whoArmy')), dest: place(placeName(state, p.path[p.path.length - 1])), turns: aboutTurns(p.turns) }), type: LogTypes.ACTION });
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.embarked', { unit: thing('unitClass', landUnit.classId, landUnit.classId) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DISEMBARK_UNIT: {
      // In port the unit steps ashore into the city; at sea it lands on `tile`, a land tile next to
      // the fleet on own, allied or free land (enemy land is an AMPHIBIOUS_ASSAULT).
      const { landUnitId, tile = null } = action.payload;
      const landUnit = state.units[landUnitId];
      const costs = ACTION_COSTS.disembarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || !landUnit.embarkedOn || landUnit.embarkedOn === landUnitId) return state; // a self-embarked unit lands by marching (armies.js)
      if (!canAfford(state.resources, costs)) return state;
      const ship = state.units[landUnit.embarkedOn];
      let landed;
      if (ship && atSea(state, ship)) {
        const tiles = getTiles();
        if (tile == null || !passableTile(tiles, tile) || !tiles.neighbors[ship.tile].includes(tile)) return reject(state, msg('m.act.no.pickShore'));
        const access = tileAccess(state, tile, state.playerNationId);
        if (access === 'enemy' || access === 'held' || access === 'closed') return reject(state, msg(access === 'closed' ? 'm.act.no.shoreClosed' : 'm.act.no.enemyShore'));
        landed = { ...landUnit, embarkedOn: null, tile, regionId: regionForTile(state, tile, state.playerNationId, landUnit.regionId), movesLeft: 0 };
      } else landed = { ...landUnit, embarkedOn: null, tile: state.regions[landUnit.regionId]?.tile ?? landUnit.tile };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: landed },
        logs: [...state.logs, { year: state.year, ...msg('m.act.disembarked', { unit: thing('unitClass', landUnit.classId, landUnit.classId), place: place(placeName(state, landed.tile)) }), type: LogTypes.ACTION }]
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
      const { fromRegionId, targetRegionId, smallTown = false } = action.payload;
      const v = validateInvasion(state, fromRegionId, targetRegionId);
      if (!v.ok) return refuseAttack(state, v.reason, targetRegionId);
      const ctx = getInvasionBattleContext(state, { targetRegionId, targetRegion: v.targetRegion, defenderUnits: v.defenderUnits });
      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, getResolveBattleArgs(v, ctx), { kind: 'invasion', cityId: targetRegionId, fromRegionId }, rng);
      const paid = { ...state, resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion) };
      const done = applyInvasionResult(paid, { fromRegionId, targetRegionId, war: v.war, targetRegion: v.targetRegion, isDefended: ctx.isDefended }, battle, { rngSeed: rng.getSeed(), militia: battle.inputs.militia });
      // U18: the game, not the player, chose Auto; the report opens at once and says why.
      return smallTown && !battleRequired(state, targetRegionId) ? stampAutoBecause(state, done, msg(autoSiegeOn(state, targetRegionId) ? 'm.act.autoSiege' : 'm.act.autoSmallTown', { place: cityOr(targetRegionId, REGIONS_DATA[targetRegionId]?.name, 'm.battle.theTown') })) : done;
    }

    // ---- Tactical Battles (design/rts-battles-implementation-plan.md §10.1) ----

    case ActionTypes.BEGIN_TACTICAL_BATTLE: {
      if (state.pendingBattle) return reject(state, msg('m.act.no.battleInProgress'));
      const { fromRegionId, targetRegionId, tile = null, fromTile = null, naval = false, quick = false } = action.payload;
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
          logs: [...state.logs, { year: state.year, ...msg('m.act.commandSea'), type: LogTypes.COMBAT }]
        };
      }
      if (tile != null) {
        // A commanded field battle (fieldBattle.js): the stack beside `tile` against the enemy on it.
        const fv = validateFieldAttack(state, fromRegionId, tile);
        if (!fv.ok) return refuseAttack(state, fv.reason, fromRegionId);
        // Decision 41: outside both sides' borders the clash is fought on Auto only.
        if (isNoMansLand(state, tile, state.playerNationId, fv.defenderNationId)) return reject(state, msg('m.q.noMans'));
        const frng = createRng(state.rngSeed);
        const fseed = Math.floor(frng.next() * 0xffffffff) >>> 0;
        const fcounter = (state.battleCounter || 0) + 1;
        const anchor = state.world?.tileOwner?.[tile] ?? fromRegionId;
        const [attackerReinforcements, defenderReinforcements] = fieldReinforcements(state, fv); // rank 9
        return {
          ...state,
          resources: applyCosts(state.resources, ACTION_COSTS.launchInvasion),
          rngSeed: frng.getSeed(),
          battleCounter: fcounter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${fcounter}`, kind: 'field', fromRegionId, tile, targetRegionId: anchor, warId: fv.war?.id ?? null,
            attackerNationId: state.playerNationId, defenderNationId: fv.defenderNationId, seed: fseed, startedTurn: state.turnNumber, playerSide: 'attacker',
            attackerUnitIds: fv.attackerUnits.map((u) => u.id), defenderUnitIds: fv.defenderUnits.map((u) => u.id), attackerReinforcements, defenderReinforcements,
            ...(quick ? { quick: true } : {}) // the player's quick field battle: 5 minutes, no base-building (buildFieldSetup)
          },
          logs: [...state.logs, { year: state.year, ...msg('m.act.commandField'), type: LogTypes.COMBAT }]
        };
      }
      const v = validateInvasion(state, fromRegionId, targetRegionId);
      if (!v.ok) return refuseAttack(state, v.reason, targetRegionId);
      // Command takes a city it wins, garrison or not (the user's rule of 14 October): an empty city
      // is fought against its militia and walls. With not even a militia there is nobody to command
      // against: the attack is fought on Auto (cityAssault.js, against its defences).
      // The result says so (DEF-01): the card could not tell a city it has no intel on was empty.
      if (v.defenderUnits.length === 0 && !cityMilitia(state, targetRegionId).length) {
        return stampAutoBecause(state, gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId, targetRegionId } }), msg('m.act.autoNoDefenders', { place: cityOr(targetRegionId, REGIONS_DATA[targetRegionId]?.name, 'm.battle.theTown') }));
      }
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.commandInvasion', { city: cityRef(targetRegionId, REGIONS_DATA[targetRegionId]?.name) }), type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.RESOLVE_TACTICAL_BATTLE: {
      const pb = state.pendingBattle;
      const { battleId } = action.payload || {};
      if (!pb || pb.id !== battleId) return state;
      // A finished battle never vanishes without a word (plan W02 task 9): when it changed nothing
      // (peace was made meanwhile, the target can no longer be fought, its queued record is gone)
      // no report is recorded, and the Log says so.
      if (!action.settling) {
        const done = reduceAction(state, { ...action, settling: true });
        if ((done.battleReportSeq || 0) !== (state.battleReportSeq || 0)) return done;
        const where = cityOr(pb.targetRegionId, state.regions[pb.targetRegionId]?.name || REGIONS_DATA[pb.targetRegionId]?.name, 'm.act.theField');
        const why = sub(pb.warId && !state.wars.some((w) => w.id === pb.warId && w.active) ? 'm.act.voidPeace' : 'm.act.voidGone');
        // English: `${BATTLE_VOID_PREFIX} <place> changed nothing: <why>.` (battleReceipt.js reads the prefix).
        return { ...done, logs: [...done.logs, { year: state.year, ...msg('m.act.battleVoid', { place: where, why }), type: LogTypes.COMBAT }] };
      }
      // With the command log, the battle is re-simulated here from the authoritative game state
      // (battleVerify.js: THE commanded setup the screen fought, the log through the live battle's
      // own order schema), and the client's reported result is ignored. This is what the edge
      // function runs too. Without a log, or with a log of another setup version, the reported
      // result is sanitized; the report keeps how the battle was checked (tactical.verification).
      const checked = verifyCommandedBattle(state, pb, action.payload);
      const result = checked.result;
      // The units that took the field: one missing from the result is lost, never handed back whole.
      const ledger = { fielded: checked.setup ? fieldedUnitIds(checked.setup) : null };
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
        const safe = sanitizeTacticalResult(state, pb, result, ledger);
        const opts = { mode: 'command', decisive: safe.report.tactical.decisive, xpBonusById: safe.report.tactical.xpBonusById };
        return pb.kind === 'intercept' ? resolveInterceptQueued(cleared, def, safe, opts) : resolveLandingQueued(cleared, def, safe, opts);
      }
      // A raid or a sack against the player (raidBattle.js): the queued record's id, then the raid carries on (raids.js).
      if (pb.defenseId && isRaidKind(pb.kind)) {
        const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
        if (!def) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result, ledger);
        return resolveRaidBattle(cleared, def, safe, { mode: 'command', xpBonusById: safe.report.tactical.xpBonusById });
      }
      const aiStarted = !!pb.defenseId && (pb.kind === 'field' || pb.kind === 'naval');
      const gateState = aiStarted ? aggressorView(cleared, pb.attackerNationId) : cleared;
      const sideOpts = aiStarted ? { ...opts, id: pb.defenseId, defenseId: pb.defenseId, attackerNationId: pb.attackerNationId, viewerId: state.playerNationId } : opts;
      if (pb.kind === 'naval') {
        const nv = validateFleetAttack(gateState, pb.fromTile, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!nv.ok || (pb.warId && !war)) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result, ledger);
        const vv = { ...nv, attackerUnits: nv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: nv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)), war };
        return applyFleetResult(cleared, vv, safe, sideOpts);
      }
      if (pb.kind === 'field') {
        const fv = validateFieldAttack(gateState, pb.fromRegionId, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!fv.ok || (pb.warId && !war)) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result, ledger);
        const vv = { ...fv, attackerUnits: fv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: fv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)), war };
        return applyFieldResult(cleared, vv, safe, { ...sideOpts, xpBonusById: safe.report.tactical.xpBonusById });
      }
      if (pb.kind === 'defense') {
        const def = (state.pendingDefenses || []).find((d) => d.id === pb.defenseId);
        if (!def) return cleared;
        const safe = sanitizeTacticalResult(state, pb, result, ledger);
        return applyDefenseResult(cleared, def, safe, { decisive: safe.report.tactical.decisive, xpBonusById: safe.report.tactical.xpBonusById, mode: 'command', militia: pb.militia || [] });
      }
      // An assault on an independent has no war (hostility.js): it stands while the target may still be attacked.
      if (!targetRegion || (pb.warId ? !war : !canAttack(state, pb.attackerNationId || state.playerNationId, targetRegion.owner))) return cleared;
      const safe = sanitizeTacticalResult(state, pb, result, ledger);
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
      // `payload.switchAt` ({ log, tick, hash, setupKey, setupVersion }, battleLoop.js snapshot):
      // the battle was commanded up to that tick, and Auto goes on from there, never from the start.
      const pb = state.pendingBattle;
      if (!pb) return state;
      // A battle the screen could not show (TacticalBattleHost): settled the same way, with a log
      // line saying why, so the player never wonders where the battle went.
      const reason = action.payload?.reason;
      if (reason) {
        const settled = gameReducer(state, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { switchAt: action.payload?.switchAt } });
        // DEF-01: the result itself says the player's Command became Auto, and why, not only the Log.
        const told = stampAutoBecause(state, settled, msg('m.act.autoBecause', { why: sub(ABANDON_REASONS[reason] ? `m.act.abandon.${reason}` : 'm.act.abandon.default') }));
        const where = cityOr(pb.targetRegionId, state.regions[pb.targetRegionId]?.name || REGIONS_DATA[pb.targetRegionId]?.name, 'm.act.theField');
        return { ...told, logs: [...settled.logs, { year: state.year, ...msg('m.act.settledOnAuto', { place: where, why: sub(ABANDON_REASONS[reason] ? `m.act.abandon.${reason}` : 'm.act.abandon.default') }), type: LogTypes.COMBAT }] };
      }
      // H-01: switched to Auto part-way through a commanded battle, Auto goes on from the battle as it
      // stood (battleSwitch.js: the log replayed to the switch; every Auto below gets it as spec.from).
      const from = switchedBattleState(state, pb, action.payload?.switchAt);
      const cleared = { ...state, pendingBattle: null };
      const opts = { rngSeed: state.rngSeed, id: pb.id, mode: 'auto' };
      // A queued battle (a defence, or a field or sea battle the AI started): its own Auto.
      if (pb.defenseId) return resolveQueuedAuto(cleared, pb.defenseId, { from });
      if (pb.kind === 'naval') {
        const nv = validateFleetAttack(cleared, pb.fromTile, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!nv.ok) return cleared;
        const vv = { ...nv, attackerUnits: nv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: nv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)) };
        if (!vv.attackerUnits.length || !vv.defenderUnits.length) return cleared;
        const battle = resolveAutoBattle(cleared, getFleetResolveArgs(vv, getFleetBattleContext(cleared, vv)), { kind: 'naval', from }, createRng(pb.seed));
        return applyFleetResult(cleared, vv, battle, opts);
      }
      if (pb.kind === 'field') {
        const fv = validateFieldAttack(cleared, pb.fromRegionId, pb.tile, { ignoreCost: true, ignoreBattleLocks: true });
        if (!fv.ok) return cleared;
        const vv = { ...fv, attackerUnits: fv.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id)), defenderUnits: fv.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id)) };
        if (!vv.attackerUnits.length || !vv.defenderUnits.length) return cleared;
        const battle = resolveAutoBattle(cleared, getFieldResolveArgs(vv, getFieldBattleContext(cleared, vv)), { kind: 'field', fromRegionId: pb.fromRegionId, from }, createRng(pb.seed));
        return applyFieldResult(cleared, vv, battle, opts);
      }
      if (pb.kind === 'amphibious') {
        const av = validateAmphibious(cleared, pb.navalUnitId, pb.targetRegionId, { ignoreCost: true, ignoreBattleLocks: true });
        if (!av.ok) return cleared;
        const attackers = av.embarkedLandUnits.filter((u) => pb.attackerUnitIds.includes(u.id));
        const defenders = av.defenderLandUnits.filter((u) => pb.defenderUnitIds.includes(u.id));
        if (!attackers.length) return cleared;
        const actx = getAmphibiousBattleContext(cleared, av, defenders);
        const battle = resolveAutoBattle(cleared, { attackerUnits: attackers, defenderUnits: defenders, ...actx }, { kind: 'landing', cityId: pb.targetRegionId, fromRegionId: pb.fromRegionId, militia: pb.militia, from }, createRng(pb.seed));
        return applyAmphibiousLanding(cleared, { navalUnitId: pb.navalUnitId, fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war: av.war, targetRegion: av.targetRegion, isDefended: defenders.length > 0 }, battle, { ...opts, militia: battle.inputs.militia });
      }
      const v = validateInvasion(cleared, pb.fromRegionId, pb.targetRegionId, { ignoreCost: true, ignoreBattleLocks: true });
      if (!v.ok) return cleared;
      const attackers = v.attackerUnits.filter((u) => pb.attackerUnitIds.includes(u.id));
      const defenders = v.defenderUnits.filter((u) => pb.defenderUnitIds.includes(u.id));
      if (!attackers.length) return cleared;
      const vv = { ...v, attackerUnits: attackers, defenderUnits: defenders };
      const ctx = getInvasionBattleContext(cleared, { targetRegionId: pb.targetRegionId, targetRegion: v.targetRegion, defenderUnits: defenders });
      const battle = resolveAutoBattle(cleared, getResolveBattleArgs(vv, ctx), { kind: 'invasion', cityId: pb.targetRegionId, fromRegionId: pb.fromRegionId, militia: pb.militia, from }, createRng(pb.seed));
      return applyInvasionResult(cleared, { fromRegionId: pb.fromRegionId, targetRegionId: pb.targetRegionId, war: v.war, targetRegion: v.targetRegion, isDefended: ctx.isDefended }, battle, { ...opts, militia: battle.inputs.militia });
    }

    // ---- Commanded amphibious landing (Tactical Battles T9) ----

    case ActionTypes.BEGIN_AMPHIBIOUS_BATTLE: {
      if (state.pendingBattle) return reject(state, msg('m.act.no.battleInProgress'));
      const { navalUnitId, targetRegionId } = action.payload || {};
      const v = validateAmphibious(state, navalUnitId, targetRegionId);
      if (!v.ok) return refuseAttack(state, v.reason, targetRegionId);
      // An enemy fleet has to be fought at sea first, and an empty beach needs no battle: both go
      // through the auto-resolved assault exactly as before.
      if (v.defenderNavalUnits.length || !v.defenderLandUnits.length) {
        return stampAutoBecause(state, gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId } }), msg(v.defenderNavalUnits.length ? 'm.act.autoFleet' : 'm.act.autoBeach'));
      }
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.commandLanding', { city: cityRef(targetRegionId, REGIONS_DATA[targetRegionId]?.name) }), type: LogTypes.COMBAT }]
      };
    }

    // ---- The battle queue (battleQueue.js): battles others started against the player ----
    // City assaults (defense.js), field battles and sea battles the AI started, in the order its
    // armies moved. Each is fought on Command or Auto; none while an event or a peace offer waits.

    case ActionTypes.RESOLVE_DEFENSE_AUTO:
      if (state.pendingBattle?.defenseId === action.payload?.defenseId) return state;
      if (battleQueueBlocked(state)) return reject(state, msg('m.act.no.answerFirst'));
      return resolveQueuedAuto(state, action.payload?.defenseId);

    case ActionTypes.RESOLVE_ALL_DEFENSES_AUTO:
      // A battle already being commanded is left alone; everything else is fought now, in order.
      if (battleQueueBlocked(state)) return reject(state, msg('m.act.no.answerFirst'));
      return resolveAllQueuedAuto(state);

    case ActionTypes.WITHDRAW_FROM_DEFENSE: {
      if (state.pendingBattle?.defenseId === action.payload?.defenseId) return state;
      const queued = (state.pendingDefenses || []).find((d) => d.id === action.payload?.defenseId);
      if (queued && queuedKind(queued) !== 'defense') return reject(state, msg('m.act.no.fieldNoWithdraw'));
      const w = applyDefenseWithdrawal(state, action.payload?.defenseId);
      return w.ok ? w.state : reject(state, msg(w.reason === 'nowhere' ? 'm.act.no.nowhereToFall' : 'm.act.no.assaultOver'));
    }

    case ActionTypes.BEGIN_DEFENSE_BATTLE: {
      if (state.pendingBattle) return reject(state, msg('m.act.no.battleInProgress'));
      if (battleQueueBlocked(state)) return reject(state, msg('m.act.no.answerFirst'));
      const def = (state.pendingDefenses || []).find((d) => d.id === action.payload?.defenseId);
      if (!def) return state;
      // DEF-01: Command that cannot open is refused with the reason the card already shows
      // (queuedCommandBlock), never fought on Auto behind the player's back.
      const block = queuedCommandBlock(state, def);
      if (block) return reject(state, block.textMsg ? msg(block.textMsg.key, block.textMsg.vars) : block.text);
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
          logs: [...state.logs, { year: state.year, ...(kind === 'intercept' ? msg('m.act.commandIntercept', { nation: nationOr(state, def.aggressorId, 'm.act.theEnemy') }) : msg('m.act.commandBeach', { city: cityRef(def.regionId, REGIONS_DATA[def.regionId]?.name) })), type: LogTypes.COMBAT }]
        };
      }
      if (isRaidKind(kind)) {
        // Raiders against the player's troops or town: the player defends (raidBattle.js).
        const armies = queuedRaidArmies(state, def);
        if (!armies.attackerUnits.length || (!armies.defenderUnits.length && kind !== 'sack')) return resolveQueuedAuto(state, def.id);
        if (kind === 'raid' && isNoMansLand(state, def.tile, def.aggressorId, state.playerNationId)) return reject(state, msg('m.q.noMans')); // decision 41
        return {
          ...state,
          battleCounter: counter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${counter}`, kind, defenseId: def.id, raidKind: def.raidKind,
            fromRegionId: null, fromTile: def.fromTile ?? null, tile: def.tile, targetRegionId: def.regionId, cityId: def.cityId ?? null, warId: null,
            attackerNationId: def.aggressorId, defenderNationId: state.playerNationId, seed: def.seed, startedTurn: state.turnNumber, playerSide: 'defender',
            attackerUnitIds: armies.attackerUnits.map((u) => u.id), defenderUnitIds: armies.defenderUnits.map((u) => u.id), attackerReinforcements: [], defenderReinforcements: [], militia: def.militia || []
          },
          logs: [...state.logs, { year: state.year, ...msg('m.act.commandRaid', { nation: nationOr(state, def.aggressorId, 'm.act.theRaiders') }), type: LogTypes.COMBAT }]
        };
      }
      if (kind !== 'defense') {
        // A field or sea battle the AI started against the player's stack: the player defends it.
        // A fort that stopped the player's army (forts.js): the player attacks it.
        const armies = queuedArmies(state, def);
        if (!armies) return resolveQueuedAuto(state, def.id);
        const attacking = def.aggressorId === state.playerNationId;
        const foe = attacking ? armies.v.defenderNationId : def.aggressorId;
        if (kind === 'field' && isNoMansLand(state, def.tile, state.playerNationId, foe)) return reject(state, msg('m.q.noMans')); // decision 41
        const [attackerReinforcements, defenderReinforcements] = kind === 'field' ? fieldReinforcements(state, armies.v) : [[], []]; // rank 9
        return {
          ...state,
          battleCounter: counter,
          pendingBattle: {
            id: `b_${state.turnNumber}_${counter}`, kind, defenseId: def.id, fort: !!def.fort,
            fromRegionId: def.fromRegionId, fromTile: def.fromTile ?? null, tile: def.tile, targetRegionId: state.world?.tileOwner?.[def.tile] ?? def.regionId, warId: def.warId,
            attackerNationId: def.aggressorId, defenderNationId: attacking ? foe : state.playerNationId, seed: def.seed, startedTurn: state.turnNumber, playerSide: attacking ? 'attacker' : 'defender',
            attackerUnitIds: armies.v.attackerUnits.map((u) => u.id), defenderUnitIds: armies.v.defenderUnits.map((u) => u.id), attackerReinforcements, defenderReinforcements
          },
          logs: [...state.logs, { year: state.year, ...(attacking ? msg('m.act.commandFort', { nation: people(foe, state.nations[foe]?.name || foe) }) : msg(kind === 'naval' ? 'm.act.commandFleetVs' : 'm.act.commandArmyVs', { nation: people(def.aggressorId, state.nations[def.aggressorId]?.name || def.aggressorId) })), type: LogTypes.COMBAT }]
        };
      }
      const armies = getDefenseArmies(state, def);
      // A city with no regiment in it is fought by its militia (the user's rule of 14 October, as
      // for the player's own attacks): win and it holds, lose and it falls. queuedCommandBlock has
      // already refused a battle with nobody on a side.
      const militia = cityMilitia(state, def.regionId);
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
          militia
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.commandDefense', { city: cityRef(def.regionId, REGIONS_DATA[def.regionId]?.name) }), type: LogTypes.COMBAT }]
      };
    }

    // battleSettings: `defaultMode` only PRE-SELECTS a choice in the pre-battle modal (your own
    // attacks always ask); `autoDefend` is the one explicit opt-in to auto-resolve enemy assaults.
    case ActionTypes.SET_BATTLE_SETTINGS: {
      const next = { ...(state.battleSettings || {}), ...(action.payload || {}) };
      if (!['ask', 'auto', 'command'].includes(next.defaultMode)) next.defaultMode = 'ask';
      next.autoDefend = next.autoDefend === true;
      next.smallTowns = next.smallTowns === 'ask' ? 'ask' : 'auto';
      next.smallTownDefense = next.smallTownDefense === 'auto' ? 'auto' : 'ask';
      next.instantBattles = next.instantBattles === true; // skip the auto-resolve replay
      return { ...state, battleSettings: next };
    }

    // "Auto until the siege ends" (battleThreshold.js autoSiegeOn): only for a city under siege now.
    case ActionTypes.SET_AUTO_SIEGE: {
      const { regionId, on } = action.payload;
      const siege = state.regions?.[regionId]?.siege;
      const rest = { ...state.autoSieges };
      delete rest[regionId];
      if (!on) return { ...state, autoSieges: rest };
      return siege ? { ...state, autoSieges: { ...rest, [regionId]: siege.startedTurn } } : state;
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
      const attackerAgeId = ageOf(state, state.playerNationId);
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
          generals: commandGenerals(state),
          attackerAgeId,
          defenderAgeId: sideAgeOf(state, defenderNavalUnits[0].ownerId)
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
          return { ...paid, units, logs: [...paid.logs, { year: state.year, ...msg('m.act.fleetSunk', { city: cityRef(targetRegionId, REGIONS_DATA[targetRegionId]?.name) }), type: LogTypes.COMBAT }] };
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
        generals: commandGenerals(state),
        attackerAgeId,
        defenderAgeId: sideAgeOf(state, targetRegion.owner),
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
      const isSeaLaneReachable = isReachableBySea(fromRegionId, targetRegionId, ageOf(state, state.playerNationId));
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
      if (defenderNavalUnits.length === 0) return reject(state, msg('m.act.no.atPeaceFleet', { nation: nationOr(state, presentNavalUnits[0].ownerId, 'm.act.thatFleetsNation') }));
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const battle = resolveAutoBattle(state, {
        attackerUnits: attackerNavalUnits,
        defenderUnits: defenderNavalUnits,
        terrain: getRegionTerrain(targetRegionId, REGIONS_DATA),
        isAttackingFortification: false,
        generals: commandGenerals(state),
        attackerAgeId: ageOf(state, state.playerNationId),
        defenderAgeId: sideAgeOf(state, defenderNavalUnits[0].ownerId)
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
        generals: commandGenerals(state),
        attackerAgeId: ageOf(state, state.playerNationId),
        defenderAgeId: ageOf(state, region.owner) // rebels fight at their host's age
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
      return { ...state, research, logs: [...state.logs, { year: state.year, ...msg('m.act.nowResearching', { tech: thing('tech', research.current, TECH_TREE[research.current]?.name), then: research.queue.length ? sub('m.act.researchThen', { list: techList(research.queue) }) : '' }), type: LogTypes.TECH }] };
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

    case ActionTypes.CHOOSE_AGE_LANDMARK: {
      // The age landmark fork (ageLandmarks.js): the oldest age waiting for its pick, once.
      const { ageId, landmarkId } = action.payload || {};
      const me = state.nations[state.playerNationId];
      if (!me || pendingLandmarkAge(state) !== ageId) return state;
      const next = withLandmark(me, ageId, landmarkId);
      if (next === me) return state;
      const landmark = landmarkOf(ageId, landmarkId);
      return {
        ...state,
        nations: { ...state.nations, [me.id]: next },
        logs: [...state.logs, { year: state.year, ...msg('m.world.landmark', { landmark: thing('landmark', landmarkId, landmark.name), age: thing('age', ageId, AGES[ageId]?.name) }), type: LogTypes.MILESTONE }]
      };
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.researchFocus', { focus: thing('techCategory', categoryId, categoryId) }), type: LogTypes.TECH }]
      };
    }

    case ActionTypes.FUND_SCHOLARS: {
      const costs = ACTION_COSTS.fundScholars;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: { ...applyCosts(state.resources, costs), techPoints: (state.resources.techPoints || 0) + FUND_SCHOLARS_TECHPOINTS },
        logs: [...state.logs, { year: state.year, ...msg('m.act.fundedScholars', { n: FUND_SCHOLARS_TECHPOINTS }), type: LogTypes.TECH }]
      };
    }

    case ActionTypes.CHANGE_GOVERNMENT_TYPE: {
      const { typeId, reforms: pickedReforms } = action.payload; // reforms: optional { [ageId]: reformId } the player chose (I140)
      const type = GOVERNMENT_TYPES[typeId];
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.changeGovernmentType;
      if (!type || !canChangeGovernmentType(nation, typeId, ageOf(state, state.playerNationId), stonePhaseOf(state, state.playerNationId), getResearched(state, state.playerNationId))) return state;
      if (!canPay(state, costs)) return state;
      return payCost({
        ...state,
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            government: { type: typeId, reforms: resetReformsForType(typeId, ageOf(state, state.playerNationId), pickedReforms) },
            stability: clampStability((nation.stability || 0) - 2)
          }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.governmentChanged', { gov: thing('government', typeId, type.name) }), type: LogTypes.MILESTONE }]
      }, costs, 'changeGovernmentType');
    }

    case ActionTypes.ENACT_GOVERNMENT_REFORM: {
      const { ageId, reformId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.enactGovernmentReform;
      if (!canEnactReform(nation, ageId, reformId, ageOf(state, state.playerNationId))) return state;
      if (!canPay(state, costs)) return state;
      const reform = getReformChoices(nation.government.type, ageId).find((r) => r.id === reformId);
      return payCost({
        ...state,
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...nation, government: { ...nation.government, reforms: { ...nation.government.reforms, [ageId]: reformId } } }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.reformEnacted', { reform: thing('reform', reformId, reform.name) }), type: LogTypes.MILESTONE }]
      }, costs, 'enactGovernmentReform');
    }

    case ActionTypes.WORLD_CONGRESS_VOTE: {
      // Only a member votes; null abstains. Counted at the next vote (worldCongress.js).
      const vote = action.payload?.vote ?? null;
      if (!state.worldCongress || ![null, 'yes', 'no'].includes(vote) || !congressMembers(state).includes(state.playerNationId)) return state;
      return { ...state, worldCongress: { ...state.worldCongress, playerVote: vote } };
    }

    case ActionTypes.CHANGE_LAW: {
      const { category, lawId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const law = getLaw(category, lawId);
      if (!law || !canEnactLaw(state, state.playerNationId, category, lawId)) return state;
      const costs = lawChangeCost(nation);
      if (!canPay(state, costs)) return state;

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

      return payCost({
        ...state,
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            laws: { ...nation.laws, [category]: lawId },
            lawCooldowns: { ...nation.lawCooldowns, [category]: state.turnNumber + LAW_CHANGE_COOLDOWN_TURNS },
            modifiers,
            stability,
            freeLawChange: false
          }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.lawEnacted', { law: thing('law', lawId, law.name) }), type: LogTypes.MILESTONE }]
      }, costs, 'changeLaw');
    }

    case ActionTypes.SHIFT_IDENTITY: {
      const { axis, direction } = action.payload;
      const nation = state.nations[state.playerNationId];
      const axisSpec = IDENTITY_AXES[axis];
      const costs = ACTION_COSTS.shiftIdentity;
      if (!axisSpec || (direction !== 1 && direction !== -1)) return state;
      if ((state.turnNumber || 0) < (nation.identityShiftCooldownTurn || 0)) return state;
      if (!canPay(state, costs)) return state;
      const currentValue = nation.identity?.[axis] || 0;
      const nextValue = clampIdentity(currentValue + direction * IDENTITY_SHIFT_STEP);
      if (nextValue === currentValue) return state;
      const poleName = direction > 0 ? axisSpec.positivePole : axisSpec.negativePole;
      return payCost({
        ...state,
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            identity: { ...nation.identity, [axis]: nextValue },
            identityShiftCooldownTurn: state.turnNumber + IDENTITY_SHIFT_COOLDOWN_TURNS
          }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.identityShift', { pole: thing('identityPole', `${axis}.${direction > 0 ? 'pos' : 'neg'}`, poleName) }), type: LogTypes.ACTION }]
      }, costs, 'shiftIdentity');
    }

    case ActionTypes.DECLARE_WAR: {
      if (exploreOn(state)) return state;
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
      if (!canPay(state, costs)) return state;

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

      return payCost({
        ...afterWar,
        nations: nextNations,
        regions: nextRegions,
        logs: [...afterWar.logs, {
          year: state.year,
          ...msg(breakingTruce ? 'm.act.warBreakTruce' : justified ? 'm.act.warJustified' : 'm.act.warUnjustified', { nation: people(nationId, target.name), stability: TRUCE_BREAK_STABILITY_PENALTY, prestige: TRUCE_BREAK_PRESTIGE_PENALTY }),
          type: LogTypes.DIPLOMACY
        }]
      }, costs, justified ? 'declareWarJustified' : 'declareWarUnjustified');
    }

    case ActionTypes.FABRICATE_CLAIM: {
      // Claims are on cities (claims.js): `cityId`, or the nearest claimable city of `nationId`.
      const { nationId, cityId } = action.payload;
      const player = state.nations[state.playerNationId];
      const city = cityId ? state.regions[cityId] : claimableCities(state, state.playerNationId, nationId)[0]?.city;
      if (!city || !canFabricateClaim(state, state.playerNationId, city.id).ok) return state;
      const costs = ACTION_COSTS.fabricateClaim;
      if (!canPay(state, costs)) return state;
      return payCost({
        ...state,
        nations: { ...state.nations, [state.playerNationId]: startClaim(player, city.id, state.turnNumber) },
        logs: [...state.logs, { year: state.year, ...msg('m.act.claimStarted', { city: cityRef(city.id, city.name), nation: people(city.owner, state.nations[city.owner]?.name || city.owner), turns: CLAIM_FABRICATE_TURNS }), type: LogTypes.DIPLOMACY }]
      }, costs, 'fabricateClaim');
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
      const costs = { gold: Math.max(SUE_FOR_PEACE_MIN_GOLD, Math.round(SUE_FOR_PEACE_BASE_GOLD - target.warExhaustion * 2)) };
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.peaceTreaty', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
        return { ...state, logs: [...state.logs, { year: state.year, ...msg('m.act.peaceRejected', { nation: people(recipient.id, recipient.name) }), type: LogTypes.DIPLOMACY }] };
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.peaceSigned', { nation: people(recipient.id, recipient.name) }), type: LogTypes.DIPLOMACY }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.peaceAccepted', { nation: people(offer.from, nextNations[offer.from]?.name || offer.from) }), type: LogTypes.DIPLOMACY }, ...applied.logs]
      };
    }

    case ActionTypes.REJECT_PENDING_PEACE: {
      const offer = state.pendingPeaceOffer;
      if (!offer) return state;
      return {
        ...state,
        pendingPeaceOffer: null,
        wars: state.wars.map(w => (w.id === offer.warId ? { ...w, peaceOfferCooldownTurn: state.turnNumber + PEACE_OFFER_COOLDOWN_TURNS } : w)),
        logs: [...state.logs, { year: state.year, ...msg('m.act.peaceOfferRejected', { nation: people(offer.from, state.nations[offer.from]?.name || offer.from) }), type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.TRADE_AGREEMENT: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.tradeAgreement;
      if (!target || target.hasTradeAgreement) return state;
      if (target.isAtWar) return reject(state, msg('m.act.no.tradeWar', { nation: people(target.id, target.name) }));
      // Trade Pact capacity (plan §M8.3/§M12) — Globalism/Isolationism identity swings it; see
      // diplomacy.js's getTradePactCapacity. Counts every OTHER nation currently pacted with the
      // player, since hasTradeAgreement lives on the target's own record.
      const activePactCount = Object.values(state.nations).filter((n) => n.hasTradeAgreement).length;
      const tradeCap = getTradePactCapacity(state.nations[state.playerNationId]);
      if (activePactCount >= tradeCap) return reject(state, msg('m.act.no.tradeFull', { a: activePactCount, b: tradeCap }));
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [nationId]: { ...target, hasTradeAgreement: true, relationStatus: RelationStatus.FRIENDLY } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.tradeAgreement', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
        return { ...state, resources: applyCosts(state.resources, costs), logs: [...state.logs, { year: state.year, ...msg('m.act.bordersRefused', { nation: people(nationId, target.name), opinion: answer.opinion, needed: answer.needed, war: answer.atWar ? sub('m.act.andAtWar') : '' }), type: LogTypes.DIPLOMACY }] };
      }
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: setOpenBorders(state.nations, state.playerNationId, nationId, true),
        logs: [...state.logs, { year: state.year, ...msg('m.act.bordersOpened', { nation: people(nationId, target.name) }), type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.PROPOSE_STELE: {
      // The Border Stele (accords.js): past the village phase; the AI agrees at STELE_OPINION; the offer costs either way.
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.borderStele;
      const me = state.playerNationId;
      if (!target || target.isEliminated || nationId === me || isIndependentNation(target) || hasStele(state, me, nationId)) return state;
      if (!canAnnex(state, me)) return reject(state, msg('m.act.no.steleVillage'));
      if (!canAfford(state.resources, costs)) return state;
      const answer = steleAcceptance(state, nationId);
      const resources = applyCosts(state.resources, costs);
      if (!answer.accepted) return { ...state, resources, logs: [...state.logs, { year: state.year, ...msg('m.act.steleRefused', { nation: people(nationId, target.name), opinion: answer.opinion, needed: answer.needed, war: answer.atWar ? sub('m.act.andAtWar') : '' }), type: LogTypes.DIPLOMACY }] };
      const turns = steleTurns(state, me, nationId);
      return {
        ...state, resources,
        nations: setStele(state.nations, me, nationId, (state.turnNumber || 0) + turns),
        logs: [...state.logs, { year: state.year, ...msg('m.act.steleRaised', { nation: people(nationId, target.name), turns }), type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.CLOSE_BORDERS: {
      const { nationId } = action.payload;
      if (!state.nations[nationId] || !hasOpenBorders(state, state.playerNationId, nationId)) return state;
      return { ...state, nations: setOpenBorders(state.nations, state.playerNationId, nationId, false), logs: [...state.logs, { year: state.year, ...msg('m.act.bordersClosed', { nation: people(nationId, state.nations[nationId].name) }), type: LogTypes.DIPLOMACY }] };
    }

    case ActionTypes.DEMAND: {
      // Demands (accords.js): tribute, a claimed city, or a stop to settling near you.
      const { nationId, kind, cityId = null } = action.payload;
      const costs = ACTION_COSTS.demand;
      if (!state.nations[nationId] || nationId === state.playerNationId || !DEMANDS[kind]) return state;
      if (!canPay(state, costs)) return state;
      const r = applyDemand(state, nationId, kind, cityId);
      if (r.state === state) return state;
      return payCost({ ...r.state, logs: [...r.state.logs, { year: state.year, ...carry(r), type: LogTypes.DIPLOMACY }] }, costs, 'demand');
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
      if (acceptanceScore < 0) return reject(state, msg('m.act.no.allianceRefused', { nation: people(target.id, target.name), score: Math.round(acceptanceScore) }));
      if (!canPay(state, costs)) return state;
      return payCost({
        ...state,
        nations: { ...state.nations, [nationId]: { ...target, hasMilitaryPact: true, relationStatus: RelationStatus.ALLIED } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.allianceFormed', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
      }, costs, 'militaryAlliance');
    }

    case ActionTypes.GIFT_BRIBE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.giftBribe;
      if (!target) return state;
      if (!canAfford(state.resources, costs)) return state;
      // A gift lowers the grudge and adds a fading warmth (opinion.js withGift): a stranger has no grudge to lower.
      const gifted = withGift(state, nationId, state.playerNationId);
      const nations = { ...state.nations, [nationId]: { ...gifted, hostility: Math.max(target.hostilityFloor || 0, (target.hostility || 0) - GIFT_HOSTILITY_REDUCTION) } };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations,
        logs: [...state.logs, { year: state.year, ...msg('m.act.giftSent', { nation: people(target.id, target.name), opinion: opinionOf({ ...state, nations }, nationId) }), type: LogTypes.DIPLOMACY }]
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
            logs: [...state.logs, { year: state.year, ...msg('m.act.spyMapped', { nation: people(target.id, target.name), turns: INTEL_DURATION_TURNS }), type: LogTypes.DIPLOMACY }]
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
            logs: [...state.logs, { year: state.year, ...msg('m.act.spyUnrest', { city: cityRef(targetRegionId, REGIONS_DATA[targetRegionId]?.name || targetRegionId) }), type: LogTypes.DIPLOMACY }]
          };
        }
        return {
          ...state,
          resources: { ...resourcesAfterCost, techPoints: (resourcesAfterCost.techPoints || 0) + ESPIONAGE_TECH_POINTS_STOLEN },
          intel,
          rngSeed: rng.getSeed(),
          logs: [...state.logs, { year: state.year, ...msg('m.act.spyTech', { nation: people(target.id, target.name), n: ESPIONAGE_TECH_POINTS_STOLEN }), type: LogTypes.DIPLOMACY }]
        };
      }
      return {
        ...state,
        resources: resourcesAfterCost,
        nations: { ...state.nations, [nationId]: { ...target, hostility: Math.min(100, target.hostility + ESPIONAGE_FAILURE_HOSTILITY_INCREASE) } },
        rngSeed: rng.getSeed(),
        logs: [...state.logs, { year: state.year, ...msg('m.act.spyCaught', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
        resources: resourcesAfterCost,
        nations: { ...state.nations, [target.id]: { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - COUNTER_INTEL_HOSTILITY_REDUCTION) } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.counterIntel', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.rival', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
      if (!canPay(state, costs)) return state;
      const nextTarget = { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - MARRIAGE_HOSTILITY_REDUCTION) };
      return payCost({
        ...state,
        nations: { ...state.nations, [state.playerNationId]: { ...player, marriageWith: [...(player.marriageWith || []), nationId] }, [nationId]: nextTarget },
        logs: [...state.logs, { year: state.year, ...msg('m.act.royalMarriage', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
      }, costs, 'proposeMarriage');
    }

    case ActionTypes.BREAK_ALLIANCE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target || !target.hasMilitaryPact) return state;
      return {
        ...state,
        nations: { ...state.nations, [nationId]: { ...target, hasMilitaryPact: false, hostility: Math.min(100, (target.hostility || 0) + BREAK_ALLIANCE_HOSTILITY_INCREASE) } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.allianceBroken', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
      };
    }

    case ActionTypes.INSULT: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      if (!target) return state;
      return {
        ...state,
        nations: { ...state.nations, [nationId]: { ...target, hostility: Math.min(100, (target.hostility || 0) + INSULT_HOSTILITY_INCREASE) } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.insulted', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.diplomatSent', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
      if (!canPay(state, costs)) return state;
      return payCost({
        ...state,
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, vassals: [...(player.vassals || []), nationId] },
          [nationId]: { ...target, vassalOf: state.playerNationId, vassalizedTurn: state.turnNumber }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.vassalized', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
      }, costs, 'vassalize');
    }

    case ActionTypes.ANNEX_VASSAL: {
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      if (!target || target.vassalOf !== state.playerNationId) return state;
      if (state.turnNumber < (target.vassalizedTurn || 0) + VASSAL_ANNEX_COOLDOWN_TURNS) return state;
      const costs = ACTION_COSTS.annexVassal;
      if (!canPay(state, costs)) return state;
      const nextRegions = { ...state.regions };
      Object.keys(nextRegions).forEach((regionId) => {
        if (nextRegions[regionId].owner === nationId) nextRegions[regionId] = transferRegion(nextRegions[regionId], state.playerNationId, state.nations).region;
      });
      return payCost({
        ...state,
        regions: nextRegions,
        units: Object.fromEntries(Object.entries(state.units).map(([id,u])=>[id,u.ownerId===nationId?{...u,ownerId:state.playerNationId}:u])),
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, vassals: player.vassals.filter((id) => id !== nationId) },
          [nationId]: { ...target, vassalOf: null, vassals: [], isEliminated: true, isAtWar: false, capitalRegionId: null }
        },
        logs: [...state.logs, { year: state.year, ...msg('m.act.annexed', { nation: people(target.id, target.name) }), type: LogTypes.MILESTONE }]
      }, costs, 'annexVassal');
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.released', { nation: people(target.id, target.name) }), type: LogTypes.DIPLOMACY }]
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
      if (!canPay(state, costs)) return state;
      const isForeignSoil = REGIONS_DATA[regionId]?.startOwner !== state.playerNationId;
      return payCost({
        ...state,
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
          ...msg('m.act.capitalMoved', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name || regionId), penalty: isForeignSoil ? sub('m.act.capitalForeign') : '' }),
          type: LogTypes.MILESTONE
        }]
      }, costs, 'moveCapital');
    }

    // A vassal's own path out of subjection (plan §M12/§M15) — the one war DECLARE_WAR's own
    // vassalOf guard above still allows. Winning is resolved entirely inside resolveWarProgress
    // (src/engine/diplomacy.js's own 'independence' cb branch), not here; this only opens the war.
    case ActionTypes.DECLARE_INDEPENDENCE: {
      const player = state.nations[state.playerNationId];
      const overlordId = player?.vassalOf;
      const overlord = overlordId ? state.nations[overlordId] : null;
      if (exploreOn(state) || !overlord || player.isAtWar || (player.libertyDesire || 0) < LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD) return state;
      const afterWar = declareWar(state, overlordId, { aggressor: state.playerNationId, goal: { type: 'independence' } });
      if (afterWar === state) return state;
      const wars = [...afterWar.wars];
      wars[wars.length - 1] = { ...wars[wars.length - 1], cb: 'independence' };
      return {
        ...afterWar,
        wars,
        logs: [...afterWar.logs, { year: state.year, ...msg('m.act.independence', { nation: people(player.id, player.name), overlord: people(overlord.id, overlord.name) }), type: LogTypes.DIPLOMACY }]
      };
    }

    // Plan §M18: "Continue playing after victory" — only valid for an AMBITION win reached before
    // the ending signal (ending.js: the turn limit or the Future's goal); the ranked ending
    // (finalScore) is the real, final game-over and has nothing left to continue toward. Records the condition in
    // victoriesAchieved so checkVictoryConditions (still true every later turn, since the region/
    // GDP/streak/etc. threshold that was met usually stays met) doesn't immediately re-fire the
    // SAME victory the very next turn.
    case ActionTypes.CONTINUE_AFTER_VICTORY: {
      if (state.gameStatus !== GameStatus.VICTORY || state.ending || endingSignal(state)) return state;
      const conditionId = state.victoryConditionId;
      return {
        ...state,
        gameStatus: GameStatus.ACTIVE,
        victoryConditionId: null,
        victoriesAchieved: [...(state.victoriesAchieved || []), conditionId],
        logs: [...state.logs, { year: state.year, ...msg('m.act.continueReign'), type: LogTypes.MILESTONE }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.promoted', { unit: thing('unitClass', unit.classId, unit.classId), perk: thing('perk', perk.id, perk.name) }), type: LogTypes.ACTION }]
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.generalJoined', { general: person(general.name) }), type: LogTypes.ACTION }]
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
          ...msg(unitId ? 'm.act.generalAssigned' : 'm.act.generalRecalled', { general: person(general.name) }),
          type: LogTypes.ACTION
        }]
      };
    }

    case ActionTypes.ADD_LOG:
      return {
        ...state,
        logs: [...state.logs, { year: state.year, ...carry(action.payload), type: action.payload.type || LogTypes.ACTION }]
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
      if (!v.ok) return reject(state, whyOf(v));
      return foundColony(state, regionId, action.payload?.policy || 'coexist');
    }

    case ActionTypes.ABANDON_COLONY:
      return abandonColony(state, action.payload?.regionId);

    // Cities (plans/civ-map-rework.md C1): production queue, focus, locks, buying tiles. All on
    // the player's own cities; the AI governor (workstream 9) drives the same functions.
    case ActionTypes.SAVE_ARMY_TEMPLATE: {
      // Army templates (armyTemplates.js): a named composition the cities build as one order.
      const { template } = action.payload || {};
      const ok = validateTemplate(template, ageOf(state, state.playerNationId), getResearched(state, state.playerNationId));
      if (!ok.ok) return reject(state, whyOf(ok));
      const me = state.nations[state.playerNationId];
      return { ...state, nations: { ...state.nations, [state.playerNationId]: saveTemplate(me, template, state.turnNumber) } };
    }
    case ActionTypes.HIRE_MERCENARY: {
      // A band from a mercantile or raiders independent (mercenaries.js, phase W2).
      const r = hireMercenaryForPlayer(state, action.payload?.independentId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.ANSWER_TRIBUTE_DEMAND: {
      // Pay an independent's tribute (no raids from it meanwhile) or refuse it (raids.js, phase W2).
      const { id, pay } = action.payload || {};
      return answerTributeDemand(state, id, !!pay);
    }
    // Phase W3 (indepPolicy.js, razing.js): influence, joining, tribute, trade and razing.
    case ActionTypes.GIFT_INDEPENDENT: {
      const r = giftIndependent(state, action.payload?.independentId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.PROPOSE_JOINING: {
      const r = proposeJoining(state, action.payload?.independentId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.ANSWER_JOIN_OFFER: {
      const { id, accept } = action.payload || {};
      return answerJoinOffer(state, id, !!accept);
    }
    case ActionTypes.DEMAND_INDEPENDENT_TRIBUTE: {
      const r = demandIndependentTribute(state, action.payload?.independentId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.PROPOSE_INDEPENDENT_TRADE: {
      const r = proposeIndependentTrade(state, action.payload?.independentId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.OFFER_INDEPENDENT_TRIBUTE: {
      // Phase W4: tribute paid unasked, for peace (indepPolicy.js).
      const r = offerIndependentTribute(state, action.payload?.independentId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.RAZE_CITY: {
      const why = canRaze(state, state.playerNationId, action.payload?.regionId);
      if (!why.ok) return reject(state, whyOf(why));
      const r = razeCityForPlayer(state, action.payload.regionId);
      return r.reason ? reject(state, whyOf(r)) : r;
    }
    case ActionTypes.STOP_RAZING: {
      const regions = stopRazing(state, state.playerNationId, action.payload?.regionId);
      if (!regions) return state;
      return { ...state, regions, logs: [...state.logs, { year: state.year, ...msg('m.act.razingStopped', { city: cityRef(action.payload.regionId, regions[action.payload.regionId].name) }), type: LogTypes.ACTION }] };
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
        logs: [...state.logs, { year: state.year, ...msg('m.act.pillage', { land: getTiles().names[tile] ? place(getTiles().names[tile]) : sub('m.act.theLand'), city: cityOr(raid.cityId, state.regions[raid.cityId]?.name, 'm.act.theEnemy'), gold: raid.gold }), type: LogTypes.COMBAT }]
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
      if (!city || city.owner !== state.playerNationId || !raw) return reject(state, msg('m.act.no.notYourCity'));
      // An army order is expanded from its template here, so later edits never change a queued order.
      const template = raw.kind === 'army' ? templatesOf(state.nations[state.playerNationId]).find((t) => t.id === raw.templateId) : null;
      if (raw.kind === 'army' && !template) return reject(state, msg('m.act.no.template'));
      let item = template ? armyOrder(template, city, state.turnNumber) : raw;
      if (raw.kind === 'wonder') {
        // Wonders (wonders.js): the project's rules with the whole state, and the tile it takes.
        const can = canQueueWonder(state, city, raw.projectId, raw.tier || 1);
        if (!can.ok) return reject(state, whyOf(can));
        item = wonderItem(raw.projectId, raw.tier || 1, raw.tile ?? can.tile);
      }
      const world = { cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} };
      const ok = canQueue(city, getTiles(), world, item, { researched: Object.keys(state.techTree || {}).filter((t) => state.techTree[t]?.researched), ageId: ageOf(state, state.playerNationId), noRobots: isBound(state, 'weaponsBan', state.playerNationId) });
      if (!ok.ok) return reject(state, whyOf(ok));
      // One order per building tier and per tile improvement: a second tap says so instead of
      // paying for the same thing twice (playtest audits I045).
      if ((item.kind === 'building' || item.kind === 'improvement') && [city.production.current, ...city.production.queue].some((q) => q && itemKey(q) === itemKey(item))) return reject(state, msg('m.act.no.inQueue'));
      return { ...state, regions: { ...state.regions, [id]: queueItem(city, item) } };
    }
    case ActionTypes.ADVISOR_PRODUCTION: {
      // The advisor's picks (productionAdvisor.js), each queued as the player would queue it.
      const only = action.payload?.cityId;
      const picks = only != null ? [{ cityId: only, item: advisorPick(state, only) }].filter((p) => p.item) : advisorPicks(state);
      if (!picks.length) return reject(state, msg('m.act.no.advisorNothing'));
      // A pick the queue refuses is skipped, not logged as a refusal.
      const next = picks.reduce((s, p) => { const n = reduceAction(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: p }); return n.regions !== s.regions ? n : s; }, state);
      return next === state ? reject(state, msg('m.act.no.advisorNothing')) : next;
    }
    case ActionTypes.SET_SETTLER_TARGET: {
      const { unitId, tile } = action.payload || {};
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== state.playerNationId || !isSettler(unit)) return reject(state, msg('m.act.no.notYourSettlers'));
      if (tile == null) return { ...state, units: { ...state.units, [unitId]: { ...unit, target: null } } };
      const can = canFoundCity({ cities: state.regions, tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} }, getTiles(), tile, state.playerNationId);
      if (!can.ok) return reject(state, whyOf(can));
      if (isBand(unit) && !canFoundVillage(state, unit, tile).ok) return reject(state, whyOf(canFoundVillage(state, unit, tile)));
      const path = settlerPath(state, unit.tile, tile, state.playerNationId);
      if (!path) return reject(state, msg('m.act.no.noLandPath'));
      const turns = Math.ceil(path.length / SETTLER_MOVES);
      return { ...state, units: { ...state.units, [unitId]: { ...unit, target: tile, ...(unit.hold ? { hold: false } : {}) } }, logs: [...state.logs, { year: state.year, ...msg(turns === 1 ? 'm.act.settlersSetOutOne' : 'm.act.settlersSetOutMany', { place: getTiles().names[tile] ? place(getTiles().names[tile]) : sub('m.act.newLand'), n: turns }), type: 'action' }] };
    }
    case ActionTypes.RESOLVE_CAMP: {
      const camp = state.pendingCamp;
      const choice = action.payload?.choice;
      if (!camp) return state;
      if (choice === 'leave') return { ...state, pendingCamp: null };
      const next = resolveCamp(state, state.playerNationId, camp.tile, choice);
      if (next === state) return reject(state, msg('m.act.no.campChoice'));
      return { ...next, pendingCamp: null, logs: [...state.logs, { year: state.year, ...msg(choice === 'absorb' ? 'm.act.campAbsorbed' : 'm.act.campTraded'), type: 'action' }] };
    }
    case ActionTypes.FOUND_CITY: {
      const { unitId } = action.payload || {};
      const unit = state.units[unitId];
      if (!unit || unit.ownerId !== state.playerNationId || !isSettler(unit)) return reject(state, msg('m.act.no.notYourSettlers'));
      if (isBand(unit)) {
        const can = canFoundVillage(state, unit);
        if (!can.ok) return reject(state, whyOf(can));
        return normalizeUnitTiles(syncWorldRegistry(withVillageLog(foundVillage(state, unitId), state.playerNationId)));
      }
      const can = canSettle(state, unit.tile, state.playerNationId, ageOf(state, state.playerNationId));
      if (!can.ok) return reject(state, whyOf(can));
      const founded = foundOutpost(state, state.regions, { tileOwner: state.world?.tileOwner || {}, tileState: state.world?.tileState || {} }, unit, state.turnNumber);
      if (!founded) return reject(state, msg('m.act.no.noCityHere'));
      const units = { ...state.units }; delete units[unitId];
      return normalizeUnitTiles(syncWorldRegistry({ ...state, regions: founded.regions, world: { ...(state.world || {}), tileOwner: founded.world.tileOwner, tileState: founded.world.tileState }, units, logs: [...state.logs, { year: state.year, ...msg('m.act.outpostFounded', { city: cityRef(founded.city.id, founded.city.name) }), type: 'action' }] }));
    }
    case ActionTypes.DEQUEUE_PRODUCTION: {
      const { cityId: id, index } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, msg('m.act.no.notYourCity'));
      return { ...state, regions: { ...state.regions, [id]: dequeueItem(city, index || 0) } };
    }
    case ActionTypes.SET_CITY_FOCUS: {
      const { cityId: id, focus } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, msg('m.act.no.notYourCity'));
      const next = setFocus(city, focus);
      return next === city ? state : { ...state, regions: { ...state.regions, [id]: next } };
    }
    case ActionTypes.TOGGLE_TILE_LOCK: {
      const { cityId: id, tile } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId || !city.tiles.includes(tile)) return reject(state, msg('m.act.no.notYourLand'));
      return { ...state, regions: { ...state.regions, [id]: toggleLock(city, tile) } };
    }
    case ActionTypes.BUY_TILE: {
      const { cityId: id, tile } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, msg('m.act.no.notYourCity'));
      // The price and the eligibility are the city sheet's own quote (cityEconomy.js quoteBuyTile,
      // I036): the research that cheapens land and pushes the border counts here as it does there.
      const quote = quoteBuyTile(state, id, tile);
      if (!quote.ok) return reject(state, whyOf(quote));
      const cost = quote.cost;
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - cost },
        regions: { ...state.regions, [id]: { ...city, tiles: [...city.tiles, tile] } },
        world: { ...state.world, tileOwner: { ...(state.world?.tileOwner || {}), [tile]: id } },
        logs: [...state.logs, { year: state.year, ...msg('m.act.tileBought', { city: cityRef(city.id, city.name), place: getTiles().names?.[tile] ? place(getTiles().names[tile]) : sub('m.act.newLand'), gold: cost }), type: LogTypes.ACTION }]
      };
    }
    case ActionTypes.MOVE_PRODUCTION: {
      // Reorder the queue (I046): `index` and `to` count [current, ...queue]; 0 is the front. No
      // progress is lost either way (cities.js moveQueueItem).
      const { cityId: id, index, to } = action.payload || {};
      const city = state.regions[id];
      if (!city || city.owner !== state.playerNationId) return reject(state, msg('m.act.no.notYourCity'));
      const next = moveQueueItem(city, index, to);
      return next === city ? state : { ...state, regions: { ...state.regions, [id]: next } };
    }

    case ActionTypes.RESET_GAME: {
      // playerNationId/gameSpeed/difficultyId come from the start screen; doctrineId comes from
      // meta-progression localStorage via the component layer — see GameProvider.resetGame below.
      // This keeps gameReducer a pure function of (state, action).
      return startState(action.payload);
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
      return r.message ? { ...r.state, logs: [...r.state.logs, { year: state.year, ...carry(r), type: LogTypes.DIPLOMACY }] } : r.state;
    }

    case ActionTypes.EXPLORE_ORDER: {
      // Scouts (scouting.js): explore the nearest unexplored land, or walk to a picked tile; never a battle.
      const { unitIds = [], toTile = null, stop = false } = action.payload || {};
      if (stop) { const stopped = stopExplore(state, unitIds); return stopped ? { ...state, units: stopped } : state; }
      const order = orderExplore(state, unitIds, toTile);
      if (!order.units) return reject(state, order.reason ? whyOf(order) : msg('m.act.no.scouts'));
      // Each scout steps at once on its own route, like a march (routes.js stepMarchesNow).
      let scouted = order.units;
      unitIds.forEach((id) => { scouted = stepMarchesNow({ ...state, units: scouted }, [id]).units; });
      return { ...state, units: scouted, logs: [...state.logs, { year: state.year, ...(order.count > 1 ? msg('m.act.scoutsMany', { n: order.count }) : msg('m.act.scoutsOne')), type: LogTypes.ACTION }] };
    }

    case ActionTypes.SET_HOLD: {
      // Hold (standingOrders.js): the units stay put and leave the idle list until told otherwise.
      const { unitIds = [], hold = true } = action.payload || {};
      const units = setHold(state, unitIds, hold);
      return units ? { ...state, units } : state;
    }

    case ActionTypes.SET_SIEGE: {
      // Lay siege to an independent's city, or lift it (`cityId` null): the explicit siege order
      // (sieges.js besiegesCity). A city at war with you is besieged by standing beside it.
      const { unitIds = [], cityId = null } = action.payload || {};
      if (cityId != null) {
        const city = state.regions[cityId];
        if (!city || city.owner === state.playerNationId) return reject(state, msg('m.act.no.cannotBesiege'));
        if (!canAttack(state, state.playerNationId, city.owner)) return reject(state, msg('m.act.no.siegePeace', { nation: nationOr(state, city.owner, 'm.act.itsOwner') }));
        const tiles = getTiles();
        const beside = unitIds.filter((id) => { const u = state.units[id]; const t = u ? unitTile(state, u) : null; return t != null && tiles.neighbors[city.tile].includes(t); });
        if (!beside.length) return reject(state, msg('m.act.no.siegeBeside', { city: cityRef(city.id, city.name) }));
        const units = setSiege(state, beside, cityId);
        if (!units) return state;
        return { ...state, units, logs: [...state.logs, { year: state.year, ...msg('m.act.siegeLaid', { city: cityRef(city.id, city.name) }), type: LogTypes.COMBAT }] };
      }
      const units = setSiege(state, unitIds, null);
      return units ? { ...state, units, logs: [...state.logs, { year: state.year, ...msg('m.act.siegeLifted'), type: LogTypes.COMBAT }] } : state;
    }

    case ActionTypes.SET_SETTLER_HOLD: {
      // Settlers wait where they are and leave the idle list (settlers.js setSettlerHold, I093).
      const { unitId, hold = true } = action.payload || {};
      const units = setSettlerHold(state, unitId, hold);
      return units ? { ...state, units } : state;
    }

    case ActionTypes.DISBAND_SETTLERS: {
      // The settlers go home (settlers.js disbandSettlers, I093): the unit is gone, its one
      // citizen joins the nearest own city. No HR, no military strength: they were never soldiers.
      const out = disbandSettlers(state, (action.payload || {}).unitId);
      if (!out) return reject(state, msg('m.act.no.notYourSettlers'));
      const line = out.city ? msg('m.act.settlersHome', { city: cityRef(out.city.id, out.city.name) }) : msg('m.act.settlersDisband');
      return syncWorldRegistry({ ...state, units: out.units, regions: out.regions, logs: [...state.logs, { year: state.year, ...line, type: LogTypes.ACTION }] });
    }

    case ActionTypes.RESOLVE_CAPTURE: {
      // The capture card (decision 40, capture.js): Conquer, Raze, Make tributary or Free, once.
      const r = resolveCapture(state, action.payload?.captureId, action.payload?.choice);
      return r.reason ? reject(state, r.reasonMsg ? msg(r.reasonMsg.key, r.reasonMsg.vars) : r.reason) : r;
    }

    case ActionTypes.UPGRADE_UNIT: {
      // Older-age units become the current age's unit of their class (unitUpgrades.js): every one
      // that can be, while the gold lasts; the button's quote is revalidated here.
      const ids = (Array.isArray(action.payload?.unitIds) ? action.payload.unitIds : []).filter((id) => state.units[id]?.ownerId === state.playerNationId);
      const r = upgradeUnits(state, ids, state.resources.gold || 0);
      if (!r.count) return reject(state, r.first ? whyOf(r.first) : msg('m.act.no.upgrade'));
      return {
        ...state,
        units: r.units,
        resources: { ...state.resources, gold: state.resources.gold - r.gold },
        logs: [...state.logs, { year: state.year, ...msg('m.act.upgraded', { count: r.count, gold: r.gold }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.RUSH_PRODUCTION: {
      // Gold for the production an order still lacks (spending.js, I019): the button's quote is
      // the charge, revalidated here; the order completes on the next turn like any other.
      const { cityId: id, index = 0 } = action.payload || {};
      const quote = rushQuote(state, id, index);
      if (!quote.ok) return reject(state, whyOf(quote));
      const city = state.regions[id];
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - quote.gold },
        regions: { ...state.regions, [id]: applyRush(city, index, quote, state.turnNumber) },
        logs: [...state.logs, { year: state.year, ...msg('m.act.rushed', { city: cityRef(city.id, city.name), gold: quote.gold, item: thing('rush', null, rushItemName(quote.item, quote.ageId)) }), type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.TRADE_MAPS: {
      // Map trading (mapTrade.js, I116): swap, give, ask, buy or sell the explored map; the quote
      // the nation card shows is the one applied here. A refusal changes nothing.
      const { nationId, kind } = action.payload || {};
      const r = tradeMaps(state, nationId, kind);
      if (r.reason) return reject(state, whyOf(r));
      return { ...r.state, logs: [...r.state.logs, { year: state.year, ...carry(r), type: LogTypes.DIPLOMACY }] };
    }

    case ActionTypes.ANSWER_MAP_OFFER: {
      // An AI's offer to swap maps (mapTrade.js processAIMapOffers): accept or decline, never blocking.
      const r = answerMapOffer(state, !!action.payload?.accept);
      return r.message ? { ...r.state, logs: [...r.state.logs, { year: state.year, ...carry(r), type: LogTypes.DIPLOMACY }] } : r.state;
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
  ActionTypes.RIVAL_NATION, ActionTypes.PROPOSE_MARRIAGE, ActionTypes.INSULT, ActionTypes.ASSIGN_DIPLOMAT, ActionTypes.VASSALIZE, ActionTypes.PROPOSE_STELE
]);
// Actions after which the player's own sight is refreshed at once (an army moved, a city rose):
// exploring and meeting peoples happen as you move, not only at the end of the turn.
const NO_FOG_REFRESH = new Set([ActionTypes.ADVANCE_TURN, ActionTypes.FAST_FORWARD, ActionTypes.RESET_GAME, ActionTypes.LOAD_GAME]);

// The state a new game starts from, out of RESET_GAME's payload (also a macro log's start, macroVerify.js).
export const startState = ({ playerNationId, gameSpeed, doctrineId, difficultyId, scenario, rngSeed, guided, exploredWorld, crises, explore } = {}) => {
  const base = createInitialState({ playerNationId, gameSpeed, scenario, rngSeed, guided, fog: !exploredWorld });
  const withCrises = crises === 'off' ? { ...base, settings: { ...base.settings, crises: 'off' } } : base;
  const fresh = explore ? { ...withCrises, settings: { ...withCrises.settings, explore: true } } : withCrises;
  const withDoctrine = doctrineId ? applyStartingDoctrine(fresh, doctrineId) : fresh;
  return difficultyId ? applyDifficulty(withDoctrine, difficultyId) : withDoctrine;
};

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
    return reject(state, msg('m.act.no.notMet'));
  }
  const gate = ACTION_AGE_GATES[action?.type];
  if (gate) {
    const age = ageOf(state, state.playerNationId);
    if ((gate.minAge && isAgeBefore(age, gate.minAge)) || (gate.maxAge && isAgeBefore(gate.maxAge, age))) return reject(state, msg('m.act.no.notThisAge'));
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
