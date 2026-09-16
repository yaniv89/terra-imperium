// src/data/geo/geo.test.js
// Data-integrity tests for the generated world geometry (see scripts/geo/build.mjs). These guard
// the pipeline's output, not hand-authored game data — a regeneration that silently drops a
// country, breaks referential integrity, or produces asymmetric adjacency should fail loudly
// here rather than surface as a subtle bug three phases later in the game engine.
import { describe, it, expect } from 'vitest';
import countriesMeta from './countries-meta.json';
import subregionsMeta from './subregions-meta.json';
import countriesAdjacency from './countries-adjacency.json';
import subregionsAdjacency from './subregions-adjacency.json';
import countriesTopo from './countries.topo.json';
import subregionsTopo from './subregions.topo.json';

const checkSymmetric = (adjacency) => {
  const asymmetric = [];
  for (const [id, neighbors] of Object.entries(adjacency)) {
    for (const n of neighbors) {
      if (!adjacency[n] || !adjacency[n].includes(id)) asymmetric.push([id, n]);
    }
  }
  return asymmetric;
};

describe('countries tier', () => {
  it('has a plausible number of sovereign/quasi-sovereign entities', () => {
    const count = Object.keys(countriesMeta).length;
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThan(260);
  });

  it('every entry has a name and continent', () => {
    Object.entries(countriesMeta).forEach(([id, m]) => {
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      // Antarctica-adjacent/unrecognized entries can legitimately lack a continent
      expect(m.continent === null || typeof m.continent === 'string').toBe(true);
      expect(id).toMatch(/^[a-z]{2}$/);
    });
  });

  it('every entry has a positive population and gdp (feeds Phase 13 worldNations.js)', () => {
    Object.values(countriesMeta).forEach((m) => {
      expect(m.population).toBeGreaterThan(0);
      expect(m.gdpMillions).toBeGreaterThan(0);
    });
  });

  it('adjacency is symmetric (A borders B iff B borders A)', () => {
    expect(checkSymmetric(countriesAdjacency)).toEqual([]);
  });

  it('every adjacency id refers to a real country', () => {
    Object.entries(countriesAdjacency).forEach(([id, neighbors]) => {
      expect(countriesMeta[id]).toBeDefined();
      neighbors.forEach((n) => expect(countriesMeta[n]).toBeDefined());
    });
  });

  it('resolves the Middle East neighborhood correctly (regression guard for Phase 12/13)', () => {
    expect(countriesMeta.il.name).toBe('Israel');
    expect(countriesAdjacency.il.sort()).toEqual(['eg', 'jo', 'lb', 'ps', 'sy']);
  });

  it('handles disputed/unrecognized territories with stable synthetic ids', () => {
    expect(countriesMeta.xk?.name).toBe('Kosovo');
    expect(countriesMeta.xs?.name).toBe('Somaliland');
    expect(countriesMeta.xn?.name).toBeDefined();
  });

  it('the topology has one object layer with a geometry per country', () => {
    const layers = Object.keys(countriesTopo.objects);
    expect(layers.length).toBe(1);
    expect(countriesTopo.objects[layers[0]].geometries.length).toBe(Object.keys(countriesMeta).length);
  });
});

describe('subregions tier', () => {
  it('has a plausible number of admin-1 divisions worldwide', () => {
    const count = Object.keys(subregionsMeta).length;
    expect(count).toBeGreaterThan(4000);
    expect(count).toBeLessThan(5000);
  });

  it('every subregion resolves to a real country (no orphans)', () => {
    const orphans = Object.entries(subregionsMeta).filter(([, m]) => !countriesMeta[m.countryId]);
    expect(orphans).toEqual([]);
  });

  it('every entry has a name, country id, and country name', () => {
    Object.values(subregionsMeta).forEach((m) => {
      expect(typeof m.name).toBe('string');
      expect(m.countryId).toMatch(/^[a-z]{2}$/);
      expect(typeof m.countryName).toBe('string');
    });
  });

  it('adjacency is symmetric', () => {
    expect(checkSymmetric(subregionsAdjacency)).toEqual([]);
  });

  it('every adjacency id refers to a real subregion', () => {
    Object.entries(subregionsAdjacency).forEach(([id, neighbors]) => {
      expect(subregionsMeta[id]).toBeDefined();
      neighbors.forEach((n) => expect(subregionsMeta[n]).toBeDefined());
    });
  });

  it('a mainland subregion has at least one neighbor (sanity check, not exhaustive)', () => {
    // Nord (France, on the Belgian border) should border something.
    expect(subregionsMeta['fr-59']?.name).toBe('Nord');
    expect(subregionsAdjacency['fr-59']?.length).toBeGreaterThan(0);
  });

  it('the topology has one object layer with a geometry per subregion', () => {
    const layers = Object.keys(subregionsTopo.objects);
    expect(layers.length).toBe(1);
    expect(subregionsTopo.objects[layers[0]].geometries.length).toBe(Object.keys(subregionsMeta).length);
  });
});
