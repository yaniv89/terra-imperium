// .claude/skills/battle-lab/squadTrace.sim.js
// Headless tactical-battle repro: build a battle, give the player side one order, and print what
// every squad is doing (position, order, target, in reach?, strength, morale) every EVERY ticks,
// then a per-squad tally of time spent in each state and damage dealt. This is how "units ignore
// orders" / "only archers fight" bugs get found: the trace shows exactly which tick an order drops.
//   ATT=infantry,infantry,cavalry,ranged DEF=infantry,infantry,ranged AGE=bronze TERRAIN=plains \
//   ORDER=attack TICKS=1400 EVERY=100 SEED=42 \
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/squadTrace
// Also AGE (bronze..modern), FORT (keep fort level), INTEL (1/0: attacker starts seeing the defender).
// ORDER: attack (all player squads at the first defender) | attackStructure (all player squads at
// the structure STRUCT, default 0 = the keep; the trace prints the tick it falls and what every
// attacker does afterwards: the "idle after the target falls" repro) | attackMove (to 12 tiles before
// the keep) | move (to 19 tiles before the keep) | none. Controllers: player vs ai.
// ECO=1 builds the setup with the battle economy (as campaign battles do: workers, camp, buildings);
// ECO_SUPPLY / ECO_DEV (0..1, default 1 and 0.3) are its campaign inputs. The trace then also
// prints an economy tally (workers, buildings, structures down).
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { inRangeOfSquad, inRangeOfStructure, structureTarget } from '../../../src/battle/sim/combat';
import { Q } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] || d;
const mk = (p, list) => list.split(',').map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

const ECO = env('ECO', '0') === '1';

it('squad trace', () => {
  const setup = buildSetupFromArmies({
    regionId: env('REGION', 'battle-lab'), terrain: env('TERRAIN', 'plains'), seed: Number(env('SEED', 42)),
    attackerUnits: mk('a', env('ATT', 'infantry,infantry,cavalry,ranged')), defenderUnits: mk('d', env('DEF', 'infantry,infantry,ranged')),
    controllers: ['player', 'ai'], attackerAgeId: env('AGE', 'bronze'), defenderAgeId: env('AGE', 'bronze'), fortLevel: Number(env('FORT', 0)), intel: { attackerSeesDefender: env('INTEL', '1') === '1' },
    ...(ECO ? { economy: true, economyInputs: { supply: [Number(env('ECO_SUPPLY', 1)), Number(env('ECO_SUPPLY', 1))], development: [Number(env('ECO_DEV', 0.3)), Number(env('ECO_DEV', 0.3))] } } : {})
  });
  const w = createWorld(setup);
  const mine = w.squads.filter((q) => q.side === 0 && q.onField && !q.worker).map((q) => q.idx);
  const keep = w.structures[0];
  const foe = w.squads.find((q) => q.side === 1 && q.onField);
  const order = env('ORDER', 'attack');
  const structIdx = Number(env('STRUCT', 0));
  const structure = w.structures[structIdx];
  if (order === 'attackStructure' && !structure) throw new Error(`no structure ${structIdx}: the setup has ${w.structures.length} (set FORT or a TERRAIN with a keep)`);
  const first = order === 'attackStructure' ? [{ side: 0, type: 'attack', squads: mine, target: { kind: 'structure', index: structIdx } }]
    : order === 'attack' ? [{ side: 0, type: 'attack', squads: mine, target: { kind: 'squad', index: foe.idx } }]
    : order === 'attackMove' ? [{ side: 0, type: 'attackMove', squads: mine, x: keep.x - 12 * Q, y: keep.y }]
      : order === 'move' ? [{ side: 0, type: 'move', squads: mine, x: keep.x - 19 * Q, y: keep.y }] : [];
  const TICKS = Number(env('TICKS', 1400)); const EVERY = Number(env('EVERY', 100));
  const tally = {};
  let fellAt = -1;
  const line = (q) => {
    const t = q.target >= 0 && q.targetKind === 'squad' ? w.squads[q.target] : null;
    const st = q.alive && (q.targetKind === 'structure' || q.targetKind === 'eco') ? structureTarget(w, q) : null;
    const state = st ? (!st.alive ? 'structure-down' : inRangeOfStructure(q, st) ? 'inReachStructure' : `${q.order.type}-closingStructure`) : !q.alive ? 'dead' : q.fled ? 'fled' : q.routed ? 'routed' : !t ? `${q.order.type}-noTarget` : inRangeOfSquad(q, t) ? 'inReach' : `${q.order.type}-closing${t.routed ? '(routed)' : ''}`;
    return { state, text: `${q.side}:${q.idx}:${q.classId} at ${(q.x / Q).toFixed(1)},${(q.y / Q).toFixed(1)} order=${q.order.type} target=${q.targetKind || '-'}#${q.target} ${state} str=${q.strength} mor=${q.morale}` };
  };
  for (let i = 0; i < TICKS && !w.ended; i++) {
    step(w, i === 0 ? first : []);
    w.squads.forEach((q) => { if (!q.onField && !q.fled) return; const { state } = line(q); const k = `${q.side}:${q.idx}:${q.classId}`; (tally[k] ||= {})[state] = (tally[k][state] || 0) + 1; });
    if (order === 'attackStructure' && fellAt < 0 && !structure.alive) {
      fellAt = w.tick; console.log(`--- structure ${structIdx} (${structure.kind}) FELL at tick ${w.tick}; attackers now:`);
      mine.map((m) => w.squads[m]).filter((q) => q.alive).forEach((q) => console.log('  ' + line(q).text));
    }
    if (i % EVERY === 0) { console.log(`--- tick ${w.tick}`); w.squads.filter((q) => q.onField || q.fled).forEach((q) => console.log('  ' + line(q).text)); }
    w.events.length = 0;
  }
  if (order === 'attackStructure') {
    const idle = mine.map((m) => w.squads[m]).filter((q) => q.alive && !q.fled && q.target < 0);
    console.log(`STRUCTURE ${structIdx} ${structure.kind} alive=${structure.alive} fellAt=${fellAt} attackersWithoutTarget=${idle.length}`);
  }
  if (ECO && w.eco) {
    const b = w.eco.buildings || [];
    console.log(`ECO workers=${w.squads.filter((q) => q.worker && q.alive).length} buildings=${b.length} alive=${b.filter((x) => x.alive).length} structuresDown=${w.structures.filter((x) => !x.alive).length}/${w.structures.length}`);
  }
  console.log(`ENDED ${JSON.stringify(w.ended)}`);
  w.squads.forEach((q) => console.log(`TALLY ${q.side}:${q.idx}:${q.classId} dealt=${q.damageDealt} str=${q.strength} ${JSON.stringify(tally[`${q.side}:${q.idx}:${q.classId}`] || {})}`));
});
