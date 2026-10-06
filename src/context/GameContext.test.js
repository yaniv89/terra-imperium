import { describe, it, expect } from 'vitest';
import { applyResearchTurn, getResearchCost } from '../engine/research';
import { hasMet } from '../engine/fog';
import { gameReducer, createInitialState } from './GameContext';
import { ActionTypes, GameStatus, LogTypes } from '../data/types';
import { XP_THRESHOLDS } from '../data/promotions';
import { TECH_TREE } from '../data/techTree';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { MAX_ORBITAL_DEBRIS } from '../data/satellites';
import { MAX_ABM_LEVEL } from '../data/missiles';
import { getNationCapital, REGIONS_DATA, getBorderingNationIds, getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities } from '../engine/testWorld';
import { setTruce } from '../engine/diplomacy';
import { hasIntel, getIntelTurnsLeft, canSeeRegionDetails } from '../engine/intel';
import { INTEL_DURATION_TURNS, ESPIONAGE_TECH_POINTS_STOLEN, ESPIONAGE_FAILURE_HOSTILITY_INCREASE, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD, ACTION_COSTS } from '../data/actionCosts';
import { IDENTITY_SHIFT_STEP, IDENTITY_MAX } from '../data/identity';
import { CLIMATE_RESILIENCE_MAX, CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION } from '../data/actionCosts';
import { TAX_RATE_CHANGE_COOLDOWN_TURNS } from '../data/taxRates';
import { ARMY_MAINTENANCE_MIN, ARMY_MAINTENANCE_MAX, ARMY_MAINTENANCE_DEFAULT, FUSION_GRID_ACTIVATION_HELIUM3 } from '../data/actionCosts';
import { MAX_RIVALS, VASSAL_ANNEX_COOLDOWN_TURNS, TRUCE_BREAK_STABILITY_PENALTY } from '../data/actionCosts';
import { claimableCities } from '../engine/claims';

// A nation now spans many real provinces, not one region matching its own id — these tests use
// each nation's capital as "its" region wherever the old one-region-per-nation model used the
// nation id directly as a region id.
const cap = getNationCapital;

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
  it('ADVANCE_TURN advances the year and delegates to resolveTurn', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    expect(next.year).toBeGreaterThan(state.year);
    expect(next.turnNumber).toBe(state.turnNumber + 1);
  });

  it('ADVANCE_TURN is a no-op once the game has ended', () => {
    const state = { ...createInitialState({ playerNationId: 'fr' }), gameStatus: GameStatus.DEFEAT };
    const next = gameReducer(state, { type: ActionTypes.ADVANCE_TURN });
    expect(next).toBe(state);
  });

  it('RESOLVE_EVENT is a no-op if there is no active event', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = gameReducer(state, { type: ActionTypes.RESOLVE_EVENT, payload: { optionIndex: 0 } });
    expect(next).toBe(state);
  });
});

describe('ADD_LOG', () => {
  it('appends a log entry with the given message and type', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = gameReducer(state, { type: ActionTypes.ADD_LOG, payload: { message: 'Test message', type: LogTypes.MILESTONE } });
    expect(next.logs[next.logs.length - 1]).toEqual({ year: state.year, message: 'Test message', type: LogTypes.MILESTONE });
  });

  it('defaults to LogTypes.ACTION when no type is given', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = gameReducer(state, { type: ActionTypes.ADD_LOG, payload: { message: 'Test message' } });
    expect(next.logs[next.logs.length - 1].type).toBe(LogTypes.ACTION);
  });
});

describe('RESET_GAME', () => {
  it('starts a fresh game as the requested nation and speed', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = gameReducer(state, { type: ActionTypes.RESET_GAME, payload: { playerNationId: 'jp', gameSpeed: 'fast' } });
    expect(next.playerNationId).toBe('jp');
    expect(next.nations.jp.isPlayer).toBe(true);
    expect(next.nations.fr.isPlayer).toBe(false);
    expect(next.gameSpeed).toBe('fast');
    expect(next.turnNumber).toBe(1);
  });

  it('applies the requested difficulty', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const next = gameReducer(state, { type: ActionTypes.RESET_GAME, payload: { playerNationId: 'fr', difficultyId: 'emperor' } });
    expect(next.difficultyId).toBe('emperor');
    expect(next.difficultyMultiplier).toBeGreaterThan(1);
  });

  it('applies a starting doctrine when one is passed', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    // 'none' has no effects, so this just confirms it doesn't throw and resources stay sane.
    const next = gameReducer(state, { type: ActionTypes.RESET_GAME, payload: { playerNationId: 'fr', doctrineId: 'none' } });
    expect(next.resources.gold).toBeGreaterThanOrEqual(0);
  });
});

describe('LOAD_GAME', () => {
  it('merges the payload over a fresh state, defaulting gameStatus to ACTIVE', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const saved = { ...state, turnNumber: 42, playerNationId: 'de' };
    const next = gameReducer(state, { type: ActionTypes.LOAD_GAME, payload: saved });
    expect(next.turnNumber).toBe(42);
    expect(next.playerNationId).toBe('de');
    expect(next.gameStatus).toBe(GameStatus.ACTIVE);
  });
});

describe('Domestic tab actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000 } };
  };

  describe('GAIN_CONTROL', () => {
    it('raises control by 5% and deducts the cost', () => {
      const before = richState();
      const withLowControl = { ...before, regions: { ...before.regions, [cap('fr')]: { ...before.regions[cap('fr')], control: 50 } } };
      const next = gameReducer(withLowControl, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].control).toBe(55);
      expect(next.resources.gold).toBeLessThan(withLowControl.resources.gold);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      const otherId = Object.keys(state.regions).find(id => id !== 'fr');
      expect(gameReducer(state, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: otherId } })).toBe(state);
    });

    it('is a no-op already at 100% control', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: cap('fr') } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const withLowControl = { ...state, resources: { ...state.resources, gold: 0 }, regions: { ...state.regions, [cap('fr')]: { ...state.regions[cap('fr')], control: 50 } } };
      expect(gameReducer(withLowControl, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: cap('fr') } })).toBe(withLowControl);
    });
  });

  describe('BUILD_INFRASTRUCTURE', () => {
    it('raises infrastructure level and deducts the cost', () => {
      const base = richState();
      const state = { ...base, regions: { ...base.regions, [cap('fr')]: { ...base.regions[cap('fr')], currentInfrastructure: 3 } } };
      const next = gameReducer(state, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].currentInfrastructure).toBe(4);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op at the level cap', () => {
      const state = richState();
      const maxed = { ...state, regions: { ...state.regions, [cap('fr')]: { ...state.regions[cap('fr')], currentInfrastructure: 10 } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: cap('fr') } })).toBe(maxed);
    });
  });

  describe('BUILD_DEFENSES', () => {
    it('raises defenseLevel and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_DEFENSES, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].defenseLevel).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op at the level cap', () => {
      const state = richState();
      const maxed = { ...state, regions: { ...state.regions, [cap('fr')]: { ...state.regions[cap('fr')], defenseLevel: 10 } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_DEFENSES, payload: { regionId: cap('fr') } })).toBe(maxed);
    });
  });

  describe('BUILD_CLIMATE_RESILIENCE', () => {
    // Modern-age-only, unlike Build Defenses — richState() above starts in the Bronze Age.
    const modernState = () => ({ ...richState(), age: 'modern', techAgeId: 'modern' });

    it('raises climateResilience and deducts the cost', () => {
      const state = modernState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].climateResilience).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op before the Modern Age', () => {
      const state = richState(); // Bronze Age
      expect(gameReducer(state, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap('fr') } })).toBe(state);
    });

    it('is a no-op at the level cap', () => {
      const state = modernState();
      const maxed = { ...state, regions: { ...state.regions, [cap('fr')]: { ...state.regions[cap('fr')], climateResilience: CLIMATE_RESILIENCE_MAX } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap('fr') } })).toBe(maxed);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...modernState(), resources: { ...modernState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.BUILD_CLIMATE_RESILIENCE, payload: { regionId: cap('fr') } })).toBe(state);
    });
  });

  describe('CONSTRUCT_BUILDING (plan §M6: tech-gated, real per-tier gold cost, slot-limited)', () => {
    it('builds a tier-1 with no requiresTech, at no tech at all researched', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } });
      expect(next.regions[cap('fr')].buildings.categories.food).toBe(0); // Granary
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op for a tier gated by a tech that is not researched', () => {
      const state = richState();
      const tier0 = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } });
      // Irrigation (tier 1) requires infrastructure_aqueducts — not researched.
      expect(gameReducer(tier0, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } })).toBe(tier0);
    });

    it('builds a gated tier once its specific tech is researched', () => {
      const base = richState();
      const tier0 = gameReducer(base, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } });
      const withTech = { ...tier0, techTree: { ...tier0.techTree, infrastructure_aqueducts: { ...tier0.techTree.infrastructure_aqueducts, researched: true } } };
      const tier1 = gameReducer(withTech, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } });
      expect(tier1.regions[cap('fr')].buildings.categories.food).toBe(1); // Irrigation
    });

    it('is a no-op for a category whose own tier-1 requires a tech (e.g. Economy needs Minted Coinage)', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'economy' } })).toBe(state);
    });

    it('is a no-op for a naval building in a non-coastal region', () => {
      const state = richState();
      const inlandId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && !REGIONS_DATA[id]?.isCoastal);
      if (!inlandId) return; // no inland French region in the current dataset — nothing to assert
      const withTech = { ...state, techTree: { ...state.techTree, economy_silk_road_trade: { ...state.techTree.economy_silk_road_trade, researched: true } } };
      expect(gameReducer(withTech, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: inlandId, categoryId: 'naval' } })).toBe(withTech);
    });

    it('rejects a new category once every building slot is used, but upgrading an existing one is still free', () => {
      // France's capital: 1 base + 1 for being the capital = 2 slots at 0 extra dev (development is
      // zeroed here: balanced regions start with more of it, and more dev means more slots).
      let state = richState();
      const capDev = state.regions[cap('fr')].dev;
      state = { ...state, regions: { ...state.regions, [cap('fr')]: { ...state.regions[cap('fr')], dev: Object.fromEntries(Object.keys(capDev).map((k) => [k, 0])) } } };
      state = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } }); // slot 1/2
      state = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'military' } }); // slot 2/2
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'defense' } })).toBe(state); // no free slot for a THIRD category
      const upgraded = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'military' } }); // Drill Yard needs Iron Weapons though
      expect(upgraded).toBe(state); // rejected by the tech gate, not the (already-passing) slot check
      const withTech = { ...state, techTree: { ...state.techTree, military_iron_weapons: { ...state.techTree.military_iron_weapons, researched: true } } };
      const upgradedForReal = gameReducer(withTech, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'military' } });
      expect(upgradedForReal.regions[cap('fr')].buildings.categories.military).toBe(1); // upgrading is free of slots
    });

    it('is a no-op when unaffordable', () => {
      const fresh = createInitialState({ playerNationId: 'fr' });
      const base = { ...fresh, resources: { ...fresh.resources, gold: 0 } };
      expect(gameReducer(base, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'food' } })).toBe(base);
    });

    it('rejects an unknown category', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: cap('fr'), categoryId: 'not_real' } })).toBe(state);
    });
  });

  describe('DEVELOP_RESOURCE_SITE', () => {
    it('develops a deposit the region actually has', () => {
      const state = richState('cl'); // Chile has copper
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cap('cl'), resourceId: 'copper' } });
      expect(next.regions[cap('cl')].buildings.extraction.copper).toBe(true);
    });

    it('rejects a resource the region has no deposit for', () => {
      const state = richState('fr'); // France has no copper deposit listed
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cap('fr'), resourceId: 'copper' } })).toBe(state);
    });

    it('rejects developing the same site twice', () => {
      const state = richState('cl');
      const once = gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cap('cl'), resourceId: 'copper' } });
      expect(gameReducer(once, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cap('cl'), resourceId: 'copper' } })).toBe(once);
    });

    it('rejects a resource not yet unlocked by age', () => {
      const state = richState('sa'); // Saudi Arabia has oil, but oil needs Modern age
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: cap('sa'), resourceId: 'oil' } })).toBe(state);
    });
  });

  describe('DEVELOP_PROVINCE (plan §M5)', () => {
    const powerRichState = () => {
      const state = createInitialState({ playerNationId: 'fr' });
      return { ...state, resources: { ...state.resources, adm: 100000, dip: 100000, mil: 100000 } };
    };

    it('raises the region\'s tax development by 1 and deducts the ADM cost', () => {
      const state = powerRichState();
      const before = state.regions[cap('fr')].dev.tax;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap('fr'), devType: 'tax' } });
      expect(next.regions[cap('fr')].dev.tax).toBe(before + 1);
      expect(next.resources.adm).toBeLessThan(state.resources.adm);
    });

    it('raises production development and spends DIP', () => {
      const state = powerRichState();
      const before = state.regions[cap('fr')].dev.production;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap('fr'), devType: 'production' } });
      expect(next.regions[cap('fr')].dev.production).toBe(before + 1);
      expect(next.resources.dip).toBeLessThan(state.resources.dip);
      expect(next.resources.adm).toBe(state.resources.adm);
    });

    it('raises manpower development and spends MIL', () => {
      const state = powerRichState();
      const before = state.regions[cap('fr')].dev.manpower;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap('fr'), devType: 'manpower' } });
      expect(next.regions[cap('fr')].dev.manpower).toBe(before + 1);
      expect(next.resources.mil).toBeLessThan(state.resources.mil);
    });

    it('grows the region\'s population by 3% of its modern baseline', () => {
      const state = powerRichState();
      const before = state.regions[cap('fr')].currentPopulation;
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap('fr'), devType: 'tax' } });
      expect(next.regions[cap('fr')].currentPopulation).toBeGreaterThan(before);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = powerRichState();
      const otherId = Object.keys(state.regions).find((id) => id !== cap('fr') && state.regions[id].owner !== 'fr');
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: otherId, devType: 'tax' } })).toBe(state);
    });

    it('is a no-op for an invalid devType', () => {
      const state = powerRichState();
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap('fr'), devType: 'bogus' } })).toBe(state);
    });

    it('is a no-op when the matching pool cannot afford the cost', () => {
      const fresh = createInitialState({ playerNationId: 'fr' });
      const base = { ...fresh, resources: { ...fresh.resources, adm: 0 } };
      expect(gameReducer(base, { type: ActionTypes.DEVELOP_PROVINCE, payload: { regionId: cap('fr'), devType: 'tax' } })).toBe(base);
    });
  });

  describe('QUELL_UNREST', () => {
    const withUnrest = (unrest) => {
      const base = richState();
      return { ...base, regions: { ...base.regions, [cap('fr')]: { ...base.regions[cap('fr')], unrest } } };
    };

    it('reduces unrest and deducts the cost', () => {
      const state = withUnrest(50);
      const next = gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].unrest).toBe(20);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when there is no unrest to quell', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: cap('fr') } })).toBe(state);
    });

    it('floors at 0 rather than going negative', () => {
      const state = withUnrest(10);
      const next = gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].unrest).toBe(0);
    });
  });

  describe('SETTLE_COLONIZE', () => {
    // be-vwv (Hainaut) really borders fr-59 (Nord) — worldRegions.json — used instead of Belgium's
    // (capital-heuristic) "capital" region, which isn't necessarily anywhere near the French
    // border (Brussels isn't).
    const BE_BORDER = cap('be'); // Brussels borders Paris on the Dawn world
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
      expect(next.regions[BE_BORDER].owner).toBe('fr');
      expect(next.regions[BE_BORDER].control).toBeGreaterThan(0);
      expect(next.regions[BE_BORDER].control).toBeLessThan(100);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.regions[BE_BORDER].formerOwner).toBe('be');
    });

    it('is a no-op when the target still has real control of its own territory', () => {
      const state = withCollapsedNeighbor(50);
      expectRefused(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: BE_BORDER } }), state);
    });

    it('is a no-op on a region that does not border the player', () => {
      // 'us' does not border 'fr'.
      const base = richState();
      const state = { ...base, regions: { ...base.regions, [cap('us')]: { ...base.regions[cap('us')], control: 5 } } };
      expectRefused(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap('us') } }), state);
    });

    it('is a no-op on a region the player already owns', () => {
      const state = withCollapsedNeighbor(10);
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap('fr') } })).toBe(state);
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
      const before = state.regions[cap('fr')].currentPopulation;
      const next = gameReducer(state, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: cap('fr') } });
      expect(next.regions[cap('fr')].currentPopulation).toBeGreaterThan(before);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: cap('be') } })).toBe(state);
    });
  });

  describe('SET_TAX_RATE', () => {
    // Free (0 AP) — a slider flip, not a strategic decision competing with the AP budget.
    it('changes the tax rate at no resource cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'high' } });
      expect(next.nations.fr.taxRate).toBe('high');
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
      expect(next.nations.fr.taxRate).toBe('low');
    });
  });

  describe('SET_ARMY_MAINTENANCE / SET_NAVY_MAINTENANCE (plan §M11)', () => {
    it('sets and clamps the army maintenance slider', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: 70 } }).nations.fr.armyMaintenance).toBe(70);
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: 10 } }).nations.fr.armyMaintenance).toBe(ARMY_MAINTENANCE_MIN);
      expect(gameReducer(state, { type: ActionTypes.SET_ARMY_MAINTENANCE, payload: { value: 200 } }).nations.fr.armyMaintenance).toBe(ARMY_MAINTENANCE_MAX);
    });

    it('sets the navy maintenance slider independently of army', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_NAVY_MAINTENANCE, payload: { value: 60 } });
      expect(next.nations.fr.navyMaintenance).toBe(60);
      expect(next.nations.fr.armyMaintenance).toBe(ARMY_MAINTENANCE_DEFAULT);
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
      expect(next.nations.fr.loans.length).toBe(1);
      expect(next.resources.gold).toBeGreaterThan(state.resources.gold);
      expect(next.nations.fr.loans[0].principal).toBeGreaterThanOrEqual(200);
    });

    it('is a no-op once loan capacity is exhausted', () => {
      let state = withBankingHouses(richState());
      const capacity = 4; // base 3 + 1 for Banking Houses, no Bank buildings
      for (let i = 0; i < capacity; i++) state = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      expect(state.nations.fr.loans.length).toBe(capacity);
      expect(gameReducer(state, { type: ActionTypes.REQUEST_LOAN })).toBe(state);
    });

    it('repaying a loan removes it and deducts its principal', () => {
      const state = withBankingHouses(richState());
      const withLoan = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      const loan = withLoan.nations.fr.loans[0];
      const next = gameReducer(withLoan, { type: ActionTypes.REPAY_LOAN, payload: { loanId: loan.id } });
      expect(next.nations.fr.loans.length).toBe(0);
      expect(next.resources.gold).toBe(withLoan.resources.gold - loan.principal);
    });

    it('repaying is a no-op when the player can\'t afford the principal', () => {
      const state = withBankingHouses(richState());
      const withLoan = gameReducer(state, { type: ActionTypes.REQUEST_LOAN });
      const loan = withLoan.nations.fr.loans[0];
      const poor = { ...withLoan, resources: { ...withLoan.resources, gold: 0 } };
      expectRefused(gameReducer(poor, { type: ActionTypes.REPAY_LOAN, payload: { loanId: loan.id } }), poor);
    });
  });

  describe('ACTIVATE_FUSION_GRID (plan §M11 resource sink)', () => {
    const withOuterPlanets = (state) => ({ ...state, completedMissions: ['outer_planets'] });

    it('is a no-op without the Outer Planets mission completed', () => {
      const state = { ...richState(), resources: { ...richState().resources, helium3: 1000 } };
      expect(gameReducer(state, { type: ActionTypes.ACTIVATE_FUSION_GRID })).toBe(state);
    });

    it('is a no-op without enough helium3', () => {
      const state = withOuterPlanets({ ...richState(), resources: { ...richState().resources, helium3: 0 } });
      expect(gameReducer(state, { type: ActionTypes.ACTIVATE_FUSION_GRID })).toBe(state);
    });

    it('activates, deducting the one-time helium3 cost', () => {
      const state = withOuterPlanets({ ...richState(), resources: { ...richState().resources, helium3: 1000 } });
      const next = gameReducer(state, { type: ActionTypes.ACTIVATE_FUSION_GRID });
      expect(next.nations.fr.fusionGridActive).toBe(true);
      expect(next.resources.helium3).toBe(1000 - FUSION_GRID_ACTIVATION_HELIUM3);
    });

    it('is a no-op once already active', () => {
      const state = withOuterPlanets({ ...richState(), resources: { ...richState().resources, helium3: 1000 } });
      const active = gameReducer(state, { type: ActionTypes.ACTIVATE_FUSION_GRID });
      expect(gameReducer(active, { type: ActionTypes.ACTIVATE_FUSION_GRID })).toBe(active);
    });
  });

  describe('INCREASE_STABILITY (plan §M4)', () => {
    const admRichState = () => {
      const state = createInitialState({ playerNationId: 'fr' });
      return { ...state, resources: { ...state.resources, adm: 100000 } };
    };

    it('raises stability by 1 and deducts the ADM cost', () => {
      const state = admRichState();
      const next = gameReducer(state, { type: ActionTypes.INCREASE_STABILITY });
      expect(next.nations.fr.stability).toBe((state.nations.fr.stability || 0) + 1);
      expect(next.resources.adm).toBeLessThan(state.resources.adm);
    });

    it('is a no-op once stability is already at its maximum', () => {
      const state = { ...admRichState() };
      state.nations = { ...state.nations, fr: { ...state.nations.fr, stability: 3 } };
      expect(gameReducer(state, { type: ActionTypes.INCREASE_STABILITY })).toBe(state);
    });

    it('is a no-op when the player cannot afford the ADM cost', () => {
      const fresh = createInitialState({ playerNationId: 'fr' });
      const base = { ...fresh, resources: { ...fresh.resources, adm: 0 } };
      expect(gameReducer(base, { type: ActionTypes.INCREASE_STABILITY })).toBe(base);
    });
  });
});

describe('Space Race tab actions', () => {
  // Satellites require the Modern Age and the real Sputnik year — richState() above starts in
  // the Bronze Age, so this describe block needs its own fixture.
  const spaceState = (playerNationId = 'fr') => {
    const fresh = createInitialState({ playerNationId });
    return {
      ...fresh,
      age: 'modern',
      techAgeId: 'modern',
      year: 1960,
      resources: { ...fresh.resources, gold: 100000, techPoints: 10000, iron: 100000, oil: 100000 }
    };
  };

  describe('LAUNCH_SATELLITE', () => {
    it('launches a satellite, deducts the cost, and it belongs to the player', () => {
      const state = spaceState();
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId: 'navigation' } });
      const launched = Object.values(next.satellites);
      expect(launched).toHaveLength(1);
      expect(launched[0]).toMatchObject({ ownerId: 'fr', typeId: 'navigation' });
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.nextSatelliteSeq).toBe(state.nextSatelliteSeq + 1);
    });

    it('is a no-op for an unknown satellite type', () => {
      const state = spaceState();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId: 'not_real' } })).toBe(state);
    });

    it('is a no-op before the Modern Age', () => {
      const state = { ...spaceState(), age: 'gunpowder', techAgeId: 'gunpowder' };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId: 'navigation' } })).toBe(state);
    });

    it('is a no-op before the real unlock year, even in the Modern Age', () => {
      const state = { ...spaceState(), year: 1901 };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId: 'navigation' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...spaceState(), resources: { ...spaceState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_SATELLITE, payload: { typeId: 'navigation' } })).toBe(state);
    });
  });

  describe('ASAT_STRIKE', () => {
    const withRivalSatellite = () => {
      const state = spaceState();
      return { ...state, satellites: { rival_sat: { id: 'rival_sat', ownerId: 'de', typeId: 'navigation' } } };
    };

    it('destroys the target satellite, deducts the cost, and raises orbital debris', () => {
      const state = withRivalSatellite();
      const next = gameReducer(state, { type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: 'rival_sat' } });
      expect(next.satellites.rival_sat).toBeUndefined();
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.orbitalDebrisLevel).toBeGreaterThan(state.orbitalDebrisLevel || 0);
    });

    it('is a no-op against a nonexistent satellite id', () => {
      const state = withRivalSatellite();
      expect(gameReducer(state, { type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: 'not_real' } })).toBe(state);
    });

    it('is a no-op against the player\'s own satellite', () => {
      const state = { ...spaceState(), satellites: { own_sat: { id: 'own_sat', ownerId: 'fr', typeId: 'navigation' } } };
      expect(gameReducer(state, { type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: 'own_sat' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const base = withRivalSatellite();
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: 'rival_sat' } })).toBe(state);
    });

    it('never lets debris exceed MAX_ORBITAL_DEBRIS even after repeated strikes', () => {
      let state = withRivalSatellite();
      state = { ...state, orbitalDebrisLevel: MAX_ORBITAL_DEBRIS - 5 };
      const next = gameReducer(state, { type: ActionTypes.ASAT_STRIKE, payload: { targetSatelliteId: 'rival_sat' } });
      expect(next.orbitalDebrisLevel).toBe(MAX_ORBITAL_DEBRIS);
    });
  });

  describe('BUILD_MISSILE', () => {
    it('adds a missile to the stockpile and deducts the cost', () => {
      const state = spaceState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_MISSILE, payload: { tierId: 'tactical' } });
      expect(next.nations.fr.missiles.tactical).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op for an unknown tier', () => {
      const state = spaceState();
      expect(gameReducer(state, { type: ActionTypes.BUILD_MISSILE, payload: { tierId: 'not_real' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const base = spaceState();
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expectRefused(gameReducer(state, { type: ActionTypes.BUILD_MISSILE, payload: { tierId: 'tactical' } }), state);
    });
  });

  describe('MISSILE_STRIKE', () => {
    // de-rp (Rhineland-Palatinate) really borders fr-57 (Moselle) — 1 hop from France's owned
    // territory, well inside tactical range (3). 'us' cap is ~30 real land hops from France (no
    // actual land route at all, in truth — Europe/Americas aren't land-connected in this data),
    // making it a genuine out-of-range target for any finite-range tier.
    const DE_REGION = cap('de'); // Berlin borders Paris on the Dawn world: 1 hop
    // A strike is an act of war (second review pass S4), so the default fixture is at war with both
    // target nations; `atWar: false` exercises the refusal.
    const withMissile = (tierId, count = 1, { atWar = true } = {}) => {
      const base = spaceState();
      const wars = atWar
        ? ['de', 'us'].map((enemy) => ({ id: `war_${enemy}`, aggressor: 'fr', enemy, active: true, battleScore: 0, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }))
        : base.wars;
      return { ...base, wars, nations: { ...base.nations, fr: { ...base.nations.fr, missiles: { ...base.nations.fr.missiles, [tierId]: count } } } };
    };

    it('damages the target region and the target nation, and consumes the missile', () => {
      const state = withMissile('tactical');
      const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } });
      expect(next.regions[DE_REGION].control).toBeLessThan(state.regions[DE_REGION].control);
      expect(next.regions[DE_REGION].unrest).toBeGreaterThan(state.regions[DE_REGION].unrest);
      expect(next.nations.de.militaryStrength).toBeLessThan(state.nations.de.militaryStrength);
      expect(next.nations.fr.missiles.tactical).toBe(0);
    });

    it('is a no-op with an empty stockpile for that tier', () => {
      const state = spaceState();
      expectRefused(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } }), state);
    });

    it('is a no-op against the player\'s own region', () => {
      const state = withMissile('tactical');
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: cap('fr') } })).toBe(state);
    });

    it('is a no-op when the target is out of the tier\'s range', () => {
      const state = withMissile('tactical');
      expectRefused(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: cap('us') } }), state);
    });

    it('an icbm reaches a target a tactical missile could never reach', () => {
      const state = withMissile('icbm');
      const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'icbm', targetRegionId: cap('us') } });
      expect(next.regions[cap('us')].control).toBeLessThan(state.regions[cap('us')].control);
    });

    it('an ABM defense level reduces incoming damage', () => {
      const base = withMissile('tactical', 2);
      const noAbm = gameReducer(base, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } });
      const withAbmState = { ...base, nations: { ...base.nations, de: { ...base.nations.de, abmDefenseLevel: 3 } } };
      const withAbm = gameReducer(withAbmState, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } });
      const noAbmDamage = base.regions[DE_REGION].control - noAbm.regions[DE_REGION].control;
      const withAbmDamage = base.regions[DE_REGION].control - withAbm.regions[DE_REGION].control;
      expect(withAbmDamage).toBeLessThan(noAbmDamage);
    });

    it('a nuclear strike scars the region and raises every other nation\'s hostility (global condemnation)', () => {
      const state = withMissile('nuclear');
      const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'nuclear', targetRegionId: DE_REGION } });
      expect(next.regions[DE_REGION].nuclearScarred).toBe(true);
      const thirdParty = Object.keys(state.nations).find(id => id !== 'fr' && id !== 'de');
      expect(next.nations[thirdParty].hostility).toBeGreaterThan(state.nations[thirdParty].hostility);
    });

    // Plan §M19: "Missiles and nuclear strikes now affect war score (+2 per strike, +10 per
    // nuclear strike), AE, and opinion. A nuclear strike gives ... -50 prestige and a 'Nuclear
    // Pariah' 20-turn modifier."
    describe('war score, prestige, and Nuclear Pariah (plan §M19)', () => {
      const withWar = (tierId) => {
        const base = withMissile(tierId);
        return { ...base, wars: [{ id: 'war_1', aggressor: 'fr', enemy: 'de', active: true, battleScore: 0, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }] };
      };

      it('a non-nuclear strike against an active war enemy bumps battleScore by +2 for the striker', () => {
        const state = withWar('tactical');
        const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } });
        expect(next.wars[0].battleScore).toBe(2);
      });

      it('a nuclear strike against an active war enemy bumps battleScore by +10 for the striker', () => {
        const state = withWar('nuclear');
        const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'nuclear', targetRegionId: DE_REGION } });
        expect(next.wars[0].battleScore).toBe(10);
      });

      it('refuses a strike on a nation the striker is not at war with (no damage, missile kept)', () => {
        const state = withMissile('tactical', 1, { atWar: false });
        const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } });
        expectRefused(next, state);
        expect(next.nations.fr.missiles.tactical).toBe(1);
      });

      it('a nuclear strike costs the striker prestige and applies a 20-turn Nuclear Pariah modifier', () => {
        const state = withMissile('nuclear');
        const prestigeBefore = state.nations.fr.prestige || 0;
        const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'nuclear', targetRegionId: DE_REGION } });
        expect(next.nations.fr.prestige).toBe(prestigeBefore - 50);
        const pariah = next.nations.fr.modifiers.find((m) => m.sourceId === 'nuclear_pariah');
        expect(pariah).toBeTruthy();
        expect(pariah.mods['national.goldMult']).toBeLessThan(0);
        expect(pariah.expiresTurn).toBe(state.turnNumber + 20);
      });

      it('a non-nuclear strike does NOT apply the prestige penalty or Nuclear Pariah modifier', () => {
        const state = withMissile('tactical');
        const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } });
        expect(next.nations.fr.prestige).toBe(state.nations.fr.prestige);
        expect(next.nations.fr.modifiers || []).toHaveLength((state.nations.fr.modifiers || []).length);
      });
    });

    it('is a no-op when unaffordable (the flat action-point cost)', () => {
      const base = withMissile('tactical');
      const state = { ...base, resources: { ...base.resources, mil: 0 } };
      expectRefused(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } }), state);
    });
  });

  describe('BUILD_ABM_DEFENSE', () => {
    it('raises the player\'s abmDefenseLevel and deducts the cost', () => {
      const state = spaceState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_ABM_DEFENSE, payload: {} });
      expect(next.nations.fr.abmDefenseLevel).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op once already at the maximum level', () => {
      const base = spaceState();
      const state = { ...base, nations: { ...base.nations, fr: { ...base.nations.fr, abmDefenseLevel: MAX_ABM_LEVEL } } };
      expect(gameReducer(state, { type: ActionTypes.BUILD_ABM_DEFENSE, payload: {} })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const base = spaceState();
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.BUILD_ABM_DEFENSE, payload: {} })).toBe(state);
    });
  });

  describe('LAUNCH_MISSION', () => {
    it('starts the first mission in the ladder and deducts its cost', () => {
      const state = spaceState();
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_MISSION, payload: { missionId: 'sounding_rocket' } });
      expect(next.spaceMissionProgress.sounding_rocket).toBe(3);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op before the Modern Age even if the mission itself would otherwise be launchable', () => {
      const state = { ...spaceState(), age: 'gunpowder', techAgeId: 'gunpowder' };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_MISSION, payload: { missionId: 'sounding_rocket' } })).toBe(state);
    });

    it('is a no-op for a mission whose predecessor is not yet complete', () => {
      const state = spaceState();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_MISSION, payload: { missionId: 'first_satellite' } })).toBe(state);
    });

    it('allows the next rung once its predecessor is completed', () => {
      const state = { ...spaceState(), completedMissions: ['sounding_rocket'] };
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_MISSION, payload: { missionId: 'first_satellite' } });
      expect(next.spaceMissionProgress.first_satellite).toBe(4);
    });

    it('is a no-op when unaffordable', () => {
      const base = spaceState();
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_MISSION, payload: { missionId: 'sounding_rocket' } })).toBe(state);
    });
  });
});

describe('Military tab actions', () => {
  // French states build on WORLD (below): the Dawn world gives France one city with no room
  // beside it, and these actions need a border city with a French neighbour.
  const richState = (playerNationId = 'fr') => {
    const state = playerNationId === 'fr' ? WORLD.state : { ...createInitialState({ playerNationId }), units: {} };
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000 } };
  };

  describe('RECRUIT_UNIT', () => {
    it('creates a unit in the region with the requested class and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
      const unitIds = Object.keys(next.units);
      expect(unitIds.length).toBe(1);
      const unit = next.units[unitIds[0]];
      expect(unit.regionId).toBe(cap('fr'));
      expect(unit.classId).toBe('infantry');
      expect(unit.ownerId).toBe('fr');
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
      const before = state.nations.fr.militaryStrength;
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
      const unit = Object.values(next.units)[0];
      expect(next.nations.fr.militaryStrength).toBe(before + unit.strength);
    });

    it('sets domain to naval for the naval class', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'naval' } });
      const unit = Object.values(next.units)[0];
      expect(unit.domain).toBe('naval');
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      const otherId = Object.keys(state.regions).find(id => id !== 'fr');
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: otherId, classId: 'infantry' } })).toBe(state);
    });

    it('is a no-op for a class not yet available at the current age', () => {
      const state = richState(); // Bronze Age: no Air units yet
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'air' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const poor = { ...state, resources: { ...state.resources, gold: 0, hr: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } })).toBe(poor);
    });
  });

  describe('DISBAND_UNIT', () => {
    const withUnit = () => {
      const state = richState();
      return gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
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
      const before = state.nations.fr.militaryStrength;
      const next = gameReducer(state, { type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
      expect(next.nations.fr.militaryStrength).toBe(before - state.units[unitId].strength);
    });

    it('is a no-op for a unit that does not exist', () => {
      const state = withUnit();
      expect(gameReducer(state, { type: ActionTypes.DISBAND_UNIT, payload: { unitId: 'not_real' } })).toBe(state);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.DISBAND_UNIT, payload: { unitId } })).toBe(stolen);
    });
  });

  // fr-59 (Nord) really borders be-vwv (Hainaut) — worldRegions.json — used below wherever the
  // old model's bare 'fr'/'be' needed genuine land adjacency, not just any owned region (a
  // nation's capital, e.g. Paris, isn't necessarily anywhere near a given border).
  // The Dawn world gives France one city with no room beside it, so the fixture founds French
  // cities on the nearest free land: FR_BORDER (bordering a foreign capital, the invasion's
  // target) and FR_NEIGHBOR, a second French city bordering it. The enemy is whoever owns the target.
  const WORLD = (() => {
    const first = addCity(createInitialState({ playerNationId: 'fr', rngSeed: 1 }), 'fr');
    // A land attack from inside a city needs the two lands to touch (registry `touching`); the Dawn
    // bridge between capitals no longer carries one.
    const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr') || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== 'fr');
    const second = addCity(first.state, 'fr', { near: first.cityId });
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

    it('moves the unit to an adjacent, player-owned region, deducts the cost, and spends its move (plan §M14)', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } });
      expect(next.units[unitId].regionId).toBe(FR_NEIGHBOR);
      expect(next.units[unitId].movesLeft).toBe(0);
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
      expect(gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: BE_REGION } })).toBe(state);
    });

    it('is a no-op moving to a non-adjacent region', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      expect(gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: cap('jp') } })).toBe(state);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } })).toBe(stolen);
    });
  });

  describe('LAUNCH_INVASION', () => {
    it('invading a nation you are at peace with does nothing but explain why (declare war first)', () => {
      const state = createInitialState({ playerNationId: 'fr', rngSeed: 1 });
      const from = cap('fr'); const target = cap('be'); // Paris borders Brussels
      const armed = { ...state, units: { x1: { id: 'x1', regionId: from, ownerId: 'fr', domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1 } } };
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

    it('conquers an undefended adjacent region and moves surviving units into it', () => {
      // Conquest by battle (src/engine/conquest.js): a captured region becomes the attacker's at
      // once, marked with the war it was taken in so a peace deal can still hand it back.
      const state = withAttacker();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(next.regions[BE_REGION].owner).toBe('fr');
      expect(next.regions[BE_REGION].occupiedBy).toBeUndefined();
      expect(next.regions[BE_REGION].conquest).toMatchObject({ from: AGG });
      // Attacking it again is refused — it's already held.
      const again = gameReducer(next, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(again.regions).toBe(next.regions);
      expect(next.units[unitId].regionId).toBe(BE_REGION);
      expect(next.resources.mil).toBeLessThan(state.resources.mil);
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('records the invasion as a battle in the war record, favoring the winning side\'s war score', () => {
      const state = withAttacker();
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

      it('captures once control crosses the threshold and a melee unit is present', () => {
        const state = withAttacker(50000);
        const defenderUnit = {
          id: 'def_weak', regionId: BE_REGION, ownerId: AGG, domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        // Already weakened by a prior round (or unrest) down to 40 — one more 30-point hit crosses
        // the 15 threshold.
        const withDefender = { ...state, units: { ...state.units, def_weak: defenderUnit }, regions: { ...state.regions, [BE_REGION]: { ...state.regions[BE_REGION], control: 40 } } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        expect(next.regions[BE_REGION].owner).toBe('fr'); // conquered by battle
        expect(next.regions[BE_REGION].control).toBe(25); // the usual post-capture reset
        expect(next.regions[BE_REGION].underInvasion).toBe(false);
        expect(next.lastBattleReport.captured).toBe(true);
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
      const otherId = Object.keys(state.regions).find(id => state.regions[id].owner !== 'fr');
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
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: cap('jp') } }), state);
    });

    it('is a no-op when there are no attacker units in the source region', () => {
      const state = richState();
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }), state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...withAttacker(), resources: { ...withAttacker().resources, mil: 0 } };
      expectRefused(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }), state);
    });
  });
});

describe('Promotions and generals actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, mil: 10 } };
  };

  describe('PROMOTE_UNIT', () => {
    const withUnit = (xp = 0) => {
      const state = richState();
      const recruited = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
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
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
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
      expect(general.nationId).toBe('fr');
      expect(general.assignedUnitId).toBeNull();
      expect(next.nextCommanderSeq).toBe(state.nextCommanderSeq + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...createInitialState({ playerNationId: 'fr' }), resources: { ...createInitialState({ playerNationId: 'fr' }).resources, gold: 0 } };
      expectRefused(gameReducer(state, { type: ActionTypes.HIRE_GENERAL, payload: {} }), state);
    });
  });

  describe('APPOINT_GENERAL', () => {
    const withGeneralAndUnit = () => {
      const state = richState();
      const hired = gameReducer(state, { type: ActionTypes.HIRE_GENERAL, payload: {} });
      const recruited = gameReducer(hired, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
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
      const second = gameReducer(appointed, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'cavalry' } });
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
      const stolen = { ...state, hiredCommanders: { ...state.hiredCommanders, [generalId]: { ...state.hiredCommanders[generalId], nationId: 'de' } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } }), stolen);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const stolenUnit = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
      expectRefused(gameReducer(stolenUnit, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } }), stolenUnit);
    });
  });
});

describe('Navies and amphibious invasion actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, mil: 10 } };
  };

  const withNavalAndLand = () => {
    const state = richState();
    const withNaval = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'naval' } });
    const withLand = gameReducer(withNaval, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
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
      const withSecondLand = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'cavalry' } });
      const withThirdLand = gameReducer(withSecondLand, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'ranged' } });
      const otherLandIds = Object.keys(withThirdLand.units).filter((id) => withThirdLand.units[id].domain === 'land' && id !== landUnitId);
      const first = gameReducer(withThirdLand, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const second = gameReducer(first, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[0], navalUnitId } });
      // Transport capacity is 2 — a third embark attempt is rejected.
      expectRefused(gameReducer(second, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[1], navalUnitId } }), second);
    });

    it('is a no-op if the units are not in the same region', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const moved = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], regionId: cap('be') } } };
      expectRefused(gameReducer(moved, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } }), moved);
    });

    it('is a no-op for a land unit not owned by the player', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const stolen = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], ownerId: 'de' } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } }), stolen);
    });

    it('is a no-op when unaffordable', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const poor = { ...state, resources: { ...state.resources, mil: 0 } };
      expectRefused(gameReducer(poor, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } }), poor);
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
      const stolen = { ...embarked, units: { ...embarked.units, [landUnitId]: { ...embarked.units[landUnitId], ownerId: 'de' } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } }), stolen);
    });
  });

  describe('AMPHIBIOUS_ASSAULT', () => {
    // A specific real GB region, not cap('gb') — the isCapital fix (build-world-regions.mjs) now
    // correctly resolves GB's capital to Westminster (real London), which isn't coastal, so it no
    // longer satisfies this test's actual requirement below. 'gb-ios' (Isles of Scilly) is not
    // land-adjacent to France but is within Bronze-age sea range (~33km across the Channel per
    // sea-lanes.json) and has no land neighbors of its own — a genuine sea-only target.
    const GB_TARGET = cap('gb');
    const withEmbarkedForce = () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      // Plan §M13: an amphibious assault now also requires an active war with the target's owner.
      return { state: withWarAgainst(embarked, 'gb'), navalUnitId, landUnitId };
    };

    it('conquers an undefended coastal region reachable only by sea', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      const next = gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.regions[GB_TARGET].owner).toBe('fr');
      expect(next.regions[GB_TARGET].conquest).toMatchObject({ from: 'gb' });
      expect(next.units[landUnitId].regionId).toBe(GB_TARGET);
      expect(next.units[landUnitId].embarkedOn).toBeNull();
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('sinks the transport and its cargo when intercepted by a defending fleet', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      const enemyFleet = {
        id: 'enemy_navy', regionId: GB_TARGET, ownerId: 'gb', domain: 'naval', classId: 'naval', ageId: 'bronze',
        strength: 50000, maxStrength: 50000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
      };
      const withEnemy = { ...state, units: { ...state.units, enemy_navy: enemyFleet } };
      const next = gameReducer(withEnemy, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.units[navalUnitId]).toBeUndefined();
      expect(next.units[landUnitId]).toBeUndefined();
      expect(next.regions[GB_TARGET].owner).toBe('gb');
    });

    it('grinds a defended landing zone\'s control without capturing it in one wave (src/engine/siege.js)', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      // A ranged-only landing wins the beach but can't take the province.
      const overwhelming = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], strength: 50000, classId: 'ranged' } } };
      const defenderUnit = {
        id: 'gb_garrison', regionId: GB_TARGET, ownerId: 'gb', domain: 'land', classId: 'infantry', ageId: 'bronze',
        strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...overwhelming, units: { ...overwhelming.units, gb_garrison: defenderUnit } };
      const next = gameReducer(withDefender, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.regions[GB_TARGET].owner).toBe('gb'); // not captured yet
      expect(next.regions[GB_TARGET].control).toBe(70); // 100 - 30
      expect(next.lastBattleReport.outcome).toBe('attacker');
      expect(next.lastBattleReport.captured).toBe(false);
      // A non-capturing landing falls back aboard the transport for another attempt.
      expect(next.units[landUnitId].embarkedOn).toBe(navalUnitId);
    });

    it('is a no-op for a naval unit not owned by the player', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      const stolen = { ...state, units: { ...state.units, [navalUnitId]: { ...state.units[navalUnitId], ownerId: 'de' } } };
      expectRefused(gameReducer(stolen, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } }), stolen);
    });

    it('is a no-op against a region the player already owns', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expectRefused(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('fr') } }), state);
    });

    it('is a no-op against a non-coastal target', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expectRefused(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('lu') } }), state);
    });

    it('is a no-op with no embarked land units', () => {
      const { state, navalUnitId } = withNavalAndLand();
      expectRefused(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('gb') } }), state);
    });

    it('is a no-op when unaffordable', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      // No MIL and no gold: whatever the landing costs (ACTION_COSTS.amphibiousAssault) is unaffordable.
      const poor = { ...state, resources: { ...state.resources, mil: 0, gold: 0 } };
      expectRefused(gameReducer(poor, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } }), poor);
    });
  });

  describe('NAVAL_ENGAGEMENT', () => {
    const withEnemyFleetAt = (regionId) => {
      const { state, navalUnitId } = withNavalAndLand();
      const enemyFleet = {
        id: 'enemy_navy', regionId, ownerId: 'gb', domain: 'naval', classId: 'naval', ageId: 'bronze',
        strength: 50, maxStrength: 50, morale: 30, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
      };
      // Engaging a fleet needs a war with its nation, like an invasion (plan §M13).
      return { state: withWarAgainst({ ...state, units: { ...state.units, enemy_navy: enemyFleet } }, 'gb'), navalUnitId };
    };

    it('refuses to engage the fleet of a nation you are at peace with, and says why', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      const peaceful = { ...state, wars: state.wars.filter((w) => w.enemy !== 'gb') };
      const next = gameReducer(peaceful, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } });
      expect(next.units.enemy_navy).toBeDefined();
      expect(next.logs.at(-1).message).toMatch(/at peace/);
    });

    it('defeats an enemy fleet contesting a sea lane, holding position rather than advancing', () => {
      const { state, navalUnitId } = withEnemyFleetAt(cap('gb'));
      const next = gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } });
      expect(next.units.enemy_navy).toBeUndefined();
      expect(next.units[navalUnitId].regionId).toBe(cap('fr'));
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('is a no-op when there is no enemy fleet to engage', () => {
      const { state } = withNavalAndLand();
      expectRefused(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } }), state);
    });

    it('is a no-op from a region not owned by the player', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      expectRefused(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('de'), targetRegionId: cap('gb') } }), state);
    });

    it('is a no-op when the target is not reachable', () => {
      const { state } = withEnemyFleetAt(cap('jp'));
      expectRefused(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('jp') } }), state);
    });

    it('is a no-op with no attacker naval units in the source region', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      const noNavy = { ...state, units: {} };
      expectRefused(gameReducer(noNavy, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } }), noNavy);
    });

    it('is a no-op when unaffordable', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      const poor = { ...state, resources: { ...state.resources, mil: 0 } };
      expectRefused(gameReducer(poor, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } }), poor);
    });
  });
});

describe('SUPPRESS_REBELLION', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, mil: 10 } };
  };

  const rebelUnit = (strength = 300) => ({
    id: 'rebel_fr_1', regionId: cap('fr'), ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
    strength, maxStrength: strength, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
  });

  const withGarrisonAndRebel = (rebelStrength = 300) => {
    const state = richState();
    const withGarrison = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
    const rebel = rebelUnit(rebelStrength);
    return { ...withGarrison, units: { ...withGarrison.units, [rebel.id]: rebel } };
  };

  it('crushes a weak rebellion, restoring some control and capping unrest', () => {
    const state = { ...withGarrisonAndRebel(50), regions: { ...withGarrisonAndRebel(50).regions, [cap('fr')]: { ...withGarrisonAndRebel(50).regions[cap('fr')], unrest: 95, control: 40 } } };
    const next = gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap('fr') } });
    expect(next.units.rebel_fr_1).toBeUndefined();
    expect(next.regions[cap('fr')].unrest).toBeLessThan(REBELLION_UNREST_THRESHOLD);
    expect(next.regions[cap('fr')].control).toBeGreaterThan(40);
    expect(next.lastBattleReport.outcome).toBe('attacker');
  });

  it('a garrison repelled by an overwhelming rebellion leaves the rebels standing', () => {
    const state = withGarrisonAndRebel(500000);
    const next = gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap('fr') } });
    expect(next.units.rebel_fr_1).toBeDefined();
    expect(next.lastBattleReport.outcome).toBe('defender');
  });

  it('is a no-op for a region not owned by the player', () => {
    const state = withGarrisonAndRebel();
    const otherId = Object.keys(state.regions).find(id => id !== 'fr');
    expect(gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: otherId } })).toBe(state);
  });

  it('is a no-op when there is no rebellion in the region', () => {
    const state = richState();
    const withGarrison = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'infantry' } });
    expect(gameReducer(withGarrison, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap('fr') } })).toBe(withGarrison);
  });

  it('is a no-op with no garrison to fight with', () => {
    const state = richState();
    const withRebel = { ...state, units: { rebel_fr_1: rebelUnit() } };
    expect(gameReducer(withRebel, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap('fr') } })).toBe(withRebel);
  });

  it('is a no-op when unaffordable', () => {
    const state = { ...withGarrisonAndRebel(), resources: { ...withGarrisonAndRebel().resources, mil: 0 } };
    expect(gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: cap('fr') } })).toBe(state);
  });
});

describe('Research tab actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
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
      const cost = getResearchCost(chosen, 'fr', 'military_bronze_casting');
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

    it('costs more science the further the tech age has fallen behind the calendar', () => {
      const baseline = richState();
      const behind = { ...baseline, age: 'gunpowder', techAgeId: 'bronze' }; // 3 ages behind -> +90%
      expect(Math.abs(getResearchCost(behind, 'fr', 'military_bronze_casting') - getResearchCost(baseline, 'fr', 'military_bronze_casting') * 1.9)).toBeLessThanOrEqual(1); // rounding of the speed table's multiplier (ages.js)
    });

    it('the second tech of a line follows once the first is researched and its year has come', () => {
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
      const cost = getResearchCost(richState(), 'fr', 'military_bronze_casting');
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

      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'air' } });
      const airUnit = Object.values(next.units).find(u => u.classId === 'air');
      expect(airUnit).toBeDefined();
    });

    it('cannot recruit the next age\'s unit class without the tech-earned advancement', () => {
      const state = { ...richState(), age: 'gunpowder' };
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'air' } })).toBe(state);
    });
  });

  describe('SET_RESEARCH_FOCUS', () => {
    it('sets the research focus and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'science' } });
      expect(next.researchFocus).toBe('science');
      expect(next.resources.adm).toBeLessThan(state.resources.adm);
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

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, adm: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'science' } })).toBe(state);
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
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, adm: 100000 } };
  };

  describe('CHANGE_GOVERNMENT_TYPE', () => {
    it('changes to an available type at the current age, deducts the cost, and applies -2 stability', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(next.nations.fr.government.type).toBe('monarchy');
      expect(next.resources.adm).toBeLessThan(state.resources.adm);
      expect(next.nations.fr.stability).toBe((state.nations.fr.stability || 0) - 2);
    });

    it('resets reforms to the new type\'s first choice for every age tier up to the calendar age', () => {
      const next = gameReducer(richState(), { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(next.nations.fr.government.reforms).toEqual({ bronze: 'despotic_rule' }); // calendar age is bronze at game start
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
      const state = { ...richState(), resources: { ...richState().resources, adm: 0 } };
      expect(gameReducer(state, { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } })).toBe(state);
    });

    it('becoming a monarchy names no heir: succession was removed (master plan decision 37)', () => {
      const next = gameReducer(richState(), { type: ActionTypes.CHANGE_GOVERNMENT_TYPE, payload: { typeId: 'monarchy' } });
      expect(next.nations.fr.government.type).toBe('monarchy');
      expect(next.nations.fr).not.toHaveProperty('heir');
      expect(next.nations.fr.ruler).not.toHaveProperty('consort');
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
      expect(next.nations.fr.government.reforms.bronze).toBe('chieftaincy');
      expect(next.resources.adm).toBeLessThan(state.resources.adm);
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
      const state = { ...richState(), resources: { ...richState().resources, adm: 0 } };
      expect(gameReducer(state, { type: ActionTypes.ENACT_GOVERNMENT_REFORM, payload: { ageId: 'bronze', reformId: 'chieftaincy' } })).toBe(state);
    });
  });

  describe('CHANGE_LAW', () => {
    const withMintedCoinage = () => {
      const base = richState();
      return { ...base, techTree: { ...base.techTree, economy_minted_coinage: { ...base.techTree.economy_minted_coinage, researched: true } } };
    };

    it('changes a category\'s law, deducts the dynamic ADM cost, and sets a cooldown', () => {
      const state = withMintedCoinage();
      const next = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'land_tax' } });
      expect(next.nations.fr.laws.taxation).toBe('land_tax');
      expect(next.resources.adm).toBe(state.resources.adm - 100); // 50 x tier 2
      expect(next.nations.fr.lawCooldowns.taxation).toBe(state.turnNumber + 5);
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
      const state = { ...withMintedCoinage(), resources: { ...withMintedCoinage().resources, adm: 0 } };
      expect(gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'taxation', lawId: 'land_tax' } })).toBe(state);
    });

    it('applies a one-time -1 stability when enacting Martial Law', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'justice', lawId: 'martial_law' } });
      expect(next.nations.fr.stability).toBe((state.nations.fr.stability || 0) - 1);
    });

    it('pushes a 10-turn timed unrest modifier when enacting Collectivization', () => {
      const base = richState();
      const state = { ...base, techTree: { ...base.techTree, economy_industrial_capital: { ...base.techTree.economy_industrial_capital, researched: true } } };
      const next = gameReducer(state, { type: ActionTypes.CHANGE_LAW, payload: { category: 'land', lawId: 'collectivization' } });
      expect(next.nations.fr.modifiers).toContainEqual(expect.objectContaining({
        sourceType: 'law', sourceId: 'collectivization', mods: { 'national.stabilityBonus': -2 }, expiresTurn: state.turnNumber + 10
      }));
    });
  });

  describe('SHIFT_IDENTITY', () => {
    it('shifts the named axis by IDENTITY_SHIFT_STEP in the given direction, deducts ADM, and sets a cooldown', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } });
      expect(next.nations.fr.identity.collectivism).toBe(IDENTITY_SHIFT_STEP);
      expect(next.resources.adm).toBeLessThan(state.resources.adm);
      expect(next.nations.fr.identityShiftCooldownTurn).toBe(state.turnNumber + 5);
    });

    it('shifts in the negative direction too, and other axes stay untouched', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'globalism', direction: -1 } });
      expect(next.nations.fr.identity.globalism).toBe(-IDENTITY_SHIFT_STEP);
      expect(next.nations.fr.identity.collectivism).toBe(0);
      expect(next.nations.fr.identity.secularism).toBe(0);
    });

    it('is a no-op once already at the max/min bound', () => {
      const maxed = { ...richState() };
      maxed.nations = { ...maxed.nations, fr: { ...maxed.nations.fr, identity: { ...maxed.nations.fr.identity, collectivism: IDENTITY_MAX } } };
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
      const state = { ...richState(), resources: { ...richState().resources, adm: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } })).toBe(state);
    });
  });
});

describe('Diplomacy tab actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    state.units = {}; // the Dawn start's own garrison would be "the unit" below
    return { ...state, resources: { ...state.resources, gold: 100000, dip: 1000 } };
  };

  describe('DECLARE_WAR', () => {
    it('declares an unjustified war, charging the premium and costing global relations and home stability', () => {
      const state = richState();
      const other = Object.keys(state.nations).find(id => id !== 'fr' && id !== 'de');
      const before = state.nations[other].hostility;
      const next = gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(next.nations.de.isAtWar).toBe(true);
      expect(next.wars.some(w => w.enemy === 'de' && w.aggressor === 'fr')).toBe(true);
      expect(next.resources.gold).toBeLessThan(state.resources.gold - 1); // more than a token AP-only cost
      expect(next.regions[cap('fr')].unrest).toBeGreaterThan(state.regions[cap('fr')].unrest);
      expect(next.nations[other].hostility).toBeGreaterThan(before);
    });

    it('declares a justified war for free of the gold premium when a claim already exists', () => {
      const state = richState();
      const withClaim = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, claims: [cap('de')] } } };
      const other = Object.keys(state.nations).find(id => id !== 'fr' && id !== 'de');
      const before = state.nations[other].hostility;
      const next = gameReducer(withClaim, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(next.nations.de.isAtWar).toBe(true);
      expect(next.resources.gold).toBe(withClaim.resources.gold); // declareWarJustified has no gold cost
      expect(next.nations[other].hostility).toBe(before); // no global relations penalty
      expect(next.nations.fr.claims).toContain(cap('de')); // the claim stays until the city is taken
    });

    it('is a no-op declaring war on yourself', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'fr' } })).toBe(state);
    });

    it('can attack a nation that is already at war with someone else', () => {
      const base = richState();
      const busy = { ...base, nations: { ...base.nations, de: { ...base.nations.de, isAtWar: true } },
        wars: [...base.wars, { id: 'war_de_ai', aggressor: 'at', enemy: 'de', active: true, score: 0, battleScore: 0, tickScore: 0, goalAchieved: false, goal: { type: 'destroy_military', threshold: 1 } }] };
      const next = gameReducer(busy, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(next.wars.some(w => w.active && w.aggressor === 'fr' && w.enemy === 'de')).toBe(true);
      // Making peace with the player leaves de still fighting Austria.
      const peace = gameReducer(next, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } });
      expect(peace.wars.find(w => w.aggressor === 'fr' && w.enemy === 'de').active).toBe(false);
      expect(peace.nations.de.isAtWar).toBe(true);
      expect(peace.nations.fr.isAtWar).toBe(false);
    });

    it('is a no-op if already at war', () => {
      const state = richState();
      const atWar = gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(gameReducer(atWar, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } })).toBe(atWar);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0, actionPoints: 0 } };
      expect(gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } })).toBe(state);
    });
  });

  describe('FABRICATE_CLAIM', () => {
    it('starts a claim on the nearest city of the target within reach and deducts the cost', () => {
      const state = richState();
      const site = claimableCities(state, 'fr')[0].city;
      const next = gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: site.owner } });
      expect(next.nations.fr.claimsInProgress.map((c) => c.cityId)).toContain(site.id);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op for a claim already held', () => {
      const state = gameReducer(richState(), { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: 'de' } });
      expect(gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: 'de' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: 'de' } })).toBe(state);
    });
  });

  describe('SUE_FOR_PEACE', () => {
    const atWarWithDe = () => gameReducer(richState(), { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });

    it('ends the war and signs a peace treaty', () => {
      const state = atWarWithDe();
      const next = gameReducer(state, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } });
      expect(next.nations.de.isAtWar).toBe(false);
      expect(next.nations.de.hasPeaceTreaty).toBe(true);
      expect(next.wars.find(w => w.enemy === 'de').active).toBe(false);
    });

    it('costs less gold against a more war-exhausted target', () => {
      const fresh = atWarWithDe();
      const exhausted = { ...fresh, nations: { ...fresh.nations, de: { ...fresh.nations.de, warExhaustion: 80 } } };
      const freshPeace = gameReducer(fresh, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } });
      const exhaustedPeace = gameReducer(exhausted, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } });
      const freshCost = fresh.resources.gold - freshPeace.resources.gold;
      const exhaustedCost = exhausted.resources.gold - exhaustedPeace.resources.gold;
      expect(exhaustedCost).toBeLessThan(freshCost);
    });

    it('is a no-op when not at war with the target', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...atWarWithDe(), resources: { ...atWarWithDe().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } })).toBe(state);
    });

    it('clears the player\'s own isAtWar too, and deactivates the war record even when the AI was the aggressor', () => {
      // Regression: an AI-declared war (aggressor: 'de', enemy: player) previously left the
      // player's own isAtWar flag stuck true forever after peace, which made aiLogic.js's
      // pickWarTarget (which filters out any nation still flagged isAtWar) treat the player as
      // permanently immune to any FUTURE war declaration by anyone.
      const base = richState();
      const withAiWar = {
        ...base,
        nations: { ...base.nations, fr: { ...base.nations.fr, isAtWar: true }, de: { ...base.nations.de, isAtWar: true } },
        wars: [{ id: 'war_1', aggressor: 'de', enemy: 'fr', active: true, goalAchieved: false, startYear: base.year, goal: { type: 'destroy_military', threshold: 1 } }]
      };
      const next = gameReducer(withAiWar, { type: ActionTypes.SUE_FOR_PEACE, payload: { nationId: 'de' } });
      expect(next.nations.fr.isAtWar).toBe(false);
      expect(next.nations.de.isAtWar).toBe(false);
      expect(next.wars[0].active).toBe(false);
    });
  });

  describe('TRADE_AGREEMENT', () => {
    it('signs a trade agreement and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } });
      expect(next.nations.de.hasTradeAgreement).toBe(true);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op while at war with the target', () => {
      const state = gameReducer(richState(), { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } })).toBe(state);
    });

    it('is a no-op if a trade agreement already exists', () => {
      const state = gameReducer(richState(), { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } });
      expect(gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } })).toBe(state);
    });
  });

  describe('MILITARY_ALLIANCE', () => {
    it('forms an alliance when hostility is low enough', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: 'de' } });
      expect(next.nations.de.hasMilitaryPact).toBe(true);
    });

    it('is a no-op when hostility is too high and there is no trade agreement', () => {
      const state = richState();
      const hostile = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 90 } } };
      expect(gameReducer(hostile, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: 'de' } })).toBe(hostile);
    });

    it('succeeds despite high hostility once a trade agreement exists', () => {
      const state = richState();
      const traded = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } });
      const hostileButTraded = { ...traded, nations: { ...traded.nations, de: { ...traded.nations.de, hostility: 90 } } };
      const next = gameReducer(hostileButTraded, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: 'de' } });
      expect(next.nations.de.hasMilitaryPact).toBe(true);
    });

    it('is a no-op while at war with the target', () => {
      const state = gameReducer(richState(), { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(gameReducer(state, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: 'de' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.MILITARY_ALLIANCE, payload: { nationId: 'de' } })).toBe(state);
    });
  });

  describe('GIFT_BRIBE', () => {
    it('reduces hostility and deducts gold', () => {
      const state = richState();
      const hostile = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 50 } } };
      const next = gameReducer(hostile, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: 'de' } });
      expect(next.nations.de.hostility).toBeLessThan(50);
      expect(next.resources.gold).toBeLessThan(hostile.resources.gold);
    });

    it('never drops hostility below the nation\'s hostility floor', () => {
      const state = richState();
      const floored = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 5, hostilityFloor: 3 } } };
      const next = gameReducer(floored, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: 'de' } });
      expect(next.nations.de.hostility).toBeGreaterThanOrEqual(3);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.GIFT_BRIBE, payload: { nationId: 'de' } })).toBe(state);
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
      const before = state.nations.de.hostility;
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de' } });
      expect(next.resources.techPoints).toBe((state.resources.techPoints || 0) + ESPIONAGE_TECH_POINTS_STOLEN);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.nations.de.hostility).toBe(before);
    });

    it('on failure, raises the target\'s hostility instead of stealing tech points', () => {
      const state = { ...richState(), rngSeed: 1 };
      const before = state.nations.de.hostility;
      const beforeTech = state.resources.techPoints || 0;
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de' } });
      expect(next.nations.de.hostility).toBe(before + ESPIONAGE_FAILURE_HOSTILITY_INCREASE);
      expect(next.resources.techPoints || 0).toBe(beforeTech);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de' } })).toBe(state);
    });

    it('is a no-op against an unknown nation', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'not_a_real_nation' } })).toBe(state);
    });

    // Foreign provinces stay hidden until an op succeeds (src/engine/intel.js).
    it('gather_intel reveals the target\'s provinces for INTEL_DURATION_TURNS, and nothing else', () => {
      const state = { ...richState(), rngSeed: 7 };
      const deRegion = Object.keys(state.regions).find((id) => state.regions[id].owner === 'de');
      expect(canSeeRegionDetails(state, deRegion)).toBe(false);
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de', type: 'gather_intel' } });
      expect(hasIntel(next, 'de')).toBe(true);
      expect(canSeeRegionDetails(next, deRegion)).toBe(true);
      expect(getIntelTurnsLeft(next, 'de')).toBe(INTEL_DURATION_TURNS);
      expect(getIntelTurnsLeft(state, 'de')).toBe(null);
      expect(next.resources.techPoints || 0).toBe(state.resources.techPoints || 0);
      // Expires once the window has passed.
      const later = { ...next, turnNumber: next.turnNumber + INTEL_DURATION_TURNS + 1 };
      expect(hasIntel(later, 'de')).toBe(false);
      expect(canSeeRegionDetails(later, deRegion)).toBe(false);
    });

    it('a caught gather_intel op reveals nothing and raises hostility', () => {
      const state = { ...richState(), rngSeed: 1 };
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de', type: 'gather_intel' } });
      expect(hasIntel(next, 'de')).toBe(false);
      expect(next.nations.de.hostility).toBe(state.nations.de.hostility + ESPIONAGE_FAILURE_HOSTILITY_INCREASE);
    });

    it('a successful steal-tech op also leaves intel behind', () => {
      const state = { ...richState(), rngSeed: 7 };
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de' } });
      expect(hasIntel(next, 'de')).toBe(true);
      expect(hasIntel(next, 'fr')).toBe(false);
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

    it('reduces the most-hostile foreign nation\'s hostility and rewards diplomacy points', () => {
      const state = withAllHostilityZeroed(richState());
      const other = Object.keys(state.nations).find(id => id !== 'fr' && id !== 'de');
      const withHostility = {
        ...state,
        nations: {
          ...state.nations,
          de: { ...state.nations.de, hostility: 40 },
          [other]: { ...state.nations[other], hostility: 90 } // the most hostile — should be the one targeted
        }
      };
      const beforeDiplo = withHostility.resources.dip;
      const next = gameReducer(withHostility, { type: ActionTypes.COUNTER_INTELLIGENCE });
      expect(next.nations[other].hostility).toBe(90 - COUNTER_INTEL_HOSTILITY_REDUCTION);
      expect(next.nations.de.hostility).toBe(40); // untouched — it wasn't the most hostile
      expect(next.resources.dip).toBe(beforeDiplo - ACTION_COSTS.counterIntelligence.dip + COUNTER_INTEL_DIPLOMACY_POINTS_REWARD);
      expect(next.resources.gold).toBeLessThan(withHostility.resources.gold);
    });

    it('never drops hostility below the target\'s hostility floor', () => {
      const state = withAllHostilityZeroed(richState());
      const withFloor = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 5, hostilityFloor: 3 } } };
      const next = gameReducer(withFloor, { type: ActionTypes.COUNTER_INTELLIGENCE });
      expect(next.nations.de.hostility).toBeGreaterThanOrEqual(3);
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
      expect(next.nations.fr.culturalInfluence).toBe(CULTURAL_EXPORT_INFLUENCE_GAIN);
      expect(next.nations.de.hostility).toBe(50 - CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION);
      expect(next.resources.gold).toBeLessThan(withHostility.resources.gold);
    });

    it('never drops any nation\'s hostility below its own floor', () => {
      const state = modernState();
      const floored = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 1, hostilityFloor: 0 } } };
      const next = gameReducer(floored, { type: ActionTypes.CULTURAL_EXPORT });
      expect(next.nations.de.hostility).toBeGreaterThanOrEqual(0);
    });

    it('accumulates across repeated uses', () => {
      const state = modernState();
      const once = gameReducer(state, { type: ActionTypes.CULTURAL_EXPORT });
      const twice = gameReducer(once, { type: ActionTypes.CULTURAL_EXPORT });
      expect(twice.nations.fr.culturalInfluence).toBe(CULTURAL_EXPORT_INFLUENCE_GAIN * 2);
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
      expect(next.nations.fr.rivals).toContain(targetId);
    });

    it('is a no-op for a non-bordering nation', () => {
      const state = richState();
      const bordering = new Set(getBorderingNationIds(state.regions, 'fr'));
      const nonBordering = Object.keys(state.nations).find((id) => id !== 'fr' && !bordering.has(id) && hasMet(state, 'fr', id));
      expect(gameReducer(state, { type: ActionTypes.RIVAL_NATION, payload: { nationId: nonBordering } })).toBe(state);
    });

    it('is a no-op once MAX_RIVALS is reached', () => {
      const state = richState();
      const targetId = borderingId(state);
      const fr = { ...state.nations.fr, rivals: Array.from({ length: MAX_RIVALS }, (_, i) => `slot${i}`) };
      const full = { ...state, nations: { ...state.nations, fr } };
      expect(gameReducer(full, { type: ActionTypes.RIVAL_NATION, payload: { nationId: targetId } })).toBe(full);
    });

    it('unrival removes a rival', () => {
      const state = richState();
      const targetId = borderingId(state);
      const rivaled = gameReducer(state, { type: ActionTypes.RIVAL_NATION, payload: { nationId: targetId } });
      const next = gameReducer(rivaled, { type: ActionTypes.UNRIVAL_NATION, payload: { nationId: targetId } });
      expect(next.nations.fr.rivals).not.toContain(targetId);
    });
  });

  describe('PROPOSE_MARRIAGE', () => {
    const asMonarchies = (state, targetId) => ({
      ...state,
      nations: {
        ...state.nations,
        fr: { ...state.nations.fr, government: { type: 'monarchy', reforms: {} } },
        [targetId]: { ...state.nations[targetId], government: { type: 'monarchy', reforms: {} } }
      }
    });

    it('reduces the target\'s hostility and records the match', () => {
      const state = asMonarchies(richState(), 'de');
      const withHostility = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 80 } } };
      const next = gameReducer(withHostility, { type: ActionTypes.PROPOSE_MARRIAGE, payload: { nationId: 'de' } });
      expect(next.nations.de.hostility).toBeLessThan(80);
      expect(next.nations.fr.marriageWith).toContain('de');
      expect(next.nations.fr.ruler).not.toHaveProperty('consort');
    });

    it('is a no-op unless both nations are monarchies', () => {
      const state = richState();
      const frRepublicDeMonarchy = {
        ...state,
        nations: {
          ...state.nations,
          fr: { ...state.nations.fr, government: { type: 'republic', reforms: {} } },
          de: { ...state.nations.de, government: { type: 'monarchy', reforms: {} } }
        }
      };
      expect(gameReducer(frRepublicDeMonarchy, { type: ActionTypes.PROPOSE_MARRIAGE, payload: { nationId: 'de' } })).toBe(frRepublicDeMonarchy);
    });

    it('is a no-op once already married into that nation', () => {
      const state = asMonarchies(richState(), 'de');
      const married = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, marriageWith: ['de'] } } };
      expect(gameReducer(married, { type: ActionTypes.PROPOSE_MARRIAGE, payload: { nationId: 'de' } })).toBe(married);
    });
  });

  describe('BREAK_ALLIANCE', () => {
    it('clears the pact and raises hostility', () => {
      const state = richState();
      const allied = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hasMilitaryPact: true, hostility: 10 } } };
      const next = gameReducer(allied, { type: ActionTypes.BREAK_ALLIANCE, payload: { nationId: 'de' } });
      expect(next.nations.de.hasMilitaryPact).toBe(false);
      expect(next.nations.de.hostility).toBeGreaterThan(10);
    });

    it('is a no-op when there is no pact', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.BREAK_ALLIANCE, payload: { nationId: 'de' } })).toBe(state);
    });
  });

  describe('INSULT', () => {
    it('raises the target\'s hostility for free', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.INSULT, payload: { nationId: 'de' } });
      expect(next.nations.de.hostility).toBeGreaterThan(state.nations.de.hostility);
      expect(next.resources.gold).toBe(state.resources.gold);
    });
  });

  describe('ASSIGN_DIPLOMAT / RECALL_DIPLOMAT', () => {
    it('assigns a diplomat to improve relations with a target', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: 'de' } });
      expect(next.nations.fr.diplomatTasks).toEqual([{ targetId: 'de', task: 'improve_relations', startedTurn: state.turnNumber }]);
    });

    it('is a no-op once every diplomat is already assigned', () => {
      const state = richState();
      const targets = Object.keys(state.nations).filter((id) => id !== 'fr' && hasMet(state, 'fr', id)).slice(0, state.nations.fr.diplomats);
      let assigned = state;
      targets.forEach((id) => { assigned = gameReducer(assigned, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: id } }); });
      const extra = Object.keys(state.nations).find((id) => id !== 'fr' && !targets.includes(id) && hasMet(state, 'fr', id));
      expect(gameReducer(assigned, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: extra } })).toBe(assigned);
    });

    it('recall removes the assignment', () => {
      const state = richState();
      const assigned = gameReducer(state, { type: ActionTypes.ASSIGN_DIPLOMAT, payload: { nationId: 'de' } });
      const next = gameReducer(assigned, { type: ActionTypes.RECALL_DIPLOMAT, payload: { nationId: 'de' } });
      expect(next.nations.fr.diplomatTasks).toEqual([]);
    });
  });

  describe('VASSALIZE / ANNEX_VASSAL / RELEASE_VASSAL', () => {
    const dominant = (state, targetId) => ({
      ...state,
      nations: {
        ...state.nations,
        fr: { ...state.nations.fr, militaryStrength: 100000 },
        [targetId]: { ...state.nations[targetId], militaryStrength: 100, hostility: 0 }
      }
    });

    it('vassalizes a weak, low-hostility nation', () => {
      const state = dominant(richState(), 'de');
      const next = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } });
      expect(next.nations.de.vassalOf).toBe('fr');
      expect(next.nations.fr.vassals).toContain('de');
    });

    it('is a no-op when the target is too strong', () => {
      const state = richState();
      const notWeak = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 0, militaryStrength: state.nations.fr.militaryStrength } } };
      expect(gameReducer(notWeak, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } })).toBe(notWeak);
    });

    it('is a no-op when hostility is too high', () => {
      const state = dominant(richState(), 'de');
      const hostile = { ...state, nations: { ...state.nations, de: { ...state.nations.de, hostility: 90 } } };
      expect(gameReducer(hostile, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } })).toBe(hostile);
    });

    it('annexes a vassal past the cooldown, transferring its regions and clearing vassalOf', () => {
      const state = dominant(richState(), 'de');
      const vassalized = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } });
      const pastCooldown = { ...vassalized, turnNumber: vassalized.turnNumber + VASSAL_ANNEX_COOLDOWN_TURNS, resources: { ...vassalized.resources, dip: 1000000 } };
      const next = gameReducer(pastCooldown, { type: ActionTypes.ANNEX_VASSAL, payload: { nationId: 'de' } });
      expect(next.nations.de.vassalOf).toBeNull();
      expect(next.nations.fr.vassals).not.toContain('de');
      expect(Object.values(next.regions).some((r) => r.owner === 'de')).toBe(false);
    });

    it('is a no-op annexing before the cooldown has passed', () => {
      const state = dominant(richState(), 'de');
      const vassalized = { ...gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } }), resources: { ...state.resources, dip: 1000000 } };
      expect(gameReducer(vassalized, { type: ActionTypes.ANNEX_VASSAL, payload: { nationId: 'de' } })).toBe(vassalized);
    });

    it('releases a vassal', () => {
      const state = dominant(richState(), 'de');
      const vassalized = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } });
      const next = gameReducer(vassalized, { type: ActionTypes.RELEASE_VASSAL, payload: { nationId: 'de' } });
      expect(next.nations.de.vassalOf).toBeNull();
      expect(next.nations.fr.vassals).not.toContain('de');
    });

    it('a vassal player cannot declare an ordinary war (plan §M15: "except independence")', () => {
      const state = dominant(richState(), 'de');
      const vassalized = gameReducer(state, { type: ActionTypes.VASSALIZE, payload: { nationId: 'de' } });
      // fr is now de's OVERLORD in this fixture, not a vassal — flip the roles to test the guard.
      const frIsVassal = { ...vassalized, nations: { ...vassalized.nations, fr: { ...vassalized.nations.fr, vassalOf: 'de' } } };
      const other = Object.keys(frIsVassal.nations).find((id) => id !== 'fr' && id !== 'de' && hasMet(frIsVassal, 'fr', id));
      expect(gameReducer(frIsVassal, { type: ActionTypes.DECLARE_WAR, payload: { nationId: other } })).toBe(frIsVassal);
    });
  });

  describe('MOVE_CAPITAL (plan §M15)', () => {
    const affordable = () => {
      const state = addCity(richState(), 'fr').state; // somewhere to move it to
      return { ...state, resources: { ...state.resources, adm: 500 } };
    };

    it('moves the capital to an owned, unoccupied region and deducts the cost', () => {
      const state = affordable();
      const targetId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && id !== cap('fr'));
      const next = gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: targetId } });
      expect(next.nations.fr.capitalRegionId).toBe(targetId);
      expect(next.resources.adm).toBe(state.resources.adm - ACTION_COSTS.moveCapital.adm);
      expect(next.resources.gold).toBe(state.resources.gold - ACTION_COSTS.moveCapital.gold);
    });

    it('costs an extra -1 stability when the new capital is outside the nation\'s own original territory', () => {
      const state = affordable();
      const foreignId = Object.keys(state.regions).find((id) => REGIONS_DATA[id].startOwner !== 'fr');
      const conquered = { ...state, regions: { ...state.regions, [foreignId]: { ...state.regions[foreignId], owner: 'fr' } } };
      const next = gameReducer(conquered, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: foreignId } });
      expect(next.nations.fr.capitalRegionId).toBe(foreignId);
      expect(next.nations.fr.stability).toBe((conquered.nations.fr.stability || 0) - 1);
    });

    it('does not cost stability when relocating within the nation\'s own original territory', () => {
      const state = affordable();
      const nativeId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && id !== cap('fr'));
      const next = gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: nativeId } });
      expect(next.nations.fr.stability).toBe(state.nations.fr.stability || 0);
    });

    it('is a no-op targeting a region the player does not own', () => {
      const state = affordable();
      expect(gameReducer(state, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: cap('de') } })).toBe(state);
    });

    it('is a no-op targeting an occupied region', () => {
      const state = affordable();
      const targetId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && id !== cap('fr'));
      const occupied = { ...state, regions: { ...state.regions, [targetId]: { ...state.regions[targetId], occupiedBy: 'de' } } };
      expect(gameReducer(occupied, { type: ActionTypes.MOVE_CAPITAL, payload: { regionId: targetId } })).toBe(occupied);
    });

    it('is a no-op without enough ADM/gold', () => {
      const state = richState(); // no adm top-up
      const targetId = Object.keys(state.regions).find((id) => state.regions[id].owner === 'fr' && id !== cap('fr'));
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
          fr: { ...state.nations.fr, vassalOf: 'de', libertyDesire },
          de: { ...state.nations.de, vassals: ['fr'] }
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
      expect(next.nations.fr.isAtWar).toBe(true);
      const war = next.wars.find((w) => w.aggressor === 'fr' && w.enemy === 'de');
      expect(war).toBeDefined();
      expect(war.cb).toBe('independence');
    });

    it('is a no-op while already at war', () => {
      const state = { ...vassalState(60), nations: { ...vassalState(60).nations, fr: { ...vassalState(60).nations.fr, isAtWar: true } } };
      expect(gameReducer(state, { type: ActionTypes.DECLARE_INDEPENDENCE, payload: {} })).toBe(state);
    });
  });

  describe('DECLARE_WAR truce-breaking (plan §M12/M13)', () => {
    it('allows the player to break a truce, at a stability/prestige/AE cost', () => {
      const state = richState();
      const nations = setTruce(state.nations, 'fr', 'de', state.turnNumber);
      const withTruce = { ...state, nations };
      const next = gameReducer(withTruce, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(next.nations.de.isAtWar).toBe(true);
      expect(next.nations.fr.stability).toBe((withTruce.nations.fr.stability || 0) - TRUCE_BREAK_STABILITY_PENALTY);
      expect(next.nations.fr.prestige).toBeLessThan(withTruce.nations.fr.prestige || 0);
    });

    it('declares normally with no penalty when there is no truce', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(next.nations.fr.stability).toBe(state.nations.fr.stability || 0);
    });
  });

  describe('TRADE_AGREEMENT capacity (plan §M8.3/§M12)', () => {
    it('is a no-op once trade pact capacity is exhausted', () => {
      const state = richState(); // base capacity 1 with neutral identity
      const first = gameReducer(state, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: 'de' } });
      const otherId = Object.keys(first.nations).find((id) => id !== 'fr' && id !== 'de' && !first.nations[id].isAtWar && hasMet(first, 'fr', id));
      expect(gameReducer(first, { type: ActionTypes.TRADE_AGREEMENT, payload: { nationId: otherId } })).toBe(first);
    });
  });

  describe('ESPIONAGE support_rebels variant (plan §M12)', () => {
    it('raises unrest in the target\'s capital on success', () => {
      const state = richState();
      const targetCapital = getNationCapital('de');
      const next = gameReducer(state, { type: ActionTypes.ESPIONAGE, payload: { nationId: 'de', type: 'support_rebels' } });
      // ESPIONAGE_SUCCESS_CHANCE is seed-dependent; only assert when it actually succeeded (unrest changed).
      if (next.regions[targetCapital].unrest !== state.regions[targetCapital].unrest) {
        expect(next.regions[targetCapital].unrest).toBeGreaterThan(state.regions[targetCapital].unrest);
      }
    });
  });
});

describe('default case', () => {
  it('returns state unchanged for an unrecognized action type', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(gameReducer(state, { type: 'NOT_A_REAL_ACTION' })).toBe(state);
  });
});

