// src/components/map/closeView/terrainKits.js
// Map terrain kits (plans/ART-MODELS-PLAN.md 8.4, S11): src/assets/map/terrain/<id>.glb, model
// units like the towns (1 unit = 10 m, Z up in Blender, the glTF front +Z, origin on the ground).
//   mountain-ridges.glb  ridge-1, ridge-2, ridge-3: a ridge segment 2 units long along model x with
//                        its crest along x, about 1.1 wide and 1.15 high (mountainModels.js's
//                        shape and size); ridge-1-snow .. ridge-3-snow the snowy variants (else
//                        the plain ones). Swapped into the close view's instanced ridges.
//   hills.glb            hill (or hill-1): a foothill about 2 units across. Swapped in the same way.
//   cliffs, dunes, coasts, lakes, wetlands, field-edges: loaded by mapTerrainKit() for the
//                        placement code to come (terrainPlacement.js places ridges and hills only).
// The placement (terrainPlacement.js) is untouched: every instance keeps its place, turn and size,
// and takes the kit object's geometry and materials (LOD1: the map shows hundreds at once).
// Without a file the code ridges and hills stay.
import { ART } from '../../../battle/art/artFiles';
import { loadKit, kitObject } from '../../../battle/art/kitLoader';
import { RIDGE_VARIANTS } from './mountainModels';

/** The loaded kit for a map terrain id, or null (no file, or it failed). */
export const mapTerrainKit = (id, { art = ART, load = loadKit } = {}) => {
  const ref = art.mapTerrain(id);
  return ref ? load(ref.url).catch((e) => { console.warn(`[art] ${e.message}: keeping the code terrain`); return null; }) : Promise.resolve(null);
};

const swap = (mesh, obj, lod) => {
  const b = obj.lods[lod] || obj.lods[0];
  mesh.geometry = b.geometry;
  mesh.material = b.materials.length === 1 ? b.materials[0] : b.materials;
};

/**
 * Dress the close view's instanced ridges (`ridges`: Map `${variant}|${snow}` -> InstancedMesh)
 * and hills (an InstancedMesh) from the kits, calling `onReady` when something changed.
 * Resolves to the number of meshes swapped.
 */
export const dressCloseTerrain = ({ ridges, hills }, onReady = () => {}, { art = ART, load = loadKit, lod = 1 } = {}) => Promise.all([
  mapTerrainKit('mountain-ridges', { art, load }), mapTerrainKit('hills', { art, load })
]).then(([ridgeKit, hillKit]) => {
  let n = 0;
  if (ridgeKit) {
    for (let v = 0; v < RIDGE_VARIANTS; v++) {
      [false, true].forEach((snow) => {
        const plain = [`ridge-${v + 1}`, 'ridge-1'];
        const obj = kitObject(ridgeKit, snow ? [`ridge-${v + 1}-snow`, ...plain] : plain);
        const mesh = ridges.get(`${v}|${snow}`);
        if (obj && mesh) { swap(mesh, obj, lod); n += 1; }
      });
    }
  }
  const hill = kitObject(hillKit, 'hill', 'hill-1');
  if (hill && hills) { swap(hills, hill, lod); n += 1; }
  if (n) onReady();
  return n;
});
