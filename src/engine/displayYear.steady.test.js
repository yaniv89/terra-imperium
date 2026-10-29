import { describe, it, expect } from 'vitest';
import { displayYear } from './displayYear';
import { withAgesResearched, getResearchCost } from './research';
import { addNationModifier } from './modifiers/timed';
import { TECH_TREE } from '../data/techTree';
import { peoplesWorld } from './testWorld';

describe('year label', () => {
  it('does not go back when a tech under way gets dearer (manual playtest 29 Oct: T25 1253 BCE, T26 1283 BCE)', () => {
    const S = peoplesWorld({ seed: 7 });
    const me = S.playerNationId;
    const state = withAgesResearched(S, me, 'bronze');
    const tech = Object.values(TECH_TREE).find((t) => t.ageId === 'bronze').id;
    const going = { ...state, research: { ...state.research, current: tech, progress: { [tech]: getResearchCost(state, me, tech) / 2 } } };
    const before = displayYear(going);
    const dearer = { ...going, nations: { ...going.nations, [me]: addNationModifier(going.nations[me], { sourceType: 'test', sourceId: 't', label: 't', mods: { 'national.researchCost': 0.3 }, duration: 10, turnNumber: going.turnNumber }) } };
    expect(getResearchCost(dearer, me, tech)).toBeGreaterThan(getResearchCost(going, me, tech));
    expect(displayYear(dearer)).toBe(before);
  });
});
