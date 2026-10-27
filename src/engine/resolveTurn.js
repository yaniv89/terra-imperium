import { applyArmyDesertion, DESERTION_SHARE, DESERTION_MORALE } from './armyDesertion';
import { processAIAccords } from './aiAccords';
import { processWorldCongress } from './worldCongress';
import { advanceTutorial } from './tutorial';
export { DESERTION_SHARE, DESERTION_MORALE, DESERTION_DISBAND_BELOW } from './armyDesertion';
import { processLateArrivals, independentCityCtx } from './independents';
import { forageCtx } from '../data/hearths';
import { updateCamps } from './tribalCamps';
import { stonePhaseCtx } from './stonePhase';
import { isIndependent, isIndependentNation } from '../data/independents';
import { processAIOperations } from './aiOperations';
import { processIndependents } from './raids';
import { keepQueued } from './battleQueue';
import { processFortBattles } from './forts';
import { processMajorsAndIndependents } from './indepPolicy';
import { reconcileTerritory } from './worldLifecycle';
import { invalidateRegionsCache } from '../data/regions';
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
import { speedCostMult, speedTrainMult, isAgeAtLeast, speedTurns, FIRST_AGE_ID } from '../data/ages';
import { sideAgeOf } from './ageRefs';
import { displayYear } from './displayYear';
import { endingSignal, nextDominance, dominanceHold } from './ending';
import { awardEraLegacy, payEraGoals, eraGoalLog } from './eraGoals';
import { createEmptyResourcePool } from '../data/resources';
import { drawEvent, cardOf } from './eventDeck';
import { processCrises } from './crises';
import { crisisCardId } from '../data/crises';
import { applyEventEffects, getOptionShortfall } from './applyEventEffects';
import { exploreOn } from './hostility';
import { calcIncome, nextUnrest, getNationBonusTotal, getFieldedStrength } from '../utils/helpers';
import { getRegionModifier, getModifier } from './modifiers/sheet';
import { nextSiegeControlRegen, SIEGE_REGEN_COOLDOWN_TURNS } from './siege';
import { getPopulationGrowthRate, nextRegionPopulation, peopleOf } from './population';
import { checkNationElimination, unlinkEliminatedVassalage, closeWarsForEliminatedNation, wasEliminatedByPlayer, NATION_ELIMINATION_REWARD, checkPlayerDefeat } from './elimination';
import { processAllAINations, processAIWarDecisions, processAIRecruitment, getSortedByMilitary, getRelationFromHostility, getNationTier } from '../utils/aiLogic';
import { calcAllNationIncomes, processAIEconomyTurn, settleAIUpkeep, thinksThisTurn } from './aiEconomy';
import { aiBudgetStep } from './aiBudget';
import { warBurdenInputs, warExhaustionRise } from './warBurden';
import { isUnitInBattle } from './invasion';
import { stampUnitAges, aiUpgradeUnits } from './unitUpgrades';
import { isRobot } from './robots';
import { isBound, AI_LIMITS_CAP } from '../data/worldCongress';
import { automationOf, automationTarget, nextAutomation, isRioting, uprisingStep, startUprising, AUTOMATION_RIOT_UNREST, AUTOMATION_UPRISING_AT, AUTOMATION_UPRISING_STABILITY, UPRISING_WARNING_REF_TURNS } from './automation';
import { resolveWarProgress, refreshWarFlags } from './diplomacy';
import { drainAutoBattles } from './battleQueue';
import { transferRegion } from './regionTransfer';
import { checkVictoryConditions, applyVictory, VICTORY_CONDITIONS } from '../data/victoryConditions';
import { getPlayerRank } from './score';
import { REGIONS_DATA, getCapital } from '../data/regions';
import {
  REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, REBEL_GROWTH_RATE, REBEL_MAX_GROWTH_MULT, getRebelSpawnStrength,
  REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD, REVOLT_RECLAIMED_CONTROL, REVOLT_RECLAIMED_UNREST
} from '../data/rebellion';
import { createRng } from '../utils/rng';
import { processCities, growthThreshold, privateWorld, unitWaitsForTech } from './world/cities';
import { makeSettler, processSettlers, bestSites, isSettler, foundAiVillages } from './settlers';
import { chooseProduction, nationCounts } from './aiProduction';
import { syncWorldRegistry } from './world/registry';
import { lodPeriod, settlesThisTurn, turnsToSettle } from './world/lod';
import { applyMarketHousing } from './world/market';
import { getTiles } from '../data/geo/tiles';
import { getResearched, ageOf } from './nationState';
import { libertyDesireTarget, libertyInputs, nextLibertyDesire } from './vassals';
import { levyUnit, decayDevastation, devastationGrowthPenalty } from './aftermath';
import { expireNationModifiers, expireRegionModifiers } from './modifiers/timed';
import { TAX_RATES } from '../data/taxRates';
import {
  UNIT_UPKEEP_GOLD_PER_TURN, ARMY_MAINTENANCE_DEFAULT, FORT_UPKEEP_GOLD_PER_FORT_LEVEL,
  DIPLOMAT_IMPROVE_RELATIONS_HOSTILITY_DECAY_PER_TURN, VASSAL_TRIBUTE_RATE, VASSAL_TRIBUTE_GOLD_PER_DEV_POINT,
  RIVAL_ELIMINATED_PRESTIGE_REWARD, CAPITAL_OCCUPIED_STABILITY_PENALTY,
  ECONOMIC_COLLAPSE_STABILITY_PENALTY
} from '../data/actionCosts';
import { getAdvisorSalary, aiDevelopRuler, rulerLevel } from './rulers';
import { grantRenown, timeRenown } from './renown';
import { tickAmbitions, ambitionDef } from './ambitions';
import { tickChronicle } from './chronicle';
import { RENOWN, STABILITY_RENOWN_REF_TURNS, STABILITY_RENOWN_GAP_REF_TURNS } from '../data/rulers';
import { grantDecree, tickDecrees } from './decrees';
import { applyResearchTurn, researchesThisTurn } from './research';
import { processNationalPowerTurn, clampStability, clampPrestige, STABILITY_MAX, getOverextension } from './nationalPower';
import { GREAT_PROJECTS, cityWonderTotal } from '../data/greatProjects';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { clampMaintenance, getLoanCapacity, getLoanSize, getLoanInterestRate, applyBankruptcy, buildingUpkeepOf } from './economy';
import {
  nextLowStabilityStreak, isStabilityCivilWarTrigger, startCivilWar, processCivilWarTurn, inCivilWarCooldown
} from './civilWar';
import { processDisastersTurn, nextEconomicCollapseProgress, isEconomicCollapseDisasterReady } from './disasters';
import { getTotalDev, devFromYields } from './development';
import { decayAggressiveExpansion } from './expansion';
import { advanceClaims } from './claims';
import { updateDefensivePacts } from './pacts';
import { computeSupplyFlow, isCampaigning, unitsByOwner, HUNGER_MORALE } from './supplies';
import { advanceMarches, marchUpkeep, unitsAtTurnStart } from './routes';
import { normalizeUnitTiles } from './armies';
import { canReinforce } from './unitLocation';
import { applySupplyMeter, SUPPLY_LINE_RINGS } from './supplyMeter';
import { processSieges } from './sieges';
import { opinionOf, opinionGivesCasusBelli } from './opinion';
import { applyLoyalty } from './loyalty';
import { settleOpenCaptures } from './capture';
import { processColonies } from './colonies';
import { hasPerk } from '../data/promotions';
import { governorEffects, governorOf, regroupGovernors, generateGovernorCandidates, GOVERNOR_UNREST_MULT, GOVERNOR_REFRESH_TURNS } from './governors';
import { lawRulesOf, rulerCityCtx } from './lawRules';
import { advanceTradeDisruptions } from './tradeDisruptions';
import { authorityRisksCivilWar } from './authority';
import { rollCityDisasters } from './cityDisasters';
import { spreadPlague, seedPlagueNear, PLAGUE_EVENT_ORIGINS } from './plague';
import { updateWarHeat } from './warContagion';
import { navalCargo } from '../data/navalLines';
import { ringsFromF75 } from '../data/geo/gridScale';
import { updateFog } from './fog';
import { processAIMapOffers } from './mapTrade';
import { continueExplorers, EXPLORER_STRENGTH } from './scouting';
import { repairCityDamage } from './cityManifest';
import { msg, carry, sub, people, cityRef, thing, person } from './messages';
import { copyTileMap } from './world/tileIndex';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const WAR_EXHAUSTION_DECAY_PER_TURN = 3;

// War exhaustion past WAR_WEARINESS_FROM adds (WE - FROM) / SCALE unrest per turn in every province.
export const WAR_WEARINESS_FROM = 40;
export const WAR_WEARINESS_SCALE = 40;
// Bankruptcy's cost to the army: the share of men who desert, the morale every unit loses, and the
// size below which a unit simply dissolves.

// `onPhase(name, ms)` is an optional perf hook (src/engine/aiQualityBenchmark.test.js's M0.4 perf
// harness is the only caller) fired after each named phase below with how long it took. It costs
// one optional-chained call per phase when absent, so normal play and every other test pay nothing
// for it; when present the closure trades one `performance.now()` read per phase for the timing.
// The cities phase: processCities over state.regions (every region is a city on the tile world),
// then the legacy fields the rest of the engine reads are refreshed from the result (dev mirrors
// the yields, population follows size) and finished units join state.units.
const runCitiesPhase = (state, newTurnNumber) => {
  if (!state.world) return { state, logs: [] };
  const tiles = getTiles();
  const luxuriesByNation = {};
  Object.values(state.regions).forEach((c) => { if (c.owner && c.lastYields?.luxuries) { (luxuriesByNation[c.owner] ||= new Set()); c.lastYields.luxuries.forEach((l) => luxuriesByNation[c.owner].add(l)); } });
  const citiesOwned = {};
  Object.values(state.regions).forEach((c) => { if (c.owner) citiesOwned[c.owner] = (citiesOwned[c.owner] || 0) + 1; });
  const ctxCache = new Map();
  const nationCtx = (nid) => {
    if (!ctxCache.has(nid)) {
      ctxCache.set(nid, {
        researched: nid ? getResearched(state, nid) : [],
        ageId: ageOf(state, nid),
        turnNumber: newTurnNumber,
        citiesOwned: citiesOwned[nid] || 1,
        speedMult: speedCostMult(state.gameSpeed, ageOf(state, nid)), // the speed table (ages.js)
        trainMult: speedTrainMult(state.gameSpeed, ageOf(state, nid)), // units and settlers (I024)
        luxuries: luxuriesByNation[nid] ? luxuriesByNation[nid].size : 0,
        greatProjects: state.greatProjects || {},
        ...forageCtx(nid ? getResearched(state, nid) : []), // no Agriculture: a size cap (hearths.js)
        ...stonePhaseCtx(state, nid), // the first cities: river food (stonePhase.js)
        ...rulerCityCtx(state.nations[nid]), // the ruler's yields and costs (lawRules.js)
        ...(isBound(state, 'weaponsBan', nid) ? { noRobots: true } : {}), // the Autonomous Weapons Ban (worldCongress.js)
        // An independent's city: capped size, a small border, a garrison and buildings only (independents.js).
        ...(isIndependent(state.nations, nid) ? independentCityCtx(state, nid) : {})
      });
    }
    return ctxCache.get(nid);
  };
  // A governed city (governors.js) adds its governor's food, production and culture to the nation's context.
  // A city's own national wonder adds its culture (greatProjects.js cityEffects, Solomon's Temple).
  // Pure in (owner, id) for the phase (the state is fixed): one context per city, read by the AI's
  // build choice, the city pass and the settlers alike.
  const cityCtxCache = new Map();
  const ctxFor = (city) => {
    if (city.id == null) return ctxOfCity(city);
    const key = `${city.owner}|${city.id}`;
    let ctx = cityCtxCache.get(key);
    if (!ctx) { ctx = ctxOfCity(city); cityCtxCache.set(key, ctx); }
    return ctx;
  };
  const ctxOfCity = (city) => {
    let base = nationCtx(city.owner);
    const wonderCulture = cityWonderTotal(state.greatProjects, city.id, 'local.culture');
    if (wonderCulture) base = { ...base, cultureBonus: (base.cultureBonus || 0) + wonderCulture };
    if (!city.owner || !state.nations[city.owner]?.governors || city.id == null) return base;
    const g = governorEffects(state, city.owner, city.id, newTurnNumber);
    if (!g.governed) return base;
    return { ...base, foodBonus: g.food, productionMult: (base.productionMult || 0) + g.productionMult, cultureBonus: (base.cultureBonus || 0) + g.culture };
  };
  // AI cities with nothing queued pick something first (aiProduction.js). One copy of the map,
  // one set of nation counts: never a spread per city.
  let cities = state.regions;
  const counts = nationCounts(state);
  Object.values(state.regions).forEach((city) => {
    if (!city.owner || city.owner === state.playerNationId || city.outpost) return;
    // An order the new age's tech now holds up (cities.js unitWaitsForTech) is chosen again.
    const nc = city.production?.current ? nationCtx(city.owner) : null;
    if (nc && !unitWaitsForTech(city.production.current, nc.ageId, nc.researched, nc.techFree)) return;
    const ctx = ctxFor(city);
    const item = chooseProduction(state, city, { ...ctx, units: state.units, counts: counts[city.owner] });
    if (!item) return; // nothing worth building: asked again next turn
    if (cities === state.regions) cities = { ...cities };
    cities[city.id] = { ...city, production: { ...city.production, current: item } };
  });
  // Uneven carrying capacity from market access and capital rank (world/market.js).
  const marketCities = { ...cities };
  const stoneOwner = new Map(); // no central-place bonus in the Stone Age (market.js)
  const inStone = (o) => { if (!stoneOwner.has(o)) stoneOwner.set(o, sideAgeOf(state, o) === FIRST_AGE_ID); return stoneOwner.get(o); };
  if (applyMarketHousing(marketCities, tiles, inStone)) cities = marketCities;
  const world = { cities, tileOwner: state.world.tileOwner || {}, tileState: state.world.tileState || {} };
  const result = processCities(world, tiles, ctxFor);
  const regions = {};
  Object.entries(result.world.cities).forEach(([id, c]) => {
    const y = result.yields[id];
    if (!y) { regions[id] = c; return; }
    const lastYields = { gold: y.gold, production: y.production, food: y.food, science: y.science, culture: y.culture, luxuries: y.luxuries, strategic: y.strategic };
    const dev = devFromYields(y, c); // bought development is inside the yields and the mirror (development.js, I031)
    // A record the city pass made this turn is written in place (the same keys and order as a spread).
    if (result.fresh?.has(id)) { c.lastYields = lastYields; c.dev = dev; regions[id] = c; } else regions[id] = { ...c, lastYields, dev };
  });
  // Floods, fires and plagues by tile facts (cityDisasters.js).
  const disasterLogs = rollCityDisasters(regions, newTurnNumber);
  // Plague spreads between cities along land, sea lanes, trade routes and armies (plague.js, SIR).
  disasterLogs.push(...spreadPlague(regions, newTurnNumber, { units: state.units, tileOwner: result.world.tileOwner, researchedOf: (nid) => getResearched(state, nid), state, seed: state.rngSeed }));
  // One copy of the units map for every unit finished this turn (a spread per unit was 12 ms).
  let units = result.completed.some((item) => item.kind === 'settler' || item.kind === 'unit') ? { ...state.units } : state.units;
  let nextUnitSeq = state.nextUnitSeq || 0;
  const wonders = result.completed.filter((item) => item.kind === 'wonder').map((item) => ({ ...item, nationId: item.nationId }));
  result.completed.forEach((item) => {
    if (item.kind === 'settler') {
      const id = `unit_${nextUnitSeq++}`;
      const settler = makeSettler(id, regions[item.city], item.nationId);
      // An AI settler picks its site at once; the player's waits for SET_SETTLER_TARGET.
      const site = item.nationId !== state.playerNationId ? bestSites({ ...state, regions, units }, item.nationId, settler.tile, ctxFor(regions[item.city]).ageId, { limit: 1 })[0] : null;
      units[id] = site ? { ...settler, target: site.tile } : settler;
      return;
    }
    if (item.kind !== 'unit') return;
    const id = `unit_${nextUnitSeq++}`;
    units[id] = { id, ...(isIndependent(state.nations, item.nationId) ? {} : { ageId: ageOf(state, item.nationId) }), regionId: item.city, homeRegionId: item.city, tile: regions[item.city]?.tile ?? null, ownerId: item.nationId, domain: item.classId === 'naval' ? 'naval' : 'land', classId: item.classId, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...(item.robot ? { robot: true } : {}), ...(item.army ? { army: item.army } : {}), ...(item.explorer ? { explorer: true, strength: EXPLORER_STRENGTH, maxStrength: EXPLORER_STRENGTH } : {}), ...(item.classId === 'naval' ? { navalLine: item.navalLine || 'warship', transportCapacity: navalCargo(item.navalLine || 'warship', ctxFor(regions[item.city] || { owner: item.nationId }).ageId) } : {}) };
  });
  const logs = result.logs.filter((l) => l.nationId === state.playerNationId).map(carry);
  disasterLogs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push(carry(l)); });
  // Settlers walk, found outposts, and outposts grow (settlers.js).
  const afterCities = { ...state, regions, units, nextUnitSeq, world: { tileOwner: result.world.tileOwner, tileState: result.world.tileState } };
  const hasSettlers = Object.values(units).some(isSettler) || Object.values(regions).some((c) => c.outpost);
  if (!hasSettlers) return { state: afterCities, logs, wonders };
  // Outposts are founded into the turn's own maps (copied here if the cities pass wrote nothing).
  const settled = processSettlers(afterCities, regions, units, privateWorld(afterCities.world, result.world), (nid) => ctxFor({ owner: nid }).ageId, newTurnNumber);
  settled.logs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push(carry(l)); });
  return { state: { ...afterCities, regions: settled.regions, units: settled.units, world: { tileOwner: settled.world.tileOwner, tileState: settled.world.tileState } }, logs, wonders, grown: settled.grown };
};

// The log keeps the last LOG_CAP lines (the turn report and the log panel show recent turns only).
// Without a cap a long game's save keeps growing (each line also carries msgKey / msgVars) toward
// Safari's 5 MB storage limit. Trimmed once a turn, so actions inside a turn still append freely.
export const LOG_CAP = 800;
export const capLogs = (logs) => (logs.length > LOG_CAP ? logs.slice(-LOG_CAP) : logs);

export const resolveTurn = (incomingState, { onPhase } = {}) => {
  const turnStart = onPhase ? performance.now() : 0;
  let state = syncWorldRegistry(incomingState);
  // Guard: nothing to resolve if the game already ended, an event is blocking play, or a peace
  // offer (plan §M13) is awaiting the player's ACCEPT_PENDING_PEACE/REJECT_PENDING_PEACE response.
  if (state.gameStatus !== GameStatus.ACTIVE || state.activeEventId || state.activeProceduralEvent || state.pendingPeaceOffer) {
    return state;
  }
  // Tactical Battles plan §16: assaults on the player's garrisons are fought before the turn ends.
  if (state.pendingDefenses?.length) return state;
  // Armies on tiles (armies.js): every unit's tile and city agree before the turn reads them.
  state = normalizeUnitTiles(state);
  // Units keep the age they were built in (unitUpgrades.js): any major's unit without one gets it now, before research moves on.
  state = stampUnitAges(state);
  // The Stone Age opening (settlers.js, U23): AI bands found their first village.
  state = foundAiVillages(state);
  state = updateCamps(state); // tribal camps (tribalCamps.js, U26)

  let regionDraft = null;
  let phaseStart = turnStart;
  const mark = (name) => {
    if (regionDraft) invalidateRegionsCache(regionDraft);
    if (!onPhase) return;
    const now = performance.now();
    onPhase(name, now - phaseStart);
    phaseStart = now;
  };

  // --- marches (routes.js): armies on a route walk first, so the supplies, the upkeep and every
  // phase below see where they now stand. This walk is the coming turn's movement (the player finds
  // it done when the turn begins); what this turn's points paid was walked when the order was given
  // (routes.js stepMarchesNow), and a unit marked for the coming turn cannot step again in it.
  let marchLogs = [];
  // Who moved this turn (forts.js: a manned fort stops and fights them), from where they stood when
  // the turn began, before any step taken on an order.
  const startUnits = unitsAtTurnStart(state);
  if (Object.values(state.units).some((u) => u.route?.length)) {
    const marchedUnits = { ...state.units };
    marchLogs = advanceMarches(state, marchedUnits, { year: state.year, turnOf: state.turnNumber + 1 }).logs;
    state = { ...state, units: marchedUnits };
  }
  mark('marches');

  let rng = createRng(state.rngSeed);
  const logs = [];
  // --- time ---
  // There is no calendar (eight-ages plan KTD3): a turn is a turn. The year is a display label from
  // the player's progress through its age (displayYear.js), written once at the end of the turn;
  // the logs of this turn carry the label the turn started with. No rule reads it.
  const newYear = state.year ?? displayYear(state);
  const newTurnNumber = state.turnNumber + 1;
  marchLogs.forEach((l) => logs.push({ ...l, year: newYear }));

  // Timed modifier expiry (plan §A.2) — runs right after the time step so an entry that expires
  // this turn no longer affects this turn's income/unrest/etc below. Nothing pushes an entry into
  // nation.modifiers[] or state.regionModifiers yet (a later milestone's event/law/disaster effect
  // will be the first real writer), so both calls are a same-reference no-op today.
  const modifierExpiredNations = { ...expireNationModifiers(state.nations, newTurnNumber) };
  const regionModifiers = expireRegionModifiers(state.regionModifiers, newTurnNumber);
  mark('time');

  // --- sieges (plans/civ-map-rework.md D2, sieges.js): armies beside a city grind its walls and
  // cut its production and taxes. A siege never takes a city (the user's rule of 14 October): only
  // an attack does. Before the cities phase, so a besieged city's yields are cut this turn.
  // A capture card still open here was never answered (a headless loop: End Turn waits for it in
  // the game): the city is kept (capture.js).
  state = settleOpenCaptures(state);
  {
    const siegeRegions = { ...state.regions };
    const { logs: siegeLogs } = processSieges(state, siegeRegions, state.units, { turn: newTurnNumber });
    siegeLogs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push({ year: newYear, ...carry(l), type: LogTypes.COMBAT }); });
    state = { ...state, regions: siegeRegions };
  }
  mark('sieges');

  // --- cities (plans/civ-map-rework.md C1, C2, B4): every city works its land, grows, builds and
  // extends its borders. Runs first so income reads this turn's yields (dev mirrors them) and
  // every later phase sees the new sizes and borders. Finished units are created here.
  const cityTurn = runCitiesPhase(state, newTurnNumber);
  state = cityTurn.state;
  cityTurn.logs.forEach((l) => logs.push({ year: newYear, ...carry(l), type: LogTypes.ACTION }));
  mark('cities');

  // --- income ---
  const income = calcIncome({ ...state, nations: modifierExpiredNations });
  const resources = { ...createEmptyResourcePool(ageOf(state, state.playerNationId)), ...state.resources };
  Object.entries(income).forEach(([id, amount]) => { resources[id] = (resources[id] || 0) + amount; });
  logs.push({ year: newYear, ...msg('m.turn.income', { year: Math.round(newYear), gold: income.gold || 0 }), type: LogTypes.ACTION });
  // Army supplies (src/engine/supplies.js): foraged and manufactured from metal, eaten on campaign.
  const supplyFlow = computeSupplyFlow({ regions: state.regions, units: state.units, nationId: state.playerNationId, ageId: ageOf(state, state.playerNationId), resources, turnNumber: state.turnNumber, tileOwner: state.world?.tileOwner });
  resources[supplyFlow.metalId] = (resources[supplyFlow.metalId] || 0) - supplyFlow.metalUsed;
  resources.supplies = supplyFlow.supplies;
  if (supplyFlow.hungry) logs.push({ year: newYear, ...msg(supplyFlow.campaigning > 1 ? 'm.turn.hungryMany' : 'm.turn.hungryOne', { n: supplyFlow.campaigning, morale: HUNGER_MORALE }), type: LogTypes.CRISIS });
  mark('income');

  // Army/navy/fort upkeep, advisor salaries, and loan interest are all deducted together in the
  // "economy" phase below (plan §M11), once `regions`/`nations` exist — a shortfall there can
  // trigger an auto-loan or bankruptcy, both of which need to touch nation/region state that
  // doesn't exist yet this early in the turn.

  mark('maintenanceAndPower');

  // --- unrest drift (every region, not just the player's — this is a generic mechanic every
  // nation's own territory is subject to) ---
  const regions = { ...state.regions };
  regionDraft = regions;
  // A nation's whole stability picture, once per owner: its static sources (government, policies,
  // wonders, identity) plus the state-dependent ones (its stability level, low legitimacy, and for
  // the player also overextension, crown land and researched techs like Constitutional Law). The
  // static-only total used before silently dropped all of those from province unrest. AI nations
  // skip the O(regions) overextension scan (the same trade-off supply attrition makes below).
  const stabilityCache = new Map();
  const nationalStabilityOf = (ownerId, owner) => {
    if (stabilityCache.has(ownerId)) return stabilityCache.get(ownerId);
    const value = ownerId === state.playerNationId
      ? getModifier(state, ownerId, 'national.stabilityBonus').total
      : getNationBonusTotal(owner, 'stabilityBonus') + (owner?.stability || 0) + ((owner?.legitimacy ?? 50) < 50 && owner?.ruler ? -1 : 0)
        // Overextension weighs on an AI's cities as on the player's (sources.js: -overextension/20;
        // addendum X23, CB09). getOverextension reads the memoized owned-city index: no scan.
        - (isIndependentNation(owner) ? 0 : getOverextension(state, ownerId) / 20);
    stabilityCache.set(ownerId, value);
    return value;
  };
  const governView = { ...state, nations: modifierExpiredNations }; // one view for the governor lookups below
  // Growth is paid at the city owner's own age (KTD9).
  const growthMultOf = new Map();
  const peopleSpeedMultOf = (owner) => { if (!growthMultOf.has(owner)) growthMultOf.set(owner, speedCostMult(state.gameSpeed, ageOf(state, owner))); return growthMultOf.get(owner); };
  Object.entries(regions).forEach(([id, region]) => {
    if (region.owner === null) return;
    const owner = modifierExpiredNations[region.owner];
    const taxUnrestDelta = TAX_RATES[owner?.taxRate]?.unrestDeltaPerTurn || 0;
    // Plan §M6: the Culture & Order building line's local.stabilityBonus shaves this region's own
    // unrest, on top of the nation-wide sources (government/policy/traits/stability/overextension).
    const stabilityBonus = nationalStabilityOf(region.owner, owner)
      + getRegionModifier(state, id, 'local.stabilityBonus').total;
    // A long, bloody war wears on the home front: war exhaustion past 40 pushes unrest up in every
    // province the nation holds, up to +1.5/turn at 100.
    const warWeariness = Math.max(0, ((owner?.warExhaustion || 0) - WAR_WEARINESS_FROM) / WAR_WEARINESS_SCALE);
    let unrest = nextUnrest(region, stabilityBonus, taxUnrestDelta + warWeariness);
    if (owner?.governors && governorOf(governView, region.owner, id, newTurnNumber)) unrest = Math.round(unrest * GOVERNOR_UNREST_MULT * 10) / 10; // a governor keeps order (governors.js)
    // Siege recovery (src/engine/siege.js): a region not attacked recently regenerates the control
    // combat ground down — an interrupted siege doesn't bank its damage forever. Also clears the
    // `underInvasion` map/UI flag once the cooldown passes, so a region stops reading as "under
    // attack" once it genuinely no longer is.
    let control = region.lastAttackedTurn != null ? nextSiegeControlRegen(region, newTurnNumber) : region.control;
    if(region.integratingUntil != null){control=Math.min(100,control+13);unrest=Math.max(0,unrest-7);}
    const stillUnderCooldown = region.lastAttackedTurn != null && (newTurnNumber - region.lastAttackedTurn) < SIEGE_REGEN_COOLDOWN_TURNS;

    // Population (src/engine/population.js, one model): a city's people are its size plus its
    // food bank's progress, grown by the city step's logistic rule. Only a record without a size
    // (a hand-built test region) still runs the fallback logistic on its own levers.
    const devastation = decayDevastation(region.devastation);
    let currentPopulation;
    if (region.size != null) currentPopulation = peopleOf(region, growthThreshold(region.size, peopleSpeedMultOf(region.owner)));
    else {
      const modernBaseline = REGIONS_DATA[id]?.population || 0;
      // A devastated province (aftermath.js) grows more slowly while it recovers.
      const growthRate = getPopulationGrowthRate({
        foodTier: region.buildings?.categories?.food ?? -1,
        infrastructure: region.currentInfrastructure || 0,
        popGrowthBonus: getNationBonusTotal(owner, 'popGrowthBonus'),
        unrest
      }) - devastationGrowthPenalty(region);
      currentPopulation = nextRegionPopulation({ currentPopulation: region.currentPopulation || modernBaseline, modernBaseline, growthRate, underInvasion: region.underInvasion });
    }

    if (unrest !== region.unrest || control !== region.control || (region.underInvasion && !stillUnderCooldown) || currentPopulation !== region.currentPopulation || devastation !== (region.devastation || 0)) {
      regions[id] = { ...region, ...(region.integratingUntil != null && newTurnNumber>=region.integratingUntil ? {integratingUntil:null}:{}), unrest, control, underInvasion: stillUnderCooldown ? region.underInvasion : false, currentPopulation, ...(region.devastation != null || devastation ? { devastation } : {}) };
    }
  });
  // Battle damage to cities repairs for free (cityManifest.js: damaged structures, ruined houses).
  Object.keys(regions).forEach((id) => { const r = regions[id]; if (r.cityDamage) regions[id] = repairCityDamage(r); });
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
  const revivedNations = {}; // eliminated nations a successful revolt handed land back to (see transferRegion)
  const rebelUnitIdByRegion = {};
  // Civil-war insurgents (isInsurgent) are owned by src/engine/civilWar.js, not by this unrest block —
  // letting this block see them made every insurgent stack in a calm province "dissolve" the next turn.
  Object.values(units).forEach(u => { if (u.ownerId === REBEL_OWNER_ID && !u.isInsurgent) rebelUnitIdByRegion[u.regionId] = u.id; });
  Object.entries(regions).forEach(([regionId, region]) => {
    const existingRebelId = rebelUnitIdByRegion[regionId];
    if (region.unrest >= REBELLION_UNREST_THRESHOLD && !exploreOn(state)) { // explore mode: unrest never arms a rebel
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
          // transferRegion also drops any third party's lingering occupiedBy and, if the former
          // owner had been wiped out, revives it rather than handing land to a dead nation.
          const transfer = transferRegion(region, reclaimedBy, modifierExpiredNations, {
            formerOwner: undefined,
            control: REVOLT_RECLAIMED_CONTROL,
            unrest: REVOLT_RECLAIMED_UNREST
          });
          regions[regionId] = transfer.region;
          logs.push({
            year: newYear,
            ...msg('m.turn.uprisingWon', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name || regionId), nation: people(reclaimedBy, state.nations[reclaimedBy]?.name || reclaimedBy), from: people(occupierId, state.nations[occupierId]?.name || occupierId) }),
            type: LogTypes.CRISIS
          });
          if (transfer.revivedNation) {
            revivedNations[reclaimedBy] = transfer.revivedNation;
            logs.push({ year: newYear, ...msg('m.turn.risesAgain', { nation: people(reclaimedBy, transfer.revivedNation.name) }), type: LogTypes.MILESTONE });
          }
        } else {
          // Capped at REBEL_MAX_GROWTH_MULT x a fresh uprising's size: uncapped, 15%/turn compounding
          // grew an ignored home-province rebellion without bound (x1,000+ within 50 turns).
          const strength = Math.min(getRebelSpawnStrength(region) * REBEL_MAX_GROWTH_MULT, Math.round(rebel.strength * (1 + REBEL_GROWTH_RATE)));
          units[existingRebelId] = { ...rebel, strength, maxStrength: Math.max(rebel.maxStrength, strength) };
        }
      } else {
        const rebelId = `rebel_${regionId}_${newTurnNumber}`;
        const strength = getRebelSpawnStrength(region);
        units[rebelId] = {
          id: rebelId, regionId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry',
          strength, maxStrength: strength, morale: 100, movesLeft: 1,
          xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
          spawnedTurn: newTurnNumber
        };
        regions[regionId] = { ...region, control: Math.max(0, (region.control || 0) - 30) };
        logs.push({ year: newYear, ...msg('m.turn.rebellion', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name || regionId) }), type: LogTypes.CRISIS });
      }
    } else if (existingRebelId) {
      delete units[existingRebelId];
      logs.push({ year: newYear, ...msg('m.turn.rebellionEnds', { city: cityRef(regionId, REGIONS_DATA[regionId]?.name || regionId) }), type: LogTypes.CRISIS });
    }

    // Integration (the other end condition — the good ending): conquered land that has climbed to
    // a secure level of control without presently rebelling counts as fully absorbed. formerOwner
    // clears permanently, even if the region rebels again later for some unrelated reason.
    const current = regions[regionId] || region;
    if (current.formerOwner && current.unrest < REBELLION_UNREST_THRESHOLD && (current.control || 0) >= INTEGRATION_CONTROL_THRESHOLD) {
      regions[regionId] = { ...current, formerOwner: undefined };
    }
  });

  // --- supply (plans/civ-map-rework.md D3, supplyMeter.js): every land unit's meter moves by the
  // land it stands on; at 0 it starves. The player's national.attrition modifier scales the
  // losses (AI nations do not track a techTree until AI parity, and the 240-nation getModifier
  // scan would cost a turn budget for a value that is 0 for all of them); the supply line reach
  // grows with the player's national.supplyRange.
  const playerAttritionMult = Math.max(0, 1 + getModifier(state, state.playerNationId, 'national.attrition').total);
  const playerLineRings = SUPPLY_LINE_RINGS + ringsFromF75(Math.max(0, Math.round(getModifier(state, state.playerNationId, 'national.supplyRange').total))); // the modifier counts frequency-75 tiles
  const hungryNations = new Set();
  if (supplyFlow.hungry) hungryNations.add(state.playerNationId);
  const meter = applySupplyMeter(state, units, {
    hungryFor: (nid) => hungryNations.has(nid),
    attritionMultFor: (nid) => (nid === state.playerNationId ? playerAttritionMult : 1),
    lineRingsFor: (nid) => (nid === state.playerNationId ? playerLineRings : SUPPLY_LINE_RINGS)
  });
  const starvingOwn = meter.starving.get(state.playerNationId) || 0;
  const deadOwn = meter.dead.get(state.playerNationId) || 0;
  if (starvingOwn || deadOwn) {
    const starve = starvingOwn ? sub(starvingOwn > 1 ? 'm.turn.starveMany' : 'm.turn.starveOne', { n: starvingOwn }) : null;
    const melted = deadOwn ? sub(deadOwn > 1 ? 'm.turn.meltedMany' : 'm.turn.meltedOne', { n: deadOwn }) : null;
    const what = starve && melted ? sub('m.both', { a: starve, b: melted }) : starve || melted;
    logs.push({ year: newYear, ...msg('m.turn.outOfSupply', { what }), type: LogTypes.CRISIS });
  }
  // --- loyalty and culture (plans/civ-map-rework.md C5, loyalty.js): culture pressure drifts every
  // city's shares, loyalty follows the owner's share, garrison and amenities; at 0 a city goes over
  // to the nation pressing it most, or stands free.
  {
    const loyal = applyLoyalty(state, regions, units, modifierExpiredNations, newTurnNumber, (nid) => state.lodPeriods?.[nid] || 1);
    loyal.logs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push({ year: newYear, ...carry(l), type: LogTypes.CRISIS }); });
  }
  mark('rebellionAndSupply');

  // --- movement reset, reinforcement, and morale recovery (plan §M14) ---
  // Every unit gets its move back at the start of the turn it's about to take (forcedMarch grants a
  // second one) — MOVE_ARMY/LAUNCH_INVASION/AMPHIBIOUS_ASSAULT/NAVAL_ENGAGEMENT/SUPPRESS_REBELLION
  // all spend it, one attack or move per stack per turn.
  //
  // Reinforcement and morale recovery are keyed off `lastBattleTurn === state.turnNumber` (the turn
  // that's ENDING right now, before newTurnNumber's own increment above) — a unit that fought this
  // turn doesn't recover until next turn, same as the plan's own "when not in battle that turn"
  // wording. This is also the actual fix for the long-standing one-way morale bug (src/engine/
  // battle.js's dealDamage only ever subtracts morale — nothing anywhere ever added it back).
  const REINFORCEMENT_RATE = 0.10;
  const MORALE_RECOVERY_PER_TURN = 15;
  // Mechanised warfare runs on oil: modern tanks, aircraft and warships need a stock above zero.
  const FUEL_BURNING_CLASSES = new Set(['cavalry', 'air', 'naval']);
  const playerOutOfOil = isAgeAtLeast(ageOf(state, state.playerNationId), 'modern') && (resources.oil ?? 0) <= 0;
  let groundedCount = 0;
  const ownerSupplyFlows = new Map();
  const unitsByOwnerAtStart = unitsByOwner(state.units); // one scan for every nation's supply flow
  Object.values(units).forEach((u) => {
    if (u.ownerId === REBEL_OWNER_ID || u.embarkedOn) return;
    const nation = state.nations[u.ownerId];
    if (!nation) return;
    const foughtThisTurn = u.lastBattleTurn === state.turnNumber;
    const isPlayer = u.ownerId === state.playerNationId;
    const maintenanceLevel = clampMaintenance(nation[u.domain === 'naval' ? 'navyMaintenance' : 'armyMaintenance'] ?? ARMY_MAINTENANCE_DEFAULT);
    const maintenanceFactor = Math.max(0, (maintenanceLevel - 50) / 50); // 50% maintenance = no recovery at all
    const reinforceSpeedBonus = getModifier(state, u.ownerId, 'national.reinforceSpeed').total;
    const moraleRecoveryBonus = getModifier(state, u.ownerId, 'national.moraleRecovery').total;
    let patch = null;
    // Hungry armies on campaign (supplies.js) neither recover nor reinforce, and lose heart.
    const ownerPool = isPlayer ? resources : (modifierExpiredNations[u.ownerId].economy || {});
    if (!isPlayer && !ownerSupplyFlows.has(u.ownerId)) ownerSupplyFlows.set(u.ownerId,computeSupplyFlow({regions:state.regions,units:state.units,nationId:u.ownerId,ageId:ageOf(state, u.ownerId),resources:ownerPool,tileOwner:state.world?.tileOwner,ownedUnits:unitsByOwnerAtStart.get(u.ownerId) || []}));
    const ownerSupply = isPlayer ? supplyFlow : ownerSupplyFlows.get(u.ownerId);
    // A starving unit (supply meter at 0, supplyMeter.js) recovers nothing either.
    const hungry = (ownerSupply.hungry && isCampaigning(u, regions, state.world?.tileOwner)) || (u.supply != null && u.supply <= 0);
    if (hungry && !u.robot) patch = { morale: Math.max(0, (u.morale ?? 100) - HUNGER_MORALE) }; // robots have no morale (robots.js)

    if (!hungry && !foughtThisTurn && u.morale < 100) {
      patch = { ...patch, morale: Math.min(100, u.morale + Math.round(MORALE_RECOVERY_PER_TURN * (1 + moraleRecoveryBonus) * maintenanceFactor)) };
    }

    // Recruits reach a unit that STANDS on its nation's own, unoccupied land (unitLocation.js): the
    // tile is the truth, the home base (`regionId`) is not a position. A field army in Sinai based
    // at Men-nefer no longer refills through its base (playtest audit I058, plan 2.4).
    const isSuppliedHomeTerritory = canReinforce(state, u, regions);
    if (!hungry && !foughtThisTurn && isSuppliedHomeTerritory && u.strength < u.maxStrength) {
      const cadreMult = hasPerk(u, 'cadre') ? 2 : 1;
      const robot = isRobot(u); // robots refill without manpower (robots.js)
      const gain = Math.min(robot ? Infinity : Math.floor((ownerPool.hr || 0) * 10), u.maxStrength - u.strength, Math.round(u.maxStrength * REINFORCEMENT_RATE * (1 + reinforceSpeedBonus) * maintenanceFactor * cadreMult));
      if (gain > 0 && robot) patch = { ...patch, strength: u.strength + gain };
      else if (gain > 0) {
        // Manpower is a real, spendable resource only for the player pre-M16 (economy.js's own
        // "player-only real computation" pattern) — an AI unit's strength still regrows (so the AI
        // isn't permanently crippled by a single lost battle), it just doesn't draw down a manpower
        // pool that doesn't meaningfully exist for it yet.
        if (isPlayer) resources.hr = Math.max(0, (resources.hr || 0) - Math.ceil(gain / 10));
        else modifierExpiredNations[u.ownerId] = {...modifierExpiredNations[u.ownerId],economy:{...ownerPool,hr:Math.max(0,(ownerPool.hr || 0)-Math.ceil(gain/10))}};
        patch = { ...patch, strength: u.strength + gain };
      }
    }

    // Plan §M14: forcedMarch grants a second move; every other unit gets exactly one. With the oil
    // stock empty, the player's modern machines (tanks, aircraft, warships) stay where they are.
    const outOfOil = isPlayer ? playerOutOfOil : isAgeAtLeast(ageOf(state, u.ownerId), 'modern') && (nation.economy?.oil || 0) <= 0;
    const grounded = outOfOil && FUEL_BURNING_CLASSES.has(u.classId);
    if (grounded && isPlayer) groundedCount += 1;
    const movesLeft = grounded ? 0 : 1 + (hasPerk(u, 'forcedMarch') ? 1 : 0);
    // Fortify (fieldBattle.js isFortified): the turn a stack stays on its tile is remembered.
    const heldSince = u.tile != null && u.prevTile === u.tile && !foughtThisTurn ? (u.heldSince ?? newTurnNumber) : newTurnNumber;
    units[u.id] = { ...u, ...patch, movesLeft, prevTile: u.tile ?? null, heldSince };
  });
  if (groundedCount) logs.push({ year: newYear, ...msg(groundedCount > 1 ? 'm.turn.noOilMany' : 'm.turn.noOilOne', { n: groundedCount }), type: LogTypes.CRISIS });
  mark('reinforcementAndMorale');

  // --- AI nations: passive growth + hostility drift ---
  const aiUpdates = processAllAINations(state, newYear, rng);
  const nations = { ...modifierExpiredNations, ...revivedNations };
  const opinionView = { ...state, nations: modifierExpiredNations }; // one view for the loop: a fresh spread per nation would rebuild the modifier sheets 240 times
  Object.entries(nations).forEach(([nId, nation]) => {
    if (nation.isPlayer || nation.isEliminated || isIndependentNation(nation)) return; // independents have no relations to drift (independents.js)
    const growthUpdate = aiUpdates.nationUpdates[nId];
    const militaryStrength = Math.max(100, nation.militaryStrength + (growthUpdate?.militaryStrengthChange || 0));
    const hostility = clamp(nation.hostility + (growthUpdate?.hostilityChange || 0), nation.hostilityFloor || 0, 100);
    const relationStatus = nation.isAtWar || nation.hasPeaceTreaty || nation.hasTradeAgreement
      ? nation.relationStatus
      : getRelationFromHostility(opinionGivesCasusBelli(opinionOf(opinionView, nId)) ? Math.max(hostility, 80) : hostility, nation.isAtWar, nation.hasPeaceTreaty, nation.hasTradeAgreement);
    nations[nId] = { ...nation, militaryStrength, hostility, relationStatus };
  });
  logs.push(...aiUpdates.logs.map(l => ({ year: newYear, ...l })));
  mark('aiGrowthAndHostility');

  // --- AI economy (plan §M16) --- real gold/hr/techPoints income credits every non-
  // player nation's own economy pool EVERY turn (calcAllNationIncomes is one O(regions) pass, cheap
  // enough to run unconditionally for all 240 nations — the same "one shared pass" perf pattern
  // buildOccupationIndexes/calcAllNationIncomes-style functions already use elsewhere in this
  // codebase). Spending it — adopt/reform a government, construct a building, or research a tech —
  // only happens on each nation's own tiered cadence (aiEconomy.js's thinksThisTurn: Tier 1 every
  // turn, Tier 2 every 3, Tier 3 every 10), which is what keeps this affordable at 240 nations.
  // Recruitment stays a separate pass below (processAIRecruitment, Tier 1 only, unchanged cadence)
  // now drawing on this same real economy once it exists — see aiEconomy.js's own header for the
  // full list of what's deliberately NOT part of this milestone (laws, identity, advisors,
  // diplomat tasks, AI loans/bankruptcy).
  // ONE shared state snapshot for this whole phase — critically, the SAME object reference for
  // every nation's calcAllNationIncomes/getNationTier/processAIEconomyTurn call.
  // The modifier engine (src/engine/modifiers/sheet.js) caches a nation's sheet per (state
  // reference, nationId) pair; a fresh `{ ...state, ... }` literal built INSIDE this loop, once per
  // nation, would defeat that cache entirely (each nation's sheet — including its own O(regions)
  // overextension scan — rebuilt from scratch 2-3x every turn instead of once), which is exactly
  // the "per-nation state spread" trap buildOccupationIndexes/estatesState elsewhere in this same
  // file are already careful to avoid. `regions`/`nations` are passed by REFERENCE, not spread, so
  // this snapshot stays valid even as later lines in this same loop mutate their properties.
  const aiEconState = { ...state, regions, nations };
  const tieringSortedByMilitary = getSortedByMilitary(aiEconState);
  // Level of detail (world/lod.js): a far nation at peace settles every few turns, paying and
  // earning every turn since its last settlement at once; one that thinks this turn always settles.
  const tiers = new Map(); const settling = new Set(); const lodPeriods = {};
  Object.keys(nations).forEach((nId) => {
    const nation = nations[nId];
    if (nId === state.playerNationId || nation.isEliminated || !nation.economy) return;
    const tier = getNationTier(aiEconState, nId, tieringSortedByMilitary) || 3;
    tiers.set(nId, tier);
    const period = lodPeriod(tier, nation);
    if (period > 1) lodPeriods[nId] = period;
    // A nation that spends its science this turn (research.js) settles first, so the research step
    // reads every turn's science.
    if (settlesThisTurn(nId, period, newTurnNumber) || researchesThisTurn(nId, newTurnNumber)) settling.add(nId);
  });
  const allIncomes = calcAllNationIncomes(aiEconState, settling);
  // Units grouped by owner once; a nation's own desertion below only drops its own, already settled, units.
  const unitsByOwnerNow = unitsByOwner(units);
  const upkeepState = { ...aiEconState, units, turnNumber: newTurnNumber };
  Object.keys(nations).forEach((nId) => {
    if (nId === state.playerNationId) return;
    const nation = nations[nId];
    if (nation.isEliminated) return;
    if (!nation.economy) return; // a legacy/test fixture with no seeded economy stays on the old abstract-only path
    const tier = tiers.get(nId);
    if (!settling.has(nId)) return;
    const turns = turnsToSettle(nation, newTurnNumber, lodPeriod(tier, nation));
    const income = allIncomes[nId] || { gold: 0, hr: 0, techPoints: 0 };
    const pool = { ...nation.economy };
    pool.gold += income.gold; // the other turns' gold is credited turn by turn in settleAIUpkeep
    pool.hr += income.hr * turns;
    pool.techPoints += income.techPoints * turns;
    const ownedUnits = unitsByOwnerNow.get(nId) || [];
    for (let k = 0; k < turns; k++) {
      const aiSupply = computeSupplyFlow({regions,units,nationId:nId,ageId:ageOf(state, nId),resources:pool,tileOwner:state.world?.tileOwner,ownedUnits});
      pool.supplies=aiSupply.supplies;
      pool[aiSupply.metalId]=(pool[aiSupply.metalId] || 0)-aiSupply.metalUsed;
      ['copper', 'iron', 'oil', 'rareMetals'].forEach(key => { pool[key] = (pool[key] || 0) + (income[key] || 0); });
    }
    nations[nId] = { ...nation, economy: pool, lodSettledTurn: newTurnNumber };
    // A budget that does not add up: cut pay, then disband the weakest units (aiBudget.js, I124).
    const budget = aiBudgetStep(upkeepState, nId, income, ownedUnits, (uid) => isUnitInBattle(upkeepState, uid));
    nations[nId] = budget.nation;
    const keptUnits = budget.disband.length ? ownedUnits.filter((u) => !budget.disband.includes(u.id)) : ownedUnits;
    budget.disband.forEach((uid) => { delete units[uid]; });
    nations[nId] = settleAIUpkeep(upkeepState, nId, income, keptUnits, turns, income.gold);
    if (nations[nId].lastBankruptcyTurn === newTurnNumber || nations[nId].lastUnpaidTurn === newTurnNumber) applyArmyDesertion(units, nId);

    if (!thinksThisTurn(nId, tier, newTurnNumber)) return;
    const result = processAIEconomyTurn(aiEconState, regions, nId);
    nations[nId] = result.nation;
    // Spare gold upgrades old units at home (unitUpgrades.js): a few a think, into the turn's units.
    const upgradeGold = aiUpgradeUnits(upkeepState, nId, keptUnits, units, nations[nId].economy?.gold || 0);
    if (upgradeGold) nations[nId] = { ...nations[nId], economy: { ...nations[nId].economy, gold: nations[nId].economy.gold - upgradeGold } };
  });
  mark('aiEconomy');

  // --- rulers (plan §M3) --- runs for every nation. Renown (renown.js): the cities founded this
  // turn, the time trickle while the capital is held, years of order; a ruler below the median level
  // of the living majors is a rising star; every AI ruler spends its points (rulers.js
  // aiDevelopRuler: a compare when none wait); ambitions are offered and paid (ambitions.js); the
  // player's level-ups and fulfilled ambitions are logged.
  // Governors (governors.js): the player's court offers fresh candidates every GOVERNOR_REFRESH_TURNS
  // turns, and a governor whose seat was lost leaves.
  {
    const me = state.playerNationId;
    const view = { ...state, regions, nations };
    (cityTurn.grown || []).forEach((g) => { if (nations[g.nationId]?.ruler) nations[g.nationId] = grantRenown(nations[g.nationId], 'cityFounded', RENOWN.cityFounded, newTurnNumber, g.cityId); });
    const levels = Object.values(nations).filter((n) => n.ruler && !n.isEliminated).map((n) => rulerLevel(n.ruler.renown)).sort((a, b) => a - b);
    const median = levels.length ? levels[Math.floor((levels.length - 1) / 2)] : 1;
    Object.keys(nations).forEach((nId) => {
      const r = regroupGovernors(view, nations[nId]);
      if (r.nation !== nations[nId]) nations[nId] = r.nation;
      nations[nId] = tickDecrees(view, nId, nations[nId], newTurnNumber); // the decree floor (decrees.js)
      const ruler = nations[nId].ruler;
      if (ruler && !nations[nId].isEliminated) {
        const risingStar = rulerLevel(ruler.renown) < median;
        if (!!ruler.risingStar !== risingStar) nations[nId] = { ...nations[nId], ruler: { ...ruler, risingStar } };
        if (regions[nations[nId].capitalRegionId]?.owner === nId) nations[nId] = grantRenown(nations[nId], 'time', timeRenown(state.gameSpeed, ageOf(view, nId), newTurnNumber), newTurnNumber);
        const lastOrder = nations[nId].ruler.stabilityRenownTurn ?? -Infinity;
        if ((nations[nId].stability3Streak || 0) >= speedTurns(STABILITY_RENOWN_REF_TURNS, state.gameSpeed, ageOf(view, nId)) && newTurnNumber - lastOrder >= speedTurns(STABILITY_RENOWN_GAP_REF_TURNS, state.gameSpeed, ageOf(view, nId))) {
          const granted = grantRenown(nations[nId], 'stability', RENOWN.stability, newTurnNumber);
          nations[nId] = { ...granted, ruler: { ...granted.ruler, stabilityRenownTurn: newTurnNumber } };
        }
        const amb = tickAmbitions(view, nId, nations[nId], newTurnNumber); // offers and completions (ambitions.js)
        nations[nId] = amb.nation;
        if (nId === me) amb.done.forEach((id) => logs.push({ year: newYear, ...msg('m.turn.ambition', { ambition: thing('ambition', id, ambitionDef(id).label) }), type: LogTypes.MILESTONE }));
        const goals = payEraGoals(view, nations[nId], ageOf(view, nId), newTurnNumber); // era goals pay the turn they are met (eraGoals.js)
        nations[nId] = goals.nation;
        if (nId === me) goals.paid.forEach((g) => logs.push({ year: newYear, ...eraGoalLog(g), type: LogTypes.MILESTONE }));
        if (nId !== me) nations[nId] = aiDevelopRuler(view, nId).nations[nId];
        else {
          const level = rulerLevel(nations[nId].ruler.renown);
          if (level > (nations[nId].ruler.loggedLevel || 1)) {
            logs.push({ year: newYear, ...msg('m.turn.rulerLevel', { name: person(nations[nId].ruler.name), level }), type: LogTypes.MILESTONE });
            nations[nId] = { ...nations[nId], ruler: { ...nations[nId].ruler, loggedLevel: level } };
          }
        }
      }
      if (nId !== me) return;
      r.changes.forEach((c) => {
        const city = cityRef(c.kind === 'moved' ? c.to : c.city, regions[c.kind === 'moved' ? c.to : c.city]?.name || '');
        logs.push({ year: newYear, ...msg(c.kind === 'moved' ? 'm.turn.governorMoved' : c.kind === 'merged' ? 'm.turn.governorMerged' : 'm.turn.governorLeft', { name: person(c.name), city }), type: LogTypes.EVENT });
      });
    });
    if (nations[me] && (newTurnNumber % GOVERNOR_REFRESH_TURNS === 1 || !nations[me].governorCandidates)) {
      nations[me] = { ...nations[me], governorCandidates: generateGovernorCandidates(me, `${state.rngSeed}|${newTurnNumber}`) };
    }
  }
  mark('rulers');

  // --- national power: stability decay, legitimacy/tradition/devotion, prestige (plan §M4) ---
  // runs for every nation, same cadence and reasoning as the rulers pass just above (cheap,
  // AI nations get real numbers even though nothing reads them mechanically until M16 wires AI
  // decisions off of them).
  Object.entries(nations).forEach(([nId, nation]) => {
    const result = processNationalPowerTurn(nation);
    // Plan §M18's "Iron Grip" achievement ("+3 stability for 20 turns"): a real sustained-streak
    // counter, reset to 0 the instant stability drops off the max, so a fresh run of turns is required.
    const stability3Streak = result.stability >= STABILITY_MAX ? (nation.stability3Streak || 0) + 1 : 0;
    nations[nId] = { ...nation, ...result, stability3Streak };
  });
  mark('nationalPower');

  // --- capitals (plan §M15) --- "Capital occupied: -1 stability (once), -1 all pools per turn" —
  // the stability hit only fires on the turn occupation actually STARTS (nation.capitalOccupied
  // tracks whether it already fired this occupation, the same one-shot-flag shape
  // region.underInvasion already uses); the pool penalty re-applies every turn it stays occupied.
  // Every nation gets the stability side generically (capitalOccupied/stability are both already
  // real for AI); the pool penalty only actually deducts for the player (economy.js's own
  // "player-only real computation" scope — AI has no simulated ADM/DIP/MIL pool pre-M16).
  Object.entries(nations).forEach(([nId, nation]) => {
    const capitalId = getCapital({ nations }, nId);
    const capitalOccupied = !!capitalId && !!regions[capitalId]?.occupiedBy && regions[capitalId].occupiedBy !== nId;
    if (capitalOccupied === !!nation.capitalOccupied) return;
    nations[nId] = capitalOccupied
      ? { ...nation, capitalOccupied: true, stability: clampStability((nation.stability || 0) - CAPITAL_OCCUPIED_STABILITY_PENALTY) }
      : { ...nation, capitalOccupied: false };
  });
  mark('capitals');

  // --- disasters & civil war (plan §M15) --- runs for every nation, the same "real for player and
  // AI both" cadence as stability and rulers above. Disasters read only fields every nation
  // already tracks for real; a nation already fighting a civil war skips straight to
  // processCivilWarTurn instead of re-checking triggers (declareWar's own one-active-thing-at-a-time
  // spirit, applied here even though this isn't a state.wars entry — see civilWar.js's own header on
  // why not).
  // The automation meter (automation.js) reads each nation's robots.
  const robotsOf = new Map();
  let citiesOf = null;
  Object.values(units).forEach((u) => { if (u.robot && u.strength > 0) robotsOf.set(u.ownerId, (robotsOf.get(u.ownerId) || 0) + 1); });
  Object.entries(nations).forEach(([nId, nation]) => {
    const { nation: afterDisasters, triggersCivilWar, logs: disasterLogs } = processDisastersTurn(nation, ageOf(state, nId));
    if (nId === state.playerNationId) logs.push(...disasterLogs.map((l) => ({ year: newYear, ...l })));
    nations[nId] = afterDisasters;

    if (nation.civilWar?.active) {
      const result = processCivilWarTurn(state, regions, units, nations[nId], nId, rng, newTurnNumber);
      Object.assign(regions, result.regions);
      // Object.assign alone can only ADD/replace keys — insurgent stacks the civil war removed
      // (suppressed by an AI, or cleared when the insurgents win) must be deleted explicitly too.
      Object.keys(units).forEach((id) => { if (units[id].isInsurgent && !result.units[id]) delete units[id]; });
      Object.assign(units, result.units);
      nations[nId] = result.nation;
      if (result.result === 'crushed' || result.result === 'lost') nations[nId] = { ...nations[nId], civilWarEndedTurn: newTurnNumber }; // the cooldown (civilWar.js)
      if (result.result === 'crushed') {
        logs.push({ year: newYear, ...msg('m.turn.civilWarCrushed', { nation: people(nId, nations[nId].name) }), type: LogTypes.CRISIS });
      } else if (result.result === 'lost') {
        logs.push({ year: newYear, ...msg('m.turn.civilWarLost', { nation: people(nId, nations[nId].name) }), type: LogTypes.CRISIS });
      }
      return;
    }

    // Automation (automation.js): the meter steps toward its target; low stability riots, lower still the machines rise.
    const target = Math.min(automationTarget(robotsOf.get(nId) || 0, getResearched(state, nId)), isBound(state, 'aiLimits', nId) ? AI_LIMITS_CAP : Infinity); // AI Limits (worldCongress.js)
    const automation = nextAutomation(automationOf(nations[nId]), target);
    if (automation !== automationOf(nations[nId])) nations[nId] = { ...nations[nId], automation };
    const rioting = isRioting(nations[nId]);
    if (rioting) { // the owner's cities, indexed once a turn on the first riot
      if (!citiesOf) { citiesOf = new Map(); Object.values(regions).forEach((c) => { if (c.owner) (citiesOf.get(c.owner) || citiesOf.set(c.owner, []).get(c.owner)).push(c.id); }); }
      (citiesOf.get(nId) || []).forEach((id) => { const c = regions[id]; regions[id] = { ...c, unrest: Math.min(100, (c.unrest || 0) + AUTOMATION_RIOT_UNREST) }; });
    }
    if (rioting !== !!nations[nId].automationRiots) {
      nations[nId] = { ...nations[nId], automationRiots: rioting };
      if (rioting && nId === state.playerNationId) logs.push({ year: newYear, ...msg('m.turn.automationRiots'), type: LogTypes.CRISIS });
    }
    const uprising = uprisingStep(nations[nId], nId, newTurnNumber, inCivilWarCooldown(nations[nId], newTurnNumber), speedTurns(UPRISING_WARNING_REF_TURNS, state.gameSpeed, ageOf(state, nId)), target);
    if (uprising.warning !== undefined) nations[nId] = { ...nations[nId], uprisingWarning: uprising.warning || undefined };
    if (uprising.event && nId === state.playerNationId) logs.push({ year: newYear, ...msg(uprising.event === 'warned' ? 'm.turn.uprisingWarning' : 'm.turn.uprisingAverted', { count: uprising.warning ? uprising.warning.at - newTurnNumber : 0, automation: AUTOMATION_UPRISING_AT, stability: AUTOMATION_UPRISING_STABILITY }), type: LogTypes.CRISIS });
    if (uprising.rise) {
      const war = startUprising(regions, units, nId, newTurnNumber);
      if (war) {
        nations[nId] = { ...nations[nId], civilWar: war, lowStabilityStreak: 0 };
        logs.push({ year: newYear, ...msg('m.turn.machineUprising', { nation: people(nId, nations[nId].name) }), type: LogTypes.CRISIS });
        return;
      }
    }

    const lowStabilityStreak = nextLowStabilityStreak(nations[nId], authorityRisksCivilWar({ ...state, regions, nations }, nId));
    const shouldStart = !exploreOn(state) && (triggersCivilWar || isStabilityCivilWarTrigger(lowStabilityStreak)) && !inCivilWarCooldown(nations[nId], newTurnNumber) && !isIndependentNation(nations[nId]); // an independent has no civil wars (one city, no court)
    if (shouldStart) {
      const started = startCivilWar(regions, units, nId, getFieldedStrength({ units }, nId), rng, newTurnNumber);
      if (started) {
        Object.assign(regions, started.regions);
        Object.assign(units, started.units);
        nations[nId] = { ...nations[nId], civilWar: started.civilWar, lowStabilityStreak: 0 };
        logs.push({ year: newYear, ...msg('m.turn.civilWar', { nation: people(nId, nations[nId].name) }), type: LogTypes.CRISIS });
        return;
      }
    }
    nations[nId] = { ...nations[nId], lowStabilityStreak };
  });
  mark('disastersAndCivilWar');

  let nextLoanSeq = state.nextLoanSeq || 1;
  // --- economy (plan §M11): army/navy/fort upkeep (maintenance-slider-scaled), advisor salaries,
  // and loan interest are all subtracted together so a shortfall can trigger ONE auto-loan or
  // bankruptcy, rather than three independent floor-at-0 deductions each masking part of the real
  // shortfall. Player-only, matching calcIncome/calcNationBalance's own scope — AI nations have no
  // simulated gold economy or loans. This replaces the old flat, army-only upkeep block.
  {
    const playerId = state.playerNationId;
    const nation = nations[playerId];
    // `units` (this turn's draft), not state.units: a unit lost to attrition, a revolt or a civil war
    // earlier this same turn must not still be charged upkeep.
    const playerUnits = Object.values(units).filter((u) => u.ownerId === playerId);
    // Laws and reforms move the army's upkeep (lawRules.js unitUpkeepMult), as the forecast in economy.js does.
    const armyMaintenanceMult = clampMaintenance(nation.armyMaintenance ?? ARMY_MAINTENANCE_DEFAULT) / 100 * Math.max(0, 1 + (lawRulesOf(nation).unitUpkeepMult || 0));
    const navyMaintenanceMult = clampMaintenance(nation.navyMaintenance ?? ARMY_MAINTENANCE_DEFAULT) / 100;
    const armyUpkeep = Math.round(playerUnits.filter((u) => u.domain !== 'naval').length * UNIT_UPKEEP_GOLD_PER_TURN * armyMaintenanceMult);
    const navyUpkeep = Math.round(playerUnits.filter((u) => u.domain === 'naval').length * UNIT_UPKEEP_GOLD_PER_TURN * navyMaintenanceMult);
    // Fort upkeep (plan §M6.2/§M11): 1g x fortLevel/turn — the Defense building line's
    // local.fortLevel already existed with no upkeep consumer until now.
    const fortLevels = Object.values(regions).filter((r) => r.owner === playerId).reduce((sum, r) => {
      const tier = r.buildings?.categories?.defense;
      const fortLevel = tier >= 0 ? BUILDING_CATEGORIES.defense.tiers[tier]?.effects?.['local.fortLevel'] : 0;
      return sum + (fortLevel || 0);
    }, 0);
    const fortUpkeep = fortLevels * FORT_UPKEEP_GOLD_PER_FORT_LEVEL;
    const buildingUpkeep = buildingUpkeepOf(state, regions, playerId);
    const advisors = Object.values(nation.advisors || {}).filter(Boolean);
    const advisorSalaryCost = advisors.reduce((sum, a) => sum + getAdvisorSalary(a.level), 0);
    const loanInterestCost = (nation.loans || []).reduce((sum, loan) => sum + Math.round(loan.principal * loan.interestRate), 0);
    // Marching armies (routes.js) cost a quarter more upkeep the turn they march.
    const marchingUpkeep = marchUpkeep(units, playerId, state.turnNumber, UNIT_UPKEEP_GOLD_PER_TURN * armyMaintenanceMult);
    const totalExpenses = armyUpkeep + marchingUpkeep + navyUpkeep + fortUpkeep + buildingUpkeep + advisorSalaryCost + loanInterestCost;

    if (totalExpenses > 0) {
      logs.push({
        year: newYear,
        ...msg('m.turn.upkeep', { total: totalExpenses, army: armyUpkeep, marching: marchingUpkeep ? sub('m.turn.upkeepMarching', { gold: marchingUpkeep }) : '', navy: navyUpkeep, forts: fortUpkeep, buildings: buildingUpkeep, advisors: advisorSalaryCost, interest: loanInterestCost }),
        type: LogTypes.ACTION
      });
    }
    const rawGold = resources.gold - totalExpenses;

    // Economic Collapse (plan §M15): "3 loans and negative net income for 5 turns... at 100:
    // bankruptcy plus -2 stability" — tracked off THIS turn's real income vs. expenses (not merely
    // whether the banked treasury went negative, which the auto-loan/bankruptcy path below already
    // reacts to on its own), so a nation running a persistent deficit gets an early warning even
    // while still solvent on paper.
    const netIncomeNegative = (income.gold || 0) < totalExpenses;
    const economicCollapseProgress = nextEconomicCollapseProgress(nation, netIncomeNegative);
    const disasterBankruptcyReady = isEconomicCollapseDisasterReady(economicCollapseProgress);
    const loanCapacity = rawGold < 0 ? getLoanCapacity({ ...state, regions, nations }, playerId) : 0;
    const canAutoLoan = rawGold < 0 && (nation.loans || []).length < loanCapacity;

    if ((rawGold < 0 && !canAutoLoan) || disasterBankruptcyReady) {
      // Bankruptcy (plan §M11/§M15): loan capacity already exhausted, OR the Economic Collapse
      // disaster forces it outright even while nominally solvent. See actionCosts.js's BANKRUPTCY_*
      // constants and BANKRUPTCY_MODIFIER_MODS's own header for which of the plan's listed effects
      // have a real hook today and which are deferred to M14; economy.js's applyBankruptcy is the
      // one shared implementation both this natural path and the disaster's own completion use.
      const applied = applyBankruptcy(nations[playerId], regions, playerId, newTurnNumber, disasterBankruptcyReady ? ECONOMIC_COLLAPSE_STABILITY_PENALTY : 0);
      nations[playerId] = { ...applied.nation, disasters: { ...applied.nation.disasters, economicCollapse: 0 } };
      Object.assign(regions, applied.regions);
      resources.gold = 0;
      // Unpaid soldiers desert: every unit loses DESERTION_SHARE of its men and its spirit, and a
      // unit left too small to stand dissolves. (Deserters go home: no casualty scar.)
      const deserted = applyArmyDesertion(units, playerId);
      if (deserted > 0) logs.push({ year: newYear, ...msg('m.turn.desertion', { men: Math.round(deserted * 10), pct: Math.round(DESERTION_SHARE * 100), morale: DESERTION_MORALE }), type: LogTypes.CRISIS });
      logs.push({
        year: newYear,
        ...msg(disasterBankruptcyReady && rawGold >= 0 ? 'm.turn.economicCollapse' : 'm.turn.bankruptcy'),
        type: LogTypes.CRISIS
      });
    } else if (rawGold < 0) {
      // Auto-loan (plan §M11): "if expenses would push gold below 0, a loan is auto-taken and
      // logged" — sized by the plan's own getLoanSize formula, floored at whatever actually
      // covers this turn's shortfall so the treasury doesn't stay negative regardless.
      const principal = Math.max(getLoanSize({ ...state, regions, nations, resources }, playerId), Math.ceil(-rawGold));
      const loanSeq = state.nextLoanSeq || 1;
      nextLoanSeq = loanSeq + 1;
      const loan = { id: `loan_${loanSeq}`, principal, interestRate: getLoanInterestRate({ ...state, nations }, playerId), takenTurn: newTurnNumber };
      nations[playerId] = { ...nations[playerId], loans: [...(nation.loans || []), loan], disasters: { ...nations[playerId].disasters, economicCollapse: economicCollapseProgress } };
      resources.gold = rawGold + principal;
      logs.push({ year: newYear, ...msg('m.turn.autoLoan', { gold: principal }), type: LogTypes.CRISIS });
    } else {
      resources.gold = rawGold;
      nations[playerId] = { ...nations[playerId], disasters: { ...nations[playerId].disasters, economicCollapse: economicCollapseProgress } };
    }
  }
  mark('economy');

  // --- diplomacy (plan §M12): Aggressive Expansion decay (every nation), diplomat tasks and
  // vassal tribute (player-only, matching every other player-only economic action this turn). ---
  Object.assign(nations, decayAggressiveExpansion(nations));
  // Claims on cities (claims.js): the ones being fabricated complete, the ones on cities now owned drop.
  advanceClaims(nations, regions, newTurnNumber).forEach((l) => { if (l.nationId === state.playerNationId) logs.push({ year: newYear, ...carry(l), type: LogTypes.DIPLOMACY }); });
  // Cuts of the player's trade routes (tradeDisruptions.js over plunder.js): a cut is an event with
  // a cause, a length and an end. The raider takes its gold once, when it starts; the player is
  // told at the start and at the end, never every turn (CB08: I113 to I115).
  const tradeTurn = advanceTradeDisruptions({ ...state, regions, units, nations, turnNumber: newTurnNumber }, newTurnNumber);
  tradeTurn.loot.forEach(({ by, gold }) => { const raider = nations[by]; if (raider) nations[by] = { ...raider, economy: { ...(raider.economy || {}), gold: ((raider.economy || {}).gold || 0) + gold } }; });
  tradeTurn.logs.forEach((l) => logs.push({ year: newYear, ...carry(l), type: LogTypes.COMBAT }));
  const tradeDisruptions = tradeTurn.disruptions;
  // Nations that fear the same conqueror band together in defensive pacts (src/engine/pacts.js).
  {
    const pacts = updateDefensivePacts(nations, { playerNationId: state.playerNationId, turnNumber: newTurnNumber });
    if (pacts.nations !== nations) Object.assign(nations, pacts.nations);
    logs.push(...pacts.logs.map((l) => ({ year: newYear, ...l })));
  }
  {
    const player = nations[state.playerNationId];
    (player.diplomatTasks || []).forEach((t) => {
      const target = nations[t.targetId];
      if (!target) return;
      nations[t.targetId] = { ...target, hostility: Math.max(target.hostilityFloor || 0, (target.hostility || 0) - DIPLOMAT_IMPROVE_RELATIONS_HOSTILITY_DECAY_PER_TURN) };
    });
    const vassalTribute = (player.vassals || []).reduce((sum, vassalId) => {
      const totalDev = Object.values(regions).reduce((s, r) => s + (r.owner === vassalId ? getTotalDev(r) : 0), 0);
      return sum + Math.round(totalDev * VASSAL_TRIBUTE_RATE * VASSAL_TRIBUTE_GOLD_PER_DEV_POINT);
    }, 0);
    if (vassalTribute > 0) {
      resources.gold = (resources.gold || 0) + vassalTribute;
      logs.push({ year: newYear, ...msg('m.turn.vassalTribute', { gold: vassalTribute }), type: LogTypes.ACTION });
    }
  }

  // Liberty desire (plan §M12/§M15: "rises with your weakness and their strength... at >= 50 they
  // may declare an independence war") — generic for every vassal, player or AI, the same real-
  // fielded-strength comparison civil war's own insurgent sizing uses rather than the abstract
  // militaryStrength number, since that's what an independence war would actually be fought with.
  // It now drifts toward a target read from the overlord's real weakness: relative strength, how
  // many wars it's fighting, its war exhaustion and whether it's in debt (src/engine/vassals.js).
  const fieldedOf = (id) => getFieldedStrength({ units }, id);
  const isInDebt = (id) => (id === state.playerNationId ? (resources.gold || 0) < 0 : (nations[id]?.economy?.gold || 0) < 0);
  Object.entries(nations).forEach(([nId, nation]) => {
    if (!nation.vassalOf || !nations[nation.vassalOf]) return;
    const target = libertyDesireTarget(libertyInputs(nations, state.wars, nId, fieldedOf, isInDebt));
    const libertyDesire = nextLibertyDesire(nation.libertyDesire, target);
    if (libertyDesire !== nation.libertyDesire) nations[nId] = { ...nation, libertyDesire };
  });
  // The AI's accords (aiAccords.js): open borders between friendly neighbours, tribute demands.
  const accords = processAIAccords({ ...state, nations, regions, units, resources }, nations, { turn: state.turnNumber, sortedByMilitary: tieringSortedByMilitary });
  Object.assign(nations, accords.nations);
  accords.logs.forEach((l) => { if (!l.nationId) logs.push({ year: newYear, ...carry(l), type: LogTypes.DIPLOMACY }); });
  const pendingDemand = accords.pendingDemand;
  // The World Congress (worldCongress.js): members of Global Institutions vote every span.
  const congress = processWorldCongress({ ...state, nations, regions, turnNumber: newTurnNumber });
  if (congress.nations !== nations) Object.assign(nations, congress.nations);
  congress.logs.forEach((l) => logs.push({ year: newYear, ...carry(l), type: LogTypes.DIPLOMACY }));
  mark('diplomacy');

  // --- great projects (plan §M10, now plans/civ-map-rework.md C9.2) --- a wonder is built from a
  // city's production queue on a tile of its border (wonders.js), by the player and the AI alike;
  // the old gold-and-turns construction queue is gone.
  const greatProjects = { ...state.greatProjects };
  // Wonders built from a city's queue this turn (wonders.js): the tile, the tier, the prestige.
  (cityTurn.wonders || []).forEach((w) => {
    const project = GREAT_PROJECTS[w.projectId];
    const tierSpec = project?.tiers[w.tier - 1];
    const standing = greatProjects[w.projectId];
    if (w.tier === 1 && standing && standing.regionId !== w.city) {
      // Two cities finished the same wonder this turn: the first in id order keeps it, the
      // other's tile mark is cleared and its owner told.
      if (w.tile != null && state.world?.tileState?.[w.tile]?.wonder === w.projectId) { const tileState = copyTileMap(state.world.tileState); tileState[w.tile] = { ...state.world.tileState[w.tile], wonder: undefined }; state = { ...state, world: { ...state.world, tileState } }; }
      if (regions[w.city]?.owner === state.playerNationId) logs.push({ year: newYear, ...msg('m.turn.wonderLost', { wonder: thing('wonder', w.projectId, project?.name || w.projectId), city: cityRef(w.city, regions[w.city]?.name) }), type: LogTypes.EVENT });
      return;
    }
    greatProjects[w.projectId] = { regionId: w.city, tier: w.tier, tile: w.tile };
    const ownerId = regions[w.city]?.owner;
    if (ownerId && nations[ownerId] && tierSpec?.completionPrestige) nations[ownerId] = { ...nations[ownerId], prestige: clampPrestige((nations[ownerId].prestige || 0) + tierSpec.completionPrestige) };
    if (ownerId && nations[ownerId]) nations[ownerId] = grantRenown(grantDecree(nations[ownerId], 'wonder', newTurnNumber, w.projectId), 'wonder', RENOWN.wonderTier, newTurnNumber, w.projectId);
    if (ownerId === state.playerNationId) logs.push({ year: newYear, ...msg('m.turn.wonderBuilt', { wonder: thing('wonder', w.projectId, project?.name || w.projectId), tier: w.tier, city: cityRef(w.city, regions[w.city]?.name), prestige: tierSpec?.completionPrestige ? sub('m.prestigeGain', { n: tierSpec.completionPrestige }) : '' }), type: LogTypes.MILESTONE });
  });
  mark('greatProjects');

  // sortedByMilitary is computed once here, not per nation, to keep both of the following passes
  // affordable across 240 nations.
  const sortedByMilitary = getSortedByMilitary({ ...state, nations });

  // --- AI recruitment (plan §8.5's counter-building, Task 36): Tier 1 nations turn some of their
  // abstract militaryStrength growth into real, counterable units in state.units — recruiting
  // whatever class beats their most relevant rival's dominant class. Uses the calendar age, not a
  // per-nation tech age (AI nations don't track one independently). ---
  const recruitment = processAIRecruitment({ ...state, nations, regions, units }, units, nations, regions, sortedByMilitary, rng);
  // Every unit raised this turn draws its men from its home province (aftermath.js).
  // (`regions` is this turn's own working copy, so each levy updates just its one province in place.)
  Object.values(recruitment.units).forEach((u) => {
    if (units[u.id] || u.domain === 'naval') return;
    const home = u.homeRegionId || u.regionId;
    const next = levyUnit({ [home]: regions[home] }, u)[home];
    if (next) regions[home] = next;
  });
  Object.assign(units, recruitment.units);
  Object.assign(nations, recruitment.nations);
  logs.push(...recruitment.logs.map(l => ({ year: newYear, ...l })));
  mark('aiRecruitment');

  // --- AI war declarations (plan §8.5's tiered AI): Tier 1 nations (at war, bordering the
  // player, or a top-20 military power) may each declare one war this turn against a weaker
  // neighbor, biased by doctrine and hostility. ---
  // `pendingDemand` is this turn's: a major never rolls for war on a people it holds an open demand on (X21, I103).
  const warDecisions = processAIWarDecisions({ ...state, nations, regions, units, pendingDemand }, nations, state.wars, sortedByMilitary, rng);
  let nationsAfterWars = warDecisions.nations;
  let wars = warDecisions.wars;
  logs.push(...warDecisions.logs.map(l => ({ year: newYear, ...l })));
  // War contagion (warContagion.js, a Hawkes process): wars that began this turn heat up the
  // nations near them; the heat decays and raises their own war roll next turn.
  nationsAfterWars = updateWarHeat(nationsAfterWars, wars, state.turnNumber, { ...state, regions });
  mark('aiWarDeclarations');

  // --- AI war progress (plan §8.5's war-goal resolution): territorial conquest rolls, mutual
  // attrition, and ending a war outright once its goal is met — this is what makes every one of
  // the 240 nations conquerable by ANY nation, not just the player. A war the player started is
  // untouched here; that's resolved by the player's own invasion actions instead.
  const operations = processAIOperations({ ...state, turnNumber: newTurnNumber, regions, units, nations: nationsAfterWars, wars, logs: [] }, rng);
  rng = createRng(operations.rngSeed);
  Object.keys(units).forEach(id => { if (!operations.units[id]) delete units[id]; });
  Object.assign(units, operations.units);
  Object.assign(regions, operations.regions);
  nationsAfterWars = operations.nations;
  wars = operations.wars;
  logs.push(...operations.logs);
  // The map changes the operations made (AI pillage marks, field battle marks) carry on into the
  // phases below and the next state, which is assembled from `state.world`.
  if (operations.world && operations.world !== state.world) state = { ...state, world: operations.world };
  // Sallies counted by aiSally (I125) ride on indepStats like the independents' tallies.
  if (operations.indepStats && operations.indepStats !== state.indepStats) state = { ...state, indepStats: operations.indepStats };
  invalidateRegionsCache(regions);
  const warProgress = resolveWarProgress({ ...state, regions, units, nations: nationsAfterWars }, regions, nationsAfterWars, wars, rng);
  Object.assign(regions, warProgress.regions);
  nationsAfterWars = warProgress.nations;
  wars = warProgress.wars;
  // A peace deal's 'gold' term (plan §M13/peace.js) only ever moves the PLAYER's own treasury (an
  // AI nation has no simulated one pre-M16) — applied here as a delta against `resources`'s own
  // running total rather than overwriting it outright, since this turn's income phases below add to
  // the same object both before and after this point.
  resources.gold = (resources.gold || 0) + ((warProgress.resources.gold || 0) - (state.resources.gold || 0));
  const pendingPeaceOffer = warProgress.pendingPeaceOffer || null;
  logs.push(...warProgress.logs.map(l => ({ year: newYear, ...l })));
  mark('aiWarProgress');

  // --- nation elimination (src/engine/elimination.js): a nation reduced to zero regions this turn
  // — by the player's own invasions (which land immediately via gameReducer.js, so this sweep is
  // what actually notices them), by AI-vs-AI conquest just above, or by losing its last region to
  // a rebellion — has nothing left to govern or fight with. playerEliminatedNationId is a
  // transient, one-turn signal (App.jsx diffs it to show a one-shot reward popup); it's not
  // persisted anywhere else on state. ---
  let playerEliminatedNationId = null;
  let independentsConquered = 0; // phase W3: counted into state.indepStats.conquered below
  const eliminationWarParticipants = new Set();
  Object.keys(nationsAfterWars).forEach((nId) => {
    const eliminated = checkNationElimination(nationsAfterWars, regions, nId, units);
    if (!eliminated) return;
    nationsAfterWars = unlinkEliminatedVassalage({ ...nationsAfterWars, [nId]: eliminated }, nId, nationsAfterWars[nId].vassalOf);
    wars.forEach(w => {
      if (w.aggressor === nId || w.enemy === nId) {
        eliminationWarParticipants.add(w.aggressor);
        eliminationWarParticipants.add(w.enemy);
      }
    });
    wars = closeWarsForEliminatedNation(wars, nId);
    // An independent is one city: taking it is a conquest, not the fall of a nation (no reward, no world log).
    if (isIndependentNation(eliminated)) { independentsConquered += 1; return; }
    logs.push({ year: newYear, ...msg('m.turn.eliminated', { nation: people(nId, eliminated.name) }), type: LogTypes.MILESTONE });
    // Rivals (plan §M12): "+10% prestige gain/turn" has no substrate (nationalPower.js's prestige
    // is pure decay outside one-shot sources) — this is the one real payoff instead, a one-shot
    // reward when a designated rival goes down for good.
    if ((nationsAfterWars[state.playerNationId]?.rivals || []).includes(nId)) {
      const player = nationsAfterWars[state.playerNationId];
      nationsAfterWars = { ...nationsAfterWars, [state.playerNationId]: { ...player, prestige: clampPrestige((player.prestige || 0) + RIVAL_ELIMINATED_PRESTIGE_REWARD) } };
      logs.push({ year: newYear, ...msg('m.turn.rivalFallen', { nation: people(nId, eliminated.name), n: RIVAL_ELIMINATED_PRESTIGE_REWARD }), type: LogTypes.DIPLOMACY });
    }
    if (wasEliminatedByPlayer(regions, state.playerNationId, nId)) {
      resources.gold = (resources.gold || 0) + NATION_ELIMINATION_REWARD.gold;
      playerEliminatedNationId = nId;
      logs.push({
        year: newYear,
        ...msg('m.turn.conqueredAll', { nation: people(nId, eliminated.name), gold: NATION_ELIMINATION_REWARD.gold }),
        type: LogTypes.MILESTONE
      });
    }
  });
  // Elimination also closes wars; surviving opponents must stop paying war exhaustion.
  nationsAfterWars = refreshWarFlags(nationsAfterWars, wars, [...eliminationWarParticipants]);
  mark('elimination');

  let raidBattles = [];
  // --- independents (phase W2, raids.js): their treasuries, grudges, tribute, raids and sacks,
  // and every mercenary contract (mercenaries.js). After the majors' operations, so a raid meets
  // the armies where they now stand.
  {
    // In place: the turn's working regions, units and resources are written directly.
    const indep = processIndependents({ ...state, turnNumber: newTurnNumber, year: newYear, regions, units, nations: nationsAfterWars, resources, wars }, { inPlace: true });
    if (indep) {
      nationsAfterWars = indep.nations;
      state = { ...state, world: indep.world, tributeDemands: indep.tributeDemands, indepStats: indep.indepStats, ...(indep.appliedBattleIds ? { appliedBattleIds: indep.appliedBattleIds } : {}) };
      indep.logs.forEach((l) => logs.push(l));
      // Raid battles against the player wait in the battle queue for Command or Auto (raidBattle.js).
      raidBattles = indep.queued;
      if (indep.regionsChanged) invalidateRegionsCache(regions); // a sack or a burned outpost; no city changes hands here
    }
  }
  mark('independents');

  // --- majors and independents (phase W3, indepPolicy.js and razing.js): burning cities shrink or
  // fall to ashes, the AI razes a small crowding prize, independents take favour, trade and tribute
  // and may join a major, and the AI majors court, trade with, tax or march on them (the siege force
  // itself moved in the operations above).
  {
    const stats0 = { ...(state.indepStats || {}), conquered: (state.indepStats?.conquered || 0) + independentsConquered };
    const mi = processMajorsAndIndependents({ ...state, turnNumber: newTurnNumber, year: newYear, regions, units, nations: nationsAfterWars, resources, wars, indepStats: stats0 });
    if (mi) {
      Object.keys(units).forEach((id) => { if (!mi.units[id]) delete units[id]; });
      Object.assign(units, mi.units);
      Object.keys(regions).forEach((id) => { if (!mi.regions[id]) delete regions[id]; });
      Object.assign(regions, mi.regions);
      Object.assign(resources, mi.resources);
      nationsAfterWars = mi.nations;
      wars = mi.wars;
      state = { ...state, world: mi.world, joinOffers: mi.joinOffers, indepStats: mi.indepStats };
      mi.logs.forEach((l) => { if (!l.nationId || l.nationId === state.playerNationId) logs.push({ year: l.year, ...carry(l), type: l.type }); });
      invalidateRegionsCache(regions);
    } else if (independentsConquered) state = { ...state, indepStats: stats0 };
  }
  mark('majorsAndIndependents');

  // --- history crises (crises.js): world crises from conditions, carried by loyalty, raids, plague,
  // the population model and wars; a hit player gets the opening story as a deck link due now.
  let crisisChoice; // the option the player picked during the warning, paid once the turn is assembled
  {
    const crisis = processCrises({ ...state, turnNumber: newTurnNumber, year: newYear, regions, units, nations: nationsAfterWars, wars });
    if (crisis) {
      crisisChoice = crisis.choice == null ? undefined : { id: crisis.crises.history.at(-1).id, option: crisis.choice };
      let chains = crisis.pendingEventChains;
      // The early choice can no longer be paid while another option can: the card opens again instead
      // of applyEventEffects dropping the answer with only a "can't afford" line.
      if (crisisChoice) {
        const card = cardOf(crisisCardId(crisisChoice.id));
        const short = (o) => getOptionShortfall(state.resources, o?.effects).length > 0;
        if (short(card.options[crisisChoice.option]) && card.options.some((o) => !short(o))) {
          chains = [...(chains || []), { id: card.id, dueTurn: newTurnNumber }];
          crisisChoice = undefined;
        }
      }
      nationsAfterWars = crisis.nations;
      wars = crisis.wars;
      state = { ...state, crises: crisis.crises, pendingEventChains: chains };
      logs.push(...crisis.logs);
    }
  }
  mark('crises');

  // --- war exhaustion (plan §9/§11): rises for every nation at war, including the player,
  // decays at peace. Makes a long war's eventual Sue for Peace cheaper (GameContext.jsx) — this
  // is what "forces you to actually end them" rather than letting a war run forever for free.
  // The rise follows the war's real burden (warBurden.js, CB09 I121/X22): a base, own cities under
  // siege and cities an enemy holds; battles add their own (aftermath.js).
  const liveWarIds = new Set(wars.filter((w) => w.active).map((w) => w.id));
  const atWarIds = new Set(Object.keys(nationsAfterWars).filter((nId) => nationsAfterWars[nId].isAtWar));
  const burden = warBurdenInputs(regions, atWarIds, (warId) => liveWarIds.has(warId));
  Object.entries(nationsAfterWars).forEach(([nId, nation]) => {
    // Laws and reforms slow the rise (lawRules.js warExhaustionMult: Mass Conscription, Martial Law, Military Junta).
    const delta = nation.isAtWar ? warExhaustionRise(burden.get(nId)) * Math.max(0, 1 + (lawRulesOf(nation).warExhaustionMult || 0)) : -WAR_EXHAUSTION_DECAY_PER_TURN;
    const warExhaustion = clamp((nation.warExhaustion || 0) + delta, 0, 100);
    if (warExhaustion !== nation.warExhaustion) nationsAfterWars[nId] = { ...nation, warExhaustion };
  });
  mark('warExhaustion');

  // --- events --- (eventDeck.js: a due story, else a due link, else sometimes a drawn card)
  const events = drawEvent({ ...state, nations, regions, turnNumber: newTurnNumber, year: newYear }, rng);
  // The scripted plagues start a real outbreak where history started them (plague.js).
  if (PLAGUE_EVENT_ORIGINS[events.activeEventId]) seedPlagueNear(regions, PLAGUE_EVENT_ORIGINS[events.activeEventId], newTurnNumber);

  mark('diplomacyStreakAndEvents');

  // --- assemble next state ---
  let next = {
    ...state,
    world: state.world,
    year: newYear,
    turnNumber: newTurnNumber,
    resources,
    regions,
    nations: nationsAfterWars,
    greatProjects,
    units,
    wars,
    pendingPeaceOffer,
    pendingDemand,
    ...(congress.worldCongress ? { worldCongress: congress.worldCongress } : {}),
    tradeDisruptions, // cut and guarded trade routes (tradeDisruptions.js); absent in old saves = none
    // Assaults on the player's garrisons (src/engine/defense.js), fought before the next turn —
    // dropped if their war ended this same turn.
    nextUnitSeq: operations.nextUnitSeq,
    aiOperations: operations.aiOperations,
    // Raids are not wars: their battles carry no war id and stay (battleQueue.js keepQueued).
    pendingDefenses: [...operations.pendingDefenses, ...(warProgress.pendingDefenses || []), ...raidBattles].filter((d) => keepQueued(d, wars, nationsAfterWars)),
    regionModifiers,
    playerEliminatedNationId,
    ...events,
    nextLoanSeq,
    lodPeriods, // world/lod.js: next turn's loyalty pass reads which nations are far and quiet
    rngSeed: rng.getSeed(),
    logs: capLogs([...state.logs, ...logs])
  };
  // A crisis answered early pays its option now it struck (applyEventEffects clears the open card: keep this turn's).
  if (crisisChoice) next = { ...applyEventEffects(next, cardOf(crisisCardId(crisisChoice.id)), crisisChoice.option), activeEventId: next.activeEventId, activeProceduralEvent: next.activeProceduralEvent };
  // Players who opted to auto-resolve enemy assaults are never interrupted: fought right away.
  // The battle queue (battleQueue.js): with autoDefend the battles are fought on Auto now, unless an
  // event or a peace offer opened this turn (then they wait for the answer, gameReducer's drain).
  // Manned forts stop and fight the enemy armies that came next to them this turn (forts.js).
  next = processFortBattles(next, startUnits);
  if (next.pendingDefenses.length) next = drainAutoBattles(next);
  if (next.tutorial) next = advanceTutorial(next);
  mark('assembleNextState');

  // --- defeat (plan §M15, checked against THIS turn's resolved state) --- "GameStatus.DEFEAT is set
  // when the player owns 0 regions: annexed by a peace deal, or all regions lost to rebels or
  // revolts." Checked BEFORE victory and under the same not-mid-event gating: a player just ceded
  // down to nothing can't also "survive" the same turn, and a defeat should never land mid-event.
  // elimination.js's checkNationElimination stays player-exempt (it flags an AI nation's RECORD dead;
  // the player's own record keeps playing out its defeat/game-over screen instead) — this is the
  // real player-losing condition elimination.js never had before this milestone.
  if (next.gameStatus === GameStatus.ACTIVE && !next.activeEventId && !next.activeProceduralEvent && !next.pendingPeaceOffer && checkPlayerDefeat(next.regions, next.playerNationId, next.units)) {
    next = { ...next, gameStatus: GameStatus.DEFEAT };
    next.logs = [...next.logs, { year: newYear, ...msg('m.turn.defeat'), type: LogTypes.MILESTONE }];
  }
  mark('defeat');

  // --- victory (checked against THIS turn's resolved state, not last turn's) ---
  // Not checked while an event is actively pending, so a victory never lands mid-event-resolution.
  // One victory model (differentiation plan KD4): domination wins outright on any turn; otherwise
  // the one ending signal ranks every major once by legacy (score.js, legacy.js): 'Victory' if
  // the player ranks #1, else 'Game Complete, Rank N'.
  // Dominance (ending.js): the streak is kept here, once a turn, before the signal reads it; a new
  // leader's streak is announced with the turns it must hold.
  if (!next.ending) {
    const dominance = nextDominance(next);
    if (dominance && dominance !== next.dominance) {
      const id = dominance.nationId;
      next.logs = [...next.logs, { year: newYear, ...msg(id === next.playerNationId ? 'm.turn.dominanceYou' : 'm.turn.dominance', { nation: people(id, next.nations[id]?.name || id), n: dominanceHold(next, id) }), type: LogTypes.MILESTONE }];
    }
    if (dominance !== (next.dominance ?? null)) next = { ...next, dominance };
  }
  const ending = next.ending ? null : endingSignal(next);
  if (next.gameStatus === GameStatus.ACTIVE && !next.activeEventId && !next.activeProceduralEvent && !next.pendingPeaceOffer) {
    const conditionId = checkVictoryConditions(next);
    if (conditionId) {
      const condition = VICTORY_CONDITIONS[conditionId];
      next = applyVictory(next, conditionId);
      next.logs = [...next.logs, { year: newYear, ...msg('m.turn.victory', { victory: thing('victory', conditionId, condition.name) }), type: LogTypes.MILESTONE }];
    } else if (ending) {
      // The one ending signal (ending.js): the speed's turn limit or the Future's final goal. It
      // fires once: the ending it gives is kept on the state.
      next = { ...next, ending };
      // The final age is scored once, for every major, when the game ends (KTD7).
      const scoredNations = { ...next.nations };
      Object.keys(scoredNations).sort().forEach((id) => {
        const n = scoredNations[id];
        if (!n || n.isEliminated || n.kind === 'independent') return;
        const legacy = awardEraLegacy(next, n, ageOf(next, id), next.turnNumber);
        scoredNations[id] = legacy.nation;
        if (id === next.playerNationId && legacy.log) next.logs = [...next.logs, { year: newYear, ...carry(legacy.log), type: LogTypes.MILESTONE }];
      });
      next = { ...next, nations: scoredNations };
      const rank = getPlayerRank(next);
      if (rank === 1) {
        next = { ...applyVictory(next, 'finalScore'), finalRank: 1 };
        next.logs = [...next.logs, { year: newYear, ...msg('m.turn.scoreVictory'), type: LogTypes.MILESTONE }];
      } else {
        next = { ...next, gameStatus: GameStatus.COMPLETE, finalRank: rank };
        next.logs = [...next.logs, { year: newYear, ...msg('m.turn.gameComplete', { rank }), type: LogTypes.MILESTONE }];
      }
    }
  }
  mark('victory');

  next = reconcileTerritory(processColonies(processLateArrivals(next)));
  mark('territory');
  // Research last, once this turn's science has been credited (src/engine/research.js).
  next = applyResearchTurn(next);
  // The year label for the turn just resolved, from the player's research (the only writer).
  next = { ...next, year: displayYear(next) };
  mark('research');
  next = normalizeUnitTiles(syncWorldRegistry(next));
  mark('registry');
  // Fog of war last (fog.js): what everyone sees once the turn's moves, foundings and conquests
  // are done grows their explored maps and makes contacts.
  next = updateFog(next);
  // Scouts on auto-explore pick their next unexplored tile now that the fog has grown (scouting.js).
  next = continueExplorers(next);
  // A major may offer the player a swap of maps on the grown fog (mapTrade.js, I116; never blocks).
  next = processAIMapOffers(next);
  mark('fog');
  return tickChronicle(state, next);
};
