// Generals and signature units (src/assets/units/<age>-general.glb, src/assets/units/signature/
// <peopleId>.glb): found for the sides that need them, baked under their own layer keys, and absent
// (the standard alone, the base unit) when there is no file or no roster entry.
import { describe, it, expect } from 'vitest';
import { BoxGeometry } from 'three';
import { battleExtraModels, findSignatureModel, preloadUnitModels, findGeneralModel } from './unitModels';
import { hasSoldierOverride, unregisterSoldierGeometry, MODEL_SCALE } from './soldierFactory';
import { signatureUnitFor, signatureKey, baseClassOf, SIGNATURE_UNITS } from '../../data/signatureUnits';
import { createArtIndex } from '../art/artIndex';

const TABLE = { israel: { ageId: 'bronze', classId: 'infantry', name: 'Tower-shield spearmen' } };
const art = createArtIndex({ 'assets/units/signature/israel.glb': 'test://israel.glb' });

describe('signature units', () => {
  it('apply to one people, one age and one role, and need a file', () => {
    expect(SIGNATURE_UNITS).toEqual({}); // the roster is still to be confirmed
    expect(signatureUnitFor('israel', 'bronze', 'infantry', TABLE).name).toMatch(/spearmen/);
    expect(signatureUnitFor('israel', 'classical', 'infantry', TABLE)).toBeNull();
    expect(signatureUnitFor('israel', 'bronze', 'ranged', TABLE)).toBeNull();
    expect(signatureKey('infantry', 'israel')).toBe('infantry~israel');
    expect(baseClassOf('infantry~israel')).toBe('infantry');
    expect(findSignatureModel('israel', 'bronze', 'infantry', { table: TABLE, art, options: {} }).url).toBe('test://israel.glb');
    expect(findSignatureModel('israel', 'bronze', 'infantry', { table: TABLE, art: createArtIndex({}), options: {} })).toBeNull();
    expect(findSignatureModel('israel', 'bronze', 'infantry', { table: TABLE, art, options: { israel: { enabled: false } } })).toBeNull();
    expect(findSignatureModel('israel', 'bronze', 'infantry')).toBeNull(); // the game's own table is empty
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
    expect(battleExtraModels(setup)).toEqual([]); // no general files, an empty roster
    expect(findGeneralModel('bronze')).toBeNull();
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
