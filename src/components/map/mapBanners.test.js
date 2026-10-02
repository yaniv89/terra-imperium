import { describe, it, expect } from 'vitest';
import { armyBannerHtml, clusterGlobeItems, clusterScreenMarkers, markerItems, moraleColor } from './mapBanners';

const markers = {
  armies: [{ id: 'a', regionId: 'fr-75', own: true, men: 12000, morale: 80, mainClass: 'infantry', canMove: true }, { id: 'b', regionId: 'es-z', own: false, ownerId: 'es', band: null }],
  fleets: [{ id: 'f', regionId: 'fr-35', own: false, ownerId: 'gb' }],
  battles: [{ id: 'battle-1', regionId: 'de-bw', won: true }]
};

describe('map banners', () => {
  it('lists own markers first and drops foreign ones when zoomed out', () => {
    expect(markerItems(markers, true).map((m) => m.key)).toEqual(['army:a', 'battle:battle-1', 'army:b', 'fleet:f']);
    expect(markerItems(markers, false).map((m) => m.key)).toEqual(['army:a', 'battle:battle-1']);
  });

  it('shows soldiers on own banners and only a question mark on foreign ones', () => {
    expect(armyBannerHtml(markers.armies[0])).toContain('12k');
    expect(armyBannerHtml(markers.armies[0])).toContain('map-banner-dot');
    const foreign = armyBannerHtml(markers.armies[1]);
    expect(foreign).toContain('?');
    expect(foreign).not.toContain('map-banner-label');
    expect(moraleColor(20)).toBe('#ef4444');
  });

  it('merges banners that would overlap', () => {
    const c = clusterScreenMarkers([{ key: 1, x: 0, y: 0 }, { key: 2, x: 10, y: 5 }, { key: 3, x: 100, y: 0 }], 22);
    expect(c.map((x) => x.members.length)).toEqual([2, 1]);
    const g = clusterGlobeItems([{ key: 'a', kind: 'army', own: true, lat: 48, lng: 2 }, { key: 'b', kind: 'army', own: true, lat: 48.5, lng: 2.5 }, { key: 'c', kind: 'army', own: false, lat: 40, lng: -3 }], 3);
    expect(g[0]).toMatchObject({ kind: 'cluster', count: 2, ownCluster: true });
    expect(g[1].key).toBe('c');
  });
});
