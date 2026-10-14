// What workers carry (src/assets/battle/props/worker-loads.glb): the object per resource, the
// figure scale, the place on the worker, and the shipped file itself (every object, three levels
// each, a wheel on every barrow level).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadObjectName, loadResource, workerLoadPlacement, LOAD_OBJECTS, BARROW_EMPTY, LOAD_TILES_PER_UNIT, PERSON_TILES, WORKER_LOADS_KEY, WORKER_LOADS_MODERN_KEY, workerLoadsKey, WORKER_LOAD_BACK, usesBarrow } from './workerLoads';
import { createArtIndex } from './artIndex';
import { ART_UNIT_WORLD } from '../render/unitModels';
import { CITY_TILES_PER_UNIT } from '../setup/cityBattle';

describe('worker loads', () => {
  it('names the load and the barrow for each of the four resources', () => {
    expect(Object.keys(LOAD_OBJECTS)).toEqual(['food', 'wood', 'stone', 'gold']);
    expect(loadObjectName('wood')).toBe('load-logs');
    expect(loadObjectName('stone', { barrow: true })).toBe('barrow-stone');
    expect(loadObjectName('gold')).toBe('load-gold');
    expect(loadObjectName('food', { barrow: true })).toBe('barrow-food');
    expect(loadObjectName('ore')).toBeNull(); // ore is not a resource
  });

  it('reads today\'s `materials` from the node the worker came from', () => {
    expect(loadResource('materials', 'tree')).toBe('wood');
    expect(loadResource('materials', 'stone')).toBe('stone');
    expect(loadResource('materials', 'ore')).toBe('stone');
    expect(loadObjectName('materials', { nodeKind: 'tree' })).toBe('load-logs');
    expect(loadObjectName('food', { nodeKind: 'fish' })).toBe('load-food');
    expect(loadObjectName('materials')).toBeNull();
  });

  it('draws a load at the figure scale, on the back, and a barrow ahead', () => {
    expect(PERSON_TILES).toBe(ART_UNIT_WORLD);
    expect(LOAD_TILES_PER_UNIT).toBeCloseTo(5.278, 3);
    expect(LOAD_TILES_PER_UNIT / CITY_TILES_PER_UNIT).toBeCloseTo(1.919, 3);
    const back = workerLoadPlacement(10, 0.5, 20, 0);
    expect(back.z).toBeLessThan(20); // behind a worker facing +Z
    expect(back.x).toBeCloseTo(10, 6);
    expect(back.y).toBeCloseTo(0.5 + WORKER_LOAD_BACK.up * LOAD_TILES_PER_UNIT, 6);
    expect(back.y - 0.5).toBeLessThan(PERSON_TILES); // below the head
    const barrow = workerLoadPlacement(10, 0.5, 20, Math.PI / 2, { barrow: true });
    expect(barrow.x).toBeGreaterThan(10.5); // ahead of a worker facing +X
    expect(barrow.y).toBe(0.5);
    expect(barrow.scale).toBe(LOAD_TILES_PER_UNIT);
  });

  it('picks the file by age: Modern its own set, every other age the first, the same object names in both', () => {
    expect(workerLoadsKey('modern')).toBe(WORKER_LOADS_MODERN_KEY);
    ['bronze', 'classical', 'kingdoms', 'gunpowder', undefined].forEach((a) => expect(workerLoadsKey(a)).toBe(WORKER_LOADS_KEY));
    const both = createArtIndex({ [`src/assets/${WORKER_LOADS_KEY}`]: 'old', [`src/assets/${WORKER_LOADS_MODERN_KEY}`]: 'new' });
    expect(both.workerLoads('modern')).toEqual({ url: 'new', key: WORKER_LOADS_MODERN_KEY });
    expect(both.workerLoads('kingdoms')).toEqual({ url: 'old', key: WORKER_LOADS_KEY });
    expect(both.workerLoads()).toEqual({ url: 'old', key: WORKER_LOADS_KEY });
    // without the Modern file a Modern worker still carries something
    expect(createArtIndex({ [`src/assets/${WORKER_LOADS_KEY}`]: 'old' }).workerLoads('modern').url).toBe('old');
    expect(createArtIndex({}).workerLoads('modern')).toBeNull();
  });

  it.each([WORKER_LOADS_KEY, WORKER_LOADS_MODERN_KEY])('%s ships every object with three levels and a wheel on each barrow level', (key) => {
    const buf = readFileSync(`src/assets/${key}`);
    const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
    const nodes = json.nodes;
    const roots = Object.fromEntries(json.scenes[0].nodes.map((i) => [nodes[i].name, nodes[i]]));
    const names = [...Object.values(LOAD_OBJECTS).flatMap((o) => [o.back, o.barrow]), BARROW_EMPTY];
    expect(Object.keys(roots).sort()).toEqual([...names].sort());
    names.forEach((name) => {
      const kids = (roots[name]?.children || []).map((i) => nodes[i]);
      expect(kids.map((k) => k.name.slice(0, 4)).sort(), name).toEqual(['LOD0', 'LOD1', 'LOD2']);
      if (name.startsWith('barrow-')) kids.forEach((k) => expect((k.children || []).map((i) => nodes[i].name).filter((n) => /^wheel/.test(n)).length, `${name} ${k.name}`).toBe(1));
    });
    expect(json.materials.map((m) => m.name)).toEqual(['Town']);
  });
});

describe('X28, X32: what a laborer shows', () => {
  it('food and stone in a barrow (empty on the way out), wood and gold on the back', async () => {
    const { workerLoadObject } = await import('../render/economyLayer');
    expect(usesBarrow('food')).toBe(true); expect(usesBarrow('stone')).toBe(true);
    expect(usesBarrow('wood')).toBe(false); expect(usesBarrow('gold')).toBe(false);
    expect(workerLoadObject({ res: 'stone', kind: 'stone', load: 6 })).toBe('barrow-stone');
    expect(workerLoadObject({ res: 'food', kind: 'herd', load: 0 })).toBe(BARROW_EMPTY);
    expect(workerLoadObject({ res: 'wood', kind: 'tree', load: 4 })).toBe('load-logs');
    expect(workerLoadObject({ res: 'gold', kind: 'gold', load: 0 })).toBeNull();
  });
});
