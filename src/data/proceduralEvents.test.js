import { describe, it, expect } from 'vitest';
import { pickProceduralEvent } from './proceduralEvents';
import { createInitialState } from '../context/GameContext';
import { createRng } from '../utils/rng';

describe('pickProceduralEvent', () => {
  it('returns a real, well-formed event for at least one seed against the initial state', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const results = Array.from({ length: 20 }, (_, seed) => pickProceduralEvent(state, createRng(seed)));
    const hits = results.filter(Boolean);
    expect(hits.length).toBeGreaterThan(0);
    hits.forEach(event => {
      expect(event.title).toBeTruthy();
      expect(event.description).toBeTruthy();
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      event.options.forEach(option => {
        expect(option.label).toBeTruthy();
        expect(Object.keys(option.effects || {}).length).toBeGreaterThan(0);
      });
      expect(event.procedural).toBe(true);
      expect(event.id).toMatch(/^procedural_.+_\d+$/);
    });
  });

  it('is deterministic given the same state and seed', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const a = pickProceduralEvent(state, createRng(7));
    const b = pickProceduralEvent(state, createRng(7));
    expect(a).toEqual(b);
  });

  it('substitutes the actual player nation\'s own region name into the description', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const results = Array.from({ length: 20 }, (_, seed) => pickProceduralEvent(state, createRng(seed)));
    const hit = results.find(e => e && !e.id.includes('ambitious_general') && !e.id.includes('throne_pretender'));
    expect(hit.description).toContain('France');
  });

  it('only offers the ambitious-general template once a general is actually hired', () => {
    const withoutGenerals = createInitialState({ playerNationId: 'us' });
    const noGeneralHit = Array.from({ length: 30 }, (_, seed) => pickProceduralEvent(withoutGenerals, createRng(seed)))
      .some(e => e?.id.includes('ambitious_general'));
    expect(noGeneralHit).toBe(false);

    const general = { id: 'gen_1', name: 'Commander 1' };
    const withGenerals = { ...withoutGenerals, hiredCommanders: { gen_1: general } };
    const generalHit = Array.from({ length: 30 }, (_, seed) => pickProceduralEvent(withGenerals, createRng(seed)))
      .some(e => e?.id.includes('ambitious_general'));
    expect(generalHit).toBe(true);
  });

  it('always has something eligible, even with every conditional template gated off — the plan\'s "always something happening in the quiet turns"', () => {
    const state = createInitialState({ playerNationId: 'us' });
    // Fail every conditional isEligible gate: no coast/control, low infra, high defense, no
    // unrest, no generals. failed_harvest/traveling_merchants/harsh_winter have no gate at all.
    const mostlyIneligible = {
      ...state,
      hiredCommanders: {},
      regions: {
        ...state.regions,
        us: { ...state.regions.us, control: 0, currentInfrastructure: 0, defenseLevel: 5, unrest: 0 }
      }
    };
    for (let seed = 0; seed < 10; seed++) {
      expect(pickProceduralEvent(mostlyIneligible, createRng(seed))).not.toBeNull();
    }
  });
});
