import { describe, it, expect } from 'vitest';
import { mapCardModel } from './MapCard';
import { mapFromUrl } from './MapPicker';
import { mapCode, normalizeSpec } from '../../worldgen/spec';

describe('the map card and shared map codes (MV5)', () => {
  it('describes Real Earth and a generated world with its code', () => {
    expect(mapCardModel(undefined)).toEqual({ title: 'Real Earth', lines: ['Peoples at their real homes'], code: null });
    const spec = normalizeSpec({ kind: 'generated', seed: 42, params: { shape: 'archipelago', land: 35, climate: 'hot', rainfall: 'wet', relief: 'high' } });
    const m = mapCardModel(spec);
    expect(m.title).toBe('Generated world');
    expect(m.lines[0]).toBe('Archipelago, 35% land, continents by chance');
    expect(m.lines[1]).toBe('Hot, wet, high relief');
    expect(m.lines[2]).toBe('Generator version 2');
    expect(m.code).toBe(mapCode(spec));
    expect(mapCardModel({ ...spec, generatorVersion: 1 }).lines[0]).toMatch(/^Continents,/);
  });

  it('reads ?map=CODE from the address', () => {
    const spec = normalizeSpec({ kind: 'generated', seed: 9001, params: { shape: 'pangaea' } });
    expect(mapFromUrl(`?map=${mapCode(spec)}`)).toEqual(spec);
    expect(mapFromUrl('?map=nonsense')).toBeNull();
    expect(mapFromUrl('')).toBeNull();
  });
});
