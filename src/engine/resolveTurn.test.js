import { describe, it, expect } from 'vitest';
import { resolveTurn, findConflictTerritoryTransfer, supplyDecayForInvasion } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { GamePhases, GameStatus } from '../data/types';
import { sumUnits } from '../utils/helpers';
import { HISTORICAL_EVENTS } from '../data/events';
import { INDEPENDENCE_WAR_ATTACKERS, HOSTILE_BLOCS } from '../data/nations';
import { getNationCapital } from '../data/regions';

// A minimal, deterministic "overwhelming attacker" invasion: strength so far above the
// defender's that the 0.8-1.2 random factor can never flip the outcome, so tests don't need
// to average over many runs to be reliable.
const overwhelmingInvasion = (id, targetRegion, attackerNation) => ({
  id,
  targetRegion,
  strength: 999999,
  morale: 100,
  supply: 100,
  active: true,
  isPlayerAttacker: false,
  attackerNation
});

const overwhelmingPlayerInvasion = (id, targetRegion) => ({
  id,
  targetRegion,
  composition: { infantry: 999999, armor: 0, air: 0 },
  morale: 100,
  supply: 100,
  active: true,
  isPlayerAttacker: true
});

const postStateBase = () => {
  const state = createInitialState();
  state.phase = GamePhases.POST_STATE;
  state.militaryUnits = { infantry: 100, armor: 0, air: 0 }; // deliberately weak defense
  return state;
};

describe('resolveTurn determinism', () => {
  it('produces identical output for identical input (same rngSeed)', () => {
    const state = postStateBase();
    const a = resolveTurn(state);
    const b = resolveTurn(state);
    expect(a).toEqual(b);
  });

  it('is a no-op once the game has ended', () => {
    const state = { ...postStateBase(), gameStatus: GameStatus.DEFEAT };
    expect(resolveTurn(state)).toBe(state);
  });

  it('is a no-op while an event is blocking play', () => {
    const state = { ...postStateBase(), activeEventId: 'balfour_1917' };
    expect(resolveTurn(state)).toBe(state);
  });
});

describe('resolveTurn combat resolution (regression: same-region stale-read damage loss)', () => {
  it('applies damage from two invasions on the same region additively, not by overwriting each other', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'player', control: 100, underInvasion: true };
    state.invasions = [
      overwhelmingInvasion('inv1', 'golan', 'syria'),
      overwhelmingInvasion('inv2', 'golan', 'egypt')
    ];

    const next = resolveTurn(state);

    // Each overwhelming win deals 25 damage. The old code computed both from the same
    // pre-turn control value (100), so the second dispatch silently overwrote the first and
    // the net result was a single -25 instead of -50.
    expect(next.regions.golan.control).toBe(50);
    expect(next.regions.golan.owner).toBe('player');
  });
});

describe('resolveTurn territory capture (regression: AI conquest never transferred ownership)', () => {
  it('flips region ownership when an overwhelming invasion drives control to 0', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'player', control: 20, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'golan', 'syria')];

    const next = resolveTurn(state);

    expect(next.regions.golan.owner).toBe('syria');
    expect(next.regions.golan.isOccupied).toBe(true);
    expect(next.invasions.find(i => i.id === 'inv1').active).toBe(false);
  });
});

describe('resolveTurn victory/defeat (regression: no terminal state, checked against stale data)', () => {
  it('triggers DEFEAT the same turn a core city falls, not one turn late', () => {
    const state = postStateBase();
    state.regions.tel_aviv = { ...state.regions.tel_aviv, owner: 'player', control: 20, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'tel_aviv', 'egypt')];

    const next = resolveTurn(state);

    expect(next.regions.tel_aviv.owner).not.toBe('player');
    expect(next.gameStatus).toBe(GameStatus.DEFEAT);
  });

  it('does not flag defeat while both core cities are held', () => {
    const state = postStateBase();
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.ACTIVE);
  });
});

describe('resolveTurn casualties (regression: player military was a free, undamageable pool)', () => {
  it('reduces the player military pool when their defense takes losses', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'player', control: 100, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'golan', 'syria')];

    const next = resolveTurn(state);

    expect(sumUnits(next.militaryUnits)).toBeLessThan(sumUnits(state.militaryUnits));
  });

  it('reduces the attacking nation strength when a player offensive wins', () => {
    const state = postStateBase();
    state.regions.golan = { ...state.regions.golan, owner: 'syria', control: 100 };
    state.invasions = [overwhelmingPlayerInvasion('inv1', 'golan')];

    const next = resolveTurn(state);

    expect(next.nations.syria.militaryStrength).toBeLessThan(state.nations.syria.militaryStrength);
    expect(next.regions.golan.owner).toBe('player');
  });
});

describe('resolveTurn AI vs AI conflicts (regression: computed and discarded)', () => {
  it('is wired so AI-vs-AI casualties can affect nation military strength (no crash across many turns)', () => {
    let state = postStateBase();
    for (let i = 0; i < 50; i++) {
      state = resolveTurn(state);
    }
    // Not asserting a specific delta (it's probabilistic) — the meaningful regression check is
    // that resolving 50 turns doesn't throw and nation strengths stay sane (never negative,
    // never below the reducer's floor).
    Object.values(state.nations).forEach(n => {
      if (n.isPlayer) return;
      expect(n.militaryStrength).toBeGreaterThanOrEqual(100);
    });
  });
});

describe('resolveTurn unit composition (Phase 3: terrain-vs-composition tradeoffs)', () => {
  it('casualties from a player offensive land on the invasion force, not the home defense pool', () => {
    const state = postStateBase();
    state.militaryUnits = { infantry: 200000, armor: 0, air: 0 };
    state.regions.golan = { ...state.regions.golan, owner: 'syria', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'golan', composition: { infantry: 999999, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];

    const next = resolveTurn(state);

    // The committed 999999 was already deducted at launch time (reducer concern, not tested
    // here) — resolveTurn itself must not ALSO touch the home militaryUnits pool for an
    // attacking invasion's own casualties.
    expect(next.militaryUnits).toEqual(state.militaryUnits);
  });

  it('composition vs. terrain can be the difference between a stalemate and a rout', () => {
    // iran_west: mountains, defense = 20000 (startMilitary) * 0.3 * fortification(4) = 24000,
    // further *1.4 terrain mod = 33600 defenderScore. At headcount 25000: infantry's terrain
    // bonus (x1.3 = 32500 effective) reaches the 0.7 stalemate threshold across the whole
    // 0.8-1.2 random band; armor's terrain penalty (x0.6 = 15000 effective) never does — it's
    // repelled outright regardless of the roll. This is the real, seed-independent effect of
    // composition-vs-terrain: which combat bucket you land in, not fine-grained casualty math
    // within the same bucket (that stays a flat percentage either way).
    const buildState = (composition) => {
      const state = postStateBase();
      state.regions.iran_west = { ...state.regions.iran_west, owner: 'iran', control: 100 };
      state.invasions = [{
        id: 'inv1', targetRegion: 'iran_west', composition, morale: 100, supply: 100,
        active: true, isPlayerAttacker: true
      }];
      return state;
    };

    for (const seed of [1, 2, 3, 4, 5]) {
      const armorState = buildState({ infantry: 0, armor: 25000, air: 0 });
      armorState.rngSeed = seed;
      const infantryState = buildState({ infantry: 25000, armor: 0, air: 0 });
      infantryState.rngSeed = seed;

      const armorNext = resolveTurn(armorState).invasions.find(i => i.id === 'inv1');
      const infantryNext = resolveTurn(infantryState).invasions.find(i => i.id === 'inv1');

      // Armor: repelled every time -> morale -25 AND a further 0.85 attrition scale-down.
      expect(armorNext.morale).toBe(75);
      // Infantry: stalemate every time -> morale -10 only, no extra scale-down.
      expect(infantryNext.morale).toBe(90);
    }
  });
});

describe('resolveTurn hostilityFloor (Phase 4: broken-peace memory)', () => {
  it('hostility decay never crosses below a nation\'s hostilityFloor', () => {
    let state = postStateBase();
    // Strong defense so an unrelated nation's own (nonzero-by-default) hostility can't cause an
    // early DEFEAT that freezes turn resolution before 500 decay-roll chances play out — see the
    // identical note on the AI-initiated-wars tests below, which hit this exact interaction.
    state.militaryUnits = { infantry: 1000000, armor: 0, air: 0 };
    // No scripted events allowed to interrupt this run — mark everything fired so resolveTurn
    // never blocks on activeEventId partway through.
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    state.nations.egypt = { ...state.nations.egypt, isAtWar: true, hostility: 50, hostilityFloor: 40 };

    // 35%/turn decay chance while at war; 60 turns gives an expected ~21 successful decay rolls
    // (far more than the 5 needed to walk from 50 down to the floor of 40), so "it never fired"
    // is astronomically unlikely regardless of the random seed. Deliberately NOT hundreds of
    // turns: AI military strength compounds ~3%/turn, and a long enough run would eventually
    // out-scale any fixed defense number regardless of this mechanic — that's a separate, correct
    // effect of Phase 4, not something this test needs to survive.
    for (let i = 0; i < 60; i++) {
      state = resolveTurn(state);
    }

    expect(state.nations.egypt.hostility).toBeGreaterThanOrEqual(40);
    expect(state.nations.egypt.hostility).toBeLessThan(50); // decay did actually happen
  });
});

describe('resolveTurn AI-initiated wars (Phase 4: shouldDeclareWar was written but never called)', () => {
  it('a hostile, aggressive nation can eventually declare war on the player without any player action', () => {
    let state = postStateBase();
    // Strong defense so that OTHER nations' own (nonzero-by-default) hostility can't cause an
    // early DEFEAT that freezes turn resolution before Syria gets its own chance to roll — this
    // test is specifically isolating "can an AI nation declare war unprompted," not "does the
    // whole world staying hostile eventually overwhelm a weak player" (a real, separate, and
    // correct emergent effect of this same Phase 4 change, just not what this test checks).
    state.militaryUnits = { infantry: 1000000, armor: 0, air: 0 };
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    state.nations.syria = { ...state.nations.syria, hostility: 100, isAtWar: false, hasPeaceTreaty: false };

    let syriaWentToWar = false;
    for (let i = 0; i < 300 && !syriaWentToWar; i++) {
      state = resolveTurn(state);
      if (state.nations.syria.isAtWar) syriaWentToWar = true;
    }

    expect(syriaWentToWar).toBe(true);
    expect(state.wars.some(w => w.enemy === 'syria' && w.active)).toBe(true);
  });

  it('never declares more than one AI-initiated war in a single turn', () => {
    let state = postStateBase();
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    // Make every nation maximally war-hungry at once.
    Object.keys(state.nations).forEach(id => {
      if (state.nations[id].isPlayer) return;
      state.nations[id] = { ...state.nations[id], hostility: 100, isAtWar: false, hasPeaceTreaty: false };
    });

    for (let i = 0; i < 50; i++) {
      const before = Object.values(state.nations).filter(n => !n.isPlayer && n.isAtWar).length;
      state = resolveTurn(state);
      const after = Object.values(state.nations).filter(n => !n.isPlayer && n.isAtWar).length;
      expect(after - before).toBeLessThanOrEqual(1);
    }
  });
});

describe('findConflictTerritoryTransfer (Phase 4: AI-vs-AI conflicts can now redraw the map)', () => {
  const nations = {
    syria: { name: 'Syria', militaryStrength: 100000 },
    lebanon: { name: 'Lebanon', militaryStrength: 10000 }
  };

  it('returns null when the aggressor lacks a decisive strength edge', () => {
    const evenNations = { syria: { ...nations.syria, militaryStrength: 10000 }, lebanon: nations.lebanon };
    const regions = { syria_damascus: { owner: 'syria' }, lebanon_north: { owner: 'lebanon' } };
    expect(findConflictTerritoryTransfer(regions, evenNations, { aggressor: 'syria', defender: 'lebanon' })).toBeNull();
  });

  it('returns null when the aggressor and defender share no border', () => {
    const regions = { syria_damascus: { owner: 'syria' }, egypt_cairo: { owner: 'lebanon' } };
    expect(findConflictTerritoryTransfer(regions, nations, { aggressor: 'syria', defender: 'lebanon' })).toBeNull();
  });

  it('returns the bordering region when the aggressor is decisively stronger and adjacent', () => {
    const regions = { syria_damascus: { owner: 'syria' }, lebanon_north: { owner: 'lebanon' } };
    // syria_damascus borders lebanon_north (see src/data/regions.js).
    expect(findConflictTerritoryTransfer(regions, nations, { aggressor: 'syria', defender: 'lebanon' })).toBe('lebanon_north');
  });
});

describe('resolveTurn missileDefenseBonus (Phase 5: Iron Dome/Arrow 3/Iron Beam actually reduce damage)', () => {
  it('a researched missile defense stack reduces control loss from an overwhelming enemy invasion', () => {
    const buildState = (researched) => {
      const state = postStateBase();
      state.regions.negev = { ...state.regions.negev, owner: 'player', control: 100, underInvasion: true };
      state.invasions = [overwhelmingInvasion('inv1', 'negev', 'egypt')];
      if (researched) {
        state.techTree.iron_dome = { ...state.techTree.iron_dome, researched: true };
        state.techTree.arrow_3 = { ...state.techTree.arrow_3, researched: true };
      }
      state.rngSeed = 555; // identical seed on both runs isolates the tech's effect
      return state;
    };

    const without = resolveTurn(buildState(false));
    const withDefense = resolveTurn(buildState(true));

    expect(withDefense.regions.negev.control).toBeGreaterThan(without.regions.negev.control);
  });
});

describe('resolveTurn hostilityReduction passive decay (Phase 5: Mossad effect was accumulated and never applied)', () => {
  it('a nation not at war decays hostility faster when Mossad is researched, all else identical', () => {
    // Only a single turn is compared: both runs start with identical hostility (90), so
    // aiLogic's own random decay roll (gated on `nation.hostility > threshold`) short-circuits
    // identically and consumes the exact same RNG draws on both runs. Running further turns
    // would let the passive-decay-driven hostility divergence change that short-circuit's
    // outcome, desyncing the RNG stream between the two runs and turning this into a coin flip
    // (that's what made the previous 20-turn version of this test flaky).
    const buildState = (researched) => {
      const state = postStateBase();
      state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
      state.nations.egypt = { ...state.nations.egypt, isAtWar: false, hostility: 90 };
      if (researched) state.techTree.mossad_formation = { ...state.techTree.mossad_formation, researched: true };
      state.rngSeed = 777; // identical seed -> identical random rolls on both runs
      return state;
    };

    const withoutMossad = resolveTurn(buildState(false));
    const withMossad = resolveTurn(buildState(true));

    expect(withMossad.nations.egypt.hostility).toBeLessThan(withoutMossad.nations.egypt.hostility);
  });
});

describe('resolveTurn combatPrediction integration (Phase 5: AI Warfare threaded into the defender path)', () => {
  it('does not crash and still resolves combat when the player has combatPrediction researched', () => {
    const state = postStateBase();
    state.techTree.ai_warfare = { ...state.techTree.ai_warfare, researched: true };
    state.regions.negev = { ...state.regions.negev, owner: 'player', control: 100, underInvasion: true };
    state.invasions = [overwhelmingInvasion('inv1', 'negev', 'egypt')];

    expect(() => resolveTurn(state)).not.toThrow();
  });
});

describe('resolveTurn procedural events (Phase 6: keep the late-game timeline from going quiet)', () => {
  // Every HISTORICAL_EVENTS entry marked fired so pickNextEvent always returns null here —
  // otherwise any of the many still-unfired earlier-year scripted events would be "due" the
  // moment phase is forced to POST_STATE, and the procedural gate (which only rolls when no
  // scripted event is pending) would never get a chance to run.
  const allScriptedFired = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));

  const proceduralReadyState = (overrides = {}) => ({
    ...postStateBase(),
    year: 2050,
    invasions: [],
    firedEvents: allScriptedFired,
    proceduralEventCooldown: 0,
    ...overrides
  });

  it('never fires before the year-2000 gate, whatever the roll', () => {
    for (let seed = 0; seed < 100; seed++) {
      const next = resolveTurn(proceduralReadyState({ year: 1990, rngSeed: seed }));
      expect(next.activeProceduralEvent).toBeNull();
    }
  });

  it('never fires while its cooldown has not elapsed, whatever the roll', () => {
    for (let seed = 0; seed < 100; seed++) {
      const next = resolveTurn(proceduralReadyState({ proceduralEventCooldown: 5, rngSeed: seed }));
      expect(next.activeProceduralEvent).toBeNull();
    }
  });

  it('can fire once eligible (year >= 2000, cooldown elapsed, no scripted event due), setting a fresh cooldown and blocking further turns until resolved', () => {
    let fired = null;
    for (let seed = 0; seed < 300 && !fired; seed++) {
      const next = resolveTurn(proceduralReadyState({ rngSeed: seed }));
      if (next.activeProceduralEvent) fired = next;
    }
    expect(fired).not.toBeNull();
    expect(fired.activeEventId).toBeNull();
    expect(fired.proceduralEventCooldown).toBeGreaterThan(0);
    expect(fired.activeProceduralEvent.options.length).toBeGreaterThanOrEqual(2);

    // Same guard as a scripted event: resolveTurn is a no-op while one is pending.
    expect(resolveTurn(fired)).toBe(fired);
  });
});

describe('resolveTurn event chains (Phase 10: event chains with memory)', () => {
  it('does not fire a chain event before its dueTurn', () => {
    const state = postStateBase();
    state.turnNumber = 5;
    state.pendingEventChains = [{ id: 'refugee_startup_ipo', dueTurn: 10 }];
    const next = resolveTurn(state);
    expect(next.activeEventId).toBeNull();
    expect(next.pendingEventChains).toEqual([{ id: 'refugee_startup_ipo', dueTurn: 10 }]);
  });

  it('fires the chain event the turn its dueTurn is reached, and clears it from the pending list', () => {
    const state = postStateBase();
    state.turnNumber = 5;
    state.pendingEventChains = [{ id: 'refugee_startup_ipo', dueTurn: 6 }];
    const next = resolveTurn(state);
    expect(next.turnNumber).toBe(6);
    expect(next.activeEventId).toBe('refugee_startup_ipo');
    expect(next.pendingEventChains).toEqual([]);
  });

  it('ignores a pending entry whose id has no matching registry entry, rather than throwing', () => {
    const state = postStateBase();
    state.turnNumber = 5;
    state.pendingEventChains = [{ id: 'not_a_real_chain', dueTurn: 6 }];
    expect(() => resolveTurn(state)).not.toThrow();
    const next = resolveTurn(state);
    expect(next.activeEventId).toBeNull();
    expect(next.pendingEventChains).toEqual([{ id: 'not_a_real_chain', dueTurn: 6 }]);
  });

  it('only fires one pending chain event per turn, leaving the rest scheduled', () => {
    const state = postStateBase();
    state.turnNumber = 5;
    state.pendingEventChains = [
      { id: 'refugee_startup_ipo', dueTurn: 6 },
      { id: 'refugee_startup_ipo', dueTurn: 6 }
    ];
    const next = resolveTurn(state);
    expect(next.activeEventId).toBe('refugee_startup_ipo');
    expect(next.pendingEventChains).toEqual([{ id: 'refugee_startup_ipo', dueTurn: 6 }]);
  });
});

describe('supplyDecayForInvasion (Phase 7: overextension)', () => {
  it('is the flat base rate one hop from the attacker\'s home anchor', () => {
    // gaza borders tel_aviv/negev — both CORE_REGION_IDS — so it's 1 hop from the player's anchor.
    expect(supplyDecayForInvasion(overwhelmingPlayerInvasion('inv-near', 'gaza'))).toBe(10);
  });

  it('decays faster the further the target is from the attacker\'s home anchor', () => {
    // egypt_cairo is 2 hops from the player's core (via egypt_sinai).
    expect(supplyDecayForInvasion(overwhelmingPlayerInvasion('inv-far', 'egypt_cairo'))).toBe(13);
  });

  it('scales an AI attacker\'s decay from ITS OWN capital, not the player\'s', () => {
    // egypt_cairo (egypt's capital) -> egypt_sinai -> negev is 2 hops.
    const inv = overwhelmingInvasion('inv1', 'negev', 'egypt');
    expect(supplyDecayForInvasion(inv)).toBe(13);
  });

  it('applies the flat base rate for a stateless attacker with no capital (Hamas)', () => {
    const inv = overwhelmingInvasion('inv1', 'tel_aviv', 'hamas');
    expect(supplyDecayForInvasion(inv)).toBe(10);
  });

  it('is actually consumed by resolveTurn: a farther invasion loses more supply in one turn', () => {
    const buildState = (targetRegion) => {
      const state = postStateBase();
      state.invasions = [{ ...overwhelmingPlayerInvasion('inv1', targetRegion), supply: 100 }];
      return state;
    };
    const near = resolveTurn(buildState('gaza'));
    const far = resolveTurn(buildState('egypt_cairo'));
    expect(far.invasions[0].supply).toBeLessThan(near.invasions[0].supply);
  });
});

describe('resolveTurn counter-attack windows (Phase 7: wars should have momentum swings)', () => {
  it('sets a window on the player after their own invasion is decisively repelled', () => {
    const state = postStateBase();
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true
    }];
    const next = resolveTurn(state);
    expect(next.counterAttackWindows.player).toBe(2);
  });

  it('sets a window on the attacking nation after its invasion is decisively repelled', () => {
    const state = postStateBase();
    state.militaryUnits = { infantry: 999999, armor: 0, air: 0 }; // overwhelming defense
    state.regions.negev = { ...state.regions.negev, owner: 'player', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'negev', strength: 1,
      morale: 100, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'egypt'
    }];
    const next = resolveTurn(state);
    expect(next.counterAttackWindows.egypt).toBe(2);
  });

  it('decrements an existing window each turn and drops it once it expires', () => {
    const state = { ...postStateBase(), counterAttackWindows: { egypt: 2 } };
    const afterOne = resolveTurn(state);
    expect(afterOne.counterAttackWindows.egypt).toBe(1);
    const afterTwo = resolveTurn(afterOne);
    expect(afterTwo.counterAttackWindows.egypt).toBeUndefined();
  });

  it('a pre-existing window measurably improves a marginal attacker\'s outcome', () => {
    // A deliberately marginal matchup (effective strength roughly matches the defender's) so the
    // window's 1.2x bonus has real room to change the outcome, checked across several seeds since
    // any single seed's random factor could already favor either side on its own.
    const buildState = (withWindow, rngSeed) => {
      const state = postStateBase();
      state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
      state.invasions = [{
        id: 'inv1', targetRegion: 'gaza', composition: { infantry: 9000, armor: 0, air: 0 },
        morale: 100, supply: 100, active: true, isPlayerAttacker: true
      }];
      if (withWindow) state.counterAttackWindows = { egypt: 2 };
      state.rngSeed = rngSeed;
      return state;
    };

    let sawImprovement = false;
    for (let seed = 0; seed < 100 && !sawImprovement; seed++) {
      const without = resolveTurn(buildState(false, seed));
      const withBonus = resolveTurn(buildState(true, seed));
      const survivorsWithout = sumUnits(without.invasions[0].composition);
      const survivorsWith = sumUnits(withBonus.invasions[0].composition);
      const capturedOnlyWithBonus = withBonus.regions.gaza.owner === 'player' && without.regions.gaza.owner !== 'player';
      if (survivorsWith > survivorsWithout || withBonus.regions.gaza.control > without.regions.gaza.control || capturedOnlyWithBonus) {
        sawImprovement = true;
      }
    }
    expect(sawImprovement).toBe(true);
  });
});

describe('resolveTurn war goals (Phase 7: wars end on purpose, not just when hostility happens to decay)', () => {
  it('nudges the loser\'s hostility to peace-seekable once their war goal is met', () => {
    const state = postStateBase();
    state.nations.egypt = { ...state.nations.egypt, isAtWar: true, hostility: 90, militaryStrength: 5000 };
    state.wars = [{
      id: 'war_egypt', enemy: 'egypt', startYear: state.year, active: true,
      aggressor: 'player', goal: { type: 'destroy_military', threshold: 8000 }, goalAchieved: false
    }];
    const next = resolveTurn(state);
    const war = next.wars.find(w => w.enemy === 'egypt');
    expect(war.goalAchieved).toBe(true);
    expect(next.nations.egypt.hostility).toBeLessThanOrEqual(55);
  });

  it('leaves an unmet goal untouched', () => {
    const state = postStateBase();
    state.nations.egypt = { ...state.nations.egypt, isAtWar: true, hostility: 90, militaryStrength: 15000 };
    state.wars = [{
      id: 'war_egypt', enemy: 'egypt', startYear: state.year, active: true,
      aggressor: 'player', goal: { type: 'destroy_military', threshold: 1000 }, goalAchieved: false
    }];
    const next = resolveTurn(state);
    const war = next.wars.find(w => w.enemy === 'egypt');
    expect(war.goalAchieved).toBe(false);
    expect(next.nations.egypt.hostility).toBeGreaterThan(55);
  });
});

describe('resolveTurn siege vs storm (Phase 8: siege scales with strength ratio, not a flat guaranteed grind)', () => {
  it('makes negligible progress when the besieging force is heavily outmatched', () => {
    const state = postStateBase();
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 100, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true, approach: 'siege'
    }];
    const next = resolveTurn(state);
    expect(next.regions.gaza.control).toBe(100);
    expect(next.regions.gaza.owner).toBe('egypt');
  });

  it('erodes control at a real, bounded rate when forces are roughly matched', () => {
    const state = postStateBase();
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 9000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true, approach: 'siege'
    }];
    const next = resolveTurn(state);
    expect(next.regions.gaza.control).toBeLessThan(100);
    expect(next.regions.gaza.control).toBeGreaterThan(80); // slow, not a single-turn rout
  });

  it('never produces a decisive combat-roll log — siege always reports gradual progress', () => {
    const state = postStateBase();
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 9000, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true, approach: 'siege'
    }];
    const next = resolveTurn(state);
    expect(next.logs.some(l => l.message.includes('Siege of'))).toBe(true);
    expect(next.logs.some(l => l.message.includes('VICTORY!'))).toBe(false);
  });

  it('eventually captures the region after enough turns of a favorable siege', () => {
    let state = postStateBase();
    // Overwhelming home defense — this test isolates siege progress over many turns, not
    // whether an unrelated AI nation's own invasion can overwhelm postStateBase's deliberately
    // weak default defense and trigger DEFEAT partway through the loop (same precaution as the
    // Phase 4/7 long-running tests).
    state.militaryUnits = { infantry: 999999, armor: 0, air: 0 };
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 999999, armor: 0, air: 0 },
      morale: 100, supply: 1000, active: true, isPlayerAttacker: true, approach: 'siege'
    }];
    let captured = false;
    for (let i = 0; i < 20 && !captured; i++) {
      state = resolveTurn(state);
      if (state.regions.gaza.owner === 'player') captured = true;
    }
    expect(captured).toBe(true);
  });
});

describe('resolveTurn AI siege (Phase 8: attrition/cautious doctrines grind safely — see aiLogic.js)', () => {
  it('makes negligible progress against an overwhelming player defense', () => {
    const state = postStateBase();
    state.militaryUnits = { infantry: 999999, armor: 0, air: 0 };
    state.regions.negev = { ...state.regions.negev, owner: 'player', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'negev', strength: 100,
      morale: 100, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'egypt', approach: 'siege'
    }];
    const next = resolveTurn(state);
    expect(next.regions.negev.control).toBe(100);
  });

  it('erodes control at a real rate against a weak player defense', () => {
    const state = postStateBase(); // weak default defense (infantry: 100)
    state.regions.negev = { ...state.regions.negev, owner: 'player', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'negev', strength: 999999,
      morale: 100, supply: 100, active: true, isPlayerAttacker: false, attackerNation: 'egypt', approach: 'siege'
    }];
    const next = resolveTurn(state);
    expect(next.regions.negev.control).toBeLessThan(100);
  });
});

describe('resolveTurn tactical orders (Phase 8: storm-only press/hold/probe)', () => {
  it('hold skips the combat roll entirely, recovers morale, and leaves composition untouched', () => {
    const state = postStateBase();
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 50, supply: 100, active: true, isPlayerAttacker: true, tacticalOrder: 'hold'
    }];
    const next = resolveTurn(state);
    const inv = next.invasions.find(i => i.id === 'inv1');
    expect(inv.morale).toBe(65); // +15, no combat loss
    expect(inv.composition).toEqual({ infantry: 1000, armor: 0, air: 0 });
    expect(next.regions.gaza.control).toBe(100); // no progress either — that's the tradeoff
  });

  it('caps morale recovery from hold at 100', () => {
    const state = postStateBase();
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1000, armor: 0, air: 0 },
      morale: 95, supply: 100, active: true, isPlayerAttacker: true, tacticalOrder: 'hold'
    }];
    const next = resolveTurn(state);
    expect(next.invasions.find(i => i.id === 'inv1').morale).toBe(100);
  });

  it('probe gives a measurable strength edge over press with identical composition/seed', () => {
    const buildState = (order, rngSeed) => {
      const state = postStateBase();
      state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
      state.invasions = [{
        id: 'inv1', targetRegion: 'gaza', composition: { infantry: 9000, armor: 0, air: 0 },
        morale: 100, supply: 100, active: true, isPlayerAttacker: true, tacticalOrder: order
      }];
      state.rngSeed = rngSeed;
      return state;
    };

    let sawImprovement = false;
    for (let seed = 0; seed < 100 && !sawImprovement; seed++) {
      const press = resolveTurn(buildState('press', seed));
      const probe = resolveTurn(buildState('probe', seed));
      const pressSurvivors = sumUnits(press.invasions[0].composition);
      const probeSurvivors = sumUnits(probe.invasions[0].composition);
      const capturedOnlyWithProbe = probe.regions.gaza.owner === 'player' && press.regions.gaza.owner !== 'player';
      if (probeSurvivors > pressSurvivors || probe.regions.gaza.control > press.regions.gaza.control || capturedOnlyWithProbe) {
        sawImprovement = true;
      }
    }
    expect(sawImprovement).toBe(true);
  });
});

describe('resolveTurn mercenary boost decay (Phase 8)', () => {
  it('removes exactly the boosted amount once the contract expires', () => {
    const state = postStateBase();
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1500, armor: 0, air: 0 },
      morale: 50, supply: 999, active: true, isPlayerAttacker: true, tacticalOrder: 'hold',
      mercenaryBoost: { amount: 500, turnsRemaining: 1 }
    }];
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    const next = resolveTurn(state);
    const inv = next.invasions.find(i => i.id === 'inv1');
    expect(inv.mercenaryBoost).toBeNull();
    expect(inv.composition.infantry).toBe(1000); // 1500 - 500 mercenaries removed on expiry
  });

  it('ticks turnsRemaining down without removing anything before expiry', () => {
    const state = postStateBase();
    state.invasions = [{
      id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1500, armor: 0, air: 0 },
      morale: 50, supply: 999, active: true, isPlayerAttacker: true, tacticalOrder: 'hold',
      mercenaryBoost: { amount: 500, turnsRemaining: 3 }
    }];
    state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
    const next = resolveTurn(state);
    const inv = next.invasions.find(i => i.id === 'inv1');
    expect(inv.mercenaryBoost).toEqual({ amount: 500, turnsRemaining: 2 });
    expect(inv.composition.infantry).toBe(1500);
  });
});

describe('resolveTurn commander bonuses (Phase 8: personas modify combat via calcCompositionStrength/supply/morale)', () => {
  it('an armor tactician measurably improves an armor-heavy attacker\'s outcome', () => {
    const buildState = (commanderId, rngSeed) => {
      const state = postStateBase();
      state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
      state.invasions = [{
        id: 'inv1', targetRegion: 'gaza', composition: { infantry: 0, armor: 7500, air: 0 },
        morale: 100, supply: 100, active: true, isPlayerAttacker: true, commanderId
      }];
      state.rngSeed = rngSeed;
      return state;
    };

    let sawImprovement = false;
    for (let seed = 0; seed < 100 && !sawImprovement; seed++) {
      const without = resolveTurn(buildState(null, seed));
      const withCommander = resolveTurn(buildState('rafael_katz', seed));
      const survivorsWithout = sumUnits(without.invasions[0].composition);
      const survivorsWith = sumUnits(withCommander.invasions[0].composition);
      const capturedOnlyWithCommander = withCommander.regions.gaza.owner === 'player' && without.regions.gaza.owner !== 'player';
      if (survivorsWith > survivorsWithout || withCommander.regions.gaza.control > without.regions.gaza.control || capturedOnlyWithCommander) {
        sawImprovement = true;
      }
    }
    expect(sawImprovement).toBe(true);
  });

  it('a logistics expert reduces supply decay', () => {
    const state = postStateBase();
    state.invasions = [{
      id: 'inv1', targetRegion: 'egypt_cairo', composition: { infantry: 1, armor: 0, air: 0 },
      morale: 100, supply: 100, active: true, isPlayerAttacker: true, commanderId: 'yael_ronen'
    }];
    const next = resolveTurn(state);
    // egypt_cairo is 2 hops from the player's core -> base decay 13; yael_ronen's
    // supplyDecayMult 0.6 -> round(13 * 0.6) = 8.
    expect(next.invasions.find(i => i.id === 'inv1').supply).toBe(92);
  });

  it('a morale officer halves morale loss from a decisively-lost offensive', () => {
    const buildState = (commanderId) => {
      const state = postStateBase();
      state.regions.gaza = { ...state.regions.gaza, owner: 'egypt', control: 100 };
      state.invasions = [{
        // 1 infantry can never beat gaza's defense (egypt's 15000 * 0.3 * fortification 2 =
        // 9000) regardless of the random factor, so this loss is deterministic — no seed search
        // needed to isolate the morale-loss-mult effect.
        id: 'inv1', targetRegion: 'gaza', composition: { infantry: 1, armor: 0, air: 0 },
        morale: 100, supply: 100, active: true, isPlayerAttacker: true, commanderId
      }];
      state.rngSeed = 42;
      return state;
    };
    const without = resolveTurn(buildState(null));
    const withOfficer = resolveTurn(buildState('moshe_avrahami'));
    expect(withOfficer.invasions[0].morale).toBeGreaterThan(without.invasions[0].morale);
  });
});

describe('resolveTurn multiple win conditions (Phase 10)', () => {
  it('triggers military_conquest victory the turn every 1948-war-attacker\'s capital is held', () => {
    const state = postStateBase();
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    const regions = { ...state.regions };
    INDEPENDENCE_WAR_ATTACKERS.forEach(nationId => {
      const capital = getNationCapital(nationId);
      regions[capital] = { ...regions[capital], owner: 'player' };
    });
    state.regions = regions;
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('military_conquest');
  });

  it('triggers diplomatic_hegemony victory once every hostile bloc member is at peace or trading', () => {
    const state = postStateBase();
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    const nations = { ...state.nations };
    Object.values(HOSTILE_BLOCS).flat().forEach(id => {
      nations[id] = { ...nations[id], hasPeaceTreaty: true, isAtWar: false };
    });
    state.nations = nations;
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('diplomatic_hegemony');
  });

  it('does not check victory conditions while an event is pending', () => {
    const state = postStateBase();
    state.activeEventId = 'balfour_1917';
    const regions = { ...state.regions };
    INDEPENDENCE_WAR_ATTACKERS.forEach(nationId => {
      const capital = getNationCapital(nationId);
      regions[capital] = { ...regions[capital], owner: 'player' };
    });
    state.regions = regions;
    // resolveTurn is a no-op while an event is pending (existing guard) — this just confirms
    // that guard still holds even when a victory condition would otherwise already be met.
    expect(resolveTurn(state)).toBe(state);
  });

  it('DEFEAT still takes priority — losing core territory is checked before any victory condition', () => {
    const state = postStateBase();
    state.firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map(id => [id, true]));
    const nations = { ...state.nations };
    Object.values(HOSTILE_BLOCS).flat().forEach(id => {
      nations[id] = { ...nations[id], hasPeaceTreaty: true, isAtWar: false };
    });
    state.nations = nations;
    state.regions = { ...state.regions, tel_aviv: { ...state.regions.tel_aviv, owner: 'egypt' } };
    const next = resolveTurn(state);
    expect(next.gameStatus).toBe(GameStatus.DEFEAT);
  });
});
