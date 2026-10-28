import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { getTiles } from '../../../../src/data/geo/tiles';
import { WORLD_REGISTRY, ensureDefaultWorld } from '../../../../src/engine/world/registry';
it('default world', () => {
  getTiles();
  const t0 = performance.now();
  ensureDefaultWorld();
  console.log('DEFWORLD ms', (performance.now() - t0).toFixed(0));
  writeFileSync(process.env.OUT, JSON.stringify([WORLD_REGISTRY.regions, WORLD_REGISTRY.coordinates, WORLD_REGISTRY.capitals]));
}, 600000);
