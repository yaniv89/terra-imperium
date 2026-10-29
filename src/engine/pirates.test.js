// src/engine/pirates.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { getTiles } from '../data/geo/tiles';
import { hasSeaCoast } from './world/cities';
import { isIndependentNation } from '../data/independents';
import { advancePirates, PIRATE_STRENGTH } from './pirates';
import { blockerStands } from './plunder';
import { processAINavalOperations } from './aiOperations';
import { assertGameState } from './stateAudit';
import { peoplesWorld } from './testWorld';

const tiles = getTiles();
const S = peoplesWorld({ player: 'ahhiyawa', seed: 3, age: 'bronze', independents: true });
const me = S.playerNationId;
const ship = (id, owner, regionId, tile, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'naval', classId: 'naval', navalLine: 'warship', transportCapacity: 1, strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, ...extra });

// Run the phase alone until the player's first pirate ship comes (pure and quick).
const firstPirate = (s0) => {
  let s = s0;
  for (let t = s0.turnNumber; t < s0.turnNumber + 300; t++) {
    const r = advancePirates(s, t);
    s = { ...s, units: r.units, nations: r.nations, turnNumber: t };
    const p = Object.values(s.units).find((u) => u.pirate && s.regions[u.pirate.target]?.owner === me);
    if (p) return { s, p, logs: r.logs, turn: t };
  }
  return null;
};

describe('pirates', () => {
  const hit = firstPirate(S);
  it('one weak raider of a coastal independent lurks beside a port of a Bronze-age major, and the player is told', () => {
    expect(hit).not.toBeNull();
    const { s, p, logs } = hit;
    const home = s.nations[p.ownerId];
    expect(isIndependentNation(home)).toBe(true);
    expect(hasSeaCoast(tiles, s.regions[home.capitalRegionId])).toBe(true);
    expect(p).toMatchObject({ domain: 'naval', navalLine: 'raider', strength: PIRATE_STRENGTH });
    expect(tiles.land[p.tile]).not.toBe(1);
    expect(tiles.neighbors[s.regions[p.pirate.target].tile]).toContain(p.tile); // reachable from the port
    expect(logs.map((l) => l.msgKey)).toContain('m.pirates.appear');
    expect(blockerStands(s, me, p.ownerId, p.tile)).toBe(true); // cuts sea trade without a war (plunder.js)
    assertGameState(s);
  });

  it('waits after one, sails off when its time is up, and never comes in Explore mode or before Bronze', () => {
    const { s, p, turn } = hit;
    expect(s.nations[me].pirateNext).toBeGreaterThan(turn);
    const gone = advancePirates(s, p.pirate.until);
    expect(gone.units[p.id]).toBeUndefined();
    expect(gone.logs.map((l) => l.msgKey)).toContain('m.pirates.gone');
    const explore = { ...S, settings: { ...S.settings, explore: true } };
    expect(firstPirate(explore)).toBeNull();
    const stone = peoplesWorld({ player: 'ahhiyawa', seed: 3, independents: true });
    const r = advancePirates({ ...stone, nations: { ...stone.nations, [me]: { ...stone.nations[me], pirateNext: 0 } } }, 50);
    expect(Object.values(r.units).some((u) => u.pirate && stone.regions[u.pirate.target]?.owner === me)).toBe(false);
  });

  it('the player sinks it with one warship, with no war', () => {
    const { s, p } = hit;
    const port = s.regions[p.pirate.target];
    const mine = { ...s, units: { ...s.units, w1: ship('w1', me, port.id, port.tile) }, resources: { ...s.resources, gold: 5000, mil: 5000 } };
    const after = gameReducer(mine, { type: ActionTypes.ATTACK_FLEET, payload: { fromTile: port.tile, tile: p.tile } });
    expect(after.units[p.id]?.strength ?? 0).toBeLessThan(PIRATE_STRENGTH);
    expect(after.wars.length).toBe(s.wars.length);
  });

  it('an AI ship in port beside it attacks it at peace; with no one to fight it the pirate stays put', () => {
    const { s, p } = hit;
    const port = s.regions[p.pirate.target];
    // the same port handed to an AI major
    const ai = Object.values(s.nations).find((n) => n.id !== me && !isIndependentNation(n) && !n.isEliminated).id;
    const theirs = { ...s, regions: { ...s.regions, [port.id]: { ...port, owner: ai } }, units: { ...s.units, w2: ship('w2', ai, port.id, port.tile) }, wars: [] };
    const after = processAINavalOperations(theirs);
    expect(after.units[p.id]?.strength ?? 0).toBeLessThan(PIRATE_STRENGTH);
    expect(processAINavalOperations({ ...s, wars: [] }).units[p.id].tile).toBe(p.tile); // its own people never sails it home
  });
});
