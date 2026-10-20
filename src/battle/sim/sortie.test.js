// src/battle/sim/sortie.test.js
// H-04 (audits/mobile-campaign-2026-10-20): a defender inside the walls ordered at an enemy at the gate
// never moved (it stood in a sealed pocket of the town); battle-lab pocketScan and sortieTrace.
import { describe, it, expect } from 'vitest';
import { sealPockets } from '../setup/cityBattle';
import { TILE } from '../setup/mapgen';
import { createWorld } from './world';
import { applyOrder } from './orders';
import { stepToward } from './movement';
import { getFlowField, tileOf } from './pathing';
import { makeRenderView } from '../render/view';
import { Q } from './constants';
import { town, army } from './assaultTestTown';

describe('H-04: a defender can always sortie, and an order that cannot be carried out says so', () => {
  it('no walkable ground in a town is sealed off from the field (the big bronze town had a pocket with a squad in it)', () => {
    [1, 3, 5].forEach((seed) => {
      const w = createWorld(town({ seed, tierId: 'big', ageId: 'bronze', fort: 2, def: ['infantry', 'infantry', 'infantry', 'ranged', 'ranged'], strD: 1000, controllers: ['ai', 'player'] }));
      const gate = w.structures.find((s) => s.kind === 'gate');
      const field = getFlowField(w, tileOf(w.map, gate.x - 4 * Q, gate.y), undefined, undefined, 1);
      army(w, 1).forEach((q) => { expect(field[tileOf(w.map, q.x, q.y)]).not.toBe(0xffff); });
    });
  });

  it('sealPockets closes a boxed-in patch and leaves connected ground alone', () => {
    const W = 12; const H = 9;
    const tiles = new Uint8Array(W * H).fill(TILE.OPEN);
    for (let y = 2; y <= 6; y++) for (let x = 5; x <= 9; x++) if (y === 2 || y === 6 || x === 5 || x === 9) tiles[y * W + x] = TILE.BUILDING;
    expect(sealPockets(tiles, W, H, 7, 4, 4)).toBe(9); // the 3 x 3 inside
    expect(tiles[4 * W + 7]).toBe(TILE.BUILDING);
    expect(tiles[4 * W + 2]).toBe(TILE.OPEN);
  });

  it('a squad that cannot reach its goal is flagged no path in your view', () => {
    const w = createWorld(town({ controllers: ['ai', 'player'] }));
    const q = army(w, 1)[0];
    const { w: mw, tiles } = w.map;
    const tx = Math.floor(q.x / Q); const ty = Math.floor(q.y / Q);
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) === 2) tiles[y * mw + x] = TILE.BUILDING;
    w.map.tiles = tiles; w.flowCache = null; w.flowCacheD = null;
    stepToward(w, q, 3 * Q, q.y);
    expect(q.noPathTick).toBe(w.tick);
    expect(makeRenderView(w, [], 1).squads[q.idx].noPath).toBe(true);
    expect(makeRenderView(w, [], 0).squads[q.idx].noPath).toBe(false);
  });

  it('a squad deployed onto a building stands on open ground beside it', () => {
    const w = createWorld(town({ controllers: ['ai', 'player'] }));
    const keep = w.structures[0];
    const q = army(w, 1)[0];
    applyOrder(w, { side: 1, type: 'deploy', squads: [q.idx], x: keep.x, y: keep.y });
    expect(TILE.BUILDING).not.toBe(w.map.tiles[tileOf(w.map, q.x, q.y)]);
  });
});
