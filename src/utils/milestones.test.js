import { describe, it, expect } from 'vitest';
import { computeMilestones } from './milestones';
import { createInitialState } from '../context/GameContext';
import { GamePhases } from '../data/types';
import { INDEPENDENCE_WAR_ATTACKERS, HOSTILE_BLOCS } from '../data/nations';
import { getNationCapital } from '../data/regions';

const postState = () => ({ ...createInitialState(), phase: GamePhases.POST_STATE });

describe('computeMilestones (Phase 10)', () => {
  it('returns nothing before independence', () => {
    expect(computeMilestones(createInitialState())).toEqual([]);
  });

  it('includes a next-tech milestone with tech-point progress', () => {
    const milestones = computeMilestones(postState());
    const techMilestone = milestones.find(m => m.id === 'next_tech');
    expect(techMilestone).toBeDefined();
    expect(techMilestone.progress).toBe(0); // 0 tech points at game start
  });

  it('military_conquest progress reflects how many 1948-war-attacker capitals are held', () => {
    const state = postState();
    const regions = { ...state.regions };
    const capital = getNationCapital(INDEPENDENCE_WAR_ATTACKERS[0]);
    regions[capital] = { ...regions[capital], owner: 'player' };
    const milestones = computeMilestones({ ...state, regions });
    const conquest = milestones.find(m => m.id === 'military_conquest');
    expect(conquest.progress).toBeCloseTo(1 / INDEPENDENCE_WAR_ATTACKERS.length, 5);
  });

  it('economic_ascendancy progress is the weaker of the two sub-thresholds', () => {
    const state = postState();
    const milestones = computeMilestones({
      ...state,
      resources: { ...state.resources, money: 2500000, techPoints: 2000 } // money at 50%, TP at 100%
    });
    const economic = milestones.find(m => m.id === 'economic_ascendancy');
    expect(economic.progress).toBeCloseTo(0.5, 5);
  });

  it('diplomatic_hegemony progress reflects how many hostile-bloc nations are pacified', () => {
    const state = postState();
    const nations = { ...state.nations };
    const allMembers = Object.values(HOSTILE_BLOCS).flat();
    nations[allMembers[0]] = { ...nations[allMembers[0]], hasPeaceTreaty: true };
    const milestones = computeMilestones({ ...state, nations });
    const hegemony = milestones.find(m => m.id === 'diplomatic_hegemony');
    expect(hegemony.progress).toBeCloseTo(1 / allMembers.length, 5);
  });

  it('sorts milestones by progress descending (closest to completion first)', () => {
    const state = postState();
    const nations = { ...state.nations };
    Object.values(HOSTILE_BLOCS).flat().forEach(id => { nations[id] = { ...nations[id], hasPeaceTreaty: true }; });
    const milestones = computeMilestones({ ...state, nations });
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i - 1].progress).toBeGreaterThanOrEqual(milestones[i].progress);
    }
    expect(milestones[0].id).toBe('diplomatic_hegemony');
  });
});
