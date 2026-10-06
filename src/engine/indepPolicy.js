// src/engine/indepPolicy.js
// Majors and independents, phase W3 (plans/independent-cities.md 4.5, 5 and 6; plans/MASTER-PLAN.md
// 6.5 and section 7 row 10). The independents' own AI is raids.js (W2); this module is what the
// majors do to them and how an independent comes to join one. Razing is razing.js; the siege force
// marching and the hunt for raiders run in aiOperations.js (processIndependentOps, aiHuntRaiders).
//
// The model in plain words:
// - Attitude. An independent's opinion of a major (opinion.js) is the joining measure: the usual
//   reasons (borders, AE, tribute the major pays it) plus favour bought with gifts (GIFT_GOLD buys
//   GIFT_FAVOUR, capped at FAVOUR_MAX, fading FAVOUR_DECAY a turn), kinship (the same art theme),
//   the major's culture in its city, trade, the tribute it pays the major, minus half its grudge.
// - Joining (4.5). On its think turns (raids.js thinksOn) a tribal or mercantile independent, or a
//   free city that is not a fortress, looks at the majors with a city within JOIN_KM: it joins one
//   whose attitude has stayed at JOIN_OPINION for JOIN_TURNS, or at once one whose army near it is
//   JOIN_STRENGTH_RATIO x its own while the attitude is JOIN_STRENGTH_OPINION (the best attitude
//   first). The city changes hands peacefully (no AE, loyalty JOIN_LOYALTY, its units join too).
//   To the player it is an offer (`state.joinOffers`, answered in Relations within JOIN_OFFER_TURNS);
//   the player may also ask (PROPOSE_JOINING) and gets the reason when it says no.
// - Trade (mercantile). Up to TRADE_MAX_PARTNERS majors with a city within TRADE_KM and a grudge under
//   TRADE_MAX_GRUDGE: each side gains tradeGoldOf(age) a turn; a grudge at the limit ends it.
// - Tribute to a major. A major whose army near it is DEMAND_TRIBUTE_RATIO x the independent's
//   strength may demand tributeGold a turn for TRIBUTE_TURNS turns: it pays from its treasury (a truce
//   both ways meanwhile, hostility.js) or refuses (+GRUDGE_REFUSED). A fortress never pays.
// - The AI majors think every INDEP_POLICY_PERIOD turns, staggered by id, when not at war with a
//   major and not in a civil war. In order: sign trade with mercantile neighbours (TRADE_AI_CHANCE);
//   keep up a campaign (`nation.indepGoal`); else pick one among the independents within CONQUER_KM
//   of its cities that it has met and may attack:
//     court    a joinable one with a grudge under 20, gold for COURT_GOLD_MULT gifts: a gift every
//              think turn until it joins (COURT_CHANCE to choose this);
//     conquer  its spare army near (CONQUER_KEEP_PER_CITY left in every city) is CONQUER_STRENGTH_RATIO
//              x the garrison (its units in the city): a siege force of CONQUER_FORCE_RATIO x the
//              garrison is tagged (`unit.indepOp`) and aiOperations.js marches it, besieges and
//              assaults (CONQUER_CHANCE); never a trade partner or a tributary;
//     muster   short of that force by at most MUSTER_MAX_UNITS units, a solvent major (MUSTER_MIN_GOLD,
//              a positive income) has its cities train the rest (aiProduction.js, the goal's `cap`)
//              for up to MUSTER_MAX_TURNS, then marches; an empty treasury calls it off;
//     tribute  a raiders or fortress one it outweighs DEMAND_TRIBUTE_RATIO x (DEMAND_TRIBUTE_CHANCE).
//   Score = (size + 1) x (1 + its grudge against us / 50) / (1 + rings / 4), best first.
//   Snowball guards: no new campaign above CONQUER_RUNAWAY_MULT x the median major's cities (and
//   CONQUER_RUNAWAY_MIN), nor with CONQUER_AE_LIMIT AE held against it. A campaign ends when the city
//   falls, after CONQUER_MAX_TURNS (that city is then left alone CONQUER_RETRY_TURNS), or when a
//   war with a major starts; its units go home.
// - After a conquest the AI razes only a small, crowding city (razing.js aiWantsRaze).
// Deterministic: rolls are hashRoll(`${id}|${turn}|<what>`).
import { getTiles } from '../data/geo/tiles';
import { ringsForKm, ringsApart } from '../data/geo/gridScale';
import { LogTypes } from '../data/types';
import {
  isIndependentNation, TRIBUTE_TURNS, GRUDGE_REFUSED, tributeGold, INDEP_POLICY_PERIOD, CONQUER_KM, CONQUER_STRENGTH_RATIO,
  CONQUER_FORCE_RATIO, CONQUER_KEEP_PER_CITY, CONQUER_CHANCE, CONQUER_MAX_TURNS, CONQUER_RETRY_TURNS, CONQUER_RUNAWAY_MULT,
  CONQUER_RUNAWAY_MIN, CONQUER_AE_LIMIT, JOIN_PERSONALITIES, JOIN_KM, JOIN_OPINION, JOIN_TURNS, JOIN_STRENGTH_RATIO,
  JOIN_STRENGTH_OPINION, JOIN_LOYALTY, JOIN_OFFER_TURNS, GIFT_GOLD, GIFT_FAVOUR, FAVOUR_MAX, FAVOUR_DECAY, COURT_GOLD_MULT, MUSTER_MAX_UNITS, MUSTER_MAX_TURNS, MUSTER_MIN_GOLD,
  COURT_CHANCE, DEMAND_TRIBUTE_RATIO, DEMAND_TRIBUTE_CHANCE, TRADE_KM, TRADE_MAX_PARTNERS, TRADE_MAX_GRUDGE, TRADE_AI_CHANCE,
  tradeGoldOf
} from '../data/independents';
import { opinionOf } from './opinion';
import { canAttack, hasMet } from './hostility';
import { hashRoll } from './aftermath';
import { thinksOn } from './raids';
import { grudgeOf, withGrudge } from './grudges';
import { goldIn, addGoldIn } from './mercenaries';
import { unitTile, placeInCity } from './armies';
import { isUnitInBattle } from './invasion';
import { isSettler } from './settlers';
import { ringsAround } from './world/cities';
import { transferRegion } from './regionTransfer';
import { burnCities, aiWantsRaze, startRazing } from './razing';

const COURT_MAX_GRUDGE = 20;
const COURT_MAX_TURNS = 40;
const SCORE_RINGS = 4;

const sumStrength = (units) => units.reduce((s, u) => s + Math.max(0, u.strength || 0), 0);
const isArmy = (u) => u.domain !== 'naval' && !u.embarkedOn && !isSettler(u) && u.strength > 0;

/** May this independent join a major at all? Tribal and mercantile peoples, and free cities that are not fortresses. */
export const mayJoin = (nation) => {
  const p = nation?.indep?.personality || 'tribal';
  if (p === 'fortress') return false;
  return JOIN_PERSONALITIES.includes(p) || !!nation?.indep?.freeCity;
};

/** An independent's attitude to a major: its opinion with the W3 reasons (opinion.js). */
export const attitudeOf = (state, indepId, majorId) => opinionOf(state, indepId, majorId);

/** Land strength of `nationId` within `rings` of `tile` (`byTile`: Map tile -> land units). */
const strengthNear = (byTile, nationId, tile, rings) => {
  let s = 0;
  ringsAround(getTiles(), tile, rings).forEach((d, t) => { (byTile.get(t) || []).forEach((u) => { if (u.ownerId === nationId) s += u.strength; }); });
  return s;
};
const unitsByTile = (state, units = state.units) => {
  const map = new Map();
  Object.values(units).forEach((u) => {
    if (!isArmy(u)) return;
    const t = unitTile(state, u);
    if (t == null) return;
    const l = map.get(t); if (l) l.push(u); else map.set(t, [u]);
  });
  return map;
};
/** The whole land army of `id` (from the tile index when given: one pass a turn per major). */
const armyCache = new WeakMap(); // byTile -> Map(id -> strength)
const armyStrength = (state, id, byTile = null) => {
  if (!byTile) return sumStrength(Object.values(state.units).filter((u) => u.ownerId === id && isArmy(u)));
  let m = armyCache.get(byTile);
  if (!m) { m = new Map(); byTile.forEach((list) => list.forEach((u) => m.set(u.ownerId, (m.get(u.ownerId) || 0) + u.strength))); armyCache.set(byTile, m); }
  return m.get(id) || 0;
};
/** How many land units (not settlers) `id` fields: the muster cap counts from it (aiProduction.js). */
const landUnitCount = (w, id) => Object.values(w.units).filter((u) => u.ownerId === id && u.domain === 'land' && !isSettler(u)).length;
/** Every land unit of independent `id` (garrison and raid party). */
const indepStrength = (state, id) => sumStrength(Object.values(state.units).filter((u) => u.ownerId === id && isArmy(u)));

/** The majors (alive, not independents) with a city centre within `rings` of `tile`: Map id -> nearest rings. */
const majorsNear = (state, tile, rings) => {
  const out = new Map();
  const tileOwner = state.world?.tileOwner || {};
  ringsAround(getTiles(), tile, rings).forEach((d, t) => {
    const c = state.regions[tileOwner[t]];
    if (!c || c.tile !== t || c.outpost || !c.owner) return;
    const n = state.nations[c.owner];
    if (!n || n.isEliminated || isIndependentNation(n)) return;
    if (!out.has(c.owner) || out.get(c.owner) > d) out.set(c.owner, d);
  });
  return out;
};

// ---------------------------------------------------------------------------------------------
// Joining

/**
 * Would independent `indepId` join major `majorId` now? { ok, how: 'opinion' | 'strength', attitude }
 * or { ok: false, reason, attitude }. `byTile`: optional land-units index.
 */
export const joinCheck = (state, indepId, majorId, byTile = null) => {
  const n = state.nations?.[indepId];
  const m = state.nations?.[majorId];
  if (!isIndependentNation(n) || n.isEliminated) return { ok: false, reason: 'Not an independent city.' };
  if (!m || m.isEliminated || isIndependentNation(m)) return { ok: false, reason: 'Only a nation can take them in.' };
  if (!mayJoin(n)) return { ok: false, reason: n.indep?.personality === 'fortress' ? 'A fortress people never submits peacefully.' : 'Raiders will not give up their freedom.' };
  const city = state.regions?.[n.capitalRegionId];
  if (!city || city.owner !== indepId) return { ok: false, reason: 'Their city is lost.' };
  if (city.siege?.by) return { ok: false, reason: 'Not while their city is under siege.' };
  if (!majorsNear(state, city.tile, ringsForKm(JOIN_KM)).has(majorId)) return { ok: false, reason: 'None of your cities is close enough.' };
  const attitude = attitudeOf(state, indepId, majorId);
  const since = n.indep?.leanSince?.[majorId];
  if (attitude >= JOIN_OPINION && since != null && (state.turnNumber || 0) - since >= JOIN_TURNS) return { ok: true, how: 'opinion', attitude };
  // The plan's "5 times its military strength": the major's whole land army against all of its own.
  const theirs = Math.max(1, indepStrength(state, indepId));
  const mine = armyStrength(state, majorId, byTile);
  if (attitude >= JOIN_STRENGTH_OPINION && mine >= JOIN_STRENGTH_RATIO * theirs) return { ok: true, how: 'strength', attitude };
  const why = attitude < JOIN_STRENGTH_OPINION
    ? `Their attitude to you is ${attitude}: they would join at ${JOIN_OPINION} held for ${JOIN_TURNS} turns, or at ${JOIN_STRENGTH_OPINION} if your army is ${JOIN_STRENGTH_RATIO} times their own.`
    : attitude >= JOIN_OPINION
      ? `Their attitude is ${attitude}: it must hold for ${JOIN_TURNS} turns (${since == null ? 'just started' : `${(state.turnNumber || 0) - since} so far`}), or your army must be ${JOIN_STRENGTH_RATIO} times their own.`
      : `Their attitude is ${attitude}: your army must be ${JOIN_STRENGTH_RATIO} times their own (now ${(mine / theirs).toFixed(1)} times), or raise it to ${JOIN_OPINION}.`;
  return { ok: false, reason: why, attitude };
};

/** Independent `indepId` joins major `majorId` in the turn's working maps `w` (mutated). */
const annex = (w, indepId, majorId) => {
  const n = w.nations[indepId];
  const city = w.regions[n.capitalRegionId];
  const { region, revivedNation } = transferRegion(city, majorId, w.nations, { loyalty: JOIN_LOYALTY, control: 100, unrest: 0, siege: null, freeCity: undefined, joinedTurn: w.turn, culture: { ...(city.culture || {}) } });
  w.regions[city.id] = region;
  if (revivedNation) w.nations[majorId] = revivedNation;
  // Its soldiers serve the new owner; its raid party and mercenary deals end with it.
  Object.keys(w.units).forEach((uid) => {
    const u = w.units[uid];
    if (u.ownerId !== indepId) return;
    const rest = { ...u, ownerId: majorId, regionId: city.id, homeRegionId: city.id, tile: city.tile, route: null };
    delete rest.raidOf; delete rest.mercenary;
    w.units[uid] = rest;
  });
  w.nations[indepId] = { ...n, isEliminated: true, capitalRegionId: null, indep: { ...n.indep, raid: null, joined: { to: majorId, turn: w.turn } } };
  // Its tribute and trade deals end with it (they live on its record); campaigns against it end at their next think.
  w.stats.joined += 1;
  const who = w.nations[majorId]?.name || majorId;
  w.logs.push({ year: w.year, type: LogTypes.DIPLOMACY, message: majorId === w.playerId ? `${n.name} join you: ${city.name} is yours, peacefully.` : `${n.name} join ${who}.`, nationId: majorId });
};

// ---------------------------------------------------------------------------------------------
// One independent's turn: favour, trade, tribute paid to majors, joining

const setIndep = (w, id, patch) => { const n = w.nations[id]; w.nations[id] = { ...n, indep: { ...n.indep, ...patch } }; };

const independentTurn = (w, id, byTile) => {
  let n = w.nations[id];
  const city = w.regions[n.capitalRegionId];
  if (!city || city.owner !== id) return;
  // Favour fades.
  if (n.indep.favour) {
    const favour = {};
    Object.keys(n.indep.favour).forEach((k) => { const v = n.indep.favour[k] - FAVOUR_DECAY; if (v > 0) favour[k] = Math.round(v * 10) / 10; });
    setIndep(w, id, { favour });
    n = w.nations[id];
  }
  // Trade: gold both ways; a grudge at the limit, or a partner gone, ends it.
  if (n.indep.tradeWith) {
    const tradeWith = { ...n.indep.tradeWith };
    const gold = tradeGoldOf(w.age);
    Object.keys(tradeWith).sort().forEach((p) => {
      if (!w.nations[p] || w.nations[p].isEliminated || grudgeOf(n, p) >= TRADE_MAX_GRUDGE) { delete tradeWith[p]; if (p === w.playerId) w.logs.push({ year: w.year, type: LogTypes.DIPLOMACY, message: `${n.name} end their trade with you.` }); return; }
      addGoldIn(w, p, gold); addGoldIn(w, id, gold); w.stats.tradeGold += gold;
    });
    setIndep(w, id, { tradeWith });
    n = w.nations[id];
  }
  // Tribute it pays to majors.
  if (n.indep.tributeTo) {
    const tributeTo = { ...n.indep.tributeTo };
    const truceWith = { ...(n.indep.truceWith || {}) };
    Object.keys(tributeTo).sort().forEach((p) => {
      const { until, gold } = tributeTo[p];
      if (until <= w.turn || !w.nations[p] || w.nations[p].isEliminated || goldIn(w, id) < gold) { delete tributeTo[p]; if (truceWith[p] === until) delete truceWith[p]; return; }
      addGoldIn(w, id, -gold); addGoldIn(w, p, gold); w.stats.tributeToMajors += gold;
    });
    setIndep(w, id, { tributeTo, truceWith });
    n = w.nations[id];
  }
  // Joining, on its think turns.
  if (!thinksOn(id, w.turn) || !mayJoin(n) || city.siege?.by) return;
  const near = majorsNear(w.view, city.tile, ringsForKm(JOIN_KM));
  if (!near.size) { if (n.indep.leanSince) setIndep(w, id, { leanSince: undefined }); return; }
  const leanSince = {};
  const scored = [...near.keys()].map((m) => ({ m, a: attitudeOf(w.view, id, m) })).sort((x, y) => y.a - x.a || (x.m < y.m ? -1 : 1));
  scored.forEach(({ m, a }) => { if (a >= JOIN_OPINION) leanSince[m] = n.indep.leanSince?.[m] ?? w.turn; });
  setIndep(w, id, { leanSince: Object.keys(leanSince).length ? leanSince : undefined });
  for (const { m } of scored) {
    const check = joinCheck(w.view, id, m, byTile);
    if (!check.ok) continue;
    if (m === w.playerId) {
      if (!w.joinOffers.some((o) => o.indepId === id)) {
        w.joinOffers.push({ id: `join_${id}_${w.turn}`, indepId: id, turn: w.turn, expires: w.turn + JOIN_OFFER_TURNS });
        w.logs.push({ year: w.year, type: LogTypes.DIPLOMACY, message: `${n.name} offer to join you. Answer under Relations on the Empire tab within ${JOIN_OFFER_TURNS} turns.` });
      }
      return;
    }
    annex(w, id, m);
    return;
  }
};

// ---------------------------------------------------------------------------------------------
// The AI majors

const atWarWithMajor = (w, id) => w.wars.some((x) => x.active && (x.aggressor === id || x.enemy === id));
const policyTurn = (id, turn) => (Math.floor(hashRoll(`${id}|indepPolicy`) * INDEP_POLICY_PERIOD) + turn) % INDEP_POLICY_PERIOD === 0;

/** Ends `majorId`'s campaign: its tagged units go home (to their base city's centre). */
const endCampaign = (w, majorId, why, cooldown = true) => {
  const m = w.nations[majorId];
  const goal = m.indepGoal;
  if (!goal) return;
  Object.keys(w.units).forEach((uid) => {
    const u = w.units[uid];
    if (u.ownerId !== majorId || u.indepOp !== goal.id) return;
    const rest = { ...u }; delete rest.indepOp; delete rest.routeFailed;
    const base = w.regions[rest.regionId]?.owner === majorId ? rest.regionId : m.capitalRegionId;
    w.units[uid] = base && w.regions[base] && why !== 'taken' ? { ...placeInCity(rest, w.regions, base), route: null } : rest;
  });
  const retry = cooldown ? { ...(m.indepRetry || {}), [goal.id]: w.turn + CONQUER_RETRY_TURNS } : m.indepRetry;
  w.nations[majorId] = { ...w.nations[majorId], indepGoal: null, ...(retry ? { indepRetry: retry } : {}) };
};

/** The garrison of an independent: its units standing in the city (the siege wears the walls down). */
const garrisonOf = (byTile, id, city) => sumStrength((byTile.get(city.tile) || []).filter((u) => u.ownerId === id));

/** The spare armies of `majorId` within `rings` of `tile`, nearest first, keeping CONQUER_KEEP_PER_CITY in every city. */
const spareArmies = (w, majorId, tile, rings) => {
  const tiles = getTiles();
  const near = ringsAround(tiles, tile, rings);
  const keep = new Map();
  const list = [];
  Object.values(w.units).forEach((u) => {
    if (u.ownerId !== majorId || !isArmy(u) || u.indepOp || u.raidOf || u.mercenary || isUnitInBattle(w.view, u.id)) return;
    const t = unitTile(w.view, u);
    const d = near.get(t);
    if (d == null) return;
    list.push({ u, d, t });
  });
  list.sort((a, b) => a.d - b.d || (a.u.id < b.u.id ? -1 : 1));
  // Every city centre keeps its last CONQUER_KEEP_PER_CITY units (the strongest stay).
  const centre = (t) => { const c = w.regions[w.view.world?.tileOwner?.[t]]; return c && c.tile === t && c.owner === majorId; };
  const byCentre = new Map();
  list.forEach((x) => { if (centre(x.t)) { const l = byCentre.get(x.t) || []; l.push(x.u); byCentre.set(x.t, l); } });
  byCentre.forEach((l, t) => { l.sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)); keep.set(t, new Set(l.slice(0, CONQUER_KEEP_PER_CITY).map((u) => u.id))); });
  return list.filter((x) => !keep.get(x.t)?.has(x.u.id)).map((x) => x.u);
};

const gift = (w, majorId, indepId) => {
  if (goldIn(w, majorId) < GIFT_GOLD) return false;
  addGoldIn(w, majorId, -GIFT_GOLD); addGoldIn(w, indepId, GIFT_GOLD);
  const n = w.nations[indepId];
  setIndep(w, indepId, { favour: { ...(n.indep.favour || {}), [majorId]: Math.min(FAVOUR_MAX, (n.indep.favour?.[majorId] || 0) + GIFT_FAVOUR) } });
  w.stats.gifts += 1;
  return true;
};

/** A tribute demand by `majorId` on independent `indepId` ({ paid } after it answers). Mutates `w`. */
const demandTributeOf = (w, majorId, indepId, mine, theirs) => {
  const n = w.nations[indepId];
  const pays = n.indep?.personality !== 'fortress' && mine >= DEMAND_TRIBUTE_RATIO * Math.max(1, theirs);
  if (!pays) { w.nations[indepId] = withGrudge(n, majorId, GRUDGE_REFUSED); return false; }
  const until = w.turn + TRIBUTE_TURNS;
  setIndep(w, indepId, { tributeTo: { ...(n.indep.tributeTo || {}), [majorId]: { until, gold: tributeGold(w.age) } }, truceWith: { ...(n.indep.truceWith || {}), [majorId]: until } });
  w.stats.tributeDemandsByMajors += 1;
  return true;
};

/** Tags the siege force: the nearest spare armies up to CONQUER_FORCE_RATIO x the garrison. */
const tagForce = (w, majorId, targetId, spare, garrison) => {
  let force = 0;
  for (const u of spare) {
    if (force >= CONQUER_FORCE_RATIO * garrison) break;
    w.units[u.id] = { ...w.units[u.id], indepOp: targetId };
    force += u.strength;
  }
};

const UNIT_STRENGTH = 1000;

/** The best attitude courting could reach: today's, with favour at FAVOUR_MAX. */
const courtCeiling = (w, indepId, majorId) => attitudeOf(w.view, indepId, majorId) - (w.nations[indepId].indep?.favour?.[majorId] || 0) + FAVOUR_MAX;

const majorTurn = (w, majorId, ctx) => {
  const m = w.nations[majorId];
  const goal = m.indepGoal;
  // A war with a major or a civil war: every campaign stops.
  if (atWarWithMajor(w, majorId) || m.civilWar?.active) { if (goal) endCampaign(w, majorId, 'war', false); return; }
  const tiles = getTiles();
  const reach = ringsForKm(CONQUER_KM);
  const forceReach = reach + ringsForKm(306);
  // Keep up the campaign.
  if (goal) {
    const t = w.nations[goal.id];
    const city = w.regions[goal.cityId];
    if (!t || t.isEliminated || !city || city.owner !== goal.id) endCampaign(w, majorId, city?.owner === majorId ? 'taken' : 'gone', false);
    else if (!canAttack(w.view, majorId, goal.id)) endCampaign(w, majorId, 'truce');
    else if (goal.kind === 'conquer') {
      if (w.turn - goal.since > CONQUER_MAX_TURNS || !Object.values(w.units).some((u) => u.ownerId === majorId && u.indepOp === goal.id && u.strength > 0)) endCampaign(w, majorId, 'expired');
      return;
    } else if (goal.kind === 'muster') {
      // Raising the army (aiProduction.js trains `need` more units): march once it is there.
      const garrison = Math.max(1, garrisonOf(ctx.byTile, goal.id, city));
      const spare = spareArmies(w, majorId, city.tile, forceReach);
      if (sumStrength(spare) >= CONQUER_STRENGTH_RATIO * garrison) {
        tagForce(w, majorId, goal.id, spare, garrison);
        w.nations[majorId] = { ...w.nations[majorId], indepGoal: { id: goal.id, cityId: goal.cityId, kind: 'conquer', since: w.turn } };
        w.stats.campaigns += 1;
      } else if (w.turn - goal.since > MUSTER_MAX_TURNS || goldIn(w, majorId) <= 0) endCampaign(w, majorId, 'expired');
      else {
        // The garrison grows too: the muster follows it (its cities train what is still missing).
        const need = Math.min(MUSTER_MAX_UNITS, Math.max(1, Math.ceil((CONQUER_FORCE_RATIO * garrison - sumStrength(spare)) / UNIT_STRENGTH)));
        const cap = landUnitCount(w, majorId) + need;
        if (need !== goal.need || cap !== goal.cap) w.nations[majorId] = { ...w.nations[majorId], indepGoal: { ...goal, need, cap } };
      }
      return;
    } else if (goal.kind === 'court') {
      if (w.turn - goal.since > COURT_MAX_TURNS || grudgeOf(t, majorId) >= COURT_MAX_GRUDGE || courtCeiling(w, goal.id, majorId) < JOIN_OPINION) endCampaign(w, majorId, 'expired');
      else if (goldIn(w, majorId) >= GIFT_GOLD * 2) gift(w, majorId, goal.id);
      return;
    } else return;
  }
  // The independents in reach, by score.
  const mine = ctx.citiesOf.get(majorId) || [];
  if (!mine.length) return;
  const cands = [];
  ctx.indeps.forEach((iid) => {
    const n = w.nations[iid];
    if (!n || n.isEliminated) return;
    const city = w.regions[n.capitalRegionId];
    if (!city || city.owner !== iid || city.tile == null) return;
    let best = Infinity;
    for (const c of mine) { const d = ringsApart(c.tile, city.tile, tiles); if (d < best) best = d; }
    if (best > reach || !hasMet(w.view, majorId, iid)) return;
    cands.push({ id: iid, n, city, rings: best });
  });
  if (!cands.length) return;
  // Trade with mercantile neighbours (within TRADE_KM: CONQUER_KM is inside it).
  cands.forEach(({ id: iid, n }) => {
    if (n.indep?.personality !== 'mercantile' || n.indep.tradeWith?.[majorId] != null || Object.keys(n.indep.tradeWith || {}).length >= TRADE_MAX_PARTNERS || grudgeOf(n, majorId) >= TRADE_MAX_GRUDGE) return;
    if (hashRoll(`${majorId}|${iid}|${w.turn}|trade`) >= TRADE_AI_CHANCE) return;
    setIndep(w, iid, { tradeWith: { ...(n.indep.tradeWith || {}), [majorId]: w.turn } });
    w.stats.tradeDeals += 1;
  });
  const runaway = mine.length > Math.max(CONQUER_RUNAWAY_MIN, CONQUER_RUNAWAY_MULT * ctx.medianCities);
  const aeHeld = Object.values(w.nations).reduce((mx, o) => Math.max(mx, o.ae?.[majorId] || 0), 0);
  const scored = cands.map((c) => ({ ...c, score: ((c.city.size || 1) + 1) * (1 + grudgeOf(w.nations[c.id], majorId) / 50) / (1 + c.rings / SCORE_RINGS) }))
    .filter((c) => !((w.nations[majorId].indepRetry?.[c.id] || 0) > w.turn))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  for (const c of scored) {
    const n = w.nations[c.id];
    if (!canAttack(w.view, majorId, c.id)) continue;
    // Court a joinable neighbour whose attitude gifts could lift to JOIN_OPINION.
    if (mayJoin(n) && grudgeOf(n, majorId) < COURT_MAX_GRUDGE && goldIn(w, majorId) >= COURT_GOLD_MULT * GIFT_GOLD
      && hashRoll(`${majorId}|${c.id}|${w.turn}|court`) < COURT_CHANCE && courtCeiling(w, c.id, majorId) >= JOIN_OPINION) {
      w.nations[majorId] = { ...w.nations[majorId], indepGoal: { id: c.id, cityId: c.city.id, kind: 'court', since: w.turn } };
      gift(w, majorId, c.id);
      w.stats.courtships += 1;
      return;
    }
    if (n.indep?.tradeWith?.[majorId] != null) continue; // never a trade partner
    // Raiders it outweighs may be made to pay instead (the AI only asks when it would be paid).
    if (n.indep?.personality === 'raiders' && !n.indep?.tributeTo?.[majorId] && hashRoll(`${majorId}|${c.id}|${w.turn}|tribute`) < DEMAND_TRIBUTE_CHANCE) {
      const near = strengthNear(ctx.byTile, majorId, c.city.tile, reach);
      const theirs = indepStrength(w.view, c.id);
      if (near >= DEMAND_TRIBUTE_RATIO * Math.max(1, theirs) && demandTributeOf(w, majorId, c.id, near, theirs)) return;
    }
    if (runaway || aeHeld >= CONQUER_AE_LIMIT) continue;
    if (hashRoll(`${majorId}|${c.id}|${w.turn}|conquer`) >= CONQUER_CHANCE) continue;
    const garrison = Math.max(1, garrisonOf(ctx.byTile, c.id, c.city));
    const spare = spareArmies(w, majorId, c.city.tile, forceReach);
    const spareStrength = sumStrength(spare);
    if (spareStrength >= CONQUER_STRENGTH_RATIO * garrison) {
      tagForce(w, majorId, c.id, spare, garrison);
      w.nations[majorId] = { ...w.nations[majorId], indepGoal: { id: c.id, cityId: c.city.id, kind: 'conquer', since: w.turn } };
      w.stats.campaigns += 1;
      return;
    }
    // Not enough yet: muster (its cities train the missing units, aiProduction.js), if it is a few.
    const need = Math.ceil((CONQUER_FORCE_RATIO * garrison - spareStrength) / UNIT_STRENGTH);
    if (need > MUSTER_MAX_UNITS || goldIn(w, majorId) < MUSTER_MIN_GOLD || (w.nations[majorId].lastNetIncome ?? 1) <= 0) continue;
    w.nations[majorId] = { ...w.nations[majorId], indepGoal: { id: c.id, cityId: c.city.id, kind: 'muster', since: w.turn, need, cap: landUnitCount(w, majorId) + need } };
    w.stats.musters += 1;
    return;
  }
};

// ---------------------------------------------------------------------------------------------
// The phase

/**
 * Majors and independents, one turn (resolveTurn, after the independents' own phase). `input`: the
 * turn's state with its working maps ({ regions, units, nations, resources, world, wars, turnNumber
 * (the new turn), year, age, playerNationId, joinOffers, indepStats }). Returns { regions, units,
 * nations, resources, world, wars, joinOffers, indepStats, logs } (new maps; the input's are not
 * written) or null in a world without independents (and nothing burning).
 */
export const processMajorsAndIndependents = (input) => {
  const indeps = Object.keys(input.nations || {}).filter((id) => isIndependentNation(input.nations[id]) && !input.nations[id].isEliminated).sort();
  const burning = Object.values(input.regions || {}).some((c) => c.razing);
  if (!indeps.length && !burning) return null;
  const w = {
    turn: input.turnNumber, year: input.year, age: input.age, playerId: input.playerNationId,
    regions: { ...input.regions }, units: { ...input.units }, nations: { ...input.nations }, resources: { ...input.resources },
    wars: [...(input.wars || [])], world: { ...(input.world || {}) }, logs: [], joinOffers: [...(input.joinOffers || [])],
    stats: { conquered: 0, joined: 0, razeStarted: 0, razed: 0, campaigns: 0, musters: 0, courtships: 0, gifts: 0, tradeDeals: 0, tradeGold: 0, tributeDemandsByMajors: 0, tributeToMajors: 0, ...(input.indepStats || {}) }
  };
  w.view = { ...input, regions: w.regions, units: w.units, nations: w.nations, world: w.world, wars: w.wars };
  // 1. Fire.
  const fire = burnCities({ regions: w.regions, nations: w.nations, units: w.units, world: w.world, wars: w.wars, playerNationId: w.playerId, year: w.year });
  w.stats.razed += fire.razed.length;
  fire.logs.forEach((l) => w.logs.push(l));
  // 2. A city just taken from an independent: its treasury goes to the taker (PLUNDER), and the AI
  // razes a small, crowding one.
  Object.keys(w.regions).sort().forEach((cid) => {
    const c = w.regions[cid];
    if (!c.conquest || c.conquest.turn < w.turn - 1 || !c.owner || isIndependentNation(w.nations[c.owner])) return;
    const loser = w.nations[c.conquest.from];
    if (isIndependentNation(loser) && (loser.indep?.gold || 0) > 0) {
      const gold = loser.indep.gold;
      w.nations[loser.id] = { ...loser, indep: { ...loser.indep, gold: 0 } };
      addGoldIn(w, c.owner, gold);
      w.stats.plunder = (w.stats.plunder || 0) + gold;
      if (c.owner === w.playerId) w.logs.push({ year: w.year, type: LogTypes.COMBAT, message: `You take the treasury of ${loser.name} in ${c.name}: +${gold} gold.` });
    }
    if (c.owner === w.playerId) return;
    if (!aiWantsRaze(w.view, c.owner, cid)) return;
    const r = startRazing(w.view, c.owner, cid);
    if (!r) return;
    Object.assign(w.regions, r.regions); Object.assign(w.nations, r.nations);
    w.stats.razeStarted += 1;
  });
  // The player's join offers lapse.
  w.joinOffers = w.joinOffers.filter((o) => o.expires > w.turn && w.nations[o.indepId] && !w.nations[o.indepId].isEliminated);
  if (!indeps.length) return { regions: w.regions, units: w.units, nations: w.nations, resources: w.resources, world: w.world, wars: w.wars, joinOffers: w.joinOffers, indepStats: w.stats, logs: w.logs };
  const byTile = unitsByTile(w.view, w.units);
  // 3. The independents: favour, trade, tribute to majors, joining.
  indeps.forEach((id) => { if (!w.nations[id].isEliminated) independentTurn(w, id, byTile); });
  // 4. The AI majors.
  const citiesOf = new Map();
  Object.values(w.regions).forEach((c) => {
    if (!c.owner || c.outpost || c.tile == null || isIndependentNation(w.nations[c.owner])) return;
    const l = citiesOf.get(c.owner); if (l) l.push(c); else citiesOf.set(c.owner, [c]);
  });
  const counts = [...citiesOf.values()].map((l) => l.length).sort((a, b) => a - b);
  const ctx = { byTile, citiesOf, indeps: indeps.filter((id) => !w.nations[id].isEliminated), medianCities: counts.length ? counts[Math.floor(counts.length / 2)] : 0 };
  Object.keys(w.nations).sort().forEach((id) => {
    const n = w.nations[id];
    if (id === w.playerId || n.isEliminated || isIndependentNation(n)) return;
    if (!policyTurn(id, w.turn)) {
      // Between think turns only a campaign's end is noticed (the city fell or joined someone).
      const goal = n.indepGoal;
      const city = goal ? w.regions[goal.cityId] : null;
      if (goal && (!w.nations[goal.id] || w.nations[goal.id].isEliminated || city?.owner !== goal.id)) endCampaign(w, id, city?.owner === id ? 'taken' : 'gone', false);
      else if (goal && (atWarWithMajor(w, id) || n.civilWar?.active)) endCampaign(w, id, 'war', false);
      return;
    }
    majorTurn(w, id, ctx);
  });
  return { regions: w.regions, units: w.units, nations: w.nations, resources: w.resources, world: w.world, wars: w.wars, joinOffers: w.joinOffers, indepStats: w.stats, logs: w.logs };
};

// ---------------------------------------------------------------------------------------------
// The player's actions (gameReducer)

const playerW = (state) => ({ playerId: state.playerNationId, resources: { ...state.resources }, nations: { ...state.nations } });
const withLog = (state, message, type = LogTypes.DIPLOMACY) => [...(state.logs || []), { year: state.year, message, type }];

/** GIFT_INDEPENDENT: GIFT_GOLD gold for GIFT_FAVOUR favour. Returns a new state or { reason }. */
export const giftIndependent = (state, indepId) => {
  const n = state.nations?.[indepId];
  if (!isIndependentNation(n) || n.isEliminated) return { reason: 'Not an independent city.' };
  if ((state.resources?.gold || 0) < GIFT_GOLD) return { reason: `You need ${GIFT_GOLD} gold.` };
  const w = playerW(state);
  addGoldIn(w, w.playerId, -GIFT_GOLD); addGoldIn(w, indepId, GIFT_GOLD);
  const favour = Math.min(FAVOUR_MAX, (n.indep?.favour?.[w.playerId] || 0) + GIFT_FAVOUR);
  w.nations[indepId] = { ...w.nations[indepId], indep: { ...w.nations[indepId].indep, favour: { ...(n.indep?.favour || {}), [w.playerId]: favour } } };
  return { ...state, resources: w.resources, nations: w.nations, logs: withLog(state, `You send ${n.name} ${GIFT_GOLD} gold: their favour toward you is ${favour}.`) };
};

/** Turns the independent's city over to the player (an accepted offer or a granted proposal). */
const joinPlayer = (state, indepId) => {
  const w = {
    turn: state.turnNumber || 0, year: state.year, playerId: state.playerNationId, regions: { ...state.regions }, units: { ...state.units },
    nations: { ...state.nations }, logs: [], stats: { ...(state.indepStats || {}), joined: (state.indepStats?.joined || 0) }
  };
  annex(w, indepId, state.playerNationId);
  return { ...state, regions: w.regions, units: w.units, nations: w.nations, indepStats: w.stats, joinOffers: (state.joinOffers || []).filter((o) => o.indepId !== indepId), logs: [...(state.logs || []), ...w.logs.map(({ nationId, ...l }) => l)] }; // eslint-disable-line no-unused-vars
};

/** PROPOSE_JOINING: the player asks an independent to join. Returns a new state or { reason }. */
export const proposeJoining = (state, indepId) => {
  const check = joinCheck(state, indepId, state.playerNationId);
  if (!check.ok) return { reason: check.reason };
  return joinPlayer(state, indepId);
};

/** ANSWER_JOIN_OFFER: accept (the city joins, if it still would) or decline. */
export const answerJoinOffer = (state, offerId, accept) => {
  const o = (state.joinOffers || []).find((x) => x.id === offerId);
  if (!o) return state;
  const n = state.nations[o.indepId];
  const rest = (state.joinOffers || []).filter((x) => x.id !== offerId);
  if (!accept || !n || n.isEliminated || state.regions[n.capitalRegionId]?.owner !== o.indepId) {
    return { ...state, joinOffers: rest, logs: n ? withLog(state, `You decline ${n.name}'s offer to join.`) : state.logs };
  }
  return joinPlayer({ ...state, joinOffers: rest }, o.indepId);
};

/** DEMAND_INDEPENDENT_TRIBUTE: with DEMAND_TRIBUTE_RATIO x its strength near it, it pays, else refuses (+grudge). */
export const demandIndependentTribute = (state, indepId) => {
  const n = state.nations?.[indepId];
  const me = state.playerNationId;
  if (!isIndependentNation(n) || n.isEliminated) return { reason: 'Not an independent city.' };
  if (n.indep?.tributeTo?.[me]) return { reason: 'They already pay you tribute.' };
  if (!canAttack(state, me, indepId)) return { reason: 'You pay them tribute: you cannot threaten them meanwhile.' };
  const city = state.regions[n.capitalRegionId];
  if (!city) return { reason: 'Their city is lost.' };
  const w = { turn: state.turnNumber || 0, age: state.age, playerId: me, nations: { ...state.nations }, resources: { ...state.resources }, stats: { ...(state.indepStats || {}) } };
  w.stats.tributeDemandsByMajors = w.stats.tributeDemandsByMajors || 0;
  const near = strengthNear(unitsByTile(state), me, city.tile, ringsForKm(CONQUER_KM));
  const paid = demandTributeOf(w, me, indepId, near, indepStrength(state, indepId));
  const msg = paid
    ? `${n.name} agree to pay you ${tributeGold(state.age)} gold a turn for ${TRIBUTE_TURNS} turns (a truce both ways meanwhile).`
    : n.indep?.personality === 'fortress' ? `${n.name} refuse: a fortress people pays no one. They will remember it.` : `${n.name} refuse: your army near them is not ${DEMAND_TRIBUTE_RATIO} times their strength. They will remember it.`;
  return { ...state, nations: w.nations, indepStats: w.stats, logs: withLog(state, msg) };
};

/** PROPOSE_INDEPENDENT_TRADE: a trade deal with a mercantile independent. Returns a new state or { reason }. */
export const proposeIndependentTrade = (state, indepId) => {
  const n = state.nations?.[indepId];
  const me = state.playerNationId;
  if (!isIndependentNation(n) || n.isEliminated) return { reason: 'Not an independent city.' };
  if (n.indep?.personality !== 'mercantile') return { reason: 'Only a mercantile city trades.' };
  if (n.indep.tradeWith?.[me] != null) return { reason: 'You already trade with them.' };
  if (Object.keys(n.indep.tradeWith || {}).length >= TRADE_MAX_PARTNERS) return { reason: `They trade with ${TRADE_MAX_PARTNERS} nations already.` };
  if (grudgeOf(n, me) >= TRADE_MAX_GRUDGE) return { reason: 'They hold a grudge against you.' };
  const city = state.regions[n.capitalRegionId];
  if (!city || !majorsNear(state, city.tile, ringsForKm(TRADE_KM)).has(me)) return { reason: 'None of your cities is close enough.' };
  const nations = { ...state.nations, [indepId]: { ...n, indep: { ...n.indep, tradeWith: { ...(n.indep.tradeWith || {}), [me]: state.turnNumber || 0 } } } };
  const stats = { ...(state.indepStats || {}), tradeDeals: (state.indepStats?.tradeDeals || 0) + 1 };
  return { ...state, nations, indepStats: stats, logs: withLog(state, `You open trade with ${n.name}: ${tradeGoldOf(state.age)} gold a turn each way.`) };
};

/** RAZE_CITY / STOP_RAZING for the player. Returns a new state or { reason }. */
export const razeCityForPlayer = (state, cityId) => {
  const r = startRazing(state, state.playerNationId, cityId);
  if (!r) return { reason: 'This city cannot be razed.' };
  const stats = { ...(state.indepStats || {}), razeStarted: (state.indepStats?.razeStarted || 0) + 1 };
  return { ...state, regions: r.regions, nations: r.nations, indepStats: stats, logs: [...(state.logs || []), ...r.logs.map(({ nationId, ...l }) => l)] }; // eslint-disable-line no-unused-vars
};
