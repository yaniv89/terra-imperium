import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { cityPoliticsModel, cityBuildingsModel, unrestReasons, crownActions, crownNotes, cityDevelopmentModel, UNREST_RISE_PER_TURN, UNREST_FALL_PER_TURN } from './cityPoliticsModel';
import { BUILDING_CATEGORIES } from '../../data/buildings';

describe('city politics model', () => {
  const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const paris = getNationCapital('fr');
  it('reads loyalty parts, culture shares, unrest reasons, the governor seat and candidates for the player', () => {
    const m = cityPoliticsModel(S, paris);
    expect(m.mine).toBe(true);
    expect(m.loyalty).toBe(100);
    expect(m.culture[0]).toMatchObject({ nationId: 'fr' });
    expect(m.unrestReasons.find((r) => r.id === 'control').value).toBe((S.regions[paris].control || 0) < 50 ? UNREST_RISE_PER_TURN : -UNREST_FALL_PER_TURN);
    expect(m.group.seat).toBe(paris);
    expect(Array.isArray(m.candidates)).toBe(true);
    const seated = m.candidates[0] ? gameReducer(S, { type: ActionTypes.ASSIGN_GOVERNOR, payload: { seatId: m.group.seat, candidateId: m.candidates[0].id } }) : null;
    if (seated) { const m2 = cityPoliticsModel(seated, paris); expect(m2.pending?.name).toBe(m.candidates[0].name); }
    expect(cityPoliticsModel(S, 'nope')).toBeNull();
    const foreign = cityPoliticsModel(S, getNationCapital('de'));
    expect(foreign.mine).toBe(false); expect(foreign.candidates).toEqual([]);
  });
  it('an amenity shortage, high taxes and a disaster show up', () => {
    const short = { ...S, regions: { ...S.regions, [paris]: { ...S.regions[paris], size: 12, disaster: { kind: 'plague', until: S.turnNumber + 3 } } }, nations: { ...S.nations, fr: { ...S.nations.fr, taxRate: 'high' } } };
    const reasons = unrestReasons(short, short.regions[paris]);
    expect(reasons.find((r) => r.id === 'amenities')?.value).toBeGreaterThan(0);
    expect(reasons.find((r) => r.id === 'tax')?.value).toBe(1);
    expect(cityPoliticsModel(short, paris).disaster).toEqual({ kind: 'plague', turnsLeft: 3 });
  });
  it('the buildings model lists every line with what stands and the next tier, and knows the queue', () => {
    const rows = cityBuildingsModel(S, paris);
    expect(rows.map((r) => r.category)).toEqual(Object.keys(BUILDING_CATEGORIES));
    const food = rows.find((r) => r.category === 'food');
    expect(food.next.name).toBe(BUILDING_CATEGORIES.food.tiers[food.built.length].name);
    expect(food.next.cost).toBeGreaterThan(0);
    const queued = gameReducer(S, { type: ActionTypes.QUEUE_PRODUCTION, payload: { cityId: paris, item: { kind: 'building', category: 'food', tier: food.built.length } } });
    expect(cityBuildingsModel(queued, paris).find((r) => r.category === 'food').next.queued).toBe(true);
    const naval = rows.find((r) => r.category === 'naval');
    if (naval?.next && !naval.next.canBuild) expect(naval.next.needs).toBeTruthy();
  });
});

describe('the crown in a city (the retired province tabs)', () => {
  const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const paris = getNationCapital('fr');
  it('lists the crown actions for an owned city, none for a foreign one, and each dispatches', () => {
    const actions = crownActions(S, paris);
    expect(actions.map((a) => a.id)).toEqual(['gainControl', 'quellUnrest', 'populationPolicy']);
    expect(crownActions(S, getNationCapital('de'))).toEqual([]);
    const rich = { ...S, resources: { ...S.resources, gold: 5000, adm: 500, dip: 500, mil: 500 } };
    const gain = crownActions(rich, paris).find((a) => a.id === 'gainControl');
    if (gain.enabled) expect(gameReducer(rich, { type: gain.actionType, payload: gain.payload }).regions[paris].control).toBeGreaterThan(S.regions[paris].control || 0);
    const notes = crownNotes({ ...S, regions: { ...S.regions, [paris]: { ...S.regions[paris], devastation: 20, formerOwner: 'de' } } }, paris);
    expect(notes.map((n) => n.id)).toEqual(['conquered', 'devastation']);
    const dev = cityDevelopmentModel(rich, paris);
    expect(dev.rows.map((r) => r.id)).toEqual(['dev:tax', 'dev:production', 'dev:manpower', 'infrastructure', 'defenses']);
    const tax = dev.rows[0];
    expect(tax.enabled).toBe(true);
    expect(gameReducer(rich, { type: tax.actionType, payload: tax.payload }).regions[paris].dev.tax).toBe((S.regions[paris].dev?.tax || 0) + 1);
    expect(cityDevelopmentModel(S, getNationCapital('de'))).toBeNull();
  });
  it('a second city can take the capital and a rebel-held city asks for a garrison', () => {
    const other = Object.values(S.regions).find((c) => c.owner === 'de').id;
    const s2 = { ...S, regions: { ...S.regions, [other]: { ...S.regions[other], owner: 'fr' } } };
    expect(crownActions(s2, other).find((a) => a.id === 'moveCapital')).toBeTruthy();
    const rebel = { ...s2, units: { ...s2.units, reb1: { id: 'reb1', ownerId: 'rebels', regionId: other, domain: 'land', classId: 'infantry', strength: 500, maxStrength: 500, morale: 50, spawnedTurn: 1 } } };
    const suppress = crownActions(rebel, other).find((a) => a.id === 'suppressRebellion');
    expect(suppress).toBeTruthy();
    expect(suppress.enabled).toBe(false);
    expect(suppress.reason).toBe('needs an army here');
  });
});
