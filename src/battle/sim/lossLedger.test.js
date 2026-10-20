// src/battle/sim/lossLedger.test.js
// H-03 (audits/mobile-campaign-2026-10-20): squads bled with lastHitTick never set; every loss is now
// booked under a cause (losses.js). battle-lab assaultTrace prints the causes.
import { describe, it, expect } from 'vitest';
import { createWorld } from './world';
import { step } from './step';
import { LOSS_CAUSES, lossTotal } from './losses';
import { makeRenderView } from '../render/view';
import { town, army } from './assaultTestTown';

describe('H-03: every loss has a cause', () => {
  it('a whole assault books every strength point lost under melee, ranged, tower, impact or attrition', () => {
    const w = createWorld(town({ controllers: ['ai', 'ai'] }));
    for (let i = 0; i < 20 * 240 && !w.ended; i++) { step(w, []); w.events.length = 0; }
    const squads = w.squads.filter((q) => !q.worker);
    const lost = squads.reduce((s, q) => s + (q.startStrength - q.strength), 0);
    expect(lost).toBeGreaterThan(0);
    // healing (wagons, aid posts) only gives back: booked >= lost, and booked == lost for squads never healed
    squads.forEach((q) => { expect(lossTotal(q)).toBeGreaterThanOrEqual(q.startStrength - q.strength); });
    expect(Object.keys(squads[0].lossBy).sort()).toEqual([...LOSS_CAUSES].sort());
  });

  it('the result reports each side\'s losses by cause, and the view shows your attrition', () => {
    const w = createWorld(town({ controllers: ['ai', 'ai'] }));
    const q = army(w, 0)[0];
    q.lossBy.attrition = 7;
    expect(makeRenderView(w, [], 0).squads[q.idx].attritionLost).toBe(7);
    expect(makeRenderView(w, [], 1).squads[q.idx].attritionLost).toBe(0); // not the enemy's
  });
});
