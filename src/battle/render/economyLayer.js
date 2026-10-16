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
//     HP; `<role>-ruined` once it is destroyed (a dead building stays in the view: its wreck is
//     drawn until something is built over it; no file, no wreck); while building, `construction-stage-0` (foundation) to `-3` by progress, else the role
//     rising out of the ground. Team parts take the side's colour.
//   culture skins -> src/assets/battle/rts/rts-<age>-<theme>.glb (SKIN_ROLES: barracks, tower,
//     trade-post and their -damaged): a side's buildings in its people's theme (themeOfNation,
//     else the land's style), the same age as the shared file it would use; any role or theme
//     without a skin keeps the shared building. (The town hall's skin is the civic hall the keep draws.)
//   nodes -> src/assets/battle/nature/<id>.glb (stone-outcrop, gold-vein, fish-shoal (no ore: Q1, X29):
//     objects full, half, depleted; herd-sheep-goat, herd-cattle: an `animal` object placed a few
//     times), groves -> the battle's vegetation kit (tree-l, tree-m, felled, stump by what is
//     left, and the kit's log-pile beside it: the mark of a wood node). True scale:
//     CITY_TILES_PER_UNIT tiles per model unit.
//   woods (W12: every tree is wood) -> the forest's own trees are the node (render/treeFelling.js
//     thins them to stumps); this layer adds only a log pile by the tree being cut once a wood is
//     being worked, and a tap anywhere on a wood's trees picks it.
import { InstancedMesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, CircleGeometry, Object3D, Color, Matrix4, Vector3 } from 'three';
import { Q, TICK_HZ } from '../sim/constants';
import { BUILDINGS, NODE_KINDS, buildingArt } from '../data/economy';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';
import { ART } from '../art/artFiles';
import { loadKit, kitObject, objectSize } from '../art/kitLoader';
import { KitInstances, kitLodForZoom } from '../art/kitInstances';

export { kitLodForZoom };
import { vegetationKitFor } from '../art/vegetation';
import { loadObjectName, usesBarrow, BARROW_EMPTY, workerLoadPlacement } from '../art/workerLoads';
import { themeOfNation, styleOfLand } from '../../data/architecture';
import { OwnerMarks } from './ownerMarks';

/** The roles that take a culture skin (plans/ART-MODELS-PLAN.md 5). */
export const SKIN_ROLES = new Set(['barracks', 'tower', 'trade-post']);
/** A battle side's building theme: its people's, else its land's. */
export const sideTheme = (sd) => (sd ? themeOfNation(sd.nationId) || styleOfLand(sd.nationId, sd.ageId) : null);

const PRIMS = ['box', 'roof', 'cyl', 'cone', 'rock', 'flat'];
const OVERLAY_CAPACITY = 4096;
// The land skirt the renderer draws past the field (terrainSurface.js: 40 tiles) is shaded while placing.
const OUT_OF_PLAY_TILES = 44;
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
  gold: [['rock', 0, 0.2, 0, 0.8, 0.55, 0.8, '#6b6256'], ['rock', 0.25, 0.3, 0.2, 0.4, 0.35, 0.4, '#eab308'], ['rock', -0.3, 0.2, -0.2, 0.3, 0.25, 0.3, '#facc15']],
  herd: [['box', -0.3, 0.12, 0, 0.32, 0.22, 0.18, '#f5f5f4'], ['box', 0.25, 0.12, 0.25, 0.32, 0.22, 0.18, '#e7e5e4'], ['box', 0.2, 0.12, -0.3, 0.32, 0.22, 0.18, '#d6d3d1']],
  cattle: [['box', -0.3, 0.18, 0, 0.5, 0.32, 0.24, '#78350f'], ['box', 0.35, 0.18, 0.3, 0.5, 0.32, 0.24, '#a16207']],
  fish: [['flat', 0, 0.06, 0, 1.0, 1, 1.0, '#93c5fd'], ['flat', 0.25, 0.07, 0.2, 0.45, 1, 0.45, '#dbeafe']],
  // W12: berry bushes (no art file yet: berry-bushes.glb), green mounds with red berries
  berries: [['rock', -0.25, 0.15, 0, 0.55, 0.45, 0.55, '#3f6d2f'], ['rock', 0.3, 0.12, 0.2, 0.45, 0.38, 0.45, '#4b7a36'], ['rock', 0.05, 0.12, -0.32, 0.4, 0.34, 0.4, '#355f29'],
    ['rock', -0.2, 0.36, 0.15, 0.09, 0.09, 0.09, '#c2253a'], ['rock', 0.32, 0.3, 0.1, 0.08, 0.08, 0.08, '#d03045'], ['rock', 0.0, 0.3, -0.3, 0.08, 0.08, 0.08, '#b31d33']],
  farm: []
};
// A worked wood's log pile without art (W12).
const LOG_PARTS = [['box', 0, 0, 0, 0.55, 0.13, 0.26, '#8a6a43'], ['box', 0.02, 0.13, 0.01, 0.48, 0.12, 0.22, '#7a5a35'], ['box', -0.02, 0.25, 0, 0.4, 0.1, 0.18, '#94744b']];
// A spent grove without art: two stumps (X31).
const STUMP_PARTS = [['cyl', -0.15, 0, 0.1, 0.22, 0.18, 0.22, '#6b4a2e'], ['cyl', 0.25, 0, -0.15, 0.18, 0.14, 0.18, '#5a3d24']];
// A load without the loads kit: a small block of the resource's colour on the back.
const LOAD_COLOR = { food: '#c8a24a', wood: '#8a6a43', stone: '#b8bec6', gold: '#eab308' };

/**
 * X28 / X32: the kit object a laborer shows for a `carrying` entry ({ res, load }): the loaded
 * barrow or back load while it carries, the empty barrow on the way out for a barrow resource,
 * else null. Pure (tests).
 */
export const workerLoadObject = (c) => {
  const barrow = usesBarrow(c.res);
  if (c.load > 0) return loadObjectName(c.res, { nodeKind: c.kind, barrow });
  return barrow ? BARROW_EMPTY : null;
};

const M = new Matrix4();
const V = new Vector3();
/** A node's state object by what is left of it. */
export const nodeStateNames = (frac) => (frac > 0.5 ? ['full', 'half'] : frac > 0.12 ? ['half', 'full'] : ['depleted', 'half', 'full']);
/** A grove's tree by what is left of it. */
export const groveNames = (frac) => (frac > 0.6 ? ['tree-l', 'tree-m'] : frac > 0.25 ? ['tree-m', 'tree-l'] : frac > 0 ? ['felled', 'stump', 'tree-m'] : ['stump', 'felled', 'tree-m']);
/** The construction stage object for a build progress (0..100). */
export const constructionStage = (progress) => `construction-stage-${Math.min(3, Math.floor(Math.max(0, progress) / 25))}`;
/** How far from a grove's centre its log pile stands (tiles). */
export const LOG_PILE_OFFSET = 0.7;
/** The file of log piles for the kits that have none (objects `log-pile-<kit>`), and those kits. */
export const LOG_PILES_FILE = 'log-piles';
export const LOG_PILE_FILE_KITS = ['conifer', 'tropical', 'cold'];
/**
 * A finished building's state object (manifest row MD13): `<role>-ruined` once it is destroyed
 * (dead but still in the view), `<role>-damaged` under 70% HP, else the whole building. A building
 * that never stood (a cancelled or razed building site) leaves nothing: null.
 */
export const buildingStateName = (b, role) => {
  if (!b.alive) return b.built ? `${role}-ruined` : null;
  return b.hp < b.maxHp * 0.7 ? `${role}-damaged` : role;
};
/** How far from a node's centre a tap still picks it (tiles; U04): a grove by its canopy and log pile. */
export const nodePickRadius = (kind) => (kind === 'tree' ? 1.4 : kind === 'herd' || kind === 'cattle' ? 1.2 : 1.0);
/** City and fort structures that carry the defender's owner mark (I209). */
const OWNED_STRUCTURES = new Set(['keep', 'tower', 'building']);
/** What a wreck's socket empty gives off (X27): 'fire', 'smoke' or null (any other socket). */
export const wreckFxKind = (name) => (/^socket[-_]fire/i.test(name) ? 'fire' : /^socket[-_]smoke/i.test(name) ? 'smoke' : null);
/** How long a wreck's fire burns before it is out, in battle seconds (counted in sim ticks, so pause and speed follow). */
export const WRECK_FIRE_SECONDS = 30;
/** The thinnest a wreck's smoke gets once its fire is out (share of the full column's alpha). */
export const WRECK_SMOKE_MIN = 0.6;
/** Fire strength 1 (full) to 0 (out) for a wreck `ticks` sim ticks after it was destroyed. */
export const wreckFireStrength = (ticks) => Math.max(0, Math.min(1, 1 - Math.max(0, ticks) / (WRECK_FIRE_SECONDS * TICK_HZ)));
/** Smoke strength for the same age: full while the fire burns, a little thinner once it is out. */
export const wreckSmokeStrength = (ticks) => WRECK_SMOKE_MIN + (1 - WRECK_SMOKE_MIN) * wreckFireStrength(ticks);
/** True when a standing building covers the wreck `b` (the player built over the rubble). */
export const ruinCovered = (b, buildings) => buildings.some((o) => o.alive && o.idx !== b.idx
  && Math.abs(o.x - b.x) < ((o.size + b.size) / 2) * Q && Math.abs(o.y - b.y) < ((o.size + b.size) / 2) * Q);
// Herd animals round a herd node (tiles from its centre, yaw).
const HERD_SPOTS = { herd: [[-0.3, 0, 0.4], [0.25, 0.25, 2.1], [0.2, -0.3, 4.0]], cattle: [[-0.3, 0, 0.6], [0.35, 0.3, 2.6]] };

const PENDING_GHOSTS = 8; // buildings ordered while paused, drawn at once

export class EconomyLayer {
  /** `art` and `loadKit`: the art index and kit loader (tests pass their own). */
  constructor(r, { art = ART, load = loadKit } = {}) {
    this.r = r;
    this.art = art; this.loadKit = load;
    this.on = !!r.setup.economy;
    // W12: which wood node each forest tile belongs to (a tap on any of its trees picks it)
    const map = r.setup.map; const nodes = r.setup.economy?.nodes || [];
    this.woodTile = null;
    if (map && nodes.some((n) => n.trees)) {
      this.woodTile = new Int32Array(map.w * map.h).fill(-1);
      nodes.forEach((n, i) => (n.trees || []).forEach((t) => { this.woodTile[t] = i; }));
    }
    this.ghost = null;
    this.deadSince = new Map(); // building idx -> sim tick it was first seen destroyed (drawing only)
    this.wreckFx = []; // this frame's wreck fire and smoke points (X27), refilled by update()
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
    // On top of trees and rocks (depthTest off), so a red spot in a wood is seen (B10).
    const ghostMat = r.track(new MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.5, depthWrite: false, depthTest: false }));
    this.ghostMesh = new InstancedMesh(r.track(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), ghostMat, 1);
    this.ghostMesh.count = 0; this.ghostMesh.frustumCulled = false; this.ghostMesh.renderOrder = 19;
    r.scene.add(this.ghostMesh);
    // Buildings ordered while paused (RTS-03): a fainter brass footprint until the sim takes the order.
    const pendingMat = r.track(new MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.35, depthWrite: false, depthTest: false }));
    this.pendingMesh = new InstancedMesh(r.track(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), pendingMat, PENDING_GHOSTS);
    this.pendingMesh.count = 0; this.pendingMesh.frustumCulled = false; this.pendingMesh.renderOrder = 18;
    r.scene.add(this.pendingMesh);
    // The placement overlay (UI06; I173 to I175): legal ground tinted, the tiles resources block,
    // the real edge of the field and the land past it shaded out of play. Shown only while placing.
    const flat = r.track(new BoxGeometry(1, 0.04, 1));
    const overlay = (color, opacity, n, order) => {
      const m = new InstancedMesh(flat, r.track(new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false })), n);
      m.count = 0; m.frustumCulled = false; m.renderOrder = order; r.scene.add(m);
      return m;
    };
    this.legalMesh = overlay('#86efac', 0.4, OVERLAY_CAPACITY, 16);
    this.blockedMesh = overlay('#f87171', 0.45, 256, 17);
    this.outMesh = overlay('#0b0f14', 0.55, 4, 15);
    this.edgeMesh = overlay('#fde68a', 0.9, 4, 18);
    // Whose building it is, by shape as well as colour (I209: ownerMarks.js).
    this.owners = new OwnerMarks(r);
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
    // A kit without a log pile of its own (conifer, tropical, cold: built by another pipeline) takes its
    // climate's pile from the shared file; any other kit without one draws the tree alone.
    this.pileRef = LOG_PILE_FILE_KITS.includes(this.nodeRef.tree?.kit) && (!kinds.size || kinds.has('tree')) ? art.nature(LOG_PILES_FILE) : null;
    want(this.pileRef);
    // What the player's laborers carry (X28): the loads kit of the player's age (art/workerLoads.js).
    this.loadsRef = art.workerLoads ? art.workerLoads(r.setup.sides[r.playerSide ?? 0]?.ageId) : null;
    want(this.loadsRef);
  }

  /** The player's laborers' loads (X28, X32): a barrow or a back load per `eco.carrying` entry, where
   *  the laborer's figure was drawn this frame (BattleRenderer.soldierMemo, after drawSquads). */
  writeLoads(cur, cull, lod, counts) {
    const memo = this.r.soldierMemo;
    if (!memo || !cur.eco.carrying?.length) return;
    const kit = this.kit(this.loadsRef);
    cur.eco.carrying.forEach((c) => {
      const m = memo.get(c.idx);
      if (!m || !cull(m.x, m.z, 1)) return;
      const name = workerLoadObject(c);
      if (!name) return;
      const yaw = Math.atan2(m.fx, m.fz);
      const barrow = name.startsWith('barrow');
      const obj = kit ? kitObject(kit, name) : null;
      if (obj) {
        const p = workerLoadPlacement(m.x, this.r.heightAt(m.x, m.z), m.z, yaw, { barrow });
        this.kits.add(obj, lod, M.makeRotationY(p.yaw).scale(V.setScalar(p.scale)).setPosition(p.x, p.y, p.z));
        return;
      }
      if (c.load <= 0) return; // no art: only a real load gets the stand-in block
      this.writeParts([['box', -m.fx * 0.12, 0.42, -m.fz * 0.12, 0.2, 0.18, 0.2, LOAD_COLOR[c.res] || '#a8a29e']], m.x, m.z, 1, 1, '#ffffff', counts, cull);
    });
  }

  kit(ref) { return ref ? this.loaded.get(ref.url) || null : null; }

  /** The shared file's log pile for the battle's vegetation kit, or null (not loaded, or no such pile). */
  sharedPile() { return kitObject(this.kit(this.pileRef), `log-pile-${this.nodeRef.tree?.kit}`); }

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
    const yaw = ((n.i ?? 0) * 2.39996) % 6.283;
    this.kits.add(obj, lod, M.makeRotationY(yaw).scale(V.setScalar(S)).setPosition(x, y, z));
    // A grove is a wood node, not one more tree: a pile of cut logs stands beside it (MD06).
    // (a spent grove keeps its stumps but no pile: nothing left to cut, X31)
    const pile = n.kind === 'tree' && !n.spent ? kitObject(kit, 'log-pile') || this.sharedPile() : null;
    if (pile) {
      const px = x + Math.cos(yaw) * LOG_PILE_OFFSET; const pz = z + Math.sin(yaw) * LOG_PILE_OFFSET;
      this.kits.add(pile, lod, M.makeRotationY(yaw + 0.9).scale(V.setScalar(S)).setPosition(px, this.r.heightAt(px, pz), pz));
    }
    return true;
  }

  /** W12: a wood is its own trees; once it is being worked a pile of cut logs lies by the tree being cut. */
  writeWood(n, x, z, lod, counts, cull) {
    if (n.spent || (!(n.cut > 0) && n.amount >= n.max)) return;
    const yaw = ((n.i ?? 0) * 2.39996) % 6.283;
    const px = x + Math.cos(yaw) * LOG_PILE_OFFSET; const pz = z + Math.sin(yaw) * LOG_PILE_OFFSET;
    const kit = this.kit(this.nodeRef.tree);
    const pile = kit ? kitObject(kit, 'log-pile') || this.sharedPile() : null;
    if (pile) { this.kits.add(pile, lod, M.makeRotationY(yaw + 0.9).scale(V.setScalar(CITY_TILES_PER_UNIT)).setPosition(px, this.r.heightAt(px, pz), pz)); return; }
    this.writeParts(LOG_PARTS, px, pz, 1, 1, '#ffffff', counts, cull);
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
    if (!b.alive) {
      // the wreck, at the scale of the building it was (a skin without one takes the shared file's)
      const name = buildingStateName(b, role);
      const from = name && (kitObject(own, name) ? own : kitObject(kit, name) && kitObject(kit, role) ? kit : null);
      if (!from) return false;
      const s = fit(kitObject(from, role));
      const wreck = kitObject(from, name);
      this.kits.add(wreck, lod, M.makeScale(s, s, s).setPosition(x, y, z), tmpColor);
      this.addWreckFx(wreck, x, y, z, s, b.idx, this.tick - (this.deadSince.get(b.idx) ?? this.tick));
      return true;
    }
    if (!b.built) {
      const stage = kitObject(kit, constructionStage(b.progress));
      if (stage) { this.kits.add(stage, lod, M.makeScale(fit(stage), fit(stage), fit(stage)).setPosition(x, y, z), tmpColor); return true; }
      const s = fit(whole); const grow = 0.15 + 0.85 * (b.progress / 100);
      this.kits.add(whole, lod, M.makeScale(s, s * grow, s).setPosition(x, y, z), tmpColor);
      return true;
    }
    const obj = kitObject(own, buildingStateName(b, role)) || whole;
    const s = fit(whole);
    this.kits.add(obj, lod, M.makeScale(s, s, s).setPosition(x, y, z), tmpColor);
    return true;
  }

  /** X27: a wreck's `socket-fire-*` and `socket-smoke-*` empties, in world tiles, for this frame's
   *  fire and smoke (BattleRenderer draws them from `this.wreckFx`; the wreck stays burnt black). */
  addWreckFx(obj, x, y, z, s, idx, age = 0) {
    const sockets = obj?.sockets;
    if (!sockets) return;
    const fire = wreckFireStrength(age); const smoke = wreckSmokeStrength(age);
    Object.entries(sockets).forEach(([name, p]) => {
      const kind = wreckFxKind(name);
      // the fire dies down over WRECK_FIRE_SECONDS and is then not drawn at all; the smoke stays, a little thinner
      if (kind === 'fire' && fire <= 0) return;
      if (kind) this.wreckFx.push({ kind, strength: kind === 'fire' ? fire : smoke, x: x + p.x * s, y: y + p.y * s, z: z + p.z * s, phase: idx * 0.37 + this.wreckFx.length * 0.53 });
    });
  }

  /** A structure's square on the ground for its owner mark: its footprint's bounds, else its circle. Cached. */
  structureBox(i, st) {
    this.boxes = this.boxes || [];
    if (this.boxes[i] !== undefined) return this.boxes[i];
    const fixed = this.r.setup.structures?.[i];
    const w = this.r.setup.map?.w;
    let box = null;
    if (fixed?.underHall) box = null;
    else if (fixed?.footprint?.length && w) {
      let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
      fixed.footprint.forEach((t) => { const tx = t % w; const tz = (t - tx) / w; x0 = Math.min(x0, tx); x1 = Math.max(x1, tx + 1); z0 = Math.min(z0, tz); z1 = Math.max(z1, tz + 1); });
      box = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, size: Math.max(x1 - x0, z1 - z0) };
    } else box = { x: st.x / Q, z: st.y / Q, size: Math.max(1, (2 * (st.radius || Q)) / Q) };
    this.boxes[i] = box;
    return box;
  }

  dispose() { this.disposed = true; this.kits?.dispose(); }

  /** The placement ghost: { size, tx, ty, ok } in tiles, or null. */
  setGhost(g) { this.ghost = g; }

  /** Buildings ordered while paused: [{ size, tx, ty }] in tiles (pendingMarks.js). */
  setPendingGhosts(list) { this.pendingGhosts = list || []; }

  /**
   * The placement overlay (UI06), or null to hide it: { cells } a Uint8Array over the map, 1 where
   * a footprint centred on the tile is legal (input/placement.js legalArea). The resource tiles and
   * the field edge are drawn with it.
   */
  setPlacementOverlay(o) { this.overlay = o; this.overlayDirty = true; }

  writeOverlay() {
    const r = this.r; const o = this.overlay;
    if (!o) { this.legalMesh.count = 0; this.blockedMesh.count = 0; this.outMesh.count = 0; this.edgeMesh.count = 0; return; }
    const { w, h } = r.setup.map;
    const put = (mesh, k, x, z, sx, sz, lift = 0.06) => {
      tmp.position.set(x, r.heightAt(Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, z))) + lift, z);
      tmp.rotation.set(0, 0, 0); tmp.scale.set(sx, 1, sz); tmp.updateMatrix();
      mesh.setMatrixAt(k, tmp.matrix);
    };
    if (this.overlayDirty) {
      this.overlayDirty = false;
      let n = 0;
      for (let i = 0; i < o.cells.length && n < OVERLAY_CAPACITY; i++) if (o.cells[i]) put(this.legalMesh, n++, (i % w) + 0.5, Math.floor(i / w) + 0.5, 0.72, 0.72); // a tile grid, so legal ground reads as such
      this.legalMesh.count = n; this.legalMesh.instanceMatrix.needsUpdate = true;
      // Past the field: four wide bands over the skirt the renderer draws (it is no field).
      const S = OUT_OF_PLAY_TILES;
      put(this.outMesh, 0, -S / 2, h / 2, S, h + 2 * S, 0.3); put(this.outMesh, 1, w + S / 2, h / 2, S, h + 2 * S, 0.3);
      put(this.outMesh, 2, w / 2, -S / 2, w, S, 0.3); put(this.outMesh, 3, w / 2, h + S / 2, w, S, 0.3);
      this.outMesh.count = 4; this.outMesh.instanceMatrix.needsUpdate = true;
      // The real edge of the field, a bright line round it.
      const L = 0.12;
      put(this.edgeMesh, 0, 0, h / 2, L, h, 0.32); put(this.edgeMesh, 1, w, h / 2, L, h, 0.32);
      put(this.edgeMesh, 2, w / 2, 0, w, L, 0.32); put(this.edgeMesh, 3, w / 2, h, w, L, 0.32);
      this.edgeMesh.count = 4; this.edgeMesh.instanceMatrix.needsUpdate = true;
    }
    // The tiles a resource takes (never built over), from this frame's nodes.
    let b = 0;
    (r.lastView?.eco?.nodes || []).forEach((n) => {
      if (n.spent || n.kind === 'farm' || n.trees != null || b >= 256) return; // a wood's trees are forest, refused as ground already
      put(this.blockedMesh, b++, Math.floor(n.x / Q) + 0.5, Math.floor(n.y / Q) + 0.5, 0.9, 0.9, 0.08);
    });
    this.blockedMesh.count = b; this.blockedMesh.instanceMatrix.needsUpdate = true;
  }

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
    this.wreckFx.length = 0;
    // when each wreck was first seen destroyed, in sim ticks (a view without a tick counts as one frame)
    this.tick = cur.tick ?? this.tick ?? 0;
    cur.eco.buildings.forEach((b) => {
      if (b.proxy) return;
      if (b.alive) this.deadSince.delete(b.idx);
      else if (b.built && !this.deadSince.has(b.idx)) this.deadSince.set(b.idx, this.tick);
    });
    this.kits.begin();
    cur.eco.nodes.forEach((n) => {
      const x = n.x / Q; const z = n.y / Q;
      if (!cull(x, z, 3)) return;
      if (n.trees != null) { this.writeWood(n, x, z, lod, counts, cull); return; }
      const frac = n.spent ? 0 : n.amount < 0 || n.max <= 0 ? 1 : n.amount / n.max;
      if (this.writeNodeArt(n, x, z, frac, lod)) return;
      if (n.spent) { this.writeParts(STUMP_PARTS, x, z, 1, 1, '#ffffff', counts, cull); return; } // X31
      const left = Math.max(0.35, frac);
      this.writeParts(NODE_PARTS[n.kind] || NODE_PARTS.stone, x, z, 1, left, '#ffffff', counts, cull);
    });
    this.writeLoads(cur, cull, lod, counts);
    this.owners.begin();
    cur.eco.buildings.forEach((b) => {
      if (b.proxy) return;
      const x = b.x / Q; const z = b.y / Q;
      if (!cull(x, z, b.size + 3)) return;
      if (!b.alive) {
        // a destroyed building leaves its wreck (only as art: no greybox), until something is built over it
        if (b.built && !ruinCovered(b, cur.eco.buildings)) this.writeBuildingArt(b, x, z, r.setup.sides[b.side].color, lod);
        return;
      }
      this.owners.mark(b.side, x, z, b.size);
      const grow = b.built ? 1 : 0.15 + 0.85 * (b.progress / 100);
      const side = r.setup.sides[b.side].color;
      if (this.writeBuildingArt(b, x, z, side, lod)) return;
      // The footprint is the truth: parts are laid out for a footprint of `size` and scaled by it.
      this.writeParts(PARTS[b.type] || PARTS.house, x, z, b.size / 3 * 1.1, grow, side, counts, cull, b.built ? 0 : 0.6);
    });
    // The defender's city and fort buildings (the keep, its towers and the region's buildings) carry
    // the defender's mark too: in a city assault they are the enemy's base (I209).
    (cur.structures || []).forEach((st, i) => {
      if (!st.alive || !OWNED_STRUCTURES.has(st.kind)) return;
      const box = this.structureBox(i, st);
      if (box && cull(box.x, box.z, box.size + 3)) this.owners.mark(1, box.x, box.z, box.size);
    });
    this.kits.end();
    this.owners.end();
    PRIMS.forEach((p) => { const m = this.meshes[p]; m.count = counts[p]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    const g = this.ghost;
    if (g) {
      const cx = g.tx + g.size / 2; const cz = g.ty + g.size / 2;
      tmp.position.set(cx, r.heightAt(cx, cz), cz); tmp.rotation.set(0, 0, 0); tmp.scale.set(g.size, 0.6, g.size); tmp.updateMatrix();
      this.ghostMesh.setMatrixAt(0, tmp.matrix);
      this.ghostMesh.material.color.set(g.ok ? '#4ade80' : '#f87171');
      this.ghostMesh.count = 1; this.ghostMesh.instanceMatrix.needsUpdate = true;
    } else this.ghostMesh.count = 0;
    const pend = this.pendingGhosts || [];
    let pn = 0;
    for (let k = 0; k < pend.length && pn < PENDING_GHOSTS; k++) {
      const p = pend[k]; if (!(p.size > 0)) continue;
      const cx = p.tx + p.size / 2; const cz = p.ty + p.size / 2;
      tmp.position.set(cx, r.heightAt(cx, cz), cz); tmp.rotation.set(0, 0, 0); tmp.scale.set(p.size, 0.45, p.size); tmp.updateMatrix();
      this.pendingMesh.setMatrixAt(pn, tmp.matrix); pn += 1;
    }
    this.pendingMesh.count = pn; if (pn) this.pendingMesh.instanceMatrix.needsUpdate = true;
    this.writeOverlay();
  }

  /** HP bars for damaged or unfinished buildings and the inspected one (`picked`, its idx): [{ x, z, frac, h, w }].
   *  A site's HP rises with the work (sim/economy.js), so its bar fills as it goes up (AoE style). */
  bars(cur, picked = -1) {
    if (!this.on || !cur?.eco) return [];
    // A site's bar is wider and brass (it is the build, not damage) and sits above its scaffold.
    return cur.eco.buildings.filter((b) => b.alive && !b.proxy && (b.hp < b.maxHp || !b.built || b.idx === picked)).map((b) => ({
      x: b.x / Q, z: b.y / Q, frac: b.hp / Math.max(1, b.maxHp), site: !b.built, progress: b.progress, side: b.side,
      h: b.built ? 1.6 + b.size * 0.3 : 2.2 + b.size * 0.35, w: b.built ? 1 + b.size * 0.2 : 1.4 + b.size * 0.45
    }));
  }

  /** What economy thing is under a ground point: a building { kind: 'eco', index, side } or a node { kind: 'node', index }.
   *  `margin` (tiles) grows each footprint so a building is an easy target. */
  pick(g, view, margin = 0.2) {
    if (!this.on || !view?.eco) return null;
    const b = view.eco.buildings.find((e) => e.alive && !e.proxy && Math.abs(e.x / Q - g.x) <= e.size / 2 + margin && Math.abs(e.y / Q - g.z) <= e.size / 2 + margin);
    if (b) return { kind: 'eco', index: b.idx, side: b.side };
    // A node by a forgiving circle (U04): a grove's canopy reaches further than a rock, and neither
    // shrinks below the building margin on screen (a finger at far zoom). Scored relative to the
    // circle, so the nearest node wins.
    let best = null; let bestS = 1;
    view.eco.nodes.forEach((n) => {
      if (n.spent) return;
      const r = Math.max(nodePickRadius(n.kind), margin * 1.4);
      const s = ((n.x / Q - g.x) ** 2 + (n.y / Q - g.z) ** 2) / (r * r);
      if (s < bestS) { bestS = s; best = { kind: 'node', index: n.i, res: n.res }; }
    });
    if (best || !this.woodTile) return best;
    // W12: any tree of a wood picks it (while it has wood left and is in sight)
    const { w, h } = this.r.setup.map;
    const tx = Math.floor(g.x); const tz = Math.floor(g.z);
    if (tx < 0 || tz < 0 || tx >= w || tz >= h) return null;
    const wi = this.woodTile[tz * w + tx];
    if (wi < 0) return null;
    const n = view.eco.nodes.find((e) => e.i === wi);
    return n && !n.spent ? { kind: 'node', index: n.i, res: n.res } : null;
  }
}
