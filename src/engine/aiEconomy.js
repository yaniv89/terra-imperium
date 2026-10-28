import { districtYields } from './districts';
import { getTiles } from '../data/geo/tiles';
import { LAW_CATEGORIES, LAW_CATEGORY_IDS, canEnactLaw, LAW_CHANGE_COOLDOWN_TURNS } from '../data/laws';
import { decreesOf, spendDecree, decreeCap } from './decrees';
import { generateAdvisorCandidates, getAdvisorHireCost, getAdvisorSalary } from './rulers';
import { getNeighborIds } from '../data/regions';
import { getRecruitUnitCost, calcNationBalance, getLoanCapacity, getLoanInterestRate, applyBankruptcy } from './economy';
import { canAfford, applyCosts, EXTRACTION_BASE_YIELD } from '../utils/helpers';
import { regionHasDeposit } from '../data/deposits';
// src/engine/aiEconomy.js
// Plan §M16: AI parity. Gives AI nations a real, spendable economy — gold/hr/techPoints
// on their own `nation.economy` (src/engine/nationState.js's own long-scaffolded accessor layer,
// built in M0.2 and unused in production until this milestone) — and a decision cadence, so every
// one of the 240 nations gets a real turn's income and, on its own schedule, a real spending
// decision (adopt/reform its government, construct a building, or research a tech — recruitment is
// the existing, now-upgraded, processAIRecruitment pass in aiLogic.js) instead of only ever growing
// an abstract militaryStrength number.
//
// AI uses real strategic stocks, shared recruitment costs, per-turn upkeep, loans and bankruptcy.
// Spending follows a bounded cadence with stability, frontier reserves, laws and advisors ahead
// of long-term investment. Space missions remain a player victory objective.
import { devastationIncomeMult } from './aftermath';
import { addPeople, sizeToPeople, productionCost } from './world/cities';
import { ACTION_COSTS, BASE_TECHPOINTS_PER_TURN, SCIENCE_PER_DEV, BANKRUPTCY_DURATION_TURNS } from '../data/actionCosts';
import { getFieldedStrength } from '../utils/helpers';
import { getResearched, ageOf } from './nationState';
import { robotRecruitCost } from './robots';
import { getModifier, getRegionModifierTotals } from './modifiers/sheet';
const INCOME_KEYS = ['local.taxIncome', 'local.productionIncome', 'local.manpower', 'local.techPoints', 'local.flatGold', 'local.flatManpower', 'local.tradeIncome'];
import {
  getPopFactor, seedDevelopment, getTotalDev, getDevelopProvinceCost, DEVELOP_PROVINCE_POP_GAIN_RATIO, applyDevelopment
} from './development';
import { REGIONS_DATA, getOwnedRegionIds } from '../data/regions';
import {
  BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getBuildingTierCost, getBuildingSlots, getUsedBuildingSlots
} from '../data/buildings';
import { speedCostMult, speedTrainMult, isAgeAtLeast } from '../data/ages';
import { getAvailableGovernmentTypes, getReformChoices, resetReformsForType } from '../data/government';
import { DOCTRINE_BUILDING_PRIORITY, DOCTRINE_GOVERNMENT, DOCTRINE_LAWS, DOCTRINE_REFORMS } from '../data/nations';
import { clampStability, getIncreaseStabilityCost, STABILITY_MAX } from './nationalPower';
import { createRng } from '../utils/rng';
import { applyRush, rushGold, rushHeat, rushAffordable } from './spending';
import { autoGovern } from './governors';
import { rulerCityCtx } from './lawRules';

// Plan §M21 balance harness (scripts/simulate.mjs) found that a 150-turn AI-vs-AI run produced
// roughly one civil war per 3 nations — this file's own scope-trim list above never actually named
// stability management as an intentional omission (unlike loans/bankruptcy, which does), so this was
// a real parity gap rather than a deliberate trim: nothing ever gave the AI a reason to pay for
// the player's own Increase Stability action, so a nation drifting toward the M15 civil-war floor
// (stability <= -3 for 3 turns) had no counterplay at all. -1, not 0 or -3: low enough that a nation
// merely having a rough patch doesn't burn the gold and the decree it would rather spend building/researching, but high
// enough to give a nation real turns to recover before it nears the actual civil-war trigger.
const AI_STABILITY_RAISE_THRESHOLD = -1;

// Decrees (differentiation plan U8): a warlike doctrine keeps AI_WAR_DECREE_RESERVE back for its
// claims and wars (aiLogic.js), and a nation below 0 stability keeps one for raising it (the old ADM
// paid for that), except when the bank is full; a full bank with nothing else to buy raises
// stability (the court's surplus), so no bank sits at the cap.
export const AI_WAR_DECREE_RESERVE = 1;
const WAR_DOCTRINES = new Set(['blitz', 'conqueror', 'zealot']);
export const spareDecrees = (nation) => {
  const banked = decreesOf(nation);
  if (banked >= decreeCap(nation)) return banked;
  return banked - (WAR_DOCTRINES.has(nation.doctrine) ? AI_WAR_DECREE_RESERVE : 0) - ((nation.stability || 0) < 0 ? 1 : 0);
};

const tryIncreaseStability = (state, nation, surplus = false) => {
  if (surplus ? decreesOf(nation) < decreeCap(nation) || (nation.stability || 0) >= STABILITY_MAX : (nation.stability || 0) > AI_STABILITY_RAISE_THRESHOLD) return null;
  const stabilityCostMult = getModifier(state, nation.id, 'national.stabilityCost').total;
  const cost = getIncreaseStabilityCost(state, nation.id, stabilityCostMult);
  if ((nation.economy.gold || 0) < cost.gold || decreesOf(nation) < cost.decrees) return null;
  return spendDecree({ ...nation, economy: { ...nation.economy, gold: nation.economy.gold - cost.gold }, stability: clampStability((nation.stability || 0) + 1) }, 'increaseStability', state.turnNumber, cost.decrees);
};

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

const emptyAIPool = () => ({ gold: 0, hr: 0, techPoints: 0 });

// One O(regions) pass computing real {gold, hr, techPoints} income for every non-player nation that
// owns at least one region — the player keeps calcIncome (helpers.js) unchanged; this is a separate,
// AI-only function rather than a generalization of it, so the player's own extensively-tested income
// path is never at risk of a regression from this milestone. Building/government/law/identity
// modifier sources (src/engine/modifiers/) already read generically for any nationId, so those are
// included via the SAME getRegionModifier/getModifier calls calcIncome itself uses.
// `only` (a Set of nation ids, optional): the nations whose income is wanted this turn (world/lod.js
// settles far nations every few turns); every other nation's regions are skipped.
export const calcAllNationIncomes = (state, only = null) => {
  const tiles = getTiles(); // district yields read the grid (districts.js)
  const incomes = {};
  Object.values(state.regions).forEach((region) => {
    if (!region.owner || region.owner === state.playerNationId || region.occupiedBy) return;
    if (only && !only.has(region.owner)) return;
    const regData = REGIONS_DATA[region.id];
    if (!regData) return;
    const dev = region.dev || seedDevelopment(region.id);
    const controlMult = region.control / 100;
    const infraMult = 1 + (region.currentInfrastructure || 0) * 0.1;
    const popFactor = getPopFactor(region, regData) * devastationIncomeMult(region); // a battlefield earns less while it recovers
    const m = getRegionModifierTotals(state, region.id, INCOME_KEYS); // one sheet lookup for the six keys
    const localTax = m['local.taxIncome'];
    const localProduction = m['local.productionIncome'];
    const localManpower = m['local.manpower'];
    const localTechPoints = m['local.techPoints'];
    const entry = incomes[region.owner] || { gold: 0, hr: 0, techPoints: 0 };
    entry.gold += (dev.tax * (1 + localTax) + dev.production * (1 + localProduction)) * controlMult * infraMult * popFactor;
    entry.hr += dev.manpower * (1 + localManpower) * controlMult * infraMult * popFactor;
    // The income buildings' flat yields, exactly as the player's calcIncome counts them.
    entry.gold += m['local.flatGold'] * controlMult;
    entry.hr += m['local.flatManpower'] * controlMult;
    if (localTechPoints) entry.techPoints += localTechPoints * controlMult * infraMult;
    entry.techPoints += SCIENCE_PER_DEV * getTotalDev({ dev }) * controlMult; // as the player's calcIncome
    Object.entries(region.buildings?.extraction || {}).forEach(([key, built]) => {
      if (built && regionHasDeposit(regData, key)) entry[key] = (entry[key] || 0) + EXTRACTION_BASE_YIELD * controlMult * infraMult;
    });
    entry.gold += m['local.tradeIncome'] * controlMult;
    entry.techPoints += districtYields(tiles, state.world, region).science * controlMult; // the Campus (districts.js); the player's rides lastYields.science
    incomes[region.owner] = entry;
  });
  Object.keys(incomes).forEach((nationId) => {
    const goldMult = 1 + getModifier(state, nationId, 'national.goldMult').total;
    const hrMult = 1 + getModifier(state, nationId, 'national.hrMult').total;
    incomes[nationId] = {
      ...incomes[nationId],
      gold: Math.round(incomes[nationId].gold * goldMult),
      hr: Math.round(incomes[nationId].hr * hrMult),
      techPoints: Math.round(incomes[nationId].techPoints) + BASE_TECHPOINTS_PER_TURN
    };
  });
  return incomes;
};

// Adopts a government once old enough that staying Tribal has no upside left to model, the
// doctrine's preferred type first (DOCTRINE_GOVERNMENT, plan C4.5), or fills in the current age's
// reform tier with the doctrine's preferred reform (DOCTRINE_REFORMS), else the first choice.
const tryAdoptOrReformGovernment = (state, nation) => {
  const ageId = ageOf(state, nation.id);
  if (!nation.government || nation.government.type === 'tribal') {
    if (!isAgeAtLeast(ageId, 'classical')) return null;
    const available = getAvailableGovernmentTypes(ageId, nation.identity, null, getResearched(state, nation.id)).filter((t) => t.id !== 'tribal');
    if (available.length === 0) return null;
    const preferred = (DOCTRINE_GOVERNMENT[nation.doctrine] || []).map((id) => available.find((t) => t.id === id)).find(Boolean);
    const choice = preferred || available[fnv1a(`${nation.id}gov`) % available.length];
    const cost = ACTION_COSTS.changeGovernmentType.decrees;
    if (spareDecrees(nation) < cost) return null;
    return spendDecree({ ...nation, government: { type: choice.id, reforms: resetReformsForType(choice.id, ageId) } }, 'changeGovernmentType', state.turnNumber);
  }
  const reforms = getReformChoices(nation.government.type, ageId);
  if (reforms.length > 0 && !nation.government.reforms?.[ageId]) {
    const liked = DOCTRINE_REFORMS[nation.doctrine] || [];
    const pick = reforms.find((r) => liked.includes(r.id)) || reforms[0];
    if (spareDecrees(nation) < ACTION_COSTS.enactGovernmentReform.decrees) return null;
    return spendDecree({ ...nation, government: { ...nation.government, reforms: { ...nation.government.reforms, [ageId]: pick.id } } }, 'enactGovernmentReform', state.turnNumber);
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
  // A city (a record with a size) builds through its queue; gold buys what the queue lacks
  // (tryRushProduction below, the player's own rush price). Writing the tier in directly paid one
  // gold a point at any speed and built what the queue was already building (addendum X24).
  if (region.size != null) return null;
  const totalDev = getTotalDev(region);
  const slots = getBuildingSlots(totalDev, !!REGIONS_DATA[regionId]?.isCapital);
  const used = getUsedBuildingSlots(region.buildings);
  const researchedSet = new Set(getResearched(state, nation.id));
  const buildingCostMult = getModifier(state, nation.id, 'national.buildingCost').total;
  const priority = DOCTRINE_BUILDING_PRIORITY[nation.doctrine] || BUILDING_CATEGORY_IDS;

  for (const categoryId of priority) {
    if (BUILDING_CATEGORIES[categoryId]?.coastalOnly && !REGIONS_DATA[regionId]?.isCoastal) continue;
    const currentTier = region.buildings?.categories?.[categoryId] ?? -1;
    if (currentTier === -1 && used >= slots && !BUILDING_CATEGORIES[categoryId]?.freeSlot) continue; // no free slot for a brand-new category
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


// Develops the nation's own highest-dev owned region (same placement convention as
// tryConstructBuilding above) by +1 for gold (AI_DEVELOP_GOLD_RESERVE kept back), in a type drawn from AI_DEVELOP_MIX
// by a hash of id and turn, mirroring the player's own
// DEVELOP_PROVINCE action/cost curve exactly (src/engine/gameReducer.js's case, and
// getDevelopProvinceCost) so an AI nation's economic base actually grows over a long game instead of
// staying pinned at its seeded starting value.
export const AI_DEVELOP_GOLD_RESERVE = 800; // U8 balance-sim: lower, development ate the gold armies are raised with (half the wars)
// Production first (it builds the settlers and the army), then tax and manpower.
const AI_DEVELOP_MIX = ['production', 'production', 'tax', 'manpower'];
const tryDevelopProvince = (state, nation, regions) => {
  const ownedRegionIds = getOwnedRegionIds(regions, nation.id).filter((id) => !regions[id].occupiedBy);
  if (ownedRegionIds.length === 0) return null;
  const regionId = ownedRegionIds.reduce((best, id) => (getTotalDev(regions[id]) > getTotalDev(regions[best]) ? id : best), ownedRegionIds[0]);
  const region = regions[regionId];
  const developmentCostMult = getModifier(state, nation.id, 'national.developmentCost').total;
  const cost = getDevelopProvinceCost(region, developmentCostMult);
  const pool = { ...emptyAIPool(), ...nation.economy };
  if ((pool.gold || 0) - cost < AI_DEVELOP_GOLD_RESERVE) return null;
  const devType = AI_DEVELOP_MIX[fnv1a(`${nation.id}|${state.turnNumber}`) % AI_DEVELOP_MIX.length];
  const modernBaseline = REGIONS_DATA[regionId]?.population || 0;
  const popGain = Math.round(modernBaseline * DEVELOP_PROVINCE_POP_GAIN_RATIO);
  return {
    nation: { ...nation, economy: { ...pool, gold: pool.gold - cost } },
    regionId,
    updatedRegion: {
      // The same lasting investment the player's Develop buys (development.js applyDevelopment, I031).
      ...applyDevelopment(region.size != null ? addPeople(region, sizeToPeople(region.size) * DEVELOP_PROVINCE_POP_GAIN_RATIO) : { ...region, currentPopulation: (region.currentPopulation || modernBaseline) + popGain }, devType)
    }
  };
};

// An AI nation buys production at the player's price (spending.js rushGold, rushHeat, applyRush;
// addendum X24) for the front order of its biggest city that is building something and would take
// more than AI_RUSH_MIN_TURNS turns. It buys what its gold above AI_RUSH_RESERVE (or three turns of
// a deficit) pays for, the whole order or part of it, so it spends as it earns, as the old
// one-gold-a-point building purchase did. Keeping a bigger reserve to buy whole orders let AI
// treasuries sit above the 150 gold of a fabricated claim and doubled wars at Normal.
// Not in a war chest emergency (the think returns earlier for that). Cheap: no tile work, the
// city's last yields stand in for its production.
export const AI_RUSH_RESERVE = 50;
export const AI_RUSH_MIN_TURNS = 3;
export const AI_MAX_RUSHES_PER_THINK = 4;
export const AI_EXTRA_RUSH_GOLD = 400;
// `eligibleOnly` (the surplus pass below): pick the biggest city whose order is worth buying, instead
// of giving up when the biggest one's is not.
const tryRushProduction = (state, nation, regions, skip = null, { reserve: floor = 0, minTurns = AI_RUSH_MIN_TURNS, eligibleOnly = false } = {}) => {
  const gold = nation.economy?.gold || 0;
  const reserve = Math.max(AI_RUSH_RESERVE, -(nation.lastNetIncome || 0) * 3, floor);
  if (gold - reserve < rushGold(1)) return null;
  const owned = getOwnedRegionIds(regions, nation.id);
  const ageId = ageOf(state, nation.id);
  const costCtx = { ageId, citiesOwned: owned.length || 1, speedMult: speedCostMult(state.gameSpeed, ageId), trainMult: speedTrainMult(state.gameSpeed, ageId), costMult: rulerCityCtx(nation).costMult };
  const missingOf = (c) => productionCost(c.production.current, costCtx) - (c.production.progress || 0);
  const worthIt = (c, missing) => missing > 0 && !((c.lastYields?.production || 0) > 0 && missing / c.lastYields.production <= minTurns);
  // Under a war plan (warPlans.js, lane W5) the regiments come first: the biggest city training one.
  const wantsUnits = !!nation.warPlan;
  let best = null;
  for (const id of owned) {
    const c = regions[id];
    const item = c?.production?.current;
    if (c.size == null || !item || skip?.has(id) || item.kind === 'wonder' || c.occupiedBy || c.underInvasion || c.siege || c.razing) continue;
    const unitFirst = wantsUnits ? (item.kind === 'unit') - (regions[best]?.production?.current?.kind === 'unit') : 0;
    if (!(best == null || unitFirst > 0 || (unitFirst === 0 && c.size > regions[best].size))) continue;
    if (eligibleOnly && !worthIt(c, missingOf(c))) continue;
    best = id;
  }
  if (best == null) return null;
  const city = regions[best];
  const p = city.production;
  const missing = missingOf(city);
  if (!worthIt(city, missing)) return null;
  const heat = rushHeat(city, state.turnNumber, state.gameSpeed, ageId);
  const bought = rushAffordable(missing, gold - reserve, heat, p.current);
  if (!bought) return null;
  return { nation: { ...nation, economy: { ...nation.economy, gold: gold - bought.gold } }, regionId: best, updatedRegion: applyRush(city, 0, { cost: (p.progress || 0) + bought.hammers, heat }, state.turnNumber) };
};

// Surplus spending (follow-ups 19 and 24: the era goals' gold piled up in the big majors, 10,000 to
// 30,000 gold at turn 250 on about 1,000 a turn). Gold above the surplus floor
//   floor = max(AI_SURPLUS_GOLD, AI_SURPLUS_INCOME_TURNS x net income a turn)
// buys production at the same rush price in up to AI_SURPLUS_RUSHES more cities a think, any order
// with more than AI_SURPLUS_MIN_TURNS turns left, never taking the treasury under the floor. Runs
// after the think's decision (a law and an advisor too), not on a stability emergency or a war chest
// think. Buys only what the cities' own queues chose.
export const AI_SURPLUS_GOLD = 3000;
export const AI_SURPLUS_INCOME_TURNS = 16;
export const AI_SURPLUS_RUSHES = 6;
export const AI_SURPLUS_MIN_TURNS = 1;
export const aiSurplusFloor = (nation) => Math.max(AI_SURPLUS_GOLD, AI_SURPLUS_INCOME_TURNS * (nation.lastNetIncome || 0));
const spendSurplus = (state, nation, regions) => {
  const floor = aiSurplusFloor(nation);
  if ((nation.economy?.gold || 0) <= floor) return nation;
  const skip = new Set();
  let next = nation;
  for (let k = 0; k < AI_SURPLUS_RUSHES && (next.economy?.gold || 0) > floor; k++) {
    const more = tryRushProduction(state, next, regions, skip, { reserve: floor, minTurns: AI_SURPLUS_MIN_TURNS, eligibleOnly: true });
    if (!more) break;
    next = more.nation; regions[more.regionId] = more.updatedRegion; skip.add(more.regionId);
  }
  return next;
};

/** The law an AI nation enacts this think, { category, id } or null (see the think's own note). It needs a decree. */
export const pickAILaw = (state, nationId, nation) => {
  const liked = DOCTRINE_LAWS[nation.doctrine] || {};
  const affordable = () => !!nation.freeLawChange || spareDecrees(nation) >= ACTION_COSTS.changeLaw.decrees;
  const order = [...Object.keys(liked), ...LAW_CATEGORY_IDS.filter((c) => !liked[c])]; // the doctrine's own categories first
  for (const category of order) {
    const current = nation.laws?.[category];
    const preferred = (liked[category] || []).map((id) => LAW_CATEGORIES[category].find((l) => l.id === id)).filter(Boolean);
    const held = preferred.findIndex((l) => l.id === current);
    const wanted = (held === -1 ? preferred : preferred.slice(0, held)).find((l) => canEnactLaw(state, nationId, category, l.id) && affordable(category, l));
    if (wanted) return { category, id: wanted.id };
    if (liked[category]) continue; // a doctrine with a view on this category waits for its law
    // Only up from the law it holds (it flipped back to the tier below after every cooldown), and
    // never a law that costs income (U57: every doctrine took the Renewable Mandate's -5%).
    const heldTier = LAW_CATEGORIES[category].find((l) => l.id === current)?.tier || 0;
    const choices = [...LAW_CATEGORIES[category]].filter((l) => l.requiresTech && l.tier > heldTier && canEnactLaw(state, nationId, category, l.id) && (l.effects.stabilityBonus || 0) >= 0 && (l.effects.goldMult || 0) >= 0).reverse();
    const law = choices.find((l) => affordable(category, l));
    if (law) return { category, id: law.id };
  }
  return null;
};

// One "think" for one nation: unit upkeep, then the FIRST affordable decision in priority order
// (government, building, tech, then province development). `state` must already reflect this turn's income having been
// credited to nation.economy (the caller, resolveTurn.js, does this for every nation every turn,
// not just thinking ones). Returns { nation }. `regions` is resolveTurn.js's own once-per-turn
// draft (built via one `{ ...state.regions }` at the top of that function and mutated everywhere
// else there via a single `regions[id] = ...` property write — see that file's own header comment)
// — a completed building is written into it the SAME way here, in place, rather than round-tripping
// a `{ ...regions, [id]: ... }` copy of the whole 4,482-entry map back through the caller.
export const processAIEconomyTurn = (state, regions, nationId) => {
  const nation = { ...state.nations[nationId], id: nationId };
  const pool = { ...emptyAIPool(), ...nation.economy };
  // Upkeep is settled each turn before the decision cadence.
  let nextNation = autoGovern({ ...state, regions }, { ...nation, economy: pool }, state.turnNumber + 1); // every group governed (governors.js)


  // A nation on the brink of civil war (see this function's own AI_STABILITY_RAISE_THRESHOLD
  // comment) gets first call on its gold and decrees, ahead of government/building/research — those can all
  // wait a think; losing regions to an insurgent army cannot.
  const stabilityResult = tryIncreaseStability(state, nextNation);
  if(stabilityResult)return {nation:stabilityResult};
  if(state.scenario?.mode==='emergent' && getOwnedRegionIds(regions,nationId).some(id=>getNeighborIds(id).some(n=>regions[n]?.owner===null))) return {nation:nextNation};
  // Keep cash for movement, recruitment and the next upkeep bill during wars.
  if(nextNation.isAtWar && (pool.gold || 0)<Math.max(200,-(nextNation.lastNetIncome || 0)*3))return {nation:nextNation};
  if(!stabilityResult && (nextNation.stability || 0)>=0){
    // Laws by doctrine (plan C4.5, DOCTRINE_LAWS): the first preferred law the nation can enact,
    // else the highest tier that costs no stability; the AI never moves back to a law it holds.
    const law=pickAILaw(state,nationId,nextNation);
    if(law){const enacted={...nextNation,economy:pool,laws:{...nextNation.laws,[law.category]:law.id},lawCooldowns:{...nextNation.lawCooldowns,[law.category]:state.turnNumber+LAW_CHANGE_COOLDOWN_TURNS},freeLawChange:false};return {nation:spendSurplus(state,nextNation.freeLawChange?enacted:spendDecree(enacted,'changeLaw',state.turnNumber),regions)};} // the age advance's free change first (rank 11)
    const advisorPool=nextNation.isAtWar?'mil':'adm';
    if(!nextNation.advisors?.[advisorPool] && (pool.gold || 0)>500 && (nextNation.lastNetIncome || 0)>20){
      const advisor=generateAdvisorCandidates(nationId,createRng(fnv1a(nationId+state.turnNumber)))[advisorPool].sort((a,b)=>a.level-b.level)[0];
      if(nextNation.lastNetIncome>getAdvisorSalary(advisor.level)*3)return {nation:spendSurplus(state,{...nextNation,advisors:{...nextNation.advisors,[advisorPool]:advisor},economy:{...pool,gold:pool.gold-getAdvisorHireCost(advisor.level)}},regions)};
    }
  }
  if (stabilityResult) {
    nextNation = stabilityResult;
  } else {
    const govResult = tryAdoptOrReformGovernment(state, nextNation) || tryIncreaseStability(state, nextNation, true);
    if (govResult) {
      nextNation = govResult;
    } else {
      const buildResult = tryRushProduction(state, nextNation, regions) || tryConstructBuilding(state, nextNation, regions);
      if (buildResult) {
        nextNation = buildResult.nation;
        regions[buildResult.regionId] = buildResult.updatedRegion;
        // A rich treasury buys in more cities (I017, lane W6: majors sat on about 1,000 gold by turn
        // 200 once their luxuries paid): further rushes, one city each, while the gold stays over
        // AI_EXTRA_RUSH_GOLD. The reserve rule of tryRushProduction still holds for each.
        const skip = new Set([buildResult.regionId]);
        for (let k = 1; k < AI_MAX_RUSHES_PER_THINK && (nextNation.economy?.gold || 0) > AI_EXTRA_RUSH_GOLD; k++) {
          const more = tryRushProduction(state, nextNation, regions, skip);
          if (!more) break;
          nextNation = more.nation; regions[more.regionId] = more.updatedRegion; skip.add(more.regionId);
        }
      } else {
        // Research is no longer a purchase here: AI science accumulates every turn into the
        // tech it is researching (src/engine/research.js, run at the end of resolveTurn).
        const devResult = tryDevelopProvince(state, nextNation, regions);
        if (devResult) {
          nextNation = devResult.nation;
          regions[devResult.regionId] = devResult.updatedRegion;
        }
      }
    }
  }
  nextNation = spendSurplus(state, nextNation, regions);

  // `id` is kept, not stripped: every nation record already carries its own `id` (createInitialState
  // sets it), so stripping it here deleted the REAL field on every AI think — after a few turns most
  // nations had no `id`, and every player diplomacy action silently no-oped (gameReducer.js looks the
  // target up by `nation.id`).
  return { nation: nextNation };
};

// Real recruitment cost for an AI nation once it has a real economy (plan §M16: "Tier 1 recruits
// from treasury and manpower with the same costs"), used by aiLogic.js's processAIRecruitment in
// place of the old flat abstract-militaryStrength debit once a nation's economy pool exists.
// `robot`: a robot recruit (robots.js robotRecruitCost: no manpower, more gold).
export const canAffordAIRecruit = (nation, state, ageId, robot = false) => {
  const base = state ? getRecruitUnitCost(state, ageId, nation.id) : ACTION_COSTS.recruitUnit;
  const costs = robot ? robotRecruitCost(base) : base;
  const pool = nation.economy;
  const reserve=Math.max(0,-(nation.lastNetIncome || 0)*3);
  return !!pool && canAfford(pool, costs) && (pool.gold || 0)-(costs.gold || 0)>=reserve;
};
export const applyAIRecruitCost = (nation, state, ageId, robot = false) => {
  const base = state ? getRecruitUnitCost(state, ageId, nation.id) : ACTION_COSTS.recruitUnit;
  const costs = robot ? robotRecruitCost(base) : base;
  const pool = nation.economy;
  return { ...nation, economy: applyCosts(pool, costs) };
};

// `turns`: how many turns this settlement covers (world/lod.js: a far, quiet nation settles every
// few turns). The turns are replayed one by one, so a broke nation takes a loan or goes bankrupt
// as often as it would have turn by turn: `goldPerTurn` is credited before each turn after the
// first (the caller has credited the first), and the loans' interest follows the loans taken.
export const settleAIUpkeep = (state, nationId, income, ownedUnits = null, turns = 1, goldPerTurn = 0) => {
  const balance = calcNationBalance(state, nationId, income, ownedUnits);
  const interestOf = (loans) => (loans || []).reduce((sum, loan) => sum + Math.round(loan.principal * loan.interestRate), 0);
  const otherExpenses = Object.values(balance.expenses).reduce((a,b)=>a+b,0) - balance.expenses.loanInterest;
  let nation = state.nations[nationId];
  for (let t = 0; t < turns; t++) {
    const start = t === 0 ? nation.economy.gold || 0 : (nation.economy.gold || 0) + goldPerTurn;
    const loanInterest = t === 0 ? balance.expenses.loanInterest : interestOf(nation.loans);
    const net = t === 0 ? balance.net : (income.gold || 0) - otherExpenses - loanInterest;
    const gold = start - otherExpenses - loanInterest;
    if (gold >= 0) { nation = { ...nation, economy: { ...nation.economy, gold }, lastNetIncome: net }; continue; }
    const loans = nation.loans || [];
    if (loans.length < getLoanCapacity(state, nationId)) {
      const principal = Math.max(200, -gold);
      nation = { ...nation, economy: { ...nation.economy, gold: gold + principal }, loans: [...loans, { id: 'ai_loan_' + nationId + '_' + state.turnNumber + (t ? '_' + t : ''), principal, interestRate: getLoanInterestRate(state, nationId), takenTurn: state.turnNumber }], lastNetIncome: net };
      continue;
    }
    // The recovery window (aiBudget.js, I124): within BANKRUPTCY_DURATION_TURNS of a bankruptcy the
    // debts are already written off; a new shortfall leaves the troops unpaid (resolveTurn.js applies
    // the desertion on `lastUnpaidTurn`) instead of a second bankruptcy.
    if (nation.lastBankruptcyTurn != null && state.turnNumber - nation.lastBankruptcyTurn < BANKRUPTCY_DURATION_TURNS) {
      nation = { ...nation, economy: { ...nation.economy, gold: 0 }, lastNetIncome: net, lastUnpaidTurn: state.turnNumber };
      continue;
    }
    const bankrupt = applyBankruptcy(nation, state.regions, nationId, state.turnNumber);
    Object.assign(state.regions, bankrupt.regions);
    nation = { ...bankrupt.nation, economy: { ...nation.economy, gold: 0 }, lastNetIncome: net };
  }
  return nation;
};
