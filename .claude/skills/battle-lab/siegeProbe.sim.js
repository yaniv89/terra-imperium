// .claude/skills/battle-lab/siegeProbe.sim.js
// What decides a city assault (I211, I212): the campaign way (AI against AI, the battle economy on,
// the real city from its manifest with its militia), per seed: the outcome and its reason, when the
// gate, the first ring piece and the keep fell, the defender's base left at the end, how much of
// the attacker's losses came from the city's towers and keep and from towers the workers built, and
// how long the auxiliaries lived (spawn to death, or to the end) and what they dealt.
//   N=12 ATT=infantry,infantry,infantry,cavalry,ranged DEF=infantry,ranged FORT=2 AGE=bronze \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/siegeProbe
// FORT=0 is a town (unwalled). NOROUT=attacker keeps the attacker from routing (Command's edge).
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { baseCount } from '../../../src/battle/sim/base';
import { militiaFor } from '../../../src/engine/battleInputs';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { battleLimitTicks, TICK_HZ } from '../../../src/battle/sim/constants';

const N = Number(process.env.N || 12);
const AGE = process.env.AGE || 'bronze';
const DAGE = process.env.DAGE || AGE;
const TIER = process.env.TIER || 'medium';
const FORT = Number(process.env.FORT ?? 2);
const ATT = (process.env.ATT || 'infantry,infantry,infantry,cavalry,ranged').split(',');
const DEF = (process.env.DEF || 'infantry,ranged').split(',');
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const s1 = (t) => (t < 0 ? '-' : `${Math.round(t / TICK_HZ)}s`);

it('what decides an assault', () => {
  let wins = 0; const reasons = {}; const auxHits = {}; const auxShots = {}; let auxLifeSum = [0, 0]; let auxN = [0, 0]; let auxDealt = [0, 0]; let towerShare = 0; let secs = 0;
  for (let seed = Number(process.env.SEED0 || 1); seed < Number(process.env.SEED0 || 1) + N; seed++) {
    const walled = FORT >= 2;
    const manifest = buildTownManifest({ cityId: `probe-${seed}`, ageId: DAGE, tierId: TIER, style: 'europe', seed, defenseTier: walled ? 1 : -1 });
    const militia = militiaFor({ ownerId: 'defender', cityId: `probe-${seed}`, housing: manifestHousing(manifest) });
    const setup = buildSetupFromArmies({
      regionId: `probe-${seed}`, terrain: process.env.TERRAIN || 'mixed', seed, attackerUnits: mk('a', ATT), defenderUnits: [...mk('d', DEF), ...militia],
      attackerAgeId: AGE, defenderAgeId: DAGE, controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: null, city: true,
      fortLevel: FORT, isAttackingFortification: walled, cityManifest: manifest, defenseReduction: walled ? getDefenseLevelDamageReductionMultiplier(FORT) : 1,
      economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
    });
    if (process.env.NOROUT === 'attacker') setup.sides[0].canRout = false;
    const w = createWorld(setup);
    const limit = battleLimitTicks(setup) + 20;
    const born = new Map(); const died = new Map();
    let gate = -1; let ring = -1; let keep = -1; let towerDmg = 0; let ecoTowerDmg = 0; let attLoss = 0;
    const startStr = w.squads.filter((q) => q.side === 0 && !q.worker).reduce((s, q) => s + q.strength, 0);
    while (!w.ended && w.tick < limit) {
      step(w, []);
      w.events.forEach((e) => {
        if (e.type === 'trained') born.set(e.id, e.t);
        if (e.to != null && born.has(e.to) && !w.squads[e.to].worker && e.damage > 0) { const k = e.type === 'towerShot' ? (e.eco != null ? 'ecoTower' : 'structure') : e.type; const kk = `${w.squads[e.to].side}:${k}`; auxHits[kk] = (auxHits[kk] || 0) + e.damage; auxShots[kk] = (auxShots[kk] || 0) + 1; }
        if (e.type === 'destroyed' && born.has(e.id) && !died.has(e.id)) died.set(e.id, e.t);
        if (e.type === 'towerShot') { if (e.eco != null) ecoTowerDmg += e.damage; else towerDmg += e.damage; }
        if (e.type === 'structureDestroyed' || e.type === 'keepBreached') {
          const s = w.structures.find((x) => x.id === e.structure);
          if (s?.kind === 'gate' && gate < 0) gate = e.t;
          if ((s?.kind === 'wall' || s?.kind === 'gate' || s?.kind === 'tower') && ring < 0) ring = e.t;
          if (e.type === 'keepBreached') keep = e.t;
        }
      });
      w.events.length = 0;
      if (process.env.VERBOSE && w.tick % (TICK_HZ * 20) === 0) {
        const att = w.squads.filter((q) => q.side === 0 && !q.worker && q.alive && !q.fled && q.onField);
        const tgt = {}; att.forEach((q) => { const k = q.targetKind === 'structure' ? `s:${w.structures[q.target]?.kind}` : q.targetKind || 'none'; tgt[k] = (tgt[k] || 0) + 1; });
        const armed = w.structures.filter((s) => s.alive && s.damage > 0).map((s) => `${s.kind}:${s.hp}`).join(' ');
        const base = w.structures.map((s, i) => (i === 0 ? s.kind === 'keep' : s.kind === 'building') && s.alive && !s.loot && !s.passive ? `${s.kind}${i}:${s.hp}` : null).filter(Boolean).join(' ');
        console.log(`  t=${w.tick / TICK_HZ}s att=${att.length} str=${att.reduce((s, q) => s + q.strength, 0)} routed=${att.filter((q) => q.routed || q.retreating).length} tgt=${JSON.stringify(tgt)} armed=[${armed}] base=[${base}] eco=${w.eco.buildings.filter((b) => b.side === 1 && b.alive && b.built && b.proxy == null).map((b) => b.type).join(',')}`);
      }
    }
    const life = [[], []]; const dealt = [0, 0];
    born.forEach((t, id) => { const q = w.squads[id]; if (q.worker) return; life[q.side].push(((died.get(id) ?? w.tick) - t) / TICK_HZ); dealt[q.side] += q.damageDealt; });
    const endStr = w.squads.filter((q) => q.side === 0 && !q.worker && !born.has(q.idx)).reduce((s, q) => s + (q.alive ? q.strength : 0), 0);
    attLoss = startStr - endStr;
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const deadShare = (side) => (life[side].length ? [...born.keys()].filter((id) => w.squads[id].side === side && !w.squads[id].worker && died.has(id)).length / life[side].length : 0);
    if (w.ended?.outcome === 'attacker') wins += 1;
    reasons[w.ended?.reason] = (reasons[w.ended?.reason] || 0) + 1;
    [0, 1].forEach((s) => { auxLifeSum[s] += life[s].reduce((x, y) => x + y, 0); auxN[s] += life[s].length; auxDealt[s] += dealt[s]; });
    towerShare += (towerDmg + ecoTowerDmg) / Math.max(1, attLoss);
    secs += w.tick / TICK_HZ;
    console.log(`PROBE seed=${seed} ${w.ended?.outcome}/${w.ended?.reason} t=${s1(w.tick)} gate=${s1(gate)} ring=${s1(ring)} keep=${s1(keep)} defBase=${baseCount(w, 1)} attBase=${baseCount(w, 0)} aux=${life[0].length}/${life[1].length} life=${avg(life[0]).toFixed(0)}s/${avg(life[1]).toFixed(0)}s dead=${(deadShare(0) * 100).toFixed(0)}%/${(deadShare(1) * 100).toFixed(0)}% auxDealt=${dealt[0]}/${dealt[1]} attLoss=${attLoss} towers=${towerDmg} ecoTowers=${ecoTowerDmg}`);
  }
  console.log(`SUMMARY ${ATT.join('+')} vs ${DEF.join('+')} fort=${FORT} ${AGE}>${DAGE} wins=${wins}/${N} reasons=${JSON.stringify(reasons)} auxLife=${(auxLifeSum[0] / Math.max(1, auxN[0])).toFixed(0)}s/${(auxLifeSum[1] / Math.max(1, auxN[1])).toFixed(0)}s aux=${(auxN[0] / N).toFixed(1)}/${(auxN[1] / N).toFixed(1)} auxDealtPer=${(auxDealt[0] / Math.max(1, auxN[0])).toFixed(0)}/${(auxDealt[1] / Math.max(1, auxN[1])).toFixed(0)} towerShareOfAttLoss=${(towerShare / N).toFixed(2)} battle=${Math.round(secs / N)}s`);
  console.log(`AUXHITS (side:source total/hits avg) ${Object.keys(auxHits).sort().map((k) => `${k}=${auxHits[k]}/${auxShots[k]} avg ${(auxHits[k] / auxShots[k]).toFixed(1)}`).join('  ')}`);
});
