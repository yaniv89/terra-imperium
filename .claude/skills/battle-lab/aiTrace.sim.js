// .claude/skills/battle-lab/aiTrace.sim.js
// Where the tactical AI is dumb (battle-ai-tactics lane): AI against AI, sampled every half second,
// counting squad-seconds of each mistake per side and naming the first ones (tick, squad, class):
//   LONE     a squad fighting at under half the local strength while its army as a whole is not losing
//   RANGEDMELEE a ranged squad with an enemy melee squad on top of it
//   BADMATCH a squad hitting a target its class loses to (counter x0.6) while a fair one is in sight
//   WOUNDED  a squad under 30% of its men still in melee
//   IDLE     a squad with no order and no target while an enemy is in sight within 15 tiles
//   FOCUS    ranged squads in reach of a target: share of them sharing it with another (higher = focus)
// plus the powers used (tick), workers lost per side and the outcome.
//   N=4 TYPES=field,assault,naval AGES=bronze,classical,gunpowder [ECO=1 DIFF=prince VERBOSE=1] \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/aiTrace
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { toStrategicResult } from '../../../src/battle/sim/result';
import { battleLimitTicks, Q } from '../../../src/battle/sim/constants';
import { thinkAI } from '../../../src/battle/sim/tacticalAI';
import { isFighting, inRangeOfSquad } from '../../../src/battle/sim/combat';
import { canSeeSquad } from '../../../src/battle/sim/fog';
import { getCounterMultiplier } from '../../../src/data/unitClasses';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { militiaFor } from '../../../src/engine/battleInputs';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { getAvailableClasses } from '../../../src/data/unitClasses';

const N = Number(process.env.N || 4);
const TYPES = (process.env.TYPES || 'field,assault,naval').split(',');
const AGES = (process.env.AGES || 'bronze,classical,gunpowder').split(',');
const ECO = process.env.ECO !== '0';
const DIFF = process.env.DIFF || 'prince';
const VERBOSE = process.env.VERBOSE === '1';
const LAND = [['infantry', 'infantry', 'cavalry', 'ranged', 'ranged'], ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged']];
const SEA = [['warship', 'warship', 'warship', 'raider'], ['warship', 'warship', 'raider', 'raider']];
const ofAge = (cls, ageId) => cls.map((c) => (getAvailableClasses(ageId).includes(c) ? c : 'infantry'));
const mk = (p, cls, sea) => cls.map((c, i) => ({ id: `${p}${i}`, classId: sea ? 'naval' : c, ...(sea ? { navalLine: c, domain: 'naval' } : { domain: 'land' }), strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null }));
const KINDS = ['LONE', 'RANGEDMELEE', 'BADMATCH', 'WOUNDED', 'IDLE'];
const SAMPLE = 10; // ticks (half a second)

it('where the AI is dumb', () => {
  TYPES.forEach((type) => AGES.forEach((age) => {
    const tot = [0, 1].map(() => ({ ...Object.fromEntries(KINDS.map((k) => [k, 0])), focusN: 0, focusShared: 0, wins: 0, workersLost: 0, powers: [] }));
    const firsts = [[], []];
    for (let seed = 1; seed <= N; seed++) {
      const sea = type === 'naval'; const city = type === 'assault' || type === 'town';
      const manifest = city ? buildTownManifest({ cityId: `trace-${seed}`, ageId: age, tierId: 'medium', style: 'europe', seed, defenseTier: type === 'assault' ? 1 : -1 }) : null;
      const militia = city ? militiaFor({ ownerId: 'defender', cityId: `trace-${seed}`, housing: manifestHousing(manifest) }) : [];
      const [att, def] = sea ? SEA : LAND;
      const setup = buildSetupFromArmies({
        regionId: `trace-${seed}`, terrain: sea ? 'sea' : 'mixed', seed, attackerUnits: mk('a', sea ? att : ofAge(att, age), sea), defenderUnits: [...mk('d', sea ? def : ofAge(def, age), sea), ...militia],
        attackerAgeId: age, defenderAgeId: age, deposits: [], powers: [[{ id: 'rallyCry' }], [{ id: 'rallyCry' }]], battleType: sea ? 'naval' : city ? null : 'field', city,
        ...(city ? { fortLevel: type === 'assault' ? 2 : 0, isAttackingFortification: type === 'assault', cityManifest: manifest, defenseReduction: type === 'assault' ? getDefenseLevelDamageReductionMultiplier(2) : 1 } : {}),
        economy: ECO && !sea, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
      });
      const w = createWorld({ ...setup, controllers: ['player', 'player'], difficultyId: DIFF });
      const limit = battleLimitTicks(w.setup) + 20;
      while (!w.ended && w.tick < limit) {
        const orders = [];
        thinkAI(w, 0, orders); thinkAI(w, 1, orders);
        orders.forEach((o) => { if (o.type === 'power') tot[o.side].powers.push(`${o.power}@${Math.round(w.tick / 20)}s`); });
        step(w, orders);
        w.events.length = 0;
        if (w.tick % SAMPLE) continue;
        const live = w.squads.filter((q) => isFighting(q) && !q.worker && !q.isGeneral && !(q.inside >= 0));
        const sideStr = [0, 1].map((s) => live.filter((q) => q.side === s && !q.routed).reduce((x, q) => x + q.strength, 0));
        const flag = (q, k, extra = '') => {
          tot[q.side][k] += SAMPLE / 20;
          if (firsts[q.side].filter((f) => f.startsWith(k)).length < 3) firsts[q.side].push(`${k} seed=${seed} t=${Math.round(w.tick / 20)}s #${q.idx} ${q.classId} ${Math.round(q.strength)}${extra}`);
        };
        const targetsShared = new Map();
        live.forEach((q) => {
          if (q.routed || q.retreating) return;
          const foes = live.filter((o) => o.side !== q.side && !o.routed);
          const near = (list, r) => list.filter((o) => (o.x - q.x) ** 2 + (o.y - q.y) ** 2 <= (r * Q) ** 2);
          const t = q.target >= 0 && q.targetKind === 'squad' ? w.squads[q.target] : null;
          const fighting = t && inRangeOfSquad(q, t);
          if (fighting) {
            const friends = near(live.filter((o) => o.side === q.side && !o.routed), 6).reduce((x, o) => x + o.strength, 0);
            const enemy = near(foes, 6).reduce((x, o) => x + o.strength, 0);
            if (friends < 0.5 * enemy && sideStr[q.side] >= 0.7 * sideStr[1 - q.side]) flag(q, 'LONE', ` local ${Math.round(friends)}:${Math.round(enemy)}`);
            if (getCounterMultiplier(q.classId, t.classId, age) < 1 && near(foes, q.stats.sight).some((o) => canSeeSquad(w, q.side, o) && getCounterMultiplier(q.classId, o.classId, age) >= 1)) flag(q, 'BADMATCH', ` on ${t.classId}`);
            if (q.stats.melee && q.strength < 0.3 * q.startStrength) flag(q, 'WOUNDED');
            if (q.classId === 'ranged') { tot[q.side].focusN += 1; targetsShared.set(t.idx, (targetsShared.get(t.idx) || 0) + 1); }
          }
          if (q.classId === 'ranged' && near(foes.filter((o) => o.stats.melee), 1.5).length) flag(q, 'RANGEDMELEE');
          if (q.order.type === 'idle' && q.target < 0 && near(foes, 15).some((o) => canSeeSquad(w, q.side, o))) flag(q, 'IDLE');
        });
        live.forEach((q) => { if (q.classId === 'ranged' && q.target >= 0 && (targetsShared.get(q.target) || 0) > 1 && inRangeOfSquad(q, w.squads[q.target])) tot[q.side].focusShared += 1; });
      }
      const r = toStrategicResult(w);
      if (r.outcome === 'attacker') tot[0].wins += 1; else if (r.outcome === 'defender') tot[1].wins += 1;
      [0, 1].forEach((s) => { tot[s].workersLost += w.squads.filter((q) => q.worker && q.side === s && !q.alive).length; });
      if (VERBOSE) console.log(`  seed ${seed} ${r.outcome} ${r.report.tactical.reason} ${r.report.tactical.durationSec}s`);
    }
    [0, 1].forEach((s) => {
      const t = tot[s];
      console.log(`TRACE ${type} ${age} ${DIFF} ${s ? 'DEF' : 'ATT'} wins=${t.wins}/${N} ${KINDS.map((k) => `${k}=${Math.round(t[k] / N)}s`).join(' ')} focus=${(t.focusShared / Math.max(1, t.focusN)).toFixed(2)} workersLost=${(t.workersLost / N).toFixed(1)} powers=${t.powers.slice(0, 4).join(',') || '-'}`);
      firsts[s].forEach((f) => console.log(`    ${f}`));
    });
  }));
});
