// Improvement models in the close view: the file naming, which file a tile takes (age first, then
// the land's style chain, then the base set), where a model may stand (boats on water beside the
// coast, the rest on land, never on anything else), the boats' turn toward the coast, and that
// the delivered Israelite files load into the instanced layer.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { Scene, Matrix4, Color, Vector3, Euler } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getTiles } from '../../../data/geo/tiles';
import { IMPROVEMENT_IDS } from '../../../data/tileYields';
import { parseImprovementFile, indexImprovementFiles, improvementModel, improvementModelUrl, improvementRoot, modelAllowedOnTile, boatsSpot, coastShare, shoreAnchor, yawToward, fitImprovement, BOATS_SHORE } from './improvementModels';
import { prepareBuildingModel, createBuildingLayer, modelInfo } from './buildingLayer';
import { loadAssetObjects } from './townAssets';
import { createOccupancy } from './occupancy';
import { buildingGlb } from './glbFixture';

const tiles = getTiles();
const INDEX = indexImprovementFiles({
  '../../../assets/map/improvements/farm-bronze.glb': 'u/farm-bronze',
  '../../../assets/map/improvements/farm-modern.glb': 'u/farm-modern',
  '../../../assets/map/improvements/farm-bronze-israelite.glb': 'u/farm-bronze-il',
  '../../../assets/map/improvements/fort-bronze-israelite.glb': 'u/fort-bronze-il',
  '../../../assets/map/improvements/fort-modern-israelite.glb': 'u/fort-modern-il',
  '../../../assets/map/improvements/fort-kingdoms.glb': 'u/fort-kingdoms',
  '../../../assets/map/improvements/pasture-levant.glb': 'u/pasture-levant',
  '../../../assets/map/improvements/mine.glb': 'u/mine'
});

describe('improvement models: files and lookup', () => {
  it('reads <kind>[-<age>][-<style>] names', () => {
    expect(parseImprovementFile('fishing_boats-bronze-israelite')).toEqual({ kind: 'fishing_boats', age: 'bronze', style: 'israelite' });
    expect(parseImprovementFile('fort-modern')).toEqual({ kind: 'fort', age: 'modern', style: 'base' });
    expect(parseImprovementFile('pasture-levant')).toEqual({ kind: 'pasture', age: 'bronze', style: 'levant' });
    expect(parseImprovementFile('oil_well')).toEqual({ kind: 'oil_well', age: 'bronze', style: 'base' });
    expect(parseImprovementFile('farm-bronze-israelite-extra')).toBeNull();
    expect(parseImprovementFile('Farm')).toBeNull();
  });

  it('takes the latest age at or below the owner\'s, then the style chain, then the base set', () => {
    expect(improvementModelUrl('farm', 'bronze', 'israelite', INDEX)).toBe('u/farm-bronze-il');
    expect(improvementModelUrl('farm', 'gunpowder', 'israelite', INDEX)).toBe('u/farm-bronze-il');
    // a later age's base model beats an earlier regional one
    expect(improvementModelUrl('farm', 'modern', 'israelite', INDEX)).toBe('u/farm-modern');
    expect(improvementModelUrl('farm', 'classical', 'europe', INDEX)).toBe('u/farm-bronze');
    // forts by age: the Israelite bronze fort until the base kingdoms fort, the Israelite modern one last
    expect(improvementModelUrl('fort', 'classical', 'israelite', INDEX)).toBe('u/fort-bronze-il');
    expect(improvementModelUrl('fort', 'kingdoms', 'israelite', INDEX)).toBe('u/fort-kingdoms');
    expect(improvementModelUrl('fort', 'modern', 'israelite', INDEX)).toBe('u/fort-modern-il');
    expect(improvementModelUrl('fort', 'bronze', 'europe', INDEX)).toBeNull();
    // the fallback chain (israelite -> levant)
    expect(improvementModelUrl('pasture', 'bronze', 'israelite', INDEX)).toBe('u/pasture-levant');
    expect(improvementModelUrl('pasture', 'bronze', 'sinic', INDEX)).toBeNull();
    expect(improvementModelUrl('mine', 'modern', null, INDEX)).toBe('u/mine');
    expect(improvementModelUrl('quarry', 'modern', 'israelite', INDEX)).toBeNull();
    expect(improvementModel('farm', 'bronze', 'israelite', INDEX).name).toBe('farm-bronze-israelite');
    expect(improvementModelUrl('farm', 'bronze', 'israelite', {})).toBeNull();
  });

  it('bundles the delivered base and Israelite sets, named for real improvements and ages', () => {
    const files = fs.readdirSync('src/assets/map/improvements').filter((f) => f.endsWith('.glb'));
    // every file names a real improvement, a game age (written out: a file without one would read
    // as bronze) and at most one style
    files.forEach((f) => {
      const name = f.replace('.glb', '');
      const p = parseImprovementFile(name);
      expect(p, f).toBeTruthy();
      expect(IMPROVEMENT_IDS, f).toContain(p.kind);
      expect(name.split('-')[1], f).toBe(p.age);
    });
    const base = files.filter((f) => parseImprovementFile(f.replace('.glb', '')).style === 'base').map((f) => f.replace('.glb', '')).sort();
    expect(base).toEqual(['camp-bronze', 'farm-bronze', 'farm-modern', 'fishing_boats-bronze', 'fishing_boats-modern', 'fort-classical', 'lumber_camp-bronze', 'mine-bronze', 'mine-modern',
      'pasture-bronze', 'plantation-bronze', 'quarry-bronze', 'road-bronze', 'road-modern']);
    const israelite = files.filter((f) => f.endsWith('-israelite.glb')).sort();
    expect(israelite).toEqual(['farm-bronze-israelite.glb', 'fishing_boats-bronze-israelite.glb', 'fort-bronze-israelite.glb', 'fort-modern-israelite.glb', 'pasture-bronze-israelite.glb', 'plantation-bronze-israelite.glb']);
    // the bundled index (import.meta.glob): Israelite land takes its own set, every other land the base set
    ['farm', 'pasture', 'plantation', 'fishing_boats'].forEach((kind) => {
      expect(improvementModel(kind, 'bronze', 'israelite')?.name).toBe(`${kind}-bronze-israelite`);
      expect(improvementModel(kind, 'bronze', 'levant')?.name).toBe(`${kind}-bronze`);
      expect(improvementModel(kind, 'kingdoms', 'europe')?.name).toBe(`${kind}-bronze`);
    });
    // a later age's base model beats an earlier regional one
    expect(improvementModel('farm', 'modern', 'israelite').name).toBe('farm-modern');
    expect(improvementModel('fishing_boats', 'modern', 'sinic').name).toBe('fishing_boats-modern');
    expect(improvementModel('mine', 'gunpowder', 'europe').name).toBe('mine-bronze');
    expect(improvementModel('mine', 'modern', 'israelite').name).toBe('mine-modern');
    ['camp', 'quarry', 'lumber_camp'].forEach((kind) => expect(improvementModel(kind, 'modern', 'nile').name).toBe(`${kind}-bronze`));
    expect(improvementModel('fort', 'bronze', 'israelite').name).toBe('fort-bronze-israelite');
    // the Classical castellum from the Classical Age on, everywhere (a later base beats the earlier Israelite fort)
    expect(improvementModel('fort', 'classical', 'europe').name).toBe('fort-classical');
    expect(improvementModel('fort', 'gunpowder', 'israelite').name).toBe('fort-classical');
    expect(improvementModel('fort', 'modern', 'israelite').name).toBe('fort-modern-israelite');
    expect(improvementModelUrl('fort', 'bronze', 'europe')).toBeNull();
    expect(improvementModelUrl('oil_well', 'modern', 'europe')).toBeNull();
    expect(improvementRoot({ 'farm-bronze-israelite': 1, x: 2 }, 'farm-bronze-israelite')).toBe(1);
    expect(improvementRoot({ x: 2 }, 'farm-bronze-israelite')).toBe(2);
    expect(improvementRoot(null, 'x')).toBeNull();
  });
});

describe('improvement models: placement', () => {
  const water = [...Array(tiles.count).keys()];
  const coastWater = water.find((t) => tiles.land[t] !== 1 && tiles.neighbors[t].some((n) => tiles.land[n] === 1) && Math.abs(tiles.lat[t] / 1000) < 50);
  const openSea = water.find((t) => tiles.land[t] !== 1 && tiles.neighbors[t].every((n) => tiles.land[n] !== 1 && tiles.neighbors[n].every((m) => tiles.land[m] !== 1)));
  const landTile = water.find((t) => tiles.land[t] === 1);

  it('puts boats only on water beside the coast and everything else only on land', () => {
    expect(modelAllowedOnTile(tiles, coastWater, 'fishing_boats')).toBe(true);
    expect(modelAllowedOnTile(tiles, openSea, 'fishing_boats')).toBe(false);
    expect(modelAllowedOnTile(tiles, landTile, 'fishing_boats')).toBe(false);
    expect(modelAllowedOnTile(tiles, landTile, 'farm')).toBe(true);
    expect(modelAllowedOnTile(tiles, coastWater, 'fort')).toBe(false);
  });

  it('lays the boats\' shoreline on the coast they face', () => {
    expect(boatsSpot(tiles, openSea)).toBeNull();
    const s = boatsSpot(tiles, coastWater);
    const c = tiles.latLonOf(coastWater);
    expect([s.lat, s.lon]).toEqual([c.lat, c.lon]);
    // the land they face lies among the tile's land neighbours
    const land = tiles.neighbors[coastWater].filter((n) => tiles.land[n] === 1).map((n) => tiles.latLonOf(n));
    expect(s.toLat).toBeGreaterThanOrEqual(Math.min(...land.map((p) => p.lat)) - 1e-9);
    expect(s.toLat).toBeLessThanOrEqual(Math.max(...land.map((p) => p.lat)) + 1e-9);
    // a model whose shoreline lies 1 unit east of its origin, drawn at 10 px a unit, facing land due
    // east: its origin 10 px short of the shore point, so the shoreline lands on it
    const from = { x: 0, y: 0 }; const to = { x: 200, y: 0 };
    expect(shoreAnchor(from, to, [1, 0], 10)).toEqual({ x: 200 * BOATS_SHORE - 10, y: 0 });
    // facing land due south on screen: the ground offset shrinks by the lean on screen
    const south = shoreAnchor(from, { x: 0, y: 100 }, [0, 1], 10, 0.5);
    expect(south.x).toBeCloseTo(0); expect(south.y).toBeCloseTo(100 * BOATS_SHORE - 5);
    expect(shoreAnchor(from, to, null, 10)).toEqual({ x: 200 * BOATS_SHORE, y: 0 });
    expect(BOATS_SHORE).toBeLessThan(0.5); // short of the hex edge, on the water
    // the coast found on the land mask: land east of x = 130 on a line from 0 to 200
    expect(coastShare(from, to, (x) => x >= 130, 20)).toBeCloseTo(0.65);
    expect(coastShare(from, to, () => false)).toBeNull();
    expect(shoreAnchor(from, to, [1, 0], 10, 1, 0.6)).toEqual({ x: 110, y: 0 });
  });

  it('turns the shoreline toward the coast on screen', () => {
    const tilt = 0.62; const lean = Math.sin(tilt);
    [[1, 0, 0, -1], [0.3, -0.8, -5, 2], [-1, 0.2, 3, 3], [0, 1, -2, -7]].forEach(([gx, gz, dx, dy]) => {
      const yaw = yawToward(gx, gz, dx, dy, lean);
      // the model's ground direction after the instance rotation (tilt, yaw, 0, 'XYZ'), on screen (y down)
      const v = new Vector3(gx, 0, gz).applyEuler(new Euler(tilt, yaw, 0, 'XYZ'));
      const screen = [v.x, -v.y];
      const want = Math.atan2(dy, dx); const got = Math.atan2(screen[1], screen[0]);
      expect(Math.abs(Math.atan2(Math.sin(got - want), Math.cos(got - want)))).toBeLessThan(1e-6);
    });
    expect(yawToward(0, 0, 1, 1)).toBe(0);
  });

  it('never stands on water (boats: never on land) nor on anything placed before it', () => {
    const lean = 0.6;
    const landLeft = (x) => x < 100; // land west of x = 100
    const occ = createOccupancy(lean);
    occ.claim(0, 0, 30); // a town
    expect(fitImprovement({ at: { x: 20, y: 0 }, r: 10, landAt: landLeft, occ, lean })).toBe(false); // on the town
    expect(fitImprovement({ at: { x: 95, y: 200 }, r: 10, landAt: landLeft, occ, lean })).toBe(false); // its rim in the sea
    expect(fitImprovement({ at: { x: 60, y: 200 }, r: 10, landAt: landLeft, occ, lean })).toBe(true);
    expect(fitImprovement({ at: { x: 70, y: 200 }, r: 10, landAt: landLeft, occ, lean })).toBe(false); // on that farm
    expect(fitImprovement({ boats: true, at: { x: 60, y: 400 }, r: 10, landAt: landLeft, occ, lean })).toBe(false);
    expect(fitImprovement({ boats: true, at: { x: 130, y: 400 }, r: 10, landAt: landLeft, occ, lean })).toBe(true);
    expect(occ.size()).toBe(3);
  });
});

describe('improvement models: drawing', () => {
  const parse = (bytes) => new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

  it('draws every tile\'s copy instanced, darker when pillaged', async () => {
    const objs = await loadAssetObjects('test://farm-bronze-test.glb', () => parse(buildingGlb('farm-bronze-test', 3)));
    const scene = new Scene();
    const layer = createBuildingLayer(scene);
    layer.setModel('u/farm', improvementRoot(objs, 'farm-bronze-test'));
    expect(layer.info('u/farm').radius).toBeGreaterThan(2);
    expect(layer.info('u/farm').ground).toBeNull(); // the fixture has no Ground
    layer.begin(0);
    for (let i = 0; i < 25; i++) layer.add('u/farm', new Matrix4().makeTranslation(i * 50, 0, 0), '#ff0000', null, i === 3 ? 0.45 : 1);
    layer.end();
    expect(layer.drawCalls()).toBe(2); // Town and Team for 25 farms
    const town = scene.children.find((m) => m.isInstancedMesh && m.count && m.material.name === 'Town');
    const c = new Color();
    town.getColorAt(3, c); expect(c.r).toBeCloseTo(0.45);
    town.getColorAt(4, c); expect(c.r).toBeCloseTo(1);
    layer.dispose();
  });

  const REAL = 'src/assets/map/improvements/fishing_boats-bronze-israelite.glb';
  it.skipIf(!fs.existsSync(REAL))('reads the delivered files (meshopt) into Town, Team and Ground parts per LOD', async () => {
    globalThis.self ||= globalThis; // GLTFLoader's texture path reads `self` (the atlas fails to decode in node; the geometry is checked)
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    for (const name of ['fishing_boats-bronze-israelite', 'farm-bronze-israelite', 'fort-modern-israelite']) {
      const b = fs.readFileSync(`src/assets/map/improvements/${name}.glb`);
      const objs = await loadAssetObjects(`test://real-${name}`, () => loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), ''));
      const root = improvementRoot(objs, name);
      expect(root.name).toBe(name);
      const lods = prepareBuildingModel(root);
      expect(lods).toHaveLength(3);
      lods.forEach((parts) => expect(new Set(parts.map((p) => p.kind))).toEqual(new Set(['plain', 'team', 'ground'])));
      const info = modelInfo(lods);
      // inside the 50 m (5 unit) circle of the spec
      expect(info.radius).toBeGreaterThan(0.8);
      expect(info.radius).toBeLessThanOrEqual(3.5);
      expect(info.ground).not.toBeNull();
      if (name.startsWith('fishing')) expect(Math.hypot(...info.ground)).toBeGreaterThan(0.3); // the shoreline lies to one side
    }
  });
});
