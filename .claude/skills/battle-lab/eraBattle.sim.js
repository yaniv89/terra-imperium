// .claude/skills/battle-lab/eraBattle.sim.js
// The playtester's commanded battle from an era save (scripts/ai/era-saves/): the player's army attacks
// TARGET (a city name) through BEGIN_TACTICAL_BATTLE, the screen's own setup (buildCommandedSetup),
// then the sim runs with the playtest's orders (POLICY):
//   keep   every squad gets the "Attack it" order on the enemy keep at the first tick (buildingAttackOrders, as the screen sends it)
//   idle   no order at all
// Prints the macro army (unit types and strength) next to the squads of the battle, and per seed the
// outcome, reason, length and the player's losses.
//   AGE=gunpowder TARGET=Zafar SEEDS=1-4 POLICY=keep npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/eraBattle
import { it } from 'vitest';
import { readEraSave } from '../../../scripts/ai/build-era-saves.mjs';
import { migrateSave, CURRENT_SAVE_VERSION } from '../../../src/engine/saveMigrations.js';
import { gameReducer } from '../../../src/engine/gameReducer.js';
import { ActionTypes } from '../../../src/data/types.js';
import { syncWorldRegistry } from '../../../src/engine/world/registry.js';
import { buildCommandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { toStrategicResult } from '../../../src/battle/sim/result';
import { buildingAttackOrders } from '../../../src/battle/input/selection';
import { TICK_HZ, battleLimitTicks } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] || d;
const seedsOf = (s) => s.split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });

export const eraState = (age) => {
  const { state } = readEraSave(age);
  const m = migrateSave({ version: CURRENT_SAVE_VERSION, state });
  return syncWorldRegistry(gameReducer(m.state, { type: ActionTypes.LOAD_GAME, payload: m.state }));
};

/** The first of the player's stacks that may attack the city named `name`: the state with its pendingBattle. */
export const beginAttack = (s, name) => {
  const target = Object.values(s.regions).find((c) => c.name === name);
  if (!target) throw new Error(`no city ${name}`);
  const froms = [...new Set(Object.values(s.units).filter((u) => u.ownerId === s.playerNationId && u.domain !== 'naval').map((u) => u.regionId).filter(Boolean))];
  for (const fromRegionId of froms) {
    const n = gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId, targetRegionId: target.id } });
    if (n.pendingBattle) return n;
  }
  throw new Error(`no stack of ${s.playerNationId} can attack ${name} (from ${froms.join(',')})`);
};

it('era battle', () => {
  const s = beginAttack(eraState(env('AGE', 'gunpowder')), env('TARGET', 'Zafar'));
  const pb = s.pendingBattle;
  const army = pb.attackerUnitIds.map((id) => s.units[id]);
  console.log('macro army:', army.map((u) => `${u.typeId || u.classId}(${u.classId}) ${Math.round(u.strength)} age ${u.ageId || u.age || '?'}`).join(' | '));
  console.log('reinforcements:', JSON.stringify({ att: pb.attackerReinforcements?.length, def: pb.defenderReinforcements?.map((r) => r.unitIds?.length ?? r) }));
  const setup0 = buildCommandedSetup(s, pb);
  setup0.sides.forEach((side, i) => console.log(`side ${i} (${setup0.controllers[i]}):`, side.units.map((u) => `${u.classId}${u.typeId ? '/' + u.typeId : ''} ${u.strength}`).join(' | ')));
  const POLICY = env('POLICY', 'keep');
  seedsOf(env('SEEDS', '1')).forEach((seed) => {
    const setup = { ...setup0, seed };
    const w = createWorld(setup);
    const me = setup.controllers.indexOf('player');
    const limit = battleLimitTicks(setup);
    const mine = () => w.squads.filter((q) => q.side === me && q.classId !== 'worker');
    const startMen = mine().reduce((a, q) => a + q.strength, 0);
    let orders = [];
    if (POLICY === 'keep') { const k = w.structures[0]; orders = buildingAttackOrders(mine().map((q) => q.id), { kind: 'structure', index: 0 }, k?.x, k?.y); }
    let goneAt = null;
    while (!w.ended && w.tick < limit) {
      step(w, w.tick === 0 ? orders.map((o, k) => ({ ...o, tick: 0, seq: k })) : []);
      if (goneAt == null && !mine().some((q) => q.alive && !q.fled)) goneAt = w.tick;
    }
    const r = toStrategicResult(w);
    console.log(`seed ${seed}: ${r.outcome} ${r.reason || ''} at ${Math.round(w.tick / TICK_HZ)} s (limit ${limit / TICK_HZ} s); army gone at ${goneAt == null ? '-' : Math.round(goneAt / TICK_HZ) + ' s'}; start ${startMen}`);
  });
});
