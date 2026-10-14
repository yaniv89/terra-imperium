// src/components/city/cityPoliticsModel.js
// The city sheet's Politics and Buildings tabs (plans/civ-map-rework.md E4), as pure models the
// panels render and the tests check: loyalty with its parts, the culture shares, why unrest moves
// (the same inputs resolveTurn's unrest drift reads), the governor and who could be seated, the
// disaster in progress, and the building lines with their next tier.
import { TECH_TREE } from '../../data/techTree';
import { getTiles } from '../../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { TAX_RATES } from '../../data/taxRates';
import { loyaltyOf, loyaltyTarget, cultureOf } from '../../engine/loyalty';
import { amenitiesOf, AMENITY_UNREST_PER_MISSING, hasSeaCoast } from '../../engine/world/cities';
import { cityLive, buildQuote, growthView, investInGrowth } from '../../engine/cityEconomy';
import { buildingEffect } from '../../engine/cityEffects';
import { investmentOf } from '../../engine/development';
import { infrastructureCosts, defensesCosts, growthCosts } from '../../engine/spending';
import { groupOfCity, governorOf, governorChoices, GOVERNOR_FOOD, GOVERNOR_PRODUCTION_MULT, GOVERNOR_CULTURE, GOVERNOR_LOYALTY, UNGOVERNED_LOYALTY, GOVERNOR_UNREST_MULT } from '../../engine/governors';
import { getModifier, getRegionModifier, getNationBonusTotal } from '../../engine/modifiers/sheet';
import { WAR_WEARINESS_FROM, WAR_WEARINESS_SCALE } from '../../engine/resolveTurn';
import { canBuildTier, getBuildingTierCost } from '../../data/buildings';
import { getResearched } from '../../engine/nationState';
import { ActionTypes } from '../../data/types';
import { ACTION_COSTS, CLIMATE_RESILIENCE_MAX } from '../../data/actionCosts';
import { REBEL_OWNER_ID, REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD } from '../../data/rebellion';
import { REGIONS_DATA } from '../../data/regions';
import { getDepositsFor } from '../../data/deposits';
import { EXTRACTION_BUILDINGS, canBuildExtraction } from '../../data/buildings';
import { getEffectiveAgeId } from '../../data/ages';
import { DEVASTATION_DECAY } from '../../engine/aftermath';
import { DEV_TYPE_IDS, DEV_TYPE_POOL, getDevelopProvinceCost, getTotalDev } from '../../engine/development';
import { canAfford, getSupplyCapacity } from '../../utils/helpers';

export const UNREST_CONTROL_THRESHOLD = 50;
export const UNREST_RISE_PER_TURN = 3;
export const UNREST_FALL_PER_TURN = 1;

const r1 = (v) => Math.round(v * 10) / 10;

/** Why this city's unrest moves each turn: [{ id, label, value }] (positive raises unrest). */
export const unrestReasons = (state, city) => {
  const owner = state.nations?.[city.owner];
  const out = [];
  out.push({ id: 'control', label: (city.control || 0) < UNREST_CONTROL_THRESHOLD ? `Control under ${UNREST_CONTROL_THRESHOLD}%` : 'Order kept', value: (city.control || 0) < UNREST_CONTROL_THRESHOLD ? UNREST_RISE_PER_TURN : -UNREST_FALL_PER_TURN });
  const stability = city.owner === state.playerNationId
    ? getModifier(state, city.owner, 'national.stabilityBonus').total
    : getNationBonusTotal(owner, 'stabilityBonus') + (owner?.stability || 0) + ((owner?.legitimacy ?? 50) < 50 && owner?.ruler ? -1 : 0);
  if (stability) out.push({ id: 'stability', label: 'National stability', value: -r1(stability) });
  const local = getRegionModifier(state, city.id, 'local.stabilityBonus').total;
  if (local) out.push({ id: 'local', label: 'Buildings here', value: -r1(local) });
  const tax = TAX_RATES[owner?.taxRate]?.unrestDeltaPerTurn || 0;
  if (tax) out.push({ id: 'tax', label: `${owner.taxRate} taxes`, value: tax });
  const weariness = Math.max(0, ((owner?.warExhaustion || 0) - WAR_WEARINESS_FROM) / WAR_WEARINESS_SCALE);
  if (weariness) out.push({ id: 'war', label: 'War weariness', value: r1(weariness) });
  const amen = amenitiesOf(city, { luxuries: (city.lastYields?.luxuries || []).length });
  if (amen.net < 0) out.push({ id: 'amenities', label: `${-amen.net} amenit${amen.net === -1 ? 'y' : 'ies'} short`, value: AMENITY_UNREST_PER_MISSING * -amen.net });
  if (city.integratingUntil != null && city.integratingUntil > (state.turnNumber || 0)) out.push({ id: 'integrating', label: 'Integration', value: -7 });
  if (owner?.governors && governorOf(state, city.owner, city.id)) out.push({ id: 'governor', label: 'A governor keeps order', value: null, note: `unrest x${GOVERNOR_UNREST_MULT}` });
  return out;
};

/** The model for the Politics tab, or null without a city. */
export const cityPoliticsModel = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city) return null;
  const me = state.playerNationId;
  const mine = city.owner === me;
  const nation = state.nations?.[city.owner];
  const t = loyaltyTarget(state, city);
  const loyaltyParts = [
    { id: 'people', label: 'The people', value: t.fromShare },
    { id: 'garrison', label: 'Garrison', value: t.garrison },
    { id: 'amenities', label: 'Amenities', value: t.amenities },
    { id: 'conquered', label: 'Recently conquered', value: t.conquered },
    { id: 'capitalLost', label: 'Capital lost', value: t.capitalLost },
    { id: 'governor', label: 'Governor', value: t.governor },
    { id: 'law', label: 'Laws', value: t.law },
    { id: 'wonder', label: 'Wonder', value: t.wonder }
  ].filter((p) => p.value);
  const culture = Object.entries(cultureOf(city)).sort((a, b) => b[1] - a[1]).map(([id, share]) => ({ nationId: id, name: state.nations?.[id]?.name || id, share: Math.round(share * 100) }));
  const group = city.owner ? groupOfCity(state, city.owner, cityId) : null;
  const governor = city.owner ? governorOf(state, city.owner, cityId) : null;
  const pending = group && nation?.governors?.[group.seat] && !governor ? nation.governors[group.seat] : null;
  const candidates = mine && group ? governorChoices(nation) : [];
  const turn = state.turnNumber || 0;
  const disaster = city.disaster && city.disaster.until >= turn ? { kind: city.disaster.kind, turnsLeft: city.disaster.until - turn } : null;
  return {
    cityId, name: city.name, mine, ownerName: nation?.name || city.owner || 'Free city',
    loyalty: loyaltyOf(city), loyaltyTarget: t.total, loyaltyParts, culture,
    unrest: r1(city.unrest || 0), unrestReasons: unrestReasons(state, city),
    group: group ? { seat: group.seat, seatName: state.regions[group.seat]?.name || group.seat, cities: group.cities.length } : null,
    governor: governor ? { id: governor.id, name: governor.name, skill: governor.skill, effects: `+${GOVERNOR_FOOD} food, +${Math.round(GOVERNOR_PRODUCTION_MULT * 100)}% production, +${GOVERNOR_CULTURE} culture, +${GOVERNOR_LOYALTY + (governor.skill || 1)} loyalty, less unrest` } : null,
    pending: pending ? { name: pending.name, ready: pending.ready } : null,
    ungovernedLoyalty: group && !governor && !pending && (mine || nation?.governors) ? UNGOVERNED_LOYALTY : 0,
    candidates,
    disaster
  };
};

/** The Buildings tab: every line with what stands and what comes next. */
export const cityBuildingsModel = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city) return null;
  const tiles = getTiles();
  const researched = new Set(getResearched(state, city.owner));
  const queued = new Set([city.production?.current, ...(city.production?.queue || [])].filter((i) => i?.kind === 'building').map((i) => `${i.category}:${i.tier}`));
  const live = cityLive(state, cityId);
  return Object.entries(BUILDING_CATEGORIES).map(([category, cat]) => {
    const tier = city.buildings?.categories?.[category] ?? -1;
    const next = cat.tiers[tier + 1] || null;
    // The sea beside the centre (cities.js hasSeaCoast): a river or an oasis is no coast (I040).
    const coastal = !cat.coastalOnly || hasSeaCoast(tiles, city);
    // The cost and the turns are the queue's own (cityEconomy.js); the effect lines are measured
    // on this city (cityEffects.js), never read from the data table (I043).
    const quote = next ? buildQuote(state, cityId, { kind: 'building', category, tier: tier + 1 }, live) : null;
    return {
      category, label: cat.label,
      built: cat.tiers.slice(0, tier + 1).map((t) => t.name),
      standing: tier >= 0 ? buildingEffect(state, cityId, category, tier, -1).text : null,
      next: next ? {
        name: next.name, cost: quote ? quote.cost : getBuildingTierCost(category, tier + 1), turns: quote ? quote.turns : null,
        effect: buildingEffect(state, cityId, category, tier + 1).text,
        canBuild: coastal && canBuildTier(category, researched, tier + 1), queued: queued.has(`${category}:${tier + 1}`),
        // Nothing to tap where the city can never build it: the row says why instead (I040).
        blocked: !coastal,
        needs: !coastal ? 'a sea coast' : !canBuildTier(category, researched, tier + 1) ? (TECH_TREE[next.requiresTech]?.name || 'a technology') : null,
        needsTech: !coastal || canBuildTier(category, researched, tier + 1) ? null : next.requiresTech
      } : null
    };
  });
};

// --- The crown's actions in a city (the old province Overview tab, plan E4) -------------------
// Each: { id, label, description, costs, enabled, reason, actionType, payload }. Pure.
export const crownActions = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== state.playerNationId) return [];
  const me = state.playerNationId;
  const rebels = Object.values(state.units || {}).filter((u) => u.ownerId === REBEL_OWNER_ID && u.regionId === cityId);
  const garrison = Object.values(state.units || {}).some((u) => u.ownerId === me && u.domain === 'land' && u.regionId === cityId);
  const capital = state.nations?.[me]?.capitalRegionId;
  const out = [];
  if (rebels.length) out.push({ id: 'suppressRebellion', label: `Suppress the rebellion (${rebels.length} rebel unit${rebels.length === 1 ? '' : 's'})`, description: city.formerOwner ? `${Math.max(0, REVOLT_SUCCESS_TURNS - ((state.turnNumber || 0) - (rebels[0].spawnedTurn ?? state.turnNumber)))} turn(s) before ${state.nations?.[city.formerOwner]?.name || city.formerOwner} reclaims it` : 'Rebels hold out here', costs: ACTION_COSTS.suppressRebellion, enabled: garrison && canAfford(state.resources, ACTION_COSTS.suppressRebellion), reason: !garrison ? 'needs an army here' : null, actionType: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cityId }, danger: true });
  out.push({ id: 'gainControl', label: `Gain Control (${Math.round(city.control || 0)}%)`, description: 'Raise control here by 5', costs: ACTION_COSTS.gainControl, enabled: (city.control || 0) < 100 && canAfford(state.resources, ACTION_COSTS.gainControl), reason: (city.control || 0) >= 100 ? 'full control' : null, actionType: ActionTypes.GAIN_CONTROL, payload: { regionId: cityId } });
  out.push({ id: 'quellUnrest', label: `Quell Unrest (${r1(city.unrest || 0)})`, description: 'Suppress unrest here by 30 before it spreads', costs: ACTION_COSTS.quellUnrest, enabled: (city.unrest || 0) > 0 && canAfford(state.resources, ACTION_COSTS.quellUnrest), reason: (city.unrest || 0) <= 0 ? 'no unrest' : null, actionType: ActionTypes.QUELL_UNREST, payload: { regionId: cityId } });
  // Invest in growth (I032): what the gold buys, in the city's own terms, before it is spent. The
  // preview is the reducer's own step (cities.js addPeople), so a full bank is refused here too.
  const grow = populationPolicyPreview(state, cityId);
  out.push({ id: 'populationPolicy', label: 'Invest in growth', description: grow.text, costs: grow.costs, enabled: grow.effective && canAfford(state.resources, grow.costs), reason: grow.effective ? null : 'the food bank is full', actionType: ActionTypes.POPULATION_POLICY, payload: { regionId: cityId } });
  if (capital && capital !== cityId) out.push({ id: 'moveCapital', label: 'Move the capital here', description: city.conquest ? 'Relocates the capital (-1 stability: conquered land)' : 'Relocates the capital', costs: ACTION_COSTS.moveCapital, enabled: !city.occupiedBy && canAfford(state.resources, ACTION_COSTS.moveCapital), reason: city.occupiedBy ? 'occupied' : null, actionType: ActionTypes.MOVE_CAPITAL, payload: { regionId: cityId } });
  return out;
};

/** What Invest in growth would do now: { effective, before, after, threshold, housingFull, text }.
 * The people it adds are banked as food toward the next citizen, and the bank stays from turn to
 * turn; with housing full the bank fills but the city does not grow until it has room. */
export const populationPolicyPreview = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.size == null) return { effective: true, before: 0, after: 0, threshold: 0, housingFull: false, costs: ACTION_COSTS.populationPolicy, text: 'Invest in growth: more people, more gold and manpower here' };
  const costs = growthCosts(state, city); // by age, speed and size (spending.js)
  const next = investInGrowth(state, cityId);
  const g = growthView(state, cityId);
  const before = Math.floor(city.food || 0); const after = Math.floor(next.food || 0);
  const housingFull = g?.state === 'full';
  if (next === city) return { effective: false, before, after: before, threshold: g?.threshold || 0, housingFull, costs, text: `The food bank is full (${before}/${g?.threshold || 0}): there is nothing to buy. ${housingFull ? 'The city needs housing (a Food building) before it can grow.' : 'The city grows on its next food surplus.'}` };
  const people = Math.round((next.currentPopulation || 0) - (city.currentPopulation || 0));
  // The wait it saves: the same growth view on the city with the fuller bank.
  const gNext = g?.state === 'growing' ? growthView({ ...state, regions: { ...state.regions, [cityId]: next } }, cityId) : null;
  const sooner = gNext?.turns != null && g.turns != null ? g.turns - gNext.turns : 0;
  const tail = housingFull ? ' Housing is full: the food is kept, but the city will not grow until it has room (a Food building).' : g?.state === 'growing' ? ` It grows in ${gNext.turns} turn${gNext.turns === 1 ? '' : 's'} instead of ${g.turns}${sooner > 0 ? '' : ' (no sooner)'}.` : '';
  return { effective: true, before, after, threshold: g?.threshold || 0, housingFull, costs, sooner, text: `Adds ${after - before || 'a little'} food to the bank toward size ${city.size + 1}: ${before} to ${after} of ${g?.threshold || 0}${people > 0 ? ` (about ${people.toLocaleString()} people)` : ''}. The bank is kept from turn to turn.${tail}` };
};

/** Notes the crown should see: conquered and at risk, devastated. */
export const crownNotes = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city) return [];
  const out = [];
  if (city.formerOwner && city.owner === state.playerNationId) out.push({ id: 'conquered', tone: 'amber', text: `Conquered from ${state.nations?.[city.formerOwner]?.name || city.formerOwner}: it can revolt back until control reaches ${INTEGRATION_CONTROL_THRESHOLD}% (${Math.round(city.control || 0)}% now).` });
  if ((city.devastation || 0) > 0) out.push({ id: 'devastation', tone: 'red', text: `Devastated by war: ${Math.round(city.devastation)}%. Income -${Math.round(city.devastation / 2)}% and slower growth; recovers about ${DEVASTATION_DECAY}% a turn without further fighting.` });
  return out;
};

// --- Development (the old province Economy tab, plan E4): power-point investments ------------
// What one point of each kind gives a city (development.js applyDevelopment, cities.js cityYields).
export const DEV_TYPE_GIVES = {
  tax: '+1 base gold in this city every turn.',
  production: '+1 base production in this city every turn (and the gold every hammer pays).',
  manpower: '+1 manpower development: more manpower every turn.'
};
export const cityDevelopmentModel = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.owner !== state.playerNationId) return null;
  const me = state.playerNationId;
  const mult = getModifier(state, me, 'national.developmentCost').total;
  const cost = getDevelopProvinceCost(city, mult);
  const ageId = getEffectiveAgeId(state.age, state.techAgeId);
  const deposits = getDepositsFor(REGIONS_DATA[cityId]?.startOwner || city.startOwner).map((resourceId) => ({
    resourceId, name: EXTRACTION_BUILDINGS[resourceId]?.name || resourceId, built: !!city.buildings?.extraction?.[resourceId],
    enabled: !city.buildings?.extraction?.[resourceId] && canBuildExtraction(resourceId, ageId) && canAfford(state.resources, ACTION_COSTS.developResourceSite)
  }));
  // Bought development lasts (development.js, I031): the row says what a point gives and how many
  // the city already holds.
  const inv = investmentOf(city);
  const rows = DEV_TYPE_IDS.map((devType) => ({ id: `dev:${devType}`, devType, label: `Develop ${devType[0].toUpperCase()}${devType.slice(1)} (${city.dev?.[devType] || 0})`, description: `${DEV_TYPE_GIVES[devType]}${city.size != null ? ` Lasting${inv[devType] ? `: ${inv[devType]} bought here so far` : ''}.` : ''}`, bought: inv[devType], costs: { [DEV_TYPE_POOL[devType]]: cost }, enabled: (state.resources[DEV_TYPE_POOL[devType]] || 0) >= cost, actionType: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cityId, devType } }));
  // Priced by age, speed and the level already built (spending.js, I021).
  const infra = infrastructureCosts(state, city); const walls = defensesCosts(state, city);
  rows.push({ id: 'infrastructure', label: `Infrastructure (level ${city.currentInfrastructure || 0}, supply ${getSupplyCapacity(city.currentInfrastructure)})`, description: 'Raises supply capacity and output', costs: infra, enabled: (city.currentInfrastructure || 0) < 10 && canAfford(state.resources, infra), actionType: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cityId } });
  rows.push({ id: 'defenses', label: `Defenses (level ${city.defenseLevel || 0})`, description: 'Strengthens the city against invasion', costs: walls, enabled: (city.defenseLevel || 0) < 10 && canAfford(state.resources, walls), actionType: ActionTypes.BUILD_DEFENSES, payload: { regionId: cityId } });
  if (ageId === 'modern') rows.push({ id: 'resilience', label: `Climate resilience (${city.climateResilience || 0}/${CLIMATE_RESILIENCE_MAX})`, description: 'Less exposure to weather and harvest disasters', costs: ACTION_COSTS.buildClimateResilience, enabled: (city.climateResilience || 0) < CLIMATE_RESILIENCE_MAX && canAfford(state.resources, ACTION_COSTS.buildClimateResilience), actionType: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cityId } });
  return { rows, deposits, totalDev: getTotalDev(city) };
};
