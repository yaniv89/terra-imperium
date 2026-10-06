import { BATTLE_GRAPHICS, frameSummary } from './quality';
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
  ACESFilmicToneMapping, PCFShadowMap, InstancedBufferAttribute, PMREMGenerator, MeshStandardMaterial, IcosahedronGeometry, DynamicDrawUsage
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TILE } from '../setup/mapgen';
import { getBattleStats, getSoldierCount, getUnitBattleStats } from '../data/battleStats';
import { soldierSlots, squadSlots } from './capacity';
import { getSoldierGeometry, getImposterGeometry, packForGPU, disposeSoldierCache, createSoldierMaterial, createSoldierDepthMaterial, RIG_TIME, MODEL_SCALE } from './soldierFactory';
import { writeSoldierVariant } from './unitVariants';
import { ZoomLOD, IMPOSTER_DISTANCE } from './zoomLod';
import { SKIRT, buildTileMask, makeSkirtHeight, hasCoast, horizonLevel, buildSkirtGeometry, patchGroundMaterial, fitShadowBox } from './terrainSurface';
import { Q } from '../sim/constants';
import { zonePerimeter } from './deployZone';
import { CityLayer, CITY_KINDS } from './cityLayer';

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
const tmp = new Object3D();
const tmpColor = new Color();

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
    this.fx = [];
    this.markers = [];
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
    for (let row = 0; row < h; row++) {
      // Texture row 0 is the bottom of the plane (large z); map row 0 is the top (small z).
      const iz = h - 1 - row;
      for (let ix = 0; ix < w; ix++) {
        const v = grid ? grid[iz * w + ix] : 2;
        const a = v === 2 ? 0 : v === 1 ? 110 : 235;
        const o = (row * w + ix) * 4;
        this.fogData[o] = a; this.fogData[o + 1] = a; this.fogData[o + 2] = a; this.fogData[o + 3] = 255;
      }
    }
    this.fogTexture.needsUpdate = true;
  }

  track(obj) { this.disposables.push(obj); return obj; }

  // One tile's own ground level (riverbeds sit low).
  tileHeight(ix, iz) {
    const { w, h, height, tiles } = this.map;
    const cx = Math.max(0, Math.min(w - 1, ix)); const cz = Math.max(0, Math.min(h - 1, iz));
    return tiles[cz * w + cx] === TILE.WATER ? -0.5 : Math.max(-0.12, (height[cz * w + cx] / 256) * 0.55);
  }

  // The ground's height anywhere: bilinear between tile centres, so riverbanks and slopes are smooth
  // (a mesh vertex at a tile corner averages its four tiles) instead of stepping tile by tile.
  heightAt(x, z) {
    const fx = x - 0.5; const fz = z - 0.5;
    const ix = Math.floor(fx); const iz = Math.floor(fz);
    const tx = fx - ix; const tz = fz - iz;
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
      road: TILE_TINT[TILE.ROAD], sand: SAND_TINT[this.setup.terrain] || '#d6c28c', rock: TILE_TINT[TILE.ROCK], forest: TILE_TINT[TILE.FOREST]
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
    const place = (list, geo, { color = '#ffffff', shadow = true, scaleFn = (s0) => [s0, s0, s0], tint = 0.25 } = {}) => {
      if (!list.length) return;
      const mesh = new InstancedMesh(this.track(geo), this.track(new MeshLambertMaterial({ color, vertexColors: !!geo.attributes.color })), list.length);
      list.forEach(([x, z, s0], i) => {
        tmp.position.set(x, ground(x, z), z);
        tmp.rotation.set(0, hash01(i * 13 + 5) * Math.PI * 2, 0);
        const sc = scaleFn(s0, i); tmp.scale.set(sc[0], sc[1], sc[2]);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        tmpColor.setRGB(1, 1, 1).multiplyScalar(1 - tint / 2 + hash01(i * 31) * tint);
        mesh.setColorAt(i, tmpColor);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      this.scene.add(mesh);
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
      painted(new CylinderGeometry(0.07, 0.1, 0.5, 5).translate(0, 0.25, 0), '#5a3d25'),
      painted(new ConeGeometry(0.5, 0.8, 7).translate(0, 0.75, 0), leaf),
      painted(new ConeGeometry(0.4, 0.7, 7).translate(0, 1.15, 0), leaf),
      painted(new ConeGeometry(0.28, 0.6, 7).translate(0, 1.5, 0), winter ? snow : leaf)
    ]);
    const oak = mergeGeometries([
      painted(new CylinderGeometry(0.08, 0.12, 0.8, 6).translate(0, 0.4, 0), '#5f4128'),
      painted(new IcosahedronGeometry(0.55, 0).translate(0, 1.05, 0), dry ? '#7a8a3e' : '#4f8a36'),
      painted(new IcosahedronGeometry(0.4, 0).translate(0.3, 0.85, 0.15), dry ? '#6d7c36' : '#46803a'),
      painted(new IcosahedronGeometry(0.38, 0).translate(-0.25, 0.9, -0.2), dry ? '#83903f' : '#5a9440')
    ]);
    pine.computeVertexNormals(); oak.computeVertexNormals();
    place(pines, pine, { scaleFn: (s0) => [s0, s0 * (1.1 + (s0 % 0.2)), s0] });
    place(oaks, oak, { scaleFn: (s0) => [s0 * 1.1, s0, s0 * 1.1] });
    place(rocks, new DodecahedronGeometry(0.5, 0).translate(0, 0.18, 0), { color: winter ? '#a3a7a8' : '#7d7a70', scaleFn: (s0, i) => [s0, s0 * (0.5 + hash01(i) * 0.4), s0 * (0.8 + hash01(i * 3) * 0.4)] });
    const tuft = mergeGeometries([
      painted(new ConeGeometry(0.035, 0.2, 3).rotateZ(0.25).translate(0.04, 0.09, 0), dry ? '#b3aa6a' : '#7da347'),
      painted(new ConeGeometry(0.035, 0.24, 3).rotateX(-0.2).translate(-0.03, 0.11, 0.02), dry ? '#a19a5c' : '#8cb054'),
      painted(new ConeGeometry(0.03, 0.17, 3).rotateZ(-0.3).translate(-0.05, 0.08, -0.04), dry ? '#c0b67a' : '#6f9a3f')
    ]);
    tuft.computeVertexNormals();
    place(tufts, tuft, { shadow: false, tint: 0.35 });
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
      this.scene.add(g);
      this.structureMeshes.set(s.id, g);
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
  // (instanceColor), so two armies of the same age cost the same draw calls as one. A layer is a
  // ZoomLOD of two InstancedMeshes, the full model (with shadows) and its ~50-triangle imposter
  // (no shadow pass), which SHARE every per-instance buffer: matrix, colour, animation (phase,
  // moving, attacking) and variant (skin tone, emblem cell, cloth jitter). The CPU writes each
  // soldier once per frame and uploads only the used range; the GPU draws whichever level shows.
  soldierLayer(ageId, classId) {
    const key = `${ageId}:${classId}`;
    let layer = this.soldierLayers.get(key);
    if (layer) return layer;
    const MAX = soldierSlots(this.setup, ageId, classId); // every soldier of this age and class (capacity.js)
    const buf = (size) => new InstancedBufferAttribute(new Float32Array(MAX * size), size).setUsage(DynamicDrawUsage);
    const matrix = buf(16); const color = buf(3); const anim = buf(3); const variant = buf(4);
    const make = (source, shadow) => {
      const geo = this.track(packForGPU(source.clone()));
      geo.setAttribute('aAnim', anim);
      geo.setAttribute('aVariant', variant);
      const mesh = new InstancedMesh(geo, this.soldierMaterial, MAX);
      mesh.instanceMatrix = matrix; mesh.instanceColor = color;
      if (shadow) mesh.customDepthMaterial = this.soldierDepth;
      mesh.castShadow = shadow; mesh.receiveShadow = true;
      mesh.count = 0; mesh.frustumCulled = false;
      return mesh;
    };
    const high = make(getSoldierGeometry(ageId, classId), true);
    const low = make(getImposterGeometry(ageId, classId), false);
    const lod = new ZoomLOD(120);
    lod.addLevel(high, 0);
    lod.addLevel(low, IMPOSTER_DISTANCE, 0.06);
    this.scene.add(lod);
    layer = { lod, high, low, matrix, color, anim, variant, count: 0, capacity: MAX };
    this.soldierLayers.set(key, layer);
    return layer;
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    const viewH = aspect < 1 ? 16 : VIEW_TILES;
    // Phones (short side <= 500 css px) may zoom closer: at 3x a soldier is still only about 29 css
    // px tall on a 390 px tall landscape screen, too small to see the unit art.
    this.maxZoom = Math.min(width, height) <= 500 ? PHONE_MAX_ZOOM : 3;
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
    (view?.structures || []).forEach((s, index) => {
      if (!s.alive) return;
      const r = s.radius / Q + 0.6;
      if ((s.x / Q - g.x) ** 2 + (s.y / Q - g.z) ** 2 <= r * r) best = { kind: 'structure', index };
    });
    return best ? { ...best, ground: g } : { kind: 'ground', ground: g };
  }

  addMarker(x, z, color = '#a3e635') { this.markers.push({ x, z, t: 0, color }); }

  // Turn sim events into short effects.
  pushEvents(events, view) {
    events.forEach((e) => {
      if (e.type === 'shot' || e.type === 'towerShot') {
        const from = e.type === 'towerShot' ? view.structures.find((s) => s.id === e.structure) : view.squads[e.from];
        const to = e.to !== undefined ? view.squads[e.to] : view.structures.find((s) => s.id === e.structure);
        if (from && to) this.fx.push({ kind: 'tracer', x0: from.x / Q, z0: from.y / Q, x1: to.x / Q, z1: to.y / Q, t: 0, life: 0.22 });
      } else if (e.type === 'melee' && e.to !== undefined) {
        const to = view.squads[e.to];
        if (to) for (let k = 0; k < 3; k++) this.fx.push({ kind: 'spark', x: to.x / Q + (hash01(e.t * 7 + k) - 0.5), z: to.y / Q + (hash01(e.t * 13 + k) - 0.5), t: 0, life: 0.35, seed: k });
        if (to && e.damage > 0 && isOrganic(to.classId, to.ageId)) this.bleed(to.x / Q, to.y / Q, e.t * 19 + e.from * 7);
      } else if (e.type === 'impact') {
        const r = e.radius / Q;
        const n = Math.min(24, 6 + Math.round(r * 3));
        for (let k = 0; k < n; k++) this.fx.push({ kind: 'spark', x: e.x / Q + (hash01(e.t * 11 + k) - 0.5) * r * 1.6, z: e.y / Q + (hash01(e.t * 17 + k) - 0.5) * r * 1.6, t: 0, life: 0.9, seed: k, big: true, fire: true });
        this.addMarker(e.x / Q, e.y / Q, '#f97316');
        if (r > 6) this.flash = 1; // a nuclear flash
      } else if (e.type === 'ability') {
        const src = view.squads[e.id];
        if (src) this.addMarker(src.x / Q, src.y / Q, '#c084fc');
      } else if (e.type === 'destroyed' || e.type === 'keepBreached' || e.type === 'structureDestroyed') {
        const s = e.id !== undefined ? view.squads[e.id] : view.structures.find((st) => st.id === e.structure);
        if (s) for (let k = 0; k < 8; k++) this.fx.push({ kind: 'spark', x: s.x / Q + (hash01(k * 3 + e.t) - 0.5) * 1.6, z: s.y / Q + (hash01(k * 5 + e.t) - 0.5) * 1.6, t: 0, life: 0.8, seed: k, big: true });
      }
    });
    const budget=BATTLE_GRAPHICS.effects;
    if (this.fx.length > budget) this.fx.splice(0, this.fx.length - budget);
  }

  diagnostics() {
    return {dpr:this.dpr,...frameSummary(this.frameTimes),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures};
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

  render(prev, cur, alpha, ui, dt) {
    this.time += dt;
    RIG_TIME.value = this.time;
    this.adaptResolution(dt);
    this.fitShadows();
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.8); this.scene.background.copy(this.skyColor).lerp(new Color('#ffffff'), this.flash); }
    this.updateCamera();
    if (cur) this.drawSquads(prev, cur, alpha, ui);
    if (cur) this.drawStructures(cur);
    if (cur) this.cityLayer.update(cur);
    if (cur) this.drawPoints(cur);
    this.drawFx(dt);
    this.renderer.render(this.scene, this.camera);
    this.frameTimes.push(dt*1000);
    if(this.frameTimes.length>180)this.frameTimes.shift();
  }

  drawSquads(prev, cur, alpha, ui) {
    const selected = ui?.selected || new Set();
    this.soldierLayers.forEach((l) => { l.count = 0; });
    let discN = 0; let ringN = 0; let barN = 0;
    const camQuat = this.camera.quaternion;
    if (cur.fog) this.setFog(cur.fog);
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
      const facing = useP ? lerpAngle256(p.facing, s.facing, alpha) : s.facing;
      // Squads in contact get nudged apart a little every tick; that's jostling, not marching.
      const step = useP ? Math.hypot(p.x - s.x, p.y - s.y) / Q : 0;
      const moving = step > 0.03 && !s.striking;
      const y = s.classId === 'naval' ? -0.2 : this.heightAt(x, z);
      const stats = s.classId === 'naval' ? getUnitBattleStats({ classId: 'naval', navalLine: s.navalLine }, s.ageId) : getBattleStats(s.classId, s.ageId);
      const n = getSoldierCount(stats, s.strength, s.maxStrength);
      const layer = this.soldierLayer(s.ageId, s.classId);
      const { anim } = layer;
      const a = (facing / 256) * Math.PI * 2;
      const fx = Math.cos(a); const fz = Math.sin(a);
      const big = s.classId === 'cavalry' || s.classId === 'siege' || s.classId === 'support' || s.classId === 'naval' || stats.flying;
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * (big ? 1.2 : 1.8))));
      const spacing = stats.flying ? 1.4 : s.classId === 'naval' ? 2.2 : s.classId === 'siege' ? 1.5 : s.classId === 'cavalry' ? 0.95 : s.classId === 'support' ? 1.05 : 0.52;
      const scale = MODEL_SCALE[s.classId] || 0.62;
      const heading = Math.atan2(fx, fz);
      // Fighting while it's actually swinging or shooting, or standing its ground with a target.
      const fighting = !s.routed && (s.striking || (s.target >= 0 && !moving));
      tmpColor.set(this.setup.sides[s.side].color);
      if (s.routed) tmpColor.lerp(new Color('#9ca3af'), 0.6);
      if (s.hidden) tmpColor.lerp(new Color('#e2e8f0'), 0.45); // in ambush
      if (selected.has(s.idx)) tmpColor.lerp(new Color('#ffffff'), 0.2);
      for (let i = 0; i < n; i++) {
        const col = i % cols; const row = Math.floor(i / cols);
        const jitter = big ? 0.1 : 0.07;
        const lat = (col - (cols - 1) / 2) * spacing + (hash01(s.idx * 97 + i) - 0.5) * jitter * 2;
        const back = row * spacing + (hash01(s.idx * 53 + i) - 0.5) * jitter * 2;
        const px = x + (-fz) * lat - fx * back; const pz = z + fx * lat - fz * back;
        const k = layer.count;
        if (k >= layer.capacity) break;
        tmp.position.set(px, stats.flying ? 2.4 + Math.sin(this.time * 2 + i) * 0.15 : this.heightAt(px, pz), pz);
        // Routed troops turn and run; everyone else faces the squad's heading (a touch of variety).
        tmp.rotation.set(stats.flying ? Math.sin(this.time + i) * 0.15 : 0, heading + (s.routed ? Math.PI : 0) + (hash01(s.idx * 7 + i) - 0.5) * 0.18, 0);
        tmp.scale.set(scale, scale, scale);
        tmp.updateMatrix();
        layer.high.setMatrixAt(k, tmp.matrix); // shared with layer.low
        layer.high.setColorAt(k, tmpColor);
        anim.setXYZ(k, hash01(s.idx * 131 + i) * 6.283, moving || s.routed ? 1 : 0, fighting ? 1 : 0);
        writeSoldierVariant(layer.variant.array, k, s.idx, s.side, i);
        layer.count += 1;
      }
      // Soldiers lost since last frame go down in a spray of blood where they stood.
      const nextMemo = { n, x, z, fx, fz, cols, spacing, big, organic: isOrganic(s.classId, s.ageId), idx: s.idx };
      if (memo && n < memo.n) this.spillBlood({ ...nextMemo, n: memo.n }, n);
      this.soldierMemo.set(s.idx, nextMemo);
      // Ground ring, selection ring, standard-bearer banner, strength bar.
      const r = 0.7 + Math.sqrt(n) * (big ? 0.44 : 0.25);
      tmp.rotation.set(0, 0, 0); tmp.position.set(x, y + 0.05, z); tmp.scale.set(r, 1, r); tmp.updateMatrix();
      this.discs.setMatrixAt(discN, tmp.matrix); this.discs.setColorAt(discN, tmpColor.set(this.setup.sides[s.side].color));
      if (selected.has(s.idx)) { tmp.position.y = y + 0.07; tmp.updateMatrix(); this.rings.setMatrixAt(ringN, tmp.matrix); ringN += 1; }
      if (!stats.flying) {
        const bx = x + fx * 0.25 + (-fz) * (r * 0.55); const bz = z + fz * 0.25 + fx * (r * 0.55);
        tmp.position.set(bx, this.heightAt(bx, bz), bz); tmp.rotation.set(0, heading - Math.PI / 2 + Math.sin(this.time * 3 + s.idx) * 0.25, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
        this.bannerPoles.setMatrixAt(discN, tmp.matrix);
        this.bannerFlags.setMatrixAt(discN, tmp.matrix);
        this.bannerFlags.setColorAt(discN, tmpColor.set(this.setup.sides[s.side].color));
      } else {
        tmp.scale.set(0, 0, 0); tmp.updateMatrix();
        this.bannerPoles.setMatrixAt(discN, tmp.matrix); this.bannerFlags.setMatrixAt(discN, tmp.matrix);
      }
      discN += 1;
      const frac = Math.max(0, s.strength / Math.max(1, s.startStrength));
      tmp.quaternion.copy(camQuat); tmp.position.set(x, y + (stats.flying ? 3.8 : big ? 2.1 : 1.75), z); tmp.scale.set(1.0, 1, 1); tmp.updateMatrix();
      this.barBg.setMatrixAt(barN, tmp.matrix);
      tmp.position.addScaledVector(new Vector3(1, 0, 0).applyQuaternion(camQuat), -0.5); tmp.scale.set(1.0 * frac, 1, 1); tmp.updateMatrix();
      this.barFill.setMatrixAt(barN, tmp.matrix);
      this.barFill.setColorAt(barN, tmpColor.set(frac > 0.3 ? '#22c55e' : '#84cc16'));
      barN += 1;
    });
    this.soldierLayers.forEach((l) => {
      l.high.count = l.count; l.low.count = l.count;
      if (!l.count) return;
      [l.matrix, l.color, l.anim, l.variant].forEach((a) => {
        a.clearUpdateRanges(); a.addUpdateRange(0, l.count * a.itemSize); a.needsUpdate = true;
      });
    });
    [[this.discs, discN], [this.rings, ringN], [this.barBg, barN], [this.barFill, barN], [this.bannerPoles, discN], [this.bannerFlags, discN]].forEach(([m, n]) => {
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
    [this.structBarBg, this.structBarFill].forEach((m) => { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  drawPoints(cur) {
    cur.points.forEach((p) => {
      const g = this.pointMeshes.get(p.id);
      if (!g) return;
      g.userData.mat.color.set(p.owner === 0 || p.owner === 1 ? this.setup.sides[p.owner].color : '#9ca3af');
      g.children[1].rotation.y = Math.sin(this.time * 3) * 0.25;
    });
  }

  drawFx(dt) {
    let tn = 0; let sn = 0; let mn = 0;
    this.fx = this.fx.filter((f) => (f.t += dt) < f.life);
    this.fx.forEach((f) => {
      const k = f.t / f.life;
      if (f.kind === 'tracer' && tn < 64) {
        const dx = f.x1 - f.x0; const dz = f.z1 - f.z0; const len = Math.hypot(dx, dz);
        const hx = f.x0 + dx * k; const hz = f.z0 + dz * k;
        const arc = Math.sin(k * Math.PI) * Math.min(2.5, len * 0.12);
        tmp.position.set(hx, this.heightAt(hx, hz) + 0.8 + arc, hz);
        tmp.rotation.set(0, -Math.atan2(dz, dx), 0); tmp.scale.set(0.6, 1, 1); tmp.updateMatrix();
        this.tracers.setMatrixAt(tn, tmp.matrix); tn += 1;
      } else if (f.kind === 'spark' && sn < 128) {
        const rise = f.big ? k * 1.4 : k * 0.6;
        tmp.position.set(f.x, this.heightAt(f.x, f.z) + 0.4 + rise, f.z);
        tmp.rotation.set(k * 4, k * 5, 0); const sc = (f.big ? 2.2 : 1) * (1 - k); tmp.scale.set(sc, sc, sc); tmp.updateMatrix();
        this.sparks.setMatrixAt(sn, tmp.matrix);
        this.sparks.setColorAt(sn, tmpColor.set(f.fire ? (k < 0.4 ? '#fb923c' : '#57534e') : f.big ? '#a8a29e' : '#fbbf24'));
        sn += 1;
      }
    });
    let bn = 0;
    this.fx.forEach((f) => {
      if (f.kind !== 'blood' || bn >= MAX_BLOOD) return;
      const t = f.t;
      const ground = this.heightAt(f.x, f.z);
      const px = f.x + f.vx * t * 0.6; const pz = f.z + f.vz * t * 0.6;
      const py = Math.max(ground + 0.03, ground + f.y + f.vy * t - 4.9 * t * t);
      tmp.position.set(px, py, pz); tmp.rotation.set(t * 6, t * 4, 0);
      const sc = 1 - (f.t / f.life) * 0.4; tmp.scale.set(sc, sc * 1.4, sc); tmp.updateMatrix();
      this.blood.setMatrixAt(bn, tmp.matrix); this.blood.setColorAt(bn, tmpColor.set(f.color)); bn += 1;
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
      m.setMatrixAt(k, tmp.matrix); m.setColorAt(k, tmpColor.set(sp.color)); splatN[sp.layer] += 1;
    });
    this.splatLayers.forEach((m, i) => { m.count = splatN[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    this.markers = this.markers.filter((m) => (m.t += dt) < 0.8);
    this.markers.forEach((m) => {
      if (mn >= 64) return;
      const k = m.t / 0.8;
      tmp.rotation.set(0, 0, 0); tmp.position.set(m.x, this.heightAt(m.x, m.z) + 0.08, m.z); const sc = 0.6 + k * 1.2; tmp.scale.set(sc, 1, sc); tmp.updateMatrix();
      this.markerRings.setMatrixAt(mn, tmp.matrix); this.markerRings.setColorAt(mn, tmpColor.set(m.color)); mn += 1;
    });
    [[this.tracers, tn], [this.sparks, sn], [this.markerRings, mn]].forEach(([m, n]) => { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  dispose() {
    this.soldierLayers.forEach((l) => { l.high.dispose(); l.low.dispose(); });
    this.cityLayer?.dispose();
    this.disposables.forEach((d) => d.dispose?.());
    disposeSoldierCache();
    this.renderer.dispose();
  }
}
