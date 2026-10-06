// src/components/map/closeView/wonderAssets.test.js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { wonderAssetUrl, wonderTierObject, wonderPlacements } from './wonderAssets';
import { GREAT_PROJECT_IDS } from '../../../data/greatProjects';
import { readGlbJson } from '../../../../scripts/art/glbInfo.mjs';

const tiles = { land: { 10: 1, 11: 1, 12: 0 } };

describe('wonder models in the close view', () => {
  it('a wonder without a file has no model', () => {
    expect(wonderAssetUrl('no_such_wonder')).toBeNull();
    expect(wonderAssetUrl('masada', { masada: '/m.glb' })).toBe('/m.glb');
  });

  it('shows the built tier, or the highest tier the file has below it', () => {
    const objs = { tier1: 'a', tier2: 'b', tier3: 'c' };
    expect(wonderTierObject(objs, 1)).toBe('a');
    expect(wonderTierObject(objs, 2)).toBe('b');
    expect(wonderTierObject(objs, 3)).toBe('c');
    expect(wonderTierObject({ tier1: 'a' }, 3)).toBe('a');
    expect(wonderTierObject({ tier2: 'b' }, 1)).toBeNull();
    expect(wonderTierObject(null, 2)).toBeNull();
  });

  it('places each built wonder on its own land tile with its tier and owner, never on water', () => {
    const state = {
      regions: { c1: { owner: 'il' }, c2: { owner: 'eg' } },
      world: { tileState: { 11: { wonder: 'masada' }, 10: { wonder: 'solomons_temple' }, 12: { wonder: 'lighthouse' } } },
      greatProjects: {
        masada: { regionId: 'c1', tier: 2, tile: 11 },
        solomons_temple: { regionId: 'c2', tier: 3, tile: 10 },
        lighthouse: { regionId: 'c1', tier: 1, tile: 12 }, // a water tile: never drawn
        great_library: { regionId: 'c1', tier: 1, tile: 13 } // its tile lost the mark: not drawn
      }
    };
    expect(wonderPlacements(state, tiles)).toEqual([
      { projectId: 'solomons_temple', tile: 10, tier: 3, ownerId: 'eg' },
      { projectId: 'masada', tile: 11, tier: 2, ownerId: 'il' }
    ]);
    expect(wonderPlacements({ regions: {} }, tiles)).toEqual([]);
  });

  const DIR = 'src/assets/map/wonders';
  const SHIPPED = fs.readdirSync(DIR).filter((f) => f.endsWith('.glb')).map((f) => f.replace('.glb', ''));
  it('ships one file per wonder of the game, and none for an unknown id', () => {
    expect(SHIPPED.filter((id) => !GREAT_PROJECT_IDS.includes(id))).toEqual([]);
    expect(GREAT_PROJECT_IDS.filter((id) => !SHIPPED.includes(id))).toEqual([]);
  });

  it('each file holds tier1, tier2 and tier3 with three levels of detail, in the map materials only', () => {
    SHIPPED.forEach((id) => {
      const j = readGlbJson(`${DIR}/${id}.glb`);
      ['tier1', 'tier2', 'tier3'].forEach((t) => {
        const root = j.nodes.find((n) => n.name === t);
        expect(root, `${id} ${t}`).toBeTruthy();
        expect(root.children.map((c) => j.nodes[c].name.replace(/\.\d+$/, '')).sort(), `${id} ${t}`).toEqual(['LOD0', 'LOD1', 'LOD2']);
      });
      j.materials.forEach((m) => expect(['Town', 'Team', 'Ground'], id).toContain(m.name));
    });
  });
});
