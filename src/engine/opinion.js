// src/engine/opinion.js
// Opinion with itemised reasons (plans/civ-map-rework.md, C6.3; workstream 7). What nation A
// thinks of nation B is a list of reasons from the map and the records (src/data/opinion.js),
// summed and clamped to -100..100:
//   baseline       a stranger starts at OPINION_BASELINE (8)
//   grudge         -0.6 per point of A's `hostility` (the decaying memory of insults, wars, gifts)
//   borders        A's city tiles that touch B's: -1 each beyond 5, at most -20
//   settled near   B founded a city within 4 tiles of A's: -15 each, fading 1 a turn
//   my people      B holds a city A's people founded: -10 each
//   claim          B holds a claim on A: -10
//   trade          +5 per trade agreement (one today), alliance +25, defensive pact +15,
//                  royal marriage +15, the same lean on an identity axis +5 each
//   aggressive expansion  -1 per AE point B has in A's eyes above 20
//   rival          -30; a broken truce -20 while its floor stands; vassalage -10
// The AI's war roll multiplies by max(0, (20 - opinion) / 60) (aiLogic.js): with no map reasons
// this equals the old hostility/100 + 0.2, so a friend never gets a surprise war and an enemy at
// -40 or less gives a casus belli (diplomacy.js). Pure; cached per (nations, regions, world).
import { getTiles } from '../data/geo/tiles';
import { IDENTITY_AXES, leansNegative, leansPositive } from '../data/identity';
import {
  OPINION_MIN, OPINION_MAX, OPINION_BASELINE, GRUDGE_PER_HOSTILITY, BORDER_FREE_TILES, BORDER_PER_TILE, BORDER_MAX, SETTLED_NEAR_RINGS, SETTLED_NEAR,
  HOLDS_MY_CULTURE, CLAIM_ON_MY_CITY, TRADE_ROUTE, TRADE_MAX, ALLIANCE, OPEN_BORDERS, DEFENSIVE_PACT, ROYAL_MARRIAGE, SAME_IDENTITY_AXIS, BROKEN_TRUCE, AE_FREE, AE_PER_POINT, RIVAL, VASSAL_OF_YOU,
  WAR_ROLL_OPINION_CEILING, WAR_ROLL_OPINION_SPAN, CASUS_BELLI_OPINION
} from '../data/opinion';

const clamp = (v) => Math.max(OPINION_MIN, Math.min(OPINION_MAX, Math.round(v)));
// Per regions identity: cities by owner, and for every city founded after the start the set of
// tiles within SETTLED_NEAR_RINGS of it. Built once per turn, so the opinion of 240 nations costs
// one pass over the cities instead of a breadth-first search per city pair.
const cityIndexCache = new WeakMap(); // regions -> { byOwner: Map, nearSets: Map(cityId -> Set(tile)) }
const ringSet = (tiles, from, max) => {
  const seen = new Set([from]); let frontier = [from];
  for (let d = 1; d <= max; d++) { const next = []; for (const t of frontier) for (const n of tiles.neighbors[t]) { if (!seen.has(n)) { seen.add(n); next.push(n); } } frontier = next; }
  return seen;
};
const cityIndexOf = (regions, tiles) => {
  let idx = cityIndexCache.get(regions);
  if (idx) return idx;
  idx = { byOwner: new Map(), nearSets: new Map() };
  Object.values(regions).forEach((c) => {
    if (!c.owner || c.tile == null) return;
    const list = idx.byOwner.get(c.owner); if (list) list.push(c); else idx.byOwner.set(c.owner, [c]);
    if (c.founded > 1) idx.nearSets.set(c.id, ringSet(tiles, c.tile, SETTLED_NEAR_RINGS));
  });
  cityIndexCache.set(regions, idx);
  return idx;
};

// The map's part of A's opinion of B: borders, settling, culture.
const mapReasons = (state, a, b) => {
  const out = [];
  const regions = state.regions || {};
  const tileOwner = state.world?.tileOwner;
  if (!tileOwner) return out;
  const tiles = getTiles();
  const idx = cityIndexOf(regions, tiles);
  const mine = idx.byOwner.get(a) || [];
  const theirs = idx.byOwner.get(b) || [];
  if (!mine.length || !theirs.length) return out;
  const theirCities = new Set(theirs.map((c) => c.id));
  let shared = 0;
  mine.forEach((c) => (c.tiles || [c.tile]).forEach((t) => { if (tiles.neighbors[t].some((n) => theirCities.has(tileOwner[n]))) shared += 1; }));
  if (shared > BORDER_FREE_TILES) out.push({ id: 'borders', label: 'Shared border', value: Math.max(BORDER_MAX, BORDER_PER_TILE * (shared - BORDER_FREE_TILES)), detail: `${shared} tiles touch` });
  const turn = state.turnNumber || 1;
  let settled = 0;
  theirs.forEach((c) => {
    const near = idx.nearSets.get(c.id);
    if (!near) return;
    if (mine.some((m) => (m.founded || 1) < c.founded && near.has(m.tile))) settled += Math.min(0, SETTLED_NEAR + (turn - c.founded));
  });
  if (settled < 0) out.push({ id: 'settledNear', label: 'Settled next to my cities', value: settled });
  const culture = theirs.filter((c) => c.founderId === a).length;
  if (culture) out.push({ id: 'myPeople', label: 'Holds cities of my people', value: HOLDS_MY_CULTURE * culture, detail: `${culture} cit${culture > 1 ? 'ies' : 'y'}` });
  // Claims are on cities (claims.js): each of mine that B claims.
  const bClaims = state.nations?.[b]?.claims || [];
  const claimed = bClaims.length ? mine.filter((c) => bClaims.includes(c.id)).length : 0;
  if (claimed) out.push({ id: 'claim', label: 'Holds a claim on my city', value: CLAIM_ON_MY_CITY * claimed, detail: mine.filter((c) => bClaims.includes(c.id)).map((c) => c.name).join(', ') });
  return out;
};

/** The reasons nation `a` has for its opinion of nation `b` (default: the player). */
export const opinionReasons = (state, a, b = state.playerNationId) => {
  const A = state.nations?.[a]; const B = state.nations?.[b];
  if (!A || !B || a === b) return [];
  const out = [{ id: 'baseline', label: 'Standing', value: OPINION_BASELINE }];
  const hostility = b === state.playerNationId ? (A.hostility || 0) : 0; // the grudge ledger is kept towards the player
  if (hostility) out.push({ id: 'grudge', label: 'Past grievances', value: -GRUDGE_PER_HOSTILITY * hostility, detail: `hostility ${hostility}` });
  out.push(...mapReasons(state, a, b));
  if (b === state.playerNationId && A.hasTradeAgreement) out.push({ id: 'trade', label: 'Trade between us', value: Math.min(TRADE_MAX, TRADE_ROUTE) });
  if (b === state.playerNationId && A.hasMilitaryPact) out.push({ id: 'alliance', label: 'Allied', value: ALLIANCE });
  if (A.openBordersWith?.[b] || B.openBordersWith?.[a]) out.push({ id: 'openBorders', label: 'Open borders', value: OPEN_BORDERS });
  if (A.defensivePact && B.defensivePact && A.defensivePact.against === B.defensivePact.against) out.push({ id: 'pact', label: 'Defensive pact together', value: DEFENSIVE_PACT });
  if ((B.marriageWith || []).includes(a) || (A.marriageWith || []).includes(b)) out.push({ id: 'marriage', label: 'Royal marriage', value: ROYAL_MARRIAGE });
  const axes = Object.keys(IDENTITY_AXES).filter((axis) => (leansPositive(A.identity, axis) && leansPositive(B.identity, axis)) || (leansNegative(A.identity, axis) && leansNegative(B.identity, axis)));
  if (axes.length) out.push({ id: 'identity', label: 'Alike in outlook', value: SAME_IDENTITY_AXIS * axes.length, detail: axes.join(', ') });
  const ae = B.ae?.[a] || 0;
  if (ae > AE_FREE) out.push({ id: 'ae', label: 'Aggressive expansion', value: AE_PER_POINT * Math.round(ae - AE_FREE), detail: `${Math.round(ae)} AE` });
  if ((B.rivals || []).includes(a)) out.push({ id: 'rival', label: 'Rival', value: RIVAL });
  if (b === state.playerNationId && (A.hostilityFloor || 0) >= 40) out.push({ id: 'truce', label: 'Broke a truce', value: BROKEN_TRUCE });
  if (A.vassalOf === b) out.push({ id: 'vassal', label: 'My overlord', value: VASSAL_OF_YOU });
  return out.map((r) => ({ ...r, value: Math.round(r.value * 10) / 10 }));
};

const cache = new WeakMap(); // state.nations -> Map(key -> opinion)

/** Nation `a`'s opinion of `b` (default: the player), -100..100. */
export const opinionOf = (state, a, b = state.playerNationId) => {
  if (!state.nations) return 0;
  let m = cache.get(state.nations);
  if (!m || m.regions !== state.regions || m.world !== state.world) { m = new Map(); m.regions = state.regions; m.world = state.world; cache.set(state.nations, m); }
  const key = `${a}|${b}`;
  if (m.has(key)) return m.get(key);
  const v = clamp(opinionReasons(state, a, b).reduce((s, r) => s + r.value, 0));
  m.set(key, v);
  return v;
};

/** The AI war roll's opinion factor: 0 at WAR_ROLL_OPINION_CEILING and above, 1 at ceiling - span. */
export const warRollOpinionMult = (opinion) => Math.max(0, (WAR_ROLL_OPINION_CEILING - opinion) / WAR_ROLL_OPINION_SPAN);

export const opinionGivesCasusBelli = (opinion) => opinion <= CASUS_BELLI_OPINION;
