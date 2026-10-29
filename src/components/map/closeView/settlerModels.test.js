// The settler party in the close view (units/settler-<age>): the band an age draws, when the party
// replaces the wagon disc, which settlers stand a party, and that the shipped files load and bake
// at the baggage train's scale.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { settlerBand, settlerModelReady, settlerModelled, settlersInSight, ownerAge } from './settlerModels';
import { findSettlerModel, findUnitModel, bakeOptionsFor, SETTLER_KEY } from '../../../battle/render/unitModels';
import { parseUnitModel } from '../../../battle/render/gltfUnitLoader';
import { settlerSprites } from '../gl/sceneModel';

const FILES = { 'bronze-settler': 1, 'kingdoms-settler': 1, 'modern-settler': 1 };
const find = (ageId, key) => (FILES[`${ageId}-${key}`] ? { name: `${ageId}-${key}`, url: `u/${ageId}`, options: {} } : null);

describe('settler models', () => {
  it('takes the latest age band at or below the owner\'s age', () => {
    expect(['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'].map((a) => settlerBand(a, find))).toEqual(['bronze', 'bronze', 'kingdoms', 'kingdoms', 'modern']);
    expect(settlerBand('bronze', () => null)).toBeNull();
    // the bundled files: one per band
    expect(findSettlerModel('classical')?.name).toBe('bronze-settler');
    expect(findSettlerModel('gunpowder')?.name).toBe('kingdoms-settler');
    expect(findSettlerModel('modern')?.name).toBe('modern-settler');
  });

  it('is drawn only once the band\'s model is registered', () => {
    expect(settlerModelReady('classical', { find, has: (a, k) => a === 'bronze' && k === SETTLER_KEY })).toBe(true);
    expect(settlerModelReady('classical', { find, has: () => false })).toBe(false);
    expect(settlerModelReady('bronze', { find: () => null, has: () => true })).toBe(false);
  });

  it('stands a party for your settlers and for others\' in sight', () => {
    const state = { playerNationId: 'me', units: {
      a: { id: 'a', classId: 'settler', ownerId: 'me', tile: 5 },
      b: { id: 'b', classId: 'settler', ownerId: 'them', tile: 6 },
      c: { id: 'c', classId: 'settler', ownerId: 'them', tile: 7 },
      d: { id: 'd', classId: 'infantry', ownerId: 'me', tile: 5 },
      e: { id: 'e', classId: 'settler', ownerId: 'me', tile: null }
    } };
    expect(settlersInSight(state, (t) => t === 6).map((u) => u.id)).toEqual(['a', 'b']);
    expect(ownerAge({ playerNationId: 'me', age: 'bronze', techAgeId: 'classical', nations: {} }, 'me')).toBe('classical');
  });

  it('the close view hides the disc of a modelled settler but keeps its tap target; the far map keeps the disc', () => {
    const state = { playerNationId: 'me', techAgeId: 'bronze', nations: {}, units: { a: { id: 'a', classId: 'settler', ownerId: 'me', tile: 5 } } };
    const projection = () => [100, 100];
    const at = (k, modelled) => settlerSprites({ state, projection, k, isVisible: () => true, dpr: 1, modelled });
    const modelled = settlerModelled(state, { find, has: () => true });
    const close = at(60, modelled);
    expect(close.sprites).toHaveLength(0);
    expect(close.hits).toHaveLength(1);
    expect(at(2, modelled).sprites).toHaveLength(1);
    expect(at(60, settlerModelled(state, { find, has: () => false })).sprites).toHaveLength(1);
  });

  it('ships the three parties; each loads and bakes at the baggage train\'s scale', async () => {
    for (const name of Object.keys(FILES)) {
      const b = readFileSync(`src/assets/units/${name}.glb`);
      const ageId = name.split('-')[0];
      const model = findSettlerModel(ageId);
      expect(model.name).toBe(name);
      const { geometry, stats } = await parseUnitModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), bakeOptionsFor(ageId, SETTLER_KEY, 'support', model));
      expect(geometry.attributes.position.count, name).toBeGreaterThan(500);
      expect(stats.scale, name).toBeGreaterThan(0);
    }
  }, 60000);

  // the scout party (map-art-8 asked for a model; built in Blender 29 Oct: the age's figure, no weapon, a pack)
  it('ships a scout for every age; each is found by class and bakes as a walking figure', async () => {
    for (const ageId of ['stone', 'bronze', 'classical', 'kingdoms', 'gunpowder', 'modern', 'information', 'future']) {
      const model = findUnitModel(ageId, 'scout');
      expect(model?.name, ageId).toBe(`${ageId}-scout`);
      const b = readFileSync(`src/assets/units/${ageId}-scout.glb`);
      const { geometry, stats } = await parseUnitModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), bakeOptionsFor(ageId, 'scout', 'scout', model));
      expect(geometry.attributes.position.count, ageId).toBeGreaterThan(500);
      expect(stats.scale, ageId).toBeGreaterThan(0);
    }
  }, 60000);
});
