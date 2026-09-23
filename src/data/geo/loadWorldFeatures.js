// src/data/geo/loadWorldFeatures.js
// Turns the committed country-tier TopoJSON (see scripts/geo/build.mjs) into plain GeoJSON
// features on demand. Dynamic imports keep the ~280KB topology and its metadata out of the main
// bundle — only the globe view (Phase 12), which nobody has to open, pays for them.
import { feature } from 'topojson-client';

let cachedCountryFeatures = null;
let cachedSubregionFeatures = null;
let cachedSubregionTopology = null;

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

  cachedSubregionTopology = { topology, object: topology.objects[objectKey] };
  cachedSubregionFeatures = collection.features;
  return cachedSubregionFeatures;
};

// The raw topology (not just the GeoJSON features derived from it) is what topojson-client's
// mesh() needs to extract national-border lines — the shared arcs between two neighboring
// provinces, filterable by whether their current owners differ. Always load subregion features
// first (loadGameRegions.js does this on mount); this just hands back the topology that call
// already cached, with no separate fetch.
export const loadSubregionTopology = async () => {
  if (!cachedSubregionTopology) await loadSubregionFeatures();
  return cachedSubregionTopology;
};
