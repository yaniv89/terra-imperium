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
import { placementCheck, PLACEMENT_REASON } from './placement';

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
        if (ui.code !== 'fog' && sim !== 'node' && sim !== 'noVein') expect(ui.code, `${type} at ${tx},${ty}`).toBe(sim);
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

  it('every reason has words', () => {
    ['edge', 'limit', 'ground', 'crowded', 'node', 'noVein', 'fog', 'far', 'occupied'].forEach((c) => expect(PLACEMENT_REASON[c]).toBeTruthy());
  });
});
