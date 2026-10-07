// The game's one Web Audio context: suspended whenever the page is away, resumed only when it is
// back (and retried after an iOS interruption), shared by every player, and no lock screen media
// session that could restart anything.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { contextAction, getAudioContext, unlockAudio, resumeAudio, clearMediaSession, setAmbientAudioSession, audioDebugInfo, resetAudioContextForTest } from './audioContext';
import { setPageStateForTest, resetPageStateForTest } from './pageLifecycle';
import { createFakeAudioContext } from './testAudioContext';

describe('context state machine (pure)', () => {
  it('suspends a running context when the page is away, leaves an idle one alone', () => {
    expect(contextAction({ state: 'running', audible: false })).toBe('suspend');
    expect(contextAction({ state: 'suspended', audible: false })).toBe('none');
    expect(contextAction({ state: 'interrupted', audible: false })).toBe('none');
  });
  it('resumes a suspended or interrupted context only when the page is on screen', () => {
    expect(contextAction({ state: 'suspended', audible: true })).toBe('resume');
    expect(contextAction({ state: 'interrupted', audible: true })).toBe('resume');
    expect(contextAction({ state: 'running', audible: true })).toBe('none');
  });
  it('a closed or missing context: nothing', () => {
    expect(contextAction({ state: 'closed', audible: true })).toBe('none');
    expect(contextAction({ state: null, audible: false })).toBe('none');
  });
});

describe('the shared context', () => {
  afterEach(() => { resetAudioContextForTest(); resetPageStateForTest(); vi.unstubAllGlobals(); });

  it('is one context for every caller', () => {
    const made = vi.fn(() => createFakeAudioContext());
    resetAudioContextForTest(made);
    expect(getAudioContext({ create: false })).toBe(null);
    const a = unlockAudio();
    expect(getAudioContext()).toBe(a);
    expect(made).toHaveBeenCalledTimes(1);
  });

  it('follows the page: away suspends, a tap while away does not wake it, back resumes', () => {
    const ctx = createFakeAudioContext();
    resetAudioContextForTest(() => ctx);
    unlockAudio();
    setPageStateForTest({ pagehidden: true });
    expect(ctx.state).toBe('suspended');
    unlockAudio(); resumeAudio();
    expect(ctx.resumeCalls).toBe(0);
    setPageStateForTest({ pagehidden: false });
    expect(ctx.state).toBe('running');
    expect(audioDebugInfo().log.some((l) => /page away \(pagehidden\)/.test(l))).toBe(true);
  });

  it('a context created while the page is away starts suspended', () => {
    setPageStateForTest({ frozen: true });
    const ctx = createFakeAudioContext();
    resetAudioContextForTest(() => ctx);
    unlockAudio();
    expect(ctx.state).toBe('suspended');
  });

  it('asks iOS for the ambient audio session and leaves the lock screen nothing to show', () => {
    const handlers = { play: () => {}, pause: () => {} };
    const ms = { playbackState: 'playing', metadata: { title: 'x' }, setActionHandler: (a, h) => { if (h) handlers[a] = h; else delete handlers[a]; } };
    const audioSession = { type: 'auto' };
    vi.stubGlobal('navigator', { mediaSession: ms, audioSession });
    setAmbientAudioSession();
    expect(audioSession.type).toBe('ambient');
    clearMediaSession();
    expect(ms.metadata).toBe(null);
    expect(ms.playbackState).toBe('none');
    expect(Object.keys(handlers)).toEqual([]);
  });

  it('creating the context also clears the media session and sets the session type', () => {
    const ms = { playbackState: 'playing', metadata: {}, setActionHandler: vi.fn() };
    const audioSession = { type: 'playback' };
    vi.stubGlobal('navigator', { mediaSession: ms, audioSession });
    resetAudioContextForTest(() => createFakeAudioContext());
    unlockAudio();
    expect(audioSession.type).toBe('ambient');
    expect(ms.playbackState).toBe('none');
    expect(ms.setActionHandler).toHaveBeenCalledWith('play', null);
  });
});
