// The Mesopotamian art theme (audit I215): Akkad, Elam, Mari and Dilmun build it, the land of Iraq
// and Kuwait in every age and the Iranian plateau and Bahrain in the Bronze Age; every file it
// lacks comes from the Levant kit (then the age's base), and kinship is unchanged.
import { describe, it, expect } from 'vitest';
import { PEOPLES, kinThemeOf } from './peoples';
import { styleOfLand, styleChain, themeOfNation, STYLE_FALLBACK } from './architecture';
import { townFileKey, indexTownFiles, townVariant, buildTownManifest } from './townLayout';
import { createArtIndex } from '../battle/art/artIndex';
import { ART } from '../battle/art/artFiles';
import { townAssetUrl, sharedAssetUrls } from '../components/map/closeView/townAssets';
import { kinOf } from '../engine/grudges';

const MESO = ['akkad', 'elam', 'mari', 'dilmun'];
const AGES = ['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'];

describe('Mesopotamian theme routing', () => {
  it('routes the peoples of the rivers and the Gulf to it, the rest of the Near East stays Levant', () => {
    MESO.forEach((id) => {
      expect(PEOPLES[id].theme, id).toBe('mesopotamia');
      expect(themeOfNation(id), id).toBe('mesopotamia');
      expect(styleOfLand(id, 'kingdoms'), id).toBe('mesopotamia'); // a generated world's zone of that people
    });
    ['ugarit', 'media', 'urartu', 'magan', 'saba', 'kanesh'].forEach((id) => expect(PEOPLES[id].theme, id).toBe('levant'));
    expect(STYLE_FALLBACK.mesopotamia).toBe('levant');
    expect(styleChain('mesopotamia')).toEqual(['mesopotamia', 'levant']);
  });

  it('builds the land of Iraq and Kuwait in it in every age, Iran and Bahrain in the Bronze Age only', () => {
    AGES.forEach((age) => {
      expect(styleOfLand('iq', age), age).toBe('mesopotamia');
      expect(styleOfLand('kw', age), age).toBe('mesopotamia');
    });
    expect(styleOfLand('ir', 'bronze')).toBe('mesopotamia');
    expect(styleOfLand('bh', 'bronze')).toBe('mesopotamia');
    AGES.slice(1).forEach((age) => {
      expect(styleOfLand('ir', age), age).toBe('levant');
      expect(styleOfLand('bh', age), age).toBe('levant');
    });
    expect(styleOfLand('sy', 'bronze')).toBe('levant');
    expect(styleOfLand('il', 'bronze')).toBe('israelite');
  });

  it('keeps the Levant tradition for the base layouts', () => {
    expect(townVariant('bronze', 'mesopotamia', 1)).toBe('a');
    expect(townVariant('kingdoms', 'mesopotamia', 0)).toBe('b');
  });

  it('falls back to the Levant town, then the base, for every file it lacks', () => {
    const index = indexTownFiles([
      'bronze-town-small-a', 'bronze-town-small-b', 'bronze-town-small-a-levant', 'bronze-town-small-b-levant',
      'bronze-town-medium-a-mesopotamia', 'bronze-town-medium-b-mesopotamia', 'bronze-town-medium-a-levant',
      'classical-town-big-a', 'classical-town-big-b'
    ]);
    expect(townFileKey('bronze', 'medium', 0, 'mesopotamia', index)).toBe('bronze-town-medium-a-mesopotamia');
    expect(townFileKey('bronze', 'medium', 1, 'mesopotamia', index)).toBe('bronze-town-medium-b-mesopotamia');
    expect(townFileKey('bronze', 'small', 1, 'mesopotamia', index)).toBe('bronze-town-small-b-levant');
    expect(townFileKey('classical', 'big', 1, 'mesopotamia', index)).toBe('classical-town-big-a'); // the base, in the Roman tradition
    expect(townFileKey('kingdoms', 'big', 1, 'mesopotamia', index)).toBeNull();
  });

  it('shows a town for every age and size in the shipped files, its own or the Levant one', () => {
    AGES.forEach((age) => ['small', 'medium', 'big'].forEach((size) => [0, 1].forEach((seed) => {
      const url = townAssetUrl(age, size, seed, 'mesopotamia');
      const levant = townAssetUrl(age, size, seed, 'levant');
      expect(url, `${age} ${size} ${seed}`).toBeTruthy();
      if (!/-mesopotamia/.test(url)) expect(url, `${age} ${size} ${seed}`).toBe(levant);
    })));
    // the shared files: its own first where it has one, the Levant's next, the base last
    AGES.forEach((age) => {
      const shared = sharedAssetUrls(age, 'mesopotamia');
      expect(shared.slice(-1)[0], age).toBe(sharedAssetUrls(age, null).slice(-1)[0]);
      shared.slice(0, -1).forEach((u) => expect(u, age).toMatch(/shared-[a-z]+-(mesopotamia|levant)/));
    });
  });

  it('a city manifest of the theme reads a real town layout', () => {
    const m = buildTownManifest({ cityId: 'kish', ageId: 'bronze', tierId: 'medium', style: 'mesopotamia', seed: 4 });
    expect(m.townKey).toMatch(/^bronze-town-medium-a-(mesopotamia|levant)$/);
    expect(m.structures.some((s) => s.kind === 'house')).toBe(true);
  });

  it('battle skins, damaged houses, civic halls and palace damage follow the chain to the Levant, then the base', () => {
    const files = ['battle/rts/rts-bronze-levant.glb', 'battle/rts/rts-classical-mesopotamia.glb',
      'battle/city/bronze-houses-damage.glb', 'battle/city/bronze-levant-houses-damage.glb', 'battle/city/classical-mesopotamia-houses-damage.glb',
      'battle/city/civic-bronze.glb', 'battle/city/civic-bronze-levant.glb', 'battle/city/palace-damage-bronze.glb'];
    const a = createArtIndex(Object.fromEntries(files.map((k) => [`../../assets/${k}`, `/u/${k}`])));
    expect(a.rtsSkin('bronze', 'mesopotamia').style).toBe('levant');
    expect(a.rtsSkin('classical', 'mesopotamia').style).toBe('mesopotamia');
    expect(a.rtsSkin('kingdoms', 'mesopotamia')).toBeNull();
    expect(a.housesDamage('bronze', 'mesopotamia').style).toBe('levant');
    expect(a.housesDamage('classical', 'mesopotamia').style).toBe('mesopotamia');
    expect(a.civic('bronze', 'mesopotamia').style).toBe('levant');
    expect(a.palaceDamage('bronze', 'mesopotamia').style).toBe('base');
  });

  it('is an art theme only: the Mesopotamian peoples stay kin of the Levant peoples', () => {
    MESO.forEach((id) => expect(kinThemeOf(id), id).toBe('levant'));
    expect(kinThemeOf('ugarit')).toBe('levant');
    expect(kinThemeOf('israel')).toBe('israelite');
    expect(kinThemeOf('kemet')).toBe('nile');
    expect(kinThemeOf(null)).toBeNull();
    expect(kinThemeOf('fr')).toBeNull();
    expect(kinOf({ people: 'akkad' })).toBe(kinOf({ people: 'ugarit' }));
  });

  it('the shipped battle art: the theme\'s own civic halls for the Bronze and Classical cities', () => {
    expect(ART.civic('bronze', 'mesopotamia').style).toBe('mesopotamia');
    expect(ART.civic('classical', 'mesopotamia').style).toBe('mesopotamia');
    expect(ART.civic('classical', 'levant').style).toBe('base'); // no other theme has a Classical hall
  });
});
