// src/battle/sim/movement.js
// Where every squad wants to be this tick, and getting it there (Tactical Battles plan §8.2):
// straight lines over open ground, flow fields around obstacles, each squad at its own pace (also
// in a mixed group: the user's ruling Q6), terrain speed, and a separation pass so squads don't stack.
//
// The stance contract (playtest audit CB17: U11, I190, I191; the same for the player and the AI):
//   idle        fights any enemy it can see within its sight, and whoever hits it (even from beyond
//               its sight: a shooter gives itself away); chases no further than its leash from its
//               post, then walks back.
//   attackMove  the same on the way, without the leash; once the fight is over it walks on.
//   attack      the target it was given, until that dies or leaves the field; then it becomes idle
//               where it stands and takes on the threats around it (I191). Sent at a building, it
//               turns on a squad that hits it and goes back to the building once that fight is over.
//   hold        strikes whatever comes within its reach; never steps out, never chases.
//   move, retreat  the order is obeyed: it walks where it was sent and does not stop to fight
//               (a withdrawal never turns into an attack, I190).
//   garrison    walks into its building; the building does the shooting.
// Nobody leaves the player's control on their own: morale only makes a commanded side Shaken
// (morale.js). (The pursuit after a decided field battle is step.js's, not a stance.)
import { TILE, TILE_COST } from '../setup/mapgen';
import { angleBetween, distSq, isqrt, polarX, polarY, turnToward } from './fixed';
import { buildTargetGrid, getFlowField, lineClear, nextWaypoint, tileOf, SPATIAL_CELL, SPATIAL_PER } from './pathing';
import { sortInts } from './spatial';
import { acquireTarget, canAttack, inRangeOfSquad, inRangeOfStructure, isFighting, structureTarget } from './combat';
import { canSeeSquad } from './fog';
import { sideEdgeX } from './world';
import { speedMult } from './effects';
import { Q, SQUAD_RADIUS, SIDE_DEFENDER } from './constants';
import { baseBuildings, hasBase } from './base';
import { BUILDINGS } from '../data/economy';

const ARRIVE = Math.round(0.3 * Q);
const NO_PATH = 0xffff; // a flow field's unreached tile (pathing.js)
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
  let speed = Math.max(1, Math.round(q.stats.speed * speedMult(w, q)));
  let wx = gx; let wy = gy;
  if (!q.stats.flying) {
    if (!q.stats.hover) speed = Math.max(1, Math.trunc((speed * 8) / (TILE_COST[w.map.tiles[tileOf(w.map, q.x, q.y)]] || 8))); // hover hulls ignore the ground's drag (U66)
    if (!lineClear(w.map, q.x, q.y, gx, gy)) {
      const field = cacheKey ? getFlowField(w, tileOf(w.map, gx, gy), cacheKey, 96, q.side) : getFlowField(w, tileOf(w.map, gx, gy), undefined, undefined, q.side);
      const wp = nextWaypoint(w, field, q.x, q.y);
      if (!wp) {
        // Truly unreachable from where it stands (not merely next to a goal inside a building): the
        // screen says "no path" (H-04) instead of the order silently doing nothing. Drawing only.
        if (field[tileOf(w.map, q.x, q.y)] === NO_PATH) q.noPathTick = w.tick;
        return true; // unreachable: stop trying
      }
      wx = wp.x; wy = wp.y;
    }
  }
  const heading = angleBetween(q.x, q.y, wx, wy);
  q.stepTick = w.tick; q.stepHeading = heading; // separateSquads lets two squads walking into each other pass
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

// Auto-continue (audit H-26): in a battle with bases a squad whose building fell, or whose
// attack-move ended in the enemy's base, goes on to the next one instead of standing idle beside
// live towers: first a tower (the city's, the keep's, or one the enemy's workers raised) that has it
// in range, else the nearest standing enemy base building (base.js), within `near` of (ox, oy) when
// given (an idle squad that took a building on its own: that building; an attack-move's end: the
// point the player chose, as a squad blocked short of it still "ended in their base", P4-H4). Hold is
// never touched (only attack and attack-move call this); a player's Stop or Move ends it.
// An attack-move "ended in the enemy's base": a base building this close. The town's territory is
// 14 tiles and each squad's goal is its formation slot, a few tiles off the tapped point (P4-H4).
export const CONTINUE_NEAR = 18 * Q;
export const nextBaseTarget = (w, q, near = Infinity, ox = q.x, oy = q.y) => {
  if (!hasBase(w) || !canAttack(q) || q.stats.airOnly || q.worker) return null;
  const enemy = q.side === SIDE_DEFENDER ? 0 : 1;
  let best = null; let bestD = Infinity;
  const consider = (kind, index, d2) => { if (d2 < bestD) { bestD = d2; best = { kind, index }; } };
  const reach = (r) => (r + SQUAD_RADIUS) * (r + SQUAD_RADIUS);
  if (enemy === SIDE_DEFENDER) w.structures.forEach((s, i) => { if (s.alive && s.damage > 0 && s.range > 0) { const d2 = distSq(q.x, q.y, s.x, s.y); if (d2 <= reach(s.range)) consider('structure', i, d2); } });
  if (w.eco) w.eco.buildings.forEach((b, i) => { const t = BUILDINGS[b.type]?.tower; if (t && b.side === enemy && b.alive && b.built) { const d2 = distSq(q.x, q.y, b.x, b.y); if (d2 <= reach(t.range)) consider('eco', i, d2); } });
  if (best) return best;
  baseBuildings(w, enemy).forEach((b) => { if (near === Infinity || distSq(ox, oy, b.x, b.y) <= near * near) consider(b.kind, b.index, distSq(q.x, q.y, b.x, b.y)); });
  return best;
};
const continueAssault = (w, q, near, ox, oy) => {
  const next = nextBaseTarget(w, q, near, ox, oy);
  if (!next) return false;
  q.order = { type: 'attack' }; q.targetKind = next.kind; q.target = next.index;
  return true;
};

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
    // A squad that broke off an attack on a building to fight back (combat.js applyDamage) goes back
    // to the building once its attacker is dead, gone or running (U11): it does not chase the beaten.
    if (q.resumeKind && q.order.type === 'idle') {
      if (valid && q.targetKind === 'squad' && w.squads[q.target].routed) valid = false;
      if (!valid) {
        const kind = q.resumeKind; const idx = q.resumeTarget;
        q.resumeKind = null; q.resumeTarget = -1;
        const s = kind === 'eco' ? w.eco?.buildings[idx] : w.structures[idx];
        if (s?.alive) { q.order = { type: 'attack' }; q.targetKind = kind; q.target = idx; return; }
        q.target = -1; q.targetKind = null;
      }
    }
    if (q.order.type === 'attack') {
      if (valid) return;
      // its building fell: on to the next one (H-26); a squad it was sent after is simply dead
      if ((q.targetKind === 'structure' || q.targetKind === 'eco') && continueAssault(w, q)) return;
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
    const fell = q.targetKind === 'structure' || q.targetKind === 'eco' ? structureTarget(w, q) : null; // the building it took on its own fell
    const found = acquireTarget(w, q, radius);
    q.target = found ? found.index : -1;
    q.targetKind = found ? found.kind : null;
    if (!found && fell && q.order.type === 'idle') continueAssault(w, q, CONTINUE_NEAR, fell.x, fell.y);
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
        const { type, x: gx, y: gy } = q.order;
        q.order = q.path?.length ? { type: 'move', ...q.path.shift() } : { type: 'idle' }; // U38: next drawn waypoint
        if (type === 'attackMove' && q.target < 0) continueAssault(w, q, CONTINUE_NEAR, gx, gy); // ended in their base: raze on (H-26)
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
const SIDESTEP = 32; // 45 degrees (256 to the turn)
const angleDiff = (a, b) => ((((a - b) & 255) + 128) & 255) - 128;
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
      let a = d === 0 ? (q.idx * 37 + j * 11) & 255 : angleBetween(o.x, o.y, q.x, q.y);
      // Two squads walking into each other: a straight push undoes both steps every tick and they
      // stand locked forever (P4-H4). Pushed a little sideways, they slide past each other instead.
      if (d > 0 && q.stepTick === w.tick && o.stepTick === w.tick && Math.abs(angleDiff(q.stepHeading, a + 128)) < 64 && Math.abs(angleDiff(o.stepHeading, a)) < 64) a = (a + SIDESTEP) & 255;
      const qx = q.x + polarX(a, push); const qy = q.y + polarY(a, push);
      const ox = o.x - polarX(a, push); const oy = o.y - polarY(a, push);
      if (passableAt(w, q, qx, qy)) shift(q, qx, qy);
      if (passableAt(w, o, ox, oy)) shift(o, ox, oy);
    }
  }
};
