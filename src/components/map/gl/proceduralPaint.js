// src/components/map/gl/proceduralPaint.js
// The GPU painter of generated worlds (plans/MAP-VARIATIONS-PLAN.md 5.1 to 5.3, phase MV4): the
// realistic look of the Earth raster build (scripts/geo/build-world-raster.mjs, and the CPU base
// picture of src/worldgen/painter.js) drawn by a fragment shader into 256-pixel tiles of the
// pyramid layout (rasterTiles.js: level z is 2^(z+1) x 2^z tiles), on demand, by the map's own
// WebGL context. The raster layer (glLayers.js createRasterLayer) draws them exactly like Earth's
// downloaded tiles, plain or through the close view's terrain shader, which also reads the land
// cover tiles this painter renders (the second mode).
//
// Per pixel (formulas of the position on the unit sphere, so tiles of every level agree and the
// world wraps without a seam):
//   the tile    the lookup texel's tile, then a short walk to the nearest centre (tileGpuData.js);
//   the blend   Gaussian weights of that tile and its six neighbours: land share, mean elevation,
//               climate colour, roughness, ice; the coast is where the land share crosses one half,
//               pushed a few kilometres either way by noise (a natural shore, never a hexagon);
//   the relief  fractal noise (ridged where the land is rough) under the hex scale, its amplitude
//               the tile's roughness, only octaves larger than two pixels; hillshade from the
//               elevation one pixel east and north, with the Earth build's light and exaggeration;
//   colours     the Earth build's: hypsometric tints, rock, the snow line 5400 - |lat| x 40 m,
//               bathymetry by depth, lakes, the 4% grain;
//   rivers      on the tile's six edges with a river bit, corner to corner, bent by a meander that
//               is a function of the edge (the same from both sides) and fades to nothing at the
//               corners, so reaches join; wider by size class, a darker bank, on land only.
// Visual only: floats, sin and exp are fine; nothing the rules read comes from here.
import { Mesh, PlaneGeometry, ShaderMaterial, Scene, OrthographicCamera, WebGLRenderTarget, DataTexture, RGBAFormat, RedFormat, FloatType, NearestFilter, LinearFilter, ClampToEdgeWrapping, GLSL3, Color } from 'three';
import { DATA_W, LOOKUP_W, LOOKUP_H, WALK_STEPS, tileGpuData } from './tileGpuData';
import { paintTileData } from '../../../worldgen/paintData';
import { RASTER_TILE } from '../../../data/geo/rasterTiles';

export const EARTH_R_KM = 6371;
// The Gaussian width of the blend (radians): a little under the hex spacing (painter.js).
export const BLEND_SIGMA = 0.0095;
// The land share has a wider blend: rounder shores, less of the hexagon.
export const LAND_SIGMA = 0.0115;
// River half widths by size class (km): a stream, a river, a great river (river-paint.mjs: a
// trickle is about 2 km wide, the Nile at the sea 10 km; wider than real so a river reads).
export const RIVER_HALF_KM = [0, 0.9, 1.6, 2.6];
// The meander's amplitude as a share of the edge's length.
export const MEANDER = 0.12;
// The river network's warp (km, the largest push): bends reaches off the hex edges.
export const RIVER_WARP_KM = 7;

export const PAINT_VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const PAINT_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uCentres;
uniform sampler2D uNeigh;
uniform sampler2D uLookup;
uniform sampler2D uPaint;
uniform vec4 uGeo;     // lon0, lat0 (the top edge), lon span, lat span (radians)
uniform float uKmPx;   // km a pixel north to south
uniform float uMode;   // 0 colour, 1 land cover class
uniform float uSeed;
in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265358979;
const float R_KM = ${EARTH_R_KM.toFixed(1)};
ivec2 at(int i) { return ivec2(i % ${DATA_W}, i / ${DATA_W}); }
vec4 centreOf(int i) { return texelFetch(uCentres, at(i), 0); }
vec4 paintA(int i) { return texelFetch(uPaint, at(i * 2), 0); }
vec4 paintB(int i) { return texelFetch(uPaint, at(i * 2 + 1), 0); }
void neighbours(int i, out int n[6]) {
  vec4 a = texelFetch(uNeigh, at(i * 2), 0);
  vec4 b = texelFetch(uNeigh, at(i * 2 + 1), 0);
  n[0] = int(floor(a.x + 0.5)); n[1] = int(floor(a.y + 0.5)); n[2] = int(floor(a.z + 0.5)); n[3] = int(floor(a.w + 0.5));
  n[4] = int(floor(b.x + 0.5)); n[5] = int(floor(b.y + 0.5));
}
vec3 unitOf(float lon, float lat) { float cl = cos(lat); return vec3(cl * cos(lon), cl * sin(lon), sin(lat)); }
int walk(int a, vec3 p, int steps) {
  int n[6];
  for (int it = 0; it < 8; it++) {
    if (it >= steps) break;
    neighbours(a, n);
    float best = dot(p, centreOf(a).xyz); int next = a;
    for (int k = 0; k < 6; k++) {
      if (n[k] < 0) continue;
      float d = dot(p, centreOf(n[k]).xyz);
      if (d > best) { best = d; next = n[k]; }
    }
    if (next == a) break;
    a = next;
  }
  return a;
}
int tileAt(float lon, float lat, vec3 p) {
  int ix = clamp(int((lon + PI) / (2.0 * PI) * ${LOOKUP_W}.0), 0, ${LOOKUP_W - 1});
  int iy = clamp(int((0.5 * PI - lat) / PI * ${LOOKUP_H}.0), 0, ${LOOKUP_H - 1});
  return walk(int(floor(texelFetch(uLookup, ivec2(ix, iy), 0).r + 0.5)), p, ${WALK_STEPS + 1});
}

// 3D value noise (seamless on the sphere), a seeded offset per world.
float hash3(vec3 q) { q = fract(q * 0.3183099 + 0.1); q *= 17.0; return fract(q.x * q.y * q.z * (q.x + q.y + q.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// noise with a wavelength of wl km at p (-0.5 to 0.5), in its own band of the noise space
float nkm(vec3 p, float wl, float band) { return vnoise(p * (R_KM / wl) + vec3(band * 17.31 + uSeed, band * 5.17, band * 11.9 - uSeed)) - 0.5; }

// The seven tiles of the blend (the pixel's tile and its neighbours) and what they carry.
int T[7]; vec4 TA[7]; vec4 TB[7]; vec3 TC[7];
void gather(int a) {
  int n[6]; neighbours(a, n);
  T[0] = a;
  for (int k = 0; k < 6; k++) T[k + 1] = n[k];
  for (int j = 0; j < 7; j++) {
    if (T[j] < 0) { TA[j] = vec4(0.0); TB[j] = vec4(0.0); TC[j] = vec3(0.0); continue; }
    TA[j] = paintA(T[j]); TB[j] = paintB(T[j]); TC[j] = centreOf(T[j]).xyz;
  }
}
float flag(vec4 b, float bit) { return mod(floor(b.x / bit), 2.0); }
// the blend at p: x land share, y mean elevation, z roughness, w ice; colour and lake share out
vec4 blendAt(vec3 p, out vec3 colour, out float lake) {
  float ws = 0.0; float wls = 0.0; float ls = 0.0; vec4 s = vec4(0.0); vec3 c = vec3(0.0); float lk = 0.0;
  for (int j = 0; j < 7; j++) {
    if (T[j] < 0) continue;
    float d = dot(p, TC[j]);
    float w = exp(-(2.0 * (1.0 - d)) / ${(BLEND_SIGMA * BLEND_SIGMA).toExponential(6)});
    float wl = exp(-(2.0 * (1.0 - d)) / ${(LAND_SIGMA * LAND_SIGMA).toExponential(6)});
    ws += w; wls += wl;
    s += w * vec4(0.0, TA[j].w, TB[j].y, flag(TB[j], 4.0));
    ls += wl * flag(TB[j], 1.0);
    c += w * TA[j].rgb;
    lk += wl * flag(TB[j], 2.0);
  }
  ws = max(ws, 1e-30); wls = max(wls, 1e-30);
  colour = c / ws; lake = lk / wls;
  return vec4(ls / wls, s.yzw / ws);
}
// relief under the hex scale (metres): octaves from 64 km down to two pixels, ridged where rough
float detail(vec3 p, float rough) {
  float ridge = smoothstep(120.0, 420.0, rough);
  float s = 0.0; float wl = 64.0; float amp = 1.0;
  for (int o = 0; o < 7; o++) {
    float fade = smoothstep(1.5, 3.0, wl / uKmPx);
    if (fade <= 0.0) break;
    float v = nkm(p, wl, float(o));
    float r = 0.25 - abs(v);            // ridged: sharp crests
    s += fade * amp * mix(v, r * 1.6, ridge);
    wl *= 0.5; amp *= 0.62;
  }
  return s * max(rough, 90.0) * 3.2;
}
float elevAt(vec3 p) {
  vec3 c; float lk;
  vec4 b = blendAt(p, c, lk);
  float landN = b.x;
  return b.y + detail(p, b.z) * (landN > 0.5 ? 1.0 : 0.15);
}
// the coast's wobble: the land share is pushed by noise of 40, 12 and 4 km
float shoreNoise(vec3 p) { return nkm(p, 110.0, 10.0) * 0.3 + nkm(p, 40.0, 11.0) * 0.36 + nkm(p, 12.0, 12.0) * 0.18 + nkm(p, 4.0, 13.0) * 0.07 * smoothstep(1.0, 3.0, 4.0 / uKmPx); }

// The distance (km) from p to the river on edge k of tile T[0] (its meander), and its size; big when none.
float riverDist(vec3 p, int k, int m, float bits, float sizes, out float size) {
  size = 0.0;
  if (mod(floor(bits / exp2(float(k))), 2.0) < 0.5) return 1e6;
  int kp = k == 0 ? m - 1 : k - 1; int kn = k == m - 1 ? 0 : k + 1;
  int a = T[0]; int b = T[k + 1]; int tp = T[kp + 1]; int tn = T[kn + 1];
  vec3 cp = normalize(TC[0] + TC[kp + 1] + TC[k + 1]);
  vec3 cn = normalize(TC[0] + TC[k + 1] + TC[kn + 1]);
  // the same orientation from both sides: from the corner of the smaller third tile
  vec3 c0 = tp < tn ? cp : cn; vec3 c1 = tp < tn ? cn : cp;
  float sz = mod(floor(sizes / exp2(float(2 * k))), 4.0);
  size = max(sz, 1.0);
  float lo = float(min(a, b)); float hi = float(max(a, b));
  float h = fract(sin(lo * 12.9898 + hi * 78.233) * 43758.5453);
  float h2 = fract(sin(lo * 39.346 + hi * 11.135) * 24634.6345);
  vec3 e = c1 - c0; float L = length(e);
  float t = dot(p - c0, e) / (L * L);
  vec3 nrm = normalize(cross(c0, c1));
  float side = dot(p, nrm);
  float amp = ${MEANDER.toFixed(3)} * L;
  // the bend: one or two loops plus a wobble, nothing at the corners
  float f = 1.0 + floor(h * 2.0);
  float tc = clamp(t, 0.0, 1.0);
  float env = sin(tc * PI);
  float wav = sin(tc * PI * f + h2 * 6.2831) * 0.75 + sin(tc * PI * (f * 2.0 + 1.0) + h * 6.2831) * 0.25;
  float off = amp * env * wav;
  // its slope along the edge (to keep the width even through the bends)
  float dt = 0.01; float tc2 = clamp(t + dt, 0.0, 1.0);
  float off2 = amp * sin(tc2 * PI) * (sin(tc2 * PI * f + h2 * 6.2831) * 0.75 + sin(tc2 * PI * (f * 2.0 + 1.0) + h * 6.2831) * 0.25);
  float slope = (off2 - off) / max((tc2 - tc) * L, 1e-9);
  float d = abs(side - off) / sqrt(1.0 + slope * slope);
  if (t < 0.0) d = length(p - c0);
  else if (t > 1.0) d = length(p - c1);
  return d * R_KM;
}

void main() {
  float lon = uGeo.x + vUv.x * uGeo.z;
  float lat = uGeo.y - (1.0 - vUv.y) * uGeo.w;
  lon = mod(lon + PI, 2.0 * PI) - PI;
  vec3 p = unitOf(lon, lat);
  int a = tileAt(lon, lat, p);
  gather(a);
  vec3 colour; float lake;
  vec4 b = blendAt(p, colour, lake);
  float land = b.x + shoreNoise(p) * (1.0 - abs(b.x - 0.5) * 1.2);
  float aa = max(fwidth(land) * 0.75, 1e-4);
  float isLand = smoothstep(0.5 - aa, 0.5 + aa, land);
  float e = b.y + detail(p, b.z) * (b.x > 0.5 ? 1.0 : 0.15);
  float iceW = b.w + nkm(p, 18.0, 21.0) * 0.4;
  float isIce = smoothstep(0.45, 0.55, iceW);
  float latDeg = degrees(lat);
  float snowLine = 5400.0 - abs(latDeg) * 40.0;
  e = isLand > 0.5 ? max(e, 2.0) : min(e, -80.0);

  if (uMode > 0.5) {
    // land cover (rasterDetail.js LAND_COVER): the base class of the tile under a warped point
    // (wavy edges), ice above the snow line, rock above the tree line, water off the land
    float cls = 0.0;
    if (isLand > 0.5) {
      vec3 q = normalize(p + (vec3(nkm(p, 30.0, 31.0), nkm(p, 30.0, 32.0), nkm(p, 30.0, 33.0)) * 0.006 + vec3(nkm(p, 8.0, 34.0), nkm(p, 8.0, 35.0), nkm(p, 8.0, 36.0)) * 0.0018));
      int c = walk(a, q, 3);
      cls = floor(paintB(c).x / 8.0);
      float treeLine = 3900.0 - max(0.0, abs(latDeg) - 25.0) * 70.0;
      if (isIce > 0.5 || e > snowLine) cls = 1.0;
      else if (e > treeLine) cls = 2.0;
    }
    fragColor = vec4(cls / 255.0, 0.0, 0.0, 1.0);
    return;
  }

  // hillshade: the elevation one pixel east and one pixel south (the Earth build's light)
  float kmLon = max(0.05, uKmPx * (uGeo.z / uGeo.w) * cos(lat));
  vec3 pe = unitOf(lon + uGeo.z / ${RASTER_TILE}.0, lat);
  vec3 ps = unitOf(lon, lat - uGeo.w / ${RASTER_TILE}.0);
  float ee = elevAt(pe); float es = elevAt(ps);
  float gx = ((ee - e) / (kmLon * 1000.0)) * 14.0;
  float gy = ((es - e) / (uKmPx * 1000.0)) * 14.0;
  if (isLand < 0.5) { gx *= 0.15; gy *= 0.15; }
  vec3 nl = normalize(vec3(-gx, -gy, 1.0));
  float dotL = dot(nl, vec3(-0.5, -0.6, 0.62));
  float shade = 0.62 + 0.5 * max(0.0, dotL);
  vec3 landC;
  float landShade = shade;
  if (isIce > 0.5) { landC = vec3(232.0, 238.0, 244.0) / 255.0; landShade = 0.8 + 0.3 * max(0.0, dotL); }
  else {
    landC = colour;
    landC = mix(landC, vec3(152.0, 128.0, 102.0) / 255.0, clamp((e - 700.0) / 2400.0, 0.0, 1.0) * 0.75);
    landC = mix(landC, vec3(168.0, 160.0, 152.0) / 255.0, clamp((e - 2600.0) / 1800.0, 0.0, 1.0) * 0.8);
    landC = mix(landC, vec3(240.0, 243.0, 246.0) / 255.0, clamp((e - snowLine) / 600.0, 0.0, 1.0));
    if (e < 50.0) landC = mix(landC, landC * vec3(0.92, 0.98, 0.9), 0.5);
    // a little patchiness at the scale of fields and woods
    landC *= 1.0 + nkm(p, 9.0, 41.0) * 0.12 * smoothstep(1.0, 3.0, 9.0 / uKmPx);
  }
  vec3 waterC; float waterShade;
  bool isLake = lake / max(1.0 - b.x, 1e-3) > 0.5;
  if (isLake) { waterC = vec3(58.0, 118.0, 170.0) / 255.0; waterShade = 0.9 + 0.1 * max(0.0, dotL); }
  else {
    float depth = max(0.0, -e);
    waterC = mix(vec3(92.0, 160.0, 205.0), vec3(48.0, 104.0, 165.0), clamp(depth / 220.0, 0.0, 1.0)) / 255.0;
    waterC = mix(waterC, vec3(18.0, 42.0, 92.0) / 255.0, clamp((depth - 220.0) / 3800.0, 0.0, 1.0));
    waterShade = 0.88 + 0.2 * max(0.0, dotL);
    if (isIce > 0.5) { waterC = vec3(226.0, 234.0, 242.0) / 255.0; waterShade = 0.95; }
  }
  vec3 col = mix(waterC * waterShade, landC * landShade, isLand);

  // Rivers on the edges of the tile under a warped point: the warp (a smooth field of about
  // RIVER_WARP_KM) bends the whole network, so reaches leave the hex edges and the corners round
  // off, and stays connected (a continuous deformation). Each edge is drawn from both its tiles.
  vec3 q = normalize(p + (vec3(nkm(p, 100.0, 51.0), nkm(p, 100.0, 52.0), nkm(p, 100.0, 53.0)) * 3.0 + vec3(nkm(p, 35.0, 54.0), nkm(p, 35.0, 55.0), nkm(p, 35.0, 56.0)) * 0.7) * ${(RIVER_WARP_KM / EARTH_R_KM).toExponential(4)});
  int aq = walk(a, q, 2);
  if (aq != a) gather(aq);
  float bits = TB[0].z; float sizes = TB[0].w;
  if (bits > 0.5 && isLand > 0.0) {
    int m = T[6] < 0 ? 5 : 6;
    float bank = 0.0; float water = 0.0;
    for (int k = 0; k < 6; k++) {
      if (k >= m) break;
      float size;
      float d = riverDist(q, k, m, bits, sizes, size);
      if (d > 50.0) continue;
      float hw = max(${RIVER_HALF_KM[1].toFixed(2)} * step(size, 1.5) + ${RIVER_HALF_KM[2].toFixed(2)} * step(1.5, size) * step(size, 2.5) + ${RIVER_HALF_KM[3].toFixed(2)} * step(2.5, size), 0.0) / uKmPx;
      // streams fade out on the small levels (as Earth's picture shows only the larger rivers there)
      float vis = size < 1.5 ? smoothstep(0.22, 0.6, hw) : clamp(hw * 3.0, 0.5, 1.0);
      hw = max(hw, 0.45);
      float dp = d / uKmPx;
      water = max(water, clamp(hw - dp + 0.5, 0.0, 1.0) * vis);
      bank = max(bank, clamp(hw + 0.9 - dp + 0.5, 0.0, 1.0) * vis);
    }
    col = mix(col, vec3(58.0, 108.0, 168.0) / 255.0, bank * 0.6 * isLand);
    col = mix(col, vec3(112.0, 172.0, 228.0) / 255.0, water * 0.92 * isLand);
  }
  float grain = 1.0 + (fract(sin(dot(gl_FragCoord.xy + vUv * 977.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.05;
  fragColor = vec4(clamp(col * grain, 0.0, 1.0), 1.0);
}
`;

const dataTexture = (data, w, h, format) => {
  const t = new DataTexture(data, w, h, format, FloatType);
  t.minFilter = NearestFilter; t.magFilter = NearestFilter; t.generateMipmaps = false;
  t.wrapS = ClampToEdgeWrapping; t.wrapT = ClampToEdgeWrapping; t.flipY = false;
  t.needsUpdate = true;
  return t;
};

/** The tile's geography for the shader: lon0, lat0 (top), spans (radians) and km a pixel. */
export const tileGeo = (z, x, y) => {
  const cols = 2 ** (z + 1); const rows = 2 ** z;
  const lonSpan = (2 * Math.PI) / cols; const latSpan = Math.PI / rows;
  return { geo: [-Math.PI + x * lonSpan, Math.PI / 2 - y * latSpan, lonSpan, latSpan], kmPx: (latSpan * EARTH_R_KM) / RASTER_TILE };
};

/**
 * The procedural raster source of a generated world, drawing with `renderer` (the map's):
 * `colour(z, x, y)` and `cover(z, x, y)` render that pyramid tile now and return its texture
 * (a render target's: dispose it with `release(texture)`).
 */
export const createProceduralSource = (renderer, tiles, { seed = 0 } = {}) => {
  const grid = tileGpuData(tiles);
  const paint = paintTileData(tiles);
  const textures = [
    dataTexture(grid.centres, DATA_W, grid.rows, RGBAFormat),
    dataTexture(grid.neighbours, DATA_W, grid.neighbourRows, RGBAFormat),
    dataTexture(grid.lookup, LOOKUP_W, LOOKUP_H, RedFormat),
    dataTexture(paint.data, DATA_W, paint.rows, RGBAFormat)
  ];
  const uniforms = {
    uCentres: { value: textures[0] }, uNeigh: { value: textures[1] }, uLookup: { value: textures[2] }, uPaint: { value: textures[3] },
    uGeo: { value: [0, 0, 1, 1] }, uKmPx: { value: 1 }, uMode: { value: 0 }, uSeed: { value: (seed % 997) * 0.731 }
  };
  const material = new ShaderMaterial({ glslVersion: GLSL3, vertexShader: PAINT_VERTEX, fragmentShader: PAINT_FRAGMENT, uniforms, depthTest: false, depthWrite: false });
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const keep = new Color();
  const targets = new Set();
  const render = (z, x, y, mode) => {
    const filter = mode ? NearestFilter : LinearFilter;
    const target = new WebGLRenderTarget(RASTER_TILE, RASTER_TILE, { minFilter: filter, magFilter: filter, generateMipmaps: false, depthBuffer: false });
    target.texture.wrapS = ClampToEdgeWrapping; target.texture.wrapT = ClampToEdgeWrapping;
    const { geo, kmPx } = tileGeo(z, x, y);
    uniforms.uGeo.value = geo; uniforms.uKmPx.value = kmPx; uniforms.uMode.value = mode;
    const before = renderer.getRenderTarget(); const alpha = renderer.getClearAlpha(); renderer.getClearColor(keep);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(before); renderer.setClearColor(keep, alpha); renderer.autoClear = autoClear;
    target.texture.userData.target = target;
    targets.add(target);
    return target.texture;
  };
  return {
    colour: (z, x, y) => render(z, x, y, 0),
    cover: (z, x, y) => render(z, x, y, 1),
    release: (texture) => { const t = texture?.userData?.target; if (t) { targets.delete(t); t.dispose(); } },
    dispose: () => { targets.forEach((t) => t.dispose()); targets.clear(); material.dispose(); quad.geometry.dispose(); textures.forEach((t) => t.dispose()); }
  };
};
