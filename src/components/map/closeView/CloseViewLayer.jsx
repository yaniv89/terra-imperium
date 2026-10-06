// src/components/map/closeView/CloseViewLayer.jsx
// The close view of the flat map (plan §4f): from CLOSE_ZOOM_K up, towns and armies stand on the
// land as 3D models, drawn by three.js on a transparent canvas over the SVG provinces. Towns are
// sized by the province's buildings (townModels.js); armies are 1 to 3 soldiers of their main unit
// type and age, the very models and walk cycle of the tactical battles (soldierFactory.js),
// walking while they march. Trees stand in forest and jungle hexes and a small work on every
// improved tile (landscape.js); a city's buildings stand round its town as landmark models
// (buildingModels.js, drawn instanced by buildingLayer.js); a built wonder stands on its own tile
// as its tier's model (wonderAssets.js); an improved tile shows its improvement's artist model
// for the owner's age and the land's style when a file exists (improvementModels.js, drawn
// instanced like the landmarks), else its procedural work; the ground under it all is CloseTerrainLayer. Zoomed out, the banners and icons take over again (Map2DMarkersOverlay).
// The camera is orthographic in screen pixels, so a model sits exactly over its province as the
// map pans; models are tilted toward the viewer for a three-quarter look. Loaded lazily: three.js
// only arrives the first time the player zooms this close.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  WebGLRenderer, Scene, OrthographicCamera, HemisphereLight, DirectionalLight, Mesh, MeshLambertMaterial, InstancedMesh,
  InstancedBufferAttribute, DynamicDrawUsage, Object3D, Color, Matrix4, Box3
} from 'three';
import { useGame } from '../../../context/GameContext';
import { REGION_COORDINATES } from '../../../data/regionCoordinates';
import { markerLatLng } from '../../../utils/markerPosition';
import { getEffectiveAgeId } from '../../../data/ages';
import { getMapMarkers } from '../../../utils/mapMarkers';
import { getSoldierGeometry, packForGPU, createSoldierMaterial, RIG_TIME, MODEL_SCALE } from '../../../battle/render/soldierFactory';
import { getNationColor } from '../../../data/nationColors';
import { getTownGeometry, townTier } from './townModels';
import { townAssetUrl, loadTownAsset, loadAssetObjects, sharedAssetUrls, palaceFor, wallsFor, COLONY_CAMP, isCamp, fieldsAround, fieldCount, FIELDS_FOR_WORK, instanceTownAsset, showLod, lodForZoom } from './townAssets';
import { ARMY_SPOT, unitPx, tiltFor, lightRig, townUnitPx, townRoomUnits, townGapUnits, TIER_SCALE } from './scale';
import { landscapeOnScreen, MAX_TREES, WORK_KINDS, WORK_OFFSET } from './landscape';
import { getTiles } from '../../../data/geo/tiles';
import { styleOfLand } from '../../../data/architecture';
import { loadGroundData, isLandAt, sampleLandColour, groundTint, tintKey } from './groundBlend';
import { createOccupancy } from './occupancy';
import { worldRasterUrl } from '../../../data/geo/worldRaster';
import { getTreeGeometry, getWorkGeometry } from './landscapeModels';
import { pickBuildingModels, buildingSpots, assignSpots, buildingRoot, needsCoast, BUILDING_DISC } from './buildingModels';
import { createBuildingLayer } from './buildingLayer';
import { wonderAssetUrl, wonderTierObject, wonderPlacements, WONDER_RADIUS } from './wonderAssets';
import { improvementModel, improvementRoot, modelAllowedOnTile, boatsSpot, coastShare, shoreAnchor, yawToward, fitImprovement, IMPROVEMENT_SCALE, SHORE_BACK } from './improvementModels';

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
// The ground a field takes, model units (a field is about 1.6 by 1.2: the disc round its middle).
const FIELD_DISC = 0.8;
const figuresFor = (men) => (men == null ? 2 : men < 5000 ? 1 : men < 20000 ? 2 : 3);

const CloseViewLayer = ({ projection, transform, width, height, active, land = null }) => {
  const { state } = useGame();
  const canvasRef = useRef(null);
  const three = useRef(null);
  const [assetsTick, setAssetsTick] = useState(0); // bumps when an artist town file finishes loading
  // The land mask and the world picture's colours (groundBlend.js), once the coastline is in.
  const ground = useRef(null);
  useEffect(() => {
    if (!active || !land || ground.current) return;
    loadGroundData(land, worldRasterUrl(2048)).then((d) => { ground.current = d; setAssetsTick((n) => n + 1); });
  }, [active, land]);

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
    const sky = new HemisphereLight('#ffffff', '#475569', 1.25);
    const sun = new DirectionalLight('#fff7e6', 1.35);
    scene.add(sky, sun); // aimed each layout by lightRig (scale.js), with the models' tilt
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
    const buildings = createBuildingLayer(scene);
    const improvements = createBuildingLayer(scene);
    three.current = { renderer, scene, camera, sky, sun, townMaterial, soldierMaterial, towns: new Map(), wonders: new Map(), fieldWorks: new Map(), layers: new Map(), assets: new Map(), trees, works, buildings, improvements, dirty: true, moving: false };
    if (import.meta.env.DEV) window.__closeView = three.current; // for browser checks
    return () => {
      const t = three.current;
      t.trees.forEach((m) => m.dispose()); t.works.forEach((m) => m.dispose());
      t.towns.forEach((m) => scene.remove(m)); t.wonders.forEach((m) => scene.remove(m)); t.fieldWorks.forEach((g) => scene.remove(g));
      t.layers.forEach((l) => { l.mesh.geometry.dispose(); });
      t.buildings.dispose();
      t.improvements.dispose();
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
    const rig = lightRig(TILT);
    t.sky.position.set(...rig.sky);
    t.sun.position.set(...rig.sun);
    // Where a screen point lies on the Earth, and whether that is land (fields, works and trees are
    // never drawn in the sea); the tint that sets a model's ground into the land around it.
    const latLonAt = (x, y) => projection.invert([(x - transform.x) / k, (y - transform.y) / k]);
    const landAt = (x, y) => { const ll = latLonAt(x, y); return !ll || isLandAt(ground.current?.mask, ll[1], ll[0]); };
    const tintAt = (lat, lon) => groundTint(sampleLandColour(ground.current?.raster, ground.current?.mask, lat, lon, 3));
    const toScreenLatLng = (c) => {
      const p = c && projection([c.lng, c.lat]);
      if (!p) return null;
      const x = p[0] * k + transform.x; const y = p[1] * k + transform.y;
      return x < -EDGE || y < -EDGE || x > width + EDGE || y > height + EDGE ? null : { x, y };
    };
    const toScreen = (regionId) => toScreenLatLng(REGION_COORDINATES[regionId]);

    // The age's shared files (palaces, walls, the camp, fields): each loaded once, the objects by
    // name; a region's file (its own palaces and walls) over the age's base file.
    const loadShared = (url) => {
      if (!t.assets.has(url)) {
        t.assets.set(url, null);
        loadAssetObjects(url).then((objs) => { t.assets.set(url, objs); setAssetsTick((n) => n + 1); })
          .catch((e) => { console.warn('shared model file failed, towns stand without palaces, walls, camps and fields:', e.message); });
      }
      return t.assets.get(url) || null;
    };
    const sharedFor = (ageId, style = null) => {
      const urls = sharedAssetUrls(ageId, style);
      if (!urls.length) return null;
      const parts = urls.map(loadShared);
      if (!parts[parts.length - 1]) return null; // the base file is not in yet
      return parts.length === 1 ? parts[0] : Object.assign({}, ...parts.filter(Boolean).reverse());
    };

    // Ground claimed this frame: towns, then works, then the fields round towns; nothing overlaps.
    const lean = Math.sin(TILT);
    const occ = createOccupancy(lean);
    const ringFields = []; // [{ mesh, at, s }] placed once the works have claimed their ground
    const townBuildings = []; // [{ mesh, at, s, picks, teamColor, tint }] placed once every town has claimed its ground
    // A landmark file: loaded once, its root object handed to the instanced layer.
    const buildingReady = ({ id, url }) => {
      if (t.buildings.hasModel(url)) return true;
      if (!t.assets.has(url)) {
        t.assets.set(url, null);
        loadAssetObjects(url).then((objs) => { t.buildings.setModel(url, buildingRoot(objs, id, url)); setAssetsTick((n) => n + 1); })
          .catch((e) => { console.warn('building model failed, the town stands without it:', e.message); });
      }
      return false;
    };

    // Towns: every province on screen with an owner or a colony.
    const seen = new Set();
    // town tiles, so no town grows into its neighbour (townGapUnits)
    const townTiles = new Set(Object.values(state.regions).filter((r) => (r.owner || r.colony) && r.tile != null).map((r) => r.tile));
    // a wonder with a model counts too: a town and the wonder beside it never grow into each other
    const wonders = wonderPlacements(state, getTiles()).filter((w) => wonderAssetUrl(w.projectId));
    wonders.forEach((w) => townTiles.add(w.tile));
    const isTown = (t) => townTiles.has(t);
    Object.keys(REGION_COORDINATES).forEach((id) => {
      const region = state.regions[id];
      if (!region || (!region.owner && !region.colony)) return;
      const at = toScreen(id);
      if (!at) return;
      const owner = region.owner || region.colony?.ownerId;
      const tier = region.owner ? townTier(region) : { id: 'small' };
      const opts = { ageId: ageOf(state, owner), walls: (region.buildings?.categories?.defense ?? -1) >= 0, capital: state.nations[owner]?.capitalRegionId === id };
      // An artist model for this age and size replaces the procedural town once its file is in;
      // an outpost shows the age's colony camp instead.
      const camp = isCamp(region);
      const seed = [...id].reduce((h, c) => h + c.charCodeAt(0), 0);
      // the land's architecture style (the tile's country), whoever owns the city (art spec 3b)
      const landNation = region.tile != null ? getTiles().countryOf(region.tile) : null;
      const style = styleOfLand(landNation || owner, opts.ageId);
      const assetUrl = camp ? null : townAssetUrl(opts.ageId, tier.id, seed, style);
      const asset = assetUrl ? t.assets.get(assetUrl) : null;
      if (assetUrl && !t.assets.has(assetUrl)) {
        t.assets.set(assetUrl, null);
        loadTownAsset(assetUrl).then((root) => { t.assets.set(assetUrl, root); setAssetsTick((n) => n + 1); })
          .catch((e) => { console.warn('town model failed, keeping the procedural town:', e.message); });
      }
      // The camp, a capital's palace, the wall ring and the fields come from the age's shared file.
      const shared = camp || asset ? sharedFor(opts.ageId, style) : null;
      const campRoot = camp ? shared?.[COLONY_CAMP] : null;
      const palaceRoot = asset && opts.capital ? shared?.[palaceFor(tier.id)] : null;
      const wallsRoot = asset && opts.walls ? shared?.[wallsFor(tier.id)] : null;
      const fields = asset && shared ? fieldsAround(tier.id, seed, fieldCount(region)).filter((f) => shared[f.name]) : [];
      const teamColor = owner === state.playerNationId ? PLAYER_COLOR : (getNationColor(owner) || '#64748b');
      const ll = REGION_COORDINATES[id];
      const tint = (campRoot || asset) && ll ? tintAt(ll.lat, ll.lng) : null;
      const key = campRoot ? `${id}|camp|${opts.ageId}|${teamColor}|${tintKey(tint)}`
        : asset ? `${id}|asset|${assetUrl}|${teamColor}|${tintKey(tint)}|${palaceRoot ? palaceRoot.uuid : ''}|${wallsRoot ? wallsRoot.uuid : ''}|${fields.map((f) => f.name).join(',')}`
          : `${id}|${tier.id}|${opts.ageId}|${opts.walls}|${opts.capital}`;
      seen.add(id);
      let mesh = t.towns.get(id);
      if (!mesh || mesh.userData.key !== key) {
        if (mesh) scene.remove(mesh);
        const model = campRoot || asset;
        mesh = model ? instanceTownAsset(model, teamColor, tint) : new Mesh(getTownGeometry(id, tier.id, opts), t.townMaterial);
        if (asset && palaceRoot) mesh.add(instanceTownAsset(palaceRoot, teamColor, tint));
        if (asset && wallsRoot) mesh.add(instanceTownAsset(wallsRoot, teamColor, tint));
        mesh.userData.fields = fields.map((f) => {
          const field = instanceTownAsset(shared[f.name], teamColor, tint);
          field.position.set(f.x, 0, f.z);
          field.rotation.y = f.yaw;
          mesh.add(field);
          return { field, f };
        });
        mesh.userData.key = key;
        mesh.userData.asset = !!model;
        mesh.frustumCulled = false;
        t.towns.set(id, mesh);
        scene.add(mesh);
      }
      if (mesh.userData.asset) showLod(mesh, lodForZoom(k));
      // the town's ground (and its wall ring) is claimed first; its fields come after the works
      // bigger towns drawn bigger, and no town reaching into the sea
      const radius = (campRoot ? 1.0 : tier.modelRadius || 2) + (wallsRoot ? 0.3 : 0);
      const room = Math.min(townRoomUnits(projection, getTiles(), region.tile), townGapUnits(projection, getTiles(), region.tile, isTown));
      const ts = townUnitPx(k, radius, room * k, campRoot ? 1 : TIER_SCALE[tier.id] || 1);
      occ.claim(at.x, at.y, radius * ts);
      if (mesh.userData.fields?.length) ringFields.push({ mesh, at, s: ts });
      // the city's landmarks (its highest building tiers with a model file) round an artist town
      const picks = asset ? pickBuildingModels(region, style, tier.id).filter(buildingReady) : [];
      if (picks.length) {
        mesh.userData.spots ||= buildingSpots(tier.id, seed, fields);
        townBuildings.push({ mesh, at, s: ts, picks, teamColor, tint });
      }
      mesh.position.set(at.x, -at.y, at.y * 0.05);
      mesh.rotation.set(TILT, 0, 0);
      mesh.scale.setScalar(ts);
      mesh.visible = true;
    });
    t.towns.forEach((mesh, id) => { if (!seen.has(id)) mesh.visible = false; });

    // Wonders on their own tiles (wonderAssets.js): the built tier's model at the towns' scale,
    // in the owner's colour, on land only. Without a file the banner and the star stay alone.
    const seenWonders = new Set();
    wonders.forEach((w) => {
      const url = wonderAssetUrl(w.projectId);
      if (!t.assets.has(url)) {
        t.assets.set(url, null);
        loadAssetObjects(url).then((objs) => { t.assets.set(url, objs); setAssetsTick((n) => n + 1); })
          .catch((e) => { console.warn('wonder model failed, the wonder keeps its banner:', e.message); });
      }
      const root = wonderTierObject(t.assets.get(url), w.tier);
      if (!root) return;
      const { lat, lon } = getTiles().latLonOf(w.tile);
      const at = toScreenLatLng({ lat, lng: lon });
      if (!at || !landAt(at.x, at.y)) return;
      const teamColor = w.ownerId === state.playerNationId ? PLAYER_COLOR : (getNationColor(w.ownerId) || '#64748b');
      const tint = tintAt(lat, lon);
      const key = `${root.uuid}|${teamColor}|${tintKey(tint)}`;
      let mesh = t.wonders.get(w.tile);
      if (!mesh || mesh.userData.key !== key) {
        if (mesh) scene.remove(mesh);
        mesh = instanceTownAsset(root, teamColor, tint);
        // its ground radius from the model itself (up to 120 m across), measured untransformed
        const box = new Box3().setFromObject(mesh);
        const r = box.isEmpty() ? WONDER_RADIUS : Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
        mesh.userData.radius = Math.max(1, Math.min(WONDER_RADIUS * 1.5, r || WONDER_RADIUS));
        mesh.userData.key = key;
        mesh.frustumCulled = false;
        t.wonders.set(w.tile, mesh);
        scene.add(mesh);
      }
      showLod(mesh, lodForZoom(k));
      const radius = mesh.userData.radius;
      const room = Math.min(townRoomUnits(projection, getTiles(), w.tile), townGapUnits(projection, getTiles(), w.tile, isTown));
      const ws = townUnitPx(k, radius, room * k);
      occ.claim(at.x, at.y, radius * ws);
      mesh.position.set(at.x, -at.y, at.y * 0.05);
      mesh.rotation.set(TILT, 0, 0);
      mesh.scale.setScalar(ws);
      mesh.visible = true;
      seenWonders.add(w.tile);
    });
    t.wonders.forEach((mesh, tile) => { if (!seenWonders.has(tile)) mesh.visible = false; });

    // Landmarks: each on the first free spot round its town (on land, and outside the wall only
    // where nothing else stands; a naval one on the shore, its quay to the water), with the town's
    // scale, tilt and level of detail.
    t.buildings.begin(lodForZoom(k));
    const spotMatrix = new Matrix4(); const placed = new Matrix4();
    townBuildings.forEach(({ mesh, at, s: ts, picks, teamColor, tint }) => {
      mesh.updateMatrix();
      const accept = (spot, model) => {
        const sx = at.x + spot.x * ts; const sy = at.y + spot.z * ts * lean;
        const r = BUILDING_DISC * ts * 0.8;
        if (needsCoast(model.id)) {
          // a naval landmark: land under it and behind it, open water just in front of its quay
          const fx = Math.sin(spot.yaw) * ts; const fy = Math.cos(spot.yaw) * ts * lean;
          const onLand = (d) => landAt(sx + fx * d, sy + fy * d);
          if (!onLand(0) || !onLand(-BUILDING_DISC * 0.8) || onLand(BUILDING_DISC * 1.3) || onLand(BUILDING_DISC * 2)) return false;
          return occ.take(sx, sy, BUILDING_DISC * ts);
        }
        if (![[0, 0], [r, 0], [-r, 0], [0, r * lean], [0, -r * lean]].every(([dx, dy]) => landAt(sx + dx, sy + dy))) return false;
        return spot.inner || occ.take(sx, sy, BUILDING_DISC * ts);
      };
      assignSpots(picks, mesh.userData.spots, accept).forEach(({ model, spot }) => {
        spotMatrix.makeRotationY(spot.yaw).setPosition(spot.x, 0, spot.z);
        t.buildings.add(model.url, placed.multiplyMatrices(mesh.matrix, spotMatrix), teamColor, tint);
      });
    });
    t.buildings.end();

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
    // Farms, pastures and plantations show the owner's age's field models once its shared file is
    // in (two fields on a farm); a pillaged work, or one without models, stays procedural.
    const seenFields = new Set();
    const fieldWork = (w) => {
      const names = !w.pillaged && FIELDS_FOR_WORK[w.kind];
      const owner = names && state.regions[state.world?.tileOwner?.[w.tile]]?.owner;
      const shared = owner ? sharedFor(ageOf(state, owner)) : null;
      if (!shared || !names.every((n) => shared[n])) return false;
      const ll = latLonAt(w.x + s * WORK_OFFSET.x, w.y + s * WORK_OFFSET.y);
      const tint = ll ? tintAt(ll[1], ll[0]) : null;
      const key = `${names.join(',')}|${ageOf(state, owner)}|${tintKey(tint)}`;
      let g = t.fieldWorks.get(w.tile);
      if (!g || g.userData.key !== key) {
        if (g) scene.remove(g);
        g = new Object3D();
        names.forEach((n, i) => {
          const field = instanceTownAsset(shared[n], '#888888', tint);
          field.position.set((i - (names.length - 1) / 2) * 1.75, 0, 0);
          g.add(field);
        });
        g.userData.key = key;
        t.fieldWorks.set(w.tile, g);
        scene.add(g);
      }
      showLod(g, lodForZoom(k));
      g.position.set(w.x + s * WORK_OFFSET.x, -(w.y + s * WORK_OFFSET.y), (w.y + s * WORK_OFFSET.y) * 0.05);
      g.rotation.set(TILT, w.turn * 0.15, 0, 'XYZ');
      g.scale.setScalar(s);
      g.visible = true;
      seenFields.add(w.tile);
      return true;
    };
    // Improvement models (improvementModels.js): the owner's age and the land's style pick the
    // file; boats on a water tile beside the coast, their shoreline toward the land, the rest on
    // land; the towns' scale capped by the coast and the next town; nothing overlapping. Returns
    // false when the tile has no model (its procedural work or fields stay), true when handled.
    t.improvements.begin(lodForZoom(k));
    const tilesNow = getTiles();
    const impMatrix = new Object3D();
    const improvementWork = (w) => {
      const owner = state.regions[state.world?.tileOwner?.[w.tile]]?.owner;
      if (!owner || !modelAllowedOnTile(tilesNow, w.tile, w.kind)) return false;
      const ageId = ageOf(state, owner);
      const model = improvementModel(w.kind, ageId, styleOfLand(tilesNow.countryOf(w.tile) || owner, ageId));
      if (!model) return false;
      if (!t.improvements.hasModel(model.url)) {
        if (!t.assets.has(model.url)) {
          t.assets.set(model.url, null);
          loadAssetObjects(model.url).then((objs) => { t.improvements.setModel(model.url, improvementRoot(objs, model.name)); setAssetsTick((n) => n + 1); })
            .catch((e) => { console.warn('improvement model failed, the tile keeps its work:', e.message); });
        }
        return false;
      }
      const info = t.improvements.info(model.url);
      const boats = w.kind === 'fishing_boats';
      const ll = boats ? boatsSpot(tilesNow, w.tile) : tilesNow.latLonOf(w.tile);
      const centre = ll && project(ll.lat, ll.lon);
      const coast = boats && ll ? project(ll.toLat, ll.toLon) : null;
      if (!centre || (boats && !coast)) return true;
      const radius = Math.max(0.5, info.radius * IMPROVEMENT_SCALE);
      const room = boats ? Infinity : Math.min(townRoomUnits(projection, tilesNow, w.tile), townGapUnits(projection, tilesNow, w.tile, isTown));
      const px = townUnitPx(k, radius, Number.isFinite(room) ? room * k : 0) * IMPROVEMENT_SCALE;
      // boats: the shoreline turned toward the land and laid on the coast
      const yaw = boats && info.ground ? yawToward(info.ground[0], info.ground[1], coast.x - centre.x, coast.y - centre.y, lean) : w.turn * 0.15;
      const shore = boats ? coastShare(centre, coast, landAt) : null;
      const at = boats ? shoreAnchor(centre, coast, info.ground, px, lean, shore ? Math.max(0.1, shore - SHORE_BACK) : undefined) : centre;
      if (!fitImprovement({ boats, at, r: info.radius * px, landAt, occ, lean })) return true;
      const teamColor = owner === state.playerNationId ? PLAYER_COLOR : (getNationColor(owner) || '#64748b');
      const tint = boats ? tintAt(ll.toLat, ll.toLon) : tintAt(ll.lat, ll.lon);
      impMatrix.position.set(at.x, -at.y, at.y * 0.05);
      impMatrix.rotation.set(TILT, yaw, 0, 'XYZ');
      impMatrix.scale.setScalar(px);
      impMatrix.updateMatrix();
      t.improvements.add(model.url, impMatrix.matrix, teamColor, tint, w.pillaged ? 0.45 : 1);
      return true;
    };
    land.works.forEach((w) => {
      if (improvementWork(w)) return;
      // a work set off its tile centre must still stand on land (fishing boats belong at sea)
      const wx = w.x + s * WORK_OFFSET.x; const wy = w.y + s * WORK_OFFSET.y;
      if (w.kind !== 'fishing_boats' && !landAt(wx, wy)) return;
      // and clear of the towns and the works already placed
      const names = !w.pillaged && FIELDS_FOR_WORK[w.kind];
      const disc = names ? (names.length > 1 ? 1.9 : FIELD_DISC) : 0.75;
      if (!occ.take(wx, wy, disc * s)) return;
      if (fieldWork(w)) return;
      const mesh = t.works.get(w.kind);
      if (mesh && mesh.count < MAX_WORKS) put(mesh, w.x + s * WORK_OFFSET.x, w.y + s * WORK_OFFSET.y, s * 1.2, w.turn * 0.15, w.pillaged ? 0.45 : 1);
    });
    t.fieldWorks.forEach((g, tile) => { if (!seenFields.has(tile)) g.visible = false; });
    t.improvements.end();
    // The fields round towns: shown where they are on land and clear of everything placed so far
    // (the ring is in model units, so where it falls on the Earth changes with the zoom).
    // (the fields are children of the town, so they share its hex-capped scale `ts`)
    ringFields.forEach(({ mesh, at, s: ts }) => {
      mesh.userData.fields.forEach(({ field, f }) => {
        const ends = [0, -0.75, 0.75].map((u) => [f.x + u * Math.cos(f.yaw), f.z - u * Math.sin(f.yaw)]);
        field.visible = ends.every(([fx, fz]) => landAt(at.x + fx * ts, at.y + fz * ts * lean))
          && occ.take(at.x + f.x * ts, at.y + f.z * ts * lean, FIELD_DISC * ts);
      });
    });
    // Trees last, on free land only.
    land.trees.forEach((tr) => {
      const mesh = t.trees.get(tr.kind);
      if (mesh && mesh.count < MAX_TREES && landAt(tr.x, tr.y) && occ.free(tr.x, tr.y, 0.12 * s * tr.size)) put(mesh, tr.x, tr.y, s * tr.size, tr.turn, 0.85 + (tr.turn % 0.3));
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
  }, [active, projection, transform, width, height, state, markers, assetsTick]);

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
