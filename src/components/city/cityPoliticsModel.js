// src/components/city/cityPoliticsModel.js
// The city sheet's Politics and Buildings tabs (plans/civ-map-rework.md E4), as pure models the
// panels render and the tests check: loyalty with its parts, the culture shares, why unrest moves
// (the same inputs resolveTurn's unrest drift reads), the governor and who could be seated, the
// estates' land in this city, the disaster in progress, and the building lines with their next tier.
import { getTiles } from '../../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { TAX_RATES } from '../../data/taxRates';
import { ESTATE_LABELS } from '../../data/estates';
import { loyaltyOf, loyaltyTarget, cultureOf } from '../../engine/loyalty';
import { amenitiesOf, AMENITY_UNREST_PER_MISSING } from '../../engine/world/cities';
import { groupOfCity, governorOf, governorChoices, GOVERNOR_FOOD, GOVERNOR_PRODUCTION_MULT, GOVERNOR_CULTURE, GOVERNOR_LOYALTY, UNGOVERNED_LOYALTY, GOVERNOR_UNREST_MULT } from '../../engine/governors';
import { estateHoldings, NOBLE_LEVY_PER_TILE, CLERGY_CULTURE_PER_TILE, BURGHER_TRADE_GOLD_PER_TILE } from '../../engine/estateLand';
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
    { id: 'law', label: 'Laws', value: t.law }
  ].filter((p) => p.value);
  const culture = Object.entries(cultureOf(city)).sort((a, b) => b[1] - a[1]).map(([id, share]) => ({ nationId: id, name: state.nations?.[id]?.name || id, share: Math.round(share * 100) }));
  const group = city.owner ? groupOfCity(state, city.owner, cityId) : null;
  const governor = city.owner ? governorOf(state, city.owner, cityId) : null;
  const pending = group && nation?.governors?.[group.seat] && !governor ? nation.governors[group.seat] : null;
  const candidates = mine && group ? governorChoices(nation) : [];
  const holdings = mine ? estateHoldings(state) : null;
  const estates = holdings ? Object.entries(holdings.byCity[cityId] || {}).map(([estateId, tiles]) => ({
    estateId, label: ESTATE_LABELS[estateId] || estateId, tiles, worked: holdings.workedByCity[cityId]?.[estateId] || 0,
    gives: estateId === 'nobility' ? `${NOBLE_LEVY_PER_TILE} manpower per worked tile` : estateId === 'clergy' ? `${CLERGY_CULTURE_PER_TILE} culture per worked tile` : estateId === 'burghers' ? `${BURGHER_TRADE_GOLD_PER_TILE} gold per worked tile with a trade pact` : ''
  })) : [];
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
    estates,
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
  return Object.entries(BUILDING_CATEGORIES).map(([category, cat]) => {
    const tier = city.buildings?.categories?.[category] ?? -1;
    const next = cat.tiers[tier + 1] || null;
    const coastal = !cat.coastalOnly || !!tiles.coastal[city.tile];
    return {
      category, label: cat.label,
      built: cat.tiers.slice(0, tier + 1).map((t) => t.name),
      next: next ? { name: next.name, cost: getBuildingTierCost(category, tier + 1), canBuild: coastal && canBuildTier(category, researched, tier + 1), queued: queued.has(`${category}:${tier + 1}`), needs: !coastal ? 'a coast' : !canBuildTier(category, researched, tier + 1) ? 'a technology' : null } : null
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
  out.push({ id: 'populationPolicy', label: 'Population Policy', description: 'Invest in growth: more people, more gold and manpower here', costs: ACTION_COSTS.populationPolicy, enabled: canAfford(state.resources, ACTION_COSTS.populationPolicy), reason: null, actionType: ActionTypes.POPULATION_POLICY, payload: { regionId: cityId } });
  if (capital && capital !== cityId) out.push({ id: 'moveCapital', label: 'Move the capital here', description: city.conquest ? 'Relocates the capital (-1 stability: conquered land)' : 'Relocates the capital', costs: ACTION_COSTS.moveCapital, enabled: !city.occupiedBy && canAfford(state.resources, ACTION_COSTS.moveCapital), reason: city.occupiedBy ? 'occupied' : null, actionType: ActionTypes.MOVE_CAPITAL, payload: { regionId: cityId } });
  return out;
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
  const rows = DEV_TYPE_IDS.map((devType) => ({ id: `dev:${devType}`, devType, label: `Develop ${devType[0].toUpperCase()}${devType.slice(1)} (${city.dev?.[devType] || 0})`, description: `+1 ${devType} development`, costs: { [DEV_TYPE_POOL[devType]]: cost }, enabled: (state.resources[DEV_TYPE_POOL[devType]] || 0) >= cost, actionType: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cityId, devType } }));
  rows.push({ id: 'infrastructure', label: `Infrastructure (level ${city.currentInfrastructure || 0}, supply ${getSupplyCapacity(city.currentInfrastructure)})`, description: 'Raises supply capacity and output', costs: ACTION_COSTS.buildInfrastructure, enabled: (city.currentInfrastructure || 0) < 10 && canAfford(state.resources, ACTION_COSTS.buildInfrastructure), actionType: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cityId } });
  rows.push({ id: 'defenses', label: `Defenses (level ${city.defenseLevel || 0})`, description: 'Strengthens the city against invasion', costs: ACTION_COSTS.buildDefenses, enabled: (city.defenseLevel || 0) < 10 && canAfford(state.resources, ACTION_COSTS.buildDefenses), actionType: ActionTypes.BUILD_DEFENSES, payload: { regionId: cityId } });
  if (ageId === 'modern') rows.push({ id: 'resilience', label: `Climate resilience (${city.climateResilience || 0}/${CLIMATE_RESILIENCE_MAX})`, description: 'Less exposure to weather and harvest disasters', costs: ACTION_COSTS.buildClimateResilience, enabled: (city.climateResilience || 0) < CLIMATE_RESILIENCE_MAX && canAfford(state.resources, ACTION_COSTS.buildClimateResilience), actionType: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cityId } });
  return { rows, deposits, totalDev: getTotalDev(city) };
};
