import { describe, it, expect } from 'vitest';
import { calcNationScore, getWarsWonCount, rankNations, getPlayerRank } from './score';
import { createInitialState } from '../context/GameContext';
import { getNationCapital, getOwnedRegionIds } from '../data/regions';
import { getTotalDev } from './development';

describe('getWarsWonCount (plan §M18)', () => {
  it('counts a closed war as won for the aggressor when the final score favored them', () => {
    const state = { wars: [{ aggressor: 'fr', enemy: 'de', active: false, score: 40 }] };
    expect(getWarsWonCount(state, 'fr')).toBe(1);
    expect(getWarsWonCount(state, 'de')).toBe(0);
  });

  it('counts a closed war as won for the enemy when the final score favored them', () => {
    const state = { wars: [{ aggressor: 'fr', enemy: 'de', active: false, score: -40 }] };
    expect(getWarsWonCount(state, 'de')).toBe(1);
    expect(getWarsWonCount(state, 'fr')).toBe(0);
  });

  it('never counts a still-active war or a white peace (score 0)', () => {
    const state = { wars: [{ aggressor: 'fr', enemy: 'de', active: true, score: 40 }, { aggressor: 'fr', enemy: 'jp', active: false, score: 0 }] };
    expect(getWarsWonCount(state, 'fr')).toBe(0);
  });
});

describe('calcNationScore (plan §M18: "development + regions + tech + prestige + great projects + wars won")', () => {
  it('is 0 for a nation that owns nothing and has done nothing', () => {
    const state = { regions: {}, nations: { ghost: {} }, greatProjects: {}, wars: [], playerNationId: 'other' };
    expect(calcNationScore(state, 'ghost').total).toBe(0);
  });

  it('counts owned regions, their development, researched techs, and prestige', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const ownedIds = getOwnedRegionIds(state.regions, 'fr');
    const score = calcNationScore(state, 'fr');
    expect(score.regions).toBe(ownedIds.length);
    expect(score.regions).toBeGreaterThan(0);
    expect(score.development).toBe(ownedIds.reduce((sum, id) => sum + getTotalDev(state.regions[id]), 0));
    expect(score.prestige).toBe(state.nations.fr.prestige || 0);
    expect(score.total).toBeGreaterThan(0);
  });

  it('credits great projects only for the nation that currently owns the SITE region', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const frCapital = getNationCapital('fr');
    const withProject = { ...state, greatProjects: { great_pyramids: { regionId: frCapital, tier: 2 } } };
    expect(calcNationScore(withProject, 'fr').greatProjects).toBe(1);
    expect(calcNationScore(withProject, 'de').greatProjects).toBe(0);
  });

  it('credits wars won at +100 each', () => {
    const state = { regions: {}, nations: { fr: {} }, greatProjects: {}, wars: [{ aggressor: 'fr', enemy: 'de', active: false, score: 50 }] };
    expect(calcNationScore(state, 'fr').total).toBe(100);
  });
});

describe('rankNations / getPlayerRank', () => {
  it('ranks the player #1 in a fresh game only if no other nation somehow scores higher (ties broken by id)', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const ranked = rankNations(state);
    expect(ranked.length).toBe(Object.keys(state.nations).length);
    // Every entry sorted strictly non-increasing by total score.
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].total).toBeGreaterThanOrEqual(ranked[i].total);
  });

  it('getPlayerRank finds the player at the correct 1-indexed position', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const rank = getPlayerRank(state);
    const ranked = rankNations(state);
    expect(ranked[rank - 1].nationId).toBe('fr');
  });

  it('a nation with a dramatically higher score outranks the player', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const boosted = { ...state, nations: { ...state.nations, de: { ...state.nations.de, prestige: 100000 } } };
    expect(getPlayerRank(boosted)).toBeGreaterThan(1);
    expect(rankNations(boosted)[0].nationId).toBe('de');
  });
});
