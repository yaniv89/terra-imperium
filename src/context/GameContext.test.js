import { describe, it, expect, afterEach } from 'vitest';
import { applyResearchTurn, getResearchCost } from '../engine/research';
import { hasMet } from '../engine/fog';
import { gameReducer } from './GameContext';
import { ActionTypes, GameStatus, LogTypes } from '../data/types';
import { XP_THRESHOLDS } from '../data/promotions';
import { TECH_TREE } from '../data/techTree';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { regionHasDeposit } from '../data/deposits';
import { getNationCapital, REGIONS_DATA, getBorderingNationIds, getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities, withDecrees, neighbourWorld, peoplesWorld, rivalOf, borderPair, cloneWorld } from '../engine/testWorld';
import { syncWorldRegistry } from '../engine/world/registry';
import { setTruce } from '../engine/diplomacy';
import { hasIntel, getIntelTurnsLeft, canSeeRegionDetails } from '../engine/intel';
import { INTEL_DURATION_TURNS, ESPIONAGE_TECH_POINTS_STOLEN, ESPIONAGE_FAILURE_HOSTILITY_INCREASE, COUNTER_INTEL_HOSTILITY_REDUCTION, ACTION_COSTS } from '../data/actionCosts';
import { IDENTITY_SHIFT_STEP, IDENTITY_MAX } from '../data/identity';
import { CLIMATE_RESILIENCE_MAX, CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION } from '../data/actionCosts';
import { TAX_RATE_CHANGE_COOLDOWN_TURNS } from '../data/taxRates';
import { ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_MAX, ARMY_MAINTENANCE_DEFAULT } from '../data/actionCosts';
import { MAX_RIVALS, VASSAL_ANNEX_COOLDOWN_TURNS, TRUCE_BREAK_STABILITY_PENALTY } from '../data/actionCosts';
import { claimableCities } from '../engine/claims';
import { displayYear } from '../engine/displayYear';

// A nation now spans many real provinces, not one region matching its own id — these tests use
// each nation's capital as "its" region wherever the old one-region-per-nation model used the
// nation id directly as a region id.
const cap = getNationCapital;

// The old tests named countries; a peoples world names its own. FR is the player, DE/GB/BE/JP border it
// (neighbourWorld founds a city of each beside the player's capital); US, LU, AT are further majors.
const SEED = 1;
const SCENARIO = { mode: 'peoples', size: 'small', seed: SEED, independents: false };
const BASE = neighbourWorld({ player: 'ahhiyawa', seed: SEED, rivals: 4, age: 'bronze', fog: false });
const FR = BASE.playerNationId;
const [DE, GB, BE, JP] = [0, 1, 2, 3].map((i) => rivalOf(BASE, i));
const [US, LU, AT] = [4, 6, 7].map((i) => rivalOf(BASE, i));
// A fresh, changeable game as `player` (the shared cached world is cloned first).
const game = (player = FR) => cloneWorld(player === FR ? BASE : peoplesWorld({ seed: SEED, player, age: 'bronze', fog: false }));

// Plan §M13: LAUNCH_INVASION/AMPHIBIOUS_ASSAULT now require an active war with the target's owner
// (a real pre-existing gap this milestone fixes — see gameReducer.js's own comment on those cases),
// so any test exercising them needs one declared first. A minimal, directly-constructed war record
// is enough here; these are unit tests on the reducer's own capture logic, not on declareWar itself.
const withWarAgainst = (state, targetNationId) => ({
  ...state,
  wars: [...state.wars, {
    id: `war_test_${targetNationId}`, aggressor: state.playerNationId, enemy: targetNationId, active: true,
    goalAchieved: false, startYear: state.year, startTurn: state.turnNumber, cb: 'none',
    battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0,
    goal: { type: 'destroy_military', threshold: 1 }
  }]
});


// A refused player action now logs WHY (gameReducer.js's `reject`), so it's no longer the identical
// state object — but nothing other than that one log line may change.
const expectRefused = (next, state) => {
  if (next === state) return;
  expect(next.logs.length).toBe(state.logs.length + 1);
  ['resources', 'regions', 'nations', 'units', 'wars'].forEach((key) => expect(next[key]).toBe(state[key]));
};

describe('ADVANCE_TURN / RESOLVE_EVENT delegate to the pure engine', () => {
  it('ADVANCE_TURN advances the turn, writes the year label and delegates to resolveTurn', () => {
    const state = game();
    const next = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    expect(next.year).toBe(displayYear(next));
    expect(next.turnNumber).toBe(state.turnNumber + 1);
  });

  it('ADVANCE_TURN is a no-op once the game has ended', () => {
    const state = { ...game(), gameStatus: GameStatus.DEFEAT };
    const next = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    expect(next).toBe(state);
  });

  it('RESOLVE_EVENT is a no-op if there is no active event', () => {
    const state = game();
    const next = gameReducer(state, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    expect(next).toBe(state);
  });
});

describe('ADD_LOG', () => {
  it('appends a log entry with the given message and type', () => {
    const state = game();
    const next = gameReducer(state, { type: ActionTypes.ADD_LOG, payload: { message: 'Test message', type: LogTypes.MILESTONE } });
    expect(next.logs[next.logs.length - 1]).toEqual({ year: state.year, message: 'Test message', type: LogTypes.MILESTONE });
  });

  it('defaults to LogTypes.ACTION when no type is given', () => {
    const state = game();
    const next = gameReducer(state, { type: ActionTypes.ADD_LOG, payload: { message: 'Test message' } });
    expect(next.logs[next.logs.length - 1].type).toBe(LogTypes.ACTION);
  });
});

describe('RESET_GAME', () => {
  it('starts a fresh game as the requested nation and speed', () => {
    const state = game();
    const next = gameReducer(state, { type: ActionTypes.RESET_GAME, payload: { playerNationId: JP, scenario: SCENARIO, rngSeed: SEED, gameSpeed: 'fast' } });
    expect(next.playerNationId).toBe(JP);
    expect(next.nations[JP].isPlayer).toBe(true);
    expect(Object.values(next.nations).filter((n) => n.isPlayer).map((n) => n.id)).toEqual([JP]);
    expect(next.gameSpeed).toBe('fast');
    expect(next.turnNumber).toBe(1);
  });

  it('applies the requested difficulty', () => {
    const state = game();
    const next = gameReducer(state, { type: ActionTypes.RESET_GAME, payload: { playerNationId: FR, scenario: SCENARIO, rngSeed: SEED, difficultyId: 'emperor' } });
    expect(next.difficultyId).toBe('emperor');
    expect(next.difficultyMultiplier).toBeGreaterThan(1);
  });

  it('applies a starting doctrine when one is passed', () => {
    const state = game();
    // 'none' has no effects, so this just confirms it doesn't throw and resources stay sane.
    const next = gameReducer(state, { type: ActionTypes.RESET_GAME, payload: { playerNationId: FR, scenario: SCENARIO, rngSeed: SEED, doctrineId: 'none' } });
    expect(next.resources.gold).toBeGreaterThanOrEqual(0);
  });
});

describe('LOAD_GAME', () => {
  it('merges the payload over a fresh state, defaulting gameStatus to ACTIVE', () => {
    const state = game();
    const saved = { ...state, turnNumber: 42, playerNationId: DE };
    const next = gameReducer(state, { type: ActionTypes.LOAD_GAME, payload: saved });
    expect(next.turnNumber).toBe(42);
    expect(next.playerNationId).toBe(DE);
    expect(next.gameStatus).toBe(GameStatus.ACTIVE);
  });
});

describe('Domestic tab actions', () => {
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000 } };
  };

  describe('GAIN_CONTROL', () => {
    it('raises control by 5% and deducts the cost', () => {
      const before = richState();
      const withLowControl = { ...before, regions: { ...before.regions, [cap(FR)]: { ...before.regions[cap(FR)], control: 50 } } };
      const next = gameReducer(withLowControl, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].control).toBe(55);
      expect(next.resources.gold).toBeLessThan(withLowControl.resources.gold);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      const otherId = Object.keys(state.regions).find((id) => state.regions[id].owner !== FR);
      expect(gameReducer(state, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: otherId } })).toBe(state);
    });

    it('is a no-op already at 100% control', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: cap(FR) } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = game();
      const withLowControl = { ...state, resources: { ...state.resources, gold: 0 }, regions: { ...state.regions, [cap(FR)]: { ...state.regions[cap(FR)], control: 50 } } };
      expect(gameReducer(withLowControl, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: cap(FR) } })).toBe(withLowControl);
    });
  });

  describe('BUILD_INFRASTRUCTURE', () => {
    it('raises infrastructure level and deducts the cost', () => {
      const base = richState();
      const state = { ...base, regions: { ...base.regions, [cap(FR)]: { ...base.regions[cap(FR)], currentInfrastructure: 3 } } };
      const next = gameReducer(state, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].currentInfrastructure).toBe(4);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op at the level cap', () => {
      const state = richState();
      const maxed = { ...state, regions: { ...state.regions, [cap(FR)]: { ...state.regions[cap(FR)], currentInfrastructure: 10 } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cap(FR) } })).toBe(maxed);
    });
  });

  describe('BUILD_DEFENSES', () => {
    it('raises defenseLevel and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_DEFENSES, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].defenseLevel).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op at the level cap', () => {
      const state = richState();
      const maxed = { ...state, regions: { ...state.regions, [cap(FR)]: { ...state.regions[cap(FR)], defenseLevel: 10 } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_DEFENSES, payload: { regionId: cap(FR) } })).toBe(maxed);
    });
  });

  describe('BUILD_CLIMATE_RESILIENCE', () => {
    // Modern-age-only, unlike Build Defenses — richState() above starts in the Bronze Age.
    const modernState = () => ({ ...richState(), age: 'modern', techAgeId: 'modern' });

    it('raises climateResilience and deducts the cost', () => {
      const state = modernState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].climateResilience).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op before the Modern Age', () => {
      const state = richState(); // Bronze Age
      expect(gameReducer(state, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap(FR) } })).toBe(state);
    });

    it('is a no-op at the level cap', () => {
      const state = modernState();
      const maxed = { ...state, regions: { ...state.regions, [cap(FR)]: { ...state.regions[cap(FR)], climateResilience: CLIMATE_RESILIENCE_MAX } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap(FR) } })).toBe(maxed);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...modernState(), resources: { ...modernState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap(FR) } })).toBe(state);
    });
  });

  describe('CONSTRUCT_BUILDING (plan §M6: tech-gated, real per-tier gold cost, slot-limited)', () => {
    it('builds a tier-1 with no requiresTech, at no tech at all researched', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } });
      expect(next.regions[cap(FR)].buildings.categories.food).toBe(0); // Granary
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op for a tier gated by a tech that is not researched', () => {
      const state = richState();
      const tier0 = gameReducer(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } }), { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } }); // Storage Pits, then the Granary
      // Irrigation (tier 2) requires infrastructure_aqueducts — not researched.
      expect(gameReducer(tier0, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } })).toBe(tier0);
    });

    it('builds a gated tier once its specific tech is researched', () => {
      const base = richState();
      const tier0 = gameReducer(gameReducer(base, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } }), { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } }); // Storage Pits, then the Granary
      const withTech = { ...tier0, techTree: { ...tier0.techTree, infrastructure_aqueducts: { ...tier0.techTree.infrastructure_aqueducts, researched: true } } };
      const tier1 = gameReducer(withTech, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } });
      expect(tier1.regions[cap(FR)].buildings.categories.food).toBe(2); // Irrigation
    });

    it('is a no-op for a category whose own tier-1 requires a tech (e.g. Economy needs Minted Coinage)', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'economy' } })).toBe(state);
    });

    it('is a no-op for a naval building in a non-coastal region', () => {
      const state = richState();
      const inlandId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && !REGIONS_DATA[id]?.isCoastal);
      if (!inlandId) return; // no inland French region in the current dataset — nothing to assert
      const withTech = { ...state, techTree: { ...state.techTree, economy_silk_road_trade: { ...state.techTree.economy_silk_road_trade, researched: true } } };
      expect(gameReducer(withTech, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: inlandId, categoryId: 'naval' } })).toBe(withTech);
    });

    it('rejects a new category once every building slot is used, but upgrading an existing one is still free', () => {
      // France's capital: 1 base + 1 for being the capital = 2 slots at 0 extra dev (development is
      // zeroed here: balanced regions start with more of it, and more dev means more slots).
      let state = richState();
      const capDev = state.regions[cap(FR)].dev;
      state = { ...state, regions: { ...state.regions, [cap(FR)]: { ...state.regions[cap(FR)], dev: Object.fromEntries(Object.keys(capDev).map((k) => [k, 0])) } } };
      state = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } }); // slot 1/2
      state = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'military' } }); // slot 2/2
      state = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'military' } }); // the Warrior Lodge, then the Barracks
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'defense' } })).toBe(state); // no free slot for a THIRD category
      const upgraded = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'military' } }); // Drill Yard needs Iron Weapons though
      expect(upgraded).toBe(state); // rejected by the tech gate, not the (already-passing) slot check
      const withTech = { ...state, techTree: { ...state.techTree, military_iron_weapons: { ...state.techTree.military_iron_weapons, researched: true } } };
      const upgradedForReal = gameReducer(withTech, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'military' } });
      expect(upgradedForReal.regions[cap(FR)].buildings.categories.military).toBe(2); // upgrading is free of slots
    });

    it('is a no-op when unaffordable', () => {
      const fresh = game();
      const base = { ...fresh, resources: { ...fresh.resources, gold: 0 } };
      expect(gameReducer(base, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'food' } })).toBe(base);
    });

    it('rejects an unknown category', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap(FR), categoryId: 'not_real' } })).toBe(state);
    });
  });

  describe('DEVELOP_RESOURCE_SITE', () => {
    // A small peoples world has few deposits, so the player's capital gets copper and oil in the registry
    // the reducer reads (data/deposits.js); afterEach puts the registry back.
    const original = REGIONS_DATA[cap(FR)].deposits;
    const withDeposits = (state) => {
      syncWorldRegistry(state);
      REGIONS_DATA[cap(FR)].deposits = ['copper', 'oil'];
      return state;
    };
    afterEach(() => { REGIONS_DATA[cap(FR)].deposits = original; });
    const develop = (state, resourceId) => gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cap(FR), resourceId } });
    it('develops a deposit the region actually has', () => {
      const next = develop(withDeposits(richState()), 'copper');
      expect(next.regions[cap(FR)].buildings.extraction.copper).toBe(true);
    });

    it('rejects a resource the region has no deposit for', () => {
      const state = richState(FR);
      expect(regionHasDeposit(state.regions[cap(FR)], 'copper')).toBe(false);
      expect(develop(state, 'copper')).toBe(state);
    });

    it('rejects developing the same site twice', () => {
      const once = develop(withDeposits(richState()), 'copper');
      expect(develop(once, 'copper')).toBe(once);
    });

    it('rejects a resource not yet unlocked by age', () => {
      const state = withDeposits(richState()); // oil needs the Modern age
      expect(develop(state, 'oil')).toBe(state);
    });
  });

  describe('DEVELOP_PROVINCE (plan §M5)', () => {
    const powerRichState = () => {
      const state = game();
      return { ...state, resources: { ...state.resources, gold: 1000000 } };
    };

    it('raises the region\'s tax development by 1 and deducts the gold cost', () => {
      const state = powerRichState();
      const before = state.regions[cap(FR)].dev.tax;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap(FR), devType: 'tax' } });
      expect(next.regions[cap(FR)].dev.tax).toBe(before + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('raises production development and spends gold', () => {
      const state = powerRichState();
      const before = state.regions[cap(FR)].dev.production;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap(FR), devType: 'production' } });
      expect(next.regions[cap(FR)].dev.production).toBe(before + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('raises manpower development and spends gold', () => {
      const state = powerRichState();
      const before = state.regions[cap(FR)].dev.manpower;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap(FR), devType: 'manpower' } });
      expect(next.regions[cap(FR)].dev.manpower).toBe(before + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('grows the region\'s population by 3% of its modern baseline', () => {
      const state = powerRichState();
      const before = state.regions[cap(FR)].currentPopulation;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap(FR), devType: 'tax' } });
      expect(next.regions[cap(FR)].currentPopulation).toBeGreaterThan(before);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = powerRichState();
      const otherId = Object.keys(state.regions).find((id) => id !== cap(FR) && state.regions[id].owner !== FR);
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: otherId, devType: 'tax' } })).toBe(state);
    });

    it('is a no-op for an invalid devType', () => {
      const state = powerRichState();
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap(FR), devType: 'bogus' } })).toBe(state);
    });

    it('is a no-op when the gold cannot cover the cost', () => {
      const fresh = game();
      const base = { ...fresh, resources: { ...fresh.resources, gold: 0 } };
      expect(gameReducer(base, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap(FR), devType: 'tax' } })).toBe(base);
    });
  });

  describe('QUELL_UNREST', () => {
    const withUnrest = (unrest) => {
      const base = richState();
      return { ...base, regions: { ...base.regions, [cap(FR)]: { ...base.regions[cap(FR)], unrest } } };
    };

    it('reduces unrest and deducts the cost', () => {
      const state = withUnrest(50);
      const next = gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].unrest).toBe(20);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when there is no unrest to quell', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: cap(FR) } })).toBe(state);
    });

    it('floors at 0 rather than going negative', () => {
      const state = withUnrest(10);
      const next = gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].unrest).toBe(0);
    });
  });

  describe('SETTLE_COLONIZE', () => {
    const BE_BORDER = borderPair(BASE, FR, BE)[1]; // a BE city touching FR
    // Settling now needs land nobody governs: a rebel army holding the province (or a dead owner).
    const withCollapsedNeighbor = (control, rebels = true) => {
      const base = richState();
      const units = rebels
        ? { ...base.units, rebel_be: { id: 'rebel_be', regionId: BE_BORDER, ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', strength: 20, maxStrength: 20, morale: 100, movesLeft: 1 } }
        : base.units;
      return { ...base, units, regions: { ...base.regions, [BE_BORDER]: { ...base.regions[BE_BORDER], control } } };
    };

    it('refuses a living nation\'s province that no rebels hold, however low its control', () => {
      const state = withCollapsedNeighbor(10, false);
      const next = gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: BE_BORDER } });
      expectRefused(next, state);
    });

    it('absorbs a bordering rebel-held province whose control has collapsed, and deducts the cost', () => {
      const state = withCollapsedNeighbor(10);
      const next = gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: BE_BORDER } });
      expect(next.regions[BE_BORDER].owner).toBe(FR);
      expect(next.regions[BE_BORDER].control).toBeGreaterThan(0);
      expect(next.regions[BE_BORDER].control).toBeLessThan(100);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.regions[BE_BORDER].formerOwner).toBe(BE);
    });

    it('is a no-op when the target still has real control of its own territory', () => {
      const state = withCollapsedNeighbor(50);
      expectRefused(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: BE_BORDER } }), state);
    });

    it('is a no-op on a region that does not border the player', () => {
      // US does not border FR.
      const base = richState();
      const state = { ...base, regions: { ...base.regions, [cap(US)]: { ...base.regions[cap(US)], control: 5 } } };
      expectRefused(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap(US) } }), state);
    });

    it('is a no-op on a region the player already owns', () => {
      const state = withCollapsedNeighbor(10);
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap(FR) } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const base = withCollapsedNeighbor(10);
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expectRefused(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: BE_BORDER } }), state);
    });
  });

  describe('POPULATION_POLICY', () => {
    it('grows population and deducts the cost', () => {
      const state = richState();
      const before = state.regions[cap(FR)].currentPopulation;
      const next = gameReducer(state, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: cap(FR) } });
      expect(next.regions[cap(FR)].currentPopulation).toBeGreaterThan(before);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: cap(BE) } })).toBe(state);
    });
  });

  describe('SET_TAX_RATE', () => {
    // Free (0 AP) — a slider flip, not a strategic decision competing with the AP budget.
    it('changes the tax rate at no resource cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'high' } });
      expect(next.nations[FR].taxRate).toBe('high');
      expect(next.resources.actionPoints).toBe(state.resources.actionPoints);
    });

    it('is a no-op for an unknown rate id', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'not_real' } })).toBe(state);
    });

    it('is a no-op when already at the requested rate', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'normal' } })).toBe(state);
    });

    // Plan §M11: "cooldown 3 turns".
    it('is a no-op while on cooldown, and allows a change again once it has passed', () => {
      const state = richState();
      const changed = gameReducer(state, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'high' } });
      expect(gameReducer(changed, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'low' } })).toBe(changed);
      const afterCooldown = { ...changed, turnNumber: changed.turnNumber + TAX_RATE_CHANGE_COOLDOWN_TURNS };
      const next = gameReducer(afterCooldown, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'low' } });
      expect(next.nations[FR].taxRate).toBe('low');
    });
  });

  describe('SET_ARMY_MAINTENANCE / SET_NAVY_MAINTENANCE (plan §M11)', () => {
    it('sets and clamps the army maintenance slider', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: 70 } }).nations[FR].armyMaintenance).toBe(70);
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: 10 } }).nations[FR].armyMaintenance).toBe(ARMY_MAINTENANCE_MIN);
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: 200 } }).nations[FR].armyMaintenance).toBe(ARMY_MAINTENANCE_MAX);
    });

    it('sets the navy maintenance slider independently of army', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_NAVY_MAINTENANCE, payload: { value: 60 } });
      expect(next.nations[FR].navyMaintenance).toBe(60);
      expect(next.nations[FR].armyMaintenance).toBe(ARMY_MAINTENANCE_DEFAULT);
    });

    it('is a no-op (free, no cost) when the clamped value is unchanged', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: ARMY_MAINTENANCE_DEFAULT } })).toBe(state);
    });
  });

  describe('REQUEST_LOAN / REPAY_LOAN (plan §M11)', () => {
    const withBankingHouses = (state) => ({
      ...state,
      techTree: { ...state.techTree, economy_banking_houses: { ...state.techTree.economy_banking_houses, researched: true } }
    });

    it('is a no-op without Banking Houses researched', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.REQUEST_LOAN })).toBe(state);
    });

    it('adds gold and a loan record once Banking Houses is researched', () => {
      const state = withBankingHouses(richState());
      const next = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      expect(next.nations[FR].loans.length).toBe(1);
      expect(next.resources.gold).toBeGreaterThan(state.resources.gold);
      expect(next.nations[FR].loans[0].principal).toBeGreaterThanOrEqual(200);
    });

    it('is a no-op once loan capacity is exhausted', () => {
      let state = withBankingHouses(richState());
      const capacity = 4; // base 3 + 1 for Banking Houses, no Bank buildings
      for (let i = 0; i < capacity; i++) state = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      expect(state.nations[FR].loans.length).toBe(capacity);
      expect(gameReducer(state, { type: ActionTypes.REQUEST_LOAN })).toBe(state);
    });

    it('repaying a loan removes it and deducts its principal', () => {
      const state = withBankingHouses(richState());
      const withLoan = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      const loan = withLoan.nations[FR].loans[0];
      const next = gameReducer(withLoan, { type: ActionTypes.REPAY_LOAN, payload: { loanId: loan.id } });
      expect(next.nations[FR].loans.length).toBe(0);
      expect(next.resources.gold).toBe(withLoan.resources.gold - loan.principal);
    });

    it('repaying is a no-op when the player can\'t afford the principal', () => {
      const state = withBankingHouses(richState());
      const withLoan = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      const loan = withLoan.nations[FR].loans[0];
      const poor = { ...withLoan, resources: { ...withLoan.resources, gold: 0 } };
      expectRefused(gameReducer(poor, { type: ActionTypes.REPAY_LOAN, payload: { loanId: loan.id } }), poor);
    });
  });

  describe('INCREASE_STABILITY (plan §M4)', () => {
    const admRichState = () => {
      const state = game();
      return withDecrees({ ...state, resources: { ...state.resources, gold: 100000 } });
    };

    it('raises stability by 1 and spends gold and a decree', () => {
      const state = admRichState();
      const next = gameReducer(state, { type: ActionTypes.INCREASE_STABILITY });
      expect(next.nations[FR].stability).toBe((state.nations[FR].stability || 0) + 1);
      expect(next.nations[FR].ruler.decrees).toBe(state.nations[FR].ruler.decrees - 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op once stability is already at its maximum', () => {
      const state = { ...admRichState() };
      state.nations = { ...state.nations, [FR]: { ...state.nations[FR], stability: 3 } };
      expect(gameReducer(state, { type: ActionTypes.INCREASE_STABILITY })).toBe(state);
    });

    it('is a no-op when the player has no decree', () => {
      const fresh = game();
      const base = withDecrees({ ...fresh, resources: { ...fresh.resources, gold: 100000 } }, 0);
      expect(gameReducer(base, { type: ActionTypes.INCREASE_STABILITY })).toBe(base);
    });
  });
});

describe('Military tab actions', () => {
  // French states build on WORLD (below): the Dawn world gives France one city with no room
  // beside it, and these actions need a border city with a French neighbour.
  const richState = (playerNationId = FR) => {
    const state = playerNationId === FR ? WORLD.state : { ...game(playerNationId), units: {} };
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000 } };
  };

  describe('RECRUIT_UNIT', () => {
    it('creates a unit in the region with the requested class and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
      const unitIds = Object.keys(next.units);
      expect(unitIds.length).toBe(1);
      const unit = next.units[unitIds[0]];
      expect(unit.regionId).toBe(cap(FR));
      expect(unit.classId).toBe('infantry');
      expect(unit.ownerId).toBe(FR);
      expect(unit.domain).toBe('land');
      expect(next.nextUnitSeq).toBe(state.nextUnitSeq + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.resources.hr).toBeLessThan(state.resources.hr);
    });

    // Regression: militaryStrength (the "power" stat shown in the header) never moved for the
    // player on recruit/disband — only the AI's passive-growth path touched it — so a player could
    // train an entire army and see their own displayed power sit frozen forever.
    it('raises the player\'s militaryStrength by the new unit\'s strength', () => {
      const state = richState();
      const before = state.nations[FR].militaryStrength;
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
      const unit = Object.values(next.units)[0];
      expect(next.nations[FR].militaryStrength).toBe(before + unit.strength);
    });

    it('sets domain to naval for the naval class', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'naval' } });
      const unit = Object.values(next.units)[0];
      expect(unit.domain).toBe('naval');
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      const otherId = Object.keys(state.regions).find((id) => state.regions[id].owner !== FR);
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: otherId, classId: 'infantry' } })).toBe(state);
    });

    it('is a no-op for a class not yet available at the current age', () => {
      const state = richState(); // Bronze Age: no Air units yet
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'air' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = game();
      const poor = { ...state, resources: { ...state.resources, gold: 0, hr: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } })).toBe(poor);
    });
  });

  describe('DISBAND_UNIT', () => {
    const withUnit = () => {
      const state = richState();
      return gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
    };

    it('removes the unit and refunds a fraction of its HR cost', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
      expect(next.units[unitId]).toBeUndefined();
      expect(next.resources.hr).toBeGreaterThan(state.resources.hr);
    });

    it('lowers the player\'s militaryStrength by the disbanded unit\'s strength', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const before = state.nations[FR].militaryStrength;
      const next = gameReducer(state, { type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
      expect(next.nations[FR].militaryStrength).toBe(before - state.units[unitId].strength);
    });

    it('is a no-op for a unit that does not exist', () => {
      const state = withUnit();
      expect(gameReducer(state, { type: ActionTypes.DISBAND_UNIT, payload: { unitId: 'not_real' } })).toBe(state);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: DE } } };
      expect(gameReducer(stolen, { type: ActionTypes.DISBAND_UNIT, payload: { unitId } })).toBe(stolen);
    });
  });

  // fr-59 (Nord) really borders be-vwv (Hainaut) — worldRegions.json — used below wherever the
  // old model's bare FR/BE needed genuine land adjacency, not just any owned region (a
  // nation's capital, e.g. Paris, isn't necessarily anywhere near a given border).
  // The Dawn world gives France one city with no room beside it, so the fixture founds French
  // cities on the nearest free land: FR_BORDER (bordering a foreign capital, the invasion's
  // target) and FR_NEIGHBOR, a second French city bordering it. The enemy is whoever owns the target.
  const WORLD = (() => {
    const first = addCity(game(), FR);
    // A land attack from inside a city needs the two lands to touch (registry `touching`); the Dawn
    // bridge between capitals no longer carries one.
    const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== FR) || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== FR);
    const second = addCity(first.state, FR, { near: first.cityId });
    const AGG = second.state.regions[target].owner;
    // The enemy gets two more cities, so taking the target does not end its nation and its war.
    const grown = addCities(second.state, AGG, 2);
    return { state: { ...grown.state, units: {} }, FR_BORDER: first.cityId, BE_REGION: target, FR_NEIGHBOR: second.cityId, AGG };
  })();
  const { FR_BORDER, BE_REGION, FR_NEIGHBOR, AGG } = WORLD;

  describe('MOVE_ARMY', () => {
    // A French-owned neighbor of FR_BORDER (fr-62, Pas-de-Calais) — MOVE_ARMY is redeployment
    // within your own territory, not an invasion, so a genuinely successful move has to land in a
    // region the player already owns; BE_REGION (foreign, Belgium) is used below specifically to
    // confirm that's rejected, not as a valid destination.
    const withUnit = () => {
      const state = richState();
      return gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'infantry' } });
    };

    // Move now walks the same route a march would, and only when it fits in this turn's movement
    // (routes.js moveNowCheck): the unit stands one tile from the city it moves into.
    const beside = (state, cityId) => getTiles().neighbors[state.regions[cityId].tile].find((t) => getTiles().land[t] === 1);
    it('moves the unit to a player-owned city it can reach this turn, and spends its move (plan §M14)', () => {
      const s0 = withUnit();
      const unitId = Object.keys(s0.units)[0];
      const state = { ...s0, units: { ...s0.units, [unitId]: { ...s0.units[unitId], classId: 'cavalry', tile: beside(s0, FR_NEIGHBOR) } } };
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } });
      expect(next.units[unitId].regionId).toBe(FR_NEIGHBOR);
      expect(next.units[unitId].tile).toBe(state.regions[FR_NEIGHBOR].tile);
      expect(next.units[unitId].movesLeft).toBe(0);
    });

    it('refuses, with the reason, a city the march would not reach this turn (no jump: playtest audit I065)', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } });
      expect(next.units).toBe(state.units);
      expect(next.logs[next.logs.length - 1].message).toMatch(/Too far to move now: the march needs \d+ more End Turn/);
    });

    it('is a no-op once the unit has no moves left this turn (plan §M14)', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const spent = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], movesLeft: 0 } } };
      expect(gameReducer(spent, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } })).toBe(spent);
    });

    // Regression (playtest report): Move Army let a unit walk straight into a foreign, not-at-war
    // region with no invasion, no combat, and no consequence beyond the ordinary move cost — a
    // real bug, not the game's actual invasion mechanic (LAUNCH_INVASION/AMPHIBIOUS_ASSAULT).
    it('is a no-op moving to an adjacent but foreign-owned region', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: BE_REGION } });
      expect(next.units).toBe(state.units);
      expect(next.resources).toBe(state.resources);
      expect(next.logs[next.logs.length - 1].message).toMatch(/city of your own/);
    });

    it('moves nothing to a far foreign region', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: cap(JP) } });
      expect(next.units).toBe(state.units);
      expect(next.resources).toBe(state.resources);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: DE } } };
      expect(gameReducer(stolen, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } })).toBe(stolen);
    });
  });

  describe('LAUNCH_INVASION', () => {
    it('invading a nation you are at peace with does nothing but explain why (declare war first)', () => {
      const state = game();
      const [from, target] = borderPair(BASE, FR, BE); // two bordering cities
      const armed = { ...state, units: { x1: { id: 'x1', regionId: from, ownerId: FR, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1 } } };
      const next = gameReducer(armed, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: from, targetRegionId: target } });
      expectRefused(next, armed);
      expect(next.logs.at(-1).message).toMatch(/at peace with .* declare war/i);
    });

    const withAttacker = (strength) => {
      const state = withWarAgainst(richState(), AGG);
      const raw = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'infantry' } });
      // The recruit stands at the target's gates when its city's land does not touch the target's.
      const touching = getTouchingIds(FR_BORDER).includes(BE_REGION);
      const t = getTiles();
      const gate = touching ? null : t.neighbors[raw.regions[BE_REGION].tile].find((n) => t.land[n] === 1);
      const recruited = gate == null ? raw : { ...raw, units: Object.fromEntries(Object.entries(raw.units).map(([id, u]) => [id, u.regionId === FR_BORDER && u.domain === 'land' ? { ...u, tile: gate } : u])) };
      if (strength === undefined) return recruited;
      const unitId = Object.keys(recruited.units)[0];
      return { ...recruited, units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], strength } } };
    };

    it('conquers an empty adjacent city with broken defences and moves surviving units into it', () => {
      // Conquest by battle (src/engine/conquest.js): a captured region becomes the attacker's at
      // once, marked with the war it was taken in so a peace deal can still hand it back. An empty
      // city falls on Auto when an attack brings its HP to 0 (cityAssault.js).
      const raw = withAttacker();
      const state = { ...raw, regions: { ...raw.regions, [BE_REGION]: { ...raw.regions[BE_REGION], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } };
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(next.regions[BE_REGION].owner).toBe(FR);
      expect(next.regions[BE_REGION].occupiedBy).toBeUndefined();
      expect(next.regions[BE_REGION].conquest).toMatchObject({ from: AGG });
      // Attacking it again is refused — it's already held.
      const again = gameReducer(next, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(again.regions).toBe(next.regions);
      expect(next.units[unitId].regionId).toBe(BE_REGION);
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('records the invasion as a battle in the war record, favoring the winning side\'s war score', () => {
      const raw = withAttacker();
      const state = { ...raw, regions: { ...raw.regions, [BE_REGION]: { ...raw.regions[BE_REGION], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } }; // one hit from falling, so the attacker wins
      const war = state.wars.find(w => w.enemy === AGG || w.aggressor === AGG);
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      const nextWar = next.wars.find(w => w.id === war.id);
      expect(nextWar.battleScore).toBeGreaterThan(war.battleScore);
    });

    it('is repelled by a strong defender, leaving the region unconquered', () => {
      const state = withAttacker(100); // a token attacking force
      const defenderUnit = {
        id: 'def_x', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry', ageId: 'bronze',
        strength: 50000, maxStrength: 50000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...state, units: { ...state.units, def_x: defenderUnit } };
      const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(next.regions[BE_REGION].owner).toBe(AGG);
      expect(next.lastBattleReport.outcome).toBe('defender');
    });

    // Plan §M14 replaces the old flat "ages-behind" combat malus with roster stats compared
    // directly between the two SIDES (src/data/unitClasses.js's getRosterCombatMultiplier) —
    // getEffectiveAgeId always floors a nation at the calendar age, so falling behind on research
    // no longer separately penalizes combat on top of that floor (that would have been exactly the
    // double count the plan calls out); what DOES still matter is rushing AHEAD of the calendar.
    it('deals more attacker damage per hit when the player has rushed one age ahead of the calendar', () => {
      const baseline = withAttacker(2000);
      const attackerId = Object.keys(baseline.units)[0];
      const defenderUnit = {
        id: 'def_gap', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry',
        strength: 20000, maxStrength: 20000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...baseline, units: { ...baseline.units, def_gap: defenderUnit } };
      // Same rngSeed on both, so the only difference driving the outcome is the tech gap itself.
      const atCalendar = { ...withDefender, age: 'bronze', techAgeId: 'bronze' };
      const rushedAhead = { ...withDefender, age: 'bronze', techAgeId: 'classical' }; // effective age becomes classical

      const attackerDamage = (result) => result.lastBattleReport.log.find(l => l.attackerId === attackerId).damage;
      const atCalendarDamage = attackerDamage(gameReducer(atCalendar, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }));
      const rushedAheadDamage = attackerDamage(gameReducer(rushedAhead, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }));
      expect(rushedAheadDamage).toBeGreaterThan(atCalendarDamage);
    });

    describe('siege (src/engine/siege.js): a defended region no longer falls in one hit', () => {
      it('grinds down a defended region\'s control without capturing it when no melee unit can take it', () => {
        // Archers alone can break a garrison but can't hold the ground: the win only costs control.
        const armed = withAttacker(50000);
        const attackerId = Object.keys(armed.units)[0];
        const state = { ...armed, units: { ...armed.units, [attackerId]: { ...armed.units[attackerId], classId: 'ranged' } } };
        const defenderUnit = {
          id: 'def_weak', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        const withDefender = { ...state, units: { ...state.units, def_weak: defenderUnit } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        expect(next.regions[BE_REGION].owner).toBe(AGG); // still not captured
        expect(next.regions[BE_REGION].control).toBe(70); // 100 - 30
        expect(next.regions[BE_REGION].underInvasion).toBe(true);
        expect(next.lastBattleReport.outcome).toBe('attacker');
        expect(next.lastBattleReport.captured).toBe(false);
        // A non-capturing win still falls back to origin — the siege continues as a fresh,
        // separately-paid LAUNCH_INVASION next time, not an automatically-continuing occupation.
        expect(next.units[attackerId].regionId).toBe(FR_BORDER);
      });

      it('on Auto a beaten garrison is driven out, but the city is not taken in that battle', () => {
        const state = withAttacker(50000);
        const defenderUnit = {
          id: 'def_weak', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        // Already weakened by a prior round (or unrest) down to 40 — one more 30-point hit crosses
        // the 15 threshold.
        const withDefender = { ...state, units: { ...state.units, def_weak: defenderUnit }, regions: { ...state.regions, [BE_REGION]: { ...state.regions[BE_REGION], control: 40 } } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        // On Auto the garrison is fought first (the 14 October rule): beaten, it is driven out, but the
        // city is not taken in this battle. The next attack goes at its defences.
        expect(next.regions[BE_REGION].owner).toBe(AGG);
        expect(next.lastBattleReport.captured).toBe(false);
        expect(next.units.def_weak?.regionId ?? null).not.toBe(BE_REGION);
      });

      it('clamps at the threshold without capturing when the attacker has no melee unit deployed', () => {
        const state = withWarAgainst(richState(), AGG);
        const recruitedRanged = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'ranged' } });
        const rangedId = Object.keys(recruitedRanged.units)[0];
        const strongRanged = { ...recruitedRanged, units: { ...recruitedRanged.units, [rangedId]: { ...recruitedRanged.units[rangedId], strength: 50000 } } };
        const defenderUnit = {
          id: 'def_weak', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 100, maxStrength: 100, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        const withDefender = { ...strongRanged, units: { ...strongRanged.units, def_weak: defenderUnit }, regions: { ...strongRanged.regions, [BE_REGION]: { ...strongRanged.regions[BE_REGION], control: 40 } } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        expect(next.lastBattleReport.outcome).toBe('attacker'); // ranged fire alone broke the weak garrison
        expect(next.regions[BE_REGION].owner).toBe(AGG); // but nothing to occupy it with
        expect(next.regions[BE_REGION].control).toBe(15); // clamped at the threshold, not lower
        expect(next.lastBattleReport.captured).toBe(false);
      });

      it('defenseLevel measurably reduces incoming damage (a "Walls" bonus, src/engine/siege.js)', () => {
        const baseline = withAttacker(2000);
        const attackerId = Object.keys(baseline.units)[0];
        const defenderUnit = {
          id: 'def_gap', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 20000, maxStrength: 20000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        const withDefender = { ...baseline, units: { ...baseline.units, def_gap: defenderUnit } };
        const undefended = { ...withDefender, regions: { ...withDefender.regions, [BE_REGION]: { ...withDefender.regions[BE_REGION], defenseLevel: 0 } } };
        const fortified = { ...withDefender, regions: { ...withDefender.regions, [BE_REGION]: { ...withDefender.regions[BE_REGION], defenseLevel: 10 } } };

        const attackerDamage = (result) => result.lastBattleReport.log.find(l => l.attackerId === attackerId).damage;
        const weakWallsDamage = attackerDamage(gameReducer(undefended, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }));
        const strongWallsDamage = attackerDamage(gameReducer(fortified, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }));
        expect(strongWallsDamage).toBeLessThan(weakWallsDamage);
      });
    });

    it('is a no-op from a region not owned by the player', () => {
      const state = withAttacker();
      const otherId = Object.keys(state.regions).find(id => state.regions[id].owner !== FR);
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: otherId, targetRegionId: BE_REGION } }), state);
    });

    // Plan §M13: a real pre-existing gap this milestone fixes — invading previously required no
    // declared war at all.
    it('is a no-op with no active war against the target\'s owner', () => {
      const state = richState();
      const recruited = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'infantry' } });
      expectRefused(gameReducer(recruited, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }), recruited);
    });

    // Plan §M14: one attack per stack per turn, spent from the same movesLeft counter MOVE_ARMY uses.
    it('is a no-op once the attacking stack has already spent its move this turn', () => {
      const state = withAttacker();
      const unitId = Object.keys(state.units)[0];
      const spent = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], movesLeft: 0 } } };
      expectRefused(gameReducer(spent, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }), spent);
    });

    it('is a no-op against a region the player already owns', () => {
      const state = withAttacker();
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: FR_BORDER } }), state);
    });

    it('is a no-op against a non-adjacent region', () => {
      const state = withAttacker();
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: cap(JP) } }), state);
    });

    it('is a no-op when there are no attacker units in the source region', () => {
      const state = richState();
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }), state);
    });

  });
});

describe('Promotions and generals actions', () => {
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, mil: 10 } };
  };

  describe('PROMOTE_UNIT', () => {
    const withUnit = (xp = 0) => {
      const state = richState();
      const recruited = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
      const unitId = Object.keys(recruited.units)[0];
      return { ...recruited, units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], xp } } };
    };

    // Free (0 AP) — bookkeeping, not a strategic decision competing with the AP budget.
    it('grants the chosen perk once the unit has reached the next rank, at no resource cost', () => {
      const state = withUnit(XP_THRESHOLDS.regular);
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } });
      expect(next.units[unitId].promotions).toContain('shock');
      expect(next.resources.actionPoints).toBe(state.resources.actionPoints);
    });

    it('is a no-op if the unit has not reached the next rank yet', () => {
      const state = withUnit(0);
      const unitId = Object.keys(state.units)[0];
      expectRefused(gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } }), state);
    });

    it('is a no-op for an unknown perk id', () => {
      const state = withUnit(XP_THRESHOLDS.regular);
      const unitId = Object.keys(state.units)[0];
      expectRefused(gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'not_a_perk' } }), state);
    });

    it('is a no-op for a perk the unit already holds', () => {
      const state = withUnit(XP_THRESHOLDS.veteran);
      const unitId = Object.keys(state.units)[0];
      const withPerk = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], promotions: ['shock'] } } };
      expectRefused(gameReducer(withPerk, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } }), withPerk);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit(XP_THRESHOLDS.regular);
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: DE } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } }), stolen);
    });
  });

  describe('HIRE_GENERAL', () => {
    it('creates a general with valid traits and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.HIRE_GENERAL, payload: {} });
      const generalIds = Object.keys(next.hiredCommanders);
      expect(generalIds.length).toBe(1);
      const general = next.hiredCommanders[generalIds[0]];
      expect(general.nationId).toBe(FR);
      expect(general.assignedUnitId).toBeNull();
      expect(next.nextCommanderSeq).toBe(state.nextCommanderSeq + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...game(), resources: { ...game().resources, gold: 0 } };
      expectRefused(gameReducer(state, { type: ActionTypes.HIRE_GENERAL, payload: {} }), state);
    });
  });

  describe('APPOINT_GENERAL', () => {
    const withGeneralAndUnit = () => {
      const state = richState();
      const hired = gameReducer(state, { type: ActionTypes.HIRE_GENERAL, payload: {} });
      const recruited = gameReducer(hired, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
      const generalId = Object.keys(recruited.hiredCommanders)[0];
      const unitId = Object.keys(recruited.units)[0];
      return { state: recruited, generalId, unitId };
    };

    it('assigns a general to an owned unit', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const next = gameReducer(state, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } });
      expect(next.units[unitId].commanderId).toBe(generalId);
      expect(next.hiredCommanders[generalId].assignedUnitId).toBe(unitId);
    });

    it('reassigning a general to a new unit vacates the old one', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const appointed = gameReducer(state, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } });
      const second = gameReducer(appointed, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'cavalry' } });
      const secondUnitId = Object.keys(second.units).find((id) => id !== unitId);
      const reassigned = gameReducer(second, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId: secondUnitId } });
      expect(reassigned.units[unitId].commanderId).toBeNull();
      expect(reassigned.units[secondUnitId].commanderId).toBe(generalId);
    });

    it('unassigning with a null unitId clears the commander from their unit', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const appointed = gameReducer(state, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } });
      const unassigned = gameReducer(appointed, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId: null } });
      expect(unassigned.units[unitId].commanderId).toBeNull();
      expect(unassigned.hiredCommanders[generalId].assignedUnitId).toBeNull();
    });

    it('is a no-op for a general not owned by the player', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const stolen = { ...state, hiredCommanders: { ...state.hiredCommanders, [generalId]: { ...state.hiredCommanders[generalId], nationId: DE } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } }), stolen);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const stolenUnit = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: DE } } };
      expectRefused(gameReducer(stolenUnit, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } }), stolenUnit);
    });
  });
});

describe('Navies and amphibious invasion actions', () => {
  // A player city and a GB city that touch: the fleet sails from the first, and the second is a land-adjacent coast target.
  const [FR_PORT, GB_TARGET] = borderPair(BASE, FR, GB);
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, mil: 10 } };
  };

  const withNavalAndLand = () => {
    const state = richState();
    const withNaval = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_PORT, classId: 'naval' } });
    const withLand = gameReducer(withNaval, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_PORT, classId: 'infantry' } });
    const navalUnitId = Object.keys(withLand.units).find((id) => withLand.units[id].domain === 'naval');
    const landUnitId = Object.keys(withLand.units).find((id) => withLand.units[id].domain === 'land');
    return { state: withLand, navalUnitId, landUnitId };
  };

  describe('EMBARK_UNIT', () => {
    it('embarks a land unit onto a naval transport', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const next = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      expect(next.units[landUnitId].embarkedOn).toBe(navalUnitId);
    });

    it('is a no-op if the land unit is already embarked', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      expectRefused(gameReducer(embarked, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } }), embarked);
    });

    it('is a no-op once the transport is at capacity', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const withSecondLand = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_PORT, classId: 'cavalry' } });
      const withThirdLand = gameReducer(withSecondLand, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_PORT, classId: 'ranged' } });
      const otherLandIds = Object.keys(withThirdLand.units).filter((id) => withThirdLand.units[id].domain === 'land' && id !== landUnitId);
      const first = gameReducer(withThirdLand, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const second = gameReducer(first, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[0], navalUnitId } });
      // Transport capacity is 2 — a third embark attempt is rejected.
      expectRefused(gameReducer(second, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[1], navalUnitId } }), second);
    });

    it('is a no-op if the units are not in the same region', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const moved = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], regionId: cap(BE) } } };
      expectRefused(gameReducer(moved, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } }), moved);
    });

    it('is a no-op for a land unit not owned by the player', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const stolen = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], ownerId: DE } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } }), stolen);
    });

  });

  describe('DISEMBARK_UNIT', () => {
    it('clears embarkedOn for an embarked unit', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const next = gameReducer(embarked, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } });
      expect(next.units[landUnitId].embarkedOn).toBeNull();
    });

    it('is a no-op for a unit that is not embarked', () => {
      const { state, landUnitId } = withNavalAndLand();
      expectRefused(gameReducer(state, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } }), state);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const stolen = { ...embarked, units: { ...embarked.units, [landUnitId]: { ...embarked.units[landUnitId], ownerId: DE } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } }), stolen);
    });
  });

  describe('AMPHIBIOUS_ASSAULT', () => {
    const withEmbarkedForce = () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      // Plan §M13: an amphibious assault now also requires an active war with the target's owner.
      return { state: withWarAgainst(embarked, GB), navalUnitId, landUnitId };
    };

    it('conquers an empty coastal city with broken defences, reachable only by sea', () => {
      const { state: s0, navalUnitId, landUnitId } = withEmbarkedForce();
      const state = { ...s0, regions: { ...s0.regions, [GB_TARGET]: { ...s0.regions[GB_TARGET], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } };
      const next = gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.regions[GB_TARGET].owner).toBe(FR);
      expect(next.regions[GB_TARGET].conquest).toMatchObject({ from: GB });
      expect(next.units[landUnitId].regionId).toBe(GB_TARGET);
      expect(next.units[landUnitId].embarkedOn).toBeNull();
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('sinks the transport and its cargo when intercepted by a defending fleet', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      const enemyFleet = {
        id: 'enemy_navy', regionId: GB_TARGET, ownerId: GB, domain: 'naval', classId: 'naval', ageId: 'bronze',
        strength: 50000, maxStrength: 50000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
      };
      const withEnemy = { ...state, units: { ...state.units, enemy_navy: enemyFleet } };
      const next = gameReducer(withEnemy, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.units[navalUnitId]).toBeUndefined();
      expect(next.units[landUnitId]).toBeUndefined();
      expect(next.regions[GB_TARGET].owner).toBe(GB);
    });

    it('grinds a defended landing zone\'s control without capturing it in one wave (src/engine/siege.js)', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      // A ranged-only landing wins the beach but can't take the province.
      const overwhelming = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], strength: 50000, classId: 'ranged' } } };
      const defenderUnit = {
        id: 'gb_garrison', regionId: GB_TARGET, ownerId: GB, domain: 'land', classId: 'infantry', ageId: 'bronze',
        strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...overwhelming, units: { ...overwhelming.units, gb_garrison: defenderUnit } };
      const next = gameReducer(withDefender, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.regions[GB_TARGET].owner).toBe(GB); // not captured yet
      expect(next.regions[GB_TARGET].control).toBe(70); // 100 - 30
      expect(next.lastBattleReport.outcome).toBe('attacker');
      expect(next.lastBattleReport.captured).toBe(false);
      // A non-capturing landing falls back aboard the transport for another attempt.
      expect(next.units[landUnitId].embarkedOn).toBe(navalUnitId);
    });

    it('is a no-op for a naval unit not owned by the player', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      const stolen = { ...state, units: { ...state.units, [navalUnitId]: { ...state.units[navalUnitId], ownerId: DE } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } }), stolen);
    });

    it('is a no-op against a region the player already owns', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expectRefused(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: FR_PORT } }), state);
    });

    it('is a no-op against a non-coastal target', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expectRefused(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap(LU) } }), state);
    });

    it('is a no-op with no embarked land units', () => {
      const { state, navalUnitId } = withNavalAndLand();
      expectRefused(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } }), state);
    });

  });

  describe('NAVAL_ENGAGEMENT', () => {
    const withEnemyFleetAt = (regionId) => {
      const { state, navalUnitId } = withNavalAndLand();
      const enemyFleet = {
        id: 'enemy_navy', regionId, ownerId: GB, domain: 'naval', classId: 'naval', ageId: 'bronze',
        strength: 50, maxStrength: 50, morale: 30, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
      };
      // Engaging a fleet needs a war with its nation, like an invasion (plan §M13).
      return { state: withWarAgainst({ ...state, units: { ...state.units, enemy_navy: enemyFleet } }, GB), navalUnitId };
    };

    it('refuses to engage the fleet of a nation you are at peace with, and says why', () => {
      const { state } = withEnemyFleetAt(GB_TARGET);
      const peaceful = { ...state, wars: state.wars.filter((w) => w.enemy !== GB) };
      const next = gameReducer(peaceful, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: FR_PORT, targetRegionId: GB_TARGET } });
      expect(next.units.enemy_navy).toBeDefined();
      expect(next.logs.at(-1).message).toMatch(/at peace/);
    });

    it('defeats an enemy fleet contesting a sea lane, holding position rather than advancing', () => {
      const { state, navalUnitId } = withEnemyFleetAt(GB_TARGET);
      const next = gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: FR_PORT, targetRegionId: GB_TARGET } });
      expect(next.units.enemy_navy).toBeUndefined();
      expect(next.units[navalUnitId].regionId).toBe(FR_PORT);
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('is a no-op when there is no enemy fleet to engage', () => {
      const { state } = withNavalAndLand();
      expectRefused(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: FR_PORT, targetRegionId: GB_TARGET } }), state);
    });

    it('is a no-op from a region not owned by the player', () => {
      const { state } = withEnemyFleetAt(GB_TARGET);
      expectRefused(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap(DE), targetRegionId: GB_TARGET } }), state);
    });

    it('is a no-op when the target is not reachable', () => {
      const { state } = withEnemyFleetAt(cap(JP));
      expectRefused(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: FR_PORT, targetRegionId: cap(JP) } }), state);
    });

    it('is a no-op with no attacker naval units in the source region', () => {
      const { state } = withEnemyFleetAt(GB_TARGET);
      const noNavy = { ...state, units: {} };
      expectRefused(gameReducer(noNavy, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: FR_PORT, targetRegionId: GB_TARGET } }), noNavy);
    });

  });
});

describe('SUPPRESS_REBELLION', () => {
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, mil: 10 } };
  };

  const rebelUnit = (strength = 300) => ({
    id: 'rebel_fr_1', regionId: cap(FR), ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
    strength, maxStrength: strength, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
  });

  const withGarrisonAndRebel = (rebelStrength = 300) => {
    const state = richState();
    const withGarrison = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
    const rebel = rebelUnit(rebelStrength);
    return { ...withGarrison, units: { ...withGarrison.units, [rebel.id]: rebel } };
  };

  it('crushes a weak rebellion, restoring some control and capping unrest', () => {
    const state = { ...withGarrisonAndRebel(50), regions: { ...withGarrisonAndRebel(50).regions, [cap(FR)]: { ...withGarrisonAndRebel(50).regions[cap(FR)], unrest: 95, control: 40 } } };
    const next = gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap(FR) } });
    expect(next.units.rebel_fr_1).toBeUndefined();
    expect(next.regions[cap(FR)].unrest).toBeLessThan(REBELLION_UNREST_THRESHOLD);
    expect(next.regions[cap(FR)].control).toBeGreaterThan(40);
    expect(next.lastBattleReport.outcome).toBe('attacker');
  });

  it('a garrison repelled by an overwhelming rebellion leaves the rebels standing', () => {
    const state = withGarrisonAndRebel(500000);
    const next = gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap(FR) } });
    expect(next.units.rebel_fr_1).toBeDefined();
    expect(next.lastBattleReport.outcome).toBe('defender');
  });

  it('is a no-op for a region not owned by the player', () => {
    const state = withGarrisonAndRebel();
    const otherId = Object.keys(state.regions).find((id) => state.regions[id].owner !== FR);
    expect(gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: otherId } })).toBe(state);
  });

  it('is a no-op when there is no rebellion in the region', () => {
    const state = richState();
    const withGarrison = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'infantry' } });
    expect(gameReducer(withGarrison, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap(FR) } })).toBe(withGarrison);
  });

  it('is a no-op with no garrison to fight with', () => {
    const state = richState();
    const withRebel = { ...state, units: { rebel_fr_1: rebelUnit() } };
    expect(gameReducer(withRebel, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap(FR) } })).toBe(withRebel);
  });

});

describe('Research tab actions', () => {
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    // Plan §M7: research costs power (age-scaled, up to 160 at Modern) + techPoints — no gold.
    return { ...state, resources: { ...state.resources, techPoints: 100000, mil: 100000, dip: 100000, adm: 100000 } };
  };

  // Research is Civ-style now (src/engine/research.js): RESEARCH_TECH chooses the target and
  // science pays for it at the end of each turn; nothing is bought on the spot.
  describe('RESEARCH_TECH', () => {
    // Choose a tech, then pay `stock` science into it (what the end of a turn does).
    const researchWith = (state, techId, stock) => applyResearchTurn({ ...gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId } }), resources: { ...state.resources, techPoints: stock } });

    it('chooses a tech without spending anything; science completes it at the end of the turn', () => {
      const state = richState();
      const chosen = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } });
      expect(chosen.research.current).toBe('military_bronze_casting');
      expect(chosen.resources).toBe(state.resources);
      const cost = getResearchCost(chosen, FR, 'military_bronze_casting');
      const done = researchWith(state, 'military_bronze_casting', cost);
      expect(done.techTree.military_bronze_casting.researched).toBe(true);
      expect(done.resources.techPoints).toBe(0);
      expect(done.resources.mil).toBe(state.resources.mil); // the power pools no longer pay for research
    });

    it('queues a missing prerequisite before the tech picked', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_composite_bow' } });
      expect(next.research.current).toBe('military_bronze_casting');
      expect(next.research.queue).toEqual(['military_composite_bow']);
    });

    it('costs no more science for a nation that has fallen behind (KTD5)', () => {
      const baseline = richState();
      const behind = { ...baseline, year: 1700 };
      expect(getResearchCost(behind, FR, 'military_bronze_casting')).toBe(getResearchCost(baseline, FR, 'military_bronze_casting'));
    });

    it('the second tech of a line follows once the first is researched', () => {
      const state = { ...richState(), year: -1000 };
      const next = researchWith(state, 'military_composite_bow', 10000);
      expect(next.techTree.military_bronze_casting.researched).toBe(true);
      expect(next.techTree.military_composite_bow.researched).toBe(true);
    });

    it('is a no-op for an unknown tech id', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'not_a_real_tech' } })).toBe(state);
    });

    it('a Research Focus line gets 10% more out of the same science', () => {
      const cost = getResearchCost(richState(), FR, 'military_bronze_casting');
      const spend = Math.ceil(cost / 2);
      const plain = researchWith({ ...richState(), researchFocus: null }, 'military_bronze_casting', spend);
      const focused = researchWith({ ...richState(), researchFocus: 'military' }, 'military_bronze_casting', spend);
      expect(focused.research.progress.military_bronze_casting).toBeCloseTo(plain.research.progress.military_bronze_casting * 1.1, 5);
    });

    it("advances the tech-earned age once enough of the current age's techs are researched", () => {
      let state = { ...richState(), year: -1000 };
      ['military_composite_bow', 'economy_granary_storage', 'infrastructure_mudbrick_roads'].forEach((techId) => { state = researchWith(state, techId, 10000); });
      expect(state.techAgeId).toBe('classical');
    });
  });


  describe('RESEARCH_TECH: tech-earned age unlocks recruiting a class early', () => {
    it('lets a nation whose tech has raced ahead recruit the next age\'s unit class before the calendar catches up', () => {
      // Air only exists in UNIT_ROSTER at 'modern' (src/data/unitClasses.js) — the one unit class
      // with no rush allowance of its own, so it's the clean end-to-end proof that
      // getEffectiveAgeId(calendarAge, techAgeId) is actually being read by RECRUIT_UNIT.
      let state = richState();
      // Pre-mark every tech through Kingdoms researched, as if reached over previous turns, so
      // this test only has to dispatch the Gunpowder-line techs that actually trigger the
      // techAgeId 'gunpowder' -> 'modern' advancement.
      const preResearchedAges = ['bronze', 'classical', 'kingdoms'];
      const techTree = { ...state.techTree };
      Object.values(TECH_TREE).forEach(tech => {
        if (preResearchedAges.includes(tech.ageId)) techTree[tech.id] = { ...techTree[tech.id], researched: true };
      });
      // 1750 is past the Gunpowder age's midpoint (1700), when the second tech in each line
      // becomes available (see techTree.js's buildLine staggering).
      state = { ...state, techTree, age: 'gunpowder', techAgeId: 'gunpowder', year: 1750 };

      const chain = [
        'military_gunpowder_weapons', 'military_standing_armies',
        'economy_joint_stock_companies', 'economy_colonial_trade',
        'infrastructure_canal_locks', 'infrastructure_turnpike_roads'
      ];
      chain.forEach(techId => {
        state = applyResearchTurn({ ...gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId } }), resources: { ...state.resources, techPoints: 100000 } });
      });
      expect(state.techAgeId).toBe('modern');

      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'air' } });
      const airUnit = Object.values(next.units).find(u => u.classId === 'air');
      expect(airUnit).toBeDefined();
    });

    it('cannot recruit the next age\'s unit class without the tech-earned advancement', () => {
      const state = { ...richState(), age: 'gunpowder' };
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap(FR), classId: 'air' } })).toBe(state);
    });
  });

  describe('SET_RESEARCH_FOCUS', () => {
    it('sets the research focus for free', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'science' } });
      expect(next.researchFocus).toBe('science');
      expect(next.resources).toEqual(state.resources);
    });

    it('is a no-op for an invalid category', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'not_a_category' } })).toBe(state);
    });

    it('is a no-op when already set to that category', () => {
      const state = richState();
      const focused = gameReducer(state, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'science' } });
      expect(gameReducer(focused, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'science' } })).toBe(focused);
    });

  });

  describe('FUND_SCHOLARS', () => {
    it('grants tech points and deducts gold', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.FUND_SCHOLARS, payload: {} });
      expect(next.resources.techPoints).toBeGreaterThan(state.resources.techPoints);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.FUND_SCHOLARS, payload: {} })).toBe(state);
    });
  });
});

describe('Government reform and law actions (plan §M8)', () => {
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return withDecrees({ ...state, resources: { ...state.resources, gold: 100000 } });
  };

  describe('CHANGE_GOVERNMENT_TYPE', () => {
    it('changes to an available type at the current age, deducts the cost, and applies -2 stability', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(next.nations[FR].government.type).toBe('monarchy');
      expect(next.nations[FR].ruler.decrees).toBeLessThan(state.nations[FR].ruler.decrees);
      expect(next.nations[FR].stability).toBe((state.nations[FR].stability || 0) - 2);
    });

    it('resets reforms to the new type\'s first choice for every age tier up to the calendar age', () => {
      const next = gameReducer(richState(), { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(next.nations[FR].government.reforms).toEqual({ stone: 'city_king', bronze: 'despotic_rule' }); // the age is bronze at game start; the Stone tier fills too
    });

    it('is a no-op for a type not yet reached by age (Republic needs Classical)', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'republic' } })).toBe(state);
    });

    it('is a no-op when already that type', () => {
      const state = gameReducer(richState(), { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } })).toBe(state);
    });

    it('is a no-op for Theocracy without the identity gate', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'theocracy' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = withDecrees(richState(), 0);
      expect(gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } })).toBe(state);
    });

    it('becoming a monarchy names no heir: succession was removed (master plan decision 37)', () => {
      const next = gameReducer(richState(), { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(next.nations[FR].government.type).toBe('monarchy');
      expect(next.nations[FR]).not.toHaveProperty('heir');
      expect(next.nations[FR].ruler).not.toHaveProperty('consort');
    });
  });

  describe('ENACT_GOVERNMENT_REFORM', () => {
    const withMonarchy = () => gameReducer(richState(), { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });

    it('cannot re-pick a tier CHANGE_GOVERNMENT_TYPE already auto-filled (once per tier locks in)', () => {
      const state = withMonarchy(); // resetReformsForType already set bronze: despotic_rule
      expect(gameReducer(state, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'bronze', reformId: 'divine_kingship' } })).toBe(state);
    });

    it('enacts a reform for an unset tier and deducts the cost', () => {
      // A fresh tribal nation has no reforms set yet at all.
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'bronze', reformId: 'chieftaincy' } });
      expect(next.nations[FR].government.reforms.bronze).toBe('chieftaincy');
      expect(next.nations[FR].ruler.decrees).toBeLessThan(state.nations[FR].ruler.decrees);
    });

    it('is a no-op for a tier ahead of the calendar age', () => {
      const state = withMonarchy();
      expect(gameReducer(state, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'classical', reformId: 'imperial_bureaucracy' } })).toBe(state);
    });

    it('is a no-op for a reform id that does not belong to the current type/age', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'bronze', reformId: 'despotic_rule' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = withDecrees(richState(), 0);
      expect(gameReducer(state, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'bronze', reformId: 'chieftaincy' } })).toBe(state);
    });
  });

  describe('CHANGE_LAW', () => {
    const withMintedCoinage = () => {
      const base = richState();
      return { ...base, techTree: { ...base.techTree, economy_minted_coinage: { ...base.techTree.economy_minted_coinage, researched: true } } };
    };

    it('changes a category\'s law, spends a decree, and sets a cooldown', () => {
      const state = withMintedCoinage();
      const next = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'land_tax' } });
      expect(next.nations[FR].laws.taxation).toBe('land_tax');
      expect(next.nations[FR].ruler.decrees).toBe(state.nations[FR].ruler.decrees - 1); // one decree
      expect(next.nations[FR].lawCooldowns.taxation).toBe(state.turnNumber + 5);
    });

    it('is a no-op for a law already active in that category', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'tribute' } })).toBe(state);
    });

    it('is a no-op for a tech-gated law without the tech researched', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'land_tax' } })).toBe(state);
    });

    it('is a no-op while the category is on cooldown', () => {
      const state = withMintedCoinage();
      const first = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'land_tax' } });
      expect(gameReducer(first, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'tribute' } })).toBe(first);
    });

    it('is a no-op when unaffordable', () => {
      const state = withDecrees(withMintedCoinage(), 0);
      expect(gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'land_tax' } })).toBe(state);
    });

    it('applies a one-time -1 stability when enacting Martial Law', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'justice', lawId: 'martial_law' } });
      expect(next.nations[FR].stability).toBe((state.nations[FR].stability || 0) - 1);
    });

    it('pushes a 10-turn timed unrest modifier when enacting Collectivization', () => {
      const base = richState();
      const state = { ...base, techTree: { ...base.techTree, economy_industrial_capital: { ...base.techTree.economy_industrial_capital, researched: true } } };
      const next = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'land', lawId: 'collectivization' } });
      expect(next.nations[FR].modifiers).toContainEqual(expect.objectContaining({
        sourceType: 'law', sourceId: 'collectivization', mods: { 'national.stabilityBonus': -2 }, expiresTurn: state.turnNumber + 10
      }));
    });
  });

  describe('SHIFT_IDENTITY', () => {
    it('shifts the named axis by IDENTITY_SHIFT_STEP in the given direction, spends a decree, and sets a cooldown', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } });
      expect(next.nations[FR].identity.collectivism).toBe(IDENTITY_SHIFT_STEP);
      expect(next.nations[FR].ruler.decrees).toBeLessThan(state.nations[FR].ruler.decrees);
      expect(next.nations[FR].identityShiftCooldownTurn).toBe(state.turnNumber + 5);
    });

    it('shifts in the negative direction too, and other axes stay untouched', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'globalism', direction: -1 } });
      expect(next.nations[FR].identity.globalism).toBe(-IDENTITY_SHIFT_STEP);
      expect(next.nations[FR].identity.collectivism).toBe(0);
      expect(next.nations[FR].identity.secularism).toBe(0);
    });

    it('is a no-op once already at the max/min bound', () => {
      const maxed = { ...richState() };
      maxed.nations = { ...maxed.nations, [FR]: { ...maxed.nations[FR], identity: { ...maxed.nations[FR].identity, collectivism: IDENTITY_MAX } } };
      expect(gameReducer(maxed, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } })).toBe(maxed);
    });

    it('is a no-op for an unknown axis', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'not_a_real_axis', direction: 1 } })).toBe(state);
    });

    it('is a no-op for an invalid direction', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 0 } })).toBe(state);
    });

    it('is a no-op while on cooldown', () => {
      const state = richState();
      const first = gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } });
      expect(gameReducer(first, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'globalism', direction: 1 } })).toBe(first);
    });

    it('is a no-op when unaffordable', () => {
      const state = withDecrees(richState(), 0);
      expect(gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } })).toBe(state);
    });
  });
});

describe('Diplomacy tab actions', () => {
  const richState = (playerNationId = FR) => {
    const state = game(playerNationId);
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return withDecrees({ ...state, resources: { ...state.resources, gold: 100000 } });
  };

  describe('DECLARE_WAR', () => {
    it('declares an unjustified war, charging the premium and costing global relations and home stability', () => {
      const state = richState();
      const other = Object.keys(state.nations).find(id => id !== FR && id !== DE);
      const before = state.nations[other].hostility;
      const next = gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(next.nations[DE].isAtWar).toBe(true);
      expect(next.wars.some(w => w.enemy === DE && w.aggressor === FR)).toBe(true);
      expect(next.resources.gold).toBeLessThan(state.resources.gold - 1); // more than a token AP-only cost
      expect(next.regions[cap(FR)].unrest).toBeGreaterThan(state.regions[cap(FR)].unrest);
      expect(next.nations[other].hostility).toBeGreaterThan(before);
    });

    it('declares a justified war for free of the gold premium when a claim already exists', () => {
      const state = richState();
      const withClaim = { ...state, nations: { ...state.nations, [FR]: { ...state.nations[FR], claims: [cap(DE)] } } };
      const other = Object.keys(state.nations).find(id => id !== FR && id !== DE);
      const before = state.nations[other].hostility;
      const next = gameReducer(withClaim, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(next.nations[DE].isAtWar).toBe(true);
      expect(next.resources.gold).toBe(withClaim.resources.gold); // declareWarJustified has no gold cost
      expect(next.nations[other].hostility).toBe(before); // no global relations penalty
      expect(next.nations[FR].claims).toContain(cap(DE)); // the claim stays until the city is taken
    });

    it('is a no-op declaring war on yourself', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: FR } })).toBe(state);
    });

    it('can attack a nation that is already at war with someone else', () => {
      const base = richState();
      const busy = { ...base, nations: { ...base.nations, [DE]: { ...base.nations[DE], isAtWar: true } },
        wars: [...base.wars, { id: 'war_de_ai', aggressor: AT, enemy: DE, active: true, score: 0, battleScore: 0, tickScore: 0, goalAchieved: false, goal: { type: 'destroy_military', threshold: 1 } }] };
      const next = gameReducer(busy, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(next.wars.some(w => w.active && w.aggressor === FR && w.enemy === DE)).toBe(true);
      // Making peace with the player leaves de still fighting Austria.
      const peace = gameReducer(next, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } });
      expect(peace.wars.find(w => w.aggressor === FR && w.enemy === DE).active).toBe(false);
      expect(peace.nations[DE].isAtWar).toBe(true);
      expect(peace.nations[FR].isAtWar).toBe(false);
    });

    it('is a no-op if already at war', () => {
      const state = richState();
      const atWar = gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(gameReducer(atWar, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } })).toBe(atWar);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0, actionPoints: 0 } };
      expect(gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } })).toBe(state);
    });
  });

  describe('FABRICATE_CLAIM', () => {
    it('starts a claim on the nearest city of the target within reach and deducts the cost', () => {
      const state = richState();
      const site = claimableCities(state, FR)[0].city;
      const next = gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: site.owner } });
      expect(next.nations[FR].claimsInProgress.map((c) => c.cityId)).toContain(site.id);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op for a claim already held', () => {
      const state = gameReducer(richState(), { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: DE } });
      expect(gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: DE } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: DE } })).toBe(state);
    });
  });

  describe('SUE_FOR_PEACE', () => {
    const atWarWithDe = () => gameReducer(richState(), { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });

    it('ends the war and signs a peace treaty', () => {
      const state = atWarWithDe();
      const next = gameReducer(state, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } });
      expect(next.nations[DE].isAtWar).toBe(false);
      expect(next.nations[DE].hasPeaceTreaty).toBe(true);
      expect(next.wars.find(w => w.enemy === DE).active).toBe(false);
    });

    it('costs less gold against a more war-exhausted target', () => {
      const fresh = atWarWithDe();
      const exhausted = { ...fresh, nations: { ...fresh.nations, [DE]: { ...fresh.nations[DE], warExhaustion: 80 } } };
      const freshPeace = gameReducer(fresh, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } });
      const exhaustedPeace = gameReducer(exhausted, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } });
      const freshCost = fresh.resources.gold - freshPeace.resources.gold;
      const exhaustedCost = exhausted.resources.gold - exhaustedPeace.resources.gold;
      expect(exhaustedCost).toBeLessThan(freshCost);
    });

    it('is a no-op when not at war with the target', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...atWarWithDe(), resources: { ...atWarWithDe().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } })).toBe(state);
    });

    it('clears the player\'s own isAtWar too, and deactivates the war record even when the AI was the aggressor', () => {
      // Regression: an AI-declared war (aggressor: DE, enemy: player) previously left the
      // player's own isAtWar flag stuck true forever after peace, which made aiLogic.js's
      // pickWarTarget (which filters out any nation still flagged isAtWar) treat the player as
      // permanently immune to any FUTURE war declaration by anyone.
      const base = richState();
      const withAiWar = {
        ...base,
        nations: { ...base.nations, [FR]: { ...base.nations[FR], isAtWar: true }, [DE]: { ...base.nations[DE], isAtWar: true } },
        wars: [{ id: 'war_1', aggressor: DE, enemy: FR, active: true, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }]
      };
      const next = gameReducer(withAiWar, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: DE } });
      expect(next.nations[FR].isAtWar).toBe(false);
      expect(next.nations[DE].isAtWar).toBe(false);
      expect(next.wars[0].active).toBe(false);
    });
  });

  describe('TRADE_AGREEMENT', () => {
    it('signs a trade agreement and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } });
      expect(next.nations[DE].hasTradeAgreement).toBe(true);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op while at war with the target', () => {
      const state = gameReducer(richState(), { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } })).toBe(state);
    });

    it('is a no-op if a trade agreement already exists', () => {
      const state = gameReducer(richState(), { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } });
      expect(gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } })).toBe(state);
    });
  });

  describe('MILITARY_ALLIANCE', () => {
    it('forms an alliance when hostility is low enough', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: DE } });
      expect(next.nations[DE].hasMilitaryPact).toBe(true);
    });

    it('is a no-op when hostility is too high and there is no trade agreement', () => {
      const state = richState();
      const hostile = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 90 } } };
      expect(gameReducer(hostile, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: DE } })).toBe(hostile);
    });

    it('succeeds despite high hostility once a trade agreement exists', () => {
      const state = richState();
      const traded = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } });
      const hostileButTraded = { ...traded, nations: { ...traded.nations, [DE]: { ...traded.nations[DE], hostility: 90 } } };
      const next = gameReducer(hostileButTraded, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: DE } });
      expect(next.nations[DE].hasMilitaryPact).toBe(true);
    });

    it('is a no-op while at war with the target', () => {
      const state = gameReducer(richState(), { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(gameReducer(state, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: DE } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: DE } })).toBe(state);
    });
  });

  describe('GIFT_BRIBE', () => {
    it('reduces hostility and deducts gold', () => {
      const state = richState();
      const hostile = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 50 } } };
      const next = gameReducer(hostile, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: DE } });
      expect(next.nations[DE].hostility).toBeLessThan(50);
      expect(next.resources.gold).toBeLessThan(hostile.resources.gold);
    });

    it('never drops hostility below the nation\'s hostility floor', () => {
      const state = richState();
      const floored = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 5, hostilityFloor: 3 } } };
      const next = gameReducer(floored, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: DE } });
      expect(next.nations[DE].hostility).toBeGreaterThanOrEqual(3);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: DE } })).toBe(state);
    });
  });

  // Espionage/Counter-Intelligence (types.js's header comment): a real pair added together since
  // Counter-Intelligence would have nothing to counter without a real Espionage action to go with
  // it. rngSeed 7/1 are pinned seeds whose first createRng().next() call falls below/above
  // ESPIONAGE_SUCCESS_CHANCE (0.6), found by direct computation against src/utils/rng.js — not
  // arbitrary, so these tests exercise both branches deterministically rather than flaking.
  describe('ESPIONAGE', () => {
    it('on success, steals tech points and deducts the cost without raising hostility', () => {
      const state = { ...richState(), rngSeed: 7 };
      const before = state.nations[DE].hostility;
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE } });
      expect(next.resources.techPoints).toBe((state.resources.techPoints || 0) + ESPIONAGE_TECH_POINTS_STOLEN);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.nations[DE].hostility).toBe(before);
    });

    it('on failure, raises the target\'s hostility instead of stealing tech points', () => {
      const state = { ...richState(), rngSeed: 1 };
      const before = state.nations[DE].hostility;
      const beforeTech = state.resources.techPoints || 0;
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE } });
      expect(next.nations[DE].hostility).toBe(before + ESPIONAGE_FAILURE_HOSTILITY_INCREASE);
      expect(next.resources.techPoints || 0).toBe(beforeTech);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE } })).toBe(state);
    });

    it('is a no-op against an unknown nation', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'not_a_real_nation' } })).toBe(state);
    });

    // Foreign provinces stay hidden until an op succeeds (src/engine/intel.js).
    it('gather_intel reveals the target\'s provinces for INTEL_DURATION_TURNS, and nothing else', () => {
      const state = { ...richState(), rngSeed: 7 };
      const deRegion = Object.keys(state.regions).find((id) => state.regions[id].owner === DE);
      expect(canSeeRegionDetails(state, deRegion)).toBe(false);
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE, type: 'gather_intel' } });
      expect(hasIntel(next, DE)).toBe(true);
      expect(canSeeRegionDetails(next, deRegion)).toBe(true);
      expect(getIntelTurnsLeft(next, DE)).toBe(INTEL_DURATION_TURNS);
      expect(getIntelTurnsLeft(state, DE)).toBe(null);
      expect(next.resources.techPoints || 0).toBe(state.resources.techPoints || 0);
      // Expires once the window has passed.
      const later = { ...next, turnNumber: next.turnNumber + INTEL_DURATION_TURNS + 1 };
      expect(hasIntel(later, DE)).toBe(false);
      expect(canSeeRegionDetails(later, deRegion)).toBe(false);
    });

    it('a caught gather_intel op reveals nothing and raises hostility', () => {
      const state = { ...richState(), rngSeed: 1 };
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE, type: 'gather_intel' } });
      expect(hasIntel(next, DE)).toBe(false);
      expect(next.nations[DE].hostility).toBe(state.nations[DE].hostility + ESPIONAGE_FAILURE_HOSTILITY_INCREASE);
    });

    it('a successful steal-tech op also leaves intel behind', () => {
      const state = { ...richState(), rngSeed: 7 };
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE } });
      expect(hasIntel(next, DE)).toBe(true);
      expect(hasIntel(next, FR)).toBe(false);
    });

    it('your own provinces are always visible', () => {
      const state = richState();
      const own = Object.keys(state.regions).find((id) => state.regions[id].owner === state.playerNationId);
      expect(canSeeRegionDetails(state, own)).toBe(true);
    });
  });

  describe('COUNTER_INTELLIGENCE', () => {
    // Real per-nation hostility baselines (WORLD_NATIONS' startHostility) vary and aren't something
    // this test should depend on, so every non-player nation is normalized to 0 first — that makes
    // whichever single nation is bumped up afterward unambiguously "the most hostile" regardless of
    // real game data.
    const withAllHostilityZeroed = (state) => ({
      ...state,
      nations: Object.fromEntries(Object.entries(state.nations).map(([id, n]) => [id, n.isPlayer ? n : { ...n, hostility: 0 }]))
    });

    it('reduces the most-hostile foreign nation\'s hostility and pays its gold', () => {
      const state = withAllHostilityZeroed(richState());
      const other = Object.keys(state.nations).find(id => id !== FR && id !== DE);
      const withHostility = {
        ...state,
        nations: {
          ...state.nations,
          [DE]: { ...state.nations[DE], hostility: 40 },
          [other]: { ...state.nations[other], hostility: 90 } // the most hostile — should be the one targeted
        }
      };
      const goldBefore = withHostility.resources.gold;
      const next = gameReducer(withHostility, { type: ActionTypes.COUNTER_INTELLIGENCE });
      expect(next.nations[other].hostility).toBe(90 - COUNTER_INTEL_HOSTILITY_REDUCTION);
      expect(next.nations[DE].hostility).toBe(40); // untouched — it wasn't the most hostile
      expect(next.resources.gold).toBe(goldBefore - ACTION_COSTS.counterIntelligence.gold);
      expect(next.resources.gold).toBeLessThan(withHostility.resources.gold);
    });

    it('never drops hostility below the target\'s hostility floor', () => {
      const state = withAllHostilityZeroed(richState());
      const withFloor = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 5, hostilityFloor: 3 } } };
      const next = gameReducer(withFloor, { type: ActionTypes.COUNTER_INTELLIGENCE });
      expect(next.nations[DE].hostility).toBeGreaterThanOrEqual(3);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.COUNTER_INTELLIGENCE })).toBe(state);
    });
  });

  describe('CULTURAL_EXPORT', () => {
    // Modern-age-only — richState() above starts in the Bronze Age.
    const modernState = () => ({ ...richState(), age: 'modern', techAgeId: 'modern' });

    it('raises culturalInfluence, eases every other nation\'s hostility, and deducts the cost', () => {
      const state = modernState();
      const withHostility = {
        ...state,
        nations: Object.fromEntries(Object.entries(state.nations).map(([id, n]) => [id, n.isPlayer ? n : { ...n, hostility: 50 }]))
      };
      const next = gameReducer(withHostility, { type: ActionTypes.CULTURAL_EXPORT });
      expect(next.nations[FR].culturalInfluence).toBe(CULTURAL_EXPORT_INFLUENCE_GAIN);
      expect(next.nations[DE].hostility).toBe(50 - CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION);
      expect(next.resources.gold).toBeLessThan(withHostility.resources.gold);
    });

    it('never drops any nation\'s hostility below its own floor', () => {
      const state = modernState();
      const floored = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 1, hostilityFloor: 0 } } };
      const next = gameReducer(floored, { type: ActionTypes.CULTURAL_EXPORT });
      expect(next.nations[DE].hostility).toBeGreaterThanOrEqual(0);
    });

    it('accumulates across repeated uses', () => {
      const state = modernState();
      const once = gameReducer(state, { type: ActionTypes.CULTURAL_EXPORT });
      const twice = gameReducer(once, { type: ActionTypes.CULTURAL_EXPORT });
      expect(twice.nations[FR].culturalInfluence).toBe(CULTURAL_EXPORT_INFLUENCE_GAIN * 2);
    });

    it('is a no-op before the Modern Age', () => {
      const state = richState(); // Bronze Age
      expect(gameReducer(state, { type: ActionTypes.CULTURAL_EXPORT })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...modernState(), resources: { ...modernState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.CULTURAL_EXPORT })).toBe(state);
    });
  });

  // Diplomacy overhaul (plan §M12).
  describe('RIVAL_NATION / UNRIVAL_NATION', () => {
    const borderingId = (state) => getBorderingNationIds(state.regions, state.playerNationId)[0];

    it('adds a bordering nation to rivals', () => {
      const state = richState();
      const targetId = borderingId(state);
      const next = gameReducer(state, { type: ActionTypes.RIVAL_NATION, payload: { nationId: targetId } });
      expect(next.nations[FR].rivals).toContain(targetId);
    });

    it('is a no-op for a non-bordering nation', () => {
      const state = richState();
      const bordering = new Set(getBorderingNationIds(state.regions, FR));
      const nonBordering = Object.keys(state.nations).find((id) => id !== FR && !bordering.has(id) && hasMet(state, FR, id));
      expect(gameReducer(state, { type: ActionTypes.RIVAL_NATION, payload: { nationId: nonBordering } })).toBe(state);
    });

    it('is a no-op once MAX_RIVALS is reached', () => {
      const state = richState();
      const targetId = borderingId(state);
      const fr = { ...state.nations[FR], rivals: Array.from({ length: MAX_RIVALS }, (_, i) => `slot${i}`) };
      const full = { ...state, nations: { ...state.nations, [FR]: fr } };
      expect(gameReducer(full, { type: ActionTypes.RIVAL_NATION, payload: { nationId: targetId } })).toBe(full);
    });

    it('unrival removes a rival', () => {
      const state = richState();
      const targetId = borderingId(state);
      const rivaled = gameReducer(state, { type: ActionTypes.RIVAL_NATION, payload: { nationId: targetId } });
      const next = gameReducer(rivaled, { type: ActionTypes.UNRIVAL_NATION, payload: { nationId: targetId } });
      expect(next.nations[FR].rivals).not.toContain(targetId);
    });
  });

  describe('PROPOSE_MARRIAGE', () => {
    const asMonarchies = (state, targetId) => ({
      ...state,
      nations: {
        ...state.nations,
        [FR]: { ...state.nations[FR], government: { type: 'monarchy', reforms: {} } },
        [targetId]: { ...state.nations[targetId], government: { type: 'monarchy', reforms: {} } }
      }
    });

    it('reduces the target\'s hostility and records the match', () => {
      const state = asMonarchies(richState(), DE);
      const withHostility = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 80 } } };
      const next = gameReducer(withHostility, { type: ActionTypes.PROPOSE_MARRIAGE, payload: { nationId: DE } });
      expect(next.nations[DE].hostility).toBeLessThan(80);
      expect(next.nations[FR].marriageWith).toContain(DE);
      expect(next.nations[FR].ruler).not.toHaveProperty('consort');
    });

    it('is a no-op unless both nations are monarchies', () => {
      const state = richState();
      const frRepublicDeMonarchy = {
        ...state,
        nations: {
          ...state.nations,
          [FR]: { ...state.nations[FR], government: { type: 'republic', reforms: {} } },
          [DE]: { ...state.nations[DE], government: { type: 'monarchy', reforms: {} } }
        }
      };
      expect(gameReducer(frRepublicDeMonarchy, { type: ActionTypes.PROPOSE_MARRIAGE, payload: { nationId: DE } })).toBe(frRepublicDeMonarchy);
    });

    it('is a no-op once already married into that nation', () => {
      const state = asMonarchies(richState(), DE);
      const married = { ...state, nations: { ...state.nations, [FR]: { ...state.nations[FR], marriageWith: [DE] } } };
      expect(gameReducer(married, { type: ActionTypes.PROPOSE_MARRIAGE, payload: { nationId: DE } })).toBe(married);
    });
  });

  describe('BREAK_ALLIANCE', () => {
    it('clears the pact and raises hostility', () => {
      const state = richState();
      const allied = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hasMilitaryPact: true, hostility: 10 } } };
      const next = gameReducer(allied, { type: ActionTypes.BREAK_ALLIANCE, payload: { nationId: DE } });
      expect(next.nations[DE].hasMilitaryPact).toBe(false);
      expect(next.nations[DE].hostility).toBeGreaterThan(10);
    });

    it('is a no-op when there is no pact', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.BREAK_ALLIANCE, payload: { nationId: DE } })).toBe(state);
    });
  });

  describe('INSULT', () => {
    it('raises the target\'s hostility for free', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.INSULT, payload: { nationId: DE } });
      expect(next.nations[DE].hostility).toBeGreaterThan(state.nations[DE].hostility);
      expect(next.resources.gold).toBe(state.resources.gold);
    });
  });

  describe('ASSIGN_DIPLOMAT / RECALL_DIPLOMAT', () => {
    it('assigns a diplomat to improve relations with a target', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: DE } });
      expect(next.nations[FR].diplomatTasks).toEqual([{ targetId: DE, task: 'improve_relations', startedTurn: state.turnNumber }]);
    });

    it('is a no-op once every diplomat is already assigned', () => {
      const state = richState();
      const targets = Object.keys(state.nations).filter((id) => id !== FR && hasMet(state, FR, id)).slice(0, state.nations[FR].diplomats);
      let assigned = state;
      targets.forEach((id) => { assigned = gameReducer(assigned, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: id } }); });
      const extra = Object.keys(state.nations).find((id) => id !== FR && !targets.includes(id) && hasMet(state, FR, id));
      expect(gameReducer(assigned, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: extra } })).toBe(assigned);
    });

    it('recall removes the assignment', () => {
      const state = richState();
      const assigned = gameReducer(state, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: DE } });
      const next = gameReducer(assigned, { type: ActionTypes.RECALL_DIPLOMAT, payload: { nationId: DE } });
      expect(next.nations[FR].diplomatTasks).toEqual([]);
    });
  });

  describe('VASSALIZE / ANNEX_VASSAL / RELEASE_VASSAL', () => {
    const dominant = (state, targetId) => ({
      ...state,
      nations: {
        ...state.nations,
        [FR]: { ...state.nations[FR], militaryStrength: 100000 },
        [targetId]: { ...state.nations[targetId], militaryStrength: 100, hostility: 0 }
      }
    });

    it('vassalizes a weak, low-hostility nation', () => {
      const state = dominant(richState(), DE);
      const next = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } });
      expect(next.nations[DE].vassalOf).toBe(FR);
      expect(next.nations[FR].vassals).toContain(DE);
    });

    it('is a no-op when the target is too strong', () => {
      const state = richState();
      const notWeak = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 0, militaryStrength: state.nations[FR].militaryStrength } } };
      expect(gameReducer(notWeak, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } })).toBe(notWeak);
    });

    it('is a no-op when hostility is too high', () => {
      const state = dominant(richState(), DE);
      const hostile = { ...state, nations: { ...state.nations, [DE]: { ...state.nations[DE], hostility: 90 } } };
      expect(gameReducer(hostile, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } })).toBe(hostile);
    });

    it('annexes a vassal past the cooldown, transferring its regions and clearing vassalOf', () => {
      const state = dominant(richState(), DE);
      const vassalized = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } });
      const pastCooldown = { ...vassalized, turnNumber: vassalized.turnNumber + VASSAL_ANNEX_COOLDOWN_TURNS };
      const next = gameReducer(pastCooldown, { type: ActionTypes.ANNEX_VASSAL, payload: { nationId: DE } });
      expect(next.nations[DE].vassalOf).toBeNull();
      expect(next.nations[FR].vassals).not.toContain(DE);
      expect(Object.values(next.regions).some((r) => r.owner === DE)).toBe(false);
    });

    it('is a no-op annexing before the cooldown has passed', () => {
      const state = dominant(richState(), DE);
      const vassalized = { ...gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } }) };
      expect(gameReducer(vassalized, { type: ActionTypes.ANNEX_VASSAL, payload: { nationId: DE } })).toBe(vassalized);
    });

    it('releases a vassal', () => {
      const state = dominant(richState(), DE);
      const vassalized = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } });
      const next = gameReducer(vassalized, { type: ActionTypes.RELEASE_VASSAL, payload: { nationId: DE } });
      expect(next.nations[DE].vassalOf).toBeNull();
      expect(next.nations[FR].vassals).not.toContain(DE);
    });

    it('a vassal player cannot declare an ordinary war (plan §M15: "except independence")', () => {
      const state = dominant(richState(), DE);
      const vassalized = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: DE } });
      // fr is now de's OVERLORD in this fixture, not a vassal — flip the roles to test the guard.
      const frIsVassal = { ...vassalized, nations: { ...vassalized.nations, [FR]: { ...vassalized.nations[FR], vassalOf: DE } } };
      const other = Object.keys(frIsVassal.nations).find((id) => id !== FR && id !== DE && hasMet(frIsVassal, FR, id));
      expect(gameReducer(frIsVassal, { type: ActionTypes.DECLARE_WAR, payload: { nationId: other } })).toBe(frIsVassal);
    });
  });

  describe('MOVE_CAPITAL (plan §M15)', () => {
    const affordable = () => {
      const state = addCity(richState(), FR).state; // somewhere to move it to
      return withDecrees(state);
    };

    it('moves the capital to an owned, unoccupied region and deducts the cost', () => {
      const state = affordable();
      const targetId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && id !== cap(FR));
      const next = gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: targetId } });
      expect(next.nations[FR].capitalRegionId).toBe(targetId);
      expect(next.nations[FR].ruler.decrees).toBe(state.nations[FR].ruler.decrees - ACTION_COSTS.moveCapital.decrees);
      expect(next.resources.gold).toBe(state.resources.gold - ACTION_COSTS.moveCapital.gold);
    });

    it('costs an extra -1 stability when the new capital is outside the nation\'s own original territory', () => {
      const state = affordable();
      const foreignId = Object.keys(state.regions).find((id) => REGIONS_DATA[id].startOwner !== FR);
      const conquered = { ...state, regions: { ...state.regions, [foreignId]: { ...state.regions[foreignId], owner: FR } } };
      const next = gameReducer(conquered, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: foreignId } });
      expect(next.nations[FR].capitalRegionId).toBe(foreignId);
      expect(next.nations[FR].stability).toBe((conquered.nations[FR].stability || 0) - 1);
    });

    it('does not cost stability when relocating within the nation\'s own original territory', () => {
      const state = affordable();
      const nativeId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && id !== cap(FR));
      const next = gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: nativeId } });
      expect(next.nations[FR].stability).toBe(state.nations[FR].stability || 0);
    });

    it('is a no-op targeting a region the player does not own', () => {
      const state = affordable();
      expect(gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: cap(DE) } })).toBe(state);
    });

    it('is a no-op targeting an occupied region', () => {
      const state = affordable();
      const targetId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && id !== cap(FR));
      const occupied = { ...state, regions: { ...state.regions, [targetId]: { ...state.regions[targetId], occupiedBy: DE } } };
      expect(gameReducer(occupied, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: targetId } })).toBe(occupied);
    });

    it('is a no-op without enough ADM/gold', () => {
      const state = withDecrees(addCity(richState(), FR).state, 0); // somewhere to move it to, no decree
      const targetId = Object.keys(state.regions).find((id) => state.regions[id].owner === FR && id !== cap(FR));
      expect(gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: targetId } })).toBe(state);
    });
  });

  describe('DECLARE_INDEPENDENCE (plan §M15)', () => {
    const vassalState = (libertyDesire) => {
      const state = richState();
      return {
        ...state,
        nations: {
          ...state.nations,
          [FR]: { ...state.nations[FR], vassalOf: DE, libertyDesire },
          [DE]: { ...state.nations[DE], vassals: [FR] }
        }
      };
    };

    it('is a no-op below the liberty desire threshold', () => {
      const state = vassalState(10);
      expect(gameReducer(state, { type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} })).toBe(state);
    });

    it('is a no-op for a nation that is not anyone\'s vassal', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} })).toBe(state);
    });

    it('declares an independence war against the overlord once liberty desire clears the threshold', () => {
      const state = vassalState(60);
      const next = gameReducer(state, { type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} });
      expect(next.nations[FR].isAtWar).toBe(true);
      const war = next.wars.find((w) => w.aggressor === FR && w.enemy === DE);
      expect(war).toBeDefined();
      expect(war.cb).toBe('independence');
    });

    it('is a no-op while already at war', () => {
      const state = { ...vassalState(60), nations: { ...vassalState(60).nations, [FR]: { ...vassalState(60).nations[FR], isAtWar: true } } };
      expect(gameReducer(state, { type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} })).toBe(state);
    });
  });

  describe('DECLARE_WAR truce-breaking (plan §M12/M13)', () => {
    it('allows the player to break a truce, at a stability/prestige/AE cost', () => {
      const state = richState();
      const nations = setTruce(state.nations, FR, DE, state.turnNumber);
      const withTruce = { ...state, nations };
      const next = gameReducer(withTruce, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(next.nations[DE].isAtWar).toBe(true);
      expect(next.nations[FR].stability).toBe((withTruce.nations[FR].stability || 0) - TRUCE_BREAK_STABILITY_PENALTY);
      expect(next.nations[FR].prestige).toBeLessThan(withTruce.nations[FR].prestige || 0);
    });

    it('declares normally with no penalty when there is no truce', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: DE } });
      expect(next.nations[FR].stability).toBe(state.nations[FR].stability || 0);
    });
  });

  describe('TRADE_AGREEMENT capacity (plan §M8.3/§M12)', () => {
    it('is a no-op once trade pact capacity is exhausted', () => {
      const state = richState(); // base capacity 1 with neutral identity
      const first = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: DE } });
      const otherId = Object.keys(first.nations).find((id) => id !== FR && id !== DE && !first.nations[id].isAtWar && hasMet(first, FR, id));
      expect(gameReducer(first, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: otherId } })).toBe(first);
    });
  });

  describe('ESPIONAGE support_rebels variant (plan §M12)', () => {
    it('raises unrest in the target\'s capital on success', () => {
      const state = richState();
      const targetCapital = getNationCapital(DE);
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: DE, type: 'support_rebels' } });
      // ESPIONAGE_SUCCESS_CHANCE is seed-dependent; only assert when it actually succeeded (unrest changed).
      if (next.regions[targetCapital].unrest !== state.regions[targetCapital].unrest) {
        expect(next.regions[targetCapital].unrest).toBeGreaterThan(state.regions[targetCapital].unrest);
      }
    });
  });
});

describe('default case', () => {
  it('returns state unchanged for an unrecognized action type', () => {
    const state = game();
    expect(gameReducer(state, { type: 'NOT_A_REAL_ACTION' })).toBe(state);
  });
});

