// src/components/battle/battleCoach.test.js
// RTS-01: touch words for touch and mouse words for a mouse, true to gestures.js; the coach is
// once per device and survives storage that is missing or throws.
import { beforeEach, describe, expect, it } from 'vitest';
import { coachSeen, markCoachSeen, resetCoachSession, coachSteps, deployHelp, cameraHelp, mouseFirst, COACH_KEY } from './battleCoach';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
const win = ({ fine, touchPoints = 0, coarse = false }) => ({
  navigator: { maxTouchPoints: touchPoints },
  matchMedia: (q) => ({ matches: q === '(pointer: fine)' ? fine : q === '(any-pointer: coarse)' ? coarse : false })
});

describe('the first-battle coach', () => {
  beforeEach(() => resetCoachSession());

  it('shows once per device', () => {
    const s = memory();
    expect(coachSeen(s)).toBe(false);
    markCoachSeen(s);
    expect(s.getItem(COACH_KEY)).toBe('1');
    resetCoachSession();
    expect(coachSeen(s)).toBe(true);
  });

  it('blocked storage never throws, and the coach still shows only once a session', () => {
    expect(coachSeen(broken)).toBe(false);
    expect(() => markCoachSeen(broken)).not.toThrow();
    expect(coachSeen(broken)).toBe(true);
    expect(coachSeen(null)).toBe(true);
  });

  it('three steps; touch words never speak of the mouse, mouse words never of taps', () => {
    const touch = coachSteps(false); const mouse = coachSteps(true);
    expect(touch).toHaveLength(3); expect(mouse).toHaveLength(3);
    const t = [...touch.map((s) => s.text), deployHelp(false), cameraHelp(false)].join(' ');
    const m = [...mouse.map((s) => s.text), deployHelp(true), cameraHelp(true)].join(' ');
    expect(t).not.toMatch(/click|right drag|wheel|arrow keys/i);
    expect(t).toMatch(/pinch/); expect(t).toMatch(/one finger/i); expect(t).toMatch(/Attack, then tap/);
    expect(m).not.toMatch(/\btap\b|pinch|finger/i);
  });

  it('the touch steps teach the controls in order: path, circle, hold', () => {
    expect(coachSteps(false).map((s) => s.title)).toEqual(['Draw a path', 'Circle to select', 'Hold for help']);
  });

  it('a mouse only when the pointer is fine and there is no touch screen', () => {
    expect(mouseFirst(win({ fine: true }))).toBe(true);
    expect(mouseFirst(win({ fine: true, touchPoints: 5 }))).toBe(false);
    expect(mouseFirst(win({ fine: false, coarse: true }))).toBe(false);
    expect(mouseFirst(null)).toBe(false);
  });
});
