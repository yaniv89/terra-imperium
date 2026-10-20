// src/engine/battleSwitch.test.js
// Audit H-01: "Switch to Auto" in the middle of a commanded battle went back to the start (dead
// squads came back, the enemy at full strength): a free re-roll. Auto now goes on from the battle
// as it stands at the switch (battleSwitch.js, autoBattle.js continueFrom), checked by replaying
// the commanded part to the switch tick, through the one outcome service, with a balanced ledger.
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { buildCommandedSetup, setupKeyOf, SETUP_VERSION } from '../battle/setup/buildBattleSetup';
import { createBattleLoop } from '../battle/worker/battleLoop';
import { deployZone } from '../battle/sim/world';
import { Q } from '../battle/sim/constants';
import { getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities, neighbourWorld } from './testWorld';
import { switchedBattleState } from './battleSwitch';
import { continueFrom } from './autoBattle';
import { ledgerOf, conserved } from './battleLedger';
import { auditGameState } from './stateAudit';
import { modeText } from '../components/battle/battleReportsModel';

const WORLD = (() => {
  const base = neighbourWorld({ player: 'ahhiyawa', seed: 1 });
  const me = base.playerNationId;
  const first = addCity(base, me);
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== me) || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== me);
  const enemy = first.state.regions[target].owner;
  const grown = addCities(first.state, enemy, 3);
  return { state: grown.state, me, enemy, from: first.cityId, target };
})();
const { me: ME, enemy: ENEMY, from: FROM, target: TARGET } = WORLD;
const GATE = getTouchingIds(FROM).includes(TARGET) ? null : getTiles().neighbors[WORLD.state.regions[TARGET].tile].find((n) => getTiles().land[n] === 1);
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1,
  ...(regionId === FROM && GATE != null ? { tile: GATE } : {})
});
const started = (() => {
  const s = WORLD.state;
  const state = {
    ...s,
    resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
    wars: [...s.wars, { id: 'war_t', aggressor: ME, enemy: ENEMY, active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }],
    units: {
      // A strong army whose commander throws one regiment (a2) away alone: on Auto from the start
      // that regiment would live; commanded, it is dead before the switch.
      a1: unit('a1', FROM, ME), a2: unit('a2', FROM, ME, 'cavalry', 300), a3: unit('a3', FROM, ME, 'ranged'), a4: unit('a4', FROM, ME), a5: unit('a5', FROM, ME),
      d1: unit('d1', TARGET, ENEMY), d2: unit('d2', TARGET, ENEMY, 'ranged', 800)
    }
  };
  return gameReducer(state, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FROM, targetRegionId: TARGET } });
})();
const pb = started.pendingBattle;

// The live battle as the screen runs it (battleLoop.js): deploy, attack, fight until a regiment of
// ours is dead and both sides have lost men, then the screen's snapshot at that moment.
const commandUntilLosses = () => {
  const setup = buildCommandedSetup(started, pb);
  const messages = [];
  const loop = createBattleLoop({ setup, post: (m) => messages.push(m) });
  const w = loop.world;
  const side = setup.controllers.indexOf('player');
  const army = () => w.squads.filter((q) => q.side === side && !q.eco && q.alive && q.onField).map((q) => q.idx);
  loop.setPaused(true);
  let now = 0;
  loop.frame(now);
  const zone = deployZone(w, side);
  loop.pushOrders([{ side, type: 'deploy', squads: army(), x: Math.round(zone.x1 * Q), y: Math.round(((zone.y0 + zone.y1) / 2) * Q), formation: 'line' }]);
  loop.setPaused(false);
  const keep = setup.structures[0];
  let ordered = false;
  const lost = (s) => w.squads.filter((q) => q.side === s && !q.eco).reduce((a, q) => a + (q.startStrength - Math.max(0, q.strength)), 0);
  const lone = w.squads.find((q) => q.unitId === 'a2');
  for (let f = 0; f < 200000 && !w.ended; f++) {
    now += 50;
    loop.frame(now);
    if (!ordered && w.tick > 2) { loop.pushOrders([{ side, type: 'attackMove', squads: [lone.idx], x: keep.x, y: keep.y, formation: 'line' }, { side, type: 'hold', squads: army().filter((i) => i !== lone.idx) }]); ordered = true; }
    if (!lone.alive && lost(1 - side) > 0) break;
  }
  expect(w.ended, 'the battle must still be on at the switch').toBeFalsy();
  loop.setPaused(true);
  loop.snapshot();
  const snap = messages.filter((m) => m.type === 'snapshot').pop();
  const atSwitch = {};
  w.squads.filter((q) => !q.eco).forEach((q) => { atSwitch[q.unitId] = { side: q.side, strength: q.alive ? Math.max(0, q.strength) : 0, start: q.startStrength }; });
  return { setup, snap, atSwitch, switchAt: { log: snap.log, tick: snap.tick, hash: snap.hash, setupKey: setupKeyOf(setup), setupVersion: SETUP_VERSION } };
};

let memo = null;
const played = () => { memo = memo || commandUntilLosses(); return memo; };

describe('Switch to Auto part-way through a commanded battle (H-01)', () => {
  it('no dead regiment comes back, nobody ends stronger than at the switch, and the losses at least stand', () => {
    const { atSwitch, switchAt } = played();
    const dead = Object.keys(atSwitch).filter((id) => atSwitch[id].strength <= 0 && started.units[id]);
    expect(dead).toContain('a2');
    const next = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { switchAt } });
    expect(next.pendingBattle).toBeNull();
    dead.forEach((id) => expect(next.units[id], id).toBeUndefined());
    Object.entries(atSwitch).forEach(([id, at]) => {
      if (!started.units[id]) return; // the militia lives on the battle only
      expect(next.units[id]?.strength ?? 0, id).toBeLessThanOrEqual(at.strength);
    });
    const entry = next.battleReports[0];
    const lostAt = (s) => Object.entries(atSwitch).filter(([id, at]) => at.side === s && started.units[id]).reduce((a, [id, at]) => a + started.units[id].strength - at.strength, 0);
    const sumFallen = (s) => entry.sides[s].filter((u) => started.units[u.id]).reduce((a, u) => a + (u.before - Math.max(0, u.after)), 0);
    expect(sumFallen('attacker')).toBeGreaterThanOrEqual(lostAt(0));
    expect(sumFallen('defender')).toBeGreaterThanOrEqual(lostAt(1));
  }, 120000);

  it('the old way (Auto from the start) would have handed the dead back: the switch is no re-roll', () => {
    const { switchAt } = played();
    const fresh = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    const switched = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { switchAt } });
    expect(fresh.battleReports[0].switchedAtSec).toBeUndefined();
    expect(fresh.units.a2?.strength, 'the bug: Auto from the start brings a2 back').toBeGreaterThan(0);
    expect(switched.units.a2).toBeUndefined();
    // deterministic: the same switch gives the same result
    const again = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { switchAt } });
    expect(again.units).toEqual(switched.units);
    expect(again.battleReports[0].outcome).toBe(switched.battleReports[0].outcome);
  }, 120000);

  it('one outcome, a balanced ledger, and the report says Command then Auto with how the replay checked', () => {
    const { switchAt, snap } = played();
    const next = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { switchAt } });
    expect(next.appliedBattleIds.filter((id) => id === pb.id)).toHaveLength(1);
    const entry = next.battleReports[0];
    expect(entry.commanded).toBe(true);
    expect(entry.switchedAtSec).toBe(Math.round(snap.tick / 20));
    expect(entry.verification).toBe('verified');
    expect(modeText(entry)).toBe('Command, then Auto');
    expect(next.lastBattleReport.tactical).toMatchObject({ mode: 'switched', verified: true, switchedAtTick: snap.tick });
    const ledger = ledgerOf(entry);
    [ledger.mine, ledger.theirs].forEach((t) => { expect(t.before).toBe(t.after + t.fallen + t.fled); expect(conserved(t)).toBe(true); });
    expect(auditGameState(next).filter((i) => i.code === 'battle_ledger')).toEqual([]);
    // a forged hash is not trusted: the replay stands, marked desync
    const forged = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE, payload: { switchAt: { ...switchAt, hash: 1 } } });
    expect(forged.units).toEqual(next.units);
    expect(forged.lastBattleReport.tactical.verification.status).toBe('desync');
  }, 120000);

  it('switchedBattleState: nothing to go on from before the battle starts or for a log of other rules', () => {
    const { switchAt } = played();
    expect(switchedBattleState(started, pb, null)).toBeNull();
    expect(switchedBattleState(started, pb, { ...switchAt, tick: 0 })).toBeNull();
    expect(switchedBattleState(started, pb, { ...switchAt, setupVersion: SETUP_VERSION - 1 })).toBeNull();
    expect(switchedBattleState(started, pb, switchAt, { build: () => { throw new Error('no grid'); } })).toBeNull();
  }, 120000);
});

describe('continueFrom', () => {
  it('strength only down, the dead and the fled set aside, the walls at their remaining share', () => {
    const ins = { attackerUnits: [{ id: 'a', strength: 1000, morale: 90 }, { id: 'b', strength: 500, morale: 90 }, { id: 'c', strength: 300, morale: 90 }], defenderUnits: [{ id: 'd', strength: 800, morale: 80 }, { id: 'm', strength: 250, morale: 70, militia: true }], militia: [{ id: 'm', strength: 250, militia: true }], hpRatio: 0.8 };
    const from = { units: { a: { strength: 1200, morale: 40, disposition: 'field' }, b: { strength: 0, morale: 0, disposition: 'dead' }, c: { strength: 200, morale: 10, disposition: 'fled' }, d: { strength: 300, morale: 60, disposition: 'field' }, m: { strength: 0, disposition: 'dead' } }, wallsShare: 0.5 };
    const { ins: out, aside } = continueFrom(ins, from);
    expect(out.attackerUnits).toEqual([{ id: 'a', strength: 1000, morale: 40 }]);
    expect(out.defenderUnits).toEqual([{ id: 'd', strength: 300, morale: 60 }]);
    expect(out.militia).toEqual([]);
    expect(out.hpRatio).toBeCloseTo(0.4);
    expect(aside[0].map((u) => [u.id, u.strength, u.disposition])).toEqual([['b', 0, 'dead'], ['c', 200, 'fled']]);
    expect(aside[1].map((u) => [u.id, u.disposition])).toEqual([['m', 'dead']]);
  });
});
