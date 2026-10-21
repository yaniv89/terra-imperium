// src/engine/consequences.test.js
// U25: the preview matches what the capture does, and never writes state.
import { describe, it, expect } from 'vitest';
import { coalitionIfTaken, loyaltyIfTaken, consequencesOfTaking } from './consequences';
import { conquerRegion } from './conquest';
import { updateDefensivePacts, PACT_FORM_AE } from './pacts';
import { peoplesWorld, rivalOf, cap } from './testWorld';

const world = () => {
  const s = peoplesWorld({ seed: 9 });
  const nations = { ...s.nations };
  Object.keys(nations).forEach((id) => { if (id !== s.playerNationId) nations[id] = { ...nations[id], ae: { [s.playerNationId]: PACT_FORM_AE - 1 } }; });
  return { ...s, nations };
};

describe('consequences of taking a city', () => {
  const state = world();
  const me = state.playerNationId;
  const target = cap(rivalOf(state, 0));

  it('the coalition preview matches the pacts after a real capture', () => {
    const { regions, nations } = conquerRegion(state, target, me);
    const after = updateDefensivePacts(nations, { playerNationId: me, turnNumber: state.turnNumber }).nations;
    const real = Object.keys(after).filter((id) => after[id].defensivePact?.against === me).sort();
    expect(regions[target].owner).toBe(me);
    expect(coalitionIfTaken(state, target)).toEqual(real);
    expect(real.length).toBeGreaterThan(1);
  });

  it('projects loyalty for a city that is not yet ours', () => {
    const f = loyaltyIfTaken(state, target);
    expect(f.loyalty).toBe(50);
    expect(f.graceLeft).toBe(10);
  });

  it('changes nothing and ignores a city already ours', () => {
    const before = JSON.stringify(state);
    consequencesOfTaking(state, target);
    expect(JSON.stringify(state)).toBe(before);
    expect(coalitionIfTaken(state, cap(me))).toEqual([]);
    expect(loyaltyIfTaken(state, cap(me))).toBeNull();
  });
});
