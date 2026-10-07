// src/components/map/closeView/shipModels.js
// Artist warship models for fleets in the close view (art spec ships, plans/art/ships/warship-<age>).
// Files: src/assets/map/ships/warship-<age>.glb, one root object named after the file with LOD0..
// LOD2 children (materials Town and Team; the sea is the map's own, no water plane). A fleet shows
// the model of the latest age at or below its owner's age that has a file (a gunpowder fleet keeps
// the kingdoms warship until a later file arrives); with none (no file yet) only its banner stands.
// Pure (no three.js); unit tested. Drawn instanced by buildingLayer.js from closeViewScene.js.
import { AGE_ORDER, getAgeIndex } from '../../../data/ages';

/** Split a file name (no folder, no extension) into { kind, age }, or null. */
export const parseShipFile = (name) => {
  const m = /^([a-z_]+)-([a-z]+)$/.exec(name || '');
  if (!m || !AGE_ORDER.includes(m[2])) return null;
  return { kind: m[1], age: m[2] };
};

/** Index files by kind: { warship: [{ age, ageIndex, url, name }] }. `files` maps a path to its
 * url, as import.meta.glob gives it. */
export const indexShipFiles = (files) => {
  const out = {};
  Object.entries(files).forEach(([path, url]) => {
    const name = path.match(/([^/]+)\.glb$/)?.[1];
    const p = parseShipFile(name);
    if (p) (out[p.kind] ||= []).push({ ...p, ageIndex: getAgeIndex(p.age), url, name });
  });
  return out;
};
const FILES = import.meta.glob('../../../assets/map/ships/*.glb', { query: '?url', import: 'default', eager: true });
const BY_KIND = indexShipFiles(FILES);

/** The ship file for a fleet whose owner is in this age: { url, name, age } or null. */
export const shipModel = (ageId, kind = 'warship', index = BY_KIND) => {
  const files = index[kind];
  if (!files?.length) return null;
  const now = getAgeIndex(ageId) >= 0 ? getAgeIndex(ageId) : 0;
  return files.filter((f) => f.ageIndex <= now).sort((a, b) => b.ageIndex - a.ageIndex)[0] || null;
};

// A warship is 24 to 37 m long (2.4 to 3.7 model units); drawn at SHIP_SCALE of the soldiers'
// pixels per unit, so a fleet reads beside an army without covering the coast.
export const SHIP_SCALE = 0.55;
/** How many ships a fleet shows: one, two from 5 units, three from 12. */
export const shipsFor = (count) => (count >= 12 ? 3 : count >= 5 ? 2 : 1);
