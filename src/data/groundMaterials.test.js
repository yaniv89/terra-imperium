// Ground materials (src/assets/terrain/<id>/) and map terrain kits (src/assets/map/terrain/): found
// when dropped in, wired into both ground shaders and the close view's ridges and hills, and
// compiled out entirely when absent.
import { describe, it, expect } from 'vitest';
import { InstancedMesh, BoxGeometry, MeshBasicMaterial, MeshLambertMaterial, Texture } from 'three';
import { indexGroundMaterials, groundMaterial, battleGroundSets, GROUND_MATERIALS, groundTextureUniform, whiteTexture } from './groundMaterials';
import { closeGroundSetup, TERRAIN_FRAGMENT } from '../components/map/closeView/terrainShader';
import { patchGroundMaterial } from '../battle/render/terrainSurface';
import { dressCloseTerrain, mapTerrainKit } from '../components/map/closeView/terrainKits';
import { createArtIndex } from '../battle/art/artIndex';
import { parseKit } from '../battle/art/kitLoader';
import { kitGlb, parseGlbBytes } from '../components/map/closeView/glbFixture';

const files = {
  '../assets/terrain/grass/color.webp': 'g.webp', '../assets/terrain/grass/normal.png': 'gn.png', '../assets/terrain/grass/orm.png': 'go.png',
  '../assets/terrain/rock/color.webp': 'r.webp', '../assets/terrain/snow/normal.png': 'only-normal.png'
};

describe('ground materials', () => {
  it('index sets with a colour, with fallbacks', () => {
    const idx = indexGroundMaterials(files);
    expect(Object.keys(idx).sort()).toEqual(['grass', 'rock']);
    expect(idx.grass).toEqual({ color: 'g.webp', normal: 'gn.png', orm: 'go.png' });
    expect(groundMaterial('steppe-grass', idx).id).toBe('grass');
    expect(groundMaterial('paving', idx).id).toBe('rock');
    expect(groundMaterial('snow', idx)).toBeNull();
    const sets = battleGroundSets('plains', { index: idx });
    expect(sets.base.id).toBe('grass'); expect(sets.rock.id).toBe('rock'); expect(sets.sand).toBeNull();
    expect(Object.values(GROUND_MATERIALS).every((s) => !!s.color)).toBe(true);
    expect(groundTextureUniform(null).value).toBe(whiteTexture());
  });

  it('selects explicit tundra detail and falls back to rock until delivered', () => {
    const idx = indexGroundMaterials({ ...files, '../assets/terrain/tundra/color.webp': 't.webp' });
    expect(battleGroundSets('tundra', { index: idx }).base).toEqual({ id: 'tundra', color: 't.webp' });
    expect(battleGroundSets('tundra', { index: indexGroundMaterials(files) }).base.id).toBe('rock');
    expect(battleGroundSets('arctic', { index: idx }).base).toBeNull();
  });
  it('compile into the battle ground shader only where a set exists', () => {
    const compile = (details) => {
      const m = patchGroundMaterial(new MeshLambertMaterial(), { mask: new Texture(), mapW: 10, mapH: 10, road: '#000', sand: '#000', rock: '#000', forest: '#000', details });
      const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
      m.onBeforeCompile(shader);
      return { shader, key: m.customProgramCacheKey() };
    };
    const none = compile({});
    expect(none.shader.fragmentShader).not.toMatch(/groundDetail\(/);
    expect(none.key).toBe('battle-ground|');
    const some = compile({ base: { value: new Texture() }, rock: { value: new Texture() } });
    expect(some.shader.fragmentShader).toMatch(/#define GD_BASE/);
    expect(some.shader.fragmentShader).toMatch(/d_rock = groundDetail\(uGd_rock/);
    expect(some.shader.uniforms.uGd_base).toBeTruthy();
    expect(some.key).toBe('battle-ground|base,rock');
  });

  it('compile into the close-view terrain shader only where a set exists', () => {
    expect(closeGroundSetup({})).toEqual({ defines: {}, uniforms: {} });
    const s = closeGroundSetup(indexGroundMaterials(files), () => ({ value: 1 }));
    expect(s.defines).toEqual({ GROUND_MATERIALS: 1, GM_GRASS: 1, GM_STEPPE: 1, GM_ROCK: 1 }); // steppe falls back to grass
    expect(Object.keys(s.uniforms).sort()).toEqual(['uGmGrass', 'uGmRock', 'uGmSteppe']);
    expect(TERRAIN_FRAGMENT).toMatch(/#ifdef GROUND_MATERIALS/);
  });
});

describe('map terrain kits', () => {
  it('swap the close view\'s ridges and hills when delivered, keep them when not', async () => {
    const mk = () => new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 3);
    const ridges = new Map(); [0, 1, 2].forEach((v) => [false, true].forEach((snow) => ridges.set(`${v}|${snow}`, mk())));
    const hills = mk();
    const before = ridges.get('1|true').geometry;
    const art = createArtIndex({ 'assets/map/terrain/mountain-ridges.glb': 'test://ridges', 'assets/map/terrain/hills.glb': 'test://hills' });
    const kits = { 'test://ridges': [{ name: 'ridge-1', size: 2 }, { name: 'ridge-2', size: 2 }, { name: 'ridge-2-snow', size: 2 }], 'test://hills': [{ name: 'hill', size: 2 }] };
    const load = async (url) => parseKit((await parseGlbBytes(kitGlb(kits[url]))).scene);
    let ready = 0;
    const n = await dressCloseTerrain({ ridges, hills }, () => { ready += 1; }, { art, load });
    expect(n).toBe(7); // ridge-3 falls back to ridge-1
    expect(ready).toBe(1);
    expect(ridges.get('1|true').geometry).not.toBe(before);
    expect(ridges.get('1|true').geometry).not.toBe(ridges.get('1|false').geometry);
    const keep = mk(); const g = keep.geometry;
    expect(await dressCloseTerrain({ ridges: new Map([['0|false', keep]]), hills: null }, () => {}, { art: createArtIndex({}) })).toBe(0);
    expect(keep.geometry).toBe(g);
    expect(await mapTerrainKit('dunes', { art })).toBeNull();
  });
});
