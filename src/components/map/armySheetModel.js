// src/components/map/armySheetModel.js
// What the army sheet shows for the player's stack on a tile (plans/civ-map-rework.md E4):
// units grouped by army, each with its strength, morale, supply and moves, the general, the
// supply zone with its reason, the route with its ETA. Pure, so it can be tested without a DOM.
import { getTiles } from '../../data/geo/tiles';
import { getEffectiveAgeId } from '../../data/ages';
import { getUnitDefinition, UNIT_CLASSES } from '../../data/unitClasses';
import { unitTile, movePoints } from '../../engine/armies';
import { supplyOf, supplyZone, SUPPLY_MAX } from '../../engine/supplyMeter';
import { routeDestination, placeName } from '../../engine/routes';
import { getTechAgeId } from '../../engine/nationState';
import { mapEffectsFor } from '../../engine/techMapEffects';

import { pillageTile } from '../../engine/threat';
import { REBEL_OWNER_ID } from '../../data/rebellion';
import { tileFacts, IMPROVEMENTS } from '../../data/tileYields';
import { ALL_PERKS, canPromote, hasPerk, getRankForXp, XP_THRESHOLDS, RANK_ORDER } from '../../data/promotions';
import { airUnitsInRange, AIR_RANGE } from '../../engine/airPower';
import { validateFieldAttack, enemyStackAt } from '../../engine/fieldBattle';
import { validateInvasion } from '../../engine/invasion';
import { besiegersOf, siegeHpOf, siegeMaxHp, wallsOf, isEncircled, siegeStrength } from '../../engine/sieges';

export const ZONE_TEXT = {
  home: 'In friendly land: the meter fills every turn.',
  held: 'Holding enemy land: the meter holds.',
  wild: 'In the wilderness: the meter drains slowly.',
  enemy: 'In enemy land: the meter drains; a supply line from your border would slow it.'
};

/** The player's land units standing on `tile`. */
export const stackOn = (state, tile) => Object.values(state.units)
  .filter((u) => u.ownerId === state.playerNationId && u.domain !== 'naval' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && unitTile(state, u) === tile)
  .sort((a, b) => (a.id < b.id ? -1 : 1));

export const armySheetModel = (state, tile) => {
  const tiles = getTiles();
  const units = stackOn(state, tile);
  if (!units.length) return null;
  const ageId = getEffectiveAgeId(state.age, getTechAgeId(state, state.playerNationId));
  const max = SUPPLY_MAX + mapEffectsFor(state, state.playerNationId).supplyMax;
  const rows = units.map((u) => ({
    id: u.id,
    name: getUnitDefinition(ageId, u.classId)?.name || UNIT_CLASSES[u.classId]?.name || u.classId,
    classId: u.classId,
    army: u.army?.name || null,
    armyId: u.army?.id || null,
    strength: u.strength, maxStrength: u.maxStrength || u.strength,
    morale: u.morale ?? 100,
    supply: supplyOf(u, max), supplyMax: max,
    moves: u.movesLeft ?? 0, movePoints: movePoints(u),
    general: u.commanderId ? state.hiredCommanders?.[u.commanderId]?.name || null : null,
    promotions: (u.promotions || []).length,
    rank: getRankForXp(u.xp || 0),
    xp: u.xp || 0,
    nextRankAt: XP_THRESHOLDS[RANK_ORDER[RANK_ORDER.indexOf(getRankForXp(u.xp || 0)) + 1]] || null,
    generalId: u.commanderId || null,
    perks: canPromote(u) ? ALL_PERKS.filter((p) => !hasPerk(u, p.id)).map((p) => ({ id: p.id, name: p.name, description: p.description })) : []
  }));
  const generals = Object.entries(state.hiredCommanders || {}).filter(([, g]) => !g.assignedUnitId).map(([id, g]) => ({ id, name: g.name }));
  const groups = [];
  rows.forEach((r) => {
    const key = r.armyId || '';
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, name: r.army || 'Unassigned units', units: [] }; groups.push(g); }
    g.units.push(r);
  });
  const zone = supplyZone(state, tiles, units[0]);
  const lead = units.find((u) => u.route?.length) || null;
  const dest = lead ? routeDestination(lead) : null;
  const pace = lead ? (lead.routePace || 1) : 0;
  return {
    tile,
    regionId: units[0].regionId,
    base: state.regions[units[0].regionId]?.name || null,
    soldiers: units.reduce((s, u) => s + u.strength, 0),
    groups,
    zone: zone.zone, zoneText: ZONE_TEXT[zone.zone] || '',
    route: dest != null ? { to: dest, name: placeName(state, dest), turns: Math.max(1, Math.ceil(lead.route.length / Math.max(1, pace))) } : null,
    canMarch: units.some((u) => (u.movesLeft ?? 0) > 0 && !u.route?.length),
    pillage: pillageTarget(state, tile, units),
    generals,
    airCover: airUnitsInRange(state, state.playerNationId, tile, units).length, airRange: AIR_RANGE,
    targets: attackTargets(state, tile, units),
    siege: siegePressed(state, tile, units),
    unitIds: units.map((u) => u.id)
  };
};

/** The improvement the stack could pillage here (an enemy's, unburnt), or null: { name }. */
export const pillageTarget = (state, tile, units) => {
  if (!units.some((u) => (u.movesLeft ?? 0) > 0)) return null;
  const me = state.playerNationId;
  const enemies = new Set([REBEL_OWNER_ID, ...(state.wars || []).filter((w) => w.active && (w.aggressor === me || w.enemy === me)).map((w) => (w.aggressor === me ? w.enemy : w.aggressor))]);
  const raid = pillageTile(state, me, tile, enemies);
  if (!raid) return null;
  const facts = tileFacts(getTiles(), tile, state.world?.tileState?.[tile]);
  return { name: IMPROVEMENTS[facts.improvement]?.name || facts.improvement, gold: raid.gold };
};

const ATTACK_REASON = { no_war: 'not at war', no_moves: 'no moves left', cost: 'cannot afford the attack', no_units: 'no unit beside it', not_adjacent: 'not beside it' };

/** What the stack can attack from here: enemy stacks and enemy cities on the tiles around.
 * [{ kind: 'army'|'city', tile, regionId, name, strength, ok, reason }]. */
export const attackTargets = (state, tile, units) => {
  if (!units.length) return [];
  const tiles = getTiles();
  const me = state.playerNationId;
  const from = units[0].regionId;
  const out = [];
  tiles.neighbors[tile].forEach((n) => {
    const cityId = state.world?.tileOwner?.[n];
    const city = cityId ? state.regions[cityId] : null;
    if (city && city.tile === n && city.owner !== me) {
      const v = validateInvasion(state, from, cityId);
      if (v.ok || ['no_moves', 'cost', 'no_war'].includes(v.reason)) out.push({ kind: 'city', tile: n, regionId: cityId, name: city.name, owner: state.nations[city.owner]?.name || city.owner, strength: Object.values(state.units).filter((u) => u.regionId === cityId && u.domain === 'land' && u.ownerId !== me && u.strength > 0).reduce((s, u) => s + u.strength, 0), ok: !!v.ok, reason: v.ok ? null : ATTACK_REASON[v.reason] || v.reason });
      return;
    }
    const enemy = enemyStackAt(state, n, me);
    if (!enemy.length) return;
    const v = validateFieldAttack(state, from, n);
    if (v.ok || ['no_moves', 'cost'].includes(v.reason)) out.push({ kind: 'army', tile: n, regionId: null, name: `${state.nations[enemy[0].ownerId]?.name || 'Rebel'} army`, owner: state.nations[enemy[0].ownerId]?.name || 'Rebels', strength: enemy.reduce((s, u) => s + u.strength, 0), ok: !!v.ok, reason: v.ok ? null : ATTACK_REASON[v.reason] || v.reason });
  });
  return out.sort((a, b) => a.tile - b.tile);
};

/** The enemy city this stack besieges (a city whose centre touches the tile), or null:
 * { regionId, name, hp, maxHp, walls, encircled, strength }. */
export const siegePressed = (state, tile, units) => {
  if (!units.length) return null;
  const tiles = getTiles();
  const me = state.playerNationId;
  for (const n of tiles.neighbors[tile]) {
    const cityId = state.world?.tileOwner?.[n];
    const city = cityId ? state.regions[cityId] : null;
    if (!city || city.tile !== n || city.owner === me) continue;
    const mine = besiegersOf(state, city).get(me);
    if (!mine?.length) continue;
    return { regionId: cityId, name: city.name, hp: Math.round(siegeHpOf(city)), maxHp: siegeMaxHp(city), walls: wallsOf(city), encircled: isEncircled(state, city, me), strength: Math.round(siegeStrength(state, me, mine)) };
  }
  return null;
};
