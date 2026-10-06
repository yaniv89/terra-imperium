// .claude/skills/battle-lab/autoCalib.sim.js
// Calibrates the honest auto-resolve's economy and walls constants (src/engine/autoBattle.js
// AUTO_TUNE) against a parityEco run's real-time numbers: reads BASE=<parityEco output file>,
// re-runs only the auto-resolve over a grid of constants, and prints the best ones by how many
// matchups fall inside the guardrail (tactical exchange within [auto / 2, auto x 3.5]), then the
// summed |log ratio| and the win-rate gap.
//   BASE=parity.txt N=32 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/autoCalib
import { it } from 'vitest';
import fs from 'node:fs';
import { autoFromInputs } from '../../../src/engine/autoBattle';
import { militiaFor } from '../../../src/engine/battleInputs';
import { createRng } from '../../../src/utils/rng';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';

const N = Number(process.env.N || 32);
const TIER = process.env.TIER || 'medium';
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const sum = (units) => units.reduce((x, u) => x + Math.max(0, u.strength), 0);

it('calibrate', () => {
  const rows = fs.readFileSync(process.env.BASE, 'utf8').split('\n').filter((l) => l.startsWith('PARITY')).map((l) => {
    const [, type, ages, att, , def] = l.split(' ');
    const [ageA, ageD] = ages.split('>');
    return { type, ageA, ageD, att: att.split('+'), def: def.split('+'), tactical: Number(/tactical=([\d.]+)/.exec(l)[1]), wins: Number(/ wins=(\d+)/.exec(l)[1]), terrain: (/terrain=(\w+)/.exec(l) || [0, 'mixed'])[1] };
  });
  // Pre-build the inputs once per row and seed.
  const cases = rows.map((r) => {
    const assault = r.type === 'assault' || r.type === 'town';
    const walled = r.type === 'assault';
    const seeds = [];
    for (let seed = 1; seed <= N; seed++) {
      const manifest = assault ? buildTownManifest({ cityId: `parity-${seed}`, ageId: r.ageD, tierId: TIER, style: 'europe', seed, defenseTier: walled ? 1 : -1 }) : null;
      const housing = assault ? manifestHousing(manifest) : 0;
      const militia = assault ? militiaFor({ ownerId: 'defender', cityId: `parity-${seed}`, housing }) : [];
      seeds.push({ seed, attackers: mk('a', r.att), defenders: [...mk('d', r.def), ...militia], housing });
    }
    return { ...r, assault, walled, seeds };
  });
  const score = (tune) => {
    let out = 0; let logSum = 0; let winGap = 0; const outRows = [];
    cases.forEach((c) => {
      let aA = 0; let aD = 0; let wins = 0;
      c.seeds.forEach((s) => {
        const ins = { attackerUnits: s.attackers, defenderUnits: s.defenders, hpRatio: 1, walled: c.walled, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }, housing: s.housing };
        const r = autoFromInputs({ terrain: c.terrain, isAttackingFortification: c.walled, battleType: c.walled ? 'assault' : 'field', attackerAgeId: c.ageA, defenderAgeId: c.ageD, defenderDamageReductionMultiplier: c.walled ? getDefenseLevelDamageReductionMultiplier(2) : 1, generals: {} }, ins, c.assault ? 'invasion' : 'field', createRng(s.seed * 97), tune);
        aA += sum(s.attackers) - sum(r.attackerUnits); aD += sum(s.defenders) - sum(r.defenderUnits);
        if (r.outcome === 'attacker') wins += 1;
      });
      const auto = aA / Math.max(1, aD);
      const ratio = c.tactical / Math.max(0.001, auto);
      if (ratio < 0.5 || ratio > 3.5) { out += 1; outRows.push(`${c.type} ${c.ageA}>${c.ageD} ${c.att.join('+')} vs ${c.def.join('+')} ratio=${ratio.toFixed(2)} wins=${c.wins}/${wins}`); }
      logSum += Math.abs(Math.log(ratio));
      winGap += Math.abs(c.wins - wins) / N;
    });
    return { out, logSum, winGap, outRows };
  };
  const results = [];
  for (const AUX_CLOSENESS of (process.env.K || "0").split(",").map(Number)) for (const AUX_ROUNDS of (process.env.R || "2").split(",").map(Number)) for (const AUX_UNIT of (process.env.U || "400").split(",").map(Number)) for (const AUX_EFFECT of (process.env.EFF || "0.4,0.7,1").split(",").map(Number)) for (const f of (process.env.F || "4,8,12").split(",").map(Number)) for (const a of (process.env.A || "6,12,20").split(",").map(Number)) for (const d of (process.env.D || "4,8,12").split(",").map(Number)) for (const WALLS_NO_SIEGE_MULT of (process.env.W || "0.2,0.35,0.5,0.7").split(",").map(Number)) {
    const tune = { AUX_CLOSENESS, AUX_ROUNDS, AUX_UNIT, AUX_EFFECT, AUX_TRAINED: { field: [f, f], assault: [a, d] }, WALLS_NO_SIEGE_MULT };
    results.push({ tune, ...score(tune) });
  }
  results.sort((x, y) => x.out - y.out || (x.logSum + x.winGap) - (y.logSum + y.winGap));
  results.slice(0, 8).forEach((r) => console.log(`CALIB out=${r.out}/${cases.length} logSum=${r.logSum.toFixed(2)} winGap=${r.winGap.toFixed(2)} ${JSON.stringify(r.tune)}`));
  results[0].outRows.forEach((row) => console.log(`CALIB-OUT ${row}`));
});
