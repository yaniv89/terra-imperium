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

export const RALLY_MORALE = 35;
const RALLY_QUIET_TICKS = secondsToTicks(6);
const REGEN_QUIET_TICKS = secondsToTicks(3);

export const updateMorale = (w) => {
  w.squads.forEach((q) => {
    if (!isFighting(q)) return;
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
    if (quiet > REGEN_QUIET_TICKS && w.tick % 20 === 0 && q.morale < 100) q.morale += 1;
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
