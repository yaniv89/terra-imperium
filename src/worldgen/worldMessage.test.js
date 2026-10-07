// Workers get the page's own grid in the world message (worldLoader.js worldMessage) and install it
// without fetching or unzipping anything (iOS Safari: less memory, no second network path).
import { describe, it, expect } from 'vitest';
import { worldMessage, loadWorldFromMessage, WORLD_MESSAGE } from './worldLoader';
import { getTiles, loadedRawTiles } from '../data/geo/tiles';

describe('worldMessage', () => {
  it('carries the loaded grid as cloneable typed-array columns, and a worker installs it as is', async () => {
    const tiles = getTiles();
    const msg = worldMessage();
    expect(msg.type).toBe(WORLD_MESSAGE);
    expect(msg.spec.kind).toBe('earth');
    expect(msg.grid).toBe(loadedRawTiles());
    const copy = structuredClone(msg);
    expect(copy.grid.count).toBe(tiles.count);
    expect(copy.grid.land).toBeInstanceOf(Uint8Array);
    const installed = await loadWorldFromMessage(copy);
    expect(installed.count).toBe(tiles.count);
    expect(installed.isLand(tiles.countryTiles[Object.keys(tiles.countryTiles)[0]][0])).toBe(true);
  });
});
