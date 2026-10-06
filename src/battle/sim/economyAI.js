// src/battle/sim/economyAI.js
// The tactical AI's economy (phase R1): it runs inside the sim like the army AI (tacticalAI.js),
// speaks only through orders, and plays by the same rules as the player. Every think it puts idle
// laborers to work, sends builders to unattended sites, raises a village house before the housing
// cap is reached, trains laborers up to its difficulty's target, raises production buildings (and
// towers, defending, at king and up) and keeps them training. Trained squads then join the army AI's
// plans by themselves (they are ordinary squads to it).
import { distSq } from './fixed';
import { Q, SIDE_ATTACKER } from './constants';
import { placementBlock, population, housingCap, ecoAlive } from './economy';
import { BUILDINGS, UNITS, RESOURCES, MILLI, costMilli, buildableFor, trainableRoles, POP_LIMIT, WORKER_MIX } from '../data/economy';

// workers: laborers it keeps; prod: production buildings; towers: when defending; mix: the share of
// laborers on food, materials, gold; army: what its barracks train, in order of preference.
export const AI_ECONOMY = {
  settler: { every: 60, workers: 6, prod: 1, towers: 0, queue: 1 },
  chieftain: { every: 50, workers: 8, prod: 1, towers: 0, queue: 1 },
  prince: { every: 40, workers: 14, prod: 2, towers: 0, queue: 2 },
  king: { every: 30, workers: 20, prod: 3, towers: 1, queue: 2 },
  emperor: { every: 24, workers: 26, prod: 4, towers: 2, queue: 3 }
};
const MIX = WORKER_MIX;
const PRODUCTION = ['barracks', 'range', 'stable', 'siegeWorkshop'];

const afford = (stock, cost, reserve = 0) => { const c = costMilli(cost); return RESOURCES.every((r, i) => stock[i] - reserve * MILLI >= c[r]); };
const spend = (stock, cost) => { const c = costMilli(cost); RESOURCES.forEach((r, i) => { stock[i] -= c[r]; }); };

const nearestNode = (w, side, res, x, y) => {
  let best = -1; let bestD = Infinity;
  w.eco.nodes.forEach((n, i) => { if (n.res === res && n.amount !== 0 && (n.side < 0 || n.side === side)) { const d = distSq(n.x, n.y, x, y); if (d < bestD) { bestD = d; best = i; } } });
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
  if (!hq) return;

  // 1. Idle laborers to whatever resource is furthest under its share.
  const onRes = { food: 0, materials: 0, gold: 0 };
  workers.forEach((q) => { if (q.job?.t === 'gather') onRes[w.eco.nodes[q.job.node].res] += 1; });
  const idle = workers.filter((q) => !q.job || q.order.type !== 'work');
  idle.forEach((q) => {
    const total = workers.length || 1;
    const res = RESOURCES.slice().sort((a, b) => (onRes[a] / total - MIX[a]) - (onRes[b] / total - MIX[b]))[0];
    let best = -1; let bestD = Infinity;
    w.eco.nodes.forEach((n, i) => { if (n.res === res && n.amount !== 0 && (n.side < 0 || n.side === side)) { const d = distSq(n.x, n.y, hq.x, hq.y) + distSq(n.x, n.y, q.x, q.y); if (d < bestD) { bestD = d; best = i; } } });
    if (best < 0) return;
    onRes[res] += 1;
    orders.push({ side, type: 'gather', squads: [q.idx], node: best });
  });

  // ... and one laborer a think moves from the most crowded resource to the most wanting one.
  const total = workers.length;
  const over = RESOURCES.find((r) => onRes[r] > MIX[r] * total + 1.5);
  const under = RESOURCES.find((r) => onRes[r] < MIX[r] * total - 1);
  if (over && under) {
    const mover = workers.find((q) => q.job?.t === 'gather' && w.eco.nodes[q.job.node].res === over && !idle.includes(q));
    const node = mover ? nearestNode(w, side, under, mover.x, mover.y) : -1;
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
  const build = (type, near = hq) => {
    if (!afford(stock, BUILDINGS[type].cost)) return false;
    const spot = findSpot(w, side, type, near.x, near.y);
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
  const roles = trainableRoles(ageId);
  const prod = mine.filter((b) => PRODUCTION.includes(b.type));
  if (!sites.some((b) => b.type !== 'house') && workers.length >= Math.min(6, cfg.workers)) {
    const want = PRODUCTION.filter((t) => buildableFor(ageId).includes(t) && roles.includes(BUILDINGS[t].trains[0])).slice(0, cfg.prod);
    const next = want.find((t) => !prod.some((b) => b.type === t));
    if (next) build(next);
    else if (side !== SIDE_ATTACKER && cfg.towers && mine.filter((b) => b.type === 'tower').length < cfg.towers) build('tower');
  }

  // 6. Keep the production buildings training (a little food kept back for laborers).
  prod.filter((b) => b.built).forEach((b) => {
    if (b.queue.length >= cfg.queue) return;
    const role = BUILDINGS[b.type].trains.find((r) => roles.includes(r));
    if (!role || !afford(stock, UNITS[role].cost, 40)) return;
    spend(stock, UNITS[role].cost);
    orders.push({ side, type: 'train', building: b.idx, role });
  });
};
