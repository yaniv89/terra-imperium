// src/components/globe/MapLegend.jsx
// The map's legend in the Field Atlas look (plans/UI-DESIGN.md section 2): territories are a soft
// tint in the owner's colour with one crisp border (yours blue, rivals in their colours, an enemy at
// war outlined in danger red, independents violet and dashed), shown with the mini map where there
// is room (the desktop). The fog legend chip (Visible / Explored / Unexplored) was removed in the
// map HUD cleanup: the three fog looks read on their own.
import React from 'react';

const Swatch = ({ style, className = '' }) => <span className={`inline-block w-3 h-3 rounded-sm shrink-0 ${className}`} style={style} aria-hidden="true" />;

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
