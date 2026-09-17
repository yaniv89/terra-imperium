import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from '../data/types';
import { getYearsPerTurn, getCalendarAgeId, END_YEAR } from '../data/ages';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD, REVOLT_SUCCESS_TURNS, INTEGRATION_CONTROL_THRESHOLD } from '../data/rebellion';
import { HISTORICAL_EVENTS } from '../data/events';
import { EVENT_CHAINS } from '../data/eventChains';
import { applyEventEffects } from './applyEventEffects';

// Every real scripted/procedural event already "used up" — isolates tests that aren't themselves
// about the event system from HISTORICAL_EVENTS/proceduralEvents.js's real, non-empty content
// (Phase D3): resolveTurn is a no-op while an event is pending, so an unrelated test that runs
// enough turns to cross a real event's year would otherwise silently stall.
const withAllEventsFired = (state) => ({
  ...state,
  firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {}),
  proceduralEventCooldown: 999999
});

describe('resolveTurn determinism', () => {
  it('produces identical output for identical input (same rngSeed)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const a = resolveTurn(state);
    const b = resolveTurn(state);
    expect(a).toEqual(b);
  });

  it('is a no-op once the game has ended', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), gameStatus: GameStatus.DEFEAT };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while a scripted event is blocking play', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), activeEventId: 'some_event' };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while a procedural event is blocking play', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), activeProceduralEvent: { id: 'x', options: [] } };
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn calendar advance', () => {
  it('advances the year by the age/speed years-per-turn table', () => {
    const state = createInitialState({ playerNationId: 'fr', gameSpeed: 'normal' });
    const next = resolveTurn(state);
    expect(next.year).toBe(state.year + getYearsPerTurn(state.age, 'normal'));
  });

  it('advances faster at Fast speed than Marathon, all else equal', () => {
    const fast = resolveTurn(createInitialState({ playerNationId: 'fr', gameSpeed: 'fast' }));
    const marathon = resolveTurn(createInitialState({ playerNationId: 'fr', gameSpeed: 'marathon' }));
    expect(fast.year).toBeGreaterThan(marathon.year);
  });

  it('recomputes age from the new calendar year', () => {
    // Bronze -> Classical boundary is -800; jump the state right up to it.
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: -840, age: 'bronze' };
    const next = resolveTurn(state);
    expect(next.age).toBe(getCalendarAgeId(next.year));
  });

  it('increments turnNumber', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = resolveTurn(state);
    expect(next.turnNumber).toBe(state.turnNumber + 1);
  });
});

describe('resolveTurn resource income', () => {
  it('grows the player\'s gold and hr each turn', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = resolveTurn(state);
    expect(next.resources.gold).toBeGreaterThan(state.resources.gold);
    expect(next.resources.hr).toBeGreaterThan(state.resources.hr);
  });

  it('unlocks a newly-available resource at 0 the turn its age arrives', () => {
    // Classical unlocks Iron; start one tick before the boundary.
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: -820, age: 'bronze' };
    expect(state.resources.iron).toBeUndefined();
    const next = resolveTurn(state);
    expect(next.age).toBe('classical');
    expect(next.resources.iron).toBeDefined();
  });
});

describe('resolveTurn unrest drift', () => {
  it('settles unrest toward 0 when every region is at full control', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), regions: { ...createInitialState({ playerNationId: 'fr' }).regions, fr: { ...createInitialState({ playerNationId: 'fr' }).regions.fr, unrest: 10 } } };
    const next = resolveTurn(state);
    expect(next.regions.fr.unrest).toBeLessThan(10);
  });

  it('raises unrest for a region under the control threshold', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const lowControl = { ...state, regions: { ...state.regions, fr: { ...state.regions.fr, control: 10, unrest: 0 } } };
    const next = resolveTurn(lowControl);
    expect(next.regions.fr.unrest).toBeGreaterThan(0);
  });
});

describe('resolveTurn rebellion', () => {
  const rebelUnitIn = (state) => Object.values(state.units).find(u => u.ownerId === REBEL_OWNER_ID);

  it('spawns a rebel army once unrest crosses the threshold', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    // A few points above the threshold: unrest drift (-1/turn at full control) shouldn't be
    // enough to pull it back under REBELLION_UNREST_THRESHOLD before the rebellion check reads it.
    const state = { ...base, regions: { ...base.regions, fr: { ...base.regions.fr, unrest: REBELLION_UNREST_THRESHOLD + 5 } } };
    const next = resolveTurn(state);
    const rebel = rebelUnitIn(next);
    expect(rebel).toBeDefined();
    expect(rebel.regionId).toBe('fr');
    expect(rebel.domain).toBe('land');
    expect(next.regions.fr.control).toBeLessThan(state.regions.fr.control);
  });

  it('does not spawn a second rebel army in a region that already has one', () => {
    const base = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const state = { ...base, regions: { ...base.regions, fr: { ...base.regions.fr, unrest: REBELLION_UNREST_THRESHOLD + 5 } } };
    const withRebel = resolveTurn(state);
    const again = resolveTurn(withRebel);
    const rebelCount = Object.values(again.units).filter(u => u.ownerId === REBEL_OWNER_ID && u.regionId === 'fr').length;
    expect(rebelCount).toBe(1);
  });

  it('grows an existing rebel army while unrest stays at or above the threshold', () => {
    const base = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const state = { ...base, regions: { ...base.regions, fr: { ...base.regions.fr, unrest: REBELLION_UNREST_THRESHOLD + 5 } } };
    const withRebel = resolveTurn(state);
    const before = rebelUnitIn(withRebel).strength;
    const again = resolveTurn(withRebel);
    const after = rebelUnitIn(again)?.strength;
    expect(after).toBeGreaterThan(before);
  });

  it('dissolves the rebellion once unrest drops back below the threshold', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const rebelUnit = {
      id: 'rebel_fr_1', regionId: 'fr', ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 500, maxStrength: 500, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = {
      ...base,
      units: { rebel_fr_1: rebelUnit },
      regions: { ...base.regions, fr: { ...base.regions.fr, unrest: 0 } }
    };
    const next = resolveTurn(state);
    expect(next.units.rebel_fr_1).toBeUndefined();
  });
});

describe('resolveTurn revolt end conditions (conquered territory)', () => {
  const rebelUnitAt = (regionId, spawnedTurn) => ({
    id: `rebel_${regionId}_1`, regionId, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
    strength: 500, maxStrength: 500, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null,
    spawnedTurn
  });

  it('reverts a conquered region to its former owner once the revolt runs unresolved for REVOLT_SUCCESS_TURNS', () => {
    const base = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const rebel = rebelUnitAt('de', 1);
    const garrison = {
      id: 'garrison_1', regionId: 'de', ownerId: 'fr', domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 200, maxStrength: 200, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = {
      ...base,
      turnNumber: 1 + REVOLT_SUCCESS_TURNS,
      units: { [rebel.id]: rebel, [garrison.id]: garrison },
      regions: { ...base.regions, de: { ...base.regions.de, owner: 'fr', formerOwner: 'de', unrest: REBELLION_UNREST_THRESHOLD + 5, control: 20 } }
    };
    const next = resolveTurn(state);
    expect(next.regions.de.owner).toBe('de');
    expect(next.regions.de.formerOwner).toBeUndefined();
    expect(next.units[rebel.id]).toBeUndefined();
    // The occupier's garrison is overrun along with the rebellion's victory, same as a lost battle.
    expect(next.units[garrison.id]).toBeUndefined();
  });

  it('keeps growing the rebel army in conquered land that has not yet run REVOLT_SUCCESS_TURNS', () => {
    const base = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const rebel = rebelUnitAt('de', 1);
    const state = {
      ...base,
      turnNumber: 1, // only one turn old — far short of REVOLT_SUCCESS_TURNS
      units: { [rebel.id]: rebel },
      regions: { ...base.regions, de: { ...base.regions.de, owner: 'fr', formerOwner: 'de', unrest: REBELLION_UNREST_THRESHOLD + 5, control: 20 } }
    };
    const next = resolveTurn(state);
    expect(next.regions.de.owner).toBe('fr'); // still held
    expect(next.regions.de.formerOwner).toBe('de'); // still at risk
    expect(next.units[rebel.id].strength).toBeGreaterThan(rebel.strength); // grew instead of succeeding
  });

  it('never reverts ownership for a home-territory rebellion, which has no formerOwner to revert to', () => {
    const base = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const rebel = rebelUnitAt('fr', 1);
    const state = {
      ...base,
      turnNumber: 1 + REVOLT_SUCCESS_TURNS + 5, // well past the revolt-success window
      units: { [rebel.id]: rebel },
      regions: { ...base.regions, fr: { ...base.regions.fr, unrest: REBELLION_UNREST_THRESHOLD + 5 } }
    };
    const next = resolveTurn(state);
    expect(next.regions.fr.owner).toBe('fr');
    expect(Object.values(next.units).some(u => u.ownerId === REBEL_OWNER_ID && u.regionId === 'fr')).toBe(true);
  });

  it('integrates a conquered region once control reaches INTEGRATION_CONTROL_THRESHOLD without a live rebellion', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const state = {
      ...base,
      regions: { ...base.regions, de: { ...base.regions.de, owner: 'fr', formerOwner: 'de', unrest: 10, control: INTEGRATION_CONTROL_THRESHOLD } }
    };
    const next = resolveTurn(state);
    expect(next.regions.de.formerOwner).toBeUndefined();
    expect(next.regions.de.owner).toBe('fr'); // integration only clears the revolt-risk flag, ownership is unchanged
  });

  it('keeps formerOwner set on conquered land that is neither revolting nor yet fully integrated', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const state = {
      ...base,
      regions: { ...base.regions, de: { ...base.regions.de, owner: 'fr', formerOwner: 'de', unrest: 10, control: 30 } }
    };
    const next = resolveTurn(state);
    expect(next.regions.de.formerOwner).toBe('de');
  });
});

describe('resolveTurn supply attrition', () => {
  it('bleeds strength from a unit stationed beyond its nation\'s supply reach', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    // 'us' is 9 land hops from France — beyond even a maxed-out region's supply range (up to 6).
    const farUnit = {
      id: 'u_far', regionId: 'us', ownerId: 'fr', domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 1000, maxStrength: 1000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = { ...base, units: { u_far: farUnit } };
    const next = resolveTurn(state);
    expect(next.units.u_far.strength).toBeLessThan(1000);
  });

  it('does not bleed a unit stationed on its own nation\'s territory', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const homeUnit = {
      id: 'u_home', regionId: 'fr', ownerId: 'fr', domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 1000, maxStrength: 1000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = { ...base, units: { u_home: homeUnit } };
    const next = resolveTurn(state);
    expect(next.units.u_home.strength).toBe(1000);
  });

  it('does not bleed embarked cargo directly — it shares its transport\'s supply state', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const cargoUnit = {
      id: 'u_cargo', regionId: 'us', ownerId: 'fr', domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 1000, maxStrength: 1000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: 'u_ship'
    };
    const state = { ...base, units: { u_cargo: cargoUnit } };
    const next = resolveTurn(state);
    expect(next.units.u_cargo.strength).toBe(1000);
  });

  it('removes a unit whose strength is fully consumed by attrition', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const weakUnit = {
      id: 'u_weak', regionId: 'us', ownerId: 'fr', domain: 'land', classId: 'infantry', ageId: 'bronze',
      strength: 1, maxStrength: 1000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
    };
    const state = { ...base, units: { u_weak: weakUnit } };
    const next = resolveTurn(state);
    expect(next.units.u_weak).toBeUndefined();
  });
});

describe('resolveTurn war exhaustion', () => {
  it('rises for a nation at war', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const state = { ...base, nations: { ...base.nations, de: { ...base.nations.de, isAtWar: true } } };
    const next = resolveTurn(state);
    expect(next.nations.de.warExhaustion).toBeGreaterThan(0);
  });

  it('decays for a nation at peace', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const state = { ...base, nations: { ...base.nations, de: { ...base.nations.de, warExhaustion: 50 } } };
    const next = resolveTurn(state);
    expect(next.nations.de.warExhaustion).toBeLessThan(50);
  });

  it('applies to the player too, not just AI nations', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const state = { ...base, nations: { ...base.nations, fr: { ...base.nations.fr, isAtWar: true } } };
    const next = resolveTurn(state);
    expect(next.nations.fr.warExhaustion).toBeGreaterThan(0);
  });

  it('never drops below 0 or exceeds 100', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const atZero = { ...base, nations: { ...base.nations, de: { ...base.nations.de, warExhaustion: 0 } } };
    expect(resolveTurn(atZero).nations.de.warExhaustion).toBe(0);
    const atMax = { ...base, nations: { ...base.nations, de: { ...base.nations.de, warExhaustion: 100, isAtWar: true } } };
    expect(resolveTurn(atMax).nations.de.warExhaustion).toBe(100);
  });
});

describe('resolveTurn AI nations', () => {
  it('grows non-player nations\' military strength over many turns without crashing', () => {
    let state = createInitialState({ playerNationId: 'fr' });
    for (let i = 0; i < 20; i++) {
      state = resolveTurn(state);
    }
    Object.values(state.nations).forEach(n => {
      if (n.isPlayer) return;
      expect(n.militaryStrength).toBeGreaterThanOrEqual(100);
      expect(Number.isFinite(n.militaryStrength)).toBe(true);
    });
  });

  it('never touches the player nation\'s own stats via the AI pass', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = resolveTurn(state);
    expect(next.nations.fr.militaryStrength).toBe(state.nations.fr.militaryStrength);
  });
});

describe('resolveTurn AI war declarations', () => {
  it('carries an existing war forward across a turn (wars is part of the resolved state)', () => {
    // Every non-player nation already isAtWar: true — aiLogic.js's processAIWarDecisions skips any
    // nation that's already at war (`if (nation.isPlayer || nation.isAtWar) return;`), so this
    // deterministically guarantees no OTHER nation can spontaneously start a new war of its own
    // this turn. (difficultyMultiplier: 0 does NOT work for this: `state.difficultyMultiplier || 1`
    // treats 0 as falsy and silently falls back to 1, the normal aggression level.) This test is
    // about wars[] surviving the turn, not about AI war-declaration odds.
    const fresh = createInitialState({ playerNationId: 'fr' });
    const nations = { ...fresh.nations };
    Object.keys(nations).forEach(id => { if (id !== 'fr') nations[id] = { ...nations[id], isAtWar: true }; });
    const base = { ...fresh, nations };
    const existingWar = { id: 'war_de_-2000', enemy: 'de', startYear: base.year, active: true, aggressor: 'fr', goal: { type: 'destroy_military', threshold: 1 }, goalAchieved: false };
    const state = { ...base, wars: [existingWar] };
    const next = resolveTurn(state);
    expect(next.wars).toEqual([existingWar]);
  });

  it('an aggressive, hostile Tier 1 neighbor eventually declares war on its own, wired end-to-end through resolveTurn', () => {
    // 'de' borders the player ('fr'), which makes it Tier 1 every turn regardless of ranking.
    // zealot + hostility 100 gives it the highest available per-turn roll chance; run enough
    // turns that failing to ever roll it is astronomically unlikely (this is an integration test
    // of the real wiring, not a probability estimate — aiLogic.test.js covers the exact odds).
    const base = createInitialState({ playerNationId: 'fr' });
    let state = withAllEventsFired({
      ...base,
      nations: { ...base.nations, de: { ...base.nations.de, doctrine: 'zealot', hostility: 100 } }
    });
    let warDeclared = false;
    for (let i = 0; i < 300 && !warDeclared; i++) {
      state = resolveTurn(state);
      if (state.nations.de.isAtWar) warDeclared = true;
    }
    expect(warDeclared).toBe(true);
    expect(state.wars.some(w => w.aggressor === 'de')).toBe(true);
  });
});

describe('resolveTurn victory', () => {
  it('triggers survival victory once the year reaches END_YEAR', () => {
    const state = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), year: END_YEAR - 1 });
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('survival');
  });

  it('does not check victory conditions while an event is pending', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), year: END_YEAR - 1, activeEventId: 'some_event' };
    // resolveTurn is a no-op while an event is pending (existing guard) — this just confirms
    // that guard still holds even when a victory condition would otherwise already be met.
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn event chains', () => {
  it('does not fire a chain event before its dueTurn', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 5, pendingEventChains: [{ id: 'not_registered', dueTurn: 10 }] };
    const next = resolveTurn(state);
    expect(next.activeEventId).toBeNull();
    expect(next.pendingEventChains).toEqual([{ id: 'not_registered', dueTurn: 10 }]);
  });

  it('ignores a pending entry whose id has no matching registry entry, rather than throwing', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 5, pendingEventChains: [{ id: 'not_a_real_chain', dueTurn: 6 }] };
    expect(() => resolveTurn(state)).not.toThrow();
  });

  it('fires a real, multi-step chain end-to-end: schedules, fires at dueTurn, and resolving it schedules the next step', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), turnNumber: 5, pendingEventChains: [{ id: 'succession_crisis_1', dueTurn: 6 }] });
    const next = resolveTurn(base);
    expect(next.activeEventId).toBe('succession_crisis_1');
    expect(next.pendingEventChains).toEqual([]);

    const event = HISTORICAL_EVENTS[next.activeEventId] || EVENT_CHAINS[next.activeEventId];
    expect(event.title).toBe('A Succession Crisis Brews');

    const resolved = applyEventEffects(next, event, 0); // "Name the eldest heir now" -> schedules succession_crisis_2
    expect(resolved.pendingEventChains).toEqual([{ id: 'succession_crisis_2', dueTurn: resolved.turnNumber + 5 }]);
    expect(resolved.activeEventId).toBeNull();
  });
});

describe('resolveTurn curated national events', () => {
  it('fires a curated national event for the nation it names, once its year arrives', () => {
    // national_egypt_nile_flood (-1900) is chronologically the earliest of ALL real events, so
    // clearing firedEvents entirely can't let some other event preempt it.
    const state = { ...withAllEventsFired(createInitialState({ playerNationId: 'eg' })), year: HISTORICAL_EVENTS.national_egypt_nile_flood.year - 1, firedEvents: {} };
    const next = resolveTurn(state);
    expect(next.activeEventId).toBe('national_egypt_nile_flood');
  });

  it('never fires a curated national event for a different nation', () => {
    const state = { ...withAllEventsFired(createInitialState({ playerNationId: 'fr' })), year: HISTORICAL_EVENTS.national_egypt_nile_flood.year - 1, firedEvents: {} };
    const next = resolveTurn(state);
    expect(next.activeEventId).not.toBe('national_egypt_nile_flood');
  });

  it('declaring war through a curated event\'s warWith effect marks both sides isAtWar (Task 23\'s aggressor fix)', () => {
    const event = HISTORICAL_EVENTS.national_punic_ambitions;
    const base = createInitialState({ playerNationId: 'it' });
    const resolved = applyEventEffects(base, event, 0); // "Declare war and settle it by force" -> warWith: ['tn']
    expect(resolved.nations.tn.isAtWar).toBe(true);
    expect(resolved.nations.it.isAtWar).toBe(true);
  });
});

describe('resolveTurn orbital debris (Space Race)', () => {
  it('decays every turn, whether or not anyone struck a satellite this turn', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), orbitalDebrisLevel: 50 });
    const next = resolveTurn(base);
    expect(next.orbitalDebrisLevel).toBeLessThan(50);
  });

  it('never drops below 0', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), orbitalDebrisLevel: 0 });
    const next = resolveTurn(base);
    expect(next.orbitalDebrisLevel).toBe(0);
  });

  it('feeds a satellite\'s stabilityBonus into every owning nation\'s own regions\' unrest drift, not just the player\'s', () => {
    // 'de' (not the player) owns a Recon Satellite (stabilityBonus 6) and starts with unrest high
    // enough that the drift would otherwise rise this turn.
    const base = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const stateWithoutSat = { ...base, regions: { ...base.regions, de: { ...base.regions.de, control: 0, unrest: 10 } } };
    const stateWithSat = { ...stateWithoutSat, satellites: { s1: { id: 's1', ownerId: 'de', typeId: 'recon' } } };
    const withoutSat = resolveTurn(stateWithoutSat);
    const withSat = resolveTurn(stateWithSat);
    expect(withSat.regions.de.unrest).toBeLessThan(withoutSat.regions.de.unrest);
  });
});

describe('resolveTurn space mission ladder', () => {
  it('ticks a mission\'s progress down by one turn', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), spaceMissionProgress: { sounding_rocket: 3 } });
    const next = resolveTurn(base);
    expect(next.spaceMissionProgress.sounding_rocket).toBe(2);
  });

  it('completes a mission once its progress reaches 0, applying its one-time reward and clearing it from progress', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), spaceMissionProgress: { sounding_rocket: 1 } });
    const next = resolveTurn(base);
    expect(next.spaceMissionProgress.sounding_rocket).toBeUndefined();
    expect(next.completedMissions).toContain('sounding_rocket');
    // sounding_rocket's oneTimeReward is diplomacyPoints: 10, on top of that turn's own income.
    expect(next.resources.diplomacyPoints).toBeGreaterThanOrEqual(base.resources.diplomacyPoints + 10);
  });

  it('leaves unrelated in-progress missions untouched', () => {
    const base = withAllEventsFired({
      ...createInitialState({ playerNationId: 'fr' }),
      spaceMissionProgress: { sounding_rocket: 1, first_satellite: 4 }
    });
    const next = resolveTurn(base);
    expect(next.completedMissions).toContain('sounding_rocket');
    expect(next.spaceMissionProgress.first_satellite).toBe(3);
  });

  it('a completed mission\'s recurring reward flows into income starting the turn after completion', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), completedMissions: ['moon_landing'] });
    const withoutMission = withAllEventsFired(createInitialState({ playerNationId: 'fr' }));
    const withMission = resolveTurn(base);
    const without = resolveTurn(withoutMission);
    // moon_landing's recurringReward is diplomacyPointsPerTurn: 10.
    expect(withMission.resources.diplomacyPoints).toBeGreaterThan(without.resources.diplomacyPoints);
  });
});

describe('resolveTurn diplomatic leadership streak', () => {
  it('increments the streak while aligned with a majority of the world', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const nations = { ...base.nations };
    Object.keys(nations).forEach(id => {
      if (id === 'fr') return;
      nations[id] = { ...nations[id], hasTradeAgreement: true };
    });
    const state = withAllEventsFired({ ...base, nations, diplomaticLeadershipStreak: 5 });
    const next = resolveTurn(state);
    expect(next.diplomaticLeadershipStreak).toBe(6);
  });

  it('resets the streak once alignment drops below a majority', () => {
    const state = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), diplomaticLeadershipStreak: 10 });
    const next = resolveTurn(state);
    expect(next.diplomaticLeadershipStreak).toBe(0);
  });
});

describe('resolveTurn new victory conditions wired end-to-end', () => {
  it('triggers Space Ascendancy once the final mission completes mid-turn', () => {
    const base = withAllEventsFired({ ...createInitialState({ playerNationId: 'fr' }), spaceMissionProgress: { interstellar_probe: 1 } });
    const next = resolveTurn(base);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('spaceAscendancy');
  });

  it('triggers Domination once the player holds enough of the world\'s regions', () => {
    const base = createInitialState({ playerNationId: 'fr' });
    const regions = { ...base.regions };
    const ids = Object.keys(regions);
    ids.slice(0, Math.ceil(ids.length * 0.41)).forEach(id => { regions[id] = { ...regions[id], owner: 'fr' }; });
    const state = withAllEventsFired({ ...base, regions });
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('domination');
  });
});
