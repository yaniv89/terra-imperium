// src/engine/airPower.js
// Air units on the tile map (plans/civ-map-rework.md D5b). An aircraft (classId 'air', Modern)
// is not a mover that fights where it stands: it flies from a base, one of its nation's cities
// (the airfield) or a carrier it is embarked on, and reaches any tile within AIR_RANGE rings.
// Every battle within that range (an invasion, a defence, a field battle) gets the aircraft as
// the air squads of the existing sim, on the attacker's or the defender's side by nation; after
// the battle they stay at their base. An aircraft standing on open ground between bases, or in a
// foreign city, covers nothing. Air defence (D5b): every Support unit (Anti-Air in the Modern
// age) on the battle tile of the other side turns back ANTI_AIR_SHARE of the aircraft that would
// join, and every aircraft of the other side on patrol (`unit.patrol`, SET_AIR_PATROL) whose base
// lies within AIR_PATROL_RINGS of the tile turns back PATROL_SHARE more, up to MAX_TURNED_BACK; the
// aircraft turned back are the last by id and take no part. Pure.
import { getTiles } from '../data/geo/tiles';
import { ringsAround } from './world/cities';
import { unitTile } from './armies';
import { ringsForKm } from '../data/geo/gridScale';

export const AIR_RANGE_KM = 1122; // km (11 rings at frequency 75)
export const AIR_RANGE = ringsForKm(AIR_RANGE_KM);
export const AIR_PATROL_KM = 612; // km (6 rings at frequency 75)
export const AIR_PATROL_RINGS = ringsForKm(AIR_PATROL_KM);
export const ANTI_AIR_SHARE = 0.2;
export const PATROL_SHARE = 0.25;
export const MAX_TURNED_BACK = 0.8;

export const isAir = (u) => u?.classId === 'air';

/** The tile an aircraft flies from, or null when it has no base under it. */
export const airBaseTile = (state, u) => {
  if (!isAir(u) || !(u.strength > 0)) return null;
  if (u.embarkedOn) { const ship = state.units?.[u.embarkedOn]; return ship && ship.navalLine === 'carrier' ? unitTile(state, ship) : null; }
  const t = unitTile(state, u);
  if (t == null) return null;
  const cityId = state.world?.tileOwner?.[t];
  const city = cityId ? state.regions?.[cityId] : null;
  return city && city.tile === t && city.owner === u.ownerId ? t : null;
};

/** The aircraft of `nationId` whose base reaches `tile`, not already among `inBattle`. */
export const airUnitsInRange = (state, nationId, tile, inBattle = []) => {
  if (tile == null) return [];
  const tiles = getTiles();
  const skip = new Set(inBattle.map((u) => u.id));
  const rings = ringsAround(tiles, tile, AIR_RANGE);
  return Object.values(state.units || {})
    .filter((u) => u.ownerId === nationId && isAir(u) && !skip.has(u.id))
    .filter((u) => { const base = airBaseTile(state, u); return base != null && rings.has(base); })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
};

/** The other side's patrolling aircraft whose base reaches `tile`. */
export const interceptorsAt = (state, enemyNationId, tile) => {
  if (!enemyNationId || tile == null) return [];
  const rings = ringsAround(getTiles(), tile, AIR_PATROL_RINGS);
  return Object.values(state.units || {}).filter((u) => u.ownerId === enemyNationId && isAir(u) && u.patrol && u.strength > 0 && rings.has(airBaseTile(state, u) ?? -1));
};

/** The share of joining aircraft turned back by `opposing` units on the tile and the other side's patrols. */
export const turnedBackShare = (state, enemyNationId, tile, opposing = []) => {
  const antiAir = opposing.filter((u) => u.classId === 'support' && u.strength > 0).length;
  const patrols = interceptorsAt(state, enemyNationId, tile).length;
  return Math.min(MAX_TURNED_BACK, ANTI_AIR_SHARE * antiAir + PATROL_SHARE * patrols);
};

/** `units` plus the nation's aircraft in range of `tile`, less those the other side turns back. */
export const withAirSupport = (state, nationId, tile, units, opposing = []) => {
  let air = airUnitsInRange(state, nationId, tile, units);
  if (!air.length) return units;
  const enemyNationId = opposing.find((u) => u.ownerId && u.ownerId !== nationId)?.ownerId || null;
  const share = turnedBackShare(state, enemyNationId, tile, opposing);
  const kept = air.length - Math.floor(air.length * share);
  air = air.slice(0, kept);
  return air.length ? [...units, ...air] : units;
};

/** Every air base on the map with its reach, for the threat lens: [{ tile, nationId, own, count, edgeTile }]. */
export const airRanges = (state) => {
  const tiles = getTiles();
  const me = state.playerNationId;
  const byBase = new Map();
  Object.values(state.units || {}).forEach((u) => {
    const base = airBaseTile(state, u);
    if (base == null) return;
    const key = `${base}|${u.ownerId}`;
    if (!byBase.has(key)) byBase.set(key, { tile: base, nationId: u.ownerId, own: u.ownerId === me, count: 0 });
    byBase.get(key).count += 1;
  });
  return [...byBase.values()].map((b) => {
    const rings = ringsAround(tiles, b.tile, AIR_RANGE);
    const edgeTile = [...rings].find(([, d]) => d === AIR_RANGE)?.[0] ?? b.tile;
    return { ...b, edgeTile };
  }).sort((a, b) => a.tile - b.tile || (a.nationId < b.nationId ? -1 : 1));
};
