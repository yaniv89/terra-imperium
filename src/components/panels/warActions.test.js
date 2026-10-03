import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { declareWarModel } from './warActions';
import { spaceUnlocked, visibleTabs } from './ActionPanelTabs';

describe('declare war from anywhere (plan P2.1) and the Space tab (P5.3)', () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
  it('one model names the cost, the justification and the block', () => {
    const m = declareWarModel(s, 'de');
    expect(m.name).toBe('Germany'); expect(m.atWar).toBe(false); expect(m.costs).toBeTruthy(); expect(m.label).toMatch(/Declare war on Germany/);
    expect(declareWarModel(s, 'fr')).toBeNull();
    expect(declareWarModel(s, 'rebels')).toBeNull();
    const vassal = { ...s, nations: { ...s.nations, fr: { ...s.nations.fr, vassalOf: 'de' } } };
    expect(declareWarModel(vassal, 'de').enabled).toBe(false);
  });
  it('the Space tab waits for the Modern Age', () => {
    expect(spaceUnlocked(s)).toBe(false);
    expect(visibleTabs(s).map((t) => t.id)).toEqual(['domestic', 'tech', 'legacy']);
    expect(spaceUnlocked({ ...s, techAgeId: 'modern' })).toBe(true);
    expect(spaceUnlocked({ ...s, techTree: { ...s.techTree, science_computing: { researched: true } } })).toBe(true);
  });
});
