// src/battle/sim/morale.js
// Morale, rout, rally and leaving the field (Tactical Battles plan §8.12). The rout threshold and
// Unbreakable's once-per-battle immunity are auto-resolve's own rules (battle.js's markRouted);
// here they're checked continuously instead of once per phase. A routed squad that reaches its own
// edge leaves the field and SURVIVES strategically with whatever strength it has left — routed is
// not dead, exactly as in auto-resolve.
import { MORALE_ROUT_THRESHOLD } from '../../engine/battle';
import { hasPerk } from '../../data/promotions';
import { isFighting } from './combat';
import { sideEdgeX } from './world';
import { Q, secondsToTicks } from './constants';
import { makeGrid, rebuildGrid } from './spatial';

export const RALLY_MORALE = 35;
export { RTS_MORALE_PER_PERCENT, moraleFromLosses } from './moraleMath';
// Seeing a neighbour break or die shakes the squads around it (a local, cascading morale shock).
export const SHOCK_RADIUS = 5 * Q;
export const SHOCK_MORALE = 5;
// However many neighbours break around it in one tick, a squad loses at most this much morale from
// the shock: a collapse spreads along a line over several ticks (time to react) instead of one
// broken squad instantly toppling a whole army.
export const SHOCK_CAP_PER_TICK = 10;
const SHOCK_CELL = 4 * Q;
const inGrid = (q) => q.alive && q.onField;
const RALLY_QUIET_TICKS = secondsToTicks(6);
const REGEN_QUIET_TICKS = secondsToTicks(3);
export const ROUTED_REGEN_PER_SEC = 3;

export const updateMorale = (w) => {
  // Squads that broke or fell this tick shake their neighbours (applied before rout checks, so a
  // collapse can cascade along a line over the following ticks).
  const shocks = w.events.filter((e) => e.t === w.tick && (e.type === 'destroyed' || e.type === 'routed')).map((e) => w.squads[e.id]).filter(Boolean);
  if (shocks.length) {
    const taken = new Map();
    // Neighbours from a grid of where everyone stands right now (split by side): each squad's
    // loss from one source doesn't depend on the others', so the scan order changes nothing.
    const g = rebuildGrid(w.shockGrid && w.shockGrid.cell === SHOCK_CELL ? w.shockGrid : makeGrid(SHOCK_CELL, true), w.squads, inGrid);
    w.shockGrid = g;
    const { cell, cx0, cy0, cols, rows, start, items } = g;
    shocks.forEach((src) => {
      const ax = Math.max(Math.floor((src.x - SHOCK_RADIUS) / cell) - cx0, 0); const bx = Math.min(Math.floor((src.x + SHOCK_RADIUS) / cell) - cx0, cols - 1);
      const ay = Math.max(Math.floor((src.y - SHOCK_RADIUS) / cell) - cy0, 0); const by = Math.min(Math.floor((src.y + SHOCK_RADIUS) / cell) - cy0, rows - 1);
      for (let cy = ay; cy <= by; cy++) {
        for (let cx = ax; cx <= bx; cx++) {
          const b = (cy * cols + cx) * 2 + src.side;
          for (let s = start[b], end = start[b + 1]; s < end; s++) {
            const q = w.squads[items[s]];
            if (q === src || !isFighting(q) || q.routed || q.inside >= 0 || q.worker) continue;
            const dx = q.x - src.x; const dy = q.y - src.y;
            if (dx * dx + dy * dy > SHOCK_RADIUS * SHOCK_RADIUS) continue;
            const loss = Math.min(SHOCK_MORALE, SHOCK_CAP_PER_TICK - (taken.get(q.idx) || 0));
            if (loss <= 0) continue;
            taken.set(q.idx, (taken.get(q.idx) || 0) + loss);
            q.morale = Math.max(0, q.morale - loss);
          }
        }
      }
    });
  }
  w.squads.forEach((q) => {
    if (!isFighting(q) || q.inside >= 0 || q.worker) return; // sheltered by its walls; workers never rout (economy.js)
    if (!q.routed && q.morale <= MORALE_ROUT_THRESHOLD && q.strength > 0) {
      if (hasPerk(q, 'unbreakable') && !q.routImmunityUsed) {
        q.routImmunityUsed = true;
        q.morale = MORALE_ROUT_THRESHOLD + 1;
      } else {
        q.routed = true; q.target = -1; q.targetKind = null; q.order = { type: 'idle' };
        w.events.push({ t: w.tick, type: 'routed', id: q.idx });
      }
    }
    const quiet = w.tick - q.lastHitTick;
    // Morale comes back once nobody is shooting at you — faster for a routed squad that got clear
    // (it can rally and return to the fight before it runs off the field, as in Total War).
    if (quiet > REGEN_QUIET_TICKS && w.tick % 20 === 0 && q.morale < 100) q.morale = Math.min(100, q.morale + (q.routed ? ROUTED_REGEN_PER_SEC : 1));
    if (q.routed && quiet > RALLY_QUIET_TICKS && q.morale >= RALLY_MORALE) {
      q.routed = false; q.anchorX = q.x; q.anchorY = q.y;
      w.events.push({ t: w.tick, type: 'rallied', id: q.idx });
    }
    if ((q.routed || q.retreating) && Math.abs(q.x - sideEdgeX(w, q.side)) <= Q) {
      q.onField = false; q.fled = true;
      w.events.push({ t: w.tick, type: 'fled', id: q.idx });
    }
  });
};
