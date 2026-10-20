// .claude/skills/battle-lab/sortieTrace.sim.js
// H-04 repro: the PLAYER defends a walled city (fort level FORT, the battle economy on, the real
// town from its manifest), the AI assaults. Once an enemy squad stands near the gate (or at tick
// ORDER_AT) every player squad still on the field is ordered to attack it. Prints a STUCK line for
// each ordered squad that moved less than a tile in CHECK ticks while its target lived, and (unless
// QUIET=1) where each ordered squad is every EVERY ticks.
//   SEEDS=1,2,3 FORT=2 AGE=bronze TICKS=20000 QUIET=1 \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/sortieTrace
// SPREAD=1 scatters the defenders over the town first (moves to random spots inside the ring),
// as a player's squads stand after a while, before the order.
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { militiaFor } from '../../../src/engine/battleInputs';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { Q } from '../../../src/battle/sim/constants';
import { canSeeSquad } from '../../../src/battle/sim/fog';
import { inRangeOfSquad } from '../../../src/battle/sim/combat';

const env = (k, d) => process.env[k] || d;
const mk = (p, list, str = 1000) => list.split(',').filter(Boolean).map((classId, i) => ({ id: `${p}${i}`, classId, strength: str, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const f1 = (v) => (v / Q).toFixed(1);

const runOne = (seed) => {
  const FORT = Number(env('FORT', 2)); const AGE = env('AGE', 'bronze');
  const cityManifest = buildTownManifest({ cityId: `sortie-${seed}`, ageId: AGE, tierId: env('TIER', 'medium'), style: 'europe', seed, defenseTier: 1 });
  const militia = militiaFor({ ownerId: 'defender', cityId: `sortie-${seed}`, housing: manifestHousing(cityManifest) });
  const setup = commandedSetup(buildSetupFromArmies({
    regionId: `sortie-${seed}`, terrain: env('TERRAIN', 'mixed'), seed, attackerUnits: mk('a', env('ATT', 'infantry,infantry,ranged')), defenderUnits: [...mk('d', env('DEF', 'infantry,ranged')), ...militia],
    attackerAgeId: AGE, defenderAgeId: AGE, controllers: ['ai', 'player'], deposits: [], powers: [[], []], battleType: null, city: true,
    fortLevel: FORT, isAttackingFortification: true, cityManifest, defenseReduction: getDefenseLevelDamageReductionMultiplier(FORT),
    economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
  }));
  const w = createWorld(setup);
  const gate = w.structures.find((s) => s.kind === 'gate');
  const keep = w.structures[0];
  console.log(`seed=${seed} gate at ${f1(gate.x)},${f1(gate.y)} keep at ${f1(keep.x)},${f1(keep.y)}`);
  const mine = () => w.squads.filter((q) => q.side === 1 && q.alive && q.onField && !q.worker && !q.fled && !q.isGeneral);
  const TICKS = Number(env('TICKS', 20000)); const EVERY = Number(env('EVERY', 200)); const CHECK = Number(env('CHECK', 300));
  let orderedAt = -1; let ordered = []; let foeIdx = -1; const from = new Map();
  let rs = seed * 7919;
  const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
  for (let i = 0; i < TICKS && !w.ended; i++) {
    let orders = [];
    if (i === 1 && env('SPREAD', '0') === '1') {
      orders = mine().map((q) => { const a = rnd() * Math.PI * 2; const r = (2 + rnd() * 6) * Q; return { side: 1, type: 'move', squads: [q.idx], x: Math.round(keep.x + Math.cos(a) * r), y: Math.round(keep.y + Math.sin(a) * r) }; });
    }
    if (orderedAt < 0) {
      const foe = w.squads.find((q) => q.side === 0 && q.alive && q.onField && !q.worker && (q.x - gate.x) ** 2 + (q.y - gate.y) ** 2 <= (6 * Q) ** 2);
      if (foe || i === Number(env('ORDER_AT', -1))) {
        const t = foe || w.squads.find((q) => q.side === 0 && q.alive && q.onField && !q.worker);
        foeIdx = t.idx; orderedAt = w.tick; ordered = mine().map((q) => q.idx);
        ordered.forEach((j) => from.set(j, { x: w.squads[j].x, y: w.squads[j].y }));
        orders = [{ side: 1, type: 'attack', squads: ordered, target: { kind: 'squad', index: foeIdx } }];
        console.log(`--- ORDER seed=${seed} tick ${w.tick}: ${ordered.length} squads attack ${foeIdx} (${t.classId}) at ${f1(t.x)},${f1(t.y)} gate alive=${gate.alive}`);
      }
    }
    step(w, orders);
    if (orderedAt >= 0 && w.tick - orderedAt === CHECK) {
      const t = w.squads[foeIdx];
      ordered.forEach((j) => {
        const q = w.squads[j]; const f = from.get(j); const moved = Math.sqrt((q.x - f.x) ** 2 + (q.y - f.y) ** 2) / Q;
        const reach = Math.sqrt((q.x - t.x) ** 2 + (q.y - t.y) ** 2) / Q;
        console.log(`${moved < 1 && q.alive && t.alive && reach > 2 ? 'STUCK' : 'OK   '} seed=${seed} 1:${j}:${q.classId} from ${f1(f.x)},${f1(f.y)} now ${f1(q.x)},${f1(q.y)} moved=${moved.toFixed(1)} dist=${reach.toFixed(1)} foe ${t.alive ? 'alive' : 'dead'} order=${q.order.type} target=${q.targetKind}#${q.target} seen=${canSeeSquad(w, 1, t)} inRange=${inRangeOfSquad(q, t)} hiddenUntil=${t.hiddenUntil ?? '-'} noPath=${q.noPath ?? '-'}`);
      });
    }
    if (env('QUIET', '0') !== '1' && orderedAt >= 0 && (w.tick - orderedAt) % EVERY === 0) {
      const t = w.squads[foeIdx];
      console.log(`--- tick ${w.tick} foe ${foeIdx} at ${f1(t.x)},${f1(t.y)} alive=${t.alive} str=${t.strength} gate alive=${gate.alive}`);
      ordered.forEach((j) => { const q = w.squads[j]; const f = from.get(j); console.log(`  1:${j}:${q.classId} at ${f1(q.x)},${f1(q.y)} moved=${(Math.sqrt((q.x - f.x) ** 2 + (q.y - f.y) ** 2) / Q).toFixed(1)} order=${q.order.type} target=${q.targetKind}#${q.target} inside=${q.inside} str=${q.strength}`); });
    }
    w.events.length = 0;
  }
  console.log(`ENDED seed=${seed} ${JSON.stringify(w.ended)}`);
};

it('sortie trace', () => { (env('SEEDS', '') ? env('SEEDS', '').split(',').map(Number) : [Number(env('SEED', 1))]).forEach(runOne); });
