// src/engine/supplyMeter.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getNationCapital } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { getCombatWidth } from '../data/combatWidth';
import { legacyTerrainOf } from './world/registry';
import {
  applySupplyMeter, supplyZone, stackCap, supplyOf, SUPPLY_MAX, SUPPLY_HOME_GAIN, SUPPLY_WILD_LOSS, SUPPLY_ENEMY_LOSS, SUPPLY_LINE_LOSS,
  SUPPLY_HUNGER_LOSS, STACK_OVER_LOSS, STACK_WIDTH_MULT, STARVE_STRENGTH, STARVE_MORALE
} from './supplyMeter';
import { visibleTiles, canSeeTile, SIGHT_LAND, SIGHT_ARMY } from './sight';

const tiles = getTiles();
const S = { ...createInitialState({ playerNationId: 'in', rngSeed: 3 }), units: {} };
const IN = getNationCapital('in');
const PK = getNationCapital('pk');
const unit = (id, regionId, extra = {}) => ({ id, ownerId: 'in', regionId, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, embarkedOn: null, promotions: [], ...extra });
const atWar = (s, enemy) => ({ ...s, wars: [...s.wars, { id: 'w', aggressor: 'in', enemy, active: true, startYear: s.year }] });
const freeNear = (from) => { let f = [from]; const seen = new Set(f); for (let d = 0; d < 6; d++) { const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); const hit = n.find((t) => tiles.land[t] && !S.world.tileOwner[t]); if (hit != null) return hit; f = n; } return null; };

describe('supply zones', () => {
  it('home land refills, free land drains a little, enemy land a lot, less with a supply line', () => {
    const home = unit('a', IN);
    expect(supplyZone(S, tiles, home)).toEqual({ zone: 'home', delta: SUPPLY_HOME_GAIN });
    const wild = unit('b', IN, { tile: freeNear(S.regions[IN].tile) });
    expect(supplyZone(S, tiles, wild)).toEqual({ zone: 'wild', delta: -SUPPLY_WILD_LOSS });
    const war = atWar(S, 'pk');
    const near = unit('c', PK, { tile: S.regions[PK].tile }); // Islamabad is a few tiles from Indian land
    expect(supplyZone(war, tiles, near)).toEqual({ zone: 'enemy', delta: -SUPPLY_LINE_LOSS });
    const deep = unit('d', getNationCapital('us'), { tile: S.regions[getNationCapital('us')].tile });
    expect(supplyZone(atWar(S, 'us'), tiles, deep)).toEqual({ zone: 'enemy', delta: -SUPPLY_ENEMY_LOSS });
    expect(supplyZone(war, tiles, near, { lineRings: 0 })).toEqual({ zone: 'enemy', delta: -SUPPLY_ENEMY_LOSS });
    // Occupied enemy land costs nothing.
    const held = { ...war, regions: { ...war.regions, [PK]: { ...war.regions[PK], occupiedBy: 'in' } } };
    expect(supplyZone(held, tiles, near).zone).toBe('held');
  });

  it('caps a stack by the tile\'s combat width', () => {
    const t = S.regions[IN].tile;
    expect(stackCap(tiles, t)).toBe(getCombatWidth(legacyTerrainOf(tiles, t)) * STACK_WIDTH_MULT);
  });
});

describe('the supply phase', () => {
  it('moves every meter, clamps it, and starves at zero', () => {
    const war = atWar(S, 'pk');
    const far = S.regions[getNationCapital('us')].tile;
    const units = {
      home: unit('home', IN, { supply: 95 }),
      abroad: unit('abroad', getNationCapital('us'), { tile: far, supply: 30 }),
      starving: unit('starving', getNationCapital('us'), { tile: far, supply: 10, strength: 400, morale: 50 }),
      gone: unit('gone', getNationCapital('us'), { tile: far, supply: 0, strength: 1 }),
      ship: unit('ship', IN, { domain: 'naval', supply: 10 })
    };
    const r = applySupplyMeter(atWar(war, 'us'), units);
    expect(units.home.supply).toBe(SUPPLY_MAX);
    expect(units.abroad.supply).toBe(30 - SUPPLY_ENEMY_LOSS);
    expect(units.starving.supply).toBe(0);
    expect(units.starving.strength).toBe(Math.floor(400 * (1 - STARVE_STRENGTH)));
    expect(units.starving.morale).toBe(50 - STARVE_MORALE);
    expect(units.gone).toBeUndefined();
    expect(units.ship.supply).toBe(10);
    expect(r.starving.get('in')).toBe(1);
    expect(r.dead.get('in')).toBe(1);
    expect(supplyOf({})).toBe(SUPPLY_MAX);
  });

  it('a hungry nation and an oversized stack drain faster; Forager halves the loss', () => {
    const t = freeNear(S.regions[IN].tile);
    const units = { a: unit('a', IN, { tile: t }) };
    applySupplyMeter(S, units, { hungryFor: () => true });
    expect(units.a.supply).toBe(SUPPLY_MAX - SUPPLY_WILD_LOSS - SUPPLY_HUNGER_LOSS);
    const stack = {};
    for (let i = 0; i <= stackCap(tiles, t); i++) stack[`s${i}`] = unit(`s${i}`, IN, { tile: t });
    applySupplyMeter(S, stack);
    expect(stack.s0.supply).toBe(SUPPLY_MAX - SUPPLY_WILD_LOSS - STACK_OVER_LOSS);
    const forager = { f: unit('f', IN, { tile: t, promotions: ['forager'] }) };
    applySupplyMeter(S, forager);
    expect(forager.f.supply).toBe(SUPPLY_MAX - SUPPLY_WILD_LOSS / 2);
  });
});

describe('sight', () => {
  it('sees its land and two rings around it, and around its armies', () => {
    const seen = visibleTiles(S, 'in');
    const centre = S.regions[IN].tile;
    expect(seen.has(centre)).toBe(true);
    S.regions[IN].tiles.forEach((t) => tiles.neighbors[t].forEach((n) => expect(seen.has(n)).toBe(true)));
    const far = S.regions[getNationCapital('us')].tile;
    expect(canSeeTile(S, far, 'in')).toBe(false);
    const scouted = { ...S, units: { a: unit('a', getNationCapital('us'), { tile: far }) } };
    expect(canSeeTile(scouted, far, 'in')).toBe(true);
    let ring = [far]; const all = new Set(ring);
    for (let d = 0; d < SIGHT_ARMY; d++) { const n = []; ring.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!all.has(x)) { all.add(x); n.push(x); } })); ring = n; }
    all.forEach((t) => expect(canSeeTile(scouted, t, 'in')).toBe(true));
    expect(visibleTiles(scouted, 'in')).toBe(visibleTiles(scouted, 'in'));
    expect(SIGHT_LAND).toBe(2);
  });
});
