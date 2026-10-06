// Soldier detail levels (phase C2): the clustered levels keep the rig and fit their triangle caps,
// and the per-frame level follows the soldiers' size on screen within the triangle budget.
import { describe, it, expect } from 'vitest';
import { simplifyRigged, soldierLodGeometries, pickSoldierTier, triangleCount, TIER_TRIS, TIER_PX } from './soldierLod';
import { getProceduralSoldierGeometry, LIMB } from './soldierFactory';
import { figureScale, scaledSoldiers } from './capacity';
import { makeBenchSetup } from '../bench/benchScenario';

describe('soldier detail levels', () => {
  it('cluster every model under its caps and keep every rig attribute', () => {
    [['classical', 'infantry'], ['classical', 'cavalry'], ['kingdoms', 'ranged'], ['modern', 'cavalry'], ['gunpowder', 'siege']].forEach(([a, c]) => {
      const full = getProceduralSoldierGeometry(a, c);
      const [l0, l1, l2] = soldierLodGeometries(full);
      expect(l0).toBe(full);
      expect(triangleCount(l1)).toBeLessThanOrEqual(TIER_TRIS[1]);
      expect(triangleCount(l2)).toBeLessThanOrEqual(TIER_TRIS[2]);
      expect(triangleCount(l2)).toBeGreaterThan(8); // still a figure, not nothing
      expect(Object.keys(l2.attributes).sort()).toEqual(Object.keys(full.attributes).sort());
      // Every vertex keeps a limb the full model had, so the shader rig still moves it.
      const limbs = new Set(full.attributes.aLimb.array);
      l2.attributes.aLimb.array.forEach((v) => expect(limbs.has(v)).toBe(true));
      expect(l2.boundingBox.max.y).toBeGreaterThan(full.boundingBox.max.y * 0.6); // keeps its height
    });
  });

  it('keeps arms and legs apart so the walk and the strike still animate', () => {
    const l1 = soldierLodGeometries(getProceduralSoldierGeometry('classical', 'infantry'))[1];
    const limbs = new Set(l1.attributes.aLimb.array);
    [LIMB.BODY, LIMB.LEG_L, LIMB.LEG_R, LIMB.ARM_R].forEach((l) => expect(limbs.has(l)).toBe(true));
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
