// src/components/map/Map2DView.jsx
// A flat, CK3-style world map — the same real admin-1 province geometry the 3D globe uses
// (loadGameRegionFeatures), projected to a rectangle instead of a sphere via d3-geo. Shares the
// same selectedRegion/onSelectRegion contract and the same region coloring rules
// (src/utils/mapRegionStyle.js) as GlobeView, so switching map modes never changes what a color
// or outline means — only how the world is projected.
//
// Rendered as one <path> per region in a single <svg>. The expensive part (turning each feature's
// lat/lng geometry into an SVG path string) is memoized on [width, height, polygons] only; fill and
// stroke are computed per-render (cheap: a couple of object lookups), the same split GlobeView's
// own capColor/strokeColor already uses for the same reason.
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { loadGameRegionFeatures } from '../../data/geo/loadGameRegions';
import { getAtWarNationIds, getRegionFillColor, getRegionStrokeColor } from '../../utils/mapRegionStyle';

const OCEAN_COLOR = '#0f172a'; // matches GlobeView's OCEAN_COLOR / backgroundColor

// `interactive: false` is the minimap's own mode: no click handling, no hover title, and a
// slightly thinner/absent stroke so a few thousand paths stay cheap to render at a tiny size.
// Loads its own geometry (loadGameRegionFeatures() below) rather than taking it as a prop —
// that loader already caches at the module level (see its own file), so a second Map2DView
// instance (the minimap, alongside the main flat map) re-fetches nothing.
const Map2DView = ({ width, height, selectedRegion, onSelectRegion, interactive = true }) => {
  const { state } = useGame();
  const [polygons, setPolygons] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadGameRegionFeatures().then((f) => { if (!cancelled) setPolygons(f.gameRegionFeatures); });
    return () => { cancelled = true; };
  }, []);

  const atWarNationIds = useMemo(() => getAtWarNationIds(state.wars, state.playerNationId), [state.wars, state.playerNationId]);

  const pathsById = useMemo(() => {
    if (!polygons || width <= 0 || height <= 0) return null;
    const projection = geoEquirectangular().fitSize([width, height], { type: 'FeatureCollection', features: polygons });
    const pathGen = geoPath(projection);
    const map = new Map();
    polygons.forEach((feature) => {
      const gameRegionId = feature.properties?.gameRegionId;
      if (!gameRegionId) return;
      map.set(gameRegionId, pathGen(feature));
    });
    return map;
  }, [polygons, width, height]);

  const handleClick = useCallback((gameRegionId) => {
    if (!interactive) return;
    onSelectRegion(gameRegionId === selectedRegion ? null : gameRegionId);
  }, [interactive, onSelectRegion, selectedRegion]);

  if (!pathsById) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm" style={{ background: OCEAN_COLOR }}>
        {polygons ? null : 'Loading world map…'}
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: OCEAN_COLOR, display: 'block' }}
    >
      <g>
        {[...pathsById.entries()].map(([gameRegionId, d]) => {
          if (!d) return null;
          const fill = getRegionFillColor(state.regions, state.playerNationId, gameRegionId);
          const stroke = interactive
            ? getRegionStrokeColor(state.regions, state.playerNationId, gameRegionId, selectedRegion, atWarNationIds)
            : 'rgba(0,0,0,0.4)';
          return (
            <path
              key={gameRegionId}
              d={d}
              fill={fill}
              stroke={stroke}
              strokeWidth={gameRegionId === selectedRegion ? 1.5 : 0.4}
              onClick={interactive ? () => handleClick(gameRegionId) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
            >
              {interactive && <title>{REGIONS_DATA[gameRegionId]?.name || gameRegionId}</title>}
            </path>
          );
        })}
      </g>
    </svg>
  );
};

export default Map2DView;
