// src/engine/cityDisasters.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getTiles } from '../data/geo/tiles';
import { cityYields, processCity } from './world/cities';
import { rollFor, strike, disasterMults, rollCityDisasters, FLOOD_CHANCE, DISASTER_TURNS, DISASTER_COOLDOWN, FLOOD_FOOD_MULT, PLAGUE_SIZE_LOSS } from './cityDisasters';

const S = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
const tiles = getTiles();

describe('city disasters', () => {
  it('rolls deterministically by tile facts: only river cities flood, only big cities burn or sicken, never twice at once or within the cooldown', () => {
    const cities = Object.values(S.regions).filter((c) => c.tile != null);
    let floods = 0; let fires = 0; let plagues = 0; let total = 0;
    cities.forEach((c) => { for (let t = 1; t <= 300; t++) { const k = rollFor({ ...c, size: 8 }, t, tiles); total++; if (k === 'flood') { floods++; expect(tiles.rivers[c.tile]).toBeTruthy(); } if (k === 'fire') fires++; if (k === 'plague') plagues++; } });
    expect(floods + fires + plagues).toBeGreaterThan(0);
    expect((floods + fires + plagues) / total).toBeLessThan(0.02);
    const small = cities.map((c) => rollFor({ ...c, size: 1 }, 5, tiles)).filter(Boolean);
    small.forEach((k) => expect(k).toBe('flood'));
    const river = cities.find((c) => tiles.rivers[c.tile]);
    const t = Array.from({ length: 2000 }, (_, i) => i + 1).find((i) => rollFor(river, i, tiles) === 'flood');
    expect(t).toBeDefined();
    expect(rollFor({ ...river, disaster: { kind: 'fire', until: t + 2 } }, t, tiles)).toBeNull();
    expect(rollFor({ ...river, lastDisasterTurn: t - DISASTER_COOLDOWN + 1 }, t, tiles)).toBeNull();
    expect(rollFor({ ...river, outpost: { progress: 0 } }, t, tiles)).toBeNull();
    expect(rollFor(river, t, tiles)).toBe(rollFor(river, t, tiles));
    expect(FLOOD_CHANCE).toBeLessThan(0.01);
  });

  it('a strike leaves a mark with the plan\'s effects, and the mark clears after DISASTER_TURNS', () => {
    const city = { ...Object.values(S.regions).find((c) => c.tile != null), food: 20, size: 7, production: { current: null, queue: [], progress: 40 } };
    const flooded = strike(city, 'flood', 10);
    expect(flooded.food).toBe(10);
    expect(flooded.disaster).toEqual({ kind: 'flood', until: 10 + DISASTER_TURNS });
    expect(disasterMults(flooded, 12).food).toBe(FLOOD_FOOD_MULT);
    expect(disasterMults(flooded, 10 + DISASTER_TURNS + 1).food).toBe(1);
    expect(strike(city, 'fire', 10).production.progress).toBe(20);
    expect(strike(city, 'plague', 10).size).toBe(7 - PLAGUE_SIZE_LOSS);
    expect(disasterMults(strike(city, 'plague', 10), 11).growth).toBe(0);
    const world = { cities: S.regions, tileOwner: S.world.tileOwner, tileState: S.world.tileState };
    const plain = cityYields(city, tiles, world, city.worked, [], { turnNumber: 12 });
    const wet = cityYields(flooded, tiles, world, city.worked, [], { turnNumber: 12 });
    expect(wet.food).toBeLessThanOrEqual(plain.food);
    const sick = processCity(world, tiles, { ...strike(city, 'plague', 10), food: 0 }, { turnNumber: 11 });
    expect(sick.city.food).toBe(0); // no growth under plague
    const regions = { [city.id]: { ...flooded, disaster: { kind: 'flood', until: 5 } } };
    expect(rollCityDisasters(regions, 6)).toEqual([]);
    expect(regions[city.id].disaster).toBeNull();
  });
});
