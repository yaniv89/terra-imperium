// src/data/geo/loadWorldFeatures.js
// Turns the committed country-tier TopoJSON (see scripts/geo/build.mjs) into plain GeoJSON
// features on demand. Dynamic imports keep the ~280KB topology and its metadata out of the main
// bundle — only the globe view (Phase 12), which nobody has to open, pays for them.
import { feature } from 'topojson-client';

let cachedCountryFeatures = null;
let cachedSubregionFeatures = null;

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
