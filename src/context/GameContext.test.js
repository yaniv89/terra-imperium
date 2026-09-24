import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './GameContext';
import { ActionTypes, GameStatus, LogTypes } from '../data/types';
import { XP_THRESHOLDS } from '../data/promotions';
import { TECH_TREE } from '../data/techTree';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { MAX_ORBITAL_DEBRIS } from '../data/satellites';
import { MAX_ABM_LEVEL } from '../data/missiles';
import { getNationCapital, REGIONS_DATA } from '../data/regions';
import { ESPIONAGE_TECH_POINTS_STOLEN, ESPIONAGE_FAILURE_HOSTILITY_INCREASE, COUNTER_INTEL_HOSTILITY_REDUCTION, COUNTER_INTEL_DIPLOMACY_POINTS_REWARD, ACTION_COSTS } from '../data/actionCosts';
import { IDENTITY_SHIFT_STEP, IDENTITY_MAX } from '../data/identity';
import { CLIMATE_RESILIENCE_MAX, CULTURAL_EXPORT_INFLUENCE_GAIN, CULTURAL_EXPORT_GLOBAL_HOSTILITY_REDUCTION } from '../data/actionCosts';

// A nation now spans many real provinces, not one region matching its own id — these tests use
// each nation's capital as "its" region wherever the old one-region-per-nation model used the
// nation id directly as a region id.
const cap = getNationCapital;

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
      // France's capital: 1 base + 1 for being the capital = 2 slots at 0 extra dev.
      let state = richState();
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
    const BE_BORDER = 'be-vwv';
    const withCollapsedNeighbor = (control) => {
      const base = richState();
      return { ...base, regions: { ...base.regions, [BE_BORDER]: { ...base.regions[BE_BORDER], control } } };
    };

    it('absorbs a bordering nation whose control has collapsed, and deducts the cost', () => {
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
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap('be') } })).toBe(state);
    });

    it('is a no-op on a region that does not border the player', () => {
      // 'us' does not border 'fr'.
      const base = richState();
      const state = { ...base, regions: { ...base.regions, [cap('us')]: { ...base.regions[cap('us')], control: 5 } } };
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap('us') } })).toBe(state);
    });

    it('is a no-op on a region the player already owns', () => {
      const state = withCollapsedNeighbor(10);
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap('fr') } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const base = withCollapsedNeighbor(10);
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: cap('be') } })).toBe(state);
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
  });

  describe('CONSTRUCT_WONDER', () => {
    it('completes a wonder available at the current age, deducts the cost, and claims it globally', () => {
      const state = richState(); // starts in the Bronze Age -> pyramids is buildable
      const next = gameReducer(state, { type: ActionTypes.CONSTRUCT_WONDER, payload: { wonderId: 'pyramids' } });
      expect(next.wondersBuilt.pyramids).toBe('fr');
      expect(next.nations.fr.wonders).toContain('pyramids');
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('grants prestige on completion (plan §M4: great projects\' own prestige source, M10, isn\'t built yet)', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CONSTRUCT_WONDER, payload: { wonderId: 'pyramids' } });
      expect(next.nations.fr.prestige).toBeGreaterThan(state.nations.fr.prestige || 0);
    });

    it('is a no-op for a wonder two or more ages ahead of the current age', () => {
      const state = richState(); // Bronze Age -> grandBazaar (Kingdoms) is two ages ahead
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_WONDER, payload: { wonderId: 'grandBazaar' } })).toBe(state);
    });

    it('is a no-op once the wonder is already claimed by any nation', () => {
      const state = { ...richState(), wondersBuilt: { pyramids: 'de' } };
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_WONDER, payload: { wonderId: 'pyramids' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const fresh = createInitialState({ playerNationId: 'fr' });
      const base = { ...fresh, resources: { ...fresh.resources, gold: 0 } };
      expect(gameReducer(base, { type: ActionTypes.CONSTRUCT_WONDER, payload: { wonderId: 'pyramids' } })).toBe(base);
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
      expect(gameReducer(state, { type: ActionTypes.BUILD_MISSILE, payload: { tierId: 'tactical' } })).toBe(state);
    });
  });

  describe('MISSILE_STRIKE', () => {
    // de-rp (Rhineland-Palatinate) really borders fr-57 (Moselle) — 1 hop from France's owned
    // territory, well inside tactical range (3). 'us' cap is ~30 real land hops from France (no
    // actual land route at all, in truth — Europe/Americas aren't land-connected in this data),
    // making it a genuine out-of-range target for any finite-range tier.
    const DE_REGION = 'de-rp';
    const withMissile = (tierId, count = 1) => {
      const base = spaceState();
      return { ...base, nations: { ...base.nations, fr: { ...base.nations.fr, missiles: { ...base.nations.fr.missiles, [tierId]: count } } } };
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
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } })).toBe(state);
    });

    it('is a no-op against the player\'s own region', () => {
      const state = withMissile('tactical');
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: cap('fr') } })).toBe(state);
    });

    it('is a no-op when the target is out of the tier\'s range', () => {
      const state = withMissile('tactical');
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: cap('us') } })).toBe(state);
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

    it('is a no-op when unaffordable (the flat action-point cost)', () => {
      const base = withMissile('tactical');
      const state = { ...base, resources: { ...base.resources, mil: 0 } };
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: DE_REGION } })).toBe(state);
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
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
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
  const FR_BORDER = 'fr-59';
  const BE_REGION = 'be-vwv';

  describe('MOVE_ARMY', () => {
    // A French-owned neighbor of FR_BORDER (fr-62, Pas-de-Calais) — MOVE_ARMY is redeployment
    // within your own territory, not an invasion, so a genuinely successful move has to land in a
    // region the player already owns; BE_REGION (foreign, Belgium) is used below specifically to
    // confirm that's rejected, not as a valid destination.
    const FR_NEIGHBOR = 'fr-62';
    const withUnit = () => {
      const state = richState();
      return gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'infantry' } });
    };

    it('moves the unit to an adjacent, player-owned region and deducts the action point cost', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: FR_NEIGHBOR } });
      expect(next.units[unitId].regionId).toBe(FR_NEIGHBOR);
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
    const withAttacker = (strength) => {
      const state = richState();
      const recruited = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'infantry' } });
      if (strength === undefined) return recruited;
      const unitId = Object.keys(recruited.units)[0];
      return { ...recruited, units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], strength } } };
    };

    it('captures an undefended adjacent region and moves surviving units into it', () => {
      const state = withAttacker();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(next.regions[BE_REGION].owner).toBe('fr');
      expect(next.units[unitId].regionId).toBe(BE_REGION);
      expect(next.resources.mil).toBeLessThan(state.resources.mil);
      expect(next.lastBattleReport.outcome).toBe('attacker');
      // Conquered territory (plan §9 revolt system): records who it was taken from, so an
      // unresolved rebellion there can later revert it rather than fighting the same army forever.
      expect(next.regions[BE_REGION].formerOwner).toBe('be');
    });

    it('does not mark a nation reclaiming its own native region as conquered territory', () => {
      // be-vwv (Hainaut) really borders nl-ze (Zeeland) — worldRegions.json — so this uses that
      // real pair directly rather than each nation's (capital-heuristic) "capital" region, since
      // build-world-regions.mjs's smallest-area capital pick lands on a tiny detached island
      // territory for some nations (e.g. Saba for the Netherlands), which isn't adjacent to
      // anything useful here.
      const BE_REGION = 'be-vwv';
      const NL_REGION = 'nl-ze';
      const base = richState('be');
      const recruited = gameReducer(base, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: BE_REGION, classId: 'infantry' } });
      const unitId = Object.keys(recruited.units)[0];
      const state = {
        ...recruited,
        units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], regionId: NL_REGION } },
        regions: {
          ...recruited.regions,
          [BE_REGION]: { ...recruited.regions[BE_REGION], owner: 'fr' },
          [NL_REGION]: { ...recruited.regions[NL_REGION], owner: 'be' }
        }
      };
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: NL_REGION, targetRegionId: BE_REGION } });
      expect(next.regions[BE_REGION].owner).toBe('be');
      expect(next.regions[BE_REGION].formerOwner).toBeUndefined();
    });

    it('is repelled by a strong defender, leaving the region unconquered', () => {
      const state = withAttacker(100); // a token attacking force
      const defenderUnit = {
        id: 'def_x', regionId: BE_REGION, ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
        strength: 50000, maxStrength: 50000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...state, units: { ...state.units, def_x: defenderUnit } };
      const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
      expect(next.regions[BE_REGION].owner).toBe('be');
      expect(next.lastBattleReport.outcome).toBe('defender');
    });

    it('deals less attacker damage per hit the further the player\'s tech age has fallen behind the calendar (src/data/ages.js\'s getAgesBehindCombatMultiplier)', () => {
      const baseline = withAttacker(2000);
      const attackerId = Object.keys(baseline.units)[0];
      const defenderUnit = {
        id: 'def_gap', regionId: BE_REGION, ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
        strength: 20000, maxStrength: 20000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...baseline, units: { ...baseline.units, def_gap: defenderUnit } };
      // Same rngSeed on both, so the only difference driving the outcome is the tech gap itself.
      const behind = { ...withDefender, age: 'modern', techAgeId: 'bronze' }; // 4 ages behind -> floored 40% output
      const caughtUp = { ...withDefender, age: 'modern', techAgeId: 'modern' }; // 0 ages behind -> full output

      const attackerDamage = (result) => result.lastBattleReport.log.find(l => l.attackerId === attackerId).damage;
      const behindDamage = attackerDamage(gameReducer(behind, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }));
      const caughtUpDamage = attackerDamage(gameReducer(caughtUp, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } }));
      expect(behindDamage).toBeLessThan(caughtUpDamage);
    });

    describe('siege (src/engine/siege.js): a defended region no longer falls in one hit', () => {
      it('grinds down a defended region\'s control without capturing it in a single round', () => {
        const state = withAttacker(50000); // overwhelming, guarantees an 'attacker' round outcome
        const attackerId = Object.keys(state.units)[0];
        const defenderUnit = {
          id: 'def_weak', regionId: BE_REGION, ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        const withDefender = { ...state, units: { ...state.units, def_weak: defenderUnit } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        expect(next.regions[BE_REGION].owner).toBe('be'); // still not captured
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
          id: 'def_weak', regionId: BE_REGION, ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 2000, maxStrength: 2000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        // Already weakened by a prior round (or unrest) down to 40 — one more 30-point hit crosses
        // the 15 threshold.
        const withDefender = { ...state, units: { ...state.units, def_weak: defenderUnit }, regions: { ...state.regions, [BE_REGION]: { ...state.regions[BE_REGION], control: 40 } } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        expect(next.regions[BE_REGION].owner).toBe('fr');
        expect(next.regions[BE_REGION].control).toBe(25); // the usual post-capture reset
        expect(next.regions[BE_REGION].underInvasion).toBe(false);
        expect(next.lastBattleReport.captured).toBe(true);
      });

      it('clamps at the threshold without capturing when the attacker has no melee unit deployed', () => {
        const state = richState();
        const recruitedRanged = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: FR_BORDER, classId: 'ranged' } });
        const rangedId = Object.keys(recruitedRanged.units)[0];
        const strongRanged = { ...recruitedRanged, units: { ...recruitedRanged.units, [rangedId]: { ...recruitedRanged.units[rangedId], strength: 50000 } } };
        const defenderUnit = {
          id: 'def_weak', regionId: BE_REGION, ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
          strength: 100, maxStrength: 100, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
        };
        const withDefender = { ...strongRanged, units: { ...strongRanged.units, def_weak: defenderUnit }, regions: { ...strongRanged.regions, [BE_REGION]: { ...strongRanged.regions[BE_REGION], control: 40 } } };
        const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
        expect(next.lastBattleReport.outcome).toBe('attacker'); // ranged fire alone broke the weak garrison
        expect(next.regions[BE_REGION].owner).toBe('be'); // but nothing to occupy it with
        expect(next.regions[BE_REGION].control).toBe(15); // clamped at the threshold, not lower
        expect(next.lastBattleReport.captured).toBe(false);
      });

      it('defenseLevel measurably reduces incoming damage (a "Walls" bonus, src/engine/siege.js)', () => {
        const baseline = withAttacker(2000);
        const attackerId = Object.keys(baseline.units)[0];
        const defenderUnit = {
          id: 'def_gap', regionId: BE_REGION, ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
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
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: otherId, targetRegionId: BE_REGION } })).toBe(state);
    });

    it('is a no-op against a region the player already owns', () => {
      const state = withAttacker();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: FR_BORDER } })).toBe(state);
    });

    it('is a no-op against a non-adjacent region', () => {
      const state = withAttacker();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: cap('jp') } })).toBe(state);
    });

    it('is a no-op when there are no attacker units in the source region', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...withAttacker(), resources: { ...withAttacker().resources, mil: 0 } };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } })).toBe(state);
    });
  });
});

describe('Promotions and generals actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
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
      expect(gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } })).toBe(state);
    });

    it('is a no-op for an unknown perk id', () => {
      const state = withUnit(XP_THRESHOLDS.regular);
      const unitId = Object.keys(state.units)[0];
      expect(gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'not_a_perk' } })).toBe(state);
    });

    it('is a no-op for a perk the unit already holds', () => {
      const state = withUnit(XP_THRESHOLDS.veteran);
      const unitId = Object.keys(state.units)[0];
      const withPerk = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], promotions: ['shock'] } } };
      expect(gameReducer(withPerk, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } })).toBe(withPerk);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit(XP_THRESHOLDS.regular);
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } })).toBe(stolen);
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
      expect(gameReducer(state, { type: ActionTypes.HIRE_GENERAL, payload: {} })).toBe(state);
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
      expect(gameReducer(stolen, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } })).toBe(stolen);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const { state, generalId, unitId } = withGeneralAndUnit();
      const stolenUnit = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
      expect(gameReducer(stolenUnit, { type: ActionTypes.APPOINT_GENERAL, payload: { generalId, unitId } })).toBe(stolenUnit);
    });
  });
});

describe('Navies and amphibious invasion actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
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
      expect(gameReducer(embarked, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } })).toBe(embarked);
    });

    it('is a no-op once the transport is at capacity', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const withSecondLand = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'cavalry' } });
      const withThirdLand = gameReducer(withSecondLand, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: cap('fr'), classId: 'ranged' } });
      const otherLandIds = Object.keys(withThirdLand.units).filter((id) => withThirdLand.units[id].domain === 'land' && id !== landUnitId);
      const first = gameReducer(withThirdLand, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const second = gameReducer(first, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[0], navalUnitId } });
      // Transport capacity is 2 — a third embark attempt is rejected.
      expect(gameReducer(second, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[1], navalUnitId } })).toBe(second);
    });

    it('is a no-op if the units are not in the same region', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const moved = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], regionId: cap('be') } } };
      expect(gameReducer(moved, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } })).toBe(moved);
    });

    it('is a no-op for a land unit not owned by the player', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const stolen = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } })).toBe(stolen);
    });

    it('is a no-op when unaffordable', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const poor = { ...state, resources: { ...state.resources, mil: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } })).toBe(poor);
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
      expect(gameReducer(state, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } })).toBe(state);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const stolen = { ...embarked, units: { ...embarked.units, [landUnitId]: { ...embarked.units[landUnitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId } })).toBe(stolen);
    });
  });

  describe('AMPHIBIOUS_ASSAULT', () => {
    // A specific real GB region, not cap('gb') — the isCapital fix (build-world-regions.mjs) now
    // correctly resolves GB's capital to Westminster (real London), which isn't coastal, so it no
    // longer satisfies this test's actual requirement below. 'gb-ios' (Isles of Scilly) is not
    // land-adjacent to France but is within Bronze-age sea range (~33km across the Channel per
    // sea-lanes.json) and has no land neighbors of its own — a genuine sea-only target.
    const GB_TARGET = 'gb-ios';
    const withEmbarkedForce = () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      return { state: embarked, navalUnitId, landUnitId };
    };

    it('captures an undefended coastal region reachable only by sea', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      const next = gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } });
      expect(next.regions[GB_TARGET].owner).toBe('fr');
      expect(next.units[landUnitId].regionId).toBe(GB_TARGET);
      expect(next.units[landUnitId].embarkedOn).toBeNull();
      expect(next.lastBattleReport.outcome).toBe('attacker');
      expect(next.regions[GB_TARGET].formerOwner).toBe('gb');
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
      const overwhelming = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], strength: 50000 } } };
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
      expect(gameReducer(stolen, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: GB_TARGET } })).toBe(stolen);
    });

    it('is a no-op against a region the player already owns', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expect(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('fr') } })).toBe(state);
    });

    it('is a no-op against a non-coastal target', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expect(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('lu') } })).toBe(state);
    });

    it('is a no-op with no embarked land units', () => {
      const { state, navalUnitId } = withNavalAndLand();
      expect(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('gb') } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      const poor = { ...state, resources: { ...state.resources, actionPoints: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: cap('gb') } })).toBe(poor);
    });
  });

  describe('NAVAL_ENGAGEMENT', () => {
    const withEnemyFleetAt = (regionId) => {
      const { state, navalUnitId } = withNavalAndLand();
      const enemyFleet = {
        id: 'enemy_navy', regionId, ownerId: 'gb', domain: 'naval', classId: 'naval', ageId: 'bronze',
        strength: 50, maxStrength: 50, morale: 30, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
      };
      return { state: { ...state, units: { ...state.units, enemy_navy: enemyFleet } }, navalUnitId };
    };

    it('defeats an enemy fleet contesting a sea lane, holding position rather than advancing', () => {
      const { state, navalUnitId } = withEnemyFleetAt(cap('gb'));
      const next = gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } });
      expect(next.units.enemy_navy).toBeUndefined();
      expect(next.units[navalUnitId].regionId).toBe(cap('fr'));
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('is a no-op when there is no enemy fleet to engage', () => {
      const { state } = withNavalAndLand();
      expect(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } })).toBe(state);
    });

    it('is a no-op from a region not owned by the player', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      expect(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('de'), targetRegionId: cap('gb') } })).toBe(state);
    });

    it('is a no-op when the target is not reachable', () => {
      const { state } = withEnemyFleetAt(cap('jp'));
      expect(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('jp') } })).toBe(state);
    });

    it('is a no-op with no attacker naval units in the source region', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      const noNavy = { ...state, units: {} };
      expect(gameReducer(noNavy, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } })).toBe(noNavy);
    });

    it('is a no-op when unaffordable', () => {
      const { state } = withEnemyFleetAt(cap('gb'));
      const poor = { ...state, resources: { ...state.resources, mil: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: cap('fr'), targetRegionId: cap('gb') } })).toBe(poor);
    });
  });
});

describe('SUPPRESS_REBELLION', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
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
    return { ...state, resources: { ...state.resources, gold: 100000, techPoints: 100000, mil: 100, dip: 100, adm: 100 } };
  };

  describe('RESEARCH_TECH', () => {
    it('researches an available first-of-chain tech and deducts its cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } });
      expect(next.techTree.military_bronze_casting.researched).toBe(true);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.resources.techPoints).toBeLessThan(state.resources.techPoints);
      expect(next.resources.mil).toBeLessThan(state.resources.mil);
    });

    it('is a no-op for a tech whose prerequisite is not yet researched', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_composite_bow' } })).toBe(state);
    });

    it('charges a scaled-up cost the further the tech age has fallen behind the calendar (src/data/ages.js\'s getAgesBehindResearchCostMultiplier)', () => {
      const baseline = richState();
      const behind = { ...baseline, age: 'gunpowder', techAgeId: 'bronze' }; // 3 ages behind -> +90%

      const nextBaseline = gameReducer(baseline, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } });
      const nextBehind = gameReducer(behind, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } });

      const baselineGoldSpent = baseline.resources.gold - nextBaseline.resources.gold;
      const behindGoldSpent = behind.resources.gold - nextBehind.resources.gold;
      expect(behindGoldSpent).toBeGreaterThan(baselineGoldSpent);
      expect(behindGoldSpent).toBe(Math.round(baselineGoldSpent * 1.9));
    });

    it('is researchable once its prerequisite is researched', () => {
      // military_composite_bow is the second Bronze-age tech in its line, available partway
      // through the age (see techTree.js's buildLine) — advance the year past that point.
      const state = { ...richState(), year: -1000 };
      const withFirst = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } });
      const next = gameReducer(withFirst, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_composite_bow' } });
      expect(next.techTree.military_composite_bow.researched).toBe(true);
    });

    it('is a no-op for an unknown tech id', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'not_a_real_tech' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } })).toBe(state);
    });

    it('advances the tech-earned age once enough of the current age\'s line is researched', () => {
      let state = { ...richState(), year: -1000 };
      const chain = [
        'military_bronze_casting', 'military_composite_bow',
        'economy_bronze_trade_routes', 'economy_granary_storage',
        'infrastructure_irrigation_canals', 'infrastructure_mudbrick_roads'
      ];
      chain.forEach(techId => {
        state = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId } });
      });
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
        state = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId } });
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

describe('Government and policy actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    return { ...state, resources: { ...state.resources, gold: 100000, adm: 100 } };
  };

  describe('ADOPT_GOVERNMENT', () => {
    it('adopts a government available at the current age and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } });
      expect(next.nations.fr.government).toBe('tribal');
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('trims policies that no longer fit after reforming to a government with fewer slots', () => {
      const monarchy = gameReducer(richState(), { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'monarchy' } });
      const withTwoPolicies = ['levy_system', 'merchant_charter'].reduce(
        (s, policyId) => gameReducer(s, { type: ActionTypes.ADOPT_POLICY, payload: { policyId } }),
        monarchy
      );
      expect(withTwoPolicies.nations.fr.policies.length).toBe(2);
      // Reforming back to Tribal Council (1 slot) should drop one of the two adopted policies.
      const next = gameReducer(withTwoPolicies, { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } });
      expect(next.nations.fr.policies.length).toBe(1);
    });

    it('is a no-op for a government more than one age ahead of the calendar', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'feudal' } })).toBe(state);
    });

    it('is a no-op when already that government', () => {
      const state = gameReducer(richState(), { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } });
      expect(gameReducer(state, { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } })).toBe(state);
    });
  });

  describe('ADOPT_POLICY', () => {
    const withGovernment = () => gameReducer(richState(), { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } });

    it('adopts a policy into an open slot and deducts the cost', () => {
      const state = withGovernment();
      const next = gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } });
      expect(next.nations.fr.policies).toContain('levy_system');
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op without a government adopted yet', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } })).toBe(state);
    });

    it('is a no-op once every slot is filled', () => {
      // Tribal Council has exactly 1 slot.
      const state = gameReducer(withGovernment(), { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } });
      expect(gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'merchant_charter' } })).toBe(state);
    });

    it('is a no-op for a policy already adopted', () => {
      const state = gameReducer(withGovernment(), { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } });
      expect(gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } })).toBe(state);
    });

    it('is a no-op for an unknown policy id', () => {
      const state = withGovernment();
      expect(gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'not_real' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...withGovernment(), resources: { ...withGovernment().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } })).toBe(state);
    });
  });

  describe('REMOVE_POLICY', () => {
    const withPolicy = () => {
      const state = gameReducer(richState(), { type: ActionTypes.ADOPT_GOVERNMENT, payload: { governmentId: 'tribal' } });
      return gameReducer(state, { type: ActionTypes.ADOPT_POLICY, payload: { policyId: 'levy_system' } });
    };

    it('removes an adopted policy', () => {
      const state = withPolicy();
      const next = gameReducer(state, { type: ActionTypes.REMOVE_POLICY, payload: { policyId: 'levy_system' } });
      expect(next.nations.fr.policies).not.toContain('levy_system');
    });

    it('is a no-op for a policy not currently adopted', () => {
      const state = withPolicy();
      expect(gameReducer(state, { type: ActionTypes.REMOVE_POLICY, payload: { policyId: 'merchant_charter' } })).toBe(state);
    });
  });

  describe('SHIFT_IDENTITY', () => {
    it('shifts the named axis by IDENTITY_SHIFT_STEP in the given direction and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } });
      expect(next.nations.fr.identity.collectivism).toBe(IDENTITY_SHIFT_STEP);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
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

    it('is a no-op when unaffordable', () => {
      const state = { ...richState(), resources: { ...richState().resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SHIFT_IDENTITY, payload: { axis: 'collectivism', direction: 1 } })).toBe(state);
    });
  });
});

describe('Diplomacy tab actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
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
      const withClaim = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, claims: ['de'] } } };
      const other = Object.keys(state.nations).find(id => id !== 'fr' && id !== 'de');
      const before = state.nations[other].hostility;
      const next = gameReducer(withClaim, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'de' } });
      expect(next.nations.de.isAtWar).toBe(true);
      expect(next.resources.gold).toBe(withClaim.resources.gold); // declareWarJustified has no gold cost
      expect(next.nations[other].hostility).toBe(before); // no global relations penalty
      expect(next.nations.fr.claims).not.toContain('de'); // the claim is spent
    });

    it('is a no-op declaring war on yourself', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.DECLARE_WAR, payload: { nationId: 'fr' } })).toBe(state);
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
    it('adds a claim against the target and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.FABRICATE_CLAIM, payload: { nationId: 'de' } });
      expect(next.nations.fr.claims).toContain('de');
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
});

describe('default case', () => {
  it('returns state unchanged for an unrecognized action type', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(gameReducer(state, { type: 'NOT_A_REAL_ACTION' })).toBe(state);
  });
});
