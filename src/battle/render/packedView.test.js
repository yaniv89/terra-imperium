// Packed render frames (RTS plan 13.3): a decoded packed frame reads exactly like the plain view
// makeRenderView builds, the squads travel in one transferable buffer, and the slow fields carry
// over between the frames that leave them out.
import { describe, it, expect } from 'vitest';
import { createViewPacker, createViewDecoder, SQUAD_STRIDE } from './packedView';
import { makeRenderView } from './view';
import { makeBenchWorld } from '../bench/benchScenario';
import { step } from '../sim/step';

const plain = (v) => JSON.parse(JSON.stringify(v));

describe('packed render frames', () => {
  it('decode to the same view as makeRenderView, tick after tick', () => {
    const w = makeBenchWorld(30, 3);
    const packer = createViewPacker(); const decode = createViewDecoder();
    for (let t = 0; t < 300; t++) {
      step(w, []);
      w.events.length = 0;
      if (t % 37 !== 0 && t !== 299) continue;
      [0, 1].forEach((side) => {
        const { packed, transfer } = createViewPacker().pack(w, [], side, { fog: true, slow: true });
        expect(transfer).toEqual([packed.squads]);
        expect(packed.squads.byteLength).toBe(w.squads.length * SQUAD_STRIDE * 8);
        expect(plain(createViewDecoder()(packed))).toEqual(plain(makeRenderView(w, [], side, true)));
      });
      // The same packer and decoder across frames, slow part only every few.
      const view = decode(packer.pack(w, [], 0, { fog: false, slow: t % 74 === 0 }).packed);
      expect(plain(view.squads)).toEqual(plain(makeRenderView(w, [], 0, false).squads).map((s, i) => ({ ...s, abilities: view.squads[i].abilities, callCost: view.squads[i].callCost })));
    }
  });

  it('keeps two decoded frames independent (the screen interpolates between them)', () => {
    const w = makeBenchWorld(10, 4);
    const packer = createViewPacker(); const decode = createViewDecoder();
    const a = decode(packer.pack(w).packed);
    const ax = a.squads.map((s) => s.x);
    for (let t = 0; t < 120; t++) { step(w, []); w.events.length = 0; }
    const b = decode(packer.pack(w, [], 0, { slow: false }).packed);
    expect(a.squads.map((s) => s.x)).toEqual(ax);
    expect(b.squads.some((s, i) => s.x !== ax[i])).toBe(true);
    expect(b.squads[3].classId).toBe(a.squads[3].classId);
  });
});
