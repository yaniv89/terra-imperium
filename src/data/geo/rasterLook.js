// src/data/geo/rasterLook.js
// The realistic look's palette (plans/MAP-VARIATIONS-PLAN.md 3.4), shared by the Earth raster build
// (scripts/geo/build-world-raster.mjs imports it back) and the generated worlds' painter
// (src/worldgen/painter.js), so both paint with the same colours.

// Climate colours (sRGB, low elevation), by Köppen class.
export const CLIMATE_COLOR = {
  Af: [36, 88, 40], Am: [44, 96, 44], Aw: [108, 128, 56], As: [118, 132, 62],
  BWh: [218, 190, 134], BWk: [200, 182, 142], BSh: [176, 162, 98], BSk: [162, 152, 104],
  Cfa: [84, 130, 60], Cwa: [92, 132, 60], Cfb: [78, 124, 66], Cfc: [92, 122, 86], Cwb: [86, 126, 70], Cwc: [96, 120, 86],
  Csa: [142, 146, 82], Csb: [126, 138, 80], Csc: [120, 130, 90],
  Dfa: [96, 126, 70], Dwa: [100, 124, 72], Dsa: [120, 128, 80], Dfb: [84, 116, 70], Dwb: [88, 114, 72], Dsb: [110, 120, 82],
  Dfc: [78, 100, 74], Dwc: [82, 100, 76], Dsc: [100, 108, 84], Dfd: [100, 106, 88], Dwd: [104, 108, 90],
  ET: [142, 136, 116], EF: [236, 239, 242]
};
export const DEFAULT_LAND = [120, 130, 90];
