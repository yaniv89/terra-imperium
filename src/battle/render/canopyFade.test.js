import { describe, it, expect } from 'vitest';
import { canopyHoles, createCanopyFade, MAX_HOLES } from './canopyFade';
import { MeshLambertMaterial } from 'three';

const sq = (idx, over = {}) => ({ idx, side: 0, alive: true, onField: true, fled: false, routed: false, striking: false, target: -1, x: 0, y: 0, ...over });

describe('canopyHoles', () => {
  it('takes the player\'s selected squads first, then the ones fighting, never the enemy\'s or the idle', () => {
    const squads = [sq(0), sq(1, { striking: true }), sq(2, { side: 1, striking: true }), sq(3), sq(4, { target: 7 })];
    expect(canopyHoles(squads, new Set([3]), 0).map((s) => s.idx)).toEqual([3, 1, 4]);
  });
  it('skips the dead, the fled, the routed and the ones off the field, and keeps to the cap', () => {
    const bad = [sq(0, { alive: false, striking: true }), sq(1, { fled: true, striking: true }), sq(2, { routed: true, striking: true }), sq(3, { onField: false, striking: true })];
    expect(canopyHoles(bad, new Set(), 0)).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => sq(i, { striking: true }));
    expect(canopyHoles(many, new Set(), 0)).toHaveLength(MAX_HOLES);
  });
});

describe('createCanopyFade', () => {
  it('patches a material once and fills the shared uniforms', () => {
    const fade = createCanopyFade();
    const m = new MeshLambertMaterial();
    fade.apply(m); const hook = m.onBeforeCompile; fade.apply(m);
    expect(m.onBeforeCompile).toBe(hook);
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <project_vertex>', fragmentShader: '#include <common>\n#include <dithering_fragment>' };
    m.onBeforeCompile(shader, null);
    expect(shader.uniforms.uCfHoles).toBe(fade.holes);
    expect(shader.fragmentShader).toContain('discard');
    fade.set([{ x: 3, z: 4, r: 2 }]);
    expect(fade.count.value).toBe(1);
    expect(fade.holes.value[0].toArray()).toEqual([3, 4, 2]);
  });
});
