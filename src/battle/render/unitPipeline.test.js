// The rest of the unit pipeline: per-instance variants (skin tone, emblem cell, cloth jitter), the
// zoom-driven LOD, far-zoom imposters, GLB overrides of the procedural models, and the preload
// registry that picks the models a battle needs.
import { describe, it, expect, afterEach } from 'vitest';
import { OrthographicCamera, Object3D, BoxGeometry } from 'three';
import { emblemCellUv, emblemCellFor, writeSoldierVariant, SKIN_TONES, EMBLEM_CELLS, getEmblemAtlas } from './unitVariants';
import { ZoomLOD, IMPOSTER_DISTANCE, IMPOSTER_ZOOM } from './zoomLod';
import {
  getSoldierGeometry, getImposterGeometry, registerSoldierGeometry, unregisterSoldierGeometry, getProceduralSoldierGeometry,
  RIG_ATTRIBUTES, LIMB, PART
} from './soldierFactory';
import { battleModelPairs, findUnitModel, preloadUnitModels, needsUnitModels } from './unitModels';

describe('instance variants', () => {
  it('maps an emblem cell to its own inset square of the atlas', () => {
    const [u0, v0] = emblemCellUv(0, 0, 0);
    const [u1, v1] = emblemCellUv(0, 1, 1);
    expect(u0).toBeGreaterThan(0); expect(u1).toBeLessThan(0.25);
    expect(v0).toBeGreaterThan(0); expect(v1).toBeLessThan(0.25);
    const [u, v] = emblemCellUv(6, 0.5, 0.5); // column 2, row 1
    expect(u).toBeCloseTo(2.5 / 4, 5); expect(v).toBeCloseTo(1.5 / 4, 5);
    expect(emblemCellUv(99, 2, -1)).toEqual(emblemCellUv(EMBLEM_CELLS - 1, 1, 0)); // clamped
  });

  it('gives each army its own half of the heraldry and every soldier a skin tone', () => {
    for (let s = 0; s < 40; s++) {
      expect(emblemCellFor(0, s)).toBeGreaterThanOrEqual(0); expect(emblemCellFor(0, s)).toBeLessThan(8);
      expect(emblemCellFor(1, s)).toBeGreaterThanOrEqual(8); expect(emblemCellFor(1, s)).toBeLessThan(16);
    }
    const arr = new Float32Array(4 * 200); const tones = new Set();
    for (let i = 0; i < 200; i++) {
      writeSoldierVariant(arr, i, 3, 1, i);
      tones.add(arr[i * 4]);
      expect(arr[i * 4 + 1]).toBe(emblemCellFor(1, 3)); // one device per squad
      expect(Math.abs(arr[i * 4 + 2])).toBeLessThanOrEqual(1);
    }
    expect(tones.size).toBe(SKIN_TONES.length);
  });

  it('falls back to a blank atlas where there is no canvas', () => {
    expect(getEmblemAtlas().image.width).toBe(1);
  });
});

describe('ZoomLOD', () => {
  const lod = () => { const l = new ZoomLOD(120); l.addLevel(new Object3D(), 0); l.addLevel(new Object3D(), IMPOSTER_DISTANCE, 0.06); return l; };
  const cam = (zoom, x = 0) => { const c = new OrthographicCamera(); c.zoom = zoom; c.position.set(x, 50, 0); c.updateMatrixWorld(); return c; };

  it('swaps to the imposter when zoomed out, whatever the camera is looking at', () => {
    const l = lod();
    l.update(cam(1)); expect(l.getCurrentLevel()).toBe(0);
    l.update(cam(0.6)); expect(l.getCurrentLevel()).toBe(1);
    l.update(cam(0.6, 5000)); expect(l.getCurrentLevel()).toBe(1); // panning doesn't matter
    l.update(cam(1.5, 5000)); expect(l.getCurrentLevel()).toBe(0);
    expect(l.levels[0].object.visible).toBe(true); expect(l.levels[1].object.visible).toBe(false);
  });

  it('holds its level across the threshold (no flicker while pinching)', () => {
    const l = lod();
    l.update(cam(IMPOSTER_ZOOM * 0.95)); expect(l.getCurrentLevel()).toBe(1);
    l.update(cam(IMPOSTER_ZOOM * 1.03)); expect(l.getCurrentLevel()).toBe(1);
    l.update(cam(IMPOSTER_ZOOM * 1.1)); expect(l.getCurrentLevel()).toBe(0);
  });
});

describe('imposters and overrides', () => {
  afterEach(() => unregisterSoldierGeometry('bronze', 'infantry'));

  it('builds a tiny imposter with the same rig attributes for every kind of unit', () => {
    [['kingdoms', 'infantry'], ['kingdoms', 'cavalry'], ['gunpowder', 'siege'], ['modern', 'cavalry'], ['modern', 'air']].forEach(([a, c]) => {
      const imp = getImposterGeometry(a, c);
      const full = getSoldierGeometry(a, c);
      Object.keys(RIG_ATTRIBUTES).forEach((k) => expect(imp.attributes[k], `${a} ${c} ${k}`).toBeDefined());
      expect(imp.attributes.position.count / 3).toBeLessThanOrEqual(60);
      expect(imp.attributes.position.count).toBeLessThanOrEqual(full.attributes.position.count);
      if (c !== 'air') expect(imp.attributes.position.count).toBeLessThanOrEqual(full.attributes.position.count / 3);
      expect(imp.attributes.aTeam.array.some((t) => t === 1)).toBe(true);
    });
    const walker = new Set(getImposterGeometry('kingdoms', 'infantry').attributes.aLimb.array);
    expect(walker.has(LIMB.LEG_L)).toBe(true);
    expect(new Set(getImposterGeometry('kingdoms', 'cavalry').attributes.aLimb.array).has(LIMB.HORSE_FRONT)).toBe(true);
  });

  it('marks faces and hands as skin and shields as emblems on the procedural soldiers', () => {
    const parts = new Set(getSoldierGeometry('bronze', 'infantry').attributes.aPart.array);
    expect(parts.has(PART.SKIN)).toBe(true);
    expect(parts.has(PART.EMBLEM)).toBe(true);
  });

  it('lets a registered GLB geometry replace the procedural model (and its imposter)', () => {
    const proc = getProceduralSoldierGeometry('bronze', 'infantry');
    const glb = registerSoldierGeometry('bronze', 'infantry', new BoxGeometry(0.4, 1, 0.3).toNonIndexed());
    expect(getSoldierGeometry('bronze', 'infantry')).toBe(glb);
    Object.keys(RIG_ATTRIBUTES).forEach((k) => expect(glb.attributes[k], k).toBeDefined());
    expect(getImposterGeometry('bronze', 'infantry').attributes.position.count).toBeLessThanOrEqual(60 * 3);
    unregisterSoldierGeometry('bronze', 'infantry');
    expect(getSoldierGeometry('bronze', 'infantry')).toBe(proc);
  });
});

describe('unit model registry', () => {
  const setup = { sides: [
    { ageId: 'bronze', units: [{ classId: 'infantry' }, { classId: 'ranged' }, { classId: 'infantry' }], reinforcements: [{ classId: 'cavalry' }] },
    { ageId: 'classical', units: [{ classId: 'infantry' }, { classId: 'naval' }] }
  ] };

  it('lists each (age, class) a battle fields once, reinforcements included, ships excluded', () => {
    expect(battleModelPairs(setup).map((p) => p.join(':')).sort()).toEqual(['bronze:cavalry', 'bronze:infantry', 'bronze:ranged', 'classical:infantry']);
  });

  it('has nothing to wait for when no model files are shipped', async () => {
    expect(findUnitModel('bronze', 'infantry')).toBeNull();
    expect(needsUnitModels(setup)).toBe(false);
    expect(await preloadUnitModels(setup)).toEqual({ loaded: [], failed: [] });
  });
});
