// .claude/skills/battle-lab/parity.sim.js
// Tactical sim vs auto-resolve casualty exchange rate (attacker losses / defender losses), AI vs AI,
// over N seeds per matchup — the same measure as systems.test.js's parity guardrail, but with the
// raw numbers and a seed count you choose (4 seeds swing it +-30%: judge on 16+).
//   N=16 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parity
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { runHeadless } from '../../../src/battle/sim/headless';
import { resolveBattle } from '../../../src/engine/battle';
import { createRng } from '../../../src/utils/rng';

const N = Number(process.env.N || 16);
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const MATCHUPS = [
  [['infantry', 'infantry', 'ranged'], ['infantry', 'infantry', 'ranged']],
  [['infantry', 'infantry', 'infantry', 'cavalry', 'ranged'], ['infantry', 'ranged']],
  [['cavalry', 'cavalry'], ['ranged', 'ranged']]
];
const lost = (u, st) => st.reduce((x, v) => x + v.strength, 0) - u.reduce((x, v) => x + v.strength, 0);

it('parity', () => {
  MATCHUPS.forEach(([att, def]) => {
    let tA = 0; let tD = 0; let aA = 0; let aD = 0; let wins = 0; let autoWins = 0; const reasons = {};
    for (let seed = 1; seed <= N; seed++) {
      const { result } = runHeadless(buildSetupFromArmies({ regionId: `parity-${seed}`, terrain: 'mixed', seed, attackerUnits: mk('a', att), defenderUnits: mk('d', def), controllers: ['ai', 'ai'], deposits: [], powers: [[], []] }));
      tA += lost(result.attackerUnits, mk('a', att)); tD += lost(result.defenderUnits, mk('d', def)); if (result.outcome === 'attacker') wins += 1; const rk = `${result.outcome}:${result.report.tactical.reason}`; reasons[rk] = (reasons[rk] || 0) + 1;
      const auto = resolveBattle({ attackerUnits: mk('a', att), defenderUnits: mk('d', def), terrain: 'mixed', isAttackingFortification: false, rng: createRng(seed * 97) });
      aA += lost(auto.attackerUnits, mk('a', att)); aD += lost(auto.defenderUnits, mk('d', def)); if (auto.outcome === 'attacker') autoWins += 1;
    }
    const tactical = tA / Math.max(1, tD); const auto = aA / Math.max(1, aD);
    console.log(`PARITY ${att.join('+')} vs ${def.join('+')} seeds=${N} tactical=${tactical.toFixed(3)} auto=${auto.toFixed(3)} ratio=${(tactical / Math.max(0.001, auto)).toFixed(2)}x attackerWins=${wins}/${N} autoWins=${autoWins}/${N} ${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  });
});
