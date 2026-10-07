// src/data/geo/worldPictures.js
// The painted base picture of a generated world (src/worldgen/painter.js, phase MV4), handed over
// by the world loader before the app loads. While one is set the map draws it instead of the baked
// Earth pictures, and asks for no Earth pyramid tiles or detail tiles (rasterTiles.js, glLayers).
let picture = null; // { url, size }

export const setWorldPicture = (url, size = 2048) => { picture = url ? { url, size } : null; };
/** The painted picture of this page's world, or null on the real Earth. */
export const worldPicture = () => picture;
/** True when the world is painted procedurally (no baked Earth tiles may be drawn). */
export const proceduralRaster = () => !!picture;
