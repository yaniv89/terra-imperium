import { describe, it, expect } from 'vitest';
import { chronicleModel } from './chronicleModel';
import { tickChronicle, tileRuns, BATTLES_KEPT } from '../../engine/chronicle';
import { peoplesWorld } from '../../engine/testWorld';

const WORLD = peoplesWorld({ seed: 11 });
const turn = (s, patch = {}) => ({ ...s, turnNumber: s.turnNumber + 1, ...patch });
const report = (n, fallen, outcome = 'attacker') => ({ id: `battle-${n}`, turn: 5, name: `Battle ${n}`, tile: 1, kind: 'land', playerSide: 'attacker', outcome, fallen: { attacker: fallen, defender: 0 } });

describe('chronicleModel', () => {
  it('has no chapters before the story starts', () => {
    expect(chronicleModel(WORLD)).toEqual([]);
  });

  it('a chapter with no battles has an empty list and the open chapter shows the tiles held now', () => {
    const s = tickChronicle(WORLD, turn(WORLD));
    const [c] = chronicleModel(s);
    expect(c.open).toBe(true);
    expect(c.battles).toEqual([]);
    expect(c.runs).toEqual(tileRuns(s));
  });

  it('a chapter with many battles lists the biggest, each with its result', () => {
    const reports = Array.from({ length: BATTLES_KEPT + 3 }, (_, i) => report(i + 1, 10 + i, i === 0 ? 'stalemate' : i === 1 ? 'defender' : 'attacker'));
    const first = tickChronicle(WORLD, turn(WORLD));
    const s = tickChronicle(first, turn(first, { battleReports: reports, battleReportSeq: reports.length }));
    const [c] = chronicleModel(s);
    expect(c.battles).toHaveLength(BATTLES_KEPT);
    expect(c.battles[0].fallen).toBe(10 + BATTLES_KEPT + 2);
    expect(c.battles.every((b) => ['won', 'lost', 'drawn'].includes(b.result))).toBe(true);
  });
});
