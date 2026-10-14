// The outpost camp in the close view (playtest audit I055): the file naming, the pick by the owner's
// age band, that only an outpost or an ownerless colony takes it, its size against the hex, and
// that the shipped files have the root, the levels and the smoke socket.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { indexShipFiles } from './shipModels';
import { outpostModel, outpostFor, outpostFitRadius, OUTPOST_RADIUS, OUTPOST_HEX_SHARE } from './outpostModels';
import { readGlbJson } from '../../../../scripts/art/glbInfo.mjs';

const INDEX = indexShipFiles({
  '../../../assets/map/outposts/outpost-bronze.glb': 'u/ob',
  '../../../assets/map/outposts/outpost-kingdoms.glb': 'u/ok',
  '../../../assets/map/outposts/outpost-modern.glb': 'u/om'
});

describe('outpost models', () => {
  it('takes the latest age band at or below the owner\'s age', () => {
    expect(outpostModel('bronze', INDEX).url).toBe('u/ob');
    expect(outpostModel('classical', INDEX).url).toBe('u/ob');
    expect(outpostModel('kingdoms', INDEX).url).toBe('u/ok');
    expect(outpostModel('gunpowder', INDEX).url).toBe('u/ok');
    expect(outpostModel('modern', INDEX).url).toBe('u/om');
    expect(outpostModel('bronze', {})).toBeNull();
  });

  it('stands only where a camp stands: an outpost or a colony with no owner yet', () => {
    expect(outpostFor({ owner: 'eg', outpost: { progress: 10 } }, 'bronze', INDEX).name).toBe('outpost-bronze');
    expect(outpostFor({ owner: null, colony: { ownerId: 'eg' } }, 'modern', INDEX).name).toBe('outpost-modern');
    expect(outpostFor({ owner: 'eg' }, 'bronze', INDEX)).toBeNull();
    expect(outpostFor({ owner: 'eg', colony: { ownerId: 'eg' } }, 'bronze', INDEX)).toBeNull();
    expect(outpostFor(undefined, 'bronze', INDEX)).toBeNull();
  });

  it('fills a share of the hex, a little smaller than the small town it grows into', () => {
    expect(OUTPOST_HEX_SHARE).toBeGreaterThan(0.5);
    expect(OUTPOST_HEX_SHARE).toBeLessThan(1);
    // fitting the bigger radius to the hex leaves the real ground at that share of the town's room
    expect(OUTPOST_RADIUS / outpostFitRadius()).toBeCloseTo(OUTPOST_HEX_SHARE, 6);
  });

  it('ships one camp per age band, each a root with LOD0..LOD2 and a smoke socket', () => {
    const files = fs.readdirSync('src/assets/map/outposts').filter((f) => f.endsWith('.glb')).sort();
    expect(files).toEqual(['outpost-bronze.glb', 'outpost-kingdoms.glb', 'outpost-modern.glb']);
    files.forEach((f) => {
      const name = f.replace('.glb', '');
      const { nodes, materials } = readGlbJson(`src/assets/map/outposts/${f}`);
      const root = nodes.find((n) => n.name === name);
      expect(root, f).toBeTruthy();
      const kids = root.children.map((i) => nodes[i].name).sort();
      expect(kids, f).toEqual(['LOD0', 'LOD1', 'LOD2', 'smoke']);
      expect(materials.map((m) => m.name).sort(), f).toEqual(['Ground', 'Team', 'Town']);
      // the bundled index picks the file of the owner's band
      expect(outpostModel(root.name.split('-')[1]).name).toBe(name);
    });
  });
});
