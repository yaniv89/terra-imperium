// Sound stops whenever the page is away (hidden, put away, frozen, app paused, a phone's window
// blurred) and comes back only when it returns and sound is still wanted.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { pageAudible, isPageAudible, subscribePageAudio, setPageStateForTest, resetPageStateForTest } from './pageLifecycle';
import { musicWanted } from './music';

describe('pageAudible (pure)', () => {
  it('is audible on a visible, focused page', () => {
    expect(pageAudible({})).toBe(true);
    expect(pageAudible({ phone: true })).toBe(true);
  });
  it('is silent when hidden, put away, frozen or the app is in the background', () => {
    expect(pageAudible({ hidden: true })).toBe(false);
    expect(pageAudible({ pagehidden: true })).toBe(false);
    expect(pageAudible({ frozen: true })).toBe(false);
    expect(pageAudible({ appPaused: true })).toBe(false);
  });
  it('a lost focus silences a phone (locked iPhone) but not a desktop window', () => {
    expect(pageAudible({ blurred: true, phone: true })).toBe(false);
    expect(pageAudible({ blurred: true, phone: false })).toBe(true);
  });
});

describe('music wanted with the page state', () => {
  const base = { started: true, sound: true, volume: 0.5, suppressed: false, trackCount: 3 };
  it('plays only when the page is audible', () => {
    expect(musicWanted({ ...base, hidden: !pageAudible({}) })).toBe(true);
    expect(musicWanted({ ...base, hidden: !pageAudible({ hidden: true }) })).toBe(false);
    expect(musicWanted({ ...base, hidden: !pageAudible({ blurred: true, phone: true }) })).toBe(false);
  });
  it('coming back resumes only if music is still wanted', () => {
    expect(musicWanted({ ...base, hidden: false, suppressed: true })).toBe(false);
    expect(musicWanted({ ...base, hidden: false, sound: false })).toBe(false);
  });
});

describe('page audio subscription', () => {
  afterEach(() => resetPageStateForTest());
  it('tells listeners once per change', () => {
    const fn = vi.fn();
    const off = subscribePageAudio(fn);
    setPageStateForTest({ appPaused: true });
    setPageStateForTest({ hidden: true }); // still silent: no second call
    expect(isPageAudible()).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(false);
    setPageStateForTest({ appPaused: false, hidden: false });
    expect(fn).toHaveBeenLastCalledWith(true);
    off();
  });
});
