// src/components/battle/battleReportsModel.test.js
// W16: the result from your side, the filters and the detail of a battle report entry.
import { describe, expect, it } from 'vitest';
import { fateRows, filterReports, reportDetail, reportGroup, reportRow, resultOf } from './battleReportsModel';

const base = {
  id: 'b1', turn: 29, year: -1948, kind: 'land', commanded: true, targetRegionId: null, battleType: 'assault',
  attackerNationId: 'ak', defenderNationId: 'el', playerSide: 'attacker', outcome: 'attacker', captured: true,
  timeline: [{ round: 0, att: 34, def: 28 }, { round: 1, att: 30, def: 10 }],
  sides: { attacker: [{ id: 'a', classId: 'infantry', before: 34, after: 24 }], defender: [{ id: 'd', classId: 'infantry', before: 28, after: 0 }] },
  fallen: { attacker: 96, defender: 231 }, fled: { attacker: 0, defender: 0 }
};
const state = { nations: { ak: { name: 'Akkad' }, el: { name: 'Elam' } } };

describe('W16 battle reports model', () => {
  it('names the result from your side', () => {
    expect(resultOf(base)).toEqual({ label: 'Victory', tone: 'win' });
    expect(resultOf({ ...base, outcome: 'defender' })).toEqual({ label: 'Repelled', tone: 'loss' });
    expect(resultOf({ ...base, playerSide: 'defender', outcome: 'defender' })).toEqual({ label: 'Held', tone: 'win' });
    expect(resultOf({ ...base, playerSide: 'defender' }).label).toBe('Lost');
    expect(resultOf({ ...base, outcome: 'stalemate' }).label).toBe('Stalemate');
  });

  it('filters by result, mode and kind', () => {
    const field = { ...base, id: 'b2', battleType: 'field', commanded: false, outcome: 'defender' };
    const sea = { ...base, id: 'b3', kind: 'naval', battleType: 'naval', commanded: false };
    const all = [base, field, sea];
    expect(reportGroup(field)).toBe('field');
    expect(reportGroup(sea)).toBe('sea');
    expect(filterReports(all, 'won').map((e) => e.id)).toEqual(['b1', 'b3']);
    expect(filterReports(all, 'lost').map((e) => e.id)).toEqual(['b2']);
    expect(filterReports(all, 'command').map((e) => e.id)).toEqual(['b1']);
    expect(filterReports(all, 'auto')).toHaveLength(2);
    expect(filterReports(all, 'siege').map((e) => e.id)).toEqual(['b1']);
  });

  it('a row and the detail: the losses on both sides, in and lost', () => {
    const row = reportRow(state, base);
    expect(row).toMatchObject({ mode: 'Command', losses: '-96 / -231', when: 'T29 · 1948 BCE' });
    const d = reportDetail(state, base);
    expect(d.yours).toEqual({ name: 'Akkad', in: 340, lost: 96 });
    expect(d.theirs).toEqual({ name: 'Elam', in: 280, lost: 231 });
    expect(d.summary).toMatch(/1 of their regiments destroyed; none of yours lost\./);
    expect(d.canReplay).toBe(true);
  });
});

describe('W16 unit fates', () => {
  const fated = {
    ...base,
    sides: {
      attacker: [{ id: 'a', classId: 'infantry', before: 34, after: 24, fate: 'held' }, { id: 'a2', classId: 'cavalry', before: 20, after: 8, routed: true, fate: 'pulledBack' }],
      defender: [
        { id: 'd', classId: 'infantry', before: 28, after: 0, fate: 'fellFighting' },
        { id: 'd2', classId: 'infantry', before: 20, after: 9, routed: true, fate: 'runDown', byCavalry: true },
        { id: 'd3', classId: 'ranged', before: 20, after: 9, routed: true, fate: 'runDown' },
        { id: 'd4', classId: 'ranged', before: 20, after: 12, routed: true, fate: 'escaped' },
        { id: 'd5', classId: 'infantry', before: 20, after: 15, fate: 'withdrew' },
        { id: 'd6', classId: 'naval', domain: 'naval', before: 20, after: 15, fate: 'runDown' }
      ]
    }
  };

  it('says each fate in plain words, men before and after', () => {
    expect(fateRows(fated, 'attacker').map((r) => r.text)).toEqual(['Held the field', 'Pulled back']);
    expect(fateRows(fated, 'defender').map((r) => r.text)).toEqual([
      'Destroyed in the fight', 'Run down by cavalry while fleeing', 'Caught and destroyed while fleeing',
      'Broke but escaped', 'Withdrew in good order', 'Sunk while falling back'
    ]);
    expect(fateRows(fated, 'attacker')[0]).toMatchObject({ menBefore: 340, menAfter: 240, tone: 'good' });
    expect(fateRows(fated, 'defender').map((r) => r.tone)).toEqual(['bad', 'bad', 'bad', 'warn', 'calm', 'bad']);
  });

  it('reads older reports saved without fates', () => {
    const old = { ...base, sides: { attacker: [{ id: 'a', classId: 'infantry', before: 34, after: 24 }, { id: 'a2', classId: 'infantry', before: 10, after: 4, routed: true }],
      defender: [{ id: 'd', classId: 'infantry', before: 28, after: 0 }, { id: 'd2', classId: 'infantry', before: 10, after: 5, routed: true }, { id: 'd3', classId: 'infantry', before: 10, after: 5 }] } };
    expect(fateRows(old, 'attacker').map((r) => r.fate)).toEqual(['held', 'pulledBack']);
    expect(fateRows(old, 'defender').map((r) => r.fate)).toEqual(['fellFighting', 'broke', 'withdrew']);
    expect(fateRows(old, 'defender')[1].text).toBe('Broke and fled');
    expect(fateRows({ ...old, sides: undefined }, 'attacker')).toEqual([]);
  });
});
