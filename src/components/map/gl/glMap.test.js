import { describe, it, expect } from 'vitest';
import { geoEquirectangular } from 'd3-geo';
import { worldRect, wrapNear, viewFor, screenToWorld, worldToScreen, minZoomFor, pickHit } from './mapView';
import { cssColor } from './cssColor';
import { packShelf, ATLAS_SIZE } from './spriteAtlas';
import { indexCities, buildTileTexels, buildCityTexels, buildTintTexels, FLAG_ENEMY, FLAG_OWN, PLAYER_BAND_COLOR } from './territoryData';
import { DATA_W } from './tileGpuData';
import { nearView } from './sceneModel';
import { BAND_PX, TERRITORY_FRAGMENT } from './territoryShader';

const projection = geoEquirectangular().fitSize([844, 390], { type: 'Sphere' });
const raster = worldRect(projection);
const view = (t) => viewFor({ transform: t, width: 844, height: 390, dpr: 2, projection, raster });

describe('the WebGL map camera', () => {
  it('fits the world by height on a phone held sideways and never shows more than one world', () => {
    expect(raster.width).toBeCloseTo(780, 0);
    expect(minZoomFor(844, raster)).toBeCloseTo(844 / 780, 5);
  });

  it('wraps east and west: a view one world to the east is the same view', () => {
    const a = view({ k: 4, x: -1000, y: -300 });
    const b = view({ k: 4, x: -1000 - 4 * raster.width, y: -300 });
    expect(b.worldLeft).toBeCloseTo(a.worldLeft, 6);
    expect(b.camX).toBeCloseTo(a.camX, 6);
  });

  it('maps screen to world and back across the antimeridian', () => {
    // the view centred on the antimeridian: half Siberia, half Alaska
    const k = 6;
    const [x180] = projection([180, 65]);
    const v = view({ k, x: 422 - x180 * k, y: 195 - projection([180, 65])[1] * k });
    const east = projection([-170, 65]); const west = projection([170, 65]);
    const [sxE] = worldToScreen(v, east[0], east[1]); const [sxW] = worldToScreen(v, west[0], west[1]);
    expect(sxE).toBeGreaterThan(422); // Alaska to the right of the line
    expect(sxW).toBeLessThan(422); // Siberia to the left
    const back = projection.invert(screenToWorld(v, sxE, 195));
    expect(back[0]).toBeCloseTo(-170, 3);
    expect(wrapNear(10, 1000, 780)).toBeCloseTo(10 + 780, 6);
  });

  it('picks the last hit under a point (markers over cities), discs by distance', () => {
    const v = view({ k: 4, x: -1000, y: -300 });
    const anchor = screenToWorld(v, 400, 200);
    const hits = [
      { kind: 'city', id: 'a', anchor, size: [8, 8], exp: [0.5, 0], round: true },
      { kind: 'marker', marker: { regionId: 'b' }, anchor, offset: [0, -14, 0, 0], size: [30, 34] }
    ];
    expect(pickHit(v, hits, 400, 190).kind).toBe('marker');
    expect(pickHit(v, hits, 400, 206).kind).toBe('city'); // below the marker's box, on the disc (radius 8)
    expect(pickHit(v, hits, 460, 260)).toBeNull();
  });
});

describe('territory data', () => {
  const regions = {
    'c:fr': { id: 'c:fr', owner: 'fr', tile: 10 },
    'c:de': { id: 'c:de', owner: 'de', tile: 20 },
    'c:ghost': { id: 'c:ghost', owner: 'de', tile: 30, ghost: true }
  };
  const index = indexCities(regions);

  it('indexes cities and nations stably', () => {
    expect(index.ids).toEqual(['c:de', 'c:fr', 'c:ghost']);
    expect(index.nationIndex.get('de')).toBe(0);
    expect(index.nationIndex.get('fr')).toBe(1);
  });

  it('writes city, nation and fog per tile', () => {
    const fog = { on: true, explored: { bytes: new Uint8Array([0b0000_0110, 0, 0, 0]) }, visible: new Set([2, 5]) };
    const { data, rows } = buildTileTexels({ tileCount: 32, tileOwner: { 1: 'c:fr', 2: 'c:de', 9: 'nobody' }, regions, fog, index });
    expect(rows).toBe(1);
    expect(data.length).toBe(DATA_W * 4);
    expect([...data.slice(4, 8)]).toEqual([2, 2, 1, 0]); // tile 1: c:fr, fr, explored
    expect([...data.slice(8, 12)]).toEqual([1, 1, 2, 0]); // tile 2: c:de, de, in sight
    expect(data[5 * 4 + 2]).toBe(0); // in sight but never explored: still under the mask
    expect(data[9 * 4]).toBe(0); // an unknown city id is nobody's
    const off = buildTileTexels({ tileCount: 4, tileOwner: {}, regions, fog: { on: false }, index });
    expect(off.data[2]).toBe(2);
  });

  it('writes bands, flags and outlines per city', () => {
    const { data } = buildCityTexels({ regions, index, playerNationId: 'fr', selectedRegion: 'c:de', atWarNationIds: new Set(['de']) });
    const fr = index.cityIndex.get('c:fr') * 8; const de = index.cityIndex.get('c:de') * 8;
    expect([...data.slice(fr, fr + 3)]).toEqual(cssColor(PLAYER_BAND_COLOR).slice(0, 3).map(Math.fround));
    expect(data[fr + 3]).toBe(FLAG_OWN);
    expect(data[de + 3] & FLAG_ENEMY).toBe(FLAG_ENEMY);
    expect(data[de + 7]).toBe(2); // the selected city
    expect(data[fr + 7]).toBe(0); // a plain border
  });

  it('writes lens tints as bytes', () => {
    const { data } = buildTintTexels(8, [{ tile: 3, colour: 'rgba(52,211,153,0.28)' }]);
    expect([...data.slice(12, 16)]).toEqual([52, 211, 153, 71]);
  });

  it('the shader knows the band width', () => {
    expect(TERRITORY_FRAGMENT).toContain(`${BAND_PX.toFixed(1)}`);
  });
});

describe('helpers', () => {
  it('parses the map colours', () => {
    expect(cssColor('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(cssColor('#fff')).toEqual([1, 1, 1, 1]);
    expect(cssColor('rgba(0, 0, 255, 0.5)')).toEqual([0, 0, 1, 0.5]);
    const g = cssColor('hsl(120 80% 45%)');
    expect(g[1]).toBeGreaterThan(g[0]);
    expect(cssColor('nonsense')).toEqual([0, 0, 0, 0]);
  });

  it('packs the atlas in shelves and says when it is full', () => {
    const st = { shelves: [], top: 0 };
    const a = packShelf(st, 100, 40); const b = packShelf(st, 100, 40);
    expect(a).toEqual({ x: 0, y: 0 });
    expect(b.y).toBe(0); expect(b.x).toBeGreaterThan(100);
    expect(packShelf(st, 10, 200).y).toBeGreaterThan(40); // too tall for the first shelf
    expect(packShelf(st, ATLAS_SIZE + 1, 4)).toBeNull();
    const full = { shelves: [], top: ATLAS_SIZE - 5 };
    expect(packShelf(full, 10, 20)).toBeNull();
  });

  it('keeps sprites near the view, east-west wrapped', () => {
    const k = 8;
    const [x180, y] = projection([180, 0]);
    const v = view({ k, x: 422 - x180 * k, y: 195 - y * k });
    const near = nearView(v);
    expect(near(projection([-179, 0]))).toBe(true);
    expect(near(projection([179, 0]))).toBe(true);
    expect(near(projection([0, 0]))).toBe(false);
    const wide = nearView(view({ k: 1.1, x: 0, y: 0 }));
    expect(wide(projection([0, 0]))).toBe(true);
  });
});
