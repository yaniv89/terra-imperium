// src/battle/sim/orderSchema.test.js
// The one order schema (playtest audit CB01): every order the sim handles has a row, every row
// round-trips, a malformed order is refused, and the side is always forced.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admitOrder, ORDER_SCHEMA, ORDER_TYPES, MAX_SQUADS_PER_ORDER, MAX_PATH_POINTS } from './orderSchema';

// One valid example of every order type, as the battle screen sends it.
const EXAMPLES = {
  move: { squads: [0, 3], x: 512, y: 1024.5, formation: 'line' },
  attackMove: { squads: [1], x: 0, y: 0, formation: 'column' },
  movePath: { squads: [0, 3], path: [{ x: 10, y: 20 }, { x: 300.5, y: 40 }], formation: 'line' },
  deploy: { squads: [0, 1, 2], x: 300, y: 4000, formation: 'line' },
  formationLine: { squads: [0, 1], x: 10, y: 20, x2: 10, y2: 900 },
  attack: { squads: [2], target: { kind: 'eco', index: 4 } },
  stop: { squads: [5] },
  hold: { squads: [5] },
  retreat: { squads: [5] },
  retreatAll: {},
  callReserve: { squads: [7] },
  ability: { squads: [1], ability: 'charge' },
  power: { power: 'rallyCry', x: 100, y: 200 },
  garrison: { squads: [1, 2], structure: 0 },
  gather: { squads: [9, 10], node: 3 },
  build: { squads: [9], building: 'barracks', tx: 12, ty: 30 },
  assist: { squads: [9], target: { kind: 'eco', index: 2 } },
  repair: { squads: [9], target: { kind: 'structure', index: 0 } },
  train: { building: 2, role: 'infantry', count: 3 },
  cancelTrain: { building: 2, slot: 1 },
  rally: { building: 2, x: 700, y: 800 },
  cancelBuild: { building: 3 },
  workerPreset: { preset: 'food' },
  autoRebuild: { on: true },
  steward: { on: true }
};

const source = (file) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
const casesIn = (text, fn) => {
  const body = text.slice(text.indexOf(`export const ${fn} = `));
  const end = body.indexOf('\n};');
  return [...body.slice(0, end).matchAll(/case '([A-Za-z]+)'/g)].map((m) => m[1]);
};

describe('battle order schema', () => {
  it('knows every order the sim handles (fails when the sim gains an order the verifier lacks)', () => {
    const army = casesIn(source('./orders.js'), 'applyOrder');
    const eco = casesIn(source('./economy.js'), 'applyEcoOrder');
    expect(army.length).toBeGreaterThan(10);
    expect(eco.length).toBeGreaterThan(7);
    expect([...new Set([...army, ...eco])].sort()).toEqual([...ORDER_TYPES].sort());
    expect(Object.keys(EXAMPLES).sort()).toEqual([...ORDER_TYPES].sort());
  });

  it('every order type round-trips with its whole payload, forced onto the given side', () => {
    ORDER_TYPES.forEach((type) => {
      const sent = { type, side: 0, ...EXAMPLES[type], tick: 40, seq: 7, evil: true };
      const admitted = admitOrder(sent, 1);
      expect(admitted, type).toEqual({ type, side: 1, ...(ORDER_SCHEMA[type].req?.squads ? { squads: [] } : {}), ...EXAMPLES[type] });
      // idempotent: what the live loop logged is what the replay admits
      expect(admitOrder(admitted, 1), `${type} again`).toEqual(admitted);
    });
  });

  it('refuses what it does not know or cannot read', () => {
    const bad = [
      null, 'move', { type: 'teleport' }, { type: 'constructor' }, { type: 'toString' },
      { type: 'move', squads: [0], x: NaN, y: 1 }, { type: 'move', squads: [0], x: 1 }, { type: 'move', squads: 'all', x: 1, y: 1 },
      { type: 'move', squads: [0], x: 1, y: 1, formation: 7 },
      { type: 'movePath', squads: [0], path: [] }, { type: 'movePath', squads: [0] }, { type: 'movePath', squads: [0], path: [{ x: 1, y: NaN }] },
      { type: 'movePath', squads: [0], path: Array.from({ length: MAX_PATH_POINTS + 1 }, (_, i) => ({ x: i, y: i })) }, // too many waypoints
      { type: 'formationLine', squads: [0], x: 1, y: 1, x2: Infinity, y2: 2 },
      { type: 'attack', squads: [0] }, { type: 'attack', squads: [0], target: { kind: 'node', index: 1 } }, { type: 'attack', squads: [0], target: { kind: 'squad', index: -1 } },
      { type: 'assist', squads: [0], target: { kind: 'squad', index: 1 } },
      { type: 'ability', squads: [0], ability: '' }, { type: 'power', power: 'x'.repeat(40) }, { type: 'power', power: 'nuclearStrike' }, { type: 'power', power: 'rallyCry', x: 'left' },
      { type: 'garrison', squads: [0], structure: 1.5 },
      { type: 'gather', squads: [0], node: -1 },
      { type: 'build', squads: [0], building: 'deathStar', tx: 1, ty: 1 }, { type: 'build', squads: [0], building: 'toString', tx: 1, ty: 1 }, { type: 'build', squads: [0], building: 'house', tx: 1.5, ty: 1 },
      { type: 'train', building: 0, role: 'dragon' }, { type: 'train', building: 0, role: 'infantry', count: 2.5 }, { type: 'train', role: 'infantry' },
      { type: 'cancelTrain', building: 0, slot: 'last' }, { type: 'rally', building: 0, x: 5 }, { type: 'cancelBuild' }
    ];
    bad.forEach((o) => expect(admitOrder(o, 0), JSON.stringify(o)).toBeNull());
  });

  it('normalises only what the sim would read the same way', () => {
    expect(admitOrder({ type: 'stop' }, 0)).toEqual({ type: 'stop', side: 0, squads: [] });
    expect(admitOrder({ type: 'stop', squads: [0, -1, 'x', 2, 2.5] }, 0).squads).toEqual([0, 2]);
    expect(admitOrder({ type: 'stop', squads: Array.from({ length: MAX_SQUADS_PER_ORDER + 9 }, (_, i) => i) }, 0).squads).toHaveLength(MAX_SQUADS_PER_ORDER);
    expect(admitOrder({ type: 'train', building: 1, role: 'worker', count: 99 }, 0).count).toBe(5);
    expect(admitOrder({ type: 'rally', building: 1, x: null, y: undefined }, 0)).toEqual({ type: 'rally', side: 0, building: 1 });
    expect(admitOrder({ type: 'power', power: 'rallyCry' }, 0)).toEqual({ type: 'power', side: 0, power: 'rallyCry' });
  });
});
