// The Stone AI (eight-ages plan U36): bands settle at once, foragers research Agriculture first,
// a village people raids one neighbour at a time and only one it outnumbers, armies keep archers.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { resolveTurn } from './resolveTurn';
import { HISTORICAL_EVENTS } from '../data/events';
import { suggestTechs } from './research';
import { AGRICULTURE_TECH } from '../data/hearths';
import { getResearched } from './nationState';
import { stonePhaseOf } from './stonePhase';
import { majorIds } from './testWorld';

const firedEvents = Object.fromEntries(Object.keys(HISTORICAL_EVENTS).map((id) => [id, true]));
const bandWorld = (seed) => ({ ...createInitialState({ playerNationId: 'akkad', rngSeed: seed, scenario: { mode: 'peoples', size: 'small', seed, band: true } }), firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const step = (s) => { const n = resolveTurn(s.pendingPeaceOffer ? { ...s, pendingPeaceOffer: null } : s); return n.activeProceduralEvent ? { ...n, activeProceduralEvent: null } : n; };

describe('Stone AI', () => {
  it.each([3, 5, 9])('every AI major has a city by turn 2 (seed %i)', (seed) => {
    const s = step(step(bandWorld(seed)));
    majorIds(s).filter((id) => id !== s.playerNationId && !s.nations[id].isEliminated).forEach((id) => {
      expect(s.regions[s.nations[id].capitalRegionId]?.owner, id).toBe(id);
    });
  });

  it('a forager researches Agriculture first; a hearth people goes on by its doctrine', () => {
    const s = bandWorld(3);
    const ids = majorIds(s);
    const forager = ids.find((id) => !getResearched(s, id).includes(AGRICULTURE_TECH));
    const hearth = ids.find((id) => getResearched(s, id).includes(AGRICULTURE_TECH));
    expect(suggestTechs(s, forager, 1)).toEqual([AGRICULTURE_TECH]);
    if (hearth) expect(suggestTechs(s, hearth, 3)).not.toContain(AGRICULTURE_TECH);
  });

  it('no village people holds two raids at once', () => {
    let s = bandWorld(5);
    for (let t = 0; t < 40; t++) {
      s = step(s);
      const raids = {};
      s.wars.filter((w) => w.active && stonePhaseOf(s, w.aggressor) === 'village').forEach((w) => { raids[w.aggressor] = (raids[w.aggressor] || 0) + 1; });
      Object.entries(raids).forEach(([id, n]) => expect(n, `${id} turn ${s.turnNumber}`).toBeLessThanOrEqual(1));
    }
    expect(s.turnNumber).toBeGreaterThan(40);
  });
});
