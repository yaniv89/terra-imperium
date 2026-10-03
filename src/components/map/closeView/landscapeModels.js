// src/components/map/closeView/landscapeModels.js
// The meshes for landscape.js: three trees and one small work per improvement, built in code from
// simple solids (vertex coloured, merged), the same way as the towns (townModels.js). Placeholders
// until the art from plans/model-brief-for-claude.md arrives; sizes are in model units, y up, a
// hex being about 4 units across. Cached: one geometry per kind for the life of the page.
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint } from './townModels';

const cache = new Map();
const once = (key, build) => {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
};

const TRUNK = '#6b4a2f';

export const getTreeGeometry = (kind) => once(`tree:${kind}`, () => {
  const parts = [];
  if (kind === 'conifer') {
    parts.push(paint(new CylinderGeometry(0.03, 0.04, 0.16, 5).translate(0, 0.08, 0), TRUNK));
    parts.push(paint(new ConeGeometry(0.17, 0.32, 7).translate(0, 0.28, 0), '#2f5d3a'));
    parts.push(paint(new ConeGeometry(0.12, 0.24, 7).translate(0, 0.44, 0), '#3a6e45'));
  } else if (kind === 'palm') {
    parts.push(paint(new CylinderGeometry(0.02, 0.035, 0.42, 5).translate(0, 0.21, 0), '#7a5a3a'));
    parts.push(paint(new ConeGeometry(0.22, 0.1, 7).rotateX(Math.PI).translate(0, 0.44, 0), '#2e7d32'));
    parts.push(paint(new SphereGeometry(0.06, 6, 4).translate(0, 0.43, 0), '#3f8f3a'));
  } else {
    parts.push(paint(new CylinderGeometry(0.03, 0.045, 0.18, 5).translate(0, 0.09, 0), TRUNK));
    parts.push(paint(new IcosahedronGeometry(0.17, 0).translate(0, 0.3, 0), '#4d7c3a'));
    parts.push(paint(new IcosahedronGeometry(0.11, 0).translate(0.08, 0.38, 0.04), '#5b8c42'));
  }
  return mergeGeometries(parts);
});

const box = (parts, color, w, h, d, x, y, z, rot = 0) => parts.push(paint(new BoxGeometry(w, h, d).rotateY(rot).translate(x, y + h / 2, z), color));

const WORKS = {
  // Farm: a patchwork of fields in three crops and a barn.
  farm: (p) => {
    const crops = ['#d6b85a', '#9cb85a', '#c9a24a', '#b7c56a'];
    for (let i = 0; i < 6; i++) box(p, crops[i % 4], 0.5, 0.03, 0.34, -0.55 + (i % 3) * 0.55, 0, -0.2 + Math.floor(i / 3) * 0.4);
    box(p, '#8b3a2a', 0.2, 0.16, 0.14, 0.2, 0.03, 0.5);
    p.push(paint(new ConeGeometry(0.17, 0.1, 4).rotateY(Math.PI / 4).translate(0.2, 0.24, 0.5), '#5b4636'));
  },
  // Pasture: a fenced meadow with a few beasts.
  pasture: (p) => {
    box(p, '#86a95a', 1.3, 0.02, 0.9, 0, 0, 0);
    [[-0.65, 0, 0.02, 0.9], [0.65, 0, 0.02, 0.9], [0, -0.45, 1.3, 0.02], [0, 0.45, 1.3, 0.02]].forEach(([x, z, w, d]) => box(p, '#7a5a3a', w, 0.08, d, x, 0.02, z));
    [[-0.3, -0.1], [0.1, 0.15], [0.35, -0.2], [-0.1, 0.25]].forEach(([x, z], i) => box(p, i % 2 ? '#f1ede4' : '#6b4a2f', 0.12, 0.07, 0.06, x, 0.04, z, i));
  },
  // Camp: hunters' tents round a fire.
  camp: (p) => {
    [[-0.25, 0], [0.2, -0.15], [0.1, 0.25]].forEach(([x, z]) => p.push(paint(new ConeGeometry(0.13, 0.22, 6).translate(x, 0.11, z), '#c8b48a')));
    box(p, '#c2410c', 0.08, 0.04, 0.08, 0, 0, 0.05);
  },
  // Mine: a spoil heap, a shaft house and a cart track.
  mine: (p) => {
    p.push(paint(new ConeGeometry(0.4, 0.3, 7).translate(-0.2, 0.15, 0), '#6b6259'));
    box(p, '#4b5563', 0.2, 0.22, 0.18, 0.3, 0, 0.1);
    box(p, '#3f3a35', 0.6, 0.02, 0.06, 0.15, 0, 0.35);
  },
  // Quarry: a stepped pit of pale stone and cut blocks.
  quarry: (p) => {
    box(p, '#cfc8b8', 0.9, 0.06, 0.6, 0, 0, 0);
    box(p, '#bdb5a4', 0.6, 0.12, 0.4, 0.1, 0, -0.05);
    box(p, '#e2dccd', 0.12, 0.1, 0.12, -0.5, 0, 0.35); box(p, '#e2dccd', 0.12, 0.1, 0.12, -0.35, 0, 0.4);
  },
  // Plantation: rows of bushes.
  plantation: (p) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) p.push(paint(new SphereGeometry(0.07, 6, 4).translate(-0.4 + c * 0.2, 0.07, -0.25 + r * 0.25), '#2f6b35'));
    box(p, '#a07a4a', 1.0, 0.01, 0.75, 0, 0, 0);
  },
  // Lumber camp: a log pile and a saw shed.
  lumber_camp: (p) => {
    for (let i = 0; i < 4; i++) p.push(paint(new CylinderGeometry(0.04, 0.04, 0.5, 6).rotateZ(Math.PI / 2).translate(-0.15, 0.04 + Math.floor(i / 2) * 0.07, -0.05 + (i % 2) * 0.09), '#8a6a45'));
    box(p, '#6b4a2f', 0.26, 0.16, 0.2, 0.3, 0, 0.15);
  },
  // Oil well: a derrick and a tank.
  oil_well: (p) => {
    p.push(paint(new ConeGeometry(0.12, 0.6, 4).translate(0, 0.3, 0), '#374151'));
    p.push(paint(new CylinderGeometry(0.14, 0.14, 0.16, 10).translate(0.35, 0.08, 0.1), '#9ca3af'));
  },
  // Fort: a square of walls round a keep.
  fort: (p) => {
    [[0, -0.35, 0.8, 0.06], [0, 0.35, 0.8, 0.06], [-0.4, 0, 0.06, 0.76], [0.4, 0, 0.06, 0.76]].forEach(([x, z, w, d]) => box(p, '#8f8f8a', w, 0.16, d, x, 0, z));
    box(p, '#7a7a74', 0.26, 0.32, 0.26, 0, 0, 0);
  },
  // Fishing boats: two hulls with a mast (on a coast tile, beside the shore).
  fishing_boats: (p) => {
    [[-0.2, 0], [0.25, 0.2]].forEach(([x, z]) => {
      box(p, '#7a5a3a', 0.26, 0.05, 0.09, x, 0, z);
      box(p, '#e5e7eb', 0.015, 0.2, 0.015, x, 0.05, z);
    });
  }
};

export const getWorkGeometry = (kind) => once(`work:${kind}`, () => {
  const parts = [];
  (WORKS[kind] || WORKS.camp)(parts);
  return mergeGeometries(parts);
});
