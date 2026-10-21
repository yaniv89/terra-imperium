import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { rulerSheetModel, rulerBadge } from './rulerSheetModel';
import { getTabBadge } from '../panels/ActionPanelTabs';
import { rulerPortrait } from './rulerPortrait';
import { PEOPLES } from '../../data/peoples';
import { BRANCHES, TIERS } from '../../data/rulerVirtues';

const game = () => createInitialState({ playerNationId: 'akkad', rngSeed: 7, scenario: { mode: 'peoples', size: 'standard', seed: 7 } });
const withRuler = (s, patch) => ({ ...s, nations: { ...s.nations, [s.playerNationId]: { ...s.nations[s.playerNationId], ruler: { ...s.nations[s.playerNationId].ruler, ...patch } } } });

describe('rulerSheetModel', () => {
  it('lists six attributes and a 5 x 6 tree; a fresh ruler has the founding virtue point only', () => {
    const m = rulerSheetModel(game());
    expect(m.attributes.map((a) => a.id)).toEqual(['adm', 'dip', 'mil', 'cmd', 'lrn', 'maj']);
    expect(m.branches).toHaveLength(BRANCHES.length);
    expect(m.branches[0].cells).toHaveLength(TIERS);
    expect(m.points).toMatchObject({ attribute: 0, virtue: 1 });
    expect(m.attributes.every((a) => !a.can)).toBe(true);
  });
  it('chip states: open tier 1 when a point waits, locked above, taken after the pick', () => {
    const m = rulerSheetModel(game());
    expect(m.branches[0].cells[0].state).toBe('open');
    expect(m.branches[0].cells[1].state).toBe('locked');
    const taken = rulerSheetModel(withRuler(game(), { traits: [m.branches[0].cells[0].id] }));
    expect(taken.branches[0].cells[0].state).toBe('taken');
  });
  it('the tab badge counts the points waiting', () => {
    const s = game();
    expect(rulerBadge(s)).toBe(1);
    expect(getTabBadge(s, 'ruler')).toBe(1);
    expect(getTabBadge(withRuler(s, { renown: 100 }), 'ruler')).toBeGreaterThan(1);
  });
  it('shows the ambitions offered, and an empty strip before the first turn', () => {
    const s = game();
    expect(rulerSheetModel(s).ambitions).toEqual([]);
    const next = { ...s, nations: { ...s.nations, [s.playerNationId]: { ...s.nations[s.playerNationId], ambitions: { ageId: 'stone', offers: [{ id: 'threeCities', base: 0 }, { id: 'lore', base: 0, done: 3 }], done: [] } } } };
    expect(rulerSheetModel(next).ambitions.map((a) => [a.id, a.done])).toEqual([['threeCities', false], ['lore', true]]);
  });
});

describe('rulerPortrait', () => {
  it('returns a bust placeholder for every theme, and the legacy world falls back', () => {
    const themes = new Set(Object.values(PEOPLES).map((p) => p.theme));
    themes.forEach((th) => {
      const id = Object.values(PEOPLES).find((p) => p.theme === th).id;
      expect(rulerPortrait(id, 'sargon').bust).toBeTruthy();
    });
    expect(rulerPortrait('france', 'Louis')).toMatchObject({ initial: 'L' });
    expect(rulerPortrait('france', 'Louis').bust).toBeTruthy();
  });
});
