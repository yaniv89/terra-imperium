// The battle economy's art (src/assets/battle/rts/rts-<age>.glb, src/assets/battle/nature/*.glb):
// a dropped-in file replaces the greyboxes per age with the earlier-age fallback, picks the damaged
// and construction objects, the node states by what is left; no file keeps the greyboxes.
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { EconomyLayer, nodeStateNames, groveNames, constructionStage, kitLodForZoom, sideTheme, SKIN_ROLES } from './economyLayer';
import { createArtIndex } from '../art/artIndex';
import { parseKit } from '../art/kitLoader';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';
import { Q } from '../sim/constants';

const FILES = {
  'battle/rts/rts-bronze.glb': [{ name: 'barracks', size: 1.2 }, { name: 'barracks-damaged', size: 1.2 }, { name: 'construction-stage-1', size: 1.2 }, { name: 'tower', size: 0.8 }],
  'battle/nature/stone-outcrop.glb': [{ name: 'full', size: 0.6 }, { name: 'half', size: 0.5 }, { name: 'depleted', size: 0.4 }],
  'battle/nature/herd-cattle.glb': [{ name: 'animal', size: 0.25 }],
  // a culture skin: the Shang (sinic) barracks, larger so its geometry is told apart
  'battle/rts/rts-bronze-sinic.glb': [{ name: 'barracks', size: 1.5 }, { name: 'barracks-damaged', size: 1.5 }]
};
const loader = async (url) => parseKit((await parseGlbBytes(kitGlb(FILES[url.replace('test://', '')]))).scene);
const fakeRenderer = () => ({
  scene: new Group(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 },
  setup: { terrain: 'plains', economy: { nodes: [] }, sides: [{ ageId: 'kingdoms', color: '#dc2626' }, { ageId: 'modern', color: '#2563eb' }] }
});
const view = () => ({
  eco: {
    nodes: [{ i: 0, kind: 'stone', x: 10 * Q, y: 10 * Q, amount: 100, max: 500 }, { i: 1, kind: 'cattle', x: 20 * Q, y: 10 * Q, amount: 450, max: 450 }, { i: 2, kind: 'gold', x: 30 * Q, y: 10 * Q, amount: 400, max: 400 }],
    buildings: [
      { idx: 0, alive: true, side: 0, type: 'barracks', size: 3, x: 5 * Q, y: 5 * Q, built: true, hp: 500, maxHp: 1200, progress: 100 },
      { idx: 1, alive: true, side: 0, type: 'tower', size: 2, x: 9 * Q, y: 5 * Q, built: false, hp: 100, maxHp: 1000, progress: 30 },
      { idx: 2, alive: true, side: 0, type: 'stable', size: 4, x: 15 * Q, y: 5 * Q, built: true, hp: 1300, maxHp: 1300, progress: 100 }
    ]
  }
});
const greyboxes = (layer) => Object.values(layer.meshes).reduce((n, m) => n + m.count, 0);

describe('battle economy art', () => {
  it('picks states, stages and LODs', () => {
    expect(nodeStateNames(0.9)[0]).toBe('full');
    expect(nodeStateNames(0.3)[0]).toBe('half');
    expect(nodeStateNames(0)[0]).toBe('depleted');
    expect(groveNames(1)[0]).toBe('tree-l');
    expect(groveNames(0)[0]).toBe('stump');
    expect([0, 24, 25, 60, 99, 100].map(constructionStage)).toEqual(['construction-stage-0', 'construction-stage-0', 'construction-stage-1', 'construction-stage-2', 'construction-stage-3', 'construction-stage-3']);
    expect([2, 1, 0.6, 0.3].map(kitLodForZoom)).toEqual([0, 0, 1, 2]);
  });

  it('draws a dropped-in file in place of the greyboxes, the Bronze file standing in for later ages', async () => {
    const art = createArtIndex(Object.fromEntries(Object.keys(FILES).map((k) => [`assets/${k}`, `test://${k}`])));
    const r = fakeRenderer();
    const layer = new EconomyLayer({ ...r, setup: { ...r.setup, economy: {} } }, { art, load: loader });
    layer.build();
    await Promise.all(layer.ready);
    layer.update(view(), () => true);
    // barracks (damaged), the tower's stage-1 scaffold, the stone outcrop (half), two cattle
    expect(layer.kits.stats().copies).toBe(5);
    const objs = [...layer.kits.meshes.keys()].map((b) => b.geometry.uuid);
    expect(new Set(objs).size).toBe(4);
    // the stable has no object in the file and gold no file: both stay greyboxes
    expect(greyboxes(layer)).toBeGreaterThan(0);
    layer.dispose();
  });

  it('a side builds the culture skin of its people where one exists, the shared building elsewhere', async () => {
    expect(sideTheme({ nationId: 'shang', ageId: 'bronze' })).toBe('sinic');
    expect([...SKIN_ROLES].sort()).toEqual(['barracks', 'tower', 'trade-post']);
    const art = createArtIndex(Object.fromEntries(Object.keys(FILES).map((k) => [`assets/${k}`, `test://${k}`])));
    expect(art.rtsSkin('bronze', 'korea').style).toBe('sinic'); // the style chain
    expect(art.rtsSkin('bronze', 'nile')).toBeNull();
    const r = fakeRenderer();
    const sides = [{ ageId: 'bronze', nationId: 'shang', color: '#dc2626' }, { ageId: 'bronze', nationId: 'kemet', color: '#2563eb' }];
    const layer = new EconomyLayer({ ...r, setup: { ...r.setup, sides, economy: {} } }, { art, load: loader });
    layer.build();
    await Promise.all(layer.ready);
    const skin = layer.kit(layer.skinRef[0]);
    expect(skin).toBeTruthy();
    expect(layer.skinRef[1]).toBeNull();
    const v = view();
    v.eco.buildings.push({ idx: 3, alive: true, side: 1, type: 'barracks', size: 3, x: 25 * Q, y: 5 * Q, built: true, hp: 1200, maxHp: 1200, progress: 100 });
    layer.update(v, () => true);
    const drawn = new Set([...layer.kits.meshes.keys()].map((b) => b.geometry.uuid));
    // side 0's damaged barracks from the skin, side 1's barracks from the shared file
    expect(drawn.has(skin.objects['barracks-damaged'].lods[0].geometry.uuid)).toBe(true);
    const shared = layer.kit({ url: 'test://battle/rts/rts-bronze.glb' });
    expect(drawn.has(shared.objects.barracks.lods[0].geometry.uuid)).toBe(true);
    expect(drawn.has(shared.objects['barracks-damaged'].lods[0].geometry.uuid)).toBe(false);
    layer.dispose();
  });

  it('keeps the greyboxes and loads nothing without files', () => {
    let loads = 0;
    const layer = new EconomyLayer({ ...fakeRenderer(), setup: { ...fakeRenderer().setup, economy: {} } }, { art: createArtIndex({}), load: async () => { loads += 1; } });
    layer.build();
    layer.update(view(), () => true);
    expect(loads).toBe(0);
    expect(layer.kits.stats()).toEqual({ copies: 0, draws: 0 });
    expect(greyboxes(layer)).toBeGreaterThan(10);
  });
});
