import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes } from '../../data/types';
import { createInitialState, gameReducer } from '../../engine/gameReducer';
import { getNeighborIds, REGIONS_DATA } from '../../data/regions';
import { validateInvasion } from '../../engine/invasion';
import PreBattleModal from './PreBattleModal';
import RegionInfoModal from '../modals/RegionInfoModal';

const game = vi.hoisted(() => ({ state: null, dispatch: vi.fn(), addLog: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../context/EffectsContext', () => ({ useEffects: () => ({ triggerEffect: vi.fn(), effects: [] }) }));
vi.mock('../../context/MapInsetsContext', () => ({ useReportInset: () => {} }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../hooks/useAutoPeek', () => ({ useAutoPeek: () => [false, vi.fn()] }));

let from, target;
const renderBattle = () => renderToStaticMarkup(React.createElement(PreBattleModal, { fromRegionId: from, targetRegionId: target, onClose: vi.fn() }));
const button = (html, testId) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0];

describe('attack buttons follow the engine validation', () => {
  beforeEach(() => {
    game.state = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
    from = Object.keys(game.state.regions).find(id => game.state.regions[id].owner === 'de' && getNeighborIds(id).some(n => game.state.regions[n]?.owner === 'de'));
    target = getNeighborIds(from).find(id => game.state.regions[id]?.owner === 'de');
    game.state.regions[from].owner = 'fr';
    game.state.wars = [{ id: 'w', aggressor: 'fr', enemy: 'de', active: true, score: 0 }];
    game.state.resources.gold = 10000;
    game.state.resources.mil = 10000;
    game.state.units = { army: { id: 'army', ownerId: 'fr', regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, movesLeft: 0 } };
  });
  it('disables both battle modes and explains the exhausted army after conquest', () => {
    expect(validateInvasion(game.state, from, target)).toMatchObject({ ok: false, reason: 'no_moves' });
    const html = renderBattle();
    expect(html).toContain('End the turn before attacking again.');
    expect(button(html, 'battle-choice-command')).toContain('disabled=""');
    expect(button(html, 'battle-choice-auto')).toContain('disabled=""');
    expect(button(html, 'battle-choice-calloff')).not.toContain('disabled=""');
  });
  it('disables the source action in the province panel as well', () => {
    const html = renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId: target, onClose: vi.fn() }));
    const action = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]).find(b => b.includes(`Invade from ${REGIONS_DATA[from].name}`));
    expect(action).toBeDefined();
    expect(action).toContain('disabled=""');
    expect(html).toContain('End the turn before attacking again.');
  });
  it('enables auto-resolve when movement is restored', () => {
    game.state.units.army.movesLeft = 1;
    expect(validateInvasion(game.state, from, target).ok).toBe(true);
    expect(button(renderBattle(), 'battle-choice-auto')).not.toContain('disabled=""');
  });
  it('blocks a second invasion after an actual undefended conquest', () => {
    game.state.units.army.movesLeft = 1;
    game.state = gameReducer(game.state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: from, targetRegionId: target } });
    expect(game.state.regions[target].owner).toBe('fr');
    expect(game.state.units.army.regionId).toBe(target);
    expect(game.state.units.army.movesLeft).toBe(0);
    from = target;
    target = getNeighborIds(from).find(id => game.state.regions[id]?.owner === 'de');
    expect(target).toBeDefined();
    expect(button(renderBattle(), 'battle-choice-auto')).toContain('disabled=""');
    expect(renderBattle()).toContain('End the turn before attacking again.');
  });
  it('blocks an unaffordable attack before opening a battle', () => {
    game.state.units.army.movesLeft = 1;
    game.state.resources = {};
    expect(renderBattle()).toContain('Not enough resources to launch this attack.');
    expect(button(renderBattle(), 'battle-choice-auto')).toContain('disabled=""');
  });
  it('blocks stale battle dialogs when the war has ended', () => {
    game.state.wars[0].active = false;
    expect(button(renderBattle(), 'battle-choice-auto')).toContain('disabled=""');
  });
});
