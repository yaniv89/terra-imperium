import { districtYields } from './districts';
import { getTiles } from '../data/geo/tiles';
import { ESTATE_PRIVILEGES, CROWN_LAND_SEIZE_AMOUNT, CROWN_LAND_SEIZE_LOYALTY_PENALTY, ESTATE_INTERACTION_COOLDOWN_TURNS } from '../data/estates';
import { canDoEstateInteraction } from './estates';
import { LAW_CATEGORIES, LAW_CATEGORY_IDS, canEnactLaw, getLawChangeCost, LAW_CHANGE_COOLDOWN_TURNS } from '../data/laws';
import { generateAdvisorCandidates, getAdvisorHireCost, getAdvisorSalary } from './succession';
import { getNeighborIds } from '../data/regions';
import { getRecruitUnitCost, calcNationBalance, getLoanCapacity, getLoanInterestRate, applyBankruptcy } from './economy';
import { canAfford, applyCosts, EXTRACTION_BASE_YIELD } from '../utils/helpers';
import { hasDeposit } from '../data/deposits';
// src/engine/aiEconomy.js
// Plan §M16: AI parity. Gives AI nations a real, spendable economy — gold/hr/techPoints/adm/dip/mil
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
import { addPeople, sizeToPeople } from './world/cities';
import { ACTION_COSTS, BASE_TECHPOINTS_PER_TURN, SCIENCE_PER_DEV } from '../data/actionCosts';
import { getFieldedStrength } from '../utils/helpers';
import { getResearched } from './nationState';
import { getModifier, getRegionModifierTotals } from './modifiers/sheet';
const INCOME_KEYS = ['local.taxIncome', 'local.productionIncome', 'local.manpower', 'local.techPoints', 'local.flatGold', 'local.flatManpower', 'local.tradeIncome'];
import {
  getPopFactor, seedDevelopment, getTotalDev, DEV_TYPE_IDS, DEV_TYPE_POOL, getDevelopProvinceCost, DEVELOP_PROVINCE_POP_GAIN_RATIO
} from './development';
import { REGIONS_DATA, getOwnedRegionIds } from '../data/regions';
import {
  BUILDING_CATEGORIES, BUILDING_CATEGORY_IDS, canBuildTier, getBuildingTierCost, getBuildingSlots, getUsedBuildingSlots
} from '../data/buildings';
import { AGE_ORDER } from '../data/ages';
import { getAvailableGovernmentTypes, getReformChoices, resetReformsForType } from '../data/government';
import { DOCTRINE_BUILDING_PRIORITY, DOCTRINE_GOVERNMENT, DOCTRINE_LAWS, DOCTRINE_REFORMS } from '../data/nations';
import { clampStability, getIncreaseStabilityCost } from './nationalPower';
import { getSuccessionStyle, generateHeir } from './succession';
import { createRng } from '../utils/rng';
import { autoGovern } from './governors';

// Plan §M21 balance harness (scripts/simulate.mjs) found that a 150-turn AI-vs-AI run produced
// roughly one civil war per 3 nations — this file's own scope-trim list above never actually named
// stability management as an intentional omission (unlike loans/bankruptcy, which does), so this was
// a real parity gap rather than a deliberate trim: nothing ever gave the AI a reason to spend ADM on
// the player's own Increase Stability action, so a nation drifting toward the M15 civil-war floor
// (stability <= -3 for 3 turns) had no counterplay at all. -1, not 0 or -3: low enough that a nation
// merely having a rough patch doesn't burn ADM it would rather spend building/researching, but high
// enough to give a nation real turns to recover before it nears the actual civil-war trigger.
const AI_STABILITY_RAISE_THRESHOLD = -1;
const tryIncreaseStability = (state, nation) => {
  if ((nation.stability || 0) > AI_STABILITY_RAISE_THRESHOLD) return null;
  const stabilityCostMult = getModifier(state, nation.id, 'national.stabilityCost').total;
  const cost = getIncreaseStabilityCost(state, nation.id, stabilityCostMult);
  if ((nation.economy.adm || 0) < cost) return null;
  return { ...nation, economy: { ...nation.economy, adm: nation.economy.adm - cost }, stability: clampStability((nation.stability || 0) + 1) };
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

const emptyAIPool = () => ({ gold: 0, hr: 0, techPoints: 0, adm: 0, dip: 0, mil: 0 });

// One O(regions) pass computing real {gold, hr, techPoints} income for every non-player nation that
// owns at least one region — the player keeps calcIncome (helpers.js) unchanged; this is a separate,
// AI-only function rather than a generalization of it, so the player's own extensively-tested income
// path is never at risk of a regression from this milestone. Building/government/law/identity
// modifier sources (src/engine/modifiers/) already read generically for any nationId, so those are
// included via the SAME getRegionModifier/getModifier calls calcIncome itself uses.
export const calcAllNationIncomes = (state) => {
  const tiles = getTiles(); // district yields read the grid (districts.js)
  const incomes = {};
  Object.values(state.regions).forEach((region) => {
    if (!region.owner || region.owner === state.playerNationId || region.occupiedBy) return;
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
      if (built && hasDeposit(regData.startOwner, key)) entry[key] = (entry[key] || 0) + EXTRACTION_BASE_YIELD * controlMult * infraMult;
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
  const ageId = state.age;
  if (!nation.government || nation.government.type === 'tribal') {
    if (AGE_ORDER.indexOf(ageId) < AGE_ORDER.indexOf('classical')) return null;
    const available = getAvailableGovernmentTypes(ageId, nation.identity).filter((t) => t.id !== 'tribal');
    if (available.length === 0) return null;
    const preferred = (DOCTRINE_GOVERNMENT[nation.doctrine] || []).map((id) => available.find((t) => t.id === id)).find(Boolean);
    const choice = preferred || available[fnv1a(`${nation.id}gov`) % available.length];
    // Plan §M21 balance fix (see this file's own header on the M16 laws/reform scope trim, and
    // gameReducer.js's CHANGE_GOVERNMENT_TYPE case for the identical player-side fix): without
    // this, an AI nation's FIRST reign as a fresh monarchy is always heirless (heir stays null
    // until a reign actually ends), guaranteeing a Succession Crisis — and its 40% civil-war roll
    // — the moment that first reign runs out. A one-off deterministic rng (not a threaded seed,
    // matching this file's own `fnv1a`-keyed pseudo-randomness elsewhere) generates an heir right
    // when hereditary government is adopted, the same as the player gets.
    const heir = getSuccessionStyle({ type: choice.id }) === 'hereditary'
      ? generateHeir(nation.id, createRng(fnv1a(`${nation.id}heir${state.turnNumber}`)), nation.ruler?.dynasty, state.turnNumber)
      : nation.heir;
    return { ...nation, government: { type: choice.id, reforms: resetReformsForType(choice.id, ageId) }, heir };
  }
  const reforms = getReformChoices(nation.government.type, ageId);
  if (reforms.length > 0 && !nation.government.reforms?.[ageId]) {
    const liked = DOCTRINE_REFORMS[nation.doctrine] || [];
    const pick = reforms.find((r) => liked.includes(r.id)) || reforms[0];
    return { ...nation, government: { ...nation.government, reforms: { ...nation.government.reforms, [ageId]: pick.id } } };
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


// Develops the nation's own highest-dev owned region (same placement convention as
// tryConstructBuilding above) by +1 in whichever of tax/production/manpower its corresponding power
// pool (adm/dip/mil — see DEV_TYPE_POOL) can most easily afford, mirroring the player's own
// DEVELOP_PROVINCE action/cost curve exactly (src/engine/gameReducer.js's case, and
// getDevelopProvinceCost) so an AI nation's economic base actually grows over a long game instead of
// staying pinned at its seeded starting value.
const tryDevelopProvince = (state, nation, regions) => {
  const ownedRegionIds = getOwnedRegionIds(regions, nation.id).filter((id) => !regions[id].occupiedBy);
  if (ownedRegionIds.length === 0) return null;
  const regionId = ownedRegionIds.reduce((best, id) => (getTotalDev(regions[id]) > getTotalDev(regions[best]) ? id : best), ownedRegionIds[0]);
  const region = regions[regionId];
  const developmentCostMult = getModifier(state, nation.id, 'national.developmentCost').total;
  const cost = getDevelopProvinceCost(region, developmentCostMult);
  const pool = { ...emptyAIPool(), ...nation.economy };
  // Whichever pool can afford it AND currently has the largest balance — a simple, doctrine-free
  // "spend your fullest currency" heuristic rather than a fourth priority table.
  const devType = DEV_TYPE_IDS
    .filter((type) => (pool[DEV_TYPE_POOL[type]] || 0) >= cost)
    .sort((a, b) => (pool[DEV_TYPE_POOL[b]] || 0) - (pool[DEV_TYPE_POOL[a]] || 0))[0];
  if (!devType) return null;
  const poolKey = DEV_TYPE_POOL[devType];
  const modernBaseline = REGIONS_DATA[regionId]?.population || 0;
  const popGain = Math.round(modernBaseline * DEVELOP_PROVINCE_POP_GAIN_RATIO);
  return {
    nation: { ...nation, economy: { ...pool, [poolKey]: pool[poolKey] - cost } },
    regionId,
    updatedRegion: {
      ...region,
      ...(region.size != null ? addPeople(region, sizeToPeople(region.size) * DEVELOP_PROVINCE_POP_GAIN_RATIO) : { currentPopulation: (region.currentPopulation || modernBaseline) + popGain }),
      dev: { ...region.dev, [devType]: (region.dev?.[devType] || 0) + 1 }
    }
  };
};

export const AI_LAW_ADM_RESERVE = 50;
/** The law an AI nation enacts this think, { category, id } or null (see the think's own note). */
export const pickAILaw = (state, nationId, nation, pool) => {
  const liked = DOCTRINE_LAWS[nation.doctrine] || {};
  const affordable = (category, l) => (pool.adm || 0) >= getLawChangeCost(state, nationId, category, l.id) + AI_LAW_ADM_RESERVE;
  const order = [...Object.keys(liked), ...LAW_CATEGORY_IDS.filter((c) => !liked[c])]; // the doctrine's own categories first
  for (const category of order) {
    const current = nation.laws?.[category];
    const preferred = (liked[category] || []).map((id) => LAW_CATEGORIES[category].find((l) => l.id === id)).filter(Boolean);
    const held = preferred.findIndex((l) => l.id === current);
    const wanted = (held === -1 ? preferred : preferred.slice(0, held)).find((l) => canEnactLaw(state, nationId, category, l.id) && affordable(category, l));
    if (wanted) return { category, id: wanted.id };
    if (liked[category]) continue; // a doctrine with a view on this category waits for its law
    const choices = [...LAW_CATEGORIES[category]].filter((l) => l.requiresTech && canEnactLaw(state, nationId, category, l.id) && (l.effects.stabilityBonus || 0) >= 0).reverse();
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
  // comment) gets first call on its ADM, ahead of government/building/research — those can all
  // wait a think; losing regions to a pretender army cannot.
  const stabilityResult = tryIncreaseStability(state, nextNation);
  if(stabilityResult)return {nation:stabilityResult};
  if(state.scenario?.mode==='emergent' && getOwnedRegionIds(regions,nationId).some(id=>getNeighborIds(id).some(n=>regions[n]?.owner===null))) return {nation:nextNation};
  const estateEntries=Object.entries(nextNation.estates || {});
  if((nextNation.crownLand ?? 50)<50 && estateEntries.length && estateEntries.every(([,e])=>e.loyalty>=70) && canDoEstateInteraction(nextNation,'seizeLand',state.turnNumber) && canAfford(pool,ACTION_COSTS.seizeLand)){
    return {nation:{...nextNation,economy:applyCosts(pool,ACTION_COSTS.seizeLand),crownLand:Math.min(100,nextNation.crownLand+CROWN_LAND_SEIZE_AMOUNT),estates:Object.fromEntries(estateEntries.map(([id,e])=>[id,{...e,loyalty:e.loyalty-CROWN_LAND_SEIZE_LOYALTY_PENALTY}])),estateInteractionCooldowns:{...nextNation.estateInteractionCooldowns,seizeLand:state.turnNumber+ESTATE_INTERACTION_COOLDOWN_TURNS}}};
  }
  for(const [id,e] of estateEntries){
    const privilege=(ESTATE_PRIVILEGES[id] || []).find(p=>p.loyaltyBonus>0 && e.loyalty<30 && !e.privileges.includes(p.id) && e.influence+(p.influenceBonus || 0)<80);
    if(privilege && canAfford(pool,ACTION_COSTS.grantEstatePrivilege))return {nation:{...nextNation,economy:applyCosts(pool,ACTION_COSTS.grantEstatePrivilege),estates:{...nextNation.estates,[id]:{...e,privileges:[...e.privileges,privilege.id]}}}};
  }
  // Keep power and cash for movement, recruitment and the next upkeep bill during wars.
  if(nextNation.isAtWar && ((pool.gold || 0)<Math.max(200,-(nextNation.lastNetIncome || 0)*3) || (pool.mil || 0)<10))return {nation:nextNation};
  if(!stabilityResult && (nextNation.stability || 0)>=0){
    // Laws by doctrine (plan C4.5, DOCTRINE_LAWS): the first preferred law the nation can enact,
    // else the highest tier that costs no stability; the AI never moves back to a law it holds.
    const law=pickAILaw(state,nationId,nextNation,pool);
    if(law)return {nation:{...nextNation,economy:{...pool,adm:pool.adm-getLawChangeCost(state,nationId,law.category,law.id)},laws:{...nextNation.laws,[law.category]:law.id},lawCooldowns:{...nextNation.lawCooldowns,[law.category]:state.turnNumber+LAW_CHANGE_COOLDOWN_TURNS}}};
    const advisorPool=nextNation.isAtWar?'mil':'adm';
    if(!nextNation.advisors?.[advisorPool] && (pool.gold || 0)>500 && (nextNation.lastNetIncome || 0)>20){
      const advisor=generateAdvisorCandidates(nationId,createRng(fnv1a(nationId+state.turnNumber)))[advisorPool].sort((a,b)=>a.level-b.level)[0];
      if(nextNation.lastNetIncome>getAdvisorSalary(advisor.level)*3)return {nation:{...nextNation,advisors:{...nextNation.advisors,[advisorPool]:advisor},economy:{...pool,gold:pool.gold-getAdvisorHireCost(advisor.level)}}};
    }
  }
  if (stabilityResult) {
    nextNation = stabilityResult;
  } else {
    const govResult = tryAdoptOrReformGovernment(state, nextNation);
    if (govResult) {
      nextNation = govResult;
    } else {
      const buildResult = tryConstructBuilding(state, nextNation, regions);
      if (buildResult) {
        nextNation = buildResult.nation;
        regions[buildResult.regionId] = buildResult.updatedRegion;
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

  // `id` is kept, not stripped: every nation record already carries its own `id` (createInitialState
  // sets it), so stripping it here deleted the REAL field on every AI think — after a few turns most
  // nations had no `id`, and every player diplomacy action silently no-oped (gameReducer.js looks the
  // target up by `nation.id`).
  return { nation: nextNation };
};

// Real recruitment cost for an AI nation once it has a real economy (plan §M16: "Tier 1 recruits
// from treasury and manpower with the same costs"), used by aiLogic.js's processAIRecruitment in
// place of the old flat abstract-militaryStrength debit once a nation's economy pool exists.
export const canAffordAIRecruit = (nation, state, ageId) => {
  const costs = state ? getRecruitUnitCost(state, ageId, nation.id) : ACTION_COSTS.recruitUnit;
  const pool = nation.economy;
  const reserve=Math.max(0,-(nation.lastNetIncome || 0)*3);
  return !!pool && canAfford(pool, costs) && (pool.gold || 0)-(costs.gold || 0)>=reserve;
};
export const applyAIRecruitCost = (nation, state, ageId) => {
  const costs = state ? getRecruitUnitCost(state, ageId, nation.id) : ACTION_COSTS.recruitUnit;
  const pool = nation.economy;
  return { ...nation, economy: applyCosts(pool, costs) };
};

export const settleAIUpkeep = (state, nationId, income, ownedUnits = null) => {
  const nation = state.nations[nationId];
  const balance = calcNationBalance(state, nationId, income, ownedUnits);
  const expenses = Object.values(balance.expenses).reduce((a,b)=>a+b,0);
  const gold = (nation.economy.gold || 0) - expenses;
  if (gold >= 0) return { ...nation, economy: { ...nation.economy, gold }, lastNetIncome: balance.net };
  const loans = nation.loans || [];
  if (loans.length < getLoanCapacity(state, nationId)) {
    const principal = Math.max(200, -gold);
    return { ...nation, economy: { ...nation.economy, gold: gold + principal }, loans: [...loans, { id: 'ai_loan_' + nationId + '_' + state.turnNumber, principal, interestRate: getLoanInterestRate(state, nationId), takenTurn: state.turnNumber }], lastNetIncome: balance.net };
  }
  const bankrupt = applyBankruptcy(nation, state.regions, nationId, state.turnNumber);
  Object.assign(state.regions, bankrupt.regions);
  return { ...bankrupt.nation, economy: { ...nation.economy, gold: 0 }, lastNetIncome: balance.net };
};
