// .claude/skills/battle-lab/buildSlots.sim.js
// How much ground a side can build on at the start of a battle (playtest audit I176): for every
// terrain and seed, the legal top-left tiles (sim/economy.js placementBlock) of a house (2x2), a
// barracks (3x3) and a stable (4x4) for each side a few ticks in, and why the rest of the build
// circle is refused. Run it on two checkouts to compare a placement or setup change.
//   SEEDS=8 TERRAINS=plains,forest,hills,desert,mixed TYPES=field,assault \
//     npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/buildSlots
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { placementBlock } from '../../../src/battle/sim/economy';
import { BUILDINGS, BUILD_RADIUS_HQ } from '../../../src/battle/data/economy';
import { buildTownManifest } from '../../../src/data/townLayout';
import { Q } from '../../../src/battle/sim/constants';

const SEEDS = Number(process.env.SEEDS || 8);
const TERRAINS = (process.env.TERRAINS || 'plains,forest,hills,desert,mixed').split(',');
const TYPES = (process.env.TYPES || 'field,assault').split(',');
const KINDS = ['house', 'barracks', 'stable'];
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));

it('legal build slots at the start of a battle', () => {
  const rows = [];
  TYPES.forEach((type) => TERRAINS.forEach((terrain) => {
    const sum = [0, 1].map(() => ({ ...Object.fromEntries(KINDS.map((k) => [k, 0])), why: {} }));
    for (let seed = 1; seed <= SEEDS; seed++) {
      const city = type === 'assault' ? buildTownManifest({ cityId: `slots-${seed}`, ageId: 'bronze', tierId: 'medium', style: 'levant', seed, capital: false, defenseTier: 1, buildings: {} }) : null;
      const w = createWorld(buildSetupFromArmies({
        regionId: `slots-${terrain}-${seed}`, terrain, seed,
        attackerUnits: mk('a', ['infantry', 'infantry', 'ranged', 'cavalry']), defenderUnits: mk('d', ['infantry', 'infantry', 'ranged']),
        controllers: ['player', 'player'], intel: { attackerSeesDefender: false }, economy: true,
        ...(city ? { cityManifest: city, fortLevel: 2 } : {})
      }));
      for (let i = 0; i < 5; i++) step(w, []);
      [0, 1].forEach((side) => {
        const hq = w.eco.buildings.find((b) => b.side === side && BUILDINGS[b.type].hq);
        const cx = Math.floor(hq.x / Q); const cy = Math.floor(hq.y / Q);
        for (let dy = -BUILD_RADIUS_HQ; dy <= BUILD_RADIUS_HQ; dy++) {
          for (let dx = -BUILD_RADIUS_HQ; dx <= BUILD_RADIUS_HQ; dx++) {
            if (dx * dx + dy * dy > BUILD_RADIUS_HQ * BUILD_RADIUS_HQ) continue;
            KINDS.forEach((k) => {
              const why = placementBlock(w, side, k, cx + dx, cy + dy);
              if (!why) sum[side][k] += 1;
              else if (k === 'barracks') sum[side].why[why] = (sum[side].why[why] || 0) + 1;
            });
          }
        }
      });
    }
    [0, 1].forEach((side) => {
      const s = sum[side];
      const total = Object.values(s.why).reduce((a, b) => a + b, 0) + s.barracks;
      const why = Object.entries(s.why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${Math.round((v / total) * 100)}%`).join(' ');
      rows.push(`SLOTS ${type} ${terrain} ${side ? 'defender' : 'attacker'} per battle: house=${(s.house / SEEDS).toFixed(0)} barracks=${(s.barracks / SEEDS).toFixed(0)} stable=${(s.stable / SEEDS).toFixed(0)} barracks refused: ${why}`);
    });
  }));
  console.log(rows.join('\n'));
}, 600000);
