// src/data/geo/cityFeatures.js
// The map's geometry from game state (plans/civ-map-rework.md, B4, B4b and workstream 3.4): one
// territory per city from `state.world.tileOwner`, clipped to the real coastline so no hex edge
// ever shows along a coast; one territory per nation (the union of its cities) whose outline is
// the nation border; the hex mesh; and "which city is at this lat/lon". Everything is derived and
// cached by the identity of the objects it comes from (the tileOwner map, the land features),
// so a render that changes nothing rebuilds nothing. Both map views (the globe texture and the
// flat SVG map) read the same features, so a border is the same line on both.
//
// Clipping is done once here with polygon-clipping, not with an SVG clipPath on every paint: a
// clip path made of every coastline on Earth made each repaint of the flat map (and of the
// minimap) pathologically slow.
import polygonClipping from 'polygon-clipping';
import { getTiles, onWorldChange } from './tiles';
import { buildTerritories, buildHexMesh, cellFeature } from './tileGeometry';
import { tilesInWindow } from './tileSpatialIndex';

const territoryCache = new WeakMap(); // tileOwner -> Map(landKey -> [feature])
const nationCache = new WeakMap();    // tileOwner -> Map(landKey|ownersKey -> [feature])
const landBoxes = new WeakMap();      // land features -> [{ box, polygons }]
let hexMesh = null;
onWorldChange(() => { hexMesh = null; });

// polygon-clipping returns GeoJSON winding (exterior anticlockwise); d3-geo reads an
// anticlockwise exterior as "the whole sphere but this shape", so every ring is reversed.
const toD3Winding = (multi) => multi.map((poly) => poly.map((ring) => ring.slice().reverse()));

const bboxOfRings = (rings) => {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  rings.forEach((ring) => ring.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }));
  return [x0, y0, x1, y1];
};
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// Every land polygon with its bounding box, computed once per land feature list.
const landIndex = (land) => {
  let idx = landBoxes.get(land);
  if (idx) return idx;
  idx = [];
  land.forEach((f) => {
    const g = f.geometry;
    if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach((poly) => idx.push({ box: bboxOfRings(poly), poly }));
  });
  landBoxes.set(land, idx);
  return idx;
};

// How many territory polygons fell back to their raw hex shape because clipping failed (tests).
export const clipStats = { fallbacks: 0 };

// A territory's polygons cut to the coastline. A territory across the antimeridian (its unwrapped
// longitudes run past 180) is left as it is: the land polygons are split there.
const clipToLand = (multi, land) => {
  const idx = landIndex(land);
  const out = [];
  multi.forEach((poly) => {
    const box = bboxOfRings(poly);
    if (box[0] < -180 || box[2] > 180) { out.push(poly); return; }
    const near = idx.filter((l) => overlaps(l.box, box)).map((l) => l.poly);
    // No coastline here at all: an island too small for the land data keeps its hex shape.
    if (!near.length) { out.push(poly); return; }
    // Hex corners carry float noise that trips the clipper (Moscow's ring against a plain inland
    // square): snap to a millionth of a degree (about 10 cm) and drop repeated points first.
    const clean = poly.map((ring) => ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6])
      .filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]));
    let cut;
    try {
      cut = polygonClipping.intersection([clean], near);
    } catch {
      // The land comes in 10 degree pieces (hexCoast.js) and the clipper can trip where a
      // territory meets two pieces along their shared edge: cut against each piece on its own.
      cut = [];
      for (const piece of near) {
        try { cut.push(...polygonClipping.intersection([clean], [piece])); } catch (e) {
          if (!clipToLand.warned) { clipToLand.warned = true; console.warn('Territory clipping failed, drawing hex shapes', e); }
          cut = null;
          break;
        }
      }
    }
    if (cut && cut.length) toD3Winding(cut).forEach((p) => out.push(p));
    else { if (!cut) clipStats.fallbacks += 1; out.push(poly); }
  });
  return out;
};

/** One GeoJSON Feature per city, `properties.gameRegionId` = the city id, geometry MultiPolygon.
 * With `land` (the country features) the territories are cut to the coastline. */
export const getCityFeatures = (state, land = null) => {
  const tileOwner = state?.world?.tileOwner;
  if (!tileOwner) return [];
  let perLand = territoryCache.get(tileOwner);
  if (!perLand) { perLand = new Map(); territoryCache.set(tileOwner, perLand); }
  const key = land || 'raw';
  let features = perLand.get(key);
  if (!features) {
    const tiles = getTiles();
    features = buildTerritories(tiles, (i) => tileOwner[i] || null).map((f) => {
      const coordinates = land ? clipToLand(f.geometry.coordinates, land) : f.geometry.coordinates;
      return { ...f, properties: { ...f.properties, gameRegionId: f.id }, geometry: { type: 'MultiPolygon', coordinates } };
    }).filter((f) => f.geometry.coordinates.length > 0);
    perLand.set(key, features);
  }
  return features;
};

const ownersKey = (regions) => Object.keys(regions).sort().map((id) => `${id}:${regions[id].owner}`).join(',');

/** One Feature per nation: the union of its cities' (clipped) territories. Its outline is the
 * nation border; its id is the nation id. */
export const getNationTerritories = (state, land = null) => {
  const tileOwner = state?.world?.tileOwner;
  if (!tileOwner) return [];
  let perKey = nationCache.get(tileOwner);
  if (!perKey) { perKey = new Map(); nationCache.set(tileOwner, perKey); }
  const key = `${land ? 'clipped' : 'raw'}|${ownersKey(state.regions)}`;
  let features = perKey.get(key);
  if (!features) {
    const byNation = new Map();
    getCityFeatures(state, land).forEach((f) => {
      const owner = state.regions[f.properties.gameRegionId]?.owner;
      if (!owner) return;
      (byNation.get(owner) || byNation.set(owner, []).get(owner)).push(f.geometry.coordinates);
    });
    features = [];
    byNation.forEach((multis, owner) => {
      let coordinates;
      try { coordinates = multis.length === 1 ? multis[0] : toD3Winding(polygonClipping.union(...multis)); } catch { coordinates = multis.flat(); }
      features.push({ type: 'Feature', id: owner, properties: { owner }, geometry: { type: 'MultiPolygon', coordinates } });
    });
    perKey.set(key, features);
  }
  return features;
};

/** The faint hex grid over land, built once. */
export const getHexMesh = () => {
  if (!hexMesh) hexMesh = buildHexMesh(getTiles());
  return hexMesh;
};

/** The hex grid over the land cells inside a lat/lon window only (the flat map draws the mesh
 * for what is on screen: the whole world's mesh is one 50,000-segment path, too heavy to paint
 * at every pan). `west` may exceed `east` across the antimeridian. */
/** The land tile ids inside a lat/lon window (`west` may exceed `east` across the antimeridian). */
// Both read the spatial index (tileSpatialIndex.js): only the cells in the window are visited,
// not all 100,002 tiles on every pan step.
export const landTilesWithin = (area) => tilesInWindow(area);

export const getHexMeshWithin = (area, keep = null) => buildHexMesh(getTiles(), { landOnly: true, only: keep ? tilesInWindow(area).filter(keep) : tilesInWindow(area) });

/** A single tile as a feature (highlights). */
export const getTileFeature = (tile) => cellFeature(getTiles(), tile);

/** The tile under a point, and the city whose land it is (null on free land or at sea). */
export const tileAtLatLon = (lat, lon) => getTiles().nearest(lat, lon);
export const cityAtLatLon = (state, lat, lon) => {
  const tile = tileAtLatLon(lat, lon);
  if (tile == null || tile < 0) return null;
  return state?.world?.tileOwner?.[tile] || null;
};

/** The lat/lon of a city's centre tile. */
export const cityLatLon = (state, cityId) => {
  const city = state?.regions?.[cityId];
  if (!city || city.tile == null) return null;
  const { lat, lon } = getTiles().latLonOf(city.tile);
  return { lat, lng: lon };
};
