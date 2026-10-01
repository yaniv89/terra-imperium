import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { ActionTypes } from '../../data/types';
import ResearchChoiceSheet, { needsResearchChoice } from './ResearchChoiceSheet';
import TechPanel from '../panels/TechPanel';

const game = vi.hoisted(() => ({ state: null, dispatch: vi.fn(), addLog: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../context/EffectsContext', () => ({ useEffects: () => ({ triggerEffect: vi.fn(), effects: [] }) }));

const fresh = () => createInitialState({ playerNationId: 'fr', rngSeed: 4 });

describe('research choice sheet', () => {
  it('asks at the start of a game, and not once something is chosen or the advisor picks', () => {
    const s = fresh();
    expect(needsResearchChoice(s)).toBe(true);
    const chosen = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: Object.keys(s.techTree)[0] } });
    expect(needsResearchChoice(chosen)).toBe(false);
    expect(needsResearchChoice(gameReducer(s, { type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }))).toBe(false);
    expect(needsResearchChoice({ ...s, activeEventId: 'x' })).toBe(false);
  });

  it('offers three techs with their turns, the advisor and the full tree', () => {
    game.state = fresh();
    const html = renderToStaticMarkup(React.createElement(ResearchChoiceSheet, { hidden: false }));
    expect(html).toContain('Choose your research');
    expect((html.match(/data-testid="research-option-/g) || []).length).toBe(3);
    expect(html).toContain('Let my advisor choose');
    expect(renderToStaticMarkup(React.createElement(ResearchChoiceSheet, { hidden: true }))).toBe('');
  });

  it('the Research tab shows science per turn, the current tech and the queue', () => {
    const s = fresh();
    const techs = Object.values(s.techTree).length ? Object.keys(s.techTree) : [];
    const military = techs.filter((id) => id.startsWith('military_'));
    game.state = gameReducer(s, { type: ActionTypes.RESEARCH_TECH, payload: { techId: military[1] } });
    const html = renderToStaticMarkup(React.createElement(TechPanel));
    expect(html).toMatch(/\+[\d.]+ science\/turn/);
    expect(html).toContain('data-testid="research-current"');
    expect(html).toContain('data-testid="research-queue"');
  });
});
