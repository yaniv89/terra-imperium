import { BATTLE_GRAPHICS, ADAPTIVE, frameSummary } from './quality';
// src/battle/render/BattleRenderer.js
// The battlefield on screen (Tactical Battles plan §15): a three.js scene with an orthographic,
// isometric camera (the Red Alert 2 look), soft sun shadows and filmic tone mapping, a heightmapped
// terrain mesh with natural colour variation, water, instanced trees/rocks/grass/houses, the keep
// and towers, capture-point flags, and every soldier of every squad as an animated 3D model
// (src/battle/render/soldierFactory.js: they walk, strike and gallop, rigged in the shader). It only ever READS render views from the sim and interpolates
// between the last two (20 Hz sim → smooth 60 fps), plus short-lived effects driven by sim events.
import {
  WebGLRenderer, Scene, OrthographicCamera, ClampToEdgeWrapping, Color, HemisphereLight, DirectionalLight, PlaneGeometry,
  MeshLambertMaterial, MeshBasicMaterial, InstancedMesh, Object3D, Vector3, Vector2, Raycaster, Plane,
  ConeGeometry, DodecahedronGeometry, BoxGeometry, CylinderGeometry, RingGeometry,
  Float32BufferAttribute, DoubleSide, Group, Mesh, FogExp2, DataTexture, RGBAFormat, LinearFilter,
  ACESFilmicToneMapping, PCFShadowMap, InstancedBufferAttribute, PMREMGenerator, MeshStandardMaterial, IcosahedronGeometry, DynamicDrawUsage, Matrix4
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TILE } from '../setup/mapgen';
import { getBattleStats, getSoldierCount, getUnitBattleStats } from '../data/battleStats';
import { soldierSlots, squadSlots, figureScale, scaledSoldiers } from './capacity';
import { getSoldierGeometry, hasSoldierOverride, packForGPU, disposeSoldierCache, createSoldierMaterial, createSoldierDepthMaterial, RIG_TIME, MODEL_SCALE } from './soldierFactory';
import { writeSoldierVariant, skinToneFor } from './unitVariants';
import { soldierLodGeometries, pickSoldierTier, triangleCount } from './soldierLod';
import { SKIRT, buildTileMask, makeSkirtHeight, hasCoast, horizonLevel, buildSkirtGeometry, patchGroundMaterial, fitShadowBox } from './terrainSurface';
import { Q } from '../sim/constants';
import { zonePerimeter } from './deployZone';
import { CityLayer, CITY_KINDS } from './cityLayer';
import { EconomyLayer } from './economyLayer';
import { VegetationProps } from '../art/vegetationProps';
import { dressStructure, fortRef, CivicStructures } from '../art/structureArt';
import { BattleTerrainArt } from '../art/battleTerrain';
import { ProjectileArt } from '../art/projectiles';
import { FxSprites } from '../art/fxSheets';
import { orderRingState, recordOrderTarget, ORDER_RING_COLOR, MAX_ORDER_TARGETS } from './orderTarget';
import { getAgeIndex } from '../../data/ages';
import { peopleForNationId } from '../../data/peoples';
import { signatureKey, baseClassOf } from '../../data/signatureUnits';
import { lookKey, unitLookOf, LOOK_CLASS } from './unitModels';
import { battleGroundSets, groundTextureUniform } from '../../data/groundMaterials';
import { styleOfLand } from '../../data/architecture';
import { BattleProps } from '../art/battleProps';

const GROUND = {
  plains: '#6d8f3a', mixed: '#5f8536', hills: '#76853f', forest: '#4b7030', mountains: '#7a7867',
  desert: '#cdb07a', arctic: '#e4ebef', urban: '#7d8078', island: '#6f9c42'
};
// A second grass/soil tone, blended in by large-scale noise so fields don't look painted flat.
const GROUND_ALT = {
  plains: '#8d9a4a', mixed: '#7a8a45', hills: '#8f8a55', forest: '#3f5f2a', mountains: '#8d8a7a',
  desert: '#dcc28f', arctic: '#d3dde3', urban: '#8a8a80', island: '#8aa653'
};
const TILE_TINT = {
  [TILE.FOREST]: '#3d5f29', [TILE.WATER]: '#3a5f63', [TILE.ROCK]: '#6f6d63', [TILE.ROAD]: '#9a8058',
  [TILE.FORD]: '#6f8a7e', [TILE.BUILDING]: '#77766f', [TILE.RUBBLE]: '#8b8073'
};
// The sky and the haze the far land melts into, by terrain (FogExp2 uses the same colour, so the
// horizon has no edge).
const HAZE = {
  plains: '#b8cad6', mixed: '#b5c7d3', hills: '#b3c3ce', forest: '#aebfc5', mountains: '#bcc8d3',
  desert: '#dccfb5', arctic: '#dde6ec', urban: '#b9bec3', island: '#b1cad8'
};
const FOG_DENSITY = 0.0034;
const SUN_OFFSET = new Vector3(22, 38, -10);
const SAND_TINT = { desert: '#e3cd95', arctic: '#f5f8fb', island: '#e9d9a4' };
const ISO_DIR = new Vector3(1, 1.25, 1).normalize();
const SCREEN_RIGHT = new Vector3(1, 0, -1).normalize();
const SCREEN_UP_GROUND = new Vector3(-1, 0, -1).normalize();
export const PHONE_MAX_ZOOM = 5;
const VIEW_TILES = 30;       // landscape; portrait phones get a closer camera (see resize)
const PHONE_VIEW_TILES = 18; // a landscape phone (short side <= 500 css px)
const BANNER_HEIGHT = 0.62;  // of the old pole: standards above the men, not a forest over them
const BANNER_MIN_ZOOM = 0.6; // zoomed further out only generals and the selection carry one
const BAR_MIN_ZOOM = 0.7;    // strength bars of fighting squads from this zoom in
const tmp = new Object3D();
const ORDER_DASHES = 48; // dashes per order target line at most
const tmpColor = new Color();
const GREY_ROUT = new Color('#9ca3af');
const PALE_AMBUSH = new Color('#e2e8f0');
const WHITE = new Color('#ffffff');
const CAM_RIGHT = new Vector3();
const CAM_BASIS = new Matrix4();
const BAR_GREEN = new Color('#22c55e');
const BAR_LIME = new Color('#84cc16');
// Write position · turn about the vertical (yaw) · scale into slot k of an instance matrix array
// (what Object3D.updateMatrix would compose, without the Euler and quaternion round trip).
const writeYaw = (arr, k, x, y, z, yaw, sx, sy, sz) => {
  const c = Math.cos(yaw); const s = Math.sin(yaw); const o = k * 16;
  arr[o] = c * sx; arr[o + 1] = 0; arr[o + 2] = -s * sx; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = s * sz; arr[o + 9] = 0; arr[o + 10] = c * sz; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
};
// The same for a quad turned to face the camera (rotation matrix elements `b`), stretched by sx.
const writeBasis = (arr, k, b, x, y, z, sx) => {
  const o = k * 16;
  arr[o] = b[0] * sx; arr[o + 1] = b[1] * sx; arr[o + 2] = b[2] * sx; arr[o + 3] = 0;
  arr[o + 4] = b[4]; arr[o + 5] = b[5]; arr[o + 6] = b[6]; arr[o + 7] = 0;
  arr[o + 8] = b[8]; arr[o + 9] = b[9]; arr[o + 10] = b[10]; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
};
// An instanced mesh's colour array (three.js makes it on the first setColorAt).
// Parsed colours by CSS string (Color.set parses the string every call: costly every frame).
const COLORS = new Map();
const colorOf = (css) => { let c = COLORS.get(css); if (!c) { c = new Color(css); COLORS.set(css, c); } return c; };
const instanceColors = (mesh) => { if (!mesh.instanceColor) mesh.setColorAt(0, WHITE); return mesh.instanceColor.array; };
const PROP_CHUNK = 48;
const FIG = 9; // floats per figure in a squad's cached layout (squadFigures) // trees, rocks, tufts and houses are instanced per 48 x 48 tile chunk

const hash01 = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
// Smooth 2D value noise (for ground colour patches), 0..1.
const vnoise = (x, z) => {
  const ix = Math.floor(x); const iz = Math.floor(z); const fx = x - ix; const fz = z - iz;
  const h = (a, b) => hash01(a * 7919 + b * 104729);
  const sx = fx * fx * (3 - 2 * fx); const sz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h(ix, iz), h(ix + 1, iz), sx), lerp(h(ix, iz + 1), h(ix + 1, iz + 1), sx), sz);
};
const lerpAngle256 = (a, b, t) => { const d = ((b - a + 384) % 256) - 128; return a + d * t; };

// A soft ring decal as an alpha texture (green channel): transparent centre with a faint fill, a
// ring that fades in and out smoothly between `inner` and `outer` (radius 1 = the quad's edge).
export const makeRingDecal = ({ inner = 0.8, outer = 0.97, fill = 0.12, sharp = false, size = 128 } = {}) => {
  const data = new Uint8Array(size * size * 4);
  const soft = sharp ? 0.03 : 0.07;
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      const ring = smooth(inner - soft, inner, r) * (1 - smooth(outer - soft, outer, r));
      const a = Math.max(ring, fill * (1 - smooth(inner - soft, inner, r)));
      const o = (y * size + x) * 4;
      data[o] = 255; data[o + 1] = Math.round(a * 255); data[o + 2] = 255; data[o + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
};

// A splash of blood (or a scorch mark) seen from above: an irregular blob with a few droplets
// thrown out around it, as an alpha texture. `seed` varies the shape.
export const makeSplatDecal = ({ seed = 1, size = 64 } = {}) => {
  const data = new Uint8Array(size * size * 4);
  const lobes = Array.from({ length: 7 }, (_, k) => ({ a: hash01(seed * 31 + k) * Math.PI * 2, r: 0.12 + hash01(seed * 17 + k) * 0.16 }));
  const drops = Array.from({ length: 6 }, (_, k) => {
    const a = hash01(seed * 53 + k) * Math.PI * 2; const d = 0.55 + hash01(seed * 71 + k) * 0.35;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.05 + hash01(seed * 89 + k) * 0.06 };
  });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1; const v = ((y + 0.5) / size) * 2 - 1;
      const ang = Math.atan2(v, u); const r = Math.hypot(u, v);
      let edge = 0.42;
      lobes.forEach((l) => { const d = Math.cos(ang - l.a); if (d > 0) edge += l.r * d ** 6; });
      let a = Math.max(0, Math.min(1, (edge - r) / 0.06));
      drops.forEach((d) => { a = Math.max(a, Math.max(0, Math.min(1, (d.r - Math.hypot(u - d.x, v - d.y)) / 0.03))); });
      const o = (y * size + x) * 4;
      data[o] = 255; data[o + 1] = Math.round(a * 235); data[o + 2] = 255; data[o + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
};

// Troops bleed; machines (siege engines, aircraft, modern tanks and AA batteries) burn and smoke.
export const isOrganic = (classId, ageId) => !(classId === 'siege' || classId === 'air' || classId === 'naval'
  || (ageId === 'modern' && (classId === 'cavalry' || classId === 'support')));

const BLOOD_COLORS = ['#7f1010', '#991b1b', '#5c0a0a'];
const SPLAT_LIFE = 28;   // seconds a blood pool stays on the ground (it shrinks away over the last few)
const MAX_SPLATS = 96;
const MAX_BLOOD = 256;

export class BattleRenderer {
  constructor(canvas, setup, { playerSide = 0 } = {}) {
    this.setup = setup;
    this.map = setup.map;
    this.playerSide = playerSide;
    this.frameTimes = [];
    this.renderer = new WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    // Dynamic resolution (plan §15): start at the screen's DPR (max 2); 3 slow frames in a row
    // (> 20 ms) drop it a step (1.25, then 1), and a long run of fast frames earns it back.
    this.baseDpr = Math.min(window.devicePixelRatio || 1, BATTLE_GRAPHICS.maxDpr);
    this.dpr = this.baseDpr;
    this.slowFrames = 0; this.fastFrames = 0;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = BATTLE_GRAPHICS.shadows;
    // three r186 folded PCFSoftShadowMap into PCFShadowMap (now soft: Vogel-disk filtering sized by
    // shadow.radius); asking for PCFSoft only logs a deprecation warning.
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene = new Scene();
    this.skyColor = new Color(HAZE[setup.terrain] || HAZE.mixed);
    this.scene.background = this.skyColor.clone();
    this.scene.fog = new FogExp2(this.skyColor.getHex(), FOG_DENSITY);
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.camera.zoom = 1;
    // Start looking at your own army's front line.
    this.target = new Vector3(playerSide === 0 ? (this.map.attackerEdge || 1) + 9 : this.map.keep.x - 9, 0, this.map.h / 2);
    this.raycaster = new Raycaster();
    this.groundPlane = new Plane(new Vector3(0, 1, 0), 0);
    this.disposables = [];
    this.soldierLayers = new Map();
    this.figureScale = figureScale(setup); // fewer figures per squad in a big battle (capacity.js)
    this.detail = { bias: ADAPTIVE.startBias, ceiling: ADAPTIVE.maxBias, frames: new Float32Array(ADAPTIVE.window), n: 0, holdUntil: 1, retryAt: 0, p95: 0 };
    // Markers (rings, bars, banners): one standard per few squads in a big battle (regiment colours,
    // not a forest of poles); generals always carry theirs.
    const perSide = Math.max(1, ...setup.sides.map((sd) => (sd.units || []).length));
    this.bannerEvery = perSide > 120 ? 6 : perSide > 40 ? 3 : 1;
    this.sideColors = setup.sides.map((sd) => new Color(sd.color));
    this.squadInfo = [];
    this.figureBudget = BATTLE_GRAPHICS.figureTriangles.desktop;
    this.fx = [];
    this.markers = [];
    this.orderTargets = []; // orders at an object (orderTarget.js), drawn as a ring and a dashed line
    this.orderScratch = {};
    this.time = 0;

    // Less flat fill than before, a stronger sun: shadows read as shadows and ground the troops.
    this.scene.add(new HemisphereLight('#e3eef8', '#5a503f', 0.95));
    // A low warm sun from the side, casting soft shadows that follow the camera around the field.
    this.sun = new DirectionalLight('#ffe7c2', 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(BATTLE_GRAPHICS.shadowSize, BATTLE_GRAPHICS.shadowSize);
    Object.assign(this.sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2.5;
    // The light's own right/up axes, for snapping the shadow box to whole texels (fitShadows).
    const lightZ = SUN_OFFSET.clone().normalize();
    this.sunDir = lightZ;
    this.lightRight = new Vector3(0, 1, 0).cross(lightZ).normalize();
    this.lightUp = lightZ.clone().cross(this.lightRight).normalize();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // PBR soldiers (Cook-Torrance): per-vertex metalness/roughness, so armour catches the sun. A
    // one-time, tiny prefiltered room environment gives metal something to reflect (without one,
    // metallic surfaces render nearly black); it lights only the Standard materials (troops, water)
    // and costs one ~256px PMREM texture, generated once per battle.
    this.soldierMaterial = this.track(createSoldierMaterial({ standard: true }));
    // The far level (soldierLod.js) takes only a little more of the side's colour than the near ones:
    // a strong tint turned armies into solid orange and blue carpets; the banners carry the colour.
    this.farSoldierMaterial = this.track(createSoldierMaterial({ standard: true, teamTint: 0.18 }));
    const pmrem = new PMREMGenerator(this.renderer);
    this.envMap = this.track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.45;
    this.soldierDepth = this.track(createSoldierDepthMaterial());

    this.buildTerrain();
    this.buildProps();
    this.buildStructures();
    this.cityLayer = new CityLayer(this); // the real city's houses, walls and ruins (cityLayer.js)
    this.cityLayer.build();
    this.ecoLayer = new EconomyLayer(this); // the battle economy's nodes and buildings (economyLayer.js)
    this.ecoLayer.build();
    this.battleProps = new BattleProps(this); // wells, carts, stalls, standards (battle/art/battleProps.js)
    // Art files for the river banks, fords and bridges, and for projectiles (battle/art/).
    this.terrainArt = new BattleTerrainArt(this);
    this.projectileArt = new ProjectileArt(this);
    this.buildPoints();
    this.buildOverlays();
    this.buildFogOverlay();
  }

  // Fog of war: a black sheet over the terrain whose alpha comes from the player's fog grid —
  // opaque where never seen, dimmed where explored, clear where visible right now.
  buildFogOverlay() {
    const { w, h } = this.map;
    this.fogData = new Uint8Array(w * h * 4);
    this.fogTexture = this.track(new DataTexture(this.fogData, w, h, RGBAFormat));
    this.fogTexture.magFilter = LinearFilter; this.fogTexture.minFilter = LinearFilter;
    this.fogTexture.wrapS = ClampToEdgeWrapping; this.fogTexture.wrapT = ClampToEdgeWrapping;
    const geo = this.terrain.geometry.clone();
    geo.translate(0, 0.12, 0);
    this.track(geo);
    const mat = this.track(new MeshBasicMaterial({ color: '#05080d', transparent: true, alphaMap: this.fogTexture, depthWrite: false }));
    this.fogMesh = new Mesh(geo, mat);
    this.fogMesh.renderOrder = 2;
    this.scene.add(this.fogMesh);
    // The veil carries on over the skirt (its UVs clamp to the map's edge texels), so unexplored
    // borders fade out into the unknown land beyond instead of ending in a dark slab edge.
    const skirtVeil = this.track(this.skirt.geometry.clone());
    skirtVeil.translate(0, 0.12, 0);
    this.skirtFogMesh = new Mesh(skirtVeil, mat);
    this.skirtFogMesh.renderOrder = 2;
    this.scene.add(this.skirtFogMesh);
    this.setFog(null);
  }

  setFog(grid) {
    const { w, h } = this.map;
    let veiled = false;
    // The veil's alpha per tile, then softened by a small separable blur (1 2 3 2 1) across rows
    // and columns: the sight discs' tile steps read as soft edges, not dark stair-stepped squares.
    const n = w * h;
    if (!this.fogA || this.fogA.length !== n) { this.fogA = new Uint16Array(n); this.fogB = new Uint16Array(n); }
    const A = this.fogA; const B = this.fogB;
    for (let i = 0; i < n; i++) { const v = grid ? grid[i] : 2; A[i] = v === 2 ? 0 : v === 1 ? 110 : 235; if (A[i]) veiled = true; }
    const K = [1, 2, 3, 2, 1];
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * A[z * w + Math.max(0, Math.min(w - 1, x + k))];
      B[z * w + x] = Math.round(s / 9);
    }
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      let s = 0; for (let k = -2; k <= 2; k++) s += K[k + 2] * B[Math.max(0, Math.min(h - 1, z + k)) * w + x];
      A[z * w + x] = Math.round(s / 9);
    }
    for (let row = 0; row < h; row++) {
      // Texture row 0 is the bottom of the plane (large z); map row 0 is the top (small z).
      const iz = h - 1 - row;
      for (let ix = 0; ix < w; ix++) {
        const a = A[iz * w + ix];
        const o = (row * w + ix) * 4;
        this.fogData[o] = a; this.fogData[o + 1] = a; this.fogData[o + 2] = a; this.fogData[o + 3] = 255;
      }
    }
    this.fogTexture.needsUpdate = true;
    // Nothing hidden (everything in sight, or no fog of war): the two veils would draw about
    // 66,000 fully clear triangles a frame.
    this.fogMesh.visible = veiled; this.skirtFogMesh.visible = veiled;
  }

  track(obj) { this.disposables.push(obj); return obj; }

  // One tile's own ground level (riverbeds sit low).
  // (Read thousands of times a frame for the figures: worked out once per tile, then looked up.)
  tileHeight(ix, iz) {
    const { w, h, height, tiles } = this.map;
    if (!this.tileHeights) {
      this.tileHeights = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) this.tileHeights[i] = tiles[i] === TILE.WATER ? -0.5 : Math.max(-0.12, (height[i] / 256) * 0.55);
    }
    const cx = ix < 0 ? 0 : ix > w - 1 ? w - 1 : ix; const cz = iz < 0 ? 0 : iz > h - 1 ? h - 1 : iz;
    return this.tileHeights[cz * w + cx];
  }

  // The ground's height anywhere: bilinear between tile centres, so riverbanks and slopes are smooth
  // (a mesh vertex at a tile corner averages its four tiles) instead of stepping tile by tile.
  heightAt(x, z) {
    const fx = x - 0.5; const fz = z - 0.5;
    const ix = Math.floor(fx); const iz = Math.floor(fz);
    const tx = fx - ix; const tz = fz - iz;
    const { w, h } = this.map;
    if (ix >= 0 && iz >= 0 && ix < w - 1 && iz < h - 1 && this.tileHeights) {
      // Inside the map (nearly every call): the same bilinear blend, straight from the table.
      const t = this.tileHeights; const o = iz * w + ix;
      const top = t[o] + (t[o + 1] - t[o]) * tx;
      const bottom = t[o + w] + (t[o + w + 1] - t[o + w]) * tx;
      return top + (bottom - top) * tz;
    }
    const top = lerp(this.tileHeight(ix, iz), this.tileHeight(ix + 1, iz), tx);
    const bottom = lerp(this.tileHeight(ix, iz + 1), this.tileHeight(ix + 1, iz + 1), tx);
    return lerp(top, bottom, tz);
  }

  buildTerrain() {
    const { w, h, tiles } = this.map;
    const naval = !!this.map.naval;
    const geo = this.track(new PlaneGeometry(w, h, w, h));
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2, 0, h / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new Color(GROUND[this.setup.terrain] || GROUND.mixed);
    const alt = new Color(GROUND_ALT[this.setup.terrain] || GROUND_ALT.mixed);
    const tileColor = new Color();
    // The grass itself (two tones over big and small noise, lit a touch by height) is per vertex;
    // roads, sand, rock and forest floor are painted per pixel by the ground shader
    // (terrainSurface.js) so their edges feather instead of stair-stepping.
    const grass = (x, z, y, i) => {
      const patch = vnoise(x / 9, z / 9) * 0.7 + vnoise(x / 2.5, z / 2.5) * 0.3;
      const shade = 0.9 + hash01(i * 7 + 3) * 0.08 + y * 0.12;
      return tmpColor.copy(base).lerp(alt, patch).multiplyScalar(shade);
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const y = this.heightAt(Math.min(w - 0.01, x), Math.min(h - 0.01, z));
      pos.setY(i, y);
      const ix = Math.max(0, Math.min(w - 1, Math.floor(x))); const iz = Math.max(0, Math.min(h - 1, Math.floor(z)));
      const t = tiles[iz * w + ix];
      grass(x, z, y, i);
      if (t === TILE.WATER || t === TILE.FORD || (naval && t === TILE.OPEN)) tmpColor.lerp(tileColor.set(TILE_TINT[TILE.WATER]), 0.85); // a sea battle's open tiles are water
      colors[i * 3] = tmpColor.r; colors[i * 3 + 1] = tmpColor.g; colors[i * 3 + 2] = tmpColor.b;
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.tileMask = this.track(buildTileMask(this.map));
    const mat = this.track(patchGroundMaterial(new MeshLambertMaterial({ vertexColors: true }), {
      mask: this.tileMask, mapW: w, mapH: h,
      road: TILE_TINT[TILE.ROAD], sand: SAND_TINT[this.setup.terrain] || '#d6c28c', rock: TILE_TINT[TILE.ROCK], forest: TILE_TINT[TILE.FOREST],
      // ground material sets (src/assets/terrain/<id>/, data/groundMaterials.js) as detail, where delivered
      details: Object.fromEntries(Object.entries(battleGroundSets(this.setup.terrain, { urban: !!this.setup.city })).filter(([, set]) => set).map(([layer, set]) => [layer, groundTextureUniform(set.color)]))
    }));
    this.terrain = new Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // The land goes on beyond the battlefield: a skirt of rolling country stitched to the map's own
    // edge vertices (no cliff, no seam), the same palette and ground shader, fading into the haze.
    this.skirtHeight = makeSkirtHeight(this.map, (x, z) => this.heightAt(x, z));
    const far = new Color().copy(base).lerp(alt, 0.5);
    let n = 0;
    const skirtGeo = this.track(buildSkirtGeometry(this.map, this.skirtHeight, (x, z, y) => {
      const d = Math.hypot(x - Math.max(0, Math.min(w, x)), z - Math.max(0, Math.min(h, z)));
      grass(x, z, Math.max(0, y), n++);
      if (y < -0.3 || naval) tmpColor.lerp(tileColor.set(TILE_TINT[TILE.WATER]), 0.85); // open sea all round a sea battle
      return tmpColor.lerp(far, Math.min(0.35, d / 90));
    }));
    this.skirt = new Mesh(skirtGeo, mat);
    this.skirt.receiveShadow = true;
    this.scene.add(this.skirt);
    // And past the skirt, a plain far plane at the skirt's outer level, lost in the haze.
    const coast = naval || hasCoast(this.map);
    // A frame around the skirt's rim — never under the map, where it would hide riverbeds.
    const E = 450; const X0 = -SKIRT; const X1 = w + SKIRT; const Z0 = -SKIRT; const Z1 = h + SKIRT; const hy = horizonLevel(coast);
    const band = (x0, x1, z0, z1) => new PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, hy, (z0 + z1) / 2);
    const horizon = new Mesh(
      this.track(mergeGeometries([band(X0 - E, X1 + E, Z0 - E, Z0), band(X0 - E, X1 + E, Z1, Z1 + E), band(X0 - E, X0, Z0, Z1), band(X1, X1 + E, Z0, Z1)])),
      this.track(new MeshLambertMaterial({ color: coast ? new Color(TILE_TINT[TILE.WATER]) : far.clone().multiplyScalar(0.95) }))
    );
    horizon.renderOrder = -1;
    this.scene.add(horizon);
    // Water is a real, glossy surface over the riverbeds, lakes and the landing sea — and on a
    // coast it carries on to the horizon.
    if (naval || tiles.some((t) => t === TILE.WATER || t === TILE.FORD)) {
      // A coast's sea runs to the horizon; a river runs on through the skirt and fades at its rim.
      const size = coast ? [w + SKIRT * 2 + 900, h + SKIRT * 2 + 900] : [w + SKIRT * 2, h + SKIRT * 2];
      const water = new Mesh(
        this.track(new PlaneGeometry(size[0], size[1]).rotateX(-Math.PI / 2).translate(w / 2, -0.2, h / 2)),
        this.track(new MeshStandardMaterial({ color: '#2f6a8c', roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.86 }))
      );
      water.receiveShadow = true;
      this.water = water;
      this.scene.add(water);
    }
  }

  buildProps() {
    const { w, h, tiles } = this.map;
    const keep = this.map.keep;
    const winter = this.setup.terrain === 'arctic';
    const dry = this.setup.terrain === 'desert';
    const pines = []; const oaks = []; const rocks = []; const houses = []; const tufts = [];
    // Tiles taken by the province's own buildings get their own models (buildStructures).
    const landmarkTiles = new Set(this.setup.structures.filter((st) => st.kind === 'building').map((st) => Math.floor(st.y / Q) * w + Math.floor(st.x / Q)));
    this.setup.structures.forEach((st) => (st.footprint || []).forEach((c) => landmarkTiles.add(c))); // the real city draws its own (cityLayer.js)
    (this.setup.economy?.camp?.footprint || []).forEach((c) => landmarkTiles.add(c)); // the expedition camp (economyLayer.js)
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const t = tiles[z * w + x];
        const r = hash01(z * w + x);
        const r2 = hash01((z * w + x) * 3 + 1);
        if (t === TILE.FOREST && r < 0.9) {
          (r2 < (winter ? 0.85 : 0.45) ? pines : oaks).push([x + 0.2 + r * 0.6, z + 0.2 + r2 * 0.6, 0.7 + r * 0.4]);
          if (r > 0.6) (r2 < 0.5 ? oaks : pines).push([x + 0.8 - r2 * 0.5, z + 0.7 - r * 0.4, 0.5 + r2 * 0.3]);
        } else if (t === TILE.ROCK && r < 0.5) rocks.push([x + 0.3 + r2 * 0.4, z + 0.3 + r * 0.4, 0.4 + r * 0.6]);
        else if (t === TILE.BUILDING && Math.abs(x - keep.x) + Math.abs(z - keep.y) > 3 && !landmarkTiles.has(z * w + x)) houses.push([x + 0.5, z + 0.5, r]);
        else if ((t === TILE.OPEN || t === TILE.SAND) && !winter && !this.map.naval && r < (dry ? 0.1 : 0.32)) tufts.push([x + r2, z + hash01(r * 1e6), 0.6 + r2 * 0.5]);
        else if (t === TILE.OPEN && !this.map.naval && r > 0.985) rocks.push([x + r2, z + 0.5, 0.25 + r2 * 0.3]); // the odd boulder in a field
      }
    }
    // Woods and the odd boulder out in the skirt too, so the land beyond isn't a bare lawn.
    for (let z = -SKIRT + 1; z < h + SKIRT; z += 1.4) {
      for (let x = -SKIRT + 1; x < w + SKIRT; x += 1.4) {
        const outside = Math.max(-x, x - w, -z, z - h);
        if (outside < 1.5) continue;
        const r = hash01(Math.floor(x * 7.1) * 7919 + Math.floor(z * 7.1));
        const wood = vnoise(x / 11, z / 11);
        if (this.skirtHeight(x, z) < -0.15) continue; // the sea
        if (wood > 0.6 && r < 0.75) (r < (winter ? 0.85 : 0.5) ? pines : oaks).push([x + r * 0.6, z + (1 - r) * 0.6, 0.75 + r * 0.45]);
        else if (r > 0.992) rocks.push([x, z, 0.4 + r * 0.4]);
      }
    }
    const ground = (x, z) => (x < 0 || z < 0 || x > w || z > h ? this.skirtHeight(x, z) : this.heightAt(x, z));
    // Instanced by spatial chunk (PROP_CHUNK tiles square): each chunk has its own bounds, so
    // three.js leaves out the chunks off screen (and outside the sun's shadow box). One mesh for
    // the whole field had bounds covering everything and drew every tree every frame.
    const propMeshes = {}; // kind -> its chunk meshes (the vegetation kit swaps their geometry in)
    const place = (list, geo, { color = '#ffffff', shadow = true, scaleFn = (s0) => [s0, s0, s0], tint = 0.25, kind = null } = {}) => {
      if (!list.length) return;
      this.track(geo);
      const mat = this.track(new MeshLambertMaterial({ color, vertexColors: !!geo.attributes.color }));
      const chunks = new Map();
      list.forEach((item, i) => {
        const key = `${Math.floor(item[0] / PROP_CHUNK)},${Math.floor(item[1] / PROP_CHUNK)}`;
        if (!chunks.has(key)) chunks.set(key, []);
        chunks.get(key).push(i);
      });
      chunks.forEach((ids, key) => {
        const mesh = new InstancedMesh(geo, mat, ids.length);
        // Out in the skirt (the land beyond the field, fading into the haze) props cast no shadow.
        const [cx, cz] = key.split(',').map(Number);
        const beyond = (cx + 1) * PROP_CHUNK <= 0 || (cz + 1) * PROP_CHUNK <= 0 || cx * PROP_CHUNK >= w || cz * PROP_CHUNK >= h;
        ids.forEach((i, j) => {
          const [x, z, s0] = list[i];
          tmp.position.set(x, ground(x, z), z);
          tmp.rotation.set(0, hash01(i * 13 + 5) * Math.PI * 2, 0);
          const sc = scaleFn(s0, i); tmp.scale.set(sc[0], sc[1], sc[2]);
          tmp.updateMatrix();
          mesh.setMatrixAt(j, tmp.matrix);
          tmpColor.setRGB(1, 1, 1).multiplyScalar(1 - tint / 2 + hash01(i * 31) * tint);
          mesh.setColorAt(j, tmpColor);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere(); mesh.computeBoundingBox();
        mesh.castShadow = shadow && !beyond; mesh.receiveShadow = true;
        this.scene.add(mesh);
        if (kind) (propMeshes[kind] ||= []).push(mesh);
      });
    };
    // Vertex-coloured multi-part props, merged: one draw call per kind.
    const painted = (geo, color) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const c = new Color(color); const n = g.attributes.position.count; const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.deleteAttribute('uv');
      return g;
    };
    const leaf = winter ? '#5d7d6c' : dry ? '#6f7d3a' : '#3d6e2e';
    const snow = '#eef3f6';
    const pine = mergeGeometries([
      painted(new CylinderGeometry(0.07, 0.1, 0.5, 5, 1, true).translate(0, 0.25, 0), '#5a3d25'),
      painted(new ConeGeometry(0.5, 0.8, 7, 1, true).translate(0, 0.75, 0), leaf),
      painted(new ConeGeometry(0.4, 0.7, 7, 1, true).translate(0, 1.15, 0), leaf),
      painted(new ConeGeometry(0.28, 0.6, 7, 1, true).translate(0, 1.5, 0), winter ? snow : leaf)
    ]);
    const oak = mergeGeometries([
      painted(new CylinderGeometry(0.08, 0.12, 0.8, 6, 1, true).translate(0, 0.4, 0), '#5f4128'),
      painted(new IcosahedronGeometry(0.55, 0).translate(0, 1.05, 0), dry ? '#7a8a3e' : '#4f8a36'),
      painted(new IcosahedronGeometry(0.4, 0).translate(0.3, 0.85, 0.15), dry ? '#6d7c36' : '#46803a'),
      painted(new IcosahedronGeometry(0.38, 0).translate(-0.25, 0.9, -0.2), dry ? '#83903f' : '#5a9440')
    ]);
    pine.computeVertexNormals(); oak.computeVertexNormals();
    place(pines, pine, { scaleFn: (s0) => [s0, s0 * (1.1 + (s0 % 0.2)), s0], kind: 'pine' });
    place(oaks, oak, { scaleFn: (s0) => [s0 * 1.1, s0, s0 * 1.1], kind: 'oak' });
    place(rocks, new DodecahedronGeometry(0.5, 0).translate(0, 0.18, 0), { color: winter ? '#a3a7a8' : '#7d7a70', scaleFn: (s0, i) => [s0, s0 * (0.5 + hash01(i) * 0.4), s0 * (0.8 + hash01(i * 3) * 0.4)], kind: 'rock' });
    const tuft = mergeGeometries([
      painted(new ConeGeometry(0.035, 0.2, 3, 1, true).rotateZ(0.25).translate(0.04, 0.09, 0), dry ? '#b3aa6a' : '#7da347'),
      painted(new ConeGeometry(0.035, 0.24, 3, 1, true).rotateX(-0.2).translate(-0.03, 0.11, 0.02), dry ? '#a19a5c' : '#8cb054'),
      painted(new ConeGeometry(0.03, 0.17, 3, 1, true).rotateZ(-0.3).translate(-0.05, 0.08, -0.04), dry ? '#c0b67a' : '#6f9a3f')
    ]);
    tuft.computeVertexNormals();
    place(tufts, tuft, { shadow: false, tint: 0.35, kind: 'tuft' });
    // The vegetation kit (src/assets/battle/nature/vegetation-<kit>.glb) takes the place of the
    // trees, rocks and tufts once it is in: same chunks, same instances, its geometry (vegetation.js).
    this.vegetation = new VegetationProps(this, propMeshes);
    // Houses: whitewashed or stone walls under a pitched roof, age-appropriate colours.
    const modern = this.setup.sides[1].ageId === 'modern';
    const house = mergeGeometries([
      painted(new BoxGeometry(0.9, 0.7, 0.8).translate(0, 0.35, 0), modern ? '#b9b5ad' : '#d8cdb5'),
      painted(new ConeGeometry(0.72, 0.5, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9).translate(0, 0.95, 0), modern ? '#5d6166' : '#9a4b32'),
      painted(new BoxGeometry(0.16, 0.3, 0.02).translate(0, 0.15, 0.41), '#4a3322')
    ]);
    house.computeVertexNormals();
    place(houses, house, { scaleFn: (r) => [0.95, 0.8 + r * 0.9, 0.95] });
  }

  buildStructures() {
    this.structureMeshes = new Map();
    this.civicStructures = new CivicStructures(this);
    const modern = this.setup.sides[1].ageId === 'modern';
    const merlons = (g, mat, radius, y, count, size = 0.22) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const m = new Mesh(this.track(new BoxGeometry(size, size * 1.1, size).translate(Math.cos(a) * radius, y, Math.sin(a) * radius)), mat);
        m.castShadow = true; g.add(m);
      }
    };
    const squareMerlons = (g, mat, half, y) => {
      for (let i = -3; i <= 3; i += 2) {
        [[i * half / 3.5, -half], [i * half / 3.5, half], [-half, i * half / 3.5], [half, i * half / 3.5]].forEach(([dx, dz]) => {
          const m = new Mesh(this.track(new BoxGeometry(0.28, 0.3, 0.28).translate(dx, y, dz)), mat); m.castShadow = true; g.add(m);
        });
      }
    };
    this.setup.structures.forEach((s) => {
      if (this.map.naval) return; // a sea battle's anchorage is an objective for the AI, nothing stands there
      if (CITY_KINDS.has(s.kind)) return; // drawn by cityLayer.js
      // Per-structure materials, so a destroyed tower can turn to rubble on its own.
      const stone = this.track(new MeshLambertMaterial({ color: modern ? '#8f9194' : '#a39c8c' }));
      const darkStone = this.track(new MeshLambertMaterial({ color: modern ? '#6c6e72' : '#7d776a' }));
      const roof = this.track(new MeshLambertMaterial({ color: this.setup.sides[1].color }));
      const wood = this.track(new MeshLambertMaterial({ color: '#5b3d24' }));
      const g = new Group();
      const add = (geo, mat) => { const m = new Mesh(this.track(geo), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      const x = s.x / Q; const z = s.y / Q;
      if (s.kind === 'building') {
        this.buildLandmark(add, s.category, { stone, darkStone, roof, wood, modern });
      } else if (s.kind === 'keep') {
        add(new BoxGeometry(2.8, 0.35, 2.8).translate(0, 0.17, 0), darkStone); // plinth
        add(new BoxGeometry(2.5, 2.0, 2.5).translate(0, 1.2, 0), stone);
        squareMerlons(g, stone, 1.2, 2.35);
        add(new BoxGeometry(0.7, 0.9, 0.08).translate(-1.26, 0.6, 0).rotateY(Math.PI / 2), wood); // gate (faces the attacker)
        [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].forEach(([dx, dz]) => {
          add(new CylinderGeometry(0.46, 0.52, 2.9, 10).translate(dx, 1.45, dz), stone);
          merlons(g, stone, 0.44, 3.0, 7, 0.16);
          g.children.slice(-7).forEach((m) => m.position.set(dx, 0, dz));
          if (!modern) add(new ConeGeometry(0.58, 0.9, 10).translate(dx, 3.5, dz), roof);
        });
        add(new CylinderGeometry(0.03, 0.03, 1.4, 5).translate(0, 3.1, 0), wood); // banner pole
        const flag = add(new PlaneGeometry(0.8, 0.5).translate(0.4, 3.55, 0), this.track(new MeshLambertMaterial({ color: this.setup.sides[1].color, side: DoubleSide })));
        flag.castShadow = false;
        g.userData.flag = flag;
        if (s.walls && !this.setup.city) { // a real city has its own wall ring (cityLayer.js)
          // A curtain wall ring with a crenellated top.
          const segs = 20;
          for (let i = 0; i < segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            if (Math.abs(Math.cos(a) + 1) < 0.08) continue; // the gateway on the attacker's side
            const wallSeg = add(new BoxGeometry(1.25, 0.9, 0.3).translate(0, 0.45, 0), stone);
            wallSeg.position.set(Math.cos(a) * 3.7, 0, Math.sin(a) * 3.7); wallSeg.rotation.y = -a + Math.PI / 2;
            const cap = add(new BoxGeometry(0.3, 0.25, 0.32).translate(0, 1.0, 0), stone);
            cap.position.copy(wallSeg.position); cap.rotation.y = wallSeg.rotation.y;
          }
        }
      } else {
        add(new CylinderGeometry(0.55, 0.7, 2.4, 10).translate(0, 1.2, 0), stone);
        add(new CylinderGeometry(0.68, 0.62, 0.25, 10).translate(0, 2.45, 0), darkStone);
        merlons(g, stone, 0.6, 2.7, 8, 0.18);
        if (!modern) add(new ConeGeometry(0.72, 0.9, 10).translate(0, 3.25, 0), roof);
      }
      g.position.set(x, this.heightAt(x, z), z);
      this.mergeByMaterial(g);
      this.scene.add(g);
      this.structureMeshes.set(s.id, g);
      // A fortified place without a real city: its keep is the age's fort once the file is in
      // (src/assets/battle/city/fort-<age>.glb or the map's fort improvement; structureArt.js).
      if (s.kind === 'keep' && !this.setup.city && (s.walls || s.damage > 0)) {
        dressStructure(g, fortRef(this.setup.sides[1].ageId), { fitTiles: s.walls ? 8 : 4.5, teamColor: this.setup.sides[1].color, track: (m) => this.track(m), isLive: () => !this.disposed });
      } else if (s.kind === 'keep' && !this.setup.city) {
        // the defender's own hall: its people's theme, a legacy country's land style
        this.civicStructures.add(g, s, this.setup.sides[1].ageId, styleOfLand(this.setup.sides[1].nationId, this.setup.sides[1].ageId));
      }
    });
  }

  // A structure is built from dozens of parts (a keep with walls has about 60: merlons, towers,
  // wall segments); one draw call each adds up. Bake each part's placement into its geometry and
  // merge the parts that share a material (and a shadow setting) into one mesh.
  mergeByMaterial(g) {
    const groups = new Map();
    g.children.forEach((m) => {
      if (!m.isMesh) return;
      const key = `${m.material.uuid}:${m.castShadow}`;
      if (!groups.has(key)) groups.set(key, { material: m.material, castShadow: m.castShadow, geos: [] });
      m.updateMatrix();
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      groups.get(key).geos.push(geo.applyMatrix4(m.matrix));
    });
    g.clear();
    groups.forEach(({ material, castShadow, geos }) => {
      const geo = this.track(mergeGeometries(geos));
      geos.forEach((x) => x.dispose());
      const mesh = new Mesh(geo, material);
      mesh.castShadow = castShadow; mesh.receiveShadow = true;
      g.add(mesh);
    });
  }

  // The province's own buildings (src/battle/sim/buildings.js), one recognisable model each.
  buildLandmark(add, category, { stone, darkStone, roof, wood, modern }) {
    const plaster = this.track(new MeshLambertMaterial({ color: modern ? '#b7b3ab' : '#d9ccb0' }));
    const tile = this.track(new MeshLambertMaterial({ color: modern ? '#565a60' : '#9a4b32' }));
    const cloth = this.track(new MeshLambertMaterial({ color: '#efe6d2', side: DoubleSide }));
    const hipRoof = (wdt, dpt, y, mat, hgt = 0.55) => add(new ConeGeometry(Math.max(wdt, dpt) * 0.72, hgt, 4).rotateY(Math.PI / 4).scale(wdt / Math.max(wdt, dpt), 1, dpt / Math.max(wdt, dpt)).translate(0, y + hgt / 2, 0), mat);
    switch (category) {
      case 'military': // barracks: a long hall with a banner
        add(new BoxGeometry(1.7, 0.7, 1.0).translate(0, 0.35, 0), plaster); hipRoof(1.8, 1.1, 0.7, tile);
        add(new CylinderGeometry(0.03, 0.03, 1.8, 5).translate(0.95, 0.9, 0.55), wood);
        add(new PlaneGeometry(0.6, 0.38).translate(1.25, 1.6, 0.55), roof);
        break;
      case 'economy': // market: stalls under striped awnings
        [[-0.55, -0.3], [0.55, -0.3], [0, 0.45]].forEach(([dx, dz], i) => {
          add(new BoxGeometry(0.7, 0.35, 0.5).translate(dx, 0.18, dz), wood);
          add(new BoxGeometry(0.8, 0.04, 0.62).rotateX(-0.25).translate(dx, 0.62, dz), i % 2 ? roof : cloth);
          [-0.35, 0.35].forEach((px) => add(new CylinderGeometry(0.025, 0.025, 0.6, 4).translate(dx + px, 0.3, dz + 0.24), wood));
        });
        break;
      case 'industry': // workshop with a tall chimney
        add(new BoxGeometry(1.4, 0.8, 1.1).translate(0, 0.4, 0), modern ? darkStone : stone); hipRoof(1.5, 1.2, 0.8, tile, 0.4);
        add(new CylinderGeometry(0.13, 0.17, 1.9, 8).translate(0.45, 0.95, -0.3), darkStone);
        break;
      case 'culture': // temple: columns under a pediment (or a dome)
        add(new BoxGeometry(1.7, 0.18, 1.2).translate(0, 0.09, 0), stone);
        for (let i = -2; i <= 2; i++) { add(new CylinderGeometry(0.07, 0.08, 0.9, 7).translate(i * 0.36, 0.63, 0.45), plaster); add(new CylinderGeometry(0.07, 0.08, 0.9, 7).translate(i * 0.36, 0.63, -0.45), plaster); }
        add(new BoxGeometry(1.7, 0.12, 1.15).translate(0, 1.14, 0), stone);
        hipRoof(1.7, 1.2, 1.2, roof, 0.4);
        break;
      case 'food': // granary silos
        [[-0.4, 0], [0.4, 0.1]].forEach(([dx, dz]) => { add(new CylinderGeometry(0.36, 0.38, 1.0, 10).translate(dx, 0.5, dz), plaster); add(new ConeGeometry(0.42, 0.4, 10).translate(dx, 1.2, dz), tile); });
        break;
      case 'science': // library / academy under a dome
        add(new BoxGeometry(1.3, 0.75, 1.1).translate(0, 0.38, 0), plaster);
        add(new CylinderGeometry(0.42, 0.45, 0.2, 12).translate(0, 0.85, 0), stone);
        add(new IcosahedronGeometry(0.42, 1).scale(1, 0.8, 1).translate(0, 0.95, 0), roof);
        break;
      case 'naval': // harbour warehouse with a crane
        add(new BoxGeometry(1.8, 0.7, 0.9).translate(0, 0.35, 0), wood); hipRoof(1.9, 1.0, 0.7, tile, 0.35);
        add(new BoxGeometry(0.1, 1.6, 0.1).translate(-0.85, 0.8, 0.6), wood); add(new BoxGeometry(0.9, 0.08, 0.08).translate(-0.45, 1.55, 0.6), wood);
        break;
      case 'logistics': // road post: a waystation, a cart and a signpost
        add(new BoxGeometry(0.8, 0.6, 0.7).translate(-0.3, 0.3, 0), plaster); hipRoof(0.9, 0.8, 0.6, tile, 0.4);
        add(new BoxGeometry(0.5, 0.25, 0.8).translate(0.55, 0.3, 0.1), wood);
        add(new CylinderGeometry(0.03, 0.03, 1.1, 5).translate(0.3, 0.55, -0.5), wood); add(new BoxGeometry(0.4, 0.12, 0.04).translate(0.45, 0.95, -0.5), wood);
        break;
      default:
        add(new BoxGeometry(1.2, 0.8, 1.0).translate(0, 0.4, 0), plaster); hipRoof(1.3, 1.1, 0.8, tile);
    }
  }

  buildPoints() {
    this.pointMeshes = new Map();
    const pole = this.track(new CylinderGeometry(0.05, 0.05, 1.8, 5).translate(0, 0.9, 0));
    const flag = this.track(new PlaneGeometry(0.8, 0.5).translate(0.4, 1.55, 0));
    const ring = this.track(new RingGeometry(1.2, 1.5, 28).rotateX(-Math.PI / 2).translate(0, 0.05, 0));
    this.setup.points.forEach((p) => {
      const g = new Group();
      const mat = new MeshBasicMaterial({ color: '#9ca3af', side: DoubleSide });
      this.track(mat);
      g.add(new Mesh(pole, this.track(new MeshLambertMaterial({ color: '#d6d3d1' }))));
      g.add(new Mesh(flag, mat));
      g.add(new Mesh(ring, mat));
      const x = p.x / Q; const z = p.y / Q;
      g.position.set(x, this.heightAt(x, z), z);
      g.userData.mat = mat;
      this.scene.add(g);
      this.pointMeshes.set(p.id, g);
    });
  }

  // The deployment zone (plan E7): dots along the player's zone edge until Start; null clears it.
  setDeployZone(zone, side = 0) {
    if (this.zoneMesh) { this.scene.remove(this.zoneMesh); this.zoneMesh.geometry.dispose(); this.zoneMesh.material.dispose(); this.zoneMesh = null; }
    if (!zone) return;
    const dots = zonePerimeter(zone);
    const mat = new MeshBasicMaterial({ color: side === 0 ? '#86efac' : '#93c5fd', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: DoubleSide });
    const mesh = new InstancedMesh(new PlaneGeometry(0.22, 0.22).rotateX(-Math.PI / 2), mat, dots.length);
    const o = new Object3D();
    const w = this.map.w; const h = this.map.h;
    dots.forEach((d, i) => { const x = Math.max(0, Math.min(w - 0.01, d.x)); const z = Math.max(0, Math.min(h - 0.01, d.z)); o.position.set(x, this.heightAt(x, z) + 0.06, z); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.zoneMesh = mesh;
  }

  buildOverlays() {
    const MAX = squadSlots(this.setup); // one marker, banner and bar per squad that can take the field (capacity.js)
    const mk = (geo, color, opacity = 1) => {
      const mat = this.track(new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: DoubleSide }));
      const m = new InstancedMesh(this.track(geo), mat, MAX);
      m.count = 0; m.frustumCulled = false; this.scene.add(m);
      return m;
    };
    // A faint team-coloured ring on the ground under each squad, a bright one when selected.
    // Squad markers as ground decals: one quad each with a soft-edged ring (and a faint fill)
    // painted by an alpha texture — no hard line loops, and still one draw call for every squad.
    const decal = (size, map, opacity) => {
      const mat = this.track(new MeshBasicMaterial({ color: '#ffffff', alphaMap: map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      const m = new InstancedMesh(this.track(new PlaneGeometry(size, size).rotateX(-Math.PI / 2)), mat, MAX);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 1; this.scene.add(m);
      return m;
    };
    this.discs = decal(2, this.track(makeRingDecal({ inner: 0.8, outer: 0.97, fill: 0.14 })), 0.7);
    this.rings = decal(2.3, this.track(makeRingDecal({ inner: 0.84, outer: 0.95, fill: 0.2, sharp: true })), 1);
    this.rings.material.color.set('#bef264');
    // Strength bar: a bright green fill on a dark red track, always drawn on top (no depth test, no
    // haze), so it reads at any zoom and the red shows at a glance how much of the squad is gone.
    this.barBg = mk(new PlaneGeometry(1.08, 0.16), '#3f0d0d', 0.9);
    this.barFill = mk(new PlaneGeometry(1, 0.1).translate(0.5, 0, 0), '#ffffff');
    [[this.barBg, 20], [this.barFill, 21]].forEach(([m, order]) => {
      Object.assign(m.material, { depthTest: false, depthWrite: false, fog: false, transparent: true });
      m.renderOrder = order;
    });
    // Each squad's standard: a pole and a waving flag in the side's colour.
    const poleMat = this.track(new MeshLambertMaterial({ color: '#4a3524' }));
    this.bannerPoles = new InstancedMesh(this.track(new CylinderGeometry(0.025, 0.025, 2.1, 5).translate(0, 1.05, 0)), poleMat, MAX);
    this.bannerFlags = new InstancedMesh(this.track(new PlaneGeometry(0.6, 0.38, 4, 1).translate(0.3, 1.86, 0)), this.track(new MeshLambertMaterial({ color: '#ffffff', side: DoubleSide })), MAX);
    [this.bannerPoles, this.bannerFlags].forEach((m) => { m.count = 0; m.frustumCulled = false; m.castShadow = true; this.scene.add(m); });
    this.structBarBg = mk(new PlaneGeometry(1, 0.18), '#0f172a', 0.85);
    this.structBarFill = mk(new PlaneGeometry(1, 0.13).translate(0.5, 0, 0), '#ffffff');
    this.tracers = mk(new BoxGeometry(1, 0.05, 0.05).translate(0.5, 0, 0), '#fde68a');
    this.sparks = mk(new DodecahedronGeometry(0.12, 0), '#fbbf24');
    this.sparks.dispose(); this.scene.remove(this.sparks);
    this.sparks = new InstancedMesh(this.track(new DodecahedronGeometry(0.12, 0)), this.track(new MeshBasicMaterial({ color: '#ffffff' })), 128);
    this.sparks.count = 0; this.sparks.frustumCulled = false; this.scene.add(this.sparks);
    this.markerRings = decal(1.7, this.track(makeRingDecal({ inner: 0.74, outer: 0.96, fill: 0.08 })), 0.9);
    // The order target indicator (orderTarget.js): a brass-yellow ring over a dark halo (so it
    // reads on sand as well as grass) around the object a group was sent at, and a dashed line to it.
    const orderDecal = (map, color, max) => {
      const mat = this.track(new MeshBasicMaterial({ color, alphaMap: map, transparent: true, opacity: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      const im = new InstancedMesh(this.track(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2)), mat, max);
      im.count = 0; im.frustumCulled = false; im.renderOrder = 2; this.scene.add(im);
      return im;
    };
    // the halo is a thin dark outline just outside the yellow band (scaled 1.1x: 0.9..1.0 of it)
    this.orderShade = orderDecal(this.track(makeRingDecal({ inner: 0.88, outer: 1, fill: 0 })), '#1c1405', MAX_ORDER_TARGETS);
    this.orderRings = orderDecal(this.track(makeRingDecal({ inner: 0.76, outer: 0.96, fill: 0.1, sharp: true })), ORDER_RING_COLOR, MAX_ORDER_TARGETS);
    this.orderRings.material.toneMapped = false; this.orderRings.material.fog = false; // the true brass yellow
    const dashMat = this.track(new MeshBasicMaterial({ color: ORDER_RING_COLOR, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.orderDashes = new InstancedMesh(this.track(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), dashMat, MAX_ORDER_TARGETS * ORDER_DASHES);
    this.orderDashes.count = 0; this.orderDashes.frustumCulled = false; this.orderDashes.renderOrder = 2; this.scene.add(this.orderDashes);
    // Effect sprite sheets (src/assets/fx/<id>/, fxSheets.js) where delivered; the sparks otherwise.
    this.fxSprites = new FxSprites(this.scene, { track: (x) => this.track(x) });
    // Blood: droplets that spray and fall when soldiers go down, and the pools they leave behind
    // (three splat shapes so the ground doesn't repeat one stamp). Machines leave scorch marks.
    this.blood = new InstancedMesh(this.track(new DodecahedronGeometry(0.045, 0)), this.track(new MeshBasicMaterial({ color: '#ffffff' })), MAX_BLOOD);
    this.blood.count = 0; this.blood.frustumCulled = false; this.scene.add(this.blood);
    this.splatLayers = [1, 2, 3].map((seed) => decal(1, this.track(makeSplatDecal({ seed })), 0.85));
    this.splatLayers.forEach((m) => { m.material.depthWrite = false; m.renderOrder = 0; });
    this.splats = [];
    this.soldierMemo = new Map();
  }

  // One soldier layer per (age, class) for BOTH armies — the side's colour is per instance
  // (instanceColor), so two armies of the same age cost the same draw calls as one. A layer holds
  // three InstancedMeshes, one per detail level (soldierLod.js: the full model, the only one that
  // casts shadows, then about 360 and about 60 triangles), which SHARE every per-instance buffer:
  // matrix, colour, animation (phase, moving, attacking) and variant (skin tone, emblem cell,
  // cloth jitter). Only squads in view are written (drawSquads culls them), so three.js's own
  // per-object culling stays off; the CPU uploads only the used range and one level draws.
  soldierLayer(ageId, classId) {
    const key = `${ageId}:${classId}`;
    let layer = this.soldierLayers.get(key);
    if (layer) return layer;
    // every soldier of this age and class (capacity.js); a signature unit's layer ('infantry~people')
    // as many as its base class, a general layer one a squad (the minimum pool)
    const MAX = soldierSlots(this.setup, ageId, LOOK_CLASS[classId] || baseClassOf(classId));
    const buf = (size) => new InstancedBufferAttribute(new Float32Array(MAX * size), size).setUsage(DynamicDrawUsage);
    const matrix = buf(16); const color = buf(3); const anim = buf(3); const variant = buf(4);
    const make = (source, shadow, far) => {
      const geo = this.track(packForGPU(source.clone()));
      geo.setAttribute('aAnim', anim);
      geo.setAttribute('aVariant', variant);
      const mesh = new InstancedMesh(geo, far ? this.farSoldierMaterial : this.soldierMaterial, MAX);
      mesh.instanceMatrix = matrix; mesh.instanceColor = color;
      if (shadow) mesh.customDepthMaterial = this.soldierDepth;
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      mesh.count = 0; mesh.frustumCulled = false; mesh.visible = false;
      this.scene.add(mesh);
      return mesh;
    };
    const levels = soldierLodGeometries(getSoldierGeometry(ageId, classId)).map((g, k) => make(g, k === 0 && BATTLE_GRAPHICS.shadows, k === 2));
    layer = { levels, tris: levels.map((m) => triangleCount(m.geometry)), matrix, color, anim, variant, count: 0, capacity: MAX };
    this.soldierLayers.set(key, layer);
    return layer;
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    // Phones in landscape start closer (PHONE_VIEW_TILES): the default view shows soldiers, not a map.
    const viewH = aspect < 1 ? 16 : Math.min(width, height) <= 500 ? PHONE_VIEW_TILES : VIEW_TILES;
    // Phones (short side <= 500 css px) may zoom closer: at 3x a soldier is still only about 29 css
    // px tall on a 390 px tall landscape screen, too small to see the unit art.
    this.maxZoom = Math.min(width, height) <= 500 ? PHONE_MAX_ZOOM : 3;
    // The soldiers' share of the triangle budget (RTS plan 13.1: about 0.5 M a frame on a phone
    // with terrain and scenery, 1 to 1.5 M on a desktop).
    this.figureBudget = Math.min(width, height) <= 500 ? BATTLE_GRAPHICS.figureTriangles.phone : BATTLE_GRAPHICS.figureTriangles.desktop;
    this.camera.left = (-viewH * aspect) / 2; this.camera.right = (viewH * aspect) / 2;
    this.camera.top = viewH / 2; this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
  }

  clampTarget() {
    this.target.x = Math.max(0, Math.min(this.map.w, this.target.x));
    this.target.z = Math.max(0, Math.min(this.map.h, this.target.z));
  }

  worldPerPixel() { return (this.camera.top - this.camera.bottom) / this.camera.zoom / Math.max(1, this.height); }

  pan(dxPx, dyPx) {
    const k = this.worldPerPixel();
    this.target.addScaledVector(SCREEN_RIGHT, -dxPx * k);
    this.target.addScaledVector(SCREEN_UP_GROUND, dyPx * k * 1.35);
    this.clampTarget();
  }

  zoomBy(factor, px = this.width / 2, py = this.height / 2) {
    const before = this.screenToGround(px, py);
    this.camera.zoom = Math.max(0.45, Math.min(this.maxZoom || 3, this.camera.zoom * factor));
    this.camera.updateProjectionMatrix();
    this.updateCamera();
    const after = this.screenToGround(px, py);
    if (before && after) { this.target.x += before.x - after.x; this.target.z += before.z - after.z; this.clampTarget(); }
  }

  centerOn(x, z) { this.target.set(x, 0, z); this.clampTarget(); }

  updateCamera() {
    this.camera.position.copy(this.target).addScaledVector(ISO_DIR, 120);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  // The sun's shadow box follows the camera and is sized to exactly what's on screen (zoomed in:
  // small box, crisp shadows; zoomed out: a bigger, softer one), snapped to whole shadow texels in
  // the light's frame so shadows stay still as the view pans.
  fitShadows() {
    this.updateCamera();
    const corners = this.width ? [[0, 0], [this.width, 0], [0, this.height], [this.width, this.height]].map(([px, py]) => this.screenToGround(px, py)) : [];
    const { center, radius, texel } = fitShadowBox(corners, this.target, { mapSize: this.sun.shadow.mapSize.x, right: this.lightRight, up: this.lightUp });
    // The light stands back far enough that every ground point of the box is inside its depth range.
    const dist = radius + 40;
    if (radius !== this.shadowRadius) {
      this.shadowRadius = radius;
      Object.assign(this.sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: dist * 2 + 20 });
      this.sun.shadow.camera.updateProjectionMatrix();
      // Bigger box → bigger texels: the soft-shadow filter samples ~2.5 texels around each point, so
      // the receiver offset has to grow with the texel or the tilted ground shadows itself (acne).
      this.sun.shadow.normalBias = Math.max(0.02, texel * 4);
      this.sun.shadow.bias = -0.0002;
    }
    this.sun.target.position.set(center.x, center.y, center.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, dist);
    this.sun.target.updateMatrixWorld();
  }

  // Screen pixel → ground point (tiles), or null.
  screenToGround(px, py) {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new Vector3();
    // The ground isn't flat: intersect the plane at the height found under the last guess and
    // repeat, so a tap on a hillside lands where the finger is, not a few tiles behind it.
    this.groundPlane.constant = 0;
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    for (let i = 0; i < 3; i++) {
      this.groundPlane.constant = -this.heightAt(hit.x, hit.z);
      if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) break;
    }
    this.groundPlane.constant = 0;
    return { x: hit.x, z: hit.z };
  }

  // Ground point (tiles) → screen pixel.
  worldToScreen(x, z) {
    const v = new Vector3(x, this.heightAt(x, z), z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  // What's under a screen point: { kind: 'squad', idx } | { kind: 'structure', index } | { kind: 'ground' }.
  // Enemies hidden by the fog of war can't be picked (you can't order an attack on what you can't
  // see). With `enemyFirst` (the player has troops selected), a visible enemy anywhere near the tap
  // wins over a friendly squad beside it: in a melee the two are inches apart, and a tap meant as
  // "attack that" must not silently turn into "select this".
  pick(px, py, view, radiusTiles = 1.1, { enemyFirst = false } = {}) {
    const g = this.screenToGround(px, py);
    if (!g) return null;
    const enemyRadius = radiusTiles * 1.45;
    let own = null; let ownD = radiusTiles * radiusTiles;
    let foe = null; let foeD = enemyRadius * enemyRadius;
    (view?.squads || []).forEach((s) => {
      if (!s.alive || !s.onField || s.fled || s.inside >= 0) return;
      const d = (s.x / Q - g.x) ** 2 + (s.y / Q - g.z) ** 2;
      if (s.side === view.playerSide) { if (d < ownD) { ownD = d; own = { kind: 'squad', idx: s.idx, side: s.side }; } return; }
      if (s.visible === false) return;
      if (d < foeD) { foeD = d; foe = { kind: 'squad', idx: s.idx, side: s.side }; }
    });
    let best = null;
    if (foe && (enemyFirst || !own || foeD < ownD)) best = foe;
    else if (own) best = own;
    if (best) return { ...best, ground: g };
    // A building of the battle economy (a generous footprint: at least ~16 px around it), or a resource node.
    const eco = this.ecoLayer.pick(g, view, Math.max(0.5, 16 * this.worldPerPixel()));
    if (eco) return { ...eco, ground: g };
    (view?.structures || []).forEach((s, index) => {
      if (!s.alive) return;
      const r = s.radius / Q + 0.6;
      if ((s.x / Q - g.x) ** 2 + (s.y / Q - g.z) ** 2 <= r * r) best = { kind: 'structure', index };
    });
    return best ? { ...best, ground: g } : { kind: 'ground', ground: g };
  }

  addMarker(x, z, color = '#a3e635') { this.markers.push({ x, z, t: 0, color }); }

  /** Squads sent at an object (orderTarget.js): target { kind, index } or null for a plain move. */
  setOrderTarget(squads, target, cmd) { recordOrderTarget(this.orderTargets, squads, target, cmd, this.time, this.lastView?.tick ?? null); }

  // The order target rings and dashed lines (orderTarget.js decides; nothing is allocated here).
  drawOrderTargets(view, selected) {
    const list = this.orderTargets;
    const st = this.orderScratch;
    const wpp = this.worldPerPixel();
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
    const spacing = Math.max(0.7, 16 * wpp); const dashLen = spacing * 0.55; const width = Math.max(0.07, 2.5 * wpp);
    const march = (this.time * spacing * 1.5) % spacing;
    const maxDash = this.orderDashes.instanceMatrix.count;
    let rn = 0; let dn = 0; let alpha = 0;
    for (let k = 0; k < list.length; k++) {
      const s = orderRingState(list[k], view, selected, this.time, wpp, st);
      if (!s) continue;
      alpha = Math.max(alpha, s.alpha);
      // An enemy squad: ring its whole block where it is drawn this frame (outside the figures).
      const memo = list[k].target.kind === 'squad' ? this.soldierMemo.get(list[k].target.index) : null;
      if (memo && memo.n > 0) {
        // figures stand behind the squad's point in rows (drawSquads): centre on the block
        const rows = Math.ceil(memo.n / Math.max(1, memo.cols)); const back = ((rows - 1) * memo.spacing) / 2;
        s.x = memo.x - memo.fx * back; s.z = memo.z - memo.fz * back;
        s.radius = Math.max(s.radius, Math.hypot(memo.cols * memo.spacing, rows * memo.spacing) / 2 + 0.6);
      }
      const y = this.heightAt(s.x, s.z) + 0.1;
      const r = s.radius * (1 + 0.08 * pulse);
      tmp.rotation.set(0, 0, 0); tmp.position.set(s.x, y, s.z);
      tmp.scale.set(r * 1.1, 1, r * 1.1); tmp.updateMatrix(); this.orderShade.setMatrixAt(rn, tmp.matrix);
      tmp.scale.set(r, 1, r); tmp.updateMatrix(); this.orderRings.setMatrixAt(rn, tmp.matrix);
      rn += 1;
      if (!s.hasFrom) continue;
      const dx = s.x - s.fromX; const dz = s.z - s.fromZ;
      const len = Math.hypot(dx, dz); const end = len - s.radius;
      if (end <= 0.6) continue;
      const ux = dx / len; const uz = dz / len;
      tmp.rotation.set(0, Math.atan2(-uz, ux), 0); tmp.scale.set(dashLen, 1, width);
      for (let d = 0.6 + march; d + dashLen <= end && dn < maxDash; d += spacing) {
        const cx = s.fromX + ux * (d + dashLen / 2); const cz = s.fromZ + uz * (d + dashLen / 2);
        tmp.position.set(cx, this.heightAt(cx, cz) + 0.12, cz); tmp.updateMatrix();
        this.orderDashes.setMatrixAt(dn, tmp.matrix); dn += 1;
      }
    }
    this.orderRings.material.opacity = alpha * (0.7 + 0.3 * pulse);
    this.orderShade.material.opacity = alpha * 0.5;
    this.orderDashes.material.opacity = alpha * 0.85;
    this.orderRings.count = rn; this.orderShade.count = rn; this.orderDashes.count = dn;
    if (rn) { this.orderRings.instanceMatrix.needsUpdate = true; this.orderShade.instanceMatrix.needsUpdate = true; }
    if (dn) this.orderDashes.instanceMatrix.needsUpdate = true;
  }

  // Turn sim events into short effects.
  pushEvents(events, view) {
    events.forEach((e) => {
      if (e.type === 'shot' || e.type === 'towerShot') {
        const from = e.type === 'towerShot' ? view.structures.find((s) => s.id === e.structure) : view.squads[e.from];
        const to = e.to !== undefined ? view.squads[e.to] : view.structures.find((s) => s.id === e.structure);
        // who shot (the projectile art by class and age; a tower shoots with the defender's age)
        const shooter = e.type === 'towerShot' ? { classId: 'tower', ageId: this.setup.sides[1].ageId } : { classId: from?.classId, ageId: from?.ageId };
        if (from && to) this.fx.push({ kind: 'tracer', x0: from.x / Q, z0: from.y / Q, x1: to.x / Q, z1: to.y / Q, t: 0, life: 0.22, shooter });
        if (from && e.type === 'shot' && getAgeIndex(shooter.ageId) >= getAgeIndex('gunpowder') && this.fxSprites.has('muzzle-flash')) this.fx.push({ kind: 'sprite', sheet: 'muzzle-flash', x: from.x / Q, z: from.y / Q, y: 0.5, t: 0, life: 0.15 });
      } else if (e.type === 'melee' && e.to !== undefined) {
        const to = view.squads[e.to];
        if (to && this.fxSprites.has('impact-sparks')) this.fx.push({ kind: 'sprite', sheet: 'impact-sparks', x: to.x / Q + (hash01(e.t * 7) - 0.5) * 0.6, z: to.y / Q + (hash01(e.t * 13) - 0.5) * 0.6, y: 0.4, t: 0, life: 0.35 });
        else if (to) for (let k = 0; k < 3; k++) this.fx.push({ kind: 'spark', x: to.x / Q + (hash01(e.t * 7 + k) - 0.5), z: to.y / Q + (hash01(e.t * 13 + k) - 0.5), t: 0, life: 0.35, seed: k });
        if (to && view.squads[e.from]?.classId === 'cavalry' && this.fxSprites.has('dust')) this.fx.push({ kind: 'sprite', sheet: 'dust', x: to.x / Q, z: to.y / Q, y: 0, t: 0, life: 0.8 });
        if (to && e.damage > 0 && isOrganic(to.classId, to.ageId)) this.bleed(to.x / Q, to.y / Q, e.t * 19 + e.from * 7);
      } else if (e.type === 'impact') {
        const r = e.radius / Q;
        const n = Math.min(24, 6 + Math.round(r * 3));
        if (this.fxSprites.has('explosion')) {
          this.fx.push({ kind: 'sprite', sheet: 'explosion', x: e.x / Q, z: e.y / Q, y: 0, t: 0, life: 0.9, size: Math.max(1, r) });
          if (this.fxSprites.has('smoke')) this.fx.push({ kind: 'sprite', sheet: 'smoke', x: e.x / Q, z: e.y / Q, y: 0.3, rise: 1.2, t: 0, life: 2.4, size: Math.max(1, r) });
        } else for (let k = 0; k < n; k++) this.fx.push({ kind: 'spark', x: e.x / Q + (hash01(e.t * 11 + k) - 0.5) * r * 1.6, z: e.y / Q + (hash01(e.t * 17 + k) - 0.5) * r * 1.6, t: 0, life: 0.9, seed: k, big: true, fire: true });
        this.addMarker(e.x / Q, e.y / Q, '#f97316');
        if (r > 6) this.flash = 1; // a nuclear flash
      } else if (e.type === 'ability') {
        const src = view.squads[e.id];
        if (src) this.addMarker(src.x / Q, src.y / Q, '#c084fc');
      } else if (e.type === 'destroyed' || e.type === 'keepBreached' || e.type === 'structureDestroyed') {
        const s = e.id !== undefined ? view.squads[e.id] : view.structures.find((st) => st.id === e.structure);
        if (s && this.fxSprites.has('debris')) {
          this.fx.push({ kind: 'sprite', sheet: 'debris', x: s.x / Q, z: s.y / Q, y: 0, t: 0, life: 0.8 });
          if (this.fxSprites.has('smoke')) this.fx.push({ kind: 'sprite', sheet: 'smoke', x: s.x / Q, z: s.y / Q, y: 0.3, rise: 1, t: 0, life: 2 });
        } else if (s) for (let k = 0; k < 8; k++) this.fx.push({ kind: 'spark', x: s.x / Q + (hash01(k * 3 + e.t) - 0.5) * 1.6, z: s.y / Q + (hash01(k * 5 + e.t) - 0.5) * 1.6, t: 0, life: 0.8, seed: k, big: true });
      }
    });
    const budget=BATTLE_GRAPHICS.effects;
    if (this.fx.length > budget) this.fx.splice(0, this.fx.length - budget);
  }

  diagnostics() {
    let figures = 0; this.soldierLayers.forEach((l) => { figures += l.count; });
    return {dpr:this.dpr,...frameSummary(this.frameTimes),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,figures,tier:this.soldierTier??null,bias:this.detail.bias,zoom:this.camera.zoom};
  }

  // Adaptive soldier detail (quality.js ADAPTIVE): while frames keep up with the display (p95 at
  // or under STEP_UP_MS), one finer soldier level than their size on screen asks for, then two;
  // a second of slow frames (p95 over STEP_DOWN_MS) steps back down and holds there a while. The
  // triangle budget only binds at the base level, so it is a floor for slow devices.
  adaptDetail(dt) {
    const d = this.detail;
    d.frames[d.n++ % d.frames.length] = dt * 1000;
    if (d.n % d.frames.length || this.time < d.holdUntil) return;
    const p95 = [...d.frames].sort((a, b) => a - b)[Math.floor(d.frames.length * 0.95)];
    d.p95 = p95;
    if (p95 > ADAPTIVE.stepDownMs && d.bias > 0) { d.bias -= 1; d.ceiling = d.bias; d.holdUntil = this.time + ADAPTIVE.holdAfterDownS; d.retryAt = this.time + ADAPTIVE.retryS; return; }
    if (this.time >= d.retryAt) d.ceiling = ADAPTIVE.maxBias;
    if (p95 <= ADAPTIVE.stepUpMs && d.bias < d.ceiling) { d.bias += 1; d.holdUntil = this.time + ADAPTIVE.holdAfterUpS; }
  }

  adaptResolution(dt) {
    // A stable 60 Hz display delivers ~16.7 ms frames even with GPU headroom. Requiring
    // <12 ms permanently trapped those displays at reduced resolution after a slowdown.
    if (dt > 0.02) { this.slowFrames += 1; this.fastFrames = 0; } else if (dt < 0.018) { this.fastFrames += 1; this.slowFrames = 0; } else { this.slowFrames = 0; this.fastFrames = 0; }
    let next = this.dpr;
    if (this.slowFrames >= 3 && this.dpr > 1) { next = this.dpr > 1.25 ? 1.25 : 1; this.slowFrames = -30; } // give the new size a moment
    else if (this.fastFrames >= 240 && this.dpr < this.baseDpr) { next = this.dpr < 1.25 ? Math.min(1.25, this.baseDpr) : this.baseDpr; this.fastFrames = 0; }
    if (next !== this.dpr) {
      this.dpr = next;
      this.renderer.setPixelRatio(next);
      if (this.width) this.renderer.setSize(this.width, this.height, false);
    }
  }

  // Where a world point (Q units) sits across the screen, -1 (left) to 1 (right): the stereo pan
  // for battle sounds.
  screenPan(x, y) {
    this.tmpPan = this.tmpPan || new Vector3();
    this.tmpPan.set(x / Q, 0, y / Q).project(this.camera);
    return Math.max(-1, Math.min(1, this.tmpPan.x));
  }

  // The camera's view of the ground for positional sound (src/audio/spatial.js): its centre and the
  // half-extent vectors to the middle of the right and top screen edges, in tiles. null before
  // the first resize.
  audioView() {
    if (!this.width || !this.height) return null;
    this.updateCamera();
    const c = this.screenToGround(this.width / 2, this.height / 2);
    const r = this.screenToGround(this.width, this.height / 2);
    const t = this.screenToGround(this.width / 2, 0);
    if (!c || !r || !t) return null;
    return { cx: c.x, cz: c.z, ax: r.x - c.x, az: r.z - c.z, bx: t.x - c.x, bz: t.z - c.z };
  }

  render(prev, cur, alpha, ui, dt) {
    this.time += dt;
    this.adaptDetail(dt);
    RIG_TIME.value = this.time;
    this.adaptResolution(dt);
    this.fitShadows();
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.8); this.scene.background.copy(this.skyColor).lerp(new Color('#ffffff'), this.flash); }
    this.updateCamera();
    this.vegetation?.update(this.camera.zoom);
    this.terrainArt?.update(this.camera.zoom);
    if (cur) this.lastView = cur;
    if (cur) this.drawSquads(prev, cur, alpha, ui);
    if (cur) this.drawStructures(cur);
    if (cur) this.cityLayer.update(cur);
    if (cur) this.ecoLayer.update(cur, this.viewCuller());
    if (cur) this.drawPoints(cur);
    if (cur) this.drawOrderTargets(cur, ui?.selected);
    this.drawFx(dt);
    this.renderer.render(this.scene, this.camera);
    this.frameTimes.push(dt*1000);
    if(this.frameTimes.length>180)this.frameTimes.shift();
  }

  // A test for "is a ground point (tiles) within `margin` tiles of the screen?", from this frame's
  // camera. The camera is orthographic: a point's screen position is a fixed linear map of it.
  viewCuller() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.viewProj = (this.viewProj || cam.projectionMatrix.clone()).multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const e = this.viewProj.elements;
    const perTile = (2 * cam.zoom) / Math.min(cam.right - cam.left, cam.top - cam.bottom); // ndc per tile, the larger of the two axes
    return (x, z, margin) => {
      const y = this.heightAt(x, z);
      const m = 1 + margin * perTile;
      const nx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const ny = e[1] * x + e[5] * y + e[9] * z + e[13];
      return nx > -m && nx < m && ny > -m && ny < m;
    };
  }

  // What never changes about a squad's figures (class and age are fixed for a battle): its stats,
  // soldier layer, how many figures it draws at full strength and how they stand.
  squadLook(s) {
    const stats = s.classId === 'naval' ? getUnitBattleStats({ classId: 'naval', navalLine: s.navalLine }, s.ageId) : getBattleStats(s.classId, s.ageId);
    // the side's people's signature unit draws in place of the base unit when its model is in
    // (data/signatureUnits.js, unitModels.js); without it the base unit's layer
    const people = this.sidePeople?.[s.side] ?? (this.sidePeople = this.setup.sides.map((sd) => peopleForNationId(sd.nationId)))[s.side];
    const sig = people ? signatureKey(s.classId, people) : null;
    // a raid party's riders and a hired band's foot draw their irregular look when its model is in
    const look = lookKey(s.look || unitLookOf(null, this.setup, s.side), s.classId);
    return {
      stats,
      layer: this.soldierLayer(s.ageId, sig && hasSoldierOverride(s.ageId, sig) ? sig : look && hasSoldierOverride(s.ageId, look) ? look : s.classId),
      general: hasSoldierOverride(s.ageId, 'general') ? this.soldierLayer(s.ageId, 'general') : null,
      drawn: this.figureScale < 1 ? { soldiers: scaledSoldiers(stats.soldiers, this.figureScale) } : stats,
      big: s.classId === 'cavalry' || s.classId === 'siege' || s.classId === 'support' || s.classId === 'naval' || !!stats.flying,
      spacing: stats.flying ? 1.4 : s.classId === 'naval' ? 2.2 : s.classId === 'siege' ? 1.5 : s.classId === 'cavalry' ? 0.95 : s.classId === 'support' ? 1.05 : 0.52,
      scale: MODEL_SCALE[s.classId] || 0.62,
      organic: isOrganic(s.classId, s.ageId),
      sideColor: this.sideColors[s.side],
      tone: skinToneFor(this.setup.sides[s.side]?.nationId) // one people, one skin tone (unitVariants.js)
    };
  }

  // A squad's figures where they stand in its block (lateral, back), the cos and sin of each one's
  // small turn, its walk phase and its look (skin, emblem, cloth): all fixed for a given count and
  // spacing, so worked out once and again only when the squad loses a figure.
  squadFigures(info, s, n, cols, spacing) {
    const f = info.fig;
    if (f && f.n === n && f.cols === cols && f.spacing === spacing) return f.data;
    const data = new Float32Array(n * FIG);
    const jitter = info.big ? 0.1 : 0.07;
    const look = new Float32Array(4);
    for (let i = 0; i < n; i++) {
      const d = i * FIG; const col = i % cols; const row = Math.floor(i / cols);
      data[d] = (col - (cols - 1) / 2) * spacing + (hash01(s.idx * 97 + i) - 0.5) * jitter * 2;
      data[d + 1] = row * spacing + (hash01(s.idx * 53 + i) - 0.5) * jitter * 2;
      const j = (hash01(s.idx * 7 + i) - 0.5) * 0.18;
      data[d + 2] = Math.cos(j); data[d + 3] = Math.sin(j);
      data[d + 4] = hash01(s.idx * 131 + i) * 6.283;
      writeSoldierVariant(look, 0, s.idx, s.side, i, info.tone);
      data.set(look, d + 5);
    }
    info.fig = { n, cols, spacing, data };
    return data;
  }

  // A soldier's height on screen (css px) at the current zoom.
  soldierPx() { return (MODEL_SCALE.infantry * this.camera.zoom * (this.height || 1)) / Math.max(1e-6, this.camera.top - this.camera.bottom); }

  drawSquads(prev, cur, alpha, ui) {
    const selected = ui?.selected || new Set();
    this.soldierLayers.forEach((l) => { l.count = 0; });
    let discN = 0; let ringN = 0; let barN = 0; let bannerN = 0;
    const camQuat = this.camera.quaternion;
    const camRight = CAM_RIGHT.set(1, 0, 0).applyQuaternion(camQuat);
    const camBasis = CAM_BASIS.makeRotationFromQuaternion(camQuat).elements;
    // A view stays current for a few screen frames: repaint the fog only when a new grid arrives.
    if (cur.fog && cur.fog !== this.lastFog) { this.lastFog = cur.fog; this.setFog(cur.fog); }
    const cull = this.viewCuller();
    // Fewer figures in a big battle stand as close as a full squad's (a sparse block reads as noise;
    // the sim's squad radius is unchanged, only the drawing is smaller and fuller).
    const spread = 1;
    const discMat = this.discs.instanceMatrix.array; const discCol = instanceColors(this.discs);
    const ringMat = this.rings.instanceMatrix.array;
    const poleMat = this.bannerPoles.instanceMatrix.array; const flagMat = this.bannerFlags.instanceMatrix.array; const flagCol = instanceColors(this.bannerFlags);
    const barBgMat = this.barBg.instanceMatrix.array; const barFillMat = this.barFill.instanceMatrix.array; const barFillCol = instanceColors(this.barFill);
    cur.squads.forEach((s) => {
      const memo = this.soldierMemo.get(s.idx);
      // Wiped out on the field: every soldier still standing last frame falls at once.
      if (!s.alive && memo && !s.fled) this.spillBlood(memo, 0);
      if (!s.alive || !s.onField || s.inside >= 0 || s.fled) { this.soldierMemo.delete(s.idx); return; } // garrisoned squads are inside their building
      if (s.side !== cur.playerSide && s.visible === false) { this.soldierMemo.delete(s.idx); return; } // in the fog of war
      const p = prev?.squads?.[s.idx];
      const useP = p && p.onField;
      const x = (useP ? lerp(p.x, s.x, alpha) : s.x) / Q;
      const z = (useP ? lerp(p.y, s.y, alpha) : s.y) / Q;
      const info = this.squadInfo[s.idx] || (this.squadInfo[s.idx] = this.squadLook(s));
      const { stats, layer, big } = info;
      const n = getSoldierCount(info.drawn, s.strength, s.maxStrength);
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * (big ? 1.2 : 1.8))));
      const spacing = info.spacing * spread;
      // Off screen (with a margin for the block, which runs back from its front rank, the figures'
      // height and the banner): nothing to draw, so no figures, ring, banner or bar, and no blood
      // for its losses while away.
      if (!cull(x, z, Math.max(cols / 2, Math.ceil(n / cols)) * spacing + 3)) { this.soldierMemo.delete(s.idx); return; }
      const facing = useP ? lerpAngle256(p.facing, s.facing, alpha) : s.facing;
      // Squads in contact get nudged apart a little every tick; that's jostling, not marching.
      const step = useP ? Math.hypot(p.x - s.x, p.y - s.y) / Q : 0;
      const moving = step > 0.03 && !s.striking;
      const y = s.classId === 'naval' ? -0.2 : this.heightAt(x, z);
      const a = (facing / 256) * Math.PI * 2;
      const fx = Math.cos(a); const fz = Math.sin(a);
      const scale = info.scale;
      const heading = Math.atan2(fx, fz);
      // Fighting while it's actually swinging or shooting, or standing its ground with a target.
      const fighting = !s.routed && (s.striking || (s.target >= 0 && !moving));
      const isSelected = selected.has(s.idx);
      tmpColor.copy(info.sideColor);
      if (s.routed) tmpColor.lerp(GREY_ROUT, 0.6);
      if (s.hidden) tmpColor.lerp(PALE_AMBUSH, 0.45); // in ambush
      if (isSelected) tmpColor.lerp(WHITE, 0.2);
      const { r: cr, g: cg, b: cb } = tmpColor;
      const mat = layer.matrix.array; const colArr = layer.color.array; const animArr = layer.anim.array;
      const walking = moving || s.routed ? 1 : 0; const striking = fighting ? 1 : 0;
      const turn = heading + (s.routed ? Math.PI : 0); // routed troops turn and run
      const ct = Math.cos(turn) * scale; const st = Math.sin(turn) * scale;
      const fig = this.squadFigures(info, s, n, cols, spacing);
      const varArr = layer.variant.array;
      for (let i = 0; i < n; i++) {
        const k = layer.count;
        if (k >= layer.capacity) break;
        const d = i * FIG;
        const lat = fig[d]; const back = fig[d + 1];
        const px = x + (-fz) * lat - fx * back; const pz = z + fx * lat - fz * back;
        // Everyone faces the squad's heading, with a touch of variety (cos and sin of the turn
        // plus the figure's own small jitter, by the angle-sum rule).
        if (stats.flying) {
          const yaw = turn + Math.atan2(fig[d + 3], fig[d + 2]);
          tmp.position.set(px, 2.4 + Math.sin(this.time * 2 + i) * 0.15, pz);
          tmp.rotation.set(Math.sin(this.time + i) * 0.15, yaw, 0);
          tmp.scale.set(scale, scale, scale);
          tmp.updateMatrix();
          tmp.matrix.toArray(mat, k * 16);
        } else {
          const c = ct * fig[d + 2] - st * fig[d + 3]; const sn = st * fig[d + 2] + ct * fig[d + 3]; const o = k * 16;
          mat[o] = c; mat[o + 1] = 0; mat[o + 2] = -sn; mat[o + 3] = 0;
          mat[o + 4] = 0; mat[o + 5] = scale; mat[o + 6] = 0; mat[o + 7] = 0;
          mat[o + 8] = sn; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0;
          mat[o + 12] = px; mat[o + 13] = this.heightAt(px, pz); mat[o + 14] = pz; mat[o + 15] = 1;
        }
        colArr[k * 3] = cr; colArr[k * 3 + 1] = cg; colArr[k * 3 + 2] = cb;
        animArr[k * 3] = fig[d + 4]; animArr[k * 3 + 1] = walking; animArr[k * 3 + 2] = striking;
        varArr[k * 4] = fig[d + 5]; varArr[k * 4 + 1] = fig[d + 6]; varArr[k * 4 + 2] = fig[d + 7]; varArr[k * 4 + 3] = fig[d + 8];
        layer.count += 1;
      }
      // Soldiers lost since last frame go down in a spray of blood where they stood.
      if (memo && n < memo.n) this.spillBlood({ n: memo.n, x, z, fx, fz, cols, spacing, big, organic: info.organic, idx: s.idx }, n);
      const m = memo || {};
      Object.assign(m, { n, x, z, fx, fz, cols, spacing, big, organic: info.organic, idx: s.idx });
      if (!memo) this.soldierMemo.set(s.idx, m);
      // Ground ring, selection ring, standard-bearer banner, strength bar (written straight into
      // their instance buffers: three.js's Object3D compose and colour parsing cost more than
      // the soldiers themselves at 600 squads).
      const r = 0.7 + Math.sqrt(n) * (big ? 0.44 : 0.25);
      // Readable at 300 to 500 a side (phase R1 readability): rings only under the selection, one
      // short standard per few squads (and every general), shown from mid zoom in, and a strength
      // bar only on the selection and on squads losing men in a fight.
      const side = info.sideColor;
      const zoom = this.camera.zoom;
      if (isSelected) {
        writeYaw(discMat, discN, x, y + 0.05, z, 0, r, 1, r);
        discCol[discN * 3] = side.r; discCol[discN * 3 + 1] = side.g; discCol[discN * 3 + 2] = side.b;
        discN += 1;
        writeYaw(ringMat, ringN, x, y + 0.07, z, 0, r, 1, r); ringN += 1;
      }
      if (!stats.flying && s.classId !== 'worker' && (isSelected || s.commanderId || (zoom >= BANNER_MIN_ZOOM && s.idx % this.bannerEvery === 0))) {
        const bx = x + fx * 0.25 + (-fz) * (r * 0.55); const bz = z + fz * 0.25 + fx * (r * 0.55);
        writeYaw(poleMat, bannerN, bx, this.heightAt(bx, bz), bz, heading - Math.PI / 2 + Math.sin(this.time * 3 + s.idx) * 0.25, 1, BANNER_HEIGHT, 1);
        flagMat.set(poleMat.subarray(bannerN * 16, bannerN * 16 + 16), bannerN * 16);
        flagCol[bannerN * 3] = side.r; flagCol[bannerN * 3 + 1] = side.g; flagCol[bannerN * 3 + 2] = side.b;
        bannerN += 1;
        // the general's own figure beside the standard (src/assets/units/<age>-general.glb)
        const gl = s.commanderId ? info.general : null;
        if (gl && gl.count < gl.capacity) {
          const gk = gl.count; const gx = bx - fx * 0.6; const gz = bz - fz * 0.6; const gs = MODEL_SCALE.general;
          writeYaw(gl.matrix.array, gk, gx, this.heightAt(gx, gz), gz, turn, gs, gs, gs);
          gl.color.array[gk * 3] = cr; gl.color.array[gk * 3 + 1] = cg; gl.color.array[gk * 3 + 2] = cb;
          gl.anim.array[gk * 3] = fig[4]; gl.anim.array[gk * 3 + 1] = walking; gl.anim.array[gk * 3 + 2] = striking;
          gl.variant.array.set(fig.subarray(5, 9), gk * 4);
          gl.count += 1;
        }
      }
      const hurt = s.strength < s.startStrength && (s.striking || s.target >= 0);
      if (!isSelected && !(hurt && zoom >= BAR_MIN_ZOOM)) return;
      const frac = Math.max(0, s.strength / Math.max(1, s.startStrength));
      const by = y + (stats.flying ? 3.8 : big ? 2.1 : 1.75);
      writeBasis(barBgMat, barN, camBasis, x, by, z, 1);
      writeBasis(barFillMat, barN, camBasis, x - camRight.x * 0.5, by - camRight.y * 0.5, z - camRight.z * 0.5, frac);
      const bar = frac > 0.3 ? BAR_GREEN : BAR_LIME;
      barFillCol[barN * 3] = bar.r; barFillCol[barN * 3 + 1] = bar.g; barFillCol[barN * 3 + 2] = bar.b;
      barN += 1;
    });
    // One detail level for every soldier this frame (soldierLod.js): what their size on screen
    // calls for, coarser while the figures in view would pass the triangle budget.
    const layers = [...this.soldierLayers.values()];
    this.soldierTier = pickSoldierTier({ px: this.soldierPx(), layers: layers.map((l) => ({ figures: l.count, tris: l.tris })), budget: this.figureBudget, prev: this.soldierTier ?? 2, bias: this.detail.bias });
    layers.forEach((l) => {
      l.levels.forEach((m, k) => { m.count = l.count; m.visible = k === this.soldierTier && l.count > 0; });
      if (!l.count) return;
      [l.matrix, l.color, l.anim, l.variant].forEach((a) => {
        a.clearUpdateRanges(); a.addUpdateRange(0, l.count * a.itemSize); a.needsUpdate = true;
      });
    });
    [[this.discs, discN], [this.rings, ringN], [this.barBg, barN], [this.barFill, barN], [this.bannerPoles, bannerN], [this.bannerFlags, bannerN]].forEach(([m, n]) => {
      m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  // Soldiers `from`..memo.n-1 of a squad (laid out as in drawSquads) have just fallen: each one
  // throws a few droplets and leaves a pool on the ground; a machine throws sparks and leaves a
  // scorch mark instead.
  spillBlood(memo, from) {
    const { x, z, fx, fz, cols, spacing, big, organic, idx } = memo;
    for (let i = from; i < memo.n; i++) {
      const col = i % cols; const row = Math.floor(i / cols);
      const lat = (col - (cols - 1) / 2) * spacing; const back = row * spacing;
      const px = x + (-fz) * lat - fx * back; const pz = z + fx * lat - fz * back;
      const seed = idx * 977 + i * 31 + Math.floor(this.time * 60);
      if (organic) {
        for (let k = 0; k < 7; k++) {
          const a = hash01(seed + k * 3) * Math.PI * 2; const v = 0.6 + hash01(seed + k * 5) * 1.6;
          this.fx.push({ kind: 'blood', x: px, z: pz, y: 0.55 + hash01(seed + k) * 0.35, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 1 + hash01(seed + k * 7) * 2.2, t: 0, life: 0.7, color: BLOOD_COLORS[k % 3] });
        }
      } else if (this.fxSprites.has('fire-small')) {
        this.fx.push({ kind: 'sprite', sheet: 'fire-small', x: px, z: pz, y: 0, t: 0, life: 1.6 });
        if (this.fxSprites.has('smoke')) this.fx.push({ kind: 'sprite', sheet: 'smoke', x: px, z: pz, y: 0.3, rise: 1, t: 0, life: 2.2 });
      } else {
        for (let k = 0; k < 4; k++) this.fx.push({ kind: 'spark', x: px + (hash01(seed + k) - 0.5), z: pz + (hash01(seed + k * 3) - 0.5), t: 0, life: 0.9, seed: k, big: true, fire: k % 2 === 0 });
      }
      const size = (organic ? 0.45 + hash01(seed + 11) * 0.35 : 0.8) * (big ? 1.6 : 1);
      this.splats.push({ x: px, z: pz, rot: hash01(seed + 13) * Math.PI * 2, size, t: 0, layer: this.splats.length % 3, color: organic ? '#6b0f0f' : '#1c1917' });
    }
    if (this.splats.length > MAX_SPLATS) this.splats.splice(0, this.splats.length - MAX_SPLATS);
  }

  // A few drops on every melee blow that lands on living troops (death gets the full spray).
  bleed(x, z, seed) {
    for (let k = 0; k < 3; k++) {
      const a = hash01(seed + k * 3) * Math.PI * 2; const v = 0.4 + hash01(seed + k * 5) * 0.9;
      this.fx.push({ kind: 'blood', x: x + (hash01(seed + k) - 0.5) * 0.8, z: z + (hash01(seed + k * 9) - 0.5) * 0.8, y: 0.6, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 0.8 + hash01(seed + k * 7) * 1.2, t: 0, life: 0.5, color: BLOOD_COLORS[k % 3] });
    }
  }

  drawStructures(cur) {
    this.civicStructures?.update(cur);
    this.battleProps?.update(cur);
    let n = 0;
    const camQuat = this.camera.quaternion;
    cur.structures.forEach((s) => {
      const g = this.structureMeshes.get(s.id);
      if (!g) return;
      const frac = s.hp / Math.max(1, s.maxHp);
      g.scale.y = s.alive ? 1 : 0.28;
      g.children.forEach((c) => { if (c.material?.color && !s.alive) c.material.color.set('#57534e'); });
      if (!s.alive) return;
      const x = s.x / Q; const z = s.y / Q;
      tmp.quaternion.copy(camQuat); tmp.position.set(x, this.heightAt(x, z) + (s.kind === 'keep' ? 4 : s.kind === 'building' ? 2.1 : 3.3), z); tmp.scale.set(s.kind === 'keep' ? 2.4 : 1.4, 1, 1); tmp.updateMatrix();
      this.structBarBg.setMatrixAt(n, tmp.matrix);
      tmp.position.addScaledVector(new Vector3(1, 0, 0).applyQuaternion(camQuat), -(s.kind === 'keep' ? 1.2 : 0.7)); tmp.scale.set((s.kind === 'keep' ? 2.4 : 1.4) * frac, 1, 1); tmp.updateMatrix();
      this.structBarFill.setMatrixAt(n, tmp.matrix);
      this.structBarFill.setColorAt(n, tmpColor.setHSL(0.08 + 0.25 * frac, 0.8, 0.5));
      n += 1;
    });
    // The battle economy's damaged and unfinished buildings (economyLayer.js).
    this.ecoLayer.bars(cur).forEach((b) => {
      tmp.quaternion.copy(camQuat); tmp.position.set(b.x, this.heightAt(b.x, b.z) + b.h, b.z); tmp.scale.set(b.w, 1, 1); tmp.updateMatrix();
      this.structBarBg.setMatrixAt(n, tmp.matrix);
      tmp.position.addScaledVector(new Vector3(1, 0, 0).applyQuaternion(camQuat), -b.w / 2); tmp.scale.set(b.w * b.frac, 1, 1); tmp.updateMatrix();
      this.structBarFill.setMatrixAt(n, tmp.matrix);
      this.structBarFill.setColorAt(n, tmpColor.setHSL(0.08 + 0.25 * b.frac, 0.8, 0.5));
      n += 1;
    });
    [this.structBarBg, this.structBarFill].forEach((m) => { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  drawPoints(cur) {
    cur.points.forEach((p) => {
      const g = this.pointMeshes.get(p.id);
      if (!g) return;
      g.userData.mat.color.copy(colorOf(p.owner === 0 || p.owner === 1 ? this.setup.sides[p.owner].color : '#9ca3af'));
      g.children[1].rotation.y = Math.sin(this.time * 3) * 0.25;
    });
  }

  drawFx(dt) {
    let tn = 0; let sn = 0; let mn = 0;
    this.fx = this.fx.filter((f) => (f.t += dt) < f.life);
    const sprites = this.fxSprites; const shots = this.projectileArt;
    sprites.begin(CAM_BASIS.makeRotationFromQuaternion(this.camera.quaternion).elements);
    shots.begin();
    this.fx.forEach((f) => {
      const k = f.t / f.life;
      if (f.kind === 'sprite') {
        sprites.add(f.sheet, f.x, this.heightAt(f.x, f.z) + (f.y || 0) + (f.rise || 0) * k, f.z, { k, scale: f.size || 1, alpha: f.rise ? 1 - k * k : 1 });
        return;
      }
      if (f.kind === 'tracer' && tn < 64) {
        const dx = f.x1 - f.x0; const dz = f.z1 - f.z0; const len = Math.hypot(dx, dz);
        const hx = f.x0 + dx * k; const hz = f.z0 + dz * k;
        const peak = Math.min(2.5, len * 0.12);
        const arc = Math.sin(k * Math.PI) * peak;
        // the projectile's model when its file has one (projectiles.js), else the tracer streak
        const obj = f.shooter && shots.objectFor(f.shooter.classId, f.shooter.ageId);
        if (obj) { shots.add(obj, hx, this.heightAt(hx, hz) + 0.8 + arc, hz, dx, dz, (Math.PI * peak * Math.cos(k * Math.PI)) / Math.max(0.1, len)); return; }
        tmp.position.set(hx, this.heightAt(hx, hz) + 0.8 + arc, hz);
        tmp.rotation.set(0, -Math.atan2(dz, dx), 0); tmp.scale.set(0.6, 1, 1); tmp.updateMatrix();
        this.tracers.setMatrixAt(tn, tmp.matrix); tn += 1;
      } else if (f.kind === 'spark' && sn < 128) {
        const rise = f.big ? k * 1.4 : k * 0.6;
        tmp.position.set(f.x, this.heightAt(f.x, f.z) + 0.4 + rise, f.z);
        tmp.rotation.set(k * 4, k * 5, 0); const sc = (f.big ? 2.2 : 1) * (1 - k); tmp.scale.set(sc, sc, sc); tmp.updateMatrix();
        this.sparks.setMatrixAt(sn, tmp.matrix);
        this.sparks.setColorAt(sn, colorOf(f.fire ? (k < 0.4 ? '#fb923c' : '#57534e') : f.big ? '#a8a29e' : '#fbbf24'));
        sn += 1;
      }
    });
    // Buildings and city structures under 30% HP burn while a fire sheet is in.
    if (sprites.has('fire-large') && this.lastView) {
      const burn = (x, z, phase) => sprites.add('fire-large', x, this.heightAt(x, z) + 0.2, z, { time: this.time + phase });
      (this.lastView.eco?.buildings || []).forEach((b) => { if (b.alive && !b.proxy && b.built && b.hp < b.maxHp * 0.3) burn(b.x / Q, b.y / Q, b.idx * 0.37); });
      (this.lastView.structures || []).forEach((st, i) => { if (st.alive && st.maxHp > 0 && st.hp < st.maxHp * 0.3) burn(st.x / Q, st.y / Q, i * 0.41); });
    }
    sprites.end(); shots.end();
    let bn = 0;
    this.fx.forEach((f) => {
      if (f.kind !== 'blood' || bn >= MAX_BLOOD) return;
      const t = f.t;
      const ground = this.heightAt(f.x, f.z);
      const px = f.x + f.vx * t * 0.6; const pz = f.z + f.vz * t * 0.6;
      const py = Math.max(ground + 0.03, ground + f.y + f.vy * t - 4.9 * t * t);
      tmp.position.set(px, py, pz); tmp.rotation.set(t * 6, t * 4, 0);
      const sc = 1 - (f.t / f.life) * 0.4; tmp.scale.set(sc, sc * 1.4, sc); tmp.updateMatrix();
      this.blood.setMatrixAt(bn, tmp.matrix); this.blood.setColorAt(bn, colorOf(f.color)); bn += 1;
    });
    this.blood.count = bn; this.blood.instanceMatrix.needsUpdate = true; if (this.blood.instanceColor) this.blood.instanceColor.needsUpdate = true;
    this.splats = this.splats.filter((sp) => (sp.t += dt) < SPLAT_LIFE);
    const splatN = [0, 0, 0];
    this.splats.forEach((sp) => {
      const m = this.splatLayers[sp.layer]; const k = splatN[sp.layer];
      if (k >= 64) return;
      // Spreads out over the first half second, then shrinks away over the last four seconds.
      const grow = Math.min(1, sp.t / 0.5); const fade = Math.min(1, (SPLAT_LIFE - sp.t) / 4);
      const sc = sp.size * (0.4 + 0.6 * grow) * fade;
      tmp.rotation.set(0, sp.rot, 0); tmp.position.set(sp.x, this.heightAt(sp.x, sp.z) + 0.03, sp.z); tmp.scale.set(sc, 1, sc); tmp.updateMatrix();
      m.setMatrixAt(k, tmp.matrix); m.setColorAt(k, colorOf(sp.color)); splatN[sp.layer] += 1;
    });
    this.splatLayers.forEach((m, i) => { m.count = splatN[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    this.markers = this.markers.filter((m) => (m.t += dt) < 0.8);
    this.markers.forEach((m) => {
      if (mn >= 64) return;
      const k = m.t / 0.8;
      tmp.rotation.set(0, 0, 0); tmp.position.set(m.x, this.heightAt(m.x, m.z) + 0.08, m.z); const sc = 0.6 + k * 1.2; tmp.scale.set(sc, 1, sc); tmp.updateMatrix();
      this.markerRings.setMatrixAt(mn, tmp.matrix); this.markerRings.setColorAt(mn, colorOf(m.color)); mn += 1;
    });
    [[this.tracers, tn], [this.sparks, sn], [this.markerRings, mn]].forEach(([m, n]) => { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  dispose() {
    this.disposed = true;
    this.soldierLayers.forEach((l) => l.levels.forEach((m) => m.dispose()));
    this.cityLayer?.dispose();
    this.civicStructures?.dispose();
    this.battleProps?.dispose();
    this.ecoLayer?.dispose();
    this.vegetation?.dispose();
    this.terrainArt?.dispose();
    this.projectileArt?.dispose();
    this.fxSprites?.dispose();
    this.disposables.forEach((d) => d.dispose?.());
    disposeSoldierCache();
    this.renderer.dispose();
  }
}
