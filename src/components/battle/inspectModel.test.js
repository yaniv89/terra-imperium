import { describe, it, expect } from 'vitest';
import { inspectInfo, buildBlock, buildDetail } from './inspectModel';

const setup = { sides: [{ ageId: 'bronze' }, { ageId: 'bronze' }], city: null, structures: [{ kind: 'keep', damage: 10 }, { kind: 'tower' }, { kind: 'building', category: 'culture', tier: 1, name: 'Temple' }] };
const hud = {
  structures: [
    { kind: 'keep', hp: 2000, maxHp: 3000, alive: true, garrison: 1, garrisonSlots: 3 },
    { kind: 'tower', hp: 0, maxHp: 1000, alive: false, garrison: 0, garrisonSlots: 0 },
    { kind: 'building', hp: 900, maxHp: 900, alive: true }
  ],
  eco: {
    buildings: [
      { idx: 0, type: 'camp', side: 0, hp: 2500, maxHp: 2500, alive: true, built: true, progress: 100, proxy: false },
      { idx: 1, type: 'hall', side: 1, hp: 2000, maxHp: 3000, alive: true, built: true, progress: 100, proxy: true },
      { idx: 2, type: 'barracks', side: 1, hp: 300, maxHp: 1200, alive: true, built: false, progress: 25, proxy: false }
    ],
    nodes: [{ i: 4, kind: 'stone', res: 'materials', amount: 120, max: 500 }]
  }
};

describe('the info card (B09)', () => {
  it('names any building with its owner, HP and state', () => {
    const site = inspectInfo(hud, setup, { kind: 'eco', index: 2 }, 0);
    expect(site).toMatchObject({ title: 'Barracks', owner: 'enemy', hp: 300, maxHp: 1200, built: false, progress: 25 });
    expect(site.lines[0]).toMatch(/Under construction, 25% built/);
    expect(site.icon).toEqual({ group: 'battle', id: 'build-barracks' });
    expect(inspectInfo(hud, setup, { kind: 'eco', index: 0 }, 0)).toMatchObject({ title: 'Expedition camp', owner: 'you' });
  });

  it('the town hall is the keep; ruins, garrison and the region buildings say what they are', () => {
    expect(inspectInfo(hud, setup, { kind: 'eco', index: 1 }, 0)).toMatchObject({ title: 'Keep', owner: 'enemy', hp: 2000, maxHp: 3000 });
    const keep = inspectInfo(hud, setup, { kind: 'structure', index: 0 }, 1);
    expect(keep.owner).toBe('you');
    expect(keep.lines).toContain('Garrison 1 / 3');
    expect(inspectInfo(hud, setup, { kind: 'structure', index: 1 }, 0).lines[0]).toBe('Ruined');
    expect(inspectInfo(hud, setup, { kind: 'structure', index: 2 }, 0)).toMatchObject({ title: 'Temple' });
  });

  it('a resource node shows what is left', () => {
    expect(inspectInfo(hud, setup, { kind: 'node', index: 4 }, 0)).toMatchObject({ title: 'Stone', owner: 'neutral', hp: 120, maxHp: 500 });
  });

  it('the build menu says why a tile is disabled', () => {
    expect(buildBlock('range', [100, 200, 10], 3)).toMatchObject({ kind: 'cost', short: [['gold', 20]] });
    expect(buildBlock('house', [0, 100, 0], 0)).toMatchObject({ kind: 'workers' });
    expect(buildBlock('house', [0, 100, 0], 2)).toBeNull();
    expect(buildDetail('tower', 'bronze')).toMatchObject({ title: 'Tower', hp: 1000, size: 2, time: 45 });
  });
});
