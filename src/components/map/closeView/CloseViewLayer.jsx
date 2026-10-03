// src/components/map/closeView/CloseViewLayer.jsx
// The close view of the flat map (plan §4f): from CLOSE_ZOOM_K up, towns and armies stand on the
// land as 3D models, drawn by three.js on a transparent canvas over the SVG provinces. Towns are
// sized by the province's buildings (townModels.js); armies are 1 to 3 soldiers of their main unit
// type and age, the very models and walk cycle of the tactical battles (soldierFactory.js),
// walking while they march. Trees stand in forest and jungle hexes and a small work on every
// improved tile (landscape.js); the ground under it all is CloseTerrainLayer. Zoomed out, the banners and icons take over again (Map2DMarkersOverlay).
// The camera is orthographic in screen pixels, so a model sits exactly over its province as the
// map pans; models are tilted toward the viewer for a three-quarter look. Loaded lazily: three.js
// only arrives the first time the player zooms this close.
import React, { useEffect, useMemo, useRef } from 'react';
import {
  WebGLRenderer, Scene, OrthographicCamera, HemisphereLight, DirectionalLight, Mesh, MeshLambertMaterial, InstancedMesh,
  InstancedBufferAttribute, DynamicDrawUsage, Object3D, Color
} from 'three';
import { useGame } from '../../../context/GameContext';
import { REGION_COORDINATES } from '../../../data/regionCoordinates';
import { markerLatLng } from '../../../utils/markerPosition';
import { getEffectiveAgeId } from '../../../data/ages';
import { getMapMarkers } from '../../../utils/mapMarkers';
import { getSoldierGeometry, packForGPU, createSoldierMaterial, RIG_TIME, MODEL_SCALE } from '../../../battle/render/soldierFactory';
import { getNationColor } from '../../../data/nationColors';
import { getTownGeometry, townTier } from './townModels';
import { ARMY_SPOT, unitPx, tiltFor } from './scale';
import { landscapeOnScreen, MAX_TREES, WORK_KINDS, WORK_OFFSET } from './landscape';
import { getTreeGeometry, getWorkGeometry } from './landscapeModels';

const TREE_KINDS = ['conifer', 'broad', 'palm'];
const MAX_WORKS = 400;
const SOLDIER_SIZE = 2.4; // soldiers are drawn larger than true scale so they read at map size
const MAX_SOLDIERS = 240;
const EDGE = 80;
const PLAYER_COLOR = '#2563eb';

const ageOf = (state, nationId) => {
  if (!nationId) return state.age;
  if (nationId === state.playerNationId) return getEffectiveAgeId(state.age, state.techAgeId);
  return getEffectiveAgeId(state.age, state.nations[nationId]?.tech?.ageId);
};
const figuresFor = (men) => (men == null ? 2 : men < 5000 ? 1 : men < 20000 ? 2 : 3);

const CloseViewLayer = ({ projection, transform, width, height, active }) => {
  const { state } = useGame();
  const canvasRef = useRef(null);
  const three = useRef(null);

  // One renderer for the life of the map.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return undefined; // no WebGL: the banners stay, nothing else breaks
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 0, -1, -6000, 6000);
    scene.add(new HemisphereLight('#ffffff', '#475569', 1.25));
    const sun = new DirectionalLight('#fff7e6', 1.35);
    sun.position.set(-0.5, 0.8, 1);
    scene.add(sun);
    const townMaterial = new MeshLambertMaterial({ vertexColors: true });
    const soldierMaterial = createSoldierMaterial();
    // Trees and works: one instanced mesh per kind, filled each layout.
    const instanced = (geometry, max) => {
      const mesh = new InstancedMesh(geometry, townMaterial, max);
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(DynamicDrawUsage);
      mesh.count = 0; mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };
    const trees = new Map(TREE_KINDS.map((kind) => [kind, instanced(getTreeGeometry(kind), MAX_TREES)]));
    const works = new Map(WORK_KINDS.map((kind) => [kind, instanced(getWorkGeometry(kind), MAX_WORKS)]));
    three.current = { renderer, scene, camera, townMaterial, soldierMaterial, towns: new Map(), layers: new Map(), trees, works, dirty: true, moving: false };
    return () => {
      const t = three.current;
      t.trees.forEach((m) => m.dispose()); t.works.forEach((m) => m.dispose());
      t.towns.forEach((m) => scene.remove(m));
      t.layers.forEach((l) => { l.mesh.geometry.dispose(); });
      townMaterial.dispose(); soldierMaterial.dispose();
      renderer.dispose();
      three.current = null;
    };
  }, []);

  const markers = useMemo(() => getMapMarkers(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.units, state.regions, state.nations, state.intel, state.battleReports, state.turnNumber, state.playerNationId]);

  // Lay the scene out whenever the view or the game changes.
  useEffect(() => {
    const t = three.current;
    if (!t || !active || !projection || width <= 0 || height <= 0) return;
    const { renderer, scene, camera } = t;
    renderer.setSize(width, height, false);
    camera.left = 0; camera.right = width; camera.top = 0; camera.bottom = -height;
    camera.updateProjectionMatrix();
    const k = transform.k;
    const s = unitPx(k);
    const TILT = tiltFor(k);
    const toScreenLatLng = (c) => {
      const p = c && projection([c.lng, c.lat]);
      if (!p) return null;
      const x = p[0] * k + transform.x; const y = p[1] * k + transform.y;
      return x < -EDGE || y < -EDGE || x > width + EDGE || y > height + EDGE ? null : { x, y };
    };
    const toScreen = (regionId) => toScreenLatLng(REGION_COORDINATES[regionId]);

    // Towns: every province on screen with an owner or a colony.
    const seen = new Set();
    Object.keys(REGION_COORDINATES).forEach((id) => {
      const region = state.regions[id];
      if (!region || (!region.owner && !region.colony)) return;
      const at = toScreen(id);
      if (!at) return;
      const owner = region.owner || region.colony?.ownerId;
      const tier = region.owner ? townTier(region) : { id: 'small' };
      const opts = { ageId: ageOf(state, owner), walls: (region.buildings?.categories?.defense ?? -1) >= 0, capital: state.nations[owner]?.capitalRegionId === id };
      const key = `${id}|${tier.id}|${opts.ageId}|${opts.walls}|${opts.capital}`;
      seen.add(id);
      let mesh = t.towns.get(id);
      if (!mesh || mesh.userData.key !== key) {
        if (mesh) scene.remove(mesh);
        mesh = new Mesh(getTownGeometry(id, tier.id, opts), t.townMaterial);
        mesh.userData.key = key;
        mesh.frustumCulled = false;
        t.towns.set(id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(at.x, -at.y, at.y * 0.05);
      mesh.rotation.set(TILT, 0, 0);
      mesh.scale.setScalar(s);
      mesh.visible = true;
    });
    t.towns.forEach((mesh, id) => { if (!seen.has(id)) mesh.visible = false; });

    // The land: trees in the woods, a work on each improved tile (landscape.js).
    const lsTmp = new Object3D(); const lsColor = new Color();
    const project = (lat, lon) => {
      const p = projection([lon, lat]);
      return p ? { x: p[0] * k + transform.x, y: p[1] * k + transform.y } : null;
    };
    const cityTiles = new Set(Object.values(state.regions).map((r) => r.tile).filter((x) => x != null));
    const land = landscapeOnScreen({ toScreen: project, width, height, k, world: state.world, cityTiles });
    t.trees.forEach((m) => { m.count = 0; });
    t.works.forEach((m) => { m.count = 0; });
    const put = (mesh, x, y, scale, turn, shade) => {
      const i = mesh.count;
      lsTmp.position.set(x, -y, y * 0.05);
      lsTmp.rotation.set(TILT, turn, 0, 'XYZ');
      lsTmp.scale.setScalar(scale);
      lsTmp.updateMatrix();
      mesh.setMatrixAt(i, lsTmp.matrix);
      mesh.setColorAt(i, lsColor.setScalar(shade));
      mesh.count += 1;
    };
    land.trees.forEach((tr) => {
      const mesh = t.trees.get(tr.kind);
      if (mesh && mesh.count < MAX_TREES) put(mesh, tr.x, tr.y, s * tr.size, tr.turn, 0.85 + (tr.turn % 0.3));
    });
    land.works.forEach((w) => {
      const mesh = t.works.get(w.kind);
      if (mesh && mesh.count < MAX_WORKS) put(mesh, w.x + s * WORK_OFFSET.x, w.y + s * WORK_OFFSET.y, s * 1.2, w.turn * 0.15, w.pillaged ? 0.45 : 1);
    });
    [...t.trees.values(), ...t.works.values()].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });

    // Armies: soldiers of the main unit type, beside the town, in the owner's colour.
    t.layers.forEach((l) => { l.mesh.count = 0; });
    const layerFor = (ageId, classId) => {
      const key = `${ageId}:${classId}`;
      let l = t.layers.get(key);
      if (!l) {
        const geo = packForGPU(getSoldierGeometry(ageId, classId).clone());
        const anim = new InstancedBufferAttribute(new Float32Array(MAX_SOLDIERS * 3), 3).setUsage(DynamicDrawUsage);
        const variant = new InstancedBufferAttribute(new Float32Array(MAX_SOLDIERS * 4), 4).setUsage(DynamicDrawUsage);
        geo.setAttribute('aAnim', anim); geo.setAttribute('aVariant', variant);
        const mesh = new InstancedMesh(geo, t.soldierMaterial, MAX_SOLDIERS);
        mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_SOLDIERS * 3), 3).setUsage(DynamicDrawUsage);
        mesh.count = 0; mesh.frustumCulled = false;
        scene.add(mesh);
        l = { mesh, anim, variant };
        t.layers.set(key, l);
      }
      return l;
    };
    const tmp = new Object3D(); const color = new Color();
    let moving = false;
    markers.armies.forEach((m, mi) => {
      const at = toScreenLatLng(markerLatLng(m));
      if (!at) return;
      const classId = m.own && m.mainClass && m.mainClass !== 'mixed' ? m.mainClass : 'infantry';
      const ageId = ageOf(state, m.ownerId);
      const l = layerFor(ageId, classId);
      // Marching: face the next step and walk.
      const lead = m.own ? state.units[m.units?.[0]] : null;
      const next = lead?.route?.[0] ? toScreen(lead.route[0]) : null;
      const walking = !!next;
      if (walking) moving = true;
      const heading = next ? Math.atan2(next.x - at.x, next.y - at.y) : 0.5;
      const n = figuresFor(m.men);
      const scale = s * SOLDIER_SIZE * (MODEL_SCALE[classId] || 0.88);
      color.set(m.own ? PLAYER_COLOR : getNationColor(m.ownerId) || '#64748b');
      for (let i = 0; i < n && l.mesh.count < MAX_SOLDIERS; i++) {
        const k2 = l.mesh.count;
        const ox = (i - (n - 1) / 2) * s * 1.1 + s * ARMY_SPOT.x; const oy = s * ARMY_SPOT.y + (i % 2) * s * 0.4;
        tmp.position.set(at.x + ox, -(at.y + oy), (at.y + oy) * 0.05 + 40);
        tmp.rotation.set(TILT, heading, 0, 'XYZ');
        tmp.scale.setScalar(scale);
        tmp.updateMatrix();
        l.mesh.setMatrixAt(k2, tmp.matrix);
        l.mesh.setColorAt(k2, color);
        l.anim.setXYZ(k2, (mi * 1.7 + i) % 6.28, walking ? 1 : 0, 0);
        l.variant.setXYZW(k2, (mi + i) % 4, (mi * 3 + i) % 16, ((mi + i) % 5) / 5 - 0.4, 0);
        l.mesh.count += 1;
      }
    });
    t.layers.forEach((l) => { l.mesh.instanceMatrix.needsUpdate = true; l.mesh.instanceColor.needsUpdate = true; l.anim.needsUpdate = true; l.variant.needsUpdate = true; });
    t.moving = moving;
    t.dirty = true;
  }, [active, projection, transform, width, height, state, markers]);

  // Draw: every frame while soldiers walk, otherwise only after a change.
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const loop = (now) => {
      const t = three.current;
      if (t && (t.dirty || t.moving)) {
        RIG_TIME.value = now / 1000;
        t.renderer.render(t.scene, t.camera);
        t.dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="close-view"
      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
      style={{ width, height, opacity: active ? 1 : 0 }}
    />
  );
};

export default CloseViewLayer;
