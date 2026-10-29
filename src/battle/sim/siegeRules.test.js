// Playtest audit I211 (auxiliaries feel fragile) and I212 (towers and repair make assaults hopeless).
import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from '../setup/buildBattleSetup';
import { createWorld } from './world';
import { step } from './step';
import { attackStructure, attackSquad } from './combat';
import { updateBuildings } from './buildings';
import { strikingStrength, capShotOn, fireShare, ringBroken, AUX_FRONTAGE, AUX_SHOT_CAP, STRUCTURE_FIRE_FLOOR, KEEP_STORM_MULT, KEEP_HELD_MULT, REPAIR_UNDER_ATTACK_MAX_PER_SEC } from './siegeRules';
import { TICK_HZ } from './constants';
import { buildTownManifest } from '../../data/townLayout';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const walledCity = (controllers = ['player', 'player']) => createWorld(buildSetupFromArmies({
  regionId: 'siege-rules', terrain: 'plains', seed: 7, attackerUnits: mk('a', ['infantry', 'infantry']), defenderUnits: mk('d', ['infantry']),
  controllers, intel: { attackerSeesDefender: true }, battleType: null, city: true, fortLevel: 2, isAttackingFortification: true, defenseReduction: 0.8, economy: true,
  cityManifest: buildTownManifest({ cityId: 'siege-rules', ageId: 'bronze', tierId: 'medium', style: 'europe', seed: 7, defenseTier: 1 })
}));

describe('auxiliaries (I211)', () => {
  const regiment = { strength: 1000, original: {} };
  const company = { strength: 200, startStrength: 200, original: { auxiliary: true } };
  const laborer = { strength: 25, startStrength: 25, worker: true, original: { auxiliary: true } };

  it('a regiment strikes a company as at most AUX_FRONTAGE times its strength; laborers and regiments as before', () => {
    expect(strikingStrength(regiment, company)).toBe(AUX_FRONTAGE * 200);
    expect(strikingStrength({ strength: 300 }, company)).toBe(300);
    expect(strikingStrength(regiment, laborer)).toBe(1000);
    expect(strikingStrength(regiment, { strength: 400, startStrength: 1000, original: {} })).toBe(1000);
  });

  it('one volley takes at most AUX_SHOT_CAP of a company, any amount of a regiment', () => {
    expect(capShotOn(company, 90)).toBe(Math.round(200 * AUX_SHOT_CAP));
    expect(capShotOn(company, 10)).toBe(10);
    expect(capShotOn({ startStrength: 1000, original: {} }, 90)).toBe(90);
  });

  it('a company in the sim takes a lighter blow than a regiment from the same regiment', () => {
    const w = walledCity();
    const att = w.squads.find((q) => q.side === 0 && !q.worker && q.classId === 'infantry');
    const reg = w.squads.find((q) => q.side === 1 && !q.worker && q.classId === 'infantry');
    const aux = { ...reg, idx: reg.idx, strength: 200, startStrength: 200, original: { ...reg.original, auxiliary: true }, order: { type: 'move' } };
    const regCopy = { ...reg, order: { type: 'move' } };
    const rng = w.rngState;
    attackSquad(w, { ...att, cooldown: 0 }, regCopy);
    const toRegiment = 1000 - regCopy.strength;
    w.rngState = rng;
    attackSquad(w, { ...att, cooldown: 0 }, aux);
    const toCompany = 200 - aux.strength;
    expect(toRegiment).toBeGreaterThan(0);
    expect(toCompany).toBeLessThan(toRegiment);
  });
});

describe('assaults (I212)', () => {
  it('a building fires in proportion to its HP, down to STRUCTURE_FIRE_FLOOR', () => {
    expect(fireShare({ hp: 100, maxHp: 100 })).toBe(1);
    expect(fireShare({ hp: 0, maxHp: 100 })).toBe(STRUCTURE_FIRE_FLOOR);
    expect(fireShare({ hp: 50, maxHp: 100 })).toBeCloseTo(STRUCTURE_FIRE_FLOOR + (1 - STRUCTURE_FIRE_FLOOR) / 2);
  });

  it('the keep loses its walls\' cover once the ring is broken, and men without engines storm it', () => {
    const blow = (breach, held = false) => {
      const w = walledCity();
      const keep = w.structures[0];
      expect(keep.walls).toBe(true);
      // U9: the storm comes once the garrison is beaten; while it holds a regiment the keep takes KEEP_HELD_MULT
      if (!held) w.squads.forEach((q) => { if (q.side === 1 && !q.worker) q.alive = false; });
      if (breach) { const gate = w.structures.find((s) => s.kind === 'gate'); gate.alive = false; }
      expect(ringBroken(w)).toBe(breach);
      const a = w.squads.find((q) => q.side === 0 && !q.worker && q.classId === 'infantry');
      const before = keep.hp;
      attackStructure(w, a, keep);
      return before - keep.hp;
    };
    const whole = blow(false); const broken = blow(true);
    expect(whole).toBeGreaterThan(0);
    // 0.6 walls' cover gone and the storm: about KEEP_STORM_MULT / 0.6 times the blow
    expect(broken / whole).toBeGreaterThan(KEEP_STORM_MULT);
    // a city falls only when its defence is beaten: a held keep takes a fraction of the storm
    expect(blow(true, true) / broken).toBeLessThan(KEEP_HELD_MULT);
  });

  it('every hit on a city work marks it as under attack', () => {
    const w = walledCity();
    const gate = w.structures.find((s) => s.kind === 'gate');
    const a = w.squads.find((q) => q.side === 0 && !q.worker);
    w.tick = 123;
    attackStructure(w, a, gate);
    expect(gate.lastHitTick).toBe(123);
  });

  it('the Workshop\'s field repairs wait while the keep is under attack', () => {
    const w = walledCity();
    w.structures.push({ id: 'b_industry', kind: 'building', category: 'industry', alive: true, hp: 600, maxHp: 600, x: 0, y: 0, radius: 1 });
    const keep = w.structures[0];
    keep.hp = keep.maxHp - 500;
    w.tick = 400; keep.lastHitTick = 390;
    updateBuildings(w);
    expect(keep.hp).toBe(keep.maxHp - 500);
    keep.lastHitTick = 0;
    updateBuildings(w);
    expect(keep.hp).toBeGreaterThan(keep.maxHp - 500);
  });

  it('all the laborers repairing a keep under attack restore at most REPAIR_UNDER_ATTACK_MAX_PER_SEC a second', () => {
    const w = walledCity();
    const keep = w.structures[0];
    keep.hp = keep.maxHp - 1500;
    const hands = w.squads.filter((q) => q.worker && q.side === 1 && q.alive).map((q) => q.idx);
    expect(hands.length).toBeGreaterThan(2);
    step(w, [{ side: 1, type: 'repair', squads: hands, target: { kind: 'structure', index: 0 } }]);
    // the keep is hit every tick while they walk there and work
    for (let i = 0; i < 40 * TICK_HZ; i++) { keep.lastHitTick = w.tick; step(w, []); w.events.length = 0; }
    const start = keep.hp;
    for (let i = 0; i < 10 * TICK_HZ; i++) { keep.lastHitTick = w.tick; step(w, []); w.events.length = 0; }
    expect(keep.hp - start).toBeLessThanOrEqual(REPAIR_UNDER_ATTACK_MAX_PER_SEC * 10);
    expect(keep.hp - start).toBeGreaterThan(0);
  });
});
