import { it, expect } from 'vitest';
import { createInitialState } from '../gameReducer';
import { getNeighborIds, getNationCapital, getBorderingNationIds } from '../../data/regions';
import { addCity, borderPair, interiorCity } from '../testWorld';

it('bridge adjacency: peoples that border on Earth border on the Dawn world', () => {
  const s = createInitialState({ playerNationId: 'fr', rngSeed: 7 });
  const fr = getNationCapital('fr');
  const bordering = getBorderingNationIds(s.regions, 'fr');
  console.log('fr borders', bordering.join(','), '| us borders', getBorderingNationIds(s.regions, 'us').join(','), '| de borders', getBorderingNationIds(s.regions, 'de').join(','));
  expect(bordering).toContain('de'); expect(bordering).toContain('be'); expect(bordering).toContain('es');
  expect(getBorderingNationIds(s.regions, 'us')).toContain('ca');
  expect(getNeighborIds(fr).every((n) => getNeighborIds(n).includes(fr))).toBe(true);
  const { state: s2, cityId } = addCity(s, 'fr');
  expect(s2.regions[cityId].owner).toBe('fr');
  expect(getNeighborIds(cityId)).toContain(fr);
  expect(borderPair(s2, 'fr', 'de')).not.toBeNull();
  const { state: s3, cityId: inner } = interiorCity(s2, 'de', 'fr');
  expect(getNeighborIds(inner).some((n) => s3.regions[n]?.owner === 'fr')).toBe(false);
});
