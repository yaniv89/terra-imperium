import { describe, it, expect } from 'vitest';
import { MAX_BATTLE_ROUNDS, resolveBattle } from './battle';
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

  it('neither side breaking by the last round counts as the defender holding, not a phantom attacker win', () => {
    // Tiny units whose hits round to zero: nothing ever breaks, the battle runs out its rounds.
    const attackerUnits = [makeUnit('a0', 'infantry', 4, 100)];
    const defenderUnits = [makeUnit('d0', 'infantry', 4, 100)];
    const { outcome, report } = run({ attackerUnits, defenderUnits });
    expect(report.rounds).toBe(MAX_BATTLE_ROUNDS);
    expect(outcome).toBe('defender');
  });

  it('is fought over several rounds until a line breaks, both sides striking at once', () => {
    const attackerUnits = [makeUnit('a0', 'infantry', 1000), makeUnit('a1', 'infantry', 1000)];
    const defenderUnits = [makeUnit('d0', 'infantry', 1000), makeUnit('d1', 'infantry', 1000)];
    const { report } = run({ attackerUnits, defenderUnits }, 9);
    expect(report.rounds).toBeGreaterThan(1);
    expect(new Set(report.log.map((e) => e.round)).size).toBe(report.rounds);
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
    const defenderUnits = [makeUnit('d0', 'infantry', 5000, 100)];
    const { outcome, report, defenderUnits: resultDefenders } = run({ attackerUnits, defenderUnits }, 5);
    expect(outcome).toBe('attacker');
    const pursuit = report.log.filter((e) => e.phase === 'pursuit');
    expect(pursuit.length).toBeGreaterThan(0);
    const d0 = resultDefenders.find((u) => u.id === 'd0');
    expect(d0.routed || d0.strength === 0).toBe(true);
    const combat = report.log.filter((e) => e.defenderId === 'd0' && e.phase !== 'pursuit').reduce((sum, e) => sum + e.damage, 0);
    expect(5000 - d0.strength).toBeGreaterThan(Math.min(5000, combat)); // pursuit took more on top
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
    // Shaky (morale 21) against a fresh unit: without the perk it breaks on the first round; with
    // it, it shrugs that first rout off and fights on.
    const battle = (promotions) => run({ attackerUnits: [makeUnit('a0', 'infantry', 1000, 21, { promotions })], defenderUnits: [makeUnit('d0', 'infantry', 1000, 100)] }, 3);
    expect(battle([]).report.rounds).toBe(1);
    expect(battle(['unbreakable']).report.rounds).toBeGreaterThan(1);
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
      const defenderUnits = [makeUnit('d0', 'infantry', 5000, 100)];
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

// Reported: "check that the auto battle is fair". Before, one exchange never broke anyone, so an
// attacker could not win an auto-resolved battle at any odds. These pin the fairness properties.
describe('resolveBattle: fairness', () => {
  const mix = ['infantry', 'infantry', 'cavalry', 'ranged'];
  const army = (p, n, strength = 1000) => Array.from({ length: n }, (_, i) => makeUnit(`${p}${i}`, mix[i % mix.length], strength));
  const rates = (a, d, extra = {}, n = 200) => {
    const t = { attacker: 0, defender: 0, stalemate: 0 };
    for (let i = 1; i <= n; i++) t[run({ attackerUnits: a, defenderUnits: d, terrain: 'plains', ...extra }, i * 7919).outcome] += 1;
    return { attacker: t.attacker / n, defender: t.defender / n };
  };

  it('equal armies on open ground are close to a coin flip', () => {
    const r = rates(army('a', 4), army('d', 4));
    expect(r.attacker).toBeGreaterThan(0.2);
    expect(r.defender).toBeGreaterThan(0.2);
    expect(Math.abs(r.attacker - r.defender)).toBeLessThan(0.2);
  });

  it('a bigger army usually wins, but a modest edge is not a certainty', () => {
    expect(rates(army('a', 8), army('d', 2)).attacker).toBeGreaterThan(0.95);
    const edge = rates(army('a', 5), army('d', 4));
    expect(edge.attacker).toBeGreaterThan(0.7);
    expect(edge.attacker).toBeLessThan(1);
  });

  it('hills and walls favour the defender', () => {
    const open = rates(army('a', 4), army('d', 4));
    expect(rates(army('a', 4), army('d', 4), { terrain: 'hills' }).attacker).toBeLessThan(open.attacker);
    expect(rates(army('a', 4), army('d', 4), { defenderDamageReductionMultiplier: 0.75 }).attacker).toBeLessThan(open.attacker);
  });
});

describe('resolveBattle: the battle type sets the odds (battleType.js)', () => {
  const sides = () => ({ attackerUnits: [makeUnit('a1', 'infantry', 1000), makeUnit('a2', 'infantry', 1000), makeUnit('a3', 'ranged', 1000)], defenderUnits: [makeUnit('d1', 'infantry', 1000), makeUnit('d2', 'infantry', 1000), makeUnit('d3', 'ranged', 1000)] });
  const defenderLost = (r) => 3000 - r.defenderUnits.reduce((s, u) => s + u.strength, 0);
  it('a river crossing, an ambush and a landing cost the attacker output; a sally and an assault change nothing by themselves; the report names the type', () => {
    const field = run({ ...sides(), battleType: 'field' }, 11);
    expect(field.report.battleType).toBe('field');
    ['river', 'ambush', 'landing'].forEach((battleType) => {
      const r = run({ ...sides(), battleType }, 11);
      expect(r.report.battleType).toBe(battleType);
      expect(defenderLost(r)).toBeLessThan(defenderLost(field));
    });
    expect(defenderLost(run({ ...sides(), battleType: 'sally' }, 11))).toBe(defenderLost(field));
    expect(defenderLost(run({ ...sides(), battleType: 'assault' }, 11))).toBe(defenderLost(field));
    expect(run(sides(), 11).report.battleType).toBe('field'); // the default
  });
});
