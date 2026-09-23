import { describe, it, expect } from 'vitest';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';

const makeUnit = (id, classId, strength, morale = 100, extra = {}) => ({
  id, classId, strength, maxStrength: strength, morale, organization: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra
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

describe('resolveBattle: promotion perks wired into combat', () => {
  it('Volley Fire gives a ranged unit two ranged-phase hits instead of one', () => {
    const attackerUnits = [makeUnit('a0', 'ranged', 1000, 100, { promotions: ['volleyFire'] })];
    const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100), makeUnit('d1', 'infantry', 100000, 100)];
    const { report } = run({ attackerUnits, defenderUnits });
    const shots = report.log.filter((e) => e.phase === 'ranged' && e.attackerId === 'a0');
    expect(shots.length).toBe(2);
  });

  it('Unbreakable shrugs off the first rout of the battle', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 1000, 21, { promotions: ['unbreakable'] })];
    const defenderUnits = [makeUnit('d0', 'infantry', 1000, 100)];
    const { attackerUnits: result } = run({ attackerUnits, defenderUnits }, 3);
    const a0 = result.find((u) => u.id === 'a0');
    expect(a0.routed).toBe(false);
  });

  it('Sapper deals more damage than a plain siege unit in the open field', () => {
    const dmgFor = (promotions) => {
      const attackerUnits = [makeUnit('a0', 'siege', 1000, 100, { promotions })];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const { report } = run({ attackerUnits, defenderUnits, isAttackingFortification: false }, 55);
      return report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(dmgFor(['sapper'])).toBeGreaterThan(dmgFor([]));
  });

  it('Relentless deals more pursuit damage than a plain cavalry pursuer', () => {
    const pursuitDamage = (cavPromotions) => {
      const attackerUnits = [
        ...Array.from({ length: 4 }, (_, i) => makeUnit(`inf${i}`, 'infantry', 5000)),
        makeUnit('cav', 'cavalry', 5000, 100, { promotions: cavPromotions })
      ];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const { report } = run({ attackerUnits, defenderUnits }, 5);
      return report.log.filter((e) => e.phase === 'pursuit').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(pursuitDamage(['relentless'])).toBeGreaterThan(pursuitDamage([]));
  });
});

describe('resolveBattle: generals wired into combat', () => {
  it('a high-martial commander increases the damage their unit deals', () => {
    const dmgWithMartial = (martial) => {
      const commanderId = 'g1';
      const attackerUnits = [makeUnit('a0', 'infantry', 1000, 100, { commanderId })];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const generals = { g1: { martial, shock: 3, fire: 3, maneuver: 3, personality: 'logistician' } };
      const { report } = run({ attackerUnits, defenderUnits, generals }, 21);
      return report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(dmgWithMartial(5)).toBeGreaterThan(dmgWithMartial(1));
  });

  it('a cautious commander reduces damage their unit takes', () => {
    const dmgTaken = (personality) => {
      const commanderId = 'g1';
      const attackerUnits = [makeUnit('a0', 'infantry', 100000, 100)];
      const defenderUnits = [makeUnit('d0', 'infantry', 1000, 100, { commanderId })];
      const generals = { g1: { martial: 3, shock: 3, fire: 3, maneuver: 3, personality } };
      const { report } = run({ attackerUnits, defenderUnits, generals }, 21);
      return report.log.filter((e) => e.defenderId === 'd0').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(dmgTaken('cautious')).toBeLessThan(dmgTaken('reckless'));
  });
});

describe('resolveBattle: amphibious assault penalty', () => {
  it('reduces the attacker\'s damage output when set below 1', () => {
    const dmgAt = (attackerPenaltyMultiplier) => {
      const attackerUnits = [makeUnit('a0', 'infantry', 1000)];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const { report } = run({ attackerUnits, defenderUnits, attackerPenaltyMultiplier }, 8);
      return report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(dmgAt(0.75)).toBeLessThan(dmgAt(1));
  });

  it('also reduces flanking damage from reserve cavalry, not just the front line', () => {
    const flankDmgAt = (attackerPenaltyMultiplier) => {
      const attackerUnits = [
        ...Array.from({ length: 5 }, (_, i) => makeUnit(`filler${i}`, 'infantry', 50)),
        makeUnit('flanker', 'cavalry', 10)
      ];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const { report } = run({ attackerUnits, defenderUnits, attackerPenaltyMultiplier }, 1);
      return report.log.filter((e) => e.phase === 'flanking').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(flankDmgAt(0.5)).toBeLessThan(flankDmgAt(1));
  });

  it('does not affect the defender\'s damage output', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 100000, 100)];
    const defenderUnits = [makeUnit('d0', 'infantry', 1000)];
    const { report } = run({ attackerUnits, defenderUnits, attackerPenaltyMultiplier: 0.75 }, 8);
    const defenderDamage = report.log.filter((e) => e.attackerId === 'd0').reduce((sum, e) => sum + e.damage, 0);
    const { report: reportNoPenalty } = run({ attackerUnits, defenderUnits, attackerPenaltyMultiplier: 1 }, 8);
    const defenderDamageNoPenalty = reportNoPenalty.log.filter((e) => e.attackerId === 'd0').reduce((sum, e) => sum + e.damage, 0);
    expect(defenderDamage).toBe(defenderDamageNoPenalty);
  });
});

describe('resolveBattle: defenseLevel damage reduction (src/engine/siege.js)', () => {
  it('reduces the attacker\'s damage output when below 1, same slot as the amphibious penalty', () => {
    const dmgAt = (defenderDamageReductionMultiplier) => {
      const attackerUnits = [makeUnit('a0', 'infantry', 1000)];
      const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
      const { report } = run({ attackerUnits, defenderUnits, defenderDamageReductionMultiplier }, 8);
      return report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    };
    expect(dmgAt(0.5)).toBeLessThan(dmgAt(1));
  });

  it('stacks multiplicatively with attackerPenaltyMultiplier rather than overriding it', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 1000)];
    const defenderUnits = [makeUnit('d0', 'infantry', 100000, 100)];
    const dmgWithBoth = run({ attackerUnits, defenderUnits, attackerPenaltyMultiplier: 0.75, defenderDamageReductionMultiplier: 0.5 }, 8)
      .report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    const dmgWithNeither = run({ attackerUnits, defenderUnits, attackerPenaltyMultiplier: 1, defenderDamageReductionMultiplier: 1 }, 8)
      .report.log.filter((e) => e.attackerId === 'a0').reduce((sum, e) => sum + e.damage, 0);
    // Both multipliers apply to the same hits, so the combined reduction is at least as large as
    // either one alone — not merely "some reduction happened."
    expect(dmgWithBoth).toBeLessThanOrEqual(Math.round(dmgWithNeither * 0.75 * 0.5) + 1);
  });

  it('does not affect the defender\'s own damage output', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 100000, 100)];
    const defenderUnits = [makeUnit('d0', 'infantry', 1000)];
    const { report } = run({ attackerUnits, defenderUnits, defenderDamageReductionMultiplier: 0.5 }, 8);
    const defenderDamage = report.log.filter((e) => e.attackerId === 'd0').reduce((sum, e) => sum + e.damage, 0);
    const { report: reportNoReduction } = run({ attackerUnits, defenderUnits, defenderDamageReductionMultiplier: 1 }, 8);
    const defenderDamageNoReduction = reportNoReduction.log.filter((e) => e.attackerId === 'd0').reduce((sum, e) => sum + e.damage, 0);
    expect(defenderDamage).toBe(defenderDamageNoReduction);
  });
});
