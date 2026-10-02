import { describe, it, expect } from 'vitest';
import { createInitialState } from '../engine/gameReducer';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { getMarchLines, turnMarks } from './marchLines';

describe('march lines', () => {
  it('numbers the end of each turn of the march', () => {
    expect(turnMarks([1, 1, 2, 3, 3])).toEqual([{ index: 2, turn: 1 }, { index: 3, turn: 2 }, { index: 5, turn: 3 }]);
  });

  it('draws one line per marching stack plus the preview, in tiles', () => {
    const s = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
    const tiles = getTiles();
    const P = getNationCapital('fr');
    const t0 = s.regions[P].tile;
    const t1 = tiles.neighbors[t0].find((t) => tiles.land[t]);
    const t2 = tiles.neighbors[t1].find((t) => tiles.land[t] && t !== t0);
    const u = { id: 'a', ownerId: 'fr', regionId: P, tile: t0, domain: 'land', classId: 'infantry', strength: 1000, route: [t1, t2], routePace: 2 };
    const st = { ...s, units: { a: u, b: { ...u, id: 'b' } } };
    const lines = getMarchLines(st, { ok: true, path: [t0, t1], stepTurns: [1], haltTile: null });
    expect(lines.map((l) => l.kind)).toEqual(['active', 'preview']);
    expect(lines[0].points).toEqual([t0, t1, t2]);
    expect(lines[1].points).toEqual([t0, t1]);
  });
});
