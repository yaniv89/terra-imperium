// src/components/battle/battleHudModel.test.js
// The battle screens' numbers: the context panel's state, the selection line, the city's housing and
// the houses ruined, alerts between frames (at most two shown), and the result: without a receipt
// the battle's own reading (XP by the campaign's formula, the general's fate by the same roll),
// with one (src/engine/battleReceipt.js) what the campaign commits.
import { describe, expect, it } from 'vitest';
import { contextFor, selectionSummary, cityAssaultView, nextAlerts, visibleAlerts, minutesLeft, battleResultModel, armyTally, armyTallyText, enemyObjectives, supplyView, supplyRate, strengthShare, lootView, objectiveLine, endReasonText } from './battleHudModel';
import { battleGoal } from './battleText';
import { hashRoll, COMMANDER_FALL_CHANCE } from '../../engine/aftermath';
import { XP_WIN } from '../../engine/battleOutcome';

const sq = (idx, o = {}) => ({ idx, side: 0, classId: 'infantry', ageId: 'bronze', strength: 50, maxStrength: 100, morale: 80, alive: true, onField: true, fled: false, routed: false, x: 256 * idx, y: 0, ...o });
const st = (kind, o = {}) => ({ kind, hp: 100, maxHp: 100, alive: true, x: 0, y: 0, ...o });

describe('battle HUD model', () => {
  it('the context panel follows the selection', () => {
    expect(contextFor({})).toBe('none');
    expect(contextFor({ selectedSquads: [sq(0)] })).toBe('army');
    expect(contextFor({ selectedSquads: [sq(0, { classId: 'worker' })] })).toBe('workers');
    expect(contextFor({ selectedSquads: [sq(0, { classId: 'worker' }), sq(1)] })).toBe('mixed');
    expect(contextFor({ building: { built: true } })).toBe('building');
    expect(contextFor({ building: { built: false } })).toBe('site');
    expect(contextFor({ inspect: { kind: 'structure', index: 0 } })).toBe('inspect');
    expect(contextFor({ selectedSquads: [sq(0, { classId: 'worker' })], armed: { type: 'place', building: 'house' } })).toBe('place');
    expect(contextFor({ selectedSquads: [sq(0)], armed: 'attackMove' })).toBe('army');
  });

  it('sums the selection', () => {
    expect(selectionSummary([sq(0), sq(1)])).toMatchObject({ squads: 2, men: 100, share: 0.5, morale: 80 });
    expect(selectionSummary([])).toBeNull();
  });

  it('the city: housing now and at the start, houses ruined', () => {
    const setup = { city: {}, structures: [st('keep', { housing: 20 }), st('house', { housing: 10 }), st('house', { housing: 10 }), st('house', { housing: 5 }), st('house', { housing: 5, ruinedAtStart: true }), st('gate')] };
    const hud = { structures: [st('keep'), st('house', { alive: false }), st('house'), st('house'), st('house', { alive: false }), st('gate', { alive: false })] };
    const c = cityAssaultView(hud, setup);
    expect(c).toMatchObject({ total: 3, standing: 2, ruined: 1, housingStart: 45, housingNow: 35 });
    expect(c.maxLost).toBeUndefined();
    expect(c.gate.alive).toBe(false);
    expect(cityAssaultView(hud, { ...setup, city: null })).toBeNull();
  });

  it('alerts: a gate breached, a regiment shaken (never "routed"), enemy squads broke; two shown at most', () => {
    const prev = { tick: 100, structures: [st('keep'), st('gate')], squads: [sq(0), sq(1), sq(2, { side: 1 }), sq(3, { side: 1 })] };
    const cur = { tick: 120, structures: [st('keep', { hp: 40 }), st('gate', { alive: false })], squads: [sq(0, { morale: 15 }), sq(1, { routed: true }), sq(2, { side: 1, routed: true }), sq(3, { side: 1, routed: true })] };
    const a = nextAlerts(prev, cur, 0, {});
    expect(a.map((x) => x.kind).sort()).toEqual(['broke', 'gate', 'keep', 'shaken']);
    expect(a.find((x) => x.kind === 'shaken').squad).toBe(0);
    expect(a.find((x) => x.kind === 'broke').title).toBe('2 enemy squads broke');
    expect(a.find((x) => x.kind === 'gate').tone).toBe('good');
    const v = visibleAlerts(a, 130);
    expect(v.shown).toHaveLength(2);
    expect(v.older).toBe(2);
    // I203: shown 8 s, then only in the history (newest first)
    expect(visibleAlerts(a, 120 + 8 * 20 + 1).shown).toHaveLength(0);
    expect(visibleAlerts(a, 120 + 8 * 20 + 1).history).toHaveLength(4);
    expect(visibleAlerts(a, 120 + 8 * 20 + 1).older).toBe(4);
    expect(minutesLeft(1800, 1)).toBe(30);
    expect(minutesLeft(1800, 3)).toBe(10);
  });

  it('I196, I197: the enemy objective as far as it is known, nearest first, or why there is none', () => {
    const setup = { sides: [{ ageId: 'bronze' }, { ageId: 'bronze' }], map: { w: 100, h: 60, attackerEdge: 2, keep: { x: 80, y: 30 } } };
    const keepHud = { structures: [st('keep', { x: 80 * 256, y: 30 * 256 })], squads: [], eco: null };
    expect(enemyObjectives(keepHud, setup, 0).targets[0]).toMatchObject({ x: 80, y: 30, label: 'Their keep' });
    // Defending: the keep is yours; their camp counts once seen (the view leaves out the unseen).
    const eco = { buildings: [
      { idx: 0, side: 0, type: 'camp', x: 10 * 256, y: 30 * 256, alive: true, built: true, proxy: false },
      { idx: 1, side: 0, type: 'barracks', x: 30 * 256, y: 30 * 256, alive: true, built: true, proxy: false },
      { idx: 2, side: 0, type: 'house', x: 40 * 256, y: 30 * 256, alive: true, built: true, proxy: false },
      { idx: 3, side: 1, type: 'barracks', x: 70 * 256, y: 30 * 256, alive: true, built: true, proxy: false }] };
    const seen = enemyObjectives({ ...keepHud, eco }, setup, 1, { x: 50, y: 30 });
    expect(seen.targets.map((t) => t.x)).toEqual([30, 10]); // no house, nothing of yours, nearest first
    expect(seen.note).toBeNull();
    const none = enemyObjectives({ structures: [st('keep', { x: 0, y: 0 })], squads: [], eco: { buildings: [] } }, setup, 1);
    expect(none.targets).toEqual([]);
    expect(none.note).toMatch(/not seen yet.*west/);
    expect(none.fallback).toEqual({ x: 8, y: 30 });
    const troops = enemyObjectives({ structures: [], squads: [sq(0, { side: 0, x: 256 * 20, y: 256 * 10 }), sq(1, { side: 0, visible: false })], eco: { buildings: [] } }, setup, 1);
    expect(troops.targets).toEqual([{ x: 20, y: 10, label: 'Enemy troops in sight' }]);
  });

  it('U12: Battle Supply now, cap, low under the cheapest power, and the rise a second', () => {
    const h = { supply: [90.6, 0], powers: [{ label: 'Rally Cry', cost: 120, usesLeft: 1 }, { label: 'Spent', cost: 50, usesLeft: 0 }] };
    expect(supplyView(h, { supplyCap: 350 }, 0)).toMatchObject({ now: 90, cap: 350, low: true, costs: [{ label: 'Rally Cry', cost: 120 }] });
    expect(supplyView({ ...h, supply: [130, 0] }, { supplyCap: 350 }, 0).low).toBe(false);
    // +2 a second, a spend of 120 left out
    expect(supplyRate([{ tick: 0, v: 100 }, { tick: 20, v: 102 }, { tick: 40, v: -16 }, { tick: 60, v: -14 }])).toBe(1.3);
    expect(supplyRate([{ tick: 0, v: 1 }])).toBeNull();
  });

  it('the result without a campaign: XP by the formula, the general by the same roll, the houses ruined', () => {
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
    expect(m.state).toBe('preview');
    expect(m.city).toMatchObject({ committed: false, total: 10, ruined: 7, otherDown: 1 });
    expect(m.city.maxLost).toBeUndefined();
    expect(m.workersLost).toBe(3);
    // Gold looted in the battle is spent in it: never shown as gold for the treasury.
    expect(m.loot).toEqual({ gold: 40, banked: false });
    expect(m.auto).toMatch(/62%/);
  });
});

describe('I195: the army tally', () => {
  it('says where every squad went: on the field, killed, routed, withdrew, arriving, kept out', () => {
    const q = (o) => ({ side: 0, classId: 'infantry', alive: true, onField: true, fled: false, routed: false, enterTick: -1, ...o });
    const hud = { squads: [
      q({}), q({}), q({ alive: false }), q({ routed: true }), q({ fled: true }), q({ onField: false, enterTick: 500 }),
      q({ onField: false }), q({ classId: 'worker' }), q({ side: 1 })
    ] };
    const t = armyTally(hud, 0);
    expect(t).toEqual({ field: 2, routed: 1, killed: 1, withdrew: 1, arriving: 1, out: 1 });
    expect(armyTallyText(t)).toBe('2 on the field, 1 killed, 1 routed, 1 withdrew, 1 arriving, 1 kept out (over 300)');
    expect(armyTallyText(armyTally(hud, 1))).toBe('1 on the field');
  });
});

describe('battle endings lane: who is winning, the objective, the loot, the reason', () => {
  it('strength left as a share of what each side brought: routed, fled and dead are gone, laborers and held-back squads left out', () => {
    const hud = { squads: [
      sq(0, { strength: 50, startStrength: 100 }), sq(1, { strength: 100, startStrength: 100, routed: true }),
      sq(2, { classId: 'worker', strength: 10, startStrength: 10 }), sq(3, { onField: false, enterTick: -1, strength: 100, startStrength: 100 }),
      sq(4, { side: 1, strength: 0, startStrength: 100, alive: false }), sq(5, { side: 1, strength: 100, startStrength: 100, onField: false, enterTick: 40 })
    ] };
    expect(strengthShare(hud, 0)).toBe(0.25);
    expect(strengthShare(hud, 1)).toBe(0.5); // a reinforcement still marching in counts
    expect(strengthShare({ squads: [] }, 0)).toBe(0);
  });

  it('the loot: burned of needed, taken once enough fell, and the raiders still to catch', () => {
    const setup = { raid: { needed: 2 }, structures: [st('keep'), st('house', { loot: true }), st('house', { loot: true }), st('house', { loot: true })] };
    const hud = { structures: [st('keep'), st('house', { alive: false }), st('house'), st('house')], squads: [sq(0), sq(1, { classId: 'worker' }), sq(2, { side: 1 })] };
    expect(lootView(hud, setup)).toMatchObject({ burned: 1, needed: 2, total: 3, taken: false, raidersLeft: 1 });
    hud.structures[2] = st('house', { alive: false });
    expect(lootView(hud, setup)).toMatchObject({ burned: 2, taken: true });
    expect(lootView(hud, { structures: [] })).toBeNull();
    // the alerts: one burn from their win, then the loot taken
    const prev = { tick: 0, structures: [st('keep'), st('house'), st('house'), st('house')], squads: hud.squads };
    const near = nextAlerts(prev, { ...prev, tick: 1, structures: [st('keep'), st('house', { alive: false }), st('house'), st('house')] }, 1, setup);
    expect(near.map((a) => a.id)).toContain('loot-near');
    const taken = nextAlerts({ ...prev, structures: [st('keep'), st('house', { alive: false }), st('house'), st('house')] }, { ...prev, tick: 2, structures: hud.structures }, 1, setup);
    expect(taken.map((a) => a.id)).toContain('loot-taken');
  });

  it('the objective line: the base rule in words with bases, the type\'s own goal without', () => {
    expect(objectiveLine({ battleType: 'field', base: [1, 9] }, {}, 0, battleGoal)).toMatch(/9 base buildings/);
    expect(objectiveLine({ battleType: 'assault', base: [3, 4] }, {}, 1, battleGoal)).toMatch(/clock/);
    expect(objectiveLine({ battleType: 'sack', base: null }, {}, 1, battleGoal)).toMatch(/catch every last raider/);
    expect(objectiveLine({ battleType: 'field', base: null }, {}, 0, battleGoal)).toMatch(/Rout the enemy/);
  });

  it('one plain reason line from the end cause, told from your side', () => {
    expect(endReasonText('campDestroyed', false)).toBe('Your camp and base buildings were burned.');
    expect(endReasonText('campDestroyed', true)).toBe('You burned their camp and base buildings.');
    expect(endReasonText('looted', false)).toMatch(/still loose at the clock/);
    expect(endReasonText('raidersDriven', true)).toMatch(/drove the raiders off/);
    expect(endReasonText('mutualDestruction', false)).toBe('Neither army is left standing.');
    expect(endReasonText('nonsense', true)).toBe('');
  });
});
