// An independent city on the WebGL map: its personality picks its shield (the far badge) and the
// banner's frame, and the sprite keys tell personalities apart so the atlas never mixes them.
import { describe, it, expect } from 'vitest';
import { badgeArt, cityBannerArt, independentShieldUrl, independentBannerUrl } from './spriteArt';
import { independentPersonality, PERSONALITY_IDS } from '../../../data/independents';

describe('independent city badge and banner', () => {
  it('reads the personality off the nation record, tribal when it has none, null for a major', () => {
    const nations = { ugarit: { kind: 'independent', indep: { personality: 'mercantile' } }, sheba: { kind: 'independent' }, akkad: { kind: 'major' } };
    expect(independentPersonality(nations, 'ugarit')).toBe('mercantile');
    expect(independentPersonality(nations, 'sheba')).toBe('tribal');
    expect(independentPersonality(nations, 'akkad')).toBeNull();
    expect(independentPersonality(nations, null)).toBeNull();
  });

  it('has a shield per personality and a frame; none for a major\'s city', () => {
    const urls = PERSONALITY_IDS.map(independentShieldUrl);
    urls.forEach((u, i) => expect(u, PERSONALITY_IDS[i]).toBeTruthy());
    expect(new Set(urls).size).toBe(PERSONALITY_IDS.length);
    expect(independentShieldUrl(null)).toBeNull();
    expect(independentBannerUrl()).toBeTruthy();
  });

  it('keys the badge and the banner by personality', () => {
    const b = (indep) => badgeArt({ r0: 5, colour: '#888', fill: '#fff', indep }, 12).key;
    expect(b('raiders')).not.toBe(b('fortress'));
    expect(b(null)).not.toBe(b('tribal'));
    const c = (indep) => cityBannerArt({ name: 'Ugarit', size: 2, colour: '#888', indep }, 2).key;
    expect(c('raiders')).not.toBe(c('mercantile'));
    expect(c(null)).not.toBe(c('tribal'));
  });
});
