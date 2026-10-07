import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { turnBlockers } from '../../engine/turnBlockers';
import { endTurnButton, endTurnPress } from './endTurnModel';
import { goToBlocker } from './promptActions';
import { MANAGE_CITY, FOCUS_REGION } from '../map/marchEvents';
import { OPEN_RESEARCH_CHOICE, SHOW_PEACE_OFFER, SHOW_DEFENSE } from './uiEvents';
import { OPEN_TAB } from '../panels/panelEvents';
import { OPEN_TRIBUTE_DEMAND, OPEN_JOIN_OFFER } from '../independents/independentEvents';

const BUILD = { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 };
const EMPTY = { current: null, queue: [], progress: 0 };
const settledGame = () => {
  const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const regions = Object.fromEntries(Object.entries(S.regions).map(([id, c]) => [id, c.owner === 'fr' ? { ...c, production: BUILD } : c]));
  return { ...S, regions, research: { ...S.research, current: 'science_cuneiform_records', queue: [], auto: false }, activeEventId: null, activeProceduralEvent: null, pendingPeaceOffer: null, pendingDefenses: [], pendingDemand: null, tributeDemands: [], joinOffers: [], pendingBattle: null };
};

// The tap targets fire window events (the sheets listen); record them in node.
const fired = [];
let saved;
beforeAll(() => {
  saved = globalThis.window;
  const target = new EventTarget();
  target.dispatchEvent = (e) => { fired.push({ type: e.type, detail: e.detail }); return true; };
  globalThis.window = target;
});
afterAll(() => { globalThis.window = saved; });
const tap = (state, b) => { fired.length = 0; goToBlocker(state, b); return fired.map((e) => e.type); };

describe('the End Turn call to action', () => {
  it('reads End Turn and ends the turn when nothing blocks; no confirmation for units that can move', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const army = Object.values(S.units).find((u) => u.ownerId === 'fr' && u.domain === 'land');
    const field = { ...S, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 2, route: null } } };
    expect(endTurnButton(field)).toMatchObject({ mode: 'ready', label: 'End Turn', badge: null });
    expect(endTurnPress(field)).toEqual({ end: true });
  });

  it('names the first blocker with a +N badge for the rest, and a tap goes there', () => {
    const S = settledGame();
    const cities = Object.values(S.regions).filter((c) => c.owner === 'fr' && c.tile != null && !c.outpost).map((c) => c.id).sort();
    const first = cities[0];
    const idle = { ...S, regions: { ...S.regions, [first]: { ...S.regions[first], production: EMPTY } } };
    const one = endTurnButton(idle);
    expect(one).toMatchObject({ mode: 'blocker', label: `Choose production: ${S.regions[first].name}`, badge: null, count: 1 });
    const both = { ...idle, research: { ...idle.research, current: null } };
    const two = endTurnButton(both);
    expect(two).toMatchObject({ mode: 'blocker', label: 'Choose research', badge: '+1', count: 2 });
    expect(endTurnPress(both)).toEqual({ go: turnBlockers(both)[0] });
    // the press goes to the blocker, never ends the turn
    expect(endTurnPress(both).end).toBeUndefined();
  });

  it('each blocker opens exactly its own thing', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const other = Object.keys(S.nations).find((id) => id !== 'fr');
    const all = {
      ...S,
      research: { ...S.research, current: null },
      regions: { ...S.regions, [cap]: { ...S.regions[cap], production: EMPTY } },
      activeProceduralEvent: { id: 'p', cityId: cap },
      pendingPeaceOffer: { from: other, terms: [] },
      pendingDefenses: [{ id: 'd1', kind: 'defense', regionId: cap }],
      pendingDemand: { from: other, kind: 'tribute', amount: 10, until: 9 },
      tributeDemands: [{ id: 't1', indepId: other }],
      joinOffers: [{ id: 'j1', indepId: other }]
    };
    const by = Object.fromEntries(turnBlockers(all).map((b) => [b.kind, b]));
    expect(tap(all, by.city)).toEqual([MANAGE_CITY]);
    expect(fired[0].detail).toEqual({ regionId: cap, tab: 'build' });
    expect(tap(all, by.research)).toEqual([OPEN_RESEARCH_CHOICE]);
    expect(tap(all, by.demand)).toEqual([OPEN_TAB]);
    expect(fired[0].detail).toBe('diplomacy');
    expect(tap(all, by.tribute)).toEqual([OPEN_TRIBUTE_DEMAND]);
    expect(fired[0].detail).toBe('t1');
    expect(tap(all, by.join)).toEqual([OPEN_JOIN_OFFER]);
    expect(fired[0].detail).toBe('j1');
    expect(tap(all, by.peace)).toEqual([SHOW_PEACE_OFFER]);
    expect(tap(all, by.defense)).toEqual([SHOW_DEFENSE]);
    expect(tap(all, by.event)).toEqual([FOCUS_REGION]);
    expect(endTurnButton(all).label).toBe('Answer the event');
  });

  it('the "warn me" setting arms one soft confirmation for units that can move, then ends', () => {
    const S = settledGame();
    const cap = getNationCapital('fr');
    const army = Object.values(S.units).find((u) => u.ownerId === 'fr' && u.domain === 'land');
    const warn = { ...S, battleSettings: { ...S.battleSettings, warnEndTurn: true }, units: { ...S.units, [army.id]: { ...army, tile: S.regions[cap].tiles.find((t) => t !== S.regions[cap].tile), movesLeft: 2, route: null } } };
    expect(endTurnPress(warn)).toEqual({ arm: true });
    expect(endTurnButton(warn, { armed: true })).toMatchObject({ mode: 'armed', label: 'End anyway? 1 waiting' });
    expect(endTurnPress(warn, { armed: true })).toEqual({ end: true });
    // with nothing soft waiting, the setting asks nothing
    expect(endTurnPress({ ...S, battleSettings: warn.battleSettings })).toEqual({ end: true });
  });

  it('Enter (the same press) does nothing while the world moves or the game is over', () => {
    const S = settledGame();
    expect(endTurnButton(S, { turnPending: true })).toMatchObject({ mode: 'moving', label: 'The world moves…' });
    expect(endTurnPress(S, { turnPending: true })).toEqual({ none: true });
    expect(endTurnPress({ ...S, gameStatus: 'defeat' })).toEqual({ none: true });
  });
});
