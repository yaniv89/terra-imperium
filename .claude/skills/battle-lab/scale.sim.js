// .claude/skills/battle-lab/scale.sim.js
// How the tactical sim cost grows with army size (rts-world-review.md section 3):
//   npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/scale
import { it } from 'vitest';
import { buildSetupFromArmies } from '../../../src/battle/setup/buildBattleSetup';
import { createWorld } from '../../../src/battle/sim/world';
import { step } from '../../../src/battle/sim/step';
const mk = (p, n) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, classId: ['infantry', 'infantry', 'ranged', 'cavalry'][i % 4], strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
it('scale', () => {
  for (const n of [6, 24, 96, 384]) {
    const setup = buildSetupFromArmies({ regionId: 'scale', terrain: 'mixed', seed: 3, attackerUnits: mk('a', n), defenderUnits: mk('d', n), attackerAgeId: 'classical', defenderAgeId: 'classical', controllers: ['ai', 'ai'], deposits: [], powers: [[], []], battleType: 'field' });
    const w = createWorld(setup);
    w.squads.forEach((q) => { q.reserve = false; q.onField = true; q.enterTick = 0; });
    const t0 = performance.now(); let ticks = 0;
    while (!w.ended && ticks < 1200) { step(w, []); w.events.length = 0; ticks++; }
    const ms = (performance.now() - t0) / ticks;
    console.log(`SCALE squadsPerSide=${n} total=${w.squads.length} ticks=${ticks} msPerTick=${ms.toFixed(3)} ended=${w.ended}`);
  }
}, 600000);
