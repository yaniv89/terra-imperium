// src/data/geo/riverCodec.js
// The binary of the map's river lines (public/map/rivers.bin.gz, built by
// scripts/geo/build-river-lines.mjs from Natural Earth's rivers_lake_centerlines_scale_rank).
// Pure: no fetch, no DOM, no Node. Little endian.
//
//   "RVL1"  magic
//   u32     reach count
//   u32     coordinate quanta per degree (Q)
//   then per reach, as unsigned LEB128 varints (zz = zigzag for signed numbers):
//     rank (Natural Earth scalerank, 0 largest), w0, w1 (the river's weight at the first and the
//     last point, Natural Earth's strokeweig x 100: the width grows along the reach from w0 to
//     w1), n (points), lon0 zz, lat0 zz (quanta), then n - 1 deltas (dlon zz, dlat zz),
//     then ceil(n / 4) bytes of levels, 2 bits a point, first point in the low bits.
// A point's level is the coarsest detail band it is kept in (Douglas-Peucker, RIVER_BAND_TOL_KM):
// 0 the world view, 3 only the closest. The two end points are level 0.

export const RIVER_MAGIC = 'RVL1';
// Douglas-Peucker tolerance (km) of each detail band; points under the last one are dropped.
export const RIVER_BAND_TOL_KM = Object.freeze([3, 1, 0.45, 0.28]);

const zz = (v) => (v < 0 ? -2 * v - 1 : 2 * v);
const unzz = (u) => (u & 1 ? -(u + 1) / 2 : u / 2);

/** Bytes of the river file from reaches { rank, w0, w1, pts: [[lonQ, latQ]...] (integers), levels: [0..3] }. */
export const encodeRivers = (reaches, Q) => {
  const out = [];
  const varint = (v) => {
    let u = v;
    while (u >= 128) { out.push((u & 127) | 128); u = Math.floor(u / 128); }
    out.push(u);
  };
  [...RIVER_MAGIC].forEach((c) => out.push(c.charCodeAt(0)));
  const u32 = (v) => { out.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); };
  u32(reaches.length); u32(Q);
  reaches.forEach((r) => {
    varint(r.rank); varint(r.w0); varint(r.w1); varint(r.pts.length);
    let px = 0; let py = 0;
    r.pts.forEach(([x, y]) => { varint(zz(x - px)); varint(zz(y - py)); px = x; py = y; });
    for (let i = 0; i < r.pts.length; i += 4) {
      let b = 0;
      for (let j = 0; j < 4 && i + j < r.pts.length; j++) b |= (r.levels[i + j] & 3) << (2 * j);
      out.push(b);
    }
  });
  return Uint8Array.from(out);
};

/**
 * The reaches of a river file: [{ rank, w0, w1, lon: Float64Array, lat: Float64Array, level:
 * Uint8Array, minLon, maxLon, minLat, maxLat }] (degrees; lon is continuous along a reach, so it
 * may run a little past +-180). Throws on a file that is not one.
 */
export const decodeRivers = (bytes) => {
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== RIVER_MAGIC) throw new Error('not a river file');
  const u32 = (o) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) + bytes[o + 3] * 16777216;
  const count = u32(4); const Q = u32(8);
  let o = 12;
  const varint = () => {
    let v = 0; let mul = 1; let b;
    do { b = bytes[o++]; v += (b & 127) * mul; mul *= 128; } while (b & 128);
    return v;
  };
  const reaches = [];
  for (let r = 0; r < count; r++) {
    const rank = varint(); const w0 = varint() / 100; const w1 = varint() / 100; const n = varint();
    const lon = new Float64Array(n); const lat = new Float64Array(n); const level = new Uint8Array(n);
    let x = 0; let y = 0;
    let minLon = Infinity; let maxLon = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
    for (let i = 0; i < n; i++) {
      x += unzz(varint()); y += unzz(varint());
      const lo = x / Q; const la = y / Q;
      lon[i] = lo; lat[i] = la;
      if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo; if (la < minLat) minLat = la; if (la > maxLat) maxLat = la;
    }
    for (let i = 0; i < n; i += 4) {
      const b = bytes[o++];
      for (let j = 0; j < 4 && i + j < n; j++) level[i + j] = (b >> (2 * j)) & 3;
    }
    reaches.push({ rank, w0, w1, lon, lat, level, minLon, maxLon, minLat, maxLat });
  }
  return reaches;
};
