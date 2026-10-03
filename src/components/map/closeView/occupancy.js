// src/components/map/closeView/occupancy.js
// Nothing stands on anything else in the close view: every frame, towns, then the works on
// improved tiles, then the fields round towns claim discs of ground in that order, and whatever
// would overlap a disc already claimed is left out; trees only grow on unclaimed ground.
// Discs are on the ground plane in screen pixels: the models lean toward the viewer, so a screen
// y is divided by the lean (sin of the tilt) to get back to the ground. Pure; unit tested.

export const createOccupancy = (lean = 1) => {
  const discs = [];
  const toGround = (x, y) => [x, y / (lean || 1)];
  const overlaps = (gx, gy, r) => discs.some((d) => (d.x - gx) ** 2 + (d.y - gy) ** 2 < (d.r + r) ** 2);
  return {
    /** Is a disc of radius r (ground pixels) at screen point (x, y) free? */
    free: (x, y, r) => { const [gx, gy] = toGround(x, y); return !overlaps(gx, gy, r); },
    /** Claim a disc whatever is there (towns: they are the cities themselves). */
    claim: (x, y, r) => { const [gx, gy] = toGround(x, y); discs.push({ x: gx, y: gy, r }); },
    /** Claim a disc only when it is free; true when claimed. */
    take: (x, y, r) => {
      const [gx, gy] = toGround(x, y);
      if (overlaps(gx, gy, r)) return false;
      discs.push({ x: gx, y: gy, r });
      return true;
    },
    size: () => discs.length
  };
};
