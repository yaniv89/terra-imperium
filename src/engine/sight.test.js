import { describe, it, expect } from 'vitest';
import { peoplesWorld } from './testWorld';
import { getTiles } from '../data/geo/tiles';
import { visibleTiles, sightIndex, sightTest, SIGHT_ARMY } from './sight';

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

describe('sightTest', () => {
  it('neighbours are symmetric (sightTest walks from the asked tile)', () => {
    for (let t = 0; t < tiles.count; t++) tiles.neighbors[t].forEach((n) => { if (!tiles.neighbors[n].includes(t)) throw new Error(`${t}->${n}`); });
  });
  it('answers like visibleTiles for every tile, with armies, fleets and hills', () => {
    const S = peoplesWorld({ size: 'standard', seed: 7, independents: true });
    const ids = Object.keys(S.nations).slice(0, 6);
    // armies (and a fleet) spread over and past each nation's land, so the unit reaches matter
    const units = { ...S.units };
    ids.forEach((id, i) => {
      const land = Object.values(S.regions).filter((c) => c.owner === id).flatMap((c) => c.tiles || [c.tile]);
      [0, 7, 19].forEach((k) => { const t = land[(k * 13) % land.length] + 40 * k; if (t >= 0 && t < tiles.count) units[`p${i}_${k}`] = { id: `p${i}_${k}`, ownerId: id, tile: t, domain: k === 19 ? 'naval' : 'land', classId: k === 19 ? 'naval' : 'infantry', strength: 1000, embarkedOn: null }; });
    });
    const s = { ...S, units };
    const index = sightIndex(s);
    ids.forEach((id) => {
      const set = visibleTiles(s, id); const test = sightTest(s, id); const indexed = sightTest(s, id, index);
      for (let t = 0; t < tiles.count; t++) if (test(t) !== set.has(t) || indexed(t) !== set.has(t)) throw new Error(`${id} tile ${t}`);
      expect(test(null)).toBe(false);
    });
  });
  it('reads units moved in place once the nations object changes (resolveTurn drafts)', () => {
    const S = peoplesWorld({ size: 'standard', seed: 7, independents: true });
    const me = S.playerNationId;
    const s = { ...S, units: { ...S.units, probe: { id: 'probe', ownerId: me, tile: 0, domain: 'land', classId: 'infantry', strength: 1000, embarkedOn: null } } };
    sightTest(s, me);
    s.units.probe = { ...s.units.probe, tile: 5000 }; // moved in place, as resolveTurn's working copy is
    const later = { ...s, nations: { ...s.nations } };
    const set = visibleTiles(later, me); const test = sightTest(later, me);
    for (let t = 0; t < tiles.count; t++) if (test(t) !== set.has(t)) throw new Error(`tile ${t}`);
  });
});
