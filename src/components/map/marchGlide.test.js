import { describe, it, expect } from 'vitest';
import { getTiles } from '../../data/geo/tiles';
import { planGlides, glideAt, walkedTiles, afterTurnReport, REPORT_SETTLE_MS, GLIDE_MIN_MS, GLIDE_MAX_MS } from './marchGlide';

// a short walk over land: a land tile and two land steps away from it
const landWalk = () => {
  const t = getTiles();
  for (let a = 0; a < t.count; a++) {
    if (t.land[a] !== 1) continue;
    const b = t.neighbors[a].find((n) => t.land[n] === 1);
    const c = b != null ? t.neighbors[b].find((n) => n !== a && t.land[n] === 1 && !t.neighbors[a].includes(n)) : null;
    if (c != null) return [a, b, c];
  }
  throw new Error('no land walk');
};
const far = (from) => { const t = getTiles(); for (let x = t.count - 1; x >= 0; x--) if (t.land[x] === 1 && Math.abs(t.latLonOf(x).lon - t.latLonOf(from).lon) > 60) return x; return null; };

const world = (unit, turn = 1) => ({ playerNationId: 'me', turnNumber: turn, regions: {}, units: { u1: { id: 'u1', ownerId: 'me', strength: 10, ...unit } } });
const marks = (tile, ownerId = 'me') => ({ armies: [{ id: `${tile}|c|${ownerId}|land`, tile, lead: 'u1', ownerId }], fleets: [] });

describe('march glide (I070)', () => {
  it('follows the steps of the route the stack walked', () => {
    const [a, b, c] = landWalk();
    expect(walkedTiles([b, c, 99], a, c)).toEqual([a, b, c]);
    const plan = planGlides({ prevState: world({ tile: a, route: [b, c] }), nextState: world({ tile: c, route: null }, 2), prevMarkers: marks(a), nextMarkers: marks(c) });
    const g = plan.get(`army:${c}|c|me|land`);
    expect(g.points).toHaveLength(3);
    expect(g.dur).toBeGreaterThanOrEqual(GLIDE_MIN_MS);
    expect(g.dur).toBeLessThanOrEqual(GLIDE_MAX_MS);
    // starts on the old tile, ends on the new one, never past it
    const start = glideAt(g, 0); const end = glideAt(g, g.dur); const after = glideAt(g, g.dur * 3);
    const ll = (x) => { const p = getTiles().latLonOf(x); return { lat: p.lat, lng: p.lon }; };
    expect(start.lat).toBeCloseTo(ll(a).lat, 6);
    expect(end.done && after.done).toBe(true);
    expect(after.lat).toBeCloseTo(ll(c).lat, 6);
    expect(glideAt(g, g.dur / 2).done).toBe(false);
  });

  it('does not glide a long jump without a route, a loaded game, or a foreign stack that came out of the fog', () => {
    const [a, , c] = landWalk();
    const z = far(a);
    expect(planGlides({ prevState: world({ tile: a }), nextState: world({ tile: z }, 2), prevMarkers: marks(a), nextMarkers: marks(z) }).size).toBe(0);
    // turn went back (a load)
    expect(planGlides({ prevState: world({ tile: a, route: [c] }, 5), nextState: world({ tile: c }, 3), prevMarkers: marks(a), nextMarkers: marks(c) }).size).toBe(0);
    // the stack was not on the map before (fog): it appears, it does not glide out of the dark
    const prevS = world({ tile: a, route: [c], ownerId: 'them' }); const nextS = world({ tile: c, ownerId: 'them' }, 2);
    expect(planGlides({ prevState: prevS, nextState: nextS, prevMarkers: { armies: [], fleets: [] }, nextMarkers: marks(c, 'them') }).size).toBe(0);
    expect(planGlides({ prevState: prevS, nextState: nextS, prevMarkers: marks(a, 'them'), nextMarkers: marks(c, 'them') }).size).toBe(1);
  });

  it('a move ordered now (no old route) glides over land round a bay, never across the water', () => {
    const t = getTiles();
    // two land tiles two steps apart whose shared neighbours are all water
    let pair = null;
    for (let a = 0; a < t.count && !pair; a++) {
      if (t.land[a] !== 1) continue;
      const ring1 = new Set(t.neighbors[a]);
      for (const w of t.neighbors[a]) {
        const c = t.land[w] !== 1 && t.neighbors[w].find((n) => n !== a && t.land[n] === 1 && !ring1.has(n) && t.neighbors[n].filter((x) => ring1.has(x)).every((x) => t.land[x] !== 1));
        if (c != null && c !== false && walkedTiles(null, a, c)) { pair = [a, c]; break; }
      }
    }
    expect(pair).not.toBeNull();
    const path = walkedTiles(null, ...pair);
    expect(path.length).toBeGreaterThan(3);
    expect(path.every((x) => t.land[x] === 1)).toBe(true);
    const plan = planGlides({ prevState: world({ tile: pair[0] }), nextState: world({ tile: pair[1] }, 1), prevMarkers: marks(pair[0]), nextMarkers: marks(pair[1]) });
    expect(plan.get(`army:${pair[1]}|c|me|land`).points).toHaveLength(path.length);
  });

  it('takes the short way across the date line', () => {
    const g = { points: [{ lat: 0, lng: 179 }, { lat: 0, lng: -179 }], dur: 1000 };
    const mid = glideAt(g, 500);
    expect(Math.abs(mid.lng)).toBeGreaterThan(179);
  });
});

// The glide after End Turn waits for the turn report to close.
describe('afterTurnReport', () => {
  const makeEnv = (shown = false) => {
    const env = { shown, fns: new Set(), timers: [] };
    env.isShown = () => env.shown;
    env.listen = (fn) => { env.fns.add(fn); return () => env.fns.delete(fn); };
    env.later = (fn, ms) => { const t = { fn, ms, off: false }; env.timers.push(t); return () => { t.off = true; }; };
    env.setShown = (v) => { env.shown = v; env.fns.forEach((f) => f(v)); };
    env.tick = () => env.timers.filter((t) => !t.off).forEach((t) => { t.off = true; t.fn(); });
    return env;
  };

  it('quiet turn: no report opens, it plays once the short wait is over', () => {
    const env = makeEnv(); let n = 0;
    afterTurnReport(env, () => { n += 1; });
    expect(n).toBe(0);
    expect(env.timers[0].ms).toBe(REPORT_SETTLE_MS);
    env.tick();
    expect(n).toBe(1);
  });

  it('a report opens: nothing plays until it closes, then it plays once', () => {
    const env = makeEnv(); let n = 0;
    afterTurnReport(env, () => { n += 1; });
    env.setShown(true);
    env.tick();
    expect(n).toBe(0);
    env.setShown(false);
    expect(n).toBe(1);
    env.setShown(true); env.setShown(false);
    expect(n).toBe(1);
  });

  it('cancelled (another turn, unmount): never plays', () => {
    const env = makeEnv(); let n = 0;
    const cancel = afterTurnReport(env, () => { n += 1; });
    cancel();
    env.tick(); env.setShown(false);
    expect(n).toBe(0);
  });
});
