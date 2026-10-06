// src/components/map/closeView/occupancy.js
// Nothing stands on anything else in the close view: every frame, towns, then the works on
// improved tiles, then the fields round towns claim discs of ground in that order, and whatever
// would overlap a disc already claimed is left out; trees only grow on unclaimed ground.
// Discs are on the ground plane in screen pixels: the models lean toward the viewer, so a screen
// y is divided by the lean (sin of the tilt) to get back to the ground. Pure; unit tested.
// The discs sit in a grid of CELL px buckets (phase F claims the river bands too: hundreds of
// small discs), so a test looks at the few buckets round it, not at every disc.
const CELL = 48;

export const createOccupancy = (lean = 1) => {
  const cells = new Map(); // "cx,cy" -> [disc]
  let count = 0;
  const toGround = (x, y) => [x, y / (lean || 1)];
  const range = (v, r) => [Math.floor((v - r) / CELL), Math.floor((v + r) / CELL)];
  const overlaps = (gx, gy, r) => {
    const [x0, x1] = range(gx, r + CELL); const [y0, y1] = range(gy, r + CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = cells.get(`${cx},${cy}`);
        if (list && list.some((d) => (d.x - gx) ** 2 + (d.y - gy) ** 2 < (d.r + r) ** 2)) return true;
      }
    }
    return false;
  };
  // a disc is filed under the bucket of its centre; a search reaches one bucket past its radius,
  // and discs larger than a bucket are filed in every bucket they touch
  const add = (gx, gy, r) => {
    const d = { x: gx, y: gy, r };
    const [x0, x1] = r > CELL ? range(gx, r) : [Math.floor(gx / CELL), Math.floor(gx / CELL)];
    const [y0, y1] = r > CELL ? range(gy, r) : [Math.floor(gy / CELL), Math.floor(gy / CELL)];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = `${cx},${cy}`;
        const list = cells.get(key);
        if (list) list.push(d); else cells.set(key, [d]);
      }
    }
    count += 1;
  };
  return {
    /** Is a disc of radius r (ground pixels) at screen point (x, y) free? */
    free: (x, y, r) => { const [gx, gy] = toGround(x, y); return !overlaps(gx, gy, r); },
    /** Claim a disc whatever is there (towns: they are the cities themselves). */
    claim: (x, y, r) => { const [gx, gy] = toGround(x, y); add(gx, gy, r); },
    /** Claim a disc only when it is free; true when claimed. */
    take: (x, y, r) => {
      const [gx, gy] = toGround(x, y);
      if (overlaps(gx, gy, r)) return false;
      add(gx, gy, r);
      return true;
    },
    size: () => count
  };
};
