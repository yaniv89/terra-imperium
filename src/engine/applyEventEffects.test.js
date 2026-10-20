import { describe, it, expect } from 'vitest';
import { applyEventEffects } from './applyEventEffects';
import { GameStatus } from '../data/types';
import { getNationCapital } from '../data/regions';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 11 });
const FR_ID = PEOPLES_WORLD.playerNationId;
const DE_ID = rivalOf(PEOPLES_WORLD, 0);

const fixtureEvent = (id, effects) => ({ id, title: 'Test Event', options: [{ label: 'ok', effects }] });

describe('applyEventEffects', () => {
  it('applies resource effects atomically in one state transition', () => {
    const state = neighbourWorld();
    const event = fixtureEvent('gold_event', { gold: 500, dip: 10 });
    const next = applyEventEffects(state, event, 0);
    expect(next.resources.gold).toBe(state.resources.gold + 500);
    expect(next.resources.dip).toBe(state.resources.dip + 10);
    expect(next.activeEventId).toBeNull();
    expect(next.firedEvents[event.id]).toBe(true);
  });

  it('sets gameStatus to VICTORY when the choice carries effects.victory', () => {
    const state = neighbourWorld();
    const next = applyEventEffects(state, fixtureEvent('win_event', { victory: true }), 0);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    // Plan §M18 removed the old 'survival' auto-win-at-END_YEAR condition entirely — an event
    // granting victory directly records the display-only 'eventVictory' entry instead.
    expect(next.victoryConditionId).toBe('eventVictory');
  });

  it('applies stability/legitimacy/prestige deltas to the player nation (plan §M4)', () => {
    const state = neighbourWorld();
    const next = applyEventEffects(state, fixtureEvent('stability_event', { stability: 1, legitimacy: 10, prestige: 20 }), 0);
    expect(next.nations[FR_ID].stability).toBe((state.nations[FR_ID].stability || 0) + 1);
    expect(next.nations[FR_ID].legitimacy).toBe(state.nations[FR_ID].legitimacy + 10);
    expect(next.nations[FR_ID].prestige).toBe(state.nations[FR_ID].prestige + 20);
  });

  it('clamps stability/legitimacy/prestige deltas to their valid ranges', () => {
    const state = neighbourWorld();
    const next = applyEventEffects(state, fixtureEvent('extreme_event', { stability: 100, legitimacy: 1000, prestige: -1000 }), 0);
    expect(next.nations[FR_ID].stability).toBe(3);
    expect(next.nations[FR_ID].legitimacy).toBe(100);
    expect(next.nations[FR_ID].prestige).toBe(-100);
  });

  it('declares war on the named nation for warWith', () => {
    const state = neighbourWorld();
    const next = applyEventEffects(state, fixtureEvent('war_event', { warWith: DE_ID }), 0);
    expect(next.nations[DE_ID].isAtWar).toBe(true);
    expect(next.wars.some(w => w.enemy === DE_ID && w.active)).toBe(true);
  });

  it('ends the war and clears the player\'s own isAtWar too, even when the AI was the aggressor', () => {
    // Regression: previously only cleared the NAMED nation's isAtWar and only deactivated a war
    // record where that nation was the `enemy` field — a war the AI itself declared on the player
    // (aggressor: DE_ID, enemy: player) matched neither, leaving both the player's own isAtWar flag
    // and the war record stuck forever, which made aiLogic.js's pickWarTarget (filters out any
    // isAtWar nation) treat the player as permanently immune to any future war declaration.
    const base = neighbourWorld();
    const state = {
      ...base,
      nations: { ...base.nations, [FR_ID]: { ...base.nations[FR_ID], isAtWar: true }, [DE_ID]: { ...base.nations[DE_ID], isAtWar: true } },
      wars: [{ id: 'war_1', aggressor: DE_ID, enemy: FR_ID, active: true, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }]
    };
    const next = applyEventEffects(state, fixtureEvent('peace_event', { peaceWith: DE_ID }), 0);
    expect(next.nations[DE_ID].isAtWar).toBe(false);
    expect(next.nations[FR_ID].isAtWar).toBe(false);
    expect(next.wars[0].active).toBe(false);
  });

  it('does not mutate the input state', () => {
    const state = neighbourWorld();
    const snapshotGold = state.resources.gold;
    applyEventEffects(state, fixtureEvent('gold_event', { gold: 500 }), 0);
    expect(state.resources.gold).toBe(snapshotGold);
    expect(state.activeEventId).toBeNull(); // unchanged - was already null
  });

  // Plan §M17: defenseBonus becomes a real timed local.fortLevel modifier on every region the
  // player owns (replacing the M14-removed dead `eventDefenseBonus` field it used to accumulate
  // into with nothing ever reading it).
  it('applies defenseBonus as a timed local.fortLevel modifier on every player-owned region', () => {
    const state = neighbourWorld();
    const frCapital = getNationCapital(FR_ID);
    const next = applyEventEffects(state, fixtureEvent('defense_event', { defenseBonus: 0.2 }), 0);
    const entries = next.regionModifiers[frCapital];
    expect(entries).toHaveLength(1);
    expect(entries[0].mods['local.fortLevel']).toBe(4); // round(0.2 * 20)
    expect(entries[0].expiresTurn).toBe(next.turnNumber + 20);
    // A region owned by another nation gets nothing.
    const deCapital = getNationCapital(DE_ID);
    expect(next.regionModifiers[deCapital]).toBeUndefined();
  });

  it('applies militaryStrengthBonus to the player nation\'s militaryStrength', () => {
    const state = neighbourWorld();
    const before = state.nations[FR_ID].militaryStrength;
    const next = applyEventEffects(state, fixtureEvent('rally_event', { militaryStrengthBonus: 5000 }), 0);
    expect(next.nations[FR_ID].militaryStrength).toBe(before + 5000);
  });

  it('captures the named regions for the player', () => {
    const state = neighbourWorld();
    const deCapital = getNationCapital(DE_ID);
    const next = applyEventEffects(state, fixtureEvent('capture_event', { captureRegions: [deCapital] }), 0);
    expect(next.regions[deCapital].owner).toBe(FR_ID);
  });

  describe('nationHostility', () => {
    it('adjusts only the named nation\'s hostility, clamped to [0, 100]', () => {
      const state = neighbourWorld();
      state.nations[DE_ID] = { ...state.nations[DE_ID], hostility: 50 };
      const event = fixtureEvent('hostility_event', { nationHostility: { [DE_ID]: 20 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.nations[DE_ID].hostility).toBe(70);
      expect(next.nations[rivalOf(PEOPLES_WORLD, 1)].hostility).toBe(state.nations[rivalOf(PEOPLES_WORLD, 1)].hostility); // untouched

      const capped = applyEventEffects({ ...state, nations: { ...state.nations, [DE_ID]: { ...state.nations[DE_ID], hostility: 95 } } }, event, 0);
      expect(capped.nations[DE_ID].hostility).toBe(100);
    });

    it('ignores an unknown nation id rather than throwing', () => {
      const state = neighbourWorld();
      const event = fixtureEvent('hostility_event', { nationHostility: { not_a_real_nation: 10 } });
      expect(() => applyEventEffects(state, event, 0)).not.toThrow();
    });
  });

  it('clears activeProceduralEvent when resolving a procedural event', () => {
    const proceduralEvent = fixtureEvent('procedural_test_1', { gold: 100 });
    const state = { ...neighbourWorld(), activeEventId: null, activeProceduralEvent: proceduralEvent };
    const next = applyEventEffects(state, state.activeProceduralEvent, 0);
    expect(next.activeProceduralEvent).toBeNull();
    expect(next.resources.gold).toBe(state.resources.gold + 100);
  });

  describe('spawnFollowUp (event chains with memory)', () => {
    it('schedules a pendingEventChains entry at turnNumber + delayTurns', () => {
      const state = { ...neighbourWorld(), turnNumber: 40 };
      const event = fixtureEvent('chain_source', { spawnFollowUp: { id: 'some_chain', delayTurns: 6 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.pendingEventChains).toEqual([{ id: 'some_chain', dueTurn: 46 }]);
    });

    it('appends to any existing pendingEventChains rather than overwriting them', () => {
      const state = { ...neighbourWorld(), turnNumber: 10, pendingEventChains: [{ id: 'some_other_chain', dueTurn: 12 }] };
      const event = fixtureEvent('chain_source', { spawnFollowUp: { id: 'some_chain', delayTurns: 6 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.pendingEventChains).toEqual([
        { id: 'some_other_chain', dueTurn: 12 },
        { id: 'some_chain', dueTurn: 16 }
      ]);
    });

    it('leaves pendingEventChains untouched when the option has no spawnFollowUp', () => {
      const state = { ...neighbourWorld(), pendingEventChains: [{ id: 'x', dueTurn: 5 }] };
      const next = applyEventEffects(state, fixtureEvent('no_chain_event', { gold: 10 }), 0);
      expect(next.pendingEventChains).toEqual([{ id: 'x', dueTurn: 5 }]);
    });
  });

  // Plan §M17's new effect vocabulary — each hooks into an EXISTING M3/M5/M6/M8/M9/M12/M14 system.
  describe('M17 effect vocabulary', () => {
    it('addModifier adds a real, timed nation modifier (first production caller of addNationModifier)', () => {
      const state = { ...neighbourWorld(), turnNumber: 5 };
      const event = fixtureEvent('modifier_event', { addModifier: { label: 'Test Boon', mods: { 'national.goldMult': 0.1 }, duration: 10 } });
      const next = applyEventEffects(state, event, 0);
      expect(next.nations[FR_ID].modifiers).toHaveLength(1);
      expect(next.nations[FR_ID].modifiers[0]).toMatchObject({ label: 'Test Boon', mods: { 'national.goldMult': 0.1 }, expiresTurn: 15 });
    });

    it('addClaim names a nation and grants a claim on its city nearest to the player, one city per event', () => {
      const state = neighbourWorld();
      const next = applyEventEffects(state, fixtureEvent('claim_event', { addClaim: DE_ID }), 0);
      expect(next.nations[FR_ID].claims).toHaveLength(1);
      expect(next.regions[next.nations[FR_ID].claims[0]].owner).toBe(DE_ID);
      const again = applyEventEffects(next, fixtureEvent('claim_event_2', { addClaim: DE_ID }), 0);
      expect(again.nations[FR_ID].claims).toHaveLength(Math.min(2, Object.values(state.regions).filter((r) => r.owner === DE_ID).length));
    });

    it('spawnRebels creates a real rebel unit in the target region and dents its control', () => {
      const state = neighbourWorld();
      const frCapital = getNationCapital(FR_ID);
      const controlBefore = state.regions[frCapital].control;
      const next = applyEventEffects(state, fixtureEvent('uprising_event', { spawnRebels: { regionId: frCapital, strength: 500 } }), 0);
      const rebel = Object.values(next.units).find((u) => u.regionId === frCapital && u.ownerId === 'rebels');
      expect(rebel).toBeTruthy();
      expect(rebel.strength).toBe(500);
      expect(next.regions[frCapital].control).toBe(Math.max(0, controlBefore - 30));
    });

    it('spawnRebels is a no-op if that region is already rebelling', () => {
      const state = neighbourWorld();
      const frCapital = getNationCapital(FR_ID);
      const withRebel = { ...state, units: { ...state.units, existing_rebel: { id: 'existing_rebel', regionId: frCapital, ownerId: 'rebels', strength: 100 } } };
      const next = applyEventEffects(withRebel, fixtureEvent('uprising_event', { spawnRebels: { regionId: frCapital, strength: 500 } }), 0);
      expect(Object.values(next.units).filter((u) => u.regionId === frCapital && u.ownerId === 'rebels')).toHaveLength(1);
    });

    it('ruler.addTrait/removeTrait mutate the real ruler traits array', () => {
      const state = neighbourWorld();
      const withScholar = { ...state, nations: { ...state.nations, [FR_ID]: { ...state.nations[FR_ID], ruler: { ...state.nations[FR_ID].ruler, traits: ['scholar'] } } } };
      const added = applyEventEffects(withScholar, fixtureEvent('trait_event', { ruler: { addTrait: 'warrior' } }), 0);
      expect(added.nations[FR_ID].ruler.traits).toEqual(['scholar', 'warrior']);
      const removed = applyEventEffects(withScholar, fixtureEvent('trait_event_2', { ruler: { removeTrait: 'scholar' } }), 0);
      expect(removed.nations[FR_ID].ruler.traits).toEqual([]);
    });

    it('dev bumps the real region development field, floored at 1', () => {
      const state = neighbourWorld();
      const frCapital = getNationCapital(FR_ID);
      const before = state.regions[frCapital].dev.tax;
      const next = applyEventEffects(state, fixtureEvent('dev_event', { dev: { regionId: frCapital, type: 'tax', delta: 3 } }), 0);
      expect(next.regions[frCapital].dev.tax).toBe(before + 3);
    });

    it('construct grants a free tier-0 building only if that category is not already built there', () => {
      const state = neighbourWorld();
      const frCapital = getNationCapital(FR_ID);
      const next = applyEventEffects(state, fixtureEvent('construct_event', { construct: { regionId: frCapital, category: 'military' } }), 0);
      expect(next.regions[frCapital].buildings.categories.military).toBe(0);

      const alreadyBuilt = { ...next, regions: { ...next.regions, [frCapital]: { ...next.regions[frCapital], buildings: { ...next.regions[frCapital].buildings, categories: { ...next.regions[frCapital].buildings.categories, military: 2 } } } } };
      const noOp = applyEventEffects(alreadyBuilt, fixtureEvent('construct_event_2', { construct: { regionId: frCapital, category: 'military' } }), 0);
      expect(noOp.regions[frCapital].buildings.categories.military).toBe(2); // untouched, not reset to 0
    });

    it('law sets the real per-category law only for a valid lawId', () => {
      const state = neighbourWorld();
      const next = applyEventEffects(state, fixtureEvent('law_event', { law: { category: 'taxation', lawId: 'land_tax' } }), 0);
      expect(next.nations[FR_ID].laws.taxation).toBe('land_tax');

      const bogus = applyEventEffects(state, fixtureEvent('law_event_2', { law: { category: 'taxation', lawId: 'not_a_real_law' } }), 0);
      expect(bogus.nations[FR_ID].laws.taxation).toBe(state.nations[FR_ID].laws.taxation); // unchanged
    });
  });
});

describe('controlPenalty (H-09)', () => {
  it('lowers control in every city the player owns, occupied or not', () => {
    const state = neighbourWorld();
    const mine = Object.values(state.regions).filter((r) => r.owner === FR_ID);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => !r.occupiedBy)).toBe(true);
    const next = applyEventEffects(state, fixtureEvent('control_event', { controlPenalty: 20 }), 0);
    mine.forEach((r) => expect(next.regions[r.id].control).toBe(Math.max(0, r.control - 20)));
    const other = Object.values(state.regions).find((r) => r.owner !== FR_ID);
    if (other) expect(next.regions[other.id].control).toBe(other.control);
  });
});
