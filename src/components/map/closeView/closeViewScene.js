// src/components/map/closeView/closeViewScene.js
// The close view's models (plan §4f), apart from any renderer: towns sized by their buildings
// (townModels.js) or the artist files (townAssets.js), wonders on their tiles, a city's landmarks
// round its town (buildingModels.js, instanced by buildingLayer.js), improvement models
// (improvementModels.js), procedural works and fields, trees in the woods (landscape.js), and
// armies as 1 to 3 soldiers of their main unit type and age, the battle's own models and walk
// cycle (soldierFactory.js), walking while they march; fleets as 1 to 3 warships of their
// owner's age (shipModels.js).
// `createCloseScene(scene, root)` puts the lights in `scene` and every model under `root`;
// `layout(...)` places them in screen pixels for a view (x right, y up = -screen y, z toward the
// viewer), models tilted toward the viewer for a three-quarter look. Used by CloseViewLayer.jsx
// (its own canvas over the SVG map) and by the WebGL map (gl/GLMapView.jsx), which lays the
// models out once per settled view and moves `root` while the map pans and zooms.
// Phase F (world plan 4 and 5): towns stand on their tile's centre within the footprint's town disk
// (src/data/geo/footprints.js), the fields of a town and of a farm are the footprint's plots, the
// mountain chains run along the ridge lines (terrainPlacement.js, mountainModels.js) and nothing
// grows in a river's band.
import {
  HemisphereLight, DirectionalLight, Mesh, MeshLambertMaterial, MeshBasicMaterial, InstancedMesh, PlaneGeometry, CanvasTexture, SRGBColorSpace,
  InstancedBufferAttribute, DynamicDrawUsage, Object3D, Color, Matrix4, Box3, BufferGeometry
} from 'three';
import { REGION_COORDINATES } from '../../../data/regionCoordinates';
import { markerLatLng } from '../../../utils/markerPosition';
import { getEffectiveAgeId } from '../../../data/ages';
import { getSoldierGeometry, hasSoldierOverride, packForGPU, createSoldierMaterial, MODEL_SCALE } from '../../../battle/render/soldierFactory';
import { findUnitModel, preloadSoldierModel, preloadSignatureModel } from '../../../battle/render/unitModels';
import { signatureUnitFor, signatureKey, rigFiguresOf } from '../../../data/signatureUnits';
import { peopleForNationId } from '../../../data/peoples';
import { soldierLodGeometries, triangleCount } from '../../../battle/render/soldierLod';
import { skinToneFor, soldierSkinTone, emblemCellFor } from '../../../battle/render/unitVariants';
import { getNationColor } from '../../../data/nationColors';
import { getTownGeometry, townTier } from './townModels';
import { townAssetUrl, loadTownAsset, loadAssetObjects, sharedAssetUrls, palaceFor, wallsFor, COLONY_CAMP, isCamp, FIELDS_FOR_WORK, instanceTownAsset, showLod, lodForZoom } from './townAssets';
import { ARMY_SPOT, unitPx, tiltFor, lightRig, townUnitPx, townRoomUnits, townGapUnits, TIER_SCALE } from './scale';
import { cityHexOf, hexTownPx, insideHex } from './cityHex';
import { cachedFootprint, screenFrame, plotsOnScreen, reliefOnScreen, riverDiscsOnScreen } from './terrainPlacement';
import { getRidgeGeometry, getHillGeometry, RIDGE_VARIANTS } from './mountainModels';
import { dressCloseTerrain } from './terrainKits';
import { riverHalfPx } from '../gl/terrainModel';
import { EARTH_RADIUS_KM } from '../../../data/geo/geodesic';
import { landscapeOnScreen, MAX_TREES, WORK_KINDS, WORK_OFFSET } from './landscape';
import { getTiles } from '../../../data/geo/tiles';
import { landOf } from '../../../engine/world/cultureZones';
import { styleOfLand, themeOfNation } from '../../../data/architecture';
import { isLandAt, sampleLandColour, groundTint, tintKey } from './groundBlend';
import { createOccupancy } from './occupancy';
import { getTreeGeometry, getWorkGeometry } from './landscapeModels';
import { pickBuildingModels, buildingSpots, assignSpots, buildingRoot, needsCoast, BUILDING_DISC } from './buildingModels';
import { createBuildingLayer } from './buildingLayer';
import { cityManifestOf, manifestStates } from '../../../engine/cityManifest';
import { applyTownDamage, syncTownDamage, enableGroundClear, setGroundClear, fileGroundClear } from './townDamage';
import { wonderAssetUrl, wonderTierObject, wonderPlacements, WONDER_RADIUS } from './wonderAssets';
import { shipModel, shipsFor, SHIP_SCALE } from './shipModels';
import { improvementModel, improvementRoot, modelAllowedOnTile, boatsSpot, coastShare, shoreAnchor, yawToward, fitImprovement, IMPROVEMENT_SCALE, SHORE_BACK } from './improvementModels';

const TREE_KINDS = ['conifer', 'broad', 'palm'];
const MAX_WORKS = 400;
const SOLDIER_SIZE = 2.4; // soldiers are drawn larger than true scale so they read at map size
const MAX_SOLDIERS = 240;
// A standing army turns a little toward the viewer: body, kilt and spear show beside the shield's
// face (team colour and device) on the left arm, not just the shield or its back.
const STAND_HEADING = 0.15;
// Army figures stand at least this tall (layout px, model height before the tilt; about 34 css px
// on screen at mid zoom): smaller, the spear, shield and kilt of the battle model run together.
const MIN_FIGURE_PX = 64;
// The army figures' triangle budget at full detail (phones: about 100 Bronze spearmen of 1,500
// triangles, a small share of the map's frame); past it every figure takes the clustered level.
export const MAP_FIGURE_TRIS = 150000;
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
const MAX_PLOTS = 3000;
const MAX_RIDGE_MESH = 600; // per variant
// Field plots: the footprint's rectangles, flat on the map (placeholder for the `map-terrain/
// field-edges` kit, src/assets/map/terrain/field-edges.glb): furrows and a hedge rim, tinted per plot.
const PLOT_TINTS = ['#d6c27a', '#a9b45f', '#8f7a52', '#c9b26a', '#7f9a4e'].map((c) => new Color(c));
const plotTexture = () => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 32);
  g.fillStyle = 'rgba(0,0,0,0.13)';
  for (let x = 2; x < 64; x += 5) g.fillRect(x, 2, 2, 28);
  g.strokeStyle = 'rgba(60,72,40,0.75)'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 30);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
};
const FOG_GREY = new Color(0.55, 0.57, 0.64);

/** The town tiles (so no town grows into its neighbour) and the wonders with a model, once per game state. */
export const closeTowns = (state) => {
  const townTiles = new Set(Object.values(state.regions).filter((r) => (r.owner || r.colony) && r.tile != null).map((r) => r.tile));
  const wonders = wonderPlacements(state, getTiles()).filter((w) => wonderAssetUrl(w.projectId));
  wonders.forEach((w) => townTiles.add(w.tile));
  return { wonders, isTown: (t) => townTiles.has(t) };
};

/**
 * The close view's models under `root`, its lights in `scene`. `onAssets()` is called whenever a
 * model file finishes loading (lay out again). Returns { layout, moving, dispose }.
 */
export const createCloseScene = (scene, root, { onAssets, footprintOf = cachedFootprint }) => {
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
    root.add(mesh);
    return mesh;
  };
  const t = {
    sky, sun, townMaterial, soldierMaterial, towns: new Map(), wonders: new Map(), fieldWorks: new Map(), layers: new Map(), soldierLoads: new Set(), assets: new Map(),
    trees: new Map(TREE_KINDS.map((kind) => [kind, instanced(getTreeGeometry(kind), MAX_TREES)])),
    works: new Map(WORK_KINDS.map((kind) => [kind, instanced(getWorkGeometry(kind), MAX_WORKS)])),
    buildings: createBuildingLayer(root), improvements: createBuildingLayer(root), ships: createBuildingLayer(root), moving: false,
    ridges: new Map(), hills: instanced(getHillGeometry(), 600)
  };
  for (let v = 0; v < RIDGE_VARIANTS; v++) [false, true].forEach((snow) => t.ridges.set(`${v}|${snow}`, instanced(getRidgeGeometry(v, snow), MAX_RIDGE_MESH)));
  // an army layer built on a soldier model that has since been replaced (its GLB arrived)
  const dropLayer = (l) => { l.levels.forEach((m) => { root.remove(m); m.geometry.dispose(); }); };
  dressCloseTerrain(t, onAssets); // the map terrain kits, where delivered (terrainKits.js)
  const plotMap = plotTexture();
  const plotMaterial = new MeshBasicMaterial({ map: plotMap, transparent: true, opacity: 0.88, depthWrite: false });
  t.plots = new InstancedMesh(new PlaneGeometry(1, 1), plotMaterial, MAX_PLOTS);
  t.plots.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_PLOTS * 3), 3).setUsage(DynamicDrawUsage);
  t.plots.count = 0; t.plots.frustumCulled = false; t.plots.renderOrder = -1;
  root.add(t.plots);

  /**
   * Lays the models out for a view. `projection`: the map's d3 projection (town room and gaps are
   * measured on it); `proj`: { fwd(lon, lat) -> [x, y], inv(x, y) -> [lon, lat] } in its units,
   * the wrapped copy nearest the view for the WebGL map; `transform` { x, y, k }: screen = world *
   * k + (x, y); `width`, `height`: the screen box the models are laid out over.
   */
  const layout = ({ projection, proj, transform, width, height, state, fog, towns, markers, ground }) => {
    const k = transform.k;
    const s = unitPx(k);
    const TILT = tiltFor(k);
    const rig = lightRig(TILT);
    sky.position.set(...rig.sky);
    sun.position.set(...rig.sun);
    // Where a screen point lies on the Earth, and whether that is land (fields, works and trees are
    // never drawn in the sea); the tint that sets a model's ground into the land around it.
    const latLonAt = (x, y) => proj.inv((x - transform.x) / k, (y - transform.y) / k);
    const landAt = (x, y) => { const ll = latLonAt(x, y); return !ll || isLandAt(ground?.mask, ll[1], ll[0]); };
    const tintAt = (lat, lon) => groundTint(sampleLandColour(ground?.raster, ground?.mask, lat, lon, 3));
    const toScreenLatLng = (c) => {
      const p = c && proj.fwd(c.lng, c.lat);
      if (!p) return null;
      const x = p[0] * k + transform.x; const y = p[1] * k + transform.y;
      return x < -EDGE || y < -EDGE || x > width + EDGE || y > height + EDGE ? null : { x, y };
    };
    const toScreen = (regionId) => toScreenLatLng(REGION_COORDINATES[regionId]);
    // phase F: a lat/lon to screen pixels without the edge cut, and screen pixels per km (north)
    const project = (lat, lon) => {
      const p = proj.fwd(lon, lat);
      return p ? { x: p[0] * k + transform.x, y: p[1] * k + transform.y } : null;
    };
    const pxPerKmNorth = (projection.scale() * k) / EARTH_RADIUS_KM;
    const plotTiles = []; // [{ tile, fp }]: towns' and farms' fields, laid after the works

    // The age's shared files (palaces, walls, the camp, fields): each loaded once, the objects by
    // name; a region's file (its own palaces and walls) over the age's base file.
    const loadShared = (url) => {
      if (!t.assets.has(url)) {
        t.assets.set(url, null);
        loadAssetObjects(url).then((objs) => { t.assets.set(url, objs); onAssets(); })
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
        loadAssetObjects(url).then((objs) => { t.buildings.setModel(url, buildingRoot(objs, id, url)); onAssets(); })
          .catch((e) => { console.warn('building model failed, the town stands without it:', e.message); });
      }
      return false;
    };

    // Towns: every province on screen with an owner or a colony.
    const seen = new Set();
    const { wonders, isTown } = towns;
    Object.keys(REGION_COORDINATES).forEach((id) => {
      const region = state.regions[id];
      if (!region || (!region.owner && !region.colony)) return;
      // the town stands on its tile's centre (the footprint's frame), else on the province point
      const tileLL = region.tile != null ? getTiles().latLonOf(region.tile) : null;
      const at = tileLL ? toScreenLatLng({ lat: tileLL.lat, lng: tileLL.lon }) : toScreen(id);
      if (!at) return;
      const fp = region.tile != null ? footprintOf(region.tile, state) : null;
      const owner = region.owner || region.colony?.ownerId;
      const tier = region.owner ? townTier(region) : { id: 'small' };
      const opts = { ageId: ageOf(state, owner), walls: (region.buildings?.categories?.defense ?? -1) >= 0, capital: state.nations[owner]?.capitalRegionId === id };
      // An artist model for this age and size replaces the procedural town once its file is in;
      // an outpost shows the age's colony camp instead.
      const camp = isCamp(region);
      const seed = [...id].reduce((h, c) => h + c.charCodeAt(0), 0);
      // the land's architecture style (the tile's country), whoever owns the city (art spec 3b)
      const landNation = region.tile != null ? landOf(region.tile, state.scenario?.sites) : null;
      const style = styleOfLand(landNation || owner, opts.ageId);
      const assetUrl = camp ? null : townAssetUrl(opts.ageId, tier.id, seed, style);
      const asset = assetUrl ? t.assets.get(assetUrl) : null;
      if (assetUrl && !t.assets.has(assetUrl)) {
        t.assets.set(assetUrl, null);
        loadTownAsset(assetUrl).then((r) => { t.assets.set(assetUrl, r); onAssets(); })
          .catch((e) => { console.warn('town model failed, keeping the procedural town:', e.message); });
      }
      // The camp, a capital's palace, the wall ring and the fields come from the age's shared file.
      const shared = camp || asset ? sharedFor(opts.ageId, style) : null;
      const campRoot = camp ? shared?.[COLONY_CAMP] : null;
      // A capital's palace follows the owner's theme (a people's `theme`, art spec 3b.5), the town
      // the land's; a legacy nation's palace stays with the land.
      const palaceStyle = themeOfNation(owner);
      const palaceShared = asset && opts.capital && palaceStyle && palaceStyle !== style ? sharedFor(opts.ageId, palaceStyle) : shared;
      const palaceRoot = asset && opts.capital ? palaceShared?.[palaceFor(tier.id)] : null;
      const wallsRoot = asset && opts.walls ? shared?.[wallsFor(tier.id)] : null;
      // the fields are the footprint's plots now (laid after the works), not a ring of models
      const fields = [];
      if (fp?.fields.length && !camp) plotTiles.push({ tile: region.tile, fp, visible: !fog.isVisible || fog.isVisible(region.tile) });
      const teamColor = owner === state.playerNationId ? PLAYER_COLOR : (getNationColor(owner) || '#64748b');
      const ll = REGION_COORDINATES[id];
      const tint = (campRoot || asset) && ll ? tintAt(ll.lat, ll.lng) : null;
      // battle damage on the city (src/engine/cityManifest.js): ruined houses cut out, damaged darkened
      const dmg = asset ? region.cityDamage : null;
      const dmgKey = dmg ? `${Object.keys(dmg.ruined || {}).sort().join(',')}/${Object.keys(dmg.damaged || {}).sort().join(',')}` : '';
      const key = campRoot ? `${id}|camp|${opts.ageId}|${teamColor}|${tintKey(tint)}`
        : asset ? `${id}|asset|${assetUrl}|${teamColor}|${tintKey(tint)}|${palaceRoot ? palaceRoot.uuid : ''}|${wallsRoot ? wallsRoot.uuid : ''}|${fields.map((f) => f.name).join(',')}|${dmgKey}`
          : `${id}|${tier.id}|${opts.ageId}|${opts.walls}|${opts.capital}`;
      seen.add(id);
      let mesh = t.towns.get(id);
      if (!mesh || mesh.userData.key !== key) {
        if (mesh) { root.remove(mesh); [...(mesh.userData.townDamage || []), ...(mesh.userData.groundClear || [])].forEach((m) => m.dispose()); }
        const model = campRoot || asset;
        mesh = model ? instanceTownAsset(model, teamColor, tint) : new Mesh(getTownGeometry(id, tier.id, opts), townMaterial);
        const palaceNode = asset && palaceRoot ? instanceTownAsset(palaceRoot, teamColor, tint) : null;
        if (palaceNode) mesh.add(palaceNode);
        if (asset && wallsRoot) mesh.add(instanceTownAsset(wallsRoot, teamColor, tint));
        // the old plots of landmarks the art moved off the square: their baked shade lifted
        const plots = asset ? fileGroundClear(mesh) : [];
        if (plots.length) { enableGroundClear(mesh); setGroundClear(mesh, plots); }
        if (dmg) {
          const states = manifestStates(cityManifestOf(state, id), dmg).filter((s) => s.kind === 'house' || s.kind === 'landmark' || (palaceNode && s.kind === 'palace'));
          const palace = palaceNode ? { name: palaceFor(tier.id), style: palaceShared === shared ? style : palaceStyle, node: palaceNode } : null;
          applyTownDamage(mesh, states, { ageId: opts.ageId, style, teamColor, tint, onReady: onAssets, palace });
        }
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
        root.add(mesh);
      }
      if (mesh.userData.asset) showLod(mesh, lodForZoom(k));
      // the town's ground (and its wall ring) is claimed first; its fields come after the works.
      // Every tier fills its own hex (cityHex.js, decision D10): the tier's art shows the city's
      // size; never into a neighbouring hex or the sea. An outpost's camp keeps its natural size.
      const radius = (camp ? 1.0 : tier.modelRadius || 2) + (opts.walls && !camp ? 0.3 : 0);
      const ts = hexTownPx({ projection, tiles: getTiles(), tile: region.tile, k, radius, lean, fill: !camp, isTown, tierScale: TIER_SCALE[tier.id] || 1 });
      occ.claim(at.x, at.y, radius * ts);
      if (mesh.userData.fields?.length) ringFields.push({ mesh, at, s: ts });
      // the city's landmarks (its highest building tiers with a model file) round an artist town
      const picks = asset ? pickBuildingModels(region, style, tier.id).filter(buildingReady) : [];
      if (picks.length) {
        mesh.userData.spots ||= buildingSpots(tier.id, seed, fields);
        townBuildings.push({ mesh, at, s: ts, picks, teamColor, tint, hex: cityHexOf(projection, getTiles(), region.tile) });
      }
      mesh.position.set(at.x, -at.y, at.y * 0.05);
      mesh.rotation.set(TILT, 0, 0);
      mesh.scale.setScalar(ts);
      mesh.visible = true;
      if (mesh.userData.townDamage || mesh.userData.groundClear) syncTownDamage(mesh);
    });
    t.towns.forEach((mesh, id) => { if (!seen.has(id)) mesh.visible = false; });

    // Wonders on their own tiles (wonderAssets.js): the built tier's model at the towns' scale,
    // in the owner's colour, on land only. Without a file the banner and the star stay alone.
    const seenWonders = new Set();
    wonders.forEach((w) => {
      const url = wonderAssetUrl(w.projectId);
      if (!t.assets.has(url)) {
        t.assets.set(url, null);
        loadAssetObjects(url).then((objs) => { t.assets.set(url, objs); onAssets(); })
          .catch((e) => { console.warn('wonder model failed, the wonder keeps its banner:', e.message); });
      }
      const wroot = wonderTierObject(t.assets.get(url), w.tier);
      if (!wroot) return;
      const { lat, lon } = getTiles().latLonOf(w.tile);
      const at = toScreenLatLng({ lat, lng: lon });
      if (!at || !landAt(at.x, at.y)) return;
      const teamColor = w.ownerId === state.playerNationId ? PLAYER_COLOR : (getNationColor(w.ownerId) || '#64748b');
      const tint = tintAt(lat, lon);
      const key = `${wroot.uuid}|${teamColor}|${tintKey(tint)}`;
      let mesh = t.wonders.get(w.tile);
      if (!mesh || mesh.userData.key !== key) {
        if (mesh) root.remove(mesh);
        mesh = instanceTownAsset(wroot, teamColor, tint);
        // its ground radius from the model itself (up to 120 m across), measured untransformed
        const box = new Box3().setFromObject(mesh);
        const r = box.isEmpty() ? WONDER_RADIUS : Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
        mesh.userData.radius = Math.max(1, Math.min(WONDER_RADIUS * 1.5, r || WONDER_RADIUS));
        mesh.userData.key = key;
        mesh.frustumCulled = false;
        t.wonders.set(w.tile, mesh);
        root.add(mesh);
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
    townBuildings.forEach(({ mesh, at, s: ts, picks, teamColor, tint, hex }) => {
      mesh.updateMatrix();
      const accept = (spot, model) => {
        const sx = at.x + spot.x * ts; const sy = at.y + spot.z * ts * lean;
        const r = BUILDING_DISC * ts * 0.8;
        // the town fills its hex: a landmark off its ground stays on that hex (a quay's centre on it)
        if (!spot.inner && hex && !insideHex(hex, (sx - at.x) / k, (sy - at.y) / k, spot.shore ? 0 : r / k, lean, false)) return false;
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
    const cityTiles = new Set(Object.values(state.regions).map((r) => r.tile).filter((x) => x != null));
    // The screen as a lat/lon window (with a margin) for the spatial index: only the tiles in view.
    const nw = latLonAt(-120, -120); const se = latLonAt(width + 120, height + 120);
    const screenWindow = nw && se ? { west: nw[0], north: nw[1], east: se[0], south: se[1] } : null;
    const land = landscapeOnScreen({ toScreen: project, width, height, k, world: state.world, cityTiles, isExplored: fog.isExplored, area: screenWindow });
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
        if (g) root.remove(g);
        g = new Object3D();
        names.forEach((n, i) => {
          const field = instanceTownAsset(shared[n], '#888888', tint);
          field.position.set((i - (names.length - 1) / 2) * 1.75, 0, 0);
          g.add(field);
        });
        g.userData.key = key;
        t.fieldWorks.set(w.tile, g);
        root.add(g);
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
      const model = improvementModel(w.kind, ageId, styleOfLand(landOf(w.tile, state.scenario?.sites) || owner, ageId));
      if (!model) return false;
      if (!t.improvements.hasModel(model.url)) {
        if (!t.assets.has(model.url)) {
          t.assets.set(model.url, null);
          loadAssetObjects(model.url).then((objs) => { t.improvements.setModel(model.url, improvementRoot(objs, model.name)); onAssets(); })
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
      // a farm (phase F): its farmstead model if there is one, and the footprint's plots round it
      if (w.kind === 'farm' && !w.pillaged) {
        improvementWork(w);
        const fp = footprintOf(w.tile, state);
        if (fp.fields.length) plotTiles.push({ tile: w.tile, fp, visible: fog.isVisible(w.tile) });
        return;
      }
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
    // The fields of towns and farms: the footprint's plots (local km, so they never move with the
    // zoom), flat on the map, on land and clear of everything placed so far.
    t.plots.count = 0;
    const plotTmp = new Object3D(); const plotColor = new Color();
    plotTiles.forEach(({ tile, fp, visible }) => {
      const frame = screenFrame(tile, project);
      if (!frame) return;
      plotsOnScreen(fp, frame).forEach((p) => {
        if (t.plots.count >= MAX_PLOTS || p.x < -EDGE || p.y < -EDGE || p.x > width + EDGE || p.y > height + EDGE) return;
        if (!landAt(p.x, p.y) || !occ.take(p.x, p.y, Math.min(p.len, p.wid) * 0.5)) return;
        plotTmp.position.set(p.x, -p.y, p.y * 0.05 - 1);
        plotTmp.rotation.set(0, 0, -p.angle);
        plotTmp.scale.set(p.len, p.wid, 1);
        plotTmp.updateMatrix();
        t.plots.setMatrixAt(t.plots.count, plotTmp.matrix);
        plotColor.copy(PLOT_TINTS[Math.floor(p.shade * PLOT_TINTS.length) % PLOT_TINTS.length]);
        if (!visible) plotColor.multiply(FOG_GREY);
        t.plots.setColorAt(t.plots.count, plotColor);
        t.plots.count += 1;
      });
    });
    t.plots.instanceMatrix.needsUpdate = true; t.plots.instanceColor.needsUpdate = true;
    // The mountain chains and foothills (terrainPlacement.reliefOnScreen), on ground nothing else holds.
    t.ridges.forEach((m) => { m.count = 0; });
    t.hills.count = 0;
    const relief = reliefOnScreen({ project, width, height, area: screenWindow, lean, isExplored: fog.isExplored, isVisible: fog.isVisible || (() => true) });
    const reliefPut = (mesh, r) => {
      if (mesh.count >= mesh.instanceMatrix.count) return;
      lsTmp.position.set(r.x, -r.y, r.y * 0.05);
      lsTmp.rotation.set(TILT, r.yaw, 0, 'XYZ');
      lsTmp.scale.set(r.sx, r.sy, r.sz);
      lsTmp.updateMatrix();
      mesh.setMatrixAt(mesh.count, lsTmp.matrix);
      lsColor.setScalar(0.92 + 0.16 * ((r.x * 0.37 + r.y * 0.11) % 1));
      if (!r.visible) lsColor.multiply(FOG_GREY);
      mesh.setColorAt(mesh.count, lsColor);
      mesh.count += 1;
    };
    relief.ridges.forEach((r) => {
      if (!landAt(r.x, r.y) || !occ.free(r.x, r.y, r.sz * 0.35)) return;
      reliefPut(t.ridges.get(`${r.variant}|${r.snow}`), r);
      occ.claim(r.x, r.y, r.sz * 0.45);
    });
    relief.hills.forEach((h) => { if (landAt(h.x, h.y) && occ.take(h.x, h.y, h.sx * 0.8)) reliefPut(t.hills, h); });
    [...t.ridges.values(), t.hills].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
    // Rivers keep their band clear: no tree stands in the water.
    riverDiscsOnScreen({ project, width, height, area: screenWindow, pxPerKm: pxPerKmNorth, halfPx: (size) => riverHalfPx(size, k) }).forEach((d) => occ.claim(d.x, d.y, d.r));
    // Trees last, on free land only.
    land.trees.forEach((tr) => {
      const mesh = t.trees.get(tr.kind);
      if (mesh && mesh.count < MAX_TREES && landAt(tr.x, tr.y) && occ.free(tr.x, tr.y, 0.12 * s * tr.size)) put(mesh, tr.x, tr.y, s * tr.size, tr.turn, 0.85 + (tr.turn % 0.3));
    });
    [...t.trees.values(), ...t.works.values()].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });

    // Armies: soldiers of the main unit type, beside the town, in the owner's colour.
    t.layers.forEach((l) => { l.levels.forEach((m) => { m.count = 0; }); });
    // The battle's own soldier: the artist's GLB where the unit has one (loaded once, then the
    // layer is rebuilt on it; the procedural body meanwhile and if it fails), else the procedural
    // model. The full model whenever the figures on screen fit MAP_FIGURE_TRIS (the clustered
    // battle LOD, about 280 triangles, read as a blob at mid zoom), the clustered one only beyond.
    // A people's war elephants (the rigs with their own few figures, RIG_FIGURES) draw under their
    // signature key once the model is in; until then the base unit of the role. Other signature
    // units keep the base unit on the map for now.
    const signatureLayerKey = (peopleId, ageId, classId) => {
      const entry = peopleId ? signatureUnitFor(peopleId, ageId, classId) : null;
      if (!rigFiguresOf(entry)) return null;
      const key = signatureKey(classId, peopleId);
      if (hasSoldierOverride(ageId, key)) return key;
      const loadKey = `${ageId}:${key}`;
      if (!t.soldierLoads.has(loadKey)) {
        t.soldierLoads.add(loadKey);
        preloadSignatureModel(peopleId, ageId, classId).then((ok) => { if (ok) onAssets(); }).catch(() => {});
      }
      return null;
    };
    const layerFor = (ageId, classId, sigKey = null) => {
      const key = `${ageId}:${sigKey || classId}`;
      if (!sigKey && !t.soldierLoads.has(key) && !hasSoldierOverride(ageId, classId) && findUnitModel(ageId, classId)) {
        t.soldierLoads.add(key);
        preloadSoldierModel(ageId, classId).then((ok) => { if (ok) onAssets(); }).catch(() => {});
      }
      const source = getSoldierGeometry(ageId, sigKey || classId);
      let l = t.layers.get(key);
      if (l && l.source !== source) { dropLayer(l); l = null; }
      if (!l) {
        const anim = new InstancedBufferAttribute(new Float32Array(MAX_SOLDIERS * 3), 3).setUsage(DynamicDrawUsage);
        const variant = new InstancedBufferAttribute(new Float32Array(MAX_SOLDIERS * 4), 4).setUsage(DynamicDrawUsage);
        const color = new InstancedBufferAttribute(new Float32Array(MAX_SOLDIERS * 3), 3).setUsage(DynamicDrawUsage);
        let matrix = null; // one instance buffer set, shared by both levels
        const levels = soldierLodGeometries(source).slice(0, 2).map((g) => {
          const geo = packForGPU(g.clone());
          geo.setAttribute('aAnim', anim); geo.setAttribute('aVariant', variant);
          const mesh = new InstancedMesh(geo, soldierMaterial, MAX_SOLDIERS);
          if (matrix) mesh.instanceMatrix = matrix; else matrix = mesh.instanceMatrix.setUsage(DynamicDrawUsage);
          mesh.instanceColor = color;
          mesh.count = 0; mesh.frustumCulled = false;
          root.add(mesh);
          return mesh;
        });
        source.computeBoundingBox();
        l = { source, levels, mesh: levels[0], anim, variant, color, tris: triangleCount(levels[0].geometry), height: Math.max(0.1, source.boundingBox.max.y - source.boundingBox.min.y) };
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
      const peopleId = m.ownerId ? peopleForNationId(m.ownerId) : null;
      const sigKey = signatureLayerKey(peopleId, ageId, classId);
      // war elephants: at most two full-size figures, wider apart
      const rigFig = sigKey ? rigFiguresOf(signatureUnitFor(peopleId, ageId, classId)) : null;
      const l = layerFor(ageId, classId, sigKey);
      // Marching: face the next step and walk.
      const lead = m.own ? state.units[m.units?.[0]] : null;
      const next = lead?.route?.[0] ? toScreen(lead.route[0]) : null;
      const walking = !!next;
      if (walking) moving = true;
      const heading = next ? Math.atan2(next.x - at.x, next.y - at.y) : STAND_HEADING;
      const n = rigFig ? Math.min(rigFig.figures, figuresFor(m.men)) : figuresFor(m.men);
      // never smaller than MIN_FIGURE_PX on screen (mid zoom), spaced to match
      const trueScale = s * SOLDIER_SIZE * (MODEL_SCALE[classId] || 0.88);
      const scale = Math.max(trueScale, MIN_FIGURE_PX / l.height);
      const gap = s * (scale / trueScale);
      color.set(m.own ? PLAYER_COLOR : getNationColor(m.ownerId) || '#64748b');
      const tone = skinToneFor(m.ownerId); const cell = emblemCellFor(m.own ? 0 : 1, mi);
      const side = rigFig ? 2.8 : 1.1; // elephants stand wider apart than men and horses, as in battle
      for (let i = 0; i < n && l.mesh.count < MAX_SOLDIERS; i++) {
        const k2 = l.mesh.count;
        const ox = (i - (n - 1) / 2) * gap * side + gap * ARMY_SPOT.x; const oy = gap * ARMY_SPOT.y + (i % 2) * gap * 0.4;
        tmp.position.set(at.x + ox, -(at.y + oy), (at.y + oy) * 0.05 + 40);
        tmp.rotation.set(TILT, heading, 0, 'XYZ');
        tmp.scale.setScalar(scale);
        tmp.updateMatrix();
        l.mesh.setMatrixAt(k2, tmp.matrix);
        l.mesh.setColorAt(k2, color);
        l.anim.setXYZ(k2, (mi * 1.7 + i) % 6.28, walking ? 1 : 0, 0);
        // one people's skin tone and one device per army, as in battle (unitVariants.js)
        l.variant.setXYZW(k2, soldierSkinTone(tone, mi, i), cell, ((mi + i) % 5) / 5 - 0.4, 0);
        l.mesh.count += 1;
      }
    });
    let figureTris = 0;
    t.layers.forEach((l) => { figureTris += l.mesh.count * l.tris; });
    const tier = figureTris <= MAP_FIGURE_TRIS ? 0 : 1;
    t.figureTier = tier;
    t.layers.forEach((l) => {
      const [full, mid] = l.levels;
      const n = full.count;
      full.count = tier === 0 ? n : 0; mid.count = tier === 1 ? n : 0;
      full.instanceMatrix.needsUpdate = true; l.color.needsUpdate = true; l.anim.needsUpdate = true; l.variant.needsUpdate = true;
    });
    t.moving = moving;

    // Fleets: 1 to 3 warships of the owner's age (shipModels.js) on their sea tile, turned toward
    // the next step of their route. With no ship file for the age only the banner stands.
    t.ships.begin(lodForZoom(k));
    markers.fleets.forEach((m, mi) => {
      const model = shipModel(ageOf(state, m.ownerId));
      if (!model) return;
      if (!t.ships.hasModel(model.url)) {
        if (!t.assets.has(model.url)) {
          t.assets.set(model.url, null);
          loadAssetObjects(model.url).then((objs) => {
            const ship = objs[model.name] || Object.values(objs)[0];
            // the file's swell (morph targets, for a later animated pass) is not drawn: the
            // instanced layer shows the hull at rest
            ship.traverse((o) => {
              if (!o.isMesh || !Object.keys(o.geometry.morphAttributes || {}).length) return;
              const g = new BufferGeometry();
              Object.entries(o.geometry.attributes).forEach(([n, a]) => g.setAttribute(n, a));
              if (o.geometry.index) g.setIndex(o.geometry.index);
              o.geometry.groups.forEach((gr) => g.addGroup(gr.start, gr.count, gr.materialIndex));
              o.geometry = g;
              o.morphTargetInfluences = undefined; o.morphTargetDictionary = undefined;
            });
            t.ships.setModel(model.url, ship); onAssets();
          })
            .catch((e) => { console.warn('ship model failed, the fleet keeps its banner:', e.message); });
        }
        return;
      }
      const at = toScreenLatLng(markerLatLng(m));
      if (!at) return;
      const lead = m.own ? state.units[m.units?.[0]] : null;
      const step = lead?.route?.[0];
      const stepLL = step != null && step >= 0 ? getTiles().latLonOf(step) : null;
      const next = stepLL ? project(stepLL.lat, stepLL.lon) : null;
      const heading = next ? Math.atan2(next.x - at.x, next.y - at.y) : 0.5 + mi * 0.7;
      const px = s * SHIP_SCALE;
      const n = shipsFor(m.units?.length || 1);
      const teamColor = m.own ? PLAYER_COLOR : (getNationColor(m.ownerId) || '#64748b');
      for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * px * 2.2; const oy = (i % 2) * px * 1.2;
        tmp.position.set(at.x + ox, -(at.y + oy), (at.y + oy) * 0.05 + 40);
        tmp.rotation.set(TILT, heading, 0, 'XYZ');
        tmp.scale.setScalar(px);
        tmp.updateMatrix();
        t.ships.add(model.url, tmp.matrix, teamColor);
      }
    });
    t.ships.end();
  };

  return {
    layout,
    moving: () => t.moving,
    state: t,
    dispose: () => {
      t.trees.forEach((m) => m.dispose()); t.works.forEach((m) => m.dispose());
      t.ridges.forEach((m) => m.dispose()); t.hills.dispose(); t.plots.dispose(); t.plots.geometry.dispose(); plotMaterial.dispose(); plotMap?.dispose();
      t.towns.forEach((m) => root.remove(m)); t.wonders.forEach((m) => root.remove(m)); t.fieldWorks.forEach((g) => root.remove(g));
      t.layers.forEach(dropLayer);
      t.buildings.dispose();
      t.improvements.dispose();
      t.ships.dispose();
      townMaterial.dispose(); soldierMaterial.dispose();
      scene.remove(sky, sun);
    }
  };
};
