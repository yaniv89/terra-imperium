// City destruction art (src/assets/battle/city/): wall kits, ruin libraries and damaged houses
// replace the boxes, mounds and shader darkening when their files exist, in the battle and in the
// close view; without them the placeholders stay.
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { CityLayer } from './cityLayer';
import { createArtIndex } from '../art/artIndex';
import { parseKit } from '../art/kitLoader';
import { houseTypes, pickHouse, pickRubble, wallPiece } from '../art/cityArt';
import { fortRef, dressStructure } from '../art/structureArt';
import { applyTownDamage } from '../../components/map/closeView/townDamage';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';
import { Q } from '../sim/constants';

const FILES = {
  'battle/city/walls-bronze.glb': [{ name: 'wall-straight', size: 1 }, { name: 'wall-straight-damaged', size: 1 }, { name: 'wall-straight-breached', size: 1 }, { name: 'gate-open', size: 1 }, { name: 'tower', size: 0.6 }],
  'battle/city/ruins-bronze.glb': [{ name: 'rubble-s', size: 0.8 }, { name: 'rubble-m', size: 1.4 }, { name: 'rubble-l', size: 2.4 }],
  'battle/city/bronze-levant-houses-damage.glb': [{ name: 'house-poor-damaged', size: 0.8 }, { name: 'house-poor-ruined', size: 0.8 }, { name: 'house-rich-damaged', size: 1.4 }, { name: 'house-rich-ruined', size: 1.4 }],
  'battle/city/fort-classical.glb': [{ name: 'fort', size: 4 }]
};
const kitOf = async (key) => parseKit((await parseGlbBytes(kitGlb(FILES[key]))).scene);
const art = createArtIndex(Object.fromEntries(Object.keys(FILES).map((k) => [`assets/${k}`, `test://${k}`])));
const load = (url) => kitOf(url.replace('test://', ''));

describe('city kit rules', () => {
  it('matches a layout house to the nearest house type, turned when that fits', async () => {
    const kit = await kitOf('battle/city/bronze-levant-houses-damage.glb');
    expect(houseTypes(kit).map((t) => t.base)).toEqual(['house-poor', 'house-rich']);
    expect(pickHouse(kit, 0.85, 0.75, 'damaged').base).toBe('house-poor');
    expect(pickHouse(kit, 1.5, 1.3, 'ruined').obj.name).toBe('house-rich-ruined');
    expect(pickHouse(kit, 1.4, 1.4, 'burnt')).toBeNull();
    expect(pickHouse(null, 1, 1, 'damaged')).toBeNull();
  });

  it('picks rubble by size and wall pieces by state', async () => {
    const ruins = await kitOf('battle/city/ruins-bronze.glb');
    expect(pickRubble(ruins, 0.7).obj.name).toBe('rubble-s');
    expect(pickRubble(ruins, 2).obj.name).toBe('rubble-l');
    const walls = await kitOf('battle/city/walls-bronze.glb');
    expect(wallPiece(walls, 'wall', 0).name).toBe('wall-straight');
    expect(wallPiece(walls, 'wall', 2).name).toBe('wall-straight-breached');
    expect(wallPiece(walls, 'gate', 1).name).toBe('gate-open'); // no gate-open-damaged: the whole gate
    expect(wallPiece(walls, 'tower', 0).name).toBe('tower');
  });
});

const cityRenderer = () => ({
  scene: new Group(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 }, structureMeshes: new Map([['tower0', new Group()]]),
  map: { keep: { x: 40, y: 30 }, naval: false },
  setup: {
    city: { ageId: 'bronze', style: 'levant', townKey: null, scale: 2.75 },
    sides: [{ color: '#dc2626' }, { color: '#2563eb' }],
    structures: [
      { id: 'w1', kind: 'wall', x: 30 * Q, y: 30 * Q, w: 1, d: 3 },
      { id: 'g1', kind: 'gate', x: 30 * Q, y: 34 * Q, w: 1, d: 3 },
      { id: 'h1', kind: 'house', x: 36 * Q, y: 30 * Q, w: 2, d: 2, h: 1, model: [0.5, 0.2, 0.8, 0.7] },
      { id: 'h2', kind: 'house', x: 36 * Q, y: 33 * Q, w: 4, d: 4, h: 1, model: [1.5, 0.2, 1.4, 1.3] },
      { id: 'tower0', kind: 'tower', x: 31 * Q, y: 27 * Q, w: 1, d: 1 }
    ]
  }
});
const states = (alive, frac) => ({ structures: cityRenderer().setup.structures.map((_, i) => ({ alive: alive[i], hp: frac[i] * 100, maxHp: 100 })) });

describe('the city on the battlefield', () => {
  it('draws the wall kit, kit houses and rubble once the files are in', async () => {
    const r = cityRenderer();
    const layer = new CityLayer(r, { art, load });
    layer.build();
    await Promise.all(layer.ready);
    layer.update(states([true, true, true, false, true], [0.5, 1, 0.5, 0, 1]));
    // the damaged wall, the gate, the tower, the damaged and the ruined house: all kit pieces
    expect(layer.pieces.stats().copies).toBe(3);
    expect(layer.housePieces.stats().copies).toBe(2);
    expect(layer.walls.count).toBe(0);
    expect(layer.rubble.count).toBe(0);
    expect(r.structureMeshes.get('tower0').visible).toBe(false);
    layer.dispose();
  });

  it('keeps boxes and mounds without files', () => {
    const r = cityRenderer();
    const layer = new CityLayer(r, { art: createArtIndex({}), load: () => { throw new Error('no load expected'); } });
    layer.build();
    layer.update(states([true, true, true, false, true], [0.5, 1, 0.5, 0, 1]));
    expect(layer.walls.count).toBe(3); // the wall and the gate's two posts
    expect(layer.rubble.count).toBe(1);
    expect(layer.pieces.stats().copies).toBe(0);
    expect(r.structureMeshes.get('tower0').visible).toBe(true);
  });
});

describe('damage art in the close view', () => {
  it('places damaged and ruined houses and rubble, removing the mounds', async () => {
    const root = new Group();
    let ready = 0;
    const st = [{ kind: 'house', state: 'damaged', x: 0.5, z: 0.2, w: 0.8, d: 0.7 }, { kind: 'house', state: 'ruined', x: 1, z: 1, w: 1.4, d: 1.3 }, { kind: 'landmark', state: 'ruined', x: -1, z: 0, w: 1.3, d: 1.3 }];
    const ok = await applyTownDamage(root, st, { ageId: 'bronze', style: 'levant', art, load, onReady: () => { ready += 1; } });
    expect(ok).toBe(true); expect(ready).toBe(1);
    expect(root.children.filter((c) => c.name === 'damage-art')).toHaveLength(3);
    expect(root.children.filter((c) => c.name === 'ruin')).toHaveLength(0);
  });

  it('keeps the mounds and loads nothing without files', async () => {
    const root = new Group();
    const ok = await applyTownDamage(root, [{ kind: 'house', state: 'ruined', x: 0, z: 0, w: 1, d: 1 }], { ageId: 'bronze', art: createArtIndex({}), load: () => { throw new Error('no load expected'); } });
    expect(ok).toBe(false);
    expect(root.children.filter((c) => c.name === 'ruin')).toHaveLength(1);
  });
});

describe('forts', () => {
  it('take the battle fort file, else the map fort improvement, and dress the keep', async () => {
    expect(fortRef('kingdoms', null, art, () => null).url).toBe('test://battle/city/fort-classical.glb');
    expect(fortRef('bronze', 'israelite', art, () => ({ url: 'test://imp', name: 'fort-bronze-israelite' }))).toEqual({ url: 'test://imp', names: ['fort-bronze-israelite', 'fort'] });
    expect(fortRef('bronze', null, createArtIndex({}), () => null)).toBeNull();
    const g = new Group(); g.add(new Group());
    const added = await dressStructure(g, fortRef('modern', null, art, () => null), { fitTiles: 8, load });
    expect(added).toBeTruthy();
    expect(g.children[0].visible).toBe(false);
    expect(await dressStructure(new Group(), null, { fitTiles: 8 })).toBeNull();
  });
});
