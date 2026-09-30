// src/battle/render/BattleRenderer.js
// The battlefield on screen (Tactical Battles plan §15): a three.js scene with an orthographic,
// isometric camera (the Red Alert 2 look), a heightmapped terrain mesh coloured per tile, instanced
// trees/rocks/buildings, the keep and towers, capture-point flags, and every soldier of every squad
// as an instanced extruded token. It only ever READS render views from the sim and interpolates
// between the last two (20 Hz sim → smooth 60 fps), plus short-lived effects driven by sim events.
import {
  WebGLRenderer, Scene, OrthographicCamera, Color, HemisphereLight, DirectionalLight, PlaneGeometry,
  MeshLambertMaterial, MeshBasicMaterial, InstancedMesh, Object3D, Vector3, Vector2, Raycaster, Plane,
  ConeGeometry, DodecahedronGeometry, BoxGeometry, CylinderGeometry, RingGeometry, CircleGeometry,
  Float32BufferAttribute, DoubleSide, Group, Mesh, Fog
} from 'three';
import { TILE } from '../setup/mapgen';
import { getBattleStats, getSoldierCount } from '../data/battleStats';
import { getUnitTokenGeometry, disposeTokenCache } from './tokenFactory';
import { Q } from '../sim/constants';

const GROUND = {
  plains: '#6f9a41', mixed: '#628f3c', hills: '#7c8d47', forest: '#4d7a33', mountains: '#7f7f70',
  desert: '#d6bd86', arctic: '#e6edf1', urban: '#8b908a', island: '#79ab4a'
};
const TILE_TINT = {
  [TILE.FOREST]: '#3b6528', [TILE.WATER]: '#2f6f9f', [TILE.ROCK]: '#6e6d66', [TILE.ROAD]: '#a88f63',
  [TILE.FORD]: '#5f93b3', [TILE.BUILDING]: '#6b6f73'
};
const SAND_TINT = { desert: '#e3cd95', arctic: '#f5f8fb', island: '#e9d9a4' };
const ISO_DIR = new Vector3(1, 1.25, 1).normalize();
const SCREEN_RIGHT = new Vector3(1, 0, -1).normalize();
const SCREEN_UP_GROUND = new Vector3(-1, 0, -1).normalize();
const VIEW_TILES = 30;       // landscape; portrait phones get a closer camera (see resize)
const tmp = new Object3D();
const tmpColor = new Color();

const hash01 = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle256 = (a, b, t) => { const d = ((b - a + 384) % 256) - 128; return a + d * t; };

export class BattleRenderer {
  constructor(canvas, setup, { playerSide = 0 } = {}) {
    this.setup = setup;
    this.map = setup.map;
    this.playerSide = playerSide;
    this.renderer = new WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new Scene();
    this.scene.background = new Color('#0f1a24');
    this.scene.fog = new Fog('#0f1a24', 90, 170);
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.camera.zoom = 1;
    this.target = new Vector3(playerSide === 0 ? 16 : this.map.w - 24, 0, this.map.h / 2);
    this.raycaster = new Raycaster();
    this.groundPlane = new Plane(new Vector3(0, 1, 0), 0);
    this.disposables = [];
    this.soldierLayers = new Map();
    this.fx = [];
    this.markers = [];
    this.time = 0;

    this.scene.add(new HemisphereLight('#ffffff', '#6b705c', 1.7));
    // Lit from the camera's side, so the faces the player sees aren't in shadow.
    const sun = new DirectionalLight('#fff4dc', 1.3);
    sun.position.set(30, 80, 50);
    this.scene.add(sun);

    this.buildTerrain();
    this.buildProps();
    this.buildStructures();
    this.buildPoints();
    this.buildOverlays();
  }

  track(obj) { this.disposables.push(obj); return obj; }

  heightAt(x, z) {
    const { w, h, height, tiles } = this.map;
    const ix = Math.max(0, Math.min(w - 1, Math.floor(x))); const iz = Math.max(0, Math.min(h - 1, Math.floor(z)));
    const t = tiles[iz * w + ix];
    return t === TILE.WATER ? -0.25 : (height[iz * w + ix] / 256) * 0.55;
  }

  buildTerrain() {
    const { w, h, tiles } = this.map;
    const geo = this.track(new PlaneGeometry(w, h, w, h));
    geo.rotateX(-Math.PI / 2);
    geo.translate(w / 2, 0, h / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new Color(GROUND[this.setup.terrain] || GROUND.mixed);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      pos.setY(i, this.heightAt(Math.min(w - 0.01, x), Math.min(h - 0.01, z)));
      const ix = Math.max(0, Math.min(w - 1, Math.floor(x))); const iz = Math.max(0, Math.min(h - 1, Math.floor(z)));
      const t = tiles[iz * w + ix];
      tmpColor.set(t === TILE.SAND ? (SAND_TINT[this.setup.terrain] || '#d9c690') : (TILE_TINT[t] || base));
      const shade = 0.93 + hash01(i * 7 + 3) * 0.12 + this.heightAt(x, z) * 0.05;
      colors[i * 3] = tmpColor.r * shade; colors[i * 3 + 1] = tmpColor.g * shade; colors[i * 3 + 2] = tmpColor.b * shade;
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = this.track(new MeshLambertMaterial({ vertexColors: true }));
    this.terrain = new Mesh(geo, mat);
    this.scene.add(this.terrain);
  }

  buildProps() {
    const { w, h, tiles } = this.map;
    const keep = this.map.keep;
    const trees = []; const rocks = []; const houses = [];
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const t = tiles[z * w + x];
        const r = hash01(z * w + x);
        if (t === TILE.FOREST && r < 0.85) trees.push([x + 0.2 + r * 0.6, z + 0.2 + hash01(r * 1e6) * 0.6, 0.8 + r * 0.6]);
        else if (t === TILE.ROCK && r < 0.7) rocks.push([x + 0.5, z + 0.5, 0.7 + r * 0.8]);
        else if (t === TILE.BUILDING && Math.abs(x - keep.x) + Math.abs(z - keep.y) > 3) houses.push([x + 0.5, z + 0.5, 0.8 + r * 1.8]);
      }
    }
    const place = (list, geo, color, scaleFn) => {
      if (!list.length) return;
      const mesh = new InstancedMesh(this.track(geo), this.track(new MeshLambertMaterial({ color })), list.length);
      list.forEach(([x, z, s], i) => {
        tmp.position.set(x, this.heightAt(x, z), z);
        tmp.rotation.set(0, hash01(i * 13) * Math.PI * 2, 0);
        const sc = scaleFn(s); tmp.scale.set(sc[0], sc[1], sc[2]);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        tmpColor.set(color).multiplyScalar(0.85 + hash01(i * 31) * 0.3);
        mesh.setColorAt(i, tmpColor);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    };
    const winter = this.setup.terrain === 'arctic';
    place(trees, new ConeGeometry(0.42, 1.4, 6).translate(0, 0.7, 0), winter ? '#6b8a78' : '#3f7d35', (s) => [s, s, s]);
    place(rocks, new DodecahedronGeometry(0.5, 0).translate(0, 0.25, 0), '#77766c', (s) => [s, s * 0.8, s]);
    place(houses, new BoxGeometry(0.95, 1, 0.95).translate(0, 0.5, 0), '#9a8f82', (s) => [1, s, 1]);
  }

  buildStructures() {
    this.structureMeshes = new Map();
    this.setup.structures.forEach((s) => {
      // Per-structure materials, so a destroyed tower can turn to rubble on its own.
      const stone = this.track(new MeshLambertMaterial({ color: '#8d8a80' }));
      const roof = this.track(new MeshLambertMaterial({ color: this.setup.sides[1].color }));
      const g = new Group();
      const x = s.x / Q; const z = s.y / Q;
      if (s.kind === 'keep') {
        g.add(new Mesh(this.track(new BoxGeometry(2.6, 1.8, 2.6).translate(0, 0.9, 0)), stone));
        g.add(new Mesh(this.track(new BoxGeometry(2.9, 0.35, 2.9).translate(0, 1.95, 0)), stone));
        [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([dx, dz]) => {
          g.add(new Mesh(this.track(new CylinderGeometry(0.45, 0.5, 2.6, 8).translate(dx, 1.3, dz)), stone));
          g.add(new Mesh(this.track(new ConeGeometry(0.55, 0.8, 8).translate(dx, 3, dz)), roof));
        });
        if (s.walls) g.add(new Mesh(this.track(new RingGeometry(3.4, 3.9, 24).rotateX(-Math.PI / 2).translate(0, 0.35, 0)), stone));
      } else {
        g.add(new Mesh(this.track(new CylinderGeometry(0.5, 0.62, 2.2, 8).translate(0, 1.1, 0)), stone));
        g.add(new Mesh(this.track(new ConeGeometry(0.62, 0.8, 8).translate(0, 2.6, 0)), roof));
      }
      g.position.set(x, this.heightAt(x, z), z);
      this.scene.add(g);
      this.structureMeshes.set(s.id, g);
    });
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
    this.discs = mk(new CircleGeometry(1, 20).rotateX(-Math.PI / 2), '#ffffff', 0.35);
    this.rings = mk(new RingGeometry(1.05, 1.28, 24).rotateX(-Math.PI / 2), '#a3e635', 0.95);
    this.barBg = mk(new PlaneGeometry(1, 0.14), '#0f172a', 0.85);
    this.barFill = mk(new PlaneGeometry(1, 0.1).translate(0.5, 0, 0), '#ffffff');
    this.structBarBg = mk(new PlaneGeometry(1, 0.18), '#0f172a', 0.85);
    this.structBarFill = mk(new PlaneGeometry(1, 0.13).translate(0.5, 0, 0), '#ffffff');
    this.tracers = mk(new BoxGeometry(1, 0.05, 0.05).translate(0.5, 0, 0), '#fde68a');
    this.sparks = mk(new DodecahedronGeometry(0.12, 0), '#fbbf24');
    this.markerRings = mk(new RingGeometry(0.6, 0.8, 20).rotateX(-Math.PI / 2), '#a3e635', 0.9);
  }

  soldierLayer(ageId, classId, side) {
    const key = `${ageId}:${classId}:${side}`;
    let layer = this.soldierLayers.get(key);
    if (!layer) {
      const mat = this.track(new MeshLambertMaterial({ color: '#ffffff', side: DoubleSide }));
      layer = new InstancedMesh(getUnitTokenGeometry(ageId, classId), mat, 16 * 20);
      layer.count = 0; layer.frustumCulled = false;
      this.scene.add(layer);
      this.soldierLayers.set(key, layer);
    }
    return layer;
  }

  resize(width, height) {
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    const viewH = aspect < 1 ? 20 : VIEW_TILES;
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
      } else if (e.type === 'destroyed' || e.type === 'keepBreached' || e.type === 'structureDestroyed') {
        const s = e.id !== undefined ? view.squads[e.id] : view.structures.find((st) => st.id === e.structure);
        if (s) for (let k = 0; k < 8; k++) this.fx.push({ kind: 'spark', x: s.x / Q + (hash01(k * 3 + e.t) - 0.5) * 1.6, z: s.y / Q + (hash01(k * 5 + e.t) - 0.5) * 1.6, t: 0, life: 0.8, seed: k, big: true });
      }
    });
    if (this.fx.length > 200) this.fx.splice(0, this.fx.length - 200);
  }

  render(prev, cur, alpha, ui, dt) {
    this.time += dt;
    this.updateCamera();
    if (cur) this.drawSquads(prev, cur, alpha, ui);
    if (cur) this.drawStructures(cur);
    if (cur) this.drawPoints(cur);
    this.drawFx(dt);
    this.renderer.render(this.scene, this.camera);
  }

  drawSquads(prev, cur, alpha, ui) {
    const selected = ui?.selected || new Set();
    const counts = new Map();
    this.soldierLayers.forEach((l) => { l.count = 0; });
    let discN = 0; let ringN = 0; let barN = 0;
    const camQuat = this.camera.quaternion;
    cur.squads.forEach((s) => {
      if (!s.alive || !s.onField) return;
      const p = prev?.squads?.[s.idx];
      const useP = p && p.onField;
      const x = (useP ? lerp(p.x, s.x, alpha) : s.x) / Q;
      const z = (useP ? lerp(p.y, s.y, alpha) : s.y) / Q;
      const facing = useP ? lerpAngle256(p.facing, s.facing, alpha) : s.facing;
      const moving = useP && (p.x !== s.x || p.y !== s.y);
      const y = this.heightAt(x, z);
      const stats = getBattleStats(s.classId, s.ageId);
      const n = getSoldierCount(stats, s.strength, s.maxStrength);
      const layer = this.soldierLayer(s.ageId, s.classId, s.side);
      const a = (facing / 256) * Math.PI * 2;
      const fx = Math.cos(a); const fz = Math.sin(a);
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
      const spacing = stats.flying ? 0.6 : 0.42;
      const mirror = fx - fz < 0 ? -1 : 1;
      const scale = stats.flying ? 0.85 : s.classId === 'siege' ? 0.9 : 0.7;
      tmpColor.set(this.setup.sides[s.side].color);
      if (s.routed) tmpColor.lerp(new Color('#9ca3af'), 0.6);
      if (selected.has(s.idx)) tmpColor.lerp(new Color('#ffffff'), 0.25);
      for (let i = 0; i < n; i++) {
        const col = i % cols; const row = Math.floor(i / cols);
        const lat = (col - (cols - 1) / 2) * spacing + (hash01(s.idx * 97 + i) - 0.5) * 0.08;
        const back = row * spacing + (hash01(s.idx * 53 + i) - 0.5) * 0.08;
        const px = x + (-fz) * lat - fx * back; const pz = z + fx * lat - fz * back;
        const bob = moving ? Math.abs(Math.sin(this.time * 11 + i * 1.7)) * 0.06 : 0;
        const k = layer.count;
        if (k >= layer.instanceMatrix.count) break;
        tmp.position.set(px, (stats.flying ? 2.2 + Math.sin(this.time * 2 + i) * 0.15 : this.heightAt(px, pz)) + bob, pz);
        tmp.rotation.set(0, Math.PI / 4, 0);
        tmp.scale.set(scale * mirror, scale, scale);
        tmp.updateMatrix();
        layer.setMatrixAt(k, tmp.matrix);
        layer.setColorAt(k, tmpColor);
        layer.count += 1;
      }
      counts.set(layer, true);
      // Team disc, selection ring, strength bar.
      const r = 0.55 + Math.sqrt(n) * 0.16;
      tmp.rotation.set(0, 0, 0); tmp.position.set(x, y + 0.04, z); tmp.scale.set(r, 1, r); tmp.updateMatrix();
      this.discs.setMatrixAt(discN, tmp.matrix); this.discs.setColorAt(discN, tmpColor.set(this.setup.sides[s.side].color)); discN += 1;
      if (selected.has(s.idx)) { tmp.position.y = y + 0.06; tmp.updateMatrix(); this.rings.setMatrixAt(ringN, tmp.matrix); ringN += 1; }
      const frac = Math.max(0, s.strength / Math.max(1, s.startStrength));
      tmp.quaternion.copy(camQuat); tmp.position.set(x, y + (stats.flying ? 3.2 : 1.35), z); tmp.scale.set(1.2, 1, 1); tmp.updateMatrix();
      this.barBg.setMatrixAt(barN, tmp.matrix);
      tmp.position.addScaledVector(new Vector3(1, 0, 0).applyQuaternion(camQuat), -0.6); tmp.scale.set(1.2 * frac, 1, 1); tmp.updateMatrix();
      this.barFill.setMatrixAt(barN, tmp.matrix);
      this.barFill.setColorAt(barN, tmpColor.setHSL(0.33 * frac, 0.75, 0.5));
      barN += 1;
    });
    this.soldierLayers.forEach((l) => { l.instanceMatrix.needsUpdate = true; if (l.instanceColor) l.instanceColor.needsUpdate = true; });
    [[this.discs, discN], [this.rings, ringN], [this.barBg, barN], [this.barFill, barN]].forEach(([m, n]) => {
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
      tmp.quaternion.copy(camQuat); tmp.position.set(x, this.heightAt(x, z) + (s.kind === 'keep' ? 4 : 3.3), z); tmp.scale.set(s.kind === 'keep' ? 2.4 : 1.4, 1, 1); tmp.updateMatrix();
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
      } else if (f.kind === 'spark' && sn < 64) {
        const rise = f.big ? k * 1.4 : k * 0.6;
        tmp.position.set(f.x, this.heightAt(f.x, f.z) + 0.4 + rise, f.z);
        tmp.rotation.set(k * 4, k * 5, 0); const sc = (f.big ? 2.2 : 1) * (1 - k); tmp.scale.set(sc, sc, sc); tmp.updateMatrix();
        this.sparks.setMatrixAt(sn, tmp.matrix);
        this.sparks.setColorAt(sn, tmpColor.set(f.big ? '#a8a29e' : '#fbbf24'));
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
    this.soldierLayers.forEach((l) => l.dispose());
    this.disposables.forEach((d) => d.dispose?.());
    disposeTokenCache();
    this.renderer.dispose();
  }
}
