// scripts/geo/river-paint.mjs
// Rivers painted into the Earth raster as real lines (plans/game/map-rivers-trial/README.md).
// Shared by build-world-raster.mjs, build-raster-pyramid.mjs and build-raster-detail.mjs, so the
// three levels draw the same rivers.
//
// OFF since the map draws its rivers as vector lines (plans/game/map-river-lines/README.md:
// scripts/geo/build-river-lines.mjs, src/components/map/gl/riverLayer.js): PAINT_RIVERS false
// makes riverSvg empty, so the rasters carry no rivers and the map never shows two. The loader
// stays for check-river-match.mjs and a trial that wants the painted look back.
//
// Source: Natural Earth 1:10M "rivers_lake_centerlines_scale_rank" (public domain). Every river is
// cut into reaches and each reach carries `strokeweig`, a width that grows downstream (the Nile
// goes 0.2 near its source to 2.0 at the delta), plus a `scalerank` (0 largest). The gameplay
// river edges (build-tile-terrain.mjs) come from the same family of Natural Earth lines, so a
// river drawn here and a river edge a player crosses follow the same course. Nothing here
// touches tiles.json or the river rules.
//
// Looks: each reach is smoothed (Chaikin corner cutting, so no polyline kinks), widened by its
// strokeweig in km (so the ground width is the same at every level and the pixel width follows
// the level's scale), drawn as a darker bank line under a lighter water core. The callers clip
// the result to the land mask, so rivers stay on land and stop at the hex coast.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const RIVER_FILE = 'ne_10m_rivers_lake_centerlines_scale_rank.geojson';
export const PAINT_RIVERS = false;

// Ground width in km from the reach weight: a trickle is about 2 km, the Nile at the sea 10 km.
// (Wider than real so a river reads at map scale; a hex is 77 km across.)
export const riverWidthKm = (strokeweig) => 1.6 + 4.2 * strokeweig;

// Which ranks are drawn at a level (higher level = closer = more small rivers).
export const RIVER_MAX_RANK = { world: 7, 5: 9, 6: 10 };

const chaikin = (pts, passes) => {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    if (p.length < 3) return p;
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, ay] = p[i]; const [bx, by] = p[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
};

/** [{ line: [[lon, lat]...], sw, rank, minX, minY, maxX, maxY }] from the Natural Earth file. */
export const loadRiverLines = (rawDir, { maxRank = 10 } = {}) => {
  const fc = JSON.parse(readFileSync(path.join(rawDir, 'ne', RIVER_FILE), 'utf8'));
  const out = [];
  fc.features.forEach((f) => {
    const rank = f.properties.scalerank ?? 12;
    if (rank > maxRank || /lake/i.test(f.properties.featurecla || '')) return;
    const sw = Number(f.properties.strokeweig) || 0.2;
    const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    lines.forEach((raw) => {
      if (raw.length < 2) return;
      const line = chaikin(raw.map(([x, y]) => [x, y]), 2);
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      line.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
      out.push({ line, sw, rank, minX, minY, maxX, maxY });
    });
  });
  // Small reaches first, so the wide trunk is drawn on top where they meet.
  return out.sort((a, b) => a.sw - b.sw);
};

/**
 * SVG for the rivers in a pixel space of W x H (the whole equirectangular level). `kmPx` is the
 * ground size of one pixel; `minPx` keeps the thinnest reaches visible at far zoom. `keep` is an
 * optional filter on a line (a bounding box test for tiles).
 */
export const riverSvg = (lines, { W, H, kmPx, minPx = 0.7, keep = () => true }) => {
  if (!PAINT_RIVERS) return '';
  const bank = []; const water = [];
  lines.forEach((l) => {
    if (!keep(l)) return;
    const d = l.line.map(([lon, lat], i) => `${i ? 'L' : 'M'}${(((lon + 180) / 360) * W).toFixed(1)} ${(((90 - lat) / 180) * H).toFixed(1)}`).join('');
    const w = Math.max(minPx, riverWidthKm(l.sw) / kmPx);
    const casing = (w + Math.max(0.9, w * 0.35)).toFixed(2);
    const style = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
    bank.push(`<path d="${d}" stroke="rgb(58,108,168)" stroke-opacity="0.6" stroke-width="${casing}" ${style}/>`);
    water.push(`<path d="${d}" stroke="rgb(112,172,228)" stroke-opacity="0.92" stroke-width="${w.toFixed(2)}" ${style}/>`);
  });
  return bank.join('') + water.join('');
};
