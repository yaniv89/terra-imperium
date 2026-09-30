// The synthesized battle audio: plays the right kind of sound for each sim event, stays quiet
// when muted, throttles floods of identical events, and never throws without WebAudio.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBattleAudio, isBattleAudioEnabled, setBattleAudioEnabled } from './battleAudio';

// The suite runs in Node: a minimal window/localStorage stand-in is all this module touches.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), clear: () => store.clear() };
globalThis.window = globalThis;

const fakeNode = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 0 }, pan: { value: 0 }, playbackRate: { value: 1 }, start: vi.fn(), stop: vi.fn() });
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = fakeNode(); FakeAudioContext.oscillators = 0; FakeAudioContext.instances += 1; }
  createGain() { return fakeNode(); }
  createStereoPanner() { return fakeNode(); }
  createBiquadFilter() { return fakeNode(); }
  createBufferSource() { return fakeNode(); }
  createOscillator() { FakeAudioContext.oscillators += 1; return { ...fakeNode(), type: 'sine' }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() {} suspend() {} close() {}
}
FakeAudioContext.instances = 0;

describe('battle audio', () => {
  beforeEach(() => { localStorage.clear(); window.AudioContext = FakeAudioContext; FakeAudioContext.instances = 0; });

  it('plays age-appropriate shots and throttles a flood of them', () => {
    const audio = createBattleAudio({ ageIds: ['modern', 'bronze'] });
    const view = { squads: [{ x: 0, y: 0, side: 0 }, { x: 0, y: 0, side: 1 }] };
    audio.events([{ type: 'shot', from: 0, to: 1 }], view);
    const afterOne = FakeAudioContext.oscillators;
    expect(afterOne).toBeGreaterThan(0);
    audio.events(Array.from({ length: 50 }, () => ({ type: 'shot', from: 0, to: 1 })), view);
    expect(FakeAudioContext.oscillators).toBe(afterOne); // within the cooldown: nothing more
  });

  it('muting is remembered and silences everything', () => {
    expect(isBattleAudioEnabled()).toBe(true);
    const audio = createBattleAudio();
    audio.setEnabled(false);
    expect(isBattleAudioEnabled()).toBe(false);
    const again = createBattleAudio();
    again.events([{ type: 'impact', x: 0, y: 0, radius: 2000 }], { squads: [] });
    expect(FakeAudioContext.instances).toBe(0);
    setBattleAudioEnabled(true);
  });

  it('does nothing (and does not throw) without WebAudio', () => {
    delete window.AudioContext;
    const audio = createBattleAudio();
    expect(() => { audio.unlock(); audio.orderConfirmed(); audio.events([{ type: 'melee', to: 0 }], { squads: [{ x: 0, y: 0 }] }); audio.dispose(); }).not.toThrow();
  });
});
