import { describe, it, expect } from 'vitest';
import { pickProceduralEvent } from './proceduralEvents';
import { createInitialState } from '../context/GameContext';
import { createRng } from '../utils/rng';
import { EVENT_CHAINS } from './eventChains';
import { REGIONS_DATA, getNationCapital } from './regions';

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
    // "Your region" is the player's capital (src/data/proceduralEvents.js's home()) — now that a
    // nation spans many provinces, that's Paris, not "France" itself.
    const capitalName = REGIONS_DATA[getNationCapital('fr')].name;
    expect(hit.description).toContain(capitalName);
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

  it('never spawns a follow-up that points at a nonexistent chain entry, across every template it can build', () => {
    const state = { ...createInitialState({ playerNationId: 'us' }), hiredCommanders: { gen_1: { id: 'gen_1', name: 'Commander 1' } } };
    for (let seed = 0; seed < 40; seed++) {
      const event = pickProceduralEvent(state, createRng(seed));
      if (!event) continue;
      event.options.forEach(option => {
        const followUp = option.effects.spawnFollowUp;
        if (followUp) expect(EVENT_CHAINS[followUp.id]).toBeDefined();
      });
    }
  });

  it('offers the refugee-crisis template when a war is active anywhere, even one the player isn\'t in', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const withDistantWar = { ...state, wars: [{ active: true, aggressor: 'de', enemy: 'fr' }] };
    const hit = Array.from({ length: 40 }, (_, seed) => pickProceduralEvent(withDistantWar, createRng(seed)))
      .some(e => e?.id.includes('refugee_crisis'));
    expect(hit).toBe(true);
  });

  it('offers the refugee-crisis template when the home region is badly unsettled, even with no war', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const capitalId = getNationCapital('us');
    const withUnrest = { ...state, wars: [], regions: { ...state.regions, [capitalId]: { ...state.regions[capitalId], unrest: 50 } } };
    const hit = Array.from({ length: 40 }, (_, seed) => pickProceduralEvent(withUnrest, createRng(seed)))
      .some(e => e?.id.includes('refugee_crisis'));
    expect(hit).toBe(true);
  });

  it('never offers the refugee-crisis template with no war and a settled home region', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const capitalId = getNationCapital('us');
    const calm = { ...state, wars: [], regions: { ...state.regions, [capitalId]: { ...state.regions[capitalId], unrest: 0 } } };
    const hit = Array.from({ length: 40 }, (_, seed) => pickProceduralEvent(calm, createRng(seed)))
      .some(e => e?.id.includes('refugee_crisis'));
    expect(hit).toBe(false);
  });

  // Build Climate Resilience (gameReducer.js's BUILD_CLIMATE_RESILIENCE) is what raises this stat —
  // this only tests the resulting eligibility gate, not the action itself.
  it('stops offering failed_harvest/harsh_winter once the home region is climate-resilient', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const capitalId = getNationCapital('us');
    const resilient = { ...state, regions: { ...state.regions, [capitalId]: { ...state.regions[capitalId], climateResilience: 3 } } };
    const results = Array.from({ length: 60 }, (_, seed) => pickProceduralEvent(resilient, createRng(seed)));
    expect(results.some(e => e?.id.includes('failed_harvest'))).toBe(false);
    expect(results.some(e => e?.id.includes('harsh_winter'))).toBe(false);
  });

  it('still offers failed_harvest/harsh_winter below the resilience threshold', () => {
    const state = createInitialState({ playerNationId: 'us' });
    const capitalId = getNationCapital('us');
    const unprepared = { ...state, regions: { ...state.regions, [capitalId]: { ...state.regions[capitalId], climateResilience: 0 } } };
    const results = Array.from({ length: 60 }, (_, seed) => pickProceduralEvent(unprepared, createRng(seed)));
    expect(results.some(e => e?.id.includes('failed_harvest') || e?.id.includes('harsh_winter'))).toBe(true);
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
