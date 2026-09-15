import { describe, it, expect } from 'vitest';
import { resolveTurn, findConflictTerritoryTransfer } from './resolveTurn';
import { createInitialState } from '../context/GameContext';
import { GamePhases, GameStatus } from '../data/types';
import { sumUnits } from '../utils/helpers';
import { HISTORICAL_EVENTS } from '../data/events';

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
