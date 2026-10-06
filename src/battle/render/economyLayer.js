// src/battle/render/economyLayer.js
// The battle economy on the battlefield (phase R1; src/battle/sim/economy.js): resource nodes,
// the buildings workers raise (scaffolds that grow with the work), the camp, HP bars for damaged
// and unfinished buildings, and the build-placement ghost. Kept apart from BattleRenderer.js, which
// only creates it and calls update(), like cityLayer.js.
//
// Everything is drawn from a handful of instanced meshes (one per primitive: box, roof, cylinder,
// cone, rock, flat disc), every part of every building and node written into them each frame, so a
// base of 160 buildings and 60 nodes costs seven draw calls (phone budget: under 120 in all).
//
// PLACEHOLDERS and the art that replaces them (plans/ART-PRODUCTION-PLAN.md batches 04 and 05):
//   buildings (greyboxes with the right footprint; roofs in the side's colour) -> one file per age,
//     src/assets/battle/rts/rts-<age>.glb, an object per role (S5): rts/bronze/expedition-camp,
//     town-hall (the keep stands in for it), food-depot, materials-yard, trade-post, farm-plot, mine,
//     barracks, range, stable, siege-workshop, aid-post, tower; scaffolds -> rts/bronze/construction-set;
//     village houses -> the town kits' houses (battle-city/<age>/<theme> houses);
//   nodes (primitive shapes) -> src/assets/battle/nature/<id>.glb (S9): stone-outcrop, ore-outcrop,
//     gold-vein, fish-shoal, herd-sheep-goat, herd-cattle, and the vegetation kits for groves
//     (vegetation-temperate and its five siblings by biome).
import { InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, CircleGeometry, Object3D, Color } from 'three';
import { Q } from '../sim/constants';

const PRIMS = ['box', 'roof', 'cyl', 'cone', 'rock', 'flat'];
const CAPACITY = 3072;
const tmp = new Object3D();
const tmpColor = new Color();
const SCAFFOLD = new Color('#c8a165');

// A building's parts in tiles from its centre: [prim, dx, y0, dz, sx, sy, sz, colour ('side' = the
// side's colour)]. Sizes are fractions of the footprint so the footprint stays the truth.
const BODY = '#b8a888'; const WOOD = '#8a6a43'; const DARK = '#5b5148'; const STONE = '#a39c8c'; const FIELD = '#b9b061';
const PARTS = {
  camp: [['cone', -0.8, 0, -0.8, 1.3, 1.4, 1.3, '#d9cfb8'], ['cone', 0.8, 0, -0.8, 1.3, 1.4, 1.3, '#d9cfb8'], ['cone', -0.8, 0, 0.8, 1.3, 1.4, 1.3, '#d9cfb8'], ['cone', 0.9, 0, 0.9, 1.6, 1.9, 1.6, 'side'], ['cyl', 0, 0, 0, 0.06, 2.6, 0.06, WOOD], ['box', 0, 2.2, 0.25, 0.04, 0.35, 0.5, 'side']],
  hall: [],
  house: [['box', 0, 0, 0, 1.3, 0.9, 1.1, BODY], ['roof', 0, 0.9, 0, 1.5, 0.6, 1.3, 'side']],
  foodDepot: [['box', 0, 0, 0, 1.5, 0.7, 1.2, WOOD], ['roof', 0, 0.7, 0, 1.6, 0.4, 1.4, 'side'], ['box', 0.7, 0, 0.5, 0.3, 0.3, 0.3, FIELD]],
  materialsYard: [['box', -0.3, 0, 0, 0.9, 0.5, 1.3, WOOD], ['rock', 0.5, 0.2, 0.3, 0.45, 0.4, 0.45, STONE], ['cyl', 0.5, 0, -0.4, 0.12, 0.8, 0.12, WOOD], ['box', 0.8, 0.9, -0.4, 0.1, 0.12, 0.3, 'side']],
  tradePost: [['box', 0, 0, 0, 2.0, 0.9, 1.6, BODY], ['roof', 0, 0.9, 0, 2.2, 0.5, 1.8, 'side'], ['box', -1.1, 0.7, 0, 0.3, 0.06, 1.4, '#c2410c']],
  farm: [['flat', 0, 0.03, 0, 2.6, 1, 2.6, FIELD], ['box', 0, 0, -1.3, 2.6, 0.25, 0.06, WOOD], ['box', 0, 0, 1.3, 2.6, 0.25, 0.06, WOOD], ['box', 1.3, 0, 0, 0.06, 0.25, 2.6, WOOD], ['box', -1.1, 0, -1.1, 0.25, 0.5, 0.25, 'side']],
  mine: [['rock', 0, 0.3, 0, 1.2, 0.9, 1.2, DARK], ['box', -0.6, 0, 0, 0.4, 0.6, 0.6, WOOD], ['box', -0.75, 0.6, 0, 0.12, 0.12, 0.7, 'side']],
  barracks: [['box', 0, 0, 0, 2.6, 1.0, 1.4, BODY], ['roof', 0, 1.0, 0, 2.8, 0.6, 1.6, 'side'], ['cyl', -1.4, 0, 0.8, 0.05, 0.8, 0.05, WOOD]],
  range: [['flat', 0, 0.03, 0, 2.7, 1, 2.6, '#9f8e64'], ['box', -1.0, 0, 0, 0.8, 0.8, 1.6, BODY], ['roof', -1.0, 0.8, 0, 0.9, 0.4, 1.8, 'side'], ['cyl', 1.0, 0, -0.7, 0.25, 0.6, 0.25, '#e5e5e5'], ['cyl', 1.0, 0, 0.7, 0.25, 0.6, 0.25, '#e5e5e5']],
  stable: [['box', 0, 0, -0.5, 3.4, 0.7, 1.4, WOOD], ['roof', 0, 0.7, -0.5, 3.6, 0.4, 1.6, 'side'], ['box', 0, 0, 1.2, 3.4, 0.3, 0.06, WOOD]],
  siegeWorkshop: [['box', 0, 0, 0, 3.0, 0.4, 2.6, DARK], ['cyl', -1.2, 0, -1.0, 0.1, 2.2, 0.1, WOOD], ['cyl', 1.2, 0, -1.0, 0.1, 2.2, 0.1, WOOD], ['box', 0, 2.1, -1.0, 2.6, 0.12, 0.12, WOOD], ['roof', 0, 0.4, 0.4, 2.8, 0.6, 1.6, 'side']],
  aidPost: [['cone', 0, 0, 0, 2.2, 1.4, 2.2, '#f1f5f9'], ['box', 0, 1.2, 0, 0.5, 0.12, 0.12, '#dc2626'], ['box', 0, 1.2, 0, 0.12, 0.12, 0.5, '#dc2626']],
  tower: [['cyl', 0, 0, 0, 1.1, 2.6, 1.1, STONE], ['cyl', 0, 2.6, 0, 1.3, 0.3, 1.3, '#8f877a'], ['cone', 0, 2.9, 0, 1.3, 0.8, 1.3, 'side']]
};
// Node parts: the same primitives (a grove is a tree; herds a few animals; fish a ring of ripples).
const NODE_PARTS = {
  tree: [['cyl', 0, 0, 0, 0.12, 0.5, 0.12, '#5a3d24'], ['cone', 0, 0.45, 0, 0.9, 1.3, 0.9, '#2f6b33'], ['cone', 0.35, 0.2, 0.3, 0.6, 0.9, 0.6, '#3b7a3c']],
  stone: [['rock', 0, 0.2, 0, 0.9, 0.6, 0.8, '#9ca3af'], ['rock', 0.45, 0.1, 0.35, 0.45, 0.35, 0.45, '#b8bec6']],
  ore: [['rock', 0, 0.2, 0, 0.9, 0.6, 0.8, '#57534e'], ['rock', 0.4, 0.15, -0.3, 0.4, 0.35, 0.4, '#b45309']],
  gold: [['rock', 0, 0.2, 0, 0.8, 0.55, 0.8, '#6b6256'], ['rock', 0.25, 0.3, 0.2, 0.4, 0.35, 0.4, '#eab308'], ['rock', -0.3, 0.2, -0.2, 0.3, 0.25, 0.3, '#facc15']],
  herd: [['box', -0.3, 0.12, 0, 0.32, 0.22, 0.18, '#f5f5f4'], ['box', 0.25, 0.12, 0.25, 0.32, 0.22, 0.18, '#e7e5e4'], ['box', 0.2, 0.12, -0.3, 0.32, 0.22, 0.18, '#d6d3d1']],
  cattle: [['box', -0.3, 0.18, 0, 0.5, 0.32, 0.24, '#78350f'], ['box', 0.35, 0.18, 0.3, 0.5, 0.32, 0.24, '#a16207']],
  fish: [['flat', 0, 0.06, 0, 1.0, 1, 1.0, '#93c5fd'], ['flat', 0.25, 0.07, 0.2, 0.45, 1, 0.45, '#dbeafe']],
  farm: []
};

export class EconomyLayer {
  constructor(r) {
    this.r = r;
    this.on = !!r.setup.economy;
    this.ghost = null;
  }

  build() {
    if (!this.on) return;
    const r = this.r;
    const geos = {
      box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      roof: new ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
      cyl: new CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0),
      cone: new ConeGeometry(0.5, 1, 10).translate(0, 0.5, 0),
      rock: new DodecahedronGeometry(0.5, 0),
      flat: new CircleGeometry(0.5, 16).rotateX(-Math.PI / 2)
    };
    this.meshes = {};
    PRIMS.forEach((p) => {
      const mesh = new InstancedMesh(r.track(geos[p]), r.track(new MeshLambertMaterial({ color: '#ffffff' })), CAPACITY);
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = p !== 'flat'; mesh.receiveShadow = true;
      mesh.setColorAt(0, tmpColor.set('#ffffff'));
      r.scene.add(mesh);
      this.meshes[p] = mesh;
    });
    const ghostMat = r.track(new MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.45, depthWrite: false }));
    this.ghostMesh = new InstancedMesh(r.track(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), ghostMat, 1);
    this.ghostMesh.count = 0; this.ghostMesh.frustumCulled = false; this.ghostMesh.renderOrder = 3;
    r.scene.add(this.ghostMesh);
  }

  /** The placement ghost: { size, tx, ty, ok } in tiles, or null. */
  setGhost(g) { this.ghost = g; }

  writeParts(parts, cx, cz, scaleXZ, grow, sideColor, counts, cull, scaffold = 0) {
    const r = this.r;
    const y0 = r.heightAt(cx, cz);
    for (let k = 0; k < parts.length; k++) {
      const [p, dx, py, dz, sx, sy, sz, col] = parts[k];
      const mesh = this.meshes[p]; const n = counts[p];
      if (n >= CAPACITY) continue;
      const x = cx + dx * scaleXZ; const z = cz + dz * scaleXZ;
      tmp.position.set(x, y0 + py * grow, z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(Math.max(0.01, sx * scaleXZ), Math.max(0.01, sy * grow), Math.max(0.01, sz * scaleXZ));
      tmp.updateMatrix();
      mesh.setMatrixAt(n, tmp.matrix);
      tmpColor.set(col === 'side' ? sideColor : col);
      if (scaffold) tmpColor.lerp(SCAFFOLD, scaffold);
      mesh.setColorAt(n, tmpColor);
      counts[p] = n + 1;
    }
  }

  update(cur, cull) {
    if (!this.on || !cur?.eco) return;
    const r = this.r;
    const counts = Object.fromEntries(PRIMS.map((p) => [p, 0]));
    cur.eco.nodes.forEach((n) => {
      const x = n.x / Q; const z = n.y / Q;
      if (!cull(x, z, 3)) return;
      const left = n.amount < 0 || n.max <= 0 ? 1 : Math.max(0.35, n.amount / n.max);
      this.writeParts(NODE_PARTS[n.kind] || NODE_PARTS.stone, x, z, 1, left, '#ffffff', counts, cull);
    });
    cur.eco.buildings.forEach((b) => {
      if (!b.alive || b.proxy) return;
      const x = b.x / Q; const z = b.y / Q;
      if (!cull(x, z, b.size + 3)) return;
      const grow = b.built ? 1 : 0.15 + 0.85 * (b.progress / 100);
      const side = r.setup.sides[b.side].color;
      // The footprint is the truth: parts are laid out for a footprint of `size` and scaled by it.
      this.writeParts(PARTS[b.type] || PARTS.house, x, z, b.size / 3 * 1.1, grow, side, counts, cull, b.built ? 0 : 0.6);
    });
    PRIMS.forEach((p) => { const m = this.meshes[p]; m.count = counts[p]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    const g = this.ghost;
    if (g) {
      const cx = g.tx + g.size / 2; const cz = g.ty + g.size / 2;
      tmp.position.set(cx, r.heightAt(cx, cz), cz); tmp.rotation.set(0, 0, 0); tmp.scale.set(g.size, 0.6, g.size); tmp.updateMatrix();
      this.ghostMesh.setMatrixAt(0, tmp.matrix);
      this.ghostMesh.material.color.set(g.ok ? '#4ade80' : '#f87171');
      this.ghostMesh.count = 1; this.ghostMesh.instanceMatrix.needsUpdate = true;
    } else this.ghostMesh.count = 0;
  }

  /** HP bars for the side's damaged or unfinished buildings: [{ x, z, frac, h }]. */
  bars(cur) {
    if (!this.on || !cur?.eco) return [];
    return cur.eco.buildings.filter((b) => b.alive && !b.proxy && (b.hp < b.maxHp || !b.built)).map((b) => ({ x: b.x / Q, z: b.y / Q, frac: b.built ? b.hp / Math.max(1, b.maxHp) : b.progress / 100, h: 1.6 + b.size * 0.3, w: 1 + b.size * 0.2 }));
  }

  /** What economy thing is under a ground point: a building { kind: 'eco', index, side } or a node { kind: 'node', index }. */
  pick(g, view) {
    if (!this.on || !view?.eco) return null;
    const b = view.eco.buildings.find((e) => e.alive && !e.proxy && Math.abs(e.x / Q - g.x) <= e.size / 2 + 0.2 && Math.abs(e.y / Q - g.z) <= e.size / 2 + 0.2);
    if (b) return { kind: 'eco', index: b.idx, side: b.side };
    let best = null; let bestD = 1.0;
    view.eco.nodes.forEach((n) => { const d = (n.x / Q - g.x) ** 2 + (n.y / Q - g.z) ** 2; if (d < bestD) { bestD = d; best = { kind: 'node', index: n.i, res: n.res }; } });
    return best;
  }
}
