// Calibrates the Lanchester estimate (lanchester.js) against the real auto-resolve (battle.js).
// Random but seeded fixtures (army sizes, unit mixes, depleted units, terrain, walls, forts, ages,
// battle types) are each fought SAMPLES times with resolveBattle; the estimate must match the
// observed win rate. By default a small set runs as a regression test. CALIBRATE=1 runs the full
// set, grid-searches the constants (quarter exponents, see lanchester.js) and prints the error
// table that plans/math/ai.md quotes:
//   CALIBRATE=1 npx vitest run src/engine/lanchester.calibration.test.js
import { describe, it, expect } from 'vitest';
import { resolveBattle } from './battle';
import { createRng } from '../utils/rng';
import { estimateBattle, battleEffectiveness, SHARPNESS, LANCHESTER_EDGE, LOSS_BASE, LOSS_EXP } from './lanchester';
import { getDefenseLevelDamageReductionMultiplier } from './siege';
import { FORT_REDUCTION } from './fieldBattle';

const FULL = !!process.env.CALIBRATE;
const FIXTURES = FULL ? 1500 : 160;
const SAMPLES = FULL ? 48 : 24;
const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const TERRAINS = ['plains', 'plains', 'mixed', 'hills', 'forest', 'mountains', 'desert'];
const MIX = [['infantry', 0.45], ['ranged', 0.25], ['cavalry', 0.2], ['siege', 0.1]];

const pick = (rng, list) => list[Math.floor(rng.next() * list.length)];
const pickClass = (rng) => { let r = rng.next(); for (const [c, w] of MIX) { if (r < w) return c; r -= w; } return 'infantry'; };
const army = (rng, side, n, skew) => Array.from({ length: n }, (_, i) => ({
  id: `${side}${i}`, classId: skew && rng.next() < 0.5 ? skew : pickClass(rng),
  strength: rng.next() < 0.6 ? 1000 : Math.round(250 + rng.next() * 750), morale: 100, promotions: []
}));

export const makeFixture = (seed) => {
  const rng = createRng(seed);
  const nA = 1 + Math.floor(rng.next() * 9); const nB = 1 + Math.floor(rng.next() * 9);
  const kind = rng.next();
  const age = Math.floor(rng.next() * AGES.length);
  const gap = rng.next() < 0.75 ? 0 : (rng.next() < 0.5 ? -1 : 1);
  const defAge = Math.max(0, Math.min(AGES.length - 1, age + gap));
  const skewA = rng.next() < 0.3 ? pickClass(rng) : null; const skewB = rng.next() < 0.3 ? pickClass(rng) : null;
  const base = { attackerUnits: army(rng, 'a', nA, skewA), defenderUnits: army(rng, 'd', nB, skewB), attackerAgeId: AGES[age], defenderAgeId: AGES[defAge], terrain: pick(rng, TERRAINS) };
  if (kind < 0.3) { // a city assault behind walls
    const level = 1 + Math.floor(rng.next() * 8);
    return { ...base, isAttackingFortification: true, battleType: 'assault', defenderDamageReductionMultiplier: getDefenseLevelDamageReductionMultiplier(level) };
  }
  if (kind < 0.4) return { ...base, battleType: 'river' };
  if (kind < 0.5) return { ...base, battleType: 'ambush', terrain: pick(rng, ['forest', 'hills']) };
  if (kind < 0.6) return { ...base, battleType: 'field', isAttackingFortification: true, defenderDamageReductionMultiplier: FORT_REDUCTION };
  return { ...base, battleType: 'field' };
};

const sum = (units) => units.reduce((s, u) => s + Math.max(0, u.strength), 0);
export const observe = (fx, samples) => {
  let wins = 0; let la = 0; let lb = 0;
  const a0 = sum(fx.attackerUnits); const b0 = sum(fx.defenderUnits);
  for (let i = 1; i <= samples; i++) {
    const r = resolveBattle({ ...fx, rng: createRng(Math.imul(i, 2654435761) >>> 0) });
    if (r.outcome === 'attacker') wins += 1;
    la += (a0 - sum(r.attackerUnits)) / a0; lb += (b0 - sum(r.defenderUnits)) / b0;
  }
  return { p: wins / samples, la: la / samples, lb: lb / samples };
};

const data = (() => {
  const out = [];
  for (let i = 0; i < FIXTURES; i++) {
    const fx = makeFixture(1000 + i);
    const eff = battleEffectiveness(fx);
    out.push({ fx, obs: observe(fx, SAMPLES), lnE: Math.log(eff.att / eff.def), lnN: Math.log(sum(fx.attackerUnits) / sum(fx.defenderUnits)), rawRatio: sum(fx.attackerUnits) / sum(fx.defenderUnits) });
  }
  return out;
})();

// Errors of a predictor p(d) against the observed rates: Brier (mean squared), mean absolute,
// and decision agreement (would attack iff p >= 0.5, vs the observed rate >= 0.5).
const score = (predict) => {
  let brier = 0; let mae = 0; let agree = 0;
  data.forEach((d) => { const p = predict(d); brier += (p - d.obs.p) ** 2; mae += Math.abs(p - d.obs.p); if ((p >= 0.5) === (d.obs.p >= 0.5)) agree += 1; });
  return { brier: brier / data.length, mae: mae / data.length, agree: agree / data.length };
};
const lanchesterP = (d) => estimateBattle(d.fx).pWin;
// What the AI used before: a raw strength share (out-of-sight wars, peace), or attack iff the raw
// ratio clears 1.2 (relief) or 0.8 (assault: it held back only when the garrison was 1.25x).
const shareP = (d) => d.rawRatio / (1 + d.rawRatio);

describe('Lanchester estimate vs the real auto-resolve', () => {
  it('predicts the win rate far better than the raw strength share', () => {
    const lan = score(lanchesterP); const raw = score(shareP);
    const relief = data.filter((d) => (d.rawRatio >= 1.2) === (d.obs.p >= 0.5)).length / data.length;
    const assault = data.filter((d) => (d.rawRatio >= 0.8) === (d.obs.p >= 0.5)).length / data.length;
    if (FULL || process.env.VERBOSE) {
      console.log(`CALIBRATION fixtures=${data.length} samples=${SAMPLES} constants sharpness=${SHARPNESS} edge=${LANCHESTER_EDGE} lossBase=${LOSS_BASE} lossExp=${LOSS_EXP}`);
      console.log(`  lanchester  brier=${lan.brier.toFixed(4)} mae=${lan.mae.toFixed(3)} decisions=${(100 * lan.agree).toFixed(1)}%`);
      console.log(`  rawShare    brier=${raw.brier.toFixed(4)} mae=${raw.mae.toFixed(3)} decisions=${(100 * raw.agree).toFixed(1)}%`);
      console.log(`  rule 1.2x (relief) decisions=${(100 * relief).toFixed(1)}%  rule 0.8x (assault) decisions=${(100 * assault).toFixed(1)}%`);
      // Reliability: observed vs predicted by bins of predicted pWin.
      const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, o: 0 }));
      data.forEach((d) => { const p = lanchesterP(d); const b = bins[Math.min(9, Math.floor(p * 10))]; b.n += 1; b.p += p; b.o += d.obs.p; });
      bins.forEach((b, i) => { if (b.n) console.log(`  bin ${i / 10}-${(i + 1) / 10}: n=${b.n} predicted=${(b.p / b.n).toFixed(2)} observed=${(b.o / b.n).toFixed(2)}`); });
      let lossErr = 0; data.forEach((d) => { const e = estimateBattle(d.fx); lossErr += Math.abs(e.attackerLossShare - d.obs.la) + Math.abs(e.defenderLossShare - d.obs.lb); });
      console.log(`  loss share mae=${(lossErr / data.length / 2).toFixed(3)}`);
      // Error by battle type, and what each attack rule does: of the battles it would fight, the
      // share actually won (expected), and the expected wins it passes up.
      ['field', 'assault', 'river', 'ambush'].forEach((type) => {
        const sub = data.filter((d) => (d.fx.battleType || 'field') === type);
        if (sub.length) console.log(`  ${type.padEnd(8)} n=${sub.length} mae=${(sub.reduce((a, d) => a + Math.abs(lanchesterP(d) - d.obs.p), 0) / sub.length).toFixed(3)}`);
      });
      const rule = (label, attacks) => {
        const fought = data.filter(attacks); const skipped = data.filter((d) => !attacks(d));
        console.log(`  ${label.padEnd(26)} fights=${fought.length} wins/fight=${(fought.reduce((a, d) => a + d.obs.p, 0) / Math.max(1, fought.length)).toFixed(2)} wins passed up=${skipped.reduce((a, d) => a + d.obs.p, 0).toFixed(0)}`);
      };
      rule('old relief (raw x1.2)', (d) => d.rawRatio >= 1.2);
      rule('new relief (pWin >= 0.6)', (d) => lanchesterP(d) >= 0.6);
      rule('old assault (raw x0.8)', (d) => d.rawRatio >= 0.8);
      rule('new assault (pWin >= 0.45)', (d) => lanchesterP(d) >= 0.45);
      // Cost: one estimate against the 200-sample Monte Carlo the player's odds sheet runs.
      const fx = data[0].fx; let t = performance.now();
      for (let i = 0; i < 2000; i++) estimateBattle(fx);
      const est = (performance.now() - t) / 2000; t = performance.now();
      observe(fx, 200);
      console.log(`  cost: estimate ${(est * 1000).toFixed(1)} us, 200-sample Monte Carlo ${(performance.now() - t).toFixed(1)} ms`);
    }
    expect(lan.brier).toBeLessThan(raw.brier * 0.6);
    expect(lan.mae).toBeLessThan(0.12);
    expect(lan.agree).toBeGreaterThan(0.85);
  }, 120000);

  it.runIf(FULL)('grid search for the constants (prints the best fit)', () => {
    const logistic = (z) => 1 / (1 + Math.exp(-z));
    let best = null;
    for (let ce = 0.5; ce <= 12; ce += 0.5) for (let cn = 0.5; cn <= 16; cn += 0.5) for (let edge = 0.5; edge <= 1.6; edge += 0.02) {
      const le = Math.log(edge);
      let b = 0;
      for (const d of data) { const p = logistic(le + ce * d.lnE + cn * d.lnN); b += (p - d.obs.p) ** 2; }
      if (!best || b < best.total) best = { ce, cn, edge: Math.round(edge * 100) / 100, total: b, b: b / data.length };
    }
    // The constrained (square law) fit the game uses: power = eff x N², pWin = logistic(ln edge + k ln power).
    let sq = null;
    for (let k = 0.5; k <= 8; k += 0.25) for (let edge = 0.5; edge <= 1.6; edge += 0.02) {
      const le = Math.log(edge);
      let b = 0;
      for (const d of data) b += (logistic(le + k * (d.lnE + 2 * d.lnN)) - d.obs.p) ** 2;
      if (!sq || b < sq.total) sq = { k, edge: Math.round(edge * 100) / 100, total: b, b: b / data.length };
    }
    let sqLoss = null;
    for (let base = 0.3; base <= 1.0; base += 0.02) for (let q = 0.25; q <= 3; q += 0.25) {
      let e = 0;
      for (const d of data) { const r = Math.exp(q * (d.lnE + 2 * d.lnN)); e += (base / (1 + r) - d.obs.la) ** 2 + (base * r / (1 + r) - d.obs.lb) ** 2; }
      if (!sqLoss || e < sqLoss.e) sqLoss = { base: Math.round(base * 100) / 100, q, e };
    }
    console.log(`FIT free effExp=${best.ce} numExp=${best.cn} edge=${best.edge} brier=${best.b.toFixed(4)}`);
    console.log(`FIT squareLaw sharpness=${sq.k} edge=${sq.edge} brier=${sq.b.toFixed(4)} lossBase=${sqLoss.base} lossExp=${sqLoss.q}`);
    expect(best.b).toBeLessThan(0.1);
  }, 600000);
});
