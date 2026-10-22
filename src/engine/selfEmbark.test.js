import { describe, it, expect } from 'vitest';
import { createInitialState } from '../context/GameContext';
import { getTiles } from '../data/geo/tiles';
import { getCapital } from '../data/regions';
import { scoutPath } from './aiScouting';
import { findRoute, advanceMarches } from './routes';
import { normalizeUnitTiles, unitTile, selfEmbarked, tileStepCost, EMBARK_COST, passableTile } from './armies';
import { seaPassable } from './fleets';

// The AoE and Civ report's rank 12: from the Classical age a land unit crosses water by itself.
describe('self-embark', () => {
  const base = createInitialState({ playerNationId: 'gunditjmara', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
  const me = base.playerNationId;
  const tiles = getTiles();
  const cap = base.regions[getCapital(base, me)];
  const open = (t) => base.world.tileOwner[t] == null || base.regions[base.world.tileOwner[t]]?.owner === me;
  // Land-only steps from `from` (bounded), to tell a strait from a bay.
  const landSteps = (from, max) => {
    const d = new Map([[from, 0]]); let level = [from];
    for (let i = 1; i <= max && level.length; i++) {
      const next = [];
      level.forEach((x) => tiles.neighbors[x].forEach((n) => { if (!d.has(n) && passableTile(tiles, n)) { d.set(n, i); next.push(n); } }));
      level = next;
    }
    return d;
  };
  // A coast tile near the capital, a sea tile beside it and a shore across the water that no
  // short land walk reaches.
  const near = landSteps(cap.tile, 12);
  let shore = null; let sea = null; let across = null;
  for (const [t] of [...near].sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    if (!open(t)) continue;
    const w = tiles.neighbors[t].find((n) => tiles.land[n] !== 1 && seaPassable(tiles, n, 'classical', false, true) && open(n));
    if (w == null) continue;
    const walk = landSteps(t, 30);
    const seen = new Set([w]); let level = [w];
    for (let i = 0; i < 4 && across == null; i++) {
      const next = [];
      level.forEach((x) => tiles.neighbors[x].forEach((n) => {
        if (seen.has(n)) return; seen.add(n);
        if (passableTile(tiles, n)) { if (!walk.has(n) && open(n) && across == null) across = n; } else if (seaPassable(tiles, n, 'classical', false, true) && open(n)) next.push(n);
      }));
      level = next;
    }
    if (across != null) { shore = t; sea = w; break; }
    across = null;
  }
  const at = (ageId) => ({ ...base, techAgeId: ageId });
  const unit = Object.values(base.units).find((u) => u.ownerId === me && u.domain === 'land' && u.classId !== 'settler');
  const placed = (state, tile) => ({ ...state, units: { ...state.units, [unit.id]: { ...unit, tile, movesLeft: 1 } } });

  it('found a strait to test on', () => { expect([shore, sea, across].every((t) => t != null)).toBe(true); });

  it('never in the Stone Age: no route and no scout path over the sea', () => {
    expect(findRoute(at('stone'), shore, sea).path).toBeUndefined();
    expect(findRoute(at('stone'), shore, across).path).toBeUndefined();
    expect(scoutPath(at('stone'), me, shore, (t) => t === across, 30)).toBeNull();
  });

  it('from the Classical age a route and a scout path cross the water', () => {
    const r = findRoute(at('classical'), shore, across);
    expect(r.path).toBeDefined();
    expect(r.path.some((t) => tiles.land[t] !== 1)).toBe(true);
    const s = scoutPath(at('classical'), me, shore, (t) => t === across, 30);
    expect(s?.[s.length - 1]).toBe(across);
  });

  it('stepping off the land costs EMBARK_COST more, a water step 1', () => {
    expect(tileStepCost(base, tiles, shore, sea)).toBe(1 + EMBARK_COST);
    const w2 = tiles.neighbors[sea].find((n) => tiles.land[n] !== 1);
    expect(tileStepCost(base, tiles, sea, w2)).toBe(1);
  });

  it('a march onto the water makes the unit its own carrier, and ashore again a land unit', () => {
    const s = placed(at('classical'), shore);
    const units = { ...s.units, [unit.id]: { ...s.units[unit.id], route: [sea], routePace: 4 } };
    advanceMarches(s, units, { turnOf: s.turnNumber });
    const boat = units[unit.id];
    expect(boat.tile).toBe(sea);
    expect(selfEmbarked(boat)).toBe(true);
    const norm = normalizeUnitTiles({ ...s, units });
    expect(unitTile(norm, norm.units[unit.id])).toBe(sea);
    expect(selfEmbarked(norm.units[unit.id])).toBe(true);
    const back = { ...units, [unit.id]: { ...boat, route: [shore], routePace: 4, movedNowTurn: null } };
    advanceMarches(s, back, { turnOf: s.turnNumber + 1 });
    expect(back[unit.id].tile).toBe(shore);
    expect(back[unit.id].embarkedOn).toBeNull();
  });
});
