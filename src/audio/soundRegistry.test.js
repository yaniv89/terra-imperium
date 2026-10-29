// The sound registry: every battle sound the game names, files grouped by folder, variants picked
// without repeating, and the music decision.
import { describe, it, expect } from 'vitest';
import { BATTLE_SOUNDS, UI_SOUNDS, WORLD_SOUNDS, BATTLE_SOUND_IDS, AMBIENCE_SOUNDS, groupByFolder, pickVariant, createSoundRng, battleFilesFor, musicTracks, battleMusicTracks, ambienceFilesFor, tracksForAge } from './soundRegistry';
import { AGE_ORDER } from '../data/ages';
import { musicWanted, nextTrack } from './music';
import { soundForEvent, cueForEvent, SILENT_EVENTS, isBattleAudioEnabled } from '../battle/audio/battleAudio';
import { ACTION_SOUNDS, actionSound } from './worldSounds';
import { ActionTypes } from '../data/types';
import { getAudioSettings, setAudioSettings, resetAudioSettingsCache } from './audioSettings';

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
    Object.keys(AMBIENCE_SOUNDS).forEach((id) => expect(ambienceFilesFor(id).length, id).toBeGreaterThanOrEqual(1));
  });

  it('every age has its own map music, at least two tracks, none shared with another age', () => {
    const seen = new Set();
    AGE_ORDER.forEach((age) => {
      const list = musicTracks(age);
      expect(list.length, age).toBeGreaterThanOrEqual(2);
      expect(list.every((u) => u.includes(`/music/ages/${age}/`)), age).toBe(true);
      list.forEach((u) => { expect(seen.has(u)).toBe(false); seen.add(u); });
    });
  });

  it('an age without its own folder takes the nearest earlier one, else the nearest later one', () => {
    const byAge = { bronze: ['b'], modern: ['m'] };
    expect(tracksForAge(byAge, 'stone')).toEqual(['b']);
    expect(tracksForAge(byAge, 'kingdoms')).toEqual(['b']);
    expect(tracksForAge(byAge, 'future')).toEqual(['m']);
    expect(tracksForAge({}, 'future')).toEqual([]);
  });

  it('battle music: the ancient playlist until gunpowder, then the later ages\' own', () => {
    expect(battleMusicTracks('kingdoms').every((u) => /music\/battle\/[^/]+\.ogg$/.test(u))).toBe(true);
    expect(battleMusicTracks('modern').every((u) => u.includes('/music/battle/gunpowder/'))).toBe(true);
    expect(battleMusicTracks('future').every((u) => u.includes('/music/battle/information/'))).toBe(true);
  });

  it('the battle playlist is its own folder, never part of the map playlist', () => {
    const battle = battleMusicTracks();
    expect(battle.length).toBeGreaterThanOrEqual(4);
    expect(battle.every((u) => /music\/battle\//.test(u))).toBe(true);
    expect(musicTracks().some((u) => /\/battle\/|\/ambience\//.test(u))).toBe(false);
  });

  it('an id with no files falls back to the synthesized sound (empty list)', () => {
    expect(battleFilesFor('laser-fire')).toEqual([]);
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

// The sound gate (plan 2026-10-29 KTD6): every map and battle event has a cue, every age has
// music, and one tap mutes both channels and gives back the old volumes.
describe('sound gate: cue coverage', () => {
  // Every type a battle sim module pushes into w.events (the ternary's names too).
  const simEventTypes = () => {
    const sources = import.meta.glob(['../battle/sim/*.js', '!../battle/sim/*.test.js'], { query: '?raw', import: 'default', eager: true });
    const types = new Set();
    Object.values(sources).forEach((src) => {
      for (const [, expr] of src.matchAll(/events\.push\(\{[^}]*?type: ([^,}]+)/g)) {
        for (const [, name] of expr.replace(/===\s*'[^']*'/g, '').matchAll(/'([a-zA-Z]+)'/g)) types.add(name);
      }
    });
    return [...types];
  };

  it('finds the sim events (the scan works)', () => {
    const types = simEventTypes();
    ['melee', 'shot', 'destroyed', 'ended', 'trained', 'shieldHit'].forEach((t) => expect(types).toContain(t));
  });

  it('every battle sim event has a sound or a player cue, or is silent on purpose', () => {
    const view = { squads: [{ idx: 0, side: 0, x: 0, y: 0 }], structures: [{ id: 's', kind: 'gate', x: 0, y: 0 }], eco: { buildings: [] } };
    simEventTypes().forEach((type) => {
      const e = { type, id: 0, from: 0, to: 0, side: 0, structure: 's', power: 'rallyCry', outcome: 'attacker', x: 0, y: 0 };
      const sound = soundForEvent(e, view, ['bronze', 'bronze'], 0)?.id;
      const cue = cueForEvent(e, view, 0);
      if (SILENT_EVENTS.has(type)) return;
      expect(sound || cue, `sim event '${type}' has no sound: add a case in battleAudio.js or SILENT_EVENTS`).toBeTruthy();
      [sound, cue].filter(Boolean).forEach((id) => expect(BATTLE_SOUNDS[id], `${type} -> ${id}`).toBeTruthy());
    });
  });

  it('every map action names a registered cue or is silent on purpose', () => {
    const prev = { playerNationId: 'akkad', regions: {}, units: {}, logs: [] };
    Object.values(ActionTypes).forEach((type) => {
      expect(ACTION_SOUNDS, type).toHaveProperty(type);
      const id = actionSound({ type, payload: {} }, prev, prev);
      if (id !== null) expect(UI_SOUNDS[id] || WORLD_SOUNDS[id], `${type} -> ${id}`).toBeTruthy();
    });
  });

  it('every age has map and battle music', () => {
    AGE_ORDER.forEach((age) => {
      expect(musicTracks(age).length, age).toBeGreaterThan(0);
      expect(battleMusicTracks(age).length, age).toBeGreaterThan(0);
    });
  });

  it('one tap mutes music and effects; the next gives back the old volumes', () => {
    try { localStorage.clear(); } catch { /* no storage */ }
    resetAudioSettingsCache();
    setAudioSettings({ music: 0.3, effects: 0.6 });
    setAudioSettings({ sound: false });
    const s = getAudioSettings();
    expect(musicWanted({ started: true, sound: s.sound, volume: s.music, suppressed: false, hidden: false, trackCount: 3 })).toBe(false);
    expect(isBattleAudioEnabled()).toBe(false);
    setAudioSettings({ sound: true });
    expect(getAudioSettings()).toMatchObject({ music: 0.3, effects: 0.6, sound: true });
    expect(isBattleAudioEnabled()).toBe(true);
  });
});
