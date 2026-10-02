import { applyArmyDesertion, DESERTION_SHARE, DESERTION_MORALE } from './armyDesertion';
export { DESERTION_SHARE, DESERTION_MORALE, DESERTION_DISBAND_BELOW } from './armyDesertion';
import { processEmergence } from './emergence';
import { processAIOperations } from './aiOperations';
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
import { AGES, getCalendarAgeId, getYearsPerTurn, END_YEAR } from '../data/ages';
import { createEmptyResourcePool } from '../data/resources';
import { pickNextEvent } from '../data/events';
import { pickProceduralEvent } from '../data/proceduralEvents';
import { EVENT_CHAINS } from '../data/eventChains';
import { calcIncome, formatMoney, nextUnrest, getNationBonusTotal, getPowerIncome, getFieldedStrength } from '../utils/helpers';
import { getRegionModifier, getModifier } from './modifiers/sheet';
import { nextSiegeControlRegen, SIEGE_REGEN_COOLDOWN_TURNS } from './siege';
import { getPopulationGrowthRate, nextRegionPopulation } from './population';
import { checkNationElimination, unlinkEliminatedVassalage, closeWarsForEliminatedNation, wasEliminatedByPlayer, NATION_ELIMINATION_REWARD, checkPlayerDefeat } from './elimination';
import { processAllAINations, processAIWarDecisions, processAIRecruitment, getSortedByMilitary, getRelationFromHostility, getNationTier } from '../utils/aiLogic';
import { calcAllNationIncomes, processAIEconomyTurn, settleAIUpkeep, thinksThisTurn } from './aiEconomy';
import { processAIAbmDefense } from './aiMissiles';
import { resolveWarProgress, refreshWarFlags } from './diplomacy';
import { resolveAllDefensesAuto } from './defense';
import { transferRegion } from './regionTransfer';
import { checkVictoryConditions, applyVictory, VICTORY_CONDITIONS, getDiplomaticAlignmentShare, DIPLOMATIC_LEADERSHIP_SHARE } from '../data/victoryConditions';
import { getPlayerRank } from './score';
import { SPACE_MISSIONS_BY_ID } from '../data/spaceMissions';
import { REGIONS_DATA, getCapital } from '../data/regions';
import {
  REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, REBEL_GROWTH_RATE, REBEL_MAX_GROWTH_MULT, getRebelSpawnStrength,
  REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD, REVOLT_RECLAIMED_CONTROL, REVOLT_RECLAIMED_UNREST
} from '../data/rebellion';
import { createRng } from '../utils/rng';
import { processCities, sizeToPeople } from './world/cities';
import { makeSettler, processSettlers, bestSites, isSettler } from './settlers';
import { chooseProduction, nationCounts } from './aiProduction';
import { syncWorldRegistry } from './world/registry';
import { getTiles } from '../data/geo/tiles';
import { getResearched, getTechAgeId } from './nationState';
import { getEffectiveAgeId } from '../data/ages';
import { libertyDesireTarget, libertyInputs, nextLibertyDesire } from './vassals';
import { levyUnit, decayDevastation, devastationGrowthPenalty } from './aftermath';
import { expireNationModifiers, expireRegionModifiers } from './modifiers/timed';
import { TAX_RATES } from '../data/taxRates';
import { getSatelliteEffectTotal, MAX_ORBITAL_DEBRIS } from '../data/satellites';
import {
  ORBITAL_DEBRIS_DECAY_PER_TURN, UNIT_UPKEEP_GOLD_PER_TURN, ARMY_MAINTENANCE_DEFAULT, FORT_UPKEEP_GOLD_PER_FORT_LEVEL,
  FUSION_GRID_UPKEEP_HELIUM3_PER_TURN,
  DIPLOMAT_IMPROVE_RELATIONS_HOSTILITY_DECAY_PER_TURN, VASSAL_TRIBUTE_RATE, VASSAL_TRIBUTE_GOLD_PER_DEV_POINT,
  RIVAL_ELIMINATED_PRESTIGE_REWARD, CAPITAL_OCCUPIED_STABILITY_PENALTY, CAPITAL_OCCUPIED_POOL_PENALTY,
  CIVIL_WAR_SUCCESSION_CRISIS_CHANCE, ECONOMIC_COLLAPSE_STABILITY_PENALTY,
  POWER_POOL_CAP
} from '../data/actionCosts';
import { processSuccession, processRoyalBirth, getAdvisorSalary } from './succession';
import { applyResearchTurn } from './research';
import { processNationalPowerTurn, clampStability, clampLegitimacy, clampPrestige, STABILITY_MAX } from './nationalPower';
import { processEstatesTurn } from './estates';
import { createInitialEstate, LABOR_ESTATE_ID } from '../data/estates';
import { GREAT_PROJECTS } from '../data/greatProjects';
import { BUILDING_CATEGORIES } from '../data/buildings';
import { clampMaintenance, getLoanCapacity, getLoanSize, getLoanInterestRate, applyBankruptcy } from './economy';
import {
  nextLowStabilityStreak, isStabilityCivilWarTrigger, startCivilWar, processCivilWarTurn
} from './civilWar';
import { processDisastersTurn, nextEconomicCollapseProgress, isEconomicCollapseDisasterReady } from './disasters';
import { getTotalDev } from './development';
import { decayAggressiveExpansion } from './expansion';
import { advanceClaims } from './claims';
import { updateDefensivePacts } from './pacts';
import { computeSupplyFlow, isCampaigning, unitsByOwner, HUNGER_MORALE } from './supplies';
import { advanceMarches, marchUpkeep } from './routes';
import { normalizeUnitTiles } from './armies';
import { applySupplyMeter, SUPPLY_LINE_RINGS } from './supplyMeter';
import { processSieges } from './sieges';
import { opinionOf, opinionGivesCasusBelli } from './opinion';
import { applyLoyalty } from './loyalty';
import { awardEraLegacy } from './eraGoals';
import { createDefenseRecord } from './defense';
import { conquerRegion } from './conquest';
import { processColonies } from './colonies';
import { hasPerk } from '../data/promotions';
import { governorEffects, governorOf, pruneGovernors, generateGovernorCandidates, GOVERNOR_UNREST_MULT, GOVERNOR_REFRESH_TURNS } from './governors';
import { authorityRisksCivilWar } from './authority';
import { rollCityDisasters } from './cityDisasters';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const WAR_EXHAUSTION_RISE_PER_TURN = 5;
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
const runCitiesPhase = (state, newAge, newTurnNumber) => {
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
        ageId: getEffectiveAgeId(newAge, nid ? getTechAgeId(state, nid) : newAge),
        turnNumber: newTurnNumber,
        citiesOwned: citiesOwned[nid] || 1,
        luxuries: luxuriesByNation[nid] ? luxuriesByNation[nid].size : 0
      });
    }
    return ctxCache.get(nid);
  };
  // A governed city (governors.js) adds its governor's food, production and culture to the nation's context.
  const ctxFor = (city) => {
    const base = nationCtx(city.owner);
    if (!city.owner || !state.nations[city.owner]?.governors || city.id == null) return base;
    const g = governorEffects(state, city.owner, city.id, newTurnNumber);
    if (!g.governed) return base;
    return { ...base, foodBonus: g.food, productionMult: (base.productionMult || 0) + g.productionMult, cultureBonus: g.culture };
  };
  // AI cities with nothing queued pick something first (aiProduction.js). One copy of the map,
  // one set of nation counts: never a spread per city.
  let cities = state.regions;
  const counts = nationCounts(state);
  Object.values(state.regions).forEach((city) => {
    if (!city.owner || city.owner === state.playerNationId || city.outpost || city.production?.current) return;
    const ctx = ctxFor(city);
    const item = chooseProduction(state, city, { ...ctx, units: state.units, counts: counts[city.owner] });
    if (item) { if (cities === state.regions) cities = { ...cities }; cities[city.id] = { ...city, production: { ...city.production, current: item } }; }
  });
  const world = { cities, tileOwner: state.world.tileOwner || {}, tileState: state.world.tileState || {} };
  const result = processCities(world, tiles, ctxFor);
  const regions = {};
  Object.entries(result.world.cities).forEach(([id, c]) => {
    const y = result.yields[id];
    regions[id] = y ? { ...c, lastYields: { gold: y.gold, production: y.production, food: y.food, science: y.science, culture: y.culture, luxuries: y.luxuries, strategic: y.strategic }, dev: { tax: Math.max(1, Math.round(y.raw.gold)), production: Math.max(1, Math.round(y.production)), manpower: Math.max(1, c.size) } } : c;
  });
  // Floods, fires and plagues by tile facts (cityDisasters.js).
  const disasterLogs = rollCityDisasters(regions, newTurnNumber);
  let units = state.units;
  let nextUnitSeq = state.nextUnitSeq || 0;
  result.completed.forEach((item) => {
    if (item.kind === 'settler') {
      const id = `unit_${nextUnitSeq++}`;
      const settler = makeSettler(id, regions[item.city], item.nationId);
      // An AI settler picks its site at once; the player's waits for SET_SETTLER_TARGET.
      const site = item.nationId !== state.playerNationId ? bestSites({ ...state, regions, units }, item.nationId, settler.tile, ctxFor(regions[item.city]).ageId, { limit: 1 })[0] : null;
      units = { ...units, [id]: site ? { ...settler, target: site.tile } : settler };
      return;
    }
    if (item.kind !== 'unit') return;
    const id = `unit_${nextUnitSeq++}`;
    units = { ...units, [id]: { id, regionId: item.city, homeRegionId: item.city, tile: regions[item.city]?.tile ?? null, ownerId: item.nationId, domain: item.classId === 'naval' ? 'naval' : 'land', classId: item.classId, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null } };
  });
  const logs = result.logs.filter((l) => l.nationId === state.playerNationId).map((l) => l.message);
  disasterLogs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push(l.message); });
  // Settlers walk, found outposts, and outposts grow (settlers.js).
  const afterCities = { ...state, regions, units, nextUnitSeq, world: { tileOwner: result.world.tileOwner, tileState: result.world.tileState } };
  const hasSettlers = Object.values(units).some(isSettler) || Object.values(regions).some((c) => c.outpost);
  if (!hasSettlers) return { state: afterCities, logs };
  const settled = processSettlers(afterCities, regions, units, afterCities.world, (nid) => ctxFor({ owner: nid }).ageId, newTurnNumber);
  settled.logs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push(l.message); });
  return { state: { ...afterCities, regions: settled.regions, units: settled.units, world: settled.world }, logs };
};

export const resolveTurn = (incomingState, { onPhase } = {}) => {
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

  let regionDraft = null;
  let phaseStart = onPhase ? performance.now() : 0;
  const mark = (name) => {
    if (regionDraft) invalidateRegionsCache(regionDraft);
    if (!onPhase) return;
    const now = performance.now();
    onPhase(name, now - phaseStart);
    phaseStart = now;
  };

  // --- marches (routes.js): armies on a route walk this turn's steps first, so the supplies, the
  // upkeep and every phase below see where they now stand.
  let marchLogs = [];
  if (Object.values(state.units).some((u) => u.route?.length)) {
    const marchedUnits = { ...state.units };
    marchLogs = advanceMarches(state, marchedUnits, { year: state.year }).logs;
    state = { ...state, units: marchedUnits };
  }

  let rng = createRng(state.rngSeed);
  const logs = [];
  // --- time ---
  const newYear = state.year + getYearsPerTurn(state.age, state.gameSpeed);
  const newAge = getCalendarAgeId(newYear);
  const newTurnNumber = state.turnNumber + 1;
  marchLogs.forEach((l) => logs.push({ ...l, year: newYear }));
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
  const modifierExpiredNations = { ...expireNationModifiers(state.nations, newTurnNumber) };
  const regionModifiers = expireRegionModifiers(state.regionModifiers, newTurnNumber);
  // Era goals (plans/civ-map-rework.md C9.3, eraGoals.js): the ending age is scored for the player
  // and a legacy carries into the new one.
  if (newAge !== state.age && modifierExpiredNations[state.playerNationId]) {
    const legacy = awardEraLegacy(state, modifierExpiredNations[state.playerNationId], state.age, newTurnNumber);
    modifierExpiredNations[state.playerNationId] = legacy.nation;
    if (legacy.log) logs.push({ year: newYear, message: legacy.log, type: LogTypes.MILESTONE });
  }
  mark('time');

  // --- sieges (plans/civ-map-rework.md D2, sieges.js): armies beside a city grind its walls; at
  // 0 HP it falls. Before the cities phase, so a besieged city works ring 1 only this turn.
  {
    const siegeRegions = { ...state.regions };
    const siegeUnits = { ...state.units };
    const { fallen, logs: siegeLogs } = processSieges(state, siegeRegions, siegeUnits, { turn: newTurnNumber });
    let siegeNations = state.nations; let siegeWars = state.wars; const pendingDefenses = [...(state.pendingDefenses || [])];
    const committed = new Set();
    fallen.forEach((f, i) => {
      const war = siegeWars.find((w) => w.active && ((w.aggressor === f.to && w.enemy === f.from) || (w.aggressor === f.from && w.enemy === f.to)));
      if (f.from === state.playerNationId && war && f.to !== REBEL_OWNER_ID) {
        // A last stand: the besiegers assault the player's city this turn (defense.js).
        const seed = Math.floor(rng.next() * 0xffffffff) >>> 0;
        const record = createDefenseRecord({ ...state, regions: siegeRegions, units: siegeUnits }, { war: { ...war, aggressor: f.to }, regionId: f.cityId, aggressorShare: 1, seed, index: `siege_${i}`, committed });
        pendingDefenses.push({ ...record, siege: true });
        siegeLogs.push({ nationId: f.from, message: `The walls of ${siegeRegions[f.cityId].name} are breached: the garrison makes its last stand.` });
        return;
      }
      if (f.to === REBEL_OWNER_ID) return; // rebels take no cities by siege (rebellion.js holds the revolt)
      const r = conquerRegion({ regions: siegeRegions, nations: siegeNations, turnNumber: newTurnNumber }, f.cityId, f.to, war || null);
      Object.assign(siegeRegions, r.regions); siegeRegions[f.cityId] = { ...r.regions[f.cityId], siege: null, buildings: siegeRegions[f.cityId].buildings };
      siegeNations = r.nations;
      siegeLogs.push({ nationId: f.from, message: `${siegeRegions[f.cityId].name} has fallen to ${state.nations[f.to]?.name || f.to} after a siege.` }, { nationId: f.to, message: `${siegeRegions[f.cityId].name} surrenders to your siege.` });
    });
    siegeLogs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push({ year: newYear, message: l.message, type: LogTypes.COMBAT }); });
    state = { ...state, regions: siegeRegions, units: siegeUnits, nations: siegeNations, pendingDefenses };
    state = syncWorldRegistry(state);
  }
  mark('sieges');

  // --- cities (plans/civ-map-rework.md C1, C2, B4): every city works its land, grows, builds and
  // extends its borders. Runs first so income reads this turn's yields (dev mirrors them) and
  // every later phase sees the new sizes and borders. Finished units are created here.
  const cityTurn = runCitiesPhase(state, newAge, newTurnNumber);
  state = cityTurn.state;
  cityTurn.logs.forEach((l) => logs.push({ year: newYear, message: l, type: LogTypes.ACTION }));
  mark('cities');

  // --- income ---
  const income = calcIncome({ ...state, nations: modifierExpiredNations });
  const resources = { ...createEmptyResourcePool(newAge), ...state.resources };
  Object.entries(income).forEach(([id, amount]) => { resources[id] = (resources[id] || 0) + amount; });
  logs.push({ year: newYear, message: `${Math.round(newYear)}: +${formatMoney(income.gold || 0)}`, type: LogTypes.ACTION });
  // Army supplies (src/engine/supplies.js): foraged and manufactured from metal, eaten on campaign.
  const supplyFlow = computeSupplyFlow({ regions: state.regions, units: state.units, nationId: state.playerNationId, ageId: getEffectiveAgeId(newAge, state.techAgeId), resources, turnNumber: state.turnNumber, tileOwner: state.world?.tileOwner });
  resources[supplyFlow.metalId] = (resources[supplyFlow.metalId] || 0) - supplyFlow.metalUsed;
  resources.supplies = supplyFlow.supplies;
  if (supplyFlow.hungry) logs.push({ year: newYear, message: `Out of supplies: your ${supplyFlow.campaigning} unit${supplyFlow.campaigning > 1 ? 's' : ''} on campaign go hungry (-${HUNGER_MORALE} morale, no reinforcement). Build Industry, stockpile metal or bring them home.`, type: LogTypes.CRISIS });
  mark('income');

  // Army/navy/fort upkeep, advisor salaries, and loan interest are all deducted together in the
  // "economy" phase below (plan §M11), once `regions`/`nations` exist — a shortfall there can
  // trigger an auto-loan or bankruptcy, both of which need to touch nation/region state that
  // doesn't exist yet this early in the turn.

  // ADM/DIP/MIL (plan §M2) each gain the nation's per-turn income every turn, and unspent power
  // BANKS up to the flat POWER_POOL_CAP (src/data/actionCosts.js) — saving up across turns is how a
  // 40-160 power tech, a 300-ADM government change or a 100+ ADM stability increase is ever paid for.
  // getPowerIncome (Administrative Capacity) is recomputed fresh from current government/tech
  // every turn rather than read from a stored field, so adopting a government or finishing a
  // Governance tech takes effect on the very next turn automatically. maxAdm/maxDip/maxMil keep
  // their old names for save compatibility but hold that per-turn INCOME (what the UI shows as
  // "+N/turn"), not a ceiling.
  const powerIncome = getPowerIncome({ ...state, nations: modifierExpiredNations });
  ['adm', 'dip', 'mil'].forEach((pool) => {
    const income = powerIncome[pool];
    // Reads `resources[pool]` (already `state.resources[pool]` at this point, or that PLUS
    // this turn's calcIncome addition — e.g. a Communications Satellite's dipPerTurn trickle —
    // never `state.resources[pool]` directly, or a satellite's contribution would be silently
    // overwritten by this bank-up step immediately after calcIncome applied it.
    resources[`max${pool[0].toUpperCase()}${pool.slice(1)}`] = income;
    resources[pool] = Math.min((resources[pool] || 0) + income, POWER_POOL_CAP);
  });
  mark('maintenanceAndPower');

  // --- unrest drift (every region, not just the player's — this is a generic mechanic every
  // nation's own territory is subject to) ---
  const regions = { ...state.regions };
  regionDraft = regions;
  const satellites = state.satellites || {};
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
      : getNationBonusTotal(owner, 'stabilityBonus') + (owner?.stability || 0) + ((owner?.legitimacy ?? 50) < 50 && owner?.ruler ? -1 : 0);
    stabilityCache.set(ownerId, value);
    return value;
  };
  const governView = { ...state, nations: modifierExpiredNations }; // one view for the governor lookups below
  Object.entries(regions).forEach(([id, region]) => {
    if (region.owner === null) return;
    const owner = modifierExpiredNations[region.owner];
    const taxUnrestDelta = TAX_RATES[owner?.taxRate]?.unrestDeltaPerTurn || 0;
    // Plan §M6: the Culture & Order building line's local.stabilityBonus shaves this region's own
    // unrest, on top of the nation-wide sources (government/policy/traits/stability/overextension).
    const stabilityBonus = nationalStabilityOf(region.owner, owner)
      + getSatelliteEffectTotal(satellites, region.owner, 'stabilityBonus', state.orbitalDebrisLevel)
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

    // Population (plan item 3): driven by the Food & Growth building tier, infrastructure,
    // government/policy/wonder popGrowthBonus and unrest — not automatic time-based growth. A
    // region actively under invasion this turn loses population instead of growing (src/engine/
    // population.js has the full breakdown).
    const modernBaseline = REGIONS_DATA[id]?.population || 0;
    // A devastated province (aftermath.js) grows more slowly while it recovers.
    const growthRate = getPopulationGrowthRate({
      foodTier: region.buildings?.categories?.food ?? -1,
      infrastructure: region.currentInfrastructure || 0,
      popGrowthBonus: getNationBonusTotal(owner, 'popGrowthBonus'),
      unrest
    }) - devastationGrowthPenalty(region);
    const devastation = decayDevastation(region.devastation);
    const currentPopulation = region.size != null
      ? sizeToPeople(region.size)
      : nextRegionPopulation({
        currentPopulation: region.currentPopulation || modernBaseline,
        modernBaseline,
        growthRate,
        underInvasion: region.underInvasion
      });

    if (unrest !== region.unrest || control !== region.control || (region.underInvasion && !stillUnderCooldown) || currentPopulation !== region.currentPopulation || devastation !== (region.devastation || 0)) {
      regions[id] = { ...region, ...(region.integratingUntil != null && newTurnNumber>=region.integratingUntil ? {integratingUntil:null}:{}), unrest, control, underInvasion: stillUnderCooldown ? region.underInvasion : false, currentPopulation, ...(region.devastation != null || devastation ? { devastation } : {}) };
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
  const revivedNations = {}; // eliminated nations a successful revolt handed land back to (see transferRegion)
  const rebelUnitIdByRegion = {};
  // Civil-war pretenders (isPretender) are owned by src/engine/civilWar.js, not by this unrest block —
  // letting this block see them made every pretender in a calm province "dissolve" the next turn.
  Object.values(units).forEach(u => { if (u.ownerId === REBEL_OWNER_ID && !u.isPretender) rebelUnitIdByRegion[u.regionId] = u.id; });
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
            message: `The uprising in ${REGIONS_DATA[regionId]?.name || regionId} succeeds — ${state.nations[reclaimedBy]?.name || reclaimedBy} reclaims it from ${state.nations[occupierId]?.name || occupierId}.`,
            type: LogTypes.CRISIS
          });
          if (transfer.revivedNation) {
            revivedNations[reclaimedBy] = transfer.revivedNation;
            logs.push({ year: newYear, message: `${transfer.revivedNation.name} rises again!`, type: LogTypes.MILESTONE });
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

  // --- supply (plans/civ-map-rework.md D3, supplyMeter.js): every land unit's meter moves by the
  // land it stands on; at 0 it starves. The player's national.attrition modifier scales the
  // losses (AI nations do not track a techTree until AI parity, and the 240-nation getModifier
  // scan would cost a turn budget for a value that is 0 for all of them); the supply line reach
  // grows with the player's national.supplyRange.
  const playerAttritionMult = Math.max(0, 1 + getModifier(state, state.playerNationId, 'national.attrition').total);
  const playerLineRings = SUPPLY_LINE_RINGS + Math.max(0, Math.round(getModifier(state, state.playerNationId, 'national.supplyRange').total));
  const hungryNations = new Set();
  if (supplyFlow.hungry) hungryNations.add(state.playerNationId);
  const meter = applySupplyMeter(state, units, {
    hungryFor: (nid) => hungryNations.has(nid),
    attritionMultFor: (nid) => (nid === state.playerNationId ? playerAttritionMult : 1),
    lineRingsFor: (nid) => (nid === state.playerNationId ? playerLineRings : SUPPLY_LINE_RINGS)
  });
  const starvingOwn = meter.starving.get(state.playerNationId) || 0;
  const deadOwn = meter.dead.get(state.playerNationId) || 0;
  if (starvingOwn || deadOwn) logs.push({ year: newYear, message: `Out of supply: ${starvingOwn ? `${starvingOwn} of your unit${starvingOwn > 1 ? 's' : ''} starve${starvingOwn > 1 ? '' : 's'} in the field` : ''}${starvingOwn && deadOwn ? ' and ' : ''}${deadOwn ? `${deadOwn} unit${deadOwn > 1 ? 's' : ''} melted away` : ''}. Bring them home or hold a city near them.`, type: LogTypes.CRISIS });
  // --- loyalty and culture (plans/civ-map-rework.md C5, loyalty.js): culture pressure drifts every
  // city's shares, loyalty follows the owner's share, garrison and amenities; at 0 a city goes over
  // to the nation pressing it most, or stands free.
  {
    const loyal = applyLoyalty(state, regions, units, modifierExpiredNations, newTurnNumber);
    loyal.logs.forEach((l) => { if (l.nationId === state.playerNationId) logs.push({ year: newYear, message: l.message, type: LogTypes.CRISIS }); });
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
  const playerOutOfOil = getEffectiveAgeId(newAge, state.techAgeId) === 'modern' && (resources.oil ?? 0) <= 0;
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
    if (!isPlayer && !ownerSupplyFlows.has(u.ownerId)) ownerSupplyFlows.set(u.ownerId,computeSupplyFlow({regions:state.regions,units:state.units,nationId:u.ownerId,ageId:getEffectiveAgeId(newAge,nation.tech?.ageId),resources:ownerPool,tileOwner:state.world?.tileOwner,ownedUnits:unitsByOwnerAtStart.get(u.ownerId) || []}));
    const ownerSupply = isPlayer ? supplyFlow : ownerSupplyFlows.get(u.ownerId);
    // A starving unit (supply meter at 0, supplyMeter.js) recovers nothing either.
    const hungry = (ownerSupply.hungry && isCampaigning(u, regions, state.world?.tileOwner)) || (u.supply != null && u.supply <= 0);
    if (hungry) patch = { morale: Math.max(0, (u.morale ?? 100) - HUNGER_MORALE) };

    if (!hungry && !foughtThisTurn && u.morale < 100) {
      patch = { ...patch, morale: Math.min(100, u.morale + Math.round(MORALE_RECOVERY_PER_TURN * (1 + moraleRecoveryBonus) * maintenanceFactor)) };
    }

    const region = regions[u.regionId];
    const isSuppliedHomeTerritory = region && region.owner === u.ownerId && !region.occupiedBy;
    if (!hungry && !foughtThisTurn && isSuppliedHomeTerritory && u.strength < u.maxStrength) {
      const cadreMult = hasPerk(u, 'cadre') ? 2 : 1;
      const gain = Math.min(Math.floor((ownerPool.hr || 0) * 10), u.maxStrength - u.strength, Math.round(u.maxStrength * REINFORCEMENT_RATE * (1 + reinforceSpeedBonus) * maintenanceFactor * cadreMult));
      if (gain > 0) {
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
    const outOfOil = isPlayer ? playerOutOfOil : getEffectiveAgeId(newAge, nation.tech?.ageId) === 'modern' && (nation.economy?.oil || 0) <= 0;
    const grounded = outOfOil && FUEL_BURNING_CLASSES.has(u.classId);
    if (grounded && isPlayer) groundedCount += 1;
    const movesLeft = grounded ? 0 : 1 + (hasPerk(u, 'forcedMarch') ? 1 : 0);
    units[u.id] = { ...u, ...patch, movesLeft };
  });
  if (groundedCount) logs.push({ year: newYear, message: `No oil: ${groundedCount} of your mechanised unit${groundedCount > 1 ? 's are' : ' is'} out of fuel and cannot move this turn. Build Oil Wells or trade for oil.`, type: LogTypes.CRISIS });
  mark('reinforcementAndMorale');

  // --- AI nations: passive growth + hostility drift ---
  const aiUpdates = processAllAINations(state, newYear, rng);
  const nations = { ...modifierExpiredNations, ...revivedNations };
  const opinionView = { ...state, nations: modifierExpiredNations }; // one view for the loop: a fresh spread per nation would rebuild the modifier sheets 240 times
  Object.entries(nations).forEach(([nId, nation]) => {
    if (nation.isPlayer || nation.isEliminated) return;
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

  // --- AI economy (plan §M16) --- real gold/hr/techPoints/adm/dip/mil income credits every non-
  // player nation's own economy pool EVERY turn (calcAllNationIncomes is one O(regions) pass, cheap
  // enough to run unconditionally for all 240 nations — the same "one shared pass" perf pattern
  // buildOccupationIndexes/calcAllNationIncomes-style functions already use elsewhere in this
  // codebase). Spending it — adopt/reform a government, construct a building, or research a tech —
  // only happens on each nation's own tiered cadence (aiEconomy.js's thinksThisTurn: Tier 1 every
  // turn, Tier 2 every 3, Tier 3 every 10), which is what keeps this affordable at 240 nations.
  // Recruitment stays a separate pass below (processAIRecruitment, Tier 1 only, unchanged cadence)
  // now drawing on this same real economy once it exists — see aiEconomy.js's own header for the
  // full list of what's deliberately NOT part of this milestone (laws, estates, identity, advisors,
  // diplomat tasks, AI loans/bankruptcy).
  // ONE shared state snapshot for this whole phase — critically, the SAME object reference for
  // every nation's calcAllNationIncomes/getPowerIncome/getNationTier/processAIEconomyTurn call.
  // The modifier engine (src/engine/modifiers/sheet.js) caches a nation's sheet per (state
  // reference, nationId) pair; a fresh `{ ...state, ... }` literal built INSIDE this loop, once per
  // nation, would defeat that cache entirely (each nation's sheet — including its own O(regions)
  // overextension scan — rebuilt from scratch 2-3x every turn instead of once), which is exactly
  // the "per-nation state spread" trap buildOccupationIndexes/estatesState elsewhere in this same
  // file are already careful to avoid. `regions`/`nations` are passed by REFERENCE, not spread, so
  // this snapshot stays valid even as later lines in this same loop mutate their properties.
  const aiEconState = { ...state, regions, nations };
  const allIncomes = calcAllNationIncomes(aiEconState);
  const tieringSortedByMilitary = getSortedByMilitary(aiEconState);
  // Units grouped by owner once; a nation's own desertion below only drops its own, already settled, units.
  const unitsByOwnerNow = unitsByOwner(units);
  const upkeepState = { ...aiEconState, units, turnNumber: newTurnNumber };
  Object.keys(nations).forEach((nId) => {
    if (nId === state.playerNationId) return;
    const nation = nations[nId];
    if (nation.isEliminated) return;
    if (!nation.economy) return; // a legacy/test fixture with no seeded economy stays on the old abstract-only path
    const income = allIncomes[nId] || { gold: 0, hr: 0, techPoints: 0 };
    const powerIncome = getPowerIncome(aiEconState, nId);
    const pool = { ...nation.economy };
    pool.gold += income.gold;
    pool.hr += income.hr;
    pool.techPoints += income.techPoints;
    const ownedUnits = unitsByOwnerNow.get(nId) || [];
    const aiSupply = computeSupplyFlow({regions,units,nationId:nId,ageId:getEffectiveAgeId(newAge,nation.tech?.ageId),resources:pool,tileOwner:state.world?.tileOwner,ownedUnits});
    pool.supplies=aiSupply.supplies;
    pool[aiSupply.metalId]=(pool[aiSupply.metalId] || 0)-aiSupply.metalUsed;
    ['copper', 'iron', 'oil', 'rareMetals', 'helium3'].forEach(key => { pool[key] = (pool[key] || 0) + (income[key] || 0); });
    // Same flat POWER_POOL_CAP bank the player's own pools use (the maintenanceAndPower phase
    // above) — the old 2x-income cap here kept every AI pool below the cheapest tech's 40 power,
    // so no AI nation ever researched anything.
    ['adm', 'dip', 'mil'].forEach((p) => { pool[p] = Math.min((pool[p] || 0) + powerIncome[p], POWER_POOL_CAP); });
    nations[nId] = { ...nation, economy: pool };
    nations[nId] = settleAIUpkeep(upkeepState, nId, income, ownedUnits);
    if (nations[nId].lastBankruptcyTurn === newTurnNumber) applyArmyDesertion(units, nId);

    const tier = getNationTier(aiEconState, nId, tieringSortedByMilitary) || 3;
    if (!thinksThisTurn(nId, tier, newTurnNumber)) return;
    const result = processAIEconomyTurn(aiEconState, regions, nId);
    nations[nId] = result.nation;
  });
  mark('aiEconomy');

  // --- succession (plan §M3) --- runs for every nation (cheap: a number comparison for the vast
  // majority whose reign isn't ending this turn), but only the player's own succession is logged —
  // 240 nations' worth of log lines every few turns would drown out everything else in the console.
  // AI nations still get a real ruler/heir update even though nothing reads an AI ruler's stats
  // mechanically yet (M16), so this doesn't need touching again once AI parity lands.
  // Governors (governors.js): the player's court offers fresh candidates every GOVERNOR_REFRESH_TURNS
  // turns, and a governor whose seat was lost leaves.
  {
    const me = state.playerNationId;
    const view = { ...state, regions, nations };
    Object.keys(nations).forEach((nId) => { const pruned = pruneGovernors(view, nations[nId]); if (pruned !== nations[nId]) nations[nId] = pruned; });
    if (nations[me] && (newTurnNumber % GOVERNOR_REFRESH_TURNS === 1 || !nations[me].governorCandidates)) {
      nations[me] = { ...nations[me], governorCandidates: generateGovernorCandidates(me, `${state.rngSeed}|${newTurnNumber}`) };
    }
  }
  Object.entries(nations).forEach(([nId, nation]) => {
    const result = processSuccession(nation, rng, { turnNumber: newTurnNumber, age: newAge, gameSpeed: state.gameSpeed, bornHeirsOnly: nId === state.playerNationId });
    if (!result) return;
    // Plan §M4: "heirless succession: -1 stability" is the one lower-stability trigger from the
    // plan's own table that's mechanically real today — a heirless OR low-claim succession is
    // exactly M3's `result.crisis` flag, so this reuses it rather than inventing a parallel check.
    const stability = result.crisis ? clampStability((nation.stability || 0) - 1) : nation.stability;
    // Plan §M8.1: Elective Monarchy's "-10 legitimacy at succession" (result.legitimacyPenalty).
    const legitimacy = result.legitimacyPenalty ? clampLegitimacy((nation.legitimacy ?? 50) - result.legitimacyPenalty) : nation.legitimacy;
    // Plan §M18's "Dynasty" achievement ("the same dynasty for 10 rulers"): a real consecutive-
    // succession counter, reset the instant the ruling house actually changes (an elective/
    // theocratic/autocratic/tribal succession, or a hereditary line that just failed, both roll a
    // brand-new dynasty name per succession.js's own nextDynasty logic).
    const sameDynastyStreak = result.ruler.dynasty === nation.ruler?.dynasty ? (nation.sameDynastyStreak || 0) + 1 : 1;
    nations[nId] = { ...nation, ruler: result.ruler, heir: result.heir, stability, legitimacy, sameDynastyStreak };
    if (nId === state.playerNationId) {
      const message = result.crisis
        ? `${result.ruler.name} of House ${result.ruler.dynasty} succeeds to the throne amid an uncertain succession. (-1 stability)`
        : `${result.ruler.name} of House ${result.ruler.dynasty} succeeds to the throne.`;
      logs.push({ year: newYear, message, type: LogTypes.MILESTONE });
    }
    // Civil war trigger #1 (plan §M3/§M15): "a heirless OR low-claim succession fires the Succession
    // Crisis chain... a pretender rebel spawns with 40% chance" — the plan named this chance back in
    // M3 but nothing existed yet to spawn into (civil war IS that "pretender rebel" substrate, so
    // this is where the M3 comment's own deferred 40% roll is finally wired, not a new mechanic).
    if (result.crisis && !nation.civilWar?.active && rng.next() < CIVIL_WAR_SUCCESSION_CRISIS_CHANCE) {
      const started = startCivilWar(regions, units, nId, getFieldedStrength({ units }, nId), rng, newTurnNumber);
      if (started) {
        Object.assign(regions, started.regions);
        Object.assign(units, started.units);
        nations[nId] = { ...nations[nId], civilWar: started.civilWar };
        logs.push({ year: newYear, message: `${nations[nId].name}: the succession crisis erupts into open civil war!`, type: LogTypes.CRISIS });
      }
    }
  });
  // The player's royal family: a married monarch without an heir may have one this turn.
  const playerForBirth = nations[state.playerNationId];
  const newborn = playerForBirth ? processRoyalBirth(playerForBirth, rng, newTurnNumber) : null;
  if (newborn) {
    nations[state.playerNationId] = { ...playerForBirth, heir: newborn };
    logs.push({ year: newYear, message: `An heir is born to ${playerForBirth.ruler.name} and ${playerForBirth.ruler.consort.name}: ${newborn.name} of House ${newborn.dynasty} (claim ${newborn.claim}).`, type: LogTypes.MILESTONE });
  }
  mark('succession');

  // --- national power: stability decay, legitimacy/tradition/devotion, prestige (plan §M4) ---
  // runs for every nation, same cadence and reasoning as the succession pass just above (cheap,
  // AI nations get real numbers even though nothing reads them mechanically until M16 wires AI
  // decisions off of them).
  Object.entries(nations).forEach(([nId, nation]) => {
    const result = processNationalPowerTurn(nation);
    // Plan §M18's "Iron Grip" achievement ("+3 stability for 20 turns"): a real sustained-streak
    // counter, the same shape diplomaticLeadershipStreak already uses for Diplomatic Victory —
    // reset to 0 the instant stability drops off the max, so a fresh run of turns is required.
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
  if (nations[state.playerNationId].capitalOccupied) {
    resources.adm = Math.max(0, (resources.adm || 0) - CAPITAL_OCCUPIED_POOL_PENALTY);
    resources.dip = Math.max(0, (resources.dip || 0) - CAPITAL_OCCUPIED_POOL_PENALTY);
    resources.mil = Math.max(0, (resources.mil || 0) - CAPITAL_OCCUPIED_POOL_PENALTY);
  }
  mark('capitals');

  // --- estates (plan §M9) --- loyalty drifts 1/turn toward its reform/law/trait/privilege-driven
  // target, influence is recomputed (real for the player, a cheap privilege-only proxy for AI — see
  // estates.js's getEstateInfluence). Labor joins once a nation reaches the Modern age, matching the
  // plan's own gating; earlier ages never see the fourth estate at all.
  const estatesState = { ...state, nations, regions };
  Object.entries(nations).forEach(([nId, nation]) => {
    let estates = processEstatesTurn(estatesState, nId);
    if (newAge === 'modern' && estates && !estates[LABOR_ESTATE_ID]) {
      estates = { ...estates, [LABOR_ESTATE_ID]: createInitialEstate() };
    }
    if (estates && estates !== nation.estates) nations[nId] = { ...nation, estates };
  });
  mark('estates');

  // --- disasters & civil war (plan §M15) --- runs for every nation, the same "real for player and
  // AI both" cadence as stability/estates/succession above. Disasters read only fields every nation
  // already tracks for real; a nation already fighting a civil war skips straight to
  // processCivilWarTurn instead of re-checking triggers (declareWar's own one-active-thing-at-a-time
  // spirit, applied here even though this isn't a state.wars entry — see civilWar.js's own header on
  // why not).
  Object.entries(nations).forEach(([nId, nation]) => {
    const { nation: afterDisasters, triggersCivilWar, logs: disasterLogs } = processDisastersTurn(nation, newAge, newTurnNumber);
    if (nId === state.playerNationId) logs.push(...disasterLogs.map((l) => ({ year: newYear, ...l })));
    nations[nId] = afterDisasters;

    if (nation.civilWar?.active) {
      const result = processCivilWarTurn({ ...state, age: newAge }, regions, units, nations[nId], nId, rng, newTurnNumber);
      Object.assign(regions, result.regions);
      // Object.assign alone can only ADD/replace keys — pretender stacks the civil war removed
      // (suppressed by an AI, or cleared when the pretenders win) must be deleted explicitly too.
      Object.keys(units).forEach((id) => { if (units[id].isPretender && !result.units[id]) delete units[id]; });
      Object.assign(units, result.units);
      nations[nId] = result.nation;
      if (result.result === 'crushed') {
        logs.push({ year: newYear, message: `${nations[nId].name} crushes the pretender uprising. (+1 stability, +10 legitimacy)`, type: LogTypes.CRISIS });
      } else if (result.result === 'lost') {
        logs.push({ year: newYear, message: `${nations[nId].name} falls to the pretenders — a new regime takes power.`, type: LogTypes.CRISIS });
      }
      return;
    }

    const lowStabilityStreak = nextLowStabilityStreak(nations[nId], authorityRisksCivilWar({ ...state, regions, nations }, nId));
    const shouldStart = triggersCivilWar || isStabilityCivilWarTrigger(lowStabilityStreak);
    if (shouldStart) {
      const started = startCivilWar(regions, units, nId, getFieldedStrength({ units }, nId), rng, newTurnNumber);
      if (started) {
        Object.assign(regions, started.regions);
        Object.assign(units, started.units);
        nations[nId] = { ...nations[nId], civilWar: started.civilWar, lowStabilityStreak: 0 };
        logs.push({ year: newYear, message: `${nations[nId].name} descends into civil war!`, type: LogTypes.CRISIS });
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
    const armyMaintenanceMult = clampMaintenance(nation.armyMaintenance ?? ARMY_MAINTENANCE_DEFAULT) / 100;
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
    const advisors = Object.values(nation.advisors || {}).filter(Boolean);
    const advisorSalaryCost = advisors.reduce((sum, a) => sum + getAdvisorSalary(a.level), 0);
    const loanInterestCost = (nation.loans || []).reduce((sum, loan) => sum + Math.round(loan.principal * loan.interestRate), 0);
    // Marching armies (routes.js) cost a quarter more upkeep the turn they march.
    const marchingUpkeep = marchUpkeep(units, playerId, state.turnNumber, UNIT_UPKEEP_GOLD_PER_TURN * armyMaintenanceMult);
    const totalExpenses = armyUpkeep + marchingUpkeep + navyUpkeep + fortUpkeep + advisorSalaryCost + loanInterestCost;

    if (totalExpenses > 0) {
      logs.push({
        year: newYear,
        message: `Upkeep: -${formatMoney(totalExpenses)} (army ${formatMoney(armyUpkeep)}${marchingUpkeep ? `, marching ${formatMoney(marchingUpkeep)}` : ''}, navy ${formatMoney(navyUpkeep)}, forts ${formatMoney(fortUpkeep)}, advisors ${formatMoney(advisorSalaryCost)}, loan interest ${formatMoney(loanInterestCost)})`,
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
      if (deserted > 0) logs.push({ year: newYear, message: `Unpaid, ${Math.round(deserted * 10).toLocaleString()} soldiers desert your army (-${Math.round(DESERTION_SHARE * 100)}% strength, -${DESERTION_MORALE} morale in every unit).`, type: LogTypes.CRISIS });
      logs.push({
        year: newYear,
        message: disasterBankruptcyReady && rawGold >= 0
          ? 'Economic Collapse! Years of mounting debt force bankruptcy outright. (-2 stability on top of the usual bankruptcy penalties)'
          : 'Bankruptcy! The treasury is empty and no further loans can be taken. (-3 stability, -20 prestige, every estate -20 loyalty, a 10-turn economic crisis)',
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
      logs.push({ year: newYear, message: `Treasury shortfall — auto-took a loan of ${formatMoney(principal)} gold.`, type: LogTypes.CRISIS });
    } else {
      resources.gold = rawGold;
      nations[playerId] = { ...nations[playerId], disasters: { ...nations[playerId].disasters, economicCollapse: economicCollapseProgress } };
    }

    // Fusion Grid (plan §M11 resource sink): upkeep is deducted every turn while active; going
    // unpaid takes it offline (sources.js's contextSources only reads this flag for the goldMult
    // bonus) — the same "disabled when upkeep can't be paid" behavior the plan's own Future-
    // building resource sinks describe, applied to this standalone action instead (see
    // types.js's ACTIVATE_FUSION_GRID comment on why no Future building tier exists to hang it on).
    if (nations[playerId].fusionGridActive) {
      if ((resources.helium3 || 0) >= FUSION_GRID_UPKEEP_HELIUM3_PER_TURN) {
        resources.helium3 -= FUSION_GRID_UPKEEP_HELIUM3_PER_TURN;
      } else {
        nations[playerId] = { ...nations[playerId], fusionGridActive: false };
        logs.push({ year: newYear, message: 'The Fusion Grid has gone offline — insufficient Helium-3.', type: LogTypes.CRISIS });
      }
    }
  }
  mark('economy');

  // --- diplomacy (plan §M12): Aggressive Expansion decay (every nation), diplomat tasks and
  // vassal tribute (player-only, matching every other player-only economic action this turn). ---
  Object.assign(nations, decayAggressiveExpansion(nations));
  // Claims on cities (claims.js): the ones being fabricated complete, the ones on cities now owned drop.
  advanceClaims(nations, regions, newTurnNumber).forEach((l) => { if (l.nationId === state.playerNationId) logs.push({ year: newYear, message: l.message, type: LogTypes.DIPLOMACY }); });
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
      logs.push({ year: newYear, message: `Vassal tribute: +${formatMoney(vassalTribute)}.`, type: LogTypes.ACTION });
    }
  }

  // Liberty desire (plan §M12/§M15: "rises with your weakness and their strength... at >= 50 they
  // may declare an independence war") — generic for every vassal, player or AI, the same real-
  // fielded-strength comparison civil war's own pretender sizing uses rather than the abstract
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
  mark('diplomacy');

  // --- great projects (plan §M10) --- construction is player-only for now, matching every other
  // AI-economic-action deferral since M8 (government reforms, laws, estates — AI never acts, only
  // the player does), so only player-owned regions ever carry a `greatProjectConstruction` in the
  // first place. A region captured mid-construction loses its queued project outright (there's no
  // partial-credit hand-off to a new owner) rather than silently freezing forever.
  const greatProjects = { ...state.greatProjects };
  Object.keys(regions).forEach((regionId) => {
    const region = regions[regionId];
    const construction = region.greatProjectConstruction;
    if (!construction) return;
    if (region.owner !== state.playerNationId) {
      regions[regionId] = { ...region, greatProjectConstruction: null };
      return;
    }
    const turnsLeft = construction.turnsLeft - 1;
    if (turnsLeft > 0) {
      regions[regionId] = { ...region, greatProjectConstruction: { ...construction, turnsLeft } };
      return;
    }
    const project = GREAT_PROJECTS[construction.projectId];
    const tierSpec = project?.tiers[construction.tier - 1];
    regions[regionId] = { ...region, greatProjectConstruction: null };
    greatProjects[construction.projectId] = { regionId, tier: construction.tier };
    if (tierSpec?.completionPrestige) {
      const nation = nations[state.playerNationId];
      nations[state.playerNationId] = { ...nation, prestige: clampPrestige((nation.prestige || 0) + tierSpec.completionPrestige) };
    }
    logs.push({
      year: newYear,
      message: `${project.name} (tier ${construction.tier}) completed!${tierSpec?.completionPrestige ? ` (+${tierSpec.completionPrestige} prestige)` : ''}`,
      type: LogTypes.MILESTONE
    });
  });
  mark('greatProjects');

  // sortedByMilitary is computed once here, not per nation, to keep both of the following passes
  // affordable across 240 nations.
  const sortedByMilitary = getSortedByMilitary({ ...state, nations });

  // --- AI recruitment (plan §8.5's counter-building, Task 36): Tier 1 nations turn some of their
  // abstract militaryStrength growth into real, counterable units in state.units — recruiting
  // whatever class beats their most relevant rival's dominant class. Uses the calendar age, not a
  // per-nation tech age (AI nations don't track one independently). ---
  const recruitment = processAIRecruitment({ ...state, nations, regions, units }, units, nations, regions, sortedByMilitary, newAge, rng);
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
  const warDecisions = processAIWarDecisions({ ...state, nations, regions, units }, nations, state.wars, sortedByMilitary, rng);
  let nationsAfterWars = warDecisions.nations;
  let wars = warDecisions.wars;
  logs.push(...warDecisions.logs.map(l => ({ year: newYear, ...l })));
  mark('aiWarDeclarations');

  // --- AI ABM defense (plan §M19: "AI builds ABM to level 1-2 when at war with a nuclear power") ---
  const abmResult = processAIAbmDefense({ ...state, wars }, nationsAfterWars);
  nationsAfterWars = abmResult.nations;
  logs.push(...abmResult.logs.map(l => ({ year: newYear, ...l })));
  mark('aiAbmDefense');

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
  const eliminationWarParticipants = new Set();
  Object.keys(nationsAfterWars).forEach((nId) => {
    const eliminated = checkNationElimination(nationsAfterWars, regions, nId);
    if (!eliminated) return;
    nationsAfterWars = unlinkEliminatedVassalage({ ...nationsAfterWars, [nId]: eliminated }, nId, nationsAfterWars[nId].vassalOf);
    wars.forEach(w => {
      if (w.aggressor === nId || w.enemy === nId) {
        eliminationWarParticipants.add(w.aggressor);
        eliminationWarParticipants.add(w.enemy);
      }
    });
    wars = closeWarsForEliminatedNation(wars, nId);
    logs.push({ year: newYear, message: `${eliminated.name} has been eliminated — no territory remains under its control.`, type: LogTypes.MILESTONE });
    // Rivals (plan §M12): "+10% prestige gain/turn" has no substrate (nationalPower.js's prestige
    // is pure decay outside one-shot sources) — this is the one real payoff instead, a one-shot
    // reward when a designated rival goes down for good.
    if ((nationsAfterWars[state.playerNationId]?.rivals || []).includes(nId)) {
      const player = nationsAfterWars[state.playerNationId];
      nationsAfterWars = { ...nationsAfterWars, [state.playerNationId]: { ...player, prestige: clampPrestige((player.prestige || 0) + RIVAL_ELIMINATED_PRESTIGE_REWARD) } };
      logs.push({ year: newYear, message: `Your rival ${eliminated.name} has fallen. (+${RIVAL_ELIMINATED_PRESTIGE_REWARD} prestige)`, type: LogTypes.DIPLOMACY });
    }
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
  // Elimination also closes wars; surviving opponents must stop paying war exhaustion.
  nationsAfterWars = refreshWarFlags(nationsAfterWars, wars, [...eliminationWarParticipants]);
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
    world: state.world,
    year: newYear,
    age: newAge,
    turnNumber: newTurnNumber,
    resources,
    regions,
    nations: nationsAfterWars,
    greatProjects,
    units,
    wars,
    pendingPeaceOffer,
    // Assaults on the player's garrisons (src/engine/defense.js), fought before the next turn —
    // dropped if their war ended this same turn.
    nextUnitSeq: operations.nextUnitSeq,
    aiOperations: operations.aiOperations,
    pendingDefenses: [...operations.pendingDefenses, ...(warProgress.pendingDefenses || [])].filter((d) => wars.some((w) => w.id === d.warId && w.active)),
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
    nextLoanSeq,
    rngSeed: rng.getSeed(),
    logs: [...state.logs, ...logs]
  };
  // Players who opted to auto-resolve enemy assaults are never interrupted: fought right away.
  if (next.pendingDefenses.length && state.battleSettings?.autoDefend === true) next = resolveAllDefensesAuto(next);
  mark('assembleNextState');

  // --- defeat (plan §M15, checked against THIS turn's resolved state) --- "GameStatus.DEFEAT is set
  // when the player owns 0 regions: annexed by a peace deal, or all regions lost to rebels or
  // revolts." Checked BEFORE victory and under the same not-mid-event gating: a player just ceded
  // down to nothing can't also "survive" the same turn, and a defeat should never land mid-event.
  // elimination.js's checkNationElimination stays player-exempt (it flags an AI nation's RECORD dead;
  // the player's own record keeps playing out its defeat/game-over screen instead) — this is the
  // real player-losing condition elimination.js never had before this milestone.
  if (next.gameStatus === GameStatus.ACTIVE && !next.activeEventId && !next.activeProceduralEvent && !next.pendingPeaceOffer && checkPlayerDefeat(next.regions, next.playerNationId)) {
    next = { ...next, gameStatus: GameStatus.DEFEAT };
    next.logs = [...next.logs, { year: newYear, message: 'DEFEAT: your nation has fallen — no territory remains under your control.', type: LogTypes.MILESTONE }];
  }
  mark('defeat');

  // --- victory (checked against THIS turn's resolved state, not last turn's) ---
  // Not checked while an event is actively pending, so a victory never lands mid-event-resolution.
  // Plan §M18: "Remove the free win... at END_YEAR the game ends with a Final Score screen ranking
  // the player against the top 10 nations... 'Victory' if the player ranks #1; otherwise 'Game
  // Complete — Rank N'." An ambition (domination/conqueror/economicHegemony/diplomatic/
  // spaceAscendancy) can still win outright at ANY year — only reaching the calendar's own end
  // with no ambition met routes through this ranked step instead of an automatic win.
  if (next.gameStatus === GameStatus.ACTIVE && !next.activeEventId && !next.activeProceduralEvent && !next.pendingPeaceOffer) {
    const conditionId = checkVictoryConditions(next);
    if (conditionId) {
      const condition = VICTORY_CONDITIONS[conditionId];
      next = applyVictory(next, conditionId);
      next.logs = [...next.logs, { year: newYear, message: `VICTORY: ${condition.name} achieved!`, type: LogTypes.MILESTONE }];
    } else if (next.year >= END_YEAR) {
      const rank = getPlayerRank(next);
      if (rank === 1) {
        next = applyVictory(next, 'finalScore');
        next.logs = [...next.logs, { year: newYear, message: 'VICTORY: Score Victory achieved — your nation leads the world!', type: LogTypes.MILESTONE }];
      } else {
        next = { ...next, gameStatus: GameStatus.COMPLETE, finalRank: rank };
        next.logs = [...next.logs, { year: newYear, message: `GAME COMPLETE: your nation finishes ranked #${rank} in the world.`, type: LogTypes.MILESTONE }];
      }
    }
  }
  mark('victory');

  // Research last, once this turn's science has been credited (src/engine/research.js).
  return normalizeUnitTiles(syncWorldRegistry(applyResearchTurn(reconcileTerritory(processColonies(processEmergence(next))))));
};
