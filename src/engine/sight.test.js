import { describe, it, expect } from 'vitest';
import { peoplesWorld } from './testWorld';
import { getTiles } from '../data/geo/tiles';
import { visibleTiles, SIGHT_ARMY } from './sight';

const tiles = getTiles();
const ring = (from, rings) => {
  const seen = new Set([from]); let f = [from];
  for (let d = 0; d < rings; d++) { const n = []; f.forEach((t) => tiles.neighbors[t].forEach((x) => { if (!seen.has(x)) { seen.add(x); n.push(x); } })); f = n; }
  return seen;
};

describe('army sight', () => {
  it('an army just inside the nation\'s visible edge still sees its full radius beyond it', () => {
    const S = peoplesWorld({ size: 'standard', seed: 7, independents: true });
    const me = S.playerNationId;
    const base = visibleTiles(S, me);
    // a flat tile inside the seen area with an unseen neighbour: the edge
    const edge = [...base].find((t) => tiles.reliefOf(t) !== 'hills' && tiles.neighbors[t].some((n) => !base.has(n)));
    const s = { ...S, units: { ...S.units, probe: { id: 'probe', ownerId: me, tile: edge, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, embarkedOn: null } } };
    const seen = visibleTiles(s, me);
    ring(edge, SIGHT_ARMY).forEach((t) => expect(seen.has(t)).toBe(true));
  });
});
