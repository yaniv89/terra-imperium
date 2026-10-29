// A walled city holds its walls (U9, lead option A): its stores, its town hall's training, its
// laborers kept inside the whole ring, and a keep that takes KEEP_HELD_MULT of a blow while the
// garrison holds a regiment (a city falls only when its defence is beaten).
import { describe, it, expect } from 'vitest';
import { town } from './assaultTestTown';
import { createWorld } from './world';
import { step } from './step';
import { walledCity, trainsOf, ecoView } from './economy';
import { ringBroken, crewShares, KEEP_HELD_MULT } from './siegeRules';
import { CITY_STORES_PER_SEC, CITY_HALL_TRAINS, MILLI, RES_INDEX } from '../data/economy';

const walled = () => createWorld(town({ controllers: ['ai', 'ai'], fort: 2, def: ['infantry', 'infantry', 'ranged'], strD: 1000, att: ['infantry', 'infantry', 'ranged'], strA: 1000 }));
const hallOf = (w) => w.eco.buildings.find((b) => b.side === 1 && b.type === 'hall');

describe('walled city', () => {
  it('its hall trains the foot, and the HUD view says so', () => {
    const w = walled();
    expect(walledCity(w)).toBe(true);
    expect(trainsOf(w, hallOf(w))).toEqual(['worker', ...CITY_HALL_TRAINS]);
    expect(ecoView(w, 1).buildings.find((b) => b.type === 'hall').trains).toEqual(['worker', ...CITY_HALL_TRAINS]);
  });

  it('a weak town (under a regiment of its own) raises no army at its hall: the Siwa assault', () => {
    const w = createWorld(town({ controllers: ['ai', 'ai'], fort: 1 }));
    expect(walledCity(w)).toBe(true);
    expect(trainsOf(w, hallOf(w))).toEqual(['worker']);
  });

  it('its stores feed the defender every second while the keep stands', () => {
    const w = walled();
    const food = w.eco.stock[1][RES_INDEX.food];
    for (let i = 0; i < 20; i++) step(w, []);
    expect(w.eco.stock[1][RES_INDEX.food] - food).toBeGreaterThanOrEqual(Math.round(CITY_STORES_PER_SEC.food * MILLI) - 100 * MILLI);
    expect(w.eco.stats[1].gathered[RES_INDEX.food]).toBeGreaterThanOrEqual(Math.round(CITY_STORES_PER_SEC.food * MILLI));
  });

  it('behind a whole ring its laborers stay by the hall and nothing is raised outside', () => {
    const w = walled();
    const hall = hallOf(w);
    for (let i = 0; i < 20 * 90 && !ringBroken(w); i++) { step(w, []); w.events.length = 0; }
    if (!ringBroken(w)) {
      const far = w.squads.filter((q) => q.worker && q.side === 1 && q.alive && Math.hypot(q.x - hall.x, q.y - hall.y) > 9 * 256);
      expect(far.length).toBe(0);
    }
    expect(w.eco.buildings.filter((b) => b.side === 1 && b.type !== 'hall').length).toBe(0);
  });

  it('the keep takes a held share of a blow while the garrison holds a regiment', () => {
    expect(KEEP_HELD_MULT).toBeGreaterThan(0);
    expect(KEEP_HELD_MULT).toBeLessThan(1);
    const w = walled();
    expect(crewShares(w)[1]).toBe(1);
  });
});
