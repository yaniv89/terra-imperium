import { describe, it, expect, beforeEach } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import {
  cleanLatLng, normalLng, latLngOfTile, latLngOfCity, latLngOfPlace, cameraTarget, battlePlaces, freshBattleReport,
  cameraKey, rememberCamera, recallCamera, forgetCamera
} from './mapCamera';
import { carryTransform, isSaneTransform } from './gl/mapView';
import { getTiles } from '../../data/geo/tiles';

// three tiles: 0 near Babylon, 1 in the Nile delta, 2 near Rome
const TILES = { count: 3, latLonOf: (t) => [{ lat: 32.5, lon: 44.4 }, { lat: 30.8, lon: 31 }, { lat: 41.9, lon: 12.5 }][t] };
const COORDS = { babylon: { lat: 32.5, lng: 44.4 }, broken: { lat: NaN, lng: 10 } };
const opts = { tiles: TILES, coords: COORDS };
const state = {
  playerNationId: 'akkad',
  scenario: { seed: 42, mode: 'peoples' },
  nations: { akkad: { capitalRegionId: 'babylon' } },
  regions: { babylon: { tile: 0 }, memphis: { tile: 1 }, broken: { tile: 2 } }
};

describe('map camera targets', () => {
  it('accepts only real points on Earth and wraps the longitude', () => {
    expect(cleanLatLng({ lat: 10, lng: 190 })).toEqual({ lat: 10, lng: -170 });
    expect(cleanLatLng({ lat: 10, lon: -200 })).toEqual({ lat: 10, lng: 160 });
    expect(cleanLatLng({ lat: 91, lng: 0 })).toBeNull();
    expect(cleanLatLng({ lat: NaN, lng: 0 })).toBeNull();
    expect(cleanLatLng({ lat: 0, lng: undefined })).toBeNull();
    expect(cleanLatLng(null)).toBeNull();
    expect(cleanLatLng(undefined)).toBeNull();
    expect(normalLng(180)).toBe(-180);
  });

  it('finds a tile only inside the world', () => {
    expect(latLngOfTile(1, TILES)).toEqual({ lat: 30.8, lng: 31 });
    expect(latLngOfTile('2', TILES)).toEqual({ lat: 41.9, lng: 12.5 });
    [null, undefined, -1, 3, 1.5, NaN, '', 'x'].forEach((t) => expect(latLngOfTile(t, TILES)).toBeNull());
  });

  it('finds a real tile of the real grid', () => {
    const tiles = getTiles();
    const ll = latLngOfTile(0, tiles);
    expect(Number.isFinite(ll.lat) && Number.isFinite(ll.lng)).toBe(true);
    expect(latLngOfTile(tiles.count, tiles)).toBeNull();
  });

  it('finds a city by its coordinates, else its tile; a city that is gone is null', () => {
    expect(latLngOfCity(state, 'babylon', opts)).toEqual({ lat: 32.5, lng: 44.4 });
    expect(latLngOfCity(state, 'memphis', opts)).toEqual({ lat: 30.8, lng: 31 }); // not in the registry yet
    expect(latLngOfCity(state, 'broken', opts)).toEqual({ lat: 41.9, lng: 12.5 }); // NaN coordinates: the tile
    expect(latLngOfCity(state, 'razed', opts)).toBeNull();
    expect(latLngOfCity(state, null, opts)).toBeNull();
    expect(latLngOfCity(state, undefined, opts)).toBeNull();
  });

  it('a place is its tile first, then its city', () => {
    expect(latLngOfPlace(state, { tile: 1, regionId: 'babylon' }, opts)).toEqual({ lat: 30.8, lng: 31 });
    expect(latLngOfPlace(state, { tile: 99, regionId: 'babylon' }, opts)).toEqual({ lat: 32.5, lng: 44.4 });
    expect(latLngOfPlace(state, null, opts)).toBeNull();
  });

  it('goes to the first place that exists', () => {
    expect(cameraTarget(state, [{ regionId: 'razed' }, { regionId: 'memphis' }], opts)).toMatchObject({ lat: 30.8, from: 'place', index: 1 });
  });

  it('falls back to the selected army, then the capital, never to a default spot', () => {
    expect(cameraTarget(state, [{ regionId: 'razed' }], { ...opts, selectedArmyTile: 2 })).toMatchObject({ lat: 41.9, from: 'army' });
    expect(cameraTarget(state, [{ regionId: 'razed' }], { ...opts, selectedArmyTile: 77 })).toMatchObject({ lat: 32.5, from: 'capital' });
    expect(cameraTarget(state, [], opts)).toMatchObject({ from: 'capital' });
    const noCapital = { ...state, nations: { akkad: { capitalRegionId: 'razed' } } };
    expect(cameraTarget(noCapital, [{ tile: undefined }, { regionId: undefined }], opts)).toBeNull();
    expect(cameraTarget(null, [], opts)).toBeNull();
  });

  it('a battle is found by its battlefield tile, then the city fought for, then where it came from', () => {
    const r = { tile: null, targetRegionId: 'razed', fromRegionId: 'memphis' };
    expect(cameraTarget(state, battlePlaces(r), opts)).toMatchObject({ lat: 30.8, from: 'place', index: 2 });
    expect(cameraTarget(state, battlePlaces({ ...r, tile: 2 }), opts)).toMatchObject({ lat: 41.9, index: 0 });
    expect(battlePlaces(null)).toEqual([]);
  });
});

describe('the battle that just ended', () => {
  const reports = [{ id: 'b3', turn: 10 }, { id: 'b2', turn: 10 }, { id: 'b1', turn: 4 }];
  it('is the newest report since the last one seen', () => {
    expect(freshBattleReport(reports, 'b2', 10)).toBe(reports[0]);
    expect(freshBattleReport(reports, 'b1', 11)).toBe(reports[0]); // fought in the turn just played
    expect(freshBattleReport(reports, 'b3', 10)).toBeNull();
    expect(freshBattleReport([], null, 10)).toBeNull();
    expect(freshBattleReport(undefined, null, 10)).toBeNull();
  });
  it('an old save loaded never moves the camera', () => {
    expect(freshBattleReport(reports, 'zz', 30)).toBeNull();
    expect(freshBattleReport(reports, null, 10)).toBe(reports[0]);
  });
});

describe('the remembered camera', () => {
  beforeEach(() => forgetCamera());
  it('comes back for the same game only', () => {
    const key = cameraKey(state);
    rememberCamera(key, { lat: 30, lng: 40, scaleK: 5000 });
    expect(recallCamera(key)).toMatchObject({ lat: 30, lng: 40, scaleK: 5000 });
    expect(recallCamera(cameraKey({ ...state, scenario: { seed: 43, mode: 'peoples' } }))).toBeNull();
    expect(recallCamera(cameraKey({ ...state, playerNationId: 'egypt' }))).toBeNull();
  });
  it('never keeps a broken camera', () => {
    const key = cameraKey(state);
    rememberCamera(key, { lat: NaN, lng: 40, scaleK: 5000 });
    rememberCamera(key, { lat: 10, lng: 40, scaleK: 0 });
    rememberCamera('', { lat: 10, lng: 40, scaleK: 10 });
    expect(recallCamera(key)).toBeNull();
  });
});

describe('a resize keeps the camera on the same place', () => {
  const geom = (width, height) => ({ projection: geoEquirectangular().fitSize([width, height], { type: 'Sphere' }), width, height });
  const centreOf = (t, g) => { const ll = g.projection.invert([(g.width / 2 - t.x) / t.k, (g.height / 2 - t.y) / t.k]); return { lng: normalLng(ll[0]), lat: ll[1] }; };
  const viewOn = (g, lat, lng, k) => { const [px, py] = g.projection([lng, lat]); return { k, x: g.width / 2 - px * k, y: g.height / 2 - py * k }; };

  it('an iPhone toolbar showing (844x390 to 844x340) at a close zoom', () => {
    const from = geom(844, 390); const to = geom(844, 340);
    const t = viewOn(from, 33.1, 44.2, 40);
    // the old transform kept as it was points somewhere else entirely (the bug)
    const stale = centreOf(t, to);
    expect(Math.hypot(stale.lat - 33.1, stale.lng - 44.2)).toBeGreaterThan(1);
    const c = carryTransform({ transform: t, from, to, minK: 1, maxK: 200 });
    expect(isSaneTransform(c)).toBe(true);
    const after = centreOf(c, to);
    expect(after.lat).toBeCloseTo(33.1, 6);
    expect(after.lng).toBeCloseTo(44.2, 6);
    // the same ground scale: pixels per degree unchanged
    expect(c.k * to.projection.scale()).toBeCloseTo(t.k * from.projection.scale(), 6);
  });

  it('a desktop window made wider and a view across the date line', () => {
    const from = geom(1280, 800); const to = geom(1600, 700);
    const t = viewOn(from, -17, 179.5, 12);
    const after = centreOf(carryTransform({ transform: t, from, to, minK: 1, maxK: 200 }), to);
    expect(after.lat).toBeCloseTo(-17, 6);
    expect(Math.abs(normalLng(after.lng - 179.5))).toBeLessThan(1e-6);
  });

  it('keeps the zoom inside its limits and refuses a broken view', () => {
    const from = geom(844, 390); const to = geom(400, 200);
    expect(carryTransform({ transform: viewOn(from, 0, 0, 200), from, to, minK: 1, maxK: 200 }).k).toBe(200);
    expect(carryTransform({ transform: { x: NaN, y: 0, k: 2 }, from, to })).toBeNull();
    expect(carryTransform({ transform: { x: 0, y: 0, k: 0 }, from, to })).toBeNull();
    expect(carryTransform({ transform: null, from, to })).toBeNull();
    expect(isSaneTransform({ x: 1, y: Infinity, k: 1 })).toBe(false);
  });
});
