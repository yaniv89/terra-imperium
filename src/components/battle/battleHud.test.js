// src/components/battle/battleHud.test.js
// B01 / B05 / B06: the HUD renders its top bar, regiment cards and labelled commands; commands
// need a selection; the pause sheet replaces the bottom bar; the city card shows in a city assault;
// once the battle has ended only the top bar stays.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BattleHud from './BattleHud';

const sq = (idx, o = {}) => ({ idx, side: 0, classId: 'infantry', ageId: 'bronze', strength: 50, maxStrength: 100, morale: 80, alive: true, onField: true, fled: false, routed: false, x: 0, y: 0, reserve: false, enterTick: -1, ...o });
const hud = { tick: 100, supply: [200, 200], battleType: 'assault', assimilation: 0, powers: [{ id: 'rallyCry', label: 'Rally Cry', cost: 120, usesLeft: Infinity, readyIn: 0 }], squads: [sq(0), sq(1, { classId: 'ranged' }), sq(2, { side: 1 })], structures: [{ kind: 'keep', hp: 900, maxHp: 1000, alive: true, x: 0, y: 0, garrison: 0, garrisonSlots: 0 }], eco: null };
const setup = { sides: [{ ageId: 'bronze' }, { ageId: 'bronze' }], structures: [{ kind: 'keep' }] };
const base = { title: 'Siege of Susa', hud, setup, playerSide: 0, timeLeft: 1500, paused: false, started: true, speed: 1, armed: null, formation: 'line', selectedSquads: [], onTogglePause: vi.fn(), onSpeed: vi.fn(), onArm: vi.fn(), onFormation: vi.fn(), onSelectClass: vi.fn(), onCallReserve: vi.fn(), onCommand: vi.fn(), onRetreatAll: vi.fn(), onFocusKeep: vi.fn(), onPower: vi.fn(), onOpenAbilities: vi.fn(), hasAbilities: false };
const html = (props) => renderToStaticMarkup(React.createElement(BattleHud, { ...base, ...props }));
const btn = (h, id) => h.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] || '';

describe('BattleHud', () => {
  it('top bar, regiment cards, labelled commands that need a selection', () => {
    const h = html();
    expect(h).toContain('Siege of Susa');
    expect(h).toContain('25:00');
    expect(h).toContain('data-testid="battle-regiment-infantry"');
    expect(h).toContain('Rally Cry');
    expect(btn(h, 'battle-attack-move')).toContain('disabled=""');
    const sel = html({ selectedSquads: [hud.squads[0]] });
    expect(btn(sel, 'battle-attack-move')).not.toContain('disabled=""');
    expect(sel).toContain('data-testid="battle-selection"');
  });

  it('the selection card has a labelled 44 px x that clears it; the hint speaks of taps or clicks', () => {
    const h = html({ selectedSquads: [hud.squads[0]], onClearSelection: vi.fn(), selectHint: true });
    const x = btn(h, 'battle-clear-selection');
    expect(x).toContain('aria-label="Clear selection"');
    expect(x).toContain('w-11 h-11');
    expect(h).toContain('tap it again to let go');
    expect(html({ selectHint: true, mouse: true })).toContain('Right click orders');
    expect(html({ selectedSquads: [] , onClearSelection: vi.fn() })).not.toContain('battle-clear-selection');
  });

  it('paused: the sheet with Resume, speed, Switch to Auto and Retreat apart; no bottom bar', () => {
    const h = html({ paused: true, onAbandon: vi.fn() });
    expect(h).toContain('data-testid="battle-pause-sheet"');
    expect(h).toContain('battle-switch-auto');
    expect(h).toContain('battle-leave');
    expect(h).not.toContain('data-testid="battle-commands"');
  });

  it('a city assault shows the housing and the 50% rule; ended leaves only the top bar', () => {
    const citySetup = { ...setup, city: {}, structures: [{ kind: 'keep', housing: 20 }, { kind: 'house', housing: 10 }, { kind: 'house', housing: 10 }] };
    const cityHud = { ...hud, structures: [hud.structures[0], { kind: 'house', alive: false, hp: 0, maxHp: 1 }, { kind: 'house', alive: true, hp: 1, maxHp: 1 }] };
    const h = html({ setup: citySetup, hud: cityHud });
    expect(h).toContain('data-testid="battle-city"');
    expect(h).toContain('The 50% rule');
    const done = html({ ended: true });
    expect(done).toContain('data-testid="battle-top-bar"');
    expect(done).not.toContain('data-testid="battle-commands"');
  });
});
