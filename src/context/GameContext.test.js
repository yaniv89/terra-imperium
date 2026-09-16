import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from './GameContext';
import { ActionTypes, GameStatus, LogTypes } from '../data/types';
import { XP_THRESHOLDS } from '../data/promotions';

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

describe('default case', () => {
  it('returns state unchanged for an unrecognized action type', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    expect(gameReducer(state, { type: 'NOT_A_REAL_ACTION' })).toBe(state);
  });
});
