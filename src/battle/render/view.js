// src/battle/render/view.js
// The small, plain snapshot of a world the renderer and HUD need each frame — cheap to post from
// the worker (≤ 64 squads) and free of anything the UI shouldn't touch.
export const makeRenderView = (w, pendingOrders = []) => ({
  tick: w.tick,
  supply: [...w.supply],
  assimilation: w.assimilation,
  ended: w.ended,
  pendingOrders: pendingOrders.length,
  squads: w.squads.map((q) => ({
    idx: q.idx, side: q.side, unitId: q.unitId, classId: q.classId, ageId: q.ageId,
    x: q.x, y: q.y, facing: q.facing,
    strength: q.strength, maxStrength: q.maxStrength, startStrength: q.startStrength, morale: q.morale,
    alive: q.alive, onField: q.onField, fled: q.fled, routed: q.routed, retreating: q.retreating,
    reserve: q.reserve, enterTick: q.enterTick,
    order: q.order.type, orderX: q.order.x ?? null, orderY: q.order.y ?? null,
    target: q.target, targetKind: q.targetKind,
    xp: q.original.xp || 0, promotions: q.promotions, commanderId: q.commanderId
  })),
  structures: w.structures.map((s) => ({ id: s.id, kind: s.kind, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, alive: s.alive, radius: s.radius })),
  points: w.points.map((p) => ({ id: p.id, resId: p.resId, x: p.x, y: p.y, owner: p.owner, progress: p.progress, capturingSide: p.capturingSide }))
});
