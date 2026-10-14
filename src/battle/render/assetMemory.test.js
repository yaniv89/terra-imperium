import { describe, it, expect, vi } from 'vitest';
import { Scene, Mesh, BoxGeometry, MeshStandardMaterial, Texture } from 'three';
import { textureCap, assetBudget, capSceneTextures, disposeGltf, createAssetLru, STAND_IN_PX, hasReleasedTextures } from './assetMemory';

const bitmap = (w, h) => ({ width: w, height: h, close: vi.fn() });
const fakeCanvas = (w, h) => {
  const ctx = { drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'low' };
  return { width: w, height: h, getContext: () => ctx, ctx };
};
const sceneWith = (...maps) => {
  const scene = new Scene();
  const m = new MeshStandardMaterial();
  [m.map, m.normalMap, m.roughnessMap] = maps.map((img) => (img ? new Texture(img) : null));
  scene.add(new Mesh(new BoxGeometry(), m));
  return { scene, m };
};

describe('texture cap (the iPhone crash hunt)', () => {
  it('is 1024 on a touch device and 2048 on a desktop', () => {
    expect(textureCap({ matchMedia: () => ({ matches: true }) })).toBe(1024);
    expect(textureCap({ matchMedia: () => ({ matches: false }) })).toBe(2048);
    expect(textureCap(null)).toBe(2048);
    expect(assetBudget(1024)).toBeLessThan(assetBudget(2048));
  });

  it('scales 2048 maps down to the cap, closes the decoded bitmaps and counts the bytes', () => {
    const big = [bitmap(2048, 2048), bitmap(2048, 2048), bitmap(2048, 1024)];
    const { scene, m } = sceneWith(...big);
    const bytes = capSceneTextures(scene, 1024, fakeCanvas);
    expect(m.map.image.width).toBe(1024); expect(m.map.image.height).toBe(1024);
    expect(m.roughnessMap.image.width).toBe(1024); expect(m.roughnessMap.image.height).toBe(512);
    big.forEach((b) => expect(b.close).toHaveBeenCalled());
    expect(m.map.image.ctx.drawImage).toHaveBeenCalled();
    // two 1024 squares and one 1024 x 512: GPU with mips plus the CPU copy
    expect(bytes).toBe(Math.round((1024 * 1024 * 2 + 1024 * 512) * 4 * (1 + 4 / 3)));
  });

  it('with release, swaps the CPU copy for a small stand-in once three.js has uploaded it', () => {
    const img = bitmap(1024, 512);
    const { scene, m } = sceneWith(img);
    const bytes = capSceneTextures(scene, 1024, fakeCanvas, { release: true });
    expect(bytes).toBe(Math.round(1024 * 512 * 4 * (4 / 3))); // GPU only
    expect(m.map.image).toBe(img); // still whole until uploaded
    m.map.onUpdate(m.map); // what WebGLTextures calls after the upload
    expect(img.close).toHaveBeenCalled();
    expect(m.map.image.width).toBe(STAND_IN_PX); expect(m.map.image.height).toBe(STAND_IN_PX / 2);
    expect(m.map.onUpdate).toBe(null);
    expect(hasReleasedTextures(scene)).toBe(true);
  });

  it('leaves maps within the cap as they are', () => {
    const small = bitmap(512, 512);
    const { scene, m } = sceneWith(small);
    capSceneTextures(scene, 1024, fakeCanvas);
    expect(m.map.image).toBe(small);
    expect(small.close).not.toHaveBeenCalled();
  });

  it('disposeGltf frees geometry, materials and textures and closes bitmaps', () => {
    const img = bitmap(64, 64);
    const { scene, m } = sceneWith(img);
    const geo = scene.children[0].geometry;
    const spies = [vi.spyOn(geo, 'dispose'), vi.spyOn(m, 'dispose'), vi.spyOn(m.map, 'dispose')];
    disposeGltf({ scene });
    spies.forEach((s) => expect(s).toHaveBeenCalled());
    expect(img.close).toHaveBeenCalled();
  });
});

describe('createAssetLru', () => {
  it('drops the least recently used files over the budget, never one used just now', () => {
    let t = 0;
    const evicted = [];
    const lru = createAssetLru({ budget: 100, keepMs: 10, now: () => t, onEvict: (k) => evicted.push(k) });
    lru.add('a', 'A', 60); t = 5;
    lru.add('b', 'B', 60); t = 20;
    lru.touch('a'); // a is the newest use now
    lru.add('c', 'C', 30);
    lru.trim();
    expect(evicted).toEqual(['b']);
    expect(lru.bytes).toBe(90);
    // within keepMs nothing goes, even over the budget
    lru.add('d', 'D', 80);
    expect(lru.trim()).toEqual([]);
    t = 100;
    expect(lru.trim()).toEqual(['a', 'c']);
    lru.add('e', 'E', 10);
    lru.forget('e');
    expect(lru.has('e')).toBe(false);
    expect(evicted).not.toContain('e'); // forget never calls onEvict
    lru.clear();
    expect(lru.size).toBe(0); expect(lru.bytes).toBe(0);
  });
});
