import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from './buildBattleSetup';
import { hallSize, hallPlacement, HALL_TILES, CITY_TILES_PER_UNIT } from './cityBattle';
import { TILE, reachable, isPassable } from './mapgen';
import { buildTownManifest, manifestHousing } from '../../data/townLayout';
import { createWorld } from '../sim/world';
import { step } from '../sim/step';
import { runHeadless } from '../sim/headless';
import { attackStructure } from '../sim/combat';
import { replaySegment } from '../sim/replay';
import { getFlowField, tileOf } from '../sim/pathing';
import { Q } from '../sim/constants';

const mk = (p, cls) => cls.map((c, i) => ({ id: `${p}${i}`, classId: c, strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
const manifest = buildTownManifest({ cityId: 'city-test', ageId: 'classical', tierId: 'medium', style: 'europe', seed: 4, defenseTier: 1, capital: true, buildings: { culture: 1, economy: 0 } });
const setup = (over = {}) => buildSetupFromArmies({
  regionId: 'city-test', terrain: 'plains', seed: 9, fortLevel: 2, isCapital: true,
  attackerUnits: mk('a', ['infantry', 'infantry', 'infantry', 'cavalry', 'ranged', 'siege']),
  defenderUnits: mk('d', ['infantry', 'ranged', 'infantry']),
  attackerAgeId: 'classical', defenderAgeId: 'classical', controllers: ['ai', 'ai'],
  cityManifest: manifest, ...over
});

describe('a city assault loads the real city (cityBattle.js)', () => {
  it('every manifest structure stands on the field exactly once, the keep first', () => {
    const s = setup();
    expect(s.battleType).toBe('assault');
    expect(s.structures[0]).toMatchObject({ kind: 'keep', manifestId: 'townhall' });
    const ids = s.structures.map((st) => st.manifestId).filter(Boolean).sort();
    expect(ids).toEqual(manifest.structures.map((st) => st.id).sort());
    expect(s.city.housingCap).toBe(manifestHousing(manifest));
  });

  it('houses and walls block the ground; the gate and the main street stay open to the keep', () => {
    const s = setup();
    const { map } = s;
    const house = s.structures.find((st) => st.kind === 'house');
    expect(house.footprint.length).toBeGreaterThan(0);
    house.footprint.forEach((c) => expect(map.tiles[c]).toBe(TILE.BUILDING));
    expect(s.structures.filter((st) => st.kind === 'wall').every((st) => st.footprint.length > 0)).toBe(true);
    expect(s.structures.find((st) => st.kind === 'gate').footprint).toEqual([]);
    expect(reachable(map.tiles, map.w, map.h, 6, map.keep.y, Math.floor(s.structures[0].x / Q - s.structures[0].hall / 2) - 1, map.keep.y)).toBe(true);
    // no two structures share a tile
    const all = s.structures.flatMap((st) => st.footprint || []);
    expect(new Set(all).size).toBe(all.length);
    // the gate faces the attacker (west of the keep)
    expect(s.structures.find((st) => st.kind === 'gate').x).toBeLessThan(s.structures[0].x);
  });

  it('a ruined house from an earlier battle is rubble with no HP; a damaged one starts at half', () => {
    const s = setup({ cityDamage: { ruined: { 'house-0': 5 }, damaged: { 'house-1': 2 } } });
    const h0 = s.structures.find((st) => st.manifestId === 'house-0');
    const h1 = s.structures.find((st) => st.manifestId === 'house-1');
    expect(h0).toMatchObject({ alive: false, hp: 0, ruinedAtStart: true });
    h0.footprint.forEach((c) => expect(s.map.tiles[c]).toBe(TILE.RUBBLE));
    expect(h1.hp).toBe(Math.round(h1.maxHp / 2));
    expect(s.city.housingCap).toBe(manifestHousing(manifest, { 'house-0': 1 }));
  });

  it('a house brought down turns to rubble, opens the path and is reported by manifest id', () => {
    const s = setup();
    const w = createWorld(s);
    const si = w.structures.findIndex((st) => st.kind === 'house' && st.footprint.length);
    const house = w.structures[si];
    const cell = house.footprint[0];
    const before = getFlowField(w, cell);
    const attacker = w.squads.find((q) => q.side === 0);
    for (let k = 0; k < 400 && house.alive; k++) attackStructure(w, attacker, house);
    expect(house.alive).toBe(false);
    expect(w.map.tiles[cell]).toBe(TILE.RUBBLE);
    expect(s.map.tiles[cell]).toBe(TILE.BUILDING); // the setup itself is untouched (replays start clean)
    expect(isPassable(w.map.tiles[cell])).toBe(true);
    expect(getFlowField(w, cell)).not.toBe(before);
    expect(w.events.some((e) => e.type === 'collapsed')).toBe(true);
  });

  it('passive houses are never picked automatically; the battle ends and reports the city', () => {
    const { world, result } = runHeadless(setup());
    expect(world.ended).toBeTruthy();
    const report = result.report.tactical.cityDamage;
    expect(report).toBeDefined();
    const houses = new Set(manifest.structures.filter((st) => st.kind === 'house').map((st) => st.id));
    // nobody ordered an attack on a house: none fell to the AI
    expect(report.destroyed.filter((id) => houses.has(id))).toEqual([]);
  }, 60000);

  it('is deterministic and replays from a snapshot', () => {
    const a = runHeadless(setup());
    const b = runHeadless(setup());
    expect(a.chain).toBe(b.chain);
    const w = createWorld(setup());
    for (let t = 0; t < 400; t++) { step(w, []); w.events.length = 0; }
    const snap = structuredClone(w);
    const end = replaySegment(snap, [], Infinity);
    expect(end.chain).toBe(a.chain);
  }, 60000);

  it('a squad standing on the keep line spawns on open ground', () => {
    const w = createWorld(setup());
    w.squads.filter((q) => q.onField).forEach((q) => expect(isPassable(w.map.tiles[tileOf(w.map, q.x, q.y)])).toBe(true));
    expect(Q).toBe(256);
  });

  it('the town hall is the biggest building: drawn at the plan size, blocking its cells, houses under it cut', () => {
    const s = setup();
    const keep = s.structures[0];
    const { size, ox, oy } = hallPlacement(manifest);
    expect(keep.hall).toBe(size);
    expect(keep.hall).toBeGreaterThanOrEqual(3);
    expect(keep.hall).toBeLessThanOrEqual(HALL_TILES.medium);
    expect(ox).toBeGreaterThanOrEqual(0); // never toward the gate
    expect(keep.x).toBe(Math.round((s.map.keep.x + 0.5 + ox) * Q));
    expect(keep.y).toBe(Math.round((s.map.keep.y + 0.5 + oy) * Q));
    // every cell well inside the hall is blocked; the old 3 x 3 keep's cells outside it are not
    for (let j = 0; j < s.map.h; j++) {
      for (let i = 0; i < s.map.w; i++) {
        const core = Math.abs(i - s.map.keep.x) <= 1 && Math.abs(j - s.map.keep.y) <= 1;
        const inside = Math.abs(i + 0.5 - keep.x / Q) <= size / 2 - 0.3 && Math.abs(j + 0.5 - keep.y / Q) <= size / 2 - 0.3;
        if (inside) expect(s.map.tiles[j * s.map.w + i]).toBe(TILE.BUILDING);
        else if (core) expect(s.structures.some((st) => st.footprint?.includes(j * s.map.w + i)) || s.map.tiles[j * s.map.w + i] !== TILE.BUILDING).toBe(true);
      }
    }
    expect(keep.radius).toBeGreaterThanOrEqual(Math.round((keep.hall / 2) * Q));
    s.structures.filter((st) => st.underHall).forEach((st) => { expect(st.kind).toBe('house'); expect(st.footprint).toEqual([]); });
    // never into a landmark or a region building
    const S = CITY_TILES_PER_UNIT;
    manifest.structures.filter((st) => st.kind === 'landmark' || st.kind === 'building').forEach((st) => {
      const cx = -st.z * S; const cy = st.x * S; const hx = (st.d * S) / 2; const hy = (st.w * S) / 2;
      expect(Math.max(Math.abs(cx - ox) - hx, Math.abs(cy - oy) - hy)).toBeGreaterThanOrEqual(size / 2 + 0.09);
    });
  });

  it('hallPlacement: the tier size, stepped aside from a temple, shrunk only when hemmed in, never under 3 tiles', () => {
    expect(hallSize({ tierId: 'big', structures: [] })).toBe(HALL_TILES.big);
    expect(hallSize({ tierId: 'small', structures: [] })).toBe(HALL_TILES.small);
    // a capital's hall stays centred (its palace)
    expect(hallPlacement({ tierId: 'big', structures: [{ kind: 'palace', x: 0, z: 0, w: 1, d: 1 }, { kind: 'landmark', x: 1.4, z: 0, w: 1, d: 1 }] })).toMatchObject({ ox: 0, oy: 0 });
    // a temple just north of the centre (tile y +): the hall steps aside at full size
    const near = hallPlacement({ tierId: 'big', structures: [{ kind: 'landmark', x: 1.4, z: 0, w: 1, d: 1 }] });
    expect(near.size).toBe(HALL_TILES.big);
    expect(near.ox).toBeGreaterThanOrEqual(0);
    expect(Math.max(near.ox, Math.abs(near.oy))).toBeGreaterThan(0);
    // hemmed in on every side: shrunk, never under 3 tiles
    const ring = [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]].map(([x, z]) => ({ kind: 'building', x, z, w: 0.6, d: 0.6 }));
    expect(hallSize({ tierId: 'big', structures: [...ring, { kind: 'palace', x: 0, z: 0, w: 1, d: 1 }] })).toBe(3); // a capital's cannot step aside
    expect(hallSize({ tierId: 'big', structures: ring })).toBeGreaterThan(3); // a plain town's steps out
    // houses never move it; the centred spot wins whenever the full size fits there
    expect(hallPlacement({ tierId: 'big', structures: [{ kind: 'house', x: 0.3, z: 0, w: 1, d: 1 }] })).toEqual({ size: HALL_TILES.big, ox: 0, oy: 0 });
    expect(hallPlacement({ tierId: 'medium', structures: [{ kind: 'landmark', x: 3, z: 0, w: 1, d: 1 }] })).toEqual({ size: HALL_TILES.medium, ox: 0, oy: 0 });
  });
});
