// .claude/skills/battle-lab/parityEco.sim.js
// Campaign parity (master plan 6.1, phase R2): the real-time battle WITH the battle economy (as
// every campaign battle is fought: workers, three resources, houses, training) against the honest
// auto-resolve (src/engine/autoBattle.js autoFromInputs) fed the same armies, the same walls, the
// same city (its manifest, houses and militia) and the same stockpile inputs. AI against AI, per
// age pair, N seeds. Prints, per matchup: the casualty exchange (attacker losses / defender losses)
// tactical vs auto and their ratio (the guardrail: tactical within [auto / 2, auto x 3.5]), the
// attacker's wins both ways, and the auxiliaries each side trained in the real-time battle.
//   N=32 TYPES=field,assault AGES=bronze:bronze,classical:classical \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parityEco
// TYPES: field, assault (a walled city, fort level 2), town (an unwalled city). TIER=small|medium|big
// sets the city. MATCH=0,1,2 picks the matchups.
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { runHeadless } from '../../../src/battle/sim/headless';
import { autoFromInputs, autoCityDamage } from '../../../src/engine/autoBattle';
import { militiaFor } from '../../../src/engine/battleInputs';
import { createRng } from '../../../src/utils/rng';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';

const N = Number(process.env.N || 32);
const TIER = process.env.TIER || 'medium';
const TYPES = (process.env.TYPES || 'field,assault').split(',');
const AGE_PAIRS = (process.env.AGES || 'bronze:bronze,classical:classical,kingdoms:kingdoms,gunpowder:gunpowder,modern:modern').split(',').map((p) => p.split(':'));
const MATCHUPS = [
  [['infantry', 'infantry', 'ranged'], ['infantry', 'infantry', 'ranged']],
  [['infantry', 'infantry', 'infantry', 'cavalry', 'ranged'], ['infantry', 'ranged']],
  [['infantry', 'infantry', 'cavalry', 'ranged', 'siege'], ['infantry', 'infantry', 'ranged']]
].filter((_, i) => !process.env.MATCH || process.env.MATCH.split(',').map(Number).includes(i));
const FORT = 2;
const TERRAIN = process.env.TERRAIN || 'mixed';

const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const sum = (units) => units.reduce((x, u) => x + Math.max(0, u.strength), 0);

it('parity with the battle economy', () => {
  const rows = [];
  TYPES.forEach((battleType) => MATCHUPS.forEach(([att, def]) => AGE_PAIRS.forEach(([ageA, ageD]) => {
    let tA = 0; let tD = 0; let aA = 0; let aD = 0; let wins = 0; let autoWins = 0; let trainedA = 0; let trainedD = 0; let secs = 0; let housesHit = 0; let housesAuto = 0; const kinds = {};
    const t0 = Date.now();
    for (let seed = 1; seed <= N; seed++) {
      const assault = battleType === 'assault' || battleType === 'town';
      const walled = battleType === 'assault';
      const cityManifest = assault ? buildTownManifest({ cityId: `parity-${seed}`, ageId: ageD, tierId: TIER, style: 'europe', seed, defenseTier: walled ? 1 : -1 }) : null;
      const militia = assault ? militiaFor({ ownerId: 'defender', cityId: `parity-${seed}`, housing: manifestHousing(cityManifest) }) : [];
      const attackers = mk('a', att);
      const defenders = [...mk('d', def), ...militia];
      const reduction = walled ? getDefenseLevelDamageReductionMultiplier(FORT) : 1;
      const { result } = runHeadless(buildSetupFromArmies({
        regionId: `parity-${seed}`, terrain: TERRAIN, seed, attackerUnits: attackers, defenderUnits: defenders, attackerAgeId: ageA, defenderAgeId: ageD,
        controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: assault ? null : 'field', city: assault,
        ...(assault ? { fortLevel: walled ? FORT : 0, isAttackingFortification: walled, cityManifest, defenseReduction: reduction } : {}),
        economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
      }));
      tA += sum(attackers) - sum(result.attackerUnits); tD += sum(defenders) - sum(result.defenderUnits);
      if (result.outcome === 'attacker') wins += 1;
      const eco = result.report.tactical.economy;
      if (eco) { trainedA += Object.values(eco[0].trained || {}).reduce((x, n) => x + n, 0); trainedD += Object.values(eco[1].trained || {}).reduce((x, n) => x + n, 0); }
      secs += result.report.tactical.durationSec;
      if (assault) {
        const houses = cityManifest.structures.filter((x) => x.kind === 'house').map((x) => x.id);
        const cd = result.report.tactical.cityDamage || { destroyed: [] };
        housesHit += cd.destroyed.filter((id) => houses.includes(id)).length / Math.max(1, houses.length);
        const kindOf = (id) => cityManifest.structures.find((x) => x.id === id)?.kind || id.replace(/-.*$/, '');
        cd.destroyed.forEach((id) => { kinds[`x:${kindOf(id)}`] = (kinds[`x:${kindOf(id)}`] || 0) + 1 / N; });
        (cd.damaged || []).forEach((id) => { kinds[`d:${kindOf(id)}`] = (kinds[`d:${kindOf(id)}`] || 0) + 1 / N; });
      }
      const ins = { walled, attackerUnits: attackers, defenderUnits: defenders, hpRatio: 1, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }, housing: assault ? manifestHousing(cityManifest) : 0, militia };
      const auto = autoFromInputs({ terrain: TERRAIN, isAttackingFortification: walled, battleType: walled ? 'assault' : 'field', attackerAgeId: ageA, defenderAgeId: ageD, defenderDamageReductionMultiplier: reduction, generals: {} }, ins, assault ? 'invasion' : 'field', createRng(seed * 97));
      aA += sum(attackers) - sum(auto.attackerUnits); aD += sum(defenders) - sum(auto.defenderUnits);
      if (auto.outcome === 'attacker') autoWins += 1;
      if (assault) {
        const houses = cityManifest.structures.filter((x) => x.kind === 'house').map((x) => x.id);
        const ad = autoCityDamage(cityManifest, auto, (sum(defenders) - sum(auto.defenderUnits)) / sum(defenders), createRng(seed * 31));
        housesAuto += ad.destroyed.filter((id) => houses.includes(id)).length / Math.max(1, houses.length);
      }
    }
    const tactical = tA / Math.max(1, tD); const auto = aA / Math.max(1, aD);
    const ratio = tactical / Math.max(0.001, auto);
    const row = `PARITY ${battleType} ${ageA}>${ageD} ${att.join('+')} vs ${def.join('+')} seeds=${N} terrain=${TERRAIN} tactical=${tactical.toFixed(3)} auto=${auto.toFixed(3)} ratio=${ratio.toFixed(2)}x ${ratio >= 0.5 && ratio <= 3.5 ? 'IN' : 'OUT'} wins=${wins}/${N} autoWins=${autoWins}/${N} trained=${(trainedA / N).toFixed(1)}/${(trainedD / N).toFixed(1)} battle=${Math.round(secs / N)}s${battleType !== 'field' ? ` houses=${(housesHit / N).toFixed(2)}/${(housesAuto / N).toFixed(2)}` : ''} ms=${Date.now() - t0}${Object.keys(kinds).length ? ` dmg=${Object.entries(kinds).map(([k, v]) => `${k}:${v.toFixed(1)}`).join(',')}` : ''}`;
    rows.push(row);
    console.log(row);
  })));
  console.log(`IN ${rows.filter((r) => r.includes(' IN ')).length} of ${rows.length}`);
});
