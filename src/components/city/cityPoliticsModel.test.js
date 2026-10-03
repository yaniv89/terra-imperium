import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import { getNationCapital } from '../../data/regions';
import { cityPoliticsModel, cityBuildingsModel, unrestReasons, UNREST_RISE_PER_TURN, UNREST_FALL_PER_TURN } from './cityPoliticsModel';
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
    expect(foreign.mine).toBe(false); expect(foreign.candidates).toEqual([]); expect(foreign.estates).toEqual([]);
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
