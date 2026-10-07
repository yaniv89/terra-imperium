// Generals and signature units (src/assets/units/<age>-general.glb, src/assets/units/signature/
// <model>.glb): found for the sides that need them, baked under their own layer keys, and absent
// (the standard alone, the base unit) when there is no file or no roster entry.
import { describe, it, expect } from 'vitest';
import { BoxGeometry } from 'three';
import { battleExtraModels, findSignatureModel, preloadUnitModels, findGeneralModel, preloadSoldierModel, unitLookOf, lookKey, findUnitModel } from './unitModels';
import { squadLookOf } from './view';
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
    // Waves 2 and 3: every Bronze and Classical people's file ships and resolves for its age and role;
    // camels and elephants carry their own drawn height (taller than a horseman)
    Object.entries(SIGNATURE_UNITS).filter(([, e]) => e.ageId === 'bronze' || e.ageId === 'classical').forEach(([id, e]) => {
      const m = findSignatureModel(id, e.ageId, e.classId);
      expect(m?.url, id).toMatch(new RegExp(`${e.model}.*\\.glb`));
      expect(m.options.quadruped, id).toBe(e.rig !== 'person' && e.rig !== 'frame');
      if (e.rig === 'camel' || e.rig === 'elephant') expect(m.options.height, id).toBeGreaterThan(2);
    });
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
    expect(findGeneralModel('classical')?.url).toMatch(/classical-general.*\.glb/); // Wave 3
    expect(findGeneralModel('kingdoms')?.url).toMatch(/kingdoms-general.*.glb/); // Wave 4
    expect(findGeneralModel('gunpowder')?.url).toMatch(/gunpowder-general.*.glb/); // Wave 5
    expect(findGeneralModel('modern')).toBeNull();
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

describe('one soldier outside a battle (the map close view)', () => {
  it("loads and registers the unit's GLB once, and says when the unit keeps the procedural body", async () => {
    const loads = [];
    const load = async (url) => { loads.push(url); return { geometry: new BoxGeometry(0.4, 1, 0.3).toNonIndexed() }; };
    const find = (age, cls) => (cls === 'infantry' ? { name: `${age}-${cls}`, url: 'test://spear', options: {} } : null);
    try {
      expect(await preloadSoldierModel('kingdoms', 'infantry', { load, find })).toBe(true);
      expect(hasSoldierOverride('kingdoms', 'infantry')).toBe(true);
      expect(await preloadSoldierModel('kingdoms', 'infantry', { load, find })).toBe(true); // already in
      expect(loads).toEqual(['test://spear']);
      expect(await preloadSoldierModel('kingdoms', 'ranged', { load, find })).toBe(false); // no file
      const broken = async () => { throw new Error('bad file'); };
      expect(await preloadSoldierModel('kingdoms', 'siege', { load: broken, find: () => ({ name: 'x', url: 'test://bad', options: {} }) })).toBe(false);
      expect(hasSoldierOverride('kingdoms', 'siege')).toBe(false);
    } finally {
      unregisterSoldierGeometry('kingdoms', 'infantry');
    }
  });
});

describe('irregular looks (raiders, mercenaries)', () => {
  it('mark a raid party, the attackers of a sack and hired bands', () => {
    expect(unitLookOf({ classId: 'cavalry', raidOf: 'indep_1' })).toBe('raider');
    expect(unitLookOf({ classId: 'infantry', mercenary: { pay: 3 } })).toBe('mercenary');
    expect(unitLookOf({ classId: 'cavalry' }, { battleType: 'raid' }, 0)).toBe('raider');
    expect(unitLookOf({ classId: 'cavalry' }, { battleType: 'sack' }, 1)).toBeNull();
    expect(unitLookOf({ classId: 'cavalry' }, { battleType: 'field' }, 0)).toBeNull();
    expect(squadLookOf({ original: { mercenary: { pay: 1 } } })).toBe('mercenary');
    expect(squadLookOf({ original: {} })).toBeNull();
    // a look replaces one class only: riders for raiders, foot for mercenaries
    expect(lookKey('raider', 'cavalry')).toBe('raider');
    expect(lookKey('raider', 'infantry')).toBeNull();
    expect(lookKey('mercenary', 'infantry')).toBe('mercenary');
  });

  it('load the raider and mercenary models of the age for the battles that have them', () => {
    const setup = { battleType: 'raid', sides: [
      { nationId: 'xx', ageId: 'bronze', units: [{ classId: 'cavalry' }, { classId: 'infantry' }] },
      { nationId: 'yy', ageId: 'bronze', units: [{ classId: 'infantry', mercenary: { pay: 2 } }, { classId: 'ranged' }] }
    ] };
    const keys = battleExtraModels(setup, { findGeneral: () => null, findSignature: () => null }).map((e) => `${e.ageId}:${e.key}:${e.classId}`);
    expect(keys).toEqual(['bronze:raider:cavalry', 'bronze:mercenary:infantry']);
    expect(findUnitModel('bronze', 'raider')?.url).toMatch(/bronze-raider.*.glb/);
    expect(findUnitModel('bronze', 'mercenary')?.url).toMatch(/bronze-mercenary.*.glb/);
    expect(battleExtraModels({ ...setup, battleType: 'field', sides: [setup.sides[0]] }, { findGeneral: () => null, findSignature: () => null })).toEqual([]);
  });
});
