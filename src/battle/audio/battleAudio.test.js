// The battle audio: the right kind of sound for each sim event, only where the camera looks, quiet
// when muted or hidden, a capped pool of voices however big the battle, recordings when they exist,
// and it never throws without WebAudio.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBattleAudio, isBattleAudioEnabled, setBattleAudioEnabled, soundForEvent, MAX_VOICES, MAX_NEW_PER_FRAME } from './battleAudio';
import { setSoundFilesForTest } from '../../audio/soundRegistry';
import { setPageStateForTest, resetPageStateForTest } from '../../audio/pageLifecycle';

// The suite runs in Node: a minimal window/localStorage stand-in is all this module touches.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), clear: () => store.clear() };
globalThis.window = globalThis;

const param = () => ({ value: 1, setValueAtTime: vi.fn(function set(v) { this.value = v; }), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
const fakeNode = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: param(), frequency: param(), Q: { value: 0 }, pan: param(), playbackRate: { value: 1 }, start: vi.fn(), stop: vi.fn() });
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = fakeNode(); FakeAudioContext.instances += 1; FakeAudioContext.last = this; }
  createGain() { const g = fakeNode(); FakeAudioContext.gains.push(g); return g; }
  createStereoPanner() { return fakeNode(); }
  createBiquadFilter() { return fakeNode(); }
  createBufferSource() { FakeAudioContext.sources += 1; const n = fakeNode(); FakeAudioContext.bufferSources.push(n); return n; }
  createOscillator() { FakeAudioContext.sources += 1; FakeAudioContext.oscillators += 1; return { ...fakeNode(), type: 'sine' }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  decodeAudioData(ab) { return Promise.resolve({ duration: 0.4, from: ab.url }); }
  resume() {} suspend() {} close() {}
}
const resetCounts = () => { FakeAudioContext.instances = 0; FakeAudioContext.sources = 0; FakeAudioContext.oscillators = 0; FakeAudioContext.bufferSources = []; FakeAudioContext.gains = []; };
resetCounts();

// A view of the ground centred on (50, 50), 20 tiles to the right edge and 10 to the top (axis-aligned).
const RECT = { cx: 50, cz: 50, ax: 20, az: 0, bx: 0, bz: 10 };
const Q = 256;
const squad = (idx, x, y, o = {}) => ({ idx, x: x * Q, y: y * Q, side: 0, classId: 'infantry', ageId: 'bronze', alive: true, onField: true, ...o });

let clock = 1000;
describe('battle audio', () => {
  beforeEach(() => {
    localStorage.clear(); setBattleAudioEnabled(true);
    window.AudioContext = FakeAudioContext; resetCounts();
    clock += 10000; vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => { vi.restoreAllMocks(); setSoundFilesForTest(null); delete globalThis.document; });

  it('plays age-appropriate shots and throttles a flood of them', () => {
    const audio = createBattleAudio({ ageIds: ['modern', 'bronze'] });
    const view = { squads: [{ idx: 0, x: 0, y: 0, side: 0, classId: 'ranged', ageId: 'modern' }, { idx: 1, x: 0, y: 0, side: 1 }] };
    expect(soundForEvent({ type: 'shot', from: 0, to: 1 }, view, ['modern', 'bronze'], 0).id).toBe('rifle-fire');
    audio.events([{ type: 'shot', from: 0, to: 1 }], view);
    const afterOne = FakeAudioContext.oscillators;
    expect(afterOne).toBeGreaterThan(0);
    audio.events(Array.from({ length: 50 }, () => ({ type: 'shot', from: 0, to: 1 })), view);
    expect(FakeAudioContext.oscillators).toBe(afterOne); // within the cooldown: nothing more
  });

  it('names the weapon: bows early, a volley for many arrows, spears, cavalry, siege by age', () => {
    const v = { squads: [squad(0, 0, 0, { classId: 'ranged' }), squad(1, 0, 0, { classId: 'siege', ageId: 'kingdoms' }), squad(2, 0, 0, { classId: 'siege', ageId: 'gunpowder' }), squad(3, 0, 0, { classId: 'cavalry' })] };
    const id = (e) => soundForEvent(e, v, ['bronze', 'bronze'], 0).id;
    expect(id({ type: 'shot', from: 0, to: 3 })).toBe('arrow-release');
    expect(id({ type: 'shot', from: 1, to: 3 })).toBe('trebuchet-release');
    expect(id({ type: 'shot', from: 2, to: 3 })).toBe('cannon-fire');
    expect(['cavalry-charge', 'chariot-rumble']).toContain(id({ type: 'melee', from: 3, to: 0, damage: 5 }));
    expect(id({ type: 'destroyed', id: 0 })).toBe('death-cry');
  });

  it('only where the camera looks: off screen builds nothing, at the edge quieter, inside full', () => {
    const audio = createBattleAudio();
    audio.setView(RECT);
    const view = { squads: [squad(0, 50, 50), squad(1, 50, 50), squad(2, 200, 50), squad(3, 75, 50)] };
    audio.unlock();
    audio.events([{ type: 'melee', from: 2, to: 2, damage: 3 }], view); // 150 tiles off: silent
    expect(FakeAudioContext.sources).toBe(0);
    audio.events([{ type: 'melee', from: 3, to: 3, damage: 3 }], view); // a quarter screen past the edge
    expect(FakeAudioContext.sources).toBeGreaterThan(0);
    const edgeGain = FakeAudioContext.gains.find((g) => g.gain.setValueAtTime.mock.calls.length)?.gain.value;
    expect(edgeGain).toBeGreaterThan(0);
    expect(edgeGain).toBeLessThan(0.8); // sword-clash's level 0.8 at full
  });

  it('silent while the tab is hidden; the result screen stops the field but not the victory sting', () => {
    globalThis.document = { hidden: true, addEventListener: () => {}, removeEventListener: () => {} };
    const audio = createBattleAudio();
    audio.setView(RECT);
    const view = { squads: [squad(0, 50, 50)] };
    audio.events([{ type: 'melee', from: 0, to: 0, damage: 3 }, { type: 'ended', outcome: 'attacker' }], view);
    expect(FakeAudioContext.sources).toBe(0);
    globalThis.document.hidden = false;
    audio.setVisible(false);
    clock += 5000;
    audio.events([{ type: 'melee', from: 0, to: 0, damage: 3 }], view);
    expect(FakeAudioContext.sources).toBe(0);
    audio.events([{ type: 'ended', outcome: 'attacker' }], view);
    expect(FakeAudioContext.sources).toBeGreaterThan(0);
  });

  it('a locked phone or backgrounded app suspends the context; back on screen resumes it', () => {
    const audio = createBattleAudio();
    audio.unlock();
    const ctx = FakeAudioContext.last;
    ctx.suspend = vi.fn(() => { ctx.state = 'suspended'; });
    ctx.resume = vi.fn(() => { ctx.state = 'running'; });
    setPageStateForTest({ appPaused: true });
    expect(ctx.suspend).toHaveBeenCalled();
    audio.unlock(); // a stray gesture while away must not wake it
    expect(ctx.resume).not.toHaveBeenCalled();
    setPageStateForTest({ appPaused: false });
    expect(ctx.resume).toHaveBeenCalled();
    resetPageStateForTest();
    audio.dispose();
  });

  it('600 squads: a few new sounds a frame on a pool of at most 16 voices', () => {
    const audio = createBattleAudio({ ageIds: ['gunpowder', 'bronze'] });
    audio.setView(RECT);
    const classes = ['infantry', 'ranged', 'cavalry', 'siege'];
    const squads = Array.from({ length: 600 }, (_, i) => squad(i, 40 + (i % 20), 45 + (i % 10), { classId: classes[i % 4], ageId: i % 2 ? 'gunpowder' : 'bronze', side: i % 2 }));
    const view = { squads, structures: [] };
    let maxNew = 0;
    for (let f = 0; f < 60; f++) {
      clock += 50;
      const before = FakeAudioContext.sources;
      const events = squads.flatMap((q, i) => [{ type: i % 3 ? 'melee' : 'shot', from: q.idx, to: (q.idx + 1) % 600, damage: i % 5 }, ...(i % 50 === 0 ? [{ type: 'destroyed', id: q.idx }, { type: 'impact', x: q.x, y: q.y, radius: 300 }] : [])]);
      audio.events(events, view);
      maxNew = Math.max(maxNew, FakeAudioContext.sources - before);
    }
    const stats = audio.voiceStats();
    expect(stats.pool).toBeLessThanOrEqual(MAX_VOICES);
    expect(stats.busy).toBeLessThanOrEqual(MAX_VOICES);
    // Each sound is at most a handful of nodes; MAX_NEW_PER_FRAME sounds a frame at the most.
    expect(maxNew).toBeLessThanOrEqual(MAX_NEW_PER_FRAME * 4);
  });

  it('uses the recordings in the id folder once loaded, a random variant', async () => {
    const view = { squads: [squad(0, 50, 50), squad(1, 50, 50)] };
    const id = soundForEvent({ type: 'melee', from: 0, to: 1, damage: 4 }, view, ['bronze', 'bronze'], 0).id; // sword-clash or spear-thrust, by the unit's name
    setSoundFilesForTest({ battle: { [id]: ['clash-1.ogg', 'clash-2.ogg'] } });
    globalThis.fetch = vi.fn((url) => Promise.resolve({ arrayBuffer: () => Promise.resolve({ url }) }));
    const audio = createBattleAudio();
    audio.setView(RECT);
    audio.events([{ type: 'melee', from: 0, to: 1, damage: 4 }], view); // starts loading; the synth plays meanwhile
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    FakeAudioContext.bufferSources = [];
    clock += 1000;
    audio.events([{ type: 'melee', from: 0, to: 1, damage: 4 }], view);
    expect(FakeAudioContext.bufferSources.some((s) => ['clash-1.ogg', 'clash-2.ogg'].includes(s.buffer?.from))).toBe(true);
    delete globalThis.fetch;
  });

  it('muting is remembered and silences everything', () => {
    expect(isBattleAudioEnabled()).toBe(true);
    const audio = createBattleAudio();
    audio.setEnabled(false);
    expect(isBattleAudioEnabled()).toBe(false);
    expect(store.get('terra-imperium-battle-audio')).toBe('off');
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
