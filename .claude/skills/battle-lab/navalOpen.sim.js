// .claude/skills/battle-lab/navalOpen.sim.js
// The sandbox's sea battle (BattleSandbox.jsx `&sea`: 5 ships against 4) with you idle: the gap
// between the fleets at the start and when your first ship is hit and lost
// (playtest 40736779836 step 47: "a destroyer was lost before any order").
//   AGES=classical,information SEEDS=1,2,3 [EVERY=40] [TICKS=1200] \
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/navalOpen
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';

const env = (k, d) => process.env[k] || d;
const Q = 256;
const FLEETS = { attacker: ['warship', 'warship', 'warship', 'raider', 'transport'], defender: ['warship', 'warship', 'raider', 'transport'] };
const fleet = (p, side, strength) => FLEETS[side].map((navalLine, i) => ({ id: `${p}${i}`, classId: 'naval', navalLine, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'naval', xp: 0 }));

it('naval opening', () => {
  const EVERY = Number(env('EVERY', 40)); const TICKS = Number(env('TICKS', 1200));
  env('AGES', 'classical,information').split(',').forEach((age) => env('SEEDS', '1,2,3').split(',').map(Number).forEach((seed) => {
    const setup = commandedSetup(buildSetupFromArmies({
      regionId: `sandbox-sea-${seed}`, terrain: 'sea', battleType: 'naval', seed,
      attackerUnits: fleet('a', 'attacker', 1000), defenderUnits: fleet('d', 'defender', 900),
      powers: [[], []], reinforcements: [[], []], attackerAgeId: age, defenderAgeId: age, fortLevel: 0, isCapital: false, infrastructure: 0, deposits: [],
      controllers: ['player', 'ai']
    }));
    const w = createWorld(setup);
    const ships = (s) => w.squads.filter((q) => q.side === s && q.onField);
    const gap = () => Math.min(...ships(0).flatMap((a) => ships(1).map((b) => Math.hypot(a.x - b.x, a.y - b.y) / Q)));
    console.log(`${age} seed ${seed}: start gap ${gap().toFixed(1)} tiles`);
    const own = ships(0).map((q) => `${(q.x / Q).toFixed(0)},${(q.y / Q).toFixed(0)}`).join(' ');
    console.log(`  your ships at ${own}`);
    let firstHit = -1; let firstLoss = -1;
    for (let i = 0; i < TICKS && !w.ended; i++) {
      step(w, []);
      w.events.length = 0;
      const hurt = ships(0).some((q) => q.strength < 1000);
      if (firstHit < 0 && hurt) firstHit = w.tick;
      if (firstLoss < 0 && w.squads.some((q) => q.side === 0 && !q.alive)) firstLoss = w.tick;
      if (i % EVERY === 0) console.log(`  t=${(w.tick / 20).toFixed(0)}s gap ${gap().toFixed(1)} you ${ships(0).map((q) => q.strength).join(' ')} | them ${ships(1).map((q) => q.strength).join(' ')}`);
    }
    console.log(`  => first hit ${firstHit < 0 ? 'none' : `${(firstHit / 20).toFixed(1)}s`}, first ship lost ${firstLoss < 0 ? 'none' : `${(firstLoss / 20).toFixed(1)}s`}`);
  }));
}, 600000);
