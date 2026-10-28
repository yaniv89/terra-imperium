// The mix: every recorded sound lands in its loudness tier at the default volumes, so the music never
// buries the fighting, a unit bark never shouts over a cannon and a tap never startles. The levels
// come from the files (scripts/audio/mix-levels.mjs writes mixLevels.json: each folder's loudest
// 400 ms, EBU R128 momentary LUFS, mean of its variants); this checks them against the gains.
// Tiers follow how Age of Empires IV and Civilization VI layer a mix: the music as a bed, combat in
// front of it, alerts and fanfares above both, interface taps quiet.
import { describe, it, expect } from 'vitest';
import levels from './mixLevels.json';
import { BATTLE_SOUNDS, UI_SOUNDS, WORLD_SOUNDS, battleFilesFor, uiFilesFor, worldFilesFor } from './soundRegistry';
import { MASTER as SFX_MASTER, VOICE_GAIN } from './sfx';
import { BATTLE_MUSIC_DB } from './music';
import { MASTER as BATTLE_MASTER } from '../battle/audio/battleAudio';
import { DEFAULT_VOLUMES } from './audioSettings';

const db = (x) => 20 * Math.log10(x);
const TOLERANCE_DB = 2;
const MUSIC_LUFS = -18; // every track is mastered to -18 LUFS integrated (music/README.md)

const tiers = (lufs, ids) => Object.fromEntries(ids.map((id) => [id, lufs]));
// Heard level (momentary LUFS) at the default Effects volume.
const TIER = {
  ui: { ...tiers(-36, ['ui-click', 'ui-tab']), ...tiers(-32, ['ui-toggle', 'ui-open']), 'ui-close': -33, 'ui-confirm': -31, 'ui-error': -30 },
  world: {
    ...tiers(-29, ['building-queued', 'tech-selected', 'settler-moving', 'army-moved', 'gold-received', 'tribute-paid', 'trade-route', 'city-grows', 'turn-end', 'unit-trained']),
    'turn-begin': -31,
    ...tiers(-25, ['city-founded', 'building-complete', 'wonder-started', 'tech-complete', 'peace-signed', 'pact-signed', 'raid-warning', 'city-besieged', 'city-captured', 'city-lost', 'city-razed', 'event-appeared', 'first-contact', 'independent-joined', 'rebellion', 'battle-won', 'battle-lost']),
    ...tiers(-21, ['war-declared', 'era-advanced', 'wonder-complete', 'game-victory', 'game-defeat'])
  },
  battle: {
    ...tiers(-31, ['sword-clash', 'spear-thrust', 'shield-block', 'arrow-release', 'arrow-hit', 'death-cry']),
    ...tiers(-28, ['arrow-volley', 'arrow-whoosh', 'cavalry-charge', 'musket-volley', 'rifle-fire', 'ballista-release', 'trebuchet-release', 'ram-impact', 'stone-impact']),
    ...tiers(-26, ['cannon-fire', 'explosion', 'under-attack', 'retreat-horn', 'rally-cry', 'power-used', 'horn-order']),
    ...tiers(-34, ['cavalry-hooves', 'chariot-rumble']),
    ...tiers(-24, ['building-collapse', 'gate-breached', 'wall-destroyed', 'general-killed', 'victory', 'defeat']),
    ...tiers(-37, ['worker-chop', 'worker-mine', 'worker-build']),
    'fire-crackle': -38,
    ...tiers(-33, ['order-move', 'order-attack', 'order-click', 'worker-task', 'building-placed', 'battle-ambience', 'war-drums']),
    ...tiers(-29, ['building-finished', 'house-built', 'squad-trained', 'housing-full', 'node-depleted'])
  }
};
const VOICE_TIER = -30;
const BATTLE_MUSIC_LUFS = MUSIC_LUFS + db(DEFAULT_VOLUMES.music) + BATTLE_MUSIC_DB;
const MAP_MUSIC_LUFS = MUSIC_LUFS + db(DEFAULT_VOLUMES.music);

const heard = (folder, gain, bus) => levels[folder] + db(gain * bus * DEFAULT_VOLUMES.effects);
const groups = [
  ['ui', UI_SOUNDS, uiFilesFor, SFX_MASTER],
  ['world', WORLD_SOUNDS, worldFilesFor, SFX_MASTER],
  ['battle', BATTLE_SOUNDS, battleFilesFor, BATTLE_MASTER]
];

describe('the mix', () => {
  it('every id with recordings has a measured level and a tier', () => {
    groups.forEach(([cat, defs, filesFor]) => Object.keys(defs).filter((id) => filesFor(id).length).forEach((id) => {
      expect(levels[`${cat}/${id}`], `${cat}/${id}: run node scripts/audio/mix-levels.mjs`).toBeTypeOf('number');
      expect(TIER[cat][id], `${cat}/${id} has no tier`).toBeTypeOf('number');
    }));
  });

  it('each recorded id is heard within its tier', () => {
    const off = [];
    groups.forEach(([cat, defs, filesFor, bus]) => Object.entries(defs).forEach(([id, def]) => {
      if (!filesFor(id).length) return;
      const h = heard(`${cat}/${id}`, def.gain, bus);
      if (Math.abs(h - TIER[cat][id]) > TOLERANCE_DB) off.push(`${cat}/${id} heard ${h.toFixed(1)}, tier ${TIER[cat][id]}`);
    }));
    expect(off).toEqual([]);
  });

  it('unit barks sit at their tier, under the combat accents', () => {
    Object.keys(levels).filter((k) => k.startsWith('voice/')).forEach((k) => {
      expect(Math.abs(heard(k, VOICE_GAIN, SFX_MASTER) - VOICE_TIER), k).toBeLessThanOrEqual(3);
    });
    expect(VOICE_TIER).toBeLessThan(TIER.battle['cavalry-charge']);
  });

  it('the fighting is in front of the battle music, the news in front of the map music', () => {
    expect(TIER.battle['sword-clash']).toBeGreaterThan(BATTLE_MUSIC_LUFS - 1);
    expect(TIER.battle['arrow-volley']).toBeGreaterThan(BATTLE_MUSIC_LUFS);
    expect(TIER.world['war-declared']).toBeGreaterThan(MAP_MUSIC_LUFS);
    expect(TIER.ui['ui-click']).toBeLessThan(MAP_MUSIC_LUFS); // a tap never covers the music
  });
});
