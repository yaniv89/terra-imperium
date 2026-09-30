// src/battle/sim/orders.test.js
// Commanded squads do what they're told: an attack order sticks to its target (even through a
// moment out of sight) instead of being dropped, a squad whose fight is over stays where it is
// rather than marching back to where it started, and squads fighting on their own initiative
// don't chase routed men across the map while fresh enemies stand next to them.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { makeRenderView } from '../render/view';
import { Q } from './constants';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const world = () => createWorld(buildSetupFromArmies({
  regionId: 'orders-test', terrain: 'plains', seed: 42,
  attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'ranged']),
  defenderUnits: mk('d', ['infantry', 'infantry', 'ranged']),
  controllers: ['player', 'ai'], intel: { attackerSeesDefender: false }
}));
const run = (w, ticks, orders = []) => { step(w, orders); for (let i = 1; i < ticks && !w.ended; i++) step(w, []); };

describe('player orders', () => {
  it('an attack order on a far enemy is carried out, not dropped the moment the target is out of sight', () => {
    const w = world();
    const mine = w.squads.filter((q) => q.side === 0 && q.onField);
    const foe = w.squads.find((q) => q.side === 1 && q.onField);
    const startX = mine.map((q) => q.x);
    run(w, 400, [{ side: 0, type: 'attack', squads: mine.map((q) => q.idx), target: { kind: 'squad', index: foe.idx } }]);
    mine.forEach((q, i) => {
      expect(q.order.type, `squad ${q.idx}`).toBe('attack');
      expect(q.target).toBe(foe.idx);
      expect(q.x - startX[i], `squad ${q.idx} advanced`).toBeGreaterThan(15 * Q);
    });
  });

  it('melee squads sent at an enemy reach it and fight', () => {
    const w = world();
    const melee = w.squads.filter((q) => q.side === 0 && q.onField && q.stats.melee);
    const foe = w.squads.find((q) => q.side === 1 && q.onField);
    run(w, 1400, [{ side: 0, type: 'attack', squads: melee.map((q) => q.idx), target: { kind: 'squad', index: foe.idx } }]);
    melee.forEach((q) => expect(q.damageDealt, `squad ${q.idx} (${q.classId})`).toBeGreaterThan(0));
  });

  it('a squad whose target is gone stands where the fight ended instead of walking home', () => {
    const w = world();
    const q = w.squads.find((s) => s.side === 0 && s.onField && s.classId === 'cavalry');
    const foe = w.squads.find((s) => s.side === 1 && s.onField);
    q.x = foe.x - 20 * Q; q.y = foe.y; q.anchorX = 5 * Q; q.anchorY = q.y;
    step(w, [{ side: 0, type: 'attack', squads: [q.idx], target: { kind: 'squad', index: foe.idx } }]);
    foe.alive = false; foe.strength = 0; // the target is destroyed by someone else
    const x = q.x;
    run(w, 200);
    expect(q.order.type).not.toBe('attack');
    expect(Math.abs(q.anchorX - x)).toBeLessThan(3 * Q);
    expect(q.x).toBeGreaterThan(x - 6 * Q); // did not march ~15 tiles back to its old post
  });

  it('a squad fighting on its own leaves a routed enemy for one that is still fighting it', () => {
    const w = world();
    const q = w.squads.find((s) => s.side === 0 && s.onField && s.classId === 'infantry');
    const [runner, fighter] = w.squads.filter((s) => s.side === 1 && s.onField && s.classId === 'infantry');
    q.x = 60 * Q; q.y = 30 * Q; q.anchorX = q.x; q.anchorY = q.y;
    runner.x = q.x + 2 * Q; runner.y = q.y; runner.routed = true; runner.morale = 5;
    fighter.x = q.x; fighter.y = q.y + 2 * Q;
    q.target = runner.idx; q.targetKind = 'squad';
    for (let i = 0; i < 30; i++) step(w, []);
    expect(q.target).toBe(fighter.idx);
  });

  it('the render view flags squads that are actually striking', () => {
    const w = world();
    const melee = w.squads.filter((q) => q.side === 0 && q.onField && q.stats.melee);
    const foe = w.squads.find((q) => q.side === 1 && q.onField);
    step(w, [{ side: 0, type: 'attack', squads: melee.map((q) => q.idx), target: { kind: 'squad', index: foe.idx } }]);
    let seen = false;
    for (let i = 0; i < 1400 && !seen && !w.ended; i++) { step(w, []); seen = makeRenderView(w).squads.some((s) => s.side === 0 && s.striking); }
    expect(seen).toBe(true);
  });
});

describe('ground and nerve', () => {
  it('striking down from higher ground hits harder, striking uphill softer, capped at 10%', async () => {
    const { elevationMult, ELEVATION_MAX_BONUS } = await import('./combat');
    const w = world();
    const a = w.squads.find((q) => q.side === 0 && q.onField);
    const t = w.squads.find((q) => q.side === 1 && q.onField);
    const h = new Int16Array(w.map.w * w.map.h);
    const idx = (q) => Math.floor(q.y / Q) * w.map.w + Math.floor(q.x / Q);
    w.map = { ...w.map, height: h };
    expect(elevationMult(w, a, t)).toBe(1);
    h[idx(a)] = 200;
    expect(elevationMult(w, a, t)).toBeGreaterThan(1);
    expect(elevationMult(w, t, a)).toBeLessThan(1);
    h[idx(a)] = 5000;
    expect(elevationMult(w, a, t)).toBeCloseTo(1 + ELEVATION_MAX_BONUS);
  });

  it('a squad takes at most the capped shock however many neighbours break at once', async () => {
    const { updateMorale, SHOCK_CAP_PER_TICK } = await import('./morale');
    const w = world();
    const mine = w.squads.filter((q) => q.side === 0 && q.onField);
    const [victim, ...others] = mine;
    others.forEach((o) => { o.x = victim.x + Q; o.y = victim.y; w.events.push({ t: w.tick, type: 'destroyed', id: o.idx }); });
    victim.morale = 100;
    updateMorale(w);
    expect(100 - victim.morale).toBeLessThanOrEqual(SHOCK_CAP_PER_TICK);
  });
});
