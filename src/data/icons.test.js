import { describe, it, expect } from 'vitest';
import {
  iconUrl, iconIds, ICON_GROUPS, BUILDING_ICON_IDS, EXTRACTION_ICON_IDS, buildingIconUrl, buildingIconUrlForAge,
  buildingIconTiersMatch, extractionIconUrl, unitIconUrl, shipIconUrl, cityIconUrl, CITY_SIZES, ageIconUrl,
  markerIconUrl, resourceIconUrl, improvementIconUrl, wonderIconUrl
} from './icons';
import { RESOURCES_ON_TILES, IMPROVEMENT_IDS } from './tileYields';
import { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from './buildings';
import { GREAT_PROJECTS } from './greatProjects';
import { UNIT_CLASS_IDS } from './unitClasses';
import { NAVAL_LINE_IDS } from './navalLines';
import { AGE_ORDER } from './ages';
import { WONDER_ICONS } from '../components/city/wonderIcons';
import { BUILDING_MODEL_IDS } from '../components/map/closeView/buildingModels';

// Ids with no delivered art, on purpose: each falls back to its old glyph (src/components/ui/icons.jsx).
const NO_ART = {
  buildings: ['cathedral'], // not in the delivery yet: the culture line's old silhouette stays
  units: ['naval'], // drawn by its line (ships)
  wonders: ['solomons_temple', 'masada'] // scenario wonders outside art spec section 5: lucide glyphs
};

describe('icon index', () => {
  it('finds the delivered files and gives null for unknown ids', () => {
    ICON_GROUPS.forEach((g) => expect(iconIds(g).length, g).toBeGreaterThan(0));
    expect(typeof iconUrl('resources', 'wheat')).toBe('string');
    expect(iconUrl('resources', 'nope')).toBeNull();
    expect(iconUrl('nope', 'wheat')).toBeNull();
    expect(iconUrl('resources', null)).toBeNull();
  });

  it('has art for every map resource and every macro metal and gold', () => {
    Object.keys(RESOURCES_ON_TILES).forEach((id) => expect(resourceIconUrl(id), id).toBeTruthy());
    ['gold', 'copper', 'iron', 'oil'].forEach((id) => expect(resourceIconUrl(id), id).toBeTruthy());
  });

  it('has art for every tile improvement', () => {
    IMPROVEMENT_IDS.forEach((id) => expect(improvementIconUrl(id), id).toBeTruthy());
  });

  it('maps every building tier to art, or to a deliberate fallback', () => {
    expect(buildingIconTiersMatch()).toBe(true);
    Object.entries(BUILDING_CATEGORIES).forEach(([cat, c]) => c.tiers.forEach((t, i) => {
      const id = BUILDING_ICON_IDS[cat][i];
      if (cat === 'defense') expect(id, `${cat} ${i}`).toBeNull(); // the wall ring, not a landmark
      else if (NO_ART.buildings.includes(id)) expect(buildingIconUrl(cat, i)).toBeNull();
      else expect(buildingIconUrl(cat, i), `${cat} ${i} ${id}`).toBeTruthy();
    }));
    Object.keys(EXTRACTION_BUILDINGS).forEach((id) => expect(extractionIconUrl(id), id).toBeTruthy());
    expect(buildingIconUrlForAge('food', 'gunpowder')).toBe(buildingIconUrl('food', 3));
    expect(buildingIconUrlForAge('economy', 'bronze')).toBeNull();
  });

  it('uses the same building ids as the close view models', () => {
    Object.entries(BUILDING_MODEL_IDS).forEach(([cat, ids]) => expect(BUILDING_ICON_IDS[cat]).toEqual(ids));
    expect(EXTRACTION_ICON_IDS).toEqual({ copper: 'copper_mine', iron: 'iron_foundry', oil: 'oil_well' });
  });

  it('has art for every wonder of the spec, a lucide glyph for the rest', () => {
    Object.keys(GREAT_PROJECTS).forEach((id) => {
      if (NO_ART.wonders.includes(id)) { expect(wonderIconUrl(id)).toBeNull(); expect(WONDER_ICONS[id], id).toBeTruthy(); }
      else expect(wonderIconUrl(id), id).toBeTruthy();
    });
  });

  it('has art for every unit class, the settler and every naval line', () => {
    UNIT_CLASS_IDS.filter((c) => !NO_ART.units.includes(c)).forEach((c) => expect(unitIconUrl(c), c).toBeTruthy());
    expect(unitIconUrl('settler')).toBeTruthy();
    NAVAL_LINE_IDS.forEach((l) => expect(shipIconUrl(l), l).toBeTruthy());
    expect(shipIconUrl(undefined)).toBe(shipIconUrl('warship'));
  });

  it('has a city badge for every size and age, an icon per age and the four markers', () => {
    CITY_SIZES.forEach((s) => AGE_ORDER.forEach((a) => expect(cityIconUrl(s, a), `${s} ${a}`).toBeTruthy()));
    expect(cityIconUrl(undefined, 'nope')).toBe(cityIconUrl('small', 'bronze'));
    AGE_ORDER.forEach((a) => expect(ageIconUrl(a), a).toBeTruthy());
    ['capital', 'wonder', 'event', 'battle'].forEach((m) => expect(markerIconUrl(m), m).toBeTruthy());
  });

  it('ships no file the game never asks for', () => {
    const used = {
      resources: [...Object.keys(RESOURCES_ON_TILES), 'gold', 'copper', 'iron', 'oil'],
      improvements: IMPROVEMENT_IDS,
      buildings: [...Object.values(BUILDING_ICON_IDS).flat(), ...Object.values(EXTRACTION_ICON_IDS)],
      wonders: Object.keys(GREAT_PROJECTS),
      units: [...UNIT_CLASS_IDS, 'settler'],
      ships: NAVAL_LINE_IDS,
      cities: CITY_SIZES.flatMap((s) => AGE_ORDER.map((a) => `city-${s}-${a}`)),
      ages: AGE_ORDER,
      markers: ['capital', 'wonder', 'event', 'battle']
    };
    ICON_GROUPS.forEach((g) => iconIds(g).forEach((id) => expect(used[g], `${g}/${id}`).toContain(id)));
  });
});
