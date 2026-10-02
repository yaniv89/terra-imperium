import { describe, it, expect } from 'vitest';
import { createInitialState } from '../engine/gameReducer';
import { getMarchLines, turnMarks } from './marchLines';

describe('march lines', () => {
  it('numbers the end of each turn of the march', () => {
    expect(turnMarks([1, 1, 2, 3, 3])).toEqual([{ index: 2, turn: 1 }, { index: 3, turn: 2 }, { index: 5, turn: 3 }]);
  });

  it('draws one line per marching stack plus the preview', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const u = { id: 'a', ownerId: 'fr', regionId: 'fr-35', domain: 'land', classId: 'infantry', strength: 1000, route: ['fr-75', 'fr-51'], routePace: 2 };
    const st = { ...s, units: { a: u, b: { ...u, id: 'b' } } };
    const lines = getMarchLines(st, { ok: true, path: ['fr-35', 'fr-75'], stepTurns: [1], haltAt: null });
    expect(lines.map((l) => l.kind)).toEqual(['active', 'preview']);
    expect(lines[0].points).toEqual(['fr-35', 'fr-75', 'fr-51']);
  });
});
