// .claude/skills/battle-lab/viewcost.sim.js
// What one render frame costs to build in the worker and to hand to the screen, plain view
// (view.js, structured clone) against packed frame (packedView.js, transferred buffer), at N
// squads a side once the armies are in contact.
//   SIZES=300,500 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/viewcost
// Node's structuredClone stands in for postMessage (both serialize, then deserialize on arrival).
import { it } from 'vitest';
import { makeBenchWorld } from '../../../src/battle/bench/benchScenario';
import { step } from '../../../src/battle/sim/step';
import { makeRenderView } from '../../../src/battle/render/view';
import { createViewPacker, createViewDecoder } from '../../../src/battle/render/packedView';

const sizes = (process.env.SIZES || '300,500').split(',').map(Number);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

it('render frame cost: plain vs packed', () => {
  sizes.forEach((n) => {
    const w = makeBenchWorld(n, 7);
    for (let t = 0; t < 400; t++) { step(w, []); w.events.length = 0; }
    const packer = createViewPacker(); const decode = createViewDecoder();
    const r = { build: [], clone: [], pack: [], packSlow: [], move: [], decode: [], read: [] };
    for (let k = 0; k < 60; k++) {
      let t0 = performance.now(); const v = makeRenderView(w, [], 0, false); r.build.push(performance.now() - t0);
      t0 = performance.now(); structuredClone(v); r.clone.push(performance.now() - t0);
      t0 = performance.now(); const slow = packer.pack(w, [], 0, { fog: false, slow: true }); r.packSlow.push(performance.now() - t0);
      t0 = performance.now(); const fast = packer.pack(w, [], 0, { fog: false, slow: false }); r.pack.push(performance.now() - t0);
      decode(slow.packed);
      t0 = performance.now(); const moved = structuredClone(fast.packed, { transfer: fast.transfer }); r.move.push(performance.now() - t0);
      t0 = performance.now(); const view = decode(moved); r.decode.push(performance.now() - t0);
      // What the renderer reads per squad each screen frame (x, y, facing, flags, strength).
      t0 = performance.now(); let s = 0; view.squads.forEach((q) => { if (q.alive && q.onField) s += q.x + q.y + q.facing + q.strength; }); r.read.push(performance.now() - t0);
    }
    const m = Object.fromEntries(Object.entries(r).map(([k, a]) => [k, +median(a).toFixed(3)]));
    console.log(`${n} a side (${w.squads.length} squads), median ms:`);
    console.log(`  plain : build ${m.build} + clone ${m.clone} = ${(m.build + m.clone).toFixed(2)} per tick`);
    console.log(`  packed: pack ${m.pack} (with slow part ${m.packSlow}, 1 tick in 5) + transfer ${m.move} + decode ${m.decode} = ${(m.pack + m.move + m.decode).toFixed(2)} per tick; renderer reads ${m.read}`);
  });
});
