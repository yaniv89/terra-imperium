// The sound registry: every battle sound the game names, files grouped by folder, variants picked
// without repeating, and the music decision.
import { describe, it, expect } from 'vitest';
import { BATTLE_SOUNDS, BATTLE_SOUND_IDS, groupByFolder, pickVariant, createSoundRng, battleFilesFor, musicTracks, battleMusicTracks, ambienceFilesFor } from './soundRegistry';
import { musicWanted, nextTrack } from './music';

describe('sound registry', () => {
  it('lists every battle sound, each with a level, a cooldown and a fallback or a loop', () => {
    ['sword-clash', 'spear-thrust', 'arrow-release', 'arrow-volley', 'arrow-hit', 'shield-block', 'cavalry-charge', 'cavalry-hooves',
      'chariot-rumble', 'ram-impact', 'ballista-release', 'trebuchet-release', 'cannon-fire', 'musket-volley', 'rifle-fire', 'explosion',
      'building-collapse', 'fire-crackle', 'death-cry', 'horn-order', 'war-drums', 'battle-ambience', 'worker-chop', 'worker-mine', 'worker-build']
      .forEach((id) => expect(BATTLE_SOUND_IDS).toContain(id));
    Object.entries(BATTLE_SOUNDS).forEach(([id, def]) => {
      expect(def.gain, id).toBeGreaterThan(0);
      expect(def.cooldownMs, id).toBeGreaterThanOrEqual(0);
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/); // a folder name
    });
  });

  it('groups files by their folder (the sound id), sorted', () => {
    const g = groupByFolder({ '../assets/audio/battle/sword-clash/b.ogg': 'u2', '../assets/audio/battle/sword-clash/a.ogg': 'u1', '../assets/audio/battle/explosion/x.mp3': 'u3' });
    expect(g).toEqual({ 'sword-clash': ['u1', 'u2'], explosion: ['u3'] });
  });

  it('finds the shipped CC0 recordings: battle variants per id and the map playlist', () => {
    expect(battleFilesFor('sword-clash').length).toBeGreaterThanOrEqual(2);
    expect(battleFilesFor('cavalry-hooves').length).toBeGreaterThanOrEqual(2);
    expect(musicTracks().length).toBeGreaterThanOrEqual(6);
    expect(ambienceFilesFor('map-wind').length).toBeGreaterThanOrEqual(1);
  });

  it('the battle playlist is its own folder, never part of the map playlist', () => {
    const battle = battleMusicTracks();
    expect(battle.length).toBeGreaterThanOrEqual(4);
    expect(battle.every((u) => /music\/battle\//.test(u))).toBe(true);
    expect(musicTracks().some((u) => /\/battle\/|\/ambience\//.test(u))).toBe(false);
  });

  it('an id with no files falls back to the synthesized sound (empty list)', () => {
    expect(battleFilesFor('victory')).toEqual([]);
  });

  it('picks variants at random, never the same twice in a row', () => {
    const rng = createSoundRng(7);
    let last = -1;
    for (let k = 0; k < 50; k++) { const i = pickVariant(['a', 'b', 'c'], rng, last); expect(i).not.toBe(last); expect(i).toBeGreaterThanOrEqual(0); last = i; }
    expect(pickVariant(['only'], rng, 0)).toBe(0);
    expect(pickVariant([], rng)).toBe(-1);
  });

  it('music: on the map only, after a gesture, with sound on and tracks to play', () => {
    const base = { started: true, sound: true, volume: 0.5, suppressed: false, hidden: false, trackCount: 3 };
    expect(musicWanted(base)).toBe(true);
    expect(musicWanted({ ...base, suppressed: true })).toBe(false); // a battle is open
    expect(musicWanted({ ...base, hidden: true })).toBe(false);
    expect(musicWanted({ ...base, sound: false })).toBe(false);
    expect(musicWanted({ ...base, volume: 0 })).toBe(false);
    expect(musicWanted({ ...base, trackCount: 0 })).toBe(false);
    expect(musicWanted({ ...base, started: false })).toBe(false);
    expect(nextTrack(2, 3)).toBe(0);
  });
});
