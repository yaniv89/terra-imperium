// src/battle/render/deployZone.js
// The deployment zone outline (plans/civ-map-rework.md E7): the player's zone (sim/world.js
// deployZone) drawn as a dashed line of small ground decals along its edge, so the zone reads
// on the uneven terrain without a flat quad clipping through hills. Pure: the renderer places
// the dots; this lists them.
export const ZONE_DOT_STEP = 0.5; // tiles between dots

/** The dots along the zone's edge, in tile units: [{ x, z }]. The zone is inclusive tile bounds. */
export const zonePerimeter = (zone, step = ZONE_DOT_STEP) => {
  if (!zone) return [];
  const x0 = zone.x0; const x1 = zone.x1 + 1; const z0 = zone.y0; const z1 = zone.y1 + 1;
  const out = [];
  for (let x = x0; x <= x1; x += step) { out.push({ x, z: z0 }); out.push({ x, z: z1 }); }
  for (let z = z0 + step; z < z1; z += step) { out.push({ x: x0, z }); out.push({ x: x1, z }); }
  return out;
};
