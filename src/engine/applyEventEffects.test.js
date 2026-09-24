import { describe, it, expect } from 'vitest';
import { applyEventEffects } from './applyEventEffects';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from '../data/types';
import { getNationCapital } from '../data/regions';

const fixtureEvent = (id, effects) => ({ id, title: 'Test Event', options: [{ label: 'ok', effects }] });

describe('applyEventEffects', () => {
  it('applies resource effects atomically in one state transition', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const event = fixtureEvent('gold_event', { gold: 500, dip: 10 });
    const next = applyEventEffects(state, event, 0);
    expect(next.resources.gold).toBe(state.resources.gold + 500);
    expect(next.resources.dip).toBe(state.resources.dip + 10);
    expect(next.activeEventId).toBeNull();
    expect(next.firedEvents[event.id]).toBe(true);
  });

  it('sets gameStatus to VICTORY when the choice carries effects.victory', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyEventEffects(state, fixtureEvent('win_event', { victory: true }), 0);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('survival');
  });

  it('applies stability/legitimacy/prestige deltas to the player nation (plan §M4)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyEventEffects(state, fixtureEvent('stability_event', { stability: 1, legitimacy: 10, prestige: 20 }), 0);
    expect(next.nations.fr.stability).toBe((state.nations.fr.stability || 0) + 1);
    expect(next.nations.fr.legitimacy).toBe(state.nations.fr.legitimacy + 10);
    expect(next.nations.fr.prestige).toBe(state.nations.fr.prestige + 20);
  });

  it('clamps stability/legitimacy/prestige deltas to their valid ranges', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyEventEffects(state, fixtureEvent('extreme_event', { stability: 100, legitimacy: 1000, prestige: -1000 }), 0);
    expect(next.nations.fr.stability).toBe(3);
    expect(next.nations.fr.legitimacy).toBe(100);
    expect(next.nations.fr.prestige).toBe(-100);
  });

  it('declares war on the named nation for warWith', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyEventEffects(state, fixtureEvent('war_event', { warWith: 'de' }), 0);
    expect(next.nations.de.isAtWar).toBe(true);
    expect(next.wars.some(w => w.enemy === 'de' && w.active)).toBe(true);
  });

  it('ends the war and clears the player\'s own isAtWar too, even when the AI was the aggressor', () => {
    // Regression: previously only cleared the NAMED nation's isAtWar and only deactivated a war
    // record where that nation was the `enemy` field — a war the AI itself declared on the player
    // (aggressor: 'de', enemy: player) matched neither, leaving both the player's own isAtWar flag
    // and the war record stuck forever, which made aiLogic.js's pickWarTarget (filters out any
    // isAtWar nation) treat the player as permanently immune to any future war declaration.
    const base = createInitialState({ playerNationId: 'fr' });
    const state = {
      ...base,
      nations: { ...base.nations, fr: { ...base.nations.fr, isAtWar: true }, de: { ...base.nations.de, isAtWar: true } },
      wars: [{ id: 'war_1', aggressor: 'de', enemy: 'fr', active: true, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }]
    };
    const next = applyEventEffects(state, fixtureEvent('peace_event', { peaceWith: 'de' }), 0);
    expect(next.nations.de.isAtWar).toBe(false);
    expect(next.nations.fr.isAtWar).toBe(false);
    expect(next.wars[0].active).toBe(false);
  });

  it('does not mutate the input state', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const snapshotGold = state.resources.gold;
    applyEventEffects(state, fixtureEvent('gold_event', { gold: 500 }), 0);
    expect(state.resources.gold).toBe(snapshotGold);
    expect(state.activeEventId).toBeNull(); // unchanged - was already null
  });

  it('accumulates event defenseBonus so it can feed combat once combat exists', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = applyEventEffects(state, fixtureEvent('defense_event', { defenseBonus: 0.2 }), 0);
    expect(next.eventDefenseBonus).toBeGreaterThan(0);
  });

  it('applies militaryStrengthBonus to the player nation\'s militaryStrength', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const before = state.nations.fr.militaryStrength;
    const next = applyEventEffects(state, fixtureEvent('rally_event', { militaryStrengthBonus: 5000 }), 0);
    expect(next.nations.fr.militaryStrength).toBe(before + 5000);
  });

  it('captures the named regions for the player', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const deCapital = getNationCapital('de');
    const next = applyEventEffects(state, fixtureEvent('capture_event', { captureRegions: [deCapital] }), 0);
    expect(next.regions[deCapital].owner).toBe('fr');
    expect(next.regions[deCapital].isOccupied).toBe(true);
  });

  describe('nationHostility', () => {
    it('adjusts only the named nation\'s hostility, clamped to [0, 100]', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      state.nations.de = { ...state.nations.de, hostility: 50 };
      const event = fixtureEvent('hostility_event', { nationHostility: { de: 20 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.nations.de.hostility).toBe(70);
      expect(next.nations.jp.hostility).toBe(state.nations.jp.hostility); // untouched

      const capped = applyEventEffects({ ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 95 } } }, event, 0);
      expect(capped.nations.de.hostility).toBe(100);
    });

    it('ignores an unknown nation id rather than throwing', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const event = fixtureEvent('hostility_event', { nationHostility: { not_a_real_nation: 10 } });
      expect(() => applyEventEffects(state, event, 0)).not.toThrow();
    });
  });

  it('clears activeProceduralEvent when resolving a procedural event', () => {
    const proceduralEvent = fixtureEvent('procedural_test_1', { gold: 100 });
    const state = { ...createInitialState({ playerNationId: 'fr' }), activeEventId: null, activeProceduralEvent: proceduralEvent };
    const next = applyEventEffects(state, state.activeProceduralEvent, 0);
    expect(next.activeProceduralEvent).toBeNull();
    expect(next.resources.gold).toBe(state.resources.gold + 100);
  });

  describe('spawnFollowUp (event chains with memory)', () => {
    it('schedules a pendingEventChains entry at turnNumber + delayTurns', () => {
      const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 40 };
      const event = fixtureEvent('chain_source', { spawnFollowUp: { id: 'some_chain', delayTurns: 6 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.pendingEventChains).toEqual([{ id: 'some_chain', dueTurn: 46 }]);
    });

    it('appends to any existing pendingEventChains rather than overwriting them', () => {
      const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 10, pendingEventChains: [{ id: 'some_other_chain', dueTurn: 12 }] };
      const event = fixtureEvent('chain_source', { spawnFollowUp: { id: 'some_chain', delayTurns: 6 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.pendingEventChains).toEqual([
        { id: 'some_other_chain', dueTurn: 12 },
        { id: 'some_chain', dueTurn: 16 }
      ]);
    });

    it('leaves pendingEventChains untouched when the option has no spawnFollowUp', () => {
      const state = { ...createInitialState({ playerNationId: 'fr' }), pendingEventChains: [{ id: 'x', dueTurn: 5 }] };
      const next = applyEventEffects(state, fixtureEvent('no_chain_event', { gold: 10 }), 0);
      expect(next.pendingEventChains).toEqual([{ id: 'x', dueTurn: 5 }]);
    });
  });
});
