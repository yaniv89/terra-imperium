import { describe, it, expect } from 'vitest';
import {
  checkNationElimination, closeWarsForEliminatedNation, wasEliminatedByPlayer, NATION_ELIMINATION_REWARD
} from './elimination';

describe('checkNationElimination', () => {
  const nations = { de: { id: 'de', name: 'Germany' }, fr: { id: 'fr', name: 'France', isPlayer: true } };

  it('returns null when the nation still owns at least one region', () => {
    const regions = { r1: { owner: 'de' } };
    expect(checkNationElimination(nations, regions, 'de')).toBeNull();
  });

  it('returns an isEliminated patch once the nation owns zero regions', () => {
    const regions = { r1: { owner: 'fr' }, r2: { owner: 'us' } };
    const patch = checkNationElimination(nations, regions, 'de');
    expect(patch).toMatchObject({ id: 'de', name: 'Germany', isEliminated: true, isAtWar: false });
  });

  it('never eliminates the player, however few regions they hold', () => {
    const regions = {};
    expect(checkNationElimination(nations, regions, 'fr')).toBeNull();
  });

  it('is a no-op once already eliminated (no repeat reward/log trigger)', () => {
    const alreadyDead = { ...nations, de: { ...nations.de, isEliminated: true } };
    expect(checkNationElimination(alreadyDead, {}, 'de')).toBeNull();
  });

  it('returns null for an unknown nation id', () => {
    expect(checkNationElimination(nations, {}, 'zz')).toBeNull();
  });
});

describe('closeWarsForEliminatedNation', () => {
  it('drops every war naming the eliminated nation as either side', () => {
    const wars = [
      { id: 'w1', aggressor: 'de', enemy: 'fr' },
      { id: 'w2', aggressor: 'us', enemy: 'de' },
      { id: 'w3', aggressor: 'us', enemy: 'uk' }
    ];
    expect(closeWarsForEliminatedNation(wars, 'de')).toEqual([{ id: 'w3', aggressor: 'us', enemy: 'uk' }]);
  });

  it('handles an empty/undefined wars list', () => {
    expect(closeWarsForEliminatedNation([], 'de')).toEqual([]);
    expect(closeWarsForEliminatedNation(undefined, 'de')).toEqual([]);
  });
});

describe('wasEliminatedByPlayer', () => {
  it('is true when the player holds a region taken directly from that nation', () => {
    const regions = { r1: { owner: 'fr', formerOwner: 'de' } };
    expect(wasEliminatedByPlayer(regions, 'fr', 'de')).toBe(true);
  });

  it('is false when no player-owned region was ever taken from that nation', () => {
    const regions = { r1: { owner: 'fr', formerOwner: 'uk' }, r2: { owner: 'us', formerOwner: 'de' } };
    expect(wasEliminatedByPlayer(regions, 'fr', 'de')).toBe(false);
  });
});

describe('NATION_ELIMINATION_REWARD', () => {
  it('is a modest, positive one-time gold + diplomacyPoints reward', () => {
    expect(NATION_ELIMINATION_REWARD.gold).toBeGreaterThan(0);
    expect(NATION_ELIMINATION_REWARD.diplomacyPoints).toBeGreaterThan(0);
  });
});
