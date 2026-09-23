import { describe, it, expect } from 'vitest';
import { findClickAssistRegionId, CLICK_ASSIST_MAX_PIXEL_DISTANCE } from './regionClickAssist';

// The lat/lng values here are arbitrary placeholders — findClickAssistRegionId never interprets
// them itself, it only feeds them to `project` and compares the returned screen coordinates.
const REGIONS = {
  tiny_a: { lat: 1, lng: 1 },
  tiny_b: { lat: 2, lng: 2 },
  big_c: { lat: 3, lng: 3 }
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
