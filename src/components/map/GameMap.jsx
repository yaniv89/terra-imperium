// src/components/map/GameMap.jsx
// Main interactive SVG map of the Middle East

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { MAP_PATHS, MAP_VIEWBOX, MEDITERRANEAN_SEA, RED_SEA, PERSIAN_GULF } from '../../data/mapPaths';
import { RegionInfoModal } from '../modals';
import RegionPath from './RegionPath';
import MapLegend from './MapLegend';
import MapControls from './MapControls';
import CombatEffectsLayer from './CombatEffectsLayer';
import { useCombatEffects } from '../../context/CombatEffectsContext';

const GameMap = ({ selectedRegion, onSelectRegion }) => {
  const { state } = useGame();
  const { effects } = useCombatEffects();
  const [hoveredRegion, setHoveredRegion] = useState(null);
  
  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const mapContainerRef = useRef(null);

  // Display region (hovered takes priority)
  const displayRegion = hoveredRegion || selectedRegion;

  // --- Zoom Logic ---
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => {
      const newZoom = Math.max(z - 0.5, 1);
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // --- MOUSE Drag Logic (Desktop) ---
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (mapContainerRef.current) mapContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (mapContainerRef.current) mapContainerRef.current.style.cursor = zoom > 1 ? 'grab' : 'default';
  };

  // --- TOUCH Drag Logic (Mobile) ---
  const handleTouchStart = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    // Prevent default to stop the whole page from scrolling while dragging map
    if (e.cancelable) e.preventDefault(); 
    
    const touch = e.touches[0];
    const dx = touch.clientX - lastMousePos.current.x;
    const dy = touch.clientY - lastMousePos.current.y;
    
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // --- Interaction Handlers ---
  const handleRegionClick = useCallback((regionId) => {
    if (isDragging) return; 
    onSelectRegion(regionId === selectedRegion ? null : regionId);
  }, [selectedRegion, onSelectRegion, isDragging]);

  const handleRegionHover = useCallback((regionId) => {
    setHoveredRegion(regionId);
  }, []);

  const handleRegionLeave = useCallback(() => {
    setHoveredRegion(null);
  }, []);

  // --- Sorting & Rendering ---
  const sortedRegionIds = useMemo(() => {
    const regionIds = Object.keys(REGIONS_DATA);
    const typeOrder = { foreign: 0, capturable: 1, contested: 2, core: 3 };
    return regionIds.sort((a, b) => {
      const typeA = typeOrder[REGIONS_DATA[a].type] || 0;
      const typeB = typeOrder[REGIONS_DATA[b].type] || 0;
      return typeA - typeB;
    });
  }, []);

  return (
    <div className="relative w-full h-full bg-[#a5d5f2] rounded-lg overflow-hidden select-none border border-slate-700 shadow-2xl">
      <RegionInfoModal 
        regionId={displayRegion} 
        onClose={() => onSelectRegion(null)}
        position="panel"
      />

      <MapControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleResetView}
        minZoom={1}
        maxZoom={4}
      />

      <MapLegend collapsed={zoom > 1.5} />

      {/* Interactive Container */}
      <div 
        ref={mapContainerRef}
        className="w-full h-full overflow-hidden"
        // Mouse Events
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        // Touch Events (New)
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: zoom > 1 ? 'grab' : 'default',
          touchAction: 'none' // Critical for mobile performance
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg
            viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
            className="w-full h-full max-w-full max-h-full drop-shadow-xl"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="coastlineShadow" x="-50%" y="-50%" width="200%" height="200%">
                 <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#0ea5e9" floodOpacity="0.5"/>
              </filter>
            </defs>

            {/* Ocean Backgrounds */}
            <path d={MEDITERRANEAN_SEA.path} fill="#7dd3fc" opacity="0.4" />
            <path d={RED_SEA.path} fill="#7dd3fc" opacity="0.4" />
            <path d={PERSIAN_GULF.path} fill="#7dd3fc" opacity="0.4" />

            {/* Labels for Seas */}
            <g className="pointer-events-none select-none opacity-60">
                <text x="100" y="200" className="text-[14px] fill-blue-900 italic font-serif">Mediterranean Sea</text>
                <text x="220" y="550" className="text-[12px] fill-blue-900 italic font-serif" transform="rotate(20 220 550)">Red Sea</text>
                <text x="650" y="420" className="text-[12px] fill-blue-900 italic font-serif">Persian Gulf</text>
            </g>

            {/* Render Regions */}
            {sortedRegionIds.map(regionId => {
              const regionState = state.regions[regionId];
              const nation = regionState.owner !== 'player' 
                ? state.nations[regionState.owner] 
                : null;

              if (!MAP_PATHS[regionId]) return null;

              return (
                <RegionPath
                  key={regionId}
                  regionId={regionId}
                  regionState={regionState}
                  nation={nation}
                  isSelected={selectedRegion === regionId}
                  isHovered={hoveredRegion === regionId}
                  currentZoom={zoom}
                  onClick={handleRegionClick}
                  onMouseEnter={handleRegionHover}
                  onMouseLeave={handleRegionLeave}
                />
              );
            })}

            {/* Missile/airstrike effects (Phase 14) — always on top of region fills */}
            <CombatEffectsLayer effects={effects} />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-2 right-2 text-[10px] text-slate-600 font-medium bg-white/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
         {zoom === 1 ? 'Zoom in to enable pan' : 'Drag to pan'}
      </div>
    </div>
  );
};

export default GameMap;