// src/battle/sim/movement.js
// Where every squad wants to be this tick, and getting it there (Tactical Battles plan §8.2):
// straight lines over open ground, flow fields around obstacles, the slowest member's pace for a
// group moving in formation (RoN), terrain speed, and a separation pass so squads don't stack.
import { TILE_COST } from '../setup/mapgen';
import { angleBetween, distSq, isqrt, polarX, polarY, turnToward } from './fixed';
import { getFlowField, lineClear, nextWaypoint, queryRadius, tileOf } from './pathing';
import { acquireTarget, canAttack, inRangeOfSquad, inRangeOfStructure, isFighting } from './combat';
import { sideEdgeX } from './world';
import { Q, SQUAD_RADIUS } from './constants';

const ARRIVE = Math.round(0.3 * Q);
const TURN_RATE = 24;
const IDLE_LEASH = 6 * Q;

const passableAt = (w, q, x, y) => {
  if (q.stats.flying) return x >= 0 && y >= 0 && x < w.map.w * Q && y < w.map.h * Q;
  if (x < 0 || y < 0 || x >= w.map.w * Q || y >= w.map.h * Q) return false;
  return TILE_COST[w.map.tiles[tileOf(w.map, x, y)]] > 0;
};

const stepToward = (w, q, gx, gy) => {
  const remaining = isqrt(distSq(q.x, q.y, gx, gy));
  if (remaining <= ARRIVE) return true;
  let speed = q.groupSpeed && (q.order.type === 'move' || q.order.type === 'attackMove') && remaining > 4 * Q ? q.groupSpeed : q.stats.speed;
  let wx = gx; let wy = gy;
  if (!q.stats.flying) {
    speed = Math.max(1, Math.trunc((speed * 8) / (TILE_COST[w.map.tiles[tileOf(w.map, q.x, q.y)]] || 8)));
    if (!lineClear(w.map, q.x, q.y, gx, gy)) {
      const wp = nextWaypoint(w, getFlowField(w, tileOf(w.map, gx, gy)), q.x, q.y);
      if (!wp) return true; // unreachable: stop trying
      wx = wp.x; wy = wp.y;
    }
  }
  const heading = angleBetween(q.x, q.y, wx, wy);
  const len = Math.min(speed, remaining);
  const nx = q.x + polarX(heading, len); const ny = q.y + polarY(heading, len);
  if (passableAt(w, q, nx, ny)) { q.x = nx; q.y = ny; }
  else if (passableAt(w, q, nx, q.y)) q.x = nx;
  else if (passableAt(w, q, q.x, ny)) q.y = ny;
  q.facing = turnToward(q.facing, heading, TURN_RATE);
  q.movedSinceAttack += len;
  return false;
};

// Called reserves walk on from their own edge once their entry time comes.
export const enterReserves = (w) => {
  w.squads.forEach((q) => {
    if (!q.alive || q.enterTick < 0 || w.tick < q.enterTick) return;
    const lane = (q.idx * 5) % Math.max(1, w.map.h - 8);
    q.x = sideEdgeX(w, q.side);
    q.y = (4 + lane) * Q + (Q >> 1);
    q.onField = true; q.reserve = false; q.enterTick = -1;
    q.facing = q.side === 0 ? 0 : 128;
    q.anchorX = q.x; q.anchorY = q.y;
    q.order = { type: 'idle' };
    w.events.push({ t: w.tick, type: 'reserveArrived', id: q.idx });
  });
};

// Idle and attack-moving squads pick up enemies they can see; holding squads only what's in reach.
export const acquireTargets = (w) => {
  w.squads.forEach((q) => {
    if (!canAttack(q)) return;
    const hasValid = q.target >= 0 && (q.targetKind === 'squad' ? isFighting(w.squads[q.target]) && w.squads[q.target].side !== q.side : w.structures[q.target]?.alive);
    if (hasValid && (q.order.type === 'attack' || q.order.type !== 'hold')) return;
    if (q.order.type === 'move' || q.order.type === 'retreat') return;
    if (q.order.type === 'attack' && !hasValid) q.order = { type: 'idle' };
    const radius = q.order.type === 'hold' ? q.stats.range + SQUAD_RADIUS * 2 : q.stats.sight * Q;
    const found = acquireTarget(w, q, radius);
    q.target = found ? found.index : -1;
    q.targetKind = found ? found.kind : null;
  });
};

export const moveSquads = (w) => {
  w.squads.forEach((q) => {
    if (!isFighting(q)) return;
    if (q.routed || q.retreating) { stepToward(w, q, sideEdgeX(w, q.side), q.y); return; }
    if (q.order.type === 'hold') return;
    // Chase / close with the current target unless it's already in reach.
    if (q.target >= 0 && canAttack(q) && q.order.type !== 'move') {
      if (q.targetKind === 'squad') {
        const t = w.squads[q.target];
        if (inRangeOfSquad(q, t)) return;
        // Idle defenders don't chase forever — they return to their post (leash).
        if (q.order.type === 'idle' && distSq(q.anchorX, q.anchorY, t.x, t.y) > IDLE_LEASH * IDLE_LEASH * 4) { q.target = -1; q.targetKind = null; }
        else { stepToward(w, q, t.x, t.y); return; }
      } else {
        const s = w.structures[q.target];
        if (inRangeOfStructure(q, s)) return;
        stepToward(w, q, s.x, s.y);
        return;
      }
    }
    if (q.order.type === 'move' || q.order.type === 'attackMove') {
      if (stepToward(w, q, q.order.x, q.order.y)) {
        if (q.order.facing !== undefined) q.facing = q.order.facing;
        q.anchorX = q.x; q.anchorY = q.y;
        q.order = { type: 'idle' }; q.groupSpeed = 0;
      }
      return;
    }
    if (q.order.type === 'idle' && distSq(q.x, q.y, q.anchorX, q.anchorY) > Q * Q) stepToward(w, q, q.anchorX, q.anchorY);
  });
};

// Push overlapping squads apart (ground with ground, air with air), in index order.
export const separateSquads = (w) => {
  const minD = SQUAD_RADIUS * 2;
  w.squads.forEach((q) => {
    if (!isFighting(q)) return;
    queryRadius(w, q.x, q.y, minD).forEach((j) => {
      if (j <= q.idx) return;
      const o = w.squads[j];
      if (!isFighting(o) || !!o.stats.flying !== !!q.stats.flying) return;
      const d = isqrt(distSq(q.x, q.y, o.x, o.y));
      if (d >= minD) return;
      const push = Math.ceil((minD - d) / 2);
      const a = d === 0 ? (q.idx * 37 + j * 11) & 255 : angleBetween(o.x, o.y, q.x, q.y);
      const qx = q.x + polarX(a, push); const qy = q.y + polarY(a, push);
      const ox = o.x - polarX(a, push); const oy = o.y - polarY(a, push);
      if (passableAt(w, q, qx, qy)) { q.x = qx; q.y = qy; }
      if (passableAt(w, o, ox, oy)) { o.x = ox; o.y = oy; }
    });
  });
};
