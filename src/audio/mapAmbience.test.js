// The map's ambience bed from the land at the centre of the view: by terrain, feature, climate and sea.
import { describe, it, expect } from 'vitest';
import { ambienceMix, tileAmbienceFacts } from './mapAmbience';
import { AMBIENCE_SOUNDS } from './soundRegistry';
import { getTiles } from '../data/geo/tiles';

describe('map ambience', () => {
  it('picks one bed per land kind, adds surf on the coast, only wind from far out', () => {
    expect(ambienceMix({ water: true })).toEqual({ 'map-sea': 1 });
    expect(ambienceMix({ water: true, lake: true })).toEqual({ 'map-fields': 0.6, 'map-sea': 0.4 });
    expect(ambienceMix({ terrain: 'plains', feature: 'jungle' })).toEqual({ 'map-jungle': 1 });
    expect(ambienceMix({ terrain: 'desert' })).toEqual({ 'map-desert': 1 });
    expect(ambienceMix({ terrain: 'plains', relief: 'mountains' })).toEqual({ 'map-wind': 1 });
    expect(ambienceMix({ terrain: 'grassland', coastal: true })).toEqual({ 'map-fields': 1, 'map-sea': 0.5 });
    expect(ambienceMix({ terrain: 'grassland' }, { zoomedOut: true })).toEqual({ 'map-wind': 1 });
    expect(ambienceMix(null)).toEqual({ 'map-wind': 1 });
  });

  it('every bed it can pick is a registered ambience id', () => {
    const facts = [{ water: true }, { water: true, lake: true }, { feature: 'jungle' }, { terrain: 'desert' }, { terrain: 'snow' }, { terrain: 'plains', coastal: true }];
    facts.forEach((f) => Object.keys(ambienceMix(f)).forEach((id) => expect(AMBIENCE_SOUNDS[id], id).toBeTruthy()));
  });

  it('reads the real Earth: Sahara, Amazon, Atlantic, Siberia, the Paris basin', () => {
    const tiles = getTiles();
    const at = (lat, lon) => Object.keys(ambienceMix(tileAmbienceFacts(tiles, tiles.nearest(lat, lon))));
    expect(at(23, 10)).toEqual(['map-desert']);
    expect(at(-3, -62)).toEqual(['map-jungle']);
    expect(at(30, -40)).toEqual(['map-sea']);
    expect(at(66, 100)).toEqual(['map-wind']);
    expect(at(48.5, 2.5)).toEqual(['map-fields']);
  });
});
