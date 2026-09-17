import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './GameContext';
import { ActionTypes, GameStatus, LogTypes } from '../data/types';
import { XP_THRESHOLDS } from '../data/promotions';
import { TECH_TREE } from '../data/techTree';
import { REBEL_OWNER_ID, REBELLION_UNREST_THRESHOLD } from '../data/rebellion';
import { MAX_ORBITAL_DEBRIS } from '../data/satellites';
import { MAX_ABM_LEVEL } from '../data/missiles';

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
      const withLowControl = { ...before, regions: { ...before.regions, fr: { ...before.regions.fr, control: 50 } } };
      const next = gameReducer(withLowControl, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: 'fr' } });
      expect(next.regions.fr.control).toBe(55);
      expect(next.resources.gold).toBeLessThan(withLowControl.resources.gold);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      const otherId = Object.keys(state.regions).find(id => id !== 'fr');
      expect(gameReducer(state, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: otherId } })).toBe(state);
    });

    it('is a no-op already at 100% control', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: 'fr' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const withLowControl = { ...state, resources: { ...state.resources, gold: 0 }, regions: { ...state.regions, fr: { ...state.regions.fr, control: 50 } } };
      expect(gameReducer(withLowControl, { type: ActionTypes.GAIN_CONTROL, payload: { regionId: 'fr' } })).toBe(withLowControl);
    });
  });

  describe('BUILD_INFRASTRUCTURE', () => {
    it('raises infrastructure level and deducts the cost', () => {
      const base = richState();
      const state = { ...base, regions: { ...base.regions, fr: { ...base.regions.fr, currentInfrastructure: 3 } } };
      const next = gameReducer(state, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: 'fr' } });
      expect(next.regions.fr.currentInfrastructure).toBe(4);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op at the level cap', () => {
      const state = richState();
      const maxed = { ...state, regions: { ...state.regions, fr: { ...state.regions.fr, currentInfrastructure: 10 } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_INFRASTRUCTURE, payload: { regionId: 'fr' } })).toBe(maxed);
    });
  });

  describe('BUILD_DEFENSES', () => {
    it('raises defenseLevel and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.BUILD_DEFENSES, payload: { regionId: 'fr' } });
      expect(next.regions.fr.defenseLevel).toBe(1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op at the level cap', () => {
      const state = richState();
      const maxed = { ...state, regions: { ...state.regions, fr: { ...state.regions.fr, defenseLevel: 10 } } };
      expect(gameReducer(maxed, { type: ActionTypes.BUILD_DEFENSES, payload: { regionId: 'fr' } })).toBe(maxed);
    });
  });

  describe('CONSTRUCT_BUILDING', () => {
    it('advances a category to its first tier in the Bronze Age', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: 'fr', categoryId: 'food' } });
      expect(next.regions.fr.buildings.categories.food).toBe(0);
    });

    it('rejects rushing more than one tier ahead of the calendar', () => {
      const state = richState();
      const tier0 = gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: 'fr', categoryId: 'food' } });
      const tier1 = gameReducer(tier0, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: 'fr', categoryId: 'food' } });
      expect(tier1.regions.fr.buildings.categories.food).toBe(1); // Irrigation (classical) — one age ahead of bronze, allowed
      const tier2Attempt = gameReducer(tier1, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: 'fr', categoryId: 'food' } });
      expect(tier2Attempt).toBe(tier1); // Farm Estate (kingdoms) — two ages ahead, rejected
    });

    it('rejects an unknown category', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.CONSTRUCT_BUILDING, payload: { regionId: 'fr', categoryId: 'not_real' } })).toBe(state);
    });
  });

  describe('DEVELOP_RESOURCE_SITE', () => {
    it('develops a deposit the region actually has', () => {
      const state = richState('cl'); // Chile has copper
      const next = gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: 'cl', resourceId: 'copper' } });
      expect(next.regions.cl.buildings.extraction.copper).toBe(true);
    });

    it('rejects a resource the region has no deposit for', () => {
      const state = richState('fr'); // France has no copper deposit listed
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: 'fr', resourceId: 'copper' } })).toBe(state);
    });

    it('rejects developing the same site twice', () => {
      const state = richState('cl');
      const once = gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: 'cl', resourceId: 'copper' } });
      expect(gameReducer(once, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: 'cl', resourceId: 'copper' } })).toBe(once);
    });

    it('rejects a resource not yet unlocked by age', () => {
      const state = richState('sa'); // Saudi Arabia has oil, but oil needs Modern age
      expect(gameReducer(state, { type: ActionTypes.DEVELOP_RESOURCE_SITE, payload: { regionId: 'sa', resourceId: 'oil' } })).toBe(state);
    });
  });

  describe('QUELL_UNREST', () => {
    const withUnrest = (unrest) => {
      const base = richState();
      return { ...base, regions: { ...base.regions, fr: { ...base.regions.fr, unrest } } };
    };

    it('reduces unrest and deducts the cost', () => {
      const state = withUnrest(50);
      const next = gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: 'fr' } });
      expect(next.regions.fr.unrest).toBe(20);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op when there is no unrest to quell', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: 'fr' } })).toBe(state);
    });

    it('floors at 0 rather than going negative', () => {
      const state = withUnrest(10);
      const next = gameReducer(state, { type: ActionTypes.QUELL_UNREST, payload: { regionId: 'fr' } });
      expect(next.regions.fr.unrest).toBe(0);
    });
  });

  describe('SETTLE_COLONIZE', () => {
    // 'be' (Belgium) is a real bordering nation of 'fr' (see worldRegions.json's adjacency).
    const withCollapsedNeighbor = (control) => {
      const base = richState();
      return { ...base, regions: { ...base.regions, be: { ...base.regions.be, control } } };
    };

    it('absorbs a bordering nation whose control has collapsed, and deducts the cost', () => {
      const state = withCollapsedNeighbor(10);
      const next = gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: 'be' } });
      expect(next.regions.be.owner).toBe('fr');
      expect(next.regions.be.control).toBeGreaterThan(0);
      expect(next.regions.be.control).toBeLessThan(100);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.regions.be.formerOwner).toBe('be');
    });

    it('is a no-op when the target still has real control of its own territory', () => {
      const state = withCollapsedNeighbor(50);
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: 'be' } })).toBe(state);
    });

    it('is a no-op on a region that does not border the player', () => {
      // 'us' does not border 'fr'.
      const base = richState();
      const state = { ...base, regions: { ...base.regions, us: { ...base.regions.us, control: 5 } } };
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: 'us' } })).toBe(state);
    });

    it('is a no-op on a region the player already owns', () => {
      const state = withCollapsedNeighbor(10);
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: 'fr' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const base = withCollapsedNeighbor(10);
      const state = { ...base, resources: { ...base.resources, gold: 0 } };
      expect(gameReducer(state, { type: ActionTypes.SETTLE_COLONIZE, payload: { regionId: 'be' } })).toBe(state);
    });
  });

  describe('POPULATION_POLICY', () => {
    it('grows population and deducts the cost', () => {
      const state = richState();
      const before = state.regions.fr.currentPopulation;
      const next = gameReducer(state, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: 'fr' } });
      expect(next.regions.fr.currentPopulation).toBeGreaterThan(before);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
    });

    it('is a no-op on a region not owned by the player', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.POPULATION_POLICY, payload: { regionId: 'be' } })).toBe(state);
    });
  });

  describe('SET_TAX_RATE', () => {
    it('changes the tax rate and deducts the (action-point-only) cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_TAX_RATE, payload: { rate: 'high' } });
      expect(next.nations.fr.taxRate).toBe('high');
      expect(next.resources.actionPoints).toBeLessThan(state.resources.actionPoints);
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
    // 'de' is a real, land-adjacent (1 hop) neighbor of 'fr'; 'us' has no land path from 'fr' at
    // all in the real adjacency data, making it a genuine out-of-range target for finite tiers.
    const withMissile = (tierId, count = 1) => {
      const base = spaceState();
      return { ...base, nations: { ...base.nations, fr: { ...base.nations.fr, missiles: { ...base.nations.fr.missiles, [tierId]: count } } } };
    };

    it('damages the target region and the target nation, and consumes the missile', () => {
      const state = withMissile('tactical');
      const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'de' } });
      expect(next.regions.de.control).toBeLessThan(state.regions.de.control);
      expect(next.regions.de.unrest).toBeGreaterThan(state.regions.de.unrest);
      expect(next.nations.de.militaryStrength).toBeLessThan(state.nations.de.militaryStrength);
      expect(next.nations.fr.missiles.tactical).toBe(0);
    });

    it('is a no-op with an empty stockpile for that tier', () => {
      const state = spaceState();
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'de' } })).toBe(state);
    });

    it('is a no-op against the player\'s own region', () => {
      const state = withMissile('tactical');
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'fr' } })).toBe(state);
    });

    it('is a no-op when the target is out of the tier\'s range', () => {
      const state = withMissile('tactical');
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'us' } })).toBe(state);
    });

    it('an icbm reaches a target a tactical missile could never reach', () => {
      const state = withMissile('icbm');
      const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'icbm', targetRegionId: 'us' } });
      expect(next.regions.us.control).toBeLessThan(state.regions.us.control);
    });

    it('an ABM defense level reduces incoming damage', () => {
      const base = withMissile('tactical', 2);
      const noAbm = gameReducer(base, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'de' } });
      const withAbmState = { ...base, nations: { ...base.nations, de: { ...base.nations.de, abmDefenseLevel: 3 } } };
      const withAbm = gameReducer(withAbmState, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'de' } });
      const noAbmDamage = base.regions.de.control - noAbm.regions.de.control;
      const withAbmDamage = base.regions.de.control - withAbm.regions.de.control;
      expect(withAbmDamage).toBeLessThan(noAbmDamage);
    });

    it('a nuclear strike scars the region and raises every other nation\'s hostility (global condemnation)', () => {
      const state = withMissile('nuclear');
      const next = gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'nuclear', targetRegionId: 'de' } });
      expect(next.regions.de.nuclearScarred).toBe(true);
      const thirdParty = Object.keys(state.nations).find(id => id !== 'fr' && id !== 'de');
      expect(next.nations[thirdParty].hostility).toBeGreaterThan(state.nations[thirdParty].hostility);
    });

    it('is a no-op when unaffordable (the flat action-point cost)', () => {
      const base = withMissile('tactical');
      const state = { ...base, resources: { ...base.resources, actionPoints: 0 } };
      expect(gameReducer(state, { type: ActionTypes.MISSILE_STRIKE, payload: { tierId: 'tactical', targetRegionId: 'de' } })).toBe(state);
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
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
      const unitIds = Object.keys(next.units);
      expect(unitIds.length).toBe(1);
      const unit = next.units[unitIds[0]];
      expect(unit.regionId).toBe('fr');
      expect(unit.classId).toBe('infantry');
      expect(unit.ownerId).toBe('fr');
      expect(unit.domain).toBe('land');
      expect(next.nextUnitSeq).toBe(state.nextUnitSeq + 1);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.resources.hr).toBeLessThan(state.resources.hr);
    });

    it('sets domain to naval for the naval class', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'naval' } });
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
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'air' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = createInitialState({ playerNationId: 'fr' });
      const poor = { ...state, resources: { ...state.resources, gold: 0, hr: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } })).toBe(poor);
    });
  });

  describe('DISBAND_UNIT', () => {
    const withUnit = () => {
      const state = richState();
      return gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
    };

    it('removes the unit and refunds a fraction of its HR cost', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.DISBAND_UNIT, payload: { unitId } });
      expect(next.units[unitId]).toBeUndefined();
      expect(next.resources.hr).toBeGreaterThan(state.resources.hr);
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

  describe('MOVE_ARMY', () => {
    const withUnit = () => {
      const state = richState();
      return gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
    };

    it('moves the unit to an adjacent region and deducts the action point cost', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: 'be' } });
      expect(next.units[unitId].regionId).toBe('be');
    });

    it('is a no-op moving to a non-adjacent region', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      expect(gameReducer(state, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: 'jp' } })).toBe(state);
    });

    it('is a no-op for a unit not owned by the player', () => {
      const state = withUnit();
      const unitId = Object.keys(state.units)[0];
      const stolen = { ...state, units: { ...state.units, [unitId]: { ...state.units[unitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.MOVE_ARMY, payload: { unitId, toRegionId: 'be' } })).toBe(stolen);
    });
  });

  describe('LAUNCH_INVASION', () => {
    const withAttacker = (strength) => {
      const state = richState();
      const recruited = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
      if (strength === undefined) return recruited;
      const unitId = Object.keys(recruited.units)[0];
      return { ...recruited, units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], strength } } };
    };

    it('captures an undefended adjacent region and moves surviving units into it', () => {
      const state = withAttacker();
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'fr', targetRegionId: 'be' } });
      expect(next.regions.be.owner).toBe('fr');
      expect(next.units[unitId].regionId).toBe('be');
      expect(next.resources.actionPoints).toBeLessThan(state.resources.actionPoints);
      expect(next.lastBattleReport.outcome).toBe('attacker');
      // Conquered territory (plan §9 revolt system): records who it was taken from, so an
      // unresolved rebellion there can later revert it rather than fighting the same army forever.
      expect(next.regions.be.formerOwner).toBe('be');
    });

    it('does not mark a nation reclaiming its own native region as conquered territory', () => {
      // 'be' has already lost its own homeland to 'fr', but still holds the Netherlands, land-
      // adjacent to Belgium — a base to invade its own homeland back from.
      const base = richState('be');
      const recruited = gameReducer(base, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'be', classId: 'infantry' } });
      const unitId = Object.keys(recruited.units)[0];
      const state = {
        ...recruited,
        units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], regionId: 'nl' } },
        regions: {
          ...recruited.regions,
          be: { ...recruited.regions.be, owner: 'fr' },
          nl: { ...recruited.regions.nl, owner: 'be' }
        }
      };
      const next = gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'nl', targetRegionId: 'be' } });
      expect(next.regions.be.owner).toBe('be');
      expect(next.regions.be.formerOwner).toBeUndefined();
    });

    it('is repelled by a strong defender, leaving the region unconquered', () => {
      const state = withAttacker(100); // a token attacking force
      const defenderUnit = {
        id: 'def_x', regionId: 'be', ownerId: 'be', domain: 'land', classId: 'infantry', ageId: 'bronze',
        strength: 50000, maxStrength: 50000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
      };
      const withDefender = { ...state, units: { ...state.units, def_x: defenderUnit } };
      const next = gameReducer(withDefender, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'fr', targetRegionId: 'be' } });
      expect(next.regions.be.owner).toBe('be');
      expect(next.lastBattleReport.outcome).toBe('defender');
    });

    it('is a no-op from a region not owned by the player', () => {
      const state = withAttacker();
      const otherId = Object.keys(state.regions).find(id => id !== 'fr' && id !== 'be');
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: otherId, targetRegionId: 'be' } })).toBe(state);
    });

    it('is a no-op against a region the player already owns', () => {
      const state = withAttacker();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'fr', targetRegionId: 'fr' } })).toBe(state);
    });

    it('is a no-op against a non-adjacent region', () => {
      const state = withAttacker();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'fr', targetRegionId: 'jp' } })).toBe(state);
    });

    it('is a no-op when there are no attacker units in the source region', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'fr', targetRegionId: 'be' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const state = { ...withAttacker(), resources: { ...withAttacker().resources, actionPoints: 0 } };
      expect(gameReducer(state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: 'fr', targetRegionId: 'be' } })).toBe(state);
    });
  });
});

describe('Promotions and generals actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, actionPoints: 10 } };
  };

  describe('PROMOTE_UNIT', () => {
    const withUnit = (xp = 0) => {
      const state = richState();
      const recruited = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
      const unitId = Object.keys(recruited.units)[0];
      return { ...recruited, units: { ...recruited.units, [unitId]: { ...recruited.units[unitId], xp } } };
    };

    it('grants the chosen perk once the unit has reached the next rank', () => {
      const state = withUnit(XP_THRESHOLDS.regular);
      const unitId = Object.keys(state.units)[0];
      const next = gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } });
      expect(next.units[unitId].promotions).toContain('shock');
      expect(next.resources.actionPoints).toBeLessThan(state.resources.actionPoints);
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

    it('is a no-op when unaffordable', () => {
      const state = { ...withUnit(XP_THRESHOLDS.regular), resources: { ...withUnit(XP_THRESHOLDS.regular).resources, actionPoints: 0 } };
      const unitId = Object.keys(state.units)[0];
      expect(gameReducer(state, { type: ActionTypes.PROMOTE_UNIT, payload: { unitId, perkId: 'shock' } })).toBe(state);
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
      const recruited = gameReducer(hired, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
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
      const second = gameReducer(appointed, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'cavalry' } });
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
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, actionPoints: 10 } };
  };

  const withNavalAndLand = () => {
    const state = richState();
    const withNaval = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'naval' } });
    const withLand = gameReducer(withNaval, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
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
      const withSecondLand = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'cavalry' } });
      const withThirdLand = gameReducer(withSecondLand, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'ranged' } });
      const otherLandIds = Object.keys(withThirdLand.units).filter((id) => withThirdLand.units[id].domain === 'land' && id !== landUnitId);
      const first = gameReducer(withThirdLand, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      const second = gameReducer(first, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[0], navalUnitId } });
      // Transport capacity is 2 — a third embark attempt is rejected.
      expect(gameReducer(second, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: otherLandIds[1], navalUnitId } })).toBe(second);
    });

    it('is a no-op if the units are not in the same region', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const moved = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], regionId: 'be' } } };
      expect(gameReducer(moved, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } })).toBe(moved);
    });

    it('is a no-op for a land unit not owned by the player', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const stolen = { ...state, units: { ...state.units, [landUnitId]: { ...state.units[landUnitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } })).toBe(stolen);
    });

    it('is a no-op when unaffordable', () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const poor = { ...state, resources: { ...state.resources, actionPoints: 0 } };
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
    // 'gb' (Great Britain) is not land-adjacent to France but is within Bronze-age sea range
    // (~33km across the Channel per sea-lanes.json) — a genuine sea-only target.
    const withEmbarkedForce = () => {
      const { state, navalUnitId, landUnitId } = withNavalAndLand();
      const embarked = gameReducer(state, { type: ActionTypes.EMBARK_UNIT, payload: { landUnitId, navalUnitId } });
      return { state: embarked, navalUnitId, landUnitId };
    };

    it('captures an undefended coastal region reachable only by sea', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      const next = gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'gb' } });
      expect(next.regions.gb.owner).toBe('fr');
      expect(next.units[landUnitId].regionId).toBe('gb');
      expect(next.units[landUnitId].embarkedOn).toBeNull();
      expect(next.lastBattleReport.outcome).toBe('attacker');
      expect(next.regions.gb.formerOwner).toBe('gb');
    });

    it('sinks the transport and its cargo when intercepted by a defending fleet', () => {
      const { state, navalUnitId, landUnitId } = withEmbarkedForce();
      const enemyFleet = {
        id: 'enemy_navy', regionId: 'gb', ownerId: 'gb', domain: 'naval', classId: 'naval', ageId: 'bronze',
        strength: 50000, maxStrength: 50000, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
      };
      const withEnemy = { ...state, units: { ...state.units, enemy_navy: enemyFleet } };
      const next = gameReducer(withEnemy, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'gb' } });
      expect(next.units[navalUnitId]).toBeUndefined();
      expect(next.units[landUnitId]).toBeUndefined();
      expect(next.regions.gb.owner).toBe('gb');
    });

    it('is a no-op for a naval unit not owned by the player', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      const stolen = { ...state, units: { ...state.units, [navalUnitId]: { ...state.units[navalUnitId], ownerId: 'de' } } };
      expect(gameReducer(stolen, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'gb' } })).toBe(stolen);
    });

    it('is a no-op against a region the player already owns', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expect(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'fr' } })).toBe(state);
    });

    it('is a no-op against a non-coastal target', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      expect(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'lu' } })).toBe(state);
    });

    it('is a no-op with no embarked land units', () => {
      const { state, navalUnitId } = withNavalAndLand();
      expect(gameReducer(state, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'gb' } })).toBe(state);
    });

    it('is a no-op when unaffordable', () => {
      const { state, navalUnitId } = withEmbarkedForce();
      const poor = { ...state, resources: { ...state.resources, actionPoints: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId, targetRegionId: 'gb' } })).toBe(poor);
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
      const { state, navalUnitId } = withEnemyFleetAt('gb');
      const next = gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: 'fr', targetRegionId: 'gb' } });
      expect(next.units.enemy_navy).toBeUndefined();
      expect(next.units[navalUnitId].regionId).toBe('fr');
      expect(next.lastBattleReport.outcome).toBe('attacker');
    });

    it('is a no-op when there is no enemy fleet to engage', () => {
      const { state } = withNavalAndLand();
      expect(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: 'fr', targetRegionId: 'gb' } })).toBe(state);
    });

    it('is a no-op from a region not owned by the player', () => {
      const { state } = withEnemyFleetAt('gb');
      expect(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: 'de', targetRegionId: 'gb' } })).toBe(state);
    });

    it('is a no-op when the target is not reachable', () => {
      const { state } = withEnemyFleetAt('jp');
      expect(gameReducer(state, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: 'fr', targetRegionId: 'jp' } })).toBe(state);
    });

    it('is a no-op with no attacker naval units in the source region', () => {
      const { state } = withEnemyFleetAt('gb');
      const noNavy = { ...state, units: {} };
      expect(gameReducer(noNavy, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: 'fr', targetRegionId: 'gb' } })).toBe(noNavy);
    });

    it('is a no-op when unaffordable', () => {
      const { state } = withEnemyFleetAt('gb');
      const poor = { ...state, resources: { ...state.resources, actionPoints: 0 } };
      expect(gameReducer(poor, { type: ActionTypes.NAVAL_ENGAGEMENT, payload: { fromRegionId: 'fr', targetRegionId: 'gb' } })).toBe(poor);
    });
  });
});

describe('SUPPRESS_REBELLION', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    return { ...state, resources: { ...state.resources, gold: 100000, hr: 100000, actionPoints: 10 } };
  };

  const rebelUnit = (strength = 300) => ({
    id: 'rebel_fr_1', regionId: 'fr', ownerId: REBEL_OWNER_ID, domain: 'land', classId: 'infantry', ageId: 'bronze',
    strength, maxStrength: strength, morale: 100, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, transportCapacity: null, embarkedOn: null
  });

  const withGarrisonAndRebel = (rebelStrength = 300) => {
    const state = richState();
    const withGarrison = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
    const rebel = rebelUnit(rebelStrength);
    return { ...withGarrison, units: { ...withGarrison.units, [rebel.id]: rebel } };
  };

  it('crushes a weak rebellion, restoring some control and capping unrest', () => {
    const state = { ...withGarrisonAndRebel(50), regions: { ...withGarrisonAndRebel(50).regions, fr: { ...withGarrisonAndRebel(50).regions.fr, unrest: 95, control: 40 } } };
    const next = gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: 'fr' } });
    expect(next.units.rebel_fr_1).toBeUndefined();
    expect(next.regions.fr.unrest).toBeLessThan(REBELLION_UNREST_THRESHOLD);
    expect(next.regions.fr.control).toBeGreaterThan(40);
    expect(next.lastBattleReport.outcome).toBe('attacker');
  });

  it('a garrison repelled by an overwhelming rebellion leaves the rebels standing', () => {
    const state = withGarrisonAndRebel(500000);
    const next = gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: 'fr' } });
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
    const withGarrison = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'infantry' } });
    expect(gameReducer(withGarrison, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: 'fr' } })).toBe(withGarrison);
  });

  it('is a no-op with no garrison to fight with', () => {
    const state = richState();
    const withRebel = { ...state, units: { rebel_fr_1: rebelUnit() } };
    expect(gameReducer(withRebel, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: 'fr' } })).toBe(withRebel);
  });

  it('is a no-op when unaffordable', () => {
    const state = { ...withGarrisonAndRebel(), resources: { ...withGarrisonAndRebel().resources, actionPoints: 0 } };
    expect(gameReducer(state, { type: ActionTypes.SUPPRESS_REBELLION, payload: { regionId: 'fr' } })).toBe(state);
  });
});

describe('Research tab actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    return { ...state, resources: { ...state.resources, gold: 100000, techPoints: 100000, actionPoints: 100 } };
  };

  describe('RESEARCH_TECH', () => {
    it('researches an available first-of-chain tech and deducts its cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_bronze_casting' } });
      expect(next.techTree.military_bronze_casting.researched).toBe(true);
      expect(next.resources.gold).toBeLessThan(state.resources.gold);
      expect(next.resources.techPoints).toBeLessThan(state.resources.techPoints);
      expect(next.resources.actionPoints).toBeLessThan(state.resources.actionPoints);
    });

    it('is a no-op for a tech whose prerequisite is not yet researched', () => {
      const state = richState();
      expect(gameReducer(state, { type: ActionTypes.RESEARCH_TECH, payload: { techId: 'military_composite_bow' } })).toBe(state);
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

      const next = gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'air' } });
      const airUnit = Object.values(next.units).find(u => u.classId === 'air');
      expect(airUnit).toBeDefined();
    });

    it('cannot recruit the next age\'s unit class without the tech-earned advancement', () => {
      const state = { ...richState(), age: 'gunpowder' };
      expect(gameReducer(state, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: 'fr', classId: 'air' } })).toBe(state);
    });
  });

  describe('SET_RESEARCH_FOCUS', () => {
    it('sets the research focus and deducts the cost', () => {
      const state = richState();
      const next = gameReducer(state, { type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId: 'science' } });
      expect(next.researchFocus).toBe('science');
      expect(next.resources.actionPoints).toBeLessThan(state.resources.actionPoints);
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
      const state = { ...richState(), resources: { ...richState().resources, actionPoints: 0 } };
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
    return { ...state, resources: { ...state.resources, gold: 100000, actionPoints: 100 } };
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

    it('is a no-op when unaffordable', () => {
      const state = { ...withPolicy(), resources: { ...withPolicy().resources, actionPoints: 0 } };
      expect(gameReducer(state, { type: ActionTypes.REMOVE_POLICY, payload: { policyId: 'levy_system' } })).toBe(state);
    });
  });
});

describe('Diplomacy tab actions', () => {
  const richState = (playerNationId = 'fr') => {
    const state = createInitialState({ playerNationId });
    return { ...state, resources: { ...state.resources, gold: 100000, diplomacyPoints: 1000, actionPoints: 100 } };
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
      expect(next.regions.fr.unrest).toBeGreaterThan(state.regions.fr.unrest);
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
});

describe('default case', () => {
  it('returns state unchanged for an unrecognized action type', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(gameReducer(state, { type: 'NOT_A_REAL_ACTION' })).toBe(state);
  });
});
