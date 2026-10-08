import { describe, expect, it } from 'vitest';
import { getTiles } from '../../data/geo/tiles';
import { tileContextOf } from '../../battle/setup/tileContext';
import { buildSetupFromArmies } from '../../battle/setup/buildBattleSetup';
import { createWorld } from '../../battle/sim/world';
import { step } from '../../battle/sim/step';
import { worldHash } from '../../battle/sim/hash';
import { sandboxSampleTile, sandboxTileOptions } from './sandboxTile';

const tiles = getTiles();
const ids = Array.from({ length: tiles.count }, (_, i) => i);
const land = ids.find((i) => tiles.land[i] === 1);
const water = ids.find((i) => tiles.land[i] !== 1);
const river = ids.find((i) => tiles.land[i] === 1 && tiles.neighbors[i].some((n) => tiles.land[n] === 1 && tiles.riverBetween(i, n)));
// Independent copy of the previous inline selection is the baseline, not the helper under test.
const originalSample = () => ids.find((i) => tiles.land[i] === 1 &&
  tiles.neighbors[i].some((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'lake') &&
  tiles.neighbors[i].some((n) => tiles.land[n] === 1 && tiles.riverBetween(i, n)) &&
  tiles.neighbors[i].some((n) => tiles.land[n] === 1 && tiles.reliefOf(n) === 'hills')) ?? null;

describe('sandbox real tile and preview roads', () => {
  it('keeps the existing sample and null state when no QA params are provided', () => {
    expect(sandboxTileOptions(tiles, new URLSearchParams())).toEqual({ tile: originalSample(), state: null });
  });
  it('accepts a real land id without implicitly adding roads', () => {
    expect(sandboxTileOptions(tiles, new URLSearchParams(`tile=${land}`))).toEqual({ tile: land, state: null });
  });
  it.each(['', '-1', '1.5', '1e2', 'NaN', 'junk', String(tiles.count), String(water)])('falls back for tile=%s', (value) => {
    expect(sandboxTileOptions(tiles, new URLSearchParams(`tile=${value}`))).toEqual({ tile: originalSample(), state: null });
  });
  it('handles worlds without an eligible sample', () => {
    const empty = { count: 0, land: [], neighbors: [] };
    expect(sandboxSampleTile(empty)).toBeNull();
    expect(sandboxTileOptions(empty, new URLSearchParams('tile=0&artRoads'))).toEqual({ tile: null, state: null });
  });
  it('puts preview roads only on the selected land tile and real land river neighbours', () => {
    const result = sandboxTileOptions(tiles, new URLSearchParams(`tile=${river}&artRoads`));
    const expected = [river, ...tiles.neighbors[river].filter((n) => tiles.land[n] === 1 && tiles.riverBetween(river, n))];
    expect(Object.keys(result.state.world.tileState).map(Number).sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    const ctx = tileContextOf(result.state, river);
    ctx.sectors.forEach((s) => expect(s.bridge).toBe(s.river && !s.water));
    expect(tileContextOf(null, river).sectors.every((s) => !s.bridge)).toBe(true);
    // Missing road on either bank and a pillaged road must not create a bridge.
    const neighbour = expected.find((n) => n !== river);
    for (const tileState of [{ [river]: { road: true } }, { [neighbour]: { road: true } },
      { [river]: { road: true }, [neighbour]: { road: true, pillaged: true } }]) {
      expect(tileContextOf({ world: { tileState } }, river).sectors.find((s) => s.tile === neighbour).bridge).toBe(false);
    }
    expect(result.state.world.tileState[neighbour]).toEqual({ road: true });
  });
  it('retains the same default setup and battle hash after real simulation ticks', () => {
    const units = (prefix) => ['infantry', 'ranged'].map((classId, i) => ({ id: `${prefix}${i}`, classId,
      strength: 1000, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land' }));
    const input = { regionId: 'sandbox-mixed-7', terrain: 'mixed', seed: 7, fortLevel: 0,
      attackerAgeId: 'bronze', defenderAgeId: 'bronze', attackerUnits: units('a'), defenderUnits: units('d'),
      controllers: ['player', 'ai'], infrastructure: 5, deposits: ['iron', 'copper'] };
    const beforeTile = originalSample();
    const after = sandboxTileOptions(tiles, new URLSearchParams());
    const oldSetup = buildSetupFromArmies({ ...input, tileContext: beforeTile == null ? null : tileContextOf(null, beforeTile) });
    const newSetup = buildSetupFromArmies({ ...input, tileContext: after.tile == null ? null : tileContextOf(after.state, after.tile) });
    expect(newSetup).toEqual(oldSetup);
    const oldWorld = createWorld(oldSetup); const newWorld = createWorld(newSetup);
    for (let i = 0; i < 40; i++) { step(oldWorld, []); step(newWorld, []); }
    expect(worldHash(newWorld)).toBe(worldHash(oldWorld));
  });
});
