// src/battle/render/capacity.test.js
// The battlefield's instanced meshes are sized for the battle (phase C): a 300-a-side battle gets
// a marker for every squad and a figure for every soldier, not the old fixed 64 and 640.
import { describe, it, expect } from 'vitest';
import { squadSlots, soldierSlots, MIN_SQUAD_SLOTS, MIN_SOLDIER_SLOTS } from './capacity';
import { makeBenchSetup } from '../bench/benchScenario';
import { getBattleStats } from '../data/battleStats';
import { createWorld } from '../sim/world';

describe('render capacity', () => {
  it('a small battle keeps the minimum pools', () => {
    const setup = makeBenchSetup(10);
    expect(squadSlots(setup)).toBe(MIN_SQUAD_SLOTS);
    expect(soldierSlots(setup, 'classical', 'infantry')).toBe(MIN_SOLDIER_SLOTS);
  });

  it('300 a side: every squad and every soldier of each class has a slot', () => {
    const setup = makeBenchSetup(300);
    const w = createWorld(setup);
    expect(squadSlots(setup)).toBeGreaterThanOrEqual(w.squads.length);
    ['infantry', 'ranged', 'cavalry', 'siege', 'support'].forEach((classId) => {
      const soldiers = w.squads.filter((q) => q.classId === classId).length * getBattleStats(classId, 'classical').soldiers;
      expect(soldierSlots(setup, 'classical', classId)).toBeGreaterThanOrEqual(soldiers);
    });
  });
});
