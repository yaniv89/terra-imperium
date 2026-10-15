// ECON-01: the gold forecast (calcNationBalance) must equal the next turn's real change in gold,
// including the extra upkeep of armies that march during that turn.
import { describe, it, expect } from 'vitest';
import { resolveTurn } from './resolveTurn';
import { calcNationBalance } from './economy';
import { HISTORICAL_EVENTS } from '../data/events';
import { getTiles } from '../data/geo/tiles';
import { tileAccess } from './armies';
import { peoplesWorld } from './testWorld';
import { stepCost } from './routes';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = peoplesWorld({ seed: 3, fog: false });
const IN_ID = PEOPLES_WORLD.playerNationId;

const quiet = (s) => ({ ...s, firedEvents: Object.keys(HISTORICAL_EVENTS).reduce((a, k) => ({ ...a, [k]: true }), {}), proceduralEventCooldown: 999999, battleSettings: { autoDefend: true } });
const unit = (id, regionId, extra = {}) => ({ id, ownerId: IN_ID, regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });

const tiles = getTiles();
// Three turns in: the cities have settled, so the forecast and the turn read the same yields.
const base = (() => { let s = quiet(peoplesWorld({ seed: 3, fog: false })); for (let i = 0; i < 3; i++) { s = resolveTurn(s); if (s.activeProceduralEvent) s = { ...s, activeProceduralEvent: null }; } return s; })();
const P = PEOPLES_WORLD.nations[IN_ID].capitalRegionId;
const home = base.regions[P].tile;
const wild = (s, from) => { // a free land tile a few steps out, and the walk to it
  const route = []; let at = from; const seen = new Set([from]);
  while (route.length < 4) {
    // the cheapest next step, so the army really marches this turn (rough ground can eat a whole turn's points)
    const n = tiles.neighbors[at].filter((t) => !seen.has(t) && tiles.land[t] === 1 && tileAccess(s, t, IN_ID) !== 'closed').sort((a, b) => stepCost(s, a, at) - stepCost(s, b, at))[0];
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
