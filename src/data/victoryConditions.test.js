import { describe, it, expect } from 'vitest';
import { VICTORY_CONDITIONS, checkVictoryConditions, applyVictory } from './victoryConditions';
import { createInitialState } from '../context/GameContext';
import { GameStatus, GamePhases } from './types';
import { INDEPENDENCE_WAR_ATTACKERS, HOSTILE_BLOCS } from './nations';
import { getNationCapital } from './regions';

const postState = () => ({ ...createInitialState(), phase: GamePhases.POST_STATE });

describe('survival', () => {
  it('is satisfied once the year reaches 2150', () => {
    expect(VICTORY_CONDITIONS.survival.check({ ...postState(), year: 2149 })).toBe(false);
    expect(VICTORY_CONDITIONS.survival.check({ ...postState(), year: 2150 })).toBe(true);
  });
});

describe('military_conquest', () => {
  it('requires holding every 1948-war-attacker\'s capital', () => {
    const state = postState();
    expect(VICTORY_CONDITIONS.military_conquest.check(state)).toBe(false);

    const regions = { ...state.regions };
    INDEPENDENCE_WAR_ATTACKERS.forEach(nationId => {
      const capital = getNationCapital(nationId);
      regions[capital] = { ...regions[capital], owner: 'player' };
    });
    expect(VICTORY_CONDITIONS.military_conquest.check({ ...state, regions })).toBe(true);
  });

  it('is not satisfied while even one capital is still held by its nation', () => {
    const state = postState();
    const regions = { ...state.regions };
    INDEPENDENCE_WAR_ATTACKERS.slice(0, -1).forEach(nationId => {
      const capital = getNationCapital(nationId);
      regions[capital] = { ...regions[capital], owner: 'player' };
    });
    expect(VICTORY_CONDITIONS.military_conquest.check({ ...state, regions })).toBe(false);
  });
});

describe('economic_ascendancy', () => {
  it('requires both the money and tech point thresholds', () => {
    const state = postState();
    expect(VICTORY_CONDITIONS.economic_ascendancy.check({ ...state, resources: { ...state.resources, money: 5000000, techPoints: 100 } })).toBe(false);
    expect(VICTORY_CONDITIONS.economic_ascendancy.check({ ...state, resources: { ...state.resources, money: 100, techPoints: 2000 } })).toBe(false);
    expect(VICTORY_CONDITIONS.economic_ascendancy.check({ ...state, resources: { ...state.resources, money: 5000000, techPoints: 2000 } })).toBe(true);
  });
});

describe('diplomatic_hegemony', () => {
  it('requires peace or trade with every hostile bloc member', () => {
    const state = postState();
    const allMembers = Object.values(HOSTILE_BLOCS).flat();
    expect(VICTORY_CONDITIONS.diplomatic_hegemony.check(state)).toBe(false);

    const nations = { ...state.nations };
    allMembers.forEach(id => { nations[id] = { ...nations[id], hasPeaceTreaty: true }; });
    expect(VICTORY_CONDITIONS.diplomatic_hegemony.check({ ...state, nations })).toBe(true);
  });

  it('trade agreements count the same as peace treaties', () => {
    const state = postState();
    const allMembers = Object.values(HOSTILE_BLOCS).flat();
    const nations = { ...state.nations };
    allMembers.forEach(id => { nations[id] = { ...nations[id], hasTradeAgreement: true }; });
    expect(VICTORY_CONDITIONS.diplomatic_hegemony.check({ ...state, nations })).toBe(true);
  });

  it('is not satisfied while even one member is neither at peace nor trading', () => {
    const state = postState();
    const allMembers = Object.values(HOSTILE_BLOCS).flat();
    const nations = { ...state.nations };
    allMembers.slice(0, -1).forEach(id => { nations[id] = { ...nations[id], hasPeaceTreaty: true }; });
    expect(VICTORY_CONDITIONS.diplomatic_hegemony.check({ ...state, nations })).toBe(false);
  });
});

describe('checkVictoryConditions', () => {
  it('returns null when nothing is satisfied', () => {
    expect(checkVictoryConditions(postState())).toBeNull();
  });

  it('returns the id of a satisfied condition', () => {
    expect(checkVictoryConditions({ ...postState(), year: 2150 })).toBe('survival');
  });
});

describe('applyVictory', () => {
  it('sets gameStatus to VICTORY and records which condition triggered it', () => {
    const state = postState();
    const next = applyVictory(state, 'economic_ascendancy');
    expect(next.gameStatus).toBe(GameStatus.VICTORY);
    expect(next.victoryConditionId).toBe('economic_ascendancy');
  });

  it('does not mutate the input state', () => {
    const state = postState();
    applyVictory(state, 'survival');
    expect(state.gameStatus).toBe(GameStatus.ACTIVE);
  });
});
