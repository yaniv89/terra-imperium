// .claude/skills/battle-lab/pocketScan.sim.js
// H-04: can every walkable tile of a walled town reach the field outside its gate on the defender's
// own paths (the gate open to its side, pathing.js getFlowField)? Builds the town for each seed, age,
// tier and style, computes the defender's flow field to a tile just outside the gate and lists the
// walkable tiles inside the deployment zone it never reaches (pockets: a squad deployed or pushed
// there can never sortie). Also counts the squads of the deployed garrison standing in a pocket.
//   SEEDS=1-40 AGES=bronze,classical,kingdoms TIERS=small,medium,big STYLES=europe,egypt FORT=2 \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/pocketScan
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { getFlowField, tileOf } from '../../../src/battle/sim/pathing';
import { buildTownManifest } from '../../../src/data/townLayout';
import { TILE_COST, TILE } from '../../../src/battle/setup/mapgen';
import { Q } from '../../../src/battle/sim/constants';

const env = (k, d) => process.env[k] || d;
const seedsOf = (s) => s.split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
const mk = (p, list) => list.split(',').map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

it('pocket scan', () => {
  let towns = 0; let withPocket = 0; let squadsStuck = 0; let squads = 0;
  env('STYLES', 'europe').split(',').forEach((style) => env('TIERS', 'small,medium,big').split(',').forEach((tierId) => env('AGES', 'bronze,classical,kingdoms').split(',').forEach((ageId) => seedsOf(env('SEEDS', '1-20')).forEach((seed) => {
    const FORT = Number(env('FORT', 2));
    const cityManifest = buildTownManifest({ cityId: `p-${seed}`, ageId, tierId, style, seed, defenseTier: 1 });
    const setup = buildSetupFromArmies({ regionId: `p-${seed}`, terrain: env('TERRAIN', 'mixed'), seed, attackerUnits: mk('a', 'infantry,infantry'), defenderUnits: mk('d', env('DEF', 'infantry,infantry,infantry,ranged,ranged')), attackerAgeId: ageId, defenderAgeId: ageId, controllers: ['ai', 'player'], deposits: [], powers: [[], []], city: true, fortLevel: FORT, isAttackingFortification: true, cityManifest, economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] } });
    const w = createWorld(setup);
    const gate = w.structures.find((s) => s.kind === 'gate');
    if (!gate) return;
    towns += 1;
    const out = tileOf(w.map, gate.x - 4 * Q, gate.y);
    const field = getFlowField(w, out, undefined, undefined, 1);
    const keep = w.structures[0];
    const { w: mw, h: mh, tiles } = w.map;
    const pockets = [];
    for (let y = 1; y < mh - 1; y++) for (let x = Math.floor(gate.x / Q); x < mw - 1; x++) {
      const i = y * mw + x;
      if (!TILE_COST[tiles[i]] || tiles[i] === TILE.GATE) continue;
      if (Math.hypot(x + 0.5 - keep.x / Q, y + 0.5 - keep.y / Q) > (keep.x - gate.x) / Q + 1) continue; // inside the ring only
      if (field[i] === 0xffff) pockets.push([x, y]);
    }
    const stuck = w.squads.filter((q) => q.side === 1 && q.onField && !q.worker && field[tileOf(w.map, q.x, q.y)] === 0xffff);
    squads += w.squads.filter((q) => q.side === 1 && q.onField && !q.worker).length; squadsStuck += stuck.length;
    if (pockets.length) { withPocket += 1; console.log(`POCKET ${style} ${tierId} ${ageId} seed=${seed} tiles=${pockets.length} e.g. ${pockets.slice(0, 6).map(([x, y]) => `${x},${y}`).join(' ')} squadsInPocket=${stuck.map((q) => `${q.idx}@${(q.x / Q).toFixed(1)},${(q.y / Q).toFixed(1)}`).join(' ') || 0}`); }
  }))));
  console.log(`TOWNS ${towns} withPocket=${withPocket} defenderSquadsInPocket=${squadsStuck}/${squads}`);
});
