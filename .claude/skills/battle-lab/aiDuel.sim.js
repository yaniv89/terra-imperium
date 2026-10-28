// .claude/skills/battle-lab/aiDuel.sim.js
// Old AI against new AI (the battle-ai-tactics lane): the same battle fought three ways per seed,
// old vs old (the baseline), new attacker vs old defender, old attacker vs new defender. The new AI
// is this checkout's tacticalAI.js; the old one is a copy made by aiDuel-prep.mjs (OLD=<its dir>).
// Both sides think from outside step() the same way, so neither gets a fog or order-order edge.
//   node .claude/skills/battle-lab/aiDuel-prep.mjs <baseRef> <dir>
//   OLD=<dir> N=20 TYPES=field,assault,naval AGES=bronze,classical,kingdoms ECO=1 DIFF=prince \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/aiDuel
// Per row: attacker wins in each pairing, the exchange (attacker losses / defender losses) and the
// strength left. The new AI is better as attacker when NA>OO, as defender when ON<OO.
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { toStrategicResult } from '../../../src/battle/sim/result';
import { battleLimitTicks } from '../../../src/battle/sim/constants';
import { thinkAI as newThink, AI_FEATURES } from '../../../src/battle/sim/tacticalAI';
import { ECO_FEATURES } from '../../../src/battle/sim/economyAI';
import { buildTownManifest } from '../../../src/data/townLayout';
import { militiaFor } from '../../../src/engine/battleInputs';
import { manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { getAvailableClasses } from '../../../src/data/unitClasses';

const N = Number(process.env.N || 20);
const TYPES = (process.env.TYPES || 'field,assault,naval').split(',');
const AGES = (process.env.AGES || 'bronze,classical,kingdoms').split(',');
const ECO = process.env.ECO !== '0';
const DIFF = process.env.DIFF || 'prince';
const TERRAIN = process.env.TERRAIN || 'mixed';
const SEED0 = Number(process.env.SEED0 || 1);
const TRACE = Number(process.env.TRACE || 0); // ticks between squad lines (one seed: N=1 SEED0=s)
// FEAT_OFF=focus,cavalry,...: the new AI without those behaviours (tacticalAI.js AI_FEATURES).
(process.env.FEAT_OFF || '').split(',').filter(Boolean).forEach((k) => { if (k in ECO_FEATURES) ECO_FEATURES[k] = false; else AI_FEATURES[k] = false; });
const LAND = [
  [['infantry', 'infantry', 'cavalry', 'ranged', 'ranged'], ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged']],
  [['infantry', 'cavalry', 'cavalry', 'ranged'], ['infantry', 'infantry', 'ranged', 'ranged']]
].filter((_, i) => !process.env.MATCH || process.env.MATCH.split(',').map(Number).includes(i));
const SEA = [[['warship', 'warship', 'warship', 'raider'], ['warship', 'warship', 'raider', 'raider']]];
const ofAge = (cls, ageId) => cls.map((c) => (getAvailableClasses(ageId).includes(c) ? c : 'infantry'));
const mk = (p, cls, sea) => cls.map((c, i) => ({ id: `${p}${i}`, classId: sea ? 'naval' : c, ...(sea ? { navalLine: c, domain: 'naval' } : { domain: 'land' }), strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null }));
const sum = (units) => units.reduce((x, u) => x + Math.max(0, u.strength), 0);

it('old AI against new AI', async () => {
  if (!process.env.OLD) throw new Error('OLD=<dir from aiDuel-prep.mjs> is required');
  const { thinkAI: oldThink } = await import(/* @vite-ignore */ `${process.env.OLD}/tacticalAI.js`);
  const fight = (setup, thinkA, thinkD) => {
    const w = createWorld({ ...setup, controllers: ['player', 'player'], difficultyId: DIFF });
    const limit = battleLimitTicks(w.setup) + 20;
    while (!w.ended && w.tick < limit) {
      const orders = [];
      thinkA(w, 0, orders); thinkD(w, 1, orders);
      step(w, orders);
      w.events.length = 0;
      if (TRACE && w.tick % TRACE === 0) console.log(`  t=${w.tick / 20}s ${w.squads.filter((q) => q.alive && q.onField && !q.fled && !q.worker && !q.isGeneral).map((q) => `${q.side}#${q.idx}${q.classId[0]}${Math.round(q.strength / 10)}${q.routed ? 'R' : ''}:${q.order.type.slice(0, 4)}@${q.x >> 8},${q.y >> 8}`).join(' ')}`);
    }
    return toStrategicResult(w);
  };
  const rows = [];
  TYPES.forEach((type) => (type === 'naval' ? SEA : LAND).forEach(([att, def]) => AGES.forEach((age) => {
    const acc = { OO: { w: 0, la: 0, ld: 0, sec: 0 }, NO: { w: 0, la: 0, ld: 0, sec: 0 }, ON: { w: 0, la: 0, ld: 0, sec: 0 } };
    const t0 = Date.now();
    for (let seed = SEED0; seed < SEED0 + N; seed++) {
      const sea = type === 'naval'; const city = type === 'assault' || type === 'town';
      const manifest = city ? buildTownManifest({ cityId: `duel-${seed}`, ageId: age, tierId: 'medium', style: 'europe', seed, defenseTier: type === 'assault' ? 1 : -1 }) : null;
      const militia = city ? militiaFor({ ownerId: 'defender', cityId: `duel-${seed}`, housing: manifestHousing(manifest) }) : [];
      const A = mk('a', sea ? att : ofAge(att, age), sea); const D = [...mk('d', sea ? def : ofAge(def, age), sea), ...militia];
      const setup = buildSetupFromArmies({
        regionId: `duel-${seed}`, terrain: sea ? 'sea' : TERRAIN, seed, attackerUnits: A, defenderUnits: D, attackerAgeId: age, defenderAgeId: age,
        deposits: [], powers: [[{ id: 'rallyCry' }], [{ id: 'rallyCry' }]], battleType: sea ? 'naval' : city ? null : 'field', city,
        ...(city ? { fortLevel: type === 'assault' ? 2 : 0, isAttackingFortification: type === 'assault', cityManifest: manifest, defenseReduction: type === 'assault' ? getDefenseLevelDamageReductionMultiplier(2) : 1 } : {}),
        economy: ECO && !sea, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
      });
      [['OO', oldThink, oldThink], ['NO', newThink, oldThink], ['ON', oldThink, newThink]].forEach(([k, ta, td]) => {
        if (TRACE) console.log(`-- ${k} seed ${seed}`);
        const r = fight(setup, ta, td);
        if (TRACE) console.log(`   ${r.outcome} ${r.report.tactical.reason} ${r.report.tactical.durationSec}s`);
        const a = acc[k];
        if (r.outcome === 'attacker') a.w += 1;
        a.la += sum(A) - sum(r.attackerUnits); a.ld += sum(D) - sum(r.defenderUnits); a.sec += r.report.tactical.durationSec;
      });
    }
    const f = (k) => { const a = acc[k]; return `${k}=${a.w}/${N} x${(a.la / Math.max(1, a.ld)).toFixed(2)} ${Math.round(a.sec / N)}s`; };
    const row = `DUEL${process.env.FEAT_OFF ? ` off=${process.env.FEAT_OFF}` : ''} ${type} ${age} ${DIFF} ${att.join('+')} vs ${def.join('+')} ${f('OO')} | ${f('NO')} | ${f('ON')} ms=${Date.now() - t0}`;
    rows.push(row); console.log(row);
  })));
});
