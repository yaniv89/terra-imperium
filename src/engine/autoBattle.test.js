// src/engine/autoBattle.test.js
// The honest auto-resolve (master plan 6.1): the battle economy's auxiliaries (never campaign
// units), the gate a walled city holds against an army without siege engines, the city's damage,
// the decisive field rule, and a small parity guardrail against the real-time battle with the
// economy on (the full matrix: .claude/skills/battle-lab/parityEco.sim.js).
import { describe, it, expect } from 'vitest';
import { autoFromInputs, auxiliariesFor, autoCityDamage, WALLS_NO_SIEGE_MULT } from './autoBattle';
import { militiaFor } from './battleInputs';
import { createRng } from '../utils/rng';
import { buildTownManifest, manifestHousing } from '../data/townLayout';
import { buildSetupFromArmies } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const sum = (units) => units.reduce((x, u) => x + Math.max(0, u.strength), 0);
const ins = (att, def, extra = {}) => ({ attackerUnits: att, defenderUnits: def, hpRatio: 1, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }, housing: 0, ...extra });
const args = (extra = {}) => ({ terrain: 'mixed', isAttackingFortification: false, battleType: 'field', attackerAgeId: 'classical', defenderAgeId: 'classical', generals: {}, ...extra });

describe('the honest auto-resolve', () => {
  it('both sides field auxiliaries from their stockpile; they demobilise and never reach the campaign', () => {
    const i = ins(mk('a', ['infantry', 'infantry']), mk('d', ['infantry', 'infantry']));
    expect(auxiliariesFor('field', 0, i).length).toBeGreaterThan(0);
    const poor = auxiliariesFor('field', 0, { ...i, economyInputs: { supply: [0, 1], development: [0, 0] } }).reduce((s, u) => s + u.strength, 0);
    expect(poor).toBeLessThan(auxiliariesFor('field', 0, i).reduce((s, u) => s + u.strength, 0));
    const r = autoFromInputs(args(), i, 'field', createRng(4));
    expect([...r.attackerUnits, ...r.defenderUnits].some((u) => u.auxiliary)).toBe(false);
    expect([...r.report.deployedAttackerIds, ...r.report.deployedDefenderIds].some((id) => id.startsWith('aux_'))).toBe(false);
    expect(r.report.auxiliaries[0].fielded).toBeGreaterThan(0);
    // A sea battle has no battle economy.
    expect(auxiliariesFor('naval', 0, i)).toEqual([]);
  });

  it('a walled city holds its gate against an army without siege engines, less so once a siege battered it', () => {
    const att = mk('a', ['infantry', 'infantry', 'infantry']);
    const def = mk('d', ['infantry']);
    const walls = autoFromInputs(args({ isAttackingFortification: true, battleType: 'assault' }), ins(att, def, { walled: true }), 'invasion', createRng(1));
    expect(walls.report.wallsMult).toBeCloseTo(WALLS_NO_SIEGE_MULT, 6);
    const battered = autoFromInputs(args({ isAttackingFortification: true, battleType: 'assault' }), ins(att, def, { walled: true, hpRatio: 0 }), 'invasion', createRng(1));
    expect(battered.report.wallsMult).toBe(1);
    const engines = autoFromInputs(args({ isAttackingFortification: true, battleType: 'assault' }), ins(mk('a', ['infantry', 'siege']), def, { walled: true }), 'invasion', createRng(1));
    expect(engines.report.wallsMult).toBe(1);
    // A city with its militia alone is walked into: no economy, no gate.
    const empty = autoFromInputs(args(), ins(att, militiaFor({ ownerId: 'x', cityId: 'c', housing: 60 }), { walled: true }), 'invasion', createRng(1));
    expect(empty.report.wallsMult).toBe(1);
    expect(empty.report.auxiliaries[1].fielded).toBe(0);
  });

  it('an assault on Auto damages the real city the way the real-time one does: towers and the town hall', () => {
    const manifest = buildTownManifest({ cityId: 'c1', ageId: 'classical', tierId: 'medium', style: 'europe', seed: 3, defenseTier: 1 });
    const won = autoCityDamage(manifest, { outcome: 'attacker' }, 0.6, createRng(2));
    const kinds = (ids) => ids.map((id) => manifest.structures.find((s) => s.id === id)?.kind);
    expect(kinds(won.destroyed)).toContain('townhall');
    expect(kinds([...won.destroyed, ...won.damaged]).every((k) => k === 'tower' || k === 'townhall')).toBe(true);
    const held = autoCityDamage(manifest, { outcome: 'defender' }, 0.2, createRng(2));
    expect(kinds(held.destroyed)).not.toContain('townhall');
  });

  it('decisive field battles on Auto: every loser unit gets a disposition', () => {
    const r = autoFromInputs(args(), ins(mk('a', ['infantry', 'infantry', 'cavalry', 'infantry']), mk('d', ['infantry'])), 'field', createRng(9));
    [...r.attackerUnits, ...r.defenderUnits].forEach((u) => expect(['dead', 'fled', 'field']).toContain(u.disposition));
  });

  it('stays within the parity guardrail of the real-time battle with the economy (tactical within [auto / 2, auto x 3.5])', () => {
    const N = 6;
    [['field', ['infantry', 'infantry', 'ranged'], ['infantry', 'infantry', 'ranged']], ['town', ['infantry', 'infantry', 'infantry', 'cavalry', 'ranged'], ['infantry', 'ranged']]].forEach(([type, a, d]) => {
      let tA = 0; let tD = 0; let aA = 0; let aD = 0;
      for (let seed = 1; seed <= N; seed++) {
        const town = type === 'town';
        const manifest = town ? buildTownManifest({ cityId: `p${seed}`, ageId: 'classical', tierId: 'medium', style: 'europe', seed, defenseTier: -1 }) : null;
        const militia = town ? militiaFor({ ownerId: 'd', cityId: `p${seed}`, housing: manifestHousing(manifest) }) : [];
        const att = mk('a', a); const def = [...mk('d', d), ...militia];
        const { result } = runHeadless(buildSetupFromArmies({ regionId: `p${seed}`, terrain: 'mixed', seed, attackerUnits: att, defenderUnits: def, attackerAgeId: 'classical', defenderAgeId: 'classical', controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: town ? null : 'field', city: town, ...(town ? { cityManifest: manifest } : {}), economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] } }));
        tA += sum(att) - sum(result.attackerUnits); tD += sum(def) - sum(result.defenderUnits);
        const auto = autoFromInputs(args(), ins(att, def, { housing: town ? manifestHousing(manifest) : 0 }), town ? 'invasion' : 'field', createRng(seed * 97));
        aA += sum(att) - sum(auto.attackerUnits); aD += sum(def) - sum(auto.defenderUnits);
      }
      const ratio = (tA / Math.max(1, tD)) / Math.max(0.001, aA / Math.max(1, aD));
      expect(ratio, `${type}: tactical / auto exchange`).toBeGreaterThan(0.5);
      expect(ratio, `${type}: tactical / auto exchange`).toBeLessThan(3.5);
    });
  }, 120000);
});
