// src/components/battle/minimapModel.js
// The battle minimap's geometry (I196). The battlefield camera looks down the diagonal (render/
// BattleRenderer.js: screen right is ground +x -z, screen down is +x +z), so the minimap is the map
// turned the same way, a flattened diamond: up on the minimap is up on the screen. Pure.
const R2 = Math.SQRT2;

/**
 * The minimap for a `mapW` x `mapH` tile field fitted in `maxW` x `maxH` css px.
 * Returns { width, height, toMini(x, z) -> { x, y } px, toWorld(px, py) -> { x, z } tiles (clamped
 * to the field), transform: [a, b, c, d, e, f] for a canvas drawing tile (x, z) at (x, z) }.
 */
export const minimapFrame = (mapW, mapH, maxW, maxH, squash = 0.62) => {
  const uMin = -mapH / R2; const uMax = mapW / R2;
  const vMax = ((mapW + mapH) / R2) * squash;
  const scale = Math.min(maxW / (uMax - uMin), maxH / vMax);
  const width = Math.ceil((uMax - uMin) * scale); const height = Math.ceil(vMax * scale);
  const toMini = (x, z) => ({ x: ((x - z) / R2 - uMin) * scale, y: ((x + z) / R2) * squash * scale });
  const toWorld = (px, py) => {
    const a = px / scale + uMin; const b = py / (scale * squash);
    const x = (a + b) / R2; const z = (b - a) / R2;
    return { x: Math.max(0, Math.min(mapW, x)), z: Math.max(0, Math.min(mapH, z)) };
  };
  const k = scale / R2;
  return { width, height, scale, toMini, toWorld, transform: [k, k * squash, -k, k * squash, -uMin * scale, 0] };
};

// Ground colours by tile (battle/setup/mapgen.js TILE: open, forest, water, rock, road, sand, ford,
// building, rubble, gate), as RGB.
export const TILE_RGB = [[96, 128, 62], [44, 82, 44], [52, 92, 140], [120, 116, 108], [150, 132, 96], [176, 160, 112], [80, 120, 150], [150, 142, 128], [110, 100, 90], [150, 120, 80]];
