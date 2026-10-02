// src/engine/armyTemplates.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { ActionTypes } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { assertGameState } from './stateAudit';
import { getTiles } from '../data/geo/tiles';
import { processCity, productionCost, canQueue } from './world/cities';
import { DEFAULT_TEMPLATES, templatesOf, templateUnits, nextTemplateUnit, templateProgress, validateTemplate, armyOrder, saveTemplate, deleteTemplate } from './armyTemplates';

const quiet = (s) => ({ ...s, firedEvents: Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true])), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const play = (s) => {
  let x = s;
  if (x.pendingPeaceOffer) x = gameReducer(x, { type: x.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE });
  x = resolveTurn(x);
  return x.activeProceduralEvent ? { ...x, activeProceduralEvent: null } : x;
};

describe('army templates', () => {
  it('expands a composition in a fixed order and tracks the next piece', () => {
    const tpl = DEFAULT_TEMPLATES[0];
    expect(templateUnits(tpl.composition)).toEqual(['infantry', 'infantry', 'cavalry', 'ranged']);
    const item = armyOrder(tpl, { id: 'c1' }, 3);
    expect(item.armyId).toBe('army_c1_3_tpl_legion');
    expect(nextTemplateUnit(item)).toBe('infantry');
    expect(nextTemplateUnit({ ...item, built: { infantry: 2 } })).toBe('cavalry');
    expect(nextTemplateUnit({ ...item, built: { infantry: 2, cavalry: 1, ranged: 1 } })).toBeNull();
    expect(templateProgress({ ...item, built: { infantry: 1 } })).toEqual({ done: 1, total: 4 });
    expect(validateTemplate({ name: 'X', composition: { infantry: 1 } }, 'bronze').ok).toBe(true);
    expect(validateTemplate({ name: '', composition: { infantry: 1 } }, 'bronze').ok).toBe(false);
    expect(validateTemplate({ name: 'X', composition: {} }, 'bronze').ok).toBe(false);
    expect(validateTemplate({ name: 'X', composition: { air: 1 } }, 'bronze').reason).toMatch(/not available/);
    expect(productionCost(item, { ageId: 'bronze', citiesOwned: 1 })).toBe(productionCost({ kind: 'unit', classId: 'infantry' }, { ageId: 'bronze', citiesOwned: 1 }));
  });

  it('a city builds the order piece by piece, each unit tagged with the army, and the order leaves the queue when complete', () => {
    const s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 7 }));
    const tiles = getTiles();
    const cap = s.regions[getNationCapital('fr')];
    const world = { cities: s.regions, tileOwner: s.world.tileOwner, tileState: s.world.tileState };
    const item = armyOrder({ id: 't', name: 'Guard', composition: { infantry: 2 } }, cap, 1);
    expect(canQueue(cap, tiles, world, item, { researched: [], ageId: 'bronze' }).ok).toBe(true);
    const one = productionCost({ kind: 'unit', classId: 'infantry' }, { ageId: 'bronze', citiesOwned: 1 });
    let city = { ...cap, production: { current: item, queue: [{ kind: 'building', category: 'food', tier: 0 }], progress: 2 * one } };
    const r = processCity(world, tiles, city, { ageId: 'bronze', citiesOwned: 1, turnNumber: 2 });
    const units = r.completed.filter((c) => c.kind === 'unit');
    expect(units).toHaveLength(2);
    units.forEach((u) => { expect(u.classId).toBe('infantry'); expect(u.army).toEqual({ id: item.armyId, name: 'Guard' }); });
    expect(r.city.production.current).toEqual({ kind: 'building', category: 'food', tier: 0 });
    expect(r.logs.some((l) => /Guard is complete/.test(l))).toBe(true);
    const partial = processCity(world, tiles, { ...cap, production: { current: item, queue: [], progress: productionCost({ kind: 'unit', classId: 'infantry' }, { ageId: 'bronze', citiesOwned: 1 }) } }, { ageId: 'bronze', citiesOwned: 1, turnNumber: 2 });
    expect(partial.completed).toHaveLength(1);
    expect(partial.city.production.current.built).toEqual({ infantry: 1 });
  });

  it('the player saves, queues and deletes templates; the built units carry the army on the map', () => {
    let s = quiet(createInitialState({ playerNationId: 'fr', rngSeed: 7 }));
    expect(templatesOf(s.nations.fr)).toBe(DEFAULT_TEMPLATES);
    s = gameReducer(s, { type: ActionTypes.SAVE_ARMY_TEMPLATE, payload: { template: { name: 'Border guard', composition: { infantry: 1, ranged: 1 } } } });
    const mine = templatesOf(s.nations.fr);
    expect(mine).toHaveLength(DEFAULT_TEMPLATES.length + 1);
    const guard = mine[mine.length - 1];
    expect(templatesOf(gameReducer(s, { type: ActionTypes.SAVE_ARMY_TEMPLATE, payload: { template: { name: '', composition: { infantry: 1 } } } }).nations.fr)).toEqual(mine);
    const cap = getNationCapital('fr');
    s = gameReducer(s, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: cap, item: { kind: 'army', templateId: guard.id } } });
    expect(s.regions[cap].production.current).toMatchObject({ kind: 'army', templateId: guard.id, name: 'Border guard', composition: { infantry: 1, ranged: 1 } });
    s = { ...s, regions: { ...s.regions, [cap]: { ...s.regions[cap], production: { ...s.regions[cap].production, progress: 5000 } } } };
    s = play(s);
    const tagged = Object.values(s.units).filter((u) => u.ownerId === 'fr' && u.army?.name === 'Border guard');
    expect(tagged.map((u) => u.classId).sort()).toEqual(['infantry', 'ranged']);
    expect(s.regions[cap].production.current?.kind).not.toBe('army');
    assertGameState(s);
    const gone = gameReducer(s, { type: ActionTypes.DELETE_ARMY_TEMPLATE, payload: { id: guard.id } });
    expect(templatesOf(gone.nations.fr).some((t) => t.id === guard.id)).toBe(false);
    expect(saveTemplate(deleteTemplate(s.nations.fr, 'tpl_legion'), { id: 'tpl_siege_train', name: 'Siege', composition: { siege: 2 } }, 5).armyTemplates.find((t) => t.id === 'tpl_siege_train').name).toBe('Siege');
  });
});
