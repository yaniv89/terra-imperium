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
});
