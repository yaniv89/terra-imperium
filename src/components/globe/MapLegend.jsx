// src/components/globe/MapLegend.jsx
// The map's legend in the Field Atlas look (plans/UI-DESIGN.md section 2): territories are a soft
// tint in the owner's colour with one crisp border (yours blue, rivals in their colours, an enemy at
// war outlined in danger red, independents violet and dashed), and the three fog states (W03):
// visible, explored ("last seen"), unexplored. `FogLegend` is the one-row chip shown on every
// layout while the fog of war is on; the full legend only where there is room (the desktop).
import React from 'react';
import { useGame } from '../../context/GameContext';
import { fogOn } from '../../engine/fog';

const Swatch = ({ style, className = '' }) => <span className={`inline-block w-3 h-3 rounded-sm shrink-0 ${className}`} style={style} aria-hidden="true" />;

export const FogLegend = () => {
  const { state } = useGame();
  if (!fogOn(state)) return null;
  return (
    <div className="flex items-center gap-3 px-3 min-h-[32px] rounded-full bg-fa-panel/95 border border-fa-line text-[12px] text-fa-text pointer-events-auto shadow-lg" data-testid="fog-legend" aria-label="Fog of war legend">
      <span className="flex items-center gap-1.5"><Swatch style={{ background: '#8FA36A' }} />Visible</span>
      <span className="flex items-center gap-1.5"><Swatch style={{ background: '#5A5F63' }} />Explored</span>
      <span className="flex items-center gap-1.5"><Swatch style={{ background: '#0B0E12', border: '1px solid var(--fa-line)' }} />Unexplored</span>
    </div>
  );
};

const MapLegend = () => (
  <div className="hidden lg:block fa-panel p-2.5 text-[12px] space-y-1.5" data-testid="map-legend">
    <div className="fa-label mb-1">Legend</div>
    <div className="flex items-center gap-2"><Swatch style={{ background: 'rgba(91,155,240,0.25)', border: '2px solid var(--fa-you)' }} /><span>Your land</span></div>
    <div className="flex items-center gap-2"><Swatch style={{ background: 'rgba(238,138,58,0.2)', border: '2px solid var(--fa-enemy)' }} /><span>Another people (each its own colour)</span></div>
    <div className="flex items-center gap-2"><Swatch style={{ background: 'rgba(229,96,77,0.15)', border: '2px solid var(--fa-danger)' }} /><span>At war with you</span></div>
    <div className="flex items-center gap-2"><Swatch style={{ background: 'rgba(156,143,208,0.18)', border: '2px dashed var(--fa-indep)' }} /><span>Independent city</span></div>
  </div>
);

export default MapLegend;
