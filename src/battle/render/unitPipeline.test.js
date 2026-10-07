// The rest of the unit pipeline: per-instance variants (skin tone, emblem cell, cloth jitter), the
// far-zoom imposters, GLB overrides of the procedural models, and the preload
// registry that picks the models a battle needs.
import { describe, it, expect, afterEach } from 'vitest';
import { BoxGeometry } from 'three';
import { emblemCellUv, emblemCellFor, writeSoldierVariant, SKIN_TONES, EMBLEM_CELLS, getEmblemAtlas, skinToneFor, SKIN_SPREAD, DEFAULT_SKIN_TONE } from './unitVariants';
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
    const arr = new Float32Array(4 * 200); const tones = [];
    for (let i = 0; i < 200; i++) {
      writeSoldierVariant(arr, i, 3, 1, i, skinToneFor('akkad'));
      tones.push(arr[i * 4]);
      expect(arr[i * 4 + 1]).toBe(emblemCellFor(1, 3)); // one device per squad
      expect(Math.abs(arr[i * 4 + 2])).toBeLessThanOrEqual(1);
    }
    // One squad, one people: every soldier within SKIN_SPREAD of the others (never the whole
    // palette, which made one squad look like two models), but not all identical.
    expect(Math.max(...tones) - Math.min(...tones)).toBeLessThanOrEqual(SKIN_SPREAD);
    expect(new Set(tones).size).toBeGreaterThan(10);
    tones.forEach((t) => { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(SKIN_TONES.length - 1); });
  });

  it('gives each people its own skin tone and everyone else the middle of the palette', () => {
    expect(skinToneFor('akkad')).toBe(skinToneFor('israel')); // both Near East
    expect(skinToneFor('celtiberia')).toBeLessThan(skinToneFor('akkad')); // Europe paler
    expect(skinToneFor(null)).toBe(DEFAULT_SKIN_TONE);
    expect(skinToneFor('no-such-nation')).toBe(DEFAULT_SKIN_TONE);
  });

  it('falls back to a blank atlas where there is no canvas', () => {
    expect(getEmblemAtlas().image.width).toBe(1);
  });
});

describe('imposters and overrides', () => {
  afterEach(() => unregisterSoldierGeometry('bronze', 'infantry'));

  it('reduces tessellation while preserving rig attributes and unit silhouettes', () => {
    [['kingdoms', 'infantry'], ['kingdoms', 'cavalry'], ['gunpowder', 'siege'], ['modern', 'cavalry'], ['modern', 'air']].forEach(([a, c]) => {
      const imp = getImposterGeometry(a, c);
      const full = getSoldierGeometry(a, c);
      Object.keys(RIG_ATTRIBUTES).forEach((k) => expect(imp.attributes[k], `${a} ${c} ${k}`).toBeDefined());
      expect(imp.attributes.position.count).toBeLessThanOrEqual(full.attributes.position.count);
      expect(imp.boundingBox.min.distanceTo(full.boundingBox.min)).toBeLessThan(0.035);
      expect(imp.boundingBox.max.distanceTo(full.boundingBox.max)).toBeLessThan(0.035);
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
    { ageId: 'kingdoms', units: [{ classId: 'infantry' }, { classId: 'naval' }] }
  ] };

  it('lists each (age, class) a battle fields once, reinforcements included, ships excluded', () => {
    expect(battleModelPairs(setup).map((p) => p.join(':')).sort()).toEqual(['bronze:cavalry', 'bronze:infantry', 'bronze:ranged', 'kingdoms:infantry']);
  });

  it('resolves the Bronze and Classical sets to their delivered GLBs and every other age to the procedural model (the old recipes stay disabled)', () => {
    // Waves 1 and 3 (plans/ART-MODELS-PLAN.md): src/assets/units/<age>-<class>.glb with an enabling JSON
    ['bronze', 'classical'].forEach((age) => ['infantry', 'cavalry', 'ranged', 'siege', 'support', 'worker'].forEach((cls) => {
      const m = findUnitModel(age, cls);
      expect(m?.name, `${age}-${cls}`).toBe(`${age}-${cls}`);
      expect(m.recipe).toBeUndefined();
      expect(m.url).toMatch(new RegExp(`${age}-.*\\.glb`));
    }));
    expect(findUnitModel('bronze', 'cavalry').options.quadruped).toBe(true);
    expect(findUnitModel('bronze', 'support').options.quadruped).toBe(true);
    expect(findUnitModel('classical', 'cavalry').options.quadruped).toBe(true);
    expect(findUnitModel('classical', 'support').options.quadruped).toBe(false);
    ['kingdoms', 'gunpowder', 'modern'].forEach((age) => ['infantry', 'cavalry', 'ranged', 'siege'].forEach((cls) => {
      expect(findUnitModel(age, cls), `${age}-${cls}`).toBeNull();
    }));
    expect(findUnitModel('bronze', 'naval')).toBeNull();
  });

  it('composes each recipe once per age, registers it, and keeps the procedural model on failure', async () => {
    const pairs = battleModelPairs(setup);
    expect(needsUnitModels(setup)).toBe(true); // the Bronze GLBs ship
    expect(needsUnitModels({ sides: [setup.sides[1]] })).toBe(false); // Kingdoms has none yet
    const calls = [];
    const compose = async (recipe, { ageId }) => {
      calls.push(`${recipe.base}@${ageId}`);
      if (ageId === 'kingdoms') throw new Error('boom');
      return { geometry: new BoxGeometry(0.4, 1, 0.3).toNonIndexed() };
    };
    const warn = console.warn; console.warn = () => {};
    try {
      const r = await preloadUnitModels(setup, { compose, find:(age,cls)=>({name:age+'-'+cls,url:'recipe:test-'+age+'-'+cls,recipe:{base:'test'}}) });
      expect(r.loaded.sort()).toEqual(['bronze-cavalry', 'bronze-infantry', 'bronze-ranged']);
      expect(r.failed.map((f) => f.name)).toEqual(['kingdoms-infantry']);
      expect(calls.length).toBe(pairs.length);
      expect(needsUnitModels({ sides: [setup.sides[0]] })).toBe(false); // bronze is now baked
      expect(getSoldierGeometry('kingdoms', 'infantry')).toBe(getProceduralSoldierGeometry('kingdoms', 'infantry'));
    } finally {
      console.warn = warn;
      ['infantry', 'ranged', 'cavalry'].forEach((c) => unregisterSoldierGeometry('bronze', c));
    }
  });
});

describe('GPU attribute budget', () => {
  it('a soldier layer stays within WebGL\'s 16 vertex attributes (instanceMatrix counts 4)', async () => {
    const { packForGPU } = await import('./soldierFactory');
    ['infantry', 'cavalry', 'siege'].forEach((c) => {
      const gpu = packForGPU(getSoldierGeometry('kingdoms', c).clone());
      const perVertex = Object.keys(gpu.attributes).length + 2; // + aAnim, aVariant added per layer
      expect(perVertex + 4 + 1).toBeLessThanOrEqual(16); // + instanceMatrix (4) + instanceColor
      expect(gpu.attributes.aLook.itemSize).toBe(4);
      expect(gpu.attributes.aTeam).toBeUndefined();
    });
  });
});
