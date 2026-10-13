// The battle building files (src/assets/battle/rts/rts-<age>.glb, manifest row MD13): every role
// of every age has its three states, the whole building, `<role>-damaged` and `<role>-ruined`, each
// with LOD0..LOD2, and a wreck carries no door, rally or banner socket (nothing comes out of it).
import { describe, it, expect } from 'vitest';
import { readGlbJson } from '../../../scripts/art/glbInfo.mjs';
import { BUILDINGS } from '../data/economy';

const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];
const ROLES = ['expedition-camp', 'town-hall', 'food-depot', 'materials-yard', 'trade-post', 'farm-plot', 'mine', 'barracks', 'range',
  'stable', 'siege-workshop', 'aid-post', 'tower'];
const MODERN_EXTRAS = ['generator', 'airfield', 'radar-aa'];
const STATES = ['', '-damaged', '-ruined'];

describe('battle building files: three states per role', () => {
  it('the 13 roles are the roles the battle economy draws', () => {
    const drawn = new Set(Object.values(BUILDINGS).map((b) => b.art));
    ROLES.forEach((role) => expect(drawn.has(role), role).toBe(true));
  });

  it.each(AGES)('rts-%s.glb has every role whole, damaged and ruined, with three LODs each', (age) => {
    const j = readGlbJson(`src/assets/battle/rts/rts-${age}.glb`);
    const roots = new Map(j.scenes[j.scene || 0].nodes.map((i) => [j.nodes[i].name, j.nodes[i]]));
    const kids = (root) => (root.children || []).map((c) => j.nodes[c].name || '');
    const missing = [];
    [...ROLES, ...(age === 'modern' ? MODERN_EXTRAS : [])].forEach((role) => STATES.forEach((state) => {
      const root = roots.get(role + state);
      if (!root) { missing.push(role + state); return; }
      const names = kids(root);
      ['LOD0', 'LOD1', 'LOD2'].forEach((lod) => { if (!names.some((n) => n.startsWith(lod))) missing.push(`${role}${state}/${lod}`); });
      if (state === '-ruined') {
        const sockets = names.filter((n) => n.startsWith('socket-'));
        expect(sockets.every((n) => /^socket-(fire|smoke)-\d/.test(n)), `${role}-ruined sockets: ${sockets}`).toBe(true);
        expect(sockets.some((n) => n.startsWith('socket-smoke')), `${role}-ruined smoke`).toBe(true);
      }
    }));
    expect(missing).toEqual([]);
  });
});
