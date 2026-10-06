// src/components/map/CityBanners.jsx
// City banners in the close view, in the manner of Civilization's: a pill under each town with a
// disc of the owner's colour holding the city's size, a star for a capital, the name, and the
// city's state in small marks (a siege bar, a loyalty warning, an outpost's progress). HTML over
// the 3D canvas, so no building can hide a name; tapping a banner selects the city. Further out
// the SVG badges carry the cities (Map2DView).
import React, { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { cityLatLon } from '../../data/geo/cityFeatures';
import { getNationColor } from '../../data/nationColors';
import { loyaltyOf } from '../../engine/loyalty';
import { OUTPOST_DONE } from '../../engine/settlers';
import { markerIconUrl } from '../../data/icons';
import { townTier } from './closeView/townTiers';
import { townUnitPx, townRoomUnits, townGapUnits, TIER_SCALE } from './closeView/scale';
import { getTiles } from '../../data/geo/tiles';

const EDGE_PX = 80;
// The banner hangs just under the town's front edge (and its wall ring): the ground is about
// `modelRadius` units across each way at `pxPerUnit` (the town's hex-capped scale), foreshortened
// by the tilt.
export const bannerOffsetPx = (modelRadius, pxPerUnit) => (modelRadius + 0.35) * pxPerUnit * 0.8 + 6;

const CityBanners = ({ projection, transform, width, height, onSelect, selectedRegion = null, playerColor }) => {
  const { state } = useGame();
  const cities = useMemo(() => Object.values(state.regions).filter((c) => c.owner || c.colony), [state.regions]);
  const townTiles = useMemo(() => new Set(cities.filter((c) => c.tile != null).map((c) => c.tile)), [cities]);
  const isTown = (t) => townTiles.has(t);
  if (!projection) return null;
  const k = transform.k;
  const out = [];
  cities.forEach((city) => {
    const ll = cityLatLon(state, city.id);
    const p = ll && projection([ll.lng, ll.lat]);
    if (!p) return;
    const x = p[0] * k + transform.x;
    const tier = city.owner && !city.outpost ? townTier(city) : null;
    const radius = tier ? tier.modelRadius : 1;
    // the same size rule as the town itself (CloseViewLayer), walls included
    const capRadius = radius + ((city.buildings?.categories?.defense ?? -1) >= 0 ? 0.3 : 0);
    const room = Math.min(townRoomUnits(projection, getTiles(), city.tile), townGapUnits(projection, getTiles(), city.tile, isTown));
    const y = p[1] * k + transform.y + bannerOffsetPx(radius, townUnitPx(k, capRadius, room * k, tier ? TIER_SCALE[tier.id] || 1 : 1));
    if (x < -EDGE_PX || y < -EDGE_PX || x > width + EDGE_PX || y > height + EDGE_PX) return;
    const owner = city.owner || city.colony?.ownerId;
    const own = owner === state.playerNationId;
    const colour = own ? playerColor : getNationColor(owner) || '#94a3b8';
    const selected = city.id === selectedRegion;
    const siege = city.siege ? Math.max(0, Math.min(1, city.siege.hp / Math.max(1, city.siege.maxHp))) : null;
    const outpost = city.outpost ? Math.max(0, Math.min(1, (city.outpost.progress || 0) / OUTPOST_DONE)) : null;
    const disloyal = city.owner && loyaltyOf(city) <= 25;
    out.push(
      <button
        key={city.id}
        type="button"
        className={`city-banner pointer-events-auto${selected ? ' selected' : ''}${own ? ' own' : ''}`}
        style={{ transform: `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, 0)`, '--banner-colour': colour }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(city.id, e); }}
        data-city-banner={city.id}
        aria-label={`${city.name}${city.isCapital ? ', capital' : ''}, size ${city.size || 1}`}
      >
        <span className="city-banner-size">{outpost != null ? '⛺' : city.size || 1}</span>
        <span className="city-banner-name">
          {city.isCapital && (markerIconUrl('capital') ? <img src={markerIconUrl('capital')} alt="" className="city-banner-star city-banner-icon" width={14} height={14} draggable={false} /> : <span className="city-banner-star" aria-hidden="true">★</span>)}
          {city.name}
          {disloyal && <span className="city-banner-warn" title="Loyalty is low" data-loyalty-warning={city.id}>!</span>}
          {city.siege && <span className="city-banner-siege" title="Under siege" data-siege-badge={city.id}>{markerIconUrl('battle') ? <img src={markerIconUrl('battle')} alt="" className="city-banner-icon" width={14} height={14} draggable={false} /> : '⚔'}</span>}
        </span>
        {(siege != null || outpost != null) && (
          <span className="city-banner-bar" aria-hidden="true">
            <span style={{ width: `${Math.round((siege ?? outpost) * 100)}%`, background: siege != null ? '#f97316' : '#fde68a' }} />
          </span>
        )}
      </button>
    );
  });
  if (!out.length) return null;
  return <div className="absolute inset-0 pointer-events-none overflow-hidden z-[4]" data-testid="city-banners">{out}</div>;
};

export default CityBanners;
