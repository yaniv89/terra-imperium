// .claude/skills/battle-lab/nodeCount.sim.js
// The battle economy's resource nodes per battle: how many of each kind, how much of each resource,
// and how it splits between the attacker's half (west) and the defender's (east), so a node change
// can be compared between two checkouts and checked for fairness.
//   SEEDS=8 TERRAINS=plains,forest,hills,desert,mixed,arctic TYPES=field,assault \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/nodeCount
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { buildTownManifest } from '../../../src/data/townLayout';
import { Q } from '../../../src/battle/sim/constants';
import { RESOURCES, MILLI } from '../../../src/battle/data/economy';

const SEEDS = Number(process.env.SEEDS || 8);
const TERRAINS = (process.env.TERRAINS || 'plains,forest,hills,desert,mixed,arctic').split(',');
const TYPES = (process.env.TYPES || 'field,assault').split(',');
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

it('resource nodes per battle', () => {
  const rows = [];
  TYPES.forEach((type) => TERRAINS.forEach((terrain) => {
    const kinds = {}; const res = [0, 1].map(() => Object.fromEntries(RESOURCES.map((r) => [r, 0])));
    let nodes = 0; let trees = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const city = type === 'assault' ? buildTownManifest({ cityId: `nodes-${seed}`, ageId: 'bronze', tierId: 'medium', style: 'levant', seed, capital: false, defenseTier: 1, buildings: {} }) : null;
      const setup = buildSetupFromArmies({
        regionId: `nodes-${terrain}-${seed}`, terrain, seed,
        attackerUnits: mk('a', ['infantry', 'infantry', 'ranged', 'cavalry']), defenderUnits: mk('d', ['infantry', 'infantry', 'ranged']),
        controllers: ['ai', 'ai'], economy: true, ...(city ? { cityManifest: city, fortLevel: 2 } : {})
      });
      const { w } = setup.map;
      setup.economy.nodes.forEach((n) => {
        nodes += 1; kinds[n.kind] = (kinds[n.kind] || 0) + 1;
        trees += n.trees ? n.trees.length : n.kind === 'tree' ? 1 : 0;
        const half = n.x / Q < w / 2 ? 0 : 1;
        res[half][n.res] += n.amount / MILLI;
      });
    }
    const per = (v) => (v / SEEDS).toFixed(0);
    rows.push(`NODES ${type} ${terrain}: nodes=${per(nodes)} trees=${per(trees)} ${Object.entries(kinds).sort().map(([k, v]) => `${k}=${per(v)}`).join(' ')} | west ${RESOURCES.map((r) => `${r}=${per(res[0][r])}`).join(' ')} | east ${RESOURCES.map((r) => `${r}=${per(res[1][r])}`).join(' ')}`);
  }));
  console.log(rows.join('\n'));
}, 600000);
