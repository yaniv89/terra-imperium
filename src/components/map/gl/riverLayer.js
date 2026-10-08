// src/components/map/gl/riverLayer.js
// The rivers of the WebGL map as vector lines (riverModel.js has the rules), drawn in the terrain
// pass: over the Earth raster, under the mountain sprites, the territories and the fog (so the fog
// hides them where nothing is explored and greys them where the land is out of sight).
//
// Every reach is one triangle strip (riverModel.riverStrips): each point is pushed out to both
// sides along the mitred normal by the river's half width there (so the width tapers smoothly from
// the source down to the mouth), plus the edge and a pixel of room for the anti-aliasing; the
// fragment shader shades the water in the middle and a darker edge round it from the distance
// across. A strip never overlaps itself at its joints; where two reaches meet or cross (a
// confluence) the most covered pixel wins through the depth test (each fragment writes 1 - its
// coverage, the water ahead of the edge), so no beads or dark notches. No extra pass or render
// target: one draw call a frame.
// The points sit in lon/lat (degrees) and the projection is applied in the shader, so a pan or a
// zoom only changes uniforms; each reach is drawn at the copy of the world nearest the view's
// centre (by its first point: the east-west wrap). The width and fade follow riverModel.js.
import {
  BufferGeometry, BufferAttribute, ShaderMaterial, Mesh, GLSL3, Vector4, Vector3, LessDepth, DoubleSide
} from 'three';
import { RIVER_WIDTH, RIVER_FADE_K, RIVER_INK, riverFade } from './riverModel';

// The colours: a muted river blue like the raster's lakes and shallow sea, a darker bank edge.
export const RIVER_WATER = Object.freeze([0.27, 0.47, 0.65]);
export const RIVER_EDGE = Object.freeze([0.2, 0.31, 0.38]);
export const RIVER_WATER_ALPHA = 0.88;
export const RIVER_EDGE_ALPHA = 0.45;
const RANKS = RIVER_FADE_K.length;
const f = (v) => v.toFixed(4);

const RIVER_VERTEX = /* glsl */ `
uniform vec4 uView;     // world x, y of the screen's top left; zoom k; world width (the wrap)
uniform vec3 uScreen;   // CSS width, height, device pixel ratio
uniform float uCamX;    // the view centre's world x
uniform vec3 uProj;     // the projection's centre x, y and scale (px a radian at k 1)
uniform float uFade[${RANKS}];
in vec2 aCur;           // this point, the one before and the one after (lon, lat degrees)
in vec2 aPrev;
in vec2 aNext;
in vec4 aInfo;          // the river's weight here, its rank, the side (-1, 1), the reach's wrap anchor (lon)
out float vAcross;      // CSS px from the middle line
flat out float vEdge;
out float vHw;
out float vInk;
const float DEG = 0.017453292519943295;
vec2 toWorld(vec2 ll) { return vec2(uProj.x + uProj.z * ll.x * DEG, uProj.y - uProj.z * ll.y * DEG); }
float widthPx(float sw) {
  float k = uView.z;
  float mapW = (${f(RIVER_WIDTH.base)} + ${f(RIVER_WIDTH.perW)} * pow(sw, ${f(RIVER_WIDTH.wExp)})) * pow(k / ${f(RIVER_WIDTH.refK)}, ${f(RIVER_WIDTH.exp)});
  float realW = (${f(RIVER_WIDTH.kmBase)} + ${f(RIVER_WIDTH.kmPerW)} * sw) * k * uProj.z / 6371.0;
  return min(max(mapW, realW), ${f(RIVER_WIDTH.capBase)} + ${f(RIVER_WIDTH.capPerSqrtW)} * sqrt(sw));
}
void main() {
  float fade = uFade[int(aInfo.y + 0.5)];
  float ax = toWorld(vec2(aInfo.w, 0.0)).x;
  float shift = uView.w * floor((uCamX - ax) / uView.w + 0.5);
  vec2 c = (toWorld(aCur) + vec2(shift, 0.0) - uView.xy) * uView.z;
  vec2 p = (toWorld(aPrev) + vec2(shift, 0.0) - uView.xy) * uView.z;
  vec2 n = (toWorld(aNext) + vec2(shift, 0.0) - uView.xy) * uView.z;
  float w = widthPx(aInfo.x);
  // under a pixel wide: one pixel, fainter (the same ink)
  float thin = clamp(w, 0.0, 1.0);
  w = max(w, 1.0);
  float edge = clamp(0.2 * w, 0.45, 1.1) * smoothstep(1.3, 2.8, w);
  float ext = 0.5 * w + edge + 1.0;
  vec2 d1 = c - p; vec2 d2 = n - c;
  float l1 = length(d1); float l2 = length(d2);
  vec2 t1 = l1 > 1e-4 ? d1 / l1 : vec2(0.0); vec2 t2 = l2 > 1e-4 ? d2 / l2 : vec2(0.0);
  vec2 dir = t1 + t2;
  dir = length(dir) > 1e-4 ? normalize(dir) : (l1 > 1e-4 ? t1 : vec2(1.0, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  // the mitre: as long as the bend needs, at most twice (a sharp turn is cut, not a spike)
  vec2 side1 = l1 > 1e-4 ? vec2(-t1.y, t1.x) : nrm;
  float miter = 1.0 / max(dot(nrm, side1), 0.5);
  // the two ends reach a little past the last point, so reaches that meet join without a gap
  float endPush = (l1 <= 1e-4 ? -1.0 : 0.0) + (l2 <= 1e-4 ? 1.0 : 0.0);
  vec2 s = c + nrm * aInfo.z * ext * miter + dir * endPush * 0.5 * w;
  vAcross = aInfo.z * ext; vHw = 0.5 * w; vEdge = edge;
  float ink = ${f(RIVER_INK.min)} + ${f(1 - RIVER_INK.min)} * smoothstep(${f(RIVER_INK.fromW)}, ${f(RIVER_INK.fullW)}, aInfo.x);
  vInk = fade * thin * ink;
  gl_Position = fade <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(s.x / uScreen.x * 2.0 - 1.0, 1.0 - s.y / uScreen.y * 2.0, 0.0, 1.0);
}
`;
const RIVER_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uScreen;
in float vAcross;
flat in float vEdge;
in float vHw;
in float vInk;
out vec4 fragColor;
void main() {
  float dist = abs(vAcross); float px = uScreen.z;
  float core = clamp((vHw - dist) * px + 0.5, 0.0, 1.0);
  float outer = max(core, vEdge > 0.0 ? clamp((vHw + vEdge - dist) * px + 0.5, 0.0, 1.0) : 0.0);
  if (outer <= 0.0 || vInk <= 0.0) discard;
  // the most covered fragment wins (water ahead of the edge): see the header
  gl_FragDepth = 1.0 - 0.5 * (outer + core);
  float w = core * ${f(RIVER_WATER_ALPHA)} * vInk;
  float e = (outer - core) * ${f(RIVER_EDGE_ALPHA)} * vInk;
  fragColor = vec4(vec3(${RIVER_WATER.map(f).join(', ')}) * w + vec3(${RIVER_EDGE.map(f).join(', ')}) * e, w + e);
}
`;

/**
 * The river layer, a mesh in `scene` (the terrain scene) at `renderOrder`: `set(strips)`
 * (riverModel.riverStrips), `update(view)` each frame. Needs a clear depth buffer under it (the
 * ground pass's clear: nothing on the ground writes depth).
 */
export const createRiverLayer = (scene, renderOrder) => {
  let geometry = new BufferGeometry();
  const uniforms = {
    uView: { value: new Vector4() }, uScreen: { value: new Vector3(1, 1, 1) }, uCamX: { value: 0 }, uProj: { value: new Vector3() },
    uFade: { value: new Array(RANKS).fill(0) }
  };
  const material = new ShaderMaterial({
    glslVersion: GLSL3, vertexShader: RIVER_VERTEX, fragmentShader: RIVER_FRAGMENT, uniforms,
    transparent: true, premultipliedAlpha: true, depthTest: true, depthWrite: true, depthFunc: LessDepth, side: DoubleSide
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = renderOrder; mesh.visible = false;
  scene.add(mesh);
  let count = 0;
  const layer = {
    hidden: false, // a speed comparison (GLMapView __glMap.timeFrames)
    set: ({ cur, prev, next, info, index, vertices }) => {
      const g = new BufferGeometry();
      g.setAttribute('aCur', new BufferAttribute(cur, 2)); g.setAttribute('aPrev', new BufferAttribute(prev, 2));
      g.setAttribute('aNext', new BufferAttribute(next, 2)); g.setAttribute('aInfo', new BufferAttribute(info, 4));
      // three.js counts vertices by a position: the point itself (the shader does not read it)
      g.setAttribute('position', new BufferAttribute(cur, 2));
      g.setIndex(new BufferAttribute(index, 1));
      mesh.geometry = g;
      geometry.dispose();
      geometry = g;
      count = vertices;
    },
    update: (v) => {
      uniforms.uView.value.set(v.worldLeft, v.worldTop, v.k, v.worldW);
      uniforms.uScreen.value.set(v.width, v.height, v.dpr);
      uniforms.uCamX.value = v.camX;
      uniforms.uProj.value.set(v.proj.cx, v.proj.cy, v.proj.s);
      let any = false;
      for (let r = 0; r < RANKS; r++) { const fr = riverFade(r, v.k); uniforms.uFade.value[r] = fr; if (fr > 0) any = true; }
      mesh.visible = count > 0 && any && !layer.hidden;
    },
    count: () => count,
    dispose: () => { scene.remove(mesh); geometry.dispose(); material.dispose(); }
  };
  return layer;
};
