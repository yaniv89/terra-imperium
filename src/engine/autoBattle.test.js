// src/engine/autoBattle.test.js
// The honest auto-resolve (master plan 6.1): the battle economy's auxiliaries (never campaign
// units), the gate a walled city holds against an army without siege engines, the city's damage,
// the decisive field rule, and a small parity guardrail against the real-time battle with the
// economy on (the full matrix: .claude/skills/battle-lab/parityEco.sim.js).
import { describe, it, expect } from 'vitest';
import { autoFromInputs, auxiliariesFor, autoCityDamage, WALLS_NO_SIEGE_MULT, WALLS_AGE_RELIEF, AUTO_TUNE } from './autoBattle';
import { militiaFor } from './battleInputs';
import { createRng } from '../utils/rng';
import { getDefenseLevelDamageReductionMultiplier } from './siege';
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

  it('walls ease an older attacker\'s age gap: bronze against classical walls stays inside the parity guardrail', () => {
    // Real-time numbers (parityEco, 32 seeds, medium city, fort level 2): attacker losses over defender
    // losses 2.07 (no siege) and 1.56 (with siege) for bronze against classical walls. Before the
    // relief Auto gave 5.5 and 3.6 (0.38x and 0.44x, outside [auto / 2, auto x 3.5]).
    const cases = [[['infantry', 'infantry', 'ranged'], ['infantry', 'infantry', 'ranged'], 2.07], [['infantry', 'infantry', 'cavalry', 'ranged', 'siege'], ['infantry', 'infantry', 'ranged'], 1.561]];
    cases.forEach(([att, def, tactical]) => {
      const exchange = (relief) => {
        let a = 0; let d = 0;
        for (let seed = 1; seed <= 32; seed++) {
          const manifest = buildTownManifest({ cityId: `walls-${seed}`, ageId: 'classical', tierId: 'medium', style: 'europe', seed, defenseTier: 1 });
          const militia = militiaFor({ ownerId: 'defender', cityId: `walls-${seed}`, housing: manifestHousing(manifest) });
          const attackers = mk('a', att); const defenders = [...mk('d', def), ...militia];
          const i = ins(attackers, defenders, { walled: true, housing: manifestHousing(manifest), militia });
          const r = autoFromInputs(args({ attackerAgeId: 'bronze', defenderAgeId: 'classical', isAttackingFortification: true, battleType: 'assault', defenderDamageReductionMultiplier: getDefenseLevelDamageReductionMultiplier(2) }), i, 'invasion', createRng(seed * 97), { ...AUTO_TUNE, WALLS_AGE_RELIEF: relief });
          a += sum(attackers) - sum(r.attackerUnits); d += sum(defenders) - sum(r.defenderUnits);
        }
        return a / Math.max(1, d);
      };
      const without = exchange(0); const withRelief = exchange(WALLS_AGE_RELIEF);
      expect(tactical / without).toBeLessThan(0.5); // the bug: Auto too harsh on the attacker
      expect(tactical / withRelief).toBeGreaterThanOrEqual(0.5);
      expect(tactical / withRelief).toBeLessThanOrEqual(3.5);
    });
  });

  it('the age relief only helps an older attacker behind walls', () => {
    const run = (att, def, extra, walled) => autoFromInputs(args({ attackerAgeId: att, defenderAgeId: def, ...extra }), ins(mk('a', ['infantry', 'infantry']), mk('d', ['infantry', 'infantry']), { walled }), walled ? 'invasion' : 'field', createRng(5)).report.ageRelief;
    expect(run('bronze', 'classical', { isAttackingFortification: true }, true)).toBeGreaterThan(1);
    expect(run('classical', 'bronze', { isAttackingFortification: true }, true)).toBe(1);
    expect(run('classical', 'classical', { isAttackingFortification: true }, true)).toBe(1);
    expect(run('bronze', 'classical', {}, false)).toBe(1);
  });
});
