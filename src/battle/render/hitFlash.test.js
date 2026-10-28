// The melee readability pass (art-animation lane): a squad just hit flashes, then fades; soldiers
// carry a rim of their side's colour; striped sails tell the fleets apart.
import { describe, it, expect } from 'vitest';
import { hitFlash, HIT_FLASH_S, SIDE_RIM } from './BattleRenderer';
import { createSoldierMaterial, getProceduralSoldierGeometry } from './soldierFactory';

describe('hit flash', () => {
  it('is brightest on the hit tick and gone after HIT_FLASH_S', () => {
    const at0 = hitFlash(100, 100, 20);
    expect(at0).toBeGreaterThan(0.5);
    expect(hitFlash(100, 101, 20)).toBeLessThan(at0);
    expect(hitFlash(100, 100 + Math.ceil(HIT_FLASH_S * 20), 20)).toBe(0);
  });
  it('is off for a squad never hit or a hit from the future', () => {
    expect(hitFlash(-10000, 50)).toBe(0);
    expect(hitFlash(undefined, 50)).toBe(0);
    expect(hitFlash(60, 50)).toBe(0);
  });
});

describe('side rim', () => {
  it('compiles the rim into the soldier shader, brighter far than near', () => {
    expect(SIDE_RIM.far).toBeGreaterThan(SIDE_RIM.near);
    const mat = createSoldierMaterial({ standard: true, teamTint: 0, rim: SIDE_RIM.near });
    const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <color_vertex>', fragmentShader: '#include <color_fragment>\n#include <emissivemap_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>' };
    mat.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += vSide');
    expect(shader.vertexShader).toContain('vSide = instanceColor.rgb * (1.0 - isSkin)');
    expect(mat.customProgramCacheKey()).toContain(String(SIDE_RIM.near));
  });
});

describe('striped sails', () => {
  it('every sailing ship has team-coloured cloth beyond its pennant', () => {
    for (const age of ['bronze', 'gunpowder']) {
      const geo = getProceduralSoldierGeometry(age, 'naval');
      const team = geo.attributes.aTeam;
      let n = 0;
      for (let i = 0; i < team.count; i++) if (team.getX(i) > 0.5) n += 1;
      // a pennant is one box (24 vertices) a mast; the band adds another box a mast
      expect(n).toBeGreaterThanOrEqual(48);
    }
  });
});
