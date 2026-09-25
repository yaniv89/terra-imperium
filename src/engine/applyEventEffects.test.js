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
    // Plan §M18 removed the old 'survival' auto-win-at-END_YEAR condition entirely — an event
    // granting victory directly records the display-only 'eventVictory' entry instead.
    expect(next.victoryConditionId).toBe('eventVictory');
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

  // Plan §M17: defenseBonus becomes a real timed local.fortLevel modifier on every region the
  // player owns (replacing the M14-removed dead `eventDefenseBonus` field it used to accumulate
  // into with nothing ever reading it).
  it('applies defenseBonus as a timed local.fortLevel modifier on every player-owned region', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const frCapital = getNationCapital('fr');
    const next = applyEventEffects(state, fixtureEvent('defense_event', { defenseBonus: 0.2 }), 0);
    const entries = next.regionModifiers[frCapital];
    expect(entries).toHaveLength(1);
    expect(entries[0].mods['local.fortLevel']).toBe(4); // round(0.2 * 20)
    expect(entries[0].expiresTurn).toBe(next.turnNumber + 20);
    // A region owned by another nation gets nothing.
    const deCapital = getNationCapital('de');
    expect(next.regionModifiers[deCapital]).toBeUndefined();
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

  // Plan §M17's new effect vocabulary — each hooks into an EXISTING M3/M5/M6/M8/M9/M12/M14 system.
  describe('M17 effect vocabulary', () => {
    it('addModifier adds a real, timed nation modifier (first production caller of addNationModifier)', () => {
      const state = { ...createInitialState({ playerNationId: 'fr' }), turnNumber: 5 };
      const event = fixtureEvent('modifier_event', { addModifier: { label: 'Test Boon', mods: { 'national.goldMult': 0.1 }, duration: 10 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.nations.fr.modifiers).toHaveLength(1);
      expect(next.nations.fr.modifiers[0]).toMatchObject({ label: 'Test Boon', mods: { 'national.goldMult': 0.1 }, expiresTurn: 15 });
    });

    it('estateLoyalty adjusts the real, stored loyalty field, clamped to [0, 100]', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const next = applyEventEffects(state, fixtureEvent('loyalty_event', { estateLoyalty: { clergy: 20 } }), 0);
      expect(next.nations.fr.estates.clergy.loyalty).toBe(70);
      expect(next.nations.fr.estates.nobility.loyalty).toBe(50); // untouched

      const capped = applyEventEffects(
        { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, estates: { ...state.nations.fr.estates, clergy: { ...state.nations.fr.estates.clergy, loyalty: 95 } } } } },
        fixtureEvent('loyalty_event', { estateLoyalty: { clergy: 20 } }), 0
      );
      expect(capped.nations.fr.estates.clergy.loyalty).toBe(100);
    });

    it('addClaim pushes the nation id onto the real claims array used by hasCasusBelli, without duplicating', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const next = applyEventEffects(state, fixtureEvent('claim_event', { addClaim: 'de' }), 0);
      expect(next.nations.fr.claims).toEqual(['de']);
      const again = applyEventEffects(next, fixtureEvent('claim_event_2', { addClaim: 'de' }), 0);
      expect(again.nations.fr.claims).toEqual(['de']); // no duplicate
    });

    it('spawnRebels creates a real rebel unit in the target region and dents its control', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const frCapital = getNationCapital('fr');
      const controlBefore = state.regions[frCapital].control;
      const next = applyEventEffects(state, fixtureEvent('uprising_event', { spawnRebels: { regionId: frCapital, strength: 500 } }), 0);
      const rebel = Object.values(next.units).find((u) => u.regionId === frCapital && u.ownerId === 'rebels');
      expect(rebel).toBeTruthy();
      expect(rebel.strength).toBe(500);
      expect(next.regions[frCapital].control).toBe(Math.max(0, controlBefore - 30));
    });

    it('spawnRebels is a no-op if that region is already rebelling', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const frCapital = getNationCapital('fr');
      const withRebel = { ...state, units: { ...state.units, existing_rebel: { id: 'existing_rebel', regionId: frCapital, ownerId: 'rebels', strength: 100 } } };
      const next = applyEventEffects(withRebel, fixtureEvent('uprising_event', { spawnRebels: { regionId: frCapital, strength: 500 } }), 0);
      expect(Object.values(next.units).filter((u) => u.regionId === frCapital && u.ownerId === 'rebels')).toHaveLength(1);
    });

    it('ruler.addTrait/removeTrait mutate the real ruler traits array', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const withScholar = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, ruler: { ...state.nations.fr.ruler, traits: ['scholar'] } } } };
      const added = applyEventEffects(withScholar, fixtureEvent('trait_event', { ruler: { addTrait: 'warrior' } }), 0);
      expect(added.nations.fr.ruler.traits).toEqual(['scholar', 'warrior']);
      const removed = applyEventEffects(withScholar, fixtureEvent('trait_event_2', { ruler: { removeTrait: 'scholar' } }), 0);
      expect(removed.nations.fr.ruler.traits).toEqual([]);
    });

    it('heir.claim adjusts the real succession claim field, clamped to [0, 100]', () => {
      const state = { ...createInitialState({ playerNationId: 'fr' }) };
      state.nations = { ...state.nations, fr: { ...state.nations.fr, heir: { id: 'h1', name: 'Test Heir', claim: 50 } } };
      const next = applyEventEffects(state, fixtureEvent('heir_event', { heir: { claim: 20 } }), 0);
      expect(next.nations.fr.heir.claim).toBe(70);
    });

    it('dev bumps the real region development field, floored at 1', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const frCapital = getNationCapital('fr');
      const before = state.regions[frCapital].dev.tax;
      const next = applyEventEffects(state, fixtureEvent('dev_event', { dev: { regionId: frCapital, type: 'tax', delta: 3 } }), 0);
      expect(next.regions[frCapital].dev.tax).toBe(before + 3);
    });

    it('construct grants a free tier-0 building only if that category is not already built there', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const frCapital = getNationCapital('fr');
      const next = applyEventEffects(state, fixtureEvent('construct_event', { construct: { regionId: frCapital, category: 'military' } }), 0);
      expect(next.regions[frCapital].buildings.categories.military).toBe(0);

      const alreadyBuilt = { ...next, regions: { ...next.regions, [frCapital]: { ...next.regions[frCapital], buildings: { ...next.regions[frCapital].buildings, categories: { ...next.regions[frCapital].buildings.categories, military: 2 } } } } };
      const noOp = applyEventEffects(alreadyBuilt, fixtureEvent('construct_event_2', { construct: { regionId: frCapital, category: 'military' } }), 0);
      expect(noOp.regions[frCapital].buildings.categories.military).toBe(2); // untouched, not reset to 0
    });

    it('law sets the real per-category law only for a valid lawId', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const next = applyEventEffects(state, fixtureEvent('law_event', { law: { category: 'taxation', lawId: 'land_tax' } }), 0);
      expect(next.nations.fr.laws.taxation).toBe('land_tax');

      const bogus = applyEventEffects(state, fixtureEvent('law_event_2', { law: { category: 'taxation', lawId: 'not_a_real_law' } }), 0);
      expect(bogus.nations.fr.laws.taxation).toBe(state.nations.fr.laws.taxation); // unchanged
    });

    it('crownLand adjusts the real field, clamped to [0, 100]', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const next = applyEventEffects(state, fixtureEvent('crown_land_event', { crownLand: -20 }), 0);
      expect(next.nations.fr.crownLand).toBe(30);
    });
  });
});
