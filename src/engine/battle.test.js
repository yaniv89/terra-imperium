import { describe, it, expect } from 'vitest';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';

const makeUnit = (id, classId, strength, morale = 100) => ({
  id, classId, strength, maxStrength: strength, morale, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null
});

const run = (overrides = {}, seed = 42) => resolveBattle({
  attackerUnits: [],
  defenderUnits: [],
  terrain: 'mixed',
  isAttackingFortification: false,
  rng: createRng(seed),
  ...overrides
});

describe('resolveBattle: deployment / combat width', () => {
  it('deploys at most combatWidth units per side and holds the rest in reserve', () => {
    const attackerUnits = Array.from({ length: 10 }, (_, i) => makeUnit(`a${i}`, 'infantry', 100));
    const defenderUnits = [makeUnit('d0', 'infantry', 100)];
    const { report } = run({ attackerUnits, defenderUnits });
    expect(report.combatWidth).toBe(5); // 'mixed' terrain
    expect(report.deployedAttackers).toBe(5);
    expect(report.reserveAttackers).toBe(5);
  });
});

describe('resolveBattle: outcomes', () => {
  it('an empty defending side is an automatic, uncontested attacker win', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 100)];
    const { outcome } = run({ attackerUnits, defenderUnits: [] });
    expect(outcome).toBe('attacker');
  });

  it('a vastly stronger attacker breaks a token defense', () => {
    const attackerUnits = Array.from({ length: 5 }, (_, i) => makeUnit(`a${i}`, 'infantry', 5000));
    const defenderUnits = [makeUnit('d0', 'infantry', 50)];
    const { outcome } = run({ attackerUnits, defenderUnits });
    expect(outcome).toBe('attacker');
  });

  it('a token attacker is repelled by a vastly stronger defense (defender holds)', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 50)];
    const defenderUnits = Array.from({ length: 5 }, (_, i) => makeUnit(`d${i}`, 'infantry', 5000));
    const { outcome } = run({ attackerUnits, defenderUnits });
    expect(outcome).toBe('defender');
  });

  it('neither side breaking counts as the defender holding, not a phantom attacker win', () => {
    // Small, evenly matched units: one exchange barely dents strength and doesn't move morale
    // at all (damage/25 rounds to 0), so neither line can possibly break this round.
    const attackerUnits = [makeUnit('a0', 'infantry', 100, 100)];
    const defenderUnits = [makeUnit('d0', 'infantry', 100, 100)];
    const { outcome } = run({ attackerUnits, defenderUnits });
    expect(outcome).toBe('defender');
  });
});

describe('resolveBattle: class counters apply in combat', () => {
  it('cavalry beating ranged breaks a demoralized defender that would otherwise hold', () => {
    const attackerUnits = [makeUnit('a0', 'cavalry', 1000, 100)];
    const defenderUnits = [makeUnit('d0', 'ranged', 1000, 21)];
    const { outcome } = run({ attackerUnits, defenderUnits }, 7);
    expect(outcome).toBe('attacker');
  });

  it('ranged units fire in the ranged phase, not the shock phase', () => {
    const attackerUnits = [makeUnit('a0', 'ranged', 1000)];
    const defenderUnits = [makeUnit('d0', 'infantry', 1000)];
    const { report } = run({ attackerUnits, defenderUnits });
    expect(report.log.some((e) => e.phase === 'ranged' && e.attackerId === 'a0')).toBe(true);
    expect(report.log.some((e) => e.phase === 'shock' && e.attackerId === 'a0')).toBe(false);
  });
});

describe('resolveBattle: siege fortification context', () => {
  it('a siege unit does more damage attacking a fortification than in the open field', () => {
    const dmgAgainst = (isAttackingFortification) => {
      const attackerUnits = [makeUnit('a0', 'siege', 1000)];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const { report } = run({ attackerUnits, defenderUnits, isAttackingFortification }, 99);
      return report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(dmgAgainst(true)).toBeGreaterThan(dmgAgainst(false));
  });
});

describe('resolveBattle: flanking and pursuit', () => {
  it('reserve cavalry contributes a flanking log entry against the enemy front line', () => {
    // 5 weak fillers fill the front line (combat width 5 on 'mixed' terrain); the lone cavalry
    // unit, weakest of all, is guaranteed to land in reserve and flank instead of joining melee.
    const attackerUnits = [
      ...Array.from({ length: 5 }, (_, i) => makeUnit(`filler${i}`, 'infantry', 50)),
      makeUnit('flanker', 'cavalry', 10)
    ];
    const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
    const { report } = run({ attackerUnits, defenderUnits });
    expect(report.log.some((e) => e.phase === 'flanking' && e.attackerId === 'flanker')).toBe(true);
  });

  it('pursuit adds extra casualties to a routed loser beyond combat damage alone', () => {
    const attackerUnits = [
      ...Array.from({ length: 4 }, (_, i) => makeUnit(`inf${i}`, 'infantry', 5000)),
      makeUnit('cav', 'cavalry', 5000)
    ];
    const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
    const { outcome, report, defenderUnits: resultDefenders } = run({ attackerUnits, defenderUnits }, 5);
    expect(outcome).toBe('attacker');
    expect(report.log.some((e) => e.phase === 'pursuit')).toBe(true);
    const d0 = resultDefenders.find((u) => u.id === 'd0');
    expect(d0.routed).toBe(true);
    // Combat alone (5 attackers vs 1 defender, one shock exchange) only dents a 100k-strength
    // unit by a few thousand; ending well below that is only explainable by pursuit's 50% cut.
    expect(d0.strength).toBeLessThan(60000);
  });
});

describe('resolveBattle: determinism', () => {
  it('produces byte-identical results for the same inputs and seed', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 1000), makeUnit('a1', 'cavalry', 800)];
    const defenderUnits = [makeUnit('d0', 'ranged', 900), makeUnit('d1', 'siege', 400)];
    const first = run({ attackerUnits, defenderUnits }, 12345);
    const second = run({ attackerUnits, defenderUnits }, 12345);
    expect(second).toEqual(first);
  });

  it('does not mutate the input unit arrays (pure function)', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 1000)];
    const defenderUnits = [makeUnit('d0', 'infantry', 1000)];
    const attackerSnapshot = JSON.parse(JSON.stringify(attackerUnits));
    const defenderSnapshot = JSON.parse(JSON.stringify(defenderUnits));
    run({ attackerUnits, defenderUnits });
    expect(attackerUnits).toEqual(attackerSnapshot);
    expect(defenderUnits).toEqual(defenderSnapshot);
  });
});
