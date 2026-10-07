// src/components/map/gl/territoryShader.js
// The territory pass of the WebGL map: one full-screen quad that, for every pixel, finds the tile
// under it (the lookup texel's tile, then a short walk to the nearest centre, tileGpuData.js) and
// paints what the old SVG map drew with thousands of paths, in its order:
//   city outlines (coloured: selected, occupied, at war; faint white between your own cities from
//   the region zoom), the nation's colour band just inside its border, the nation border line,
//   the red war band, the hex overlay (land, from the hex zoom), the grey wash over land explored
//   but out of sight, the lens tints, the selected tile, and the dark mask over the unexplored.
// Every line is measured in screen pixels from the exact cell edge (the bisector of two centres
// on the sphere, through its analytic screen gradient), so borders stay one crisp width at any
// zoom and the world wraps east to west by itself (longitude is taken modulo 360 degrees).
// The fog is the exception: its two edges (the dark mask, the grey wash) are soft and wander like
// clouds, read from a blurred field baked per fog change (fogField.js) through world-space noise,
// so they never show the hexes; every tile's centre still shows its own per-tile fog state.
// GLSL ES 3.00 (WebGL2): texelFetch and integer indices.
import { DATA_W, LOOKUP_W, LOOKUP_H, WALK_STEPS } from './tileGpuData';
import { CITY_W, FLAG_ENEMY } from './territoryData';

// Screen widths (CSS px), from Map2DView.jsx.
export const BAND_PX = 4;
export const WAR_HALF_PX = 1.7;
export const HEX_HALF_PX = 0.3;
export const SELECTED_HALF_PX = 0.75;
export const OUTLINE_HALF_PX = 0.4;
export const FAINT_HALF_PX = 0.25;
export const MASK_COLOR = [11 / 255, 17 / 255, 32 / 255];
// The soft fog edge (fogField.js): the field's band, its noise warp and the per-tile cores.
export const FOG_DEEP = 0.002;     // below this the field is deep dark: the mask, no tile search
export const FOG_LO = 0.22;        // the mask is full below this field value (after the warp)
export const FOG_HI = 0.62;        // and gone above this one
export const FOG_WARP_KM = 45;     // the noise moves the edge up to this far either way
export const FOG_NOISE_FREQ = 16;  // noise cells per Earth radius: the base wave is about 400 km
export const FOG_FINE = 0.6;       // the finer wisps (a wave of about 90 km), in field units
export const FOG_CORE0_KM = 22;    // a tile's centre (this far from its edges and more) keeps its
export const FOG_CORE1_KM = 36;    // own fog state whatever the blur says
const EARTH_KM = 6371;

export const TERRITORY_VERTEX = /* glsl */ `
uniform vec4 uView;     // world x and y of the screen's top left, world units per CSS px, unused
uniform vec2 uViewport; // CSS px
out vec2 vWorld;
void main() {
  vec2 s = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5) * uViewport;
  vWorld = uView.xy + s * uView.z;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const TERRITORY_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uCentres;
uniform sampler2D uNeigh;
uniform sampler2D uLookup;
uniform sampler2D uTile;
uniform sampler2D uCity;
uniform sampler2D uTint;
uniform sampler2D uFog;   // the soft fog field: r explored, g in sight, blurred (fogField.js)
uniform vec3 uProj;      // projection: centre x, centre y (world px), world px per radian
uniform float uK;         // zoom (CSS px per world px)
uniform float uDpr;
uniform float uHex;       // 1 from the hex zoom
uniform float uCityDetail;// 1 from the region zoom (faint borders between your own cities)
uniform float uNationHalf;// half width of the nation border, CSS px
uniform float uSelTile;   // the selected tile or -1
uniform float uTintOn;
uniform float uFogOn;
in vec2 vWorld;
out vec4 fragColor;

const float PI = 3.14159265358979;
ivec2 at(int i, int w) { return ivec2(i % w, i / w); }
vec4 centreOf(int i) { return texelFetch(uCentres, at(i, ${DATA_W}), 0); }
vec4 tileOf(int i) { return texelFetch(uTile, at(i, ${DATA_W}), 0); }
vec4 cityBand(int c) { return texelFetch(uCity, at(c * 2, ${CITY_W}), 0); }
vec4 cityStroke(int c) { return texelFetch(uCity, at(c * 2 + 1, ${CITY_W}), 0); }
void neighbours(int i, out int n[6]) {
  vec4 a = texelFetch(uNeigh, at(i * 2, ${DATA_W}), 0);
  vec4 b = texelFetch(uNeigh, at(i * 2 + 1, ${DATA_W}), 0);
  n[0] = int(floor(a.x + 0.5)); n[1] = int(floor(a.y + 0.5)); n[2] = int(floor(a.z + 0.5)); n[3] = int(floor(a.w + 0.5));
  n[4] = int(floor(b.x + 0.5)); n[5] = int(floor(b.y + 0.5));
}

// Value noise on the unit sphere's 3D position: stable in world space and seamless east to west.
float hash3(vec3 q) { q = fract(q * 0.3183099 + 0.1); q *= 17.0; return fract(q.x * q.y * q.z * (q.x + q.y + q.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 x) {
  float s = 0.0; float amp = 0.5;
  for (int i = 0; i < 4; i++) { s += amp * vnoise(x); x = x * 2.03 + 17.1; amp *= 0.5; }
  return s / 0.9375;
}

vec2 fogFieldAt(float lon, float lat) { return texture(uFog, vec2((lon + PI) / (2.0 * PI), (0.5 * PI - lat) / PI)).rg; }

vec4 acc;
void over(vec3 rgb, float a) { acc = vec4(rgb * a, a) + acc * (1.0 - a); }
// A line of half width hw (CSS px) at distance d (CSS px) from the edge, one device pixel of AA.
float line(float d, float hw) { return clamp((hw - d) * uDpr + 0.5, 0.0, 1.0); }

void main() {
  float lon = (vWorld.x - uProj.x) / uProj.z;
  lon = mod(lon + PI, 2.0 * PI) - PI;
  float lat = (uProj.y - vWorld.y) / uProj.z;
  if (abs(lat) > 0.5 * PI) discard;
  float cl = cos(lat); float sl = sin(lat); float co = cos(lon); float so = sin(lon);
  vec3 p = vec3(cl * co, cl * so, sl);
  vec3 dLon = vec3(-cl * so, cl * co, 0.0);
  vec3 dLat = vec3(-sl * co, -sl * so, cl);
  float pxPerRad = uProj.z * uK;

  int ix = clamp(int((lon + PI) / (2.0 * PI) * ${LOOKUP_W}.0), 0, ${LOOKUP_W - 1});
  int iy = clamp(int((0.5 * PI - lat) / PI * ${LOOKUP_H}.0), 0, ${LOOKUP_H - 1});
  int a = int(floor(texelFetch(uLookup, ivec2(ix, iy), 0).r + 0.5));
  // The soft fog field (fogField.js). Deep in the unexplored dark (the field all but zero, no
  // explored tile within reach) the mask alone, with no tile search.
  // Near an edge the field is read through a world-space noise warp (a domain warp of up to
  // FOG_WARP_KM), so the edge wanders like a cloud's instead of following the hexes; the deep
  // checks are made before the warp, far enough out that the warp cannot reach an edge.
  vec2 fogF = vec2(1.0); float warp = 0.0;
  if (uFogOn > 0.5) {
    fogF = fogFieldAt(lon, lat);
    if (fogF.r < ${FOG_DEEP.toFixed(4)}) { fragColor = vec4(${MASK_COLOR.map((c) => c.toFixed(4)).join(', ')}, 1.0); return; }
    if (fogF.r < 0.999 || fogF.g < 0.999) {
      vec3 q = p * ${FOG_NOISE_FREQ.toFixed(1)};
      float wx = fbm(q) - 0.5; float wy = fbm(q + vec3(31.7, 11.3, 5.9)) - 0.5;
      warp = wx;
      float amp = 2.0 * ${(FOG_WARP_KM / EARTH_KM).toFixed(6)};
      fogF = fogFieldAt(lon + wx * amp / max(cl, 0.05), clamp(lat + wy * amp, -0.5 * PI, 0.5 * PI));
    }
  }
  int n[6];
  for (int it = 0; it < ${WALK_STEPS}; it++) {
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
  neighbours(a, n);
  vec4 ca = centreOf(a);
  vec4 ta = tileOf(a);
  int cityA = int(floor(ta.x + 0.5)) - 1;
  float natA = ta.y;
  float fogA = ta.z;
  bool landA = ca.w > 0.5;

  // Per neighbour: the distance in CSS px to the shared edge, and what lies beyond it.
  float dist[6]; vec4 tn[6]; bool landN[6];
  for (int k = 0; k < 6; k++) {
    dist[k] = 1e6; tn[k] = vec4(0.0); landN[k] = false;
    if (n[k] < 0) continue;
    vec4 cn = centreOf(n[k]);
    vec3 ab = ca.xyz - cn.xyz;
    float f = dot(p, ab);
    vec2 g = vec2(dot(ab, dLon), dot(ab, dLat)) / pxPerRad;
    dist[k] = max(0.0, f) / max(length(g), 1e-12);
    tn[k] = tileOf(n[k]);
    landN[k] = cn.w > 0.5;
  }

  acc = vec4(0.0);
  // The fog, soft: how much of the dark mask and of the grey wash this pixel gets. The blurred
  // field is warped by world-space noise inside its band, then every tile's centre is held on its
  // own side (a lone explored tile stays open, a lone unexplored one dark): the rules stay per tile.
  float maskA = 0.0; float washA = 0.0;
  if (uFogOn > 0.5) {
    // finer wisps inside the band: a second, smaller noise on the field value itself
    // (weighted to nothing near 0 and 1, so the deep checks above stay exact)
    vec2 inBand = smoothstep(vec2(0.08), vec2(0.3), fogF) * (1.0 - smoothstep(vec2(0.7), vec2(0.92), fogF));
    float fine = inBand.r + inBand.g > 0.0 ? (fbm(p * ${(FOG_NOISE_FREQ * 4.3).toFixed(1)} + vec3(7.1, 3.3, 1.9)) - 0.5) * ${FOG_FINE.toFixed(2)} : 0.0;
    maskA = 1.0 - smoothstep(${FOG_LO.toFixed(2)}, ${FOG_HI.toFixed(2)}, fogF.r + fine * inBand.r);
    washA = 1.0 - smoothstep(${FOG_LO.toFixed(2)}, ${FOG_HI.toFixed(2)}, fogF.g + fine * inBand.g);
    float dEdge = 1e6;
    for (int k = 0; k < 6; k++) dEdge = min(dEdge, dist[k]);
    float core = smoothstep(${FOG_CORE0_KM.toFixed(1)}, ${FOG_CORE1_KM.toFixed(1)}, dEdge / pxPerRad * ${EARTH_KM.toFixed(1)} + warp * 16.0);
    maskA = fogA < 0.5 ? max(maskA, core) : min(maskA, 1.0 - core);
    washA = fogA < 1.5 ? max(washA, core) : min(washA, 1.0 - core);
  }
  if (uFogOn > 0.5 && fogA < 0.5) {
    // Unexplored: no territory, only the edge of the wash and the mask over the Earth.
    over(vec3(0.059, 0.09, 0.165), 0.55 * washA);
    over(vec3(${MASK_COLOR.map((c) => c.toFixed(4)).join(', ')}), maskA);
    if (acc.a <= 0.0) discard;
    fragColor = acc;
    return;
  }

  vec4 bandA = cityA >= 0 ? cityBand(cityA) : vec4(0.0);
  vec4 strokeA = cityA >= 0 ? cityStroke(cityA) : vec4(0.0);
  bool enemyA = cityA >= 0 && mod(floor(bandA.w + 0.5), 2.0) > 0.5;

  // City outlines: the plain faint line between two of a nation's cities from the region zoom,
  // then the coloured outlines (both sides of the edge), the selected city last.
  for (int pass = 0; pass < 3; pass++) {
    for (int k = 0; k < 6; k++) {
      if (n[k] < 0) continue;
      int cityN = int(floor(tn[k].x + 0.5)) - 1;
      if (cityN == cityA) continue;
      if (pass == 0) {
        if (uCityDetail > 0.5 && cityA >= 0 && cityN >= 0 && tn[k].y == natA && strokeA.w < 0.5 && cityStroke(cityN).w < 0.5)
          over(vec3(1.0), 0.35 * line(dist[k], ${FAINT_HALF_PX.toFixed(2)}));
        continue;
      }
      vec4 sn = cityN >= 0 ? cityStroke(cityN) : vec4(0.0);
      float want = pass == 1 ? 1.0 : 2.0;
      if (abs(strokeA.w - want) < 0.5) over(strokeA.rgb, line(dist[k], want > 1.5 ? ${SELECTED_HALF_PX.toFixed(2)} : ${OUTLINE_HALF_PX.toFixed(2)}));
      if (abs(sn.w - want) < 0.5) over(sn.rgb, line(dist[k], want > 1.5 ? ${SELECTED_HALF_PX.toFixed(2)} : ${OUTLINE_HALF_PX.toFixed(2)}));
    }
  }

  // The nation's band just inside its border.
  if (natA > 0.5) {
    float dBand = 1e6;
    for (int k = 0; k < 6; k++) if (n[k] >= 0 && tn[k].y != natA) dBand = min(dBand, dist[k]);
    if (dBand < ${BAND_PX.toFixed(1)} + 1.0) over(bandA.rgb, 0.9 * line(dBand, ${BAND_PX.toFixed(1)}));
  }
  // The nation border.
  for (int k = 0; k < 6; k++) {
    if (n[k] < 0 || tn[k].y == natA || (natA < 0.5 && tn[k].y < 0.5)) continue;
    over(vec3(0.008, 0.024, 0.09), 0.85 * line(dist[k], uNationHalf));
  }
  // War: a red band round every enemy city, a dark red hairline on its edge.
  for (int k = 0; k < 6; k++) {
    if (n[k] < 0) continue;
    int cityN = int(floor(tn[k].x + 0.5)) - 1;
    if (cityN == cityA) continue;
    bool enemyN = cityN >= 0 && mod(floor(cityBand(cityN).w + 0.5), 2.0) > 0.5;
    if (!enemyA && !enemyN) continue;
    over(vec3(0.937, 0.267, 0.267), line(dist[k], ${WAR_HALF_PX.toFixed(2)}));
    over(vec3(0.5, 0.114, 0.114), 0.55 * line(dist[k], 0.2));
  }
  // The hex overlay over land.
  if (uHex > 0.5) {
    for (int k = 0; k < 6; k++) if (n[k] >= 0 && (landA || landN[k])) over(vec3(1.0), 0.2 * line(dist[k], ${HEX_HALF_PX.toFixed(2)}));
  }
  // Explored, out of sight: the grey wash.
  if (washA > 0.0) over(vec3(0.059, 0.09, 0.165), 0.55 * washA);
  // The lens tints.
  if (uTintOn > 0.5) { vec4 t = texelFetch(uTint, at(a, ${DATA_W}), 0); if (t.a > 0.0) over(t.rgb, t.a); }
  // The selected tile.
  if (uSelTile >= 0.0) {
    int sel = int(floor(uSelTile + 0.5));
    if (a == sel) {
      over(vec3(1.0), 0.15);
      for (int k = 0; k < 6; k++) if (n[k] >= 0) over(vec3(1.0), line(dist[k], 0.8));
    } else {
      for (int k = 0; k < 6; k++) if (n[k] == sel) over(vec3(1.0), line(dist[k], 0.8));
    }
  }
  // The soft edge of the unexplored dark, over everything.
  if (maskA > 0.0) over(vec3(${MASK_COLOR.map((c) => c.toFixed(4)).join(', ')}), maskA);
  if (acc.a <= 0.0) discard;
  fragColor = acc;
}
`;

export { FLAG_ENEMY };
