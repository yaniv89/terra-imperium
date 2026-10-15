// Phase H5: the battle report sheet and the replay write Hebrew with no English words left.
// (renderToStaticMarkup reads the server language, so the hook is stood in for by the current language.)
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setCurrentLanguage } from '../../i18n/core';
import BattleReportSheet from './BattleReportSheet';
import BattleReplay from './BattleReplay';

const game = vi.hoisted(() => ({ state: { nations: { fr: { name: 'France' }, de: { name: 'Germany' } } } }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../../i18n/useT', async () => {
  const core = await import('../../i18n/core');
  const names = await import('../../i18n/names');
  return {
    useLanguage: () => core.getLanguage(),
    useT: () => {
      const lang = core.getLanguage();
      return {
        t: (key, vars) => core.translate(key, vars, lang), lang, rtl: core.isRtl(lang),
        n: (v, o) => core.formatNumber(v, o, lang), year: (y) => core.formatYear(y, lang),
        name: (kind, id, en) => names.nameOf(kind, id, en, lang),
        tx: (key, fb, vars) => (core.hasKey(key, 'en') ? core.translate(key, vars, lang) : core.dataText(key, fb, vars, lang)),
        dt: (key, en, vars) => core.dataText(key, en, vars, lang)
      };
    }
  };
});

const entry = {
  id: 'battle-1', turn: 3, year: -1990, kind: 'land', commanded: false, targetRegionId: null,
  attackerNationId: 'fr', defenderNationId: 'de', playerSide: 'attacker', outcome: 'attacker', captured: true, rounds: 2, terrain: 'hills',
  timeline: [{ round: 0, att: 2000, def: 900 }, { round: 1, att: 1900, def: 600 }, { round: 2, att: 1850, def: 300, defBroken: true }],
  sides: { attacker: [{ id: 'a', classId: 'infantry', before: 2000, after: 1850, routed: false }], defender: [{ id: 'd', classId: 'infantry', before: 900, after: 300, routed: true }] },
  fallen: { attacker: 1500, defender: 6000 }, fled: { attacker: 0, defender: 3000 }
};
const words = (html) => (html.replace(/<[^>]*>/g, ' ').match(/[A-Za-z]{3,}/g) || []);

describe('battle reports in Hebrew', () => {
  beforeEach(() => { setCurrentLanguage('he'); });
  afterEach(() => { setCurrentLanguage('en'); });
  it('the sheet, its list and the replay have no English words', () => {
    const second = { ...entry, id: 'battle-2', commanded: true, playerSide: 'defender', outcome: 'attacker', captured: true, timeline: null };
    const sheet = renderToStaticMarkup(React.createElement(BattleReportSheet, { entry, reports: [second, entry], onClose: vi.fn(), onReplay: vi.fn() }));
    expect(words(sheet)).toEqual([]);
    const replay = renderToStaticMarkup(React.createElement(BattleReplay, { entries: [entry], onOpen: vi.fn(), onClose: vi.fn() }));
    expect(words(replay)).toEqual([]);
    const multi = renderToStaticMarkup(React.createElement(BattleReplay, { entries: [entry, { ...entry, id: 'b2' }], onOpen: vi.fn(), onClose: vi.fn() }));
    expect(words(multi)).toEqual([]);
  });
});

