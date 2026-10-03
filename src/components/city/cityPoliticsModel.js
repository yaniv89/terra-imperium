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
