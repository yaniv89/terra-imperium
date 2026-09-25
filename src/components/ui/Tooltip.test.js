// Plan §M20 "Tooltip v2": unit tests for the pure viewport-flipping geometry, computePosition.
// The project has no jsdom/@testing-library/react in its test setup (vitest.config.js runs in the
// 'node' environment and only Playwright covers real DOM/UI behaviour) — adding a whole RTL harness
// for one component is a bigger infra change than this milestone's UI pass intends, so the actual
// rendering/portal/touch behaviour is left to manual verification and the existing Playwright suite,
// while the one genuinely pure piece of logic (does the bubble flip when it would clip the viewport)
// gets a real, fast unit test here.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computePosition } from './Tooltip';

const rect = (top, left, width, height) => ({ top, left, width, height, bottom: top + height, right: left + width });

// The project's vitest environment is plain 'node' (no jsdom/@testing-library/react — see the file
// header comment), so there is no real `window` global here at all. computePosition only reads
// window.innerWidth/innerHeight, so a bare stub is enough to exercise its pure geometry.
describe('computePosition (Tooltip v2)', () => {
  const hadWindow = typeof globalThis.window !== 'undefined';
  const original = hadWindow ? { innerWidth: globalThis.window.innerWidth, innerHeight: globalThis.window.innerHeight } : null;

  beforeEach(() => {
    globalThis.window = { ...(hadWindow ? globalThis.window : {}), innerWidth: 800, innerHeight: 600 };
  });

  afterEach(() => {
    if (hadWindow) Object.assign(globalThis.window, original);
    else delete globalThis.window;
  });

  it('places a "top" tooltip above the trigger when there is room', () => {
    const trigger = rect(300, 300, 40, 20);
    const bubble = rect(0, 0, 100, 30);
    const pos = computePosition(trigger, bubble, 'top');
    expect(pos.side).toBe('top');
    expect(pos.top).toBe(300 - 30 - 8);
  });

  it('flips to "bottom" when a "top" tooltip would clip above the viewport', () => {
    const trigger = rect(10, 300, 40, 20); // too close to the top for a 30px-tall bubble + gap
    const bubble = rect(0, 0, 100, 30);
    const pos = computePosition(trigger, bubble, 'top');
    expect(pos.side).toBe('bottom');
    expect(pos.top).toBe(30 + 8); // trigger.bottom (30) + GAP
  });

  it('flips "left" to "right" when it would clip the left viewport edge', () => {
    const trigger = rect(300, 10, 40, 20);
    const bubble = rect(0, 0, 100, 30);
    const pos = computePosition(trigger, bubble, 'left');
    expect(pos.side).toBe('right');
  });

  it('clamps horizontally so the bubble never renders past the right viewport edge', () => {
    const trigger = rect(300, 780, 20, 20); // near the right edge
    const bubble = rect(0, 0, 200, 30);
    const pos = computePosition(trigger, bubble, 'top');
    expect(pos.left).toBeLessThanOrEqual(800 - 200 - 8);
  });

  it('keeps the preferred side when both sides would clip (no infinite regress)', () => {
    const trigger = rect(2, 300, 40, 20);
    const bubble = rect(0, 0, 100, 590); // taller than the whole viewport either way
    const pos = computePosition(trigger, bubble, 'top');
    expect(pos.side).toBe('top');
  });
});
