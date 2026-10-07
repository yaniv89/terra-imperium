// src/battle/audio/voiceLines.js
// Which unit voice answers the player in a battle (src/audio/ACTIONS.md, "Unit voices"): the class
// most of the selected squads belong to, and the kind of bark: 'select' when a group is picked,
// 'order' for a move or a task, 'attack' for an attack. Pure; src/audio/sfx.js playVoice plays the
// bark and rate-limits it (not every click is answered).
const ATTACK_ORDERS = new Set(['attack', 'attackMove', 'charge']);
const QUIET_ORDERS = new Set(['rally', 'power', 'callReserve', 'retreatAll']); // no unit answers these

/** The class most of these squads share (ties: the first met). null when none. */
export const dominantClass = (ids, squads) => {
  const count = new Map();
  (ids || []).forEach((i) => {
    const q = squads?.[i];
    if (!q) return;
    const c = String(q.unitId || '').startsWith('gen_') ? 'cavalry' : q.classId;
    if (c) count.set(c, (count.get(c) || 0) + 1);
  });
  let best = null; let n = 0;
  count.forEach((v, k) => { if (v > n) { best = k; n = v; } });
  return best;
};

/** The bark for a batch of orders the player just sent: { classId, kind } or null. */
export const voiceForOrders = (orders, squads) => {
  const withSquads = (orders || []).filter((o) => o && !QUIET_ORDERS.has(o.type) && o.squads?.length);
  if (!withSquads.length) return null;
  const attack = withSquads.find((o) => ATTACK_ORDERS.has(o.type));
  const lead = attack || withSquads[0];
  const classId = dominantClass(lead.squads, squads);
  if (!classId) return null;
  return { classId, kind: attack ? 'attack' : 'order' };
};

/** The bark when the selection changes to `ids` (from `before`): { classId, kind: 'select' } or null. */
export const voiceForSelection = (ids, before, squads) => {
  if (!ids?.length) return null;
  const prev = new Set(before || []);
  if (ids.length === prev.size && ids.every((i) => prev.has(i))) return null; // the same group again
  const classId = dominantClass(ids, squads);
  return classId ? { classId, kind: 'select' } : null;
};
