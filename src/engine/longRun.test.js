// src/engine/longRun.test.js
// Whole-world stress runs: 150 turns of all 240 nations from a fixed seed, with a passive player
// who answers peace offers (a free white peace is accepted, anything that costs is refused).
//   - Deterministic: the same seed twice gives the identical world, turn by turn (a save/load
//     or a multiplayer replay can never drift).
//   - Numerically sound: no NaN/Infinity anywhere in resources, nations or provinces.
//   - No runaway: no nation snowballs past a third of the world's provinces, and the war-cost
//     systems (levy, casualty scars, devastation) never push a province below its floor.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { createInitialState, gameReducer } from '../context/GameContext';
import { ActionTypes, GameStatus } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { REGIONS_DATA } from '../data/regions';
import { POPULATION_FLOOR_RATIO } from './population';
import { assertGameState } from './stateAudit';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
// The passive player is Australia: on the Dawn world every nation is one city, so a passive
// player with neighbours is conquered within 50 turns (one lost city is the game), which would
// end the run before the world is stressed. Canberra borders nobody.
const world = (seed) => ({
  ...createInitialState({ playerNationId: 'au', rngSeed: seed }),
  firedEvents, proceduralEventCooldown: 999999, battleSettings: { autoDefend: true }
});
const advance = (state) => {
  const answered = state.pendingPeaceOffer
    ? gameReducer(state, { type: state.pendingPeaceOffer.terms?.length ? ActionTypes.REJECT_PENDING_PEACE : ActionTypes.ACCEPT_PENDING_PEACE })
    : state;
  const next = resolveTurn(answered);
  return next.activeProceduralEvent ? { ...next, activeProceduralEvent: null } : next;
};

// A compact fingerprint of everything that matters: resources, every nation's key numbers, every
// province's owner/population/devastation, every unit, every war.
const fingerprint = (s) => {
  let h = 2166136261;
  const mix = (v) => { const str = String(v); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } };
  mix(s.turnNumber); mix(s.rngSeed); Object.entries(s.resources).forEach(([k, v]) => { mix(k); mix(v); });
  Object.keys(s.nations).sort().forEach((id) => { const n = s.nations[id]; mix(id); mix(n.militaryStrength); mix(n.warExhaustion); mix(n.isAtWar); mix(JSON.stringify(n.economy?.resources || null)); });
  Object.keys(s.regions).sort().forEach((id) => { const r = s.regions[id]; mix(r.owner); mix(r.currentPopulation); mix(r.devastation || 0); mix(r.control); });
  Object.keys(s.units).sort().forEach((id) => { const u = s.units[id]; mix(id); mix(u.regionId); mix(u.strength); });
  (s.wars || []).forEach((w) => { mix(w.id); mix(w.active); mix(w.score); });
  return h >>> 0;
};

const badNumbers = (s) => {
  const bad = [];
  const check = (where, v) => { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(where); };
  Object.entries(s.resources).forEach(([k, v]) => check(`resources.${k}`, v));
  Object.entries(s.nations).forEach(([id, n]) => {
    ['militaryStrength', 'warExhaustion', 'stability', 'prestige', 'libertyDesire'].forEach((k) => check(`${id}.${k}`, n[k]));
    Object.entries(n.economy?.resources || {}).forEach(([k, v]) => check(`${id}.economy.${k}`, v));
  });
  Object.entries(s.regions).forEach(([id, r]) => { check(`${id}.pop`, r.currentPopulation); check(`${id}.dev`, r.devastation); check(`${id}.control`, r.control); });
  return bad;
};

describe('whole-world long runs', () => {
  it('150 turns: deterministic turn by turn, finite everywhere, no runaway, provinces above their floor', () => {
    const TURNS = 150;
    let a = world(4242); let b = world(4242);
    const prints = [];
    let warsDeclared = 0;
    for (let t = 0; t < TURNS && a.gameStatus === GameStatus.ACTIVE; t++) {
      a = advance(a); b = advance(b);
      warsDeclared += a.logs.filter((l) => l.year === a.year && /declared war/.test(l.message)).length;
      assertGameState(a);
      const pa = fingerprint(a);
      expect(fingerprint(b), `diverged at turn ${a.turnNumber}`).toBe(pa);
      if (t === 49 || t === TURNS - 1) {
        expect(badNumbers(a), `non-finite values at turn ${a.turnNumber}`).toEqual([]);
        prints.push(pa);
      }
    }
    expect(a.turnNumber).toBeGreaterThanOrEqual(100); // the run didn't stall on something unanswered
    const counts = {};
    Object.values(a.regions).forEach((r) => { counts[r.owner] = (counts[r.owner] || 0) + 1; });
    const total = Object.keys(a.regions).length;
    expect(Math.max(...Object.values(counts)) / total).toBeLessThan(1 / 3);
    Object.entries(a.regions).forEach(([id, r]) => {
      const floor = (REGIONS_DATA[id]?.population || 0) * POPULATION_FLOOR_RATIO;
      if (floor > 0) expect(r.currentPopulation, id).toBeGreaterThanOrEqual(Math.floor(floor));
      expect(r.devastation || 0).toBeLessThanOrEqual(100);
    });
    // Wars happen over 150 turns (on the Dawn world a one-city war ends within a few turns and
    // leaves the war list, so the declarations seen along the way are what counts).
    expect(warsDeclared).toBeGreaterThan(0);
  }, 600000);
});
