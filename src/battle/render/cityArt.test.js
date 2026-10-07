// City destruction art (src/assets/battle/city/): wall kits, ruin libraries and damaged houses
// replace the boxes, mounds and shader darkening when their files exist, in the battle and in the
// close view; without them the placeholders stay.
import { describe, it, expect, vi } from 'vitest';
import { Group } from 'three';
import { CityLayer } from './cityLayer';
import { createArtIndex } from '../art/artIndex';
import { parseKit } from '../art/kitLoader';
import { houseTypes, pickHouse, pickRubble, wallPiece } from '../art/cityArt';
import { fortRef, dressStructure, CivicStructures, palaceName } from '../art/structureArt';
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


const civicSpecs = [{ name: 'keep', size: 1 }, { name: 'keep-damaged', size: 0.8 }, { name: 'keep-ruined', size: 1.4 }];
const palaceSpecs = [{ name: 'palace', size: 1.2 }, { name: 'palace-small', size: 0.8 }];
const palaceDamageSpecs = ['palace', 'palace-small'].flatMap((name) => [{ name: `${name}-damaged`, size: 0.7 }, { name: `${name}-ruined`, size: 1.5 }]);
const fromSpecs = async (spec) => parseKit((await parseGlbBytes(kitGlb(spec))).scene);
const civicRenderer = () => {
  const r = cityRenderer(); r.setup.city.tierId = 'small';
  r.setup.structures = [
    { id: 'keep', kind: 'keep', x: 40 * Q, y: 30 * Q, w: 3, d: 3 },
    { id: 'palace', kind: 'palace', x: 44 * Q, y: 30 * Q, w: 2.2, d: 2.2 }
  ];
  r.structureMeshes.set('keep', new Group()); return r;
};
const civicView = (keep, palace = keep) => ({ structures: [keep, palace].map((frac, i) => ({ id: i ? 'palace' : 'keep', alive: frac > 0, hp: frac * 100, maxHp: 100 })) });
const drawnPieces = (instances) => [...instances.meshes.entries()].filter(([, e]) => e.n).map(([bundle]) => bundle);

describe('civic keeps and palaces', () => {
  it('replaces both placeholders, changes damage states at 70%, and updates LOD without resizing', async () => {
    const kits = await Promise.all([fromSpecs(civicSpecs), fromSpecs(palaceSpecs), fromSpecs(palaceDamageSpecs)]);
    const r = civicRenderer();
    const a = createArtIndex({ 'battle/city/civic-bronze-levant.glb': 'test://civic', 'battle/city/palace-damage-bronze.glb': 'test://damage' });
    const layer = new CityLayer(r, { art: a, shared: () => ['test://palace'], load: async (url) => kits[{ 'test://civic': 0, 'test://palace': 1, 'test://damage': 2 }[url]] });
    layer.build(); await Promise.all(layer.ready);
    layer.update(civicView(0.7));
    expect(r.structureMeshes.get('keep').visible).toBe(false);
    expect(layer.blocks.count).toBe(0); expect(layer.pieces.stats().copies).toBe(2);
    expect(drawnPieces(layer.pieces)).toContain(kits[0].objects.keep.lods[0]);
    expect(drawnPieces(layer.pieces)).toContain(kits[1].objects['palace-small'].lods[0]);
    layer.update(civicView(0.69));
    expect(drawnPieces(layer.pieces)).toContain(kits[0].objects['keep-damaged'].lods[0]);
    const damaged = layer.pieces.meshes.get(kits[0].objects['keep-damaged'].lods[0]).mesh;
    expect(Math.hypot(...damaged.instanceMatrix.array.slice(0, 3))).toBeCloseTo(3); // intact reference is 1, not damaged 0.8
    expect(drawnPieces(layer.pieces)).toContain(kits[2].objects['palace-small-damaged'].lods[0]);
    layer.update(civicView(0));
    expect(drawnPieces(layer.pieces)).toContain(kits[0].objects['keep-ruined'].lods[0]);
    expect(drawnPieces(layer.pieces)).toContain(kits[2].objects['palace-small-ruined'].lods[0]);
    expect(layer.rubble.count).toBe(0);
    r.camera.zoom = 0.4; layer.update(civicView(0));
    expect(drawnPieces(layer.pieces)).toContain(kits[0].objects['keep-ruined'].lods[2]);
    expect(drawnPieces(layer.pieces)).not.toContain(kits[0].objects['keep-ruined'].lods[0]);
    layer.dispose(); expect(layer.pieces.stats().copies).toBe(0);
  });

  it('uses the base intact palace when a theme file lacks its root, and preserves placeholders on failure', async () => {
    const unrelated = await fromSpecs([{ name: 'walls-small', size: 3 }]);
    const base = await fromSpecs(palaceSpecs);
    const r = civicRenderer();
    const layer = new CityLayer(r, { art: createArtIndex({}), shared: () => ['theme', 'base'], load: async (url) => url === 'theme' ? unrelated : base });
    layer.build(); await Promise.all(layer.ready); layer.update(civicView(1));
    expect(r.structureMeshes.get('keep').visible).toBe(true);
    expect(drawnPieces(layer.pieces)).toContain(base.objects['palace-small'].lods[0]);
    layer.update(civicView(0)); expect(layer.rubble.count).toBe(2); expect(layer.pieces.stats().copies).toBe(0);
    layer.dispose();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failed = new CityLayer(civicRenderer(), { art: createArtIndex({ 'battle/city/civic-bronze.glb': 'missing' }), shared: () => [], load: async () => { throw new Error('404'); } });
    failed.build(); await Promise.all(failed.ready); failed.update(civicView(1));
    expect(failed.r.structureMeshes.get('keep').visible).toBe(true); expect(failed.blocks.count).toBe(1);
    failed.dispose(); warning.mockRestore();
  });

  it('uses one central palace for an overlapping keep and follows the worse damage state', async () => {
    const kits = await Promise.all([fromSpecs(civicSpecs), fromSpecs(palaceSpecs), fromSpecs(palaceDamageSpecs)]);
    const r = civicRenderer(); r.setup.structures[1].x = 40.4 * Q;
    const a = createArtIndex({ 'battle/city/civic-bronze.glb': 'civic', 'battle/city/palace-damage-bronze.glb': 'damage' });
    const layer = new CityLayer(r, { art: a, shared: () => ['palace'], load: async (url) => kits[{ civic: 0, palace: 1, damage: 2 }[url]] });
    layer.build(); await Promise.all(layer.ready); layer.update(civicView(1));
    expect(layer.pieces.stats().copies).toBe(1); expect(r.structureMeshes.get('keep').visible).toBe(false);
    expect(drawnPieces(layer.pieces)).toContain(kits[1].objects['palace-small'].lods[0]);
    layer.update(civicView(0.69, 1));
    expect(drawnPieces(layer.pieces)).toContain(kits[2].objects['palace-small-damaged'].lods[0]);
    layer.update(civicView(1, 0.69));
    expect(drawnPieces(layer.pieces)).toContain(kits[2].objects['palace-small-damaged'].lods[0]);
    layer.update(civicView(0, 1));
    expect(layer.pieces.stats().copies).toBe(1); expect(layer.rubble.count).toBe(0);
    expect(drawnPieces(layer.pieces)).toContain(kits[2].objects['palace-small-ruined'].lods[0]);
    layer.kits.palaceDamage = null; layer.last.clear(); layer.update(civicView(0, 1));
    expect(layer.pieces.stats().copies).toBe(0); expect(layer.rubble.count).toBe(1);
    layer.palaceKits = []; layer.last.clear(); layer.update(civicView(1));
    expect(drawnPieces(layer.pieces)).toContain(kits[0].objects.keep.lods[0]); expect(layer.blocks.count).toBe(1);
    layer.dispose();
  });

  it('keeps explicit palace-small naming and otherwise follows the campaign tier', () => {
    expect(palaceName({ id: 'palace' }, { tierId: 'small' })).toBe('palace-small');
    expect(palaceName({ modelName: 'palace-small' }, { tierId: 'big' })).toBe('palace-small');
    expect(palaceName({ name: 'palace' }, { tierId: 'small' })).toBe('palace');
    expect(palaceName({ id: 'palace' }, { tierId: 'medium' })).toBe('palace');
  });

  it('dresses the non-city unfortified objective and changes its states and zoom', async () => {
    const kit = await fromSpecs(civicSpecs); const r = civicRenderer();
    const group = r.structureMeshes.get('keep'); const s = r.setup.structures[0];
    const a = createArtIndex({ 'battle/city/civic-bronze.glb': 'civic' });
    const dressing = new CivicStructures(r, { art: a, load: async () => kit });
    dressing.add(group, s, 'bronze'); dressing.update(civicView(1)); expect(group.visible).toBe(true);
    await Promise.all(dressing.ready); dressing.update(civicView(1)); expect(group.visible).toBe(false);
    expect(drawnPieces(dressing.instances)).toContain(kit.objects.keep.lods[0]);
    dressing.update(civicView(0.69)); expect(drawnPieces(dressing.instances)).toContain(kit.objects['keep-damaged'].lods[0]);
    r.camera.zoom = 0.4; dressing.update(civicView(0)); expect(drawnPieces(dressing.instances)).toContain(kit.objects['keep-ruined'].lods[2]);
    dressing.dispose(); expect(dressing.instances.stats().copies).toBe(0);
  });

  it('does not add art when an async civic load completes after disposal', async () => {
    const kit = await fromSpecs(civicSpecs); const r = civicRenderer(); let resolve;
    const dressing = new CivicStructures(r, { art: createArtIndex({ 'battle/city/civic-bronze.glb': 'civic' }), load: () => new Promise((r) => { resolve = r; }) });
    dressing.add(r.structureMeshes.get('keep'), r.setup.structures[0], 'bronze'); dressing.dispose(); resolve(kit);
    await Promise.all(dressing.ready); expect(dressing.entries[0].kit).toBeNull(); expect(dressing.instances.stats().copies).toBe(0);
  });
});
