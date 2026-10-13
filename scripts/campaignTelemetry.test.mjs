import { describe, it, expect, vi } from 'vitest';
import { createScriptedPlayer, createTelemetry } from './campaignTelemetry.mjs';
import { parseArgs } from './simulate.mjs';

const AT = { ACCEPT_PENDING_PEACE: 'acceptPeace', REJECT_PENDING_PEACE: 'rejectPeace', RESOLVE_ALL_DEFENSES_AUTO: 'defAuto', ANSWER_TRIBUTE_DEMAND: 'tribute', ANSWER_DEMAND: 'demand', QUEUE_PRODUCTION: 'queue' };

const base = (over = {}) => ({
  playerNationId: 'p', turnNumber: 1, year: -2000, resources: { gold: 100, adm: 5, dip: 5, mil: 5 },
  nations: { p: {}, a: {}, b: {}, ind: { kind: 'independent' } }, regions: {}, units: {}, wars: [], logs: [], ...over
});

describe('scripted player', () => {
  it('answers a pending demand and a tribute demand per the policy and records them', () => {
    const gameReducer = vi.fn((s, a) => (a.type === AT.ANSWER_DEMAND ? { ...s, pendingDemand: null, resources: { ...s.resources, gold: s.resources.gold - 30 } } : a.type === AT.ANSWER_TRIBUTE_DEMAND ? { ...s, tributeDemands: [] } : s));
    const pay = createScriptedPlayer({ engine: { gameReducer, ActionTypes: AT }, demands: 'pay', production: false });
    const s = base({ pendingDemand: { from: 'a', kind: 'tribute', amount: 30 }, tributeDemands: [{ id: 't1', indepId: 'ind', gold: 12 }] });
    const out = pay.answer(s).state;
    expect(out.pendingDemand).toBeNull();
    expect(pay.log.demands[0]).toMatchObject({ from: 'a', quoted: 30, paid: 30, outcome: 'paid' });
    expect(pay.log.tribute[0]).toMatchObject({ from: 'ind', quoted: 12, outcome: 'paid' });
    expect(gameReducer).toHaveBeenCalledWith(expect.anything(), { type: AT.ANSWER_DEMAND, payload: { accept: true } });
    const refuse = createScriptedPlayer({ engine: { gameReducer, ActionTypes: AT }, production: false });
    refuse.answer(s);
    expect(refuse.log.demands[0].outcome).toBe('refused');
  });
  it('clears join offers and an open event so the turn can run', () => {
    const p = createScriptedPlayer({ engine: { gameReducer: (s) => s, ActionTypes: AT }, production: false });
    const out = p.answer(base({ joinOffers: [{ id: 1 }], activeEventId: 'x' })).state;
    expect(out.joinOffers).toEqual([]);
    expect(out.activeEventId).toBeNull();
  });
});

describe('telemetry', () => {
  const tiles = { neighbors: { 10: [11], 11: [10, 12], 12: [11] } };
  const mkTel = () => createTelemetry({ playerId: 'p', isIndependent: (n) => n?.kind === 'independent', getTiles: () => tiles });
  const unit = (id, owner, tile, extra = {}) => [id, { id, ownerId: owner, domain: 'land', classId: 'infantry', tile, strength: 10, ...extra }];

  it('measures war length, and classifies moved, shuttling and waiting stacks', () => {
    const tel = mkTel();
    const war = { id: 'w1', aggressor: 'a', enemy: 'b', active: true, startTurn: 1 };
    let prev = base({ wars: [war], units: Object.fromEntries([unit('u1', 'a', 10)]) });
    const step = (turn, tile, extra = {}, w = war) => {
      const next = { ...prev, turnNumber: turn, wars: [w], units: Object.fromEntries([unit('u1', 'a', tile, extra)]) };
      tel.observe(prev, next); prev = next;
    };
    step(2, 11); // moved
    step(3, 12); // moved
    step(4, 11); // back to the tile it left two turns ago: shuttle
    step(5, 11, { route: [12] }); // not moved, has a route: waiting
    step(6, 11); // not moved, no route, not home: idle in the field
    step(7, 11, {}, { ...war, active: false });
    const snap = tel.snapshot(prev);
    expect(snap.warsDeclaredMajors).toBe(1);
    expect(snap.warsEnded).toBe(1);
    expect(snap.warLenMax).toBe(6);
    const r = tel.report(prev).warStacks.w1;
    expect(r).toMatchObject({ moved: 2, shuttle: 1, waitRoute: 1 });
  });

  it('records the first unit, first building and a conquest kept 20 turns', () => {
    const tel = mkTel();
    const city = { id: 'c1', owner: 'p', tile: 1, buildings: { categories: {} }, lastYields: { production: 4 } };
    let prev = base({ regions: { c1: city }, units: Object.fromEntries([unit('s', 'p', 1, { classId: 'settler' })]) });
    const next = (turn, over) => { const n = { ...prev, turnNumber: turn, ...over }; tel.observe(prev, n); prev = n; return n; };
    next(2, {});
    next(3, { units: { ...prev.units, ...Object.fromEntries([unit('n', 'p', 1)]) } });
    next(4, { regions: { c1: { ...city, buildings: { categories: { food: 0 } } } } });
    const target = { id: 'c2', owner: 'b', tile: 5 };
    prev = { ...prev, regions: { ...prev.regions, c2: target } };
    next(5, { regions: { ...prev.regions, c2: { ...target, owner: 'a', conquest: { turn: 5 } } } });
    next(26, {});
    const snap = tel.snapshot(prev);
    expect(snap.firstUnitTurn).toBe(3);
    expect(snap.firstBuildingTurn).toBe(4);
    expect(snap.capturesTotal).toBe(1);
    expect(snap.conquestsKept20).toBe(1);
  });
});

describe('simulate.mjs options', () => {
  it('parses the telemetry options and rejects bad values', () => {
    expect(parseArgs(['--scenario', 'peoples', '--policy=scripted', '--demands', 'pay', '--speed', 'marathon', '--player', 'au'])).toMatchObject({ scenario: 'peoples', policy: 'scripted', demands: 'pay', speed: 'marathon', player: 'au' });
    expect(parseArgs([])).toMatchObject({ scenario: 'legacy', policy: 'passive' });
    expect(() => parseArgs(['--policy', 'bogus'])).toThrow('Invalid --policy');
  });
});
