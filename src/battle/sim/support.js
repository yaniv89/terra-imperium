// src/battle/sim/support.js
// RoN territory, attrition and supply wagons (Tactical Battles plan §8.3). Attackers inside the
// defender's territory slowly bleed strength unless a friendly Support squad (the supply wagon:
// Baggage Train, Engineers, Pioneers, Sappers) or their general is nearby; `forager` units are
// immune. Wagons also patch up squads resting out of combat — never above the strength they
// brought into the battle (real replenishment is the campaign's job, not the battle's).
import { hasPerk } from '../../data/promotions';
import { distSq } from './fixed';
import { isFighting } from './combat';
import { Q, SIDE_ATTACKER, secondsToTicks } from './constants';

export const SUPPORT_EVERY = 20; // once a second
const GENERAL_SUPPLY_RADIUS = 6 * Q;
const REST_TICKS = secondsToTicks(10);
const HEAL_PER_SEC = 0.005; // of max strength
const CADRE_HEAL_PER_SEC = 0.0025;

const isSupplier = (o) => isFighting(o) && !o.routed && (o.stats.supplyAura || o.commanderId);
const nearSupply = (suppliers, q) => suppliers.some((o) => o.side === q.side && (
  (o.stats.supplyAura && distSq(o.x, o.y, q.x, q.y) <= o.stats.supplyAura * o.stats.supplyAura)
  || (o.commanderId && distSq(o.x, o.y, q.x, q.y) <= GENERAL_SUPPLY_RADIUS * GENERAL_SUPPLY_RADIUS)
));

const inDefenderTerritory = (w, q) => {
  const keep = w.structures[0];
  return keep && distSq(q.x, q.y, keep.x, keep.y) <= w.setup.territoryRadius * w.setup.territoryRadius;
};

export const applySupplyAndAttrition = (w) => {
  if (w.tick % SUPPORT_EVERY !== 0 || w.tick === 0) return;
  const perSecond = (w.setup.attritionPerMinute || 0) / 60;
  // The wagons and generals, listed once: none of them can fall during this pass (a supplier is
  // always within its own reach, so it never takes attrition), so the list stays true throughout.
  const suppliers = w.squads.filter(isSupplier);
  w.squads.forEach((q) => {
    if (!isFighting(q) || q.worker) return; // workers live off their own camp (economy.js)
    const supplied = nearSupply(suppliers, q);
    // Attrition: only the invader, only on enemy soil, only without supply.
    if (q.side === SIDE_ATTACKER && !q.stats.flying && perSecond > 0 && !supplied && !hasPerk(q, 'forager') && inDefenderTerritory(w, q)) {
      const loss = Math.max(1, Math.round(q.strength * perSecond));
      q.strength = Math.max(0, q.strength - loss);
      q.attritionTaken = (q.attritionTaken || 0) + loss;
      if (q.strength === 0) { q.alive = false; w.events.push({ t: w.tick, type: 'destroyed', id: q.idx }); }
      return;
    }
    // Healing while resting: supply wagons, or a Cadre unit on its own at half the rate.
    const resting = w.tick - q.lastHitTick > REST_TICKS;
    if (!resting || q.strength >= q.startStrength) return;
    const rate = supplied ? HEAL_PER_SEC : hasPerk(q, 'cadre') ? CADRE_HEAL_PER_SEC : 0;
    if (!rate) return;
    q.strength = Math.min(q.startStrength, q.strength + Math.max(1, Math.round(q.maxStrength * rate)));
  });
};
