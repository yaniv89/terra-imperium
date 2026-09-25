// src/engine/aiEconomy.js
// Plan §M16: AI parity. Gives AI nations a real, spendable economy — gold/hr/techPoints/adm/dip/mil
// on their own `nation.economy` (src/engine/nationState.js's own long-scaffolded accessor layer,
// built in M0.2 and unused in production until this milestone) — and a decision cadence, so every
// one of the 240 nations gets a real turn's income and, on its own schedule, a real spending
// decision (adopt/reform its government, construct a building, or research a tech — recruitment is
// the existing, now-upgraded, processAIRecruitment pass in aiLogic.js) instead of only ever growing
// an abstract militaryStrength number.
//
// Scope trims (documented once, here, rather than at each item):
// - Laws, estate privilege grants/interactions, national identity shifts, advisor hiring, and
//   diplomat task assignment get NO AI decision here. Every nation still carries these fields
//   generically (laws default, estates track real loyalty/influence already since M9), but only the
//   player acts on them — the same "generic reader, player-only writer" pattern M8/M9/M12 already
//   established, just narrower than before this milestone rather than eliminated by it.
// - Loans/bankruptcy stay player-only. An AI nation whose upkeep exceeds its income simply can't pay
//   the shortfall beyond what it has (gold floors at 0 — no loan, no bankruptcy penalty): a real,
//   visible consequence (a cash-strapped AI builds/recruits less) without the more dramatic modifier/
//   prestige/estate-loyalty machinery that makes far more sense as a player-facing crisis than a
//   background simulation detail for up to 240 nations every turn.
// - AI doesn't track copper/iron/oil — recruitment (aiLogic.js) and buildings never gate on a
//   strategic resource for AI, only gold/manpower/power, unlike the player's own
//   RECRUIT_STRATEGIC_RESOURCE_BY_AGE penalty/discount.
// - Satellites and space missions are player-exclusive systems (no AI participation until M19); the
//   income pass below deliberately leaves them out rather than half-wiring a system AI can't use yet.
// - Exactly ONE spending decision happens per "think" (government, then a building, then a tech, in
//   that priority order), not the plan's own "up to 1 + floor(period/2) actions" — a bounded, simpler
//   model that still turns a nation's accumulated treasury into one real, visible decision instead
//   of none. Gold/manpower/techPoints/power themselves accrue EVERY turn regardless of whether a
//   nation "thinks" that turn (the same continuous accrual the player's own resources use), so a
//   nation that thinks less often simply arrives with more banked up, not less spending power.
import { UNIT_UPKEEP_GOLD_PER_TURN, ACTION_COSTS } from '../data/actionCosts';
import { getFieldedStrength, getUnitCount } from '../utils/helpers';
import { getResearched, getTechAgeId } from './nationState';
import { getModifier, getRegionModifier } from './modifiers/sheet';
import { getPopFactor, seedDevelopment, getTotalDev } from './development';
import { REGIONS_DATA, getOwnedRegionIds } from '../data/regions';
import {
  BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getBuildingTierCost, getBuildingSlots, getUsedBuildingSlots
} from '../data/buildings';
import {
  TECH_TREE, canResearchTech, getTechPowerCost, getTechsForAge, TECH_AGE_ADVANCEMENT_THRESHOLD
} from '../data/techTree';
import { TECH_RESEARCH_POOL } from '../data/actionCosts';
import { AGE_ORDER, getAgesBehind, getAgesBehindResearchCostMultiplier } from '../data/ages';
import { getAvailableGovernmentTypes, getReformChoices, resetReformsForType } from '../data/government';
import { DOCTRINE_BUILDING_PRIORITY, DOCTRINE_TECH_CATEGORY_PRIORITY } from '../data/nations';

// Plan §C: "a nation thinks when (turn + fnv1a(nationId)) % period === 0" — Tier 1 every turn,
// Tier 2 every 3, Tier 3 every 10, spread across turns by a hash of the nation's own id rather than
// every nation of a tier landing on the same turn.
export const AI_THINK_PERIOD = { 1: 1, 2: 3, 3: 10 };
const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
export const thinksThisTurn = (nationId, tier, turnNumber) => {
  const period = AI_THINK_PERIOD[tier] || AI_THINK_PERIOD[3];
  return (turnNumber + fnv1a(nationId)) % period === 0;
};

// Plan §M16: "getSortedByMilitary uses getFieldedStrength plus the garrison value." militaryStrength
// stops being decision-making's source of truth once a nation has real recruited units to weigh
// instead — it still exists, still grows every turn (aiLogic.js's own passive formula), and still
// feeds this as a damped "reserve/latent" component for a nation that hasn't recruited much yet.
const GARRISON_STRENGTH_WEIGHT = 0.1;
export const getEffectiveMilitaryPower = (state, nationId) =>
  getFieldedStrength(state, nationId) + (state.nations[nationId]?.militaryStrength || 0) * GARRISON_STRENGTH_WEIGHT;

const emptyAIPool = () => ({ gold: 0, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 });

// One O(regions) pass computing real {gold, hr, techPoints} income for every non-player nation that
// owns at least one region — the player keeps calcIncome (helpers.js) unchanged; this is a separate,
// AI-only function rather than a generalization of it, so the player's own extensively-tested income
// path is never at risk of a regression from this milestone. Building/government/law/identity
// modifier sources (src/engine/modifiers/) already read generically for any nationId, so those are
// included via the SAME getRegionModifier/getModifier calls calcIncome itself uses.
export const calcAllNationIncomes = (state) => {
  const incomes = {};
  Object.values(state.regions).forEach((region) => {
    if (!region.owner || region.owner === state.playerNationId || region.occupiedBy) return;
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;
    const dev = region.dev || seedDevelopment(region.id);
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    const popFactor = getPopFactor(region, regData);
    const localTax = getRegionModifier(state, region.id, 'local.taxIncome').total;
    const localProduction = getRegionModifier(state, region.id, 'local.productionIncome').total;
    const localManpower = getRegionModifier(state, region.id, 'local.manpower').total;
    const localTechPoints = getRegionModifier(state, region.id, 'local.techPoints').total;
    const entry = incomes[region.owner] || { gold: 0, hr: 0, techPoints: 0 };
    entry.gold += (dev.tax * (1 + localTax) + dev.production * (1 + localProduction)) * controlMult * infraMult * popFactor;
    entry.hr += dev.manpower * (1 + localManpower) * controlMult * infraMult * popFactor;
    if (localTechPoints) entry.techPoints += localTechPoints * controlMult * infraMult;
    incomes[region.owner] = entry;
  });
  Object.keys(incomes).forEach((nationId) => {
    const goldMult = 1 + getModifier(state, nationId, 'national.goldMult').total;
    const hrMult = 1 + getModifier(state, nationId, 'national.hrMult').total;
    incomes[nationId] = {
      gold: Math.round(incomes[nationId].gold * goldMult),
      hr: Math.round(incomes[nationId].hr * hrMult),
      techPoints: Math.round(incomes[nationId].techPoints)
    };
  });
  return incomes;
};

// Adopts a government (once old enough that staying Tribal has no upside left to model — see this
// file's header on the laws/reform scope trim: enacting a REFORM tier picks the first available
// choice, a defensible neutral default since no doctrine-driven reform-preference table exists yet)
// or fills in the current age's reform tier if the nation already has a type but hasn't picked one.
const tryAdoptOrReformGovernment = (state, nation) => {
  const ageId = state.age;
  if (!nation.government || nation.government.type === 'tribal') {
    if (AGE_ORDER.indexOf(ageId) < AGE_ORDER.indexOf('classical')) return null;
    const available = getAvailableGovernmentTypes(ageId, nation.identity).filter((t) => t.id !== 'tribal');
    if (available.length === 0) return null;
    const choice = available[fnv1a(`${nation.id}gov`) % available.length];
    return { ...nation, government: { type: choice.id, reforms: resetReformsForType(choice.id, ageId) } };
  }
  const reforms = getReformChoices(nation.government.type, ageId);
  if (reforms.length > 0 && !nation.government.reforms?.[ageId]) {
    return { ...nation, government: { ...nation.government, reforms: { ...nation.government.reforms, [ageId]: reforms[0].id } } };
  }
  return null;
};

// Constructs the first affordable, unlocked building tier in the doctrine's own priority order, in
// the nation's own highest-development region (the same capital-stand-in placement convention
// aiLogic.js's processAIRecruitment already uses).
//
// Plan §M16 perf: uses the already-memoized getOwnedRegionIds index (src/data/regions.js) rather
// than a raw `Object.keys(regions).filter(...)` scan — with 4,482 regions and up to ~88 thinking
// nations a turn, that scan alone cost ~400k wasted comparisons/turn, the same class of perf trap
// nationalPower.js's own getOwnedRegionCount fix already called out. On success this returns just
// the ONE changed region (`regionId`/`updatedRegion`), not a full `{ ...regions, [id]: ... }` copy
// of the whole 4,482-entry map — resolveTurn.js's own `regions` draft (built once per turn, see its
// own header comment there) is always updated via a single `regions[id] = ...` property write, never
// a full-map spread, and this function follows that same established convention.
const tryConstructBuilding = (state, nation, regions) => {
  const ownedRegionIds = getOwnedRegionIds(regions, nation.id).filter((id) => !regions[id].occupiedBy);
  if (ownedRegionIds.length === 0) return null;
  const regionId = ownedRegionIds.reduce((best, id) => (getTotalDev(regions[id]) > getTotalDev(regions[best]) ? id : best), ownedRegionIds[0]);
  const region = regions[regionId];
  const totalDev = getTotalDev(region);
  const slots = getBuildingSlots(totalDev, !!REGIONS_DATA[regionId]?.isCapital);
  const used = getUsedBuildingSlots(region.buildings);
  const researchedSet = new Set(getResearched(state, nation.id));
  const buildingCostMult = getModifier(state, nation.id, 'national.buildingCost').total;
  const priority = DOCTRINE_BUILDING_PRIORITY[nation.doctrine] || BUILDING_CATEGORY_IDS;

  for (const categoryId of priority) {
    if (BUILDING_CATEGORIES[categoryId]?.coastalOnly && !REGIONS_DATA[regionId]?.isCoastal) continue;
    const currentTier = region.buildings?.categories?.[categoryId] ?? -1;
    if (currentTier === -1 && used >= slots) continue; // no free slot for a brand-new category
    const nextTier = currentTier + 1;
    if (!canBuildTier(categoryId, researchedSet, nextTier)) continue;
    const cost = getBuildingTierCost(categoryId, nextTier, buildingCostMult);
    if (cost === null || (nation.economy?.gold || 0) < cost) continue;
    return {
      nation: { ...nation, economy: { ...nation.economy, gold: nation.economy.gold - cost } },
      regionId,
      updatedRegion: { ...region, buildings: { ...region.buildings, categories: { ...region.buildings.categories, [categoryId]: nextTier } } }
    };
  }
  return null;
};

// Researches the first affordable, unlocked tech in the doctrine's preferred category order (ties
// within a category broken by earliest yearAvailable). Builds a synthetic {id: {researched}} map
// from nation.tech.researched (an array, per nationState.js's own AI shape) since canResearchTech's
// generic gating logic expects the player's own {researched, available} map shape.
const tryResearchTech = (state, nation) => {
  const researched = getResearched(state, nation.id);
  const researchedSet = new Set(researched);
  const ageId = getTechAgeId(state, nation.id);
  const agesBehind = getAgesBehind(state.age, ageId);
  const researchCostMult = getModifier(state, nation.id, 'national.researchCost').total;
  const priority = DOCTRINE_TECH_CATEGORY_PRIORITY[nation.doctrine] || Object.keys(TECH_RESEARCH_POOL);
  const syntheticTechTree = {};
  Object.keys(TECH_TREE).forEach((id) => { syntheticTechTree[id] = { researched: researchedSet.has(id) }; });

  const candidates = Object.values(TECH_TREE)
    .filter((t) => !researchedSet.has(t.id))
    .sort((a, b) => {
      const pa = priority.indexOf(a.category);
      const pb = priority.indexOf(b.category);
      if (pa !== pb) return (pa === -1 ? Infinity : pa) - (pb === -1 ? Infinity : pb);
      return a.yearAvailable - b.yearAvailable;
    });

  const pool = { ...emptyAIPool(), ...nation.economy };
  for (const tech of candidates) {
    const check = canResearchTech(tech.id, syntheticTechTree, pool, state.year, TECH_TREE, agesBehind, researchCostMult, false);
    if (!check.can) continue;
    const costMult = getAgesBehindResearchCostMultiplier(agesBehind);
    const powerCost = Math.round(getTechPowerCost(tech, { researchCostMult, focused: false }) * costMult);
    const techPointsCost = Math.round(tech.cost.techPoints * (1 + researchCostMult) * costMult);
    const poolKey = TECH_RESEARCH_POOL[tech.category];
    const nextResearched = [...researched, tech.id];
    const currentAgeTechIds = getTechsForAge(ageId).map((t) => t.id);
    const researchedCount = currentAgeTechIds.filter((id) => nextResearched.includes(id)).length;
    const nextAgeIndex = AGE_ORDER.indexOf(ageId) + 1;
    const advances = researchedCount >= TECH_AGE_ADVANCEMENT_THRESHOLD && nextAgeIndex < AGE_ORDER.length;
    return {
      ...nation,
      economy: { ...pool, [poolKey]: pool[poolKey] - powerCost, techPoints: pool.techPoints - techPointsCost },
      tech: { researched: nextResearched, ageId: advances ? AGE_ORDER[nextAgeIndex] : ageId }
    };
  }
  return null;
};

// One "think" for one nation: unit upkeep, then the FIRST affordable decision in priority order
// (government, building, tech). `state` must already reflect this turn's income having been
// credited to nation.economy (the caller, resolveTurn.js, does this for every nation every turn,
// not just thinking ones). Returns { nation }. `regions` is resolveTurn.js's own once-per-turn
// draft (built via one `{ ...state.regions }` at the top of that function and mutated everywhere
// else there via a single `regions[id] = ...` property write — see that file's own header comment)
// — a completed building is written into it the SAME way here, in place, rather than round-tripping
// a `{ ...regions, [id]: ... }` copy of the whole 4,482-entry map back through the caller.
export const processAIEconomyTurn = (state, regions, nationId) => {
  const nation = { ...state.nations[nationId], id: nationId };
  const ownUnitCount = getUnitCount(state, nationId);
  const pool = { ...emptyAIPool(), ...nation.economy };
  pool.gold = Math.max(0, pool.gold - ownUnitCount * UNIT_UPKEEP_GOLD_PER_TURN);
  let nextNation = { ...nation, economy: pool };

  const govResult = tryAdoptOrReformGovernment(state, nextNation);
  if (govResult) {
    nextNation = govResult;
  } else {
    const buildResult = tryConstructBuilding(state, nextNation, regions);
    if (buildResult) {
      nextNation = buildResult.nation;
      regions[buildResult.regionId] = buildResult.updatedRegion;
    } else {
      const techResult = tryResearchTech(state, nextNation);
      if (techResult) nextNation = techResult;
    }
  }

  // eslint-disable-next-line no-unused-vars -- `id` was only added above to let the try* helpers key off nation.id; strip it back out before returning
  const { id, ...nationWithoutId } = nextNation;
  return { nation: nationWithoutId };
};

// Real recruitment cost for an AI nation once it has a real economy (plan §M16: "Tier 1 recruits
// from treasury and manpower with the same costs"), used by aiLogic.js's processAIRecruitment in
// place of the old flat abstract-militaryStrength debit once a nation's economy pool exists.
export const canAffordAIRecruit = (nation) => {
  const costs = ACTION_COSTS.recruitUnit;
  const pool = nation.economy;
  return !!pool && (pool.gold || 0) >= costs.gold && (pool.hr || 0) >= costs.hr && (pool.mil || 0) >= costs.mil;
};
export const applyAIRecruitCost = (nation) => {
  const costs = ACTION_COSTS.recruitUnit;
  const pool = nation.economy;
  return { ...nation, economy: { ...pool, gold: pool.gold - costs.gold, hr: pool.hr - costs.hr, mil: pool.mil - costs.mil } };
};
