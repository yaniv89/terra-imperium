// src/components/city/cityPoliticsModel.js
// The city sheet's Politics and Buildings tabs (plans/civ-map-rework.md E4), as pure models the
// panels render and the tests check: loyalty with its parts, the culture shares, why unrest moves
// (the same inputs resolveTurn's unrest drift reads), the governor and who could be seated, the
// disaster in progress, and the building lines with their next tier.
import { TECH_TREE } from '../../data/techTree';
import { techName, extractionName, buildingCategoryLabel, buildingTierName, taxRateName } from '../../i18n/gameText';
import { t as tNow, getLanguage } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import { getTiles } from '../../data/geo/tiles';
import { BUILDING_CATEGORIES } from '../../data/buildings';
import { TAX_RATES } from '../../data/taxRates';
import { loyaltyOf, loyaltyTarget, cultureOf, loyaltyForecast } from '../../engine/loyalty';
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
import { regionDeposits } from '../../data/deposits';
import { EXTRACTION_BUILDINGS, canBuildExtraction } from '../../data/buildings';
import { getEffectiveAgeId, isAgeAtLeast } from '../../data/ages';
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
  out.push({ id: 'control', label: (city.control || 0) < UNREST_CONTROL_THRESHOLD ? tNow('cy.un.control', { n: UNREST_CONTROL_THRESHOLD }) : tNow('cy.un.order'), value: (city.control || 0) < UNREST_CONTROL_THRESHOLD ? UNREST_RISE_PER_TURN : -UNREST_FALL_PER_TURN });
  const stability = city.owner === state.playerNationId
    ? getModifier(state, city.owner, 'national.stabilityBonus').total
    : getNationBonusTotal(owner, 'stabilityBonus') + (owner?.stability || 0) + ((owner?.legitimacy ?? 50) < 50 && owner?.ruler ? -1 : 0);
  if (stability) out.push({ id: 'stability', label: tNow('cy.un.stability'), value: -r1(stability) });
  const local = getRegionModifier(state, city.id, 'local.stabilityBonus').total;
  if (local) out.push({ id: 'local', label: tNow('cy.un.buildings'), value: -r1(local) });
  const tax = TAX_RATES[owner?.taxRate]?.unrestDeltaPerTurn || 0;
  if (tax) out.push({ id: 'tax', label: tNow('cy.un.tax', { rate: taxRateName(owner.taxRate, owner.taxRate) }), value: tax });
  const weariness = Math.max(0, ((owner?.warExhaustion || 0) - WAR_WEARINESS_FROM) / WAR_WEARINESS_SCALE);
  if (weariness) out.push({ id: 'war', label: tNow('cy.un.war'), value: r1(weariness) });
  const amen = amenitiesOf(city, { luxuries: (city.lastYields?.luxuries || []).length });
  if (amen.net < 0) out.push({ id: 'amenities', label: tNow('cy.un.amenities', { count: -amen.net }), value: AMENITY_UNREST_PER_MISSING * -amen.net });
  if (city.integratingUntil != null && city.integratingUntil > (state.turnNumber || 0)) out.push({ id: 'integrating', label: tNow('cy.un.integration'), value: -7 });
  if (owner?.governors && governorOf(state, city.owner, city.id)) out.push({ id: 'governor', label: tNow('cy.un.governor'), value: null, note: tNow('cy.un.governorNote', { x: GOVERNOR_UNREST_MULT }) });
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
    { id: 'people', label: tNow('cy.lo.people'), value: t.fromShare },
    { id: 'garrison', label: tNow('cy.lo.garrison'), value: t.garrison },
    { id: 'amenities', label: tNow('cy.lo.amenities'), value: t.amenities },
    { id: 'conquered', label: tNow('cy.lo.conquered'), value: t.conquered },
    { id: 'capitalLost', label: tNow('cy.lo.capitalLost'), value: t.capitalLost },
    { id: 'governor', label: tNow('cy.lo.governor'), value: t.governor },
    { id: 'law', label: tNow('cy.lo.laws'), value: t.law },
    { id: 'wonder', label: tNow('cy.lo.wonder'), value: t.wonder }
  ].filter((p) => p.value);
  const culture = Object.entries(cultureOf(city)).sort((a, b) => b[1] - a[1]).map(([id, share]) => ({ nationId: id, name: nameNow('nation', id, state.nations?.[id]?.name || id), share: Math.round(share * 100) }));
  const group = city.owner ? groupOfCity(state, city.owner, cityId) : null;
  const governor = city.owner ? governorOf(state, city.owner, cityId) : null;
  const pending = group && nation?.governors?.[group.seat] && !governor ? nation.governors[group.seat] : null;
  const candidates = mine && group ? governorChoices(nation) : [];
  const turn = state.turnNumber || 0;
  const disaster = city.disaster && city.disaster.until >= turn ? { kind: city.disaster.kind, turnsLeft: city.disaster.until - turn } : null;
  // Where loyalty is heading and what holds it (I127): the occupation grace, and the turns left before it could break away.
  const f = city.owner ? loyaltyForecast(state, city) : null;
  const forecast = f ? {
    grace: f.graceLeft ? tNow('cy.fc.grace', { count: f.graceLeft }) : null,
    danger: f.breaksIn != null ? `${tNow('cy.fc.danger', { count: f.breaksIn })}${mine && f.garrison.gain ? ` ${tNow('cy.fc.garrison', { gain: f.garrison.gain, cap: f.garrison.cap })}` : ''}` : null
  } : null;
  return {
    cityId, name: city.name, mine, ownerName: nation?.name || city.owner || tNow('cy.freeCity'),
    loyalty: loyaltyOf(city), loyaltyTarget: t.total, loyaltyParts, culture,
    unrest: r1(city.unrest || 0), unrestReasons: unrestReasons(state, city),
    group: group ? { seat: group.seat, seatName: nameNow('city', null, state.regions[group.seat]?.name || group.seat), cities: group.cities.length } : null,
    governor: governor ? { id: governor.id, name: nameNow('person', null, governor.name), skill: governor.skill, effects: tNow('cy.gov.effects', { food: GOVERNOR_FOOD, prod: Math.round(GOVERNOR_PRODUCTION_MULT * 100), culture: GOVERNOR_CULTURE, loyalty: GOVERNOR_LOYALTY + (governor.skill || 1) }) } : null,
    pending: pending ? { name: nameNow('person', null, pending.name), ready: pending.ready } : null,
    ungovernedLoyalty: group && !governor && !pending && (mine || nation?.governors) ? UNGOVERNED_LOYALTY : 0,
    candidates,
    disaster,
    forecast
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
      category, label: buildingCategoryLabel(category, cat.label),
      built: cat.tiers.slice(0, tier + 1).map((t, i) => buildingTierName(category, i, t.name)),
      standing: tier >= 0 ? buildingEffect(state, cityId, category, tier, -1).text : null,
      next: next ? {
        name: buildingTierName(category, tier + 1, next.name), cost: quote ? quote.cost : getBuildingTierCost(category, tier + 1), turns: quote ? quote.turns : null,
        effect: buildingEffect(state, cityId, category, tier + 1).text,
        canBuild: coastal && canBuildTier(category, researched, tier + 1), queued: queued.has(`${category}:${tier + 1}`),
        // Nothing to tap where the city can never build it: the row says why instead (I040).
        blocked: !coastal,
        needs: !coastal ? tNow('cy.seaCoast') : !canBuildTier(category, researched, tier + 1) ? techName(next.requiresTech, TECH_TREE[next.requiresTech]?.name || tNow('cy.aTechnology')) : null,
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
  if (rebels.length) out.push({ id: 'suppressRebellion', label: tNow('cy.crown.suppress', { count: rebels.length }), description: city.formerOwner ? tNow('cy.crown.reclaims', { n: Math.max(0, REVOLT_SUCCESS_TURNS - ((state.turnNumber || 0) - (rebels[0].spawnedTurn ?? state.turnNumber))), owner: nameNow('nation', city.formerOwner, state.nations?.[city.formerOwner]?.name || city.formerOwner) }) : tNow('cy.crown.holdOut'), costs: ACTION_COSTS.suppressRebellion, enabled: garrison && canAfford(state.resources, ACTION_COSTS.suppressRebellion), reason: !garrison ? tNow('cy.crown.needsArmy') : null, actionType: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cityId }, danger: true });
  out.push({ id: 'gainControl', label: tNow('cy.crown.gain', { n: Math.round(city.control || 0) }), description: tNow('cy.crown.gainDesc'), costs: ACTION_COSTS.gainControl, enabled: (city.control || 0) < 100 && canAfford(state.resources, ACTION_COSTS.gainControl), reason: (city.control || 0) >= 100 ? tNow('cy.crown.fullControl') : null, actionType: ActionTypes.GAIN_CONTROL, payload: { regionId: cityId } });
  out.push({ id: 'quellUnrest', label: tNow('cy.crown.quell', { n: r1(city.unrest || 0) }), description: tNow('cy.crown.quellDesc'), costs: ACTION_COSTS.quellUnrest, enabled: (city.unrest || 0) > 0 && canAfford(state.resources, ACTION_COSTS.quellUnrest), reason: (city.unrest || 0) <= 0 ? tNow('cy.crown.noUnrest') : null, actionType: ActionTypes.QUELL_UNREST, payload: { regionId: cityId } });
  // Invest in growth (I032): what the gold buys, in the city's own terms, before it is spent. The
  // preview is the reducer's own step (cities.js addPeople), so a full bank is refused here too.
  const grow = populationPolicyPreview(state, cityId);
  out.push({ id: 'populationPolicy', label: tNow('cy.crown.grow'), description: grow.text, costs: grow.costs, enabled: grow.effective && canAfford(state.resources, grow.costs), reason: grow.effective ? null : tNow('cy.crown.bankFull'), actionType: ActionTypes.POPULATION_POLICY, payload: { regionId: cityId } });
  if (capital && capital !== cityId) out.push({ id: 'moveCapital', label: tNow('cy.crown.move'), description: city.conquest ? tNow('cy.crown.moveConquered') : tNow('cy.crown.moveDesc'), costs: ACTION_COSTS.moveCapital, enabled: !city.occupiedBy && canAfford(state.resources, ACTION_COSTS.moveCapital), reason: city.occupiedBy ? tNow('cy.crown.occupied') : null, actionType: ActionTypes.MOVE_CAPITAL, payload: { regionId: cityId } });
  return out;
};

/** What Invest in growth would do now: { effective, before, after, threshold, housingFull, text }.
 * The people it adds are banked as food toward the next citizen, and the bank stays from turn to
 * turn; with housing full the bank fills but the city does not grow until it has room. */
export const populationPolicyPreview = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || city.size == null) return { effective: true, before: 0, after: 0, threshold: 0, housingFull: false, costs: ACTION_COSTS.populationPolicy, text: tNow('cy.grow.generic') };
  const costs = growthCosts(state, city); // by age, speed and size (spending.js)
  const next = investInGrowth(state, cityId);
  const g = growthView(state, cityId);
  const before = Math.floor(city.food || 0); const after = Math.floor(next.food || 0);
  const housingFull = g?.state === 'full';
  if (next === city) return { effective: false, before, after: before, threshold: g?.threshold || 0, housingFull, costs, text: tNow('cy.grow.full', { before, threshold: g?.threshold || 0, tail: housingFull ? tNow('cy.grow.fullHousing') : tNow('cy.grow.fullSurplus') }) };
  const people = Math.round((next.currentPopulation || 0) - (city.currentPopulation || 0));
  // The wait it saves: the same growth view on the city with the fuller bank.
  const gNext = g?.state === 'growing' ? growthView({ ...state, regions: { ...state.regions, [cityId]: next } }, cityId) : null;
  const sooner = gNext?.turns != null && g.turns != null ? g.turns - gNext.turns : 0;
  const tail = housingFull ? ` ${tNow('cy.grow.housingFull')}` : g?.state === 'growing' ? ` ${tNow('cy.grow.sooner', { count: gNext.turns, was: g.turns, noSooner: sooner > 0 ? '' : ` ${tNow('cy.grow.noSooner')}` })}` : '';
  return { effective: true, before, after, threshold: g?.threshold || 0, housingFull, costs, sooner, text: `${tNow('cy.grow.adds', { food: after - before || tNow('cy.grow.aLittle'), size: city.size + 1, before, after, threshold: g?.threshold || 0, people: people > 0 ? ` ${tNow('cy.grow.people', { n: people.toLocaleString(getLanguage() === 'he' ? 'he-IL' : undefined) })}` : '' })}${tail}` };
};

/** Notes the crown should see: conquered and at risk, devastated. */
export const crownNotes = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city) return [];
  const out = [];
  if (city.formerOwner && city.owner === state.playerNationId) out.push({ id: 'conquered', tone: 'amber', text: tNow('cy.note.conquered', { owner: nameNow('nation', city.formerOwner, state.nations?.[city.formerOwner]?.name || city.formerOwner), threshold: INTEGRATION_CONTROL_THRESHOLD, now: Math.round(city.control || 0) }) });
  if ((city.devastation || 0) > 0) out.push({ id: 'devastation', tone: 'red', text: tNow('cy.note.devastated', { n: Math.round(city.devastation), income: Math.round(city.devastation / 2), decay: DEVASTATION_DECAY }) });
  return out;
};

// --- Development (the old province Economy tab, plan E4): power-point investments ------------
// What one point of each kind gives a city (development.js applyDevelopment, cities.js cityYields).
const DEV_GIVES_KEY = { tax: 'cy.dev.giveTax', production: 'cy.dev.giveProduction', manpower: 'cy.dev.giveManpower' };
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
  const deposits = regionDeposits(REGIONS_DATA[cityId] || city).map((resourceId) => ({
    resourceId, name: extractionName(resourceId, EXTRACTION_BUILDINGS[resourceId]?.name), built: !!city.buildings?.extraction?.[resourceId],
    enabled: !city.buildings?.extraction?.[resourceId] && canBuildExtraction(resourceId, ageId) && canAfford(state.resources, ACTION_COSTS.developResourceSite)
  }));
  // Bought development lasts (development.js, I031): the row says what a point gives and how many
  // the city already holds.
  const inv = investmentOf(city);
  const rows = DEV_TYPE_IDS.map((devType) => ({ id: `dev:${devType}`, devType, label: tNow(`cy.dev.develop.${devType}`, { n: city.dev?.[devType] || 0 }), description: `${tNow(DEV_GIVES_KEY[devType])}${city.size != null ? ` ${inv[devType] ? tNow('cy.dev.lastingBought', { n: inv[devType] }) : tNow('cy.dev.lasting')}` : ''}`, bought: inv[devType], costs: { [DEV_TYPE_POOL[devType]]: cost }, enabled: (state.resources[DEV_TYPE_POOL[devType]] || 0) >= cost, actionType: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cityId, devType } }));
  // Priced by age, speed and the level already built (spending.js, I021).
  const infra = infrastructureCosts(state, city); const walls = defensesCosts(state, city);
  rows.push({ id: 'infrastructure', label: tNow('cy.dev.infra', { level: city.currentInfrastructure || 0, supply: getSupplyCapacity(city.currentInfrastructure) }), description: tNow('cy.dev.infraDesc'), costs: infra, enabled: (city.currentInfrastructure || 0) < 10 && canAfford(state.resources, infra), actionType: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cityId } });
  rows.push({ id: 'defenses', label: tNow('cy.dev.defenses', { level: city.defenseLevel || 0 }), description: tNow('cy.dev.defensesDesc'), costs: walls, enabled: (city.defenseLevel || 0) < 10 && canAfford(state.resources, walls), actionType: ActionTypes.BUILD_DEFENSES, payload: { regionId: cityId } });
  if (isAgeAtLeast(ageId, 'modern')) rows.push({ id: 'resilience', label: tNow('cy.dev.resilience', { n: city.climateResilience || 0, max: CLIMATE_RESILIENCE_MAX }), description: tNow('cy.dev.resilienceDesc'), costs: ACTION_COSTS.buildClimateResilience, enabled: (city.climateResilience || 0) < CLIMATE_RESILIENCE_MAX && canAfford(state.resources, ACTION_COSTS.buildClimateResilience), actionType: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cityId } });
  return { rows, deposits, totalDev: getTotalDev(city) };
};
