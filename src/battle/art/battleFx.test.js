// River banks, fords, bridges, projectiles and effect sheets: found on the battle map, drawn from a
// dropped-in file, and left to the code's placeholders without one.
import { describe, it, expect } from 'vitest';
import { Group, Texture } from 'three';
import { findCrossings, bridgeSpan, BattleTerrainArt } from './battleTerrain';
import { projectileFor, ProjectileArt } from './projectiles';
import { indexFxSheets, FxSprites, FX_SHEETS } from './fxSheets';
import { createArtIndex } from './artIndex';
import { parseKit } from './kitLoader';
import { TILE } from '../setup/mapgen';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';

// a 10 x 8 field: a river two tiles wide along x at z = 3..4, a ford at x = 2, a road bridge at x = 6
const riverMap = () => {
  const w = 10; const h = 8; const tiles = new Uint8Array(w * h).fill(TILE.OPEN);
  for (let x = 0; x < w; x++) for (let z = 3; z <= 4; z++) tiles[z * w + x] = x === 2 ? TILE.FORD : x === 6 ? TILE.ROAD : TILE.WATER;
  return { w, h, tiles };
};
const kit = async (objects) => parseKit((await parseGlbBytes(kitGlb(objects))).scene);

describe('battle terrain crossings', () => {
  it('finds fords, banks and bridges on the map', () => {
    const { fords, banks, bridges } = findCrossings(riverMap());
    expect(fords).toHaveLength(2);
    // every water or ford tile on the river's edge rows gives one bank piece facing the water
    expect(banks).toHaveLength(18);
    expect(banks.find((b) => b.z === 3).yaw).toBeCloseTo(0); // north bank: the water lies south (+z)
    expect(bridges).toEqual([{ x: 6.5, z: 4, axis: 'z', length: 3 }]);
  });

  it('rejects coastal road candidates whose end socket leaves any map edge', () => {
    for (const [x, z, axis] of [[0, 1, 'x'], [9, 1, 'x'], [3, 0, 'z'], [3, 7, 'z']]) {
      const map = riverMap();
      map.tiles[z * map.w + x] = TILE.ROAD;
      const lateral = axis === 'x' ? [[x, z - 1], [x, z + 1]] : [[x - 1, z], [x + 1, z]];
      lateral.forEach(([i, j]) => { map.tiles[j * map.w + i] = TILE.WATER; });
      const found = findCrossings(map);
      expect(found.bridges).toEqual([{ x: 6.5, z: 4, axis: 'z', length: 3 }]);
      expect(found.fords).toHaveLength(2);
      expect(found.banks.length).toBeGreaterThan(0);
    }
  });

  it('rejects water or ford landings at either end while keeping another valid crossing', () => {
    for (const wet of [TILE.WATER, TILE.FORD]) for (const z of [2, 5]) {
      const map = riverMap();
      map.tiles[3 * map.w + 8] = TILE.ROAD;
      map.tiles[4 * map.w + 8] = TILE.ROAD;
      map.tiles[z * map.w + 6] = wet;
      const found = findCrossings(map);
      expect(found.bridges).toEqual([{ x: 8.5, z: 4, axis: 'z', length: 3 }]);
      expect(found.fords).toHaveLength(wet === TILE.FORD ? 3 : 2);
      if (wet === TILE.FORD) expect(found.fords).toContainEqual(expect.objectContaining({ x: 6.5, z: z + 0.5 }));
    }
  });

  it('spans a bridge by its end sockets', async () => {
    const k = await kit([{ name: 'bridge-wood', size: 1, sockets: { 'socket-end-a': [0, 0, -0.6], 'socket-end-b': [0, 0, 0.6] } }, { name: 'bridge-stone', size: 1 }]);
    expect(bridgeSpan(k.objects['bridge-wood'])).toEqual({ axis: 'z', length: expect.closeTo(1.2) });
    expect(bridgeSpan(k.objects['bridge-stone']).length).toBeCloseTo(1);
  });

  it('places the dropped-in kits, and loads nothing without files', async () => {
    const files = { 'test://river': [{ name: 'bank', size: 0.36 }], 'test://ford': [{ name: 'ford', size: 0.36 }], 'test://bridge': [{ name: 'bridge-stone', size: 1 }] };
    const art = createArtIndex({ 'assets/battle/terrain/river-kit.glb': 'test://river', 'assets/battle/terrain/ford.glb': 'test://ford', 'assets/battle/terrain/bridge-stone.glb': 'test://bridge' });
    const r = { map: riverMap(), scene: new Group(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 }, setup: { sides: [{ ageId: 'bronze' }, { ageId: 'kingdoms' }] } };
    const t = new BattleTerrainArt(r, { art, load: (url) => kit(files[url]) });
    await Promise.all(t.ready);
    expect(t.pieces.stats().copies).toBe(18 + 2 + 1); // the Kingdoms stone bridge
    const none = new BattleTerrainArt({ ...r, scene: new Group() }, { art: createArtIndex({}), load: () => { throw new Error('no load expected'); } });
    none.update(1);
    expect(none.pieces.stats().copies).toBe(0);
  });
});

describe('projectiles', () => {
  it('picks a projectile by class and age, null for guns (the tracer)', () => {
    expect(projectileFor('ranged', 'bronze')).toBe('arrow');
    expect(projectileFor('siege', 'kingdoms')).toBe('stone');
    expect(projectileFor('ranged', 'gunpowder')).toBeNull();
    expect(projectileFor('siege', 'bronze')).toBeNull();
    expect(projectileFor('tower', 'gunpowder')).toBe('cannonball');
  });

  it('draws the age file (an earlier age standing in) and keeps the tracer without one', async () => {
    const art = createArtIndex({ 'assets/battle/projectiles/bronze.glb': 'test://p' });
    const r = { scene: new Group(), track: (x) => x, setup: { sides: [{ ageId: 'classical' }, { ageId: 'modern' }] } };
    const p = new ProjectileArt(r, { art, load: () => kit([{ name: 'arrow', size: 0.1, lods: false }]) });
    await Promise.all(p.ready);
    expect(p.objectFor('ranged', 'classical').name).toBe('arrow');
    expect(p.objectFor('siege', 'classical')).toBeNull(); // no bolt in the file
    expect(p.objectFor('ranged', 'modern')).toBeNull(); // no modern-or-earlier file has a missile... the bronze file has none
    p.begin(); p.add(p.objectFor('ranged', 'classical'), 1, 1, 1, 1, 0, 0.2); p.end();
    expect(p.pieces.stats().copies).toBe(1);
  });
});

describe('effect sheets', () => {
  it('index sheets with their frames, skipping the map folder and empty sheets', () => {
    const sheets = { '../../assets/fx/smoke/sheet.json': { frame: [64, 64], fps: 10, blend: 'alpha' }, '../../assets/fx/dust/sheet.json': { fps: 8 }, '../../assets/fx/map/sheet.json': {} };
    const frames = { '../../assets/fx/smoke/smoke-1.png': 'u1', '../../assets/fx/smoke/smoke-0.png': 'u0' };
    const idx = indexFxSheets(sheets, frames);
    expect(Object.keys(idx)).toEqual(['smoke']);
    expect(idx.smoke.urls).toEqual(['u0', 'u1']);
    expect(idx.smoke.frames).toBe(2);
    expect(Object.keys(FX_SHEETS).every((id) => !!FX_SHEETS[id].urls.length)).toBe(true);
  });

  it('draws a delivered sheet as instanced billboards; nothing without one', async () => {
    const scene = new Group();
    const sheets = { explosion: { frame: [64, 64], frames: 4, fps: 12, blend: 'additive', size: 2, urls: ['a', 'b', 'c', 'd'] } };
    const fx = new FxSprites(scene, { sheets, makeAtlas: async () => ({ texture: new Texture(), cols: 2, rows: 2 }) });
    await Promise.all(fx.ready);
    expect(fx.has('explosion')).toBe(true);
    expect(fx.has('smoke')).toBe(false);
    fx.begin([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(fx.add('explosion', 0, 0, 0, { k: 0.6 })).toBe(true);
    expect(fx.add('smoke', 0, 0, 0)).toBe(false);
    fx.end();
    expect(fx.layers.explosion.mesh.count).toBe(1);
    expect(fx.layers.explosion.frame.array[0]).toBe(2);
    const none = new FxSprites(new Group(), { sheets: {} });
    expect(none.ready).toHaveLength(0);
  });
});
