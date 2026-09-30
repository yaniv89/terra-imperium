// src/battle/render/soldierFactory.js
// Real 3D troops for the battlefield (replaces the old extruded-icon tokens). Every unit type of
// every age is modelled procedurally from simple solids — no art files to download — as ONE
// merged geometry per (age, class), carrying three extra per-vertex attributes:
//   color  — the part's own material colour (skin, leather, steel, wood, horse coat…)
//   aTeam  — 1 on the parts that wear the side's colour (tunic, shield face, banner), 0 elsewhere
//   aLimb  — which rig bone the vertex belongs to (0 body, 1/2 legs, 3/4 arms, 5/6 horse legs,
//            7 turret) and aPivot — that bone's hinge (y, z)
//   aPart  — 0 plain, 1 skin (takes the instance's skin tone), 2 emblem (shield faces / tabards,
//            which print the squad's heraldic device from the emblem atlas at aUv)
// createSoldierMaterial() animates those bones in the vertex shader (walk cycle, weapon strikes,
// galloping horses, turning turrets) from one per-instance vec3 (phase, moving, attacking), so a
// thousand animated soldiers cost a handful of draw calls — fine on a phone.
// Models face +Z, stand on y = 0, and a person is about 1 unit tall.
// Any (age, class) can instead use an artist's low-poly GLB (gltfUnitLoader.js → unitModels.js →
// registerSoldierGeometry): it arrives baked into exactly these attributes, so the same material,
// rig and instancing drive it. Each model also has a ~50-triangle imposter for far zoom levels.
import {
  BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, Float32BufferAttribute,
  Matrix4, Euler, Quaternion, Vector3, Color, MeshLambertMaterial, MeshStandardMaterial, MeshDepthMaterial, RGBADepthPacking
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_UNIFORM, SKIN_TONES, EMBLEM_GRID, EMBLEM_INSET, getEmblemAtlas } from './unitVariants';

export const LIMB = { BODY: 0, LEG_L: 1, LEG_R: 2, ARM_L: 3, ARM_R: 4, HORSE_FRONT: 5, HORSE_BACK: 6, TURRET: 7 };
export const PART = { PLAIN: 0, SKIN: 1, EMBLEM: 2 };
// Every soldier geometry carries exactly these attributes (merging needs them to match).
export const RIG_ATTRIBUTES = { color: 3, aLimb: 1, aPivot: 2, aTeam: 1, aPart: 1, aUv: 2 };

const C = {
  skin: ['#e0ac82', '#c68b5f', '#8d5a3b', '#f0c9a4'],
  leather: '#6b4a2e', darkLeather: '#3f2a1a', steel: '#b8bec6', darkSteel: '#6e757d', bronze: '#b98b3e',
  wood: '#8a6238', darkWood: '#5c3f23', cloth: '#d9d0bc', olive: '#56613e', darkOlive: '#3b4430',
  black: '#26241f', horse: '#6d4a31', horseDark: '#3d2a1c', rope: '#b59a6a', gold: '#d9b44a', rubber: '#1f2226'
};

const tmpM = new Matrix4(); const tmpQ = new Quaternion(); const tmpE = new Euler();

// One solid, transformed and tagged. `at` = [x, y, z], `rot` = [rx, ry, rz], `scale` = [sx, sy, sz].
// `skin` parts take the soldier's skin tone; `emblem` parts (always team-coloured) print the
// squad's device, mapped by the solid's own UVs.
const part = (geo, color, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], limb = LIMB.BODY, pivot = [0, 0], team = 0, skin = false, emblem = false } = {}) => {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  tmpE.set(rot[0], rot[1], rot[2]);
  tmpM.compose(new Vector3(...at), tmpQ.setFromEuler(tmpE), new Vector3(...scale));
  g.applyMatrix4(tmpM);
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2);
  if (emblem && g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2));
  g.deleteAttribute('uv');
  const c = new Color(color);
  const col = new Float32Array(n * 3); const lim = new Float32Array(n); const piv = new Float32Array(n * 2); const tm = new Float32Array(n); const pt = new Float32Array(n);
  const partId = emblem ? PART.EMBLEM : skin ? PART.SKIN : PART.PLAIN;
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    lim[i] = limb; piv[i * 2] = pivot[0]; piv[i * 2 + 1] = pivot[1]; tm[i] = emblem ? 1 : team; pt[i] = partId;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('aLimb', new Float32BufferAttribute(lim, 1));
  g.setAttribute('aPivot', new Float32BufferAttribute(piv, 2));
  g.setAttribute('aTeam', new Float32BufferAttribute(tm, 1));
  g.setAttribute('aPart', new Float32BufferAttribute(pt, 1));
  g.setAttribute('aUv', new Float32BufferAttribute(uv, 2));
  return g;
};
// Moves already-built parts (and their bones' hinges) — e.g. horses harnessed ahead of a chariot.
const shift = (parts, dx, dy, dz) => parts.map((g) => {
  g.translate(dx, dy, dz);
  const piv = g.attributes.aPivot;
  for (let i = 0; i < piv.count; i++) piv.setXY(i, piv.getX(i) + dy, piv.getY(i) + dz);
  return g;
});
const box = (w, h, d) => new BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 7) => new CylinderGeometry(rt, rb, h, seg);
const ball = (r, w = 7, h = 5) => new SphereGeometry(r, w, h);
const cone = (r, h, seg = 7) => new ConeGeometry(r, h, seg);

// ---- people ----------------------------------------------------------------------------------

const HIP = 0.48; const SHOULDER = 0.8;
const LEG = { limb: LIMB.LEG_L, pivot: [HIP, 0] };
const ARM_L = { limb: LIMB.ARM_L, pivot: [SHOULDER, 0] };
const ARM_R = { limb: LIMB.ARM_R, pivot: [SHOULDER, 0] };

const HELMETS = {
  bronze: (y) => [part(cone(0.12, 0.2), C.bronze, { at: [0, y + 0.1, 0] })],
  classical: (y) => [part(ball(0.12, 7, 4), C.bronze, { at: [0, y + 0.02, 0], scale: [1, 0.85, 1] }), part(box(0.035, 0.1, 0.24), '#b3261e', { at: [0, y + 0.11, -0.01] })],
  kingdoms: (y) => [part(cyl(0.115, 0.12, 0.17), C.steel, { at: [0, y + 0.03, 0] }), part(box(0.18, 0.025, 0.02), C.black, { at: [0, y + 0.02, 0.115] })],
  gunpowder: (y) => [part(cyl(0.1, 0.11, 0.2), C.black, { at: [0, y + 0.1, 0] }), part(cyl(0.13, 0.13, 0.02, 8), C.black, { at: [0, y + 0.0, 0.02] }), part(ball(0.025, 4, 3), C.gold, { at: [0, y + 0.13, 0.1] })],
  modern: (y) => [part(ball(0.13, 8, 5), C.darkOlive, { at: [0, y + 0.02, 0], scale: [1, 0.72, 1.05] })]
};
const BODY_CLOTH = { bronze: C.cloth, classical: C.leather, kingdoms: C.darkSteel, gunpowder: C.cloth, modern: C.olive };
const LEG_CLOTH = { bronze: C.leather, classical: C.leather, kingdoms: C.darkSteel, gunpowder: C.cloth, modern: C.olive };

// A standing person: legs (two bones), torso in team colour, belt, head, age helmet, two arm bones.
// `skin` picks one of four skin tones; `seat` lifts the whole figure (riders) and drops the legs.
const person = (ageId, { skin = 0, seat = 0, legs = true } = {}) => {
  const y0 = seat;
  const parts = [];
  if (legs) {
    [-1, 1].forEach((s) => {
      const bone = { ...LEG, limb: s < 0 ? LIMB.LEG_L : LIMB.LEG_R, pivot: [HIP + y0, 0] };
      parts.push(part(box(0.11, 0.42, 0.13), LEG_CLOTH[ageId], { at: [s * 0.075, 0.27 + y0, 0], ...bone }));
      parts.push(part(box(0.12, 0.07, 0.17), C.darkLeather, { at: [s * 0.075, 0.035 + y0, 0.02], ...bone }));
    });
  } else {
    [-1, 1].forEach((s) => parts.push(part(box(0.11, 0.3, 0.13), LEG_CLOTH[ageId], { at: [s * 0.13, y0 + 0.4, 0.08], rot: [-1.3, 0, s * 0.3] })));
  }
  parts.push(part(box(0.3, 0.36, 0.19), BODY_CLOTH[ageId], { at: [0, 0.64 + y0, 0], scale: [1, 1, 1] }));
  // Tabard/tunic front in the side's colour.
  parts.push(part(box(0.26, 0.3, 0.02), '#ffffff', { at: [0, 0.63 + y0, 0.1], team: 1, emblem: true }));
  parts.push(part(box(0.31, 0.05, 0.2), C.darkLeather, { at: [0, 0.5 + y0, 0] }));
  parts.push(part(ball(0.1, 7, 5), C.skin[skin % 4], { at: [0, 0.9 + y0, 0.01], skin: true }));
  parts.push(...HELMETS[ageId](0.92 + y0));
  [-1, 1].forEach((s) => {
    const bone = s < 0 ? { ...ARM_L, pivot: [SHOULDER + y0, 0] } : { ...ARM_R, pivot: [SHOULDER + y0, 0] };
    parts.push(part(box(0.085, 0.3, 0.09), BODY_CLOTH[ageId], { at: [s * 0.2, 0.66 + y0, 0], ...bone }));
    parts.push(part(ball(0.045, 5, 4), C.skin[skin % 4], { at: [s * 0.2, 0.49 + y0, 0.01], skin: true, ...bone }));
  });
  return parts;
};

// Weapons held in the right hand (bone ARM_R) or on the left arm (ARM_L), in person-space.
const rightHand = (y0 = 0) => ({ ...ARM_R, pivot: [SHOULDER + y0, 0] });
const leftHand = (y0 = 0) => ({ ...ARM_L, pivot: [SHOULDER + y0, 0] });
const spear = (len, y0 = 0, tip = C.bronze) => [
  part(cyl(0.017, 0.017, len, 5), C.wood, { at: [0.2, 0.5 + y0, 0.08], rot: [0.15, 0, 0], ...rightHand(y0) }),
  part(cone(0.035, 0.13, 5), tip, { at: [0.2, 0.5 + y0 + len / 2 + 0.05, 0.08 + len * 0.075], rot: [0.15, 0, 0], ...rightHand(y0) })
];
const sword = (y0 = 0) => [
  part(box(0.03, 0.46, 0.015), C.steel, { at: [0.2, 0.62 + y0, 0.2], rot: [1.0, 0, 0], ...rightHand(y0) }),
  part(box(0.12, 0.025, 0.03), C.gold, { at: [0.2, 0.5 + y0, 0.09], rot: [1.0, 0, 0], ...rightHand(y0) })
];
const roundShield = (y0 = 0) => [part(cyl(0.17, 0.17, 0.03, 10), '#ffffff', { at: [-0.25, 0.6 + y0, 0.08], rot: [Math.PI / 2, 0, 0], emblem: true, ...leftHand(y0) }),
  part(ball(0.035, 5, 4), C.bronze, { at: [-0.25, 0.6 + y0, 0.1], ...leftHand(y0) })];
const towerShield = (y0 = 0) => [part(box(0.28, 0.46, 0.03), '#ffffff', { at: [-0.25, 0.6 + y0, 0.1], emblem: true, ...leftHand(y0) }),
  part(box(0.06, 0.06, 0.035), C.bronze, { at: [-0.25, 0.6 + y0, 0.12], ...leftHand(y0) })];
const kiteShield = (y0 = 0) => [part(box(0.24, 0.36, 0.03), '#ffffff', { at: [-0.25, 0.62 + y0, 0.1], emblem: true, ...leftHand(y0) }),
  part(cone(0.12, 0.16, 4), '#ffffff', { at: [-0.25, 0.37 + y0, 0.1], rot: [Math.PI, Math.PI / 4, 0], scale: [1, 1, 0.2], team: 1, ...leftHand(y0) })];
const longGun = (y0 = 0, color = C.darkWood) => [
  part(box(0.04, 0.05, 0.62), color, { at: [0.12, 0.62 + y0, 0.16], rot: [-0.25, 0.25, 0], ...rightHand(y0) }),
  part(cyl(0.012, 0.012, 0.34, 5), C.darkSteel, { at: [0.08, 0.7 + y0, 0.44], rot: [Math.PI / 2 - 0.25, 0, 0], ...rightHand(y0) })
];
const rifle = (y0 = 0) => [part(box(0.045, 0.06, 0.5), C.black, { at: [0.12, 0.66 + y0, 0.18], rot: [-0.1, 0.2, 0], ...rightHand(y0) }),
  part(box(0.03, 0.08, 0.05), C.black, { at: [0.12, 0.6 + y0, 0.2], ...rightHand(y0) })];
const bow = (y0 = 0) => [
  part(new TorusGeometry(0.28, 0.014, 4, 10, Math.PI * 0.9), C.darkWood, { at: [-0.24, 0.68 + y0, 0.2], rot: [0, Math.PI / 2, Math.PI / 2 - Math.PI * 0.45], ...leftHand(y0) }),
  part(box(0.004, 0.5, 0.004), C.cloth, { at: [-0.24, 0.68 + y0, 0.2], ...leftHand(y0) }),
  part(cyl(0.05, 0.04, 0.34, 6), C.leather, { at: [0.08, 0.72 + y0, -0.14], rot: [0.3, 0, 0.2] }) // quiver
];
const launcher = (y0 = 0) => [part(cyl(0.055, 0.055, 0.8, 7), C.darkOlive, { at: [0.12, 0.92 + y0, 0.05], rot: [Math.PI / 2, 0, 0] })];
const shovel = (y0 = 0) => [part(cyl(0.015, 0.015, 0.7, 5), C.wood, { at: [0.2, 0.55 + y0, 0.06], rot: [0.2, 0, 0], ...rightHand(y0) }),
  part(box(0.12, 0.14, 0.02), C.darkSteel, { at: [0.2, 0.2 + y0, 0.0], ...rightHand(y0) })];
const pack = (color = C.leather) => [part(box(0.22, 0.26, 0.12), color, { at: [0, 0.66, -0.15] })];

// ---- horses and vehicles ---------------------------------------------------------------------

const horse = (coat = C.horse, barding = false) => {
  const parts = [
    part(box(0.34, 0.36, 0.95), coat, { at: [0, 0.78, 0] }),
    part(box(0.2, 0.42, 0.24), coat, { at: [0, 1.02, 0.52], rot: [0.55, 0, 0] }),
    part(box(0.16, 0.18, 0.36), coat, { at: [0, 1.2, 0.72], rot: [0.2, 0, 0] }),
    part(box(0.05, 0.3, 0.08), C.horseDark, { at: [0, 1.12, 0.36], rot: [0.55, 0, 0] }), // mane
    part(box(0.07, 0.34, 0.07), C.horseDark, { at: [0, 0.74, -0.52], rot: [-0.5, 0, 0] }) // tail
  ];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    // Diagonal pairs move together (a trot): front-left with back-right, front-right with back-left.
    const bone = { limb: sx * sz > 0 ? LIMB.HORSE_FRONT : LIMB.HORSE_BACK, pivot: [0.66, sz * 0.36] };
    parts.push(part(box(0.09, 0.62, 0.1), coat, { at: [sx * 0.12, 0.35, sz * 0.36], ...bone }));
    parts.push(part(box(0.1, 0.06, 0.12), C.black, { at: [sx * 0.12, 0.03, sz * 0.36], ...bone }));
  });
  if (barding) parts.push(part(box(0.38, 0.22, 0.8), '#ffffff', { at: [0, 0.74, 0], team: 1 }));
  parts.push(part(box(0.36, 0.06, 0.34), C.leather, { at: [0, 0.98, -0.02] })); // saddle
  return parts;
};
const wheel = (r, x, y, z, color = C.darkWood) => part(cyl(r, r, 0.06, 10), color, { at: [x, y, z], rot: [0, 0, Math.PI / 2] });
const tankModel = () => [
  part(box(0.9, 0.3, 1.5), C.olive, { at: [0, 0.3, 0] }),
  part(box(0.98, 0.2, 1.56), C.rubber, { at: [0, 0.12, 0] }),
  part(box(0.6, 0.24, 0.68), C.olive, { at: [0, 0.57, -0.08], limb: LIMB.TURRET }),
  part(cyl(0.05, 0.05, 1.1, 7), C.darkOlive, { at: [0, 0.6, 0.72], rot: [Math.PI / 2, 0, 0], limb: LIMB.TURRET }),
  part(box(0.3, 0.05, 0.3), '#ffffff', { at: [0, 0.7, -0.2], team: 1, limb: LIMB.TURRET })
];
const truck = (bodyColor = C.olive) => [
  part(box(0.7, 0.35, 1.3), bodyColor, { at: [0, 0.42, 0] }),
  part(box(0.66, 0.3, 0.4), bodyColor, { at: [0, 0.74, 0.42] }),
  part(box(0.6, 0.18, 0.02), '#9fc3d8', { at: [0, 0.8, 0.63] }),
  wheel(0.16, -0.38, 0.16, 0.4, C.rubber), wheel(0.16, 0.38, 0.16, 0.4, C.rubber), wheel(0.16, -0.38, 0.16, -0.4, C.rubber), wheel(0.16, 0.38, 0.16, -0.4, C.rubber),
  part(box(0.2, 0.04, 0.2), '#ffffff', { at: [0, 0.9, 0.42], team: 1 })
];

// ---- the roster, one model per (age, class) ----------------------------------------------------

const MODELS = {
  infantry: {
    bronze: () => [...person('bronze'), ...spear(1.35), ...roundShield()],
    classical: () => [...person('classical', { skin: 1 }), ...sword(), ...towerShield()],
    kingdoms: () => [...person('kingdoms', { skin: 3 }), ...spear(2.2, 0, C.steel)],
    gunpowder: () => [...person('gunpowder'), ...longGun(), ...pack()],
    modern: () => [...person('modern', { skin: 2 }), ...rifle(), ...pack(C.darkOlive)]
  },
  ranged: {
    bronze: () => [...person('bronze', { skin: 2 }), ...bow()],
    classical: () => [...person('classical'), ...bow()],
    kingdoms: () => [...person('kingdoms', { skin: 3 }), ...bow()],
    gunpowder: () => [...person('gunpowder', { skin: 1 }), ...longGun(0, C.wood)],
    modern: () => [...person('modern'), ...launcher(), ...pack(C.darkOlive)]
  },
  cavalry: {
    bronze: () => [ // a chariot: two horses, a wheeled car, a driver with a spear
      ...shift(horse(), -0.24, 0, 0.55), ...shift(horse(C.horseDark), 0.24, 0, 0.55),
      part(box(0.7, 0.34, 0.55), C.wood, { at: [0, 0.62, -0.35] }), part(box(0.72, 0.1, 0.02), '#ffffff', { at: [0, 0.75, -0.07], team: 1 }),
      wheel(0.3, -0.4, 0.3, -0.35), wheel(0.3, 0.4, 0.3, -0.35),
      ...shift(person('bronze', { seat: 0.45, legs: false }), 0, 0, -0.35), ...shift(spear(1.2, 0.45), 0, 0, -0.35)
    ],
    classical: () => [...horse(C.horse, false), ...person('classical', { seat: 0.62, legs: false }), ...spear(1.3, 0.62)],
    kingdoms: () => [...horse('#cfc7b8', true), ...person('kingdoms', { seat: 0.62, legs: false }), ...spear(1.9, 0.62, C.steel), ...kiteShield(0.62)],
    gunpowder: () => [...horse(C.horseDark), ...person('gunpowder', { seat: 0.62, legs: false }), ...longGun(0.62)],
    modern: tankModel
  },
  siege: {
    bronze: () => [ // battering ram under a roofed frame
      part(box(0.9, 0.08, 1.6), C.darkWood, { at: [0, 0.3, 0] }), wheel(0.2, -0.48, 0.2, 0.5), wheel(0.2, 0.48, 0.2, 0.5), wheel(0.2, -0.48, 0.2, -0.5), wheel(0.2, 0.48, 0.2, -0.5),
      part(cyl(0.11, 0.11, 1.9, 7), C.wood, { at: [0, 0.55, 0.2], rot: [Math.PI / 2, 0, 0] }), part(cone(0.13, 0.2, 7), C.bronze, { at: [0, 0.55, 1.2], rot: [Math.PI / 2, 0, 0] }),
      part(box(1.0, 0.06, 1.7), '#ffffff', { at: [0, 1.0, 0], rot: [0, 0, 0], team: 1 }),
      part(box(0.06, 0.7, 0.06), C.darkWood, { at: [-0.45, 0.65, 0.75] }), part(box(0.06, 0.7, 0.06), C.darkWood, { at: [0.45, 0.65, 0.75] }),
      part(box(0.06, 0.7, 0.06), C.darkWood, { at: [-0.45, 0.65, -0.75] }), part(box(0.06, 0.7, 0.06), C.darkWood, { at: [0.45, 0.65, -0.75] })
    ],
    classical: () => [ // ballista
      part(box(0.7, 0.1, 1.1), C.darkWood, { at: [0, 0.35, 0] }), wheel(0.22, -0.4, 0.22, -0.3), wheel(0.22, 0.4, 0.22, -0.3),
      part(box(0.12, 0.12, 1.2), C.wood, { at: [0, 0.6, 0.1], limb: LIMB.TURRET }),
      part(new TorusGeometry(0.5, 0.03, 4, 10, Math.PI * 0.8), C.darkWood, { at: [0, 0.6, 0.4], rot: [Math.PI / 2, 0, Math.PI * 0.1], limb: LIMB.TURRET }),
      part(box(0.3, 0.2, 0.02), '#ffffff', { at: [0, 0.45, -0.56], team: 1 })
    ],
    kingdoms: () => [ // trebuchet
      part(box(1.0, 0.12, 1.3), C.darkWood, { at: [0, 0.2, 0] }),
      part(box(0.1, 1.6, 0.1), C.wood, { at: [-0.4, 1.0, 0], rot: [0, 0, 0.12] }), part(box(0.1, 1.6, 0.1), C.wood, { at: [0.4, 1.0, 0], rot: [0, 0, -0.12] }),
      part(box(0.08, 0.08, 2.4), C.wood, { at: [0, 1.75, 0.2], rot: [0.55, 0, 0], limb: LIMB.ARM_R, pivot: [1.75, 0.2] }),
      part(box(0.4, 0.4, 0.4), C.darkWood, { at: [0, 1.25, -0.5], limb: LIMB.ARM_R, pivot: [1.75, 0.2] }),
      part(box(0.5, 0.3, 0.02), '#ffffff', { at: [0, 0.5, 0.66], team: 1 })
    ],
    gunpowder: () => [ // field cannon
      part(cyl(0.09, 0.13, 1.1, 8), C.bronze, { at: [0, 0.48, 0.2], rot: [Math.PI / 2 - 0.12, 0, 0], limb: LIMB.TURRET }),
      wheel(0.32, -0.3, 0.32, -0.05), wheel(0.32, 0.3, 0.32, -0.05),
      part(box(0.12, 0.1, 0.9), C.darkWood, { at: [0, 0.2, -0.45], rot: [0.25, 0, 0] }), part(box(0.25, 0.2, 0.02), '#ffffff', { at: [0, 0.32, -0.25], team: 1 })
    ],
    modern: () => [ // towed howitzer
      part(cyl(0.07, 0.09, 1.6, 8), C.darkOlive, { at: [0, 0.6, 0.45], rot: [Math.PI / 2 - 0.35, 0, 0], limb: LIMB.TURRET }),
      part(box(0.5, 0.3, 0.5), C.olive, { at: [0, 0.45, 0], limb: LIMB.TURRET }),
      wheel(0.24, -0.35, 0.24, 0, C.rubber), wheel(0.24, 0.35, 0.24, 0, C.rubber),
      part(box(0.08, 0.08, 1.0), C.olive, { at: [-0.2, 0.12, -0.6], rot: [0, 0.2, 0] }), part(box(0.08, 0.08, 1.0), C.olive, { at: [0.2, 0.12, -0.6], rot: [0, -0.2, 0] }),
      part(box(0.3, 0.2, 0.02), '#ffffff', { at: [0, 0.5, -0.26], team: 1 })
    ]
  },
  support: {
    bronze: () => [...shift(horse(C.horseDark), 0, 0, 0.7), part(box(0.7, 0.3, 0.9), C.wood, { at: [0, 0.55, -0.35] }), part(box(0.72, 0.3, 0.9), C.cloth, { at: [0, 0.85, -0.35] }), wheel(0.25, -0.4, 0.25, -0.35), wheel(0.25, 0.4, 0.25, -0.35), part(box(0.2, 0.2, 0.02), '#ffffff', { at: [0, 0.8, -0.81], team: 1 })],
    classical: () => [...person('classical'), ...shovel(), ...pack()],
    kingdoms: () => [...person('kingdoms', { skin: 3 }), ...shovel(), ...pack()],
    gunpowder: () => [...person('gunpowder', { skin: 1 }), ...shovel(), ...pack(C.cloth)],
    modern: () => [...truck(), part(cyl(0.03, 0.03, 0.7, 5), C.black, { at: [-0.1, 1.0, -0.2], rot: [Math.PI / 2 - 0.6, 0, 0], limb: LIMB.TURRET }), part(cyl(0.03, 0.03, 0.7, 5), C.black, { at: [0.1, 1.0, -0.2], rot: [Math.PI / 2 - 0.6, 0, 0], limb: LIMB.TURRET })]
  },
  air: {
    modern: () => [
      part(cyl(0.12, 0.18, 1.8, 8), '#8b939c', { at: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }),
      part(cone(0.12, 0.45, 8), '#6e757d', { at: [0, 0, 1.1], rot: [Math.PI / 2, 0, 0] }),
      part(box(1.5, 0.04, 0.55), '#8b939c', { at: [0, 0, -0.1] }), part(box(0.6, 0.03, 0.25), '#8b939c', { at: [0, 0, -0.8] }),
      part(box(0.03, 0.35, 0.3), '#ffffff', { at: [0, 0.18, -0.78], team: 1 }), part(ball(0.1, 6, 4), '#2b3a4a', { at: [0, 0.12, 0.45], scale: [1, 0.7, 2] })
    ]
  }
};

const cache = new Map();
// Artist models (GLB, via registerSoldierGeometry) take precedence over the procedural ones.
const overrides = new Map();

export const getProceduralSoldierGeometry = (ageId, classId) => {
  const key = `${ageId}:${classId}`;
  if (cache.has(key)) return cache.get(key);
  const byAge = MODELS[classId] || MODELS.infantry;
  const build = byAge[ageId] || byAge.modern || byAge.gunpowder || Object.values(byAge)[0];
  const geo = mergeGeometries(build());
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  cache.set(key, geo);
  return geo;
};
export const getSoldierGeometry = (ageId, classId) => overrides.get(`${ageId}:${classId}`) || overrides.get(`*:${classId}`) || getProceduralSoldierGeometry(ageId, classId);
export const hasSoldierOverride = (ageId, classId) => overrides.has(`${ageId}:${classId}`) || overrides.has(`*:${classId}`);

// Fill in any rig attribute a geometry lacks (a plain GLB mesh has none) with neutral defaults.
export const ensureRigAttributes = (geo) => {
  const n = geo.attributes.position.count;
  Object.entries(RIG_ATTRIBUTES).forEach(([name, size]) => {
    if (geo.attributes[name]) return;
    const arr = new Float32Array(n * size);
    if (name === 'color') arr.fill(1);
    geo.setAttribute(name, new Float32BufferAttribute(arr, size));
  });
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
};

// Use `geo` for (age, class) from now on — ageId '*' means every age of that class.
export const registerSoldierGeometry = (ageId, classId, geo) => {
  ensureRigAttributes(geo);
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  overrides.set(`${ageId}:${classId}`, geo);
  imposters.clear();
  return geo;
};
export const unregisterSoldierGeometry = (ageId, classId) => { overrides.delete(`${ageId}:${classId}`); imposters.clear(); };

// ---- far-zoom imposters ------------------------------------------------------------------------
// When the camera is zoomed far out a soldier is ~10 px tall: a 1,000–3,000-triangle model is
// wasted vertex work (and a shadow pass). The imposter is a handful of boxes with the SAME rig
// attributes, derived from the full model's bounds, so it keeps walking, wearing its team colour
// and skin tone — and shares the full model's per-instance buffers (see BattleRenderer ZoomLOD).

const imposters = new Map();
const meanColor = (geo, pred) => {
  const col = geo.attributes.color; const team = geo.attributes.aTeam; const pt = geo.attributes.aPart;
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let i = 0; i < col.count; i++) {
    if (!pred(team ? team.getX(i) : 0, pt ? pt.getX(i) : 0)) continue;
    r += col.getX(i); g += col.getY(i); b += col.getZ(i); n += 1;
  }
  return n ? new Color(r / n, g / n, b / n) : new Color('#6b6356');
};
export const getImposterGeometry = (ageId, classId) => {
  const key = `${ageId}:${classId}`;
  if (imposters.has(key)) return imposters.get(key);
  const full = getSoldierGeometry(ageId, classId);
  // Already about as light as an imposter (a jet is a few dozen triangles): keep the real thing.
  if (full.attributes.position.count <= 60 * 3) { imposters.set(key, full); return full; }
  if (!full.boundingBox) full.computeBoundingBox();
  const bb = full.boundingBox; const size = bb.getSize(new Vector3());
  const limbs = new Set(full.attributes.aLimb.array);
  const cloth = meanColor(full, (team, pt) => team < 0.5 && pt === PART.PLAIN);
  const h = size.y;
  let parts;
  if (limbs.has(LIMB.LEG_L) && !limbs.has(LIMB.HORSE_FRONT)) {
    // Walker: two legs (still animated), tunic in team colour, head in skin tone.
    const hip = h * 0.48; const w = Math.min(size.x, h * 0.34);
    parts = [
      part(box(w * 0.34, hip, w * 0.4), cloth, { at: [-w * 0.24, hip / 2, 0], limb: LIMB.LEG_L, pivot: [hip, 0] }),
      part(box(w * 0.34, hip, w * 0.4), cloth, { at: [w * 0.24, hip / 2, 0], limb: LIMB.LEG_R, pivot: [hip, 0] }),
      part(box(w, h * 0.36, w * 0.62), '#ffffff', { at: [0, hip + h * 0.17, 0], team: 1 }),
      part(box(w * 0.55, h * 0.18, w * 0.55), SKIN_TONES[1], { at: [0, h * 0.9, 0], skin: true })
    ];
  } else if (limbs.has(LIMB.HORSE_FRONT)) {
    // Rider: horse body, one diagonal leg pair each way, rider in team colour.
    const legH = h * 0.4; const bodyL = Math.max(0.6, size.z * 0.75);
    parts = [
      part(box(0.34, h * 0.22, bodyL), cloth, { at: [0, legH + h * 0.1, 0] }),
      part(box(0.3, legH, 0.1), cloth, { at: [0, legH / 2, bodyL * 0.38], limb: LIMB.HORSE_FRONT, pivot: [legH, bodyL * 0.38] }),
      part(box(0.3, legH, 0.1), cloth, { at: [0, legH / 2, -bodyL * 0.38], limb: LIMB.HORSE_BACK, pivot: [legH, -bodyL * 0.38] }),
      part(box(0.28, h * 0.3, 0.2), '#ffffff', { at: [0, h * 0.72, -0.02], team: 1 }),
      part(box(0.16, h * 0.12, 0.16), SKIN_TONES[1], { at: [0, h * 0.93, 0], skin: true })
    ];
  } else {
    // Vehicle / engine / aircraft: its bounds in its main colour, a team plate on top.
    const cy = (bb.min.y + bb.max.y) / 2;
    parts = [
      part(box(size.x * 0.9, h * 0.8, size.z * 0.9), cloth, { at: [(bb.min.x + bb.max.x) / 2, cy - h * 0.1, (bb.min.z + bb.max.z) / 2] }),
      part(box(size.x * 0.6, h * 0.2, size.z * 0.5), '#ffffff', { at: [(bb.min.x + bb.max.x) / 2, bb.max.y - h * 0.1, (bb.min.z + bb.max.z) / 2], team: 1 })
    ];
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  imposters.set(key, geo);
  return geo;
};

export const disposeSoldierCache = () => {
  imposters.forEach((g) => { if (![...cache.values(), ...overrides.values()].includes(g)) g.dispose(); }); imposters.clear();
  cache.forEach((g) => g.dispose()); cache.clear();
  // Registered GLB geometries stay: they were downloaded once and are reused by the next battle.
};

// How big each model stands in the world (tiles), and how a squad lays them out.
export const MODEL_SCALE = { infantry: 0.88, ranged: 0.88, cavalry: 0.78, siege: 0.82, support: 0.82, air: 1.2 };

// ---- the animated material ---------------------------------------------------------------------

const RIG_GLSL = /* glsl */`
attribute float aLimb;
attribute vec2 aPivot;
attribute float aTeam;
attribute vec3 aAnim;   // x: phase, y: moving 0..1, z: attacking 0..1
uniform float uTime;
float rigAngle() {
  float t = uTime * 8.5 + aAnim.x;
  float mv = aAnim.y; float at = aAnim.z;
  float strike = at * (0.35 + 1.1 * max(0.0, sin(uTime * 7.0 + aAnim.x * 1.7)));
  if (aLimb > 0.5 && aLimb < 1.5) return sin(t) * 0.6 * mv;
  if (aLimb > 1.5 && aLimb < 2.5) return -sin(t) * 0.6 * mv;
  if (aLimb > 2.5 && aLimb < 3.5) return -sin(t) * 0.35 * mv - at * 0.3;
  if (aLimb > 3.5 && aLimb < 4.5) return sin(t) * 0.35 * mv - strike;
  if (aLimb > 4.5 && aLimb < 5.5) return sin(t * 1.2) * 0.55 * mv;
  if (aLimb > 5.5 && aLimb < 6.5) return -sin(t * 1.2) * 0.55 * mv;
  return 0.0;
}
vec3 rigRotate(vec3 p, float a) {
  vec2 rel = vec2(p.y - aPivot.x, p.z - aPivot.y);
  float c = cos(a); float s = sin(a);
  return vec3(p.x, aPivot.x + rel.x * c - rel.y * s, aPivot.y + rel.x * s + rel.y * c);
}
vec3 rigRotateDir(vec3 d, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
}
vec3 turret(vec3 p) {
  float a = (aLimb > 6.5) ? sin(uTime * 0.7 + aAnim.x) * 0.35 * (1.0 - aAnim.y) - aAnim.z * sin(uTime * 9.0 + aAnim.x) * 0.04 : 0.0;
  float c = cos(a); float s = sin(a);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}
`;

// Colour pass only: skin tones, cloth jitter and the emblem atlas lookup (see unitVariants.js).
const SKIN_N = SKIN_TONES.length;
const f = (x) => x.toFixed(4);
const VARIANT_VERT = /* glsl */`
attribute float aPart;
attribute vec2 aUv;
attribute vec4 aVariant; // x: skin tone, y: emblem cell, z: cloth jitter
uniform vec3 uSkin[${SKIN_N}];
varying vec3 vEmblem;    // xy: atlas uv, z: 1 on emblem parts
`;
const VARIANT_FRAG = /* glsl */`
uniform sampler2D uEmblems;
varying vec3 vEmblem;
`;

const patchRig = (shader, withColor) => {
  shader.uniforms.uTime = RIG_TIME;
  shader.vertexShader = RIG_GLSL + shader.vertexShader
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      objectNormal = turret(rigRotateDir(objectNormal, rigAngle()));`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed = turret(rigRotate(transformed, rigAngle()));
      transformed.y += abs(sin(uTime * 8.5 + aAnim.x)) * 0.035 * aAnim.y;`);
  if (!withColor) return;
  shader.uniforms.uSkin = SKIN_UNIFORM;
  shader.uniforms.uEmblems = { value: withColor.emblems };
  shader.vertexShader = VARIANT_VERT + shader.vertexShader.replace('#include <color_vertex>', `
      vColor = vec4(1.0);
      vec3 base = vec3(1.0);
      #ifdef USE_COLOR
        base = color;
      #endif
      float isSkin = (aPart > 0.5 && aPart < 1.5) ? 1.0 : 0.0;
      int tone = int(clamp(floor(aVariant.x + 0.5), 0.0, ${f(SKIN_N - 1)}));
      base = mix(base * (1.0 + aVariant.z * 0.09 * (1.0 - aTeam)), uSkin[tone], isSkin);
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb = mix(base * mix(vec3(1.0), instanceColor.rgb, 0.12 * (1.0 - isSkin)), instanceColor.rgb, aTeam);
      #else
        vColor.rgb = base;
      #endif
      float cell = clamp(floor(aVariant.y + 0.5), 0.0, ${f(EMBLEM_GRID * EMBLEM_GRID - 1)});
      vec2 cellXY = vec2(mod(cell, ${f(EMBLEM_GRID)}), floor(cell / ${f(EMBLEM_GRID)}));
      vEmblem = vec3((clamp(aUv, 0.0, 1.0) * ${f(1 - 2 * EMBLEM_INSET)} + ${f(EMBLEM_INSET)} + cellXY) / ${f(EMBLEM_GRID)}, step(1.5, aPart));`);
  shader.fragmentShader = VARIANT_FRAG + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vEmblem.z > 0.5) {
        vec4 device = texture2D(uEmblems, vEmblem.xy);
        diffuseColor.rgb = mix(diffuseColor.rgb, device.rgb, device.a);
      }`);
};

// One clock shared by every soldier material.
export const RIG_TIME = { value: 0 };

// The soldiers' material. Lambert (per-vertex lighting) is the default: on a phone it is far
// cheaper per pixel than PBR and flat-coloured low-poly models gain almost nothing from it.
// `standard: true` gives the same rig on MeshStandardMaterial (the patch only touches chunks both
// share). `emblems` is the heraldry atlas texture (defaults to the shared procedural one).
export const createSoldierMaterial = ({ standard = false, emblems = getEmblemAtlas() } = {}) => {
  const mat = standard
    ? new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 })
    : new MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => patchRig(shader, { emblems });
  mat.customProgramCacheKey = () => (standard ? 'soldier-rig-std' : 'soldier-rig');
  return mat;
};
// Shadow pass: the same bones, so shadows walk with their soldiers.
export const createSoldierDepthMaterial = () => {
  const mat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  mat.onBeforeCompile = (shader) => patchRig(shader, false);
  mat.customProgramCacheKey = () => 'soldier-rig-depth';
  return mat;
};
