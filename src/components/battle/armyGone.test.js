// src/components/battle/armyGone.test.js
// battle-engage (warmonger playtest 40650973042 step 84, civ-veteran 40650976677 step 129): a city
// held by its militia alone, commanded on purpose, lost its one squad in two minutes and the screen
// showed "All 0" with the clock still running. The view the screen reads must say the army is gone,
// so it offers Finish now and Auto.
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../battle/sim/world';
import { step } from '../../battle/sim/step';
import { makeRenderView } from '../../battle/render/view';
import { town } from '../../battle/sim/assaultTestTown';
import { armyGone } from './battleHudModel';

describe('armyGone on a real battle', () => {
  it('a militia-only defence: not gone at the start, gone once the militia falls, while the battle runs on', () => {
    const w = createWorld(town({ fort: 1, ageId: 'classical', def: [], controllers: ['ai', 'player'], att: ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged'], strA: 800, terrain: 'plains' }));
    expect(armyGone(makeRenderView(w, [], 1, false), 1)).toBe(false);
    let goneAt = -1;
    for (let t = 0; t < 20 * 200 && !w.ended && goneAt < 0; t++) {
      step(w, []);
      if (t % 20 === 0 && armyGone(makeRenderView(w, [], 1, false), 1)) goneAt = w.tick;
    }
    expect(goneAt).toBeGreaterThan(0);
    expect(w.ended).toBeFalsy(); // Q3: its buildings still stand, so the battle is not over by itself
  }, 60000);
});
