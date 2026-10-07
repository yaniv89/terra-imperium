import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BattleReportSheet from './BattleReportSheet';
import BattleReplay from './BattleReplay';

const game = vi.hoisted(() => ({ state: { nations: { fr: { name: 'France' }, de: { name: 'Germany' } } } }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));

const entry = {
  id: 'battle-1', turn: 3, year: -1990, kind: 'land', commanded: false, targetRegionId: null,
  attackerNationId: 'fr', defenderNationId: 'de', playerSide: 'attacker', outcome: 'attacker', captured: true, rounds: 2, terrain: 'hills',
  timeline: [{ round: 0, att: 2000, def: 900 }, { round: 1, att: 1900, def: 600 }, { round: 2, att: 1850, def: 300, defBroken: true }],
  sides: { attacker: [{ id: 'a', classId: 'infantry', before: 2000, after: 1850, routed: false }], defender: [{ id: 'd', classId: 'infantry', before: 900, after: 300, routed: true }] },
  fallen: { attacker: 1500, defender: 6000 }, fled: { attacker: 0, defender: 3000 }
};

describe('battle report sheet', () => {
  it('shows the outcome, the fallen, the chart and both sides', () => {
    const html = renderToStaticMarkup(React.createElement(BattleReportSheet, { entry, onClose: vi.fn(), onReplay: vi.fn() }));
    expect(html).toContain('Victory');
    expect(html).toContain('taken');
    expect(html).toContain('<span class="font-semibold">1,500</span> lost');
    expect(html).toContain('<span class="font-semibold">6,000</span> lost');
    expect(html).toContain('Fled the field');
    expect(html).toContain('View replay');
    expect(html).toContain('Strength each round');
    expect(html).toContain('20,000 → 18,500');
    expect(html).toContain('Broke and fled'); // an entry saved before fates: the loser's broken unit
    expect(html).toContain('Held the field');
  });

  it('lists every battle with filters when given the history', () => {
    const second = { ...entry, id: 'battle-2', commanded: true, playerSide: 'defender', outcome: 'attacker', captured: true, timeline: null };
    const html = renderToStaticMarkup(React.createElement(BattleReportSheet, { entry, reports: [second, entry], onClose: vi.fn() }));
    expect(html.match(/data-testid="battle-report-row"/g)).toHaveLength(2);
    expect(html).toContain('Sieges');
    expect(html).toContain('>Lost<');
    expect(html).toContain('>Command<');
  });

  it('renders nothing without an entry, and the replay starts on the first round', () => {
    expect(renderToStaticMarkup(React.createElement(BattleReportSheet, { entry: null, onClose: vi.fn() }))).toBe('');
    const html = renderToStaticMarkup(React.createElement(BattleReplay, { entries: [entry], onOpen: vi.fn(), onClose: vi.fn() }));
    expect(html).toContain('Battle of');
    expect(html).toContain('Tap to skip');
    expect(html).toContain('20,000 men');
  });
});
