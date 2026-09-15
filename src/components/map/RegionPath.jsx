// src/components/map/RegionPath.jsx
// Individual SVG region path component

import React, { memo } from 'react';
import { MAP_PATHS } from '../../data/mapPaths';
import { REGIONS_DATA } from '../../data/regions';

const RegionPath = memo(({ 
  regionId,
  regionState,
  nation,
  isSelected,
  isHovered,
  currentZoom,
  onClick,
  onMouseEnter,
  onMouseLeave
}) => {
  const pathData = MAP_PATHS[regionId];
  const regionData = REGIONS_DATA[regionId];

  if (!pathData || !pathData.path || !regionData) return null;

  // Visual Styling Logic
  const getFillColor = () => {
    // Player Owned (Heatmap style)
    if (regionState.owner === 'player') {
      const control = regionState.control || 0;
      if (control >= 80) return '#4ade80'; // bright green
      if (control >= 60) return '#84cc16'; // lime
      if (control >= 40) return '#facc15'; // yellow
      if (control >= 20) return '#fb923c'; // orange
      return '#f87171'; // soft red
    }
    
    // War State
    if (nation?.isAtWar) return '#fca5a5'; // light red background for war target
    
    // Standard Political Map Colors
    return nation?.color || '#d1d5db'; // Default gray-ish for neutral
  };

  const getStrokeColor = () => {
    if (isSelected) return '#2563eb'; // Bright Blue
    if (isHovered) return '#3b82f6'; // Blue
    if (regionState.underInvasion) return '#ef4444'; // Red
    return '#525252'; // Neutral dark grey border (political map style)
  };

  // Dynamic stroke width based on zoom to keep lines crisp
  const baseStroke = isSelected || isHovered ? 2 : 0.8;
  const strokeWidth = baseStroke / currentZoom; 

  return (
    <g
      data-region-id={regionId}
      onClick={() => onClick(regionId)}
      onMouseEnter={() => onMouseEnter(regionId)}
      onMouseLeave={() => onMouseLeave()}
      className="cursor-pointer"
      style={{ transition: 'opacity 0.2s ease' }}
    >
      {/* Main Land Mass */}
      <path
        d={pathData.path}
        fill={getFillColor()}
        stroke={getStrokeColor()}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke" // backup helper
        className={`
          transition-colors duration-200 outline-none
          ${isHovered ? 'brightness-110' : ''}
          ${regionState.underInvasion ? 'animate-pulse' : ''}
        `}
      />

      {/* Region Label - Scales down slightly as we zoom in so it doesn't block view */}
      <text
        x={pathData.labelX}
        y={pathData.labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-bold fill-slate-800 pointer-events-none select-none font-sans"
        style={{ 
          fontSize: `${(regionData.type === 'core' ? 8 : 6) / Math.sqrt(currentZoom)}px`, // Dynamic font size
          textShadow: '0 0 2px rgba(255,255,255,0.7)'
        }}
      >
        {regionData.name.toUpperCase()}
      </text>

      {/* Invasion Icon */}
      {regionState.underInvasion && (
        <text
          x={pathData.labelX}
          y={pathData.labelY + (10 / currentZoom)}
          textAnchor="middle"
          style={{ fontSize: `${10 / currentZoom}px` }}
          className="pointer-events-none select-none animate-bounce"
        >
          ⚔️
        </text>
      )}

      {/* Capital Star */}
      {regionData.isCapital && (
        <path
          transform={`translate(${pathData.labelX}, ${pathData.labelY - (8 / currentZoom)}) scale(${1/currentZoom})`}
          d="M0,-3 L1,-1 L3,-1 L1.5,0.5 L2,2.5 L0,1.5 L-2,2.5 L-1.5,0.5 L-3,-1 L-1,-1 Z"
          fill="#fbbf24"
          stroke="#78350f"
          strokeWidth="0.5"
          className="pointer-events-none"
        />
      )}
    </g>
  );
});

RegionPath.displayName = 'RegionPath';

export default RegionPath;