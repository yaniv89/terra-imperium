// .claude/skills/battle-lab/assaultTrace.sim.js
// A commanded city assault the way a phone player fights it (audit H-02, H-03, H-26): the PLAYER
// attacks a city (the battle economy on, the real town from its manifest, its militia; walled at
// FORT > 0, a capital's palace with CAPITAL=1), the AI defends. The player gives ONE order and then
// watches (POLICY):
//   once   every squad attack-moves on the keep at the first tick (All + tap the town)
//   keep   every squad attacks the keep (All + Attack + tap the hall)
//   ai     the AI commands the attacker too (the parity baseline)
// Per seed: outcome, reason, length, base buildings left, the attacker's losses BY CAUSE (losses.js:
// melee, ranged, tower, impact, attrition; plus "unbooked" = start - end - booked, must be 0), the
// squad-seconds the attacker's squads stood with no target, and those of them spent under fire from
// a building (the H-26 idle-beside-towers repro). The last line sums every seed, with Auto's verdict
// (autoBattle.js autoFromInputs) on the same armies.
//   SEEDS=1-8 POLICY=once ATT=infantry,infantry,cavalry,ranged STR_A=588 DEF=infantry,cavalry STR_D=190 \
//   TERRAIN=desert FORT=1 TIER=small CAPITAL=1 AGE=kingdoms \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/assaultTrace
// TRACE=<seed> prints every attacker squad every EVERY ticks for that seed.
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { baseCount } from '../../../src/battle/sim/base';
import { LOSS_CAUSES, lossTotal } from '../../../src/battle/sim/losses';
import { militiaFor } from '../../../src/engine/battleInputs';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { autoFromInputs, AUTO_TUNE } from '../../../src/engine/autoBattle';
import { createRng } from '../../../src/utils/rng';
import { Q, TICK_HZ } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] || d;
const seedsOf = (s) => s.split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
const mk = (p, list, str) => list.split(',').filter(Boolean).map((classId, i) => ({ id: `${p}${i}`, classId, strength: str, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const sum = (units) => units.reduce((x, u) => x + Math.max(0, u.strength), 0);

it('assault trace', () => {
  const POLICY = env('POLICY', 'once'); const FORT = Number(env('FORT', 1)); const AGE = env('AGE', 'kingdoms');
  const TERRAIN = env('TERRAIN', 'desert'); const TRACE = Number(env('TRACE', -1)); const EVERY = Number(env('EVERY', 600));
  const tot = { wins: 0, autoWins: 0, n: 0, lossA: 0, lossD: 0, autoA: 0, autoD: 0, secs: 0, idle: 0, idleFire: 0, by: Object.fromEntries(LOSS_CAUSES.map((k) => [k, 0])), unbooked: 0, startA: 0 };
  seedsOf(env('SEEDS', '1-8')).forEach((seed) => {
    const walled = FORT > 0;
    const cityManifest = buildTownManifest({ cityId: `assault-${seed}`, ageId: AGE, tierId: env('TIER', 'small'), style: env('STYLE', 'europe'), seed, defenseTier: walled ? 1 : -1, capital: env('CAPITAL', '1') === '1' });
    const militia = militiaFor({ ownerId: 'defender', cityId: `assault-${seed}`, housing: manifestHousing(cityManifest) });
    const attackers = mk('a', env('ATT', 'infantry,infantry,cavalry,ranged'), Number(env('STR_A', 588)));
    const defenders = [...mk('d', env('DEF', 'infantry,cavalry'), Number(env('STR_D', 190))), ...militia];
    const reduction = walled ? getDefenseLevelDamageReductionMultiplier(FORT) : 1;
    const inputs = { supply: [1, 1], development: [0.3, 0.3] };
    const base = buildSetupFromArmies({
      regionId: `assault-${seed}`, terrain: TERRAIN, seed, attackerUnits: attackers, defenderUnits: defenders, attackerAgeId: AGE, defenderAgeId: AGE,
      controllers: [POLICY === 'ai' ? 'ai' : 'player', 'ai'], deposits: [], powers: [[], []], battleType: null, city: true,
      fortLevel: FORT, isAttackingFortification: walled, cityManifest, defenseReduction: reduction, economy: true, economyInputs: inputs
    });
    const w = createWorld(commandedSetup(base));
    const keep = w.structures[0];
    const army = () => w.squads.filter((q) => q.side === 0 && q.alive && q.onField && !q.fled && !q.worker && !q.isGeneral);
    let idle = 0; let idleFire = 0;
    const underFire = new Set(); const shots = {}; let garrisonGoneAt = -1; let towerBefore = 0;
    const limit = w.setup.limitTicks;
    for (let i = 0; i <= limit && !w.ended; i++) {
      let orders = [];
      if (i === 0 && POLICY === 'once') orders = [{ side: 0, type: 'attackMove', squads: army().map((q) => q.idx), x: keep.x, y: keep.y }];
      if (i === 0 && POLICY === 'keep') orders = [{ side: 0, type: 'attack', squads: army().map((q) => q.idx), target: { kind: 'structure', index: 0 } }];
      step(w, orders);
      underFire.clear();
      w.events.forEach((e) => { if (e.type === 'towerShot' && e.t === w.tick - 1) { underFire.add(e.to); const k = e.eco != null ? 'eco:' + e.structure : e.structure; shots[k] = (shots[k] || 0) + e.damage; } });
      if (garrisonGoneAt < 0 && !w.squads.some((q) => q.side === 1 && q.alive && !q.fled && !q.worker && !q.isGeneral && !q.original?.auxiliary)) { garrisonGoneAt = w.tick; towerBefore = w.squads.reduce((s, q) => s + (q.side === 0 ? q.lossBy.tower : 0), 0); }
      if (w.tick % TICK_HZ === 0) {
        army().forEach((q) => { if (q.target < 0 && (q.order.type === 'idle')) { idle += 1; if (w.tick - q.lastHitTick < TICK_HZ && underFire.has(q.idx)) idleFire += 1; } });
      }
      if (seed === TRACE && w.tick % EVERY === 0) {
        console.log(`--- tick ${w.tick} base left ${baseCount(w, 1)} keep ${keep.hp}/${keep.maxHp}`);
        w.squads.filter((q) => q.side === 0 && !q.worker && (q.onField || q.fled)).forEach((q) => console.log(`  0:${q.idx}:${q.classId} at ${(q.x / Q).toFixed(1)},${(q.y / Q).toFixed(1)} order=${q.order.type} target=${q.targetKind || '-'}#${q.target} str=${q.strength} mor=${q.morale} lastHit=${q.lastHitTick} lossBy=${JSON.stringify(q.lossBy)}`));
      }
      w.events.length = 0;
    }
    const mine = w.squads.filter((q) => q.side === 0 && !q.worker && !q.original?.auxiliary && !q.isGeneral);
    const by = Object.fromEntries(LOSS_CAUSES.map((k) => [k, mine.reduce((s, q) => s + (q.lossBy?.[k] || 0), 0)]));
    const start = mine.reduce((s, q) => s + q.startStrength, 0); const end = mine.reduce((s, q) => s + q.strength, 0);
    const booked = mine.reduce((s, q) => s + lossTotal(q), 0);
    const theirs = w.squads.filter((q) => q.side === 1 && !q.worker && !q.original?.auxiliary && !q.isGeneral);
    const lossD = theirs.reduce((s, q) => s + q.startStrength - q.strength, 0);
    const ended = w.ended || { outcome: 'none', reason: 'running' };
    const secs = Math.round((ended.tick ?? w.tick) / TICK_HZ);
    const ins = { walled, attackerUnits: attackers, defenderUnits: defenders, hpRatio: 1, economyInputs: inputs, housing: manifestHousing(cityManifest), militia };
    const auto = autoFromInputs({ terrain: TERRAIN, isAttackingFortification: walled, battleType: walled ? 'assault' : 'field', attackerAgeId: AGE, defenderAgeId: AGE, defenderDamageReductionMultiplier: reduction, generals: {} }, ins, 'invasion', createRng(seed * 97), AUTO_TUNE);
    const autoA = sum(attackers) - sum(auto.attackerUnits); const autoD = sum(defenders) - sum(auto.defenderUnits);
    console.log(`SEED ${seed} ${POLICY} ${ended.outcome}/${ended.reason} ${secs}s baseLeft=${baseCount(w, 1)} lostA=${start - end}/${start} lostD=${lossD} by=${JSON.stringify(by)} unbooked=${start - end - booked} shots=${JSON.stringify(shots)} garrisonGone=${garrisonGoneAt < 0 ? 'never' : Math.round(garrisonGoneAt / TICK_HZ) + 's'} towerAfterGarrison=${garrisonGoneAt < 0 ? 0 : by.tower - towerBefore} auxD=${w.squads.filter((q) => q.side === 1 && q.original?.auxiliary).length} idle=${idle}sq·s idleUnderFire=${idleFire}sq·s auto=${auto.outcome} autoLostA=${autoA} autoLostD=${autoD}`);
    tot.n += 1; tot.wins += ended.outcome === 'attacker' ? 1 : 0; tot.autoWins += auto.outcome === 'attacker' ? 1 : 0;
    tot.lossA += start - end; tot.startA += start; tot.lossD += lossD; tot.autoA += autoA; tot.autoD += autoD; tot.secs += secs; tot.idle += idle; tot.idleFire += idleFire; tot.unbooked += start - end - booked;
    LOSS_CAUSES.forEach((k) => { tot.by[k] += by[k]; });
  });
  console.log(`TOTAL ${POLICY} wins=${tot.wins}/${tot.n} autoWins=${tot.autoWins}/${tot.n} lostA=${tot.lossA}/${tot.startA} (${(100 * tot.lossA / Math.max(1, tot.startA)).toFixed(0)}%) autoLostA=${tot.autoA} lostD=${tot.lossD} autoLostD=${tot.autoD} avg=${Math.round(tot.secs / tot.n)}s by=${JSON.stringify(tot.by)} unbooked=${tot.unbooked} idle=${tot.idle} idleUnderFire=${tot.idleFire}`);
});
