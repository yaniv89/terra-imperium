// Landmark buildings in the close view: which buildings a town shows, which file each takes, where
// they stand round the town, and that a real GLB in the map format draws through the instanced
// layer with its Team cloth tinted and one draw call per part.
import { describe, it, expect } from 'vitest';
import { Scene, Matrix4, Vector3, Color } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BUILDING_CATEGORIES } from '../../../data/buildings';
import { styleOfLand } from '../../../data/architecture';
import fs from 'fs';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readGlbJson } from '../../../../scripts/art/glbInfo.mjs';
import { BUILDING_MODEL_IDS, EXTRACTION_MODEL_IDS, buildingRoot, needsCoast, facingOut, indexBuildingFiles, buildingModelUrl, builtModels, pickBuildingModels, buildingSpots, assignSpots, BUILDING_DISC, MAX_BUILDINGS } from './buildingModels';
import { prepareBuildingModel, createBuildingLayer } from './buildingLayer';
import { loadAssetObjects, fieldsAround } from './townAssets';
import { buildingGlb } from './glbFixture';

const cats = (over = {}) => ({ categories: { food: -1, economy: -1, military: -1, defense: -1, science: -1, industry: -1, culture: -1, naval: -1, logistics: -1, ...over }, extraction: { copper: false, iron: false, oil: false } });
const INDEX = indexBuildingFiles({
  '../../../assets/map/buildings/granary.glb': 'u/granary.glb',
  '../../../assets/map/buildings/granary-israelite.glb': 'u/granary-il.glb',
  '../../../assets/map/buildings/shrine-levant.glb': 'u/shrine-levant.glb',
  '../../../assets/map/buildings/library.glb': 'u/library.glb',
  '../../../assets/map/buildings/market-israelite.glb': 'u/market-il.glb',
  '../../../assets/map/buildings/copper_mine-israelite.glb': 'u/copper-il.glb',
  '../../../assets/map/buildings/barracks.glb': 'u/barracks.glb'
});

describe('building models: picking', () => {
  it('has one model id per building tier (defense is the wall ring)', () => {
    Object.entries(BUILDING_CATEGORIES).forEach(([cat, def]) => {
      if (cat === 'defense') expect(BUILDING_MODEL_IDS[cat]).toBeUndefined();
      else expect(BUILDING_MODEL_IDS[cat]).toHaveLength(def.tiers.length);
    });
  });

  it('indexes files by id and style, and picks the style chain before the base', () => {
    expect(INDEX.granary).toEqual({ base: 'u/granary.glb', israelite: 'u/granary-il.glb' });
    expect(INDEX.copper_mine).toEqual({ israelite: 'u/copper-il.glb' });
    expect(buildingModelUrl('granary', 'israelite', INDEX)).toBe('u/granary-il.glb');
    expect(buildingModelUrl('granary', 'europe', INDEX)).toBe('u/granary.glb');
    // Israelite falls back to the Levant, then to the base file
    expect(buildingModelUrl('shrine', 'israelite', INDEX)).toBe('u/shrine-levant.glb');
    expect(buildingModelUrl('shrine', 'europe', INDEX)).toBeNull();
    expect(buildingModelUrl('market', null, INDEX)).toBeNull();
    expect(buildingModelUrl('temple', 'israelite', INDEX)).toBeNull();
    expect(styleOfLand('il', 'bronze')).toBe('israelite');
  });

  it('ranks the highest tiers first and counts the mines', () => {
    const region = { buildings: { ...cats({ food: 0, science: 1, culture: 0, economy: 0 }), extraction: { copper: true, iron: false, oil: false } } };
    expect(builtModels(region).map((b) => b.id)).toEqual(['scriptorium', 'market', 'shrine', 'granary', 'copper_mine']);
  });

  it('shows only buildings with a file, at most the cap for the town size', () => {
    const region = { buildings: { ...cats({ food: 0, culture: 0, economy: 0, science: 0, military: 0 }), extraction: { copper: true, iron: false, oil: false } } };
    const il = pickBuildingModels(region, 'israelite', 'big', INDEX);
    expect(il.map((b) => b.id)).toEqual(['library', 'market', 'shrine', 'barracks']);
    expect(il.find((b) => b.id === 'shrine').url).toBe('u/shrine-levant.glb');
    expect(pickBuildingModels(region, 'israelite', 'small', INDEX)).toHaveLength(MAX_BUILDINGS.small);
    expect(pickBuildingModels(region, 'europe', 'big', INDEX).map((b) => b.id)).toEqual(['library', 'barracks', 'granary']);
    // no files at all: nothing, whatever the city has built
    expect(pickBuildingModels(region, 'israelite', 'big', {})).toEqual([]);
    expect(pickBuildingModels({ buildings: cats() }, 'israelite', 'big', INDEX)).toEqual([]);
    expect(pickBuildingModels({}, 'israelite', 'big', INDEX)).toEqual([]);
  });

  const SHIPPED = fs.readdirSync('src/assets/map/buildings').filter((f) => f.endsWith('.glb'));
  it('knows the id of every shipped landmark file, and its root is named after the bare id', () => {
    const ids = new Set([...Object.values(BUILDING_MODEL_IDS).flat(), ...Object.values(EXTRACTION_MODEL_IDS)]);
    SHIPPED.forEach((f) => {
      const id = f.replace(/(-[a-z]+)?\.glb$/, '');
      expect(ids.has(id), f).toBe(true);
      const nodes = readGlbJson(`src/assets/map/buildings/${f}`).nodes;
      const root = nodes.find((n) => n.name === id);
      expect(root, f).toBeTruthy();
      expect(root.children.map((c) => nodes[c].name).sort(), f).toEqual(['LOD0', 'LOD1', 'LOD2']);
    });
  });

  it('ships a base landmark for every building tier delivered so far', () => {
    const base = new Set(SHIPPED.filter((f) => !f.includes('-')).map((f) => f.replace('.glb', '')));
    ['granary', 'irrigation', 'farm_estate', 'crop_rotation_farm', 'mechanized_farm', 'market', 'bazaar', 'bank', 'stock_exchange',
      'barracks', 'drill_yard', 'military_academy', 'war_college', 'library', 'scriptorium', 'university', 'research_lab',
      'workshop', 'manufactory', 'factory', 'shrine', 'temple', 'cathedral', 'civic_center', 'harbor', 'shipyard', 'naval_base', 'carrier_dock',
      'road_post', 'highway', 'rail_depot', 'copper_mine', 'iron_foundry'].forEach((id) => expect(base.has(id), id).toBe(true));
    // any land without its own file draws the base landmark
    const region = { buildings: cats({ economy: 2, industry: 2, culture: 1 }) };
    expect(pickBuildingModels(region, 'europe', 'big').map((p) => p.id)).toEqual(['factory', 'bank', 'temple']);
  });

  it('finds the shipped Israelite files for Israelite land only', () => {
    const region = { buildings: cats({ food: 0, culture: 0 }) };
    const il = pickBuildingModels(region, styleOfLand('il', 'bronze'), 'small');
    il.forEach((p) => expect(p.url).toMatch(/-israelite/));
    if (fs.existsSync('src/assets/map/buildings/granary-israelite.glb')) expect(il.map((p) => p.id)).toEqual(['shrine', 'granary']);
    // other lands take the base files
    pickBuildingModels(region, 'europe', 'small').forEach((p) => expect(p.url).not.toMatch(/-israelite/));
  });
});

describe('building models: placement', () => {
  const half = { small: 2, medium: 3, big: 4 };
  const wall = { small: 2.35, medium: 3.4, big: 4.5 };

  it('offers inner spots on the back of the town first, then spots outside the wall', () => {
    ['small', 'medium', 'big'].forEach((tier) => {
      const spots = buildingSpots(tier, 0);
      const inner = spots.filter((s) => s.inner);
      expect(inner.length).toBeGreaterThan(0);
      expect(spots.slice(0, inner.length).every((s) => s.inner)).toBe(true);
      inner.forEach((s) => {
        expect(s.z).toBeLessThan(0); // north, away from the banner below the town
        expect(Math.max(Math.abs(s.x), Math.abs(s.z)) + BUILDING_DISC).toBeLessThanOrEqual(half[tier] + 0.1); // within the ground, short of the wall ring
        expect(Math.hypot(s.x, s.z) - BUILDING_DISC).toBeGreaterThanOrEqual(tier === 'small' ? 0.4 : 0.6); // clear of the palace (0.4 and 0.6 from the centre in the shared files)
      });
      spots.filter((s) => !s.inner && !s.shore).forEach((s) => {
        expect(Math.hypot(s.x, s.z) - BUILDING_DISC).toBeGreaterThan(wall[tier]);
        // never in front of the gate (south)
        expect(s.z > 0 && Math.abs(s.x) < 1.2).toBe(false);
      });
    });
  });

  it('keeps outer spots clear of the town\'s own fields', () => {
    [2, 4, 6].forEach((n) => {
      const fields = fieldsAround('medium', 7, n);
      const spots = buildingSpots('medium', 7, fields).filter((s) => !s.inner && !s.shore);
      spots.forEach((s) => fields.forEach((f) => expect(Math.hypot(s.x - f.x, s.z - f.z)).toBeGreaterThan(BUILDING_DISC + 0.8 - 0.05)));
    });
    expect(buildingSpots('medium', 7, fieldsAround('medium', 7, 2)).filter((s) => !s.inner).length).toBeGreaterThan(3);
  });

  it('gives each landmark the first free spot, never two on one place', () => {
    const models = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    const spots = buildingSpots('big', 3);
    const all = assignSpots(models, spots);
    expect(all.map((p) => p.model.id)).toEqual(['a', 'b', 'c', 'd']);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(Math.hypot(all[i].spot.x - all[j].spot.x, all[i].spot.z - all[j].spot.z)).toBeGreaterThanOrEqual(2 * BUILDING_DISC);
      }
    }
    expect(all[0].spot).toBe(spots[0]);
    // the map refuses some spots (water, another town): the next one is taken, and a landmark
    // with no spot left is not drawn
    const onlyOuterNorth = assignSpots(models, spots, (s) => !s.inner && s.z < -4);
    expect(onlyOuterNorth.length).toBeGreaterThan(0);
    onlyOuterNorth.forEach((p) => expect(p.spot.inner).toBe(false));
    expect(assignSpots(models, spots, () => false)).toEqual([]);
  });

  it('stands a naval landmark only outside the wall, its front to the water', () => {
    const spots = buildingSpots('medium', 2);
    expect(needsCoast('harbor')).toBe(true);
    expect(needsCoast('shipyard')).toBe(true);
    expect(needsCoast('granary')).toBe(false);
    // the front (+z after the turn) points straight away from the town's centre
    spots.filter((s) => !s.inner).forEach((s) => {
      const f = facingOut(s);
      const r = Math.hypot(s.x, s.z);
      expect(Math.sin(f.yaw)).toBeCloseTo(s.x / r, 6);
      expect(Math.cos(f.yaw)).toBeCloseTo(s.z / r, 6);
    });
    // shore spots: on the edge of the town's ground all round, never at the gate
    const shore = spots.filter((s) => s.shore);
    expect(shore.length).toBeGreaterThan(8);
    shore.forEach((s) => {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThan(half.medium);
      expect(Math.hypot(s.x, s.z)).toBeLessThan(wall.medium);
      expect(s.z > 0 && Math.abs(s.x) < 1.2).toBe(false);
    });
    const tried = [];
    const placed = assignSpots([{ id: 'harbor' }, { id: 'granary' }], spots, (s, m) => { tried.push([m.id, s.inner, !!s.shore]); return true; });
    const harborTried = tried.filter(([id]) => id === 'harbor');
    expect(harborTried.every(([, inner]) => !inner)).toBe(true);
    expect(harborTried[0][2]).toBe(true); // the shore first
    expect(tried.filter(([id]) => id === 'granary').every(([, , sh]) => !sh)).toBe(true); // shore spots are for naval landmarks only
    expect(placed[0].spot.shore).toBe(true);
    expect(placed[0].spot.yaw).not.toBe(0);
    expect(placed[1].spot).toBe(spots[0]); // the granary still takes the first rim spot
    // only the ring outside the wall has water in front: the harbor goes there
    const out = assignSpots([{ id: 'harbor' }], spots, (s) => !s.shore);
    expect(out[0].spot.inner || out[0].spot.shore).toBeFalsy();
    // no shore round the town (the map finds no water in front): no harbor at all
    expect(assignSpots([{ id: 'harbor' }], spots, (s, m) => m.id !== 'harbor')).toEqual([]);
  });

  it('places the same spots for the same town every time', () => {
    expect(buildingSpots('medium', 11, fieldsAround('medium', 11, 3))).toEqual(buildingSpots('medium', 11, fieldsAround('medium', 11, 3)));
    expect(buildingSpots('medium', 11)).not.toEqual(buildingSpots('medium', 12));
  });
});

describe('building models: a real GLB through the instanced layer', () => {
  const parse = (bytes) => new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

  it('finds the object named after the file, then the bare id, then the only one', () => {
    expect(buildingRoot({ 'granary-israelite': 1, x: 2 }, 'granary', '/src/assets/map/buildings/granary-israelite.glb')).toBe(1);
    expect(buildingRoot({ 'granary-israelite': 1, x: 2 }, 'granary', '/terra-imperium/assets/granary-israelite-Bx7kQ2aZ.glb')).toBe(1);
    expect(buildingRoot({ x: 2, granary: 3 }, 'granary', 'u/granary.glb')).toBe(3);
    expect(buildingRoot({ x: 2 }, 'granary', 'u/whatever.glb')).toBe(2);
  });

  const REAL = 'src/assets/map/buildings/granary-israelite.glb';
  it.skipIf(!fs.existsSync(REAL))('reads a delivered Israelite landmark (meshopt) into Town and Team parts per LOD', async () => {
    globalThis.self ||= globalThis; // GLTFLoader's texture path reads `self` (the embedded atlas fails to decode in node; the geometry is what is checked)
    const b = fs.readFileSync(REAL);
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const objs = await loadAssetObjects('test://real-granary', () => loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), ''));
    const root = buildingRoot(objs, 'granary', REAL);
    expect(root.name).toBe('granary'); // roots are named after the bare id (art 38ace92)
    const lods = prepareBuildingModel(root);
    expect(lods).toHaveLength(3);
    lods.forEach((parts) => {
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.some((p) => p.kind === 'team')).toBe(true);
    });
  });

  it('parses the fixture into a root with LOD children and splits it per material', async () => {
    const objs = await loadAssetObjects('test://granary-israelite.glb', () => parse(buildingGlb('granary-israelite')));
    expect(Object.keys(objs)).toEqual(['granary-israelite']);
    const lods = prepareBuildingModel(buildingRoot(objs, 'granary', 'test://granary-israelite.glb'));
    expect(lods).toHaveLength(3);
    lods.forEach((parts) => {
      expect(parts.map((p) => p.kind)).toEqual(['plain', 'team']);
      expect(parts[1].material.color.getHex()).toBe(0xffffff);
    });
  });

  it('draws every town\'s copy with one draw call per part, Team tinted per town', async () => {
    const objs = await loadAssetObjects('test://granary-b.glb', () => parse(buildingGlb('granary')));
    const scene = new Scene();
    const layer = createBuildingLayer(scene);
    expect(layer.add('u/none', new Matrix4(), '#ff0000')).toBe(false);
    layer.setModel('u/granary', objs.granary);
    layer.begin(1);
    for (let i = 0; i < 40; i++) layer.add('u/granary', new Matrix4().makeTranslation(i * 10, 0, 0), i % 2 ? '#ff0000' : '#0000ff');
    layer.end();
    expect(layer.drawCalls()).toBe(2); // Town and Team, for 40 towns
    const meshes = scene.children.filter((m) => m.isInstancedMesh && m.count);
    expect(meshes.map((m) => m.count)).toEqual([40, 40]);
    const team = meshes.find((m) => m.material.name === 'Team');
    const c = new Color();
    team.getColorAt(1, c);
    expect(c.r).toBeGreaterThan(c.b);
    team.getColorAt(0, c);
    expect(c.b).toBeGreaterThan(c.r);
    const m = new Matrix4(); team.getMatrixAt(3, m);
    expect(new Vector3().setFromMatrixPosition(m).x).toBeCloseTo(30, 5);
    // the next layout starts empty
    layer.begin(0); layer.end();
    expect(layer.drawCalls()).toBe(0);
    layer.dispose();
    expect(scene.children.filter((o) => o.isInstancedMesh)).toHaveLength(0);
  });
});
