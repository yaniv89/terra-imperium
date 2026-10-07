// src/battle/sim/movement.js
// Where every squad wants to be this tick, and getting it there (Tactical Battles plan §8.2):
// straight lines over open ground, flow fields around obstacles, the slowest member's pace for a
// group moving in formation (RoN), terrain speed, and a separation pass so squads don't stack.
import { TILE, TILE_COST } from '../setup/mapgen';
import { angleBetween, distSq, isqrt, polarX, polarY, turnToward } from './fixed';
import { buildTargetGrid, getFlowField, lineClear, nextWaypoint, tileOf, SPATIAL_CELL, SPATIAL_PER } from './pathing';
import { sortInts } from './spatial';
import { acquireTarget, canAttack, inRangeOfSquad, inRangeOfStructure, isFighting, structureTarget } from './combat';
import { canSeeSquad } from './fog';
import { sideEdgeX } from './world';
import { speedMult } from './effects';
import { Q, SQUAD_RADIUS, SIDE_DEFENDER } from './constants';

const ARRIVE = Math.round(0.3 * Q);
const TURN_RATE = 24;
const IDLE_LEASH = 6 * Q;

// A closed city gate (TILE.GATE) opens for the city's own side only: the attacker stands at it
// until it falls (cityStructures.js turns it to rubble).
const passableAt = (w, q, x, y) => {
  if (q.stats.flying) return x >= 0 && y >= 0 && x < w.map.w * Q && y < w.map.h * Q;
  if (x < 0 || y < 0 || x >= w.map.w * Q || y >= w.map.h * Q) return false;
  const t = w.map.tiles[tileOf(w.map, x, y)];
  return TILE_COST[t] > 0 || (t === TILE.GATE && q.side === SIDE_DEFENDER);
};

// An attacker's way is barred by the closed gate at (x, y): a squad free to fight batters it
// (it is the only way in short of a breach); one under a plain move order just stands there.
const barredByGate = (w, q, x, y) => {
  if (q.side === SIDE_DEFENDER || q.worker || !canAttack(q) || q.stats.airOnly || q.routed || q.retreating) return;
  if (q.order.type !== 'idle' && q.order.type !== 'attackMove' && q.order.type !== 'attack') return;
  const i = tileOf(w.map, x, y);
  if (w.map.tiles[i] !== TILE.GATE) return;
  if (q.targetKind === 'structure' && w.structures[q.target]?.kind === 'gate') return;
  const gi = w.structures.findIndex((s) => s.kind === 'gate' && s.alive && s.footprint?.includes(i));
  if (gi < 0) return;
  q.target = gi; q.targetKind = 'structure';
};

// `cacheKey`: the economy's workers walk on their own flow-field cache (economy.js).
export const stepToward = (w, q, gx, gy, cacheKey = null) => {
  const remaining = isqrt(distSq(q.x, q.y, gx, gy));
  if (remaining <= ARRIVE) return true;
  let speed = q.groupSpeed && (q.order.type === 'move' || q.order.type === 'attackMove') && remaining > 4 * Q ? q.groupSpeed : q.stats.speed;
  speed = Math.max(1, Math.round(speed * speedMult(w, q)));
  let wx = gx; let wy = gy;
  if (!q.stats.flying) {
    speed = Math.max(1, Math.trunc((speed * 8) / (TILE_COST[w.map.tiles[tileOf(w.map, q.x, q.y)]] || 8)));
    if (!lineClear(w.map, q.x, q.y, gx, gy)) {
      const wp = nextWaypoint(w, cacheKey ? getFlowField(w, tileOf(w.map, gx, gy), cacheKey, 96, q.side) : getFlowField(w, tileOf(w.map, gx, gy), undefined, undefined, q.side), q.x, q.y);
      if (!wp) return true; // unreachable: stop trying
      wx = wp.x; wy = wp.y;
    }
  }
  const heading = angleBetween(q.x, q.y, wx, wy);
  const len = Math.min(speed, remaining);
  const nx = q.x + polarX(heading, len); const ny = q.y + polarY(heading, len);
  if (passableAt(w, q, nx, ny)) { q.x = nx; q.y = ny; }
  else {
    if (w.map.gated) barredByGate(w, q, nx, ny);
    if (passableAt(w, q, nx, q.y)) q.x = nx;
    else if (passableAt(w, q, q.x, ny)) q.y = ny;
  }
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
    const edge = q.reinforcement?.edge;
    if (edge === 'N' || edge === 'S') {
      // Enter on the half of the north/south edge that belongs to this side.
      const span = Math.max(1, Math.floor(w.map.w / 2) - 6);
      const tx = q.side === 0 ? 4 + ((q.idx * 7) % span) : w.map.w - 5 - ((q.idx * 7) % span);
      q.x = tx * Q + (Q >> 1);
      q.y = edge === 'N' ? Q : (w.map.h - 2) * Q;
    }
    q.onField = true; q.reserve = false; q.enterTick = -1; q.joined = true;
    q.facing = q.side === 0 ? 0 : 128;
    q.anchorX = q.x; q.anchorY = q.y;
    q.order = { type: 'idle' };
    w.events.push({ t: w.tick, type: 'reserveArrived', id: q.idx });
  });
};

// How often (ticks) a squad fighting on its own initiative looks around for a better target.
const RETARGET_EVERY = 10;
// Past this distance a squad pursuing a routed enemy looks for other work every tick (tiles).
const PURSUIT_LIMIT = 5 * Q;
// A fresh enemy this close (tiles) is worth breaking off a pursuit for.
const ENGAGE_CLOSE = 3 * Q;

const hasValidTarget = (w, q) => q.target >= 0 && (q.targetKind === 'squad'
  ? isFighting(w.squads[q.target]) && w.squads[q.target].side !== q.side && w.squads[q.target].inside < 0
  : !!structureTarget(w, q)?.alive);

// A fight is over: the squad stands where it is (its new post) instead of walking back to where
// it was when the order was given.
const settle = (q) => { q.order = { type: 'idle' }; q.anchorX = q.x; q.anchorY = q.y; q.target = -1; q.targetKind = null; };

// Idle and attack-moving squads pick up enemies they can see; holding squads only what's in reach.
// A target the player chose (an 'attack' order) is kept until it dies or leaves the field. A target
// a squad picked for itself is revisited now and then, so it doesn't chase routed men across the
// map while fresh enemies are hitting it, or keep walking toward a far target past a near one.
export const acquireTargets = (w) => {
  buildTargetGrid(w); // nothing moves while targets are picked, so one build serves every query
  w.squads.forEach((q) => {
    if (!canAttack(q)) return;
    if (q.order.type === 'move' || q.order.type === 'retreat' || q.order.type === 'garrison') return;
    let valid = hasValidTarget(w, q);
    // Holding squads never step out to reach a target: one that has moved out of reach is let go.
    if (valid && q.order.type === 'hold' && q.targetKind === 'squad' && !inRangeOfSquad(q, w.squads[q.target])) { q.target = -1; q.targetKind = null; valid = false; }
    if (q.order.type === 'attack') {
      if (valid) return;
      settle(q);
    }
    const radius = q.order.type === 'hold' ? q.stats.range + SQUAD_RADIUS * 2 : q.stats.sight * Q;
    if (valid) {
      if (q.targetKind !== 'squad') { if ((w.tick + q.idx) % RETARGET_EVERY) return; }
      else {
        const t = w.squads[q.target];
        const far = t.routed && distSq(q.x, q.y, t.x, t.y) > PURSUIT_LIMIT * PURSUIT_LIMIT;
        if (!far && (w.tick + q.idx) % RETARGET_EVERY) return;
        const found = acquireTarget(w, q, radius);
        // Nothing better around: keep cutting down the fleeing (pursuit), unless they're out of sight.
        if (!found) { if (!canSeeSquad(w, q.side, t)) { q.target = -1; q.targetKind = null; } return; }
        if (found.kind === 'squad' && found.index === q.target) return;
        const next = found.kind === 'squad' ? w.squads[found.index] : null;
        const close = next && distSq(q.x, q.y, next.x, next.y) <= ENGAGE_CLOSE * ENGAGE_CLOSE;
        const better = (t.routed && close && !next.routed) || (far && found.kind !== 'squad')
          || (!inRangeOfSquad(q, t) && next && inRangeOfSquad(q, next));
        if (!better) return;
        q.target = found.index; q.targetKind = found.kind;
        return;
      }
    }
    const found = acquireTarget(w, q, radius);
    q.target = found ? found.index : -1;
    q.targetKind = found ? found.kind : null;
  });
};

export const moveSquads = (w) => {
  w.squads.forEach((q) => {
    if (!isFighting(q) || q.inside >= 0 || q.order.type === 'work') return; // a worker at work walks in economy.js
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
        const s = structureTarget(w, q);
        if (inRangeOfStructure(q, s)) return;
        stepToward(w, q, s.x, s.y);
        return;
      }
    }
    if (q.order.type === 'garrison') { stepToward(w, q, q.order.x, q.order.y); return; } // objectives.js lets it in
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
// Neighbours follow queryRadius's rule exactly (pathing.js: the 8x8 cell a squad stood in at the
// grid build must touch the query box, and it must be within reach where it stands now), but are
// found locally: squads not pushed yet this pass still stand where the grid saw them, so the fine
// cells around the query hold them; a squad once pushed leaves the grid's lists and is tracked in
// a second set of per-cell lists by where it stands now, updated on every push.
const clampTo = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
let movedCell = new Int32Array(64); // fine cell a pushed squad is listed under, -1 = never pushed
let movedNext = new Int32Array(64);
let movedHead = new Int32Array(64);
let near = new Int32Array(64);
export const separateSquads = (w) => {
  const minD = SQUAD_RADIUS * 2;
  const { squads } = w;
  const g = w.spatial;
  if (!g || !g.n) return;
  const n = squads.length;
  if (movedCell.length < n) { movedCell = new Int32Array(n * 2); movedNext = new Int32Array(n * 2); near = new Int32Array(n * 2); }
  const cellCount = g.cols * g.rows;
  if (movedHead.length < cellCount) movedHead = new Int32Array(cellCount * 2);
  movedCell.fill(-1, 0, n);
  movedHead.fill(-1, 0, cellCount);
  const { cell, cx0, cy0, cols, rows, start, items, keys } = g;
  const cellOf = (x, y) => clampTo(Math.floor(y / cell) - cy0, rows) * cols + clampTo(Math.floor(x / cell) - cx0, cols);
  const unlink = (i) => {
    const c = movedCell[i];
    if (movedHead[c] === i) { movedHead[c] = movedNext[i]; return; }
    for (let p = movedHead[c]; p >= 0; p = movedNext[p]) if (movedNext[p] === i) { movedNext[p] = movedNext[i]; return; }
  };
  const shift = (o, nx, ny) => {
    o.x = nx; o.y = ny;
    const c = cellOf(nx, ny);
    if (movedCell[o.idx] === c) return;
    if (movedCell[o.idx] >= 0) unlink(o.idx);
    movedCell[o.idx] = c; movedNext[o.idx] = movedHead[c]; movedHead[c] = o.idx;
  };
  const r2 = minD * minD;
  for (let qi = 0; qi < n; qi++) {
    const q = squads[qi];
    if (!isFighting(q) || q.inside >= 0) continue;
    // The neighbours with a higher index, in ascending order.
    const x = q.x; const y = q.y;
    // Clamped like cellOf, so a squad pushed past the grid's edge is still found in the edge cell.
    const ax = clampTo(Math.floor((x - minD) / cell) - cx0, cols); const bx = clampTo(Math.floor((x + minD) / cell) - cx0, cols);
    const ay = clampTo(Math.floor((y - minD) / cell) - cy0, rows); const by = clampTo(Math.floor((y + minD) / cell) - cy0, rows);
    const kx0 = Math.floor((x - minD) / SPATIAL_CELL); const kx1 = Math.floor((x + minD) / SPATIAL_CELL);
    const ky0 = Math.floor((y - minD) / SPATIAL_CELL); const ky1 = Math.floor((y + minD) / SPATIAL_CELL);
    let count = 0;
    for (let cy = ay; cy <= by; cy++) {
      for (let cx = ax; cx <= bx; cx++) {
        const c = cy * cols + cx;
        for (let s = start[c], end = start[c + 1]; s < end; s++) {
          const i = items[s];
          if (i <= qi || movedCell[i] >= 0) continue; // a pushed squad is found by where it is now
          const o = squads[i];
          const ddx = o.x - x; const ddy = o.y - y;
          if (ddx * ddx + ddy * ddy <= r2) near[count++] = i;
        }
        for (let i = movedHead[c]; i >= 0; i = movedNext[i]) {
          if (i <= qi) continue;
          const o = squads[i];
          const ddx = o.x - x; const ddy = o.y - y;
          if (ddx * ddx + ddy * ddy > r2) continue;
          // The old rule: the 8x8 cell it stood in at the build must touch the query box.
          const kx = Math.floor(keys[i * 2] / SPATIAL_PER); const ky = Math.floor(keys[i * 2 + 1] / SPATIAL_PER);
          if (kx < kx0 || kx > kx1 || ky < ky0 || ky > ky1) continue;
          near[count++] = i;
        }
      }
    }
    sortInts(near, count);
    for (let k = 0; k < count; k++) {
      const j = near[k];
      const o = squads[j];
      if (!isFighting(o) || o.inside >= 0 || !!o.stats.flying !== !!q.stats.flying) continue;
      const d = isqrt(distSq(q.x, q.y, o.x, o.y));
      if (d >= minD) continue;
      const push = Math.ceil((minD - d) / 2);
      const a = d === 0 ? (q.idx * 37 + j * 11) & 255 : angleBetween(o.x, o.y, q.x, q.y);
      const qx = q.x + polarX(a, push); const qy = q.y + polarY(a, push);
      const ox = o.x - polarX(a, push); const oy = o.y - polarY(a, push);
      if (passableAt(w, q, qx, qy)) shift(q, qx, qy);
      if (passableAt(w, o, ox, oy)) shift(o, ox, oy);
    }
  }
};
