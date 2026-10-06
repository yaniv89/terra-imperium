// src/components/map/closeView/terrainShader.js
// The ground of the close view (plans/playtest-1.md P1.3): the realistic Earth raster (level 5 of
// the pyramid, about 2.4 km a pixel) drawn by a shader that keeps it sharp far past its pixels.
//   Coasts, lakes and rivers  every pixel is classed land or water by its colour (water is blue
//                             over red by a clear margin); the class is blended between the four
//                             nearest pixels and cut at one half with a one-screen-pixel soft
//                             edge, so a shore is a smooth line at any zoom, never a blurry smear.
//                             Each side keeps the true colour of its own pixels. Snow and
//                             glaciers (bright, bluish white pixels) get the same cut on land.
//                             A wider look (four samples 1.5 pixels out) smooths glacier
//                             outlines. Rivers (water greener than the sea, riverness) narrow to
//                             their channel as you zoom in: a thin river's middle (where the water
//                             class stands above its neighbours) or the inside of a wide one.
//   Ground detail             value noise in world kilometres, so it never swims as you pan:
//                             mottling on green land, ripples on sand, crags on bare rock and
//                             waves on water, plus a small hillshade from the same noise. Each
//                             scale fades in once it spans a few screen pixels (DETAIL_SCALES_KM).
//   Land cover (phase F)      where the tile has a land cover tile (rasterDetail.js, uCoverOn),
//                             its class picks the detail instead of the colour guess: tree crowns
//                             in forest and rainforest, ripples on desert, crags on rock, dry
//                             speckle on steppe, a patchwork of plots on irrigated land, pools in
//                             wetland. The class is read nearest, at a point warped by the noise,
//                             so its edges never show the pixel grid. Placeholder for the ground
//                             materials of ART-PRODUCTION-PLAN batch 14 (public/terrain/<id>/).
// Kept free of React; the shader strings and the small helpers are pure and unit tested.
export const EARTH_KM = 40075;
// The noise scales, kilometres: broad patches, fields and copses, single crags and ripples.
export const DETAIL_SCALES_KM = [24, 6, 1.5];
// A scale shows once it covers this many device pixels, fully at four times that.
export const DETAIL_FADE_PX = 4;
// River water is greener than sea water: blue over green under RIVER_BG (fades between).
export const RIVER_BG = [0.12, 0.155];
// The water class must stand this much above its neighbours RIVER_REACH pixels out to be a river's middle.
export const RIVER_RIDGE = [0.15, 0.35];
// How far out (pixels) the river test looks: a drawn river loses about this much on each bank.
export const RIVER_REACH = 2;
/** The river class of a water colour (0 to 1, bytes in), the shader's rule in JS for tests. */
export const riverness = (r, g, b) => {
  const t = Math.max(0, Math.min(1, ((b - g) / 255 - RIVER_BG[0]) / (RIVER_BG[1] - RIVER_BG[0])));
  return 1 - t * t * (3 - 2 * t);
};

/** Device pixels per kilometre when the world raster is `worldWidth` CSS px wide at zoom k. */
export const pxPerKm = (worldWidth, k, dpr = 1) => (worldWidth * k * dpr) / EARTH_KM;

/** How much of a detail scale shows (0 to 1), the shader's rule in JS for tests. */
export const detailWeight = (scaleKm, pixelsPerKm) => {
  const px = scaleKm * pixelsPerKm;
  const t = Math.max(0, Math.min(1, (px - DETAIL_FADE_PX) / (DETAIL_FADE_PX * 3)));
  return t * t * (3 - 2 * t);
};

/** The water class of a colour (0 to 1, bytes in), the shader's rule in JS for tests. */
/** The snow class of a land colour (0 to 1, bytes in). */
export const snowiness = (r, g, b) => {
  const t = Math.max(0, Math.min(1, (Math.min(r, g, b) / 255 - 0.58) / 0.12));
  return r <= b + 1 ? t * t * (3 - 2 * t) : 0; // bright and bluish: bare rock is reddish grey
};

export const waterness = (r, g, b) => {
  const d = (b - r) / 255;
  const t = Math.max(0, Math.min(1, (d - 0.1) / 0.1));
  const blueOverGreen = b + 0.08 * 255 >= g ? 1 : 0;
  return t * t * (3 - 2 * t) * blueOverGreen;
};

export const TERRAIN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TERRAIN_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uSize;      // texture size in pixels
uniform vec4 uGeo;       // lon0, lat0 (top edge), lon span, lat span (degrees)
uniform float uPxPerKm;  // device pixels per kilometre
uniform sampler2D uCover;  // land cover classes (red channel, LAND_COVER order)
uniform float uCoverOn;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float water(vec3 c) { return smoothstep(0.1, 0.2, c.b - c.r) * step(c.g, c.b + 0.08); }
float river(vec3 c) { return 1.0 - smoothstep(${RIVER_BG[0].toFixed(3)}, ${RIVER_BG[1].toFixed(3)}, c.b - c.g); }
float snow(vec3 c) { return smoothstep(0.58, 0.7, min(c.r, min(c.g, c.b))) * step(c.r, c.b + 0.004); }
float weight(float km) { float px = km * uPxPerKm; return smoothstep(${DETAIL_FADE_PX.toFixed(1)}, ${(DETAIL_FADE_PX * 4).toFixed(1)}, px); }

void main() {
  // The four nearest pixels and the blend between them.
  vec2 st = vUv * uSize - 0.5;
  vec2 i0 = floor(st); vec2 f = st - i0;
  vec3 c00 = texture2D(uMap, (i0 + vec2(0.5, 0.5)) / uSize).rgb;
  vec3 c10 = texture2D(uMap, (i0 + vec2(1.5, 0.5)) / uSize).rgb;
  vec3 c01 = texture2D(uMap, (i0 + vec2(0.5, 1.5)) / uSize).rgb;
  vec3 c11 = texture2D(uMap, (i0 + vec2(1.5, 1.5)) / uSize).rgb;
  float w00 = water(c00); float w10 = water(c10); float w01 = water(c01); float w11 = water(c11);
  vec4 bw = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  float m = dot(bw, vec4(w00, w10, w01, w11));
  // A wider look (four filtered samples 1.5 pixels out): how much snow surrounds us.
  vec3 d0 = texture2D(uMap, (st + vec2(-1.0, -1.0)) / uSize).rgb; vec3 d1 = texture2D(uMap, (st + vec2(2.0, -1.0)) / uSize).rgb;
  vec3 d2 = texture2D(uMap, (st + vec2(-1.0, 2.0)) / uSize).rgb; vec3 d3 = texture2D(uMap, (st + vec2(2.0, 2.0)) / uSize).rgb;
  // Rivers: their water is greener than the sea (the river line was drawn over the land).
  float rv = 0.0;
  { vec4 ww0 = bw * vec4(w00, w10, w01, w11); float s0 = dot(ww0, vec4(1.0));
    if (s0 > 0.001) rv = dot(ww0, vec4(river(c00), river(c10), river(c01), river(c11))) / s0; }
  // The river's channel, narrower than its drawn line: the ridge of the water class (a thin
  // river's middle) or deep inside a wide one (water RIVER_REACH pixels out on every side).
  vec2 p0 = st + 0.5;
  float R = ${RIVER_REACH.toFixed(1)};
  float r1 = (water(texture2D(uMap, (p0 + vec2(-R, 0.0)) / uSize).rgb) + water(texture2D(uMap, (p0 + vec2(R, 0.0)) / uSize).rgb)
    + water(texture2D(uMap, (p0 + vec2(0.0, -R)) / uSize).rgb) + water(texture2D(uMap, (p0 + vec2(0.0, R)) / uSize).rgb)) * 0.25;
  float channel = max(smoothstep(0.75, 0.95, r1), smoothstep(${RIVER_RIDGE[0].toFixed(2)}, ${RIVER_RIDGE[1].toFixed(2)}, m - r1)) * smoothstep(0.35, 0.5, m);
  float sWide = (snow(d0) + snow(d1) + snow(d2) + snow(d3)) * 0.25;
  vec3 blend = c00 * bw.x + c10 * bw.y + c01 * bw.z + c11 * bw.w;
  // Each side's own colour: the pixels of that class, weighted by nearness.
  vec4 ww = bw * vec4(w00, w10, w01, w11); vec4 lw = bw - ww;
  float sw = dot(ww, vec4(1.0)); float sl = dot(lw, vec4(1.0));
  vec3 waterC = sw > 0.001 ? (c00 * ww.x + c10 * ww.y + c01 * ww.z + c11 * ww.w) / sw : blend;
  vec3 landC = sl > 0.001 ? (c00 * lw.x + c10 * lw.y + c01 * lw.z + c11 * lw.w) / sl : blend;
  // Snow and glaciers get the same clean cut against bare ground.
  vec4 iw = lw * vec4(snow(c00), snow(c10), snow(c01), snow(c11)); vec4 gw = lw - iw;
  float si = dot(iw, vec4(1.0)); float sg = dot(gw, vec4(1.0));
  if (si > 0.001 && sg > 0.001) {
    float mi = mix(si / (si + sg), sWide, 0.5); // the wider look smooths the glacier outline
    float ai = max(fwidth(mi) * 0.8, 0.002);
    vec3 iceC = (c00 * iw.x + c10 * iw.y + c01 * iw.z + c11 * iw.w) / si;
    vec3 groundC = (c00 * gw.x + c10 * gw.y + c01 * gw.z + c11 * gw.w) / sg;
    landC = mix(groundC, iceC, smoothstep(0.5 - ai, 0.5 + ai, mi));
  }
  float aa = max(fwidth(m) * 0.8, 0.002);
  // Rivers narrow to their channel as you zoom in, instead of staying a few kilometres wide.
  float mr = mix(m, channel, rv * weight(${DETAIL_SCALES_KM[1].toFixed(1)}));
  float ar = max(fwidth(mr) * 0.8, 0.002);
  float isWater = smoothstep(0.5 - ar, 0.5 + ar, mr);
  waterC = mix(waterC, vec3(0.27, 0.5, 0.72) * (0.85 + 0.3 * dot(waterC, vec3(0.33))), rv * 0.55);

  // World kilometres for the noise.
  float lat = uGeo.y - (1.0 - vUv.y) * uGeo.w; // v is 1 at the top edge
  float lon = uGeo.x + vUv.x * uGeo.z;
  float cl = cos(radians(lat));
  vec2 km = vec2(lon * 111.32 * cl, lat * 110.57);

  float w1 = weight(${DETAIL_SCALES_KM[0].toFixed(1)}); float w2 = weight(${DETAIL_SCALES_KM[1].toFixed(1)}); float w3 = weight(${DETAIL_SCALES_KM[2].toFixed(1)});
  // Land: what kind of ground the colour says.
  float lum = dot(landC, vec3(0.299, 0.587, 0.114));
  float green = clamp((landC.g - max(landC.r, landC.b)) * 6.0, 0.0, 1.0);
  float sand = clamp((landC.r - landC.b) * 3.0 - green, 0.0, 1.0) * smoothstep(0.35, 0.55, lum);
  float sat = max(landC.r, max(landC.g, landC.b)) - min(landC.r, min(landC.g, landC.b));
  float rock = clamp(1.0 - sat * 6.0, 0.0, 1.0) * (1.0 - smoothstep(0.82, 0.9, lum));
  float n1 = fbm(km / ${DETAIL_SCALES_KM[0].toFixed(1)}) - 0.5;
  float n2 = fbm(km / ${DETAIL_SCALES_KM[1].toFixed(1)} + 31.0) - 0.5;
  float n3 = vnoise(km / ${DETAIL_SCALES_KM[2].toFixed(1)} + 7.0) - 0.5;
  // Land cover: the class at a point warped by the noise (organic edges), one-hot by kind.
  float cForest = 0.0; float cDesert = 0.0; float cRock = 0.0; float cSteppe = 0.0; float cIrrigated = 0.0; float cWet = 0.0;
  if (uCoverOn > 0.5) {
    float cls = floor(texture2D(uCover, vUv + vec2(n2, n3) * 1.6 / uSize).r * 255.0 + 0.5);
    cForest = step(5.5, cls) * step(cls, 7.5);
    cDesert = step(2.5, cls) * step(cls, 3.5);
    cRock = step(1.5, cls) * step(cls, 2.5);
    cSteppe = step(3.5, cls) * step(cls, 4.5);
    cWet = step(8.5, cls) * step(cls, 9.5);
    cIrrigated = step(9.5, cls);
    sand = max(sand * 0.4, cDesert);
    rock = max(rock * 0.4, cRock);
    green = max(green, cForest);
  }
  float mottle = n1 * 0.24 * w1 + n2 * 0.2 * w2 * (0.5 + green) + n3 * 0.12 * w3;
  float ripple = sin(dot(km, vec2(0.83, 0.55)) * 3.2 + n2 * 9.0) * 0.05 * w3 * sand;
  float crag = (0.25 - abs(n2)) * 0.3 * w2 * rock + (0.2 - abs(n3)) * 0.18 * w3 * rock;
  // A small hillshade from the broad noise: light from the north-west.
  float hx = fbm((km + vec2(0.6, 0.0)) / ${DETAIL_SCALES_KM[1].toFixed(1)} + 31.0) - 0.5 - n2;
  float hy = fbm((km + vec2(0.0, 0.6)) / ${DETAIL_SCALES_KM[1].toFixed(1)} + 31.0) - 0.5 - n2;
  float hill = (hy - hx) * 2.2 * w2 * (0.4 + rock);
  vec3 land = landC * (1.0 + mottle + ripple + crag + hill);
  if (uCoverOn > 0.5) {
    // tree crowns: dark gaps between round canopies about 400 m across
    float crown = vnoise(km / 0.4 + 3.0);
    land *= 1.0 - cForest * w3 * (0.22 - 0.3 * crown * crown);
    // dry steppe: pale speckle
    land *= 1.0 + cSteppe * w3 * (vnoise(km / 0.5 + 11.0) - 0.5) * 0.18;
    // irrigated land: plots about 1.2 km, each its own shade, furrows along one of two ways
    vec2 plot = floor(km / 1.2);
    float ph = hash(plot);
    float furrow = sin(dot(km, ph > 0.5 ? vec2(1.0, 0.0) : vec2(0.0, 1.0)) * 40.0) * 0.5 + 0.5;
    land = mix(land, land * vec3(0.92 + 0.22 * ph, 1.0 + 0.12 * (1.0 - ph), 0.85) * (0.95 + 0.06 * furrow), cIrrigated * w3);
    // wetland: small pools between the reeds
    float pool = smoothstep(0.66, 0.72, vnoise(km / 0.45 + 23.0));
    land = mix(land, vec3(0.2, 0.33, 0.36), cWet * w3 * pool * 0.7);
  }

  // Water: slow swells and a light rim along the shore.
  float wave = (vnoise(km / 3.0 + vec2(0.0, n1 * 3.0)) - 0.5) * 0.06 * w2 + (vnoise(km * vec2(1.4, 0.5)) - 0.5) * 0.05 * w3;
  float rim = smoothstep(0.5, 0.56, m) * (1.0 - smoothstep(0.56, 0.7, m));
  vec3 sea = waterC * (1.0 + wave) + vec3(0.12, 0.14, 0.12) * rim * w2;

  gl_FragColor = vec4(mix(land, sea, isWater), 1.0);
}
`;
