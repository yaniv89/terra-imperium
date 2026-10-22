// src/battle/render/canopyFade.js
// Trees and roofs over your troops stop hiding them (battle readability): the crown of a tree or
// the roof of a house near a squad you have selected, or one of yours that is fighting, is
// stippled away (a screen-door dither, no blending, no sorting) while the trunk and the walls stay.
// The models keep their size: nothing is scaled, swapped or cut, only fragments above FADE_FROM
// tiles over the foot of the model are discarded, inside FADE_RADIUS of a hole. One uniform list
// is shared by every prop material of a battle (`apply` patches a material once).
import { Vector3 } from 'three';

export const MAX_HOLES = 16;
/** Fragments lower than this over the foot of the model (the trunk, the walls) are never faded. */
export const FADE_FROM = 0.5;
/** Most of the crown is gone in the middle of a hole, and none past its edge. */
export const FADE_STRENGTH = 0.85;

/** The ground points to clear: x, z and radius (tiles) of the player's selected squads and the ones fighting. Selected come first, at most `cap`. */
export const canopyHoles = (squads, selected, playerSide, cap = MAX_HOLES) => {
  const out = [];
  const take = (pass) => squads.forEach((s) => {
    if (out.length >= cap || !s || s.side !== playerSide || !s.alive || !s.onField || s.fled) return;
    const sel = selected?.has?.(s.idx);
    const fight = !s.routed && (s.striking || s.target >= 0);
    if (pass === 0 ? sel : (!sel && fight)) out.push(s);
  });
  take(0); take(1);
  return out;
};

const PATCHED = Symbol('canopyFade');

function patch(shader, fade) {
  shader.uniforms.uCfHoles = fade.holes;
  shader.uniforms.uCfCount = fade.count;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCf;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      {
        mat4 cfM = modelMatrix;
        #ifdef USE_INSTANCING
          cfM = modelMatrix * instanceMatrix;
        #endif
        vec4 cfW = cfM * vec4(transformed, 1.0);
        vec4 cfB = cfM * vec4(0.0, 0.0, 0.0, 1.0);
        vCf = vec3(cfW.x, cfW.z, cfW.y - cfB.y);
      }`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vCf;
      uniform vec3 uCfHoles[${MAX_HOLES}];
      uniform int uCfCount;`)
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if (uCfCount > 0 && vCf.z > ${FADE_FROM.toFixed(2)}) {
        float cfF = 0.0;
        for (int i = 0; i < ${MAX_HOLES}; i++) {
          if (i >= uCfCount) break;
          vec3 h = uCfHoles[i];
          cfF = max(cfF, 1.0 - smoothstep(h.z * 0.55, h.z, distance(vCf.xy, h.xy)));
        }
        // interleaved gradient noise: a steady stipple that does not crawl as the camera moves
        float cfN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (cfN < cfF * ${FADE_STRENGTH.toFixed(2)}) discard;
      }`);
}

/** The shared hole list of one battle's renderer. */
export const createCanopyFade = () => {
  const holes = { value: Array.from({ length: MAX_HOLES }, () => new Vector3()) };
  const count = { value: 0 };
  const fade = {
    holes, count,
    /** Patch a material (or an array of them) so it fades over the holes. Safe to call twice. */
    apply(material) {
      (Array.isArray(material) ? material : [material]).forEach((m) => {
        if (!m || m[PATCHED]) return;
        m[PATCHED] = true;
        const before = m.onBeforeCompile;
        // One function text for every material: three keys its program cache on it.
        m.onBeforeCompile = function canopyFadeCompile(shader, renderer) { before?.call(this, shader, renderer); patch(shader, fade); };
        m.needsUpdate = true;
      });
      return material;
    },
    /** Set this frame's holes from squads ({ x, z, r } in tiles). */
    set(list) {
      const n = Math.min(MAX_HOLES, list.length);
      for (let i = 0; i < n; i++) holes.value[i].set(list[i].x, list[i].z, list[i].r);
      count.value = n;
    }
  };
  return fade;
};
