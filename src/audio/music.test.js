// The map music on Web Audio: decoded tracks on the shared context (never a media element, which
// iOS keeps playing on the lock screen), the crossfade on the audio clock, the battle stopping
// and releasing it, the page going away suspending the context, and the memory it takes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startMusic, suppressMusic, startBattleMusic, musicMode, playlistLevels, dbToGain, BATTLE_MUSIC_DB, musicStep, musicDecodeRate, decodedBytes, musicDebugState, tickMusicForTest, resetMusicForTest, CROSSFADE_S, PRELOAD_S, PARK_AFTER_MS, PHONE_DECODE_RATE } from './music';
import { resetAudioContextForTest } from './audioContext';
import { setSoundFilesForTest } from './soundRegistry';
import { setPageStateForTest, resetPageStateForTest } from './pageLifecycle';
import { createFakeAudioContext, fakeFetch } from './testAudioContext';

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
// Tracks start 50 ms ahead on the audio clock.
const settle = async (ctx) => { await flush(); ctx.advance(0.1); };

describe('music step (pure)', () => {
  it('decodes the next track PRELOAD_S before the end and crossfades CROSSFADE_S before it', () => {
    expect(musicStep({ now: 10, startAt: 0, duration: 120 }).preload).toBe(false);
    expect(musicStep({ now: 120 - PRELOAD_S, startAt: 0, duration: 120 }).preload).toBe(true);
    expect(musicStep({ now: 100, startAt: 0, duration: 120, nextReady: true }).schedule).toBe(false);
    const s = musicStep({ now: 115, startAt: 0, duration: 120, nextReady: true });
    expect(s.schedule).toBe(true);
    expect(s.at).toBe(120 - CROSSFADE_S);
    expect(musicStep({ now: 115, startAt: 0, duration: 120, nextReady: false }).schedule).toBe(false);
  });
  it('a late next track starts at once', () => {
    expect(musicStep({ now: 119, startAt: 0, duration: 120, nextReady: true }).at).toBe(119);
  });
});

describe('music memory', () => {
  it('phones decode at a lower rate; the worst pair of tracks stays near 100 MB', () => {
    expect(musicDecodeRate({ phone: true, contextRate: 48000 })).toBe(PHONE_DECODE_RATE);
    expect(musicDecodeRate({ phone: false, contextRate: 48000 })).toBe(48000);
    expect(musicDecodeRate({ phone: false, contextRate: 96000 })).toBe(48000);
    expect(musicDecodeRate({ phone: false, contextRate: 44100 })).toBe(44100);
    // The longest track (300 s) and the next (233 s), both decoded during a crossfade.
    const phonePair = decodedBytes(300, PHONE_DECODE_RATE) + decodedBytes(233, PHONE_DECODE_RATE);
    expect(phonePair / 1e6).toBeLessThan(110);
    expect(decodedBytes(300, 48000) / 1e6).toBeCloseTo(115.2, 1);
  });
});

describe('music on Web Audio', () => {
  let ctx;
  beforeEach(() => {
    resetMusicForTest(); resetPageStateForTest();
    ctx = createFakeAudioContext({ durations: { 'a.ogg': 60, 'b.ogg': 50, 'wind.ogg': 45, 'x.ogg': 70, 'y.ogg': 40 } });
    resetAudioContextForTest(() => ctx);
    setSoundFilesForTest({ music: ['a.ogg', 'b.ogg'], battleMusic: ['x.ogg', 'y.ogg'], ambience: { 'map-wind': ['wind.ogg'] } });
    vi.stubGlobal('fetch', vi.fn(fakeFetch));
    vi.stubGlobal('Audio', vi.fn());
  });
  afterEach(() => {
    resetMusicForTest(); resetAudioContextForTest(); resetPageStateForTest(); setSoundFilesForTest(null);
    vi.unstubAllGlobals(); vi.useRealTimers();
  });

  it('plays the first track and the ambience as buffers, never a media element', async () => {
    startMusic();
    await settle(ctx);
    expect(ctx.playingUrls().sort()).toEqual(['a.ogg', 'wind.ogg']);
    expect(ctx.playing().find((s) => s.buffer.url === 'wind.ogg').loop).toBe(true);
    expect(globalThis.Audio).not.toHaveBeenCalled();
    expect(musicDebugState().track).toMatch(/^1\/2 a\.ogg/);
  });

  it('crossfades into the next track on the audio clock and releases the old one', async () => {
    startMusic();
    await settle(ctx);
    ctx.advance(25); tickMusicForTest(); await flush(); // 35 s left: b is decoded
    expect(musicDebugState().next).toBe('track 2 ready');
    ctx.advance(30); tickMusicForTest(); // 5 s left: the crossfade is scheduled
    const b = ctx.sources.find((s) => s.buffer?.url === 'b.ogg');
    expect(Math.abs(b.startedAt - (60 - CROSSFADE_S))).toBeLessThan(0.1);
    ctx.advance(2);
    expect(ctx.playingUrls().sort()).toEqual(['a.ogg', 'b.ogg', 'wind.ogg']); // both, mid-crossfade
    ctx.advance(CROSSFADE_S);
    expect(ctx.playingUrls().sort()).toEqual(['b.ogg', 'wind.ogg']);
    expect(musicDebugState().fadingOut).toBe(0);
    expect(musicDebugState().track).toMatch(/^2\/2/);
  });

  it('suppressed, it fades out, then stops and releases everything; after it the track picks up where it was', async () => {
    vi.useFakeTimers();
    startMusic();
    await settle(ctx);
    ctx.advance(20);
    const release = suppressMusic('test');
    expect(ctx.playingUrls().length).toBe(2); // fading
    vi.advanceTimersByTime(PARK_AFTER_MS + 10);
    expect(ctx.playing().length).toBe(0);
    expect(musicDebugState().decodedMB).toBe(0);
    release();
    await settle(ctx);
    const again = ctx.playing().find((s) => s.buffer?.url === 'a.ogg');
    expect(again.offset).toBeCloseTo(20, 0);
  });

  it('the page going away suspends the context and mutes the bus at once; back on screen resumes', async () => {
    startMusic();
    await settle(ctx);
    setPageStateForTest({ hidden: true });
    expect(ctx.state).toBe('suspended');
    expect(ctx.suspendCalls).toBe(1);
    expect(Number(musicDebugState().bus)).toBe(0);
    setPageStateForTest({ hidden: false });
    expect(ctx.state).toBe('running');
    expect(Number(musicDebugState().bus)).toBeGreaterThan(0);
  });

  it('iOS interrupting the context while on screen: resume is tried', async () => {
    startMusic();
    await settle(ctx);
    const before = ctx.resumeCalls;
    ctx.setState('interrupted');
    expect(ctx.resumeCalls).toBe(before + 1);
    expect(ctx.state).toBe('running');
  });

  it('does nothing without Web Audio', () => {
    resetAudioContextForTest();
    expect(() => { startMusic(); suppressMusic('test')(); startBattleMusic()(); }).not.toThrow();
  });
});

describe('map and battle playlists (pure)', () => {
  it('a battle screen holding the music switches to the battle playlist', () => {
    expect(musicMode({ battleHolds: 0 })).toBe('map');
    expect(musicMode({ battleHolds: 1 })).toBe('battle');
  });
  it('only the mode\'s playlist is heard, the battle one about 4 dB lower', () => {
    expect(playlistLevels({ mode: 'map', on: true })).toEqual({ map: 1, battle: 0 });
    const b = playlistLevels({ mode: 'battle', on: true });
    expect(b.map).toBe(0);
    expect(b.battle).toBeCloseTo(dbToGain(BATTLE_MUSIC_DB), 6);
    expect(b.battle).toBeCloseTo(0.631, 3);
    expect(playlistLevels({ mode: 'battle', on: false })).toEqual({ map: 0, battle: 0 });
  });
});

describe('map and battle playlists on Web Audio', () => {
  let ctx;
  beforeEach(() => {
    resetMusicForTest(); resetPageStateForTest();
    ctx = createFakeAudioContext({ durations: { 'a.ogg': 60, 'b.ogg': 50, 'wind.ogg': 45, 'x.ogg': 70, 'y.ogg': 40 } });
    resetAudioContextForTest(() => ctx);
    setSoundFilesForTest({ music: ['a.ogg', 'b.ogg'], battleMusic: ['x.ogg', 'y.ogg'], ambience: { 'map-wind': ['wind.ogg'] } });
    vi.stubGlobal('fetch', vi.fn(fakeFetch));
    vi.useFakeTimers();
  });
  afterEach(() => {
    resetMusicForTest(); resetAudioContextForTest(); resetPageStateForTest(); setSoundFilesForTest(null);
    vi.unstubAllGlobals(); vi.useRealTimers();
  });

  it('a battle crossfades the map music into the battle playlist, and back to the map where it was', async () => {
    startMusic();
    await settle(ctx);
    ctx.advance(20);
    const end = startBattleMusic();
    await settle(ctx);
    // Mid-switch: the map fading out, the battle music fading in.
    expect(ctx.playingUrls().sort()).toEqual(['a.ogg', 'wind.ogg', 'x.ogg']);
    const st = musicDebugState();
    expect(st.mode).toBe('battle');
    expect(Number(st.level)).toBe(0); // the map playlist's level target
    expect(Number(st.battle.level)).toBeCloseTo(0.63, 2);
    vi.advanceTimersByTime(PARK_AFTER_MS + 10);
    expect(ctx.playingUrls()).toEqual(['x.ogg']); // map and its ambience released
    ctx.advance(10);
    end();
    await settle(ctx);
    const back = ctx.playing().find((s) => s.buffer?.url === 'a.ogg');
    expect(back.offset).toBeCloseTo(20, 0);
    expect(musicDebugState().mode).toBe('map');
    vi.advanceTimersByTime(PARK_AFTER_MS + 10);
    expect(ctx.playingUrls().sort()).toEqual(['a.ogg', 'wind.ogg']);
  });

  it('the battle playlist crossfades from track to track like the map one', async () => {
    startMusic();
    await settle(ctx);
    startBattleMusic();
    await settle(ctx);
    ctx.advance(40); vi.advanceTimersByTime(600); await flush(); // 30 s left of x: y decoded
    ctx.advance(26); vi.advanceTimersByTime(600); // 4 s left: crossfade scheduled
    ctx.advance(1);
    expect(ctx.playingUrls()).toEqual(expect.arrayContaining(['x.ogg', 'y.ogg']));
    expect(musicDebugState().battle.track).toMatch(/^2\/2 y\.ogg/);
  });

  it('a short battle: the map music never stopped, it just comes back up', async () => {
    startMusic();
    await settle(ctx);
    const end = startBattleMusic();
    await settle(ctx);
    vi.advanceTimersByTime(1000);
    end();
    expect(Number(musicDebugState().level)).toBe(1);
    vi.advanceTimersByTime(PARK_AFTER_MS + 10);
    expect(ctx.playingUrls().sort()).toEqual(['a.ogg', 'wind.ogg']);
    expect(musicDebugState().battle.track).toBe('none');
  });

  it('the Music switch silences the battle playlist too; the page away suspends it like the rest', async () => {
    const { setAudioSettings } = await import('./audioSettings');
    startMusic();
    await settle(ctx);
    startBattleMusic();
    await settle(ctx);
    setPageStateForTest({ hidden: true });
    expect(ctx.state).toBe('suspended');
    expect(Number(musicDebugState().bus)).toBe(0);
    setPageStateForTest({ hidden: false });
    expect(ctx.state).toBe('running');
    setAudioSettings({ musicOn: false });
    vi.advanceTimersByTime(PARK_AFTER_MS + 10);
    expect(ctx.playing().length).toBe(0);
    setAudioSettings({ musicOn: true });
    await settle(ctx);
    expect(ctx.playingUrls()).toEqual(['x.ogg']);
  });

  it('with no battle tracks a battle is silent, as before', async () => {
    setSoundFilesForTest({ music: ['a.ogg'], battleMusic: [], ambience: {} });
    startMusic();
    await settle(ctx);
    startBattleMusic();
    vi.advanceTimersByTime(PARK_AFTER_MS + 10);
    expect(ctx.playing().length).toBe(0);
  });
});
