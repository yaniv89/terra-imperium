import { describe, it, expect } from 'vitest';
import { gameReducer, startState } from './gameReducer';
import { ActionTypes } from '../data/types';
import { isBand } from './settlers';

// A band start (U23): no major holds land before its first village. The territory reconcile after
// RESET_GAME and after the player's first FOUND_CITY eliminated every AI major and deleted its band.
describe('band start keeps the AI peoples', () => {
  it('no major falls on RESET_GAME or the player founding its village', () => {
    const payload = { playerNationId: 'kemet', scenario: { mode: 'peoples', size: 'small', cityStates: 'normal', seed: 5, band: true }, rngSeed: 5 };
    const s = gameReducer(startState(payload), { type: ActionTypes.RESET_GAME, payload });
    const majors = Object.values(s.nations).filter((n) => n.kind !== 'independent' && n.id !== s.playerNationId);
    expect(majors.length).toBeGreaterThan(3);
    majors.forEach((n) => {
      expect(n.isEliminated, n.id).toBeFalsy();
      expect(Object.values(s.units).some((u) => u.ownerId === n.id && isBand(u)), n.id).toBe(true);
    });
    const band = Object.values(s.units).find((u) => u.ownerId === s.playerNationId && isBand(u));
    const founded = gameReducer(s, { type: ActionTypes.FOUND_CITY, payload: { unitId: band.id } });
    expect(Object.values(founded.regions).some((c) => c.owner === s.playerNationId)).toBe(true);
    expect(majors.filter((n) => founded.nations[n.id].isEliminated)).toEqual([]);
  }, 60000);
});

describe('war while still a band', () => {
  it('an unjustified war before the first village does not crash', () => {
    const payload = { playerNationId: 'kemet', scenario: { mode: 'peoples', size: 'small', cityStates: 'normal', seed: 5, band: true }, rngSeed: 5 };
    const s0 = startState(payload);
    const foe = Object.values(s0.nations).find((n) => n.kind !== 'independent' && n.id !== s0.playerNationId);
    const s = { ...s0, resources: { ...s0.resources, gold: 5000 }, fog: s0.fog && { ...s0.fog, met: { ...s0.fog.met, kemet: { ...(s0.fog.met?.kemet || {}), [foe.id]: 1 } } } };
    const next = gameReducer(s, { type: ActionTypes.DECLARE_WAR, payload: { nationId: foe.id } });
    expect(next.wars.some((w) => w.active && w.enemy === foe.id && w.aggressor === 'kemet')).toBe(true);
  }, 60000);
});
