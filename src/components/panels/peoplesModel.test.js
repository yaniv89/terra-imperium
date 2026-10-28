import { describe, it, expect } from 'vitest';
import { peoplesModel, relationOf } from './peoplesModel';
import { metNations } from '../../engine/fog';
import { isIndependentNation } from '../../data/independents';
import { peoplesWorld } from '../../engine/testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const WORLD = peoplesWorld({ seed: 3 });
const FR = WORLD.playerNationId;

describe('peoples model (W07)', () => {
  const s = peoplesWorld({ seed: 3 });

  it('lists only the majors you met, with the unmet count, and filters by search', () => {
    const m = peoplesModel(s);
    const met = metNations(s).filter((id) => id !== FR && !isIndependentNation(s.nations[id]));
    expect(m.rows.map((r) => r.id).sort()).toEqual(met.sort());
    expect(m.counts.met).toBe(met.length);
    expect(m.counts.unmet).toBeGreaterThan(0);
    if (m.rows.length) {
      const one = m.rows[0];
      expect(peoplesModel(s, one.name.slice(0, 3)).rows.some((r) => r.id === one.id)).toBe(true);
    }
    expect(peoplesModel(s, 'zzzz-no-such-people').rows).toEqual([]);
  });

  it('puts a war first and names the relation', () => {
    const other = Object.values(s.nations).find((n) => n.id !== FR && !isIndependentNation(n));
    const st = {
      ...s,
      fog: { ...s.fog, met: { ...s.fog.met, [FR]: { ...(s.fog.met[FR] || {}), [other.id]: 1 } } },
      wars: [...(s.wars || []), { id: 'w-test', active: true, aggressor: FR, enemy: other.id, score: 0 }]
    };
    expect(relationOf(st, st.nations[other.id])).toBe('war');
    const m = peoplesModel(st);
    expect(m.rows[0].id).toBe(other.id);
    expect(m.counts.war).toBe(1);
    expect(relationOf(s, { ...other, hasMilitaryPact: true })).toBe('pact');
    expect(relationOf(s, { ...other, hasTradeAgreement: true })).toBe('trade');
  });
});
