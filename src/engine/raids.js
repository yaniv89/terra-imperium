// src/engine/raids.js
// The independents' own AI, phase W2 (plans/independent-cities.md 4, plans/MASTER-PLAN.md 6.5,
// 6.8 and decisions 37 and 38): raids, sacks, grudges and tribute. Mercenaries are in
// mercenaries.js, grudges in grudges.js, the raid battle (the swap point for the RTS phase R3) in
// raidBattle.js, the numbers in src/data/independents.js.
//
// The model in plain words:
// - Treasury. An independent keeps `indep.gold`: its city's gold yield a turn (x2 mercantile),
//   capped at INDEPENDENT_GOLD_CAP, plus loot, tribute and mercenary pay.
// - Thinking. Each independent thinks every THINK_PERIOD turns, staggered by a hash of its id
//   (about a third think a turn). A thinker, top priority first, stopping at the first that acts:
//     1. under threat (an army that may fight it within THREAT_KM of its city, or a siege): mood
//        'besieged', its raid party is recalled, a mercantile city hires one defender with its gold;
//     2. recovering (RAID_RECOVER_TURNS after a lost raid battle or a sack against it): nothing;
//     3. a raid: no raid running, the cooldown passed (RAID_COOLDOWN), and units above its garrison
//        target (the city queue trains RAID_RESERVE extra for raiders, tribal and fortress). It scans
//        the tiles within RAID_KM of its city (a ring scan, no path search) for majors' land it may
//        fight (no truce, no tribute) and scores each target:
//          score = loot x (1 + grudge / 50) x era / (1 + defenders near / party) - 2 per 102 km
//        targets: an improvement (loot RAID_GOLD, pillaged), a tile of the player's trade routes
//        (ROUTE_LOOT from the victim, the route cut while the party stands on it), a settler
//        (killed), an outpost (burned: half its progress lost) or a city whose garrison is under half
//        the party (a SACK); a city sacked or burned lately is spared RAID_SPARE_TURNS. It raids
//        when the best score clears RAID_THRESHOLD and the seeded roll
//        passes RAID_CHANCE x (1 + grudge / 100) (x the difficulty against the player). A fortress
//        raids only in revenge (a grudge of FORTRESS_REVENGE_GRUDGE); a mercantile city never.
//     4. tribute (raiders, tribal): a neighbour it hates (grudge TRIBUTE_DEMAND_GRUDGE) or outweighs
//        (TRIBUTE_STRENGTH_RATIO x their army in its reach) is asked tributeGold a turn for
//        TRIBUTE_TURNS turns. An AI major pays when the independent is stronger than its army there
//        and it can afford it; the player answers (ANSWER_TRIBUTE_DEMAND: pay or refuse; silence for
//        TRIBUTE_ANSWER_TURNS is a refusal). Paying is a truce both ways (hostility.js truceWith):
//        no raids on the payer and the payer cannot attack it. A refusal or a missed payment:
//        +GRUDGE_REFUSED and the raid cooldown is over.
// - A raid runs every turn: the party walks its tile route (A* once, when it starts; the march cost
//   rules of armies.js), at most RAID_MAX_TURNS out. An army in the way is fought when the party
//   outweighs it by RAID_FIGHT_RATIO, else the party goes home. At the target the party fights the
//   defenders there (fightRaidBattle: today's auto-resolve, R3's RTS raid later); if it wins the
//   loot is taken and it goes home. It aborts (goes home) after losing half its strength, when its
//   city is threatened or when the target is gone. Home, the units garrison again.
// - Sack (4.4, 6.5, 6.8): gold = SACK_INCOME_TURNS turns of the city's gold (at least
//   SACK_MIN_GOLD; the victim's treasury pays what it holds), the city loses one size and one
//   building tier, never more than half of either, and is never captured.
// - Losses are gone: no captives (decision 37). Raids are not wars: no war score, no peace.
// - The victim: a log line and warning (the player), `raidedBy[indepId]` (the "raided us" opinion
//   reason, opinion.js). The independent: a grudge against whoever killed its raiders.
// Deterministic: every roll is hashRoll(`${id}|${turn}|<what>`) or an rng seeded from one.
// Cheap: a ring scan per thinker, one A* per raid start or return; measured in the balance-sim.
import { getTiles } from '../data/geo/tiles';
import { kmPerRing, ringsForKm } from '../data/geo/gridScale';
import { REBEL_OWNER_ID } from '../data/rebellion';
import { LogTypes } from '../data/types';
import {
  isIndependentNation, garrisonTarget, THINK_PERIOD, RAID_KM, RAID_COOLDOWN, RAID_CHANCE, FORTRESS_REVENGE_GRUDGE, RAID_THRESHOLD,
  RAID_RING_PENALTY, RAID_RING_PENALTY_KM, RAID_MAX_TURNS, RAID_RECOVER_TURNS, RAID_FIGHT_RATIO, RAID_ERA_FACTOR, ROUTE_LOOT, SETTLER_LOOT,
  OUTPOST_LOOT, RAID_SPARE_TURNS, OUTPOST_BURN_LOSS, SACK_GARRISON_RATIO, SACK_INCOME_TURNS, SACK_MIN_GOLD, INDEPENDENT_GOLD_CAP, MERCANTILE_GOLD_MULT, GRUDGE_ATTACKED, GRUDGE_REFUSED,
  TRIBUTE_TURNS, TRIBUTE_DEMAND_GRUDGE, TRIBUTE_STRENGTH_RATIO, TRIBUTE_DEMAND_CHANCE, TRIBUTE_DEMAND_COOLDOWN, TRIBUTE_ANSWER_TURNS, tributeGold
} from '../data/independents';
import { createRng } from '../utils/rng';
import { ringsAround, sizeToPeople } from './world/cities';
import { canFight } from './hostility';
import { findTilePath, tileAccess, tileStepCost, passableTile, stackPace, unitTile } from './armies';
import { pillageTile, RAID_GOLD } from './threat';
import { playerRouteTiles } from './plunder';
import { hashRoll } from './aftermath';
import { fightRaidBattle } from './raidBattle';
import { withGrudge, grudgeOf, decayGrudges } from './grudges';
import { isUnitInBattle } from './invasion';
import { hireMercenary, mercOffer, processMercenaries, goldIn, addGoldIn } from './mercenaries';

const KIND_STAT = { pillage: 'pillages', route: 'routesCut', settler: 'settlersKilled', outpost: 'outpostsBurned' };

/** Enemy armies within this distance of an independent's city put it under threat (the plan's 2 rings). */
export const THREAT_KM = 204;

/** Does independent `id` think on `turn`? About one in THINK_PERIOD a turn, staggered by id. */
export const thinksOn = (id, turn) => (Math.floor(hashRoll(`${id}|think`) * THINK_PERIOD) + turn) % THINK_PERIOD === 0;

// ---------------------------------------------------------------------------------------------
// Treasuries: the player's resources, an AI major's economy pool, an independent's indep.gold.
const goldOf = goldIn;
const addGold = addGoldIn;
/** Takes up to `amount` from `id`'s treasury (never below 0): returns what was taken. */
const takeGold = (w, id, amount) => {
  const take = Math.max(0, Math.min(amount, goldOf(w, id)));
  if (take) addGold(w, id, -take);
  return take;
};
const setIndep = (w, id, patch) => { const n = w.nations[id]; w.nations[id] = { ...n, indep: { ...n.indep, ...patch } }; };

// ---------------------------------------------------------------------------------------------
// Unit indexes for the turn, rebuilt only after units changed.
const indexOf = (w) => {
  if (w.index && w.index.units === w.unitsVersion) return w.index;
  const armed = new Map(); const settlers = new Map(); const parties = new Map();
  Object.values(w.units).forEach((u) => {
    if (u.raidOf) { const l = parties.get(u.raidOf); if (l) l.push(u); else parties.set(u.raidOf, [u]); }
    if (u.domain === 'naval' || u.embarkedOn || !(u.strength > 0)) return;
    const t = unitTile(w.view, u);
    if (t == null) return;
    const map = u.classId === 'settler' ? settlers : armed;
    const l = map.get(t); if (l) l.push(u); else map.set(t, [u]);
  });
  w.index = { units: w.unitsVersion, armed, settlers, parties };
  return w.index;
};
const touchUnits = (w) => { w.unitsVersion += 1; };
const sumStrength = (units) => units.reduce((s, u) => s + Math.max(0, u.strength || 0), 0);

/** May independent `id` raid nation `owner`? A living major it may fight (no truce, no tribute). */
const victimOk = (w, id, owner) => !!owner && owner !== id && owner !== REBEL_OWNER_ID && !!w.nations[owner] && !w.nations[owner].isEliminated
  && !isIndependentNation(w.nations[owner]) && canFight(w.view, id, owner);

/** Armed units of nations that may fight `id` (independents left out: they never attack each other) on `tile`. */
const hostileArmiesAt = (w, id, tile) => (indexOf(w).armed.get(tile) || []).filter((u) => u.ownerId !== id && !isIndependentNation(w.nations[u.ownerId]) && canFight(w.view, id, u.ownerId));

/** Is the independent's city under threat: besieged, or a hostile army within THREAT_KM? */
export const homeThreatened = (w, id, city) => {
  if (city.siege?.by) return true;
  const tiles = getTiles();
  let hit = false;
  ringsAround(tiles, city.tile, ringsForKm(THREAT_KM)).forEach((d, t) => { if (!hit && hostileArmiesAt(w, id, t).length) hit = true; });
  return hit;
};

const log = (w, message, type = LogTypes.COMBAT) => w.logs.push({ year: w.year, message, type });
const placeOf = (w, tile) => getTiles().names?.[tile] || w.regions[w.view.world?.tileOwner?.[tile]]?.name || 'the frontier';
const rngFor = (w, id, what) => createRng(Math.floor(hashRoll(`${w.seed}|${id}|${w.turn}|${what}`) * 4294967296) >>> 0);

// ---------------------------------------------------------------------------------------------
// Targets (4.3)

/**
 * The best raid target for independent `id` with a party of `partyStrength`, or null:
 * { kind, tile, victim, cityId, unitId, loot, score, rings }. Also returns `nearArmies`
 * (Map nation -> strength of its armies within reach) for the tribute decision.
 */
export const scanTargets = (w, id, city, partyStrength) => {
  const n = w.nations[id];
  const personality = n.indep?.personality || 'tribal';
  const tiles = getTiles();
  const rings = RAID_KM[personality] ? ringsForKm(RAID_KM[personality]) : 0;
  const nearArmies = new Map();
  const nearOwners = new Set();
  if (!rings) return { best: null, nearArmies, nearOwners };
  const index = indexOf(w);
  const tileOwner = w.view.world?.tileOwner || {};
  const tileState = w.view.world?.tileState || {};
  const kmRing = kmPerRing(tiles);
  const era = RAID_ERA_FACTOR[w.age] ?? 1;
  const routes = w.routeTiles();
  let best = null;
  const defendersNear = (owner, t, centreOnly) => {
    let s = sumStrength((index.armed.get(t) || []).filter((u) => u.ownerId === owner));
    if (!centreOnly) tiles.neighbors[t].forEach((x) => { s += sumStrength((index.armed.get(x) || []).filter((u) => u.ownerId === owner)); });
    return s;
  };
  const offer = (kind, t, d, victim, loot, extra = {}) => {
    const grudge = grudgeOf(n, victim);
    if (personality === 'fortress' && grudge < FORTRESS_REVENGE_GRUDGE) return;
    const defence = defendersNear(victim, t, kind === 'sack');
    const score = loot * (1 + grudge / 50) * era / (1 + defence / Math.max(1, partyStrength)) - RAID_RING_PENALTY * d * kmRing / RAID_RING_PENALTY_KM;
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && t < best.tile)) best = { kind, tile: t, victim, loot, score, rings: d, ...extra };
  };
  ringsAround(tiles, city.tile, rings).forEach((d, t) => {
    if (d === 0) return;
    (index.armed.get(t) || []).forEach((u) => { if (u.ownerId !== id && !isIndependentNation(w.nations[u.ownerId])) nearArmies.set(u.ownerId, (nearArmies.get(u.ownerId) || 0) + u.strength); });
    (index.settlers.get(t) || []).forEach((u) => { if (victimOk(w, id, u.ownerId)) offer('settler', t, d, u.ownerId, SETTLER_LOOT, { unitId: u.id }); });
    if (routes && routes.has(t) && victimOk(w, id, w.playerId)) offer('route', t, d, w.playerId, ROUTE_LOOT);
    const cityId = tileOwner[t];
    const c = cityId != null ? w.regions[cityId] : null;
    const owner = c?.owner;
    if (owner && owner !== id && !isIndependentNation(w.nations[owner])) nearOwners.add(owner);
    if (!victimOk(w, id, owner)) return;
    if (c.tile === t) {
      // A city sacked, or an outpost burned, lately is left alone (RAID_SPARE_TURNS).
      if (Math.max(c.sackedTurn ?? -Infinity, c.burnedTurn ?? -Infinity) > w.turn - RAID_SPARE_TURNS) return;
      if (c.outpost) { offer('outpost', t, d, owner, OUTPOST_LOOT, { cityId }); return; }
      const garrison = defendersNear(owner, t, true);
      if (garrison < partyStrength * SACK_GARRISON_RATIO) offer('sack', t, d, owner, Math.max(SACK_MIN_GOLD, SACK_INCOME_TURNS * (c.lastYields?.gold || 0)), { cityId });
      return;
    }
    const ts = tileState[t];
    if ((ts?.improvement || ts?.district) && !ts.pillaged) offer('pillage', t, d, owner, RAID_GOLD, { cityId });
  });
  return { best, nearArmies, nearOwners };
};

// ---------------------------------------------------------------------------------------------
// Moving a party

const partyOf = (w, id) => (indexOf(w).parties.get(id) || []).filter((u) => w.units[u.id] && u.strength > 0);
const moveParty = (w, party, tile) => {
  party.forEach((u) => { w.units[u.id] = { ...w.units[u.id], tile }; });
  touchUnits(w);
};

/**
 * One turn of walking along `route` (tiles, the next first). Stops before an armed enemy
 * ({ blocked: tile }), at a closed border ({ closed: true }), when the move points run out, or at
 * the end ({ arrived: true }). The party moves at least one step a turn when the way is open.
 */
const walk = (w, id, party, route) => {
  const tiles = getTiles();
  let at = unitTile(w.view, party[0]);
  let points = stackPace(party, []);
  let moved = false;
  const left = [...route];
  while (left.length) {
    const next = left[0];
    if (at == null || !tiles.neighbors[at].includes(next) || !passableTile(tiles, next)) return { at, route: left, closed: true };
    const access = tileAccess(w.view, next, id);
    if (access === 'closed') { if (moved) moveParty(w, party, at); return { at, route: left, closed: true }; }
    if (hostileArmiesAt(w, id, next).length) { if (moved) moveParty(w, party, at); return { at, route: left, blocked: next }; }
    const cost = tileStepCost(w.view, tiles, at, next, access, []);
    if (moved && cost > points + 1e-9) break;
    points -= cost; at = next; left.shift(); moved = true;
    if (points <= 1e-9) break;
  }
  if (moved) moveParty(w, party, at);
  return { at, route: left, arrived: !left.length };
};

const sendHome = (w, id, party, raid, why = null) => {
  const city = w.regions[w.nations[id].capitalRegionId];
  const at = unitTile(w.view, party[0]);
  if (!city || at == null || at === city.tile) { endRaid(w, id, party); return; }
  const path = findTilePath(w.view, at, city.tile, id, { maxSteps: 80 });
  if (!path.path) { moveParty(w, party, city.tile); endRaid(w, id, party); return; }
  setIndep(w, id, { raid: { ...raid, phase: 'home', route: path.path.slice(1), ...(why ? { why } : {}) } });
};

const endRaid = (w, id, party) => {
  party.forEach((u) => { if (w.units[u.id]) { const rest = { ...w.units[u.id] }; delete rest.raidOf; w.units[u.id] = rest; } });
  touchUnits(w);
  const n = w.nations[id];
  const lost = n.indep?.raid?.lost;
  setIndep(w, id, { raid: null, mood: lost ? 'recovering' : 'calm', ...(lost ? { recoverUntil: w.turn + RAID_RECOVER_TURNS } : {}) });
};

/** Writes a battle's survivors back; the dead are gone (no captives). */
const applyBattleUnits = (w, list) => {
  list.forEach((u) => {
    if (!w.units[u.id]) return;
    if (!(u.strength > 0)) { delete w.units[u.id]; return; }
    w.units[u.id] = { ...w.units[u.id], strength: u.strength, morale: u.morale ?? w.units[u.id].morale, routed: undefined, lastBattleTurn: w.turn };
  });
  touchUnits(w);
};

/** Beaten defenders on an open tile fall back to their own city (or stay when it is gone). */
const fallBack = (w, defenders) => {
  defenders.forEach((u) => {
    const cur = w.units[u.id];
    const home = cur && w.regions[cur.regionId];
    if (cur && home?.owner === cur.ownerId && home.tile != null) w.units[u.id] = { ...cur, tile: home.tile, route: null, movesLeft: 0 };
  });
  touchUnits(w);
};

const fight = (w, id, { kind, tile, victim, city = null, party, defenders }) => {
  const result = fightRaidBattle(w.view, { kind, defenderId: victim, tile, city, attackerUnits: party.map((u) => w.units[u.id]), defenderUnits: defenders.map((u) => w.units[u.id]) }, rngFor(w, id, `battle|${tile}`));
  applyBattleUnits(w, result.attackers);
  applyBattleUnits(w, result.defenders);
  w.stats.raidBattles += 1;
  // It holds a grudge against whoever killed its raiders (4.5).
  if (result.attackerLoss > 0) w.nations[id] = withGrudge(w.nations[id], victim, GRUDGE_ATTACKED);
  return result;
};

const raiderName = (w, id) => w.nations[id]?.name || 'Raiders';
const markRaided = (w, victim, id) => {
  const v = w.nations[victim];
  if (v && !isIndependentNation(v)) w.nations[victim] = { ...v, raidedBy: { ...(v.raidedBy || {}), [id]: w.turn } };
};

// ---------------------------------------------------------------------------------------------
// The sack (4.4, 6.5, 6.8)

/** A sacked city: one size and one building tier less, never below half of either. Pure. */
export const sackedCity = (c, turn) => {
  const size = c.size >= 2 ? Math.max(Math.ceil(c.size / 2), c.size - 1) : c.size;
  const cats = c.buildings?.categories || {};
  const built = Object.keys(cats).filter((k) => (cats[k] ?? -1) >= 0).sort((a, b) => cats[b] - cats[a] || (a < b ? -1 : 1));
  let buildings = c.buildings;
  let lostBuilding = null;
  const top = built[0];
  // A tier above the first is lost; a first-tier building only while at least one other stands.
  if (top && (cats[top] >= 1 || built.length >= 2)) { buildings = { ...c.buildings, categories: { ...cats, [top]: cats[top] - 1 } }; lostBuilding = top; }
  const out = { ...c, size, buildings, sackedTurn: turn };
  if (size < c.size && c.currentPopulation != null) out.currentPopulation = Math.min(c.currentPopulation, sizeToPeople(size));
  return { city: out, lostSize: c.size - size, lostBuilding };
};

const resolveAtTarget = (w, id, party, raid) => {
  const t = raid.targetTile;
  const victim = raid.targetNationId;
  const name = raiderName(w, id);
  const toPlayer = victim === w.playerId;
  const city = raid.targetCityId != null ? w.regions[raid.targetCityId] : null;
  // Still a target?
  const ts = w.view.world?.tileState?.[t];
  const valid = victimOk(w, id, victim) && (
    raid.kind === 'pillage' ? (!!(ts?.improvement || ts?.district) && !ts.pillaged && w.regions[w.view.world?.tileOwner?.[t]]?.owner === victim)
      : raid.kind === 'route' ? !!w.routeTiles()?.has(t)
        : raid.kind === 'settler' ? !!w.units[raid.targetUnitId] && unitTile(w.view, w.units[raid.targetUnitId]) === t
          : (city?.owner === victim && (raid.kind === 'outpost' ? !!city.outpost : !city.outpost)));
  if (!valid) { sendHome(w, id, party, raid, 'gone'); return; }
  const defenders = hostileArmiesAt(w, id, t).filter((u) => u.ownerId === victim && !isUnitInBattle(w.view, u.id));
  const kind = raid.kind === 'sack' ? 'sack' : 'raid';
  if (defenders.length) {
    const r = fight(w, id, { kind, tile: t, victim, city: raid.kind === 'sack' ? city : null, party, defenders });
    const survivors = partyOf(w, id);
    if (!r.raidersWon) {
      if (toPlayer) log(w, `Your ${kind === 'sack' ? 'garrison of' : 'army at'} ${kind === 'sack' ? city.name : placeOf(w, t)} drove off ${name}.`);
      if (!survivors.length) { setIndep(w, id, { raid: { ...raid, lost: true } }); endRaid(w, id, []); return; }
      sendHome(w, id, survivors, { ...raid, lost: true }, 'beaten');
      return;
    }
    if (kind !== 'sack') fallBack(w, r.defenders.filter((u) => u.strength > 0));
    party = survivors;
    if (!party.length) { endRaid(w, id, []); return; }
  }
  let loot = 0;
  let what = '';
  if (raid.kind === 'pillage') {
    const p = pillageTile(w.view, id, t, new Set([victim]));
    if (p) { w.view.world = { ...w.view.world, tileState: p.tileState }; loot = p.gold; what = `pillage the land of ${w.regions[p.cityId]?.name || 'a city'} (${placeOf(w, t)})`; }
    moveParty(w, party, t);
  } else if (raid.kind === 'route') {
    loot = takeGold(w, victim, ROUTE_LOOT);
    what = `cut your trade route at ${placeOf(w, t)}`;
    moveParty(w, party, t);
  } else if (raid.kind === 'settler') {
    delete w.units[raid.targetUnitId]; touchUnits(w);
    loot = SETTLER_LOOT;
    what = `kill a settler party at ${placeOf(w, t)}`;
    moveParty(w, party, t);
  } else if (raid.kind === 'outpost') {
    w.regions[city.id] = { ...city, outpost: { ...city.outpost, progress: Math.round(city.outpost.progress * (1 - OUTPOST_BURN_LOSS) * 10) / 10 }, burnedTurn: w.turn };
    loot = OUTPOST_LOOT;
    what = `burn the outpost of ${city.name}`;
  } else if (raid.kind === 'sack') {
    const gold = Math.max(SACK_MIN_GOLD, Math.round(SACK_INCOME_TURNS * (city.lastYields?.gold || 0)));
    takeGold(w, victim, gold);
    loot = gold;
    const s = sackedCity(city, w.turn);
    w.regions[city.id] = s.city;
    w.stats.sacks += 1;
    what = `sack ${city.name}: ${gold} gold taken${s.lostSize ? ', the city shrinks to ' + s.city.size : ''}${s.lostBuilding ? `, a ${s.lostBuilding} building damaged` : ''}`;
  }
  addGold(w, id, loot);
  w.stats.raidsHit += 1;
  if (KIND_STAT[raid.kind]) w.stats[KIND_STAT[raid.kind]] = (w.stats[KIND_STAT[raid.kind]] || 0) + 1;
  w.stats.loot += loot;
  markRaided(w, victim, id);
  if (toPlayer) { w.stats.raidsOnPlayer += 1; log(w, `${name} ${what}.`); }
  if (raid.kind === 'route') { setIndep(w, id, { raid: { ...raid, phase: 'hold', holdUntil: w.turn + 1 } }); return; }
  sendHome(w, id, party, raid);
};

/** One turn of a running raid. */
const runRaid = (w, id, city) => {
  const n = w.nations[id];
  const raid = { ...n.indep.raid };
  const party = partyOf(w, id);
  if (!party.length) { setIndep(w, id, { raid: { ...raid, lost: true } }); endRaid(w, id, []); return; }
  if (raid.phase === 'hold') { if (w.turn >= raid.holdUntil) sendHome(w, id, party, raid); return; }
  if (raid.phase === 'home') {
    const step = walk(w, id, party, raid.route);
    if (step.arrived || step.at === city.tile) { endRaid(w, id, party); return; }
    if (step.closed || (step.blocked != null && w.turn - raid.startedTurn > 2 * RAID_MAX_TURNS)) { moveParty(w, party, city.tile); endRaid(w, id, party); return; } // slipped home by another way
    setIndep(w, id, { raid: { ...raid, route: step.route } });
    return;
  }
  // Out: abort when beaten down, too long out, or home in danger.
  const strength = sumStrength(party);
  if (strength < raid.startStrength / 2 || w.turn - raid.startedTurn > RAID_MAX_TURNS || homeThreatened(w, id, city)) { sendHome(w, id, party, { ...raid, lost: strength < raid.startStrength / 2 }, 'abort'); return; }
  // A settler moves: follow it.
  let route = raid.route;
  if (raid.kind === 'settler') {
    const s = w.units[raid.targetUnitId];
    const st = s ? unitTile(w.view, s) : null;
    if (st == null) { sendHome(w, id, party, raid, 'gone'); return; }
    if (st !== raid.targetTile) {
      const at = unitTile(w.view, party[0]);
      if (at === st) route = [];
      else { const p = findTilePath(w.view, at, st, id, { maxSteps: ringsForKm(RAID_KM.raiders) * 2 }); if (!p.path) { sendHome(w, id, party, raid, 'gone'); return; } route = p.path.slice(1); }
      raid.targetTile = st;
    }
  }
  const atTarget = (tile) => tile === raid.targetTile || (raid.kind === 'sack' || raid.kind === 'outpost') && getTiles().neighbors[raid.targetTile].includes(tile);
  if (!route.length || atTarget(unitTile(w.view, party[0]))) { resolveAtTarget(w, id, party, { ...raid, route: [] }); return; }
  const step = walk(w, id, party, route);
  if (step.arrived || atTarget(step.at)) { resolveAtTarget(w, id, party, { ...raid, route: [] }); return; }
  if (step.blocked != null) {
    if (step.blocked === raid.targetTile) { resolveAtTarget(w, id, partyOf(w, id), { ...raid, route: [] }); return; }
    const blockers = hostileArmiesAt(w, id, step.blocked).filter((u) => !isUnitInBattle(w.view, u.id));
    const owner = blockers[0]?.ownerId;
    const theirs = blockers.filter((u) => u.ownerId === owner);
    if (owner && strength >= sumStrength(theirs) * RAID_FIGHT_RATIO) {
      const r = fight(w, id, { kind: 'intercept', tile: step.blocked, victim: owner, party: partyOf(w, id), defenders: theirs });
      if (owner === w.playerId) log(w, r.raidersWon ? `${raiderName(w, id)} cut through your army near ${placeOf(w, step.blocked)}.` : `Your army near ${placeOf(w, step.blocked)} stopped ${raiderName(w, id)}.`);
      if (r.raidersWon) fallBack(w, r.defenders.filter((u) => u.strength > 0));
      const left = partyOf(w, id);
      if (!left.length) { setIndep(w, id, { raid: { ...raid, lost: true } }); endRaid(w, id, []); return; }
      if (!r.raidersWon) { sendHome(w, id, left, { ...raid, lost: true }, 'beaten'); return; }
      setIndep(w, id, { raid: { ...raid, route: step.route } });
      return;
    }
    sendHome(w, id, party, raid, 'blocked');
    return;
  }
  if (step.closed) { sendHome(w, id, party, raid, 'closed'); return; }
  // The warning (independents 7): raiders three tiles from the player's target.
  let warned = raid.warned;
  if (!warned && raid.targetNationId === w.playerId && step.route.length <= 3) {
    warned = true;
    const near = raid.targetCityId != null ? w.regions[raid.targetCityId]?.name : w.regions[w.view.world?.tileOwner?.[raid.targetTile]]?.name;
    log(w, `${raiderName(w, id)} are ${step.route.length} tile${step.route.length === 1 ? '' : 's'} from ${near || placeOf(w, raid.targetTile)}.`, LogTypes.CRISIS);
  }
  setIndep(w, id, { raid: { ...raid, route: step.route, warned } });
};

// ---------------------------------------------------------------------------------------------
// Tribute (4.5)

/** Starts tribute from `payerId` to independent `indepId` in a nations map (a new map). */
export const startTribute = (nations, indepId, payerId, gold, turn) => {
  const n = nations[indepId];
  if (!isIndependentNation(n)) return nations;
  const until = turn + TRIBUTE_TURNS;
  return { ...nations, [indepId]: { ...n, indep: { ...n.indep, tributeFrom: { ...(n.indep.tributeFrom || {}), [payerId]: { until, gold } }, truceWith: { ...(n.indep.truceWith || {}), [payerId]: until } } } };
};
/** A refusal: the grudge rises and the raid cooldown is over. */
export const refuseTribute = (nations, indepId, payerId) => {
  const n = nations[indepId];
  if (!isIndependentNation(n)) return nations;
  const g = withGrudge(n, payerId, GRUDGE_REFUSED);
  return { ...nations, [indepId]: { ...g, indep: { ...g.indep, lastRaidTurn: null } } };
};

const payTribute = (w, id) => {
  const from = w.nations[id].indep?.tributeFrom;
  if (!from) return;
  Object.keys(from).sort().forEach((payer) => {
    const { until, gold } = from[payer];
    const n = w.nations[id];
    const nextFrom = { ...n.indep.tributeFrom };
    if (until <= w.turn || !w.nations[payer] || w.nations[payer].isEliminated) {
      delete nextFrom[payer];
      setIndep(w, id, { tributeFrom: nextFrom });
      return;
    }
    if (goldOf(w, payer) >= gold) { addGold(w, payer, -gold); addGold(w, id, gold); w.stats.tributeGold += gold; return; }
    // Missed: the deal is off, the truce with it.
    delete nextFrom[payer];
    const truceWith = { ...(n.indep.truceWith || {}) }; delete truceWith[payer];
    w.nations[id] = { ...n, indep: { ...n.indep, tributeFrom: nextFrom, truceWith } };
    Object.assign(w.nations, refuseTribute(w.nations, id, payer));
    if (payer === w.playerId) log(w, `You could not pay your tribute to ${raiderName(w, id)}: the deal is off and they will raid again.`, LogTypes.DIPLOMACY);
  });
};

const demandTribute = (w, id, city, myStrength, nearArmies, nearOwners) => {
  const n = w.nations[id];
  if (!['raiders', 'tribal'].includes(n.indep?.personality)) return false;
  if (hashRoll(`${id}|${w.turn}|tribute`) >= TRIBUTE_DEMAND_CHANCE) return false;
  const asked = n.indep.demandedTurn || {};
  const cands = [...nearOwners].filter((o) => victimOk(w, id, o) && !n.indep.tributeFrom?.[o] && !(asked[o] != null && w.turn - asked[o] < TRIBUTE_DEMAND_COOLDOWN)
    && !(o === w.playerId && w.tributeDemands.some((d) => d.indepId === id))
    && (grudgeOf(n, o) >= TRIBUTE_DEMAND_GRUDGE || myStrength >= TRIBUTE_STRENGTH_RATIO * (nearArmies.get(o) || 0)))
    .sort((a, b) => grudgeOf(n, b) - grudgeOf(n, a) || (nearArmies.get(a) || 0) - (nearArmies.get(b) || 0) || (a < b ? -1 : 1));
  const target = cands[0];
  if (!target) return false;
  const gold = tributeGold(w.age);
  setIndep(w, id, { demandedTurn: { ...asked, [target]: w.turn } });
  w.stats.tributeDemands += 1;
  if (target === w.playerId) {
    w.tributeDemands.push({ id: `trib_${id}_${w.turn}`, indepId: id, gold, turns: TRIBUTE_TURNS, turn: w.turn, expires: w.turn + TRIBUTE_ANSWER_TURNS });
    log(w, `${raiderName(w, id)} demand ${gold} gold a turn for ${TRIBUTE_TURNS} turns, or they will raid you. Answer under Relations on the Empire tab within ${TRIBUTE_ANSWER_TURNS} turns.`, LogTypes.DIPLOMACY);
    return true;
  }
  // An AI major pays when the independent outweighs its army there and it can afford the deal.
  const pays = myStrength > (nearArmies.get(target) || 0) && goldOf(w, target) >= gold * TRIBUTE_TURNS / 2;
  if (pays) { Object.assign(w.nations, startTribute(w.nations, id, target, gold, w.turn)); w.stats.tributeDeals += 1; } else Object.assign(w.nations, refuseTribute(w.nations, id, target));
  return true;
};

// ---------------------------------------------------------------------------------------------
// One independent's turn

const think = (w, id, city) => {
  const n = w.nations[id];
  const p = n.indep?.personality || 'tribal';
  // 1. Under threat.
  if (homeThreatened(w, id, city)) {
    if (n.indep.mood !== 'besieged') setIndep(w, id, { mood: 'besieged' });
    const raid = w.nations[id].indep.raid;
    if (raid && raid.phase === 'out') { const party = partyOf(w, id); if (party.length) sendHome(w, id, party, raid, 'recalled'); }
    if (p === 'mercantile') {
      const offer = mercOffer(w.view, id, id);
      if (offer.ok && goldOf(w, id) >= offer.price) {
        const hired = hireMercenary(w.view, id, id, { offer });
        if (hired.ok) { addGold(w, id, -offer.price); w.units[hired.unit.id] = hired.unit; touchUnits(w); setIndep(w, id, { mercStock: hired.stock, mercTurn: hired.mercTurn }); w.stats.mercsHired += 1; }
      }
    }
    return;
  }
  if (n.indep.mood === 'besieged') setIndep(w, id, { mood: 'calm' });
  // 2. Recovering.
  if ((w.nations[id].indep.recoverUntil || 0) > w.turn) return;
  if (w.nations[id].indep.mood === 'recovering') setIndep(w, id, { mood: 'calm' });
  if (w.nations[id].indep.raid) return;
  // 3. A raid.
  const index = indexOf(w);
  const home = (index.armed.get(city.tile) || []).filter((u) => u.ownerId === id && !u.raidOf && !isUnitInBattle(w.view, u.id)).sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
  const spare = home.length - garrisonTarget(city.size, p);
  const myStrength = sumStrength(home);
  const party = spare > 0 ? home.slice(0, spare) : [];
  const partyStrength = sumStrength(party);
  const last = w.nations[id].indep.lastRaidTurn;
  const cooled = last == null || w.turn - last >= RAID_COOLDOWN[p];
  const { best, nearArmies, nearOwners } = scanTargets(w, id, city, Math.max(1, partyStrength || myStrength));
  if (party.length && cooled && best && best.score >= RAID_THRESHOLD) {
    const grudge = grudgeOf(w.nations[id], best.victim);
    const chance = Math.min(1, (RAID_CHANCE[p] || 0) * (best.victim === w.playerId ? (w.difficulty || 1) : 1) * (1 + grudge / 100));
    if (hashRoll(`${id}|${w.turn}|raid`) < chance) {
      const path = findTilePath(w.view, city.tile, best.tile, id, { maxSteps: Math.max(4, best.rings * 3) });
      if (path.path) {
        let route = path.path.slice(1);
        if (best.kind === 'sack' || best.kind === 'outpost') route = route.slice(0, -1); // halt beside the city
        party.forEach((u) => { w.units[u.id] = { ...w.units[u.id], raidOf: id }; });
        touchUnits(w);
        setIndep(w, id, { mood: 'raiding', lastRaidTurn: w.turn, raid: { kind: best.kind, targetTile: best.tile, targetNationId: best.victim, targetCityId: best.cityId ?? null, targetUnitId: best.unitId ?? null, startedTurn: w.turn, startStrength: partyStrength, phase: 'out', route, warned: false } });
        w.stats.raidsStarted += 1;
        if (best.victim === w.playerId) w.stats.raidsAtPlayer += 1;
        return;
      }
    }
  }
  // 4. Tribute.
  demandTribute(w, id, city, myStrength, nearArmies, nearOwners);
};

/**
 * The independents' phase of resolveTurn. `input`: the turn's state ({ regions, units, nations,
 * resources, world, turnNumber (the new turn), year, age, playerNationId, rngSeed, difficultyMultiplier,
 * tributeDemands, indepStats }). Returns { regions, units, nations, resources, world, tributeDemands,
 * indepStats, logs }: new maps (the input's are never written).
 */
export const processIndependents = (input) => {
  const ids = Object.keys(input.nations || {}).filter((id) => isIndependentNation(input.nations[id])).sort();
  if (!ids.length) return null;
  const w = {
    turn: input.turnNumber, year: input.year, age: input.age, seed: input.rngSeed || 0, playerId: input.playerNationId, difficulty: input.difficultyMultiplier || 1,
    regions: { ...input.regions }, units: { ...input.units }, nations: { ...input.nations }, resources: { ...input.resources },
    tributeDemands: [...(input.tributeDemands || [])], logs: [], unitsVersion: 0, index: null,
    stats: { raidsStarted: 0, raidsAtPlayer: 0, raidsHit: 0, raidsOnPlayer: 0, raidBattles: 0, sacks: 0, loot: 0, tributeDemands: 0, tributeDeals: 0, tributeGold: 0, mercsHired: 0, ...(input.indepStats || {}) }
  };
  // `view` is the state the shared readers see (canFight, paths, pillage): the turn's live maps.
  w.view = { ...input, regions: w.regions, units: w.units, nations: w.nations, world: { ...(input.world || {}) } };
  let routeCache;
  w.routeTiles = () => {
    if (routeCache !== undefined) return routeCache;
    const s = playerRouteTiles(w.view);
    routeCache = s.size ? s : null;
    return routeCache;
  };
  // Parties of independents that are gone disband.
  indexOf(w).parties.forEach((list, owner) => {
    if (!w.nations[owner] || w.nations[owner].isEliminated) { list.forEach((u) => delete w.units[u.id]); touchUnits(w); }
  });
  // The player's unanswered tribute demands lapse into refusals.
  w.tributeDemands = w.tributeDemands.filter((d) => {
    if (d.expires > w.turn && w.nations[d.indepId] && !w.nations[d.indepId].isEliminated) return true;
    if (w.nations[d.indepId] && !w.nations[d.indepId].isEliminated) {
      Object.assign(w.nations, refuseTribute(w.nations, d.indepId, w.playerId));
      log(w, `You ignored the tribute demand of ${raiderName(w, d.indepId)}: they take it as a refusal.`, LogTypes.DIPLOMACY);
    }
    return false;
  });
  ids.forEach((id) => {
    let n = w.nations[id];
    if (n.isEliminated) return;
    const city = w.regions[n.capitalRegionId];
    if (!city || city.owner !== id || city.tile == null) return;
    // Treasury and grudges.
    const income = Math.round((city.lastYields?.gold || 0) * (n.indep?.personality === 'mercantile' ? MERCANTILE_GOLD_MULT : 1));
    n = decayGrudges(n);
    n = { ...n, indep: { ...n.indep, gold: Math.min(INDEPENDENT_GOLD_CAP, (n.indep?.gold || 0) + income) } };
    w.nations[id] = n;
    payTribute(w, id);
    if (w.nations[id].indep.raid) runRaid(w, id, city);
    if (thinksOn(id, w.turn)) think(w, id, city);
  });
  processMercenaries(w);
  return { regions: w.regions, units: w.units, nations: w.nations, resources: w.resources, world: w.view.world, tributeDemands: w.tributeDemands, indepStats: w.stats, logs: w.logs };
};

/** The player's answer to a tribute demand (gameReducer ANSWER_TRIBUTE_DEMAND). Returns a new state. */
export const answerTributeDemand = (state, demandId, pay) => {
  const d = (state.tributeDemands || []).find((x) => x.id === demandId);
  if (!d) return state;
  const rest = state.tributeDemands.filter((x) => x.id !== demandId);
  const indep = state.nations[d.indepId];
  if (!indep || indep.isEliminated) return { ...state, tributeDemands: rest };
  if (pay) {
    return {
      ...state, tributeDemands: rest, nations: startTribute(state.nations, d.indepId, state.playerNationId, d.gold, state.turnNumber),
      logs: [...state.logs, { year: state.year, message: `You pay ${indep.name} ${d.gold} gold a turn for ${d.turns} turns: no raids from them meanwhile.`, type: LogTypes.DIPLOMACY }]
    };
  }
  return {
    ...state, tributeDemands: rest, nations: refuseTribute(state.nations, d.indepId, state.playerNationId),
    logs: [...state.logs, { year: state.year, message: `You refuse the tribute ${indep.name} demand. Expect raiders.`, type: LogTypes.DIPLOMACY }]
  };
};
