// Warship models for fleets in the close view: the file naming, the pick by the owner's age, and
// that the shipped files have the root and levels the instanced layer reads.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseShipFile, indexShipFiles, shipModel, shipsFor } from './shipModels';
import { readGlbJson } from '../../../../scripts/art/glbInfo.mjs';

const INDEX = indexShipFiles({
  '../../../assets/map/ships/warship-bronze.glb': 'u/wb',
  '../../../assets/map/ships/warship-kingdoms.glb': 'u/wk',
  '../../../assets/map/ships/warship-oops.glb': 'u/bad'
});

describe('ship models', () => {
  it('reads warship-<age> names', () => {
    expect(parseShipFile('warship-classical')).toEqual({ kind: 'warship', age: 'classical' });
    expect(parseShipFile('warship-oops')).toBeNull();
    expect(parseShipFile('warship')).toBeNull();
  });

  it('takes the latest age at or below the owner\'s', () => {
    expect(shipModel('bronze', 'warship', INDEX).url).toBe('u/wb');
    expect(shipModel('classical', 'warship', INDEX).url).toBe('u/wb');
    expect(shipModel('modern', 'warship', INDEX).url).toBe('u/wk');
    expect(shipModel('bronze', 'transport', INDEX)).toBeNull();
    expect(shipModel('bronze', 'warship', {})).toBeNull();
  });

  it('shows more ships for a bigger fleet', () => {
    expect([1, 4, 5, 11, 12, 40].map(shipsFor)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('ships the bronze, classical and kingdoms warships, each a root with LOD0..LOD2', () => {
    const files = fs.readdirSync('src/assets/map/ships').filter((f) => f.endsWith('.glb')).sort();
    expect(files).toEqual(['warship-bronze.glb', 'warship-classical.glb', 'warship-kingdoms.glb']);
    files.forEach((f) => {
      const name = f.replace('.glb', '');
      const { nodes } = readGlbJson(`src/assets/map/ships/${f}`);
      const root = nodes.find((n) => n.name === name);
      expect(root, f).toBeTruthy();
      expect(root.children.map((c) => nodes[c].name).sort(), f).toEqual(['LOD0', 'LOD1', 'LOD2']);
    });
    expect(shipModel('classical').name).toBe('warship-classical');
    expect(shipModel('gunpowder').name).toBe('warship-kingdoms');
  });
});
