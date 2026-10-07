// src/battle/render/view.js
// The reference shape of a render view. Live battles send packed frames instead (packedView.js,
// decoded on the screen to this exact shape; packedView.test.js keeps the two equal).
// The small, plain snapshot of a world the renderer and HUD need each frame — cheap to post from
// the worker (≤ 64 squads) and free of anything the UI shouldn't touch. Everything is seen from
// the PLAYER's side: enemy squads carry `visible` (fog of war), and the fog grid itself is only
// included when it changed (every few ticks) to keep frames small.
import { canSeeSquad } from '../sim/fog';
import { POWERS, powerState, getSquadAbilities } from '../sim/effects';
import { callCost } from '../sim/orders';
import { garrisonOf, garrisonRoom, GARRISON_SLOTS } from '../sim/objectives';
import { ecoView } from '../sim/economy';

/** A squad's irregular look for the renderer (unitModels.js): 'mercenary' (a hired band, engine
 * unit.mercenary), 'raider' (an independent's raid party, unit.raidOf), or null. */
export const squadLookOf = (q) => (q.original?.mercenary ? 'mercenary' : q.original?.raidOf || q.original?.raider ? 'raider' : null);

export const makeRenderView = (w, pendingOrders = [], playerSide = 0, includeFog = true) => ({
  tick: w.tick,
  playerSide,
  supply: [...w.supply],
  assimilation: w.assimilation,
  battleType: w.setup.battleType || 'field',
  beachhead: w.beachhead || 0,
  ended: w.ended,
  pendingOrders: pendingOrders.length,
  fog: includeFog && w.fog ? w.fog[playerSide].slice() : null,
  powers: (w.setup.powers?.[playerSide] || []).map((p) => {
    const st = powerState(w, playerSide, p.id);
    return { id: p.id, label: POWERS[p.id]?.label || p.id, cost: st.cost, usesLeft: st.usesLeft, readyIn: Math.max(0, st.readyAt - w.tick), targeted: !!POWERS[p.id]?.impacts };
  }),
  squads: w.squads.map((q) => ({
    idx: q.idx, side: q.side, unitId: q.unitId, classId: q.classId, ageId: q.ageId, navalLine: q.original?.navalLine || null, look: squadLookOf(q),
    x: q.x, y: q.y, facing: q.facing,
    strength: q.strength, maxStrength: q.maxStrength, startStrength: q.startStrength, morale: q.morale,
    alive: q.alive, onField: q.onField, fled: q.fled, routed: q.routed, retreating: q.retreating,
    reserve: q.reserve, enterTick: q.enterTick, inside: q.inside ?? -1,
    visible: canSeeSquad(w, playerSide, q),
    hidden: (q.hiddenUntil || -1) > w.tick,
    reinforcement: q.reinforcement ? { name: q.reinforcement.name, edge: q.reinforcement.edge } : null,
    callCost: callCost(q, w),
    order: q.order.type, orderX: q.order.x ?? null, orderY: q.order.y ?? null,
    target: q.target, targetKind: q.targetKind,
    // Swung or fired within its last attack cycle: in the thick of it, even while being jostled.
    striking: w.tick - (q.lastStrikeTick ?? -10000) <= q.stats.attackTicks + 4,
    xp: q.original.xp || 0, promotions: q.promotions, commanderId: q.commanderId,
    abilities: q.side === playerSide ? getSquadAbilities(w, q).map((id) => ({ id, readyIn: Math.max(0, (q.cooldowns?.[id] || 0) - w.tick) })) : []
  })),
  // The garrison is only shown to its own side (the enemy just sees a building shooting harder).
  structures: w.structures.map((s, si) => ({
    id: s.id, kind: s.kind, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, alive: s.alive, radius: s.radius,
    garrison: playerSide === 1 ? garrisonOf(w, si).length : 0,
    garrisonSlots: playerSide === 1 && garrisonRoom(w, si) + garrisonOf(w, si).length > 0 ? GARRISON_SLOTS[s.kind] || 0 : 0
  })),
  points: w.points.map((p) => ({ id: p.id, resId: p.resId, x: p.x, y: p.y, owner: p.owner, progress: p.progress, capturingSide: p.capturingSide })),
  // The battle economy (economy.js ecoView), null without one.
  eco: ecoView(w, playerSide)
});
