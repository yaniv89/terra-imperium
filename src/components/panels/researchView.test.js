import { describe, it, expect } from 'vitest';
import { ageRows, techEtaText } from './researchView';
import { AGE_ORDER } from '../../data/ages';
import { TECH_TREE } from '../../data/techTree';
import { peoplesWorld } from '../../engine/testWorld';

// The All techs list by age (plan U6, R10).
describe('ageRows: the age tabs of All techs', () => {
  const s = { ...peoplesWorld({ seed: 7 }), researchFocus: null };

  it('lists every tech under exactly one age tab', () => {
    const ids = AGE_ORDER.flatMap((ageId) => ageRows(s, ageId, 3).map((r) => r.info.tech.id));
    expect(ids.slice().sort()).toEqual(Object.keys(TECH_TREE).sort());
  });

  it('gives an open tech its remaining cost over science a turn, rounded up', () => {
    const rows = ageRows(s, s.techAgeId, 3).filter((r) => r.rowState === 'available' && !r.info.gate);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => {
      const turns = Math.max(1, Math.ceil((r.info.cost - r.info.progress) / 3));
      expect(r.info.turns).toBe(turns);
      expect(r.line).toContain(String(turns));
    });
  });

  it('shows a future-age tech its age, never a turn count', () => {
    const rows = ageRows(s, AGE_ORDER[AGE_ORDER.length - 2], 3);
    expect(rows.every((r) => r.rowState === 'future')).toBe(true);
    rows.forEach((r) => { expect(r.line).toMatch(/Opens in the/); expect(r.line).not.toMatch(/\d/); });
  });

  it('names a missing prerequisite of a locked tech (a chip in the detail)', () => {
    const locked = AGE_ORDER.flatMap((ageId) => ageRows(s, ageId, 3)).filter((r) => r.rowState === 'locked' && r.needs.length);
    expect(locked.length).toBeGreaterThan(0);
    locked.forEach((r) => {
      r.needs.forEach((p) => { expect(TECH_TREE[r.info.tech.id].prerequisites).toContain(p); expect(s.techTree[p]?.researched).toBeFalsy(); });
      expect(r.line).toMatch(/research|turn/);
    });
  });

  it('puts what you can act on first: current, queued, open, locked, later ages, known', () => {
    const order = ['current', 'queued', 'available', 'locked', 'future', 'researched'];
    const states = ageRows(s, s.techAgeId, 3).map((r) => order.indexOf(r.rowState));
    expect(states).toEqual(states.slice().sort((a, b) => a - b));
  });

  it('says "no science" without science, not "about no science of research"', () => {
    expect(techEtaText({ kind: 'path', turns: Infinity, steps: 3, gate: null })).not.toMatch(/about/);
  });
});
