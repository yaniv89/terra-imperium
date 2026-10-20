// src/components/map/armySheetModel.js
// What the army sheet shows for the player's stack on a tile (plans/civ-map-rework.md E4):
// units grouped by army, each with its strength, morale, supply and moves, the general, the
// supply zone with its reason, the route with its ETA. Pure, so it can be tested without a DOM.
import { regimentLabel, nameNow } from '../../i18n/names';
import { t, isolateLtr, dataText } from '../../i18n/core';
import { navalShipName, unitRosterName, improvementName, perkName, perkDescription } from '../../i18n/gameText';
import { whereText, placeLabel } from './placeText';
import { getTiles } from '../../data/geo/tiles';
import { getUnitDefinition, UNIT_CLASSES } from '../../data/unitClasses';
import { regimentName } from '../../data/regimentNames';
import { unitTile, movePoints } from '../../engine/armies';
import { supplyOf, supplyZone, supplyReport, SUPPLY_MAX, SUPPLY_LINE_RINGS, SUPPLY_LINE_LOSS, ROAD_LINE_BONUS, STARVE_STRENGTH, STARVE_MORALE } from '../../engine/supplyMeter';
import { isFortified } from '../../engine/fieldBattle';
import { getModifier } from '../../engine/modifiers/sheet';
import { routeDestination, routeEta } from '../../engine/routes';
import { armyStatus, isHolding } from '../../engine/standingOrders';
import { locationOf } from '../../engine/unitLocation';
import { computeSupplyFlow } from '../../engine/supplies';
import { getResearched, ageOf } from '../../engine/nationState';
import { mapEffectsFor } from '../../engine/techMapEffects';

import { pillageTile } from '../../engine/threat';
import { REBEL_OWNER_ID } from '../../data/rebellion';
import { tileFacts, IMPROVEMENTS } from '../../data/tileYields';
import { ALL_PERKS, canPromote, hasPerk, getRankForXp, XP_THRESHOLDS, RANK_ORDER } from '../../data/promotions';
import { airUnitsInRange, AIR_RANGE } from '../../engine/airPower';
import { validateFieldAttack, enemyStackAt } from '../../engine/fieldBattle';
import { validateFleetAttack, enemyFleetsAt } from '../../engine/navalBattle';
import { declareWarModel } from '../panels/warActions';
import { wallsLabel } from '../battle/warModel';
import { fleetPace } from '../../engine/fleets';
import { navalLineOf, navalName } from '../../data/navalLines';
import { validateInvasion } from '../../engine/invasion';
import { besiegersOf, siegeHpOf, siegeMaxHp, wallsOf, isEncircled, siegeStrength, siegeOrders, centreIndex } from '../../engine/sieges';
import { ringsForKm, ringsFromF75 } from '../../data/geo/gridScale';

// (read when asked, so the text follows the language)
export const ZONE_TEXT = Object.defineProperties({}, Object.fromEntries(['sea', 'home', 'held', 'wild', 'enemy'].map((z) => [z, { enumerable: true, get: () => t(`mx.zone.${z}`) }])));

/** The supply line of the sheet, in words: the same sentences as supplyMeter.js supplyReport().text,
 * written with t() so Hebrew reads them. `hungry`: the nation's supplies stock is empty. */
export const supplyText = (r, hungry) => {
  const { zone, delta, borderDistance, reach, overStack, supply, max, change, turnsLeft, starving } = r;
  let hint;
  if (zone === 'home') hint = supply >= max ? t('mx.sup.homeFull') : t('mx.sup.homeFill');
  else if (zone === 'held') hint = t('mx.sup.held');
  else if (zone === 'wild') hint = t('mx.sup.wild');
  else if (delta === -SUPPLY_LINE_LOSS) hint = t('mx.sup.lineHint', { count: borderDistance, reach });
  else hint = borderDistance == null ? t('mx.sup.far', { reach }) : t('mx.sup.near', { dist: borderDistance, reach, more: reach + ROAD_LINE_BONUS });
  if (hungry && zone !== 'home') hint += t('mx.sup.hungry');
  if (overStack) hint += t('mx.sup.over');
  if (starving) return t('mx.sup.starving', { max, pct: Math.round(STARVE_STRENGTH * 100), morale: STARVE_MORALE, hint });
  return t('mx.sup.line', { supply: Math.round(supply), max, change: isolateLtr(`${change >= 0 ? '+' : ''}${change}`), until: turnsLeft != null ? t('mx.sup.until', { count: turnsLeft }) : '', hint });
};

/** The player's land units standing on `tile`; on a sea tile, the fleets there (navalBattle.js). */
export const stackOn = (state, tile) => {
  const naval = tile != null && tile >= 0 && getTiles().land[tile] !== 1;
  return Object.values(state.units)
    .filter((u) => u.ownerId === state.playerNationId && (naval ? u.domain === 'naval' : u.domain !== 'naval') && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && unitTile(state, u) === tile)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
};

// An army's name: the templates' own names are game data; a name the player typed stays as typed.
const armyLabel = (name) => (name === 'Legion' ? t('mx.army.legion') : name === 'Siege train' ? t('mx.army.siegeTrain') : name);

export const armySheetModel = (state, tile) => {
  const tiles = getTiles();
  const units = stackOn(state, tile);
  if (!units.length) return null;
  const naval = units[0].domain === 'naval';
  const ageId = ageOf(state, state.playerNationId);
  const max = SUPPLY_MAX + mapEffectsFor(state, state.playerNationId).supplyMax;
  const researched = getResearched(state, state.playerNationId);
  const rows = units.map((u) => ({
    id: u.id,
    // "3rd Akkadian Spearmen" in a peoples world (regimentNames.js), the plain name otherwise
    name: u.explorer ? t('mx.army.scouts') : ((en) => regimentLabel(regimentName(state.nations[u.ownerId], u, en), state.nations[u.ownerId]?.people, naval ? navalShipName(navalLineOf(u), ageId, en) : unitRosterName(ageId, u.classId, en), u.regiment))(naval ? navalName(navalLineOf(u), ageId) : getUnitDefinition(ageId, u.classId)?.name || UNIT_CLASSES[u.classId]?.name || u.classId),
    cargo: naval ? Object.values(state.units).filter((c) => c.embarkedOn === u.id).length : 0,
    classId: u.classId,
    navalLine: naval ? navalLineOf(u) : null,
    army: u.army?.name || null,
    armyId: u.army?.id || null,
    strength: u.strength, maxStrength: u.maxStrength || u.strength,
    morale: u.morale ?? 100,
    supply: supplyOf(u, max), supplyMax: max,
    moves: u.movesLeft ?? 0, movePoints: naval ? fleetPace(state, u) : movePoints(u, researched),
    general: u.commanderId && state.hiredCommanders?.[u.commanderId]?.name ? nameNow('person', null, state.hiredCommanders[u.commanderId].name) : null,
    promotions: (u.promotions || []).length,
    rank: dataText(`rank.${getRankForXp(u.xp || 0)}`, getRankForXp(u.xp || 0)),
    xp: u.xp || 0,
    nextRankAt: XP_THRESHOLDS[RANK_ORDER[RANK_ORDER.indexOf(getRankForXp(u.xp || 0)) + 1]] || null,
    generalId: u.commanderId || null,
    air: u.classId === 'air', patrol: !!u.patrol,
    perks: canPromote(u) ? ALL_PERKS.filter((p) => !hasPerk(u, p.id)).map((p) => ({ id: p.id, name: perkName(p.id, p.name), description: perkDescription(p.id, p.description) })) : []
  }));
  const generals = Object.entries(state.hiredCommanders || {}).filter(([, g]) => !g.assignedUnitId).map(([id, g]) => ({ id, name: nameNow('person', null, g.name) }));
  const groups = [];
  rows.forEach((r) => {
    const key = r.armyId || '';
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, name: r.army ? armyLabel(r.army) : t('mx.army.unassigned'), units: [] }; groups.push(g); }
    g.units.push(r);
  });
  // A stack of scouts (scouting.js) lives off the land and never attacks: no supply report, no attack cards.
  const scouts = !naval && units.every((u) => u.explorer);
  const zone = naval ? { zone: 'sea' } : supplyZone(state, tiles, units[0]);
  // The forecast takes what the turn's supply phase takes (resolveTurn.js): the line's reach, the
  // attrition modifier, an empty supplies stock, the stack cap. It reads the unit worst off, so
  // the sheet never says "fine" over a starving regiment (playtest audit I005).
  const fx = mapEffectsFor(state, state.playerNationId);
  const worst = units.reduce((w, u) => (supplyOf(u, max) < supplyOf(w, max) ? u : w), units[0]);
  const hungry = !!computeSupplyFlow({ regions: state.regions, units: state.units, nationId: state.playerNationId, ageId, resources: state.resources, turnNumber: state.turnNumber, tileOwner: state.world?.tileOwner }).hungry;
  const report = naval || scouts ? null : supplyReport(state, worst, {
    lineRings: SUPPLY_LINE_RINGS + ringsForKm(fx.lineRings, { min: 0 }) + ringsFromF75(Math.max(0, Math.round(getModifier(state, state.playerNationId, 'national.supplyRange').total))),
    max, stackCapExtra: fx.stackCap,
    attritionMult: Math.max(0, 1 + getModifier(state, state.playerNationId, 'national.attrition').total),
    hungry
  });
  const fortified = !naval && units.every((u) => isFortified(u, state.turnNumber));
  const mergeFrom = naval ? [] : mergeSources(state, tile, units);
  const lead = units.find((u) => u.route?.length) || null;
  const dest = lead ? routeDestination(lead) : null;
  // What the stack is doing (standingOrders.js): the busiest answer of its units, so one idle
  // unit in a holding stack still reads idle.
  const centres = centreIndex(state);
  const statuses = units.map((u) => armyStatus(state, u, centres));
  const status = statuses.includes('idle') ? 'idle' : statuses[0];
  // Where the stack stands (the tile) and where it is based (its home city) are two facts
  // (unitLocation.js): the header names the place, and the base only when the stack is away from it.
  const loc = locationOf(state, units[0]);
  return {
    tile,
    naval,
    regionId: units[0].regionId,
    base: state.regions[units[0].regionId]?.name ? nameNow('city', null, state.regions[units[0].regionId].name) : null,
    where: whereText(state, tile), atBase: loc.atBase,
    soldiers: units.reduce((s, u) => s + u.strength, 0),
    groups,
    zone: zone.zone, zoneText: report ? supplyText(report, hungry) : ZONE_TEXT[zone.zone] || '',
    supplyReport: report, fortified, mergeFrom,
    // The ETA is the march's own schedule (routes.js routeEta), the number the order promised.
    route: dest != null ? { to: dest, name: placeLabel(state, dest), turns: routeEta(state, lead) ?? 1 } : null,
    status,
    holding: !naval && units.every((u) => isHolding(u)),
    scouts, exploring: scouts && units.some((u) => u.explore?.auto),
    canHold: !naval && !scouts && !units.some((u) => u.route?.length),
    siegeOrders: naval ? [] : siegeOrders(state, tile, units),
    canMarch: units.some((u) => (u.movesLeft ?? 0) > 0 && !u.route?.length),
    pillage: naval ? null : pillageTarget(state, tile, units),
    generals,
    airCover: naval ? 0 : airUnitsInRange(state, state.playerNationId, tile, units).length, airRange: AIR_RANGE,
    targets: scouts ? [] : naval ? fleetTargets(state, tile, units) : attackTargets(state, tile, units),
    siege: naval ? null : siegePressed(state, tile, units),
    unitIds: units.map((u) => u.id)
  };
};

/** Your other stacks on the tiles around, with moves left: the sheet offers to march them in
 * (plans/playtest-1.md P2.3 merge). [{ tile, name, regionId, unitIds }]. */
export const mergeSources = (state, tile, units) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const here = new Set(units.map((u) => u.id));
  const out = [];
  tiles.neighbors[tile].forEach((n) => {
    const stack = Object.values(state.units).filter((u) => u.ownerId === me && u.domain === 'land' && !u.embarkedOn && u.classId !== 'settler' && u.strength > 0 && !here.has(u.id) && unitTile(state, u) === n && (u.movesLeft ?? 0) > 0 && !u.route?.length);
    if (stack.length) out.push({ tile: n, name: tiles.names[n] ? nameNow('place', null, tiles.names[n]) : state.regions[state.world?.tileOwner?.[n]]?.name ? nameNow('city', null, state.regions[state.world.tileOwner[n]].name) : t('mx.army.nextTile'), regionId: stack[0].regionId, unitIds: stack.map((u) => u.id) });
  });
  return out;
};

/** The improvement the stack could pillage here (an enemy's, unburnt), or null: { name }. */
export const pillageTarget = (state, tile, units) => {
  if (!units.some((u) => (u.movesLeft ?? 0) > 0)) return null;
  const me = state.playerNationId;
  const enemies = new Set([REBEL_OWNER_ID, ...(state.wars || []).filter((w) => w.active && (w.aggressor === me || w.enemy === me)).map((w) => (w.aggressor === me ? w.enemy : w.aggressor))]);
  const raid = pillageTile(state, me, tile, enemies);
  if (!raid) return null;
  const facts = tileFacts(getTiles(), tile, state.world?.tileState?.[tile]);
  return { name: improvementName(facts.improvement, IMPROVEMENTS[facts.improvement]?.name || facts.improvement), gold: raid.gold };
};

const ATTACK_REASON = { no_war: 'not at war', no_moves: 'no moves left', cost: 'cannot afford the attack', no_units: 'no unit beside it', not_adjacent: 'not beside it' };
const reasonOfAttack = (code) => (ATTACK_REASON[code] ? t(`mx.army.why.${code}`) : code);
const foeName = (state, ownerId, fallback) => (state.nations[ownerId] ? nameNow('people', ownerId, state.nations[ownerId].name) : fallback);

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
      if (v.ok || ['no_moves', 'cost', 'no_war'].includes(v.reason)) out.push({ kind: 'city', tile: n, regionId: cityId, name: nameNow('city', null, city.name), owner: foeName(state, city.owner, city.owner), ownerId: city.owner, war: v.reason === 'no_war' ? declareWarModel(state, city.owner) : null, strength: Object.values(state.units).filter((u) => u.regionId === cityId && u.domain === 'land' && u.ownerId !== me && u.strength > 0).reduce((s, u) => s + u.strength, 0), ok: !!v.ok, reason: v.ok ? null : reasonOfAttack(v.reason) });
      return;
    }
    const enemy = enemyStackAt(state, n, me);
    if (!enemy.length) return;
    const v = validateFieldAttack(state, from, n);
    if (v.ok || ['no_moves', 'cost'].includes(v.reason)) out.push({ kind: 'army', tile: n, regionId: null, name: t('mx.army.foeArmy', { owner: foeName(state, enemy[0].ownerId, t('mx.tile.rebel')) }), owner: foeName(state, enemy[0].ownerId, t('mx.army.rebels')), strength: enemy.reduce((s, u) => s + u.strength, 0), ok: !!v.ok, reason: v.ok ? null : reasonOfAttack(v.reason) });
  });
  return out.sort((a, b) => a.tile - b.tile);
};

/** What a fleet stack can attack from here: enemy fleets on the sea tiles around (navalBattle.js).
 * The same shape as attackTargets, kind 'fleet'. */
export const fleetTargets = (state, tile, units) => {
  if (!units.length) return [];
  const tiles = getTiles();
  const me = state.playerNationId;
  const out = [];
  tiles.neighbors[tile].forEach((n) => {
    const enemy = enemyFleetsAt(state, n, me);
    if (!enemy.length) return;
    const v = validateFleetAttack(state, tile, n);
    if (v.ok || ['no_moves', 'cost'].includes(v.reason)) out.push({ kind: 'fleet', tile: n, regionId: null, name: t('mx.army.foeFleet', { owner: foeName(state, enemy[0].ownerId, t('mx.army.enemy')) }), owner: foeName(state, enemy[0].ownerId, t('mx.army.enemy')), strength: enemy.reduce((s, u) => s + u.strength, 0), ok: !!v.ok, reason: v.ok ? null : reasonOfAttack(v.reason) });
  });
  return out.sort((a, b) => a.tile - b.tile);
};

/** The enemy city this stack besieges (a city whose centre touches the tile), or null:
 * { regionId, name, hp, maxHp, walls, wallsName, encircled, strength }. `hp` is the city's siege
 * endurance (an open town has one too); `wallsName` its walls as every screen names them (I009). */
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
    return { regionId: cityId, name: nameNow('city', null, city.name), hp: Math.round(siegeHpOf(city, state.greatProjects)), maxHp: siegeMaxHp(city, state.greatProjects), walls: wallsOf(city), wallsName: wallsLabel(city), encircled: isEncircled(state, city, me), strength: Math.round(siegeStrength(state, me, mine)) };
  }
  return null;
};
