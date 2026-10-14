// src/battle/sim/base.test.js
// Playtest audit CB18: the full starting roster (U10, the user's ruling Q2) and the base rule
// (Q3, Q4, Q5): in a battle with bases a side loses only when its base buildings are gone, the keep
// alone does not win, houses, walls and towers are not base, and at the clock the defender holds.
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld, deployZone, MAX_START_SQUADS } from './world';
import { step } from './step';
import { applyOrder } from './orders';
import { toStrategicResult } from './result';
import { runHeadless } from './headless';
import { PURSUIT_TICKS } from './step';
import { baseBuildings, baseCount, baseGone } from './base';
import { buildTownManifest } from '../../data/townLayout';
import { Q, SIDE_ATTACKER, SIDE_DEFENDER } from './constants';

const mk = (p, cls, extra = {}) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', ...extra }));
const many = (p, n, cls = 'infantry') => mk(p, Array.from({ length: n }, (_, i) => (i % 4 === 3 ? 'ranged' : cls)));
const ecoSetup = (opts = {}) => buildSetupFromArmies({
  regionId: 'base-test', terrain: 'plains', seed: 7,
  attackerUnits: mk('a', ['infantry', 'infantry', 'ranged']), defenderUnits: mk('d', ['infantry', 'ranged']),
  controllers: ['player', 'player'], intel: { attackerSeesDefender: true }, economy: true, ...opts
});
const run = (w, ticks) => { for (let i = 0; i < ticks && !w.ended; i++) { step(w, []); w.events.length = 0; } };
const kill = (q) => { q.strength = 0; q.alive = false; };
const army = (w, side) => w.squads.filter((q) => q.side === side && !q.worker && !q.isGeneral);
// Knock a base building down the way combat does (its HP to zero), without walking anyone there.
const raze = (w, b) => {
  if (b.kind === 'eco') { const e = w.eco.buildings[b.index]; e.alive = false; e.hp = 0; } else { const s = w.structures[b.index]; s.alive = false; s.hp = 0; }
};

describe('U10: the whole army starts on the field', () => {
  it('an army far past the combat width is all on the field at the first tick, no reserve, in its zone', () => {
    const s = buildSetupFromArmies({ regionId: 'roster', terrain: 'plains', seed: 3, attackerUnits: many('a', 40), defenderUnits: many('d', 30), controllers: ['player', 'ai'] });
    expect(40).toBeGreaterThan(s.combatWidth + 2);
    const w = createWorld(s);
    [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => {
      const mine = army(w, side);
      expect(mine).toHaveLength(side === SIDE_ATTACKER ? 40 : 30);
      expect(mine.every((q) => q.onField && !q.reserve && q.enterTick === -1)).toBe(true);
      const z = deployZone(w, side);
      mine.forEach((q) => {
        expect(Math.floor(q.x / Q)).toBeGreaterThanOrEqual(z.x0); expect(Math.floor(q.x / Q)).toBeLessThanOrEqual(z.x1);
        expect(Math.floor(q.y / Q)).toBeGreaterThanOrEqual(z.y0); expect(Math.floor(q.y / Q)).toBeLessThanOrEqual(z.y1);
      });
      // Nobody stacked on another squad's spot: a long line forms ranks.
      expect(new Set(mine.map((q) => `${q.x},${q.y}`)).size).toBe(mine.length);
    });
  });

  it('the result counts every regiment as having taken the field (none left as an untouched reserve)', () => {
    const s = buildSetupFromArmies({ regionId: 'roster', terrain: 'plains', seed: 3, attackerUnits: many('a', 20), defenderUnits: many('d', 4), controllers: [null, null] });
    const w = createWorld(s);
    run(w, 5);
    const r = toStrategicResult(w);
    expect(r.attackerUnits).toHaveLength(20);
    expect(r.attackerUnits.some((u) => u.disposition === 'reserve')).toBe(false);
  });

  it(`a guard, not a wave: past ${MAX_START_SQUADS} a side the weakest stay out untouched and never enter`, () => {
    const big = many('a', MAX_START_SQUADS + 6).map((u, i) => ({ ...u, strength: i < MAX_START_SQUADS ? 1000 : 500 }));
    const s = buildSetupFromArmies({ regionId: 'roster', terrain: 'plains', seed: 3, attackerUnits: big, defenderUnits: many('d', 2), controllers: [null, null] });
    const w = createWorld(s);
    expect(army(w, 0).filter((q) => q.onField)).toHaveLength(MAX_START_SQUADS);
    const out = army(w, 0).filter((q) => q.heldBack);
    expect(out).toHaveLength(6);
    expect(out.every((q) => q.startStrength === 500 && q.enterTick === -1)).toBe(true);
    applyOrder(w, { side: 0, type: 'callReserve', squads: out.map((q) => q.idx) });
    run(w, 200);
    expect(out.every((q) => !q.onField && q.enterTick === -1)).toBe(true);
    const r = toStrategicResult(w);
    expect(r.attackerUnits.filter((u) => u.disposition === 'reserve').map((u) => u.strength)).toEqual(Array(6).fill(500));
  });
});

describe('the base rule (Q3, Q4, Q5)', () => {
  it('the attacker\'s base is its camp; the defender\'s the keep plus its economy and military buildings, not houses, walls or towers', () => {
    const manifest = buildTownManifest({ cityId: 'base-city', ageId: 'bronze', tierId: 'medium', style: 'europe', seed: 4, defenseTier: 1 });
    const w = createWorld(ecoSetup({ city: true, fortLevel: 2, isAttackingFortification: true, cityManifest: manifest, regionBuildings: [{ category: 'military', tier: 0, name: 'Barracks' }] }));
    const att = baseBuildings(w, SIDE_ATTACKER);
    expect(att).toHaveLength(1);
    expect(w.eco.buildings[att[0].index].type).toBe('camp');
    const def = baseBuildings(w, SIDE_DEFENDER);
    const kinds = def.map((b) => (b.kind === 'structure' ? w.structures[b.index].kind : w.eco.buildings[b.index].type));
    expect(kinds).toContain('keep');
    ['house', 'wall', 'gate', 'tower', 'landmark', 'hall'].forEach((k) => expect(kinds).not.toContain(k));
    expect(w.structures.some((st) => st.kind === 'house')).toBe(true);
    expect(w.structures.some((st) => st.kind === 'wall')).toBe(true);
  });

  it('an army wiped out while its camp stands does not lose: the battle goes on', () => {
    const w = createWorld(ecoSetup());
    run(w, 2);
    army(w, SIDE_ATTACKER).forEach(kill);
    run(w, 60);
    expect(w.ended).toBeNull();
    expect(baseGone(w, SIDE_ATTACKER)).toBe(false);
  });

  it('the camp burned ends it for the defender, whatever army the attacker still has', () => {
    const w = createWorld(ecoSetup());
    run(w, 2);
    baseBuildings(w, SIDE_ATTACKER).forEach((b) => raze(w, b));
    run(w, 3);
    // No pursuit with bases (the user's ruling, 2026-10-14): it ends at once, nobody is turned to the exits.
    expect(w.pursuit).toBeFalsy();
    expect(w.ended?.outcome).toBe('defender');
    expect(w.ended?.reason).toBe('campDestroyed');
    expect(army(w, SIDE_ATTACKER).every((q) => !q.retreating && q.order.type !== 'retreat')).toBe(true);
    // Its unbroken regiments withdraw in order, as on Auto; none is lost to a chase.
    const { attackerUnits } = toStrategicResult(w);
    expect(attackerUnits.filter((u) => u.strength > 0).every((u) => u.disposition === 'fled')).toBe(true);
  });

  it('the keep alone does not win; the last base building does', () => {
    const w = createWorld(ecoSetup({ regionBuildings: [{ category: 'military', tier: 0, name: 'Barracks' }, { category: 'economy', tier: 0, name: 'Market' }] }));
    run(w, 2);
    army(w, SIDE_DEFENDER).forEach(kill);
    raze(w, { kind: 'structure', index: 0 });
    run(w, 40);
    expect(w.ended).toBeNull();
    expect(w.assimilation).toBe(0); // standing in the keep's ruin takes nothing
    const left = baseBuildings(w, SIDE_DEFENDER);
    expect(left.length).toBe(2);
    raze(w, left[0]);
    run(w, 3);
    expect(w.ended).toBeNull();
    raze(w, left[1]);
    run(w, 3);
    expect(w.ended?.outcome).toBe('attacker');
    expect(w.ended?.reason).toBe('baseDestroyed');
  });

  it('both bases gone in the same tick: the defender holds (no draw)', () => {
    const w = createWorld(ecoSetup());
    run(w, 2);
    [SIDE_ATTACKER, SIDE_DEFENDER].forEach((side) => baseBuildings(w, side).forEach((b) => raze(w, b)));
    run(w, PURSUIT_TICKS + 5);
    expect(w.ended?.outcome).toBe('defender');
  });

  it('at the clock the defender holds, even against a far stronger attacker still on the field (Q5)', () => {
    const s = ecoSetup({ attackerUnits: many('a', 8), defenderUnits: mk('d', ['infantry']), controllers: [null, null] });
    const { result, world } = runHeadless({ ...s, limitTicks: 200 });
    expect(world.ended.reason).toBe('timeLimit');
    expect(result.outcome).toBe('defender');
    // The attacker withdraws in order: its unbroken regiments leave, none lost on the field.
    expect(result.attackerUnits.every((u) => u.disposition === 'fled')).toBe(true);
  });

  it('a commander\'s Retreat still ends it, base standing or not', () => {
    const w = createWorld(ecoSetup());
    run(w, 2);
    applyOrder(w, { side: SIDE_ATTACKER, type: 'retreatAll' });
    run(w, PURSUIT_TICKS + 5);
    expect(w.ended?.outcome).toBe('defender');
    expect(baseCount(w, SIDE_ATTACKER)).toBe(1);
  });

  it('the AI defender goes out to burn the camp once the attacker has no army left', () => {
    const s = ecoSetup({ defenderUnits: mk('d', ['infantry', 'infantry', 'cavalry', 'infantry']), controllers: ['player', 'ai'] });
    const w = createWorld(s);
    army(w, SIDE_ATTACKER).forEach(kill);
    run(w, s.limitTicks);
    expect(w.ended.outcome).toBe('defender');
    expect(w.ended.reason).toBe('campDestroyed');
    expect(w.tick).toBeLessThan(s.limitTicks);
  });
});
