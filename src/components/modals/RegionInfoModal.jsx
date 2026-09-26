// src/components/modals/RegionInfoModal.jsx
// Region information modal/panel with close button

import React from 'react';
import { MapPin, X, Shield, Users, Building, Target, AlertTriangle, Flag, Swords, Settings2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { REGIONS_DATA } from '../../data/regions';
import { isAtWarWithPlayer } from '../../engine/diplomacy';
import { formatNumber, getControlColor, getRelationColor, getFieldedStrength, getDisplayPopulation } from '../../utils/helpers';
import { useIsMobile } from '../../hooks/useIsMobile';
import ProgressBar from '../ui/ProgressBar';

// Plan feedback: on mobile the old corner-panel treatment (absolute, no height cap) could grow
// taller than the small mobile map itself, hiding the very region you just tapped and spilling
// past the map card's edges. On mobile this now renders as a real bottom sheet instead — `fixed`
// to the viewport (not confined to the map's own small bounding box), capped height with its own
// scroll, sliding up from below the whole screen rather than floating on top of the map.
const RegionInfoModal = ({ regionId, onClose, onManage, position = 'panel' }) => {
  const { state } = useGame();
  const isMobile = useIsMobile();

  // No persistent "select a region" placeholder on mobile — an always-visible empty-state sheet
  // would just be more of the same clutter this change is trying to reduce. Desktop keeps it,
  // since there it's a small, stationary corner hint, not a sheet competing for screen space.
  if (!regionId) {
    if (isMobile && position === 'panel') return null;
    return (
      <div className={`
        ${position === 'panel'
          ? 'absolute top-2 left-2 z-20'
          : 'relative'
        }
        bg-slate-900/95 backdrop-blur-sm p-3 rounded-lg text-xs min-w-[180px]
        border border-slate-700 shadow-xl
      `}>
        <div className="text-slate-400 italic flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>Select a region on the map</span>
        </div>
      </div>
    );
  }

  const regionData = REGIONS_DATA[regionId];
  const regionState = state.regions[regionId];

  if (!regionData || !regionState) return null;

  const isPlayerOwned = regionState.owner === state.playerNationId;
  const ownerNation = !isPlayerOwned ? state.nations[regionState.owner] : null;

  const mobileSheet = isMobile && position === 'panel';

  return (
    <div className={
      mobileSheet
        ? 'fixed inset-x-0 bottom-0 z-30 max-h-[50vh] overflow-y-auto rounded-t-2xl bg-slate-900/98 backdrop-blur-sm p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs border-t border-slate-700 shadow-2xl'
        : `${position === 'panel' ? 'absolute top-2 left-2 z-20' : 'relative'}
           bg-slate-900/95 backdrop-blur-sm p-3 rounded-lg text-xs min-w-[220px] max-w-[280px]
           border border-slate-700 shadow-xl`
    }>
      {mobileSheet && (
        <div className="flex justify-center mb-2 -mt-1">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-700 pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{regionData.name}</div>
            <div className="text-slate-500 text-[10px] capitalize">{regionData.terrain}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Owner */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400">Owner:</span>
        <span className={`font-semibold ${isPlayerOwned ? 'text-blue-400' : ''}`} style={{ color: !isPlayerOwned ? ownerNation?.color : undefined }}>
          {isPlayerOwned ? state.nations[state.playerNationId]?.name : ownerNation?.name || 'Unknown'}
        </span>
      </div>

      {/* Civ-style "manage this region" entry point (plan feedback: region actions used to live
          in the Domestic/Military tabs, overcrowding them) — always shown so even a foreign
          region can be inspected in the full modal, same as Civilization lets you open any city. */}
      {onManage && (
        <button
          onClick={onManage}
          className="w-full flex items-center justify-center gap-1.5 mb-2 py-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Manage Region
        </button>
      )}

      {/* Player-owned region info */}
      {isPlayerOwned && (
        <>
          {/* Control */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400">Control:</span>
              <span className="font-mono font-bold" style={{ color: getControlColor(regionState.control) }}>
                {regionState.control}%
              </span>
            </div>
            <ProgressBar value={regionState.control} color="dynamic" size="small" />
          </div>

          {/* Infrastructure */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Building className="w-3 h-3" /> Infrastructure:
            </span>
            <span className="font-mono text-slate-300">
              {regionState.currentInfrastructure}/10
            </span>
          </div>

          {/* Population */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> Population:
            </span>
            <span className="font-mono text-slate-300">
              {formatNumber(getDisplayPopulation(regionState, regionData, state.year))}
            </span>
          </div>
        </>
      )}

      {/* Foreign region info */}
      {!isPlayerOwned && ownerNation && (
        <>
          {/* Relation Status */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400">Relation:</span>
            <span className="font-semibold" style={{ color: getRelationColor(ownerNation.relationStatus) }}>
              {ownerNation.relationStatus}
            </span>
          </div>

          {/* Military Power */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Swords className="w-3 h-3" /> Military:
            </span>
            <span className="font-mono text-red-400">
              {formatNumber(getFieldedStrength(state, regionState.owner))}
            </span>
          </div>

          {/* Siege progress (src/engine/siege.js) — only shown once this region has actually been
              fought over, so an untouched foreign region doesn't clutter the panel with a number
              that's never mattered yet. */}
          {regionState.lastAttackedTurn != null && (
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-400">Control:</span>
                <span className="font-mono font-bold" style={{ color: getControlColor(regionState.control) }}>
                  {regionState.control}%
                </span>
              </div>
              <ProgressBar value={regionState.control} color="dynamic" size="small" />
            </div>
          )}

          {/* Hostility */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400">Hostility:</span>
            <span className="font-mono text-orange-400">
              {ownerNation.hostility}%
            </span>
          </div>

          {/* Treaties */}
          <div className="flex flex-wrap gap-1 mt-2">
            {ownerNation.hasPeaceTreaty && (
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                ✓ Peace Treaty
              </span>
            )}
            {ownerNation.hasTradeAgreement && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                ✓ Trade Agreement
              </span>
            )}
            {isAtWarWithPlayer(state, ownerNation.id) && (
              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] animate-pulse">
                ⚔ At War
              </span>
            )}
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-slate-700 mt-2 pt-2">
        {/* Strategic Info */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 flex items-center gap-1">
            <Target className="w-3 h-3" /> Strategic Value:
          </span>
          <span className="font-mono text-slate-300">
            {regionData.strategicValue}/10
          </span>
        </div>

        {/* Fortification */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Shield className="w-3 h-3" /> Fortification:
          </span>
          <span className="font-mono text-slate-300">
            {regionData.fortification}
          </span>
        </div>
      </div>

      {/* Status badges */}
      <div className="mt-2 space-y-1">
        {regionState.underInvasion && (
          <div className="flex items-center gap-1.5 text-orange-400 font-semibold animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            <span>Under Invasion!</span>
          </div>
        )}
        {regionState.occupiedBy && (
          <div className="flex items-center gap-1.5 text-yellow-400 text-[10px]">
            <Flag className="w-3 h-3" />
            <span>Occupied by {state.nations[regionState.occupiedBy]?.name || 'Unknown'}</span>
          </div>
        )}
        {regionData.isCapital && (
          <div className="flex items-center gap-1.5 text-purple-400 text-[10px]">
            <Flag className="w-3 h-3" />
            <span>Capital City</span>
          </div>
        )}
      </div>

      {/* Description */}
      {regionData.description && (
        <div className="mt-2 pt-2 border-t border-slate-700 text-slate-500 text-[10px] italic">
          {regionData.description}
        </div>
      )}
    </div>
  );
};

export default RegionInfoModal;
