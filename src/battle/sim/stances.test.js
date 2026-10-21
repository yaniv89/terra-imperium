// src/battle/sim/stances.test.js
// Playtest audit CB17 and CB10: speed per class (U07, I192 under the user's ruling Q6), the stance
// and threat-response contract (U11, I190, I191; movement.js header) and the AI defender's
// counter-attacks (I125). The AI is held to the player's rules: it only gives orders and only sees
// what its fog shows.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { thinkAI, AI_DIFFICULTY } from './tacticalAI';
import { updateFog } from './fog';
import { Q } from './constants';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const world = (att, def, opts = {}) => createWorld(buildSetupFromArmies({
  regionId: 'stance-test', terrain: 'plains', seed: 42,
  attackerUnits: mk('a', att), defenderUnits: mk('d', def),
  controllers: ['player', 'player'], intel: { attackerSeesDefender: false }, ...opts
}));
const place = (q, x, y) => { q.x = x; q.y = y; q.anchorX = x; q.anchorY = y; };
const run = (w, ticks, orders = []) => { step(w, orders); for (let i = 1; i < ticks && !w.ended; i++) step(w, []); };
// Everyone not in the scene stands far off in a corner.
const park = (w, keep) => w.squads.filter((q) => !keep.includes(q)).forEach((q, i) => place(q, (3 + (i % 6) * 2) * Q, (3 + Math.floor(i / 6) * 2) * Q));

// Ticks until each squad reaches (x, y) (within a tile), or -1.
const arrivals = (w, squads, x, y, limit = 2000) => {
  const at = new Map();
  for (let t = 0; t < limit && at.size < squads.length; t++) {
    step(w, []);
    squads.forEach((q) => { if (!at.has(q.idx) && Math.abs(q.x - x) <= Q && Math.abs(q.y - y) <= 2 * Q) at.set(q.idx, w.tick); });
  }
  return squads.map((q) => at.get(q.idx) ?? -1);
};

describe('speed per class (U07, I192: every squad at its own pace, Q6)', () => {
  const crossing = (classId) => {
    const w = world([classId], ['infantry']);
    const q = w.squads.find((s) => s.side === 0);
    park(w, [q]);
    place(q, 20 * Q, 40 * Q);
    step(w, [{ side: 0, type: 'move', squads: [q.idx], x: 50 * Q, y: 40 * Q }]);
    return arrivals(w, [q], 50 * Q, 40 * Q)[0];
  };

  it('over 30 tiles of open ground cavalry is the fastest, siege the slowest', () => {
    const t = Object.fromEntries(['cavalry', 'infantry', 'ranged', 'siege'].map((c) => [c, crossing(c)]));
    console.log(`U07 ticks to cross 30 tiles (20 Hz): ${JSON.stringify(t)}`);
    Object.values(t).forEach((v) => expect(v).toBeGreaterThan(0));
    expect(t.cavalry * 1.8).toBeLessThan(t.infantry); // about twice as fast
    expect(t.infantry).toBeLessThanOrEqual(t.ranged);
    expect(t.siege).toBeGreaterThan(t.infantry * 1.5);
  });

  it('a mixed group keeps no group pace: each squad arrives at its own speed', () => {
    const w = world(['infantry', 'cavalry', 'siege'], ['infantry']);
    const mine = w.squads.filter((s) => s.side === 0);
    park(w, mine);
    mine.forEach((q, i) => place(q, 20 * Q, (38 + i * 2) * Q));
    step(w, [{ side: 0, type: 'move', squads: mine.map((q) => q.idx), x: 50 * Q, y: 40 * Q }]);
    // Arrived: at its own slot of the line (the order is done).
    const at = new Map();
    for (let t = 0; t < 4000 && at.size < 3; t++) { step(w, []); mine.forEach((q) => { if (!at.has(q.idx) && q.order.type === 'idle') at.set(q.idx, w.tick); }); }
    const [inf, cav, siege] = mine.map((q) => at.get(q.idx) ?? -1);
    console.log(`U07 mixed group, ticks to arrive: infantry ${inf}, cavalry ${cav}, siege ${siege}`);
    const solo = { cav: crossing('cavalry'), siege: crossing('siege') };
    expect(cav).toBeGreaterThan(0);
    expect(cav).toBeLessThan(inf);
    expect(inf).toBeLessThan(siege);
    // The cavalry is not held back to the siege train's pace (column slots move the goal a little).
    expect(cav).toBeLessThan(solo.cav * 1.3);
    expect(siege).toBeLessThan(solo.siege * 1.3);
  });
});

describe('the stance contract (U11, I190, I191)', () => {
  it('a pull-back move from under a tower is obeyed at each squad\'s own speed, nobody stops to fight (I190)', () => {
    const w = world(['infantry', 'ranged', 'siege', 'cavalry'], ['infantry'], { fortLevel: 2, attackerAgeId: 'bronze', defenderAgeId: 'bronze' }); // Bronze ground: roads, open plains
    const tower = w.structures.findIndex((s) => s.kind === 'tower' && s.damage > 0);
    expect(tower).toBeGreaterThan(0);
    const t = w.structures[tower];
    const mine = w.squads.filter((s) => s.side === 0);
    park(w, mine);
    mine.forEach((q, i) => place(q, t.x - 4 * Q, t.y + (i - 2) * 2 * Q));
    run(w, 60, [{ side: 0, type: 'attack', squads: mine.map((q) => q.idx), target: { kind: 'structure', index: tower } }]);
    const back = { x: t.x - 25 * Q, y: t.y };
    const before = mine.map((q) => q.x);
    step(w, [{ side: 0, type: 'move', squads: mine.map((q) => q.idx), x: back.x, y: back.y }]);
    for (let i = 0; i < 120; i++) { step(w, []); mine.forEach((q) => { if (q.alive) expect(q.target, `squad ${q.idx} (${q.classId})`).toBe(-1); }); }
    mine.forEach((q, i) => { if (q.alive) expect(before[i] - q.x, `squad ${q.idx} (${q.classId}) walked back`).toBeGreaterThan(5 * Q); });
    const cav = mine.find((q) => q.classId === 'cavalry'); const siege = mine.find((q) => q.classId === 'siege');
    expect(before[mine.indexOf(cav)] - cav.x).toBeGreaterThan(before[mine.indexOf(siege)] - siege.x);
  });

  it('a squad whose ordered target falls takes on the enemy next to it without a new order (I191)', () => {
    const w = world(['infantry'], ['infantry', 'infantry']);
    const mine = w.squads.find((s) => s.side === 0);
    const [first, second] = w.squads.filter((s) => s.side === 1);
    park(w, [mine, first, second]);
    place(mine, 50 * Q, 30 * Q); place(first, 52 * Q, 30 * Q); place(second, 53 * Q, 34 * Q);
    step(w, [{ side: 0, type: 'attack', squads: [mine.idx], target: { kind: 'squad', index: first.idx } }, { side: 1, type: 'hold', squads: [first.idx, second.idx] }]);
    first.alive = false; first.strength = 0;
    run(w, 200);
    expect(mine.target).toBe(second.idx);
    expect(mine.damageDealt).toBeGreaterThan(0);
  });

  it('a squad battering a building fights off the squad that attacks it, then goes back to the building (U11)', () => {
    const w = world(['infantry'], ['infantry', 'infantry'], { fortLevel: 2 }); // the second defender keeps the battle going
    const mine = w.squads.find((s) => s.side === 0);
    const foe = w.squads.find((s) => s.side === 1);
    const keep = w.structures[0];
    park(w, [mine, foe]);
    w.structures.forEach((s) => { s.damage = 0; }); // no tower fire in this scene
    place(mine, keep.x - keep.radius - Q, keep.y);
    place(foe, mine.x - 5 * Q, mine.y);
    foe.strength = 150;
    run(w, 20, [{ side: 0, type: 'attack', squads: [mine.idx], target: { kind: 'structure', index: 0 } }]);
    expect(mine.targetKind).toBe('structure');
    step(w, [{ side: 1, type: 'attack', squads: [foe.idx], target: { kind: 'squad', index: mine.idx } }]);
    let fought = false;
    for (let i = 0; i < 1500 && foe.alive; i++) { step(w, []); if (mine.targetKind === 'squad' && mine.target === foe.idx) fought = true; }
    expect(fought).toBe(true);
    expect(foe.alive).toBe(false);
    run(w, 40);
    expect(mine.order.type).toBe('attack');
    expect(mine.targetKind).toBe('structure');
    expect(mine.target).toBe(0);
  });

  it('a holding squad strikes back at an attacker in reach and does not move; a moving squad keeps walking', () => {
    const w = world(['infantry', 'infantry'], ['infantry', 'infantry']);
    const [holder, walker] = w.squads.filter((s) => s.side === 0);
    const [a, b] = w.squads.filter((s) => s.side === 1);
    park(w, [holder, walker, a, b]);
    place(holder, 40 * Q, 20 * Q); place(a, 44 * Q, 20 * Q);
    place(walker, 40 * Q, 50 * Q); place(b, 41 * Q, 52 * Q);
    step(w, [{ side: 0, type: 'hold', squads: [holder.idx] }, { side: 0, type: 'move', squads: [walker.idx], x: 70 * Q, y: 50 * Q },
      { side: 1, type: 'attack', squads: [a.idx], target: { kind: 'squad', index: holder.idx } }, { side: 1, type: 'attack', squads: [b.idx], target: { kind: 'squad', index: walker.idx } }]);
    for (let i = 0; i < 300; i++) { step(w, []); expect(walker.target).toBe(-1); }
    expect(holder.damageDealt).toBeGreaterThan(0);
    expect(Math.abs(holder.x - 40 * Q)).toBeLessThan(Q);
    expect(holder.order.type).toBe('hold');
    expect(walker.x).toBeGreaterThan(60 * Q);
  });
});

describe('the AI defender counter-attacks (I125, CB10)', () => {
  // The fog is drawn on a tick it updates (every 5), then the side thinks on its own tick.
  const thinkAt = (w, side) => { w.tick = AI_DIFFICULTY.prince.thinkEvery * 10; updateFog(w); w.tick += side; const orders = []; thinkAI(w, side, orders); return orders; };
  const aiWorld = (att, def, opts = {}) => createWorld(buildSetupFromArmies({
    regionId: 'stance-test', terrain: 'plains', seed: 42, attackerUnits: mk('a', att), defenderUnits: mk('d', def),
    controllers: ['player', 'ai'], difficultyId: 'prince', fortLevel: 2, ...opts
  }));

  it('sends its nearest cavalry at a siege engine it can see near its walls', () => {
    const w = aiWorld(['siege', 'infantry'], ['infantry', 'cavalry', 'ranged']);
    const engine = w.squads.find((q) => q.side === 0 && q.classId === 'siege');
    const guard = w.squads.find((q) => q.side === 0 && q.classId === 'infantry');
    const keep = w.structures[0];
    place(engine, keep.x - 14 * Q, keep.y); place(guard, keep.x - 16 * Q, keep.y + 6 * Q);
    w.squads.filter((q) => q.side === 1).forEach((q, i) => place(q, keep.x + 3 * Q, keep.y + (i - 1) * 2 * Q));
    w.revealUntil = [-1, 1e9]; // the defender sees the field
    const orders = thinkAt(w, 1);
    const cav = w.squads.find((q) => q.side === 1 && q.classId === 'cavalry');
    expect(orders).toContainEqual({ side: 1, type: 'attack', squads: [cav.idx], target: { kind: 'squad', index: engine.idx } });
  });

  it('goes out to meet a clearly weaker enemy it can see, but not one hidden in the fog', () => {
    const setup = (seen) => {
      const w = aiWorld(['infantry'], ['infantry', 'infantry', 'cavalry']);
      const foe = w.squads.find((q) => q.side === 0 && q.onField);
      const keep = w.structures[0];
      w.squads.filter((q) => q.side === 0 && q !== foe).forEach((q) => { q.alive = false; });
      place(foe, keep.x - 40 * Q, keep.y);
      w.squads.filter((q) => q.side === 1).forEach((q, i) => place(q, keep.x + 2 * Q, keep.y + (i - 1) * 2 * Q));
      if (seen) w.revealUntil = [-1, 1e9];
      return { w, orders: thinkAt(w, 1) };
    };
    const open = setup(true);
    expect(open.orders.some((o) => o.side === 1 && (o.type === 'attackMove' || o.type === 'attack'))).toBe(true);
    const fog = setup(false);
    expect(fog.orders.some((o) => o.side === 1 && (o.type === 'attackMove' || o.type === 'attack'))).toBe(false);
  });
});

describe('the AI attacker keeps its army together itself (Q6)', () => {
  it('its cavalry does not run far ahead of its infantry on the approach', () => {
    const w = createWorld(buildSetupFromArmies({
      regionId: 'stance-test', terrain: 'plains', seed: 42, attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry']), defenderUnits: mk('d', ['infantry']),
      controllers: ['ai', 'player'], difficultyId: 'prince', intel: { attackerSeesDefender: false }
    }));
    const [i1, i2, cav] = w.squads.filter((q) => q.side === 0 && q.onField && !q.isGeneral);
    let worst = 0;
    for (let t = 0; t < 900; t++) {
      step(w, []);
      if ([i1, i2, cav].some((q) => q.target >= 0)) break; // contact: the fight takes over
      worst = Math.max(worst, cav.x - Math.min(i1.x, i2.x));
    }
    expect(worst).toBeLessThan(16 * Q);
  });
});
