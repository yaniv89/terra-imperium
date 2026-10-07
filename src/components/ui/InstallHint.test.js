// The "Add to Home Screen" hint: only on iPhone / iPad in a browser tab, once.
import { describe, it, expect } from 'vitest';
import { wantsInstallHint } from './InstallHint';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

describe('wantsInstallHint', () => {
  it('iPhone Safari in a tab', () => expect(wantsInstallHint({ userAgent: IPHONE })).toBe(true));
  it('an iPad that reports a Mac', () => expect(wantsInstallHint({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true));
  it('never in the home screen app, once seen, or on other devices', () => {
    expect(wantsInstallHint({ userAgent: IPHONE, standalone: true })).toBe(false);
    expect(wantsInstallHint({ userAgent: IPHONE, displayModeApp: true })).toBe(false);
    expect(wantsInstallHint({ userAgent: IPHONE, seen: true })).toBe(false);
    expect(wantsInstallHint({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' })).toBe(false);
    expect(wantsInstallHint({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });
});
