// src/battle/render/packedView.js
// Packed render frames from the sim worker to the screen (RTS plan 13.3, phase C2). At 300 squads a
// side the plain view (view.js makeRenderView: 600 nested objects) cost about 0.5 ms to build and
// 2.3 ms to structured-clone every tick, much of it on the main thread. A packed frame instead puts
// every squad's per-tick state into one Float64Array that is TRANSFERRED (moved, not copied), and
// sends the fields that hardly change (names, class, age, xp, promotions, abilities, call cost)
// only every few ticks. The screen decodes it into a view of exactly the same shape as
// makeRenderView's, whose squads read straight from the array (getters), so the renderer, HUD,
// picking and audio need no change. A buffer is never reused after it is sent: a view (and the
// HUD's copy of one) may live for many frames, and a fresh 50 KB buffer costs nothing to make.
import { canSeeSquad } from '../sim/fog';
import { POWERS, powerState, getSquadAbilities } from '../sim/effects';
import { callCost } from '../sim/orders';
import { garrisonOf, garrisonRoom, GARRISON_SLOTS } from '../sim/objectives';

// One squad's per-tick record. Nullable numbers travel as NaN.
const FIELDS = ['x', 'y', 'facing', 'strength', 'morale', 'flags', 'enterTick', 'inside', 'order', 'orderX', 'orderY', 'target', 'targetKind'];
export const SQUAD_STRIDE = FIELDS.length;
const F = Object.fromEntries(FIELDS.map((k, i) => [k, i]));
const FLAGS = ['alive', 'onField', 'fled', 'routed', 'retreating', 'reserve', 'visible', 'hidden', 'striking'];
// Fields that change rarely, sent with the slow part (checked every SLOW_EVERY ticks and when
// paused, and only for the squads where something changed).
const SLOW = ['unitId', 'classId', 'ageId', 'navalLine', 'maxStrength', 'startStrength', 'reinforcement', 'callCost', 'xp', 'promotions', 'commanderId', 'abilities'];
export const SLOW_EVERY = 5;

const num = (v) => (v === null || v === undefined ? NaN : v);
const orNull = (v) => (Number.isNaN(v) ? null : v);

// The worker's half. `strings` interns order types and target kinds (sent when the table grows).
export const createViewPacker = () => {
  const strings = []; const ids = new Map();
  let sentStrings = 0;
  const slowKeys = []; // what each squad's slow part was last sent as
  const intern = (s) => {
    if (s === null || s === undefined) return NaN;
    let id = ids.get(s);
    if (id === undefined) { id = strings.length; strings.push(s); ids.set(s, id); }
    return id;
  };
  // → { packed, transfer }: `packed` goes in the message, `transfer` in postMessage's transfer list.
  const pack = (w, pendingOrders = [], playerSide = 0, { fog = true, slow = true } = {}) => {
    const n = w.squads.length;
    const f = new Float64Array(n * SQUAD_STRIDE);
    for (let i = 0; i < n; i++) {
      const q = w.squads[i]; const o = i * SQUAD_STRIDE;
      const striking = w.tick - (q.lastStrikeTick ?? -10000) <= q.stats.attackTicks + 4;
      const flagValues = [q.alive, q.onField, q.fled, q.routed, q.retreating, q.reserve, canSeeSquad(w, playerSide, q), (q.hiddenUntil || -1) > w.tick, striking];
      let bits = 0; flagValues.forEach((b, k) => { if (b) bits |= 1 << k; });
      f[o + F.x] = q.x; f[o + F.y] = q.y; f[o + F.facing] = q.facing; f[o + F.strength] = q.strength; f[o + F.morale] = q.morale;
      f[o + F.flags] = bits; f[o + F.enterTick] = num(q.enterTick); f[o + F.inside] = q.inside ?? -1;
      f[o + F.order] = intern(q.order.type); f[o + F.orderX] = num(q.order.x); f[o + F.orderY] = num(q.order.y);
      f[o + F.target] = num(q.target); f[o + F.targetKind] = intern(q.targetKind);
    }
    const packed = {
      tick: w.tick, playerSide, n,
      supply: [...w.supply], assimilation: w.assimilation, battleType: w.setup.battleType || 'field', beachhead: w.beachhead || 0,
      ended: w.ended, pendingOrders: pendingOrders.length,
      fog: fog && w.fog ? w.fog[playerSide].slice() : null,
      powers: (w.setup.powers?.[playerSide] || []).map((p) => {
        const st = powerState(w, playerSide, p.id);
        return { id: p.id, label: POWERS[p.id]?.label || p.id, cost: st.cost, usesLeft: st.usesLeft, readyIn: Math.max(0, st.readyAt - w.tick), targeted: !!POWERS[p.id]?.impacts };
      }),
      structures: w.structures.map((s, si) => ({
        id: s.id, kind: s.kind, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, alive: s.alive, radius: s.radius,
        garrison: playerSide === 1 ? garrisonOf(w, si).length : 0,
        garrisonSlots: playerSide === 1 && garrisonRoom(w, si) + garrisonOf(w, si).length > 0 ? GARRISON_SLOTS[s.kind] || 0 : 0
      })),
      points: w.points.map((p) => ({ id: p.id, resId: p.resId, x: p.x, y: p.y, owner: p.owner, progress: p.progress, capturingSide: p.capturingSide })),
      squads: f.buffer,
      slow: slow ? w.squads.map((q, i) => ({ i, side: q.side,
        unitId: q.unitId, classId: q.classId, ageId: q.ageId, navalLine: q.original?.navalLine || null,
        maxStrength: q.maxStrength, startStrength: q.startStrength,
        reinforcement: q.reinforcement ? { name: q.reinforcement.name, edge: q.reinforcement.edge } : null,
        callCost: callCost(q, w), xp: q.original.xp || 0, promotions: q.promotions, commanderId: q.commanderId,
        abilities: q.side === playerSide ? getSquadAbilities(w, q).map((id) => ({ id, readyIn: Math.max(0, (q.cooldowns?.[id] || 0) - w.tick) })) : []
      })).filter((m) => {
        // Only the squads whose slow part changed since it was last sent (most never do).
        const key = JSON.stringify(m);
        if (slowKeys[m.i] === key) return false;
        slowKeys[m.i] = key;
        return true;
      }) : null,
      strings: strings.length > sentStrings ? strings.slice() : null
    };
    sentStrings = strings.length;
    return { packed, transfer: [f.buffer] };
  };
  return { pack };
};

// A squad of a decoded view: every field reads from the frame's array (or the latest slow part).
class PackedSquad {
  constructor(frame, idx) { this.frame = frame; this.idx = idx; }
  get side() { return this.frame.slow[this.idx].side; }
}
FIELDS.forEach((k, i) => {
  if (k === 'flags') return;
  const nullable = k === 'enterTick' || k === 'orderX' || k === 'orderY' || k === 'target';
  if (k === 'order' || k === 'targetKind') {
    Object.defineProperty(PackedSquad.prototype, k, { get() { const v = this.frame.f[this.idx * SQUAD_STRIDE + i]; return Number.isNaN(v) ? null : this.frame.strings[v]; } });
  } else {
    Object.defineProperty(PackedSquad.prototype, k, { get: nullable ? function get() { return orNull(this.frame.f[this.idx * SQUAD_STRIDE + i]); } : function get() { return this.frame.f[this.idx * SQUAD_STRIDE + i]; } });
  }
});
FLAGS.forEach((k, bit) => {
  Object.defineProperty(PackedSquad.prototype, k, { get() { return (this.frame.f[this.idx * SQUAD_STRIDE + F.flags] & (1 << bit)) !== 0; } });
});
SLOW.forEach((k) => { Object.defineProperty(PackedSquad.prototype, k, { get() { return this.frame.slow[this.idx][k]; } }); });
// The plain object makeRenderView would have built (tests, debugging, anything that copies).
PackedSquad.prototype.toJSON = function toJSON() {
  const o = { idx: this.idx, side: this.side };
  [...FIELDS.filter((k) => k !== 'flags'), ...FLAGS, ...SLOW].forEach((k) => { o[k] = this[k]; });
  return o;
};

// The screen's half: keeps the string table and the latest slow part between frames.
export const createViewDecoder = () => {
  let strings = []; const slow = [];
  return (packed) => {
    if (packed.strings) strings = packed.strings;
    // The slow part comes as the squads that changed; earlier views see the update too (these
    // fields are names, xp, abilities and costs, which the HUD wants current anyway).
    if (packed.slow) packed.slow.forEach((m) => { slow[m.i] = m; });
    const frame = { f: new Float64Array(packed.squads), strings, slow };
    const squads = new Array(packed.n);
    for (let i = 0; i < packed.n; i++) squads[i] = new PackedSquad(frame, i);
    const { n, squads: _buf, slow: _slow, strings: _str, ...rest } = packed; // eslint-disable-line no-unused-vars
    return { ...rest, squads };
  };
};
