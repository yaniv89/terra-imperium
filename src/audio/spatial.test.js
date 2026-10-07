// Battle sound only where the player looks: full inside the view, a fade over half a screen past
// the edge, nothing beyond, nothing while hidden; the ambience follows the fighting on screen.
import { describe, it, expect } from 'vitest';
import { audibility, viewCoords, ambienceTarget, easeLevel, FADE } from './spatial';

// A view centred on (50, 40): 20 tiles to the right edge, 10 to the top edge, turned like the
// isometric camera (right is +x+z, up is -x+z).
const s = Math.SQRT1_2;
const view = { cx: 50, cz: 40, ax: 20 * s, az: 20 * s, bx: -10 * s, bz: 10 * s };
const at = (u, v) => ({ x: view.cx + u * view.ax + v * view.bx, z: view.cz + u * view.az + v * view.bz });

describe('positional battle sound', () => {
  it('maps the ground into screen coordinates', () => {
    const p = at(0.5, -0.25);
    const c = viewCoords(p.x, p.z, view);
    expect(c.u).toBeCloseTo(0.5);
    expect(c.v).toBeCloseTo(-0.25);
  });

  it('inside the view: full volume, panned by where it is, distance in tiles', () => {
    const p = at(0.9, 0.5);
    const a = audibility(p.x, p.z, view);
    expect(a.inside).toBe(true);
    expect(a.gain).toBe(1);
    expect(a.pan).toBeGreaterThan(0.5);
    expect(a.dist).toBeCloseTo(Math.hypot(0.9 * 20, 0.5 * 10));
    expect(audibility(view.cx, view.cz, view).pan).toBeCloseTo(0);
  });

  it('past the edge: fades over half a screen', () => {
    const quarter = at(1 + FADE / 2, 0);
    const a = audibility(quarter.x, quarter.z, view);
    expect(a.inside).toBe(false);
    expect(a.gain).toBeCloseTo(0.5);
    const above = at(0, 1 + FADE * 0.8);
    expect(audibility(above.x, above.z, view).gain).toBeCloseTo(0.2);
  });

  it('further out: silent (gain 0: the caller builds nothing)', () => {
    const far = at(1 + FADE * 1.01, 0);
    expect(audibility(far.x, far.z, view).gain).toBe(0);
    const corner = at(-2.5, 3);
    expect(audibility(corner.x, corner.z, view).gain).toBe(0);
  });

  it('hidden (tab hidden, result screen, map open): silent everywhere', () => {
    expect(audibility(view.cx, view.cz, view, { hidden: true }).gain).toBe(0);
  });

  it('the ambience grows with the fighting on screen and eases toward it', () => {
    expect(ambienceTarget(0)).toBe(0);
    expect(ambienceTarget(10)).toBeLessThan(ambienceTarget(80));
    expect(ambienceTarget(1000)).toBeLessThanOrEqual(1);
    const l = easeLevel(0, 1, 0.1);
    expect(l).toBeGreaterThan(0);
    expect(l).toBeLessThan(0.2);
    expect(easeLevel(0.5, 0, 10)).toBeLessThan(0.01);
  });
});
