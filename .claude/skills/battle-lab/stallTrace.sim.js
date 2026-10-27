// .claude/skills/battle-lab/stallTrace.sim.js
// The battle sandbox's own battle (BattleSandbox.jsx: the balanced armies, the economy on, the
// reinforcements, the commanded rules) fought headless, to catch a stall: neither side loses a man
// and the clock decides it (playtest 40550100958, bronze field and kingdoms walls).
//   SEEDS=7 AGE=bronze FORT=0 TERRAIN=mixed ORDER=none|attackMove [CITY=medium] [EVERY=1200] \
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/stallTrace
// ORDER=attackMove sends the player's army once at the enemy keep (a tap on it after arming Attack).
// Each seed prints where both armies' centres stand every EVERY ticks, the first tick a man fell,
// the outcome, the reason and the battle length.
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { buildTownManifest } from '../../../src/data/townLayout';
import { getAvailableClasses } from '../../../src/data/unitClasses';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { battleLimitTicks, Q } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] || d;
const BALANCED = ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry'];
const SMALL = ['infantry', 'ranged'];
const army = (p, list, age, strength) => list.filter((c) => getAvailableClasses(age).includes(c))
  .map((classId, i) => ({ id: `${p}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', xp: 0 }));
const seeds = (s) => s.includes('-') ? Array.from({ length: Number(s.split('-')[1]) - Number(s.split('-')[0]) + 1 }, (_, i) => Number(s.split('-')[0]) + i) : s.split(',').map(Number);

export const sandboxSetup = ({ seed, age, fort, terrain, city }) => buildSetupFromArmies({
  regionId: `sandbox-${terrain}-${seed}`, terrain, seed,
  attackerUnits: army('a', BALANCED, age, 1000), defenderUnits: army('d', BALANCED, age, 900),
  attackerAgeId: age, defenderAgeId: age, fortLevel: fort, isCapital: fort >= 4, infrastructure: 5, deposits: ['iron', 'copper'],
  regionBuildings: [{ category: 'military', tier: 1, name: 'Barracks' }, { category: 'culture', tier: 2, name: 'Temple' }],
  reinforcements: [[{ regionId: 'north', name: 'N', edge: 'N', units: army('r', SMALL, age, 800) }], [{ regionId: 'east', name: 'E', edge: 'S', units: army('s', SMALL, age, 700) }]],
  controllers: ['player', 'ai'], economy: true,
  ...(city ? { cityManifest: buildTownManifest({ cityId: 'sandbox-city', ageId: age, tierId: city, style: 'europe', seed, capital: fort >= 4, defenseTier: Math.floor(fort / 2), buildings: { military: 1, economy: 1, culture: 2, food: 1, industry: 0, science: 2 } }) } : {})
});

it('stall trace', () => {
  const age = env('AGE', 'bronze'); const fort = Number(env('FORT', 0)); const terrain = env('TERRAIN', 'mixed');
  const order = env('ORDER', 'none'); const EVERY = Number(env('EVERY', 1200)); const city = env('CITY', '');
  seeds(env('SEEDS', '7')).forEach((seed) => {
    const setup = commandedSetup(sandboxSetup({ seed, age, fort, terrain, city }));
    const w = createWorld(setup);
    const keep = w.structures[0];
    const mine = w.squads.filter((q) => q.side === 0 && q.onField && !q.worker && !q.isGeneral).map((q) => q.idx);
    const first = order === 'attackMove' ? [{ side: 0, type: 'attackMove', squads: mine, x: keep.x, y: keep.y }] : [];
    const men = (s) => w.squads.filter((q) => q.side === s && !q.worker).reduce((t, q) => t + q.strength, 0);
    const start = [men(0), men(1)];
    let firstBlood = -1;
    const centre = (s) => {
      const l = w.squads.filter((q) => q.side === s && q.alive && q.onField && !q.worker && !q.isGeneral && !q.fled);
      if (!l.length) return '-';
      const ords = {}; l.forEach((q) => { ords[q.order.type] = (ords[q.order.type] || 0) + 1; });
      return `${(l.reduce((t, q) => t + q.x, 0) / l.length / Q).toFixed(0)},${(l.reduce((t, q) => t + q.y, 0) / l.length / Q).toFixed(0)} n=${l.length} ${JSON.stringify(ords)}`;
    };
    const limit = battleLimitTicks(setup) + 20;
    for (let i = 0; i < limit && !w.ended; i++) {
      step(w, i === 0 ? first : []);
      w.events.length = 0;
      if (firstBlood < 0 && (men(0) < start[0] || men(1) < start[1])) firstBlood = w.tick;
      if (env('QUIET', '0') !== '1' && i % EVERY === 0) console.log(`  seed ${seed} t=${(w.tick / 20).toFixed(0)}s keep=${(keep.x / Q).toFixed(0)},${(keep.y / Q).toFixed(0)} A ${centre(0)} | D ${centre(1)}`);
    }
    const e = w.ended || {};
    console.log(`SEED ${seed} ${age} fort=${fort} order=${order}: ${e.outcome} ${e.reason} at ${((e.tick || w.tick) / 20).toFixed(0)}s, firstBlood=${firstBlood < 0 ? 'never' : (firstBlood / 20).toFixed(0) + 's'}, men A ${start[0]}->${men(0)} D ${start[1]}->${men(1)}`);
  });
});
