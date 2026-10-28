// src/utils/weakNeighbour.test.js
// aiLogic.js weakNeighbourMult: a stronger bordering major rolls 1.5x on the player (lane wars-8).
import { describe, it, expect } from 'vitest';
import { weakNeighbourMult, WEAK_NEIGHBOUR_WAR_MULT, WEAK_NEIGHBOUR_REF_TURNS } from './aiLogic';
import { neighbourWorld, rivalOf } from '../engine/testWorld';
import { speedTurns } from '../data/ages';
describe('the weak-neighbour war roll (lane wars-8)', () => {
  const base = neighbourWorld({ seed: 1, age: 'bronze' });
  const me = base.playerNationId; const r = rivalOf(base, 0);
  const late = speedTurns(WEAK_NEIGHBOUR_REF_TURNS, base.gameSpeed, 'stone') * 20; // past the wait at any age's multiplier
  const world = (rStrength, pStrength, patch = {}) => ({ ...base, units: {}, turnNumber: late, ...patch,
    nations: { ...base.nations, [r]: { ...base.nations[r], militaryStrength: rStrength, ...(patch.rival || {}) }, [me]: { ...base.nations[me], militaryStrength: pStrength } } });

  it('only a stronger bordering major, only on the player, only after the reference wait', () => {
    expect(weakNeighbourMult(world(5000, 1000), r, me)).toBe(WEAK_NEIGHBOUR_WAR_MULT);
    expect(weakNeighbourMult(world(1000, 5000), r, me)).toBe(1); // weaker: no factor
    expect(weakNeighbourMult(world(5000, 1000), r, rivalOf(base, 1))).toBe(1); // not the player
    expect(weakNeighbourMult(world(5000, 1000, { turnNumber: 1 }), r, me)).toBe(1); // too early
  });

  it('not while a demand the player met still holds', () => {
    const s = world(5000, 1000, { rival: { demandMet: { [me]: { until: late + 5, kind: 'tribute' } } } });
    expect(weakNeighbourMult(s, r, me)).toBe(1);
  });
});
