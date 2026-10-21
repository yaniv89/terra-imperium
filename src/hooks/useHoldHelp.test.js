import { describe, it, expect } from 'vitest';
import { helpTarget } from './useHoldHelp';
import { glossaryIds } from '../data/glossary';

const el = (v) => ({ closest: () => (v == null ? null : { getAttribute: () => v }) });

describe('hold for help target', () => {
  it('reads a glossary kind and id, ignores unknown ones and elements without help', () => {
    const id = glossaryIds('tech')[0];
    expect(helpTarget(el(`tech:${id}`))).toEqual(['tech', id]);
    expect(helpTarget(el('tech:nope'))).toBeNull();
    expect(helpTarget(el(null))).toBeNull();
  });

  it('every trainable battle role has a unit entry in its age (train buttons, city unit rows)', () => {
    for (const role of ['infantry', 'ranged', 'cavalry', 'siege', 'support']) {
      const ids = glossaryIds('unit').filter((id) => id.endsWith(`_${role}`));
      expect(ids.length).toBeGreaterThan(0);
      expect(helpTarget(el(`unit:${ids[0]}`))).toEqual(['unit', ids[0]]);
    }
  });
});
