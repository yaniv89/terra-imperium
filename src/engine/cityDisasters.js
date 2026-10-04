// src/engine/cityDisasters.js
// Disasters on cities (plans/civ-map-rework.md, C9.4; workstream 11). Every turn each city rolls
// once (a hash of its id and the turn, so the roll is the same on every device) against the
// disasters its tile facts allow:
//   flood    a river city (FLOOD_CHANCE): half its food bank; food x FLOOD_FOOD_MULT for DISASTER_TURNS
//   fire     a city of size FIRE_MIN_SIZE or more (FIRE_CHANCE): half its production progress;
//            production x FIRE_PRODUCTION_MULT for DISASTER_TURNS
//   plague   no longer rolled here: plague spreads between cities as an epidemic (plague.js, SIR).
//            It still uses the 'plague' mark (no growth) while a city is infected; strike(.., 'plague')
//            stays for callers that force one.
// A city carries one disaster at a time (`city.disaster: { kind, until }`), shown on its card as
// a mark until it heals, and rolls again only DISASTER_COOLDOWN turns after the last one. The
// nation-wide meters (disasters.js) are a different thing: politics, not weather. Pure.
import { getTiles } from '../data/geo/tiles';

export const FLOOD_CHANCE = 0.004;
export const FIRE_CHANCE = 0.003;
export const FIRE_MIN_SIZE = 4;
export const DISASTER_TURNS = 5;
export const DISASTER_COOLDOWN = 30;
export const FLOOD_FOOD_MULT = 0.75;
export const FIRE_PRODUCTION_MULT = 0.75;
export const PLAGUE_SIZE_LOSS = 1;
export const DISASTER_LABELS = { flood: 'Flooded', fire: 'Burnt', plague: 'Plague' };

const hash = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) / 0x100000000; };

/** The disaster a city would suffer this turn by its roll, or null. */
export const rollFor = (city, turn, tiles = getTiles()) => {
  if (city.tile == null || city.outpost || !city.owner) return null;
  if (city.disaster && turn <= city.disaster.until) return null;
  if (city.lastDisasterTurn != null && turn - city.lastDisasterTurn < DISASTER_COOLDOWN) return null;
  const roll = hash(`${city.id}|${turn}|disaster`);
  let band = 0;
  if (tiles.rivers[city.tile]) { band += FLOOD_CHANCE; if (roll < band) return 'flood'; }
  if ((city.size || 1) >= FIRE_MIN_SIZE) { band += FIRE_CHANCE; if (roll < band) return 'fire'; }
  return null;
};

/** The city struck by `kind` at `turn`. */
export const strike = (city, kind, turn) => {
  const next = { ...city, disaster: { kind, until: turn + DISASTER_TURNS }, lastDisasterTurn: turn };
  if (kind === 'flood') next.food = Math.round((city.food || 0) / 2 * 10) / 10;
  if (kind === 'fire') next.production = { ...city.production, progress: Math.round((city.production?.progress || 0) / 2) };
  if (kind === 'plague') next.size = Math.max(1, (city.size || 1) - PLAGUE_SIZE_LOSS);
  return next;
};

/** The yield multipliers a city's disaster imposes today: { food, production, growth }. */
export const disasterMults = (city, turn) => {
  const d = city?.disaster;
  if (!d || (turn != null && turn > d.until)) return { food: 1, production: 1, growth: 1 };
  return { food: d.kind === 'flood' ? FLOOD_FOOD_MULT : 1, production: d.kind === 'fire' ? FIRE_PRODUCTION_MULT : 1, growth: d.kind === 'plague' ? 0 : 1 };
};

/**
 * The disasters step of a turn on the working `regions` (mutated in place): expired marks clear,
 * new disasters strike. Returns logs [{ nationId, message }].
 */
export const rollCityDisasters = (regions, turn) => {
  const tiles = getTiles();
  const logs = [];
  Object.keys(regions).forEach((id) => {
    const city = regions[id];
    if (city.disaster && turn > city.disaster.until) { regions[id] = { ...city, disaster: null }; return; }
    const kind = rollFor(city, turn, tiles);
    if (!kind) return;
    regions[id] = strike(city, kind, turn);
    logs.push({ nationId: city.owner, message: kind === 'flood' ? `The river floods ${city.name}: half its stores are lost and the fields yield less for ${DISASTER_TURNS} turns.`
      : kind === 'fire' ? `Fire sweeps through ${city.name}: half its work in progress is lost and the workshops yield less for ${DISASTER_TURNS} turns.`
        : `Plague strikes ${city.name}: ${PLAGUE_SIZE_LOSS} citizen${PLAGUE_SIZE_LOSS > 1 ? 's' : ''} lost and no growth for ${DISASTER_TURNS} turns.` });
  });
  return logs;
};
