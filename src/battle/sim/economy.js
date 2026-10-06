// src/battle/sim/economy.js
// The battle economy in the sim (phase R1; plans/MASTER-PLAN.md 6.3, 6.4; RTS plan 6): three
// resources, workers who gather, carry, build and repair, buildings, training queues, population
// and housing. Everything lives on `w.eco` (plain objects and integers, so a structuredClone of the
// world is still a full checkpoint) and only orders change it, like the rest of the sim. A world
// whose setup has no `economy` never creates `w.eco`, and nothing here runs for it: those battles
// play (and hash) exactly as before.
//
// Tick order inside step() (RTS plan 12.3): orders (applyEcoOrder) -> updateEconomy (construction
// progress, workers walk, gather and deposit, training and spawns, trade, aid) -> the armies move
// and fight -> fireEcoTowers.
//
// Population (master 6.3, decisions 25, 26, 30): every living squad of a side on the field (or
// walking on), workers and the brought army included, plus the units in training (a queue's active
// item). It may not exceed the side's housing cap, and never POP_LIMIT. The brought army is never
// blocked or harmed by housing: it is on the field from the start and reserves still enter over the
// cap; housing only stops training (an active item waits, it is never discarded).
// Housing: the attacker's camp 20 plus 10 per regiment brought (while the camp stands); the
// defender's town hall and the real city's houses (their manifest `housing`, while they stand), or a
// camp's worth in a battle without a city; every village house +10. Destroying houses lowers the cap.
import { Q, TICK_HZ, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';
import { distSq } from './fixed';
import { nextRandom } from './rng';
import { TILE } from '../setup/mapgen';
import { tileOf, walkableGoal, invalidatePaths, queryRadius } from './pathing';
import { makeSquad } from './world';
import { stepToward } from './movement';
import { moraleFromLosses } from './moraleMath';
import {
  RESOURCES, MILLI, POP_LIMIT, POP_PER_SQUAD, CARRY, GATHER_PER_SEC, FARM_RATE_MULT, MINE_RATE_MULT, WORK_REACH,
  buildRateHalves, CANCEL_REFUND, REPAIR_HP_PER_SEC, REPAIR_RECENT_TICKS, REPAIR_RECENT_MULT_QUARTERS,
  BUILD_RADIUS_HQ, BUILD_RADIUS_OWN, QUEUE_MAX, LOOT_SHARE, CITY_BUILDING_LOOT, TRADE_GOLD_PER_SEC, TRADE_GOLD_MAX,
  AID_RADIUS, AID_HEAL_PER_SEC, HOUSE_HOUSING, HALL_HOUSING, BUILDINGS, UNITS, costMilli, costTotal, buildTicks, trainTicks,
  trainableRoles, buildableFor, WORKER_MIX
} from '../data/economy';

export const START_WORKERS = 5;          // each side starts with a few laborers by its headquarters
export const MAX_ECO_BUILDINGS = 80;     // a side's raised buildings (RTS plan 13.1: 80 major structures)
const ECO_FLOW = 'ecoFlowCache';
const RES_INDEX = { food: 0, materials: 1, gold: 2 };
const centre = (t) => t * Q + (Q >> 1);
const footprintCentre = (tx, ty, size) => ({ x: tx * Q + ((size * Q) >> 1), y: ty * Q + ((size * Q) >> 1) });
const radiusOf = (size) => ((size * Q) >> 1) + (Q >> 2);

export const hasEconomy = (w) => !!w.eco;
export const isWorker = (q) => !!q.worker;
// A squad that counts toward a side's army in the battle's end rules (not a worker).
export const isArmySquad = (q) => !q.worker;

// ---- setup -------------------------------------------------------------------------------------

const makeBuilding = (w, side, type, tx, ty, { built = false, proxy = null, x = null, y = null } = {}) => {
  const def = BUILDINGS[type];
  const size = def.size;
  const c = x != null ? { x, y } : footprintCentre(tx, ty, size);
  const maxHp = def.hp;
  const b = {
    idx: w.eco.buildings.length, id: `e${w.eco.nextId++}`, eco: true, kind: 'eco', type, side,
    x: c.x, y: c.y, tx, ty, size, radius: radiusOf(size), footprint: [],
    maxHp, hp: built ? maxHp : 1, alive: true, built, progress: built ? buildTicks(type) * 2 || 1 : 0, need: Math.max(1, buildTicks(type) * 2),
    queue: [], rally: null, cooldown: 0, traded: 0, lastHitTick: -10000, node: -1, proxy
  };
  w.eco.buildings.push(b);
  return b;
};

const claimFootprint = (w, b) => {
  const { map } = w;
  for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) { const i = y * map.w + x; b.footprint.push(i); map.tiles[i] = TILE.BUILDING; }
  invalidatePaths(w);
};

/** Create `w.eco` from setup.economy (createWorld calls it after the armies are placed). */
export const initEconomy = (w) => {
  const e = w.setup.economy;
  if (!e) return;
  w.eco = {
    stock: e.stock.map((s) => [s.food, s.materials, s.gold]),
    nodes: e.nodes.map((n) => ({ ...n })),
    buildings: [],
    nextId: 0,
    trainedCount: [0, 0],
    stats: [0, 1].map(() => ({ gathered: [0, 0, 0], spent: [0, 0, 0], looted: 0, trained: {}, built: 0, lost: 0, workersLost: 0 }))
  };
  // The attacker's expedition camp (its footprint is already BUILDING in the setup's map).
  const camp = makeBuilding(w, SIDE_ATTACKER, 'camp', e.camp.tx, e.camp.ty, { built: true });
  camp.footprint = [...e.camp.footprint];
  camp.startHousing = e.housing[0];
  // The defender's town hall is the keep: it shares its HP and position (the keep is what is hit).
  const keep = w.structures[0];
  const hall = makeBuilding(w, SIDE_DEFENDER, 'hall', Math.floor(keep.x / Q) - 1, Math.floor(keep.y / Q) - 1, { built: true, proxy: 0, x: keep.x, y: keep.y });
  hall.radius = keep.radius + (Q >> 1);
  hall.startHousing = e.housing[1];
  // A few laborers by each headquarters, already at work.
  [camp, hall].forEach((hq) => { for (let k = 0; k < START_WORKERS; k++) spawnUnit(w, hq, 'worker', true); });
};

// ---- queries -----------------------------------------------------------------------------------

/** Is building `b` standing (a proxy town hall stands while its keep does)? */
export const ecoAlive = (w, b) => (b.proxy !== null && b.proxy !== undefined ? !!w.structures[b.proxy]?.alive : b.alive);
const ready = (w, b) => b.built && ecoAlive(w, b);

/** The side's housing cap (min POP_LIMIT). */
export const housingCap = (w, side) => {
  if (!w.eco) return POP_LIMIT;
  let cap = 0;
  w.eco.buildings.forEach((b) => {
    if (b.side !== side || !ready(w, b)) return;
    if (b.type === 'house') cap += HOUSE_HOUSING;
    else if (b.startHousing != null) cap += b.startHousing;
  });
  if (side === SIDE_DEFENDER && w.setup.city) {
    // The real city's houses and its town hall, while they stand (phase B manifest housing).
    w.structures.forEach((s) => { if (s.alive && s.housing) cap += s.housing; });
    if (!w.structures[0]?.housing && w.structures[0]?.alive) cap += HALL_HOUSING;
  }
  return Math.min(POP_LIMIT, cap);
};

const activeTraining = (w, side) => {
  let n = 0;
  w.eco.buildings.forEach((b) => { if (b.side === side && b.queue.length && b.queue[0].started && ready(w, b)) n += POP_PER_SQUAD; });
  return n;
};

/** Population: every living squad on (or walking onto) the field, plus the units in training. */
export const population = (w, side) => {
  let n = 0;
  for (let i = 0; i < w.squads.length; i++) {
    const q = w.squads[i];
    if (q.side === side && q.alive && !q.fled && (q.onField || q.enterTick >= 0)) n += POP_PER_SQUAD;
  }
  return w.eco ? n + activeTraining(w, side) : n;
};

export const stockOf = (w, side) => w.eco.stock[side];
const canAfford = (w, side, cost) => { const s = w.eco.stock[side]; const c = costMilli(cost); return RESOURCES.every((r, i) => s[i] >= c[r]); };
const pay = (w, side, cost) => { const s = w.eco.stock[side]; const c = costMilli(cost); RESOURCES.forEach((r, i) => { s[i] -= c[r]; w.eco.stats[side].spent[i] += c[r]; }); };
const refund = (w, side, cost, share = 1) => { const s = w.eco.stock[side]; const c = costMilli(cost); RESOURCES.forEach((r, i) => { const back = Math.floor(c[r] * share); s[i] += back; w.eco.stats[side].spent[i] -= back; }); };

// The nearest standing building of `side` that takes `res` (or the mine on `node`).
const nearestDropoff = (w, side, res, x, y, node = -1) => {
  let best = null; let bestD = Infinity;
  w.eco.buildings.forEach((b) => {
    if (b.side !== side || !ready(w, b)) return;
    const def = BUILDINGS[b.type];
    const takes = def.dropoff?.includes(res) || (def.mine && b.node >= 0 && w.eco.nodes[b.node]?.res === res && (node < 0 || b.node === node));
    if (!takes) return;
    const d = distSq(b.x, b.y, x, y);
    if (d < bestD) { bestD = d; best = b; }
  });
  return best;
};

const nodeUsable = (n, side) => n.amount !== 0 && (n.side < 0 || n.side === side);

// The nearest usable node of `res` for a worker, preferring nodes with a free slot.
const pickNode = (w, side, res, x, y, assigned, maxD = Infinity) => {
  let best = -1; let bestScore = Infinity;
  w.eco.nodes.forEach((n, i) => {
    if (n.res !== res || !nodeUsable(n, side)) return;
    const d = distSq(n.x, n.y, x, y);
    if (d > maxD * maxD) return;
    const score = assigned[i] >= n.slots ? d * 4 + 1 : d;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
};

// The resource furthest below its share of the side's laborers (WORKER_MIX; food first on ties).
export const neediest = (w, side) => {
  const on = [0, 0, 0]; let total = 0;
  w.squads.forEach((q) => { if (q.worker && q.side === side && q.alive && q.job?.t === 'gather') { on[RES_INDEX[w.eco.nodes[q.job.node].res]] += 1; total += 1; } });
  let best = 0; let bestGap = -Infinity;
  RESOURCES.forEach((r, i) => { const gap = WORKER_MIX[r] * (total + 1) - on[i]; if (gap > bestGap) { bestGap = gap; best = i; } });
  return RESOURCES[best];
};

let assignedScratch = new Int16Array(64);
const assignedCounts = (w) => {
  const n = w.eco.nodes.length;
  if (assignedScratch.length < n) assignedScratch = new Int16Array(n * 2);
  assignedScratch.fill(0, 0, n);
  w.squads.forEach((q) => { if (q.worker && q.alive && q.job?.t === 'gather') assignedScratch[q.job.node] += 1; });
  return assignedScratch;
};

const setJob = (q, job) => { q.job = job; q.order = job ? { type: 'work' } : { type: 'idle' }; q.target = -1; q.targetKind = null; q.groupSpeed = 0; q.anchorX = q.x; q.anchorY = q.y; };

// Put an idle worker to work on whatever its side needs most (spawn, finished site, emptied node).
const autoGather = (w, q, assigned = assignedCounts(w), res = neediest(w, q.side)) => {
  let ni = pickNode(w, q.side, res, q.x, q.y, assigned);
  if (ni < 0) RESOURCES.some((r) => { ni = pickNode(w, q.side, r, q.x, q.y, assigned); return ni >= 0; });
  if (ni < 0) { setJob(q, null); return; }
  assigned[ni] += 1;
  setJob(q, { t: 'gather', node: ni, phase: 0, drop: -1 });
};

// ---- placement ---------------------------------------------------------------------------------

/** Why `side` cannot place `type` with its top-left tile at (tx, ty), or null when it can. */
export const placementBlock = (w, side, type, tx, ty) => {
  const def = BUILDINGS[type];
  if (!def || !w.eco || !buildableFor(w.setup.sides[side].ageId).includes(type)) return 'unknown';
  const { map } = w; const size = def.size;
  if (tx < 1 || ty < 1 || tx + size > map.w - 1 || ty + size > map.h - 1) return 'edge';
  if (w.eco.buildings.filter((b) => b.side === side && b.alive && !BUILDINGS[b.type].hq).length >= MAX_ECO_BUILDINGS) return 'limit';
  for (let y = ty; y < ty + size; y++) {
    for (let x = tx; x < tx + size; x++) {
      const t = map.tiles[y * map.w + x];
      if (t !== TILE.OPEN && t !== TILE.SAND && t !== TILE.RUBBLE) return 'ground';
    }
  }
  // A free ring round it: buildings never touch, so they never seal a lane (RTS plan 6.2).
  for (let y = ty - 1; y <= ty + size; y++) {
    for (let x = tx - 1; x <= tx + size; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      if (map.tiles[y * map.w + x] === TILE.BUILDING) return 'crowded';
    }
  }
  const c = footprintCentre(tx, ty, size);
  // Nodes: never built over; a mine must stand by a stone, ore or gold node that has none yet.
  const near = (n, r) => Math.abs(n.x - c.x) <= r && Math.abs(n.y - c.y) <= r;
  if (w.eco.nodes.some((n) => n.amount !== 0 && n.kind !== 'farm' && near(n, ((size * Q) >> 1) + (Q >> 1)))) return 'node';
  if (def.mine) {
    const vein = w.eco.nodes.findIndex((n) => (n.kind === 'stone' || n.kind === 'ore' || n.kind === 'gold') && n.amount !== 0 && near(n, ((size * Q) >> 1) + 2 * Q)
      && !w.eco.buildings.some((b) => b.alive && b.type === 'mine' && b.node === w.eco.nodes.indexOf(n)));
    if (vein < 0) return 'noVein';
  }
  // Only on ground the side sees now, near its headquarters or a building of its own.
  if (w.fog && w.fog[side][tileOf(map, c.x, c.y)] !== 2) return 'fog';
  const reach = w.eco.buildings.some((b) => b.side === side && ready(w, b) && (BUILDINGS[b.type].hq
    ? distSq(b.x, b.y, c.x, c.y) <= (BUILD_RADIUS_HQ * Q) ** 2
    : distSq(b.x, b.y, c.x, c.y) <= (BUILD_RADIUS_OWN * Q) ** 2));
  if (!reach) return 'far';
  // Nobody may be standing on it.
  if (w.spatial && queryRadius(w, c.x, c.y, (size * Q) >> 1).some((j) => { const o = w.squads[j]; return o.alive && o.onField && !o.stats.flying && Math.abs(o.x - c.x) < (size * Q) >> 1 && Math.abs(o.y - c.y) < (size * Q) >> 1; })) return 'occupied';
  return null;
};

// ---- orders ------------------------------------------------------------------------------------

const ownWorkers = (w, side, ids) => (ids || []).map((i) => w.squads[i]).filter((q) => q && q.side === side && q.worker && q.alive && q.onField && !q.fled);
const ecoTarget = (w, t) => (t?.kind === 'eco' ? w.eco.buildings[t.index] : t?.kind === 'structure' ? w.structures[t.index] : null);

/** The economy's orders; returns true when it handled `o`. */
export const applyEcoOrder = (w, o) => {
  if (!w.eco) return false;
  const side = o.side;
  switch (o.type) {
    case 'gather': {
      const n = w.eco.nodes[o.node];
      if (!n || !nodeUsable(n, side)) return true;
      ownWorkers(w, side, o.squads).forEach((q) => setJob(q, { t: 'gather', node: o.node, phase: 0, drop: -1 }));
      return true;
    }
    case 'build': {
      const workers = ownWorkers(w, side, o.squads);
      if (!workers.length || placementBlock(w, side, o.building, o.tx, o.ty)) return true;
      const def = BUILDINGS[o.building];
      if (!canAfford(w, side, def.cost)) return true;
      pay(w, side, def.cost); // the full price is reserved when the site is placed (RTS plan 6.2)
      const b = makeBuilding(w, side, o.building, o.tx, o.ty);
      claimFootprint(w, b);
      if (def.mine) {
        const c = { x: b.x, y: b.y };
        let best = -1; let bestD = Infinity;
        w.eco.nodes.forEach((n, i) => { if ((n.kind === 'stone' || n.kind === 'ore' || n.kind === 'gold') && n.amount !== 0) { const d = distSq(n.x, n.y, c.x, c.y); if (d < bestD) { bestD = d; best = i; } } });
        b.node = best;
      }
      workers.forEach((q) => setJob(q, { t: 'build', b: b.idx }));
      w.events.push({ t: w.tick, type: 'siteStarted', side, building: b.idx, kind: o.building });
      return true;
    }
    case 'assist':
    case 'repair': {
      const t = ecoTarget(w, o.target);
      if (!t || !t.alive) return true;
      if (t.eco && t.side !== side) return true;
      if (!t.eco && side !== SIDE_DEFENDER) return true; // the city is the defender's to mend
      const job = t.eco && !t.built ? { t: 'build', b: t.idx } : { t: 'repair', kind: t.eco ? 'eco' : 'structure', b: t.eco ? t.idx : w.structures.indexOf(t) };
      if (job.t === 'repair' && t.hp >= t.maxHp) return true;
      ownWorkers(w, side, o.squads).forEach((q) => setJob(q, { ...job }));
      return true;
    }
    case 'train': {
      const b = w.eco.buildings[o.building];
      if (!b || b.side !== side || !ready(w, b) || b.queue.length >= QUEUE_MAX) return true;
      const role = o.role;
      if (!BUILDINGS[b.type].trains?.includes(role) || !trainableRoles(w.setup.sides[side].ageId).includes(role)) return true;
      const count = Math.max(1, Math.min(5, o.count || 1));
      for (let k = 0; k < count && b.queue.length < QUEUE_MAX; k++) {
        if (!canAfford(w, side, UNITS[role].cost)) break;
        pay(w, side, UNITS[role].cost); // reserved at the order (RTS plan 6.4)
        b.queue.push({ role, ticks: 0, need: trainTicks(role), started: false });
      }
      return true;
    }
    case 'cancelTrain': {
      const b = w.eco.buildings[o.building];
      if (!b || b.side !== side || !b.queue.length) return true;
      const slot = Math.max(0, Math.min(b.queue.length - 1, o.slot ?? b.queue.length - 1));
      const item = b.queue[slot];
      // An unstarted item returns everything; the active one 75% of what it has not used yet.
      refund(w, side, UNITS[item.role].cost, item.started ? CANCEL_REFUND * (1 - item.ticks / item.need) : 1);
      b.queue.splice(slot, 1);
      return true;
    }
    case 'rally': {
      const b = w.eco.buildings[o.building];
      if (!b || b.side !== side) return true;
      b.rally = o.x == null ? null : { x: o.x, y: o.y };
      return true;
    }
    case 'cancelBuild': {
      const b = w.eco.buildings[o.building];
      if (!b || b.side !== side || b.built || !b.alive) return true;
      refund(w, side, BUILDINGS[b.type].cost, CANCEL_REFUND * (1 - b.progress / b.need));
      removeBuilding(w, b, TILE.OPEN);
      return true;
    }
    default:
      return false;
  }
};

// A move, attack-move or stop ends a worker's job (the player took it off work).
export const clearWorkerJobs = (w, side, ids) => {
  if (!w.eco) return;
  (ids || []).forEach((i) => { const q = w.squads[i]; if (q && q.side === side && q.worker) q.job = null; });
};

// ---- the building's end ------------------------------------------------------------------------

const removeBuilding = (w, b, ground) => {
  b.alive = false; b.hp = 0;
  b.footprint.forEach((i) => { if (w.map.tiles[i] === TILE.BUILDING) w.map.tiles[i] = ground; });
  invalidatePaths(w);
  // A destroyed producer returns its unstarted items' price; the active one is lost (RTS plan 6.4).
  b.queue.forEach((item) => { if (!item.started) refund(w, b.side, UNITS[item.role].cost); });
  b.queue = [];
  if (BUILDINGS[b.type].farm) w.eco.nodes.forEach((n) => { if (n.building === b.idx) n.amount = 0; });
};

/** An economy building fell to `bySide` (combat.js): rubble, its queue refunded, and loot. */
export const destroyEcoBuilding = (w, b, bySide) => {
  removeBuilding(w, b, TILE.RUBBLE);
  w.eco.stats[b.side].lost += 1;
  if (bySide !== b.side && bySide >= 0) {
    const loot = Math.floor(costTotal(BUILDINGS[b.type].cost || { materials: 400 }) * LOOT_SHARE) * MILLI;
    w.eco.stock[bySide][2] += loot; w.eco.stats[bySide].looted += loot;
  }
  w.events.push({ t: w.tick, type: 'ecoDestroyed', building: b.idx, side: b.side });
};

/** A city building razed by the attacker (buildings.js): its loot in gold. */
export const lootCityBuilding = (w, bySide) => {
  if (!w.eco || bySide !== SIDE_ATTACKER) return;
  w.eco.stock[bySide][2] += CITY_BUILDING_LOOT * MILLI; w.eco.stats[bySide].looted += CITY_BUILDING_LOOT * MILLI;
};

// ---- spawning ----------------------------------------------------------------------------------

const spawnUnit = (w, b, role, atStart = false) => {
  const side = b.side;
  const n = w.eco.trainedCount[side]++;
  const def = UNITS[role];
  const unit = { id: `${side ? 'd' : 'a'}${role}${n}`, classId: role, strength: def.strength, maxStrength: def.strength, morale: 100, promotions: [], commanderId: null, domain: 'land', xp: 0, auxiliary: true };
  const q = makeSquad(w, unit, side, w.setup.sides[side].ageId, w.squads.length);
  // Out of the door on the side facing the enemy, on the nearest open ground.
  const dir = side === SIDE_ATTACKER ? 1 : -1;
  const spread = atStart ? (n % 5) - 2 : (n % 3) - 1;
  const ex = Math.floor(b.x / Q) + dir * ((b.size >> 1) + 1 + (b.proxy != null ? 1 : 0));
  const ey = Math.floor(b.y / Q) + spread;
  const tx = Math.max(1, Math.min(w.map.w - 2, ex)); const ty = Math.max(1, Math.min(w.map.h - 2, ey));
  const gi = walkableGoal(w.map, ty * w.map.w + tx);
  q.x = centre(gi % w.map.w); q.y = centre(Math.floor(gi / w.map.w));
  q.idx = w.squads.length;
  q.onField = true; q.anchorX = q.x; q.anchorY = q.y;
  q.eco = role === 'worker' ? 'worker' : 'trained';
  q.worker = role === 'worker';
  q.job = null; q.carry = 0; q.carryRes = 0;
  w.squads.push(q);
  w.eco.stats[side].trained[role] = (w.eco.stats[side].trained[role] || 0) + (atStart ? 0 : 1);
  if (q.worker) {
    const rallied = b.rally ? w.eco.nodes.findIndex((nd) => nodeUsable(nd, side) && distSq(nd.x, nd.y, b.rally.x, b.rally.y) <= Q * Q) : -1;
    if (rallied >= 0) setJob(q, { t: 'gather', node: rallied, phase: 0, drop: -1 });
    else autoGather(w, q);
  } else if (b.rally) {
    q.order = { type: 'move', x: b.rally.x, y: b.rally.y };
  }
  if (!atStart) w.events.push({ t: w.tick, type: 'trained', id: q.idx, side, role });
  return q;
};

// ---- the tick ----------------------------------------------------------------------------------

let buildersScratch = new Int16Array(64);

const inReach = (q, x, y, r) => distSq(q.x, q.y, x, y) <= (r + WORK_REACH) * (r + WORK_REACH);
const gatherPerTick = (res, mult) => Math.max(1, Math.round((GATHER_PER_SEC[res] * MILLI * mult) / TICK_HZ));

const workerTick = (w, q, assigned, builders) => {
  const job = q.job;
  if (!job) return;
  const { eco } = w;
  if (job.t === 'gather') {
    const n = eco.nodes[job.node];
    const ri = RES_INDEX[n.res];
    if (q.carry > 0 && q.carryRes !== ri) q.carry = 0; // switching resources drops the old load
    const full = q.carry >= CARRY;
    const empty = !nodeUsable(n, q.side);
    if (job.phase !== 2 && (full || (empty && q.carry > 0))) { job.phase = 2; job.drop = -1; }
    if (job.phase === 2) {
      let d = job.drop >= 0 ? eco.buildings[job.drop] : null;
      if (!d || !ready(w, d)) { d = nearestDropoff(w, q.side, n.res, q.x, q.y, job.node); job.drop = d ? d.idx : -1; }
      if (!d) return; // nowhere to take it: wait with the load
      if (!inReach(q, d.x, d.y, d.radius)) { stepToward(w, q, d.x, d.y, ECO_FLOW); return; }
      eco.stock[q.side][ri] += q.carry; eco.stats[q.side].gathered[ri] += q.carry;
      q.carry = 0;
      job.phase = 0;
      if (empty) {
        // The node ran out: the nearest one of the same kind of resource, else whatever is needed.
        const next = pickNode(w, q.side, n.res, q.x, q.y, assigned, 14 * Q);
        if (next >= 0) { assigned[job.node] -= 1; assigned[next] += 1; job.node = next; } else { assigned[job.node] -= 1; autoGather(w, q, assigned); }
      }
      return;
    }
    if (empty) { assigned[job.node] -= 1; autoGather(w, q, assigned); return; }
    if (!inReach(q, n.x, n.y, n.radius)) { job.phase = 0; stepToward(w, q, n.x, n.y, ECO_FLOW); return; }
    job.phase = 1;
    // A node takes `slots` workers at once; the rest wait their turn (lowest index first).
    const used = (eco.slotUse[job.node] || 0) + 1;
    eco.slotUse[job.node] = used;
    if (used > n.slots) return;
    const mine = eco.buildings.find((b) => b.type === 'mine' && b.node === job.node && b.side === q.side && ready(w, b));
    const mult = (n.rate || 1) * (n.kind === 'farm' ? FARM_RATE_MULT : 1) * (mine ? MINE_RATE_MULT : 1);
    let take = Math.min(gatherPerTick(n.res, mult), CARRY - q.carry);
    if (n.amount > 0) take = Math.min(take, n.amount);
    if (take <= 0) return;
    if (n.amount > 0) n.amount -= take;
    q.carryRes = ri;
    q.carry += take;
    return;
  }
  if (job.t === 'build') {
    const b = eco.buildings[job.b];
    if (!b || !b.alive || b.built) { finishJob(w, q, b, assigned); return; }
    if (!inReach(q, b.x, b.y, b.radius)) { stepToward(w, q, b.x, b.y, ECO_FLOW); return; }
    builders[job.b] += 1;
    q.lastStrikeTick = w.tick; // swings the hammer (the renderer's striking pose)
    return;
  }
  if (job.t === 'repair') {
    const s = job.kind === 'eco' ? eco.buildings[job.b] : w.structures[job.b];
    if (!s || !s.alive || s.hp >= s.maxHp) { setJob(q, null); return; }
    if (!inReach(q, s.x, s.y, s.radius)) { stepToward(w, q, s.x, s.y, ECO_FLOW); return; }
    q.lastStrikeTick = w.tick;
    if (w.tick % TICK_HZ !== 0) return;
    // Materials in proportion to the HP restored; a quarter speed under recent attack.
    const price = s.eco ? (BUILDINGS[s.type].cost?.materials || 100) : Math.round(s.maxHp / 10);
    const perHp = Math.max(1, Math.round((price * MILLI) / Math.max(1, s.maxHp)));
    const recent = w.tick - (s.lastHitTick ?? -10000) < REPAIR_RECENT_TICKS;
    let hp = Math.min(s.maxHp - s.hp, recent ? Math.max(1, Math.round((REPAIR_HP_PER_SEC * REPAIR_RECENT_MULT_QUARTERS) / 4)) : REPAIR_HP_PER_SEC);
    hp = Math.min(hp, Math.floor(eco.stock[q.side][1] / perHp));
    if (hp <= 0) return;
    eco.stock[q.side][1] -= hp * perHp; eco.stats[q.side].spent[1] += hp * perHp;
    s.hp += hp;
  }
};

// A site is done (or gone): a farm's builder farms it, a mine's works its vein, the rest go back to work.
const finishJob = (w, q, b, assigned) => {
  if (b && b.alive && b.built) {
    if (BUILDINGS[b.type].farm) { const ni = w.eco.nodes.findIndex((n) => n.building === b.idx); if (ni >= 0) { setJob(q, { t: 'gather', node: ni, phase: 0, drop: -1 }); assigned[ni] += 1; return; } }
    if (BUILDINGS[b.type].mine && b.node >= 0 && nodeUsable(w.eco.nodes[b.node], q.side)) { setJob(q, { t: 'gather', node: b.node, phase: 0, drop: -1 }); assigned[b.node] += 1; return; }
  }
  autoGather(w, q, assigned);
};

const completeBuilding = (w, b) => {
  b.built = true; b.hp = Math.max(b.hp, 1);
  w.eco.stats[b.side].built += 1;
  if (BUILDINGS[b.type].farm) {
    w.eco.nodes.push({ id: w.eco.nodes.length, kind: 'farm', res: 'food', x: b.x, y: b.y, tile: tileOf(w.map, b.x, b.y), amount: -1, max: -1, slots: BUILDINGS.farm.slots, rate: 1, side: b.side, radius: b.radius, building: b.idx });
  }
  w.events.push({ t: w.tick, type: 'built', building: b.idx, side: b.side, kind: b.type });
};

/** One tick of the economy (step.js, after the orders). */
export const updateEconomy = (w) => {
  const { eco } = w;
  if (!eco) return;
  const nb = eco.buildings.length;
  if (buildersScratch.length < nb) buildersScratch = new Int16Array(nb * 2);
  buildersScratch.fill(0, 0, nb);
  eco.slotUse = eco.slotUse && eco.slotUse.length >= eco.nodes.length ? eco.slotUse.fill(0) : new Int16Array(eco.nodes.length * 2);
  const assigned = assignedCounts(w);
  // Workers: walk, gather, carry, deposit, build, repair.
  for (let i = 0; i < w.squads.length; i++) {
    const q = w.squads[i];
    if (!q.worker || !q.alive || !q.onField || q.fled || q.order.type !== 'work') continue;
    workerTick(w, q, assigned, buildersScratch);
  }
  // Construction: builders in reach push the site on (diminishing returns), its HP grows with it.
  for (let i = 0; i < nb; i++) {
    const b = eco.buildings[i];
    if (b.built || !b.alive) continue;
    const add = buildRateHalves(buildersScratch[i]);
    if (!add) continue;
    const before = Math.floor((b.maxHp * b.progress) / b.need);
    b.progress = Math.min(b.need, b.progress + add);
    b.hp = Math.min(b.maxHp, b.hp + Math.floor((b.maxHp * b.progress) / b.need) - before);
    if (b.progress >= b.need) completeBuilding(w, b);
  }
  // Training: the first item of each queue, while the side has room under its housing cap.
  const pop = [population(w, 0), population(w, 1)];
  const cap = [housingCap(w, 0), housingCap(w, 1)];
  for (let i = 0; i < nb; i++) {
    const b = eco.buildings[i];
    if (!b.queue.length || !ready(w, b)) continue;
    const item = b.queue[0];
    if (!item.started) {
      if (pop[b.side] + POP_PER_SQUAD > cap[b.side]) { item.blocked = 'housing'; continue; }
      item.started = true; item.blocked = null; pop[b.side] += POP_PER_SQUAD;
    } else if (pop[b.side] > cap[b.side]) { item.blocked = 'housing'; continue; } // over the cap after houses fell: it waits
    item.blocked = null;
    item.ticks += 1;
    if (item.ticks >= item.need) { b.queue.shift(); spawnUnit(w, b, item.role); }
  }
  if (w.tick % TICK_HZ !== 0) return;
  // Once a second: trade posts bring gold; aid posts heal the resting.
  for (let i = 0; i < nb; i++) {
    const b = eco.buildings[i];
    if (!ready(w, b)) continue;
    const def = BUILDINGS[b.type];
    if (def.trade && b.traded < TRADE_GOLD_MAX * MILLI) {
      const g = Math.min(Math.round(TRADE_GOLD_PER_SEC * MILLI), TRADE_GOLD_MAX * MILLI - b.traded);
      b.traded += g; eco.stock[b.side][2] += g; eco.stats[b.side].gathered[2] += g;
    }
    if (def.aid) {
      queryRadius(w, b.x, b.y, AID_RADIUS).forEach((j) => {
        const q = w.squads[j];
        if (q.side !== b.side || !q.alive || q.worker || w.tick - q.lastHitTick < 200 || q.strength >= q.startStrength) return;
        q.strength = Math.min(q.startStrength, q.strength + Math.max(1, Math.round(q.maxStrength * AID_HEAL_PER_SEC)));
      });
    }
  }
};

// Towers raised by workers shoot the nearest enemy squad in range (after the armies' own attacks).
export const fireEcoTowers = (w) => {
  if (!w.eco) return;
  w.eco.buildings.forEach((b) => {
    const t = BUILDINGS[b.type].tower;
    if (!t || !ready(w, b)) return;
    if (b.cooldown > 0) { b.cooldown -= 1; return; }
    let target = null; let bestD = Infinity;
    queryRadius(w, b.x, b.y, t.range).forEach((j) => {
      const q = w.squads[j];
      if (q.side === b.side || !q.alive || !q.onField || q.fled || q.stats.flying || q.inside >= 0) return;
      const d = distSq(q.x, q.y, b.x, b.y);
      if (d < bestD) { bestD = d; target = q; }
    });
    if (!target) return;
    const damage = Math.max(1, Math.round(t.damage * (0.85 + nextRandom(w) * 0.3)));
    target.strength = Math.max(0, target.strength - damage);
    target.morale = Math.max(0, target.morale - Math.round(moraleFromLosses(target, damage)));
    target.lastHitTick = w.tick; target.engaged = true;
    if (target.strength === 0) { target.alive = false; w.events.push({ t: w.tick, type: 'destroyed', id: target.idx }); }
    w.events.push({ t: w.tick, type: 'towerShot', structure: b.id, eco: b.idx, to: target.idx, damage });
    b.cooldown = t.attackTicks;
  });
};

/** A worker or trained squad died: count it (combat and attrition call this through step's pass). */
export const countEcoLosses = (w) => {
  if (!w.eco) return;
  w.events.forEach((e) => { if (e.t === w.tick && e.type === 'destroyed') { const q = w.squads[e.id]; if (q?.worker && !q.lossCounted) { q.lossCounted = true; w.eco.stats[q.side].workersLost += 1; } } });
};

// ---- targets for the armies (movement.js, combat.js) --------------------------------------------

/** The nearest enemy economy building `q` could go for within `radius` (not the proxy town hall). */
export const ecoTargetIndex = (w, q, radius) => {
  if (!w.eco) return -1;
  let best = -1; let bestD = Infinity;
  w.eco.buildings.forEach((b, i) => {
    if (b.side === q.side || !b.alive || b.proxy != null) return;
    const d = distSq(q.x, q.y, b.x, b.y) - b.radius * b.radius;
    if (d > (radius + b.radius) * (radius + b.radius) || d >= bestD) return;
    bestD = d; best = i;
  });
  return best;
};

// ---- hash, view and result ---------------------------------------------------------------------

/** Fold the economy into a world hash (hash.js); squads (workers too) are hashed there already. */
export const foldEconomy = (h, w, mix) => {
  const { eco } = w;
  eco.stock.forEach((s) => s.forEach((v) => { h = mix(h, v); }));
  eco.nodes.forEach((n) => { h = mix(h, n.amount); });
  eco.buildings.forEach((b) => {
    h = mix(h, b.hp); h = mix(h, b.progress); h = mix(h, (b.alive ? 1 : 0) | (b.built ? 2 : 0)); h = mix(h, b.queue.length);
    if (b.queue.length) h = mix(h, b.queue[0].ticks);
  });
  w.squads.forEach((q) => { if (q.worker) { h = mix(h, q.carry); h = mix(h, q.job ? (q.job.t === 'gather' ? 1 + q.job.phase : q.job.t === 'build' ? 5 : 6) : 0); } });
  return h;
};

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** What the screen needs about the economy, from `playerSide`'s eyes (view.js, packedView.js). */
export const ecoView = (w, playerSide) => {
  const { eco } = w;
  if (!eco) return null;
  const fog = w.fog?.[playerSide];
  const seen = (x, y) => !fog || fog[tileOf(w.map, x, y)] >= 1;
  const workers = w.squads.filter((q) => q.worker && q.side === playerSide && q.alive && !q.fled);
  return {
    stock: eco.stock[playerSide].map((v) => Math.floor(v / MILLI)),
    pop: population(w, playerSide),
    cap: housingCap(w, playerSide),
    workers: workers.length,
    // Where the population is (army, laborers, in training) and where the housing comes from.
    popSplit: { workers: workers.filter((q) => q.onField || q.enterTick >= 0).length, training: activeTraining(w, playerSide), army: population(w, playerSide) - activeTraining(w, playerSide) - workers.filter((q) => q.onField || q.enterTick >= 0).length },
    houses: eco.buildings.filter((b) => b.side === playerSide && b.type === 'house' && ready(w, b)).length,
    idleWorkers: workers.filter((q) => !q.job || q.order.type !== 'work').map((q) => q.idx),
    buildings: eco.buildings.map((b) => {
      const alive = ecoAlive(w, b);
      const own = b.side === playerSide;
      if (!own && !seen(b.x, b.y)) return null;
      const keep = b.proxy != null ? w.structures[b.proxy] : null;
      return {
        idx: b.idx, id: b.id, type: b.type, side: b.side, x: b.x, y: b.y, tx: b.tx, ty: b.ty, size: b.size, radius: b.radius,
        hp: keep ? keep.hp : b.hp, maxHp: keep ? keep.maxHp : b.maxHp, alive, built: b.built, progress: pct(b.progress, b.need), proxy: b.proxy != null,
        queue: own ? b.queue.map((it) => ({ role: it.role, pct: pct(it.ticks, it.need), started: it.started, blocked: it.blocked || null })) : [],
        rally: own ? b.rally : null
      };
    }).filter(Boolean),
    nodes: eco.nodes.map((n, i) => (n.amount !== 0 && seen(n.x, n.y) && (n.side < 0 || n.side === playerSide) ? { i, kind: n.kind, res: n.res, x: n.x, y: n.y, amount: n.amount < 0 ? -1 : Math.ceil(n.amount / MILLI), max: n.max < 0 ? -1 : Math.ceil(n.max / MILLI) } : null)).filter(Boolean),
    // Workers carrying something (the renderer puts a load on their backs).
    carrying: workers.filter((q) => q.carry > 0).map((q) => q.idx)
  };
};

/**
 * The battle economy's report for the campaign (R2 reads it; RTS plan 6.5): per side what was left,
 * gathered, spent, looted, trained (auxiliaries: they demobilise after the battle), workers lost,
 * buildings raised and lost, and housing at the end.
 */
export const economyReport = (w) => {
  if (!w.eco) return null;
  return [0, 1].map((side) => {
    const st = w.eco.stats[side];
    const toUnits = (arr) => Object.fromEntries(RESOURCES.map((r, i) => [r, Math.floor(arr[i] / MILLI)]));
    const survivors = {};
    w.squads.forEach((q) => { if (q.side === side && q.eco === 'trained' && q.alive && !q.fled) survivors[q.classId] = (survivors[q.classId] || 0) + 1; });
    return {
      stock: toUnits(w.eco.stock[side]), gathered: toUnits(st.gathered), spent: toUnits(st.spent), looted: Math.floor(st.looted / MILLI),
      trained: { ...st.trained }, auxiliariesStanding: survivors, workersLost: st.workersLost,
      buildingsBuilt: st.built, buildingsLost: st.lost, population: population(w, side), housingCap: housingCap(w, side)
    };
  });
};
