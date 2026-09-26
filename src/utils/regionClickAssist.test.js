import { describe, it, expect } from 'vitest';
import { findClickAssistRegionId, resolveClickedRegionId, CLICK_ASSIST_MAX_PIXEL_DISTANCE } from './regionClickAssist';

// The lat/lng values here are arbitrary placeholders — findClickAssistRegionId never interprets
// them itself, it only feeds them to `project` and compares the returned screen coordinates.
// `extent` is only read by resolveClickedRegionId's tests below; findClickAssistRegionId ignores it.
const REGIONS = {
  tiny_a: { lat: 1, lng: 1, extent: 1 },
  tiny_b: { lat: 2, lng: 2, extent: 1 },
  big_c: { lat: 3, lng: 3, extent: 10 }
};

const projectAt = (positions) => (lat, lng) => positions[`${lat},${lng}`] || null;

describe('findClickAssistRegionId', () => {
  it('picks the one visible candidate within tolerance', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: true },
      '2,2': { x: 500, y: 500, visible: true },
      '3,3': { x: 900, y: 900, visible: true }
    });
    expect(findClickAssistRegionId(REGIONS, project, 105, 102)).toBe('tiny_a');
  });

  it('returns null when no candidate is within tolerance', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: true },
      '2,2': { x: 500, y: 500, visible: true },
      '3,3': { x: 900, y: 900, visible: true }
    });
    expect(findClickAssistRegionId(REGIONS, project, 300, 300)).toBeNull();
  });

  it('picks the closer of two candidates that are both within tolerance', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: true },
      '2,2': { x: 110, y: 100, visible: true },
      '3,3': { x: 900, y: 900, visible: true }
    });
    // Click sits between tiny_a (dist 5) and tiny_b (dist 5) but closer to tiny_b.
    expect(findClickAssistRegionId(REGIONS, project, 108, 100)).toBe('tiny_b');
  });

  it('ignores a candidate reported as not visible (behind the globe), even if geometrically close', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: false },
      '2,2': { x: 500, y: 500, visible: true },
      '3,3': { x: 900, y: 900, visible: true }
    });
    expect(findClickAssistRegionId(REGIONS, project, 101, 101)).toBeNull();
  });

  it('ignores a candidate the projector could not place at all (returns null)', () => {
    const project = () => null;
    expect(findClickAssistRegionId(REGIONS, project, 100, 100)).toBeNull();
  });

  it('respects a custom max distance', () => {
    const project = projectAt({ '1,1': { x: 100, y: 100, visible: true } });
    const single = { tiny_a: REGIONS.tiny_a };
    expect(findClickAssistRegionId(single, project, 100 + CLICK_ASSIST_MAX_PIXEL_DISTANCE + 1, 100, CLICK_ASSIST_MAX_PIXEL_DISTANCE)).toBeNull();
    expect(findClickAssistRegionId(single, project, 100 + CLICK_ASSIST_MAX_PIXEL_DISTANCE + 1, 100, CLICK_ASSIST_MAX_PIXEL_DISTANCE + 5)).toBe('tiny_a');
  });
});

// Bug fix (plan feedback: "still can't pick Tel Aviv") — reproduces the exact bug shape: a tiny
// enclave (tiny_a, e.g. Tel Aviv) sits inside a much bigger neighbor (big_c, e.g. HaMerkaz) whose own
// label point can legitimately project closer to some pixels that still land, correctly, inside
// tiny_a's own polygon (that's what made it the raw hit in the first place) than tiny_a's own label
// does. Comparing raw-hit distance alone isn't enough to rule this out (the bigger neighbor's label
// really can be nominally closer even to a valid click) — only comparing SIZE (`extent`) does:
// a candidate the assist can redirect to must be smaller than whatever was actually hit.
describe('resolveClickedRegionId (plan feedback: never redirect away from the smallest thing already hit)', () => {
  it('keeps the raw hit when the only nearby candidate is BIGGER, no matter how close its label is', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: true }, // tiny_a's own label — 9px from the click
      '3,3': { x: 105, y: 100, visible: true } // big_c's label — only 4px away, closer, but big_c is BIGGER than tiny_a
    });
    // The click (109, 100) landed on tiny_a's real polygon (that's the raw hit) — big_c's label is
    // technically closer on screen, but big_c is a bigger region than what was actually hit, so it's
    // never even considered as a replacement.
    expect(resolveClickedRegionId('tiny_a', REGIONS, project, 109, 100)).toBe('tiny_a');
  });

  it('still rescues a genuine miss: the raw hit is the big region, but a smaller region\'s label is nearby', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: true }, // tiny_a's label sits right next to the click
      '3,3': { x: 500, y: 500, visible: true } // big_c's own label is far from the click
    });
    // The click landed inside big_c's polygon (a real miss of the small region tucked inside it) —
    // tiny_a is smaller than big_c, so it's a valid replacement candidate.
    expect(resolveClickedRegionId('big_c', REGIONS, project, 102, 100)).toBe('tiny_a');
  });

  it('never redirects toward a same-size or bigger candidate, even one right on top of the click', () => {
    const project = projectAt({
      '1,1': { x: 100, y: 100, visible: true }, // tiny_a: the raw hit
      '2,2': { x: 100, y: 100, visible: true } // tiny_b: same extent, projects to the exact same pixel
    });
    expect(resolveClickedRegionId('tiny_a', REGIONS, project, 100, 100)).toBe('tiny_a');
  });

  it('falls back to the raw hit when it has no size data at all', () => {
    const project = projectAt({ '2,2': { x: 100, y: 100, visible: true } });
    expect(resolveClickedRegionId('unknown_region', REGIONS, project, 100, 100)).toBe('unknown_region');
  });

  it('falls back to the raw hit when no smaller candidate is within tolerance', () => {
    const project = projectAt({ '1,1': { x: 100, y: 100, visible: true } });
    expect(resolveClickedRegionId('tiny_a', REGIONS, project, 100, 100)).toBe('tiny_a');
  });
});
