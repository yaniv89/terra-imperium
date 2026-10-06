// src/engine/battleInputs.js
// The campaign inputs of a battle, computed ONCE and handed to both ways of fighting it: the
// commanded real-time battle (src/battle/setup/buildBattleSetup.js) and the honest auto-resolve
// (autoBattle.js). Master plan 6.1 ("Auto must be honest: fed by the same inputs") and the input
// rows of 6.7:
//   4  zone of control, local.fortLevel  already in each kind's context (siege.js); passed through
//   7  tile forts, the held tile, rivers already in the field context (fieldBattle.js); passed through
//   8  air turn-back                     the validators' withAirSupport (airPower.js) runs before
//                                        either mode sees the armies
//   9  encirclement and starvation       a starved city (sieges.js, encircled) starts with less food
//                                        and morale: STARVED_MORALE_LOSS, its stock read as supply
//                                        STARVED_SUPPLY
//   10 wonders raising wall HP           the walls' HP share (sieges.js siegeHpOf / siegeMaxHp, which
//                                        count a fortress wonder) scales the walls' effect
//   11 plague                            a unit whose city has the plague (i >= PLAGUE_VISIBLE_I)
//                                        starts with PLAGUE_MORALE_LOSS less morale
//   12 supply                            each unit's supply meter (supplyMeter.js): low supply costs
//                                        up to SUPPLY_MORALE_LOSS morale and shrinks the side's
//                                        starting stockpile (R1's stockMult, economySetup.js)
//   16 allies and vassals                co-belligerent allies' and vassals' idle land units within
//                                        REINFORCE_RINGS stand by as reinforcements (RTS plan 5.3)
//   18 bankruptcy desertion              the armies are read live from state.units, after the
//                                        turn's desertion (resolveTurn economy phase): never a snapshot
//   19 the city's militia                a city assault adds the city's militia to the defenders:
//                                        MILITIA_PER_HOUSING strength per point of its housing (its
//                                        real houses plus the town hall, cityManifest.js), at most
//                                        MILITIA_MAX, in units of MILITIA_UNIT. They are not campaign
//                                        units: they exist for the battle, and their dead are the
//                                        city's people (aftermath.js casualty scars on the city).
// Morale floors at MIN_START_MORALE so no input alone routs a unit before the battle. Pure.
import { siegeHpOf, siegeMaxHp, wallsOf } from './sieges';
import { getRegionModifier } from './modifiers/sheet';
import { cityHousingCap } from './cityManifest';
import { getReinforcementSources } from './invasion';
import { unitsWithinRings, REINFORCE_RINGS } from './armies';
import { isWarBetween } from './diplomacy';

export const SUPPLY_MORALE_LOSS = 20;
export const STARVED_MORALE_LOSS = 15;
export const STARVED_SUPPLY = 0.4;
export const PLAGUE_MORALE_LOSS = 10;
export const PLAGUE_VISIBLE_I = 0.02;
export const MIN_START_MORALE = 25;
export const MILITIA_PER_HOUSING = 2;
export const MILITIA_MAX = 600;
export const MILITIA_UNIT = 250;
export const MILITIA_MORALE = 70;
export const DEV_FULL_SIZE = 12; // a city of this size counts as fully developed for the battle stockpile

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** A city's development for the battle stockpile, 0..1, from its size. */
export const cityDevelopment = (city) => (city ? clamp01(((city.size || 1) - 1) / (DEV_FULL_SIZE - 1)) : 0);

/** The mean supply meter of the land units that carry one, 0..1 (full when none say). */
export const sideSupply = (units = []) => {
  const list = units.filter((u) => u && u.strength > 0 && u.domain !== 'naval' && !u.militia);
  if (!list.length) return 1;
  return list.reduce((s, u) => s + clamp01((u.supply ?? 100) / 100), 0) / list.length;
};

/** Is the city starving under an encircling siege (sieges.js)? */
export const isStarved = (city) => !!city?.siege?.encircled;

/** Does the city carry the plague visibly (plague.js)? */
export const hasPlague = (city) => (city?.plague?.i || 0) >= PLAGUE_VISIBLE_I;

/** The walls' remaining HP share, 0..1: a siege in progress has battered them (a fortress wonder raises the max). */
export const wallsHpRatio = (state, city) => (city ? clamp01(siegeHpOf(city, state.greatProjects) / Math.max(1, siegeMaxHp(city, state.greatProjects))) : 1);

/**
 * The walls' damage reduction after a siege battered them: breached walls keep half their effect.
 * `reduction` is the context's defenderDamageReductionMultiplier (1 = none).
 */
export const batteredReduction = (reduction, hpRatio) => 1 - (1 - (reduction ?? 1)) * (0.5 + 0.5 * clamp01(hpRatio ?? 1));

/** One unit's starting morale under its conditions. */
export const conditionUnit = (state, u, { starved = false } = {}) => {
  if (!u || u.domain === 'naval' || u.classId === 'air') return u;
  let loss = 0;
  if (u.supply != null) loss += Math.round(SUPPLY_MORALE_LOSS * (1 - clamp01(u.supply / 100)));
  if (starved) loss += STARVED_MORALE_LOSS;
  if (hasPlague(state.regions?.[u.regionId])) loss += PLAGUE_MORALE_LOSS;
  if (loss <= 0) return u;
  const morale = u.morale ?? 100;
  const next = Math.max(Math.min(morale, MIN_START_MORALE), morale - loss);
  return next === morale ? u : { ...u, morale: next };
};

/** The city's militia for an assault on it: synthetic defenders, never in state.units. */
export const cityMilitia = (state, cityId) => {
  const city = state.regions?.[cityId];
  if (!city || !city.owner || city.tile == null) return [];
  return militiaFor({ ownerId: city.owner, cityId, tile: city.tile, housing: cityHousingCap(state, cityId) || 0 });
};

/** The militia of a city with `housing` (its houses and town hall): pure, for the parity harness too. */
export const militiaFor = ({ ownerId, cityId, tile = null, housing = 0 }) => {
  let total = Math.min(MILITIA_MAX, Math.round(housing * MILITIA_PER_HOUSING));
  const out = [];
  for (let i = 0; total > 0; i++) {
    const strength = Math.min(MILITIA_UNIT, total);
    total -= strength;
    out.push({
      id: `mil_${cityId}_${i}`, ownerId, regionId: cityId, homeRegionId: cityId, tile,
      domain: 'land', classId: 'infantry', strength, maxStrength: strength, morale: MILITIA_MORALE,
      xp: 0, rank: 'recruit', promotions: [], commanderId: null, militia: true
    });
  }
  return out;
};

/** Nations fighting `enemyId` alongside `nationId`: its vassals, its overlord and its pact partners against that enemy. */
export const alliesOf = (state, nationId, enemyId) => {
  const nations = state.nations || {};
  const me = nations[nationId];
  if (!me || !enemyId) return [];
  const atWar = (id) => (state.wars || []).some((w) => w.active && isWarBetween(w, id, enemyId));
  return Object.keys(nations).filter((id) => {
    if (id === nationId || id === enemyId || nations[id]?.isEliminated) return false;
    const n = nations[id];
    const tie = n.vassalOf === nationId || me.vassalOf === id || (!!me.defensivePact && n.defensivePact?.against === me.defensivePact.against && me.defensivePact.against === enemyId);
    return tie && atWar(id);
  }).sort();
};

/**
 * Reinforcements standing by for a side (RTS plan 5.3): its own idle troops near the city
 * (invasion.js getReinforcementSources) and its allies' (row 16), grouped by region.
 */
export const reinforcementSources = (state, regionId, nationId, enemyId, excludeRegionIds = []) => {
  const own = getReinforcementSources(state, regionId, nationId, excludeRegionIds);
  const centre = state.regions?.[regionId]?.tile;
  if (centre == null) return own;
  const byRegion = new Map();
  alliesOf(state, nationId, enemyId).forEach((allyId) => unitsWithinRings(state, centre, allyId, REINFORCE_RINGS)
    .filter((u) => u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && (u.movesLeft ?? 1) > 0 && u.regionId !== regionId && !excludeRegionIds.includes(u.regionId))
    .forEach((u) => { const k = `${allyId}|${u.regionId}`; if (!byRegion.has(k)) byRegion.set(k, { regionId: u.regionId, nationId: allyId, unitIds: [] }); byRegion.get(k).unitIds.push(u.id); }));
  const allied = [...byRegion.values()].sort((a, b) => (a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : a.nationId < b.nationId ? -1 : 1));
  return [...own, ...allied];
};

/**
 * The inputs of one battle. `b`: { attackerUnits, defenderUnits, cityId (a city battle), militia
 * (default: a city battle that is not a sea battle), naval }. Returns { attackerUnits,
 * defenderUnits (conditioned, the militia added), militia, economyInputs: { supply: [a, d],
 * development: [a, d] }, hpRatio, housing, starved, plague }.
 */
export const battleInputs = (state, { attackerUnits = [], defenderUnits = [], cityId = null, fromRegionId = null, naval = false, militia = null } = {}) => {
  const city = cityId ? state.regions?.[cityId] : null;
  const starved = !naval && isStarved(city);
  const att = attackerUnits.map((u) => conditionUnit(state, u));
  const def = defenderUnits.map((u) => conditionUnit(state, u, { starved }));
  const mil = naval || !city ? [] : (militia ?? cityMilitia(state, cityId)).map((u) => conditionUnit(state, u, { starved }));
  const supply = [sideSupply(att), Math.min(sideSupply(def), starved ? STARVED_SUPPLY : 1)];
  const development = [cityDevelopment(state.regions?.[fromRegionId]), cityDevelopment(city)];
  return {
    attackerUnits: att,
    defenderUnits: [...def, ...mil],
    militia: mil,
    economyInputs: { supply, development },
    hpRatio: city ? wallsHpRatio(state, city) : 1,
    // Walls the real-time battle stands on the field (the keep's walls from the fort level, the
    // town's wall ring from its Defense line): the auto-resolve's gate rule (autoBattle.js).
    walled: !!city && ((city.defenseLevel || 0) + getRegionModifier(state, cityId, 'local.fortLevel').total >= 2 || wallsOf(city) >= 2),
    housing: city ? cityHousingCap(state, cityId) : 0,
    starved,
    plague: hasPlague(city)
  };
};
