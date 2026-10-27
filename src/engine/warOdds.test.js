import { describe, it, expect } from 'vitest';
import { getNationCapital } from '../data/regions';
import { perceivedArmy, armiesByOwner, warOdds, exposure, prizeOf, warValue, INTEL_ERROR } from './warOdds';
import { canSeeTile } from './sight';
import { neighbourWorld, rivalOf, borderPair } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 7 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);
const IT_ID = rivalOf(PEOPLES_WORLD, 1);

const cap = getNationCapital;
const unit = (id, ownerId, regionId, tile, strength = 1000, classId = 'infantry') => ({ id, ownerId, regionId, tile, domain: 'land', classId, strength, maxStrength: 1000, morale: 100 });

describe('warOdds: how an AI sizes up a war', () => {
  const base = () => {
    const s = neighbourWorld({ seed: 7 });
    const paris = s.regions[cap(FR_ID)]; const berlin = s.regions[cap(DE_ID)];
    return { s: { ...s, units: {}, wars: [], nations: { ...s.nations, [FR_ID]: { ...s.nations[FR_ID], militaryStrength: 0 }, [DE_ID]: { ...s.nations[DE_ID], militaryStrength: 0 } } }, paris, berlin };
  };

  it('sees its own army and units in sight exactly, and guesses the hidden ones within the intel error', () => {
    const { s, paris, berlin } = base();
    const units = { d1: unit('d1', DE_ID, berlin.id, berlin.tile), d2: unit('d2', DE_ID, berlin.id, paris.tile), f1: unit('f1', FR_ID, paris.id, paris.tile) };
    const st = { ...s, units };
    expect(canSeeTile(st, berlin.tile, FR_ID)).toBe(false);
    expect(perceivedArmy(st, FR_ID, FR_ID).map((u) => u.strength)).toEqual([1000]);
    const seen = perceivedArmy(st, FR_ID, DE_ID);
    const hidden = seen[0].strength; const visible = seen[1].strength;
    expect(visible).toBe(1000);
    expect(hidden).toBeGreaterThanOrEqual(1000 * (1 - INTEL_ERROR));
    expect(hidden).toBeLessThanOrEqual(1000 * (1 + INTEL_ERROR));
    // Deterministic: the same report on the same turn.
    expect(perceivedArmy(st, FR_ID, DE_ID)[0].strength).toBe(hidden);
    // A pass's one-walk index gives the same picture.
    expect(perceivedArmy(st, FR_ID, DE_ID, armiesByOwner(st.units))).toEqual(seen);
    // Sight is read fresh: a unit of the viewer moved in place (a turn's working copy) counts at once.
    st.units.f1 = { ...st.units.f1, tile: berlin.tile };
    expect(perceivedArmy(st, FR_ID, DE_ID)[0].strength).toBe(1000);
  });

  it('the bigger army has the better odds, and a nation busy in another war counts as weaker', () => {
    const { s, paris, berlin } = base();
    const units = {
      f1: unit('f1', FR_ID, paris.id, paris.tile), f2: unit('f2', FR_ID, paris.id, paris.tile),
      d1: unit('d1', DE_ID, berlin.id, berlin.tile)
    };
    const st = { ...s, units };
    const p = warOdds(st, FR_ID, DE_ID, null);
    expect(p).toBeGreaterThan(0.6);
    expect(warOdds(st, DE_ID, FR_ID, null)).toBeLessThan(0.4);
    const busy = { ...st, wars: [{ id: 'w', active: true, aggressor: DE_ID, enemy: IT_ID }] };
    expect(warOdds(busy, FR_ID, DE_ID, null)).toBeGreaterThan(p);
  });

  const [frC, deC] = borderPair(PEOPLES_WORLD, FR_ID, DE_ID); // two cities that touch
  it('exposure and prize are the development of the cities that touch the other side', () => {
    // Real Dawn capitals: Berlin borders Paris (the same story aiLogic.test.js uses).
    const regions = { [deC]: { owner: DE_ID, dev: { tax: 3, production: 3, manpower: 3 } }, [frC]: { owner: FR_ID, dev: { tax: 2, production: 2, manpower: 2 } } };
    const st = { regions, nations: { [DE_ID]: { id: DE_ID }, [FR_ID]: { id: FR_ID } }, units: {}, wars: [] };
    expect(exposure(st, FR_ID, DE_ID)).toBe(100);
    expect(prizeOf(st, FR_ID, DE_ID)).toBe(100); // 9 dev of Berlin against France's 6, capped at 100
    expect(prizeOf(st, DE_ID, FR_ID)).toBeCloseTo(100 * 6 / 9, 6);
    expect(exposure(st, FR_ID, IT_ID)).toBe(0);
  });

  it('a war is worth it only against a weaker neighbour', () => {
    const regions = { [deC]: { owner: DE_ID, dev: { tax: 3, production: 3, manpower: 3 } }, [frC]: { owner: FR_ID, dev: { tax: 3, production: 3, manpower: 3 } } };
    const nations = { [DE_ID]: { id: DE_ID, militaryStrength: 30000 }, [FR_ID]: { id: FR_ID, militaryStrength: 10000 } };
    const st = { regions, nations, units: {}, wars: [], age: 'bronze' };
    expect(warValue(st, DE_ID, FR_ID).ev).toBeGreaterThan(0);
    expect(warValue(st, FR_ID, DE_ID).ev).toBeLessThan(0);
  });
});
