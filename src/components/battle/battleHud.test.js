// src/components/battle/battleHud.test.js
// B01 / B05 / B06 / B10: the HUD renders its top bar, the small All button (no regiment bar) and
// the context panel: army commands only for army squads, Build only for laborers; the pause sheet replaces the bottom bar; the city card shows in a city assault;
// once the battle has ended only the top bar stays.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BattleHud from './BattleHud';

const sq = (idx, o = {}) => ({ idx, side: 0, classId: 'infantry', ageId: 'bronze', strength: 50, maxStrength: 100, morale: 80, alive: true, onField: true, fled: false, routed: false, x: 0, y: 0, reserve: false, enterTick: -1, ...o });
const hud = { tick: 100, supply: [200, 200], battleType: 'assault', assimilation: 0, powers: [{ id: 'rallyCry', label: 'Rally Cry', cost: 120, usesLeft: Infinity, readyIn: 0 }], squads: [sq(0), sq(1, { classId: 'ranged' }), sq(2, { side: 1 })], structures: [{ kind: 'keep', hp: 900, maxHp: 1000, alive: true, x: 0, y: 0, garrison: 0, garrisonSlots: 0 }], eco: null };
const setup = { sides: [{ ageId: 'bronze' }, { ageId: 'bronze' }], structures: [{ kind: 'keep' }] };
const base = { title: 'Siege of Susa', hud, setup, playerSide: 0, timeLeft: 1500, paused: false, started: true, speed: 1, armed: null, formation: 'line', selectedSquads: [], onTogglePause: vi.fn(), onSpeed: vi.fn(), onArm: vi.fn(), onFormation: vi.fn(), onSelectClass: vi.fn(), onCommand: vi.fn(), onRetreatAll: vi.fn(), onFocusKeep: vi.fn(), onPower: vi.fn(), onAbility: vi.fn(), abilities: [] };
const html = (props) => renderToStaticMarkup(React.createElement(BattleHud, { ...base, ...props }));
const btn = (h, id) => h.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] || '';

describe('BattleHud', () => {
  it('top bar, All, and a context panel that shows the selection\'s actions only', () => {
    const h = html();
    expect(h).toContain('Siege of Susa');
    expect(h).toContain('25:00');
    expect(h).not.toContain('battle-regiment-');
    expect(btn(h, 'battle-select-all')).toBeTruthy();
    expect(h).toContain('All 2');
    // U09: the powers sit behind one round wand with no visible text (named for screen readers)
    const wand = btn(h, 'battle-wand');
    expect(wand).toContain('aria-label="Abilities and powers');
    expect(h).not.toContain('Rally Cry');
    expect(h).not.toContain('data-testid="battle-attack-move"');
    const sel = html({ selectedSquads: [hud.squads[0]], context: 'army' });
    expect(btn(sel, 'battle-attack-move')).not.toContain('disabled=""');
    expect(sel).toContain('data-testid="battle-retreat-selected"');
    expect(sel).not.toContain('data-testid="battle-build"');
    expect(sel).toContain('data-testid="battle-selection"');
  });

  it('Build shows only with laborers; a building or a placement brings its own panel', () => {
    const eco = { stock: [100, 100, 100], pop: 5, cap: 10, workers: 2, idleWorkers: [3], buildings: [], nodes: [] };
    const ecoHud = { ...hud, eco };
    expect(html({ hud: ecoHud, selectedSquads: [hud.squads[0]], context: 'army' })).not.toContain('data-testid="battle-build"');
    expect(html({ hud: ecoHud, context: 'mixed', selectedSquads: [hud.squads[0]] })).toContain('data-testid="battle-build"');
    const w = html({ hud: ecoHud, context: 'workers', panel: React.createElement('div', { 'data-testid': 'battle-build-menu' }) });
    expect(w).toContain('data-testid="battle-build-menu"');
    expect(w).not.toContain('data-testid="battle-attack-move"');
    expect(w).not.toContain('data-testid="battle-powers"');
    expect(w).toContain('Idle 1');
    expect(w).toContain('data-testid="battle-hq"');
    const b = html({ hud: ecoHud, context: 'building', panel: React.createElement('div', { 'data-testid': 'battle-building-actions' }) });
    expect(b).toContain('data-testid="battle-building-actions"');
    expect(b).not.toContain('data-testid="battle-commands"');
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

  it('U12: Battle Supply now and cap in every battle, red when under the cheapest power', () => {
    const plain = html({ setup: { ...setup, supplyCap: 350 } });
    expect(btn(plain, 'battle-supply')).toContain('aria-label="Battle supply 200 of 350"');
    const eco = { stock: [10, 20, 30, 40], pop: 5, cap: 10, workers: 2, idleWorkers: [], buildings: [], nodes: [] };
    const low = html({ hud: { ...hud, eco, supply: [90, 0] }, setup: { ...setup, supplyCap: 350 } });
    expect(btn(low, 'battle-supply')).toContain('Battle supply 90 of 350, low');
    expect(low).toContain('data-testid="battle-stock-stone"');
  });

  it('I206: speed and pause keep the same 44 px slots before Start, in battle and paused; Start is also in the deploy card', () => {
    const slots = (h) => [btn(h, 'battle-speed').replace(/aria-label="[^"]*"/, ''), btn(h, 'battle-pause').match(/class="([^"]*)"/)[1].replace(/ !bg-fa-brass.*$/, '')];
    const deploy = html({ started: false, paused: true });
    const fight = html();
    expect(slots(deploy)[0]).toBe(slots(fight)[0]);
    expect(slots(deploy)[1]).toBe(slots(fight)[1]);
    expect(btn(fight, 'battle-pause')).toContain('!w-11 !h-11');
    expect(deploy).toContain('data-testid="battle-start"');
    // I204: short, for the input in hand, never the old regiment cards
    expect(deploy).toContain('tap inside your zone');
    expect(html({ started: false, paused: true, mouse: true })).toContain('right click inside your zone');
    expect(deploy).not.toContain('regiment card');
  });

  it('I196, I199: Enemy and Map in the small buttons, Follow with an army selected', () => {
    const h = html({ onObjective: vi.fn(), onToggleMinimap: vi.fn(), onToggleFollow: vi.fn(), selectedSquads: [hud.squads[0]], context: 'army' });
    expect(btn(h, 'battle-objective')).toBeTruthy();
    expect(btn(h, 'battle-minimap-toggle')).toContain('aria-pressed="false"');
    expect(btn(h, 'battle-follow')).toContain('aria-pressed="false"');
    expect(btn(html({ onToggleFollow: vi.fn(), selectedSquads: [hud.squads[0]], context: 'army', follow: true }), 'battle-follow')).toContain('aria-pressed="true"');
  });

  it('a city assault shows the housing and the houses ruined, never the 50% rule; ended leaves only the top bar', () => {
    const citySetup = { ...setup, city: {}, structures: [{ kind: 'keep', housing: 20 }, { kind: 'house', housing: 10 }, { kind: 'house', housing: 10 }] };
    const cityHud = { ...hud, structures: [hud.structures[0], { kind: 'house', alive: false, hp: 0, maxHp: 1 }, { kind: 'house', alive: true, hp: 1, maxHp: 1 }] };
    const h = html({ setup: citySetup, hud: cityHud });
    expect(h).toContain('data-testid="battle-city"');
    // I202: the city card starts folded, a chip with the housing that opens it.
    expect(h).toContain('data-testid="battle-city-open"');
    expect(h).not.toContain('data-testid="battle-city-houses"');
    expect(h).toContain('ruined <span class="fa-num">1/2</span>');
    expect(h).not.toContain('50% rule');
    expect(h).not.toMatch(/At most \d+ carry/);
    const done = html({ ended: true });
    expect(done).toContain('data-testid="battle-top-bar"');
    expect(done).not.toContain('data-testid="battle-commands"');
  });
});
