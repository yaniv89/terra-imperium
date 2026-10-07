import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { ActionTypes } from '../data/types';
import { turnBlockers, idleCities } from './turnBlockers';
import { nextPrompts } from '../components/ui/nextPromptModel';

const BUILD = { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 };

// A game with nothing to answer: research chosen, every city building something.
const settledGame = () => {
  const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const regions = Object.fromEntries(Object.entries(S.regions).map(([id, c]) => [id, c.owner === 'fr' ? { ...c, production: BUILD } : c]));
  return { ...S, regions, research: { ...S.research, current: 'science_cuneiform_records', queue: [], auto: false }, activeEventId: null, activeProceduralEvent: null, pendingPeaceOffer: null, pendingDefenses: [], pendingDemand: null, tributeDemands: [], joinOffers: [], pendingBattle: null };
};
const otherNation = (S, n = 0) => Object.keys(S.nations).filter((id) => id !== 'fr' && !S.nations[id].isEliminated)[n];

describe('turn blockers', () => {
  it('nothing blocks a settled turn', () => {
    expect(turnBlockers(settledGame())).toEqual([]);
  });

  it('a city with nothing to build blocks, one entry per city, and opens its build tab', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const idle = { ...S, regions: { ...S.regions, [cap]: { ...S.regions[cap], production: { current: null, queue: [], progress: 0 } } } };
    const b = turnBlockers(idle);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ kind: 'city', label: `Choose production: ${S.regions[cap].name}`, target: { regionId: cap }, action: 'city' });
    expect(idleCities(idle).map((c) => c.id)).toEqual([cap]);
    // an outpost or a burning city builds nothing, so it never blocks
    expect(turnBlockers({ ...idle, regions: { ...idle.regions, [cap]: { ...idle.regions[cap], outpost: true } } })).toEqual([]);
    expect(turnBlockers({ ...idle, regions: { ...idle.regions, [cap]: { ...idle.regions[cap], razing: { by: 'fr', startedTurn: 1 } } } })).toEqual([]);
  });

  it('no research blocks only while something can be researched and no advisor picks', () => {
    const S = settledGame();
    const idle = { ...S, research: { ...S.research, current: null, queue: [] } };
    expect(turnBlockers(idle)).toEqual([expect.objectContaining({ kind: 'research', label: 'Choose research', action: 'research' })]);
    expect(turnBlockers({ ...idle, research: { ...idle.research, auto: true } })).toEqual([]);
    expect(turnBlockers({ ...idle, research: { ...idle.research, queue: ['x'] } })).toEqual([]);
  });

  it('every diplomacy answer, event, peace offer and queued battle blocks, in a fixed order', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const a = otherNation(S, 0); const b = otherNation(S, 1); const c = otherNation(S, 2);
    const all = {
      ...S,
      research: { ...S.research, current: null },
      regions: { ...S.regions, [cap]: { ...S.regions[cap], production: { current: null, queue: [], progress: 0 } } },
      pendingBattle: { kind: 'field' },
      activeEventId: 'some_event',
      pendingPeaceOffer: { from: a, warId: 'w1', terms: [] },
      pendingDefenses: [{ id: 'd1', kind: 'defense', regionId: cap }, { id: 'd2', kind: 'naval', tile: 5 }],
      pendingDemand: { from: a, kind: 'tribute', amount: 40, until: 9 },
      tributeDemands: [{ id: 't1', indepId: b, gold: 5, turns: 10, expires: 9 }],
      joinOffers: [{ id: 'j1', indepId: c, expires: 9 }]
    };
    const list = turnBlockers(all);
    expect(list.map((x) => x.kind)).toEqual(['battle', 'event', 'peace', 'defense', 'defense', 'demand', 'tribute', 'join', 'research', 'city']);
    const by = Object.fromEntries(list.map((x) => [x.id, x]));
    expect(by.peace.label).toBe(`Answer: ${S.nations[a].name} offers peace`);
    expect(by['defense:d1']).toMatchObject({ label: `Defend ${S.regions[cap].name}: Command or Auto`, action: 'defense' });
    expect(by['defense:d2'].label).toBe('Defend your fleet: Command or Auto');
    expect(by.demand).toMatchObject({ label: `Answer: ${S.nations[a].name} demands tribute`, action: 'diplomacy' });
    expect(by['tribute:t1']).toMatchObject({ label: `Answer: ${S.nations[b].name} demands tribute`, target: { demandId: 't1' }, action: 'tribute' });
    expect(by['join:j1']).toMatchObject({ label: `Answer: ${S.nations[c].name} offers to join`, target: { offerId: 'j1' }, action: 'join' });
    // every one has the full shape
    list.forEach((x) => { expect(typeof x.label).toBe('string'); expect(x).toHaveProperty('target'); expect(typeof x.action).toBe('string'); });
    // a request from a people that is gone blocks nothing
    const gone = { ...S, nations: { ...S.nations, [b]: { ...S.nations[b], isEliminated: true } }, tributeDemands: all.tributeDemands };
    expect(turnBlockers(gone)).toEqual([]);
  });

  it('units that can still move never block (they stay soft hints)', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const army = Object.values(S.units).find((u) => u.ownerId === 'fr' && u.domain === 'land');
    const field = { ...S, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 2, route: null } } };
    expect(nextPrompts(field).some((p) => p.kind === 'army')).toBe(true);
    expect(turnBlockers(field)).toEqual([]);
  });

  it('a finished game has no blockers', () => {
    const S = settledGame();
    expect(turnBlockers({ ...S, gameStatus: 'defeat', research: { ...S.research, current: null } })).toEqual([]);
  });

  it('the engine stays the same: ADVANCE_TURN runs over UI blockers; the player\'s fast forward stops at them', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const idle = { ...S, regions: { ...S.regions, [cap]: { ...S.regions[cap], production: { current: null, queue: [], progress: 0 } } }, research: { ...S.research, current: null } };
    expect(gameReducer(idle, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(idle.turnNumber + 1);
    expect(gameReducer(idle, { type: ActionTypes.FAST_FORWARD })).toBe(idle);
    const ff = gameReducer(S, { type: ActionTypes.FAST_FORWARD });
    expect(ff.turnNumber).toBeGreaterThan(S.turnNumber);
    // it stopped either at the cap, at an engine stop, or on the first turn that left a blocker
    const warKey = (s) => (s.wars || []).filter((w) => w.active).map((w) => w.id).join('|');
    if (ff.turnNumber - S.turnNumber < 20 && ff.gameStatus === S.gameStatus && warKey(ff) === warKey(S)) {
      expect(turnBlockers(ff).length).toBeGreaterThan(0);
    }
  });
});
