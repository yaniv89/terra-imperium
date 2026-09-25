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
import { WORLD_NATIONS } from '../data/worldNations';
import { TECH_TREE, canResearchTech, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD, getTechPowerCost } from '../data/techTree';
import {
  GOVERNMENT_TYPES, canChangeGovernmentType, canEnactReform, resetReformsForType, getReformChoices
} from '../data/government';
import { IDENTITY_AXES, IDENTITY_SHIFT_STEP, IDENTITY_SHIFT_COOLDOWN_TURNS, clampIdentity } from '../data/identity';
import { getLaw, canEnactLaw, getLawChangeCost, LAW_CHANGE_COOLDOWN_TURNS, COLLECTIVIZATION_UNREST_MODIFIER, COLLECTIVIZATION_UNREST_TURNS, DEFAULT_LAWS } from '../data/laws';
import {
  createInitialEstates, getPrivilege, clampCrownLand, CROWN_LAND_DEFAULT,
  CROWN_LAND_SEIZE_AMOUNT, CROWN_LAND_SELL_AMOUNT, CROWN_LAND_SEIZE_LOYALTY_PENALTY,
  CROWN_LAND_SELL_BURGHER_LOYALTY_BONUS, ESTATE_INTERACTION_COOLDOWN_TURNS,
  ESTATE_ASK_LOYALTY_PENALTY, REVOKE_PRIVILEGE_LOYALTY_PENALTY, ESTATE_LABELS
} from '../data/estates';
import { canDoEstateInteraction } from './estates';
import { declareWar, hasCasusBelli, isWarBetween, isInTruce, getTradePactCapacity, recordBattle, setTruce, PEACE_OFFER_COOLDOWN_TURNS } from './diplomacy';
import { addNationModifier } from './modifiers/timed';
import { getEffectiveMilitaryPower } from './aiEconomy';
import { applyPeace, getPeaceAcceptance } from './peace';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { START_YEAR, END_YEAR, getCalendarAgeId, getEffectiveAgeId, AGE_ORDER, AGES, getAgesBehind, getAgesBehindResearchCostMultiplier } from '../data/ages';
import { getRegionTerrain } from '../data/terrain';
import { createEmptyResourcePool } from '../data/resources';
import {
  createEmptyRegionBuildings, canBuildTier, canBuildExtraction, BUILDING_CATEGORIES,
  getBuildingSlots, getUsedBuildingSlots, getBuildingTierCost, getCategoryTierName
} from '../data/buildings';
import { hasDeposit } from '../data/deposits';
import { getAvailableClasses } from '../data/unitClasses';
import {
  ACTION_COSTS, TECH_RESEARCH_POOL, DISBAND_HR_REFUND_RATIO, FUND_SCHOLARS_TECHPOINTS,
  SUE_FOR_PEACE_MIN_GOLD, SUE_FOR_PEACE_BASE_GOLD, GIFT_HOSTILITY_REDUCTION,
  UNJUSTIFIED_WAR_GLOBAL_HOSTILITY, UNJUSTIFIED_WAR_HOME_UNREST,
  SETTLE_COLONIZE_CONTROL_THRESHOLD, SETTLE_COLONIZE_START_CONTROL, SETTLE_COLONIZE_START_UNREST,
  POPULATION_POLICY_GROWTH_RATE, ASAT_DEBRIS_RISE,
  ESPIONAGE_SUCCESS_CHANCE, ESPIONAGE_TECH_POINTS_STOLEN, ESPIONAGE_FAILURE_HOSTILITY_INCREASE,
  COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD, CLIMATE_RESILIENCE_MAX,
  CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION,
  ARMY_MAINTENANCE_DEFAULT, FUSION_GRID_ACTIVATION_HELIUM3,
  MAX_RIVALS, MARRIAGE_HOSTILITY_REDUCTION, MARRIAGE_HEIR_CLAIM_BONUS,
  BREAK_ALLIANCE_HOSTILITY_INCREASE, INSULT_HOSTILITY_INCREASE, STARTING_DIPLOMATS,
  TRUCE_BREAK_STABILITY_PENALTY, TRUCE_BREAK_PRESTIGE_PENALTY, TRUCE_BREAK_AE_AGAINST_NEIGHBORS,
  VASSALIZE_HOSTILITY_CEILING, VASSALIZE_STRENGTH_RATIO, VASSAL_ANNEX_COOLDOWN_TURNS, VASSAL_ANNEX_DIP_PER_DEV,
  ESPIONAGE_SUPPORT_REBELS_UNREST_INCREASE, MOVE_CAPITAL_FOREIGN_STABILITY_PENALTY, LIBERTY_DESIRE_INDEPENDENCE_THRESHOLD
} from '../data/actionCosts';
import { resolveTurn } from './resolveTurn';
import { applyEventEffects } from './applyEventEffects';
import { resolveBattle } from './battle';
import { getDefenseLevelDamageReductionMultiplier, hasMeleeUnitDeployed, resolveSiegeControlDamage, getZoneOfControlMultiplier } from './siege';
import { awardXp, canPromote, getPerk } from '../data/promotions';
import { generateGeneral, getGeneralXpMultiplier } from '../data/generals';
import { isCoastal, isReachableBySea } from '../data/navalReach';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, getFormerOwnerOnConquest } from '../data/rebellion';
import { randomSeed, createRng } from '../utils/rng';
import { applyStartingDoctrine } from '../data/startingDoctrines';
import { applyDifficulty } from '../data/difficulty';
import { generateRuler, generateAdvisorCandidates, getAdvisorHireCost, getSuccessionStyle, generateHeir } from './succession';
import { clampStability, clampPrestige, getIncreaseStabilityCost } from './nationalPower';
import { seedDevelopment, getTotalDev, DEV_TYPE_POOL, getDevelopProvinceCost, DEVELOP_PROVINCE_POP_GAIN_RATIO } from './development';
import { getModifier, getRegionModifier } from './modifiers/sheet';
import { canAfford, applyCosts, BASE_POWER_PER_TURN, formatMoney } from '../utils/helpers';
import {
  GREAT_PROJECTS, getGreatProjectCost, canStartGreatProject, canUpgradeGreatProject
} from '../data/greatProjects';
import { SATELLITE_TYPES, canLaunchSatellite, MAX_ORBITAL_DEBRIS } from '../data/satellites';
import {
  MISSILE_TIERS, MAX_ABM_LEVEL, getAbmReductionMult, isMissileInRange, NUCLEAR_GLOBAL_HOSTILITY,
  NUCLEAR_PRESTIGE_PENALTY, NUCLEAR_PARIAH_DURATION_TURNS, NUCLEAR_PARIAH_GOLD_MULT_PENALTY
} from '../data/missiles';
import { SPACE_MISSIONS_BY_ID, canLaunchMission } from '../data/spaceMissions';
import { TAX_RATE_IDS, DEFAULT_TAX_RATE, TAX_RATE_CHANGE_COOLDOWN_TURNS } from '../data/taxRates';
import { getLoanCapacity, getLoanInterestRate, getLoanSize, clampMaintenance, getRecruitUnitCost, hasBankingHouses } from './economy';

// How many land units one naval unit can carry (plan §7.5's Embark/Disembark).
const NAVAL_TRANSPORT_CAPACITY = 2;
// Amphibious assault penalty (plan §7.5): attacking from the sea with no existing foothold takes
// a combat malus. Once the attacker holds a region adjacent to the target, further attacks staged
// from that beachhead are normal.
const AMPHIBIOUS_PENALTY_MULT = 0.75;

// Any of the 240 nations works as a fallback default — only used when no explicit choice (from
// the country-select start screen) or saved game is present yet.
const DEFAULT_PLAYER_NATION_ID = 'us';

const formatYear = (year) => (year < 0 ? `${-year} BCE` : `${year} CE`);

// ============ INITIAL STATE FACTORY ============
// Exported (not just used internally) so it doubles as test fixture data — resolveTurn.test.js
// and applyEventEffects.test.js build realistic states from it rather than hand-rolling partial
// mocks that could silently drift from the real shape.
export const createInitialState = ({ playerNationId = DEFAULT_PLAYER_NATION_ID, gameSpeed = 'normal', rngSeed } = {}) => {
  const year = START_YEAR;
  const age = getCalendarAgeId(year);

  // Every one of the 240 nations starts owning exactly its own territory at full control — see
  // src/data/regions.js.
  const regions = {};
  Object.entries(REGIONS_DATA).forEach(([id, data]) => {
    regions[id] = {
      id,
      owner: data.startOwner,
      control: data.startControl,
      currentPopulation: data.population,
      // Every region starts with NO built infrastructure, regardless of `data.infrastructure`
      // (a real-world-2024-GDP-derived 1-10 "development index" — see build-world-regions.mjs's
      // own file header, "richer nations score modestly higher, but this is flavor, not balance;
      // every nation starts on equal footing"). That index was never meant to seed a LIVE,
      // buildable gameplay stat: at 2000 BCE nobody has roads or aqueducts yet, and starting a
      // modern-GDP nation at infrastructure 10 handed it a permanent +100% gold multiplier
      // (calcIncome's infraMult) and 6x supply range from turn one, for free, forever, while
      // contradicting the file's own "equal footing" intent. `data.infrastructure` is still used
      // as-is for the separate, cosmetic `strategicValue` display stat.
      currentInfrastructure: 0,
      underInvasion: false,
      buildings: createEmptyRegionBuildings(),
      // Unrest (plan §9): 0 = fully calm. Drifts each turn based on control% (resolveTurn.js) and
      // can be pushed down directly via the Quell Unrest action. Every nation starts at full
      // control of its own territory, so unrest starts at 0 rather than needing a curve.
      unrest: 0,
      // Built-up defense from the Build Defenses action — separate from REGIONS_DATA's static
      // `fortification` seed value; Phase C's combat system will read both once it exists.
      defenseLevel: 0,
      // Built-up resilience from the Build Climate Resilience action (Modern age) — raises the
      // threshold proceduralEvents.js's harsh_winter/failed_harvest templates gate on, the same way
      // defenseLevel already gates frontier_raiders. Closes the loop the plan's climate_stress world
      // event otherwise left one-way: investing here measurably reduces future weather/disaster
      // exposure instead of only ever reacting to it after the fact.
      climateResilience: 0,
      // Province development (plan §M5) — the live economic base calcIncome now reads instead of
      // REGIONS_DATA's static resources.gold/hr directly; see src/engine/development.js's own
      // header for why this seeding preserves today's exact starting income.
      dev: seedDevelopment(id)
    };
  });

  // Ruler/heir generation (plan §M3) draws from a seeded rng so the whole nations table stays
  // reproducible from state.rngSeed alone — the seed captured at the end of this loop already
  // reflects every draw made generating all 240 rulers/heirs, so turn 1 continues deterministically
  // from there rather than replaying the same draws again. `rngSeed` is an optional override (tests,
  // and the edge-bundle parity check) so the WHOLE initial state — not just the final stored seed —
  // can be pinned and reproduced; real gameplay always omits it and gets fresh randomness.
  const successionRng = createRng(rngSeed ?? randomSeed());

  // Plan §M4: overextension is measured relative to each nation's OWN starting size, so a 50-region
  // nation and a 1-region nation are equally "at capacity" at the same overextension% — captured
  // once, here, since region ownership churns every game while this stays a fixed reference point.
  const startRegionCountByOwner = {};
  Object.values(regions).forEach((r) => {
    startRegionCountByOwner[r.owner] = (startRegionCountByOwner[r.owner] || 0) + 1;
  });

  // Every one of the 240 nations gets a record — any of them can be the player's.
  const nations = {};
  Object.entries(WORLD_NATIONS).forEach(([id, data]) => {
    // No nation starts with a government adopted, so none starts with an heir either (heirs only
    // exist under a hereditary government — see succession.js's getSuccessionStyle) — one is
    // generated the first time that nation's reign ends after adopting one.
    const ruler = generateRuler(id, successionRng, { turnNumber: 1, age, gameSpeed });
    nations[id] = {
      id,
      name: data.name,
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
      // Estates (plan §M9) — Clergy/Nobility/Burghers from the start; Labor is added once the
      // nation reaches the Modern age (resolveTurn.js's age-transition check). Every nation gets
      // the field so staticSources can read any nation's threshold bonus/malus generically, but
      // only the player can grant/revoke privileges or run an interaction today; AI parity is M16.
      estates: createInitialEstates(),
      crownLand: CROWN_LAND_DEFAULT,
      estateInteractionCooldowns: {},
      // Set Tax Rate (plan §M11) — every nation gets a rate so calcIncome/nextUnrest can read any
      // nation's generically; only the player can change theirs today. taxRateCooldownUntil is the
      // turn the rate can next change (0 = available now), the same "store the unlock turn, default
      // 0" shape lawCooldowns/estateInteractionCooldowns already use so a fresh nation isn't already
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
      // as estates/laws/taxRate above.
      rivals: [],
      // Diplomats (plan §M12) — a flat count for now (no bonus sources wired yet); diplomatTasks
      // holds at most `diplomats` concurrent { targetId, task, startedTurn } assignments.
      diplomats: STARTING_DIPLOMATS,
      diplomatTasks: [],
      // Royal Marriage (plan §M12) — nation ids the player has already married into, so the
      // action can't be spammed for repeated hostility reduction against the same target.
      marriageWith: [],

      // Rulers, heirs, advisors (plan §M3) — every nation gets a ruler so resolveTurn.js's
      // succession pass and the modifier engine's ruler-skill source (src/engine/modifiers/
      // sources.js) can read any nation's generically; only the player's ruler/advisors actually
      // affect anything mechanically today (AI nations don't consume power pools until M16).
      ruler,
      heir: null,
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
      // for every nation the same "generic reader, real for player and AI both" way stability/
      // estates/succession already are (every nation gets real per-turn crisis processing, matching
      // M3/M4/M9's own precedent — this is deliberately NOT deferred to M16's AI-parity milestone).
      capitalRegionId: getNationCapital(id),
      lowStabilityStreak: 0,
      civilWar: null,
      disasters: { estateTakeover: 0, economicCollapse: 0, successionWar: 0, revolution: 0 },
      libertyDesire: 0,

      // AI parity (plan §M16). Only non-player nations get these — the player keeps living on
      // state.resources/techTree/techAgeId (src/engine/nationState.js's own header explains why:
      // moving the player onto this shape too would touch every existing test and UI component that
      // reads state.resources directly, for zero present benefit). tech.ageId starts equal to the
      // calendar age, mirroring state.techAgeId's own seeding.
      ...(id !== playerNationId ? { economy: { gold: 0, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 }, tech: { researched: [], ageId: age } } : {})
    };
  });

  // Initialize tech tree (currently empty content — see src/data/techTree.js).
  const techTree = {};
  Object.entries(TECH_TREE).forEach(([id, data]) => {
    techTree[id] = { id, researched: false, available: data.yearAvailable <= year };
  });

  return {
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

    // Per-region armies (plan §7) — a flat dict keyed by unit id, not nested under regions, since
    // units move between regions over their lifetime. See src/data/unitClasses.js for the class/
    // roster data a unit's classId/ageId reference.
    units: {},
    nextUnitSeq: 0,

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

    // Events
    activeEventId: null,
    activeProceduralEvent: null,
    proceduralEventCooldown: 0,
    pendingEventChains: [],
    firedEvents: {},

    // Great Projects (plan §M10) — { projectId: { regionId, tier } }, keyed globally so a project
    // can only ever be STARTED once anywhere (canStartGreatProject). Its current owner is derived
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
    advisorPool: { [playerNationId]: generateAdvisorCandidates(playerNationId, successionRng) },

    // Space Race mission ladder (plan §10.4 Layer 3, src/data/spaceMissions.js) — a mission in
    // progress lives in spaceMissionProgress keyed by id with turns remaining; completing it moves
    // the id into completedMissions and applies its reward. diplomaticLeadershipStreak is the
    // Diplomatic victory condition's sustained-majority counter (victoryConditions.js).
    spaceMissionProgress: {},
    completedMissions: [],
    diplomaticLeadershipStreak: 0,

    // Deterministic turn resolution — see src/utils/rng.js
    // Carries forward whatever successionRng advanced to while generating all 240 nations' rulers
    // above, rather than a fresh randomSeed() — turn 1 then continues deterministically from
    // exactly where ruler generation left off, instead of silently discarding those draws.
    rngSeed: successionRng.getSeed(),

    // Logs
    logs: [
      { year, message: `${formatYear(year)}: Your nation's story begins.`, type: LogTypes.MILESTONE }
    ]
  };
};

// ============ REDUCER ============
// Exported for direct unit testing (see GameContext.test.js) — the reducer is the authoritative
// validation point for every player action, so it should be testable without mounting React.
export const gameReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.ADVANCE_TURN:
      return resolveTurn(state);

    case ActionTypes.FAST_FORWARD: {
      // Fast-forward: repeatedly resolves turns within a single atomic dispatch, so the component
      // doesn't need to loop across async re-renders. Stops the moment there's a decision worth
      // the player's attention — an event becomes active, a war starts or ends, the game ends —
      // or a turn cap is hit, so a single click can't silently skip to the end of the game.
      const MAX_TURNS = 20;
      const countWars = (s) => Object.values(s.nations).filter(n => n.isAtWar).length;
      let current = state;
      const startingWarCount = countWars(current);
      for (let i = 0; i < MAX_TURNS; i++) {
        const next = resolveTurn(current);
        if (next === current) break; // resolveTurn's own no-op guard (event pending / game over)
        current = next;
        if (current.gameStatus !== GameStatus.ACTIVE) break;
        if (current.activeEventId || current.activeProceduralEvent || current.pendingPeaceOffer) break;
        if (countWars(current) !== startingWarCount) break;
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
            dev: { ...region.dev, [devType]: (region.dev?.[devType] || 0) + 1 },
            currentPopulation: (region.currentPopulation || modernBaseline) + popGain
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
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, unrest: Math.max(0, region.unrest - 30) } },
        logs: [...state.logs, { year: state.year, message: `Quelled unrest in ${REGIONS_DATA[regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SETTLE_COLONIZE: {
      // Peacefully absorbs a bordering nation's own homeland once its control there has
      // collapsed below SETTLE_COLONIZE_CONTROL_THRESHOLD — the "minimally-held adjacent land"
      // the plan describes, adapted to a one-region-per-nation world with no literal unowned
      // territory. No military required, unlike LAUNCH_INVASION.
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.settleColonize;
      if (!region || region.owner === state.playerNationId) return state;
      if (region.control >= SETTLE_COLONIZE_CONTROL_THRESHOLD) return state;
      if (!isAdjacentToOwner(regionId, state.regions, state.playerNationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: {
          ...state.regions,
          [regionId]: {
            ...region,
            owner: state.playerNationId,
            formerOwner: getFormerOwnerOnConquest(regionId, region.owner, state.playerNationId),
            control: SETTLE_COLONIZE_START_CONTROL,
            unrest: Math.max(region.unrest || 0, SETTLE_COLONIZE_START_UNREST)
          }
        },
        logs: [...state.logs, { year: state.year, message: `Settlers peacefully absorbed ${REGIONS_DATA[regionId]?.name}, whose own control there had collapsed.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.POPULATION_POLICY: {
      const { regionId } = action.payload;
      const region = state.regions[regionId];
      const costs = ACTION_COSTS.populationPolicy;
      if (!region || region.owner !== state.playerNationId) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextPopulation = Math.round((region.currentPopulation || 1) * (1 + POPULATION_POLICY_GROWTH_RATE));
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, currentPopulation: nextPopulation } },
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
      const loan = { id: `loan_${state.turnNumber}_${(nation.loans || []).length}`, principal, interestRate: getLoanInterestRate(state, state.playerNationId), takenTurn: state.turnNumber };
      return {
        ...state,
        resources: { ...state.resources, gold: (state.resources.gold || 0) + principal },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, loans: [...(nation.loans || []), loan] } },
        logs: [...state.logs, { year: state.year, message: `Took out a loan of ${formatMoney(principal)} gold.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.REPAY_LOAN: {
      const { loanId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const loan = (nation.loans || []).find((l) => l.id === loanId);
      if (!loan || (state.resources.gold || 0) < loan.principal) return state;
      return {
        ...state,
        resources: { ...state.resources, gold: state.resources.gold - loan.principal },
        nations: { ...state.nations, [state.playerNationId]: { ...nation, loans: nation.loans.filter((l) => l.id !== loanId) } },
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

    case ActionTypes.START_GREAT_PROJECT: {
      // Region-scoped, not empire-wide (plan §M10) — a project's SITE is a specific region meeting
      // the project's own rule (a capital, a region with a named building, coastal, etc.), unlike
      // the old flat Construct Wonder. Its owner is derived from the region's owner from here on,
      // never stored — see src/data/greatProjects.js's header comment.
      const { projectId, regionId } = action.payload;
      if (!canStartGreatProject(state, state.playerNationId, projectId, regionId)) return state;
      const { turns, ...costs } = getGreatProjectCost(1);
      if (!canAfford(state.resources, costs)) return state;
      const project = GREAT_PROJECTS[projectId];
      const region = state.regions[regionId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [regionId]: { ...region, greatProjectConstruction: { projectId, tier: 1, turnsLeft: turns } } },
        logs: [...state.logs, { year: state.year, message: `Construction of ${project.name} has begun.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.UPGRADE_GREAT_PROJECT: {
      const { projectId } = action.payload;
      if (!canUpgradeGreatProject(state, state.playerNationId, projectId)) return state;
      const entry = state.greatProjects[projectId];
      const nextTier = entry.tier + 1;
      const { turns, ...costs } = getGreatProjectCost(nextTier);
      if (!canAfford(state.resources, costs)) return state;
      const project = GREAT_PROJECTS[projectId];
      const region = state.regions[entry.regionId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: { ...state.regions, [entry.regionId]: { ...region, greatProjectConstruction: { projectId, tier: nextTier, turnsLeft: turns } } },
        logs: [...state.logs, { year: state.year, message: `Upgrading ${project.name} to tier ${nextTier}.`, type: LogTypes.ACTION }]
      };
    }

    // ---- Space Race, orbital layer (plan §10.4) ----

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
      const costs = ACTION_COSTS.buildMissile[tierId];
      if (!canAfford(state.resources, costs)) return state;
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
      if (!tier || !nation.missiles[tierId]) return state;
      if (!targetRegion || targetRegion.owner === state.playerNationId) return state;
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
      const newUnit = {
        id: unitId,
        regionId,
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
        transportCapacity: isNaval ? NAVAL_TRANSPORT_CAPACITY : null,
        embarkedOn: null
      };
      const recruitingNation = state.nations[state.playerNationId];
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [unitId]: newUnit },
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
      const nextUnits = { ...state.units, [unitId]: { ...unit, regionId: toRegionId, movesLeft: (unit.movesLeft ?? 1) - 1 } };
      // A transport takes its embarked cargo along with it.
      Object.values(state.units).forEach(u => {
        if (u.embarkedOn === unitId) nextUnits[u.id] = { ...u, regionId: toRegionId };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        logs: [...state.logs, { year: state.year, message: `Moved a ${unit.classId} unit to ${REGIONS_DATA[toRegionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.EMBARK_UNIT: {
      const { landUnitId, navalUnitId } = action.payload;
      const landUnit = state.units[landUnitId];
      const navalUnit = state.units[navalUnitId];
      const costs = ACTION_COSTS.embarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || landUnit.domain !== 'land' || landUnit.embarkedOn) return state;
      if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return state;
      if (landUnit.regionId !== navalUnit.regionId) return state;
      const cargoCount = Object.values(state.units).filter(u => u.embarkedOn === navalUnitId).length;
      if (cargoCount >= navalUnit.transportCapacity) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: { ...landUnit, embarkedOn: navalUnitId } },
        logs: [...state.logs, { year: state.year, message: `A ${landUnit.classId} unit embarked for transport.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.DISEMBARK_UNIT: {
      const { landUnitId } = action.payload;
      const landUnit = state.units[landUnitId];
      const costs = ACTION_COSTS.disembarkUnit;
      if (!landUnit || landUnit.ownerId !== state.playerNationId || !landUnit.embarkedOn) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: { ...state.units, [landUnitId]: { ...landUnit, embarkedOn: null } },
        logs: [...state.logs, { year: state.year, message: `A ${landUnit.classId} unit disembarked at ${REGIONS_DATA[landUnit.regionId]?.name}.`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.LAUNCH_INVASION: {
      const { fromRegionId, targetRegionId } = action.payload;
      const fromRegion = state.regions[fromRegionId];
      const targetRegion = state.regions[targetRegionId];
      const costs = ACTION_COSTS.launchInvasion;
      if (!fromRegion || fromRegion.owner !== state.playerNationId) return state;
      if (!targetRegion || targetRegion.owner === state.playerNationId) return state;
      if (!getNeighborIds(fromRegionId).includes(targetRegionId)) return state;
      // Plan §M13: invasions now require an active war with the target's owner — a real
      // pre-existing gap (this check never previously existed) that let the player walk into any
      // neighboring nation's territory with no diplomatic consequence or war-score bookkeeping.
      const invasionWar = state.wars.find(w => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner));
      if (!invasionWar) return state;
      if (!canAfford(state.resources, costs)) return state;

      const attackerUnits = Object.values(state.units).filter(u => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'land');
      if (attackerUnits.length === 0) return state;
      // Plan §M14: one attack per stack per turn — every unit in the attacking stack must still
      // have its move, same movesLeft counter MOVE_ARMY spends (an all-or-nothing gate on the
      // WHOLE stack, matching "an army is every unit in one region" rather than letting some units
      // attack while others that already moved this turn tag along for free).
      if (!attackerUnits.every(u => (u.movesLeft ?? 1) > 0)) return state;
      const defenderUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'land');
      // An undefended region is taken in one hit regardless of its control — walking into an empty
      // city needs no siege. Only a real garrison triggers the multi-turn control-grind below.
      const isDefended = defenderUnits.length > 0;
      const terrain = getRegionTerrain(targetRegionId, REGIONS_DATA);
      // Plan §M14: each side's roster stats (src/data/unitClasses.js) are looked up live from its
      // OWNER's current effective age — a unit auto-upgrades with its nation rather than being
      // frozen at whatever age it was recruited in. The defender has no independent tech age
      // pre-M16 (AI parity), so it fights at the calendar age, same asymmetry the old ages-behind
      // malus already assumed.
      const attackerAgeId = getEffectiveAgeId(state.age, state.techAgeId);

      const rng = createRng(state.rngSeed);
      const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = resolveBattle({
        attackerUnits,
        defenderUnits,
        terrain,
        isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
        rng,
        generals: state.hiredCommanders,
        attackerAgeId,
        defenderAgeId: state.age,
        // defenseLevel's own damage reduction (a genuine "Walls" bonus, on top of the existing
        // siege-vs-fortification gate) — see src/engine/siege.js. Plan §M6: the Defense building's
        // own local.fortLevel stacks on top of the manual defenseLevel (Build Defenses) rather than
        // replacing it — both are real, player-earned investments in the same region. Plan §M14
        // folds Zone of Control into the same slot — a fortified neighbor makes a siege harder too.
        defenderDamageReductionMultiplier: isDefended
          ? getDefenseLevelDamageReductionMultiplier((targetRegion.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total) * getZoneOfControlMultiplier(state.regions, targetRegionId, targetRegion.owner)
          : 1
      });

      // A defended region's control absorbs the damage instead of an outright flip — see
      // src/engine/siege.js's file header. `captured` here means the siege is actually over.
      const { nextControl, captured } = isDefended
        ? resolveSiegeControlDamage({
            currentControl: targetRegion.control,
            outcome,
            hasMeleeUnit: hasMeleeUnitDeployed(resolvedAttackers.filter(u => u.strength > 0))
          })
        : { nextControl: targetRegion.control, captured: outcome === 'attacker' };

      // Only units actually deployed to the front line fought and earn XP; the winning side earns
      // more than the losing side, a draw splits the difference. A Logistician-commanded unit
      // earns extra on top (see src/data/generals.js).
      const XP_WIN = 30;
      const XP_LOSE = 15;
      const attackerXpAmount = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const defenderXpAmount = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const awardBattleXp = (units, deployedIds, xpAmount) => units.map(u => {
        if (!deployedIds.includes(u.id)) return u;
        const gained = Math.round(xpAmount * getGeneralXpMultiplier(state.hiredCommanders[u.commanderId]));
        return awardXp(u, gained);
      });
      const xpAttackers = awardBattleXp(resolvedAttackers, report.deployedAttackerIds, attackerXpAmount);
      const xpDefenders = awardBattleXp(resolvedDefenders, report.deployedDefenderIds, defenderXpAmount);

      const nextUnits = { ...state.units };
      // Attacker survivors occupy the target region only once it's actually captured; a round that
      // merely damages a still-defended region's control falls back to origin, same as a loss —
      // each further round of the grind is a fresh, separately-paid LAUNCH_INVASION. Plan §M14:
      // spends the whole stack's move (one attack per stack per turn) and marks it as having
      // fought this turn, so resolveTurn.js's reinforcement/morale-recovery phase skips it.
      xpAttackers.forEach(u => {
        if (u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = { ...u, regionId: captured ? targetRegionId : fromRegionId, movesLeft: 0, lastBattleTurn: state.turnNumber };
      });
      // A captured region's garrison doesn't remain a coherent defending force — on actual capture
      // the whole defending side is cleared, survivors and routed alike. A round that only damages
      // control (siege continues) persists surviving defenders exactly like a repelled attack does.
      xpDefenders.forEach(u => {
        if (captured || u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = { ...u, lastBattleTurn: state.turnNumber };
      });

      const nextRegions = { ...state.regions };
      if (captured) {
        // Occupation (plan §M13), not annexation: `owner` stays put, `occupiedBy` marks who holds
        // it militarily. Ownership only changes at the peace table (OFFER_PEACE/ACCEPT_PENDING_
        // PEACE's 'cede' term, src/engine/peace.js) — which is also where Aggressive Expansion now
        // fires, since land hasn't actually changed hands yet.
        nextRegions[targetRegionId] = {
          ...targetRegion,
          occupiedBy: state.playerNationId,
          control: 25,
          unrest: Math.max(targetRegion.unrest || 0, 50),
          lastAttackedTurn: state.turnNumber,
          underInvasion: false
        };
      } else if (isDefended) {
        nextRegions[targetRegionId] = { ...targetRegion, control: nextControl, lastAttackedTurn: state.turnNumber, underInvasion: true };
      }

      // War score (plan §M13): this invasion counts as a battle in `invasionWar` regardless of
      // which side of it the player is on, feeding the same score the AI's own peace decisions read.
      const invasionLossShare = captured ? 0.4 : (outcome === 'attacker' ? 0.2 : outcome === 'defender' ? 0.2 : null);
      const invasionWinnerId = outcome === 'attacker' ? state.playerNationId : outcome === 'defender' ? targetRegion.owner : null;
      const nextWars = invasionWinnerId
        ? state.wars.map(w => (w.id === invasionWar.id ? { ...w, battleScore: recordBattle(w, invasionWinnerId, invasionLossShare) } : w))
        : state.wars;

      const outcomeMessage = captured
        ? `Your forces occupy ${REGIONS_DATA[targetRegionId]?.name}, taken from ${state.nations[targetRegion.owner]?.name || targetRegion.owner}.`
        : outcome === 'attacker'
          ? `Your forces broke through at ${REGIONS_DATA[targetRegionId]?.name} (control now ${nextControl}%), but could not yet secure it.`
          : outcome === 'defender'
            ? `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
            : `Your invasion of ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: nextUnits,
        wars: nextWars,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, captured, fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.AMPHIBIOUS_ASSAULT: {
      const { navalUnitId, targetRegionId } = action.payload;
      const navalUnit = state.units[navalUnitId];
      const targetRegion = state.regions[targetRegionId];
      const costs = ACTION_COSTS.amphibiousAssault;
      if (!navalUnit || navalUnit.ownerId !== state.playerNationId || navalUnit.domain !== 'naval') return state;
      if (!targetRegion || targetRegion.owner === state.playerNationId) return state;
      if (!isCoastal(targetRegionId)) return state;
      const isLandAdjacent = getNeighborIds(navalUnit.regionId).includes(targetRegionId);
      const isSeaLaneReachable = isReachableBySea(navalUnit.regionId, targetRegionId, state.age);
      if (!isLandAdjacent && !isSeaLaneReachable) return state;
      const embarkedLandUnits = Object.values(state.units).filter(u => u.embarkedOn === navalUnitId && u.ownerId === state.playerNationId);
      if (embarkedLandUnits.length === 0) return state;
      // Plan §M13: an amphibious assault requires an active war with the target's owner, same as a
      // land LAUNCH_INVASION (see that case's own comment for why this check is new).
      const invasionWar = state.wars.find(w => w.active && isWarBetween(w, state.playerNationId, targetRegion.owner));
      if (!invasionWar) return state;
      // Plan §M14: one attack per stack per turn — the transport and its whole embarked cargo.
      if ((navalUnit.movesLeft ?? 1) <= 0 || !embarkedLandUnits.every(u => (u.movesLeft ?? 1) > 0)) return state;
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const nextUnits = { ...state.units };
      const terrain = getRegionTerrain(targetRegionId, REGIONS_DATA);
      const attackerAgeId = getEffectiveAgeId(state.age, state.techAgeId);

      // Naval interception (plan §7.5): a defending fleet forces a naval battle before the landing.
      // Losing it sinks the transport and everything still aboard, and the assault never lands.
      const defenderNavalUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
      if (defenderNavalUnits.length > 0) {
        const navalBattle = resolveBattle({
          attackerUnits: [navalUnit],
          defenderUnits: defenderNavalUnits,
          terrain,
          isAttackingFortification: false,
          rng,
          generals: state.hiredCommanders,
          attackerAgeId,
          defenderAgeId: state.age
        });
        navalBattle.defenderUnits.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });
        if (navalBattle.outcome !== 'attacker') {
          delete nextUnits[navalUnitId];
          embarkedLandUnits.forEach(u => delete nextUnits[u.id]);
          return {
            ...state,
            resources: applyCosts(state.resources, costs),
            units: nextUnits,
            rngSeed: rng.getSeed(),
            lastBattleReport: { ...navalBattle.report, kind: 'naval', fromRegionId: navalUnit.regionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
            logs: [...state.logs, { year: state.year, message: `Your invasion fleet was intercepted and sunk approaching ${REGIONS_DATA[targetRegionId]?.name}.`, type: LogTypes.COMBAT }]
          };
        }
        nextUnits[navalUnitId] = navalBattle.attackerUnits[0];
      }

      // No existing foothold near the target means the landing itself takes the amphibious malus;
      // once the attacker already holds a neighboring region, further attacks staged from it are normal.
      const hasBeachhead = getNeighborIds(targetRegionId).some(nId => state.regions[nId]?.owner === state.playerNationId);
      const attackerLandUnits = embarkedLandUnits.map(u => nextUnits[u.id] || u);
      const defenderLandUnits = Object.values(nextUnits).filter(u => u.regionId === targetRegionId && u.domain === 'land');
      const isDefended = defenderLandUnits.length > 0;

      const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = resolveBattle({
        attackerUnits: attackerLandUnits,
        defenderUnits: defenderLandUnits,
        terrain,
        isAttackingFortification: (targetRegion.defenseLevel || 0) > 0,
        rng,
        generals: state.hiredCommanders,
        attackerAgeId,
        defenderAgeId: state.age,
        attackerPenaltyMultiplier: hasBeachhead ? 1 : AMPHIBIOUS_PENALTY_MULT,
        defenderDamageReductionMultiplier: isDefended
          ? getDefenseLevelDamageReductionMultiplier((targetRegion.defenseLevel || 0) + getRegionModifier(state, targetRegionId, 'local.fortLevel').total) * getZoneOfControlMultiplier(state.regions, targetRegionId, targetRegion.owner)
          : 1
      });

      // See src/engine/siege.js — a defended region's control absorbs the damage instead of an
      // outright flip; undefended coastline is still taken in one landing.
      const { nextControl, captured } = isDefended
        ? resolveSiegeControlDamage({
            currentControl: targetRegion.control,
            outcome,
            hasMeleeUnit: hasMeleeUnitDeployed(resolvedAttackers.filter(u => u.strength > 0))
          })
        : { nextControl: targetRegion.control, captured: outcome === 'attacker' };

      const XP_WIN = 30;
      const XP_LOSE = 15;
      const attackerXpAmount = outcome === 'attacker' ? XP_WIN : outcome === 'defender' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const defenderXpAmount = outcome === 'defender' ? XP_WIN : outcome === 'attacker' ? XP_LOSE : Math.round((XP_WIN + XP_LOSE) / 2);
      const awardBattleXp = (units, deployedIds, xpAmount) => units.map(u => {
        if (!deployedIds.includes(u.id)) return u;
        const gained = Math.round(xpAmount * getGeneralXpMultiplier(state.hiredCommanders[u.commanderId]));
        return awardXp(u, gained);
      });
      const xpAttackers = awardBattleXp(resolvedAttackers, report.deployedAttackerIds, attackerXpAmount);
      const xpDefenders = awardBattleXp(resolvedDefenders, report.deployedDefenderIds, defenderXpAmount);

      // Survivors disembark onto the beach only once it's actually captured; a round that merely
      // damages a still-defended region's control falls back aboard the transport, still embarked,
      // for another attempt — matching how a land LAUNCH_INVASION falls back to origin.
      xpAttackers.forEach(u => {
        if (u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = captured
          ? { ...u, regionId: targetRegionId, embarkedOn: null, movesLeft: 0, lastBattleTurn: state.turnNumber }
          : { ...u, regionId: navalUnit.regionId, embarkedOn: navalUnitId, movesLeft: 0, lastBattleTurn: state.turnNumber };
      });
      xpDefenders.forEach(u => {
        if (captured || u.strength <= 0) { delete nextUnits[u.id]; return; }
        nextUnits[u.id] = { ...u, lastBattleTurn: state.turnNumber };
      });
      if (nextUnits[navalUnitId]) nextUnits[navalUnitId] = { ...nextUnits[navalUnitId], movesLeft: 0, lastBattleTurn: state.turnNumber };

      const nextRegions = { ...state.regions };
      if (captured) {
        // Occupation, not annexation — see LAUNCH_INVASION's own comment on this (plan §M13).
        nextRegions[targetRegionId] = {
          ...targetRegion,
          occupiedBy: state.playerNationId,
          control: 25,
          unrest: Math.max(targetRegion.unrest || 0, 50),
          lastAttackedTurn: state.turnNumber,
          underInvasion: false
        };
      } else if (isDefended) {
        nextRegions[targetRegionId] = { ...targetRegion, control: nextControl, lastAttackedTurn: state.turnNumber, underInvasion: true };
      }

      const assaultLossShare = captured ? 0.4 : (outcome === 'attacker' ? 0.2 : outcome === 'defender' ? 0.2 : null);
      const assaultWinnerId = outcome === 'attacker' ? state.playerNationId : outcome === 'defender' ? targetRegion.owner : null;
      const nextWars = assaultWinnerId
        ? state.wars.map(w => (w.id === invasionWar.id ? { ...w, battleScore: recordBattle(w, assaultWinnerId, assaultLossShare) } : w))
        : state.wars;

      const outcomeMessage = captured
        ? `Your amphibious assault occupies ${REGIONS_DATA[targetRegionId]?.name}, taken from ${state.nations[targetRegion.owner]?.name || targetRegion.owner}.`
        : outcome === 'attacker'
          ? `Your landing broke through at ${REGIONS_DATA[targetRegionId]?.name} (control now ${nextControl}%), but could not yet secure it.`
          : outcome === 'defender'
            ? `Your amphibious assault on ${REGIONS_DATA[targetRegionId]?.name} was repelled.`
            : `Your amphibious assault on ${REGIONS_DATA[targetRegionId]?.name} ended in a mutual withdrawal.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: nextUnits,
        wars: nextWars,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, captured, kind: 'amphibious', fromRegionId: navalUnit.regionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: targetRegion.owner },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.NAVAL_ENGAGEMENT: {
      const { fromRegionId, targetRegionId } = action.payload;
      const fromRegion = state.regions[fromRegionId];
      const costs = ACTION_COSTS.navalEngagement;
      if (!fromRegion || fromRegion.owner !== state.playerNationId) return state;
      const isLandAdjacent = getNeighborIds(fromRegionId).includes(targetRegionId);
      const isSeaLaneReachable = isReachableBySea(fromRegionId, targetRegionId, state.age);
      if (!isLandAdjacent && !isSeaLaneReachable) return state;
      const attackerNavalUnits = Object.values(state.units).filter(u => u.regionId === fromRegionId && u.ownerId === state.playerNationId && u.domain === 'naval');
      if (attackerNavalUnits.length === 0) return state;
      // Plan §M14: one attack per stack per turn.
      if (!attackerNavalUnits.every(u => (u.movesLeft ?? 1) > 0)) return state;
      const defenderNavalUnits = Object.values(state.units).filter(u => u.regionId === targetRegionId && u.domain === 'naval' && u.ownerId !== state.playerNationId);
      if (defenderNavalUnits.length === 0) return state;
      if (!canAfford(state.resources, costs)) return state;

      const rng = createRng(state.rngSeed);
      const { outcome, attackerUnits: resolvedAttackers, defenderUnits: resolvedDefenders, report } = resolveBattle({
        attackerUnits: attackerNavalUnits,
        defenderUnits: defenderNavalUnits,
        terrain: getRegionTerrain(targetRegionId, REGIONS_DATA),
        isAttackingFortification: false,
        rng,
        generals: state.hiredCommanders,
        attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
        defenderAgeId: state.age
      });

      // A naval engagement only contests the lane — survivors hold their own positions, win or
      // lose; there's no ground to capture from a fleet-on-fleet action.
      const nextUnits = { ...state.units };
      resolvedAttackers.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = { ...u, movesLeft: 0, lastBattleTurn: state.turnNumber }; });
      resolvedDefenders.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = { ...u, lastBattleTurn: state.turnNumber }; });

      const outcomeMessage = outcome === 'attacker'
        ? `Your fleet cleared the enemy from the waters near ${REGIONS_DATA[targetRegionId]?.name}.`
        : outcome === 'defender'
          ? `Your fleet was driven off near ${REGIONS_DATA[targetRegionId]?.name}.`
          : `Your fleet's engagement near ${REGIONS_DATA[targetRegionId]?.name} ended inconclusively.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        units: nextUnits,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, kind: 'naval', fromRegionId, targetRegionId, attackerNationId: state.playerNationId, defenderNationId: state.regions[targetRegionId]?.owner },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
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
      const { outcome, attackerUnits: resolvedGarrison, defenderUnits: resolvedRebels, report } = resolveBattle({
        attackerUnits: garrisonUnits,
        defenderUnits: rebelUnits,
        terrain: getRegionTerrain(regionId, REGIONS_DATA),
        isAttackingFortification: false,
        rng,
        generals: state.hiredCommanders,
        attackerAgeId: getEffectiveAgeId(state.age, state.techAgeId),
        defenderAgeId: state.age
      });

      const nextUnits = { ...state.units };
      resolvedGarrison.forEach(u => { if (u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = { ...u, movesLeft: 0, lastBattleTurn: state.turnNumber }; });
      // The rebellion is crushed outright on a win — a defeated uprising doesn't leave survivors
      // to regroup the way a foreign army might retreat and return.
      resolvedRebels.forEach(u => { if (outcome === 'attacker' || u.strength <= 0) delete nextUnits[u.id]; else nextUnits[u.id] = u; });

      const nextRegions = { ...state.regions };
      if (outcome === 'attacker') {
        nextRegions[regionId] = {
          ...region,
          unrest: Math.min(region.unrest, REBELLION_UNREST_THRESHOLD - 10),
          control: Math.min(100, (region.control || 0) + 20)
        };
      }

      const outcomeMessage = outcome === 'attacker'
        ? `The rebellion in ${REGIONS_DATA[regionId]?.name} has been crushed.`
        : outcome === 'defender'
          ? `Your garrison failed to suppress the rebellion in ${REGIONS_DATA[regionId]?.name}.`
          : `The fighting in ${REGIONS_DATA[regionId]?.name} ended without a clear result.`;

      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        units: nextUnits,
        rngSeed: rng.getSeed(),
        lastBattleReport: { ...report, kind: 'rebellion', fromRegionId: regionId, targetRegionId: regionId, attackerNationId: state.playerNationId, defenderNationId: REBEL_OWNER_ID },
        logs: [...state.logs, { year: state.year, message: outcomeMessage, type: LogTypes.COMBAT }]
      };
    }

    case ActionTypes.RESEARCH_TECH: {
      const { techId } = action.payload;
      const tech = TECH_TREE[techId];
      if (!tech) return state;
      // Plan §M7: research costs the power of the tech's own line's pool (age-scaled,
      // getTechPowerCost) plus techPoints — gold is gone. national.researchCost and (for the
      // currently-focused line) Research Focus's own -15% power discount both apply.
      const agesBehind = getAgesBehind(state.age, state.techAgeId);
      const researchCostMult = getModifier(state, state.playerNationId, 'national.researchCost').total;
      const focused = state.researchFocus === tech.category;
      if (!canResearchTech(techId, state.techTree, state.resources, state.year, TECH_TREE, agesBehind, researchCostMult, focused).can) return state;

      const nextTechTree = { ...state.techTree, [techId]: { ...state.techTree[techId], researched: true } };

      // Tech-earned age (plan §2): once a majority of the current tech age's line is researched,
      // it advances — see src/data/ages.js's getEffectiveAgeId, which is what actually gates
      // buildings/units/extraction one age ahead of the calendar as a result.
      const currentAgeTechs = getTechsForAge(state.techAgeId);
      const researchedCount = currentAgeTechs.filter(t => nextTechTree[t.id]?.researched).length;
      const nextTechAgeIndex = AGE_ORDER.indexOf(state.techAgeId) + 1;
      const advancesTechAge = researchedCount >= TECH_AGE_ADVANCEMENT_THRESHOLD && nextTechAgeIndex < AGE_ORDER.length;
      const nextTechAgeId = advancesTechAge ? AGE_ORDER[nextTechAgeIndex] : state.techAgeId;

      const costMult = getAgesBehindResearchCostMultiplier(agesBehind);
      const powerCost = Math.round(getTechPowerCost(tech, { researchCostMult, focused }) * costMult);
      const techPointsCost = Math.round(tech.cost.techPoints * (1 + researchCostMult) * costMult);
      const pool = TECH_RESEARCH_POOL[tech.category];
      const resourcesAfterTechCost = {
        ...state.resources,
        [pool]: state.resources[pool] - powerCost,
        techPoints: state.resources.techPoints - techPointsCost
      };

      return {
        ...state,
        resources: resourcesAfterTechCost,
        techTree: nextTechTree,
        techAgeId: nextTechAgeId,
        logs: [
          ...state.logs,
          { year: state.year, message: `Researched ${tech.name}.`, type: LogTypes.TECH },
          ...(advancesTechAge ? [{ year: state.year, message: `Your empire's expertise has reached the ${AGES[nextTechAgeId]?.name}.`, type: LogTypes.MILESTONE }] : [])
        ]
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
      // Plan §M21 balance fix: scripts/simulate.mjs found ~30-40% of nations hitting a Succession
      // Crisis (and its 40% civil-war roll) almost immediately after becoming a monarchy — because
      // `heir` stays null until a reign actually ENDS (see createInitialState's own comment on why
      // it starts null), a brand-new monarchy's first-ever reign end was ALWAYS heirless. Generating
      // an heir the moment a nation first becomes hereditary — same as a real dynasty already having
      // an heir apparent — closes that gap without touching the succession-crisis mechanic itself.
      const rng = createRng(state.rngSeed);
      const needsHeir = getSuccessionStyle({ type: typeId }) === 'hereditary' && !nation.heir;
      const heir = needsHeir ? generateHeir(state.playerNationId, rng, nation.ruler?.dynasty, state.turnNumber) : nation.heir;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            government: { type: typeId, reforms: resetReformsForType(typeId, state.age) },
            stability: clampStability((nation.stability || 0) - 2),
            heir
          }
        },
        rngSeed: rng.getSeed(),
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

    case ActionTypes.SEIZE_LAND: {
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.seizeLand;
      if (!canDoEstateInteraction(nation, 'seizeLand', state.turnNumber)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const estates = {};
      Object.entries(nation.estates).forEach(([id, estate]) => {
        estates[id] = { ...estate, loyalty: Math.max(0, estate.loyalty - CROWN_LAND_SEIZE_LOYALTY_PENALTY) };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            crownLand: clampCrownLand(nation.crownLand + CROWN_LAND_SEIZE_AMOUNT),
            estates,
            estateInteractionCooldowns: { ...nation.estateInteractionCooldowns, seizeLand: state.turnNumber + ESTATE_INTERACTION_COOLDOWN_TURNS }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Seized crown land from the estates. (+${CROWN_LAND_SEIZE_AMOUNT} crown land, -${CROWN_LAND_SEIZE_LOYALTY_PENALTY} loyalty for every estate)`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.SELL_LAND: {
      const nation = state.nations[state.playerNationId];
      const costs = ACTION_COSTS.sellLand;
      if (!canDoEstateInteraction(nation, 'sellLand', state.turnNumber)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const totalDev = Object.values(state.regions).reduce((sum, r) => sum + (r.owner === state.playerNationId ? getTotalDev(r) : 0), 0);
      const goldGain = 5 * totalDev;
      const afterCost = applyCosts(state.resources, costs);
      const burghers = nation.estates.burghers;
      return {
        ...state,
        resources: { ...afterCost, gold: (afterCost.gold || 0) + goldGain },
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            crownLand: clampCrownLand(nation.crownLand - CROWN_LAND_SELL_AMOUNT),
            estates: { ...nation.estates, burghers: { ...burghers, loyalty: Math.min(100, burghers.loyalty + CROWN_LAND_SELL_BURGHER_LOYALTY_BONUS) } },
            estateInteractionCooldowns: { ...nation.estateInteractionCooldowns, sellLand: state.turnNumber + ESTATE_INTERACTION_COOLDOWN_TURNS }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Sold crown land to the burghers for ${formatMoney(goldGain)}. (-${CROWN_LAND_SELL_AMOUNT} crown land, +${CROWN_LAND_SELL_BURGHER_LOYALTY_BONUS} burgher loyalty)`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.GRANT_ESTATE_PRIVILEGE: {
      const { estateId, privilegeId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const estate = nation.estates?.[estateId];
      const privilege = getPrivilege(estateId, privilegeId);
      const costs = ACTION_COSTS.grantEstatePrivilege;
      if (!estate || !privilege || estate.privileges.includes(privilegeId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...nation, estates: { ...nation.estates, [estateId]: { ...estate, privileges: [...estate.privileges, privilegeId] } } }
        },
        logs: [...state.logs, { year: state.year, message: `Granted the ${privilege.name} privilege to the ${ESTATE_LABELS[estateId]}.`, type: LogTypes.MILESTONE }]
      };
    }

    case ActionTypes.REVOKE_ESTATE_PRIVILEGE: {
      const { estateId, privilegeId } = action.payload;
      const nation = state.nations[state.playerNationId];
      const estate = nation.estates?.[estateId];
      const privilege = getPrivilege(estateId, privilegeId);
      const costs = ACTION_COSTS.revokeEstatePrivilege;
      if (!estate || !privilege || !estate.privileges.includes(privilegeId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: {
          ...state.nations,
          [state.playerNationId]: {
            ...nation,
            stability: clampStability((nation.stability || 0) - 1),
            estates: {
              ...nation.estates,
              [estateId]: { ...estate, privileges: estate.privileges.filter((id) => id !== privilegeId), loyalty: Math.max(0, estate.loyalty - REVOKE_PRIVILEGE_LOYALTY_PENALTY) }
            }
          }
        },
        logs: [...state.logs, { year: state.year, message: `Revoked the ${privilege.name} privilege from the ${ESTATE_LABELS[estateId]}. (-1 stability, -${REVOKE_PRIVILEGE_LOYALTY_PENALTY} loyalty)`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.CLERGY_TITHE: {
      const nation = state.nations[state.playerNationId];
      const clergy = nation.estates?.clergy;
      const costs = ACTION_COSTS.clergyTithe;
      if (!clergy) return state;
      if (!canAfford(state.resources, costs)) return state;
      const totalDev = Object.values(state.regions).reduce((sum, r) => sum + (r.owner === state.playerNationId ? getTotalDev(r) : 0), 0);
      const goldGain = totalDev * 2;
      const afterCost = applyCosts(state.resources, costs);
      return {
        ...state,
        resources: { ...afterCost, gold: (afterCost.gold || 0) + goldGain },
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...nation, estates: { ...nation.estates, clergy: { ...clergy, loyalty: Math.max(0, clergy.loyalty - ESTATE_ASK_LOYALTY_PENALTY) } } }
        },
        logs: [...state.logs, { year: state.year, message: `The Clergy tithes ${formatMoney(goldGain)} to the crown. (-${ESTATE_ASK_LOYALTY_PENALTY} clergy loyalty)`, type: LogTypes.ACTION }]
      };
    }

    case ActionTypes.NOBILITY_LEVIES: {
      const nation = state.nations[state.playerNationId];
      const nobility = nation.estates?.nobility;
      const costs = ACTION_COSTS.nobilityLevies;
      if (!nobility) return state;
      if (!canAfford(state.resources, costs)) return state;
      const totalDev = Object.values(state.regions).reduce((sum, r) => sum + (r.owner === state.playerNationId ? getTotalDev(r) : 0), 0);
      const hrGain = totalDev * 2;
      const afterCost = applyCosts(state.resources, costs);
      return {
        ...state,
        resources: { ...afterCost, hr: (afterCost.hr || 0) + hrGain },
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...nation, estates: { ...nation.estates, nobility: { ...nobility, loyalty: Math.max(0, nobility.loyalty - ESTATE_ASK_LOYALTY_PENALTY) } } }
        },
        logs: [...state.logs, { year: state.year, message: `The Nobility raises levies: +${Math.round(hrGain)} manpower. (-${ESTATE_ASK_LOYALTY_PENALTY} nobility loyalty)`, type: LogTypes.ACTION }]
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
      if (!target || nationId === state.playerNationId || target.isAtWar || player?.vassalOf) return state;
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
      const { nationId } = action.payload;
      const player = state.nations[state.playerNationId];
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.fabricateClaim;
      if (!target || nationId === state.playerNationId || player.claims.includes(nationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: { ...player, claims: [...player.claims, nationId] } },
        logs: [...state.logs, { year: state.year, message: `Fabricated a claim against ${target.name}.`, type: LogTypes.DIPLOMACY }]
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
        nations: nextNations,
        wars: state.wars.map(w => (w.id === war.id ? { ...w, active: false, goalAchieved: true } : w)),
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
        nations: nextNations,
        wars: state.wars.map(w => (w.id === war.id ? { ...w, active: false, goalAchieved: true } : w)),
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
        nations: nextNations,
        wars: state.wars.map(w => (w.id === war.id ? { ...w, active: false, goalAchieved: true } : w)),
        pendingPeaceOffer: null,
        logs: [...state.logs, { year: state.year, message: `You accept peace with ${nextNations[recipientId]?.name || recipientId}.`, type: LogTypes.DIPLOMACY }]
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

    case ActionTypes.MILITARY_ALLIANCE: {
      const { nationId } = action.payload;
      const target = state.nations[nationId];
      const costs = ACTION_COSTS.militaryAlliance;
      if (!target || target.isAtWar || target.hasMilitaryPact) return state;
      // Alliance acceptance (plan §M12: "opinion/4 + prestige/10 ... accept if > 0"), adapted onto
      // this codebase's real axes: hostility stands in for opinion (inverted, since 50 is neutral
      // on a 0-100 hostility scale the way 0 is neutral on a signed opinion scale), and an existing
      // trade agreement is a flat vote of confidence — replacing the old flat hostility-ceiling
      // gate with a real scored formula.
      const acceptanceScore = (50 - (target.hostility || 0)) / 2 + (target.prestige || 0) / 10 + (target.hasTradeAgreement ? 20 : 0);
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
        if (type === 'support_rebels') {
          const targetRegionId = regionId && state.regions[regionId]?.owner === nationId ? regionId : getCapital(state, nationId);
          const targetRegion = state.regions[targetRegionId];
          if (!targetRegion) return state;
          return {
            ...state,
            resources: resourcesAfterCost,
            regions: { ...state.regions, [targetRegionId]: { ...targetRegion, unrest: Math.min(100, (targetRegion.unrest || 0) + ESPIONAGE_SUPPORT_REBELS_UNREST_INCREASE) } },
            rngSeed: rng.getSeed(),
            logs: [...state.logs, { year: state.year, message: `Your agents stirred unrest in ${REGIONS_DATA[targetRegionId]?.name || targetRegionId}.`, type: LogTypes.DIPLOMACY }]
          };
        }
        return {
          ...state,
          resources: { ...resourcesAfterCost, techPoints: (resourcesAfterCost.techPoints || 0) + ESPIONAGE_TECH_POINTS_STOLEN },
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
      // Plan: "both monarchies" — this codebase's own real hereditary/monarchy check (M3).
      if (getSuccessionStyle(player.government) !== 'hereditary' || getSuccessionStyle(target.government) !== 'hereditary') return state;
      if ((player.marriageWith || []).includes(nationId)) return state;
      if (!canAfford(state.resources, costs)) return state;
      const nextTarget = { ...target, hostility: Math.max(target.hostilityFloor || 0, target.hostility - MARRIAGE_HOSTILITY_REDUCTION) };
      const nextPlayer = {
        ...player,
        marriageWith: [...(player.marriageWith || []), nationId],
        heir: player.heir ? { ...player.heir, claim: Math.min(100, player.heir.claim + MARRIAGE_HEIR_CLAIM_BONUS) } : player.heir
      };
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        nations: { ...state.nations, [state.playerNationId]: nextPlayer, [nationId]: nextTarget },
        logs: [...state.logs, { year: state.year, message: `A royal marriage was arranged with ${target.name}.${player.heir ? ` (+${MARRIAGE_HEIR_CLAIM_BONUS} heir claim)` : ''}`, type: LogTypes.DIPLOMACY }]
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
      if (!target || nationId === state.playerNationId || target.isAtWar || target.vassalOf) return state;
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
        if (nextRegions[regionId].owner === nationId) nextRegions[regionId] = { ...nextRegions[regionId], owner: state.playerNationId };
      });
      return {
        ...state,
        resources: applyCosts(state.resources, costs),
        regions: nextRegions,
        nations: {
          ...state.nations,
          [state.playerNationId]: { ...player, vassals: player.vassals.filter((id) => id !== nationId) },
          [nationId]: { ...target, vassalOf: null }
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

    case ActionTypes.RESET_GAME: {
      // playerNationId/gameSpeed/difficultyId come from the start screen; doctrineId comes from
      // meta-progression localStorage via the component layer — see GameProvider.resetGame below.
      // This keeps gameReducer a pure function of (state, action).
      const { playerNationId, gameSpeed, doctrineId, difficultyId } = action.payload || {};
      const fresh = createInitialState({ playerNationId, gameSpeed });
      const withDoctrine = doctrineId ? applyStartingDoctrine(fresh, doctrineId) : fresh;
      return difficultyId ? applyDifficulty(withDoctrine, difficultyId) : withDoctrine;
    }

    default:
      return state;
  }
};

// Re-exported so the Supabase edge bundle (scripts/build-edge-engine.mjs, whose entry point is
// this file) carries the save-migration layer automatically, without a separate bundling step —
// see src/engine/saveMigrations.js for why this exists and what it does.
export { migrateSave, CURRENT_SAVE_VERSION } from './saveMigrations';
