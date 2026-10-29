// src/engine/longRun.test.js
// Whole-world stress runs: 150 turns of a small peoples world from a fixed seed, with a passive player
// who answers peace offers (a free white peace is accepted, anything that costs is refused).
//   - Deterministic: the same seed twice gives the identical world, turn by turn (a save/load
//     or a multiplayer replay can never drift).
//   - Numerically sound: no NaN/Infinity anywhere in resources, nations or provinces.
//   - No runaway: no nation snowballs past a third of the world's provinces, and the war-cost
//     systems (levy, casualty scars, devastation) never push a province below its floor.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { gameReducer } from '../context/GameContext';
import { peoplesWorld } from './testWorld';
import { ActionTypes, GameStatus } from '../data/types';
import { HISTORICAL_EVENTS } from '../data/events';
import { REGIONS_DATA } from '../data/regions';
import { POPULATION_FLOOR_RATIO } from './population';
import { assertGameState } from './stateAudit';
import { ageOf } from './nationState';
import { FIRST_AGE_ID } from '../data/ages';

const firedEvents = Object.keys(HISTORICAL_EVENTS).reduce((acc, id) => ({ ...acc, [id]: true }), {});
// The passive player is the world's default people (akkad): a passive player with neighbours is
// conquered early (one lost city is the game), which would end the run before the world is stressed.
const world = (seed) => ({
  ...peoplesWorld({ seed }),
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
  // The passive player may be conquered (seed 4243 falls near turn 91): DEFEAT is a normal end of the run,
  // checked like the last turn. A stall (a turn that does not advance) or an invariant break still fails.
  it('150 turns or until the passive player falls: deterministic turn by turn, finite everywhere, no runaway, provinces above their floor', () => {
    const TURNS = 150;
    let a = world(4243); let b = world(4243);
    const prints = [];
    let warsDeclared = 0;
    // Every game starts in the Stone Age (eight ages plan U46): all majors, the player included.
    const majors = Object.keys(a.nations).filter((id) => a.nations[id].kind !== 'independent');
    majors.forEach((id) => expect(ageOf(a, id), id).toBe(FIRST_AGE_ID));
    const rulers = Object.fromEntries(Object.entries(a.nations).map(([id, n]) => [id, n.ruler]));
    for (let t = 0; t < TURNS && a.gameStatus === GameStatus.ACTIVE; t++) {
      const before = a.turnNumber;
      a = advance(a); b = advance(b);
      if (a.gameStatus === GameStatus.ACTIVE) expect(a.turnNumber, `stalled at turn ${before}`).toBe(before + 1);
      warsDeclared += a.logs.filter((l) => l.year === a.year && /declared war/.test(l.message)).length;
      assertGameState(a);
      const pa = fingerprint(a);
      expect(fingerprint(b), `diverged at turn ${a.turnNumber}`).toBe(pa);
      if (t === 49 || t === TURNS - 1 || a.gameStatus !== GameStatus.ACTIVE) {
        expect(badNumbers(a), `non-finite values at turn ${a.turnNumber}`).toEqual([]);
        prints.push(pa);
      }
    }
    // the run ends by playing every turn or by the passive player's defeat, never by anything else
    expect(a.gameStatus === GameStatus.ACTIVE ? 'played' : a.gameStatus).toMatch(/^(played|DEFEAT)$/);
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
    // The world leaves the Stone Age: no stall in the first age's research.
    expect(majors.some((id) => ageOf(a, id) !== FIRST_AGE_ID)).toBe(true);
    // One ruler a game (differentiation plan U5): no reign ever ends.
    Object.entries(a.nations).forEach(([id, n]) => { if (rulers[id]) expect({ id: n.ruler.id, name: n.ruler.name }, id).toEqual({ id: rulers[id].id, name: rulers[id].name }); }); // decrees and renown move (decrees.js, renown.js)
  }, 600000);
});
