// ECON-01: the gold forecast (calcNationBalance) must equal the next turn's real change in gold,
// including the extra upkeep of armies that march during that turn.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { calcNationBalance } from './economy';
import { HISTORICAL_EVENTS } from '../data/events';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { tileAccess } from './armies';
import { neighbourWorld } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ seed: 3 });
const IN_ID = PEOPLES_WORLD.playerNationId;

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const unit = (id, regionId, extra = {}) => ({ id, ownerId: IN_ID, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });

const tiles = getTiles();
// Three turns in: the cities have settled, so the forecast and the turn read the same yields.
const base = (() => { let s = quiet(neighbourWorld({ seed: 3 })); for (let i = 0; i < 3; i++) { s = resolveTurn(s); if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; } return s; })();
const P = getNationCapital(IN_ID);
const home = base.regions[P].tile;
const wild = (s, from) => { // a free land tile a few steps out, and the walk to it
  const route = []; let at = from; const seen = new Set([from]);
  while (route.length < 4) {
    const n = tiles.neighbors[at].find((t) => !seen.has(t) && tiles.land[t] === 1 && tileAccess(s, t, IN_ID) !== 'closed');
    if (n == null) break;
    seen.add(n); route.push(n); at = n;
  }
  return route;
};

describe('gold forecast', () => {
  it('equals the next turn change in gold, with armies on the march', () => {
    const route = wild(base, home);
    expect(route.length).toBeGreaterThan(1);
    const units = { a: unit('a', P, { tile: home, route, routePace: 2 }), b: unit('b', P, { tile: home, route, routePace: 2 }), c: unit('c', P, { tile: home }) };
    const s = { ...base, units: { ...base.units, ...units } };
    const forecast = Math.round(calcNationBalance(s, IN_ID).net);
    const next = resolveTurn(s);
    expect(next.units.a.marchedTurn).toBe(s.turnNumber);
    expect(Math.round(next.resources.gold - s.resources.gold)).toBe(forecast);
  });

  it('equals the next turn change in gold with a quiet army', () => {
    const s = { ...base, units: { ...base.units, c: unit('c', P, { tile: home }) } };
    expect(Math.round(resolveTurn(s).resources.gold - s.resources.gold)).toBe(Math.round(calcNationBalance(s, IN_ID).net));
  });
});
