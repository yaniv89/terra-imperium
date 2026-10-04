// src/engine/plague.js
// Plague as an epidemic on the city graph (plans/math-ideas.md 6.3): an SIR metapopulation model,
// the standard compartmental model of epidemiology applied to a network of towns. Each city's
// people are Susceptible, Infected or Recovered (shares s + i + r = 1; only i and r are stored, on
// city.plague, and only while they matter).
//
// Inside a city, one turn is one generation of the disease (a turn is years long), the Reed-Frost
// chain model: everyone infected this turn recovers or dies by the next, and infects others:
//
//   F   = beta_c x i                       new = s x F / (1 + F)     (a bounded catch chance)
//   i'  = new                               r' = r + i - WANING x r   (the dead leave S too)
//   deaths = MORTALITY x i x people         (taken through the one population model, population.js)
//
// so an outbreak grows, peaks as the susceptible run out, and burns out in eight to fifteen turns,
// leaving immunity that wanes over generations.
//
// Between cities the disease jumps (a seeded roll, the same on every device) with a chance that
// grows with the infection pressing on the city through its links:
//
//   pressure_c = sum over infected j of w_jc x i_j
//   P(jump)    = s_c x J / (1 + J),  J = JUMP x pressure_c        then i_c = JUMP_I
//
// Links carry it the way it travelled: a land kernel between any two cities by km
// (1 / (1 + (km / LAND_KM)^2), out to REACH_KM), a longer sea kernel between two ports (ships,
// SEA_W and SEA_KM), the player's trade routes (TRADE_W, capital to partner capital), and armies
// (ARMY_W between a land unit's home city and the city whose land it stands on). beta grows with
// city size (crowding) and falls with Aqueducts, the Scientific Method and Genomics, so late-game
// outbreaks fizzle.
//
// Seeds: a rare roll per city per turn for cities of SEED_MIN_SIZE or more, and the scripted plague
// events (the Antonine Plague, the Black Death) through seedPlagueNear. While a city's i is at least
// VISIBLE_I it carries the existing 'plague' disaster mark (no growth, shown on its card).
//
// Cost: one pass over the cities (most turns nothing is infected and the step ends there); then
// infected x cities km checks and one pass over units. Distances are km, so a denser grid changes
// nothing.
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { fromLatLonExact } from '../data/geo/geodesic';
import { distanceKm } from '../data/geo/geodesic';
import { drawPeople, sizeToPeople } from './world/cities';
import { getTradeRoute } from './tradeRoutes';

export const BETA = 2.4;             // contacts per generation in a city of BETA_REF_SIZE
export const BETA_REF_SIZE = 6;
export const MORTALITY = 0.3;        // of the infected, the share who die
export const WANING = 0.02;          // immunity lost per turn (about 50 turns)
export const JUMP = 0.15;            // between-city transmission
export const JUMP_I = 0.04;          // the share infected when the disease arrives in a city
export const REACH_KM = 900;         // the land kernel's cut-off
export const LAND_KM = 300;
export const SEA_W = 0.5;
export const SEA_KM = 1500;
export const SEA_REACH_KM = 3000;
export const TRADE_W = 2;            // a caravan or a fleet a turn: busier than a land neighbour
export const ARMY_W = 3;             // an army is thousands of men moving together
export const SEED_CHANCE = 0.0001;   // per city per turn at SEED_MIN_SIZE, scaled by size
export const SEED_MIN_SIZE = 4;
export const SEED_I = 0.08;
export const MIN_I = 0.005;          // below this an outbreak ends
export const MIN_R = 0.02;           // below this the immunity record is dropped
export const VISIBLE_I = 0.02;
export const PLAGUE_MARK_TURNS = 1;
export const BETA_TECHS = { infrastructure_aqueducts: 0.8, science_scientific_method: 0.75, science_genomics: 0.5 };

const hash = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) / 0x100000000; };
const round4 = (x) => Math.round(x * 10000) / 10000;

/** A city's transmission rate: crowding by size, lowered by sanitation and medicine techs. */
export const betaOf = (city, researched = []) => {
  let b = BETA * Math.min(1.5, 0.5 + (city.size || 1) / (2 * BETA_REF_SIZE));
  Object.entries(BETA_TECHS).forEach(([tech, m]) => { if (researched.includes(tech)) b *= m; });
  return b;
};

/** The land and sea kernel between two cities `km` apart. */
export const linkWeight = (km, bothPorts) => {
  let w = km <= REACH_KM ? 1 / (1 + (km / LAND_KM) * (km / LAND_KM)) : 0;
  if (bothPorts && km <= SEA_REACH_KM) w += SEA_W / (1 + (km / SEA_KM) * (km / SEA_KM));
  return w;
};

/** One generation inside an infected city: { i, r, deathsShare }. */
export const sirStep = ({ i = 0, r = 0 }, beta) => {
  const s = Math.max(0, 1 - i - r);
  const force = beta * i;
  return { i: s * force / (1 + force), r: r + i - WANING * r, deathsShare: MORTALITY * i };
};

/** The chance the disease reaches an uninfected city under `pressure` this turn. */
export const jumpChance = (pressure, r = 0) => {
  const j = JUMP * pressure;
  return Math.max(0, 1 - r) * j / (1 + j);
};

/** Start an outbreak in a city (scripted events, tests). Returns the city. */
export const seedPlague = (city, turn, i = SEED_I) => {
  if (!city || city.outpost) return city;
  const p = city.plague || {};
  if ((p.i || 0) >= i) return city;
  return { ...city, plague: { i: round4(i), r: round4(p.r || 0), since: p.i > 0 ? p.since : turn } };
};

const isPort = (tiles, city) => tiles.neighbors[city.tile].some((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'lake');
const susceptible = (c) => c.owner && !c.outpost && c.tile != null;

/**
 * The plague step of a turn on the working `regions` (mutated in place). `ctx`: { units,
 * tileOwner, researchedOf(nationId), state (for the player's trade routes), seed (state.rngSeed) }.
 * Returns logs [{ nationId, message }].
 */
export const spreadPlague = (regions, turn, ctx = {}) => {
  const tiles = getTiles();
  const ids = Object.keys(regions);
  const logs = [];
  const seed = ctx.seed ?? 0; // the game's seed: each game gets its own outbreaks
  const infected = ids.filter((id) => regions[id].plague?.i > 0);
  // Rare spontaneous outbreaks (none in a city still immune).
  ids.forEach((id) => {
    const c = regions[id];
    if (!susceptible(c) || (c.size || 1) < SEED_MIN_SIZE || c.plague?.i > 0) return;
    if (hash(`${seed}|${id}|${turn}|plague`) < SEED_CHANCE * (c.size / SEED_MIN_SIZE) * Math.max(0, 1 - (c.plague?.r || 0))) {
      regions[id] = seedPlague(c, turn);
      logs.push({ nationId: c.owner, message: `Plague breaks out in ${c.name}.` });
    }
  });
  if (!infected.length) {
    // Immunity wanes in quiet times too.
    ids.forEach((id) => {
      const c = regions[id]; const p = c.plague;
      if (!p || p.i > 0) return;
      const r = p.r * (1 - WANING);
      regions[id] = { ...c, plague: r < MIN_R ? null : { ...p, r: round4(r) } };
    });
    return logs;
  }
  // The pressure on every city from this turn's infected (before anyone changes).
  const pressure = new Map();
  const add = (id, v) => { if (v > 0 && regions[id]) pressure.set(id, (pressure.get(id) || 0) + v); };
  const ports = new Map();
  const portOf = (id) => { if (!ports.has(id)) ports.set(id, isPort(tiles, regions[id])); return ports.get(id); };
  infected.forEach((src) => {
    const a = regions[src];
    if (a.tile == null) return;
    const ia = a.plague.i;
    const ca = tiles.centres[a.tile];
    const aPort = portOf(src);
    ids.forEach((dst) => {
      const b = regions[dst];
      if (dst === src || !susceptible(b) || b.plague?.i > 0) return;
      const km = distanceKm(ca, tiles.centres[b.tile]);
      if (km > SEA_REACH_KM || (km > REACH_KM && !aPort)) return;
      add(dst, ia * linkWeight(km, aPort && portOf(dst)));
    });
  });
  const iOf = (id) => regions[id]?.plague?.i || 0;
  const st = ctx.state;
  if (st?.playerNationId) {
    const home = getCapital(st, st.playerNationId);
    Object.entries(st.nations || {}).forEach(([pid, n]) => {
      if (!n?.hasTradeAgreement || n.isEliminated || pid === st.playerNationId) return;
      const other = getCapital(st, pid);
      if (!home || !other || !regions[home] || !regions[other] || !(iOf(home) > 0 || iOf(other) > 0)) return;
      if (st.scenario && !getTradeRoute(st, pid).ok) return;
      add(other, TRADE_W * iOf(home));
      add(home, TRADE_W * iOf(other));
    });
  }
  const tileOwner = ctx.tileOwner || {};
  Object.values(ctx.units || {}).forEach((u) => {
    if (u.domain === 'naval' || u.tile == null || !(u.strength > 0)) return;
    const here = tileOwner[u.tile]; const home = u.homeRegionId;
    if (!here || !home || here === home || !regions[here] || !regions[home]) return;
    add(here, ARMY_W * iOf(home));
    add(home, ARMY_W * iOf(here));
  });

  // 1. A generation inside each infected city.
  infected.sort().forEach((id) => {
    const c = regions[id];
    const p = c.plague;
    const step = sirStep(p, betaOf(c, ctx.researchedOf && c.owner ? ctx.researchedOf(c.owner) : []));
    let { i, r } = step;
    if (i < MIN_I) { r += i; i = 0; }
    let next = drawPeople(c, step.deathsShare * (c.currentPopulation || sizeToPeople(c.size)), { canShrink: true });
    next = { ...next, plague: i > 0 || r >= MIN_R ? { i: round4(i), r: round4(Math.min(1, r)), since: p.since } : null };
    if (i >= VISIBLE_I && (!next.disaster || next.disaster.kind === 'plague' || turn > next.disaster.until)) next = { ...next, disaster: { kind: 'plague', until: turn + PLAGUE_MARK_TURNS } };
    regions[id] = next;
    if (!c.owner) return;
    if (i === 0) logs.push({ nationId: c.owner, message: `The plague in ${c.name} has burnt out${next.size < c.size ? `, leaving it at size ${next.size}` : ''}.` });
    else if (next.size < c.size) logs.push({ nationId: c.owner, message: `Plague kills many in ${c.name}: it shrinks to size ${next.size}.` });
  });
  // 2. Jumps to new cities.
  [...pressure.keys()].sort().forEach((id) => {
    const c = regions[id];
    if (!susceptible(c) || c.plague?.i > 0) return;
    if (hash(`${seed}|${id}|${turn}|plagueJump`) >= jumpChance(pressure.get(id), c.plague?.r || 0)) return;
    regions[id] = seedPlague(c, turn, JUMP_I);
    logs.push({ nationId: c.owner, message: `Plague reaches ${c.name}.` });
  });
  // 3. Immunity wanes where nothing is burning.
  const burning = new Set(infected);
  ids.forEach((id) => {
    const c = regions[id]; const p = c.plague;
    if (!p || p.i > 0 || burning.has(id)) return;
    const r = p.r * (1 - WANING);
    regions[id] = { ...c, plague: r < MIN_R ? null : { ...p, r: round4(r) } };
  });
  return logs;
};

// Where the scripted plagues began: the Antonine Plague in Mesopotamia (165), the Black Death on
// the Black Sea steppe (1347). Each seeds the cities nearest the spot.
export const PLAGUE_EVENT_ORIGINS = {
  antonine_plague: { lat: 33.1, lon: 44.5, cities: 2, i: 0.1 },
  black_death: { lat: 45.0, lon: 35.4, cities: 3, i: 0.15 }
};

/** Seed an outbreak in the `cities` owned cities nearest a point (working `regions`, mutated). Returns their ids. */
export const seedPlagueNear = (regions, { lat, lon, cities = 1, i = SEED_I }, turn) => {
  const tiles = getTiles();
  const origin = fromLatLonExact(lat, lon);
  const near = Object.keys(regions)
    .filter((id) => susceptible(regions[id]))
    .map((id) => ({ id, km: distanceKm(origin, tiles.centres[regions[id].tile]) }))
    .sort((a, b) => a.km - b.km || (a.id < b.id ? -1 : 1))
    .slice(0, cities);
  near.forEach(({ id }) => { regions[id] = seedPlague(regions[id], turn, i); });
  return near.map((n) => n.id);
};
