import { describe, it, expect } from 'vitest';
import { PEOPLES, PEOPLES_LIST, PEOPLE_IDS, PINNED_PEOPLE_IDS, LEGACY_NATION_IDS, PEOPLE_REGIONS, peopleForNationId, countryOfNation, modernLandLine } from './peoples';
import { getTiles } from './geo/tiles';
import { spacedApart } from './scenarios';
import { STYLE_NATIONS, STYLE_FALLBACK } from './architecture';
import { getCultureGroup } from './names';
import countriesMeta from './geo/countries-meta.json';

// Civilization I to VII civilizations and their close synonyms, and the city-states the plan
// checked (plans/peoples-and-world-setup.md 4.1 and 5). Kept here so a later addition is caught.
const CIV_NAMES = [
  'Egypt', 'Sumer', 'Babylon', 'Assyria', 'Persia', 'Hittites', 'Greece', 'Macedon', 'Rome', 'Carthage', 'Phoenicia', 'Nubia',
  'Ethiopia', 'Aksum', 'Mali', 'Songhai', 'China', 'Han', 'Maurya', 'Chola', 'Khmer', 'Majapahit', 'Silla', 'Japan', 'Korea',
  'Mongols', 'Scythia', 'Huns', 'Celts', 'Gaul', 'Maya', 'Inca', 'Aztec', 'Mississippian', 'Polynesia', 'Maori', "Hawai'i", 'Tonga',
  'Kush', 'Ta-Seti', 'Xiongnu', 'Qin', 'Yamato', 'Wa', 'Hatti', 'Iberians', 'Olmec', 'Meroë', 'Zagwe', 'Edo', 'Saka', 'Chenla',
  'Licchavi', 'Svear', 'Nazca', 'Cahokia', 'Rapa Nui', 'Nan Madol', 'Byblos', 'Tyre', 'Sidon', 'Ur', 'Hattusa', 'Mohenjo-daro',
  'Kandy', 'Mogadishu', 'Zanzibar', 'Antananarivo', 'Ngazargamu', 'Kumasi', 'Mitla', 'Caguana', 'La Venta', 'Israel'
];

describe('the peoples pool (phase W0)', () => {
  it('has 150 peoples with unique ids, names and adjectives', () => {
    expect(PEOPLES_LIST).toHaveLength(150);
    expect(new Set(PEOPLE_IDS).size).toBe(150);
    expect(new Set(PEOPLES_LIST.map((p) => p.name)).size).toBe(150);
    PEOPLES_LIST.forEach((p) => {
      expect(p.adjective, p.id).toMatch(/\S/);
      expect(PEOPLE_REGIONS[p.region], p.id).toBeDefined();
      expect(['A', 'B', 'C']).toContain(p.weight);
      expect(countriesMeta[p.land], p.id).toBeDefined();
    });
  });

  it('no people id is an old country id (the two id spaces never clash)', () => {
    PEOPLE_IDS.forEach((id) => expect(countriesMeta[id], id).toBeUndefined());
  });

  it('every people has 20 real city names, its capital first, no name used twice anywhere', () => {
    const seen = new Map();
    PEOPLES_LIST.forEach((p) => {
      expect(p.cities, p.id).toHaveLength(20);
      expect(new Set(p.cities).size, p.id).toBe(20);
      expect(p.cities[0], p.id).toBe(p.capital.name);
      p.cities.forEach((name) => { expect(seen.get(name), `${name} of ${p.id}`).toBeUndefined(); seen.set(name, p.id); });
    });
  });

  it('no people takes a Civilization name (civilizations, synonyms, city-states)', () => {
    const civ = new Set(CIV_NAMES.map((n) => n.toLowerCase()));
    PEOPLES_LIST.forEach((p) => {
      const plain = p.name.replace(/^The /, '').toLowerCase();
      if (p.id === 'israel') return; // the Kingdom of Israel is in the pool by the user's decision
      expect(civ.has(plain), p.name).toBe(false);
    });
  });

  it('the Kingdom of Israel is pinned, with the Israelite theme and Jerusalem', () => {
    expect(PINNED_PEOPLE_IDS).toEqual(['israel']);
    expect(PEOPLES.israel).toMatchObject({ name: 'Kingdom of Israel', stem: 'Israel', theme: 'israelite', land: 'il' });
    expect(PEOPLES.israel.capital.name).toBe('Jerusalem');
  });

  it('every theme exists in the art registry (or falls back to one that does)', () => {
    const styles = new Set([...Object.keys(STYLE_NATIONS), ...Object.keys(STYLE_FALLBACK)]);
    PEOPLES_LIST.forEach((p) => expect(styles.has(p.theme), `${p.id} ${p.theme}`).toBe(true));
  });

  it('every capital stands on a livable land tile, and every pair obeys the settling rule', () => {
    const tiles = getTiles();
    PEOPLES_LIST.forEach((p) => {
      expect(p.tile, p.id).not.toBeNull();
      expect(tiles.land[p.tile], p.id).toBe(1);
      expect(tiles.terrainOf(p.tile), p.id).not.toBe('snow');
    });
    expect(new Set(PEOPLES_LIST.map((p) => p.tile)).size).toBe(150);
    for (let i = 0; i < PEOPLES_LIST.length; i++) {
      for (let j = i + 1; j < PEOPLES_LIST.length; j++) {
        const a = PEOPLES_LIST[i]; const b = PEOPLES_LIST[j];
        expect(spacedApart(tiles, a.tile, b.tile), `${a.id}-${b.id}`).toBe(true);
      }
    }
  });

  it('every people has its own colour', () => {
    expect(new Set(PEOPLES_LIST.map((p) => p.color)).size).toBe(150);
    PEOPLES_LIST.forEach((p) => expect(p.color).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('LEGACY_NATION_IDS maps every old country to a people of its land (or the nearest one)', () => {
    const tiles = getTiles();
    Object.keys(tiles.capitals).filter((id) => tiles.capitals[id] != null).forEach((id) => expect(PEOPLES[LEGACY_NATION_IDS[id]], id).toBeDefined());
    expect(LEGACY_NATION_IDS.eg).toBe('kemet');
    expect(LEGACY_NATION_IDS.il).toBe('israel');
    expect(LEGACY_NATION_IDS.iq).toBe('akkad');
    expect(PEOPLES[LEGACY_NATION_IDS.fr].land).toBe('fr');
    expect(peopleForNationId('akkad')).toBe('akkad');
    expect(peopleForNationId('eg')).toBe('kemet');
    expect(peopleForNationId('nowhere')).toBeNull();
  });

  it('country tables read a people through its modern land', () => {
    expect(countryOfNation('akkad')).toBe('iq');
    expect(countryOfNation('fr')).toBe('fr');
    expect(getCultureGroup('akkad')).toBe(getCultureGroup('iq'));
    expect(modernLandLine('akkad')).toBe('in modern Iraq');
    expect(modernLandLine('fr')).toBeNull();
  });
});
