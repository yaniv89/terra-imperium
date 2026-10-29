// The map never goes black while its detail loads or fails (F145): the raster layer asks once for
// each picture, counts what is on its way and what failed, and retries; the territory pass waits for
// its shader to link off the main thread instead of blocking the first frame.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scene, Texture } from 'three';
import { geoEquirectangular } from 'd3-geo';
import { worldRect, viewFor } from './mapView';

// every picture request, answered by the test: { url, ok(), fail() }
const asked = [];
vi.mock('three', async (orig) => {
  const three = await orig();
  class TextureLoader { load(url, onLoad, onProgress, onError) { asked.push({ url, ok: () => onLoad(new three.Texture()), fail: () => onError(new Error('404')) }); } }
  return { ...three, TextureLoader };
});
vi.mock('../../../data/geo/rasterDetail', () => ({ loadDetailIndex: () => Promise.resolve(null), bestColourTile: () => null, coverTileUrl: () => '' }));

const { createRasterLayer, createTerritoryCache } = await import('./glLayers');

const projection = geoEquirectangular().fitSize([844, 390], { type: 'Sphere' });
const raster = worldRect(projection);
const at = (k) => viewFor({ transform: { k, x: -raster.width * k * 0.4, y: -raster.height * k * 0.3 }, width: 844, height: 390, dpr: 2, projection, raster });
const opts = { closeK: 1e9, baseZ: 2, worldUrl: 'world-2048.webp', worldSize: 2048 };

describe('the raster layer while its pictures load or fail', () => {
  beforeEach(() => { asked.length = 0; });

  it('asks for the world picture once while it is on its way, and counts it loading', () => {
    const scene = new Scene();
    const layer = createRasterLayer(scene, { request: () => {} });
    layer.update(at(1), opts); layer.update(at(1), opts); layer.update(at(1), opts);
    expect(asked.filter((a) => a.url === 'world-2048.webp')).toHaveLength(1);
    expect(layer.stats().loading).toBe(1);
    asked[0].ok();
    layer.update(at(1), opts);
    expect(layer.ready()).toBe(true);
    expect(layer.stats().loading).toBe(0);
  });

  it('a failed world picture is counted failed, not asked again each frame, and comes back on retry', () => {
    const layer = createRasterLayer(new Scene(), { request: () => {} });
    layer.update(at(1), opts);
    asked[0].fail();
    layer.update(at(1), opts); layer.update(at(1), opts);
    expect(layer.stats().failed).toBe(1);
    expect(asked).toHaveLength(1);
    layer.retry();
    layer.update(at(1), opts);
    expect(asked).toHaveLength(2);
    asked[1].ok();
    layer.update(at(1), opts);
    expect(layer.ready()).toBe(true);
    expect(layer.stats().failed).toBe(0);
  });

  it('a failed detail tile leaves the world picture drawn under it and retries on demand', () => {
    const scene = new Scene();
    const layer = createRasterLayer(scene, { request: () => {} });
    layer.update(at(8), opts);
    asked[0].ok(); // the world picture
    layer.update(at(8), opts);
    const tiles = asked.slice(1);
    expect(tiles.length).toBeGreaterThan(0);
    expect(layer.stats().loading).toBe(tiles.length);
    tiles[0].fail();
    tiles.slice(1).forEach((t) => t.ok());
    layer.update(at(8), opts);
    expect(layer.stats().failed).toBe(1);
    expect(layer.stats().loading).toBe(0);
    // the low-detail Earth is still there: never a black screen
    expect(scene.children.filter((m) => m.visible && m.material?.uniforms?.uMap?.value instanceof Texture).length).toBeGreaterThan(tiles.length - 1);
    const before = asked.length;
    layer.retry();
    layer.update(at(8), opts);
    expect(asked.length).toBe(before + 1);
    expect(asked[before].url).toBe(tiles[0].url);
  });
});

describe('the territory pass waits for its shader', () => {
  it('draws nothing until both programs are linked, then draws', async () => {
    const finish = [];
    const renderer = {
      target: null,
      getRenderTarget() { return this.target; }, setRenderTarget(t) { this.target = t; },
      compileAsync: vi.fn(() => new Promise((r) => { finish.push(r); })),
      getClearAlpha: () => 1, getClearColor: () => {}, setClearColor: () => {}, clear: () => {}, render: vi.fn()
    };
    const territory = { mesh: new Scene(), version: 0, update: () => {} };
    const cache = createTerritoryCache(territory);
    const warm = cache.warm(renderer, {});
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2); // into the cache texture, and on screen
    expect(renderer.target).toBeNull();
    expect(cache.draw(renderer, {}, at(4), {}, false)).toBe('linking');
    expect(renderer.render).not.toHaveBeenCalled();
    finish.forEach((r) => r());
    await warm;
    expect(cache.ready()).toBe(true);
    expect(cache.draw(renderer, {}, at(4), {}, false)).toBe('live');
  });
});

describe('the territory shader links fast on Windows (F145)', () => {
  it('has no loop with a constant bound (the D3D11 compiler unrolled them: 5 to 10 s a link)', async () => {
    const { TERRITORY_FRAGMENT } = await import('./territoryShader');
    expect(TERRITORY_FRAGMENT).toMatch(/uniform ivec4 uLoops;/);
    expect(TERRITORY_FRAGMENT).not.toMatch(/for \(int \w+ = 0; \w+ < \d/);
  });
});
