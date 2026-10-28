// .claude/skills/battle-lab/sandboxTrace.sim.js
// The battle sandbox's default battle (`?battleSandbox`: mixed, kingdoms, balanced v balanced, fort 2,
// the economy on, the real sample tile) fought the way the lead's browser check did: All + Attack +
// tap the keep (an attack-move on it) at the start and again every REPEAT seconds. Prints per
// minute both sides' strength, the keep, the base, and what each of the player's squads does.
//   SEED=7 REPEAT=60 [ORDER=attackMove|attack|split (what Attack it sends: battle/input/selection.js buildingAttackOrders)] [FORT=2] npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/sandboxTrace
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { baseCount } from '../../../src/battle/sim/base';
import { tileContextOf } from '../../../src/battle/setup/tileContext';
import { getTiles } from '../../../src/data/geo/tiles';
import { sandboxTileOptions } from '../../../src/components/battle/sandboxTile';
import { getBattlePowers } from '../../../src/engine/invasion';
import { getAvailableClasses } from '../../../src/data/unitClasses';
import { buildingAttackOrders } from '../../../src/battle/input/selection';
import { Q, TICK_HZ } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] ?? d;
const BAL = ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry'];
const SMALL = ['infantry', 'ranged'];
const army = (p, list, age, str, gen = null) => list.filter((c) => getAvailableClasses(age).includes(c))
  .map((classId, i) => ({ id: `${p}${i}`, classId, strength: str, maxStrength: 1000, morale: 100, promotions: classId === 'ranged' && i === 3 ? ['volleyFire'] : [], commanderId: i === 0 ? gen : null, domain: 'land', xp: 0 }));
const GENERALS = {
  g_att: { id: 'g_att', name: 'Your general', personality: 'reckless', martial: 4, shock: 4, fire: 3, maneuver: 3 },
  g_def: { id: 'g_def', name: 'Enemy general', personality: 'cautious', martial: 3, shock: 3, fire: 3, maneuver: 3 }
};

const SEEDS = (process.env.SEEDS || process.env.SEED || '7').split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
it('sandbox trace', () => SEEDS.forEach((SEED) => {
  const AGE = env('AGE', 'kingdoms'); const FORT = Number(env('FORT', 2));
  const REPEAT = Number(env("REPEAT", 60)) * TICK_HZ; const EVERY = Number(env("EVERY", 60)) * TICK_HZ; const ORDER = env('ORDER', 'attackMove'); const VERBOSE = env('VERBOSE', '1') === '1';
  const { tile, state } = sandboxTileOptions(getTiles(), new URLSearchParams());
  const setup = buildSetupFromArmies({
    tileContext: tile != null ? tileContextOf(state, tile) : null, regionId: `sandbox-mixed-${SEED}`, terrain: 'mixed', seed: SEED,
    attackerUnits: army('a', BAL, AGE, 1000, 'g_att'), defenderUnits: army('d', BAL, AGE, 900, 'g_def'), generals: GENERALS,
    powers: [getBattlePowers(null, null, AGE, army('a', BAL, AGE, 1000)), getBattlePowers(null, null, AGE, army('d', BAL, AGE, 900)).filter((p) => p.id !== 'nuclearStrike')],
    regionBuildings: [{ category: 'military', tier: 1, name: 'Barracks' }, { category: 'economy', tier: 1, name: 'Bazaar' }, { category: 'culture', tier: 2, name: 'Temple' }, { category: 'food', tier: 1, name: 'Granary' }, { category: 'industry', tier: 0, name: 'Workshop' }, { category: 'science', tier: 2, name: 'Scriptorium' }],
    reinforcements: [[{ regionId: 'north', name: 'Northern March', edge: 'N', units: army('r', SMALL, AGE, 800) }], [{ regionId: 'east', name: 'Eastern Garrison', edge: 'S', units: army('s', SMALL, AGE, 700) }]],
    intel: { attackerSeesDefender: true }, attackerAgeId: AGE, defenderAgeId: AGE, fortLevel: FORT, isCapital: FORT >= 4,
    infrastructure: 5, deposits: ['iron', 'copper'], controllers: ['player', 'ai'], economy: true
  });
  const w = createWorld(commandedSetup(setup));
  const keep = w.structures[0];
  const str = (side) => w.squads.filter((q) => q.side === side && !q.worker).reduce((s, q) => s + Math.max(0, q.strength), 0);
  const mine = () => w.squads.filter((q) => q.side === 0 && q.alive && q.onField && !q.fled && !q.worker);
  console.log(`structures: ${w.structures.map((s, i) => `${i}:${s.kind}@${(s.x / Q).toFixed(0)},${(s.y / Q).toFixed(0)} hp${s.hp}`).join(' ')}`);
  for (let i = 0; i <= w.setup.limitTicks && !w.ended; i++) {
    const orders = [];
    if (i >= TICK_HZ && (i - TICK_HZ) % REPEAT === 0) {
      const sq = mine().map((q) => q.idx);
      if (ORDER === 'split') { orders.push(...buildingAttackOrders(sq, { kind: 'structure', index: 0 }, keep.x, keep.y).map((o) => ({ side: 0, ...o }))); } else orders.push(ORDER === 'attack' ? { side: 0, type: 'attack', squads: sq, target: { kind: 'structure', index: 0 } } : { side: 0, type: 'attackMove', squads: sq, x: keep.x, y: keep.y });
    }
    step(w, orders);
    if (w.tick % EVERY === 0 || w.ended) {
      console.log(`--- ${w.tick / TICK_HZ}s you ${str(0)} them ${str(1)} keep ${keep.hp}/${keep.maxHp} base ${baseCount(w, 1)} myBase ${baseCount(w, 0)} squads ${w.squads.filter((q) => q.side === 0 && q.alive && !q.worker).length}/${w.squads.filter((q) => q.side === 1 && q.alive && !q.worker).length}`);
      if (VERBOSE && env('ENEMY')) w.squads.filter((q) => q.side === 1 && !q.worker && q.alive && q.onField).forEach((q) => console.log(`  E${q.idx}:${q.classId}${q.original?.auxiliary ? '(aux)' : ''}${q.inside >= 0 ? '(in' + q.inside + ')' : ''} @${(q.x / Q).toFixed(0)},${(q.y / Q).toFixed(0)} ${q.order.type} tgt=${q.targetKind || '-'}#${q.target} str=${q.strength}/${q.startStrength} mor=${q.morale}`));
      if (VERBOSE) w.squads.filter((q) => q.side === 0 && !q.worker && q.alive && q.onField).forEach((q) => console.log(`  ${q.idx}:${q.classId}${q.original?.auxiliary ? '(aux)' : ''} @${(q.x / Q).toFixed(0)},${(q.y / Q).toFixed(0)} ${q.order.type} tgt=${q.targetKind || '-'}#${q.target} str=${q.strength} mor=${q.morale} loss=${JSON.stringify(q.lossBy)}`));
    }
    w.events.length = 0;
  }
  const by = {}; w.squads.filter((q) => q.side === 0 && !q.worker).forEach((q) => Object.entries(q.lossBy || {}).forEach(([k, v]) => { by[k] = (by[k] || 0) + v; }));
  const regs = (side) => w.squads.filter((q) => q.side === side && !q.worker && !q.original?.auxiliary && !q.isGeneral);
  const lost = (side) => regs(side).reduce((a, q) => a + q.startStrength - Math.max(0, q.strength), 0);
  console.log(`SUMMARY seed=${SEED} order=${ORDER} end=${w.ended?.outcome}/${w.ended?.reason} at ${Math.round(w.tick / TICK_HZ)}s keep=${keep.hp} youLost=${lost(0)}/${regs(0).reduce((a, q) => a + q.startStrength, 0)} theyLost=${lost(1)}/${regs(1).reduce((a, q) => a + q.startStrength, 0)} byCause=${JSON.stringify(by)}`);
  console.log(`END tick ${w.tick} `);
}));
