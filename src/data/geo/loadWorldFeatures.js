// src/data/geo/loadWorldFeatures.js
// Turns the committed country-tier TopoJSON (see scripts/geo/build.mjs) into plain GeoJSON
// features on demand. Dynamic imports keep the ~280KB topology and its metadata out of the main
// bundle — only the globe view (Phase 12), which nobody has to open, pays for them.
import { feature } from 'topojson-client';

let cachedCountryFeatures = null;
let cachedSubregionFeatures = null;
let cachedSubregionTopology = null;

// The province topology itself (shared arcs), for drawing borders as one mesh (Map2DView's
// nation borders) instead of one outline per province.
export const loadSubregionTopology = async () => {
  if (cachedSubregionTopology) return cachedSubregionTopology;
  const { default: topology } = await import('./subregions.topo.json');
  cachedSubregionTopology = topology;
  return topology;
};

// The land the map draws: the coast along hex edges, softened (hexCoast.js, built into
// hexLand.json by scripts/geo/build-hex-coast.mjs), so every hex is all land or all water. The flat
// map and the globe clip territories to it and the close view masks its art with it.
// A generated world brings its own coast (src/worldgen/worldLoader.js builds it with buildHexLand
// and hands it over here before the app loads), so Earth's hexLand.json is never fetched for it.
let cachedLandFeatures = null;
export const setLandFeatures = (features) => { cachedLandFeatures = features; };
export const loadLandFeatures = async () => {
  if (cachedLandFeatures) return cachedLandFeatures;
  const { default: collection } = await import('./hexLand.json');
  cachedLandFeatures = collection.features;
  return cachedLandFeatures;
};

export const loadCountryFeatures = async () => {
  if (cachedCountryFeatures) return cachedCountryFeatures;

  const [{ default: topology }, { default: meta }] = await Promise.all([
    import('./countries.topo.json'),
    import('./countries-meta.json')
  ]);

  const objectKey = Object.keys(topology.objects)[0];
  const collection = feature(topology, topology.objects[objectKey]);
  collection.features.forEach((f) => {
    f.properties = { ...f.properties, ...meta[f.id] };
  });

  cachedCountryFeatures = collection.features;
  return cachedCountryFeatures;
};

export const loadSubregionFeatures = async () => {
  if (cachedSubregionFeatures) return cachedSubregionFeatures;

  const [{ default: topology }, { default: meta }] = await Promise.all([
    import('./subregions.topo.json'),
    import('./subregions-meta.json')
  ]);

  const objectKey = Object.keys(topology.objects)[0];
  const collection = feature(topology, topology.objects[objectKey]);
  collection.features.forEach((f) => {
    f.properties = { ...f.properties, ...meta[f.id] };
  });

  cachedSubregionFeatures = collection.features;
  return cachedSubregionFeatures;
};
