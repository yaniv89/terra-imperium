// The march warning (aiOperations.js warnMarches): a stack marching on one of the player's cities
// warns when it sets out, again ARMY_WARN_TILES out, and again only for a march on another city.
import { describe, it, expect } from 'vitest';
import { createInitialState } from './gameReducer';
import { getTiles } from '../data/geo/tiles';
import { rivalOf } from './testWorld';
import { warnMarches, ARMY_WARN_TILES } from './aiOperations';

const base = createInitialState({ playerNationId: 'akkad', rngSeed: 11, scenario: { mode: 'peoples', size: 'standard', seed: 11 } });
const cap = base.nations[base.playerNationId].capitalRegionId;

describe('march warning', () => {
  it('warns once when an army is within reach of the player\'s city, with its men', () => {
    const foe = rivalOf(base, 0); const city = base.regions[cap];
    const t = getTiles();
    const near = t.neighbors[city.tile].find((x) => t.land[x] === 1);
    const unit = (route) => ({ id: 'a', ownerId: foe, tile: near, domain: 'land', classId: 'infantry', strength: 800, route });
    const far = [...Array(ARMY_WARN_TILES).fill(near), city.tile];
    // Setting out: one line with the turns it needs (odds-truth P1), then nothing until ARMY_WARN_TILES out.
    const setOut = { a: unit(far) };
    const first = warnMarches(base, foe, setOut);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ msgKey: 'm.battle.armyMarches', nationId: base.playerNationId });
    expect(first[0].message).toMatch(/ sets? out for .+ with 8,000 men, about \d+ turns? away\./);
    expect(setOut.a.marchSeen).toBe(city.tile);
    expect(warnMarches(base, foe, setOut)).toEqual([]);
    const units = { a: unit([city.tile]) };
    const lines = warnMarches(base, foe, units);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msgKey: 'm.battle.armyNears', nationId: base.playerNationId });
    expect(lines[0].message).toMatch(/ march(es)? on .+ with 8,000 men, 1 tile away\./);
    expect(units.a.marchWarned).toBe(city.tile);
    expect(warnMarches(base, foe, units)).toEqual([]); // once
  });
});
