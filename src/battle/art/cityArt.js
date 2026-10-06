// src/battle/art/cityArt.js
// The city destruction kits (plans/ART-MODELS-PLAN.md 6; S6, S7), the same rules for the battle
// (battle/render/cityLayer.js) and the close view of the map (closeView/townDamage.js):
//   <age>[-<theme>]-houses-damage.glb  `<house>-damaged` and `<house>-ruined` for every house type
//       of the theme's town kit (house-poor, house-common, house-rich ...). The town layout
//       (data/townLayouts.json) keeps only each house's ground (x, z, w, d), so a house takes the
//       type whose ground is nearest its own (turned a quarter when that fits better), fitted to it.
//   ruins-<age>.glb  rubble-s (8 m), rubble-m (14 m), rubble-l (24 m), beams, scorch: a ruined
//       structure without a house kit gets the rubble nearest its size.
//   walls-<age>.glb  wall-straight (10 m along model x, the outer face to +Z), wall-corner, tower,
//       gate-open, gate-closed, each with -damaged and -breached.
import { Vector3 } from 'three';
import { kitObject } from './kitLoader';

const SIZE = new Vector3();
const sizeOf = (obj) => obj.box.getSize(SIZE);

/** The house types a damage kit holds: [{ base, w, d }] (the ground of `<base>-damaged`, or `-ruined`). */
export const houseTypes = (kit) => {
  if (!kit) return [];
  const bases = new Set(Object.keys(kit.objects).map((n) => n.match(/^(.+)-(damaged|ruined)$/)?.[1]).filter(Boolean));
  return [...bases].sort().map((base) => {
    const o = kit.objects[`${base}-damaged`] || kit.objects[`${base}-ruined`] || kit.objects[base];
    const s = sizeOf(o);
    return { base, w: Math.max(0.01, s.x), d: Math.max(0.01, s.z) };
  });
};

/**
 * The kit piece for one house of the town layout (model units, ground w by d) in `state`
 * ('damaged' or 'ruined'): { obj, yaw, sx, sz } fitted to the house's ground, or null.
 */
export const pickHouse = (kit, w, d, state, types = houseTypes(kit)) => {
  let best = null; let bestErr = Infinity;
  types.forEach((t) => {
    [[t.w, t.d, 0], [t.d, t.w, Math.PI / 2]].forEach(([tw, td, yaw]) => {
      const err = Math.abs(Math.log(w / tw)) + Math.abs(Math.log(d / td));
      if (err < bestErr) { bestErr = err; best = { t, yaw, tw, td }; }
    });
  });
  if (!best) return null;
  const obj = kitObject(kit, `${best.t.base}-${state}`);
  if (!obj) return null;
  // fitted to the ground (never stretched past a third either way: a wrong type stays readable)
  const clamp = (v) => Math.max(0.75, Math.min(1.33, v));
  const sx = clamp(w / best.tw); const sz = clamp(d / best.td);
  // lx, lz: the scales along the object's own x and z (a quarter turn swaps them)
  return { obj, yaw: best.yaw, sx, sz, lx: best.yaw ? sz : sx, lz: best.yaw ? sx : sz, base: best.t.base };
};

/** The rubble for a ruined structure of this ground (model units): rubble-s/-m/-l by size. */
export const RUBBLE = [['rubble-s', 0.8], ['rubble-m', 1.4], ['rubble-l', 2.4]];
export const pickRubble = (kit, footprint) => {
  if (!kit) return null;
  const order = [...RUBBLE].sort((a, b) => Math.abs(Math.log(footprint / a[1])) - Math.abs(Math.log(footprint / b[1])));
  const obj = kitObject(kit, order.map((r) => r[0]));
  if (!obj) return null;
  const s = sizeOf(obj);
  return { obj, scale: Math.max(0.5, Math.min(2, footprint / Math.max(0.05, Math.max(s.x, s.z)))) };
};

/** The wall kit piece for a ring structure ('wall', 'gate', 'tower') in its state (0 whole, 1 damaged, 2 destroyed). */
export const wallPiece = (kit, kind, state, gateOpen = true) => {
  const base = kind === 'gate' ? (gateOpen ? 'gate-open' : 'gate-closed') : kind === 'tower' ? 'tower' : 'wall-straight';
  const names = state === 2 ? [`${base}-breached`, `${base}-damaged`] : state === 1 ? [`${base}-damaged`, base] : [base];
  return kitObject(kit, names);
};
/** The model length of a wall piece along its run (model x). */
export const pieceLength = (obj) => Math.max(0.05, sizeOf(obj).x);
