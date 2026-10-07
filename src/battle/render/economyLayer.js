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
// ART (plans/ART-MODELS-PLAN.md 5 and 7; the folders' README.md files): wired, the greyboxes stay
// for anything without a file.
//   buildings -> src/assets/battle/rts/rts-<age>.glb (the side's age, else the nearest earlier age
//     with a file: data/economy.js buildingArt), an object per role (expedition-camp, town-hall,
//     house (optional), food-depot, materials-yard, trade-post, farm-plot, mine, barracks, range,
//     stable, siege-workshop, aid-post, tower), fitted to the footprint; `<role>-damaged` under 70%
//     HP; while building, `construction-stage-0` (foundation) to `-3` by progress, else the role
//     rising out of the ground. Team parts take the side's colour.
//   culture skins -> src/assets/battle/rts/rts-<age>-<theme>.glb (SKIN_ROLES: barracks, tower,
//     trade-post and their -damaged): a side's buildings in its people's theme (themeOfNation,
//     else the land's style), the same age as the shared file it would use; any role or theme
//     without a skin keeps the shared building. (The town hall's skin is the civic hall the keep draws.)
//   nodes -> src/assets/battle/nature/<id>.glb (stone-outcrop, ore-outcrop, gold-vein, fish-shoal:
//     objects full, half, depleted; herd-sheep-goat, herd-cattle: an `animal` object placed a few
//     times), groves -> the battle's vegetation kit (tree-l, tree-m, felled, stump by what is
//     left). True scale: CITY_TILES_PER_UNIT tiles per model unit.
import { InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, CircleGeometry, Object3D, Color, Matrix4, Vector3 } from 'three';
import { Q } from '../sim/constants';
import { BUILDINGS, NODE_KINDS, buildingArt } from '../data/economy';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';
import { ART } from '../art/artFiles';
import { loadKit, kitObject, objectSize } from '../art/kitLoader';
import { KitInstances, kitLodForZoom } from '../art/kitInstances';

export { kitLodForZoom };
import { vegetationKitFor } from '../art/vegetation';
import { themeOfNation, styleOfLand } from '../../data/architecture';

/** The roles that take a culture skin (plans/ART-MODELS-PLAN.md 5). */
export const SKIN_ROLES = new Set(['barracks', 'tower', 'trade-post']);
/** A battle side's building theme: its people's, else its land's. */
export const sideTheme = (sd) => (sd ? themeOfNation(sd.nationId) || styleOfLand(sd.nationId, sd.ageId) : null);

const PRIMS = ['box', 'roof', 'cyl', 'cone', 'rock', 'flat'];
const CAPACITY = 3072;
const tmp = new Object3D();
const tmpColor = new Color();
const SCAFFOLD = new Color('#c8a165');

// A building's parts in tiles from its centre: [prim, dx, y0, dz, sx, sy, sz, colour ('side' = the
// side's colour)]. Sizes are fractions of the footprint so the footprint stays the truth.
const BODY = '#b8a888'; const WOOD = '#8a6a43'; const DARK = '#5b5148'; const STONE = '#a39c8c'; const FIELD = '#b9b061';
export const PARTS = { // exported for the build menu icons (scripts/art/build-icons.mjs)
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

const M = new Matrix4();
const V = new Vector3();
/** A node's state object by what is left of it. */
export const nodeStateNames = (frac) => (frac > 0.5 ? ['full', 'half'] : frac > 0.12 ? ['half', 'full'] : ['depleted', 'half', 'full']);
/** A grove's tree by what is left of it. */
export const groveNames = (frac) => (frac > 0.6 ? ['tree-l', 'tree-m'] : frac > 0.25 ? ['tree-m', 'tree-l'] : frac > 0 ? ['felled', 'stump', 'tree-m'] : ['stump', 'felled', 'tree-m']);
/** The construction stage object for a build progress (0..100). */
export const constructionStage = (progress) => `construction-stage-${Math.min(3, Math.floor(Math.max(0, progress) / 25))}`;
// Herd animals round a herd node (tiles from its centre, yaw).
const HERD_SPOTS = { herd: [[-0.3, 0, 0.4], [0.25, 0.25, 2.1], [0.2, -0.3, 4.0]], cattle: [[-0.3, 0, 0.6], [0.35, 0.3, 2.6]] };

export class EconomyLayer {
  /** `art` and `loadKit`: the art index and kit loader (tests pass their own). */
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r;
    this.art = art; this.loadKit = load;
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
    // Art files (none: everything stays a greybox, nothing is loaded).
    this.kits = new KitInstances(r.scene, { track: (x) => r.track(x) });
    this.loaded = new Map(); // url -> kit
    this.ready = []; // the loads in flight (tests wait on them)
    const art = this.art;
    const want = (ref) => {
      if (!ref || this.loaded.has(ref.url)) return;
      this.loaded.set(ref.url, null);
      this.ready.push(this.loadKit(ref.url).then((kit) => { if (!this.disposed) this.loaded.set(ref.url, kit); })
        .catch((e) => console.warn(`[art] ${e.message}: keeping the greyboxes`)));
    };
    this.rtsUrl = (ageId, type) => {
      const b = buildingArt(type, ageId, (a) => art.rts(a)?.ageId === a);
      return b ? art.rts(b.ageId).url : null;
    };
    // each side's culture skin, for the age of the shared file it uses
    this.skinRef = r.setup.sides.map((sd) => { const base = art.rts(sd.ageId); return base && art.rtsSkin ? art.rtsSkin(base.ageId, sideTheme(sd)) : null; });
    r.setup.sides.forEach((sd, i) => { want(art.rts(sd.ageId)); want(this.skinRef[i]); });
    this.nodeRef = {};
    Object.entries(NODE_KINDS).forEach(([kind, k]) => { this.nodeRef[kind] = k.art === 'vegetation' ? art.vegetation(vegetationKitFor(r.setup)) : art.nature(k.art); });
    const kinds = new Set((r.setup.economy?.nodes || []).map((n) => n.kind));
    Object.entries(this.nodeRef).forEach(([kind, ref]) => { if (!kinds.size || kinds.has(kind)) want(ref); });
  }

  kit(ref) { return ref ? this.loaded.get(ref.url) || null : null; }

  // A node from its art file, or false (the greybox draws it).
  writeNodeArt(n, x, z, frac, lod) {
    const kit = this.kit(this.nodeRef[n.kind]);
    if (!kit) return false;
    const S = CITY_TILES_PER_UNIT;
    const y = this.r.heightAt(x, z);
    if (n.kind === 'herd' || n.kind === 'cattle') {
      const animal = kitObject(kit, 'animal', 'full', Object.keys(kit.objects)[0]);
      if (!animal) return false;
      const spots = HERD_SPOTS[n.kind];
      const count = Math.max(1, Math.ceil(spots.length * Math.max(0.34, frac)));
      for (let k = 0; k < count; k++) {
        const [dx, dz, yaw] = spots[k];
        this.kits.add(animal, lod, M.makeRotationY(yaw).scale(V.setScalar(S)).setPosition(x + dx, this.r.heightAt(x + dx, z + dz), z + dz));
      }
      return true;
    }
    const obj = kitObject(kit, n.kind === 'tree' ? groveNames(frac) : nodeStateNames(frac));
    if (!obj) return false;
    this.kits.add(obj, lod, M.makeRotationY(((n.i ?? 0) * 2.39996) % 6.283).scale(V.setScalar(S)).setPosition(x, y, z));
    return true;
  }

  // A building from its age's file, or false (the greybox draws it).
  writeBuildingArt(b, x, z, side, lod) {
    const ageId = this.r.setup.sides[b.side]?.ageId;
    const url = this.rtsUrl(ageId, b.type);
    const kit = url ? this.loaded.get(url) : null;
    if (!kit) return false;
    const role = BUILDINGS[b.type]?.art;
    const skin = SKIN_ROLES.has(role) ? this.kit(this.skinRef?.[b.side]) : null;
    const own = skin && kitObject(skin, role) ? skin : kit; // the side's theme, else the shared file
    const whole = kitObject(own, role);
    if (!whole) return false;
    const fit = (obj) => (b.size * 0.95) / Math.max(0.05, objectSize(obj).footprint);
    const y = this.r.heightAt(x, z);
    tmpColor.set(side);
    if (!b.built) {
      const stage = kitObject(kit, constructionStage(b.progress));
      if (stage) { this.kits.add(stage, lod, M.makeScale(fit(stage), fit(stage), fit(stage)).setPosition(x, y, z), tmpColor); return true; }
      const s = fit(whole); const grow = 0.15 + 0.85 * (b.progress / 100);
      this.kits.add(whole, lod, M.makeScale(s, s * grow, s).setPosition(x, y, z), tmpColor);
      return true;
    }
    const obj = (b.hp < b.maxHp * 0.7 && kitObject(own, `${role}-damaged`)) || whole;
    const s = fit(whole);
    this.kits.add(obj, lod, M.makeScale(s, s, s).setPosition(x, y, z), tmpColor);
    return true;
  }

  dispose() { this.disposed = true; this.kits?.dispose(); }

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
    const lod = kitLodForZoom(r.camera.zoom);
    this.kits.begin();
    cur.eco.nodes.forEach((n) => {
      const x = n.x / Q; const z = n.y / Q;
      if (!cull(x, z, 3)) return;
      const frac = n.amount < 0 || n.max <= 0 ? 1 : n.amount / n.max;
      if (this.writeNodeArt(n, x, z, frac, lod)) return;
      const left = Math.max(0.35, frac);
      this.writeParts(NODE_PARTS[n.kind] || NODE_PARTS.stone, x, z, 1, left, '#ffffff', counts, cull);
    });
    cur.eco.buildings.forEach((b) => {
      if (!b.alive || b.proxy) return;
      const x = b.x / Q; const z = b.y / Q;
      if (!cull(x, z, b.size + 3)) return;
      const grow = b.built ? 1 : 0.15 + 0.85 * (b.progress / 100);
      const side = r.setup.sides[b.side].color;
      if (this.writeBuildingArt(b, x, z, side, lod)) return;
      // The footprint is the truth: parts are laid out for a footprint of `size` and scaled by it.
      this.writeParts(PARTS[b.type] || PARTS.house, x, z, b.size / 3 * 1.1, grow, side, counts, cull, b.built ? 0 : 0.6);
    });
    this.kits.end();
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

  /** HP bars for damaged or unfinished buildings and the inspected one (`picked`, its idx): [{ x, z, frac, h, w }].
   *  A site's HP rises with the work (sim/economy.js), so its bar fills as it goes up (AoE style). */
  bars(cur, picked = -1) {
    if (!this.on || !cur?.eco) return [];
    return cur.eco.buildings.filter((b) => b.alive && !b.proxy && (b.hp < b.maxHp || !b.built || b.idx === picked)).map((b) => ({ x: b.x / Q, z: b.y / Q, frac: b.hp / Math.max(1, b.maxHp), h: 1.6 + b.size * 0.3, w: 1 + b.size * 0.2 }));
  }

  /** What economy thing is under a ground point: a building { kind: 'eco', index, side } or a node { kind: 'node', index }.
   *  `margin` (tiles) grows each footprint so a building is an easy target. */
  pick(g, view, margin = 0.2) {
    if (!this.on || !view?.eco) return null;
    const b = view.eco.buildings.find((e) => e.alive && !e.proxy && Math.abs(e.x / Q - g.x) <= e.size / 2 + margin && Math.abs(e.y / Q - g.z) <= e.size / 2 + margin);
    if (b) return { kind: 'eco', index: b.idx, side: b.side };
    let best = null; let bestD = 1.0;
    view.eco.nodes.forEach((n) => { const d = (n.x / Q - g.x) ** 2 + (n.y / Q - g.z) ** 2; if (d < bestD) { bestD = d; best = { kind: 'node', index: n.i, res: n.res }; } });
    return best;
  }
}
