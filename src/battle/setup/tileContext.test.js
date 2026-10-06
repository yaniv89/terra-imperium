// src/battle/setup/tileContext.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../engine/gameReducer';
import { getNationCapital } from '../../data/regions';
import { getTiles } from '../../data/geo/tiles';
import { tileContextOf, sectorAt } from './tileContext';
import { generateMap, TILE, SECTOR_INNER, isPassable } from './mapgen';
import { buildSetupFromArmies } from './buildBattleSetup';
import { buildInvasionSetup } from './buildBattleSetup';
import { siegeMaxHp } from '../../engine/sieges';

const tiles = getTiles();
const S = createInitialState({ playerNationId: 'fr', rngSeed: 3 });
const mk = (p, cls) => cls.map((classId, i) => ({ id: `${p}${i}`, classId, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
// A city with a wide sea beside it (three or more water neighbours) and some land: the sea
// sector's water share is then clear-cut whichever bearing the sea takes.
// Its sea lies due east (within 30 degrees), where the field's outer band is widest and no army
// deploys, so the check does not depend on which coast the grid's first such city faces.
const eastSea = (ctx) => ctx.sectors.find((s) => s.water && !s.lake && Math.abs((((s.bearing + 180) % 360) + 360) % 360 - 180) <= 30);
const coastalCity = Object.values(S.regions).sort((a, b) => a.tile - b.tile).find((c) => tiles.neighbors[c.tile].filter((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'lake').length >= 3 && tiles.neighbors[c.tile].some((n) => tiles.land[n] === 1)
  && eastSea(tileContextOf(S, c.tile, { city: c })));
const riverTile = [...Array(tiles.count).keys()].find((t) => tiles.land[t] === 1 && tiles.neighbors[t].some((n) => tiles.land[n] === 1 && tiles.riverBetween(t, n)));

const sectorCells = (map, bearing, inner = SECTOR_INNER + 0.05) => {
  const cx = (map.w - 1) / 2; const cy = (map.h - 1) / 2; const half = Math.hypot(cx, cy); const out = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const dx = x - cx; const dy = cy - y; const d = Math.hypot(dx, dy) / half; if (d < inner) continue;
    const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    if (Math.abs((((deg - bearing) % 360) + 540) % 360 - 180) < 20) out.push(map.tiles[y * map.w + x]);
  }
  return out;
};

describe('the battlefield from a tile', () => {
  it('describes the six neighbours around the tile with the attacker due west', () => {
    const city = S.regions[getNationCapital('fr')];
    const from = tiles.neighbors[city.tile].find((n) => tiles.land[n] === 1);
    const ctx = tileContextOf(S, city.tile, { fromTile: from, city });
    expect(ctx.sectors).toHaveLength(tiles.neighbors[city.tile].length);
    const approach = ctx.sectors.find((s) => s.tile === from);
    expect(Math.abs(approach.bearing - 180)).toBeLessThan(1);
    expect(ctx.walls).toBe(0);
    expect(ctx.hpRatio).toBe(1);
    expect(sectorAt(ctx.sectors, 180).tile).toBe(from);
  });

  it('puts the sea in a water neighbour\'s sector, with a beach, and rivers on their edges with fords', () => {
    const ctx = tileContextOf(S, coastalCity.tile, { city: coastalCity });
    // the sea due east (coastalCity): on the wide field the north and south sectors end before
    // the water band (SECTOR_INNER + 0.22), and the west is the attacker's deployment ground
    const sea = eastSea(ctx);
    const map = generateMap({ regionId: coastalCity.id, terrain: ctx.terrain, combatWidth: 4, tileContext: ctx });
    const cells = sectorCells(map, sea.bearing, SECTOR_INNER + 0.25);
    expect(cells.filter((t) => t === TILE.WATER).length).toBeGreaterThan(cells.length * 0.5);
    const land = ctx.sectors.find((s) => !s.water);
    if (land) expect(sectorCells(map, land.bearing, SECTOR_INNER + 0.25).filter((t) => t === TILE.WATER).length).toBe(0);
    const rctx = tileContextOf(S, riverTile);
    const river = rctx.sectors.find((s) => s.river);
    const rmap = generateMap({ regionId: 'r', terrain: rctx.terrain, combatWidth: 4, tileContext: rctx });
    const rim = sectorCells(rmap, river.bearing, SECTOR_INNER - 0.08).filter((t) => t === TILE.WATER || t === TILE.FORD);
    expect(rim.filter((t) => t === TILE.WATER).length).toBeGreaterThan(0);
    expect(rim.filter((t) => t === TILE.FORD).length).toBeGreaterThan(0);
    // Always playable: the keep stays reachable and the map is a pure function of the tile.
    expect(isPassable(rmap.tiles[rmap.keep.y * rmap.w + rmap.keep.x - 4])).toBe(true);
    expect(generateMap({ regionId: 'x', terrain: rctx.terrain, combatWidth: 4, tileContext: rctx }).tiles).toEqual(rmap.tiles);
  });

  it('draws a river as wide as its size, with its fords and a bridge where a road crosses', () => {
    const great = [...Array(tiles.count).keys()].find((t) => tiles.land[t] === 1 && tiles.neighbors[t].some((n) => tiles.land[n] === 1 && tiles.riverSizeBetween(t, n) === 3));
    const n = tiles.neighbors[great].find((x) => tiles.land[x] === 1 && tiles.riverSizeBetween(great, x) === 3);
    const ctx = tileContextOf(S, great);
    const s = ctx.sectors.find((x) => x.tile === n);
    expect(s).toMatchObject({ river: true, riverSize: 3, fords: 1, bridge: false });
    const map = generateMap({ regionId: 'g', terrain: ctx.terrain, combatWidth: 4, tileContext: ctx });
    const rim = sectorCells(map, s.bearing, SECTOR_INNER - 0.2);
    expect(rim.filter((t) => t === TILE.WATER).length).toBeGreaterThan(0);
    // with a road on both banks the crossing gets a bridge (road tiles through the water)
    const roads = { ...S, world: { ...S.world, tileState: { ...S.world.tileState, [great]: { road: true }, [n]: { road: true } } } };
    const rctx = tileContextOf(roads, great);
    const rs = rctx.sectors.find((x) => x.tile === n);
    expect(rs.bridge).toBe(true);
    const rmap = generateMap({ regionId: 'g', terrain: rctx.terrain, combatWidth: 4, tileContext: rctx });
    const cx = (rmap.w - 1) / 2; const cy = (rmap.h - 1) / 2; const half = Math.hypot(cx, cy);
    const rad = (rs.bearing * Math.PI) / 180;
    const at = (d) => rmap.tiles[Math.round(cy - Math.sin(rad) * d * half) * rmap.w + Math.round(cx + Math.cos(rad) * d * half)];
    expect(at(SECTOR_INNER + 0.02 - 4 / half)).toBe(TILE.ROAD);
    expect(at(SECTOR_INNER + 0.02 - 4 / half) === map.tiles[Math.round(cy - Math.sin(rad) * (SECTOR_INNER + 0.02 - 4 / half) * half) * map.w + Math.round(cx + Math.cos(rad) * (SECTOR_INNER + 0.02 - 4 / half) * half)]).toBe(false);
  });

  it('a battered city starts the assault with its keep at the siege HP', () => {
    const city = S.regions[getNationCapital('be')];
    const half = { ...city, siege: { hp: Math.round(siegeMaxHp(city) / 2), maxHp: siegeMaxHp(city), by: 'fr' } };
    const ctx = tileContextOf(S, city.tile, { city: half });
    expect(ctx.hpRatio).toBeCloseTo(0.5, 1);
    const setup = buildSetupFromArmies({ regionId: city.id, terrain: 'plains', seed: 1, attackerUnits: mk('a', ['infantry']), defenderUnits: mk('d', ['infantry']), fortLevel: 2, tileContext: ctx });
    const keep = setup.structures.find((s) => s.kind === 'keep');
    expect(keep.hp).toBe(Math.round(keep.maxHp * ctx.hpRatio));
    expect(setup.tile).toBe(city.tile);
  });

  it('an invasion builds its battle from the target city\'s tile', () => {
    const fr = getNationCapital('fr'); const be = getNationCapital('be');
    const s = { ...S, wars: [...S.wars, { id: 'w', aggressor: 'fr', enemy: 'be', active: true, startYear: S.year }], units: {
      a: { id: 'a', ownerId: 'fr', regionId: fr, tile: S.regions[fr].tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [] },
      d: { id: 'd', ownerId: 'be', regionId: be, tile: S.regions[be].tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, promotions: [] }
    } };
    const setup = buildInvasionSetup(s, { kind: 'invasion', fromRegionId: fr, targetRegionId: be, seed: 5, attackerUnitIds: ['a'], defenderUnitIds: ['d'] });
    expect(setup.tile).toBe(S.regions[be].tile);
    expect(setup.map.tiles.length).toBe(setup.map.w * setup.map.h);
  });
});
