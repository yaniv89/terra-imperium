// src/battle/sim/sim.test.js
// Tactical Battles T1/T2 exit gates (plan §17): maps are always winnable and stable per region;
// the sim is deterministic; every result is valid input for applyInvasionResult; the balance
// basics hold (stronger armies and good counters win); keep assimilation works; it's fast.
import { describe, it, expect } from 'vitest';
import { generateMap, reachable, TEMPLATES } from '../setup/mapgen';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { runHeadless } from './headless';
import { createWorld } from './world';
import { step } from './step';
import { buildSpatialHash } from './pathing';
import { updateAssimilation, ASSIMILATION_TICKS } from './objectives';
import { Q } from './constants';
import { resolveBattle } from '../../engine/battle';
import { createRng } from '../../utils/rng';

const TERRAINS = Object.keys(TEMPLATES);
const mk = (prefix, classes, strength = 1000, extra = {}) => classes.map((classId, i) => ({
  id: `${prefix}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', ...extra
}));
const setup = (over = {}) => buildSetupFromArmies({
  regionId: 'test-region', terrain: 'plains', seed: 42,
  attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'ranged']),
  defenderUnits: mk('d', ['infantry', 'infantry', 'ranged']),
  controllers: ['ai', 'ai'],
  ...over
});

describe('battlefield generation', () => {
  it('always lets the attacker reach the keep and every capture point', () => {
    TERRAINS.forEach((terrain) => {
      for (let r = 0; r < 25; r++) {
        const map = generateMap({ regionId: `r${r}`, terrain, combatWidth: 4, pointCount: r % 3, roads: 1 + (r % 2) });
        const midY = Math.floor(map.h / 2);
        expect(reachable(map.tiles, map.w, map.h, 6, midY, map.keep.x - 4, map.keep.y), `${terrain} r${r}`).toBe(true);
        map.points.forEach((p) => expect(reachable(map.tiles, map.w, map.h, 6, midY, p.x, p.y), `${terrain} r${r} point`).toBe(true));
      }
    });
  });

  it('gives the same region the same map every time, and different regions different maps', () => {
    const a = generateMap({ regionId: 'fr-75', terrain: 'forest', combatWidth: 4 });
    const b = generateMap({ regionId: 'fr-75', terrain: 'forest', combatWidth: 4 });
    const c = generateMap({ regionId: 'de-be', terrain: 'forest', combatWidth: 4 });
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
  });
});

describe('tactical sim determinism', () => {
  it('replays identically from the same setup (hash at every checkpoint)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = setup({ seed, terrain: TERRAINS[seed % TERRAINS.length] });
      const one = runHeadless(s, { checkpointEvery: 200 });
      const two = runHeadless(setup({ seed, terrain: TERRAINS[seed % TERRAINS.length] }), { checkpointEvery: 200 });
      expect(two.checkpoints).toEqual(one.checkpoints);
      expect(two.hash).toBe(one.hash);
      expect(two.result).toEqual(one.result);
    }
  });

  it('replays player orders from a log identically', () => {
    const orders = [
      { tick: 5, side: 0, type: 'attackMove', squads: [0, 1, 2], x: 60 * Q, y: 30 * Q, seq: 1 },
      { tick: 40, side: 0, type: 'formationLine', squads: [0, 1], x: 40 * Q, y: 20 * Q, x2: 40 * Q, y2: 34 * Q, seq: 2 },
      { tick: 90, side: 0, type: 'attackMove', squads: [0, 1, 2, 3], x: 80 * Q, y: 30 * Q, seq: 3 }
    ];
    const s1 = setup({ controllers: ['player', 'ai'] });
    const s2 = setup({ controllers: ['player', 'ai'] });
    expect(runHeadless(s2, { orders, checkpointEvery: 100 }).checkpoints).toEqual(runHeadless(s1, { orders, checkpointEvery: 100 }).checkpoints);
  });
});

describe('tactical sim results', () => {
  it('always ends with a valid, resolveBattle-shaped result', () => {
    const classes = ['infantry', 'cavalry', 'ranged', 'siege', 'support'];
    const auto = resolveBattle({ attackerUnits: mk('a', ['infantry']), defenderUnits: mk('d', ['infantry']), terrain: 'plains', isAttackingFortification: false, rng: createRng(1) });
    for (let n = 0; n < 12; n++) {
      const rng = createRng(100 + n);
      const pick = () => classes[Math.floor(rng.next() * classes.length)];
      const att = mk('a', Array.from({ length: 1 + (n % 6) }, pick), 300 + Math.floor(rng.next() * 700));
      const def = mk('d', Array.from({ length: 1 + ((n * 3) % 5) }, pick), 300 + Math.floor(rng.next() * 700));
      const s = setup({ seed: n + 7, attackerUnits: att, defenderUnits: def, terrain: TERRAINS[n % TERRAINS.length], fortLevel: n % 4, deposits: n % 2 ? ['iron'] : [] });
      const { result, world } = runHeadless(s);
      expect(world.ended).toBeTruthy();
      expect(['attacker', 'defender', 'stalemate']).toContain(result.outcome);
      expect(Object.keys(result).sort()).toEqual(Object.keys(auto).sort());
      expect(result.attackerUnits.map((u) => u.id).sort()).toEqual(att.map((u) => u.id).sort());
      expect(result.defenderUnits.map((u) => u.id).sort()).toEqual(def.map((u) => u.id).sort());
      [...result.attackerUnits, ...result.defenderUnits].forEach((u) => {
        const before = [...att, ...def].find((o) => o.id === u.id);
        expect(Number.isInteger(u.strength)).toBe(true);
        expect(u.strength).toBeGreaterThanOrEqual(0);
        expect(u.strength).toBeLessThanOrEqual(before.strength);
      });
      result.report.deployedAttackerIds.forEach((id) => expect(att.some((u) => u.id === id)).toBe(true));
      world.squads.forEach((q) => { expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true); });
    }
  });

  it('a much stronger army usually wins', () => {
    let wins = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { result } = runHeadless(setup({ seed, attackerUnits: mk('a', ['infantry', 'infantry', 'infantry', 'cavalry', 'ranged', 'ranged']), defenderUnits: mk('d', ['infantry', 'ranged'], 500) }));
      if (result.outcome === 'attacker') wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(6);
  });

  it('a hopeless attack fails', () => {
    let losses = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { result } = runHeadless(setup({ seed, attackerUnits: mk('a', ['infantry'], 400), defenderUnits: mk('d', ['infantry', 'infantry', 'ranged', 'ranged']), fortLevel: 3 }));
      if (result.outcome === 'defender') losses += 1;
    }
    expect(losses).toBe(6);
  });
});

describe('keep assimilation', () => {
  it('runs only while attacker melee holds the breached keep uncontested', () => {
    const w = createWorld(setup());
    const keep = w.structures[0];
    keep.alive = false; keep.hp = 0;
    const att = w.squads.find((q) => q.side === 0 && q.classId === 'infantry');
    const def = w.squads.find((q) => q.side === 1 && q.onField);
    att.x = keep.x - 2 * Q; att.y = keep.y;
    def.x = keep.x + 2 * Q; def.y = keep.y;
    buildSpatialHash(w); updateAssimilation(w);
    expect(w.assimilation).toBe(0); // contested
    w.squads.forEach((q) => { if (q.side === 1) q.alive = false; });
    for (let i = 0; i < 10; i++) { buildSpatialHash(w); updateAssimilation(w); }
    expect(w.assimilation).toBe(10);
  });

  it('a completed assimilation ends the battle as a decisive attacker win', () => {
    const w = createWorld(setup());
    w.assimilation = ASSIMILATION_TICKS;
    step(w);
    expect(w.ended).toMatchObject({ outcome: 'attacker', decisive: true, reason: 'keepTaken' });
  });
});

describe('performance', () => {
  it('runs a 6 v 6 battle to the end quickly', () => {
    const t0 = Date.now();
    const s = setup({ terrain: 'mixed', attackerUnits: mk('a', ['infantry', 'infantry', 'cavalry', 'cavalry', 'ranged', 'siege', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry', 'infantry', 'ranged', 'ranged', 'cavalry', 'infantry', 'infantry']), fortLevel: 2, deposits: ['iron', 'copper'] });
    const { world } = runHeadless(s);
    const ms = Date.now() - t0;
    expect(world.ended).toBeTruthy();
    expect(ms / Math.max(1, world.tick)).toBeLessThan(2); // < 2 ms per tick even on a loaded CI box
  });
});
