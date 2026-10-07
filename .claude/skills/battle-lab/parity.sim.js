// .claude/skills/battle-lab/parity.sim.js
// Tactical sim vs auto-resolve casualty exchange rate (attacker losses / defender losses), AI vs AI,
// over N seeds per matchup — the same measure as systems.test.js's parity guardrail, but with the
// raw numbers and a seed count you choose (4 seeds swing it +-30%: judge on 16+).
//   N=16 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parity
// RIVER_SIZES=1,2,3 (with TYPES=river) fights each river battle on a real tile across a river edge
// of that size (stream, river, great river: its band width and ford count, mapgen.js); BRIDGE=1
// puts a road on both banks, so the crossing has a bridge.
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { runHeadless } from '../../../src/battle/sim/headless';
import { resolveBattle } from '../../../src/engine/battle';
import { createRng } from '../../../src/utils/rng';
import { getTiles } from '../../../src/data/geo/tiles';
import { tileContextOf } from '../../../src/battle/setup/tileContext';
import { riverAttackAdjust } from '../../../src/battle/setup/battleType';
import { buildTownManifest } from '../../../src/data/townLayout';

// TYPES=assault: a siege assault on a walled town (fortLevel 2); CITY=1 loads a real city from its
// manifest (src/battle/setup/cityBattle.js: houses, the wall ring and gate, towers), TIER=small|
// medium|big its size. CITY=0 is the old abstract keep.
const CITY = process.env.CITY === '1';
const TIER = process.env.TIER || 'medium';

const N = Number(process.env.N || 16);
// NOROUT=attacker|defender: that side never routs (sides[s].canRout = false), as the player's side in a
// commanded battle (buildBattleSetup.js commandedSetup): measures Command's edge over Auto.
const NOROUT = process.env.NOROUT === 'attacker' ? 0 : process.env.NOROUT === 'defender' ? 1 : -1;
const noRout = (setup) => { if (NOROUT >= 0) setup.sides[NOROUT].canRout = false; return setup; };
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId: classId.startsWith('naval') ? 'naval' : classId, navalLine: classId.startsWith('naval:') ? classId.slice(6) : undefined, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: classId.startsWith('naval') ? 'naval' : 'land' }));
const MATCHUPS = [
  [['infantry', 'infantry', 'ranged'], ['infantry', 'infantry', 'ranged']],
  [['infantry', 'infantry', 'infantry', 'cavalry', 'ranged'], ['infantry', 'ranged']],
  [['cavalry', 'cavalry'], ['ranged', 'ranged']]
];
const lost = (u, st) => st.reduce((x, v) => x + v.strength, 0) - u.reduce((x, v) => x + v.strength, 0);

// The battle types the map decides (src/battle/setup/battleType.js): the tactical sim ends on
// each type's objective, the auto-resolve scales the attacker by the same type's odds.
const TYPES = (process.env.TYPES || 'field,river,ambush,landing,sally,naval').split(',');
// A sea battle is fleets only (navalBattle.js): warships, a raider, a transport, by line.
const NAVAL_MATCHUPS = [
  [['naval:warship', 'naval:warship', 'naval:warship'], ['naval:warship', 'naval:warship']],
  [['naval:warship', 'naval:warship', 'naval:raider'], ['naval:warship', 'naval:transport', 'naval:transport']],
  [['naval:raider', 'naval:raider'], ['naval:warship']]
];
const AGES = (process.env.AGES || 'classical').split(',');
const RIVER_SIZES = process.env.RIVER_SIZES ? process.env.RIVER_SIZES.split(',').map(Number) : [null];
// A flat, open tile across a river edge of `size`, approached over that edge.
const riverContext = (size) => {
  if (!size) return null;
  const tiles = getTiles();
  for (let t = 0; t < tiles.count; t++) {
    if (tiles.land[t] !== 1 || tiles.reliefOf(t) !== 'flat') continue;
    const from = tiles.neighbors[t].find((n) => tiles.land[n] === 1 && tiles.riverSizeBetween(t, n) === size);
    if (from == null) continue;
    const state = { world: { tileState: process.env.BRIDGE ? { [t]: { road: true }, [from]: { road: true } } : {} } };
    return tileContextOf(state, t, { fromTile: from });
  }
  return null;
};

it('parity', () => {
  RIVER_SIZES.forEach((riverSize) => TYPES.forEach((battleType) => (battleType === 'naval' ? NAVAL_MATCHUPS : MATCHUPS).forEach(([att, def]) => AGES.forEach((ageId) => {
    const tileContext = battleType === 'river' ? riverContext(riverSize) : null;
    let tA = 0; let tD = 0; let aA = 0; let aD = 0; let wins = 0; let autoWins = 0; const reasons = {};
    for (let seed = 1; seed <= N; seed++) {
      const assault = battleType === 'assault';
      const cityManifest = assault && CITY ? buildTownManifest({ cityId: `parity-${seed}`, ageId, tierId: TIER, style: 'europe', seed, defenseTier: 1 }) : null;
      const { result } = runHeadless(noRout(buildSetupFromArmies({ regionId: `parity-${seed}`, terrain: battleType === 'naval' ? 'sea' : 'mixed', seed, attackerUnits: mk('a', att), defenderUnits: mk('d', def), attackerAgeId: ageId, defenderAgeId: ageId, controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType, tileContext, landing: battleType === 'landing', sally: battleType === 'sally', ...(assault ? { fortLevel: 2, isAttackingFortification: true, cityManifest } : {}) })));
      tA += lost(result.attackerUnits, mk('a', att)); tD += lost(result.defenderUnits, mk('d', def)); if (result.outcome === 'attacker') wins += 1; const rk = `${result.outcome}:${result.report.tactical.reason}`; reasons[rk] = (reasons[rk] || 0) + 1;
      const auto = resolveBattle({ attackerUnits: mk('a', att), defenderUnits: mk('d', def), terrain: battleType === 'naval' ? 'sea' : 'mixed', isAttackingFortification: assault, battleType, attackerPenaltyMultiplier: tileContext ? riverAttackAdjust(riverSize) : 1, attackerAgeId: ageId, defenderAgeId: ageId, rng: createRng(seed * 97) });
      aA += lost(auto.attackerUnits, mk('a', att)); aD += lost(auto.defenderUnits, mk('d', def)); if (auto.outcome === 'attacker') autoWins += 1;
    }
    const tactical = tA / Math.max(1, tD); const auto = aA / Math.max(1, aD);
    console.log(`PARITY${NOROUT >= 0 ? `[norout ${process.env.NOROUT}]` : ''} ${battleType}${tileContext ? `(size ${riverSize}${process.env.BRIDGE ? ', bridge' : ''})` : ''} ${ageId} ${att.join('+')} vs ${def.join('+')} seeds=${N} tactical=${tactical.toFixed(3)} auto=${auto.toFixed(3)} ratio=${(tactical / Math.max(0.001, auto)).toFixed(2)}x attackerWins=${wins}/${N} autoWins=${autoWins}/${N} ${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }))));
});
