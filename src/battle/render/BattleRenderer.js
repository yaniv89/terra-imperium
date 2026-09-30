// src/battle/render/BattleRenderer.js
// The battlefield on screen (Tactical Battles plan §15): a three.js scene with an orthographic,
// isometric camera (the Red Alert 2 look), soft sun shadows and filmic tone mapping, a heightmapped
// terrain mesh with natural colour variation, water, instanced trees/rocks/grass/houses, the keep
// and towers, capture-point flags, and every soldier of every squad as an animated 3D model
// (src/battle/render/soldierFactory.js: they walk, strike and gallop, rigged in the shader). It only ever READS render views from the sim and interpolates
// between the last two (20 Hz sim → smooth 60 fps), plus short-lived effects driven by sim events.
import {
  WebGLRenderer, Scene, OrthographicCamera, Color, HemisphereLight, DirectionalLight, PlaneGeometry,
  MeshLambertMaterial, MeshBasicMaterial, InstancedMesh, Object3D, Vector3, Vector2, Raycaster, Plane,
  ConeGeometry, DodecahedronGeometry, BoxGeometry, CylinderGeometry, RingGeometry,
  Float32BufferAttribute, DoubleSide, Group, Mesh, Fog, DataTexture, RGBAFormat, LinearFilter,
  ACESFilmicToneMapping, PCFSoftShadowMap, InstancedBufferAttribute, MeshStandardMaterial, IcosahedronGeometry, DynamicDrawUsage
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TILE } from '../setup/mapgen';
import { getBattleStats, getSoldierCount } from '../data/battleStats';
import { getSoldierGeometry, getImposterGeometry, disposeSoldierCache, createSoldierMaterial, createSoldierDepthMaterial, RIG_TIME, MODEL_SCALE } from './soldierFactory';
import { writeSoldierVariant } from './unitVariants';
import { ZoomLOD, IMPOSTER_DISTANCE } from './zoomLod';
import { Q } from '../sim/constants';

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
  [TILE.FORD]: '#6f8a7e', [TILE.BUILDING]: '#77766f'
};
const SKY = '#9db4c6';
const SAND_TINT = { desert: '#e3cd95', arctic: '#f5f8fb', island: '#e9d9a4' };
const ISO_DIR = new Vector3(1, 1.25, 1).normalize();
const SCREEN_RIGHT = new Vector3(1, 0, -1).normalize();
const SCREEN_UP_GROUND = new Vector3(-1, 0, -1).normalize();
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

export class BattleRenderer {
  constructor(canvas, setup, { playerSide = 0 } = {}) {
    this.setup = setup;
    this.map = setup.map;
    this.playerSide = playerSide;
    this.renderer = new WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    // Dynamic resolution (plan §15): start at the screen's DPR (max 2); 3 slow frames in a row
    // (> 20 ms) drop it a step (1.25, then 1), and a long run of fast frames earns it back.
    this.baseDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.baseDpr;
    this.slowFrames = 0; this.fastFrames = 0;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene = new Scene();
    this.scene.background = new Color(SKY);
    this.scene.fog = new Fog(SKY, 150, 260);
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

    this.scene.add(new HemisphereLight('#e3eef8', '#5a503f', 1.35));
    // A low warm sun from the side, casting soft shadows that follow the camera around the field.
    const small = Math.min(window.innerWidth || 1024, window.innerHeight || 768) < 700;
    this.sun = new DirectionalLight('#ffe7c2', 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.soldierMaterial = this.track(createSoldierMaterial());
    this.soldierDepth = this.track(createSoldierDepthMaterial());

    this.buildTerrain();
    this.buildProps();
    this.buildStructures();
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
    const geo = this.terrain.geometry.clone();
    geo.translate(0, 0.12, 0);
    this.track(geo);
    const mat = this.track(new MeshBasicMaterial({ color: '#05080d', transparent: true, alphaMap: this.fogTexture, depthWrite: false }));
    this.fogMesh = new Mesh(geo, mat);
    this.fogMesh.renderOrder = 2;
    this.scene.add(this.fogMesh);
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

  heightAt(x, z) {
    const { w, h, height, tiles } = this.map;
    const ix = Math.max(0, Math.min(w - 1, Math.floor(x))); const iz = Math.max(0, Math.min(h - 1, Math.floor(z)));
    const t = tiles[iz * w + ix];
    return t === TILE.WATER ? -0.5 : Math.max(-0.12, (height[iz * w + ix] / 256) * 0.55);
  }

  buildTerrain() {
    const { w, h, tiles } = this.map;
    const geo = this.track(new PlaneGeometry(w, h, w, h));
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2, 0, h / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new Color(GROUND[this.setup.terrain] || GROUND.mixed);
    const alt = new Color(GROUND_ALT[this.setup.terrain] || GROUND_ALT.mixed);
    const tileColor = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      pos.setY(i, this.heightAt(Math.min(w - 0.01, x), Math.min(h - 0.01, z)));
      const ix = Math.max(0, Math.min(w - 1, Math.floor(x))); const iz = Math.max(0, Math.min(h - 1, Math.floor(z)));
      const t = tiles[iz * w + ix];
      // Grass patches (two tones over big and small noise), then the tile's own ground on top.
      const patch = vnoise(x / 9, z / 9) * 0.7 + vnoise(x / 2.5, z / 2.5) * 0.3;
      tmpColor.copy(base).lerp(alt, patch);
      const own = t === TILE.SAND ? (SAND_TINT[this.setup.terrain] || '#d6c28c') : TILE_TINT[t];
      if (own) tmpColor.lerp(tileColor.set(own), t === TILE.FOREST ? 0.55 : 0.85);
      const shade = 0.9 + hash01(i * 7 + 3) * 0.08 + this.heightAt(x, z) * 0.12;
      colors[i * 3] = tmpColor.r * shade; colors[i * 3 + 1] = tmpColor.g * shade; colors[i * 3 + 2] = tmpColor.b * shade;
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = this.track(new MeshLambertMaterial({ vertexColors: true }));
    this.terrain = new Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    // The land goes on beyond the battlefield (no floating island in a void)…
    const apronGeo = this.track(new PlaneGeometry(w + 160, h + 160).rotateX(-Math.PI / 2).translate(w / 2, -0.14, h / 2));
    // Coloured like the field's own average ground, so the edge of the battlefield doesn't show.
    let ar = 0; let ag = 0; let ab = 0;
    for (let i = 0; i < pos.count; i++) { ar += colors[i * 3]; ag += colors[i * 3 + 1]; ab += colors[i * 3 + 2]; }
    const apronColor = new Color(ar / pos.count, ag / pos.count, ab / pos.count).multiplyScalar(0.97);
    const apron = new Mesh(apronGeo, this.track(new MeshLambertMaterial({ color: apronColor })));
    apron.receiveShadow = true;
    this.scene.add(apron);
    // …and water is a real, glossy surface over the riverbeds, lakes and the landing sea.
    if (tiles.some((t) => t === TILE.WATER || t === TILE.FORD)) {
      const water = new Mesh(
        this.track(new PlaneGeometry(w, h).rotateX(-Math.PI / 2).translate(w / 2, -0.2, h / 2)),
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
        else if ((t === TILE.OPEN || t === TILE.SAND) && !winter && r < (dry ? 0.1 : 0.32)) tufts.push([x + r2, z + hash01(r * 1e6), 0.6 + r2 * 0.5]);
        else if (t === TILE.OPEN && r > 0.985) rocks.push([x + r2, z + 0.5, 0.25 + r2 * 0.3]); // the odd boulder in a field
      }
    }
    const place = (list, geo, { color = '#ffffff', shadow = true, scaleFn = (s0) => [s0, s0, s0], tint = 0.25 } = {}) => {
      if (!list.length) return;
      const mesh = new InstancedMesh(this.track(geo), this.track(new MeshLambertMaterial({ color, vertexColors: !!geo.attributes.color })), list.length);
      list.forEach(([x, z, s0], i) => {
        tmp.position.set(x, this.heightAt(x, z), z);
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
        if (s.walls) {
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

  buildOverlays() {
    const MAX = 64;
    const mk = (geo, color, opacity = 1) => {
      const mat = this.track(new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: DoubleSide }));
      const m = new InstancedMesh(this.track(geo), mat, MAX);
      m.count = 0; m.frustumCulled = false; this.scene.add(m);
      return m;
    };
    // A faint team-coloured ring on the ground under each squad, a bright one when selected.
    this.discs = mk(new RingGeometry(0.93, 1.0, 32).rotateX(-Math.PI / 2), '#ffffff', 0.5);
    this.rings = mk(new RingGeometry(1.02, 1.16, 32).rotateX(-Math.PI / 2), '#bef264', 0.95);
    this.barBg = mk(new PlaneGeometry(1, 0.1), '#0f172a', 0.8);
    this.barFill = mk(new PlaneGeometry(1, 0.07).translate(0.5, 0, 0), '#ffffff');
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
    this.markerRings = mk(new RingGeometry(0.6, 0.8, 20).rotateX(-Math.PI / 2), '#a3e635', 0.9);
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
    const MAX = 2 * 16 * 20;
    const buf = (size) => new InstancedBufferAttribute(new Float32Array(MAX * size), size).setUsage(DynamicDrawUsage);
    const matrix = buf(16); const color = buf(3); const anim = buf(3); const variant = buf(4);
    const make = (source, shadow) => {
      const geo = this.track(source.clone());
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
    this.camera.zoom = Math.max(0.45, Math.min(3, this.camera.zoom * factor));
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

  // Screen pixel → ground point (tiles), or null.
  screenToGround(px, py) {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
  }

  // Ground point (tiles) → screen pixel.
  worldToScreen(x, z) {
    const v = new Vector3(x, this.heightAt(x, z), z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  // What's under a screen point: { kind: 'squad', idx } | { kind: 'structure', index } | { kind: 'ground' }.
  pick(px, py, view, radiusTiles = 1.1) {
    const g = this.screenToGround(px, py);
    if (!g) return null;
    let best = null; let bestD = radiusTiles * radiusTiles;
    (view?.squads || []).forEach((s) => {
      if (!s.alive || !s.onField) return;
      const d = (s.x / Q - g.x) ** 2 + (s.y / Q - g.z) ** 2;
      if (d < bestD) { bestD = d; best = { kind: 'squad', idx: s.idx, side: s.side }; }
    });
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
    if (this.fx.length > 200) this.fx.splice(0, this.fx.length - 200);
  }

  adaptResolution(dt) {
    if (dt > 0.02) { this.slowFrames += 1; this.fastFrames = 0; } else if (dt < 0.012) { this.fastFrames += 1; this.slowFrames = 0; } else { this.slowFrames = 0; this.fastFrames = 0; }
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
    // The sun (and its shadow box) follows the camera over the field.
    this.sun.position.set(this.target.x + 22, 38, this.target.z - 10);
    this.sun.target.position.copy(this.target);
    this.sun.target.updateMatrixWorld();
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.8); this.scene.background.set(SKY).lerp(new Color('#ffffff'), this.flash); }
    this.updateCamera();
    if (cur) this.drawSquads(prev, cur, alpha, ui);
    if (cur) this.drawStructures(cur);
    if (cur) this.drawPoints(cur);
    this.drawFx(dt);
    this.renderer.render(this.scene, this.camera);
  }

  drawSquads(prev, cur, alpha, ui) {
    const selected = ui?.selected || new Set();
    this.soldierLayers.forEach((l) => { l.count = 0; });
    let discN = 0; let ringN = 0; let barN = 0;
    const camQuat = this.camera.quaternion;
    if (cur.fog) this.setFog(cur.fog);
    cur.squads.forEach((s) => {
      if (!s.alive || !s.onField || s.inside >= 0) return; // garrisoned squads are inside their building
      if (s.side !== cur.playerSide && s.visible === false) return; // in the fog of war
      const p = prev?.squads?.[s.idx];
      const useP = p && p.onField;
      const x = (useP ? lerp(p.x, s.x, alpha) : s.x) / Q;
      const z = (useP ? lerp(p.y, s.y, alpha) : s.y) / Q;
      const facing = useP ? lerpAngle256(p.facing, s.facing, alpha) : s.facing;
      const moving = useP && (p.x !== s.x || p.y !== s.y);
      const y = this.heightAt(x, z);
      const stats = getBattleStats(s.classId, s.ageId);
      const n = getSoldierCount(stats, s.strength, s.maxStrength);
      const layer = this.soldierLayer(s.ageId, s.classId);
      const { anim } = layer;
      const a = (facing / 256) * Math.PI * 2;
      const fx = Math.cos(a); const fz = Math.sin(a);
      const big = s.classId === 'cavalry' || s.classId === 'siege' || s.classId === 'support' || stats.flying;
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * (big ? 1.2 : 1.8))));
      const spacing = stats.flying ? 1.4 : s.classId === 'siege' ? 1.5 : s.classId === 'cavalry' ? 0.95 : s.classId === 'support' ? 1.05 : 0.52;
      const scale = MODEL_SCALE[s.classId] || 0.62;
      const heading = Math.atan2(fx, fz);
      // Fighting when it has a target and is standing its ground (squads closing in are "moving").
      const fighting = s.target >= 0 && !moving && !s.routed;
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
      this.barFill.setColorAt(barN, tmpColor.setHSL(0.33 * frac, 0.75, 0.5));
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
    this.disposables.forEach((d) => d.dispose?.());
    disposeSoldierCache();
    this.renderer.dispose();
  }
}
