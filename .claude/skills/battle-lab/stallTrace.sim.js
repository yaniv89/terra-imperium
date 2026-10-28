// .claude/skills/battle-lab/stallTrace.sim.js
// The battle sandbox's own battle (BattleSandbox.jsx: the balanced armies, the economy on, the
// reinforcements, the commanded rules) fought headless, to catch a stall: neither side loses a man
// and the clock decides it (playtest 40550100958, bronze field and kingdoms walls).
//   SEEDS=7 AGE=bronze FORT=0 TERRAIN=mixed ORDER=none|attackMove|attackBase [CITY=medium] [EVERY=1200] [REAL=1] [IDLE=1] \
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/stallTrace
// ORDER=attackMove sends the player's army once at the enemy keep (a tap on it after arming Attack);
// AT=<seconds> gives that order then instead of at the start. BUILD=1 runs the player's economy
// with the AI's own economy brain (economyAI.js: laborers gather, build and train), the player who
// builds first. Each seed prints where both armies' centres stand every EVERY ticks, the first
// enemy march (a defender soldier 30 tiles or more west of its keep, toward the attacker), the first tick a man fell, the
// outcome, the reason and the battle length.
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { buildTownManifest } from '../../../src/data/townLayout';
import { getAvailableClasses } from '../../../src/data/unitClasses';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { battleLimitTicks, Q } from '../../../src/battle/sim/constants';
import { thinkEconomy } from '../../../src/battle/sim/economyAI';
import { baseBuildings } from '../../../src/battle/sim/base';
import { getTiles } from '../../../src/data/geo/tiles';
import { tileContextOf } from '../../../src/battle/setup/tileContext';
import { sandboxSampleTile } from '../../../src/components/battle/sandboxTile';
import { getBattlePowers } from '../../../src/engine/invasion';

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

// REAL=1: the sandbox page's own inputs on top (BattleSandbox.jsx: its river-mouth tile, the
// generals, the age's powers, the six region buildings, volley fire on the second ranged), as the
// playtest's `?battleSandbox&age=<age>` fights it (fort 2 by default there: FORT=2).
const GENERALS = {
  g_att: { id: 'g_att', name: 'Your general', personality: 'reckless', martial: 4, shock: 4, fire: 3, maneuver: 3 },
  g_def: { id: 'g_def', name: 'Enemy general', personality: 'cautious', martial: 3, shock: 3, fire: 3, maneuver: 3 }
};
const realArmy = (p, list, age, strength, gen) => army(p, list, age, strength).map((u, i) => ({ ...u, promotions: u.classId === 'ranged' && i === 3 ? ['volleyFire'] : [], commanderId: i === 0 ? gen : null }));
export const realSandboxSetup = ({ seed, age, fort, terrain, city }) => {
  const tiles = getTiles();
  return buildSetupFromArmies({
    ...sandboxSetup({ seed, age, fort, terrain, city }),
    tileContext: tileContextOf(null, sandboxSampleTile(tiles)), regionId: `sandbox-${terrain}-${seed}`, terrain, seed,
    attackerUnits: realArmy('a', BALANCED, age, 1000, 'g_att'), defenderUnits: realArmy('d', BALANCED, age, 900, 'g_def'), generals: GENERALS,
    powers: [getBattlePowers(null, null, age, army('a', BALANCED, age, 1000)), getBattlePowers(null, null, age, army('d', BALANCED, age, 900)).filter((p) => p.id !== 'nuclearStrike')],
    regionBuildings: [{ category: 'military', tier: 1, name: 'Barracks' }, { category: 'economy', tier: 1, name: 'Bazaar' }, { category: 'culture', tier: 2, name: 'Temple' }, { category: 'food', tier: 1, name: 'Granary' }, { category: 'industry', tier: 0, name: 'Workshop' }, { category: 'science', tier: 2, name: 'Scriptorium' }],
    intel: { attackerSeesDefender: true }, isCapital: fort >= 4, attackerAgeId: age, defenderAgeId: age, fortLevel: fort,
    infrastructure: 5, deposits: ['iron', 'copper'], controllers: ['player', 'ai'], economy: true,
    ...(city ? { cityManifest: buildTownManifest({ cityId: 'sandbox-city', ageId: age, tierId: city, style: 'europe', seed, capital: fort >= 4, defenseTier: Math.max(0, Math.floor(fort / 2)), buildings: { military: 1, economy: 1, culture: 2, food: 1, industry: 0, science: 2 } }) } : {})
  });
};

it('stall trace', () => {
  const age = env('AGE', 'bronze'); const fort = Number(env('FORT', 0)); const terrain = env('TERRAIN', 'mixed');
  const order = env('ORDER', 'none'); const EVERY = Number(env('EVERY', 1200)); const city = env('CITY', '');
  seeds(env('SEEDS', '7')).forEach((seed) => {
    const setup = commandedSetup((env('REAL', '0') === '1' ? realSandboxSetup : sandboxSetup)({ seed, age, fort, terrain, city }));
    const w = createWorld(setup);
    const keep = w.structures[0];
    const mine = w.squads.filter((q) => q.side === 0 && q.onField && !q.worker && !q.isGeneral).map((q) => q.idx);
    // ORDER=attackBase: Attack it on the Enemy button's first target (their base building nearest the army).
    const cx = mine.reduce((t, i) => t + w.squads[i].x, 0) / mine.length; const cy = mine.reduce((t, i) => t + w.squads[i].y, 0) / mine.length;
    const nb = baseBuildings(w, 1).sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - (b.x - cx) ** 2 - (b.y - cy) ** 2)[0];
    const first = order === 'attackMove' ? [{ side: 0, type: 'attackMove', squads: mine, x: keep.x, y: keep.y }]
      : order === 'attackBase' && nb ? [{ side: 0, type: 'attack', squads: mine, target: { kind: nb.kind, index: nb.index } }] : [];
    const at = Math.round(Number(env('AT', 0)) * 20); const build = env('BUILD', '0') === '1';
    let marchAt = -1; let marchN = 0;
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
    // IDLE=1: what each of the player's squads was doing just before it went idle (the HUD's Idle
    // count: order idle, no target, not routed or inside), counted by `<order>/<target kind>`.
    const idleWhy = {}; const was = new Map(); const trackIdle = env('IDLE', '0') === '1';
    const isIdle = (q) => q.alive && q.onField && !q.worker && !q.isGeneral && !q.fled && !q.routed && q.order.type === 'idle' && q.target < 0 && !(q.inside >= 0);
    for (let i = 0; i < limit && !w.ended; i++) {
      if (trackIdle) w.squads.forEach((q) => { if (q.side !== 0) return; const prev = was.get(q.idx); if (isIdle(q) && prev && prev !== 'idle') idleWhy[prev] = (idleWhy[prev] || 0) + 1; was.set(q.idx, isIdle(q) ? 'idle' : `${q.order.type}/${q.targetKind || '-'}`); });
      const orders = i === at ? first.map((o) => ({ ...o, squads: o.squads.filter((m) => w.squads[m].alive) })) : [];
      if (build) thinkEconomy(w, 0, setup.difficultyId, orders);
      step(w, orders);
      w.events.length = 0;
      if (marchAt < 0) {
        const out = w.squads.filter((q) => q.side === 1 && q.alive && q.onField && !q.reinforcement && !q.worker && !q.isGeneral && q.x <= keep.x - 30 * Q);
        if (out.length) { marchAt = w.tick; marchN = w.squads.filter((q) => q.side === 1 && q.alive && q.onField && !q.worker && !q.isGeneral).length; }
      }
      if (firstBlood < 0 && (men(0) < start[0] || men(1) < start[1])) firstBlood = w.tick;
      if (env('QUIET', '0') !== '1' && i % EVERY === 0) console.log(`  seed ${seed} t=${(w.tick / 20).toFixed(0)}s keep=${(keep.x / Q).toFixed(0)},${(keep.y / Q).toFixed(0)} A ${centre(0)} | D ${centre(1)}${trackIdle ? ` idle ${w.squads.filter((q) => q.side === 0 && isIdle(q)).length}` : ''}`);
    }
    const e = w.ended || {};
    console.log(`SEED ${seed} ${age} fort=${fort} order=${order}${at ? '@' + at / 20 + 's' : ''}${build ? ' build' : ''}: ${e.outcome} ${e.reason} at ${((e.tick || w.tick) / 20).toFixed(0)}s, enemyMarch=${marchAt < 0 ? 'never' : (marchAt / 20).toFixed(0) + 's with ' + marchN + ' squads'}, firstBlood=${firstBlood < 0 ? 'never' : (firstBlood / 20).toFixed(0) + 's'}, men A ${start[0]}->${men(0)} D ${start[1]}->${men(1)}${trackIdle ? ` idleAfter ${JSON.stringify(idleWhy)} idleNow ${w.squads.filter((q) => q.side === 0 && isIdle(q)).length}` : ''}`);
  });
});
