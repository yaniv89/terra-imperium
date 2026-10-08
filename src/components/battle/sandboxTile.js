// Pure URL selection for the QA sandbox. Roads use tileContextOf's actual contract:
// state.world.tileState[id].road, not tileWorks. Nothing is written to campaign state.
export const isSandboxLandTile = (tiles, id) => Number.isInteger(id) && id >= 0 && id < tiles.count && tiles.land[id] === 1;

export const sandboxSampleTile = (tiles) => {
  for (let i = 0; i < tiles.count; i++) {
    if (tiles.land[i] !== 1) continue;
    const ns = tiles.neighbors[i];
    if (ns.some((n) => tiles.land[n] !== 1 && tiles.terrainOf(n) !== 'lake') &&
      ns.some((n) => tiles.land[n] === 1 && tiles.riverBetween(i, n)) &&
      ns.some((n) => tiles.land[n] === 1 && tiles.reliefOf(n) === 'hills')) return i;
  }
  return null;
};

export const sandboxTileOptions = (tiles, params) => {
  // Empty/decimal/exponential/negative/out-of-range/water values use the original sample.
  const raw = params.get('tile');
  const requested = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const tile = isSandboxLandTile(tiles, requested) ? requested : sandboxSampleTile(tiles);
  if (!params.has('artRoads') || !isSandboxLandTile(tiles, tile)) return { tile, state: null };
  const tileState = { [tile]: { road: true } };
  // Only land neighbours across real river edges receive preview roads. Both-bank
  // policy remains entirely tileContextOf's responsibility, including pillaged checks.
  tiles.neighbors[tile].forEach((n) => {
    if (isSandboxLandTile(tiles, n) && tiles.riverBetween(tile, n)) tileState[n] = { road: true };
  });
  return { tile, state: { world: { tileState } } };
};
