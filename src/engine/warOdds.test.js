import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { perceivedArmy, warOdds, exposure, prizeOf, warValue, INTEL_ERROR } from './warOdds';
import { canSeeTile } from './sight';

const cap = getNationCapital;
const unit = (id, ownerId, regionId, tile, strength = 1000, classId = 'infantry') => ({ id, ownerId, regionId, tile, domain: 'land', classId, strength, maxStrength: 1000, morale: 100 });

describe('warOdds: how an AI sizes up a war', () => {
  const base = () => {
    const s = createInitialState({ playerNationId: 'au', rngSeed: 7 });
    const paris = s.regions[cap('fr')]; const berlin = s.regions[cap('de')];
    return { s: { ...s, units: {}, wars: [], nations: { ...s.nations, fr: { ...s.nations.fr, militaryStrength: 0 }, de: { ...s.nations.de, militaryStrength: 0 } } }, paris, berlin };
  };

  it('sees its own army and units in sight exactly, and guesses the hidden ones within the intel error', () => {
    const { s, paris, berlin } = base();
    const units = { d1: unit('d1', 'de', berlin.id, berlin.tile), d2: unit('d2', 'de', berlin.id, paris.tile), f1: unit('f1', 'fr', paris.id, paris.tile) };
    const st = { ...s, units };
    expect(canSeeTile(st, berlin.tile, 'fr')).toBe(false);
    expect(perceivedArmy(st, 'fr', 'fr').map((u) => u.strength)).toEqual([1000]);
    const seen = perceivedArmy(st, 'fr', 'de');
    const hidden = seen[0].strength; const visible = seen[1].strength;
    expect(visible).toBe(1000);
    expect(hidden).toBeGreaterThanOrEqual(1000 * (1 - INTEL_ERROR));
    expect(hidden).toBeLessThanOrEqual(1000 * (1 + INTEL_ERROR));
    // Deterministic: the same report on the same turn.
    expect(perceivedArmy(st, 'fr', 'de')[0].strength).toBe(hidden);
  });

  it('the bigger army has the better odds, and a nation busy in another war counts as weaker', () => {
    const { s, paris, berlin } = base();
    const units = {
      f1: unit('f1', 'fr', paris.id, paris.tile), f2: unit('f2', 'fr', paris.id, paris.tile),
      d1: unit('d1', 'de', berlin.id, berlin.tile)
    };
    const st = { ...s, units };
    const p = warOdds(st, 'fr', 'de', null);
    expect(p).toBeGreaterThan(0.6);
    expect(warOdds(st, 'de', 'fr', null)).toBeLessThan(0.4);
    const busy = { ...st, wars: [{ id: 'w', active: true, aggressor: 'de', enemy: 'it' }] };
    expect(warOdds(busy, 'fr', 'de', null)).toBeGreaterThan(p);
  });

  it('exposure and prize are the development of the cities that touch the other side', () => {
    // Real Dawn capitals: Berlin borders Paris (the same story aiLogic.test.js uses).
    const regions = { [cap('de')]: { owner: 'de', dev: { tax: 3, production: 3, manpower: 3 } }, [cap('fr')]: { owner: 'fr', dev: { tax: 2, production: 2, manpower: 2 } } };
    const st = { regions, nations: { de: { id: 'de' }, fr: { id: 'fr' } }, units: {}, wars: [] };
    expect(exposure(st, 'fr', 'de')).toBe(100);
    expect(prizeOf(st, 'fr', 'de')).toBe(100); // 9 dev of Berlin against France's 6, capped at 100
    expect(prizeOf(st, 'de', 'fr')).toBeCloseTo(100 * 6 / 9, 6);
    expect(exposure(st, 'fr', 'it')).toBe(0);
  });

  it('a war is worth it only against a weaker neighbour', () => {
    const regions = { [cap('de')]: { owner: 'de', dev: { tax: 3, production: 3, manpower: 3 } }, [cap('fr')]: { owner: 'fr', dev: { tax: 3, production: 3, manpower: 3 } } };
    const nations = { de: { id: 'de', militaryStrength: 30000 }, fr: { id: 'fr', militaryStrength: 10000 } };
    const st = { regions, nations, units: {}, wars: [], age: 'bronze' };
    expect(warValue(st, 'de', 'fr').ev).toBeGreaterThan(0);
    expect(warValue(st, 'fr', 'de').ev).toBeLessThan(0);
  });
});
