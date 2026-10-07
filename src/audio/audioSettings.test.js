import { describe, it, expect, beforeEach } from 'vitest';
import { getAudioSettings, setAudioSettings, resetAudioSettingsCache } from './audioSettings';
import { isBattleAudioEnabled } from '../battle/audio/battleAudio';

describe('audio settings: separate music and battle-sound switches', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* no storage */ } resetAudioSettingsCache(); });

  it('both are on by default', () => {
    const s = getAudioSettings();
    expect(s.musicOn).toBe(true);
    expect(s.effectsOn).toBe(true);
  });

  it('muting battle sounds silences only the battle', () => {
    setAudioSettings({ effectsOn: false });
    expect(isBattleAudioEnabled()).toBe(false);
    expect(getAudioSettings().musicOn).toBe(true);
  });

  it('the master Sound switch still mutes everything', () => {
    setAudioSettings({ sound: false, effectsOn: true });
    expect(isBattleAudioEnabled()).toBe(false);
  });
});
