import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, checkAchievements } from './achievements';
import { createInitialState } from '../context/GameContext';
import { GameStatus } from './types';
import { getNationCapital } from './regions';

describe('checkAchievements', () => {
  it('reports nothing for a brand-new game', () => {
    const state = createInitialState();
    expect(checkAchievements(state)).toEqual([]);
  });

  // Plan §M18: the old free calendar achievements (enter_classical_age/enter_modern_age) are gone —
  // every achievement now needs the player to have actually done something, not just waited.
  it('detects iron_grip once +3 stability has held for 20 straight turns', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const short = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, stability3Streak: 19 } } };
    expect(checkAchievements(short)).not.toContain('iron_grip');
    const long = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, stability3Streak: 20 } } };
    expect(checkAchievements(long)).toContain('iron_grip');
  });

  it('detects phoenix only once a nation that was bankrupt recovers to 5,000g', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const richButNeverBankrupt = { ...state, resources: { ...state.resources, gold: 10000 } };
    expect(checkAchievements(richButNeverBankrupt)).not.toContain('phoenix');
    const bankruptAndPoor = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, hasBeenBankrupt: true } }, resources: { ...state.resources, gold: 100 } };
    expect(checkAchievements(bankruptAndPoor)).not.toContain('phoenix');
    const recovered = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, hasBeenBankrupt: true } }, resources: { ...state.resources, gold: 5000 } };
    expect(checkAchievements(recovered)).toContain('phoenix');
  });

  it('detects great_game only for a CLOSED war won against a currently-larger nation', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const frCapital = getNationCapital('fr');
    // Hand EVERY region to 'de' except the player's own capital, so the size comparison is fully
    // controlled rather than relying on how many real admin-1 provinces either nation happens to
    // start with (France alone starts with ~100).
    const regions = {};
    Object.keys(state.regions).forEach((id) => { regions[id] = { ...state.regions[id], owner: id === frCapital ? 'fr' : 'de' }; });
    const base = { ...state, regions };

    const stillActive = { ...base, wars: [{ id: 'w1', aggressor: 'fr', enemy: 'de', active: true, score: 50 }] };
    expect(checkAchievements(stillActive)).not.toContain('great_game');

    const lost = { ...base, wars: [{ id: 'w1', aggressor: 'fr', enemy: 'de', active: false, score: -50 }] };
    expect(checkAchievements(lost)).not.toContain('great_game');

    const wonAgainstLarger = { ...base, wars: [{ id: 'w1', aggressor: 'fr', enemy: 'de', active: false, score: 50 }] };
    expect(checkAchievements(wonAgainstLarger)).toContain('great_game');
  });

  it('detects dynasty once the same royal house has held for 10 consecutive rulers', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const short = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, sameDynastyStreak: 9 } } };
    expect(checkAchievements(short)).not.toContain('dynasty');
    const long = { ...state, nations: { ...state.nations, fr: { ...state.nations.fr, sameDynastyStreak: 10 } } };
    expect(checkAchievements(long)).toContain('dynasty');
  });

  it('detects builder_of_wonders only once 3 owned Great Projects reach tier 3', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const frCapital = getNationCapital('fr');
    const twoAtTierThree = { ...state, greatProjects: { great_pyramids: { regionId: frCapital, tier: 3 }, hanging_gardens: { regionId: frCapital, tier: 3 } } };
    expect(checkAchievements(twoAtTierThree)).not.toContain('builder_of_wonders');
    const threeAtTierThree = {
      ...state,
      greatProjects: { great_pyramids: { regionId: frCapital, tier: 3 }, hanging_gardens: { regionId: frCapital, tier: 3 }, great_wall: { regionId: frCapital, tier: 2 }, great_library: { regionId: frCapital, tier: 3 } }
    };
    expect(checkAchievements(threeAtTierThree)).toContain('builder_of_wonders'); // 3 of the 4 are at tier 3; great_wall's tier 2 doesn't count
  });

  it('detects unbroken only in/past the Modern Age with no region ever ceded in peace', () => {
    const state = createInitialState({ playerNationId: 'fr' });
    const kingdomsClean = { ...state, age: 'kingdoms' };
    expect(checkAchievements(kingdomsClean)).not.toContain('unbroken'); // age too early
    const modernButBroken = { ...state, age: 'modern', nations: { ...state.nations, fr: { ...state.nations.fr, hasCededRegionInPeace: true } } };
    expect(checkAchievements(modernButBroken)).not.toContain('unbroken');
    const modernClean = { ...state, age: 'modern' };
    expect(checkAchievements(modernClean)).toContain('unbroken');
  });

  it('detects survive_to_victory only on GameStatus.VICTORY', () => {
    const active = createInitialState();
    expect(checkAchievements(active)).not.toContain('survive_to_victory');

    const won = { ...createInitialState(), gameStatus: GameStatus.VICTORY };
    expect(checkAchievements(won)).toContain('survive_to_victory');
  });

  it('detects master_diplomat at exactly the 3-nation threshold, not below it', () => {
    const state = createInitialState();
    const nationIds = Object.keys(state.nations).filter(id => !state.nations[id].isPlayer);

    const twoFriendly = { ...state, nations: { ...state.nations } };
    nationIds.slice(0, 2).forEach(id => {
      twoFriendly.nations[id] = { ...twoFriendly.nations[id], hasPeaceTreaty: true };
    });
    expect(checkAchievements(twoFriendly)).not.toContain('master_diplomat');

    const threeFriendly = { ...state, nations: { ...state.nations } };
    nationIds.slice(0, 3).forEach(id => {
      threeFriendly.nations[id] = { ...threeFriendly.nations[id], hasPeaceTreaty: true };
    });
    expect(checkAchievements(threeFriendly)).toContain('master_diplomat');
  });

  it('detects tech_titan once 12+ techs are researched', () => {
    const state = createInitialState();
    const fakeTechTree = {};
    for (let i = 0; i < 12; i++) fakeTechTree[`tech_${i}`] = { researched: true };
    const researched = { ...state, techTree: fakeTechTree };
    expect(checkAchievements(researched)).toContain('tech_titan');
    expect(checkAchievements(state)).not.toContain('tech_titan');
  });

  it('detects three_front_war at 3 simultaneous wars', () => {
    const state = createInitialState();
    const nationIds = Object.keys(state.nations).filter(id => !state.nations[id].isPlayer).slice(0, 3);
    const atWar = { ...state, nations: { ...state.nations } };
    nationIds.forEach(id => { atWar.nations[id] = { ...atWar.nations[id], isAtWar: true }; });
    expect(checkAchievements(atWar)).toContain('three_front_war');
  });

  it('every ACHIEVEMENTS entry has an id matching its key and a check function', () => {
    Object.entries(ACHIEVEMENTS).forEach(([key, def]) => {
      expect(def.id).toBe(key);
      expect(typeof def.check).toBe('function');
      expect(typeof def.name).toBe('string');
    });
  });
});
