import { describe, it, expect } from 'vitest';
import { buildSetupFromArmies } from './buildBattleSetup';
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
    expect(reachable(map.tiles, map.w, map.h, 6, map.keep.y, map.keep.x - 2, map.keep.y)).toBe(true);
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
    const si = w.structures.findIndex((st) => st.kind === 'house');
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
});
