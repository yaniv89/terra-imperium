// src/battle/sim/autoContinue.test.js
// H-26 (audits/mobile-campaign-2026-10-20): squads went idle beside live towers once their building fell.
import { describe, it, expect } from 'vitest';
import { createWorld } from './world';
import { step } from './step';
import { applyOrder } from './orders';
import { resolveStructureFire } from './objectives';
import { acquireTargets, moveSquads, nextBaseTarget } from './movement';
import { buildSpatialHash } from './pathing';
import { baseBuildings } from './base';
import { Q } from './constants';
import { town, army } from './assaultTestTown';

describe('H-26: on to the next building', () => {
  it('a squad whose building fell attacks the nearest standing base building; Hold is left alone', () => {
    const w = createWorld(town({ tierId: 'medium', buildings: { economy: 1, military: 1 } }));
    const targets = baseBuildings(w, 1);
    expect(targets.length).toBeGreaterThan(1);
    const [a, b] = army(w, 0);
    const first = targets[0];
    applyOrder(w, { side: 0, type: 'attack', squads: [a.idx], target: { kind: first.kind, index: first.index } });
    applyOrder(w, { side: 0, type: 'hold', squads: [b.idx] });
    const s = first.kind === 'eco' ? w.eco.buildings[first.index] : w.structures[first.index];
    s.alive = false; s.hp = 0;
    acquireTargets(w);
    expect(a.order.type).toBe('attack');
    const next = nextBaseTarget(w, a);
    expect(next).not.toBeNull();
    expect([a.targetKind, a.target]).toEqual([next.kind, next.index]);
    expect(b.order.type).toBe('hold');
  });

  it('an attack-move that ends in the enemy base razes on; one that ends far from it stands', () => {
    const w = createWorld(town());
    const [a, b] = army(w, 0);
    const keep = w.structures[0];
    a.x = keep.x - 5 * Q; a.y = keep.y; a.order = { type: 'attackMove', x: a.x, y: a.y };
    b.x = 3 * Q; b.y = keep.y; b.order = { type: 'attackMove', x: b.x, y: b.y };
    a.target = -1; b.target = -1;
    moveSquads(w);
    expect(a.order.type).toBe('attack');
    expect(b.order.type).toBe('idle');
  });

  it('an idle squad a tower shoots turns on it', () => {
    const w = createWorld(town());
    const keep = w.structures[0];
    const a = army(w, 0)[0];
    a.x = keep.x - 4 * Q; a.y = keep.y; a.order = { type: 'idle' }; a.target = -1;
    keep.cooldown = 0; buildSpatialHash(w); resolveStructureFire(w);
    expect([a.targetKind, a.target]).toEqual(['structure', 0]);
  });

  // H-02 and H-26 together (battle-lab assaultTrace POLICY=once): before, 0 of 8 won.
  it('the Siwa assault (4 x 588 against a small capital garrison) is won by one attack-move, as Auto wins it', () => {
    let wins = 0; let lost = 0; let brought = 0;
    [1, 2, 3, 4].forEach((seed) => {
      const w = createWorld(town({ seed }));
      const keep = w.structures[0];
      brought += army(w, 0).reduce((s, q) => s + q.strength, 0);
      step(w, [{ side: 0, type: 'attackMove', squads: army(w, 0).map((q) => q.idx), x: keep.x, y: keep.y }]);
      while (!w.ended) { step(w, []); w.events.length = 0; }
      if (w.ended.outcome === 'attacker') wins += 1;
      lost += w.squads.filter((q) => q.side === 0 && !q.worker && !q.original?.auxiliary && !q.isGeneral).reduce((s, q) => s + q.startStrength - q.strength, 0);
    });
    expect(wins).toBe(4); // before: 0 of 4 (every regiment dead, 30:00 on the clock)
    expect(lost / brought).toBeLessThan(0.6); // before: all of it
  }, 120000);
});

// Playtest 4 P4-H4: squads stood idle (or locked in place) beside the last buildings until they died.
describe('P4-H4: squads keep fighting', () => {
  it('two squads walking straight into each other pass instead of locking', () => {
    const w = createWorld(town());
    const [a, b] = army(w, 0);
    const y = w.structures[0].y;
    a.x = 10 * Q; a.y = y; b.x = 20 * Q; b.y = y;
    applyOrder(w, { side: 0, type: 'move', squads: [a.idx], x: 20 * Q, y });
    applyOrder(w, { side: 0, type: 'move', squads: [b.idx], x: 10 * Q, y });
    for (let i = 0; i < 400; i++) { step(w, []); w.events.length = 0; }
    expect(a.x).toBeGreaterThan(18 * Q); // before: both stood 1.2 tiles apart in the middle forever
    expect(b.x).toBeLessThan(12 * Q);
  });

  it('an attack-moving squad with no target turns on the tower that shoots it', () => {
    const w = createWorld(town());
    const keep = w.structures[0];
    const a = army(w, 0)[0];
    a.x = keep.x - 4 * Q; a.y = keep.y; a.order = { type: 'attackMove', x: keep.x, y: keep.y }; a.target = -1;
    keep.cooldown = 0; buildSpatialHash(w); resolveStructureFire(w);
    expect([a.targetKind, a.target]).toEqual(['structure', 0]); // before: it bled to 0 on "attackMove" with no target
  });
});
