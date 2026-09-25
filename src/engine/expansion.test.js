import { describe, it, expect } from 'vitest';
import { applyAggressiveExpansion, decayAggressiveExpansion } from './expansion';

// getNeighborIds (src/data/regions.js) reads region TOPOLOGY from the static REGIONS_DATA world
// table by id, not from any `neighbors` field on the passed-in `regions` map — so a fake regionId
// like 'r1' below has no real neighbors and only exercises the previousOwner-gets-AE arm. The
// "the captured region's own real neighbors also get AE" behavior is exercised with real region
// ids by diplomacy.test.js's resolveWarProgress capture test instead.
describe('applyAggressiveExpansion', () => {
  const regions = {
    r1: { owner: 'attacker', dev: { tax: 5, production: 5, manpower: 0 } } // devTotal 10
  };

  it('gives the previous owner AE against the taker, proportional to the region\'s dev', () => {
    const nations = { attacker: {}, previousOwner: {} };
    const next = applyAggressiveExpansion(nations, regions, 'r1', 'previousOwner', 'attacker');
    expect(next.previousOwner.ae.attacker).toBe(10);
  });

  it('never gives the taker AE against itself even if it borders the region', () => {
    const nations = { attacker: {}, previousOwner: {} };
    const next = applyAggressiveExpansion(nations, regions, 'r1', 'previousOwner', 'attacker');
    expect(next.attacker.ae).toBeUndefined();
  });

  it('is a no-op with no previous owner (e.g. a peaceful settle, not a capture)', () => {
    const nations = { attacker: {} };
    expect(applyAggressiveExpansion(nations, regions, 'r1', null, 'attacker')).toBe(nations);
  });

  it('is a no-op when the taker captures its own region somehow', () => {
    const nations = { attacker: {} };
    expect(applyAggressiveExpansion(nations, regions, 'r1', 'attacker', 'attacker')).toBe(nations);
  });

  it('is a no-op for a region with no development', () => {
    const emptyRegions = { r1: { owner: 'attacker', dev: { tax: 0, production: 0, manpower: 0 }, neighbors: [] } };
    const nations = { attacker: {}, previousOwner: {} };
    expect(applyAggressiveExpansion(nations, emptyRegions, 'r1', 'previousOwner', 'attacker')).toBe(nations);
  });

  it('accumulates onto existing AE against the same taker rather than overwriting it', () => {
    const nations = { attacker: {}, previousOwner: { ae: { attacker: 5 } } };
    const next = applyAggressiveExpansion(nations, regions, 'r1', 'previousOwner', 'attacker');
    expect(next.previousOwner.ae.attacker).toBe(15);
  });

  it('discounts AE generation for an Isolationist taker', () => {
    const nations = { attacker: { identity: { globalism: -50 } }, previousOwner: {} };
    const next = applyAggressiveExpansion(nations, regions, 'r1', 'previousOwner', 'attacker');
    expect(next.previousOwner.ae.attacker).toBe(8); // round(10 x 0.75) rounds to 8 (7.5 -> 8)
  });
});

describe('decayAggressiveExpansion', () => {
  it('decays every AE entry by AE_DECAY_PER_TURN', () => {
    const nations = { fr: { ae: { de: 10, gb: 5 } } };
    const next = decayAggressiveExpansion(nations);
    expect(next.fr.ae).toEqual({ de: 8, gb: 3 });
  });

  it('prunes an entry once it decays below AE_PRUNE_BELOW', () => {
    const nations = { fr: { ae: { de: 2 } } };
    const next = decayAggressiveExpansion(nations);
    expect(next.fr.ae).toEqual({});
  });

  it('returns the SAME reference when no nation has any AE at all', () => {
    const nations = { fr: {}, de: { ae: {} } };
    expect(decayAggressiveExpansion(nations)).toBe(nations);
  });
});
