import { describe, it, expect } from 'vitest';
import { REGIONS_DATA, isAdjacentToOwner, distanceFromAnchor, getNationCapital, getCapital, getNeighborIds } from './regions';
import countriesMeta from './geo/countries-meta.json';
import { getTiles } from './geo/tiles';
import { absentAtStart } from './scenarios';

// The crowded small lands with no room at the start are absent from the default world
// (settle-rules R4, option A): on the map only when the player picks them.
const ABSENT = absentAtStart(getTiles(), Object.keys(getTiles().capitals));

// Regions are cities on the tile world (src/engine/world/registry.js). Before any game exists
// the registry holds the default Dawn world: every nation with room at the start, one city each.
describe('the city registry (default Dawn world)', () => {
  it('holds one city per nation, every one with the fields the engine reads', () => {
    expect(ABSENT.length).toBeGreaterThan(0);
    expect(Object.keys(REGIONS_DATA).length).toBe(240 - ABSENT.length);
    const owners = new Set(Object.values(REGIONS_DATA).map((r) => r.startOwner));
    expect(owners.size).toBe(240 - ABSENT.length);
    Object.entries(REGIONS_DATA).forEach(([id, data]) => {
      expect(data.id).toBe(id);
      expect(typeof data.name).toBe('string');
      expect(typeof data.isCoastal, id).toBe('boolean');
      expect(typeof data.population).toBe('number');
      expect(data.tile).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(data.neighbors)).toBe(true);
    });
  });

  it('is symmetric: every neighbour relationship is listed on both sides', () => {
    const asymmetric = [];
    Object.entries(REGIONS_DATA).forEach(([id, data]) => {
      data.neighbors.forEach((nId) => {
        if (!REGIONS_DATA[nId]) asymmetric.push(`${id} references unknown region ${nId}`);
        else if (!REGIONS_DATA[nId].neighbors.includes(id)) asymmetric.push(`${id} -> ${nId} but not ${nId} -> ${id}`);
      });
    });
    expect(asymmetric).toEqual([]);
  });

  it('bridges peoples that border on Earth, so most capitals have a neighbour', () => {
    const ids = Object.keys(REGIONS_DATA);
    const withNeighbors = ids.filter((id) => REGIONS_DATA[id].neighbors.length > 0);
    expect(withNeighbors.length / ids.length).toBeGreaterThan(0.6);
    const fr = getNationCapital('fr');
    expect(getNeighborIds(fr).map((id) => REGIONS_DATA[id].startOwner)).toEqual(expect.arrayContaining(['de', 'be', 'es', 'it']));
  });
});

describe('isAdjacentToOwner', () => {
  const regions = Object.fromEntries(Object.keys(REGIONS_DATA).map((id) => [id, { owner: REGIONS_DATA[id].startOwner }]));
  it('is true when a neighbouring city is owned by the given owner', () => {
    expect(isAdjacentToOwner(getNationCapital('fr'), regions, 'de')).toBe(true);
  });
  it('is false when no neighbour is owned by the given owner', () => {
    expect(isAdjacentToOwner(getNationCapital('fr'), regions, 'jp')).toBe(false);
  });
});

describe('distanceFromAnchor (overextension)', () => {
  const fr = getNationCapital('fr'); const de = getNationCapital('de'); const pl = getNationCapital('pl');
  it('is 0 for the anchor region itself', () => { expect(distanceFromAnchor([fr], fr)).toBe(0); });
  it('is 1 for a direct neighbour of the anchor', () => { expect(distanceFromAnchor([fr], de)).toBe(1); });
  it('grows for a multi-hop path (France -> Germany -> Poland)', () => {
    expect(distanceFromAnchor([fr], pl)).toBe(2);
    expect(distanceFromAnchor([fr], pl, 1)).toBeNull();
  });
  it('finds the shortest distance across multiple anchors, not just the first', () => {
    expect(distanceFromAnchor([fr, de], pl)).toBe(1);
  });
});

describe('getNationCapital', () => {
  it('returns a capital city for every nation on the map, on that nation\'s land, and none for an absent one', () => {
    ABSENT.forEach((nationId) => expect(getNationCapital(nationId), nationId).toBeNull());
    Object.keys(countriesMeta).filter((id) => !ABSENT.includes(id)).forEach((nationId) => {
      const capital = getNationCapital(nationId);
      expect(capital, nationId).toBeTruthy();
      expect(REGIONS_DATA[capital].startOwner).toBe(nationId);
      expect(REGIONS_DATA[capital].isCapital).toBe(true);
    });
  });
  it('returns null for an unknown nation id', () => { expect(getNationCapital('zz')).toBeNull(); });
});

describe('getCapital (dynamic capital)', () => {
  it('falls back to the native capital when a nation has no capitalRegionId', () => {
    expect(getCapital({}, 'fr')).toBe(getNationCapital('fr'));
    expect(getCapital({ nations: { fr: {} } }, 'fr')).toBe(getNationCapital('fr'));
  });
  it('prefers the nation\'s own capitalRegionId once one has been set', () => {
    expect(getCapital({ nations: { fr: { capitalRegionId: 'c1' } } }, 'fr')).toBe('c1');
  });
});
