// The placement ghost's rule (placement.js, read from the render view) answers like the sim's
// (economy.js placementBlock) everywhere around the camp, before and after a building goes up.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { placementBlock } from '../sim/economy';
import { makeRenderView } from '../render/view';
import { BUILDINGS, buildableFor } from '../data/economy';
import { Q } from '../sim/constants';
import { placementCheck, PLACEMENT_REASON, legalArea, footprintAt, shortfallText } from './placement';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const world = (terrain = 'mixed', seed = 11) => createWorld(buildSetupFromArmies({
  regionId: 'placement-test', terrain, seed,
  attackerUnits: mk('a', ['infantry', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry', 'ranged']),
  controllers: ['player', 'player'], intel: { attackerSeesDefender: false }, economy: true
}));

const compare = (w, side) => {
  const view = makeRenderView(w, [], side, true);
  const hq = w.eco.buildings.find((b) => b.side === side && BUILDINGS[b.type].hq);
  const types = buildableFor(w.setup.sides[side].ageId);
  const seen = new Map(); let n = 0;
  for (let dy = -24; dy <= 24; dy += 2) {
    for (let dx = -24; dx <= 24; dx += 2) {
      const tx = Math.floor(hq.x / Q) + dx; const ty = Math.floor(hq.y / Q) + dy;
      types.forEach((type) => {
        const sim = placementBlock(w, side, type, tx, ty);
        const ui = placementCheck({ view, setup: w.setup, side, type, tx, ty, fog: view.fog });
        expect(ui.ok, `${type} at ${tx},${ty}: sim ${sim}, ui ${ui.code}`).toBe(sim === null);
        // What lies in the fog (a resource there) the screen cannot know: it may give another reason.
        if (ui.code !== 'fog' && sim !== 'fog' && sim !== 'node' && sim !== 'noVein') expect(ui.code, `${type} at ${tx},${ty}`).toBe(sim);
        seen.set(sim, (seen.get(sim) || 0) + 1); n += 1;
      });
    }
  }
  return { seen, n };
};

describe('placement ghost', () => {
  it('agrees with the sim around the camp, every building type', () => {
    const w = world();
    for (let i = 0; i < 5; i++) step(w, []);
    const { seen } = compare(w, 0);
    expect(seen.get(null)).toBeGreaterThan(0); // some spots are fine
    expect([...seen.keys()].filter(Boolean).length).toBeGreaterThan(2); // and several reasons show up
  });

  it('still agrees once a site claims its footprint', () => {
    const w = world('forest', 7);
    for (let i = 0; i < 5; i++) step(w, []);
    const hq = w.eco.buildings.find((b) => b.side === 0 && BUILDINGS[b.type].hq);
    const workers = w.squads.filter((q) => q.worker && q.side === 0).map((q) => q.idx);
    let placed = false;
    for (let r = 4; r < 14 && !placed; r++) {
      const tx = Math.floor(hq.x / Q) + r; const ty = Math.floor(hq.y / Q);
      if (!placementBlock(w, 0, 'house', tx, ty)) { step(w, [{ side: 0, type: 'build', squads: workers, building: 'house', tx, ty }]); placed = true; }
    }
    expect(placed).toBe(true);
    for (let i = 0; i < 3; i++) step(w, []);
    const { seen } = compare(w, 0);
    expect(seen.get('crowded')).toBeGreaterThan(0);
  });

  it('I173: the legal tint is the rule of the sim, footprint by footprint; I181: the price and the laborers are said', () => {
    const w = world();
    for (let i = 0; i < 5; i++) step(w, []);
    const view = makeRenderView(w, [], 0, true);
    const hq = w.eco.buildings.find((b) => b.side === 0 && BUILDINGS[b.type].hq);
    const cx = Math.floor(hq.x / Q); const cy = Math.floor(hq.y / Q);
    const { cells } = legalArea({ view, setup: w.setup, side: 0, type: 'barracks', fog: view.fog, cx, cy, radius: 20 });
    let legal = 0;
    for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 20; x <= cx + 20; x++) {
      if (x < 0 || y < 0 || x >= w.map.w || y >= w.map.h) continue;
      const { tx, ty } = footprintAt('barracks', x + 0.5, y + 0.5);
      const sim = placementBlock(w, 0, 'barracks', tx, ty);
      if (cells[y * w.map.w + x]) { legal += 1; expect(sim, `barracks centred on ${x},${y}`).toBeNull(); }
    }
    expect(legal).toBeGreaterThan(50);
    // a legal spot the side cannot pay for: the shortfall is the reason; no laborers: that is
    const i = cells.findIndex((c) => c === 1);
    const { tx, ty } = footprintAt('barracks', (i % w.map.w) + 0.5, Math.floor(i / w.map.w) + 0.5);
    expect(placementCheck({ view, setup: w.setup, side: 0, type: 'barracks', tx, ty, fog: view.fog, stock: [0, 10, 0, 0] })).toMatchObject({ ok: false, code: 'cost', reason: 'Needs 140 more wood' });
    expect(placementCheck({ view, setup: w.setup, side: 0, type: 'barracks', tx, ty, fog: view.fog, stock: view.eco.stock, workers: 0 })).toMatchObject({ ok: false, code: 'workers' });
    expect(placementCheck({ view, setup: w.setup, side: 0, type: 'barracks', tx, ty, fog: view.fog, stock: view.eco.stock, workers: 3 }).ok).toBe(true);
    expect(shortfallText({ wood: 30, stone: 90, gold: 20 }, [0, 30, 20, 0])).toBe('Needs 70 more stone and 20 more gold');
  });

  it('every reason has words', () => {
    ['edge', 'limit', 'ground', 'crowded', 'node', 'noVein', 'fog', 'far', 'occupied'].forEach((c) => expect(PLACEMENT_REASON[c]).toBeTruthy());
  });
});
