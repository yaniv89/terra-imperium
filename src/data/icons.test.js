import { describe, it, expect } from 'vitest';
import {
  iconUrl, iconIds, ICON_GROUPS, BUILDING_ICON_IDS, EXTRACTION_ICON_IDS, buildingIconUrl, buildingIconUrlForAge,
  buildingIconTiersMatch, extractionIconUrl, unitIconUrl, shipIconUrl, cityIconUrl, CITY_SIZES, ageIconUrl,
  markerIconUrl, resourceIconUrl, improvementIconUrl, wonderIconUrl,
  BATTLE_STOCK_ICON_IDS, battleStockIconUrl, BATTLE_GLYPH_IDS, CAPTURE_CHOICE_ICON_IDS, UI_ICON_IDS, uiIconUrl, INDEPENDENT_ICON_IDS,
  CITY_STATE_ICON_IDS, CITY_STATE_PATRON_ICON_ID, cityStateIconUrl, cityStatePatronIconUrl
} from './icons';
import { CITY_STATE_TYPES } from './cityStates';
import { PERSONALITY_IDS, PERSONALITIES } from './independents';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESOURCES_ON_TILES, IMPROVEMENT_IDS } from './tileYields';
import { BUILDING_CATEGORIES, EXTRACTION_BUILDINGS } from './buildings';
import { GREAT_PROJECTS } from './greatProjects';
import { UNIT_CLASS_IDS } from './unitClasses';
import { NAVAL_LINE_IDS } from './navalLines';
import { AGE_ORDER } from './ages';
import { BUILDINGS as BATTLE_BUILDINGS, RESOURCES as BATTLE_RESOURCES } from '../battle/data/economy';

const ICON_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');
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
    AGE_ORDER.filter((a) => a !== 'stone').forEach((a) => expect(ageIconUrl(a), a).toBeTruthy()); // the Stone icon is art (U93)
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
      markers: ['capital', 'wonder', 'event', 'battle'],
      battle: [...Object.values(BATTLE_BUILDINGS).map((b) => b.icon), ...Object.values(BATTLE_STOCK_ICON_IDS), ...BATTLE_GLYPH_IDS],
      ui: UI_ICON_IDS,
      independents: [...INDEPENDENT_ICON_IDS, ...Object.values(CITY_STATE_ICON_IDS), CITY_STATE_PATRON_ICON_ID]
    };
    ICON_GROUPS.forEach((g) => iconIds(g).forEach((id) => expect(used[g], `${g}/${id}`).toContain(id)));
  });
});

describe('UI icons of the 13 October art update', () => {
  const svg = (group, id) => readFileSync(join(ICON_DIR, group, `${id}.svg`), 'utf8');

  it('has a battle stock icon for every battle resource, wood, stone, supply and population (UI14)', () => {
    [...BATTLE_RESOURCES, 'wood', 'stone', 'supply', 'population'].forEach((r) => expect(battleStockIconUrl(r), r).toBeTruthy());
    expect(battleStockIconUrl('stone')).not.toBe(battleStockIconUrl('wood')); // four stocks in the sim (U01)
    expect(battleStockIconUrl('materials')).toBeNull(); // retired (Q1)
    expect(battleStockIconUrl('wood')).not.toBe(battleStockIconUrl('stone'));
    expect(battleStockIconUrl('supply')).not.toBe(battleStockIconUrl('gold'));
    expect(battleStockIconUrl('nope')).toBeNull();
  });

  it('resolves every battle glyph and every card and map icon', () => {
    BATTLE_GLYPH_IDS.forEach((id) => expect(iconUrl('battle', id), id).toBeTruthy());
    UI_ICON_IDS.forEach((id) => expect(uiIconUrl(id), id).toBeTruthy());
    expect(Object.keys(CAPTURE_CHOICE_ICON_IDS)).toEqual(['conquer', 'raze', 'tributary', 'free']);
    expect(uiIconUrl('capture-conquer-disabled')).toBeNull(); // disabled is a CSS look, not a file
  });

  it('draws them as plain vector art: no text, no embedded picture, the 256 box (two wide pieces apart)', () => {
    const wide = { 'field-edge': '0 0 96 24', 'capture-header': '0 0 512 96' };
    const all = [...new Set(Object.values(BATTLE_STOCK_ICON_IDS)), ...BATTLE_GLYPH_IDS].map((id) => ['battle', id]).concat(UI_ICON_IDS.map((id) => ['ui', id]));
    all.forEach(([group, id]) => {
      const text = svg(group, id);
      expect(text, id).not.toMatch(/<text|<image|<script|href=/);
      expect(text, id).toContain(`viewBox="${wide[id] || '0 0 256 256'}"`);
    });
  });

  it('keeps the base marker and the base counter tintable', () => {
    ['base-marker', 'base-status'].forEach((id) => expect(svg('battle', id), id).toContain('fill="currentColor"'));
  });
});

describe('independent city art', () => {
  const svg = (id) => readFileSync(join(ICON_DIR, 'independents', `${id}.svg`), 'utf8');

  it('has a shield for every personality and the banner frame', () => {
    PERSONALITY_IDS.forEach((p) => expect(iconUrl('independents', p), p).toBeTruthy());
    expect(iconUrl('independents', 'banner-frame')).toBeTruthy();
    expect(INDEPENDENT_ICON_IDS).toEqual([...PERSONALITY_IDS, 'banner-frame']);
  });

  it('draws them in the icon style: vector only, no letters, the outline colour, the 256 box (the frame 256 by 64)', () => {
    INDEPENDENT_ICON_IDS.forEach((id) => {
      const text = svg(id);
      expect(text, id).not.toMatch(/<text|<image|<script|href=/);
      expect(text, id).toContain('#292C29');
      expect(text, id).toContain(id === 'banner-frame' ? 'viewBox="0 0 256 64"' : 'viewBox="0 0 256 256"');
    });
    // each shield in its own personality's colour
    PERSONALITY_IDS.forEach((p) => expect(svg(p).toUpperCase(), p).toContain(PERSONALITIES[p].badge.toUpperCase()));
  });
});

describe('city-state badges (UI18)', () => {
  const svg = (id) => readFileSync(join(ICON_DIR, 'independents', `${id}.svg`), 'utf8');
  const ids = [...Object.values(CITY_STATE_ICON_IDS), CITY_STATE_PATRON_ICON_ID];

  it('has a badge for every city-state type and the patron mark', () => {
    expect(Object.keys(CITY_STATE_ICON_IDS).sort()).toEqual(Object.keys(CITY_STATE_TYPES).sort());
    Object.keys(CITY_STATE_TYPES).forEach((t) => expect(cityStateIconUrl(t), t).toBeTruthy());
    expect(new Set(Object.keys(CITY_STATE_TYPES).map(cityStateIconUrl)).size).toBe(Object.keys(CITY_STATE_TYPES).length);
    expect(cityStatePatronIconUrl()).toBeTruthy();
    expect(cityStateIconUrl('nope')).toBeNull();
  });

  it('draws them in the icon style: vector only, no letters, the 256 box, each badge in its type colour', () => {
    ids.forEach((id) => {
      const text = svg(id);
      expect(text, id).not.toMatch(/<text|<image|<script|href=/);
      expect(text, id).toContain('#292C29');
      expect(text, id).toContain('viewBox="0 0 256 256"');
    });
    Object.entries(CITY_STATE_ICON_IDS).forEach(([t, id]) => expect(svg(id).toUpperCase(), t).toContain(CITY_STATE_TYPES[t].badge.toUpperCase()));
  });
});

describe('battle building icons', () => {
  it('has an icon for every battle-economy building (scripts/art/build-icons.mjs)', () => {
    Object.entries(BATTLE_BUILDINGS).forEach(([id, b]) => expect(iconUrl('battle', b.icon), id).toBeTruthy());
  });
});
