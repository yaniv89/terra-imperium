// src/components/map/closeView/outpostModels.js
// The outpost camp (playtest audit I055, art item MD02): the settlement stage before a city, drawn
// in the close view where an outpost (src/engine/settlers.js: a settler's new city still growing)
// or an ownerless colony stands, in place of the shared file's small `colony-camp`.
// Files: src/assets/map/outposts/outpost-<age>.glb (scripts/blender/build_map_outposts.py), one root
// object named after the file with LOD0..LOD2 children, materials Town, Team and Ground, the camp
// on its own round Ground patch inside the 50 m circle, an empty `smoke` over the fire pit. One file
// per age band: bronze (hide and linen tents, an ox cart), kingdoms (canvas tents, a covered
// wagon), modern (dome tents, a pickup truck); an age shows the latest file at or below it (a
// classical outpost the bronze camp, a gunpowder one the kingdoms camp).
// Pure (no three.js); unit tested. Drawn by closeViewScene.js like a town.
import { indexShipFiles, shipModel } from './shipModels';
import { isCamp } from './townAssets';

const FILES = import.meta.glob('../../../assets/map/outposts/*.glb', { query: '?url', import: 'default', eager: true });
const INDEX = indexShipFiles(FILES);

/** The outpost file for an owner in this age: { url, name, age } or null (the colony camp stays). */
export const outpostModel = (ageId, index = INDEX) => shipModel(ageId, 'outpost', index);

/** The camp a city shows instead of a town: the outpost file for an outpost or an ownerless colony,
 * else null (a town, or no file yet: the shared colony camp). */
export const outpostFor = (region, ageId, index = INDEX) => (isCamp(region) ? outpostModel(ageId, index) : null);

// The camp's ground patch reaches about 2 units (20 m) from its middle; it fills OUTPOST_HEX_SHARE
// of the room a town would fill on that hex (cityHex.js), so a new settlement reads as a camp a
// little smaller than the small town it grows into, never as a speck in an empty hex.
export const OUTPOST_RADIUS = 2.0;
export const OUTPOST_HEX_SHARE = 0.72;
/** The ground radius (model units) to fit to the hex so the camp fills OUTPOST_HEX_SHARE of it. */
export const outpostFitRadius = (radius = OUTPOST_RADIUS) => radius / OUTPOST_HEX_SHARE;
