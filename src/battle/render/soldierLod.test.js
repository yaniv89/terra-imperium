// Soldier detail levels (phase C2): the simplified levels keep the rig, the class silhouette and
// the side's colour as an accent, and the per-frame level follows the soldiers' size on screen
// within the triangle budget.
import { describe, it, expect, beforeAll } from 'vitest';
import { Vector3 } from 'three';
import { simplifyRigged, soldierLodGeometries, pickSoldierTier, triangleCount, soldierLodReady, isSoldierLodReady, TIER_TRIS, TIER_PX } from './soldierLod';
import { getProceduralSoldierGeometry, LIMB } from './soldierFactory';
import { figureScale, scaledSoldiers } from './capacity';
import { makeBenchSetup } from '../bench/benchScenario';

// Share of the surface that wears the side's colour (non-indexed soup: every 3 vertices a face).
const teamShare = (g) => {
  const p = g.attributes.position; const t = g.attributes.aTeam; const idx = g.index;
  const a = new Vector3(); const b = new Vector3(); const c = new Vector3();
  let team = 0; let all = 0;
  const n = idx ? idx.count : p.count;
  for (let k = 0; k < n; k += 3) {
    const i = idx ? idx.getX(k) : k; const j = idx ? idx.getX(k + 1) : k + 1; const l = idx ? idx.getX(k + 2) : k + 2;
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, j); c.fromBufferAttribute(p, l);
    const area = b.sub(a).cross(c.sub(a)).length() / 2;
    all += area; if (t.getX(i) > 0.5) team += area;
  }
  return team / all;
};
const size = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; };

describe('soldier detail levels', () => {
  beforeAll(async () => { await soldierLodReady(); });

  it('simplify every model to fewer triangles and keep every rig attribute', () => {
    expect(isSoldierLodReady()).toBe(true);
    [['classical', 'infantry'], ['classical', 'cavalry'], ['kingdoms', 'ranged'], ['modern', 'cavalry'], ['gunpowder', 'siege']].forEach(([a, c]) => {
      const full = getProceduralSoldierGeometry(a, c);
      const [l0, l1, l2] = soldierLodGeometries(full);
      expect(l0).toBe(full);
      expect(triangleCount(l1)).toBeLessThanOrEqual(triangleCount(full));
      expect(triangleCount(l2)).toBeLessThanOrEqual(triangleCount(l1));
      if (triangleCount(full) > TIER_TRIS[1] * 2) expect(triangleCount(l2)).toBeLessThan(triangleCount(full) / 3);
      expect(triangleCount(l2)).toBeGreaterThan(8); // still a figure, not nothing
      expect(Object.keys(l2.attributes).sort()).toEqual(Object.keys(full.attributes).sort());
      // Every vertex keeps a limb the full model had, so the shader rig still moves it.
      const limbs = new Set(full.attributes.aLimb.array);
      l2.attributes.aLimb.array.forEach((v) => expect(limbs.has(v)).toBe(true));
    });
  });

  it('keeps the silhouette at the far level: the same height, length and width, spears and lances included', () => {
    [['classical', 'infantry'], ['kingdoms', 'infantry'], ['classical', 'cavalry'], ['kingdoms', 'cavalry'], ['gunpowder', 'cavalry']].forEach(([a, c]) => {
      const full = getProceduralSoldierGeometry(a, c);
      const far = soldierLodGeometries(full)[2];
      const [fx, , fz] = size(full); const [x, , z] = size(far);
      expect(far.boundingBox.max.y, `${a} ${c}`).toBeGreaterThan(full.boundingBox.max.y * 0.92); // a spear or lance on top is still there
      if (c === 'infantry' && a === 'classical') return; // its 3 cm sword tip sets the box: pruned
      expect(x, `${a} ${c}`).toBeGreaterThan(fx * 0.85);
      expect(z, `${a} ${c}`).toBeGreaterThan(fz * 0.85);
    });
  });

  it('never leaves only the team cloth: the far level wears the side colour no more than the full model', () => {
    // The old vertex clustering kept the team surfaces on a finer grid and collapsed the rest, so
    // squads drew as rows of blue arrows.
    [['classical', 'infantry'], ['kingdoms', 'cavalry'], ['gunpowder', 'infantry']].forEach(([a, c]) => {
      const full = getProceduralSoldierGeometry(a, c);
      const [, mid, far] = soldierLodGeometries(full);
      expect(teamShare(mid), `${a} ${c}`).toBeLessThan(teamShare(full) * 1.25 + 0.03);
      expect(teamShare(far), `${a} ${c}`).toBeLessThan(teamShare(full) * 1.25 + 0.03);
    });
  });

  it('keeps arms and legs apart so the walk and the strike still animate', () => {
    [1, 2].forEach((k) => {
      const l = soldierLodGeometries(getProceduralSoldierGeometry('classical', 'infantry'))[k];
      const limbs = new Set(l.attributes.aLimb.array);
      [LIMB.BODY, LIMB.LEG_L, LIMB.LEG_R, LIMB.ARM_R].forEach((x) => expect(limbs.has(x)).toBe(true));
    });
  });

  it('returns a model that already fits unchanged', () => {
    const g = getProceduralSoldierGeometry('classical', 'siege');
    expect(simplifyRigged(g, 1e6)).toBe(g);
  });

  it('picks the level by size on screen, with hysteresis', () => {
    const layers = [{ figures: 10, tris: [2000, 350, 80] }];
    expect(pickSoldierTier({ px: 60, layers, budget: 1e6, prev: 0 })).toBe(0);
    expect(pickSoldierTier({ px: 30, layers, budget: 1e6, prev: 1 })).toBe(1);
    expect(pickSoldierTier({ px: 10, layers, budget: 1e6, prev: 2 })).toBe(2);
    // Just under a threshold: stays on the finer level it was on, does not climb from the coarser.
    expect(pickSoldierTier({ px: TIER_PX[0] * 0.95, layers, budget: 1e6, prev: 0 })).toBe(0);
    expect(pickSoldierTier({ px: TIER_PX[0] * 1.05, layers, budget: 1e6, prev: 1 })).toBe(1);
  });

  it('adaptive detail: a bias draws finer than size on screen asks, within a lifted budget', () => {
    const layers = [{ figures: 1000, tris: [2000, 350, 80] }];
    expect(pickSoldierTier({ px: 10, layers, budget: 300000, prev: 2, bias: 1 })).toBe(1); // 350k <= 900k
    expect(pickSoldierTier({ px: 10, layers, budget: 300000, prev: 1, bias: 2 })).toBe(1); // full: 4 M > 2.7 M
    expect(pickSoldierTier({ px: 10, layers: [{ figures: 100, tris: [2000, 350, 80] }], budget: 300000, prev: 0, bias: 2 })).toBe(0);
  });

  it('drops to a coarser level when the figures in view pass the budget', () => {
    const many = [{ figures: 3000, tris: [2000, 350, 80] }];
    expect(pickSoldierTier({ px: 80, layers: many, budget: 300000, prev: 2 })).toBe(2); // 3,000 x 350 > 300k
    const some = [{ figures: 600, tris: [2000, 350, 80] }];
    expect(pickSoldierTier({ px: 80, layers: some, budget: 300000, prev: 1 })).toBe(1); // full: 600 x 2000 x 2 (shadow)
  });
});

describe('figures per squad at scale', () => {
  it('draws every soldier in a normal battle and about half at 300 a side', () => {
    expect(figureScale(makeBenchSetup(40))).toBe(1);
    const s300 = figureScale(makeBenchSetup(300));
    expect(s300).toBeGreaterThan(0.45); expect(s300).toBeLessThan(0.6);
    expect(figureScale(makeBenchSetup(1000))).toBe(0.4);
    expect(scaledSoldiers(12, s300)).toBe(6);
    expect(scaledSoldiers(1, 0.4)).toBe(1);
  });
});
