// .claude/skills/battle-lab/sackTrace.sim.js
// The battle sandbox's sack defence (BattleSandbox.jsx `&raid=sack`: the raiders preset at 800 against
// your balanced army at 900, the medium town, its walls at FORT) fought headless with you idle, to
// see why and when the raiders leave (playtest 40651418969: "they withdrew" at 0:44, 0:44, 1:08).
//   SEEDS=7 AGE=kingdoms FORT=2 [ATT=raiders|siege] [EVERY=100] \
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/sackTrace
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { buildTownManifest } from '../../../src/data/townLayout';
import { getAvailableClasses } from '../../../src/data/unitClasses';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { battleLimitTicks } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] || d;
const PRESETS = { raiders: ['cavalry', 'cavalry', 'cavalry', 'infantry', 'infantry'], siege: ['siege', 'siege', 'siege', 'infantry', 'ranged'], balanced: ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry'] };
const army = (p, preset, age, strength, extra = {}) => PRESETS[preset].filter((c) => getAvailableClasses(age).includes(c))
  .map((classId, i) => ({ id: `${p}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', xp: 0, ...extra }));

it('sack trace', () => {
  const age = env('AGE', 'kingdoms'); const fort = Number(env('FORT', 2)); const EVERY = Number(env('EVERY', 100));
  env('SEEDS', '7').split(',').map(Number).forEach((seed) => {
    const cityManifest = buildTownManifest({ cityId: 'sandbox-city', ageId: age, tierId: 'medium', style: 'europe', seed, capital: fort >= 4, defenseTier: Math.max(0, Math.floor(fort / 2)), buildings: { military: 1, economy: 1, culture: 2, food: 1, industry: 0, science: 2 } });
    const setup = commandedSetup(buildSetupFromArmies({
      regionId: `sandbox-mixed-${seed}`, terrain: 'mixed', seed, battleType: 'sack', raid: true,
      attackerUnits: army('a', env('ATT', 'raiders'), age, 800, { raidOf: 'sandbox-raiders' }), defenderUnits: army('d', 'balanced', age, 900),
      attackerAgeId: age, defenderAgeId: age, fortLevel: fort, infrastructure: 5, deposits: [], powers: [[], []],
      reinforcements: [[], []], controllers: ['ai', 'player'], economy: true, cityManifest
    }));
    const w = createWorld(setup);
    const start = setup.sides[0].units.reduce((s, u) => s + u.strength, 0);
    const line = () => w.squads.filter((q) => q.side === 0 && !q.worker).map((q) => `${q.classId[0]}${q.strength}${!q.alive ? 'x' : q.fled ? 'F' : q.routed ? 'R' : q.retreating ? 'r' : ''}`).join(' ');
    let retreatAt = -1;
    for (let i = 0; i < battleLimitTicks(setup) + 20 && !w.ended; i++) {
      step(w, []);
      if (retreatAt < 0 && w.retreatOrdered?.[0]) retreatAt = w.tick;
      w.events.length = 0;
      if (i % EVERY === 0) console.log(`  t=${(w.tick / 20).toFixed(0)}s raiders ${line()} retreat=${!!w.retreatOrdered?.[0]}`);
    }
    const left = w.squads.filter((q) => q.side === 0 && !q.worker && q.alive && !q.fled).reduce((s, q) => s + q.strength, 0);
    console.log(`SEED ${seed} ${age} fort=${fort} ${setup.battleType}: ${w.ended?.outcome} ${w.ended?.reason} at ${(w.ended?.tick / 20).toFixed(0)}s, retreat ordered ${retreatAt < 0 ? 'never' : (retreatAt / 20).toFixed(0) + 's'}, raiders ${start} -> ${left} standing, burned ${w.structures.filter((s) => s.loot && !s.alive).length}`);
  });
});
