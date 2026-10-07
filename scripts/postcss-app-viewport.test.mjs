// vh / dvh in the CSS become shares of the measured visible area (iOS Safari, src/utils/appViewport.js).
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import appViewportUnits, { rewriteViewportUnits } from './postcss-app-viewport.js';

describe('postcss app viewport units', () => {
  it('rewrites vh, dvh and lvh, keeps svh', () => {
    expect(rewriteViewportUnits('55vh')).toBe('calc(55 * var(--app-vh, 1vh))');
    expect(rewriteViewportUnits('calc(100dvh - var(--header-height, 2.5rem) - 0.375rem)')).toBe('calc(calc(100 * var(--app-vh, 1vh)) - var(--header-height, 2.5rem) - 0.375rem)');
    expect(rewriteViewportUnits('min(40rem, 88.5lvh)')).toBe('min(40rem, calc(88.5 * var(--app-vh, 1vh)))');
    expect(rewriteViewportUnits('100svh')).toBe('100svh');
  });
  it('leaves custom properties, at-rule params and other units alone', async () => {
    const css = ':root{--app-vh:1vh}@supports (height:1dvh){.a{height:100dvh}}.b{width:100vw;max-height:60vh}';
    const out = (await postcss([appViewportUnits]).process(css, { from: undefined })).css;
    expect(out).toContain('--app-vh:1vh');
    expect(out).toContain('@supports (height:1dvh)');
    expect(out).toContain('height:calc(100 * var(--app-vh, 1vh))');
    expect(out).toContain('width:100vw');
    expect(out).toContain('max-height:calc(60 * var(--app-vh, 1vh))');
  });
});
