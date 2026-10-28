// The deploy card's one-tap presets (deployPresets.js): every squad gets one open slot in the zone,
// shooters stand behind the fighters, Wings puts the cavalry at both ends, Wide spreads the line.
import { describe, it, expect } from 'vitest';
import { deployPreset, presetFits, DEPLOY_PRESETS } from './deployPresets';

const map = { w: 60, h: 40, tiles: new Array(60 * 40).fill(0) };
const zone = { x0: 1, y0: 2, x1: 11, y1: 37 };
const army = [
  ...[0, 1, 2, 3].map((i) => ({ idx: i, classId: 'infantry', x: 6, y: 18 + i })),
  { idx: 4, classId: 'cavalry', x: 6, y: 10 }, { idx: 5, classId: 'cavalry', x: 6, y: 30 },
  { idx: 6, classId: 'ranged', x: 4, y: 19 }, { idx: 7, classId: 'siege', x: 3, y: 20 }
];
const at = (slots, idx) => slots.find((s) => s.idx === idx);

describe('deploy presets', () => {
  it('every preset gives each squad one slot inside the zone, on open ground', () => {
    map.tiles[20 * 60 + 9] = 2; // a rock where a slot would fall
    DEPLOY_PRESETS.forEach((id) => [0, 1].forEach((side) => {
      const z = side === 0 ? zone : { x0: 40, y0: 2, x1: 57, y1: 37 };
      const slots = deployPreset(id, { squads: army, zone: z, side, map });
      expect(slots.map((s) => s.idx).sort()).toEqual(army.map((q) => q.idx));
      slots.forEach((s) => {
        expect(s.x).toBeGreaterThanOrEqual(z.x0); expect(s.x).toBeLessThanOrEqual(z.x1 + 1);
        expect(s.y).toBeGreaterThanOrEqual(z.y0); expect(s.y).toBeLessThanOrEqual(z.y1 + 1);
        expect(map.tiles[Math.floor(s.y) * 60 + Math.floor(s.x)]).toBe(0);
      });
      // shooters and siege behind the fighters (the attacker faces +x, the defender -x)
      const dir = side === 0 ? 1 : -1;
      expect(dir * (at(slots, 0).x - at(slots, 6).x)).toBeGreaterThan(0);
      expect(dir * (at(slots, 0).x - at(slots, 7).x)).toBeGreaterThan(0);
    }));
  });

  it('wings puts the cavalry on both ends of the front; wide spreads wider than line', () => {
    const wings = deployPreset('wings', { squads: army, zone, side: 0, map });
    const footY = [0, 1, 2, 3].map((i) => at(wings, i).y);
    expect(at(wings, 4).y).toBeLessThan(Math.min(...footY));
    expect(at(wings, 5).y).toBeGreaterThan(Math.max(...footY));
    const span = (slots) => Math.max(...slots.map((s) => s.y)) - Math.min(...slots.map((s) => s.y));
    expect(span(deployPreset('wide', { squads: army, zone, side: 0, map }))).toBeGreaterThan(span(deployPreset('line', { squads: army, zone, side: 0, map })));
  });

  it('wings fits only an army with cavalry', () => {
    expect(presetFits('wings', army)).toBe(true);
    expect(presetFits('wings', army.filter((q) => q.classId !== 'cavalry'))).toBe(false);
    expect(presetFits('line', [])).toBe(true);
  });
});
