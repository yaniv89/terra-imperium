// .claude/skills/battle-lab/wallTrace.sim.js
// Walls must hold: an assault on a walled city (the campaign way, AI against AI, the battle economy
// on) and a count, every tick, of the attacker's ground squads standing inside the wall ring while
// the ring is still whole (no wall segment fallen, the gate standing). It must be zero.
//   N=8 AGE=bronze TIER=medium npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/wallTrace
// ORDER=keep: every attacker squad is ordered to attack-move on the keep at tick 1 (as the player
// would), instead of the AI's own plan. VERBOSE=1 prints each intrusion.
import { it, expect } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { militiaFor } from '../../../src/engine/battleInputs';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { CITY_TILES_PER_UNIT } from '../../../src/battle/setup/cityBattle';
import { battleLimitTicks, Q } from '../../../src/battle/sim/constants';

const N = Number(process.env.N || 8);
const AGE = process.env.AGE || 'bronze';
const TIER = process.env.TIER || 'medium';
const ATT = (process.env.ATT || 'infantry,infantry,infantry,cavalry,ranged,siege').split(',');
const DEF = (process.env.DEF || 'infantry,ranged').split(',');
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

it('no attacker inside an unbroken wall ring', () => {
  let total = 0;
  for (let seed = Number(process.env.SEED0 || 1); seed < Number(process.env.SEED0 || 1) + N; seed++) {
    const manifest = buildTownManifest({ cityId: `wall-${seed}`, ageId: AGE, tierId: TIER, style: 'europe', seed, defenseTier: 1 });
    const militia = militiaFor({ ownerId: 'defender', cityId: `wall-${seed}`, housing: manifestHousing(manifest) });
    const setup = buildSetupFromArmies({
      regionId: `wall-${seed}`, terrain: process.env.TERRAIN || 'plains', seed, attackerUnits: mk('a', ATT), defenderUnits: [...mk('d', DEF), ...militia],
      attackerAgeId: AGE, defenderAgeId: AGE, controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: null, city: true,
      fortLevel: 2, isAttackingFortification: true, cityManifest: manifest, defenseReduction: getDefenseLevelDamageReductionMultiplier(2),
      economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
    });
    const w = createWorld(setup);
    const ring = manifest.structures.filter((s) => s.kind === 'wall' || s.kind === 'gate');
    const ringR = ring.reduce((m, s) => Math.max(m, Math.hypot(s.x, s.z)), 0) * CITY_TILES_PER_UNIT;
    const rIn = (ringR - 1.5) * Q; // well inside the band
    const kx = (w.map.keep.x + 0.5) * Q; const ky = (w.map.keep.y + 0.5) * Q;
    const segs = w.structures.filter((s) => s.kind === 'wall' || s.kind === 'gate' || (s.kind === 'tower' && s.footprint?.length)); // a ring tower that falls opens a gap too
    const wallTiles = segs.reduce((n, s) => n + (s.footprint?.length || 0), 0);
    let breachTick = -1; let inside = 0; let firstIn = -1; const who = new Set();
    const limit = battleLimitTicks(setup) + 20;
    const keepOrder = process.env.ORDER === 'keep';
    while (!w.ended && w.tick < limit) {
      const orders = keepOrder && w.tick === 1 ? w.squads.filter((q) => q.side === 0 && !q.worker).map((q) => ({ type: 'attackMove', side: 0, squads: [q.idx], x: kx, y: ky })) : [];
      step(w, orders);
      w.events.length = 0;
      if (breachTick < 0 && segs.some((s) => !s.alive)) breachTick = w.tick;
      if (breachTick >= 0) continue;
      w.squads.forEach((q) => {
        if (q.side !== 0 || !q.alive || !q.onField || q.stats.flying) return;
        const dx = q.x - kx; const dy = q.y - ky;
        if (dx * dx + dy * dy < rIn * rIn) {
          inside += 1; who.add(q.idx); if (firstIn < 0) firstIn = w.tick;
          if (process.env.VERBOSE && inside < 20) console.log(`  t=${w.tick} ${q.idx} ${q.classId} w=${!!q.worker} ord=${q.order?.type} at ${(q.x / Q).toFixed(1)},${(q.y / Q).toFixed(1)} keep ${w.map.keep.x},${w.map.keep.y} r=${(Math.sqrt(dx * dx + dy * dy) / Q).toFixed(1)}/${ringR.toFixed(1)}`);
        }
      });
    }
    const fallen = segs.filter((s) => !s.alive).map((s) => s.kind).join(',');
    console.log(`WALL seed=${seed} ${AGE} ${TIER} ringR=${ringR.toFixed(1)} segs=${segs.length} wallTiles=${wallTiles} breachTick=${breachTick} fallen=${fallen || '-'} insideSquadTicks=${inside} squads=${who.size} firstIn=${firstIn} outcome=${w.ended?.outcome} reason=${w.ended?.reason} t=${w.tick}`);
    total += inside;
  }
  console.log(`TOTAL insideSquadTicks=${total}`);
  if (process.env.STRICT) expect(total).toBe(0);
});
