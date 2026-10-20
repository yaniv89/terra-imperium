// src/battle/sim/siegeCrew.test.js
// H-02 (audits/mobile-campaign-2026-10-20): a commanded assault on a small garrison was a trap; the
// works shoot only as hard as their side can man them (siegeRules.js crewShares).
import { describe, it, expect } from 'vitest';
import { createWorld } from './world';
import { resolveStructureFire } from './objectives';
import { crewShares, CREW_FULL } from './siegeRules';
import { buildSpatialHash } from './pathing';
import { Q } from './constants';
import { town, army } from './assaultTestTown';

describe('H-02: works shoot as hard as the city can man them', () => {
  it('crew share follows the side\'s fighting strength (workers and generals left out)', () => {
    const w = createWorld(town());
    const [, def] = crewShares(w);
    const men = army(w, 1).reduce((s, q) => s + q.strength, 0);
    expect(def).toBeCloseTo(Math.min(1, men / CREW_FULL), 6);
    army(w, 1).forEach((q) => { q.alive = false; q.strength = 0; });
    expect(crewShares(w)[1]).toBe(0);
  });

  it('a keep with nobody left to man it no longer shoots', () => {
    const w = createWorld(town());
    const keep = w.structures[0];
    expect(keep.damage).toBeGreaterThan(0);
    const a = army(w, 0)[0];
    a.x = keep.x - 4 * Q; a.y = keep.y;
    const shoot = () => { keep.cooldown = 0; buildSpatialHash(w); const before = a.strength; resolveStructureFire(w); return before - a.strength; };
    expect(shoot()).toBeGreaterThan(0);
    w.squads.forEach((q) => { if (q.side === 1 && !q.worker) { q.alive = false; q.strength = 0; } });
    expect(shoot()).toBe(0);
  });
});
