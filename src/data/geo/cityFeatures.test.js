// src/data/geo/cityFeatures.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../regions';
import { loadCountryFeatures } from './loadWorldFeatures';
import { geoArea } from 'd3-geo';
import { getCityFeatures, getNationTerritories, cityAtLatLon, cityLatLon, getHexMesh } from './cityFeatures';

const ringArea = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(a) / 2; };
const area = (f) => f.geometry.coordinates.reduce((s, poly) => s + ringArea(poly[0]) - poly.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);

describe('city features from state', () => {
  const state = createInitialState({ playerNationId: 'fr', rngSeed: 1 });

  it('gives every city a territory keyed by its id, cached by ownership identity', () => {
    const features = getCityFeatures(state);
    expect(features.length).toBe(Object.keys(state.regions).length);
    expect(features.every((f) => state.regions[f.properties.gameRegionId])).toBe(true);
    expect(getCityFeatures(state)).toBe(features);
  });

  it('cuts coastal territories to the coastline and keeps islands the land data lacks', async () => {
    const land = await loadCountryFeatures();
    const raw = Object.fromEntries(getCityFeatures(state).map((f) => [f.id, f]));
    const clipped = Object.fromEntries(getCityFeatures(state, land).map((f) => [f.id, f]));
    // Tokyo's ring reaches into the Pacific: the clipped land is smaller than the hex blob.
    const tokyo = getNationCapital('jp');
    expect(area(clipped[tokyo])).toBeLessThan(area(raw[tokyo]) * 0.9);
    expect(area(clipped[tokyo])).toBeGreaterThan(0);
    // Every city keeps a territory, Malé (a one-tile island the coastline data is too coarse for) included.
    expect(Object.keys(clipped).length).toBe(Object.keys(raw).length);
    expect(clipped[getNationCapital('mv')]).toBeDefined();
    // d3 winding: every territory is a small patch of the sphere, never its complement.
    Object.values(clipped).forEach((f) => expect(geoArea(f), f.id).toBeLessThan(0.05));
    expect(getCityFeatures(state, land)).toBe(getCityFeatures(state, land));
  });

  it('builds one territory per nation whose land is the union of its cities', async () => {
    const land = await loadCountryFeatures();
    const nations = getNationTerritories(state, land);
    const owners = new Set(Object.values(state.regions).map((r) => r.owner));
    expect(nations.length).toBe(owners.size);
    nations.forEach((f) => { expect(owners.has(f.id)).toBe(true); expect(area(f)).toBeGreaterThan(0); expect(geoArea(f), f.id).toBeLessThan(0.1); });
  });

  it('finds the city under a point and the hex mesh over land', () => {
    const paris = getNationCapital('fr');
    const { lat, lng } = cityLatLon(state, paris);
    expect(cityAtLatLon(state, lat, lng)).toBe(paris);
    expect(cityAtLatLon(state, 0, -30)).toBeNull(); // the Atlantic
    expect(getHexMesh().coordinates.length).toBeGreaterThan(10000);
  });
});
