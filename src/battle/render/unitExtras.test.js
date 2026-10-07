// Generals and signature units (src/assets/units/<age>-general.glb, src/assets/units/signature/
// <model>.glb): found for the sides that need them, baked under their own layer keys, and absent
// (the standard alone, the base unit) when there is no file or no roster entry.
import { describe, it, expect } from 'vitest';
import { BoxGeometry } from 'three';
import { battleExtraModels, findSignatureModel, preloadUnitModels, findGeneralModel } from './unitModels';
import { hasSoldierOverride, unregisterSoldierGeometry, MODEL_SCALE } from './soldierFactory';
import { signatureUnitFor, signatureKey, baseClassOf, SIGNATURE_UNITS } from '../../data/signatureUnits';
import { createArtIndex } from '../art/artIndex';
import { PEOPLES } from '../../data/peoples';
import { AGE_ORDER } from '../../data/ages';

const TABLE = { israel: { ageId: 'bronze', classId: 'infantry', model: 'israel-spear', rig: 'person', name: 'Tower-shield spearmen' } };
const art = createArtIndex({ 'assets/units/signature/israel-spear.glb': 'test://israel.glb', 'assets/units/signature/kingdom-of-israel.glb': 'test://merkava.glb' });

describe('signature units', () => {
  it('apply to one people, one age and one role, and need a file', () => {
    // the roster: 150 peoples, one each, any role (Israel: the Merkava, a Modern tank)
    expect(Object.keys(SIGNATURE_UNITS)).toHaveLength(150);
    expect(SIGNATURE_UNITS.israel).toMatchObject({ ageId: 'modern', classId: 'cavalry', model: 'kingdom-of-israel', rig: 'tank' });
    Object.entries(SIGNATURE_UNITS).forEach(([id, e]) => {
      expect(PEOPLES[id], id).toBeTruthy();
      expect(AGE_ORDER).toContain(e.ageId);
      expect(['infantry', 'ranged', 'cavalry', 'siege', 'support', 'air', 'naval']).toContain(e.classId);
      expect(e.model).toMatch(/^[a-z0-9-]+$/);
    });
    const tank = findSignatureModel('israel', 'modern', 'cavalry', { art, options: {} });
    expect(tank.url).toBe('test://merkava.glb');
    expect(tank.options.quadruped).toBe(false); // a tank, not a horse
    expect(findSignatureModel('israel', 'gunpowder', 'cavalry', { art, options: {} })).toBeNull(); // another age: the base unit
    expect(signatureUnitFor('israel', 'bronze', 'infantry', TABLE).name).toMatch(/spearmen/);
    expect(signatureUnitFor('israel', 'classical', 'infantry', TABLE)).toBeNull();
    expect(signatureUnitFor('israel', 'bronze', 'ranged', TABLE)).toBeNull();
    expect(signatureKey('infantry', 'israel')).toBe('infantry~israel');
    expect(baseClassOf('infantry~israel')).toBe('infantry');
    expect(findSignatureModel('israel', 'bronze', 'infantry', { table: TABLE, art, options: {} }).url).toBe('test://israel.glb');
    expect(findSignatureModel('israel', 'bronze', 'infantry', { table: TABLE, art: createArtIndex({}), options: {} })).toBeNull();
    expect(findSignatureModel('israel', 'bronze', 'infantry', { table: TABLE, art, options: { 'israel-spear': { enabled: false } } })).toBeNull();
    expect(findSignatureModel('israel', 'modern', 'cavalry')).toBeNull(); // no file in the game yet
  });
});

describe('extra battle models', () => {
  const setup = { sides: [
    { nationId: 'israel', ageId: 'bronze', units: [{ classId: 'infantry', commanderId: 'g1' }, { classId: 'ranged' }] },
    { nationId: 'xx', ageId: 'classical', units: [{ classId: 'infantry' }] }
  ] };
  const findGeneral = (age) => (age === 'bronze' ? { name: 'bronze-general', url: 'test://general', options: {} } : null);
  const findSignature = (p, age, c) => findSignatureModel(p, age, c, { table: TABLE, art, options: {} });

  it('list a general for sides with commanders and the people\'s signature unit', () => {
    const extras = battleExtraModels(setup, { findGeneral, findSignature });
    expect(extras.map((e) => `${e.ageId}:${e.key}:${e.classId}`)).toEqual(['bronze:general:cavalry', 'bronze:infantry~israel:infantry']);
    // the Bronze general ships (src/assets/units/bronze-general.glb); no signature files yet
    expect(battleExtraModels(setup).map((e) => `${e.ageId}:${e.key}:${e.classId}`)).toEqual(['bronze:general:cavalry']);
    expect(findGeneralModel('bronze')?.url).toMatch(/bronze-general.*\.glb/);
    expect(findGeneralModel('classical')).toBeNull();
    expect(MODEL_SCALE.general).toBeGreaterThan(MODEL_SCALE.cavalry);
  });

  it('bake and register under their own keys; the base layers stay untouched', async () => {
    const loads = [];
    const load = async (url, opts) => { loads.push([url, opts.quadruped]); return { geometry: new BoxGeometry(0.4, 1, 0.3).toNonIndexed() }; };
    try {
      const r = await preloadUnitModels(setup, { load, find: () => null, extras: (s) => battleExtraModels(s, { findGeneral, findSignature }) });
      expect(r.loaded.sort()).toEqual(['bronze-general', 'bronze-infantry~israel']);
      expect(loads).toContainEqual(['test://general', true]);
      expect(hasSoldierOverride('bronze', 'general')).toBe(true);
      expect(hasSoldierOverride('bronze', 'infantry~israel')).toBe(true);
      expect(hasSoldierOverride('bronze', 'infantry')).toBe(false);
    } finally {
      unregisterSoldierGeometry('bronze', 'general'); unregisterSoldierGeometry('bronze', 'infantry~israel');
    }
  });
});
