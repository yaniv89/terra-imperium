// CB20 I209: own and enemy buildings told apart by the mark's shape, not only its colour.
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { frameAlpha, ownerMarkKind, OwnerMarks } from './ownerMarks';
import { EconomyLayer } from './economyLayer';
import { Q } from '../sim/constants';

describe('picking a resource node (U04)', () => {
  it('a grove is picked by its canopy, and by a finger-wide circle when zoomed out', () => {
    const r = { scene: new Group(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 }, setup: { terrain: 'plains', economy: {}, sides: [{ color: '#fff' }, { color: '#000' }] } };
    const layer = new EconomyLayer(r, { art: { rts: () => null, nature: () => null, vegetation: () => null }, load: async () => null });
    const v = { eco: { buildings: [], nodes: [{ i: 0, kind: 'tree', x: 10 * Q, y: 10 * Q, res: 'wood' }, { i: 1, kind: 'stone', x: 20 * Q, y: 10 * Q, res: 'stone' }, { i: 2, kind: 'tree', x: 30 * Q, y: 10 * Q, spent: true }] } };
    expect(layer.pick({ x: 11.2, z: 10 }, v)).toMatchObject({ kind: 'node', index: 0 });
    expect(layer.pick({ x: 21.2, z: 10 }, v)).toBeNull();
    expect(layer.pick({ x: 21.2, z: 10 }, v, 1.5)).toMatchObject({ kind: 'node', index: 1 }); // far zoom
    expect(layer.pick({ x: 30, z: 10 }, v, 1.5)).toBeNull(); // spent: nothing to gather
  });
});

describe('owner marks (I209)', () => {
  it('own: a closed frame; enemy: corner brackets only', () => {
    // the middle of an edge: drawn for own, empty for the enemy
    expect(frameAlpha(0.9, 0, { inner: 0.84 })).toBe(1);
    expect(frameAlpha(0.9, 0, { inner: 0.78, brackets: true })).toBe(0);
    // a corner: drawn for both
    expect(frameAlpha(0.9, 0.85, { inner: 0.78, brackets: true })).toBe(1);
    // inside the building and past the quad: nothing
    expect(frameAlpha(0.2, 0.1)).toBe(0);
    expect(ownerMarkKind(0, 0)).toBe('own');
    expect(ownerMarkKind(1, 0)).toBe('enemy');
    expect(ownerMarkKind(0, 1)).toBe('enemy');
  });

  it('marks every standing building and the defender\'s keep, none on a wreck', () => {
    const r = {
      scene: new Group(), track: (x) => x, heightAt: () => 0, camera: { zoom: 1 }, playerSide: 0,
      setup: { terrain: 'plains', map: { w: 64, h: 40 }, economy: {}, structures: [{ kind: 'keep', footprint: [10 * 64 + 50, 10 * 64 + 51, 11 * 64 + 50, 11 * 64 + 51] }], sides: [{ ageId: 'bronze', color: '#3b82f6' }, { ageId: 'bronze', color: '#f97316' }] }
    };
    const layer = new EconomyLayer(r, { art: { rts: () => null, nature: () => null, vegetation: () => null }, load: async () => null });
    layer.build();
    const b = (idx, side, alive = true) => ({ idx, side, alive, type: 'barracks', size: 3, x: (5 + idx * 6) * Q, y: 5 * Q, built: true, hp: alive ? 900 : 0, maxHp: 1200, progress: 100 });
    layer.update({ eco: { nodes: [], buildings: [b(0, 0), b(1, 1), b(2, 1, false)] }, structures: [{ kind: 'keep', alive: true, x: 51 * Q, y: 11 * Q, radius: Q }] }, () => true);
    expect(layer.owners.meshes.own.count).toBe(1);
    expect(layer.owners.meshes.enemy.count).toBe(2); // the enemy barracks and the keep
    const e = layer.owners.meshes.enemy.instanceMatrix.array;
    expect(e[16 + 12]).toBeCloseTo(51); // the keep's footprint centre
    expect(e[16]).toBeCloseTo(2.6); // its 2 tiles plus the margin
    expect(new OwnerMarks(r).meshes.own).toBeTruthy();
    layer.dispose();
  });
});
