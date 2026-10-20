// src/battle/sim/orderSchema.js
// The one schema of a player's battle orders (playtest audit CB01, plan W01). The live battle loop
// (worker/battleLoop.js pushOrders) admits an order through `admitOrder` before it is logged and
// applied, and the verified replay (replay.js) admits every logged order through the SAME function.
// So the replay runs exactly the orders the live battle ran: nothing the live battle accepts can be
// dropped or reshaped by the verifier (the Kerma bug: deploy and every economy order were missing
// from the replay's own list, and an attack on an economy building lost its target).
//
// Rules of admission:
//   - only the types in ORDER_SCHEMA, each with only its own fields (anything else is left out);
//   - the order is forced onto the given side (a client cannot command the other side);
//   - squad lists keep their whole non-negative indexes (the sim ignores squads that are not the
//     side's own), at most MAX_SQUADS_PER_ORDER;
//   - a required field that is missing or of the wrong kind, a number that is not finite, an
//     unknown building or unit, or a target of a kind the order does not take: the order is refused;
//   - admission is idempotent: admitting an admitted order returns an equal order.
// What an admitted order may DO is still decided by the sim (orders.js, economy.js): ownership,
// affordability, placement, timing. The tactical AI's own orders never pass through here.
//
// Adding an order to the sim: add its row here in the same change (orderSchema.test.js fails when
// applyOrder or applyEcoOrder handles a type this file does not know).
import { BUILDINGS, UNITS } from '../data/economy';
import { POWERS } from './effects';

export const MAX_LOG_ORDERS = 20000;
// One order may move a whole army: the largest preset is 1,000 squads a side (MASTER-PLAN 6.2).
// (It was 64: a box-selected 300-squad order then replayed as a 64-squad one, a false desync.)
export const MAX_SQUADS_PER_ORDER = 1024;
const MAX_ID_LENGTH = 32;
const MAX_FORMATION_LENGTH = 16;

const SQUAD_TARGETS = ['squad', 'structure', 'eco']; // what an army may attack
const WORK_TARGETS = ['eco', 'structure']; // what a worker may build on or mend

// Field kinds: 'squads' (list of squad indexes), 'num' (finite number, kept exactly as recorded:
// the live battle used it as-is), 'int' (integer), 'index' (integer >= 0), 'id' (short string),
// 'formation', 'building' / 'unit' (a key of the economy catalog), 'power' (a key of POWERS), 'count' (1 to 5).
// `req` fields must be there; `opt` fields may be absent (or null) but must be valid when present.
const group = { req: { squads: 'squads', x: 'num', y: 'num' }, opt: { formation: 'formation' } };
const squadsOnly = { req: { squads: 'squads' } };
const workOn = { req: { squads: 'squads' }, target: WORK_TARGETS };
export const ORDER_SCHEMA = {
  // the army (orders.js applyOrder)
  move: group,
  attackMove: group,
  deploy: group, // before the first tick only (the deployment phase)
  formationLine: { req: { squads: 'squads', x: 'num', y: 'num', x2: 'num', y2: 'num' } },
  attack: { req: { squads: 'squads' }, target: SQUAD_TARGETS },
  stop: squadsOnly,
  hold: squadsOnly,
  retreat: squadsOnly,
  retreatAll: {},
  callReserve: squadsOnly,
  ability: { req: { squads: 'squads', ability: 'id' } },
  power: { req: { power: 'power' }, opt: { x: 'num', y: 'num' } },
  garrison: { req: { squads: 'squads', structure: 'index' } },
  // the battle economy (economy.js applyEcoOrder)
  gather: { req: { squads: 'squads', node: 'index' } },
  build: { req: { squads: 'squads', building: 'building', tx: 'int', ty: 'int' } },
  assist: workOn,
  repair: workOn,
  train: { req: { building: 'index', role: 'unit' }, opt: { count: 'count' } },
  cancelTrain: { req: { building: 'index' }, opt: { slot: 'int' } },
  rally: { req: { building: 'index' }, opt: { x: 'num', y: 'num' }, together: ['x', 'y'] }, // no point = clear the rally
  cancelBuild: { req: { building: 'index' } }
};
export const ORDER_TYPES = Object.keys(ORDER_SCHEMA);

const REFUSED = Symbol('refused');
const READ = {
  squads: (v) => (Array.isArray(v) ? v.filter((i) => Number.isInteger(i) && i >= 0).slice(0, MAX_SQUADS_PER_ORDER) : REFUSED),
  num: (v) => (Number.isFinite(v) ? v : REFUSED),
  int: (v) => (Number.isInteger(v) ? v : REFUSED),
  index: (v) => (Number.isInteger(v) && v >= 0 ? v : REFUSED),
  id: (v) => (typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH ? v : REFUSED),
  formation: (v) => (typeof v === 'string' && v.length <= MAX_FORMATION_LENGTH ? v : REFUSED),
  building: (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(BUILDINGS, v) ? v : REFUSED),
  unit: (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(UNITS, v) ? v : REFUSED),
  power: (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(POWERS, v) ? v : REFUSED),
  count: (v) => (Number.isInteger(v) ? Math.max(1, Math.min(5, v)) : REFUSED)
};

/**
 * The order as the battle may run it, on `side`, or null when it is refused. Only the order's own
 * fields are returned (no tick, no seq: the battle loop stamps those, the replay checks them).
 */
export const admitOrder = (o, side) => {
  if (!o || typeof o !== 'object' || typeof o.type !== 'string' || !Object.prototype.hasOwnProperty.call(ORDER_SCHEMA, o.type)) return null;
  const spec = ORDER_SCHEMA[o.type];
  const out = { type: o.type, side };
  for (const [key, kind] of Object.entries(spec.req || {})) {
    // An order with no squad list is a legal order for nobody (the live sim reads it as empty).
    const v = kind === 'squads' && o[key] == null ? [] : READ[kind](o[key]);
    if (v === REFUSED) return null;
    out[key] = v;
  }
  for (const [key, kind] of Object.entries(spec.opt || {})) {
    if (o[key] == null) continue;
    const v = READ[kind](o[key]);
    if (v === REFUSED) return null;
    out[key] = v;
  }
  if (spec.together && spec.together.some((k) => k in out) && !spec.together.every((k) => k in out)) return null;
  if (spec.target) {
    const t = o.target;
    if (!t || typeof t !== 'object' || !spec.target.includes(t.kind) || !Number.isInteger(t.index) || t.index < 0) return null;
    out.target = { kind: t.kind, index: t.index };
  }
  return out;
};
