// Phase W4: the independents' UI renders its models (44 px targets, brass only for the primary
// action, the placeholder shield, the honest action names).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { isIndependentNation } from '../../data/independents';
import { independentSheetModel } from './independentSheetModel';
import { IndependentSheetBody } from './IndependentSheet';
import IndependentCityCard from './IndependentCityCard';
import { ShieldMark } from './IndependentBits';

const ctx = vi.hoisted(() => ({ state: null }));
vi.mock('../../context/GameContext', () => ({ useGame: () => ({ state: ctx.state, dispatch: vi.fn() }) }));
// Imported after the mock is in place.
const { TributeDemandSheet, JoinOfferSheet } = await import('./TributeDemandSheet');
const { default: IndependentsList } = await import('./IndependentsList');

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const T = base.turnNumber;
const indeps = (p) => Object.values(base.nations).filter((n) => isIndependentNation(n) && !n.isEliminated && (!p || n.indep?.personality === p));
const html = (el) => renderToStaticMarkup(el);

describe('W4 independents UI', () => {
  it('the placeholder shield is a dot in the personality colour, never a letter', () => {
    const out = html(React.createElement(ShieldMark, { personality: 'raiders' }));
    expect(out).toContain('data-shield="raiders"');
    expect(out).toMatch(/<circle[^>]*fill="#c2410c"/);
    expect(out).not.toMatch(/<text/);
  });

  it('the sheet shows the honest actions as 44 px buttons; brass only on the primary', () => {
    const r = indeps('raiders')[0];
    const s = { ...base, resources: { ...base.resources, gold: 1000 }, tributeDemands: [{ id: 'd1', indepId: r.id, gold: 3, turns: 20, turn: T, expires: T + 3 }] };
    const m = independentSheetModel(s, r.id);
    const out = html(React.createElement(IndependentSheetBody, { model: m, onRun: () => {}, note: null, onClose: () => {} }));
    ['Attack without war', 'Pay tribute', 'Ask to join', 'Gift 50 gold', 'Demand tribute'].forEach((label) => expect(out).toContain(label));
    expect(out).toContain('data-testid="indep-demand"');
    expect(out).toContain('min-h-[44px]');
    expect((out.match(/(?<![:\w-])bg-fa-brass(?![\w-])/g) || []).length).toBe(1); // brass only on the one primary action (Field Atlas token, U1)
    expect(out).toContain('data-testid="indep-action-payTribute" data-ok="true"');
    // Raiders never join: the button stays (tappable for the reason), drawn as blocked.
    expect(out).toContain('data-testid="indep-action-join" data-ok="false"');
  });

  it('the city card summarises and opens the sheet with a 44 px button', () => {
    const t = indeps('tribal')[0];
    const out = html(React.createElement(IndependentCityCard, { state: base, nationId: t.id }));
    expect(out).toContain('data-testid="independent-attitude"');
    expect(out).toContain('data-testid="open-independent-sheet"');
    expect(out).toContain('min-h-[44px]');
  });

  it('the tribute sheet offers its choices as a radio group and one brass button', () => {
    const r = indeps('raiders')[0];
    ctx.state = { ...base, resources: { ...base.resources, gold: 500 }, tributeDemands: [{ id: 'd1', indepId: r.id, gold: 3, turns: 20, turn: T, expires: T + 3 }] };
    const out = html(React.createElement(TributeDemandSheet, { demandId: 'd1', onClose: () => {} }));
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain('data-testid="tribute-choice-pay"');
    expect(out).toContain('data-testid="tribute-choice-refuse"');
    expect(out).toContain('aria-checked="true"');
    expect((out.match(/fa-btn-primary/g) || []).length).toBe(1);
    expect(html(React.createElement(TributeDemandSheet, { demandId: 'gone', onClose: () => {} }))).toBe('');
  });

  it('the join offer sheet and the Relations list render', () => {
    const t = indeps('tribal')[0];
    ctx.state = { ...base, fog: { ...(base.fog || {}), on: false }, joinOffers: [{ id: 'j1', indepId: t.id, turn: T, expires: T + 5 }] };
    const offer = html(React.createElement(JoinOfferSheet, { offerId: 'j1', onClose: () => {} }));
    expect(offer).toContain('data-testid="join-accept"');
    const list = html(React.createElement(IndependentsList));
    expect(list).toContain('data-testid="independents-list"');
    expect((list.match(/data-testid="indep-row"/g) || []).length).toBe(12);
    expect(list).toContain('data-testid="indep-more"');
  });
});
