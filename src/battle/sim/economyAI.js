// src/battle/sim/economyAI.js
// The tactical AI's economy (phase R1): it runs inside the sim like the army AI (tacticalAI.js),
// speaks only through orders, and plays by the same rules as the player. Every think it puts idle
// laborers to work, sends builders to unattended sites, raises a village house before the housing
// cap is reached, trains laborers up to its difficulty's target, raises production buildings (and
// towers, defending, at king and up) and keeps them training. Trained squads then join the army AI's
// plans by themselves (they are ordinary squads to it).
// W12 (every tree is wood, more nodes over the field): a laborer goes to the nearest node of its
// resource with a free place (a crowded one counts as four times as far), keeps to its own half
// unless nothing is left there, and once three or more laborers walk far (DROP_FAR tiles) from a
// node to the nearest drop-off, a wood and stone yard (or a food depot) goes up beside that node.
import { distSq } from './fixed';
import { Q, SIDE_ATTACKER } from './constants';
import { placementBlock, population, housingCap, ecoAlive } from './economy';
import { BUILDINGS, UNITS, RESOURCES, MILLI, costMilli, buildableFor, trainableRoles, POP_LIMIT, WORKER_MIX } from '../data/economy';

// workers: laborers it keeps; prod: production buildings; towers: when defending; mix: the share of
// laborers on food, wood, stone, gold (WORKER_MIX); army: what its barracks train, in order of preference.
export const AI_ECONOMY = {
  settler: { every: 60, workers: 6, prod: 1, towers: 0, queue: 1 },
  chieftain: { every: 50, workers: 8, prod: 1, towers: 0, queue: 1 },
  prince: { every: 40, workers: 14, prod: 2, towers: 0, queue: 2 },
  king: { every: 30, workers: 20, prod: 3, towers: 1, queue: 2 },
  emperor: { every: 24, workers: 26, prod: 4, towers: 2, queue: 3 }
};
const MIX = WORKER_MIX;
/** How far (tiles) laborers may walk a load before the AI raises a drop-off by their node (W12). */
export const DROP_FAR = 12;
/** At most this many drop-offs of its own (yards and depots) a side raises. */
export const DROP_MAX = 3;
const PRODUCTION = ['barracks', 'range', 'stable', 'siegeWorkshop'];

const afford = (stock, cost, reserve = 0) => { const c = costMilli(cost); return RESOURCES.every((r, i) => stock[i] - reserve * MILLI >= c[r]); };
const spend = (stock, cost) => { const c = costMilli(cost); RESOURCES.forEach((r, i) => { stock[i] -= c[r]; }); };

// The node of `res` for a laborer at (x, y) from a base at `hq`: near both, a crowded one (its
// places taken) as if four times as far, one in the enemy's half only when its own has none.
const pickFor = (w, side, res, x, y, hq, load) => {
  const half = w.map.w * (Q >> 1);
  let best = -1; let bestD = Infinity;
  w.eco.nodes.forEach((n, i) => {
    if (n.res !== res || n.amount === 0 || (n.side >= 0 && n.side !== side)) return;
    let d = distSq(n.x, n.y, x, y) + (hq ? distSq(n.x, n.y, hq.x, hq.y) : 0);
    if ((load.get(i) || 0) >= n.slots) d *= 4;
    if (n.side < 0 && (side === SIDE_ATTACKER ? n.x > half : n.x < half)) d *= 9;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
};

// A spot for `type` near (x, y): rings outward, the first valid footprint (same rule as the player).
const findSpot = (w, side, type, x, y, rMin = 4, rMax = 16) => {
  const size = BUILDINGS[type].size;
  const away = side === SIDE_ATTACKER ? 128 : 0; // build on the side away from the enemy first
  for (let r = rMin; r <= rMax; r += 2) {
    const steps = 8 + r * 2;
    for (let k = 0; k < steps; k++) {
      const a = ((away + Math.round((k * 256) / steps) * (k % 2 ? 1 : -1) / 2) & 255) / 256 * Math.PI * 2;
      const tx = Math.round(x / Q + Math.cos(a) * r - size / 2); const ty = Math.round(y / Q + Math.sin(a) * r - size / 2);
      if (!placementBlock(w, side, type, tx, ty)) return { tx, ty };
    }
  }
  return null;
};

/** One economic think for `side` (tacticalAI.js calls it on the AI's own ticks). */
export const thinkEconomy = (w, side, difficultyId, orders) => {
  if (!w.eco) return;
  const cfg = AI_ECONOMY[difficultyId] || AI_ECONOMY.prince;
  if (w.tick % cfg.every !== (side * 7) % cfg.every) return;
  const ageId = w.setup.sides[side].ageId;
  const stock = [...w.eco.stock[side]]; // what this think may still spend (its orders pay later, in order)
  const mine = w.eco.buildings.filter((b) => b.side === side && ecoAlive(w, b));
  const hq = mine.find((b) => BUILDINGS[b.type].hq && b.built);
  const workers = w.squads.filter((q) => q.worker && q.side === side && q.alive && !q.fled && q.onField);
  const roles = trainableRoles(ageId);
  const prod = mine.filter((b) => PRODUCTION.includes(b.type));
  // Keep the production buildings training (a little food kept back for laborers). With bases the
  // keep or the camp may fall while the barracks stand (base.js, Q4): they train on regardless.
  const keepTraining = () => prod.filter((b) => b.built).forEach((b) => {
    if (b.queue.length >= cfg.queue) return;
    const role = BUILDINGS[b.type].trains.find((r) => roles.includes(r));
    if (!role || !afford(stock, UNITS[role].cost, 40)) return;
    spend(stock, UNITS[role].cost);
    orders.push({ side, type: 'train', building: b.idx, role });
  });
  if (!hq) { keepTraining(); return; }

  // 1. Idle laborers to whatever resource is furthest under its share.
  const onRes = Object.fromEntries(RESOURCES.map((r) => [r, 0]));
  const load = new Map(); // node -> laborers on it
  workers.forEach((q) => { if (q.job?.t === 'gather') { onRes[w.eco.nodes[q.job.node].res] += 1; load.set(q.job.node, (load.get(q.job.node) || 0) + 1); } });
  const idle = workers.filter((q) => !q.job || q.order.type !== 'work');
  idle.forEach((q) => {
    const total = workers.length || 1;
    const res = RESOURCES.slice().sort((a, b) => (onRes[a] / total - MIX[a]) - (onRes[b] / total - MIX[b]))[0];
    const best = pickFor(w, side, res, q.x, q.y, hq, load);
    if (best < 0) return;
    onRes[res] += 1; load.set(best, (load.get(best) || 0) + 1);
    orders.push({ side, type: 'gather', squads: [q.idx], node: best });
  });

  // ... and one laborer a think moves from the most crowded resource to the most wanting one.
  const total = workers.length;
  const over = RESOURCES.find((r) => onRes[r] > MIX[r] * total + 1.5);
  const under = RESOURCES.find((r) => onRes[r] < MIX[r] * total - 1);
  if (over && under) {
    const mover = workers.find((q) => q.job?.t === 'gather' && w.eco.nodes[q.job.node].res === over && !idle.includes(q));
    const node = mover ? pickFor(w, side, under, mover.x, mover.y, hq, load) : -1;
    if (node >= 0) orders.push({ side, type: 'gather', squads: [mover.idx], node });
  }

  // 2. Sites nobody is building: the nearest two laborers go.
  const sites = mine.filter((b) => !b.built && b.proxy == null);
  sites.forEach((b) => {
    if (workers.some((q) => q.job?.t === 'build' && q.job.b === b.idx)) return;
    const near = workers.filter((q) => q.job?.t !== 'build').sort((a, c) => distSq(a.x, a.y, b.x, b.y) - distSq(c.x, c.y, b.x, b.y) || a.idx - c.idx).slice(0, 2);
    if (near.length) orders.push({ side, type: 'assist', squads: near.map((q) => q.idx), target: { kind: 'eco', index: b.idx } });
  });
  const builder = () => workers.filter((q) => q.job?.t !== 'build').sort((a, c) => distSq(a.x, a.y, hq.x, hq.y) - distSq(c.x, c.y, hq.x, hq.y) || a.idx - c.idx).slice(0, 2).map((q) => q.idx);
  const build = (type, near = hq, rMin = 4, rMax = 16) => {
    if (!afford(stock, BUILDINGS[type].cost)) return false;
    const spot = findSpot(w, side, type, near.x, near.y, rMin, rMax);
    const squads = builder();
    if (!spot || !squads.length) return false;
    spend(stock, BUILDINGS[type].cost);
    orders.push({ side, type: 'build', squads, building: type, tx: spot.tx, ty: spot.ty });
    return true;
  };

  // 3. A house before the cap is reached (one site at a time).
  const pop = population(w, side); const cap = housingCap(w, side);
  const houseSite = sites.some((b) => b.type === 'house');
  if (!houseSite && cap < POP_LIMIT && cap - pop <= 3 && buildableFor(ageId).includes('house')) build('house');

  // 4. Laborers up to the target.
  const trainingWorkers = hq.queue.filter((it) => it.role === 'worker').length;
  if (workers.length + trainingWorkers < cfg.workers && hq.queue.length < 2 && afford(stock, UNITS.worker.cost)) {
    spend(stock, UNITS.worker.cost);
    orders.push({ side, type: 'train', building: hq.idx, role: 'worker' });
  }

  // 5. Production, then (defending) towers: one new site a think.
  let raised = false;
  if (!sites.some((b) => b.type !== 'house') && workers.length >= Math.min(6, cfg.workers)) {
    const want = PRODUCTION.filter((t) => buildableFor(ageId).includes(t) && roles.includes(BUILDINGS[t].trains[0])).slice(0, cfg.prod);
    const next = want.find((t) => !prod.some((b) => b.type === t));
    if (next) raised = build(next);
    else if (side !== SIDE_ATTACKER && cfg.towers && mine.filter((b) => b.type === 'tower').length < cfg.towers) raised = build('tower');
  }

  // 5b. W12: a drop-off by a node its laborers walk far from (wood, stone or food; gold goes home).
  if (!raised && !sites.some((b) => b.type !== 'house')) {
    const drops = mine.filter((b) => b.built && BUILDINGS[b.type].dropoff);
    const own = mine.filter((b) => b.type === 'materialsYard' || b.type === 'foodDepot').length;
    let far = null;
    load.forEach((count, ni) => {
      const n = w.eco.nodes[ni];
      if (count < 3 || n.kind === 'farm' || n.res === 'gold') return;
      let d = Infinity;
      drops.forEach((b) => { if (BUILDINGS[b.type].dropoff.includes(n.res)) d = Math.min(d, distSq(b.x, b.y, n.x, n.y)); });
      if (d > (DROP_FAR * Q) ** 2 && (!far || d > far.d)) far = { n, d };
    });
    if (far && own < DROP_MAX) {
      const type = far.n.res === 'food' ? 'foodDepot' : 'materialsYard';
      if (buildableFor(ageId).includes(type)) build(type, far.n, 2, 7);
    }
  }

  // 6. Keep the production buildings training.
  keepTraining();
};
