// .claude/skills/battle-lab/ghostScan.sim.js
// "Troops walk through buildings like ghosts" (battle-art-8): a commanded town assault (every squad
// attack-moves on the keep), sampled every second. Counts, over standing structures with a footprint
// (houses, landmarks, buildings, walls), how often a squad's centre and a drawn figure (the renderer's
// block: cols = ceil(sqrt(n * 1.8)), rows back from the squad's point, BattleRenderer.drawSquads)
// stand inside a structure's drawn rectangle (s.x, s.y, s.w by s.d), and the share of drawn house
// ground the sim blocks. STUCK lists squads with an order that did not move 1 tile in 30 s.
//   SEEDS=1-8 FORT=0 TIER=medium AGE=bronze npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/ghostScan
import { it } from 'vitest';
import { buildSetupFromArmies, commandedSetup } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
import { militiaFor } from '../../../src/engine/battleInputs';
import { buildTownManifest, manifestHousing } from '../../../src/data/townLayout';
import { getDefenseLevelDamageReductionMultiplier } from '../../../src/engine/siege';
import { TILE_COST } from '../../../src/battle/setup/mapgen';
import { Q, TICK_HZ } from '../../../src/battle/sim/constants';
import { getSoldierCount } from '../../../src/battle/data/battleStats';

const env = (k, d) => process.env[k] || d;
const seedsOf = (s) => s.split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
const mk = (p, list, str) => list.split(',').filter(Boolean).map((classId, i) => ({ id: `${p}${i}`, classId, strength: str, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const SPACING = { cavalry: 0.95, support: 1.05, siege: 1.5 };

it('ghost scan', () => {
  const FORT = Number(env('FORT', 0)); const AGE = env('AGE', 'bronze');
  const tot = { centre: 0, fig: 0, figN: 0, samples: 0, blocked: 0, drawn: 0, stuck: 0, wins: 0, n: 0 };
  seedsOf(env('SEEDS', '1-8')).forEach((seed) => {
    const walled = FORT > 0;
    const cityManifest = buildTownManifest({ cityId: `ghost-${seed}`, ageId: AGE, tierId: env('TIER', 'medium'), style: env('STYLE', 'europe'), seed, defenseTier: walled ? 1 : -1 });
    const militia = militiaFor({ ownerId: 'defender', cityId: `ghost-${seed}`, housing: manifestHousing(cityManifest) });
    const base = buildSetupFromArmies({
      regionId: `ghost-${seed}`, terrain: env('TERRAIN', 'mixed'), seed, attackerUnits: mk('a', env('ATT', 'infantry,infantry,infantry,cavalry,ranged'), 800), defenderUnits: [...mk('d', env('DEF', 'infantry,ranged'), 400), ...militia],
      attackerAgeId: AGE, defenderAgeId: AGE, controllers: ['player', 'ai'], deposits: [], powers: [[], []], city: true,
      fortLevel: FORT, isAttackingFortification: walled, cityManifest, defenseReduction: walled ? getDefenseLevelDamageReductionMultiplier(FORT) : 1, economy: true, economyInputs: { supply: [1, 1], development: [0.3, 0.3] }
    });
    const w = createWorld(commandedSetup(base));
    const keep = w.structures[0];
    const rects = w.structures.filter((s, i) => i > 0 && s.footprint?.length && s.kind !== 'wall' && s.kind !== 'gate').map((s) => ({ s, x0: s.x / Q - s.w / 2, x1: s.x / Q + s.w / 2, y0: s.y / Q - s.d / 2, y1: s.y / Q + s.d / 2 }));
    // drawn house ground the sim blocks (sampled on a 0.25 tile grid)
    rects.forEach((r) => { for (let y = r.y0 + 0.125; y < r.y1; y += 0.25) for (let x = r.x0 + 0.125; x < r.x1; x += 0.25) { tot.drawn += 1; if (!TILE_COST[w.map.tiles[Math.floor(y) * w.map.w + Math.floor(x)]]) tot.blocked += 1; } });
    const DEEP = Number(env("DEEP", 0.3)); // only a point this far inside the drawn walls reads as a ghost
    const inside = (x, y) => rects.some((r) => r.s.alive && x > r.x0 + DEEP && x < r.x1 - DEEP && y > r.y0 + DEEP && y < r.y1 - DEEP);
    const last = new Map();
    let centre = 0; let fig = 0; let figN = 0; let samples = 0; const stuck = new Set();
    const army = () => w.squads.filter((q) => q.side === 0 && q.alive && q.onField && !q.worker && !q.isGeneral);
    for (let i = 0; i <= w.setup.limitTicks && !w.ended; i++) {
      step(w, i === 0 ? [{ side: 0, type: 'attackMove', squads: army().map((q) => q.idx), x: keep.x, y: keep.y }] : []);
      w.events.length = 0;
      if (w.tick % TICK_HZ) continue;
      w.squads.forEach((q) => {
        if (!q.alive || !q.onField || q.fled || q.inside >= 0 || q.stats.flying) return;
        const x = q.x / Q; const y = q.y / Q; samples += 1;
        if (inside(x, y)) {
          centre += 1;
          if (process.env.WHY) { const r = rects.find((o) => o.s.alive && x > o.x0 + DEEP && x < o.x1 - DEEP && y > o.y0 + DEEP && y < o.y1 - DEEP); console.log(`IN side=${q.side} ${q.worker ? 'worker' : q.classId} tile=${w.map.tiles[Math.floor(y) * w.map.w + Math.floor(x)]} ${r.s.kind} order=${q.order.type} at ${x.toFixed(2)},${y.toFixed(2)} rect=${r.x0.toFixed(1)}..${r.x1.toFixed(1)},${r.y0.toFixed(1)}..${r.y1.toFixed(1)}`); }
        }
        const n = getSoldierCount(q.stats, q.strength, q.maxStrength); const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
        const sp = SPACING[q.classId] || 0.52; const a = (q.facing / 256) * Math.PI * 2; const fx = Math.cos(a); const fz = Math.sin(a);
        for (let k = 0; k < n; k++) { const lat = ((k % cols) - (cols - 1) / 2) * sp; const back = Math.floor(k / cols) * sp; figN += 1; if (inside(x - fz * lat - fx * back, y + fx * lat - fz * back)) fig += 1; }
        if (q.side === 0 && !q.worker && w.tick % (30 * TICK_HZ) === 0 && q.order.type !== 'idle' && q.target < 0) {
          const p = last.get(q.idx); if (p && Math.hypot(p[0] - x, p[1] - y) < 1) stuck.add(`${q.idx}@${x.toFixed(1)},${y.toFixed(1)}:${q.order.type}`);
          last.set(q.idx, [x, y]);
        }
      });
    }
    const out = w.ended?.outcome || 'none';
    console.log(`SEED ${seed} ${out}/${w.ended?.reason || '-'} ${Math.round(w.tick / TICK_HZ)}s centreInHouse=${(100 * centre / Math.max(1, samples)).toFixed(1)}% figInHouse=${(100 * fig / Math.max(1, figN)).toFixed(1)}% stuck=${[...stuck].join(' ') || 0}`);
    Object.assign(tot, { centre: tot.centre + centre, fig: tot.fig + fig, figN: tot.figN + figN, samples: tot.samples + samples, stuck: tot.stuck + stuck.size, wins: tot.wins + (out === 'attacker' ? 1 : 0), n: tot.n + 1 });
  });
  console.log(`TOTAL fort=${FORT} wins=${tot.wins}/${tot.n} centreInHouse=${(100 * tot.centre / Math.max(1, tot.samples)).toFixed(1)}% figInHouse=${(100 * tot.fig / Math.max(1, tot.figN)).toFixed(1)}% drawnHouseBlocked=${(100 * tot.blocked / Math.max(1, tot.drawn)).toFixed(0)}% stuck=${tot.stuck}`);
});
