// src/components/map/Map2DMarkersOverlay.jsx
// Armies, fleets and last turn's battles drawn on the flat map (plan §4a/4b), at screen scale so a
// banner stays the same size at any zoom. Positions come from the d3 projection plus the live
// pan/zoom transform. Banners that would overlap merge into a numbered cluster; tapping a cluster
// zooms in on it. Zoomed out (below FOREIGN_MIN_ZOOM) only your own armies and battles show.
import React, { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { markerLatLng } from '../../utils/markerPosition';
import { REGIONS_DATA } from '../../data/regions';
import { getMapMarkers } from '../../utils/mapMarkers';
import { getAtWarNationIds } from '../../utils/mapRegionStyle';
import { openBattleReport } from '../battle/battleReportEvents';
import { ARMY_SPOT, unitPx } from './closeView/scale';
import { clusterBannerHtml, clusterScreenMarkers, MARKER_OFFSET, markerHtml, markerItems } from './mapBanners';

export const FOREIGN_MIN_ZOOM = 2;
const CLUSTER_RADIUS_PX = 22;
const EDGE_PX = 30;

const describe = (m) => {
  const where = REGIONS_DATA[m.regionId]?.name || m.regionId;
  if (m.kind === 'battle') return `Battle at ${where}: open the report`;
  if (m.kind === 'colony') return `${m.own ? 'Your' : 'A foreign'} colony in ${where}, ${Math.round(m.progress || 0)}% grown`;
  if (!m.own) return `${m.kind === 'fleet' ? 'Foreign fleet' : 'Foreign army'} in ${where}`;
  return m.kind === 'fleet' ? `Your fleet in ${where}` : `Your army in ${where}, ${m.men} soldiers${m.supply != null && m.supply < 30 ? `, supply ${m.supply}` : ''}`;
};

// `close`: the close view is on (Map2DView CLOSE_ZOOM_K). Armies are drawn as soldiers there, so
// their banners shrink to a small tag above the figures.
const Map2DMarkersOverlay = ({ projection, transform, width, height, onSelectRegion, onZoomTo, onSelectTile = null, onSelectArmy = null, close = false }) => {
  const { state } = useGame();
  const markers = useMemo(() => getMapMarkers(state),
    // Only what the markers read: units, ownership, alliances, intel and battles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.units, state.regions, state.nations, state.intel, state.battleReports, state.turnNumber, state.playerNationId]);
  const atWar = useMemo(() => getAtWarNationIds(state.wars, state.playerNationId), [state.wars, state.playerNationId]);

  const placed = useMemo(() => {
    if (!projection) return [];
    const showForeign = transform.k >= FOREIGN_MIN_ZOOM;
    const items = [];
    markerItems(markers, showForeign).forEach((m) => {
      const c = markerLatLng(m);
      const p = c && projection([c.lng, c.lat]);
      if (!p) return;
      // In the close view an army's banner becomes a small tag over its soldiers.
      const s = unitPx(transform.k);
      const [ox, oy] = close && m.kind === 'army' ? [s * ARMY_SPOT.x, s * ARMY_SPOT.y - s * 2.2 - 10] : MARKER_OFFSET[m.kind];
      const x = p[0] * transform.k + transform.x + ox;
      const y = p[1] * transform.k + transform.y + oy;
      if (x < -EDGE_PX || y < -EDGE_PX || x > width + EDGE_PX || y > height + EDGE_PX) return;
      items.push({ ...m, x, y });
    });
    return clusterScreenMarkers(items, CLUSTER_RADIUS_PX);
  }, [markers, projection, transform, width, height, close]);

  if (!placed.length) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]" data-testid="map-markers">
      {placed.map((c) => {
        const single = c.members.length === 1;
        const html = single ? markerHtml(c, atWar.has(c.ownerId)) : clusterBannerHtml(c.members.length, c.members.some((m) => m.own && m.kind !== 'battle'));
        const onClick = (e) => {
          e.stopPropagation();
          if (!single) { onZoomTo?.(c.regionId); return; }
          if (c.kind === 'battle') openBattleReport(c.id);
          else if (!c.own && c.kind === 'army' && c.tile != null && onSelectTile) onSelectTile(c.tile); // a foreign army: its tile (attack it from the tile sheet)
          else if (c.own && c.kind === 'army' && c.tile != null && onSelectArmy && state.regions[state.world?.tileOwner?.[c.tile]]?.tile !== c.tile) onSelectArmy(c.tile); // your army in the field: its sheet (a garrison on its city tile belongs to the city card)
          else onSelectRegion?.(c.regionId);
        };
        return (
          <button
            key={c.key}
            type="button"
            className={`map-banner pointer-events-auto${single && !c.own ? ' foreign' : ''}${close && single && c.kind === 'army' ? ' close-tag' : ''}`}
            // In the close view an army's banner is a smaller tag above its 3D soldiers (the scale goes last
            // in the transform, so it does not shrink the position).
            style={{ transform: `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px) translate(-50%, -50%)${close && single && c.kind === 'army' ? ' scale(0.72)' : ''}` }}
            data-marker={single ? c.kind : 'cluster'}
            data-region-id={c.regionId}
            aria-label={single ? describe(c) : `${c.members.length} markers: zoom in`}
            title={single ? describe(c) : `${c.members.length} markers: zoom in`}
            onClick={onClick}
            // Built from numbers and fixed ids only (mapBanners.js), never from player text.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
};

export default Map2DMarkersOverlay;
