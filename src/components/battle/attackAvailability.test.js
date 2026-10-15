import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes } from '../../data/types';
import { gameReducer } from '../../engine/gameReducer';
import { getNeighborIds, REGIONS_DATA } from '../../data/regions';
import { validateInvasion } from '../../engine/invasion';
import { addCity } from '../../engine/testWorld';
import PreBattleModal from './PreBattleModal';
import RegionInfoModal from '../modals/RegionInfoModal';
import { atGates } from '../../engine/testWorld';
import { getTouchingIds } from '../../data/regions';
import { peoplesWorld, rivalOf } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 7 });
const FR = WORLD.playerNationId;
const DE = rivalOf(WORLD, 0);

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
    // Two German cities beside the capital, so a conquered one still has a German neighbour.
    // packed tighter than the settling rule so the two German lands touch (testWorld loose)
    const first = addCity(peoplesWorld({ seed: 7 }), DE, { loose: true });
    const second = addCity(first.state, DE, { near: first.cityId, loose: true });
    game.state = addCity(second.state, DE, { near: second.cityId, loose: true }).state; // a third, so a conquered city still has a neighbour to attack
    from = Object.keys(game.state.regions).find(id => game.state.regions[id].owner === DE && getNeighborIds(id).some(n => game.state.regions[n]?.owner === DE));
    target = getNeighborIds(from).find(id => game.state.regions[id]?.owner === DE);
    game.state.regions[from].owner = FR;
    game.state.wars = [{ id: 'w', aggressor: FR, enemy: DE, active: true, score: 0 }];
    game.state.resources.gold = 10000;
    game.state.resources.mil = 10000;
    game.state.units = { army: { id: 'army', ownerId: FR, regionId: from, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, movesLeft: 0 } };
    game.state = atGates(game.state, from, target); // the attack needs touching lands or an army beside the city
  });
  it('disables both battle modes and explains the exhausted army after conquest', { timeout: 20000 }, () => {
    expect(validateInvasion(game.state, from, target)).toMatchObject({ ok: false, reason: 'no_moves' });
    const html = renderBattle();
    expect(html).toContain('End the turn before attacking again.');
    expect(button(html, 'battle-choice-command')).toContain('disabled=""');
    expect(button(html, 'battle-choice-auto')).toContain('disabled=""');
    expect(button(html, 'battle-choice-calloff')).not.toContain('disabled=""');
  });
  it('disables the source action in the province panel as well', () => {
    const html = renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId: target, onClose: vi.fn() }));
    const action = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m => m[0]).find(b => b.includes(`Invade ${game.state.regions[target].name}`));
    expect(action).toBeDefined();
    expect(action).toContain('disabled=""');
    expect(html).toContain('End the turn before attacking again.');
    // the label names the target and where the army stands, never the city it is based at
    expect(action).toContain('(army ');
    expect(action).not.toContain(`from ${REGIONS_DATA[from].name}`);
  });
  it('offers no claim to fabricate while already at war with the owner', () => {
    expect(renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId: target, onClose: vi.fn() }))).not.toContain('Fabricate a claim');
    game.state.wars[0].active = false;
    game.state.wars = [];
    // at peace the card may offer it (when in range); at war it must not
    expect(renderToStaticMarkup(React.createElement(RegionInfoModal, { regionId: target, onClose: vi.fn() }))).toContain('claim-card');
  });
  it('enables auto-resolve when movement is restored', () => {
    game.state.units.army.movesLeft = 1;
    expect(validateInvasion(game.state, from, target).ok).toBe(true);
    expect(button(renderBattle(), 'battle-choice-auto')).not.toContain('disabled=""');
  });
  it('blocks a second invasion after an actual conquest of an empty city', () => {
    game.state.units.army.movesLeft = 1;
    // Its defences already broken: Auto takes an empty city only when an attack brings its HP to 0 (cityAssault.js).
    game.state.regions[target] = { ...game.state.regions[target], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } };
    game.state = gameReducer(game.state, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: from, targetRegionId: target } });
    expect(game.state.regions[target].owner).toBe(FR);
    expect(game.state.units.army.regionId).toBe(target);
    expect(game.state.units.army.movesLeft).toBe(0);
    from = target;
    target = getTouchingIds(from).find(id => game.state.regions[id]?.owner === DE) || getNeighborIds(from).find(id => game.state.regions[id]?.owner === DE);
    expect(target).toBeDefined();
    game.state = atGates(game.state, from, target);
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
