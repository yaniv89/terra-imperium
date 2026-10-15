import { it, expect } from 'vitest';
import { getNeighborIds, getNationCapital, getBorderingNationIds } from '../../data/regions';
import { addCity, borderPair, interiorCity, peoplesWorld } from '../testWorld';

const WORLD = peoplesWorld({ size: 'standard', seed: 7, independents: true });
const FR = WORLD.playerNationId; // the player's people

it('bridge adjacency: peoples that border on Earth border on the Dawn world', () => {
  const s = WORLD;
  const fr = getNationCapital(FR);
  const bordering = getBorderingNationIds(s.regions, FR);
  expect(bordering.length).toBeGreaterThan(0);
  const DE = bordering[0]; // a neighbour (Germany in the old fixture)
  bordering.forEach((n) => expect(getBorderingNationIds(s.regions, n)).toContain(FR)); // borders are mutual
  expect(getNeighborIds(fr).every((n) => getNeighborIds(n).includes(fr))).toBe(true);
  const { state: s2, cityId } = addCity(s, FR);
  expect(s2.regions[cityId].owner).toBe(FR);
  expect(getNeighborIds(cityId)).toContain(fr);
  expect(borderPair(s2, FR, DE)).not.toBeNull();
  const { state: s3, cityId: inner } = interiorCity(s2, DE, FR);
  expect(getNeighborIds(inner).some((n) => s3.regions[n]?.owner === FR)).toBe(false);
});
