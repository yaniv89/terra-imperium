// src/components/battle/battleHudModel.test.js
// The battle screens' numbers: regiment cards by kind, the selection line, the city's housing and
// the 50% line, alerts between frames (at most two shown), and the result: XP by the campaign's
// formula, the general's fate by the same roll, the city under the 50% rule, Auto's odds.
import { describe, expect, it } from 'vitest';
import { regimentCards, selectionSummary, cityAssaultView, nextAlerts, visibleAlerts, minutesLeft, battleResultModel } from './battleHudModel';
import { hashRoll, COMMANDER_FALL_CHANCE } from '../../engine/aftermath';
import { XP_WIN } from '../../engine/battleOutcome';

const sq = (idx, o = {}) => ({ idx, side: 0, classId: 'infantry', ageId: 'bronze', strength: 50, maxStrength: 100, morale: 80, alive: true, onField: true, fled: false, routed: false, x: 256 * idx, y: 0, ...o });
const st = (kind, o = {}) => ({ kind, hp: 100, maxHp: 100, alive: true, x: 0, y: 0, ...o });

describe('battle HUD model', () => {
  it('groups your regiments by kind, biggest first, workers apart', () => {
    const hud = { squads: [sq(0), sq(1, { strength: 30 }), sq(2, { classId: 'ranged', strength: 100 }), sq(3, { classId: 'worker' }), sq(4, { side: 1 })] };
    const cards = regimentCards(hud, 0);
    expect(cards.map((c) => c.classId)).toEqual(['ranged', 'infantry']);
    expect(cards[1]).toMatchObject({ squads: 2, men: 80, share: 0.4 });
  });

  it('sums the selection', () => {
    expect(selectionSummary([sq(0), sq(1)])).toMatchObject({ squads: 2, men: 100, share: 0.5, morale: 80 });
    expect(selectionSummary([])).toBeNull();
  });

  it('the city: housing now and at the start, the 50% line', () => {
    const setup = { city: {}, structures: [st('keep', { housing: 20 }), st('house', { housing: 10 }), st('house', { housing: 10 }), st('house', { housing: 5 }), st('house', { housing: 5, ruinedAtStart: true }), st('gate')] };
    const hud = { structures: [st('keep'), st('house', { alive: false }), st('house'), st('house'), st('house', { alive: false }), st('gate', { alive: false })] };
    const c = cityAssaultView(hud, setup);
    expect(c).toMatchObject({ total: 3, standing: 2, ruined: 1, maxLost: 1, housingStart: 45, housingNow: 35 });
    expect(c.gate.alive).toBe(false);
    expect(cityAssaultView(hud, { ...setup, city: null })).toBeNull();
  });

  it('alerts: a gate breached, a regiment routed; two shown at most', () => {
    const prev = { tick: 100, structures: [st('keep'), st('gate')], squads: [sq(0), sq(1)] };
    const cur = { tick: 120, structures: [st('keep', { hp: 40 }), st('gate', { alive: false })], squads: [sq(0, { routed: true }), sq(1)] };
    const a = nextAlerts(prev, cur, 0, {});
    expect(a.map((x) => x.kind).sort()).toEqual(['gate', 'keep', 'routed']);
    expect(a.find((x) => x.kind === 'gate').tone).toBe('good');
    const v = visibleAlerts(a, 130);
    expect(v.shown).toHaveLength(2);
    expect(v.older).toBe(1);
    expect(visibleAlerts(a, 120 + 20 * 20 + 1).shown).toHaveLength(0);
    expect(minutesLeft(1800, 1)).toBe(30);
    expect(minutesLeft(1800, 3)).toBe(10);
  });

  it('the result: XP by the formula, the general by the same roll, the city under the 50% rule', () => {
    const setup = {
      battleType: 'assault', city: {},
      sides: [{ ageId: 'bronze', units: [{ id: 'a', strength: 100 }, { id: 'b', strength: 80 }] }, { ageId: 'bronze', units: [{ id: 'd', strength: 90 }] }],
      structures: [st('keep'), ...Array.from({ length: 10 }, (_, i) => st('house', { manifestId: `h${i}` })), st('tower', { manifestId: 't1' })]
    };
    const ended = { result: {
      outcome: 'attacker',
      attackerUnits: [{ id: 'a', classId: 'infantry', strength: 70, xp: 0 }, { id: 'b', classId: 'ranged', strength: 0, commanderId: 'g1', xp: 0 }],
      defenderUnits: [{ id: 'd', classId: 'infantry', strength: 0 }],
      report: { deployedAttackerIds: ['a', 'b'], tactical: { reason: 'keepTaken', durationSec: 600, xpBonusById: { a: 5 }, cityDamage: { destroyed: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 't1'], damaged: [] }, economy: [{ workersLost: 3, looted: 40 }, { workersLost: 0, looted: 0 }] } }
    } };
    const m = battleResultModel(ended, setup, 0, { turnNumber: 31, hiredCommanders: { g1: { name: 'Sargon' } }, auto: { win: 0.62 } });
    expect(m.verdict).toBe('Victory');
    expect(m.mine).toMatchObject({ start: 180, end: 70, lost: 110, destroyed: 1 });
    expect(m.xp).toEqual([expect.objectContaining({ id: 'a', gained: XP_WIN + 5 })]);
    const falls = hashRoll('b|31') < COMMANDER_FALL_CHANCE;
    expect(m.generals[0].fate).toBe(falls ? 'fell' : 'escaped');
    expect(m.city).toMatchObject({ total: 10, ruined: 7, maxLost: 5, carried: 5, kept: 5, otherDown: 1 });
    expect(m.workersLost).toBe(3);
    expect(m.loot.gold).toBe(40);
    expect(m.auto).toMatch(/62%/);
  });
});
