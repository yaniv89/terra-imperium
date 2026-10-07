// Battle props (battleProps.js), wonders on the city battle (cityArt.js wonderPiece) and the
// close view's palace damage (townDamage.js applyTownDamage's `palace`).
import { describe, it, expect } from 'vitest';
import { Group, Scene } from 'three';
import { propPlacements, propsRef, BattleProps, PROP_SCALE } from './battleProps';
import { wonderPiece } from './cityArt';
import { createArtIndex } from './artIndex';
import { parseKit } from './kitLoader';
import { TILE } from '../setup/mapgen';
import { Q } from '../sim/constants';
import { kitGlb, parseGlbBytes } from '../../components/map/closeView/glbFixture';
import { applyTownDamage } from '../../components/map/closeView/townDamage';

const idx = (...keys) => createArtIndex(Object.fromEntries(keys.map((k) => [`../../assets/${k}`, `/u/${k}`])));
const field = (w = 60, h = 40) => {
  const tiles = new Uint8Array(w * h).fill(TILE.OPEN);
  for (let x = 0; x < w; x++) tiles[20 * w + x] = TILE.ROAD; // a road across
  return { w, h, tiles, keep: { x: w - 14, y: 20 } };
};
const kitOf = async (objects) => parseKit((await parseGlbBytes(kitGlb(objects))).scene);

describe('battle props', () => {
  it('are placed the same way every time, on free open ground only', () => {
    const map = field();
    const keepFoot = [];
    for (let j = 18; j <= 22; j++) for (let i = map.keep.x - 1; i <= map.keep.x + 1; i++) keepFoot.push(j * map.w + i);
    const setup = { map, seed: 7, structures: [{ footprint: keepFoot }], economy: { camp: { tx: 2, ty: 8, size: 4, footprint: [] }, nodes: [{ x: 30 * Q, y: 10 * Q }] } };
    const a = propPlacements(setup);
    expect(propPlacements(setup)).toEqual(a);
    expect(a.length).toBeGreaterThan(10);
    ['well', 'standard', 'campfire', 'haystack', 'fence-a', 'road-marker'].forEach((n) => expect(a.some((p) => p.name === n)).toBe(true));
    a.forEach((p) => {
      const c = Math.floor(p.z) * map.w + Math.floor(p.x);
      expect(keepFoot).not.toContain(c);
      expect([TILE.OPEN, TILE.SAND, TILE.ROAD]).toContain(map.tiles[c]);
      expect(Math.hypot(p.x - 30, p.z - 10)).toBeGreaterThan(1); // not on the node
    });
    // standards wear their side's colour: the defender's before the keep, the attacker's at its camp
    expect(a.filter((p) => p.name === 'standard').map((p) => p.side).sort()).toEqual([0, 1, 1]);
    expect(propPlacements({ ...setup, map: { ...map, naval: true } })).toEqual([]);
  });

  it('take the age file, but no earlier file stands in for a Modern battle', () => {
    expect(propsRef('kingdoms', idx('battle/props/props-bronze.glb')).ageId).toBe('bronze');
    expect(propsRef('modern', idx('battle/props/props-bronze.glb'))).toBeNull();
    expect(propsRef('bronze', idx())).toBeNull();
  });

  it('draw as instances and hide under a new building', async () => {
    const kit = await kitOf([{ name: 'well', size: 0.2 }, { name: 'standard', size: 0.05 }, { name: 'crate', size: 0.05 }]);
    const map = field();
    const r = { scene: new Scene(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 }, setup: { map, seed: 3, structures: [], sides: [{ color: '#2563eb', ageId: 'bronze' }, { color: '#dc2626', ageId: 'bronze' }] } };
    const p = new BattleProps(r, { art: idx('battle/props/props-bronze.glb'), load: async () => kit });
    await p.ready;
    p.update({ eco: { buildings: [] } });
    const count = () => p.instances.stats().copies;
    const all = count();
    expect(all).toBe(p.list.length);
    expect(all).toBeGreaterThan(3);
    const well = p.list.find((x) => x.name === 'well');
    p.update({ eco: { buildings: [{ alive: true, x: well.x * Q, y: well.z * Q, size: 2 }] } });
    expect(count()).toBeLessThan(all);
    expect(PROP_SCALE).toBeGreaterThan(1);
    p.dispose();
  });
});

describe('wonders on the city battle', () => {
  it('stand as the map model, fall to its ruin object or the rubble', async () => {
    const kit = await kitOf([{ name: 'tier1', size: 1 }, { name: 'tier3', size: 2 }]);
    expect(wonderPiece(kit, 0).piece.name).toBe('tier3');
    expect(wonderPiece(kit, 1).piece.name).toBe('tier3');
    expect(wonderPiece(kit, 2)).toBeNull();
    const ruinKit = await kitOf([{ name: 'tier2', size: 1 }, { name: 'ruin', size: 1 }]);
    expect(wonderPiece(ruinKit, 2).piece.name).toBe('ruin');
    expect(wonderPiece(null, 0)).toBeNull();
  });
});

describe('the close view palace damage', () => {
  it('swaps a capital palace for its damaged piece, and keeps it without the file', async () => {
    const kit = await kitOf([{ name: 'palace-damaged', size: 1 }, { name: 'palace-ruined', size: 1 }]);
    const make = () => { const root = new Group(); const node = new Group(); node.name = 'palace'; root.add(node); return { root, node }; };
    const states = [{ kind: 'palace', state: 'damaged', x: 0, z: 0, w: 1, d: 1 }];
    const a = make();
    const placed = await applyTownDamage(a.root, states, { ageId: 'bronze', art: idx('battle/city/palace-damage-bronze.glb'), load: async () => kit, palace: { name: 'palace', style: null, node: a.node } });
    expect(placed).toBe(true);
    expect(a.node.visible).toBe(false);
    expect(a.root.children.some((c) => c.name === 'damage-art')).toBe(true);
    const b = make();
    expect(await applyTownDamage(b.root, states, { ageId: 'bronze', art: idx(), palace: { name: 'palace', node: b.node } })).toBe(false);
    expect(b.node.visible).toBe(true);
  });
});
