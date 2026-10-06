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
// rig and instancing drive it. Each model has a matching reduced-tessellation mesh for far zoom levels.
import {
  BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry, ExtrudeGeometry, Shape, Float32BufferAttribute,
  Matrix4, Euler, Quaternion, Vector3, Color, MeshLambertMaterial, MeshStandardMaterial, MeshDepthMaterial, RGBADepthPacking
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKIN_UNIFORM, SKIN_TONES, EMBLEM_GRID, EMBLEM_INSET, getEmblemAtlas } from './unitVariants';

export const LIMB = { BODY: 0, LEG_L: 1, LEG_R: 2, ARM_L: 3, ARM_R: 4, HORSE_FRONT: 5, HORSE_BACK: 6, TURRET: 7 };
export const PART = { PLAIN: 0, SKIN: 1, EMBLEM: 2 };
// Every soldier geometry carries exactly these attributes (merging needs them to match).
export const RIG_ATTRIBUTES = { color: 3, aLimb: 1, aPivot: 2, aTeam: 1, aPart: 1, aUv: 2, aSurface: 2 };
// aSurface = (metalness, roughness) per vertex, for the PBR soldier material: armour, blades and
// helmets catch the light, cloth, leather, skin and wood stay matte.
export const MATTE = [0, 0.85];
const METAL = [0.75, 0.32];

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
const METAL_COLORS = new Set([C.steel, C.darkSteel, C.bronze, C.gold]);
const part = (geo, color, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], limb = LIMB.BODY, pivot = [0, 0], team = 0, skin = false, emblem = false, surface = METAL_COLORS.has(color) ? METAL : MATTE } = {}) => {
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
  const col = new Float32Array(n * 3); const lim = new Float32Array(n); const piv = new Float32Array(n * 2); const tm = new Float32Array(n); const pt = new Float32Array(n); const sf = new Float32Array(n * 2);
  const partId = emblem ? PART.EMBLEM : skin ? PART.SKIN : PART.PLAIN;
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    lim[i] = limb; piv[i * 2] = pivot[0]; piv[i * 2 + 1] = pivot[1]; tm[i] = emblem ? 1 : team; pt[i] = partId;
    sf[i * 2] = surface[0]; sf[i * 2 + 1] = surface[1];
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('aLimb', new Float32BufferAttribute(lim, 1));
  g.setAttribute('aPivot', new Float32BufferAttribute(piv, 2));
  g.setAttribute('aTeam', new Float32BufferAttribute(tm, 1));
  g.setAttribute('aPart', new Float32BufferAttribute(pt, 1));
  g.setAttribute('aUv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aSurface', new Float32BufferAttribute(sf, 2));
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
let reducedDetail = false;
const cyl = (rt, rb, h, seg = 12) => new CylinderGeometry(rt, rb, h, reducedDetail ? Math.min(seg, 6) : seg);
const ball = (r, w = 12, h = 8) => new SphereGeometry(r, reducedDetail ? Math.min(w, 6) : w, reducedDetail ? Math.min(h, 4) : h);
const cone = (r, h, seg = 7) => new ConeGeometry(r, h, seg);
const oval = (w, h, d) => ball(1, 10, 6).scale(w / 2, h / 2, d / 2);
const dome = (r) => new SphereGeometry(r, reducedDetail ? 8 : 14, reducedDetail ? 3 : 6, 0, Math.PI * 2, 0, Math.PI / 2);

// ---- people ----------------------------------------------------------------------------------

const HIP = 0.48; const SHOULDER = 0.8;
const LEG = { limb: LIMB.LEG_L, pivot: [HIP, 0] };
const ARM_L = { limb: LIMB.ARM_L, pivot: [SHOULDER, 0] };
const ARM_R = { limb: LIMB.ARM_R, pivot: [SHOULDER, 0] };

const HELMETS = {
  bronze: (y) => [part(dome(0.102), C.bronze, { at: [0, y, 0], scale: [1, 1.1, 1.1] })],
  classical: (y) => [part(dome(0.106), C.bronze, { at: [0, y, 0], scale: [1, 1, 1.1] }), part(oval(0.03, 0.11, 0.23), '#b3261e', { at: [0, y + 0.11, -0.01] }), ...[-1, 1].map(s => part(oval(0.025, 0.09, 0.07), C.bronze, { at: [s * 0.09, y - 0.04, 0.02] }))],
  kingdoms: (y) => [part(dome(0.106), C.steel, { at: [0, y, 0], scale: [1, 1.2, 1.1] }), part(box(0.018, 0.1, 0.015), C.steel, { at: [0, y - 0.04, 0.108] })],
  gunpowder: (y) => [part(cyl(0.1, 0.11, 0.2), C.black, { at: [0, y + 0.1, 0] }), part(cyl(0.13, 0.13, 0.02, 8), C.black, { at: [0, y + 0.0, 0.02] }), part(ball(0.025, 4, 3), C.gold, { at: [0, y + 0.13, 0.1] })],
  modern: (y) => [part(dome(0.114), C.darkOlive, { at: [0, y - 0.005, 0], scale: [1, 0.8, 1.1] })]
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
      parts.push(part(oval(0.105, 0.25, 0.125), LEG_CLOTH[ageId], { at: [s * 0.064, 0.36 + y0, 0], ...bone }));
      parts.push(part(cyl(0.045, 0.031, 0.21), LEG_CLOTH[ageId], { at: [s * 0.064, 0.155 + y0, 0], ...bone }));
      parts.push(part(oval(0.095, 0.075, 0.17), C.darkLeather, { at: [s * 0.064, 0.04 + y0, 0.035], ...bone }));
    });
  } else {
    [-1, 1].forEach((s) => parts.push(part(oval(0.11, 0.3, 0.13), LEG_CLOTH[ageId], { at: [s * 0.13, y0 + 0.4, 0.08], rot: [-1.0, 0, s * 0.3] })));
  }
  parts.push(part(oval(0.265, 0.37, 0.18), BODY_CLOTH[ageId], { at: [0, 0.645 + y0, 0] }));
  // Tabard/tunic front in the side's colour.
  parts.push(part(oval(0.24, 0.3, 0.035), '#ffffff', { at: [0, 0.64 + y0, 0.075], team: 1, emblem: true }));
  parts.push(part(cyl(0.114, 0.11, 0.034), C.darkLeather, { at: [0, 0.505 + y0, 0], scale: [1, 1, 0.78] }));
  parts.push(part(cyl(0.033, 0.04, 0.06), C.skin[skin % 4], { at: [0, 0.83 + y0, 0], skin: true }));
  parts.push(part(oval(0.17, 0.19, 0.17), C.skin[skin % 4], { at: [0, 0.92 + y0, 0.01], skin: true }));
  parts.push(part(oval(0.025, 0.043, 0.035), C.skin[skin % 4], { at: [0, 0.922 + y0, 0.096], skin: true }));
  [-1, 1].forEach(s => parts.push(part(ball(0.009, 6, 4), C.black, { at: [s * 0.033, 0.947 + y0, 0.083] })));
  parts.push(...HELMETS[ageId](0.962 + y0));
  [-1, 1].forEach((s) => {
    const bone = s < 0 ? { ...ARM_L, pivot: [SHOULDER + y0, 0] } : { ...ARM_R, pivot: [SHOULDER + y0, 0] };
    parts.push(part(oval(0.095, 0.19, 0.1), BODY_CLOTH[ageId], { at: [s * 0.17, 0.733 + y0, 0], ...bone }));
    parts.push(part(cyl(0.038, 0.027, 0.16), BODY_CLOTH[ageId], { at: [s * 0.19, 0.575 + y0, 0.015], rot: [-0.18, 0, 0], ...bone }));
    parts.push(part(oval(0.052, 0.075, 0.055), C.skin[skin % 4], { at: [s * 0.2, 0.48 + y0, 0.03], skin: true, ...bone }));
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
    part(oval(0.36, 0.43, 0.99), coat, { at: [0, 0.79, 0] }),
    part(oval(0.24, 0.55, 0.29), coat, { at: [0, 1.03, 0.4], rot: [0.48, 0, 0] }),
    part(oval(0.19, 0.23, 0.4), coat, { at: [0, 1.23, 0.63], rot: [0.36, 0, 0] }),
    part(oval(0.16, 0.15, 0.18), C.horseDark, { at: [0, 1.16, 0.81] }),
    part(oval(0.055, 0.39, 0.13), C.horseDark, { at: [0, 1.11, 0.31], rot: [0.48, 0, 0] }),
    part(oval(0.075, 0.42, 0.08), C.horseDark, { at: [0, 0.7, -0.51], rot: [-0.45, 0, 0] })
  ];
  [-1, 1].forEach(s => {
    parts.push(part(cone(0.042, 0.135, 10), coat, { at: [s * 0.065, 1.39, 0.58], scale: [0.6, 1, 1] }));
    parts.push(part(ball(0.014, 6, 4), C.black, { at: [s * 0.093, 1.27, 0.68] }));
  });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    // Diagonal pairs move together (a trot): front-left with back-right, front-right with back-left.
    const bone = { limb: sx * sz > 0 ? LIMB.HORSE_FRONT : LIMB.HORSE_BACK, pivot: [0.66, sz * 0.36] };
    parts.push(part(oval(0.1, 0.33, 0.14), coat, { at: [sx * 0.12, 0.51, sz * 0.36], ...bone }));
    parts.push(part(cyl(0.035, 0.026, 0.3), coat, { at: [sx * 0.12, 0.2, sz * 0.36], ...bone }));
    parts.push(part(oval(0.085, 0.07, 0.11), C.black, { at: [sx * 0.12, 0.035, sz * 0.36], ...bone }));
  });
  if (barding) parts.push(part(oval(0.39, 0.32, 0.84), '#ffffff', { at: [0, 0.79, 0], team: 1 }));
  parts.push(part(oval(0.36, 0.085, 0.34), C.leather, { at: [0, 1.0, -0.02] }));
  return parts;
};
const wheel = (r, x, y, z, color = C.darkWood) => part(cyl(r, r, 0.06, 10), color, { at: [x, y, z], rot: [0, 0, Math.PI / 2] });
const tankModel = () => [
  part(box(0.82, 0.24, 1.4), C.olive, { at: [0, 0.34, 0] }),
  part(box(0.82, 0.2, 0.3), C.olive, { at: [0, 0.36, 0.67], rot:[-0.45,0,0] }),
  ...[-1, 1].flatMap(s => [
    part(oval(0.17,0.31,1.52),C.rubber,{at:[s*0.45,0.17,0]}),
    ...[-0.5,-0.3,-0.1,0.1,0.3,0.5].map(z => part(cyl(0.1,0.1,0.04,12),C.darkSteel,{at:[s*0.54,0.17,z],rot:[0,0,Math.PI/2]}))
  ]),
  part(cyl(0.27,0.32,0.22,14), C.olive, { at: [0, 0.56, -0.08], scale:[1,1,1.2], limb: LIMB.TURRET }),
  part(cyl(0.045, 0.05, 1.1, 12), C.darkOlive, { at: [0, 0.6, 0.72], rot: [Math.PI / 2, 0, 0], limb: LIMB.TURRET }),
  part(cyl(0.085,0.085,0.03,12),C.darkSteel,{at:[0.09,0.685,-0.16],limb:LIMB.TURRET}),
  part(box(0.12, 0.015, 0.12), '#ffffff', { at: [-0.12, 0.681, -0.12], team: 1, limb: LIMB.TURRET })
];
const sweptWing = () => {
  const shape=new Shape();
  [[-0.16,0.25],[-0.9,-0.4],[-0.88,-0.6],[-0.16,-0.2],[0.16,-0.2],[0.88,-0.6],[0.9,-0.4],[0.16,0.25]].forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
  shape.closePath();
  return new ExtrudeGeometry(shape,{depth:0.035,bevelEnabled:false}).rotateX(Math.PI/2);
};
const truck = (bodyColor = C.olive) => [
  part(box(0.7, 0.35, 1.3), bodyColor, { at: [0, 0.42, 0] }),
  part(box(0.66, 0.3, 0.4), bodyColor, { at: [0, 0.74, 0.42] }),
  part(box(0.6, 0.18, 0.02), '#9fc3d8', { at: [0, 0.8, 0.63] }),
  wheel(0.16, -0.38, 0.16, 0.4, C.rubber), wheel(0.16, 0.38, 0.16, 0.4, C.rubber), wheel(0.16, -0.38, 0.16, -0.4, C.rubber), wheel(0.16, 0.38, 0.16, -0.4, C.rubber),
  part(box(0.2, 0.04, 0.2), '#ffffff', { at: [0, 0.9, 0.42], team: 1 })
];

// ---- the roster, one model per (age, class) ----------------------------------------------------

// Ships (plans/civ-map-rework.md D5b): placeholder hulls until the art of plans/art-image-spec.md
// arrives. A hull along z (the bow at +z), a mast or a superstructure, a team pennant or flag.
const hull = (length, beam, color = C.wood) => [
  part(box(beam, 0.22, length), color, { at: [0, 0.16, 0] }),
  part(box(beam * 0.7, 0.12, length * 0.2), color, { at: [0, 0.2, length * 0.55], rot: [0.5, 0, 0] }), // the bow
  part(box(beam * 0.85, 0.08, length * 0.9), C.darkWood, { at: [0, 0.3, 0] })
];
const mast = (height, z = 0, sail = true) => [
  part(cyl(0.025, 0.035, height, 6), C.darkWood, { at: [0, height / 2 + 0.3, z] }),
  ...(sail ? [part(box(0.9, height * 0.55, 0.02), C.cloth, { at: [0, height * 0.62, z] })] : []),
  part(box(0.02, 0.12, 0.22), '#ffffff', { at: [0, height + 0.3, z + 0.11], team: 1 })
];
const oars = (length) => [-1, 1].flatMap((s) => [-0.3, -0.1, 0.1, 0.3].map((f) => part(box(0.5, 0.02, 0.03), C.wood, { at: [s * 0.55, 0.22, f * length], rot: [0, 0, s * 0.35] })));
const SHIPS = {
  bronze: () => [...hull(2.0, 0.55), ...oars(2.0), ...mast(1.0)],
  classical: () => [...hull(2.4, 0.55), ...oars(2.4), ...mast(1.1), part(box(0.25, 0.12, 0.3), C.bronze, { at: [0, 0.18, 1.32] })], // the ram
  kingdoms: () => [...hull(2.2, 0.8), part(box(0.7, 0.4, 0.5), C.wood, { at: [0, 0.5, -0.8] }), ...mast(1.4, 0.1)], // a stern castle
  gunpowder: () => [...hull(2.8, 0.85, C.darkWood), ...mast(1.5, 0.6), ...mast(1.6, -0.1), ...mast(1.3, -0.8), ...[-1, 1].flatMap((s) => [-0.6, -0.2, 0.2, 0.6].map((z) => part(box(0.08, 0.08, 0.08), C.black, { at: [s * 0.45, 0.35, z] })))], // gun ports
  modern: () => [...hull(3.2, 0.6, '#8b939c'), part(box(0.4, 0.4, 0.9), '#6e757d', { at: [0, 0.5, 0.2] }), part(cyl(0.03, 0.03, 0.8, 6), C.darkSteel, { at: [0, 0.9, 0.2] }), part(cyl(0.04, 0.05, 0.6, 6), C.darkSteel, { at: [0, 0.42, 1.0], rot: [Math.PI / 2, 0, 0] }), part(box(0.02, 0.12, 0.22), '#ffffff', { at: [0, 1.3, 0.31], team: 1 })]
};

const MODELS = {
  naval: SHIPS,
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
    gunpowder: () => [...person('gunpowder', { skin: 1 }), ...longGun(0, C.wood), ...pack()],
    modern: () => [...person('modern'), ...launcher(), ...pack(C.darkOlive)]
  },
  cavalry: {
    bronze: () => [ // a chariot: two horses, a wheeled car, a driver with a spear
      ...shift(horse(), -0.24, 0, 0.55), ...shift(horse(C.horseDark), 0.24, 0, 0.55),
      part(box(0.7, 0.34, 0.55), C.wood, { at: [0, 0.62, -0.35] }), part(box(0.72, 0.1, 0.02), '#ffffff', { at: [0, 0.75, -0.07], team: 1 }),
      wheel(0.3, -0.4, 0.3, -0.35), wheel(0.3, 0.4, 0.3, -0.35),
      ...shift(person('bronze', { seat: 0.45, legs: false }), 0, 0, -0.35), ...shift(spear(1.2, 0.45), 0, 0, -0.35)
    ],
    classical: () => [...horse(C.horse, true), ...person('classical', { seat: 0.62, legs: false }), ...spear(1.3, 0.62)],
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
  // The battle economy's laborer (phase R1): a placeholder until the art plan's units/<age>-worker
  // (batch 04, src/assets/units/<age>-worker.glb) arrives: a person with a shovel and a pack.
  worker: {
    bronze: () => [...person('bronze', { skin: 2 }), ...shovel(), ...pack(C.cloth)],
    classical: () => [...person('classical', { skin: 1 }), ...shovel(), ...pack(C.cloth)],
    kingdoms: () => [...person('kingdoms', { skin: 3 }), ...shovel(), ...pack(C.cloth)],
    gunpowder: () => [...person('gunpowder'), ...shovel(), ...pack(C.cloth)],
    modern: () => [...person('modern', { skin: 2 }), ...shovel(), ...pack(C.darkOlive)]
  },
  air: {
    modern: () => [
      part(cyl(0.12, 0.18, 1.8, 8), '#8b939c', { at: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }),
      part(cone(0.12, 0.45, 8), '#6e757d', { at: [0, 0, 1.1], rot: [Math.PI / 2, 0, 0] }),
      part(sweptWing(), '#8b939c', { at: [0, 0, 0] }), part(box(0.6, 0.03, 0.25), '#8b939c', { at: [0, 0, -0.8] }),
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
  // The primitives already carry smooth normals. Recomputing on the non-indexed
  // merge replaces them with face normals and makes every curved surface faceted.
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
    if (name === 'aSurface') for (let i = 0; i < n; i++) { arr[i * 2] = MATTE[0]; arr[i * 2 + 1] = MATTE[1]; }
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
// Distant troops keep their class silhouette, equipment and rig. Curved surfaces
// use fewer segments; instancing still shares one geometry per age and class.

const imposters = new Map();
// Far zoom uses the same equipment, mounts, proportions and rig as near zoom.
// Only curved surface tessellation changes; a cavalry squad never becomes pink boxes.
export const getImposterGeometry = (ageId, classId) => {
  const key = `${ageId}:${classId}`;
  if (imposters.has(key)) return imposters.get(key);
  // An authored override retains its silhouette until an artist supplies a matching LOD.
  if (hasSoldierOverride(ageId,classId)) return getSoldierGeometry(ageId,classId);
  const byAge = MODELS[classId] || MODELS.infantry;
  const build = byAge[ageId] || byAge.modern || byAge.gunpowder || Object.values(byAge)[0];
  let geo;
  reducedDetail = true;
  try { geo = mergeGeometries(build()); }
  finally { reducedDetail = false; }
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  imposters.set(key, geo);
  return geo;
};

export const disposeSoldierCache = () => {
  imposters.forEach((g) => { if (![...cache.values(), ...overrides.values()].includes(g)) g.dispose(); }); imposters.clear();
  cache.forEach((g) => g.dispose()); cache.clear();
  // Registered GLB geometries stay: they were downloaded once and are reused by the next battle.
};

// How big each model stands in the world (tiles), and how a squad lays them out.
export const MODEL_SCALE = { worker: 0.8, infantry: 0.88, ranged: 0.88, cavalry: 0.78, siege: 0.82, support: 0.82, air: 1.2, naval: 1.6, general: 0.86 }; // general: a size up from cavalry (unitModels.js)

// ---- the animated material ---------------------------------------------------------------------

const RIG_GLSL = /* glsl */`
attribute float aLimb;
attribute vec2 aPivot;
attribute vec3 aAnim;   // x: phase, y: moving 0..1, z: attacking 0..1
uniform float uTime;
float rigAngle() {
  float t = uTime * 8.5 + aAnim.x;
  float mv = aAnim.y; float at = aAnim.z;
  // Three distinct beats: lift, fast contact, slower recovery. Visual phase never touches RNG.
  float beat = fract(uTime * 1.15 + aAnim.x * 0.27);
  float lift = smoothstep(0.0, 0.28, beat);
  float contact = smoothstep(0.28, 0.40, beat);
  float recovery = smoothstep(0.40, 0.95, beat);
  float strike = at * (-0.4 * lift + 1.8 * contact - 1.4 * recovery);
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
// Packed per-vertex look (see packForGPU): x team, y part, z metalness, w roughness.
attribute vec4 aLook;
#define aTeam aLook.x
#define aPart aLook.y
#define aSurface aLook.zw
attribute vec2 aUv;
varying vec2 vSurface;
attribute vec4 aVariant; // x: skin tone, y: emblem cell, z: cloth jitter
uniform vec3 uSkin[${SKIN_N}];
varying vec3 vEmblem;    // xy: atlas uv, z: 1 on emblem parts
`;
const VARIANT_FRAG = /* glsl */`
uniform sampler2D uEmblems;
varying vec3 vEmblem;
varying vec2 vSurface;
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
        vColor.rgb = mix(base * mix(vec3(1.0), instanceColor.rgb, ${f(withColor.teamTint ?? 0.12)} * (1.0 - isSkin)), instanceColor.rgb, aTeam);
      #else
        vColor.rgb = base;
      #endif
      float cell = clamp(floor(aVariant.y + 0.5), 0.0, ${f(EMBLEM_GRID * EMBLEM_GRID - 1)});
      vec2 cellXY = vec2(mod(cell, ${f(EMBLEM_GRID)}), floor(cell / ${f(EMBLEM_GRID)}));
      vSurface = aSurface;
      vEmblem = vec3((clamp(aUv, 0.0, 1.0) * ${f(1 - 2 * EMBLEM_INSET)} + ${f(EMBLEM_INSET)} + cellXY) / ${f(EMBLEM_GRID)}, step(1.5, aPart));`);
  shader.fragmentShader = VARIANT_FRAG + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vEmblem.z > 0.5) {
        vec4 device = texture2D(uEmblems, vEmblem.xy);
        diffuseColor.rgb = mix(diffuseColor.rgb, device.rgb, device.a);
      }`);
  // PBR: every vertex carries its own metalness and roughness (armour shines, cloth stays matte).
  // The rig already rotates objectNormal in beginnormal_vertex, so the lit normal (vNormal) follows
  // every swinging arm and leg; there are no normal maps, so no tangents are needed.
  if (withColor.standard) {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = vSurface.y;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor = vSurface.x;`);
  }
};

// WebGL guarantees only 16 vertex attributes (and many phones stop there). A soldier layer uses
// position, normal, color, aLimb, aPivot, aUv, aLook, aAnim, aVariant + instanceMatrix (4 slots)
// + instanceColor = 14. Unpacked, team/part/surface would take 17, which fails to link. So the GPU
// copy of a soldier geometry carries them as one vec4; the cached CPU geometry keeps them readable.
export const packForGPU = (geo) => {
  const n = geo.attributes.position.count;
  const team = geo.attributes.aTeam; const pt = geo.attributes.aPart; const sf = geo.attributes.aSurface;
  const look = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    look[i * 4] = team ? team.getX(i) : 0;
    look[i * 4 + 1] = pt ? pt.getX(i) : 0;
    look[i * 4 + 2] = sf ? sf.getX(i) : MATTE[0];
    look[i * 4 + 3] = sf ? sf.getY(i) : MATTE[1];
  }
  geo.setAttribute('aLook', new Float32BufferAttribute(look, 4));
  ['aTeam', 'aPart', 'aSurface'].forEach((a) => geo.deleteAttribute(a));
  return geo;
};

// One clock shared by every soldier material.
export const RIG_TIME = { value: 0 };

// The soldiers' material. Lambert (per-vertex lighting) is the default: on a phone it is far
// cheaper per pixel than PBR and flat-coloured low-poly models gain almost nothing from it.
// `standard: true` gives the same rig on MeshStandardMaterial (the patch only touches chunks both
// share). `emblems` is the heraldry atlas texture (defaults to the shared procedural one).
// `teamTint`: how much of the side's colour every cloth and metal part takes (the team parts take
// all of it); the far detail level raises it so a figure a few pixels tall still reads as its army.
export const createSoldierMaterial = ({ standard = false, emblems = getEmblemAtlas(), teamTint = 0.12 } = {}) => {
  const mat = standard
    ? new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 })
    : new MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => patchRig(shader, { emblems, standard, teamTint });
  mat.customProgramCacheKey = () => `${standard ? 'soldier-rig-std' : 'soldier-rig'}-${teamTint}`;
  return mat;
};
// Shadow pass: the same bones, so shadows walk with their soldiers.
export const createSoldierDepthMaterial = () => {
  const mat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  mat.onBeforeCompile = (shader) => patchRig(shader, false);
  mat.customProgramCacheKey = () => 'soldier-rig-depth';
  return mat;
};

// ---- parts for composed units (unitComposer.js) ---------------------------------------------
// Procedural props and mounts that a GLB soldier can be combined with, all carrying the rig's
// attributes. Props are modelled at their grip (origin), upright along +Y, facing +Z.

const PROPS = {
  bow: () => [
    part(new TorusGeometry(0.28, 0.014, 4, 10, Math.PI * 0.9), C.darkWood, { rot: [0, Math.PI / 2, Math.PI / 2 - Math.PI * 0.45] }),
    part(box(0.004, 0.5, 0.004), C.cloth, { at: [0, 0, 0.04] })
  ],
  quiver: () => [part(cyl(0.05, 0.04, 0.34, 6), C.leather, { rot: [0.3, 0, 0.2] })],
  shield: () => [part(cyl(0.17, 0.17, 0.03, 10), '#ffffff', { rot: [Math.PI / 2, 0, 0], emblem: true }), part(ball(0.035, 5, 4), C.bronze, { at: [0, 0, 0.02] })],
  musket: () => [part(box(0.04, 0.05, 0.62), C.darkWood, { at: [0, 0, 0.2] }), part(cyl(0.012, 0.012, 0.34, 5), C.darkSteel, { at: [0, 0.03, 0.5], rot: [Math.PI / 2, 0, 0] })],
  rifle: () => [part(box(0.045, 0.06, 0.5), C.black, { at: [0, 0, 0.16] }), part(box(0.03, 0.08, 0.05), C.black, { at: [0, -0.06, 0.12] })],
  launcher: () => [part(cyl(0.055, 0.055, 0.8, 7), C.darkOlive, { rot: [Math.PI / 2, 0, 0] })],
  turret: () => [
    part(box(0.34, 0.16, 0.4), C.olive, { limb: LIMB.TURRET }),
    part(cyl(0.035, 0.035, 0.7, 7), C.darkOlive, { at: [0, 0.02, 0.45], rot: [Math.PI / 2, 0, 0], limb: LIMB.TURRET }),
    part(box(0.2, 0.03, 0.2), '#ffffff', { at: [0, 0.1, -0.05], team: 1, limb: LIMB.TURRET })
  ]
};
export const PROP_KINDS = Object.keys(PROPS);
export const getPropGeometry = (kind) => {
  const build = PROPS[kind];
  if (!build) throw new Error(`unknown prop "${kind}"`);
  const geo = mergeGeometries(build());
  return geo;
};

// Mounts for a seated GLB rider; `saddle` is where the rider's seat goes.
const MOUNTS = {
  horse: { build: () => horse(C.horse, false), saddle: [0, 0.97, -0.02] },
  darkhorse: { build: () => horse(C.horseDark, false), saddle: [0, 0.97, -0.02] },
  warhorse: { build: () => horse('#cfc7b8', true), saddle: [0, 0.97, -0.02] },
  chariot: {
    build: () => [
      ...shift(horse(), -0.24, 0, 0.55), ...shift(horse(C.horseDark), 0.24, 0, 0.55),
      part(box(0.7, 0.34, 0.55), C.wood, { at: [0, 0.62, -0.35] }), part(box(0.72, 0.1, 0.02), '#ffffff', { at: [0, 0.75, -0.07], team: 1 }),
      wheel(0.3, -0.4, 0.3, -0.35), wheel(0.3, 0.4, 0.3, -0.35)
    ],
    saddle: [0, 0.45, -0.38],
    standing: true
  }
};
export const MOUNT_KINDS = Object.keys(MOUNTS);
export const getMount = (kind) => {
  const m = MOUNTS[kind];
  if (!m) throw new Error(`unknown mount "${kind}"`);
  const geo = mergeGeometries(m.build());
  return { geometry: geo, saddle: m.saddle, standing: !!m.standing };
};

// Move a rigged geometry (and its bones' hinges) — the composer's placement step.
export const offsetRig = (geo, dx, dy, dz) => {
  geo.translate(dx, dy, dz);
  const piv = geo.attributes.aPivot;
  if (piv) for (let i = 0; i < piv.count; i++) piv.setXY(i, piv.getX(i) + dy, piv.getY(i) + dz);
  return geo;
};

// Merge rigged pieces into one soldier geometry (one draw call), normalising their attributes.
export const mergeRigged = (geos) => {
  const ready = geos.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    ensureRigAttributes(x);
    Object.keys(x.attributes).forEach((k) => { if (!(k in RIG_ATTRIBUTES) && k !== 'position' && k !== 'normal') x.deleteAttribute(k); });
    return x;
  });
  const geo = mergeGeometries(ready);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
};
